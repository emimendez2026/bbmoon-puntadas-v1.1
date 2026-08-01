# BBMOON PUNTADAS — Sistema de Presupuestos y Gestión

Aplicación web **mobile-first** para que Verónica arme presupuestos profesionales desde el celular, lleve el stock de insumos, sus clientes, trabajos y cobros, y exporte cada presupuesto como **PDF con la identidad del taller**. Los datos se guardan en una **Planilla de Google (Google Sheets)** que funciona como base de datos, y el backend es un **Google Apps Script** publicado como API web.

Estética **"Artesanal Moderno"**: cálida, táctil y exclusiva, con estructura limpia y contemporánea. Fondo **crema cálido**, texto en **azul marino profundo** y acentos en **terracota/ladrillo**; títulos con la serif **Lora** y textos/datos con la sans-serif **Nunito**. Iluminación suave: bordes finos, sombras muy sutiles y espaciado generoso.

No requiere instalar programas, ni servidores, ni pagar hosting. Todo funciona con una cuenta de Google gratuita.

---

## 1. ¿Qué incluye?

| Módulo | Para qué sirve |
|---|---|
| **Inicio (Dashboard)** | Accesos rápidos + resumen del mes (presupuestos, aprobados, vendido). |
| **Insumos / Stock** | Telas, hilos, botones, servicios… con costo, margen y **precio de venta calculado solo**. Avisa stock bajo. |
| **Clientes** | Datos de contacto, localidad, historial. |
| **Nuevo Presupuesto** | Editor paso a paso: cliente → materiales → mano de obra → IVA → total en vivo. |
| **Presupuestos** | Listado con filtros por estado (borrador, enviado, aprobado, rechazado). Ver, duplicar, cambiar estado, **exportar PDF**, convertir en trabajo. |
| **Trabajos** | Los presupuestos aprobados se vuelven trabajos con seña, saldo y estado. Registro de **pagos**. |
| **Métricas** | KPIs del negocio: tasa de conversión, ticket promedio, total vendido, trabajos pendientes, etc. |
| **Configuración** | Datos del negocio (nombre, CUIT, teléfono), IVA, % de mano de obra por defecto, validez del presupuesto. |

---

## 2. Arquitectura (cómo está armado)

```
┌─────────────────────────────┐         POST JSON          ┌──────────────────────────────┐
│   FRONTEND  (index.html)    │  ───────────────────────▶  │   BACKEND  (Codigo.gs)       │
│   El celular / navegador    │                            │   Google Apps Script          │
│                             │  ◀───────────────────────  │   (API web /exec)             │
│  • Interfaz mobile-first    │        respuesta JSON      │                              │
│  • Calcula totales en vivo  │                            │  • Recalcula totales (fuente │
│  • Genera el PDF (jsPDF)     │                            │    de verdad)                │
└─────────────────────────────┘                            │  • Lee/escribe en la planilla│
                                                            └───────────────┬──────────────┘
                                                                            │
                                                                            ▼
                                                            ┌──────────────────────────────┐
                                                            │   GOOGLE SHEETS               │
                                                            │   Base de datos (10 hojas)    │
                                                            │   Configuracion, Insumos_Stock,│
                                                            │   Clientes, Presupuestos,      │
                                                            │   Presupuesto_Items, Trabajos, │
                                                            │   Pagos, Proveedores,          │
                                                            │   Localidades, KPIs_Mensuales  │
                                                            └──────────────────────────────┘
```

**Decisiones clave**

- **Un solo archivo `index.html`** (HTML + CSS + JavaScript, sin frameworks). Se abre en cualquier navegador de celular y se puede publicar en segundos.
- **El servidor es la fuente de verdad** de los cálculos: aunque la app muestra los totales en vivo, al guardar, el Apps Script los vuelve a calcular para que nunca haya errores.
- **PDF generado en el propio dispositivo** con jsPDF (no se sube nada a ningún lado).
- **Sin CORS ni claves**: la app le habla al Apps Script con peticiones simples; solo hay que pegar una URL la primera vez.

---

## 3. Estructura de archivos

```
bbmoon-puntadas/
├── frontend/
│   ├── index.html          ← La aplicación completa (esto es lo que se publica)
│   ├── manifest.json       ← Para que se instale como app en el celular
│   ├── icon-192.png        ← Ícono de la app
│   ├── icon-512.png        ← Ícono de la app
│   └── assets/             ← Logos originales de la marca
├── backend/
│   ├── Codigo.gs           ← Código principal para Google Apps Script
│   └── Insumos_Iniciales.gs← Los 48 insumos listos para cargar de una vez
├── docs/
│   ├── README.md           ← Este documento
│   ├── INSTALACION.md      ← Paso a paso para dejarlo funcionando
│   ├── MANUAL_DE_USO.md    ← Guía para el día a día (sin tecnicismos)
│   └── CAMBIOS.md          ← Qué se corrigió en la versión 1.1
└── sample_presupuesto.pdf  ← Ejemplo de PDF que genera la app
```

> **Logo:** el logo de BBMOON PUNTADAS ya viene **embebido dentro de `index.html`** (aparece en la barra superior, en la pantalla de conexión y en el encabezado de cada PDF), así que la app sigue siendo un solo archivo. En `frontend/assets/` quedan las copias por si querés reutilizarlas. Para cambiar el logo más adelante hay que reemplazar la imagen embebida en el HTML.

---

## 4. Puesta en marcha (resumen)

El detalle completo está en **`docs/INSTALACION.md`**. En pocas palabras:

