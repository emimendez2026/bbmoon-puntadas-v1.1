(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.BBMOONCore=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function num(v){ if(v===''||v===null||v===undefined)return 0; var n=parseFloat(String(v).replace(',','.')); return isNaN(n)?0:n; }
  function round2(n){ return Math.round((Number(n)||0)*100)/100; }
  function pad(n){ return String(n).padStart(2,'0'); }
  function localISODate(date){ var d=date||new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function addDaysLocal(days,base){ var d=base?new Date(base.getTime()):new Date(); d.setDate(d.getDate()+Number(days||0)); return localISODate(d); }
  function parseLocalDate(v){ if(!v)return null; if(v instanceof Date)return v; var m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); if(m)return new Date(+m[1],+m[2]-1,+m[3]); var d=new Date(v); return isNaN(d.getTime())?null:d; }
  function money(n,currency){ return (currency||'$')+num(n).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2}); }
  function calcQuote(d,ivaPct,defaultInternalHourlyCost){
    d=d||{}; var items=d.items||[],subMat=0,costMat=0;
    items.forEach(function(it){ var q=num(it.cantidad),p=num(it.precio_unitario),c=num(it.costo_unitario_snapshot); subMat+=q*p; costMat+=q*c; });
    var labor=d.tipo_mano_obra==='monto'?num(d.monto_mano_obra):subMat*(num(d.porcentaje_mano_obra)/100);
    var other=num(d.otros_costos),discount=num(d.descuento),beforeTax=subMat+labor+other-discount;
    var tax=d.aplica_iva?beforeTax*(num(ivaPct)/100):0;
    var total=beforeTax+tax;
    var hourly=d.costo_hora_interno===''||d.costo_hora_interno===undefined?num(defaultInternalHourlyCost):num(d.costo_hora_interno);
    var laborCost=num(d.horas_estimadas)*hourly;
    var profit=beforeTax-costMat-laborCost-other;
    return {subMat:round2(subMat),labor:round2(labor),other:round2(other),discount:round2(discount),beforeTax:round2(beforeTax),tax:round2(tax),total:round2(total),costMat:round2(costMat),laborCost:round2(laborCost),profit:round2(profit),margin:beforeTax?round2(profit/beforeTax*100):0};
  }
  function validatePayment(amount,balance){ var a=num(amount),b=num(balance); if(!(a>0))return 'El monto debe ser mayor que cero.'; if(a>b+0.009)return 'El pago supera el saldo pendiente.'; return ''; }
  return {num:num,round2:round2,localISODate:localISODate,addDaysLocal:addDaysLocal,parseLocalDate:parseLocalDate,money:money,calcQuote:calcQuote,validatePayment:validatePayment};
});
