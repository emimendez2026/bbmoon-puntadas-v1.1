# Instalación y conexión — BBMOON PUNTADAS

Tiempo estimado: **20 minutos**. Solo hace falta una cuenta de Google gratuita. No se instala ningún programa.

Son **4 etapas**:

- **A.** Crear la planilla (base de datos) y pegar el backend.
- **B.** Cargar los 48 insumos iniciales.
- **C.** Publicar el backend y copiar su dirección `/exec`.
- **D.** Poner la app en línea y conectarla.

> Si ya habías hecho una instalación antes, saltá directo a **"Actualizar una instalación existente"** al final.

---

## Etapa A — Planilla + backend

### A.1. Crear la planilla
1. Entrá a **https://sheets.google.com** con la cuenta de Google que va a ser dueña de los datos.
2. Clic en **+ En blanco**.
3. Ponele un nombre arriba a la izquierda: **`BBMOON PUNTADAS - Datos`**.

> Consejo: usá la cuenta de Google del **negocio**, no una personal. Los datos quedan ahí para siempre.

### A.2. Abrir el editor de código
1. En el menú de la planilla: **Extensiones → Apps Script**.
2. Se abre una pestaña nueva con un archivo `Código.gs` y una función vacía.

### A.3. Pegar el backend
1. Seleccioná todo lo que hay en el editor (`Ctrl+A`) y **borralo**.
2. Abrí **`backend/Codigo.gs`** de este proyecto, copiá **todo** y pegalo.
3. Guardá con `Ctrl+S`.
4. Arriba a la izquierda, renombrá el proyecto: **`API BBMOON`**.

### A.4. Agregar el archivo de insumos
1. En el panel izquierdo, al lado de **Archivos**, clic en **+ → Secuencia de comandos**.
2. Ponele de nombre **`Insumos_Iniciales`** (Apps Script le agrega `.gs` solo).
3. Borrá lo que traiga y pegá **todo** el contenido de **`backend/Insumos_Iniciales.gs`**.
4. Guardá con `Ctrl+S`.

### A.5. Crear las hojas
1. En la barra de arriba, en el desplegable de funciones, elegí **`bootstrap`**.
2. Clic en **▶ Ejecutar**.
3. La primera vez Google pide **permisos**:
   - **Revisar permisos** → elegí tu cuenta.
   - Si dice *"Google no verificó esta app"*: **Configuración avanzada → Ir a API BBMOON (no seguro)**. Es tu propio código; es seguro.
   - **Permitir**.
4. Volvé a la planilla: ahora tiene **10 pestañas** (Configuracion, Insumos_Stock, Clientes, Presupuestos, Presupuesto_Items, Trabajos, Pagos, Proveedores, Localidades, KPIs_Mensuales). ✔️

---

## Etapa B — Cargar los 48 insumos

1. Volvé al editor de Apps Script.
2. En el desplegable de funciones elegí **`cargarInsumosIniciales`**.
3. Clic en **▶ Ejecutar**.
4. En la planilla, la hoja **Insumos_Stock** queda con **48 artículos** (hilos, cierres, botones, elásticos, cintas, entretelas, avíos, agujas, herramientas), cada uno con costo, margen y precio de venta.

> Se puede ejecutar más de una vez sin miedo: si un **código** ya existe, actualiza esa fila en vez de duplicarla. Sirve también para **actualizar precios en masa** más adelante (editás la lista en el archivo y volvés a ejecutar).

---

## Etapa C — Publicar el backend

1. En el editor, arriba a la derecha: **Implementar → Nueva implementación**.
2. Clic en el **engranaje (⚙)** junto a "Seleccionar tipo" → **Aplicación web**.
3. Completá:
   - **Descripción**: `API BBMOON v1.1`
   - **Ejecutar como**: **Yo (tu correo)**
   - **Quién tiene acceso**: **Cualquier persona**
4. Clic en **Implementar** y aceptá los permisos.
5. Copiá la **URL de la aplicación web**. Termina en **`/exec`**:

   ```
   https://script.google.com/macros/s/AKfy...muy-larga.../exec
   ```

   ⚠️ Guardala. Es la llave que conecta la app con la planilla. Debe terminar en **`/exec`**, nunca en `/dev`.

### Probar que responde
Pegá esa URL en el navegador. Tiene que aparecer algo así:

```json
{"ok":true,"message":"BBMOON PUNTADAS API activa"}
```

Si aparece eso, el backend está funcionando. ✔️

---

## Etapa D — Publicar la app y conectarla

### Opción recomendada: GitHub Pages (link propio, gratis)

