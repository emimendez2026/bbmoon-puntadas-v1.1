# Cambios v1.3.0

## Seguridad

- API protegida con PIN almacenado como hash con salt en Script Properties.
- El PIN solo se usa en login; las operaciones usan token de sesion revocable.
- Tokens con vencimiento de 30 dias y hasta 8 sesiones activas.
- Rotacion de PIN revoca todas las sesiones.
- `bootstrap`/migracion ya no esta expuesto como accion remota.

## Integridad y trazabilidad

- Bajas logicas en lugar de borrados destructivos.
- Hoja Auditoria para acciones relevantes.
- Pagos inmutables: correcciones mediante anulacion.
- Movimiento de Caja asociado al pago y anulado junto con el pago.
- Validacion de montos positivos, sobrepagos, senas, descuentos y estados.
- Bloqueo de doble conversion de un mismo presupuesto.
- Bloqueo de edicion de presupuestos convertidos.
- Bloqueo de estado `cobrado` cuando queda saldo.

## Fechas

- Eliminado el uso de `toISOString().slice(0,10)` para fechas locales de negocio.
- Las nuevas fechas del frontend usan calendario local y no adelantan un dia durante la noche en Argentina.

## Caja

- Nueva hoja Movimientos_Caja.
- Ingresos automaticos desde Pagos.
- Ingresos/egresos manuales.
- Anulacion con motivo.
- KPIs de ingresos, egresos y resultado.

## Stock

- Nueva hoja Movimientos_Stock.
- Entradas, salidas y ajustes con stock anterior/nuevo.
- Descuento automatico al convertir presupuestos (configurable).
- Validacion opcional para impedir stock negativo.

## Atelier

- Fichas historicas de medidas por cliente.
- Agenda de pruebas, compras, llamadas y entregas.
- Creacion/sincronizacion automatica del evento de entrega.

## Rentabilidad

- Snapshot del costo unitario de cada item.
- Costo total de materiales.
- Horas estimadas y costo interno por hora.
- Ganancia y margen estimados por presupuesto/trabajo.
- Separacion de vendido, cobrado y saldo pendiente.

## Frontend

- Separado en `index.html`, `styles.css`, `core.js` y modulos `app-*.js`.
- PDF y uso de Web Share API cuando el dispositivo permite compartir archivos.
- PWA con service worker para cache del shell.
- Respaldo JSON desde Configuracion.

## Calidad

- `npm test` con pruebas de fechas locales, calculos, pagos, flujo integral y parseo de JavaScript.
