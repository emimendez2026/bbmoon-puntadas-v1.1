/**
 * BBMOON PUNTADAS - Backend v1.3
 * Google Apps Script bound to the business Google Sheet.
 *
 * Main goals of v1.3:
 * - PIN-gated API (PIN hash stored in Script Properties, never in the sheet)
 * - schema migration without deleting existing data
 * - server-side validation and immutable/reversible payments
 * - soft deletion + audit trail
 * - cash ledger, stock movements, client measurements and agenda
 * - profitability snapshots per quote/work
 */

var VERSION = '1.3.0';
var AUTH_SALT_KEY = 'BBMOON_AUTH_SALT';
var AUTH_HASH_KEY = 'BBMOON_AUTH_HASH';
var AUTH_SESSIONS_KEY = 'BBMOON_SESSIONS';

var SHEETS = {
  Configuracion: ['clave','valor'],
  Insumos_Stock: [
    'id_insumo','codigo','categoria','nombre','descripcion','unidad_medida',
    'cantidad_stock','stock_minimo','costo_unitario','margen_porcentaje',
    'precio_venta_unitario','proveedor','fecha_actualizacion_precio','estado',
    'observaciones','eliminado','fecha_creacion','fecha_actualizacion'
  ],
  Clientes: [
    'id_cliente','nombre','empresa','telefono','email','localidad','provincia',
    'direccion','tipo_cliente','fecha_alta','observaciones','eliminado',
    'fecha_creacion','fecha_actualizacion'
  ],
  Presupuestos: [
    'id_presupuesto','numero_presupuesto','fecha_emision','fecha_vencimiento',
    'id_cliente','cliente_nombre','titulo','descripcion','subtotal_materiales',
    'tipo_mano_obra','porcentaje_mano_obra','monto_mano_obra','otros_costos',
    'descuento','subtotal_sin_iva','aplica_iva','iva','total_con_iva','total_final',
    'estado','observaciones_internas','observaciones_cliente','pdf_url',
    'horas_estimadas','costo_hora_interno','costo_materiales','costo_mano_obra_interno',
    'ganancia_estimada','margen_estimado','eliminado','fecha_creacion',
    'fecha_actualizacion','fecha_eliminacion','motivo_eliminacion'
  ],
  Presupuesto_Items: [
    'id_item','id_presupuesto','id_insumo','codigo_insumo','nombre_insumo',
    'descripcion','cantidad','unidad_medida','precio_unitario','subtotal_item',
    'observaciones','costo_unitario_snapshot','costo_total','margen_item',
    'eliminado','fecha_creacion','fecha_actualizacion'
  ],
  Trabajos: [
    'id_trabajo','id_presupuesto','id_cliente','cliente_nombre','titulo_trabajo',
    'descripcion','fecha_aprobacion','fecha_estimada_entrega','fecha_finalizacion',
    'estado_trabajo','total_trabajo','sena','saldo','observaciones',
    'costo_materiales','costo_mano_obra_interno','otros_costos','ganancia_estimada',
    'margen_estimado','horas_estimadas','horas_reales','eliminado','fecha_creacion',
    'fecha_actualizacion','fecha_eliminacion','motivo_eliminacion'
  ],
  Pagos: [
    'id_pago','id_trabajo','id_cliente','fecha_pago','medio_pago','monto','concepto',
    'observaciones','eliminado','fecha_anulacion','motivo_anulacion','fecha_creacion'
  ],
  Proveedores: [
    'id_proveedor','nombre','telefono','email','localidad','provincia','direccion',
    'rubro','observaciones','eliminado','fecha_creacion','fecha_actualizacion'
  ],
  Localidades: ['id_localidad','localidad','provincia','pais'],
  KPIs_Mensuales: [
    'mes','anio','cantidad_presupuestos','monto_presupuestado','cantidad_aprobados',
    'tasa_conversion','total_vendido','ticket_promedio','trabajos_pendientes',
    'trabajos_finalizados','insumos_bajo_stock','margen_estimado'
  ],
  Movimientos_Caja: [
    'id_movimiento','fecha','tipo','categoria','concepto','monto','medio_pago',
    'id_cliente','id_trabajo','id_pago','origen','referencia','observaciones',
    'eliminado','fecha_anulacion','motivo_anulacion','fecha_creacion'
  ],
  Movimientos_Stock: [
    'id_movimiento_stock','fecha','id_insumo','codigo_insumo','nombre_insumo','tipo',
    'cantidad','stock_anterior','stock_nuevo','id_trabajo','id_presupuesto','origen',
    'referencia','observaciones','eliminado','fecha_creacion'
  ],
  Medidas_Clientes: [
    'id_medida','id_cliente','fecha','nombre_ficha','busto','cintura','cadera','espalda',
    'hombro','largo_total','largo_manga','contorno_brazo','tiro','entrepierna',
    'medidas_extra_json','observaciones','eliminado','fecha_creacion','fecha_actualizacion'
  ],
  Agenda: [
    'id_evento','fecha','hora','tipo','titulo','id_cliente','cliente_nombre','id_trabajo',
    'estado','prioridad','observaciones','eliminado','fecha_creacion','fecha_actualizacion'
  ],
  Auditoria: [
    'id_auditoria','fecha_hora','accion','entidad','id_entidad','detalle','origen','version'
  ]
};

