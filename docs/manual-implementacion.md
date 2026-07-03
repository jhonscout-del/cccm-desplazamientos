# Manual de implementación y configuración

Guía paso a paso para desplegar esta app desde cero en un tenant nuevo de
Microsoft 365 / Azure. Requiere permisos de administrador en Entra ID, en
el sitio de SharePoint destino, y en la suscripción de Azure.

Tiempo estimado: 1-2 horas la primera vez.

## Prerrequisitos

- Un tenant de Microsoft 365 con SharePoint activo.
- Una suscripción de Azure con permisos para crear recursos.
- El repositorio en GitHub, con acceso para configurar Secrets y Actions.
- Node.js 22 instalado si vas a ejecutar el script de aprovisionamiento
  de SharePoint desde tu computador.

## Paso 1 — App Registration para el login (SPA)

**Azure Portal → Microsoft Entra ID → App registrations → New
registration.**

1. Nombre: `CCCM Check-in` (o el que prefieras).
2. Tipo de cuenta: *Accounts in this organizational directory only*
   (single tenant).
3. Redirect URI: tipo **Single-page application (SPA)** →
   `http://localhost:5173` (lo agregarás para producción en el Paso 4).
4. **Register**.
5. En **Overview**, copia:
   - **Application (client) ID** → `VITE_AZURE_CLIENT_ID` /
     `AZURE_API_CLIENT_ID`.
   - **Directory (tenant) ID** → `VITE_AZURE_TENANT_ID` /
     `AZURE_TENANT_ID`.
6. **Expose an API**:
   - Set Application ID URI → deja el valor sugerido `api://<client-id>`.
   - **Add a scope**: nombre `access_as_user`, quién puede consentir
     *Admins and users*, estado *Enabled*.
   - El scope completo (`api://<client-id>/access_as_user`) es tu
     `VITE_AZURE_API_SCOPE`.
7. **API permissions → Add a permission → Microsoft Graph → Delegated
   permissions**: agrega `User.Read` (suele venir por defecto) y
   **`Mail.Send`**.
8. Clic **"Grant admin consent for \<tu organización\>"** → confirma.
   Sin este paso, cada usuario vería una ventana de consentimiento la
   primera vez que la app intente enviar un correo.

> ⚠️ Cuidado al agregar permisos: verifica en el breadcrumb de arriba que
> estás parado en el App Registration correcto (`CCCM Check-in`, no el de
> Graph del Paso 2) — son fáciles de confundir si tienen nombres
> parecidos.

## Paso 2 — App Registration "solo aplicación" para Graph/SharePoint

Uno **separado** del anterior: este tendrá un secreto y permisos amplios
de escritura.

1. **New registration** → nombre `CCCM Check-in - Graph` (no necesita
   redirect URI).
2. **Certificates & secrets → New client secret** → cualquier
   descripción/expiración → **Add**.
   - Copia el valor de la columna **Value** (no el "Secret ID" — son dos
     columnas distintas y es fácil copiar la equivocada; el Value es una
     cadena larga, no un GUID con guiones). Solo se muestra una vez: si
     sales de la pantalla sin copiarlo, hay que crear un secreto nuevo.
   - Esto es tu `AZURE_GRAPH_CLIENT_SECRET`.
3. En **Overview**, copia el **Application (client) ID** →
   `AZURE_GRAPH_CLIENT_ID`.
4. **API permissions → Add a permission → Microsoft Graph → Application
   permissions** → agrega **`Sites.Manage.All`**.
   - `Sites.ReadWrite.All` alcanza para leer/actualizar ítems, pero
     **no** para crear una lista nueva con columnas personalizadas — por
     eso se necesita `Sites.Manage.All` (al menos para el paso de
     aprovisionamiento inicial; puedes dejar ambos permisos si quieres).
5. Clic **"Grant admin consent for \<tu organización\>"** → confirma.

## Paso 3 — Ubicar el sitio y crear las listas de SharePoint