1. Entrá a **github.com** y creá una cuenta (o iniciá sesión).
2. Arriba a la derecha: **+ → New repository**.
   - **Repository name**: `bbmoon-puntadas`
   - Marcá **Public**
   - **Create repository**
3. **Add file → Upload files** y arrastrá estos **4 archivos** de la carpeta `frontend/`:
   - `index.html`
   - `manifest.json`
   - `icon-192.png`
   - `icon-512.png`

   Los 4 tienen que quedar en la **raíz** del repo, no dentro de una carpeta.
4. Abajo, clic en **Commit changes**.
5. Andá a **Settings → Pages**.
   - **Source**: Deploy from a branch
   - **Branch**: `main` y carpeta `/ (root)` → **Save**
6. Esperá 1–2 minutos y refrescá. Aparece tu dirección:
   ```
   https://tu-usuario.github.io/bbmoon-puntadas/
   ```

### Conectar la app
1. Abrí ese link en el celular.
2. La primera pantalla pide la **URL del backend**: pegá la de la Etapa C (`/exec`) y confirmá.
3. Queda guardada en ese dispositivo. No hay que volver a cargarla.

### Instalarla como app en el celular
- **Android (Chrome)**: menú ⋮ → **Instalar aplicación** / *Agregar a pantalla principal*.
- **iPhone (Safari)**: botón **Compartir** → **Agregar a inicio**.

Queda con el logo de BBMOON y se abre a pantalla completa, sin barra del navegador.

### Alternativa más rápida: Netlify Drop
1. Entrá a **https://app.netlify.com/drop**.
2. Arrastrá la carpeta `frontend` completa.
3. En segundos te da un link público. Funciona igual.

---

## Verificación final (hacé esto antes de entregarla)

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Abrir la app | Se ve el **Inicio** con el resumen del mes |
| 2 | Ir a **Insumos** | Aparecen los 48 artículos |
| 3 | Configuración → cargar teléfono, email, CUIT → Guardar | En la planilla, hoja **Configuracion**, cambian los valores |
| 4 | **Nuevo Presupuesto** → cliente nuevo → agregar 2 insumos → Guardar | Aparece en la hoja **Presupuestos** y los ítems en **Presupuesto_Items** |
| 5 | Tocar **Exportar PDF** | Se descarga el PDF con el logo y los datos del taller |
| 6 | Cambiar estado a **Aprobado** → **Convertir en trabajo** con seña | Aparece en **Trabajos**; la seña queda en **Pagos** |
| 7 | Registrar un pago | El saldo baja y suma la seña anterior |
| 8 | **Métricas** | Muestra el presupuesto en el mes correcto |
| 9 | Eliminar el presupuesto de prueba | Desaparece de la planilla junto con sus ítems |

Si los 9 pasan, está lista para entregar.

---

## Actualizar una instalación existente

Si ya tenías la versión anterior andando:

1. Editor de Apps Script → pegá el **nuevo** `Codigo.gs` encima del viejo (`Ctrl+A`, pegar, `Ctrl+S`).
2. Agregá el archivo `Insumos_Iniciales.gs` (Etapa A.4) y ejecutá `cargarInsumosIniciales` si querés los 48 insumos.
3. **Implementar → Gestionar implementaciones → ✏️ (lápiz) → Versión: Nueva versión → Implementar.**
   Así la **URL sigue siendo la misma** y no hay que reconectar nada.
4. Subí el nuevo `index.html` (+ los 3 archivos nuevos) al repo de GitHub y esperá 2 minutos.

> ⚠️ El error más común: modificar el código y **no crear una versión nueva**. Los cambios no se aplican hasta que hacés el paso 3.

---

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| "No se pudo conectar" / no carga nada | La URL no termina en `/exec`, o la implementación no está en **"Cualquier persona"**. Revisá la Etapa C. |
| La URL `/exec` muestra un error de permisos | Volvé a implementar eligiendo **Ejecutar como: Yo** y **Acceso: Cualquier persona**. |
| Cambié el código y no se ve el cambio | Falta crear una **Nueva versión** en *Gestionar implementaciones*. |
| Error 404 en el link de GitHub | El archivo no se llama exactamente `index.html`, está dentro de una carpeta, o no pasaron los 2 minutos. |
| Los permisos quedaron a medias | Ejecutá `bootstrap` otra vez y completá el flujo hasta **Permitir**. |
| El PDF sale sin logo | El celular estaba sin internet al abrir la app (jsPDF se carga desde internet la primera vez). |
| Se duplicaron los insumos | Ejecutá `reemplazarInsumosPorLaListaInicial` (borra la hoja y la deja limpia). |
| Quiero empezar de cero | Creá una planilla nueva y repetí desde la Etapa A. |