var CONFIG_DEFAULTS = {
  nombre_negocio: 'BBMOON PUNTADAS',
  nombre_responsable: 'Veronica',
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
  colores_marca: 'salvia',
  costo_hora_interno: '0',
  descontar_stock_al_convertir: 'si',
  permitir_stock_negativo: 'no'
};

var WRITE_ACTIONS = {
  saveConfig:1, saveInsumo:1, deleteInsumo:1, saveCliente:1, deleteCliente:1,
  savePresupuesto:1, setEstadoPresupuesto:1, deletePresupuesto:1,
  convertirEnTrabajo:1, saveTrabajo:1, deleteTrabajo:1,
  savePago:1, anularPago:1, saveProveedor:1, importInsumos:1,
  saveMovimientoCaja:1, anularMovimientoCaja:1,
  saveMovimientoStock:1, saveMedida:1, deleteMedida:1,
  saveEventoAgenda:1, deleteEventoAgenda:1
};

function doGet() {
  return jsonOut({ ok:true, app:'BBMOON PUNTADAS API', version:VERSION });
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
    var action = String(body.action || '');
    var payload = body.payload || {};
    var pin = String(body.pin || '');
    var token = String(body.token || '');

    requireConfiguredAccess();
    if (action === 'login') {
      if (!validatePin(pin)) return jsonOut({ ok:false, code:'AUTH_INVALID', error:'PIN de acceso incorrecto.' });
      return jsonOut({ ok:true, data:createSession(), version:VERSION });
    }
    if (!validateSession(token)) return jsonOut({ ok:false, code:'SESSION_INVALID', error:'La sesion vencio o no es valida. Inicia sesion nuevamente.' });
    if (action === 'logout') {
      clearSession(token);
      return jsonOut({ ok:true, data:{logout:true}, version:VERSION });
    }

    if (WRITE_ACTIONS[action]) {
      var lock = LockService.getScriptLock();
      lock.waitLock(25000);
      try {
        var wr = route(action, payload);
        SpreadsheetApp.flush();
        return jsonOut({ ok:true, data:wr, version:VERSION });
      } finally {
        lock.releaseLock();
      }
    }

    return jsonOut({ ok:true, data:route(action, payload), version:VERSION });
  } catch (err) {
    return jsonOut({
      ok:false,
      code: err && err.code ? err.code : 'SERVER_ERROR',
      error:String(err && err.message ? err.message : err)
    });
  }
}

function route(action, payload) {
  switch (action) {
    case 'ping': return { pong:true, time:new Date().toISOString(), version:VERSION };
    case 'getConfig': return getConfig();
    case 'saveConfig': return saveConfig(payload);
    case 'getSheetUrl': return getSheetUrl();

    case 'listInsumos': return readAll('Insumos_Stock');
    case 'saveInsumo': return saveInsumo(payload);
    case 'deleteInsumo': return deleteInsumo(payload);
    case 'importInsumos': return importInsumos(payload);

    case 'listClientes': return readAll('Clientes');
    case 'saveCliente': return saveCliente(payload);
    case 'deleteCliente': return deleteCliente(payload);

    case 'listPresupuestos': return readAll('Presupuestos');
    case 'getPresupuesto': return getPresupuesto(payload);
    case 'savePresupuesto': return savePresupuesto(payload);
    case 'setEstadoPresupuesto': return setEstadoPresupuesto(payload);
    case 'deletePresupuesto': return deletePresupuesto(payload);

    case 'listTrabajos': return readAll('Trabajos');
    case 'convertirEnTrabajo': return convertirEnTrabajo(payload);
    case 'saveTrabajo': return saveTrabajo(payload);
    case 'deleteTrabajo': return deleteTrabajo(payload);

    case 'listPagos': return listPagos(payload);
    case 'savePago': return savePago(payload);
    case 'anularPago': return anularPago(payload);

    case 'listProveedores': return readAll('Proveedores');
    case 'saveProveedor': return saveProveedor(payload);

    case 'listCaja': return listCaja(payload);
    case 'saveMovimientoCaja': return saveMovimientoCaja(payload);
    case 'anularMovimientoCaja': return anularMovimientoCaja(payload);

    case 'listMovimientosStock': return listMovimientosStock(payload);
    case 'saveMovimientoStock': return saveMovimientoStock(payload);

    case 'listMedidas': return listMedidas(payload);
    case 'saveMedida': return saveMedida(payload);
    case 'deleteMedida': return deleteMedida(payload);

    case 'listAgenda': return listAgenda(payload);
    case 'saveEventoAgenda': return saveEventoAgenda(payload);
    case 'deleteEventoAgenda': return deleteEventoAgenda(payload);

    case 'getKPIs': return getKPIs(payload);
    default: throw apiError('UNKNOWN_ACTION', 'Accion desconocida: ' + action);
  }
}

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

