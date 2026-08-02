/**
 * ============================================================================
 *  BBMOON PUNTADAS — Backend (Google Apps Script)
 * ============================================================================
 *  Convierte una planilla de Google Sheets en una pequeña API para la app web.
 *
 *  Cómo funciona:
 *   - La app envía peticiones POST con un cuerpo JSON: { action, payload }.
 *   - Este script lee/escribe en las pestañas de la planilla y devuelve JSON.
 *
 *  Acciones disponibles (action):
 *   - "ping"            -> prueba de conexión
 *   - "bootstrap"       -> crea todas las pestañas y encabezados si faltan
 *   - "getConfig"       -> lee la configuración del negocio
 *   - "saveConfig"      -> guarda la configuración del negocio
 *   - "listInsumos"     -> lista todos los insumos
 *   - "saveInsumo"      -> crea o actualiza un insumo
 *   - "deleteInsumo"    -> marca un insumo como inactivo
 *   - "listClientes"    -> lista todos los clientes
 *   - "saveCliente"     -> crea o actualiza un cliente
 *   - "listPresupuestos"-> lista los presupuestos (sin ítems)
 *   - "getPresupuesto"  -> devuelve un presupuesto con sus ítems
 *   - "savePresupuesto" -> crea o actualiza un presupuesto + ítems
 *   - "setEstadoPresupuesto" -> cambia solo el estado
 *   - "listTrabajos"    -> lista trabajos
 *   - "convertirEnTrabajo"   -> crea un trabajo a partir de un presupuesto
 *   - "saveTrabajo"     -> actualiza un trabajo
 *   - "listPagos"       -> lista pagos
 *   - "savePago"        -> registra un pago
 *   - "listProveedores" -> lista proveedores
 *   - "saveProveedor"   -> crea o actualiza proveedor
 *   - "getKPIs"         -> métricas calculadas del negocio
 *
 *  IMPORTANTE: después de pegar este código, ejecutá la función `bootstrap`
 *  una vez desde el editor para que se creen todas las pestañas.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  Definición de las hojas y sus columnas (el orden importa).
// ---------------------------------------------------------------------------
var SHEETS = {
  Configuracion: [
    'clave', 'valor'
  ],
  Insumos_Stock: [
    'id_insumo', 'codigo', 'categoria', 'nombre', 'descripcion',
    'unidad_medida', 'cantidad_stock', 'stock_minimo', 'costo_unitario',
    'margen_porcentaje', 'precio_venta_unitario', 'proveedor',
    'fecha_actualizacion_precio', 'estado', 'observaciones'
  ],
  Clientes: [
    'id_cliente', 'nombre', 'empresa', 'telefono', 'email', 'localidad',
    'provincia', 'direccion', 'tipo_cliente', 'fecha_alta', 'observaciones'
  ],
  Presupuestos: [
    'id_presupuesto', 'numero_presupuesto', 'fecha_emision',
    'fecha_vencimiento', 'id_cliente', 'cliente_nombre', 'titulo',
    'descripcion', 'subtotal_materiales', 'tipo_mano_obra',
    'porcentaje_mano_obra', 'monto_mano_obra', 'otros_costos', 'descuento',
    'subtotal_sin_iva', 'aplica_iva', 'iva', 'total_con_iva', 'total_final',
    'estado', 'observaciones_internas', 'observaciones_cliente', 'pdf_url'
  ],
  Presupuesto_Items: [
    'id_item', 'id_presupuesto', 'id_insumo', 'codigo_insumo',
    'nombre_insumo', 'descripcion', 'cantidad', 'unidad_medida',
    'precio_unitario', 'subtotal_item', 'observaciones'
  ],
  Trabajos: [
    'id_trabajo', 'id_presupuesto', 'id_cliente', 'cliente_nombre',
    'titulo_trabajo', 'descripcion', 'fecha_aprobacion',
    'fecha_estimada_entrega', 'fecha_finalizacion', 'estado_trabajo',
    'total_trabajo', 'sena', 'saldo', 'observaciones'
  ],
  Pagos: [
    'id_pago', 'id_trabajo', 'id_cliente', 'fecha_pago', 'medio_pago',
    'monto', 'concepto', 'observaciones'
  ],
  Proveedores: [
    'id_proveedor', 'nombre', 'telefono', 'email', 'localidad', 'provincia',
    'direccion', 'rubro', 'observaciones'
  ],
  Localidades: [
    'id_localidad', 'localidad', 'provincia', 'pais'
  ],
  KPIs_Mensuales: [
    'mes', 'anio', 'cantidad_presupuestos', 'monto_presupuestado',
    'cantidad_aprobados', 'tasa_conversion', 'total_vendido',
    'ticket_promedio', 'trabajos_pendientes', 'trabajos_finalizados',
    'insumos_bajo_stock', 'margen_estimado'
  ]
};

// Valores por defecto de la configuración del negocio.
var CONFIG_DEFAULTS = {
  nombre_negocio: 'BBMOON PUNTADAS',
  nombre_responsable: 'Verónica',
  telefono: '',
  email: '',
  direccion: '',
  localidad: '',
  provincia: '',
  cuit: '',
  condicion_fiscal: '',
  iva_porcentaje: '21',
  mano_obra_porcentaje: '50',
  validez_dias: '10',
  moneda: 'ARS',
  logo_url: '',
  colores_marca: 'salvia'
};

// ---------------------------------------------------------------------------
//  Puntos de entrada HTTP
// ---------------------------------------------------------------------------

/** Maneja peticiones GET (usado para el "ping" desde el navegador). */
function doGet(e) {
  return jsonOut({ ok: true, message: 'BBMOON PUNTADAS API activa' });
}

