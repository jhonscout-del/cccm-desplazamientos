# Manual de usuario — CCCM Check-in de viajeros

## 1. ¿Qué es esta app?

Es la herramienta para reportar tus desplazamientos (viajes de trabajo)
antes de salir, mantener informado a tu jefe inmediato y al equipo de
seguridad mientras estás en ruta, y confirmar que llegaste bien. Funciona
**sin señal de internet**: puedes hacer el check-in en zonas sin cobertura
y la app lo guarda en tu celular hasta que vuelva a haber conexión.

## 2. Instalar la app en tu celular o PC

1. Abre la dirección de la app en tu navegador (Chrome, Edge o Safari).
2. En el celular: el navegador te ofrecerá **"Agregar a pantalla de
   inicio"** o **"Instalar aplicación"** — acéptalo. Quedará como un ícono
   más, igual que cualquier otra app.
3. En PC: en la barra de direcciones aparece un ícono de instalar (⊕ o
   similar) — haz clic y confirma.
4. Una vez instalada, no necesitas volver a escribir la dirección: se abre
   como cualquier otra aplicación, incluso sin internet.

## 3. Iniciar sesión

1. Abre la app y presiona **"Iniciar sesión con Microsoft"**.
2. Ingresa tu correo y contraseña corporativos (los mismos de tu Outlook /
   Office).
3. La primera vez necesitas conexión a internet para este paso. Después,
   la sesión queda guardada en el dispositivo y no hace falta volver a
   iniciar sesión cada vez, incluso sin señal.

## 4. Registrar un viaje (check-in)

1. En la pantalla principal, presiona **"+ Nuevo viaje"**.
2. Completa el formulario:
   - **Nombre del jefe inmediato** y **área** a la que perteneces.
   - **Origen** y **destino** del desplazamiento.
   - **Opciones de transporte**: elige el tipo (aéreo, terrestre en
     carro/moto/mular/a pie, o marítimo/fluvial) — el formulario te pedirá
     los datos específicos de ese medio (aerolínea y vuelo, placa y
     cooperativa, nombre del arriero o guía, etc.). Si el transporte es de
     CCCM, marca la casilla correspondiente para indicar el número de
     vehículo o el nombre del conductor/motorista.
   - **Hora de inicio de desplazamiento**.
   - **Nombre de la persona a quien acudir** en caso de emergencia.
   - **Correo de tu jefe inmediato o coordinador** — a este correo (además
     de uno fijo del equipo de seguridad) le llegará automáticamente el
     reporte.
3. Presiona **"Iniciar viaje"**. El viaje queda con estado **"En curso"** y
   se le asigna un código (por ejemplo `V-0032`) que lo identifica.
4. Si no tienes señal en ese momento, el viaje se guarda igual en tu
   dispositivo (verás la etiqueta "pendiente de sincronizar") y se envía
   solo apenas recuperes conexión — no necesitas hacer nada más.

## 5. Trayectos internos (paradas dentro del mismo viaje)

Si tu viaje principal incluye varios tramos (por ejemplo, llegas a un
pueblo y de ahí sigues en otro medio de transporte a otro lugar), regístralos
como **trayectos internos**, sin límite de cuántos puedas agregar:

1. Dentro del detalle del viaje, presiona **"+ Agregar trayecto"**.
2. Completa origen, destino, transporte, horas de salida y llegada
   estimada, y el contacto de emergencia de ese tramo.
3. Cada trayecto queda numerado y con su propio código ligado al del viaje
   (ej. `V-0032-T2`, `V-0032-T3`...).

## 6. Observaciones

Tanto el viaje principal como cada trayecto tienen un espacio de
**observaciones** — úsalo para dejar notas de seguimiento mientras sigues
en ruta (por ejemplo: *"Salimos con una hora de retraso por el clima"* o
*"Llegamos al primer punto sin novedad"*). Cada nota queda con fecha y
hora, y se puede seguir agregando mientras el viaje o el trayecto sigan
abiertos.

