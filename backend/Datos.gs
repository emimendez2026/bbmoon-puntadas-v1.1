// Bootstrap / migration - run manually after replacing Codigo.gs
// ---------------------------------------------------------------------------

function bootstrap() {
  Object.keys(SHEETS).forEach(function(name){ ensureSheet(name); });
  var cfg = ensureSheet('Configuracion');
  var existing = readConfigMap(cfg);
  Object.keys(CONFIG_DEFAULTS).forEach(function(k){
    if (existing[k] === undefined) cfg.appendRow([k, CONFIG_DEFAULTS[k]]);
  });
  seedLocalidades();
  return { ok:true, version:VERSION, sheets:Object.keys(SHEETS) };
}

function migrarV13() {
  return bootstrap();
}

function seedLocalidades() {
  var sh=ensureSheet('Localidades');
  if (sh.getLastRow()>1) return;
  var rows=[
    ['LOC-1','Ciudad Autonoma de Buenos Aires','CABA','Argentina'],
    ['LOC-2','La Plata','Buenos Aires','Argentina'],
    ['LOC-3','Mar del Plata','Buenos Aires','Argentina'],
    ['LOC-4','Cordoba','Cordoba','Argentina'],
    ['LOC-5','Rosario','Santa Fe','Argentina'],
    ['LOC-6','Mendoza','Mendoza','Argentina'],
    ['LOC-7','San Miguel de Tucuman','Tucuman','Argentina'],
    ['LOC-8','Salta','Salta','Argentina'],
    ['LOC-9','Neuquen','Neuquen','Argentina'],
    ['LOC-10','Bariloche','Rio Negro','Argentina']
  ];
  sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}

// ---------------------------------------------------------------------------
// Generic sheet helpers
// ---------------------------------------------------------------------------

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function apiError(code, message) {
  var e = new Error(message);
  e.code = code;
  return e;
}

function getSS() { return SpreadsheetApp.getActiveSpreadsheet(); }