/** Maneja peticiones POST (todas las acciones de la app). */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action || '';
    var payload = body.payload || {};

    // Las acciones de escritura se serializan con un candado para evitar que
    // dos guardados simultáneos se pisen (por ejemplo, dos números de
    // presupuesto iguales).
    var esEscritura = /^(save|delete|convertir|bootstrap|import|setEstado)/.test(action);
    if (esEscritura) {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        var r = route(action, payload);
        SpreadsheetApp.flush();
        return jsonOut({ ok: true, data: r });
      } finally {
        lock.releaseLock();
      }
    }

    var result = route(action, payload);
    return jsonOut({ ok: true, data: result });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** Distribuye la acción hacia la función correspondiente. */
function route(action, payload) {
  switch (action) {
    case 'ping':                 return { pong: true, time: new Date().toISOString() };
    case 'bootstrap':            return bootstrap();
    case 'getConfig':            return getConfig();
    case 'saveConfig':           return saveConfig(payload);
    case 'listInsumos':          return readAll('Insumos_Stock');
    case 'saveInsumo':           return saveInsumo(payload);
    case 'deleteInsumo':         return deleteInsumo(payload);
    case 'listClientes':         return readAll('Clientes');
    case 'saveCliente':          return saveCliente(payload);
    case 'listPresupuestos':     return readAll('Presupuestos');
    case 'getPresupuesto':       return getPresupuesto(payload);
    case 'savePresupuesto':      return savePresupuesto(payload);
    case 'setEstadoPresupuesto': return setEstadoPresupuesto(payload);
    case 'listTrabajos':         return readAll('Trabajos');
    case 'convertirEnTrabajo':   return convertirEnTrabajo(payload);
    case 'saveTrabajo':          return saveTrabajo(payload);
    case 'listPagos':            return readAll('Pagos');
    case 'savePago':             return savePago(payload);
    case 'deletePresupuesto':    return deletePresupuesto(payload);
    case 'deleteCliente':        return deleteCliente(payload);
    case 'deleteTrabajo':        return deleteTrabajo(payload);
    case 'importInsumos':        return importInsumos(payload);
    case 'listProveedores':      return readAll('Proveedores');
    case 'saveProveedor':        return saveProveedor(payload);
    case 'getKPIs':              return getKPIs(payload);
    case 'getSheetUrl':          return getSheetUrl();
    default: throw new Error('Acción desconocida: ' + action);
  }
}

