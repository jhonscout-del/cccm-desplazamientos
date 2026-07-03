# Arquitectura — CCCM Check-in de viajeros

## 1. Visión general

```
┌─────────────────────┐        ┌──────────────────────┐
│   Navegador / PWA    │        │   Microsoft Entra ID  │
│  React + Vite + MSAL │◄──────►│  (login + tokens)     │
│  IndexedDB (Dexie)   │        └──────────────────────┘
└──────────┬───────────┘
           │ REST (Bearer token de Azure AD)
           ▼
┌─────────────────────┐        ┌──────────────────────┐
│  Backend Node/Express │◄──────►│  Microsoft Graph API  │
│  SQLite (fuente de    │        │  - sendMail (correo)  │
│  verdad operativa)    │        │  - SharePoint lists   │
└──────────────────────┘        └──────────────────────┘
```

- El **frontend** es una PWA (React + Vite) que corre 100% en el
  navegador/dispositivo del usuario, con una copia local de los datos en
  IndexedDB para que funcione sin conexión.
- El **backend** es una API Node/Express con SQLite como base de datos.
  Es la única fuente de verdad para la lógica de negocio (quién puede
  cerrar qué, numeración de códigos, panel de control).
- **Microsoft Entra ID** (Azure AD) provee el login — no existen usuarios
  ni contraseñas propias del sistema.
- **Microsoft Graph** se usa para dos cosas independientes: enviar el
  correo (`sendMail`, con permiso delegado del usuario logueado) y
  reflejar los registros en listas de SharePoint (con permisos de
  aplicación de un App Registration separado).

## 2. Frontend

| Carpeta | Contenido |
|---|---|
| `src/lib/msal.js` | Configuración de MSAL (login) y los dos conjuntos de scopes: `API_SCOPES` (para hablar con nuestro backend) y `MAIL_SCOPES` (para enviar correo vía Graph). |
| `src/lib/api.js` | Cliente HTTP hacia el backend; adjunta el access token de Azure AD en cada request. |
| `src/lib/localdb.js` | Esquema de IndexedDB (Dexie): tablas `viajes`, `trayectos`, `observaciones`. |
| `src/lib/sync.js` | Motor de sincronización offline-first (ver sección 4). |
| `src/lib/email.js` | Construcción y envío de los correos vía Graph `sendMail`. |
| `src/context/AuthContext.jsx` | Envuelve `MsalProvider`, resuelve el perfil del usuario (`/api/auth/me`) y expone `user`, `login`, `logout`. |
| `src/pages/*` | Pantallas: Login, Home (mis viajes), NuevoViaje, ViajeDetalle, Dashboard (control). |
| `src/components/SyncEngine.jsx` | Componente invisible que dispara `syncNow()`/`pullMisViajes()` al iniciar, cada 30s, y al recuperar conexión. |

La app es una **Progressive Web App** (`vite-plugin-pwa`): genera un
service worker que cachea los archivos estáticos para que la interfaz
cargue incluso sin conexión (los datos, aparte, ya viven en IndexedDB).

## 3. Backend

| Archivo | Responsabilidad |
|---|---|
| `server/index.js` | Punto de entrada Express. |
| `server/auth.js` | Valida el access token de Azure AD (JWKS) en cada request y da de alta/actualiza al usuario local a partir de sus claims. |
| `server/db.js` | Esquema SQLite, migraciones idempotentes (`ensureColumn`), y asignación atómica del código secuencial (`nextViajeCodigo`). |
| `server/routes/auth.js` | `GET /api/auth/me`. |
| `server/routes/viajes.js` | CRUD de viajes/trayectos/observaciones y reglas de negocio. |
| `server/graph.js` | Cliente de Microsoft Graph (app-only) para reflejar datos en SharePoint. |
| `server/scripts/provisionSharePoint.js` | Script idempotente para crear/actualizar las listas y columnas de SharePoint. |

### Modelo de datos (SQLite)

```
users        (id, azure_oid, nombre, email, role)
viajes       (id [uuid], codigo [V-0001], user_id, estado, ...datos del check-in..., closed_at)
trayectos    (id [uuid], viaje_id, numero, codigo [V-0001-T2], estado, ...datos..., closed_at)
observaciones(id [uuid], viaje_id, trayecto_id [null si es del viaje], autor, texto, created_at)
counters     (name, value) -- usado para asignar codigo de forma atómica
```

- `role` en `users` solo puede ser `viajero` o `control`; se asigna
  manualmente en la base de datos (ver manual de operación).
