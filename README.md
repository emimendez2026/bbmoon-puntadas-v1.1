# BBMOON PUNTADAS — Gestion del Atelier v1.3

Aplicacion web mobile-first para administrar presupuestos, clientes, trabajos, cobros, caja, stock, medidas y agenda de un atelier. La persistencia sigue usando Google Sheets y Google Apps Script para mantener el costo operativo practicamente en cero.

## Novedades principales

- Acceso protegido: el PIN se usa solo para iniciar sesion. El backend guarda un hash con salt y entrega un token revocable de 30 dias. Se admiten hasta 8 dispositivos/sesiones activas.
- Migracion no destructiva: `migrarV13()` agrega hojas/columnas faltantes sin borrar los datos actuales.
- Bajas logicas y auditoria: presupuestos, clientes, trabajos, medidas y eventos conservan historial.
- Pagos inmutables: un pago se anula y registra la reversa; no se edita ni se borra fisicamente.
- Validaciones server-side: cantidades, costos, descuentos, senas, pagos, estados y stock.
- Prevencion de doble conversion presupuesto -> trabajo.
- Fechas locales sin el bug UTC nocturno de Argentina.
- Caja: ingresos, egresos, medios de pago, cobros vinculados y resultado mensual.
- Stock: libro de movimientos y descuento automatico al convertir un presupuesto (configurable).
- Fichas historicas de medidas por cliente.
- Agenda de pruebas, compras, llamadas y entregas; la entrega se crea automaticamente al convertir un trabajo.
- Rentabilidad: costo historico de materiales, horas, costo interno por hora, ganancia y margen estimados.
- PDF + compartir desde dispositivos compatibles.
- Respaldo JSON descargable de los datos operativos.
- PWA con cache del shell de la aplicacion para apertura offline parcial.
- Frontend separado en HTML, CSS, logica comun y aplicacion, en vez de un unico archivo monolitico.
- Tests sin dependencias externas con `npm test`.

## Estructura

```text
backend/Codigo.gs           acceso y ruteo API
backend/Datos.gs            migracion, hojas y utilidades
backend/Operaciones.gs      presupuestos, trabajos, pagos e insumos
backend/Gestion.gs          caja, stock, medidas, agenda y KPIs
backend/Insumos_Iniciales.gs carga inicial existente
frontend/index.html         shell de la aplicacion
frontend/css/styles.css     estilos
frontend/js/core.js         calculos/fechas puros y testeables
frontend/js/app-*.js        interfaz modular y llamadas API
frontend/sw.js              service worker
frontend/manifest.json      PWA
frontend/assets/            identidad visual existente
tests/core.test.js          pruebas automatizadas
docs/INSTALACION.md         migracion/instalacion
docs/MANUAL_DE_USO.md       uso diario
docs/CAMBIOS.md             detalle de cambios
```

## Comandos de validacion

```bash
npm test
```

La aplicacion sigue pensada para un atelier pequeno/mediano y una cantidad moderada de registros. Google Sheets no se pretende usar como una base de datos de gran escala.