// ---------------------------------------------------------------------------
//  Utilidades base
// ---------------------------------------------------------------------------

/** Devuelve la salida como JSON. */
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Obtiene (o crea) una hoja por nombre con sus encabezados. */
function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Crea todas las hojas y carga defaults. Ejecutar una sola vez. */
function bootstrap() {
  Object.keys(SHEETS).forEach(function (name) { getSheet(name); });

  // Cargar configuración por defecto si la hoja está vacía.
  var cfg = getSheet('Configuracion');
  if (cfg.getLastRow() <= 1) {
    Object.keys(CONFIG_DEFAULTS).forEach(function (k) {
      cfg.appendRow([k, CONFIG_DEFAULTS[k]]);
    });
  }

  // Cargar algunas localidades de ejemplo (Argentina).
  var loc = getSheet('Localidades');
  if (loc.getLastRow() <= 1) {
    var ejemplos = [
      ['Ciudad Autónoma de Buenos Aires', 'CABA'],
      ['La Plata', 'Buenos Aires'],
      ['Mar del Plata', 'Buenos Aires'],
      ['Córdoba', 'Córdoba'],
      ['Rosario', 'Santa Fe'],
      ['Mendoza', 'Mendoza'],
      ['San Miguel de Tucumán', 'Tucumán'],
      ['Salta', 'Salta'],
      ['Neuquén', 'Neuquén'],
      ['Bariloche', 'Río Negro']
    ];
    ejemplos.forEach(function (r, i) {
      loc.appendRow(['LOC-' + (i + 1), r[0], r[1], 'Argentina']);
    });
  }

  return { created: Object.keys(SHEETS) };
}

/** Lee todas las filas de una hoja como array de objetos. */
function readAll(name) {
  var sh = getSheet(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      var v = values[i][c];
      obj[headers[c]] = v;
      if (v !== '' && v !== null) empty = false;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

/** Encuentra el índice (0-based dentro de datos) de una fila por columna id. */
function findRowIndex(sh, idCol, idVal) {
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var col = headers.indexOf(idCol);
  if (col === -1) return -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][col]) === String(idVal)) return i; // fila real (incluye header)
  }
  return -1;
}

/** Convierte un objeto en una fila ordenada según los headers de la hoja. */
function objToRow(name, obj) {
  return SHEETS[name].map(function (h) {
    return (obj[h] === undefined || obj[h] === null) ? '' : obj[h];
  });
}

/** Inserta o actualiza (upsert) una fila usando la columna id indicada. */
function upsert(name, idCol, obj) {
  var sh = getSheet(name);
  var rowValues = objToRow(name, obj);
  var rowIndex = obj[idCol] ? findRowIndex(sh, idCol, obj[idCol]) : -1;
  if (rowIndex > 0) {
    sh.getRange(rowIndex + 1, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sh.appendRow(rowValues);
  }
  return obj;
}

/** Genera un id único con prefijo. */
function newId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

/** Formatea una fecha como YYYY-MM-DD. */
function ymd(d) {
  d = d || new Date();
  if (typeof d === 'string') d = parseFecha(d) || new Date();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return d.getFullYear() + '-' + m + '-' + day;
}

function toNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  var n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/**
 * Convierte a fecha SIN corrimiento de zona horaria.
 * "2026-08-01" con new Date() se interpreta como UTC y en Argentina (UTC-3)
 * pasa a ser el 31/07 — eso hacía que los presupuestos del día 1 se contaran
 * en el mes anterior. Acá parseamos los números a mano.
 * Devuelve null si no se puede interpretar.
 */
function parseFecha(v) {
  if (!v && v !== 0) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? null : v;
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);            // 2026-08-01
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);          // 01/08/2026
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
//  Configuración
// ---------------------------------------------------------------------------