1. **Crear la planilla** en Google Sheets (en blanco).
2. **Pegar `Codigo.gs`** en el editor de Apps Script de esa planilla.
3. **Ejecutar `bootstrap()`** una vez → crea solas las 10 hojas con sus columnas.
3.b **Ejecutar `cargarInsumosIniciales()`** → carga los 48 insumos del taller.
4. **Publicar** como aplicación web (*Implementar → Nueva implementación → Aplicación web*), con acceso "Cualquier persona", y **copiar la URL `/exec`**.
5. **Abrir `index.html`** en el celular, pegar esa URL cuando la pida (se guarda sola) y listo.

---

## 5. Cálculo del presupuesto

La lógica es exactamente la del pedido:

```
subtotal_materiales = suma de (cantidad × precio_unitario) de cada ítem

mano_de_obra:
  • por porcentaje  → subtotal_materiales × (porcentaje / 100)      (por defecto 50%)
  • por monto fijo  → el monto que cargue Verónica

subtotal_sin_iva = subtotal_materiales + mano_de_obra + otros_costos − descuento

IVA  = subtotal_sin_iva × 0,21     (solo si se tilda "Aplica IVA")
total_final = subtotal_sin_iva + IVA
```

**Ejemplo** (el mismo del enunciado): materiales **$50.000**, mano de obra 50% = **$25.000**, subtotal **$75.000**; con IVA 21% → IVA **$15.750**, **total $90.750**. ✔️

---

## 6. Modelo de datos (hojas y columnas)

- **Configuracion** — `clave`, `valor` (datos del negocio en formato clave/valor).
- **Insumos_Stock** — `id_insumo`, `codigo`, `categoria`, `nombre`, `descripcion`, `unidad_medida`, `cantidad_stock`, `stock_minimo`, `costo_unitario`, `margen_porcentaje`, `precio_venta_unitario`, `proveedor`, `fecha_actualizacion_precio`, `estado`, `observaciones`.
- **Clientes** — `id_cliente`, `nombre`, `empresa`, `telefono`, `email`, `localidad`, `provincia`, `direccion`, `tipo_cliente`, `fecha_alta`, `observaciones`.
- **Presupuestos** — `id_presupuesto`, `numero_presupuesto`, `fecha_emision`, `fecha_vencimiento`, `id_cliente`, `cliente_nombre`, `titulo`, `descripcion`, `subtotal_materiales`, `tipo_mano_obra`, `porcentaje_mano_obra`, `monto_mano_obra`, `otros_costos`, `descuento`, `subtotal_sin_iva`, `aplica_iva`, `iva`, `total_con_iva`, `total_final`, `estado`, `observaciones_internas`, `observaciones_cliente`, `pdf_url`.
- **Presupuesto_Items** — `id_item`, `id_presupuesto`, `id_insumo`, `codigo_insumo`, `nombre_insumo`, `descripcion`, `cantidad`, `unidad_medida`, `precio_unitario`, `subtotal_item`, `observaciones`.
- **Trabajos** — `id_trabajo`, `id_presupuesto`, `id_cliente`, `cliente_nombre`, `titulo_trabajo`, `descripcion`, `fecha_aprobacion`, `fecha_estimada_entrega`, `fecha_finalizacion`, `estado_trabajo`, `total_trabajo`, `sena`, `saldo`, `observaciones`.
- **Pagos** — `id_pago`, `id_trabajo`, `id_cliente`, `fecha_pago`, `medio_pago`, `monto`, `concepto`, `observaciones`.
- **Proveedores** — `id_proveedor`, `nombre`, `telefono`, `email`, `localidad`, `provincia`, `direccion`, `rubro`, `observaciones`.
- **Localidades** — `id_localidad`, `localidad`, `provincia`, `pais`.
- **KPIs_Mensuales** — `mes`, `anio`, `cantidad_presupuestos`, `monto_presupuestado`, `cantidad_aprobados`, `tasa_conversion`, `total_vendido`, `ticket_promedio`, `trabajos_pendientes`, `trabajos_finalizados`, `insumos_bajo_stock`, `margen_estimado`.

> Todas las hojas se crean automáticamente al ejecutar `bootstrap()`. No hay que armar nada a mano.

---

## 7. Mejoras futuras (ideas para más adelante)

- **Envío directo** del PDF por WhatsApp o email desde la misma app.
- **Descuento real de stock** al aprobar un trabajo (hoy el stock se administra a mano).
- **Usuario y contraseña** o PIN para proteger el acceso.
- **Fotos** de las prendas/insumos en la ficha.
- **Plantillas de presupuesto** para trabajos repetidos (ej.: "bata estándar").
- **Actualización masiva de precios** por proveedor o por porcentaje.
- **Recordatorios** de presupuestos por vencer y de entregas próximas.
- **Backup/exportación** a Excel de todo el historial.
- Convertir la app en **PWA instalable** (ícono en la pantalla de inicio, uso sin conexión parcial).

---

## 8. Preguntas frecuentes

**¿Necesito internet?** Sí, para leer y guardar en la planilla. El armado del presupuesto y el PDF funcionan en el momento.

**¿Se pueden equivocar los totales?** No: el servidor recalcula todo al guardar.

**¿Puedo cambiar el nombre, CUIT o el % de mano de obra?** Sí, desde **Configuración** dentro de la app.

**¿Dónde quedan los datos?** En tu propia Planilla de Google, en tu cuenta. Podés abrirla y verla como cualquier planilla.

**¿Puedo usarlo en la computadora también?** Sí, es la misma dirección web; se adapta a pantallas grandes.

---

## 9. Versión

**v1.1** — ver `docs/CAMBIOS.md` para el detalle de correcciones (fechas/zona horaria, señas, bloqueo de escrituras simultáneas, borrado de registros, carga masiva de insumos e instalación como app en el celular).