1. Obtén el **ID del sitio** vía [Graph
   Explorer](https://developer.microsoft.com/graph/graph-explorer)
   (logueado con una cuenta admin):
   ```http
   GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{ruta-del-sitio}
   ```
   Ejemplo: `.../sites/cccmorg.sharepoint.com:/sites/CCCMCheck-in`.
   La respuesta trae el campo `id` (con dos GUIDs separados por comas) →
   ese es tu `SHAREPOINT_SITE_ID`.

2. En tu computador:
   ```bash
   git clone <tu-repo>
   cd cccm-desplazamientos
   npm install
   cp .env.example .env
   ```
   Completa en `.env`: `AZURE_TENANT_ID`, `AZURE_GRAPH_CLIENT_ID`,
   `AZURE_GRAPH_CLIENT_SECRET`, `SHAREPOINT_SITE_ID`.

3. Ejecuta el script de aprovisionamiento:
   ```bash
   node server/scripts/provisionSharePoint.js
   ```
   Crea las listas `ViajesCCCM` y `TrayectosCCCM` con sus columnas (o,
   si ya existen, agrega las columnas que falten — es seguro volver a
   correrlo). Al final imprime dos IDs:
   ```
   SHAREPOINT_LIST_VIAJES_ID=...
   SHAREPOINT_LIST_TRAYECTOS_ID=...
   ```
   Complétalos en tu `.env`.

4. **Importante — columnas indexadas**: el script marca `ViajeId` y
   `TrayectoId` como indexadas (`indexed: true`) porque el backend filtra
   por esos campos; Graph rechaza filtrar sobre columnas no indexadas.
   Si en el futuro agregas manualmente una columna a estas listas desde
   la interfaz de SharePoint (en vez de por el script), recuerda que las
   columnas *nuevas que uses en filtros* también deben indexarse a mano
   (Configuración de la lista → esa columna → Indexado).

## Paso 4 — Static Web App (frontend)

1. Azure Portal → **Create a resource → Static Web App**.
2. Conéctalo a tu repositorio de GitHub (rama `main`); Azure crea
   automáticamente un workflow en `.github/workflows/`.
3. Copia la URL asignada (`https://<algo>.azurestaticapps.net`) y
   agrégala como **Redirect URI adicional** (tipo SPA) en el App
   Registration del Paso 1.
4. **No borres ni recrees este recurso más adelante**: cada vez que se
   recrea, Azure regenera el workflow desde cero (con una URL nueva) y
   se pierde cualquier ajuste manual que le hayas hecho al workflow (ver
   Paso 6).

## Paso 5 — App Service (backend)

1. **Create a resource → Web App**:
   - Runtime: **Node 22 LTS** (Node 20 ya no está disponible en planes
     nuevos).
   - Sistema operativo: **Linux**.
2. Si al pedir el perfil de publicación aparece "La autenticación básica
   está deshabilitada": **Settings → Configuration → General settings**
   → activa **"SCM Basic Auth Publishing Credentials"** → **Save**.
3. **Overview → Get publish profile** → descarga el XML completo.
4. **Settings → Environment variables → App settings**, agrega:
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
   `DB_PATH` **debe** apuntar a `/home/...`: en App Service Linux, todo
   lo que esté bajo `/home/site/wwwroot` (el código) se reemplaza en cada
   despliegue — solo `/home` en general persiste entre despliegues.

## Paso 6 — Secrets en GitHub

**Settings → Secrets and variables → Actions → New repository secret**,
uno por cada variable (Vite las incrusta en el bundle al compilar, así
que deben existir como *secret de GitHub*, no solo como Application
Setting de Azure):

```
VITE_AZURE_CLIENT_ID
VITE_AZURE_TENANT_ID
VITE_AZURE_API_SCOPE
VITE_API_URL                    -> https://<nombre-app-service>.azurewebsites.net/api
AZURE_WEBAPP_NAME               -> el nombre del App Service (Paso 5)
AZURE_WEBAPP_PUBLISH_PROFILE    -> el XML del Paso 5
```

`AZURE_STATIC_WEB_APPS_API_TOKEN_...` ya lo crea Azure automáticamente al
conectar el repo (Paso 4). Si algún deploy del frontend falla con
"deployment_token was not provided", ese secret se perdió — ve al
recurso Static Web App → **"Manage deployment token"**, cópialo, y
créalo de nuevo en GitHub con el nombre exacto que pide el workflow.

Después de cargar los secrets, dispara un build nuevo (pestaña Actions →
el workflow correspondiente → **"Run workflow"**) — los builds
anteriores quedaron compilados sin ellos.

## Paso 7 — Verificación final

1. `https://<tu-app-service>.azurewebsites.net/api/health` debe responder
   `{"ok":true}`.
2. Abre la URL del frontend, clic en "Iniciar sesión con Microsoft" —
   debe llevarte a la pantalla real de login de Microsoft (si en vez de
   eso no pasa nada, revisa la nota de "accessTokenAcceptedVersion" más
   abajo).
3. Completa el login, crea un viaje de prueba, y confirma que aparece
   correctamente con un código (`V-0000`).
4. Revisa los logs del App Service (Monitoring → **Log stream**) mientras
   creas el viaje — no debería aparecer ningún `[SharePoint] fallo al
   sincronizar`. Si aparece, revisa el mensaje: casi siempre es un
   permiso faltante o una columna sin indexar (ver Paso 3).

### Error frecuente: "jwt issuer invalid"

Si el login funciona pero `/api/auth/me` responde 401 con
`jwt issuer invalid`, el App Registration del Paso 1 está emitiendo
tokens en formato v1 en vez de v2. Corrígelo en **Entra ID → App
registrations → \[tu app\] → Manifest**, dentro del bloque `"api"`:
```json
"requestedAccessTokenVersion": 2,
```
Guarda, y pide a los usuarios afectados que cierren sesión y vuelvan a
entrar (para que se emita un token nuevo).

## Checklist final

- [ ] App Registration del login: `User.Read` + `Mail.Send` con
      consentimiento de administrador, `requestedAccessTokenVersion: 2`.
- [ ] App Registration de Graph: `Sites.Manage.All` con consentimiento de
      administrador.
- [ ] Listas `ViajesCCCM` y `TrayectosCCCM` creadas, con `ViajeId` /
      `TrayectoId` indexados.
- [ ] Static Web App conectado a GitHub, con la URL de producción como
      Redirect URI.
- [ ] App Service en Node 22, Basic Auth activado, Application settings
      completos, `DB_PATH` apuntando a `/home/...`.
- [ ] Todos los secrets de GitHub cargados y un build reciente en verde
      para ambos workflows.
- [ ] Login real probado de punta a punta, y un viaje de prueba visible
      en SharePoint.

Para la operación del día a día una vez desplegado (promover usuarios,
renovar secretos, monitoreo), ver
[manual-operacion.md](manual-operacion.md).