function getConfig() {
  var sh = getSheet('Configuracion');
  var values = sh.getDataRange().getValues();
  var cfg = {};
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) cfg[values[i][0]] = values[i][1];
  }
  // Completar defaults ausentes.
  Object.keys(CONFIG_DEFAULTS).forEach(function (k) {
    if (cfg[k] === undefined) cfg[k] = CONFIG_DEFAULTS[k];
  });
  // Dirección de la planilla, para poder abrirla desde la app.
  // Se calcula en el momento; no se guarda como fila en la hoja.
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    cfg.planilla_url = ss.getUrl();
    cfg.planilla_nombre = ss.getName();
  } catch (e) {
    cfg.planilla_url = '';
    cfg.planilla_nombre = '';
  }
  return cfg;
}

/** Devuelve la dirección de la planilla y de cada una de sus hojas. */
function getSheetUrl() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = ss.getSheets().map(function (sh) {
    return { nombre: sh.getName(), url: ss.getUrl() + '#gid=' + sh.getSheetId() };
  });
  return { url: ss.getUrl(), nombre: ss.getName(), hojas: hojas };
}

function saveConfig(payload) {
  var sh = getSheet('Configuracion');
  var values = sh.getDataRange().getValues();
  var map = {}; // clave -> fila real
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) map[values[i][0]] = i + 1;
  }
  var CALCULADAS = { planilla_url: 1, planilla_nombre: 1 };
  Object.keys(payload).forEach(function (k) {
    if (CALCULADAS[k]) return;   // no se guardan: se calculan al vuelo
    if (map[k]) {
      sh.getRange(map[k], 2).setValue(payload[k]);
    } else {
      sh.appendRow([k, payload[k]]);
    }
  });
  return getConfig();
}

// ---------------------------------------------------------------------------
//  Insumos
// ---------------------------------------------------------------------------

function saveInsumo(p) {
  if (!p.id_insumo) p.id_insumo = newId('INS');
  if (!p.fecha_actualizacion_precio) p.fecha_actualizacion_precio = ymd();
  if (!p.estado) p.estado = 'activo';
  // Recalcular precio de venta si no vino cargado manualmente.
  if ((p.precio_venta_unitario === '' || p.precio_venta_unitario === undefined) &&
      p.costo_unitario !== undefined) {
    var costo = toNum(p.costo_unitario);
    var margen = toNum(p.margen_porcentaje);
    p.precio_venta_unitario = Math.round((costo * (1 + margen / 100)) * 100) / 100;
  }
  return upsert('Insumos_Stock', 'id_insumo', p);
}

function deleteInsumo(p) {
  var sh = getSheet('Insumos_Stock');
  var idx = findRowIndex(sh, 'id_insumo', p.id_insumo);
  if (idx > 0) {
    var col = SHEETS.Insumos_Stock.indexOf('estado') + 1;
    sh.getRange(idx + 1, col).setValue('inactivo');
  }
  return { id_insumo: p.id_insumo, estado: 'inactivo' };
}

// ---------------------------------------------------------------------------
//  Clientes
// ---------------------------------------------------------------------------

function saveCliente(p) {
  if (!p.id_cliente) p.id_cliente = newId('CLI');
  if (!p.fecha_alta) p.fecha_alta = ymd();
  if (!p.tipo_cliente) p.tipo_cliente = 'particular';
  return upsert('Clientes', 'id_cliente', p);
}

// ---------------------------------------------------------------------------
//  Presupuestos
// ---------------------------------------------------------------------------

