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
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`). Guarda
  todos los viajes de todos los usuarios (para el panel de control) y
  expone una API con autenticación por JWT.
- **Correo**: [EmailJS](https://www.emailjs.com) (sin backend de correo
  propio). Cada evento (inicio de viaje, nuevo trayecto, cierre) se
  envía a un correo fijo y a un correo variable que cada viajero escribe
  en su registro.

## Roles

- `viajero`: crea sus propios viajes, agrega trayectos, y **solo puede
  cerrar los viajes que él mismo inició**.
- `control`: ve el panel con todos los viajes de todos los usuarios y
  puede forzar el cierre de cualquiera (por ejemplo, si el viajero
  pierde su dispositivo).

No hay una pantalla para gestionar roles: por defecto todos los
usuarios se registran como `viajero`. Para dar el rol `control` a
alguien, actualiza su fila directamente en la base de datos:

```sql
UPDATE users SET role = 'control' WHERE email = 'correo@ejemplo.com';
```

## Configuración inicial

```bash
npm install
cp .env.example .env   # completa JWT_SECRET y las credenciales de EmailJS
```

### EmailJS

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
npm run dev:all   # levanta el frontend (Vite) y el backend (Express) juntos
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:4000

También puedes levantarlos por separado con `npm run dev` y
`npm run server:watch`.

## Compilar para producción

```bash
npm run build     # genera dist/ (PWA con service worker)
npm run server    # backend (usa PM2, systemd o similar para mantenerlo vivo)
```

Sirve `dist/` desde cualquier hosting estático (Netlify, Vercel, un VPS
con nginx, etc.) y despliega `server/` en un proceso Node.js aparte
(Railway, Render, un VPS, etc.). Si el frontend y el backend no
comparten dominio, define `VITE_API_URL` apuntando al backend antes de
compilar.

## Notas sobre el offline

- El check-in y los trayectos se guardan de inmediato en el
  dispositivo, sin depender de la red.
- Un viaje "pendiente de sincronizar" se reintenta automáticamente al
  recuperar señal, cada 30s mientras la app está abierta, y al detectar
  el evento `online` del navegador.
- El primer inicio de sesión en un dispositivo nuevo sí requiere
  conexión (para validar la contraseña contra el backend).
