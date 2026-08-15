const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

class Range{constructor(sheet,row,col,nr=1,nc=1){this.s=sheet;this.r=row;this.c=col;this.nr=nr;this.nc=nc;}getValues(){const out=[];for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++)row.push(this.s.get(this.r+i,this.c+j));out.push(row);}return out;}setValues(values){for(let i=0;i<values.length;i++)for(let j=0;j<values[i].length;j++)this.s.set(this.r+i,this.c+j,values[i][j]);return this;}setValue(v){this.s.set(this.r,this.c,v);return this;}}
class Sheet{constructor(name,id){this.name=name;this.id=id;this.rows=[];}getName(){return this.name;}getSheetId(){return this.id;}getLastRow(){let last=0;this.rows.forEach((r,i)=>{if(r.some(v=>v!==''&&v!==null&&v!==undefined))last=i+1;});return last;}getLastColumn(){let m=0;this.rows.forEach(r=>{for(let i=r.length-1;i>=0;i--)if(r[i]!==''&&r[i]!==null&&r[i]!==undefined){m=Math.max(m,i+1);break;}});return m;}get(row,col){return (this.rows[row-1]||[])[col-1]??'';}set(row,col,v){while(this.rows.length<row)this.rows.push([]);while(this.rows[row-1].length<col)this.rows[row-1].push('');this.rows[row-1][col-1]=v;}getRange(r,c,nr,nc){return new Range(this,r,c,nr,nc);}getDataRange(){return new Range(this,1,1,Math.max(this.getLastRow(),1),Math.max(this.getLastColumn(),1));}appendRow(row){this.rows.push([...row]);}setFrozenRows(){}}
class Spreadsheet{constructor(){this.sheets=[];this.nextId=1;}getSheetByName(n){return this.sheets.find(s=>s.name===n)||null;}insertSheet(n){const s=new Sheet(n,this.nextId++);this.sheets.push(s);return s;}getSheets(){return this.sheets;}getUrl(){return 'https://docs.google.com/spreadsheets/d/mock';}getName(){return 'BBMOON Test';}}
function formatDate(d,pattern){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d).reduce((a,p)=>(a[p.type]=p.value,a),{});if(pattern==='yyyy-MM-dd')return `${parts.year}-${parts.month}-${parts.day}`;return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;}
function loadBackend(){const ss=new Spreadsheet(),props=new Map();let uid=0;const ctx={console,Date,Math,JSON,String,Number,Object,Array,RegExp,Error,parseInt,parseFloat,isNaN,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush:()=>{}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,String(v)),deleteProperty:k=>props.delete(k)})},Utilities:{getUuid:()=>`00000000-0000-4000-8000-${String(++uid).padStart(12,'0')}`,Charset:{UTF_8:'UTF-8'},DigestAlgorithm:{SHA_256:'SHA_256'},computeDigest:(_a,v)=>[...crypto.createHash('sha256').update(String(v),'utf8').digest()],formatDate:(d,_tz,p)=>formatDate(d,p)},Session:{getScriptTimeZone:()=> 'America/Argentina/Buenos_Aires'},LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({text:t,setMimeType(){return this;}})},Logger:{log:()=>{}}};vm.createContext(ctx);['Codigo.gs','Datos.gs','Operaciones.gs','Gestion.gs'].forEach(file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../backend/'+file),'utf8'),ctx));return {ctx,ss,props};}

test('full quote -> work -> payments flow keeps integrity',()=>{
  const {ctx}=loadBackend();ctx.bootstrap();
  const client=ctx.saveCliente({nombre:'Cliente Test',telefono:'123'});
  const ins=ctx.saveInsumo({codigo:'TEL-1',nombre:'Tela Test',categoria:'Telas',unidad_medida:'Metro',cantidad_stock:10,stock_minimo:2,costo_unitario:100,margen_porcentaje:50,precio_venta_unitario:150});
  const quote=ctx.savePresupuesto({presupuesto:{id_cliente:client.id_cliente,cliente_nombre:client.nombre,titulo:'Vestido test',tipo_mano_obra:'porcentaje',porcentaje_mano_obra:50,otros_costos:20,descuento:0,aplica_iva:'no',horas_estimadas:2,costo_hora_interno:50},items:[{id_insumo:ins.id_insumo,codigo_insumo:ins.codigo,nombre_insumo:ins.nombre,cantidad:2,unidad_medida:'Metro',precio_unitario:150}]});
  assert.equal(quote.presupuesto.total_final,470);assert.equal(quote.presupuesto.costo_materiales,200);
  ctx.setEstadoPresupuesto({id_presupuesto:quote.presupuesto.id_presupuesto,estado:'aprobado'});
  const work=ctx.convertirEnTrabajo({id_presupuesto:quote.presupuesto.id_presupuesto,fecha_estimada_entrega:'2026-08-30',sena:100,medio_pago_sena:'Transferencia'});
  assert.equal(work.saldo,370);assert.equal(ctx.readOne('Insumos_Stock','id_insumo',ins.id_insumo).cantidad_stock,8);assert.equal(ctx.listPagos({id_trabajo:work.id_trabajo}).length,1);assert.equal(ctx.listCaja({}).length,1);assert.equal(ctx.listAgenda({id_trabajo:work.id_trabajo}).length,1);
  assert.throws(()=>ctx.convertirEnTrabajo({id_presupuesto:quote.presupuesto.id_presupuesto}),/Solo un presupuesto aprobado|ya fue convertido/);
  assert.throws(()=>ctx.savePago({id_trabajo:work.id_trabajo,monto:500,medio_pago:'Efectivo'}),/supera el saldo/);
  const p2=ctx.savePago({id_trabajo:work.id_trabajo,monto:370,medio_pago:'Efectivo',concepto:'Saldo'});assert.equal(ctx.readOne('Trabajos','id_trabajo',work.id_trabajo).saldo,0);
  ctx.anularPago({id_pago:p2.id_pago,motivo:'Error de carga'});assert.equal(ctx.readOne('Trabajos','id_trabajo',work.id_trabajo).saldo,370);
  assert.throws(()=>ctx.deletePresupuesto({id_presupuesto:quote.presupuesto.id_presupuesto}),/trabajo asociado/);
});