/** Calcula el próximo número correlativo de presupuesto (formato PRESU-000123). */
function nextNumeroPresupuesto() {
  var rows = readAll('Presupuestos');
  var max = 0;
  rows.forEach(function (r) {
    var m = String(r.numero_presupuesto || '').match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  var next = max + 1;
  return 'PRESU-' + ('000000' + next).slice(-6);
}

/** Recalcula todos los totales de un presupuesto en el servidor (fuente de verdad). */
function recomputeTotals(p, items) {
  var subtotalMateriales = 0;
  items.forEach(function (it) {
    var sub = toNum(it.cantidad) * toNum(it.precio_unitario);
    it.subtotal_item = Math.round(sub * 100) / 100;
    subtotalMateriales += it.subtotal_item;
  });

  var tipoMO = p.tipo_mano_obra || 'porcentaje';
  var porcMO = toNum(p.porcentaje_mano_obra);
  var montoMO;
  if (tipoMO === 'monto') {
    montoMO = toNum(p.monto_mano_obra);
  } else {
    montoMO = subtotalMateriales * (porcMO / 100);
  }

  var otros = toNum(p.otros_costos);
  var descuento = toNum(p.descuento);
  var subtotalSinIva = subtotalMateriales + montoMO + otros - descuento;

  var aplicaIva = (p.aplica_iva === true || p.aplica_iva === 'true' || p.aplica_iva === 'si');
  var ivaPorc = toNum(getConfig().iva_porcentaje) || 21;
  var iva = aplicaIva ? subtotalSinIva * (ivaPorc / 100) : 0;
  var totalConIva = subtotalSinIva + iva;
  var totalFinal = aplicaIva ? totalConIva : subtotalSinIva;

  var r2 = function (n) { return Math.round(n * 100) / 100; };
  p.subtotal_materiales = r2(subtotalMateriales);
  p.monto_mano_obra = r2(montoMO);
  p.subtotal_sin_iva = r2(subtotalSinIva);
  p.iva = r2(iva);
  p.total_con_iva = r2(totalConIva);
  p.total_final = r2(totalFinal);
  return { p: p, items: items };
}

function savePresupuesto(payload) {
  var p = payload.presupuesto || {};
  var items = payload.items || [];

  if (!p.id_presupuesto) p.id_presupuesto = newId('PRE');
  if (!p.numero_presupuesto) p.numero_presupuesto = nextNumeroPresupuesto();
  if (!p.fecha_emision) p.fecha_emision = ymd();
  if (!p.fecha_vencimiento) {
    var dias = toNum(getConfig().validez_dias) || 10;
    var venc = new Date();
    venc.setDate(venc.getDate() + dias);
    p.fecha_vencimiento = ymd(venc);
  }
  if (!p.estado) p.estado = 'borrador';

  var calc = recomputeTotals(p, items);
  p = calc.p;
  items = calc.items;

  upsert('Presupuestos', 'id_presupuesto', p);

  // Reemplazar ítems: borrar los existentes de este presupuesto y reinsertar.
  var shItems = getSheet('Presupuesto_Items');
  var values = shItems.getDataRange().getValues();
  var colPre = values[0].indexOf('id_presupuesto');
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][colPre]) === String(p.id_presupuesto)) {
      shItems.deleteRow(i + 1);
    }
  }
  items.forEach(function (it) {
    if (!it.id_item) it.id_item = newId('ITM');
    it.id_presupuesto = p.id_presupuesto;
    shItems.appendRow(objToRow('Presupuesto_Items', it));
  });

  return { presupuesto: p, items: items };
}

function getPresupuesto(payload) {
  var id = payload.id_presupuesto;
  var all = readAll('Presupuestos');
  var pre = null;
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].id_presupuesto) === String(id)) { pre = all[i]; break; }
  }
  if (!pre) throw new Error('Presupuesto no encontrado');
  var items = readAll('Presupuesto_Items').filter(function (it) {
    return String(it.id_presupuesto) === String(id);
  });
  return { presupuesto: pre, items: items };
}

