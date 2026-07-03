# Manual de operación y mantenimiento

Tareas del día a día una vez que la app ya está desplegada. Pensado para
quien administre la app, no necesariamente un desarrollador.

## 1. Promover un usuario a rol "control"

No hay pantalla para esto (por diseño, para no exponer un panel de
administración adicional). Se hace directo en la base de datos:

1. Conéctate al App Service por SSH (Azure Portal → tu App Service →
   **Development Tools → SSH**) o usa la consola Kudu.
2. Con el usuario ya logueado al menos una vez en la app (para que exista
   en la tabla `users`), ejecuta:
   ```bash
   sqlite3 /home/data/cccm.sqlite \
     "UPDATE users SET role = 'control' WHERE email = 'correo@ejemplo.com';"
   ```
   (Si `sqlite3` no está disponible en el contenedor, usa el script
   `server/scripts/` de tu preferencia con `better-sqlite3` desde tu
   computador, apuntando `DB_PATH` a una copia descargada del archivo —
   ver sección 4 sobre cómo bajar el archivo.)
3. El usuario debe cerrar sesión y volver a entrar para que el cambio de
   rol se refleje (el rol se resuelve una vez al iniciar sesión).

## 2. Renovar el Client Secret de Graph antes de que expire

El secreto creado en el **Paso 2** del manual de implementación
(`AZURE_GRAPH_CLIENT_SECRET`) tiene fecha de expiración (la que hayas
elegido al crearlo — típicamente 6, 12 o 24 meses). Si expira sin
renovarse, **deja de sincronizar con SharePoint** (seguirá funcionando el
resto de la app con normalidad, solo se detiene el espejo a SharePoint).

Recomendación: pon un recordatorio calendario ~2 semanas antes de la
fecha de expiración que ves en **Entra ID → App registrations → CCCM
Check-in - Graph → Certificates & secrets**.

Para renovarlo:

1. En esa misma pantalla, **+ New client secret** → copia el **Value**
   (no el Secret ID) inmediatamente, solo se muestra una vez.
2. En el App Service → **Environment variables → App settings** →
   actualiza `AZURE_GRAPH_CLIENT_SECRET` con el nuevo valor → **Save**
   (reinicia la app).
3. Borra el secreto viejo de Entra ID una vez confirmes que todo sigue
   sincronizando (para no dejar credenciales vencidas dando vueltas).

## 3. Monitoreo

### Logs del backend

App Service → **Monitoring → Log stream** (requiere activar antes
**"Registro de aplicaciones (sistema de archivos)"** en **Monitoring →
App Service logs**, si no lo has hecho). Ahí verás en vivo cualquier
`[SharePoint] fallo al sincronizar: ...` u otro error del servidor.

### Estado de los despliegues

GitHub → pestaña **Actions**. Dos workflows corren de forma
independiente:

- **Azure Static Web Apps CI/CD** — despliega el frontend.
- **Deploy backend to Azure App Service** — despliega el backend.

Ambos deberían estar en verde tras cada cambio en `main`. Si necesitas
forzar un redeploy sin cambiar código (por ejemplo, después de agregar
un secret nuevo), entra al workflow específico → **"Run workflow"**.

## 4. Exportar los datos a Excel

Los registros se reflejan en tiempo real en dos listas de SharePoint:
`ViajesCCCM` y `TrayectosCCCM`, dentro del sitio configurado. Para
exportarlos: abre la lista en SharePoint → **Exportar → Exportar a
Excel**. No hace falta ningún paso adicional de la app.

## 5. Respaldo de la base de datos

La base de datos SQLite (`cccm.sqlite`) vive en `/home/data/` del App
Service — esa carpeta persiste entre despliegues, pero **no** tiene
respaldo automático a menos que lo configures.

Para descargar una copia manual:

1. App Service → **Development Tools → Advanced Tools (Kudu)** → **Go**.
2. **Debug console → Bash** (o SSH) → navega a `/home/data/`.
3. Descarga `cccm.sqlite` (arrastra el archivo en la interfaz de Kudu, o
   usa el explorador de archivos de Kudu en `https://<tu-app>.scm.azurewebsites.net/DebugConsole`).

Para respaldos periódicos automáticos, considera activar **Backups** en
el App Service (Azure Portal → tu App Service → **Backups**) — requiere
un plan de pago superior a Free/Shared.

## 6. Qué hacer si el login deja de funcionar

Diagnóstico en orden:

1. **¿El botón no hace nada / no redirige a Microsoft?** Revisa que
   `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID` y `VITE_AZURE_API_SCOPE`
   existan como GitHub Secrets, y que el build más reciente de "Azure
   Static Web Apps CI/CD" haya corrido *después* de que esos secrets se
   crearon (agregar un secret no dispara un build por sí solo).
2. **¿Redirige a Microsoft pero da un error de "redirect_uri"?** Falta
   agregar la URL real de producción como Redirect URI (tipo SPA) en el
   App Registration del login.
3. **¿El login se completa pero `/api/auth/me` da 401?** Revisa el
   mensaje de error específico en el Log stream del backend:
   - `jwt issuer invalid` → falta `"requestedAccessTokenVersion": 2` en
     el Manifest del App Registration (ver manual de implementación).
   - Cualquier otro error de audiencia/emisor → confirma que
     `AZURE_TENANT_ID` y `AZURE_API_CLIENT_ID` en el App Service
     coincidan exactamente con el App Registration del login.

## 7. Qué hacer si SharePoint deja de sincronizar

1. Revisa el Log stream del backend — el mensaje de error casi siempre
   lo dice todo:
   - `401` → credenciales de Graph inválidas o secreto expirado (ver
     sección 2).
   - `403 accessDenied` → falta el permiso `Sites.Manage.All` con
     consentimiento de administrador, o el App Registration de Graph no
     es el correcto.
   - `400 ... cannot be referenced in filter ... not indexed` → una
     columna usada en un filtro (`ViajeId`, `TrayectoId`) perdió su
     índice, o se agregó una lista/columna nueva sin indexarla.
2. Esto es "mejor esfuerzo" por diseño: mientras se resuelve, la app
   sigue funcionando con normalidad para los usuarios (los datos quedan
   completos en SQLite); solo se atrasa el espejo hacia SharePoint. No es
   necesario reintentar manualmente los registros viejos una vez se
   arregle la causa — sí es necesario que se generen registros *nuevos*
   para confirmar que ya sincroniza otra vez (no hay reintento automático
   retroactivo de lo que falló en su momento).

## 8. Cosas que NO hacer

- **No borres ni recrees el recurso Static Web App** desde Azure Portal
  para "resetear" algo — Azure regenera el workflow de GitHub desde cero
  (con una URL nueva) y se pierden los ajustes hechos sobre él.
- **No cambies `DB_PATH`** a una ruta dentro del código de la app (fuera
  de `/home/...`) — se perdería la base de datos en cada despliegue.
- **No compartas el `AZURE_GRAPH_CLIENT_SECRET`** fuera de los canales
  seguros (GitHub Secrets / Application settings de Azure) — da acceso de
  escritura a todo SharePoint del sitio configurado.
