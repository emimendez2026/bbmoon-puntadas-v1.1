# Manual de uso — BBMOON PUNTADAS v1.3

## Inicio

El panel muestra presupuestado, vendido, cobrado, saldo pendiente, egresos, resultado de caja, ganancia estimada, stock bajo y agenda de los proximos siete dias.

## Presupuestos

1. Elegir cliente.
2. Escribir titulo y descripcion.
3. Agregar materiales del stock o conceptos manuales.
4. Definir precio de venta y costo interno cuando corresponda.
5. Definir mano de obra, otros costos, descuentos e IVA.
6. Cargar horas estimadas y costo interno por hora para obtener rentabilidad.
7. Guardar o Guardar + PDF.

La rentabilidad es interna y no aparece en el PDF del cliente. Un presupuesto aprobado puede convertirse una sola vez en trabajo.

## Trabajos y cobros

Al convertir un presupuesto se crea el trabajo, se registra la sena como pago si existe, se registra el ingreso en Caja, se crea la entrega en Agenda y se descuenta stock si esa opcion esta habilitada.

Los pagos no se editan ni se eliminan. Si hay un error, usar **Anular** y registrar el pago correcto. La anulacion conserva el historial y actualiza nuevamente el saldo. No se puede marcar un trabajo como `cobrado` mientras tenga saldo pendiente.

## Caja

Los pagos de clientes generan ingresos automaticamente. Tambien se pueden cargar movimientos manuales: compra de telas, avios, servicios, transporte, impuestos y otros ingresos o egresos. Los movimientos manuales pueden anularse. Los vinculados a pagos se anulan desde el pago correspondiente.

## Stock

Usar **Movimiento** para registrar entradas, salidas o ajustes. Esto conserva el historial de cada insumo. El sistema puede descontar automaticamente los materiales del presupuesto al convertirlo en trabajo.

## Medidas

Dentro de la ficha de un cliente se pueden guardar multiples fichas de medidas con fecha. La ficha anterior no se reemplaza: queda disponible como historial.

## Agenda

Se pueden registrar pruebas, entregas, compras, llamadas y otros eventos. Las fechas de entrega de los trabajos se sincronizan con un evento de agenda.

## Respaldo

Configuracion -> **Descargar respaldo JSON** crea una copia local de los principales datos visibles. La planilla de Google sigue siendo la fuente principal.

## Seguridad

El PIN se usa solo para iniciar sesion. El dispositivo conserva un token si se marca "Recordar sesion". Para revocar todos los dispositivos, ejecutar `rotarPinAcceso()` en Apps Script y usar el nuevo PIN.