function setEstadoPresupuesto(payload) {
  var sh = getSheet('Presupuestos');
  var idx = findRowIndex(sh, 'id_presupuesto', payload.id_presupuesto);
  if (idx > 0) {
    var col = SHEETS.Presupuestos.indexOf('estado') + 1;
    sh.getRange(idx + 1, col).setValue(payload.estado);
  }
  return { id_presupuesto: payload.id_presupuesto, estado: payload.estado };
}

// ---------------------------------------------------------------------------
//  Trabajos y pagos
// ---------------------------------------------------------------------------

function convertirEnTrabajo(payload) {
  var data = getPresupuesto({ id_presupuesto: payload.id_presupuesto });
  var pre = data.presupuesto;

  var trabajo = {
    id_trabajo: newId('TRA'),
    id_presupuesto: pre.id_presupuesto,
    id_cliente: pre.id_cliente,
    cliente_nombre: pre.cliente_nombre,
    titulo_trabajo: pre.titulo,
    descripcion: pre.descripcion,
    fecha_aprobacion: ymd(),
    fecha_estimada_entrega: payload.fecha_estimada_entrega || '',
    fecha_finalizacion: '',
    estado_trabajo: 'pendiente',
    total_trabajo: pre.total_final,
    sena: toNum(payload.sena),
    saldo: toNum(pre.total_final) - toNum(payload.sena),
    observaciones: payload.observaciones || ''
  };
  upsert('Trabajos', 'id_trabajo', trabajo);

  // La seña inicial se registra también como pago. Si no, al cargar el primer
  // pago real el saldo se recalculaba desde la hoja Pagos y la seña se perdía.
  if (toNum(payload.sena) > 0) {
    upsert('Pagos', 'id_pago', {
      id_pago: newId('PAG'),
      id_trabajo: trabajo.id_trabajo,
      id_cliente: trabajo.id_cliente,
      fecha_pago: ymd(),
      medio_pago: payload.medio_pago_sena || 'efectivo',
      monto: toNum(payload.sena),
      concepto: 'Seña inicial',
      observaciones: ''
    });
  }

  setEstadoPresupuesto({ id_presupuesto: pre.id_presupuesto, estado: 'convertido' });
  return trabajo;
}

function saveTrabajo(p) {
  if (!p.id_trabajo) p.id_trabajo = newId('TRA');
  p.saldo = toNum(p.total_trabajo) - toNum(p.sena);
  return upsert('Trabajos', 'id_trabajo', p);
}

function savePago(p) {
  if (!p.id_pago) p.id_pago = newId('PAG');
  if (!p.fecha_pago) p.fecha_pago = ymd();
  upsert('Pagos', 'id_pago', p);

  // Actualizar la seña / saldo del trabajo asociado.
  if (p.id_trabajo) {
    var trabajos = readAll('Trabajos');
    var t = null;
    for (var i = 0; i < trabajos.length; i++) {
      if (String(trabajos[i].id_trabajo) === String(p.id_trabajo)) { t = trabajos[i]; break; }
    }
    if (t) {
      var pagos = readAll('Pagos').filter(function (x) {
        return String(x.id_trabajo) === String(p.id_trabajo);
      });
      var totalPagado = 0;
      pagos.forEach(function (x) { totalPagado += toNum(x.monto); });
      t.sena = totalPagado;
      t.saldo = toNum(t.total_trabajo) - totalPagado;
      upsert('Trabajos', 'id_trabajo', t);
    }
  }
  return p;
}

// ---------------------------------------------------------------------------
//  Borrados
// ---------------------------------------------------------------------------

/** Borra una fila por su id. Devuelve true si borró algo. */
function deleteRowById(sheetName, idCol, idVal) {
  var sh = getSheet(sheetName);
  var idx = findRowIndex(sh, idCol, idVal);
  if (idx > 0) { sh.deleteRow(idx + 1); return true; }
  return false;
}

