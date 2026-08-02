# Cambios de la versión 1.1

Qué se corrigió y agregó respecto de la versión que tenías.

---

## Errores corregidos

### 1. Las fechas se corrían un día (y rompían las métricas) — grave
`new Date('2026-08-01')` se interpreta como medianoche **UTC**. En Argentina (UTC−3) eso es el **31/07 a las 21:00**.

Consecuencias que tenía:
- Un presupuesto emitido el **1 de agosto** se mostraba con fecha **31/07**.
- En **Métricas** ese presupuesto se contaba en **julio**, no en agosto: la facturación del mes quedaba mal.
- Lo mismo con las fechas de vencimiento y de aprobación de trabajos.

**Corrección:** se agregó `parseFecha()` en el backend y en el frontend, que arma la fecha con los números tal cual vienen, sin conversión de zona horaria.

Verificado con la zona horaria de Córdoba: antes las métricas reportaban mes 7, ahora reportan mes 8 correctamente.

### 2. La seña se perdía al registrar el primer pago — grave
Al convertir un presupuesto en trabajo con una seña de, por ejemplo, $3.000, esa seña se guardaba en el trabajo pero **no** en la hoja `Pagos`. Cuando después se registraba un pago de $2.000, el sistema recalculaba lo cobrado sumando solo la hoja `Pagos` → el total cobrado pasaba de $3.000 a $2.000 y **el saldo aumentaba**.

**Corrección:** al convertir en trabajo, la seña se registra automáticamente como un pago con el concepto *"Seña inicial"*. Verificado: seña $3.000 + pago $2.000 = $5.000 cobrados.

### 3. Dos guardados simultáneos podían pisarse
Si se guardaban dos presupuestos casi al mismo tiempo (por ejemplo desde el celular y la compu), ambos podían recibir el mismo número correlativo.

**Corrección:** las operaciones de escritura se serializan con `LockService` y se fuerza el guardado con `SpreadsheetApp.flush()`.

---

## Funciones nuevas

### Carga masiva de insumos
Archivo nuevo **`backend/Insumos_Iniciales.gs`** con los **48 insumos reales** de tu planilla Excel ya cargados (hilos, cierres, botones, elásticos, cintas, entretelas, avíos, agujas y herramientas), cada uno con costo, margen, precio de venta, proveedor y stock mínimo.

- `cargarInsumosIniciales()` — los carga. Si un código ya existe, **actualiza** esa fila en vez de duplicarla, así que también sirve para **actualizar precios en masa**.
- `reemplazarInsumosPorLaListaInicial()` — borra todo y deja la lista limpia.

Sin esto, tu clienta tendría que cargar 48 artículos a mano desde el teléfono.

### Eliminar registros
Tres acciones nuevas en el backend:
- `deletePresupuesto` — borra el presupuesto **y sus ítems** (no quedaban huérfanos en la planilla).
- `deleteCliente` — con protección: **no deja borrar** un cliente que tenga presupuestos asociados.
- `deleteTrabajo` — borra el trabajo y sus pagos.

En la app, el botón **🗑 Eliminar presupuesto** está en el detalle de cada presupuesto, con confirmación antes de borrar.

### Instalable como app en el celular
Se agregaron `manifest.json`, los íconos (`icon-192.png`, `icon-512.png`) y las etiquetas de iOS. Ahora, al agregarla a la pantalla de inicio:
- Queda con el **logo de BBMOON**, no con una captura de pantalla.
- Se abre **a pantalla completa**, sin la barra del navegador. Parece una app nativa.

---

## Lo que se revisó y estaba bien

- El cálculo de totales (materiales → mano de obra → otros → descuento → IVA 21%).
- El servidor recalcula todo al guardar, así que los totales no pueden quedar mal.
- La numeración correlativa (`PRESU-000001`, `PRESU-000002`…).
- El reemplazo de ítems al editar un presupuesto (no duplica filas).
- La generación del PDF con el logo, la marca y la leyenda de validez.
- La comunicación con Apps Script sin problemas de CORS (usa `text/plain`, que evita el preflight).

---

## Sugerencias para más adelante

Por orden de utilidad real para el taller:

1. **Enviar el presupuesto por WhatsApp** con un link directo (`wa.me`) desde la app.
2. **Descuento automático de stock** al aprobar un trabajo.
3. **PIN de acceso**, para que el link público no quede abierto a cualquiera que lo tenga.
4. **Recordatorios** de presupuestos por vencer y entregas próximas.
5. **Backup automático** de la planilla a PDF/Excel una vez por mes.

---

## Agregado en v1.2

### Acceso directo a la planilla desde la app
Ahora la app sabe dónde está su planilla de Google y permite abrirla sin buscarla:

- **Inicio** → nuevo acceso rápido **📗 Ver planilla**.
- **Configuración** → sección *"Tu planilla de Google"* con dos botones:
  - **Abrir la planilla completa**
  - **Ir a una hoja en particular** — lista las 10 hojas con nombres claros (Insumos / Stock, Clientes, Presupuestos…) y abre directamente la que se toque.

Detalles técnicos:
- La dirección **no se guarda** en ninguna parte: el backend la calcula en el momento con `SpreadsheetApp.getActiveSpreadsheet().getUrl()`. Si mañana se cambia de planilla, el acceso sigue apuntando a la correcta sola.
- `saveConfig` ignora las claves calculadas (`planilla_url`, `planilla_nombre`) para que no se escriban como filas basura en la hoja Configuracion.
- Nueva acción de backend: `getSheetUrl`.
- La planilla se abre en una pestaña nueva; solo puede verla quien tenga permiso sobre ese archivo de Google.

### Corregido: el título del presupuesto no se guardaba
El campo *Título del presupuesto* era el único del editor sin `oninput`, así que lo tipeado se veía en pantalla pero nunca llegaba al presupuesto. Al guardar, la validación lo daba por vacío y frenaba con *"Poné un título"* aunque estuviera escrito. Se agregó el `oninput` y, además, un respaldo que lee el campo directamente antes de validar.