- `id` es un UUID generado **en el cliente** (funciona offline); `codigo`
  es un número secuencial legible que asigna **el servidor** en el
  momento de sincronizar — ver la sección 5 para el porqué de esta
  separación.

## 4. Offline-first: cómo funciona la sincronización

Cada registro local (`viajes`, `trayectos`, `observaciones` en Dexie)
tiene sus propios campos de estado:

- `syncStatus`: `pending` → `synced` (creación del registro en el
  backend).
- `emailStatus` / `closeEmailStatus`: `pending` → `sent` / `error`
  (envío del correo correspondiente).
- `closeSyncStatus`: `na` → `pending` → `synced` (cierre del viaje o
  trayecto).

El motor de sincronización (`syncNow()` en `src/lib/sync.js`) recorre
estas colas en orden de dependencia (un trayecto no se sincroniza hasta
que su viaje ya lo esté; un correo de cierre no se intenta hasta que el
cierre ya se sincronizó) y **reintenta solo lo que falta** — es seguro
llamarla repetidamente. Se dispara:

1. Al montar la app (si hay sesión).
2. Cada 30 segundos mientras la app está abierta.
3. Al detectar el evento `online` del navegador.
4. Inmediatamente después de cada acción del usuario (crear, cerrar,
   agregar observación).

`pullMisViajes()` hace el camino inverso: trae del servidor los viajes
del usuario (por si el panel de control cerró alguno, o si el mismo
usuario entra desde otro dispositivo) y actualiza la copia local, sin
pisar nada que todavía esté pendiente de sincronizar localmente.

## 5. Por qué el código de viaje no es el UUID

Los `id` (UUID) se generan en el navegador para que el check-in funcione
sin conexión. Si el número visible (`V-0001`) también se generara en el
cliente, dos viajeros sin señal al mismo tiempo podrían generar el mismo
número y chocar al sincronizar. Por eso:

- El **UUID** es la clave técnica interna, generada offline, sin
  coordinación con nadie.
- El **código legible** (`V-0001`, y para trayectos `V-0001-T2`) lo asigna
  el backend de forma atómica (`nextViajeCodigo()` en `server/db.js`) en
  el instante en que el viaje llega al servidor por primera vez — el
  único lugar donde se puede garantizar que no se repita.

## 6. Autenticación

1. El frontend inicia sesión con MSAL (`loginRedirect`) contra el App
   Registration tipo SPA.
2. Para llamar a nuestra API, MSAL pide un access token con audiencia
   propia (scope `api://<client-id>/access_as_user`, expuesto por el
   mismo App Registration).
3. El backend valida ese token contra las claves públicas de Microsoft
   (JWKS, `server/auth.js`), verificando emisor, audiencia y firma. No
   hay contraseñas ni sesiones propias del backend.
4. Para enviar correo, el frontend pide un **segundo** token, esta vez
   con audiencia `https://graph.microsoft.com` y scope `Mail.Send`
   (delegado) — el correo sale desde el buzón del usuario logueado.

## 7. Integración con SharePoint

`server/graph.js` mantiene un cliente Graph "solo aplicación" (client
credentials, App Registration separado del de login) para escribir en
dos listas de SharePoint: `ViajesCCCM` y `TrayectosCCCM`.

- Cada creación/cierre/observación dispara un **upsert**: busca el ítem
  existente filtrando por `ViajeId`/`TrayectoId` (columnas indexadas) y
  lo actualiza, o lo crea si no existe.
- Es **mejor esfuerzo**: si Graph falla (sin conexión, permisos, etc.),
  el error se registra en el log del servidor pero no rompe la respuesta
  al usuario — SQLite sigue siendo la fuente de verdad; SharePoint es un
  espejo para consulta/exportación.
- Desde la lista de SharePoint, cualquier usuario con acceso puede usar
  **Exportar → Exportar a Excel** — así se cumple el requisito de
  exportación sin depender de escribir directamente sobre un archivo
  `.xlsx` (más frágil con sincronización offline).

## 8. Despliegue

| Recurso de Azure | Qué sirve | Workflow de GitHub Actions |
|---|---|---|
| Static Web App | `dist/` (frontend PWA) | `.github/workflows/azure-static-web-apps-*.yml` |
| App Service (Linux, Node 22) | `server/` (API + SQLite) | `.github/workflows/azure-app-service-backend.yml` |

Ambos despliegues son independientes y se disparan por push a `main`
(con `workflow_dispatch` disponible para forzarlos a mano). El detalle
completo de la configuración está en
[manual-implementacion.md](manual-implementacion.md).