/** Elimina un presupuesto y todos sus ítems. */
function deletePresupuesto(p) {
  var id = p.id_presupuesto;
  var shItems = getSheet('Presupuesto_Items');
  var values = shItems.getDataRange().getValues();
  var colPre = values[0].indexOf('id_presupuesto');
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][colPre]) === String(id)) shItems.deleteRow(i + 1);
  }
  var ok = deleteRowById('Presupuestos', 'id_presupuesto', id);
  return { id_presupuesto: id, deleted: ok };
}

/** Elimina un cliente (solo si no tiene presupuestos asociados). */
function deleteCliente(p) {
  var usados = readAll('Presupuestos').filter(function (x) {
    return String(x.id_cliente) === String(p.id_cliente);
  });
  if (usados.length) {
    throw new Error('No se puede borrar: el cliente tiene ' + usados.length + ' presupuesto(s).');
  }
  return { id_cliente: p.id_cliente, deleted: deleteRowById('Clientes', 'id_cliente', p.id_cliente) };
}

/** Elimina un trabajo y sus pagos. */
function deleteTrabajo(p) {
  var sh = getSheet('Pagos');
  var values = sh.getDataRange().getValues();
  var col = values[0].indexOf('id_trabajo');
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][col]) === String(p.id_trabajo)) sh.deleteRow(i + 1);
  }
  return { id_trabajo: p.id_trabajo, deleted: deleteRowById('Trabajos', 'id_trabajo', p.id_trabajo) };
}

// ---------------------------------------------------------------------------
//  Importación masiva de insumos
// ---------------------------------------------------------------------------

/**
 * Carga o actualiza varios insumos de una vez.
 * payload = { insumos: [ {...}, {...} ], modo: 'agregar' | 'reemplazar' }
 * Si un insumo trae `codigo` y ese código ya existe, se actualiza esa fila.
 */
function importInsumos(payload) {
  var lista = payload.insumos || [];
  if (!lista.length) return { creados: 0, actualizados: 0 };

  if (payload.modo === 'reemplazar') {
    var sh = getSheet('Insumos_Stock');
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  }

  var existentes = readAll('Insumos_Stock');
  var porCodigo = {};
  existentes.forEach(function (x) {
    if (x.codigo) porCodigo[String(x.codigo).toUpperCase()] = x.id_insumo;
  });

  var creados = 0, actualizados = 0;
  lista.forEach(function (it) {
    var cod = it.codigo ? String(it.codigo).toUpperCase() : '';
    if (cod && porCodigo[cod]) { it.id_insumo = porCodigo[cod]; actualizados++; }
    else { creados++; }
    it.estado = String(it.estado || 'activo').toLowerCase();
    saveInsumo(it);
  });
  return { creados: creados, actualizados: actualizados, total: lista.length };
}

// ---------------------------------------------------------------------------
//  Proveedores
// ---------------------------------------------------------------------------

function saveProveedor(p) {
  if (!p.id_proveedor) p.id_proveedor = newId('PROV');
  return upsert('Proveedores', 'id_proveedor', p);
}

// ---------------------------------------------------------------------------
//  KPIs / métricas
// ---------------------------------------------------------------------------