## 7. Cerrar un trayecto o el viaje

- **Cerrar un trayecto**: cuando termines ese tramo específico, presiona
  **"Cerrar trayecto"** en su tarjeta. Esto no cierra el viaje completo,
  solo ese tramo.
- **Cerrar el viaje (check-out)**: cuando finalices todo el desplazamiento
  y estés a salvo, presiona **"Cerrar viaje"** al final del detalle del
  viaje. Confirma la acción cuando se te pregunte.
- **Solo la persona que inició el viaje puede cerrarlo** (o el equipo de
  control, en caso de emergencia). Esto evita que alguien más marque tu
  viaje como finalizado por error.

## 8. Correos automáticos

La app envía automáticamente un correo (desde tu propia cuenta de
Microsoft) en estos momentos:

- Al iniciar el viaje (check-in).
- Al agregar un trayecto interno.
- **Al agregar una observación** (mientras el viaje o trayecto sigue
  abierto) — no hace falta esperar a que se cierre para avisar de una
  novedad.
- Al cerrar un trayecto.
- Al cerrar el viaje completo.

Cada correo llega tanto al correo fijo del equipo de seguridad como al
correo variable que escribiste al hacer el check-in. Si no hay conexión en
el momento del evento, el correo se envía automáticamente en cuanto vuelva
la señal — no se pierde ni hay que reenviarlo a mano.

El correo que se envía al agregar una observación incluye una sección
**NOVEDADES** con la nota nueva y todo el historial acumulado hasta ese
momento (o "Sin novedades registradas." si es la primera). El correo de
cierre no repite ese listado — solo indica si el viaje o trayecto terminó
"SIN NOVEDAD" o "CON NOVEDADES", ya que el detalle de cada una se envió
por separado en su momento.

## 9. Sin conexión: qué esperar

- Puedes crear un viaje, agregar trayectos, observaciones, o cerrar algo
  sin señal — todo queda guardado en tu dispositivo.
- Verás la palabra **"pendiente de sincronizar"** junto a lo que aún no se
  ha enviado al servidor.
- En la parte superior de la app, un indicador muestra si estás **"En
  línea"** o **"Sin conexión"**.
- Apenas recuperes señal, todo se sincroniza solo (revisa cada 30
  segundos mientras la app esté abierta, y también al detectar que
  volvió la conexión). No necesitas volver a hacer nada.

## 10. Para el equipo de control (seguimiento)

Si tu cuenta tiene el rol de **control**, en vez de "Mis viajes" verás un
**Panel de control** con todos los viajes de todos los usuarios:

- Filtra por **"En curso"** o **"Cerrados"**.
- Puedes ver el detalle de cada viaje (transporte, contacto de
  emergencia, código, etc.).
- Si necesitas cerrar el viaje de otra persona (por ejemplo, si perdió su
  celular o confirmaste por otro medio que llegó bien), usa el botón
  **"Forzar cierre"**.
- Este panel requiere conexión a internet (no es para uso en campo sin
  señal, sino para el equipo que hace seguimiento desde oficina).

## 11. Preguntas frecuentes

**¿Necesito internet para usar la app?**
Solo la primera vez que inicias sesión en un dispositivo nuevo. Después,
todo el registro de viajes funciona sin señal.

**¿Qué pasa si cierro la app antes de que sincronice?**
Nada se pierde — al volver a abrirla, sigue intentando enviar lo
pendiente.

**¿Puedo cerrar un viaje que inició otra persona?**
No, salvo que tengas el rol de control. Es una medida de seguridad para
que nadie marque el viaje de otra persona como finalizado sin que
realmente haya llegado.

**No me deja iniciar sesión / el botón no hace nada.**
Verifica que tengas conexión a internet (el primer login sí la necesita)
y que estés usando tu cuenta corporativa de Microsoft. Si el problema
persiste, contacta al administrador de la app.
