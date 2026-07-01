# CCCM · Check-in de viajeros

App para registrar el inicio y cierre de desplazamientos (viajes) de
viajeros CCCM, con trayectos internos ilimitados dentro de cada viaje,
un panel de control centralizado, y notificación automática por correo.
Funciona sin conexión en celulares y PC (PWA instalable).

## Arquitectura

- **Frontend**: React + Vite + Tailwind, PWA instalable (`vite-plugin-pwa`).
  Los registros se guardan primero en el dispositivo (IndexedDB, vía
  Dexie) para que el check-in funcione sin señal. Una cola de
  sincronización los envía al backend y dispara los correos en cuanto
  hay conexión (reintenta automáticamente).
- **Login**: cuenta corporativa Microsoft/Office 365 (Entra ID), vía
  MSAL. No hay usuarios ni contraseñas propias — la identidad la valida
  Microsoft.
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`). Sigue
  siendo la fuente de verdad operativa de la app (quién puede cerrar
  qué viaje, qué está pendiente de sincronizar, panel de control), y
  valida cada request comprobando el token de Azure AD emitido por MSAL.
- **SharePoint**: cada vez que se crea un viaje, se agrega un trayecto o
  se cierra un viaje, el backend refleja ese registro en una lista de
  SharePoint (usando permisos de aplicación, no expuestos al navegador).
  Desde esa lista, cualquiera con acceso puede exportarlo a Excel con un
  clic ("Exportar a Excel" es una función nativa de las listas de
  SharePoint).
- **Correo**: [EmailJS](https://www.emailjs.com). Cada evento se envía a
  un correo fijo y a un correo variable que cada viajero escribe en su
  registro.

## Roles

- `viajero`: crea sus propios viajes, agrega trayectos, y **solo puede
  cerrar los viajes que él mismo inició** (identificado por su cuenta de
  Microsoft, no por lo que escriba en un formulario).
- `control`: ve el panel con todos los viajes de todos los usuarios y
  puede forzar el cierre de cualquiera.

No hay pantalla para gestionar roles: todos entran como `viajero` la
primera vez que inician sesión. Para dar el rol `control` a alguien:

```sql
UPDATE users SET role = 'control' WHERE email = 'correo@ejemplo.com';
```

## Configuración en Microsoft Entra ID (Azure AD)

Esto lo debe hacer alguien con permisos de administrador en el tenant de
Microsoft 365 de la organización (Azure Portal → Microsoft Entra ID).

### 1. App Registration para el login (SPA)

1. **Azure Portal → Entra ID → App registrations → New registration**.
   - Nombre: `CCCM Check-in`.
   - Tipo de cuenta: *Accounts in this organizational directory only*
     (single tenant, recomendado para una ONG/empresa).
   - Redirect URI: tipo **SPA**, con la URL de la app (ej.
     `http://localhost:5173` en desarrollo, y la URL real en producción).
2. Anota el **Application (client) ID** y el **Directory (tenant) ID** →
   van en `VITE_AZURE_CLIENT_ID` y `VITE_AZURE_TENANT_ID`
   (y también en `AZURE_TENANT_ID` / `AZURE_API_CLIENT_ID` del backend,
   si usas un solo App Registration como aquí).
3. **Expose an API** (en el mismo App Registration):
   - Set Application ID URI (deja el valor por defecto `api://<client-id>`).
   - Add a scope: nombre `access_as_user`, quién puede consentir: *Admins
     and users*, estado *Enabled*.
   - Copia el scope completo (`api://<client-id>/access_as_user`) a
     `VITE_AZURE_API_SCOPE`.
4. **API permissions**: agrega `Microsoft Graph → User.Read` (delegado) —
   suele venir por defecto. No se necesitan más permisos delegados: el
   login solo identifica al usuario, no accede a SharePoint desde el
   navegador.

### 2. App Registration "solo aplicación" para Graph/SharePoint

Uno **separado**, porque este sí tendrá un secreto y permisos amplios de
escritura — no debe compartirse con el App Registration público del SPA.

1. **New registration** → nombre `CCCM Check-in - Graph` (no necesita
   redirect URI).
2. **Certificates & secrets → New client secret** → copia el valor a
   `AZURE_GRAPH_CLIENT_SECRET`, y el Client ID a `AZURE_GRAPH_CLIENT_ID`.