function getKPIs(payload) {
  var now = new Date();
  var mes = (payload && payload.mes) ? parseInt(payload.mes, 10) : (now.getMonth() + 1);
  var anio = (payload && payload.anio) ? parseInt(payload.anio, 10) : now.getFullYear();

  var presupuestos = readAll('Presupuestos');
  var trabajos = readAll('Trabajos');
  var insumos = readAll('Insumos_Stock');
  var items = readAll('Presupuesto_Items');
  var clientes = readAll('Clientes');

  function enMes(fechaStr) {
    var d = parseFecha(fechaStr);
    if (!d) return false;
    return (d.getMonth() + 1) === mes && d.getFullYear() === anio;
  }

  var presMes = presupuestos.filter(function (p) { return enMes(p.fecha_emision); });
  var montoPresupuestado = 0, montoAprobado = 0, aprobados = 0, manoObraPres = 0;
  presMes.forEach(function (p) {
    montoPresupuestado += toNum(p.total_final);
    manoObraPres += toNum(p.monto_mano_obra);
    var est = String(p.estado || '').toLowerCase();
    if (est === 'aprobado' || est === 'convertido' || est === 'finalizado') {
      aprobados++;
      montoAprobado += toNum(p.total_final);
    }
  });

  var trabMes = trabajos.filter(function (t) { return enMes(t.fecha_aprobacion); });
  var totalVendido = 0, manoObraCobrada = 0;
  var pendientes = 0, enProceso = 0, entregados = 0;
  trabajos.forEach(function (t) {
    var est = String(t.estado_trabajo || '').toLowerCase();
    if (est === 'pendiente') pendientes++;
    else if (est === 'en proceso') enProceso++;
    else if (est === 'entregado' || est === 'cobrado') entregados++;
  });
  trabMes.forEach(function (t) { totalVendido += toNum(t.total_trabajo); });

  var vencidos = 0;
  presupuestos.forEach(function (p) {
    if (String(p.estado).toLowerCase() === 'vencido') vencidos++;
    else if (p.fecha_vencimiento) {
      var venc = parseFecha(p.fecha_vencimiento);
      var est = String(p.estado).toLowerCase();
      if (venc && venc < now && (est === 'borrador' || est === 'enviado')) vencidos++;
    }
  });

  var bajoStock = insumos.filter(function (i) {
    return String(i.estado).toLowerCase() === 'activo' &&
           toNum(i.cantidad_stock) <= toNum(i.stock_minimo) &&
           toNum(i.stock_minimo) > 0;
  });

  // Insumos más usados (por cantidad total en ítems).
  var usoInsumo = {};
  items.forEach(function (it) {
    var key = it.nombre_insumo || it.id_insumo;
    usoInsumo[key] = (usoInsumo[key] || 0) + toNum(it.cantidad);
  });
  var topInsumos = Object.keys(usoInsumo).map(function (k) {
    return { nombre: k, cantidad: usoInsumo[k] };
  }).sort(function (a, b) { return b.cantidad - a.cantidad; }).slice(0, 5);

  // Clientes con más presupuestos.
  var usoCliente = {};
  presupuestos.forEach(function (p) {
    var key = p.cliente_nombre || p.id_cliente;
    if (key) usoCliente[key] = (usoCliente[key] || 0) + 1;
  });
  var topClientes = Object.keys(usoCliente).map(function (k) {
    return { nombre: k, cantidad: usoCliente[k] };
  }).sort(function (a, b) { return b.cantidad - a.cantidad; }).slice(0, 5);

  var tasaConversion = presMes.length ? Math.round((aprobados / presMes.length) * 100) : 0;
  var ticketPromedio = trabMes.length ? Math.round(totalVendido / trabMes.length) : 0;

  return {
    mes: mes,
    anio: anio,
    cantidad_presupuestos: presMes.length,
    monto_presupuestado: Math.round(montoPresupuestado),
    cantidad_aprobados: aprobados,
    tasa_conversion: tasaConversion,
    total_vendido: Math.round(totalVendido),
    ticket_promedio: ticketPromedio,
    trabajos_pendientes: pendientes,
    trabajos_en_proceso: enProceso,
    trabajos_entregados: entregados,
    trabajos_finalizados: entregados,
    presupuestos_vencidos: vencidos,
    insumos_bajo_stock: bajoStock.length,
    lista_bajo_stock: bajoStock.map(function (i) {
      return { nombre: i.nombre, stock: toNum(i.cantidad_stock), minimo: toNum(i.stock_minimo) };
    }),
    mano_obra_presupuestada: Math.round(manoObraPres),
    clientes_activos: clientes.length,
    top_insumos: topInsumos,
    top_clientes: topClientes
  };
}
