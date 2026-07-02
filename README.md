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
- **Correo**: Microsoft Graph (`Mail.Send` delegado). El correo se envía
  desde el buzón del propio viajero que inició sesión — sin servicio de
  correo externo — a un correo fijo y a un correo variable que cada
  viajero escribe en su registro.

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
4. **API permissions → Add a permission → Microsoft Graph → Delegated
   permissions**: agrega `User.Read` (suele venir por defecto) y
   **`Mail.Send`** (necesario para que la app envíe el correo desde la
   cuenta del viajero logueado). Clic **Grant admin consent for
   \<tu organización\>** — sin este consentimiento del administrador,
   Microsoft le pedirá permiso a cada usuario individualmente la primera
   vez que intente enviar un correo.

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

El correo fijo (`gerente.seguridad@colombiasinminas.org`) está definido
en [src/lib/email.js](src/lib/email.js) y siempre recibe copia; el
correo variable lo escribe cada viajero al hacer el check-in. No hay
nada más que configurar aparte del permiso `Mail.Send` del paso 1.4 —
el envío usa la misma sesión de Microsoft del usuario, sin variables ni
cuentas adicionales.

## Ejecutar en desarrollo

```bash
npm install
cp .env.example .env   # completa las variables de Azure AD / Graph
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

## Despliegue en Azure (GitHub Actions)

El repo trae dos workflows en `.github/workflows/`, uno por cada mitad de
la app — **Static Web Apps solo sirve archivos estáticos, no ejecuta el
backend**, así que hacen falta los dos:

| Workflow | Qué despliega | Recurso de Azure |
|---|---|---|
| `azure-static-web-apps-*.yml` | `dist/` (frontend PWA) | Static Web App |
| `azure-app-service-backend.yml` | `server/` (API Express + SQLite) | App Service (Linux, Node 22) |

### 1. Crear el App Service del backend

En Azure Portal: **Create a resource → Web App** → runtime **Node 22
LTS**, sistema operativo **Linux**. Cuando exista:

- **Configuration → General settings**: Startup Command puede quedar
  vacío (usa `npm start`, ya definido en `package.json`).
- **Configuration → Application settings**, agrega:
  ```
  AZURE_TENANT_ID=...
  AZURE_API_CLIENT_ID=...
  AZURE_GRAPH_CLIENT_ID=...
  AZURE_GRAPH_CLIENT_SECRET=...
  SHAREPOINT_SITE_ID=...
  SHAREPOINT_LIST_VIAJES_ID=...
  SHAREPOINT_LIST_TRAYECTOS_ID=...
  DB_PATH=/home/data/cccm.sqlite
  ```
  `DB_PATH` **debe** apuntar a `/home/...` (no a la carpeta del código):
  en App Service Linux, `/home` es lo único que persiste entre
  despliegues — el resto del sistema de archivos se reemplaza cada vez
  que se sube código nuevo.
- **Overview**: copia el nombre de la Web App → secret de GitHub
  `AZURE_WEBAPP_NAME`.
- Si al intentar descargar el perfil de publicación aparece "La
  autenticación básica está deshabilitada": ve a **Settings →
  Configuration → General settings** → activa **"SCM Basic Auth
  Publishing Credentials"** → **Save**.
- **Get publish profile** (botón en Overview) → descarga el XML y
  pégalo completo como secret de GitHub `AZURE_WEBAPP_PUBLISH_PROFILE`.

### 2. Secrets del repositorio en GitHub

**Settings → Secrets and variables → Actions → New repository secret**,
uno por cada variable (Vite las incrusta al compilar, así que deben
existir como *secret*, no solo como Application Setting de Azure):

```
VITE_AZURE_CLIENT_ID
VITE_AZURE_TENANT_ID
VITE_AZURE_API_SCOPE
VITE_API_URL                    -> https://<AZURE_WEBAPP_NAME>.azurewebsites.net/api
AZURE_WEBAPP_NAME
AZURE_WEBAPP_PUBLISH_PROFILE
```

`AZURE_STATIC_WEB_APPS_API_TOKEN_...` ya lo crea Azure automáticamente
al conectar el repo. Si el deploy falla con "deployment_token was not
provided", ese secret específico se perdió — ve al recurso Static Web
App → **"Manage deployment token"**, copia el valor, y vuelve a crear
ese mismo secret en GitHub con el nombre exacto que pide el workflow.

Después de agregar los secrets, vuelve a correr el workflow de Static
Web Apps ("Run workflow" en la pestaña Actions) para que el próximo
build sí los incluya — builds anteriores quedaron compilados sin ellos.

**No borres ni recrees el recurso Static Web App desde Azure Portal**:
cada vez que eso pasa, Azure regenera el archivo de workflow desde cero
(con una URL nueva) y se pierden estos ajustes.

Recuerda también agregar la URL final del frontend (la de Static Web
Apps) como Redirect URI tipo **SPA** en el App Registration del login.

### Desarrollo / otros hosting

```bash
npm run build     # genera dist/ (PWA con service worker)
npm start          # backend (usa PM2, systemd o similar para mantenerlo vivo)
```

También puedes servir `dist/` y desplegar `server/` en cualquier otro
proveedor (Netlify, un VPS con nginx, etc.) — solo ajusta `VITE_API_URL`
y `DB_PATH` según corresponda.

## Notas sobre el offline

- El check-in y los trayectos se guardan de inmediato en el
  dispositivo, sin depender de la red.
- Un viaje "pendiente de sincronizar" se reintenta automáticamente al
  recuperar señal, cada 30s mientras la app está abierta, y al detectar
  el evento `online` del navegador.
- El primer inicio de sesión en un dispositivo nuevo sí requiere
  conexión (para el login con Microsoft). Después, MSAL guarda la
  sesión en el dispositivo y la app funciona sin señal.