/**
 * Run manually once from the Apps Script editor. It generates an 8-digit PIN,
 * stores only a salted SHA-256 hash in Script Properties and logs the PIN once.
 */
function configurarAcceso() {
  var pin = '';
  for (var i=0; i<8; i++) pin += String(Math.floor(Math.random()*10));
  setPinHash(pin);
  Logger.log('BBMOON PIN DE ACCESO: ' + pin);
  return 'PIN generado. Revisar el registro de ejecucion.';
}

/** Run manually to invalidate the previous PIN and create a new one. */
function rotarPinAcceso() {
  return configurarAcceso();
}

function setPinHash(pin) {
  var props = PropertiesService.getScriptProperties();
  var salt = Utilities.getUuid();
  props.setProperty(AUTH_SALT_KEY, salt);
  props.setProperty(AUTH_HASH_KEY, sha256Hex(salt + ':' + String(pin)));
  clearSession();
}

function requireConfiguredAccess() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty(AUTH_HASH_KEY) || !props.getProperty(AUTH_SALT_KEY)) {
    throw apiError('AUTH_NOT_CONFIGURED', 'Falta ejecutar configurarAcceso() en Apps Script.');
  }
}

function validatePin(pin) {
  if (!pin) return false;
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty(AUTH_SALT_KEY) || '';
  var expected = props.getProperty(AUTH_HASH_KEY) || '';
  return constantTimeEqual(sha256Hex(salt + ':' + pin), expected);
}

function getSessions() {
  var raw=PropertiesService.getScriptProperties().getProperty(AUTH_SESSIONS_KEY)||'[]';
  try{return JSON.parse(raw)||[];}catch(e){return [];}
}

function saveSessions(list) {
  PropertiesService.getScriptProperties().setProperty(AUTH_SESSIONS_KEY,JSON.stringify(list||[]));
}

function createSession() {
  var props=PropertiesService.getScriptProperties();
  var salt=props.getProperty(AUTH_SALT_KEY)||'';
  var token=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
  var exp=Date.now()+30*24*60*60*1000;
  var sessions=getSessions().filter(function(x){return x&&toNum(x.exp)>Date.now();});
  sessions.push({hash:sha256Hex(salt+':session:'+token),exp:exp});
  while(sessions.length>8)sessions.shift();
  saveSessions(sessions);
  return {token:token,expires_at:new Date(exp).toISOString()};
}

function validateSession(token) {
  if(!token)return false;
  var props=PropertiesService.getScriptProperties();
  var salt=props.getProperty(AUTH_SALT_KEY)||'';
  var candidate=sha256Hex(salt+':session:'+token),now=Date.now(),valid=false;
  var sessions=getSessions().filter(function(x){
    if(!x||toNum(x.exp)<=now)return false;
    if(constantTimeEqual(String(x.hash||''),candidate))valid=true;
    return true;
  });
  saveSessions(sessions);
  return valid;
}

function clearSession(token) {
  if(!token){saveSessions([]);return;}
  var props=PropertiesService.getScriptProperties(),salt=props.getProperty(AUTH_SALT_KEY)||'',candidate=sha256Hex(salt+':session:'+token);
  saveSessions(getSessions().filter(function(x){return !constantTimeEqual(String(x.hash||''),candidate);}));
}

function sha256Hex(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(function(b){ var v=(b<0?b+256:b).toString(16); return v.length===1?'0'+v:v; }).join('');
}

function constantTimeEqual(a,b) {
  a=String(a||''); b=String(b||'');
  if (a.length !== b.length) return false;
  var diff=0;
  for (var i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

// ---------------------------------------------------------------------------