function ensureSheet(name) {
  if (!SHEETS[name]) throw new Error('Hoja no definida: '+name);
  var ss=getSS();
  var sh=ss.getSheetByName(name);
  if (!sh) {
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);
    sh.setFrozenRows(1);
    return sh;
  }
  if (sh.getLastRow()===0) {
    sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);
    sh.setFrozenRows(1);
    return sh;
  }
  var lastCol=Math.max(sh.getLastColumn(),1);
  var headers=sh.getRange(1,1,1,lastCol).getValues()[0].map(String);
  var missing=SHEETS[name].filter(function(h){ return headers.indexOf(h)===-1; });
  if (missing.length) {
    sh.getRange(1,headers.length+1,1,missing.length).setValues([missing]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function getHeaders(sh) {
  if (sh.getLastColumn()===0) return [];
  return sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
}

function readAll(name, options) {
  options=options||{};
  var sh=ensureSheet(name);
  if (sh.getLastRow()<2) return [];
  var values=sh.getDataRange().getValues();
  var headers=values[0].map(String);
  var rows=[];
  for (var i=1;i<values.length;i++) {
    var obj={}, empty=true;
    for (var c=0;c<headers.length;c++) {
      obj[headers[c]]=values[i][c];
      if (values[i][c]!=='' && values[i][c]!==null) empty=false;
    }
    if (empty) continue;
    if (!options.includeDeleted && isDeleted(obj)) continue;
    rows.push(obj);
  }
  return rows;
}

function readOne(name,idCol,idVal,includeDeleted) {
  var rows=readAll(name,{includeDeleted:!!includeDeleted});
  for (var i=0;i<rows.length;i++) if (String(rows[i][idCol])===String(idVal)) return rows[i];
  return null;
}

function findRowIndex(sh,idCol,idVal) {
  if (sh.getLastRow()<2) return -1;
  var values=sh.getDataRange().getValues();
  var headers=values[0].map(String);
  var col=headers.indexOf(idCol);
  if (col<0) return -1;
  for (var i=1;i<values.length;i++) if (String(values[i][col])===String(idVal)) return i+1;
  return -1;
}

function rowToObject(headers,row) {
  var obj={};
  for (var i=0;i<headers.length;i++) obj[headers[i]]=row[i];
  return obj;
}

function writeObject(name,idCol,obj) {
  var sh=ensureSheet(name);
  var headers=getHeaders(sh);
  var rowNum=obj[idCol]?findRowIndex(sh,idCol,obj[idCol]):-1;
  var merged={};
  if (rowNum>1) {
    merged=rowToObject(headers,sh.getRange(rowNum,1,1,headers.length).getValues()[0]);
  }
  Object.keys(obj).forEach(function(k){ if (headers.indexOf(k)!==-1) merged[k]=obj[k]; });
  var row=headers.map(function(h){ return sanitizeCell(merged[h]); });
  if (rowNum>1) sh.getRange(rowNum,1,1,row.length).setValues([row]);
  else sh.appendRow(row);
  return merged;
}

function updateFields(name,idCol,idVal,fields) {
  var current=readOne(name,idCol,idVal,true);
  if (!current) throw apiError('NOT_FOUND','Registro no encontrado.');
  fields[idCol]=idVal;
  return writeObject(name,idCol,fields);
}

function sanitizeCell(v) {
  if (v===undefined || v===null) return '';
  if (typeof v==='string' && /^=/.test(v)) return "'"+v;
  return v;
}

function isDeleted(obj) {
  var v=String(obj.eliminado===undefined?'':obj.eliminado).toLowerCase();
  return v==='si'||v==='true'||v==='1';
}

function softDelete(name,idCol,idVal,reason) {
  var now=timestamp();
  return updateFields(name,idCol,idVal,{
    eliminado:'si', fecha_eliminacion:now, motivo_eliminacion:String(reason||''), fecha_actualizacion:now
  });
}

function newId(prefix) {
  return prefix+'-'+Date.now()+'-'+Math.floor(Math.random()*100000);
}

function toNum(v) {
  if (v===''||v===null||v===undefined) return 0;
  var n=parseFloat(String(v).replace(',','.'));
  return isNaN(n)?0:n;
}

function round2(n) { return Math.round((Number(n)||0)*100)/100; }
function boolYes(v) { var s=String(v).toLowerCase(); return v===true||s==='true'||s==='si'||s==='1'; }
function timestamp() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm:ss'); }
function ymd(d) { return Utilities.formatDate(d||new Date(), Session.getScriptTimeZone()||'America/Argentina/Buenos_Aires', 'yyyy-MM-dd'); }

function parseFecha(v) {
  if (!v && v!==0) return null;
  if (Object.prototype.toString.call(v)==='[object Date]') return isNaN(v.getTime())?null:v;
  var s=String(v).trim(),m;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return new Date(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) return new Date(+m[3],+m[2]-1,+m[1]);
  var d=new Date(s); return isNaN(d.getTime())?null:d;
}

function assertNonNegative(value,label) {
  if (toNum(value)<0) throw apiError('VALIDATION_ERROR', label+' no puede ser negativo.');
}
function assertPositive(value,label) {
  if (!(toNum(value)>0)) throw apiError('VALIDATION_ERROR', label+' debe ser mayor que cero.');
}
function assertRequired(value,label) {
  if (String(value===undefined||value===null?'':value).trim()==='') throw apiError('VALIDATION_ERROR','Falta '+label+'.');
}

function audit(action,entity,id,detail) {
  try {
    var txt=JSON.stringify(detail||{});
    if (txt.length>4500) txt=txt.slice(0,4500)+'...';
    writeObject('Auditoria','id_auditoria',{
      id_auditoria:newId('AUD'), fecha_hora:timestamp(), accion:action, entidad:entity,
      id_entidad:id||'', detalle:txt, origen:'web', version:VERSION
    });
  } catch (e) {
    // Audit must never break the business operation.
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function readConfigMap(sh) {
  var values=sh.getDataRange().getValues(), out={};
  for (var i=1;i<values.length;i++) if(values[i][0]) out[String(values[i][0])]=values[i][1];
  return out;
}

function getConfig() {
  var sh=ensureSheet('Configuracion');
  var cfg=readConfigMap(sh);
  Object.keys(CONFIG_DEFAULTS).forEach(function(k){ if(cfg[k]===undefined) cfg[k]=CONFIG_DEFAULTS[k]; });
  var ss=getSS();
  cfg.planilla_url=ss.getUrl();
  cfg.planilla_nombre=ss.getName();
  cfg.version=VERSION;
  return cfg;
}

function getSheetUrl() {
  var ss=getSS();
  return {
    url:ss.getUrl(), nombre:ss.getName(),
    hojas:ss.getSheets().map(function(sh){ return {nombre:sh.getName(),url:ss.getUrl()+'#gid='+sh.getSheetId()}; })
  };
}

function saveConfig(payload) {
  payload=payload||{};
  if (payload.iva_porcentaje!==undefined) {
    var iva=toNum(payload.iva_porcentaje); if(iva<0||iva>100) throw apiError('VALIDATION_ERROR','IVA invalido.');
  }
  ['mano_obra_porcentaje','validez_dias','costo_hora_interno'].forEach(function(k){ if(payload[k]!==undefined) assertNonNegative(payload[k],k); });
  var sh=ensureSheet('Configuracion'), values=sh.getDataRange().getValues(), rows={};
  for(var i=1;i<values.length;i++) if(values[i][0]) rows[String(values[i][0])]=i+1;
  Object.keys(payload).forEach(function(k){
    if (CONFIG_DEFAULTS[k]===undefined) return;
    if(rows[k]) sh.getRange(rows[k],2).setValue(sanitizeCell(payload[k]));
    else sh.appendRow([k,sanitizeCell(payload[k])]);
  });
  audit('UPDATE','Configuracion','config',payload);
  return getConfig();
}
