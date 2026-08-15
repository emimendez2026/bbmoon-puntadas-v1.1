# BBMOON PUNTADAS — Gestion del Atelier v1.3

Aplicacion web mobile-first para administrar presupuestos, clientes, trabajos, cobros, caja, stock, medidas y agenda de un atelier. La persistencia sigue usando Google Sheets y Google Apps Script.

## Cambios principales

- Acceso con PIN y tokens de sesion revocables.
- Migracion no destructiva con `migrarV13()`.
- Bajas logicas, auditoria y pagos anulables.
- Validaciones economicas en backend y prevencion de doble conversion.
- Caja e historial de movimientos de stock.
- Fichas historicas de medidas y agenda.
- Rentabilidad por presupuesto/trabajo.
- Fechas locales corregidas para Argentina.
- Frontend modular, PWA, compartir PDF y respaldo JSON.
- Tests reproducibles con `npm test`.

Consultar `INSTALACION.md`, `MANUAL_DE_USO.md` y `CAMBIOS.md` para el detalle.
