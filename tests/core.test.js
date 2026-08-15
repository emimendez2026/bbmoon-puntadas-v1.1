const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../frontend/js/core.js');

test('localISODate keeps Argentina local date instead of UTC date',()=>{
  const instant=new Date('2026-08-16T01:30:00Z');
  assert.equal(core.localISODate(instant),'2026-08-15');
});

test('addDaysLocal advances calendar days locally',()=>{
  const d=new Date(2026,7,15,23,30,0);
  assert.equal(core.addDaysLocal(1,d),'2026-08-16');
});

test('quote calculation includes sale totals and internal profitability',()=>{
  const q={items:[{cantidad:2,precio_unitario:100,costo_unitario_snapshot:40},{cantidad:1,precio_unitario:50,costo_unitario_snapshot:20}],tipo_mano_obra:'porcentaje',porcentaje_mano_obra:50,otros_costos:25,descuento:10,aplica_iva:true,horas_estimadas:2,costo_hora_interno:30};
  const r=core.calcQuote(q,21,0);
  assert.equal(r.subMat,250);assert.equal(r.labor,125);assert.equal(r.beforeTax,390);assert.equal(r.tax,81.9);assert.equal(r.total,471.9);assert.equal(r.costMat,100);assert.equal(r.laborCost,60);assert.equal(r.profit,205);
});

test('payment validation rejects non-positive and overpayments',()=>{
  assert.match(core.validatePayment(0,100),/mayor que cero/);
  assert.match(core.validatePayment(101,100),/supera el saldo/);
  assert.equal(core.validatePayment(100,100),'');
});

test('backend and frontend JavaScript parse successfully',()=>{
  const backend=['Codigo.gs','Datos.gs','Operaciones.gs','Gestion.gs'].map(f=>fs.readFileSync(path.join(__dirname,'../backend/'+f),'utf8')).join('\n');
  const frontend=['core.js','app-core.js','app-stock-clients.js','app-quotes-works.js','app-management.js'].map(f=>fs.readFileSync(path.join(__dirname,'../frontend/js/'+f),'utf8')).join('\n');
  assert.doesNotThrow(()=>new Function(backend));
  assert.doesNotThrow(()=>new Function(frontend));
});