3. **API permissions → Add a permission → Microsoft Graph → Application
   permissions** → agrega `Sites.Selected`.
4. **Grant admin consent** (botón en la misma pantalla).
5. Con `Sites.Selected` el app no tiene acceso a ningún sitio hasta que
   se le otorgue explícitamente. Un administrador de SharePoint debe
   ejecutar (por ejemplo desde
   [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer)
   ya logueado como admin):
   ```http
   POST https://graph.microsoft.com/v1.0/sites/{SHAREPOINT_SITE_ID}/permissions
   {
     "roles": ["write"],
     "grantedToIdentities": [{
       "application": { "id": "<AZURE_GRAPH_CLIENT_ID>", "displayName": "CCCM Check-in - Graph" }
     }]
   }
   ```
   (Alternativa más simple pero menos restrictiva: usar el permiso de
   aplicación `Sites.ReadWrite.All` en vez de `Sites.Selected` — da
   acceso a todo SharePoint del tenant y solo requiere el "Grant admin
   consent" del paso 4, sin el POST anterior.)

### 3. Ubicar el sitio de SharePoint

```http
GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{ruta-del-sitio}
```
(por ejemplo `.../sites/colombiasinminas.sharepoint.com:/sites/Seguridad`).
La respuesta trae el campo `id` → cópialo a `SHAREPOINT_SITE_ID`.

### 4. Crear las listas

```bash
cp .env.example .env   # completa lo obtenido en los pasos 1-3
node server/scripts/provisionSharePoint.js
```

El script crea las listas `ViajesCCCM` y `TrayectosCCCM` (si no
existen) y al final imprime los IDs — cópialos en
`SHAREPOINT_LIST_VIAJES_ID` y `SHAREPOINT_LIST_TRAYECTOS_ID` en `.env`.
Desde esa lista, en SharePoint, usa **Exportar → Exportar a Excel** para
obtener el archivo `.xlsx` cuando lo necesites.

## EmailJS

1. Crea una cuenta en https://www.emailjs.com y un "Email Service".
2. Crea una plantilla con las variables `{{to_fijo}}`, `{{to_variable}}`,
   `{{subject}}` y `{{message}}`, y configúrala para enviar a ambos
   destinatarios (por ejemplo, "To" = `{{to_fijo}}, {{to_variable}}`).
3. Copia `Service ID`, `Template ID` y `Public Key` a las variables
   `VITE_EMAILJS_*` del archivo `.env`.

El correo fijo (`gerente.seguridad@colombiasinminas.org`) está definido
en [src/lib/email.js](src/lib/email.js) y siempre recibe copia; el
correo variable lo escribe cada viajero al hacer el check-in.

## Ejecutar en desarrollo

```bash
npm install
cp .env.example .env   # completa las variables de Azure AD / Graph / EmailJS
npm run dev:all        # levanta el frontend (Vite) y el backend (Express) juntos
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:4000

**Nota**: sin las variables de Azure AD configuradas, la app carga y
muestra la pantalla de login, pero el botón "Iniciar sesión con
Microsoft" no podrá completar el login (Microsoft rechazará un
`client_id` vacío). Sin `AZURE_GRAPH_*` / `SHAREPOINT_*`, el backend
sigue funcionando con normalidad — simplemente no replica en SharePoint
(lo registra en consola y continúa).

## Compilar para producción

```bash
npm run build     # genera dist/ (PWA con service worker)
npm run server    # backend (usa PM2, systemd o similar para mantenerlo vivo)
```

Sirve `dist/` desde cualquier hosting estático (Azure Static Web Apps,
Netlify, un VPS con nginx, etc.) y despliega `server/` en un proceso
Node.js aparte. Si el frontend y el backend no comparten dominio, define
`VITE_API_URL` apuntando al backend antes de compilar. Recuerda agregar
la URL de producción como Redirect URI (tipo SPA) en el App Registration.

## Notas sobre el offline

- El check-in y los trayectos se guardan de inmediato en el
  dispositivo, sin depender de la red.
- Un viaje "pendiente de sincronizar" se reintenta automáticamente al
  recuperar señal, cada 30s mientras la app está abierta, y al detectar
  el evento `online` del navegador.
- El primer inicio de sesión en un dispositivo nuevo sí requiere
  conexión (para el login con Microsoft). Después, MSAL guarda la
  sesión en el dispositivo y la app funciona sin señal.
