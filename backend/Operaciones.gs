// ---------------------------------------------------------------------------
// Insumos
// ---------------------------------------------------------------------------

function saveInsumo(p) {
  p=p||{};
  assertRequired(p.nombre,'el nombre del insumo');
  ['cantidad_stock','stock_minimo','costo_unitario','margen_porcentaje','precio_venta_unitario'].forEach(function(k){ if(p[k]!==undefined&&p[k]!=='') assertNonNegative(p[k],k); });
  var now=timestamp();
  if(!p.id_insumo){ p.id_insumo=newId('INS'); p.fecha_creacion=now; }
  p.fecha_actualizacion=now;
  p.eliminado='no';
  if(!p.estado) p.estado='activo';
  if(!p.fecha_actualizacion_precio) p.fecha_actualizacion_precio=ymd();
  if ((p.precio_venta_unitario===''||p.precio_venta_unitario===undefined) && p.costo_unitario!==undefined) {
    p.precio_venta_unitario=round2(toNum(p.costo_unitario)*(1+toNum(p.margen_porcentaje)/100));
  }
  var saved=writeObject('Insumos_Stock','id_insumo',p);
  audit('UPSERT','Insumos_Stock',p.id_insumo,{nombre:p.nombre});
  return saved;
}

function deleteInsumo(p) {
  assertRequired(p.id_insumo,'id_insumo');
  var saved=updateFields('Insumos_Stock','id_insumo',p.id_insumo,{estado:'inactivo',eliminado:'si',fecha_actualizacion:timestamp()});
  audit('SOFT_DELETE','Insumos_Stock',p.id_insumo,{motivo:p.motivo||''});
  return saved;
}

function importInsumos(payload) {
  var lista=(payload&&payload.insumos)||[];
  if(!Array.isArray(lista)||!lista.length) return {creados:0,actualizados:0,total:0};
  var existing=readAll('Insumos_Stock',{includeDeleted:true}), map={};
  existing.forEach(function(x){ if(x.codigo) map[String(x.codigo).toUpperCase()]=x.id_insumo; });
  var creados=0,actualizados=0;
  lista.forEach(function(it){
    var cod=String(it.codigo||'').toUpperCase();
    if(cod&&map[cod]){ it.id_insumo=map[cod]; actualizados++; } else creados++;
    saveInsumo(it);
  });
  audit('IMPORT','Insumos_Stock','bulk',{total:lista.length});
  return {creados:creados,actualizados:actualizados,total:lista.length};
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

function saveCliente(p) {
  p=p||{}; assertRequired(p.nombre,'el nombre del cliente');
  var now=timestamp();
  if(!p.id_cliente){ p.id_cliente=newId('CLI'); p.fecha_alta=p.fecha_alta||ymd(); p.fecha_creacion=now; }
  p.fecha_actualizacion=now; p.eliminado='no'; p.tipo_cliente=p.tipo_cliente||'particular';
  var saved=writeObject('Clientes','id_cliente',p);
  audit('UPSERT','Clientes',p.id_cliente,{nombre:p.nombre});
  return saved;
}

function deleteCliente(p) {
  assertRequired(p.id_cliente,'id_cliente');
  var activeWorks=readAll('Trabajos').filter(function(t){return String(t.id_cliente)===String(p.id_cliente)&&String(t.estado_trabajo).toLowerCase()!=='cancelado';});
  if(activeWorks.length) throw apiError('RELATION_CONFLICT','No se puede dar de baja: el cliente tiene trabajos activos.');
  var saved=softDelete('Clientes','id_cliente',p.id_cliente,p.motivo||'');
  audit('SOFT_DELETE','Clientes',p.id_cliente,{motivo:p.motivo||''});
  return saved;
}

// ---------------------------------------------------------------------------
// Presupuestos
// ---------------------------------------------------------------------------

function nextNumeroPresupuesto() {
  var rows=readAll('Presupuestos',{includeDeleted:true}),max=0;
  rows.forEach(function(r){var m=String(r.numero_presupuesto||'').match(/(\d+)/);if(m)max=Math.max(max,parseInt(m[1],10));});
  return 'PRESU-'+('000000'+(max+1)).slice(-6);
}

function validatePresupuestoInput(p,items) {
  assertRequired(p.id_cliente,'el cliente');
  assertRequired(p.titulo,'el titulo');
  if(!items||!items.length) throw apiError('VALIDATION_ERROR','Agrega al menos un material o concepto.');
  items.forEach(function(it,i){
    assertPositive(it.cantidad,'Cantidad del item '+(i+1));
    assertNonNegative(it.precio_unitario,'Precio del item '+(i+1));
    if(it.costo_unitario_snapshot!==undefined&&it.costo_unitario_snapshot!=='') assertNonNegative(it.costo_unitario_snapshot,'Costo del item '+(i+1));
  });
  assertNonNegative(p.porcentaje_mano_obra,'Porcentaje de mano de obra');
  assertNonNegative(p.monto_mano_obra,'Monto de mano de obra');
  assertNonNegative(p.otros_costos,'Otros costos');
  assertNonNegative(p.descuento,'Descuento');
  assertNonNegative(p.horas_estimadas,'Horas estimadas');
  assertNonNegative(p.costo_hora_interno,'Costo hora interno');
}

function recomputeTotals(p,items) {
  validatePresupuestoInput(p,items);
  var insumos=readAll('Insumos_Stock'), byId={};
  insumos.forEach(function(x){byId[String(x.id_insumo)]=x;});
  var subtotalMat=0,costoMat=0;
  items.forEach(function(it){
    var qty=toNum(it.cantidad),price=toNum(it.precio_unitario);
    it.subtotal_item=round2(qty*price);
    subtotalMat+=it.subtotal_item;
    var snap=(it.costo_unitario_snapshot!==undefined&&it.costo_unitario_snapshot!=='')?toNum(it.costo_unitario_snapshot):0;
    if(!snap&&it.id_insumo&&byId[String(it.id_insumo)]) snap=toNum(byId[String(it.id_insumo)].costo_unitario);
    it.costo_unitario_snapshot=round2(snap);
    it.costo_total=round2(qty*snap);
    costoMat+=it.costo_total;
    it.margen_item=it.subtotal_item?round2(((it.subtotal_item-it.costo_total)/it.subtotal_item)*100):0;
  });
  var tipo=String(p.tipo_mano_obra||'porcentaje');
  var mo=tipo==='monto'?toNum(p.monto_mano_obra):subtotalMat*(toNum(p.porcentaje_mano_obra)/100);
  var otros=toNum(p.otros_costos),desc=toNum(p.descuento);
  var bruto=subtotalMat+mo+otros;
  if(desc>bruto) throw apiError('VALIDATION_ERROR','El descuento no puede superar el subtotal.');
  var sinIva=bruto-desc;
  var ivaPct=toNum(getConfig().iva_porcentaje); if(ivaPct<0||ivaPct>100) ivaPct=21;
  var iva=boolYes(p.aplica_iva)?sinIva*(ivaPct/100):0;
  var total=sinIva+iva;
  var horas=toNum(p.horas_estimadas);
  var costoHora=(p.costo_hora_interno!==undefined&&p.costo_hora_interno!=='')?toNum(p.costo_hora_interno):toNum(getConfig().costo_hora_interno);
  var costoMOInterno=round2(horas*costoHora);
  var ganancia=round2(sinIva-costoMat-costoMOInterno-otros);
  var margen=sinIva?round2((ganancia/sinIva)*100):0;

  p.subtotal_materiales=round2(subtotalMat);
  p.monto_mano_obra=round2(mo);
  p.subtotal_sin_iva=round2(sinIva);
  p.iva=round2(iva);
  p.total_con_iva=round2(total);
  p.total_final=round2(total);
  p.costo_materiales=round2(costoMat);
  p.costo_hora_interno=round2(costoHora);
  p.costo_mano_obra_interno=costoMOInterno;
  p.ganancia_estimada=ganancia;
  p.margen_estimado=margen;
  return {p:p,items:items};
}

function savePresupuesto(payload) {
  payload=payload||{};
  var p=payload.presupuesto||{},items=payload.items||[],now=timestamp();
  var existing=p.id_presupuesto?readOne('Presupuestos','id_presupuesto',p.id_presupuesto,true):null;
  if(existing&&String(existing.estado).toLowerCase()==='convertido') throw apiError('STATE_LOCKED','Un presupuesto convertido no puede editarse.');
  if(!p.id_presupuesto){p.id_presupuesto=newId('PRE');p.numero_presupuesto=nextNumeroPresupuesto();p.fecha_creacion=now;}
  else if(!p.numero_presupuesto&&existing)p.numero_presupuesto=existing.numero_presupuesto;
  p.fecha_emision=p.fecha_emision||ymd();
  if(!p.fecha_vencimiento){var d=new Date();d.setDate(d.getDate()+(toNum(getConfig().validez_dias)||10));p.fecha_vencimiento=ymd(d);}
  p.estado=p.estado||'borrador'; p.eliminado='no'; p.fecha_actualizacion=now;
  var calc=recomputeTotals(p,items);p=calc.p;items=calc.items;
  writeObject('Presupuestos','id_presupuesto',p);

  var oldItems=readAll('Presupuesto_Items',{includeDeleted:true}).filter(function(x){return String(x.id_presupuesto)===String(p.id_presupuesto)&&!isDeleted(x);});
  oldItems.forEach(function(x){updateFields('Presupuesto_Items','id_item',x.id_item,{eliminado:'si',fecha_actualizacion:now});});
  items.forEach(function(it){
    if(!it.id_item)it.id_item=newId('ITM');
    it.id_presupuesto=p.id_presupuesto;it.eliminado='no';it.fecha_actualizacion=now;it.fecha_creacion=it.fecha_creacion||now;
    writeObject('Presupuesto_Items','id_item',it);
  });
  audit(existing?'UPDATE':'CREATE','Presupuestos',p.id_presupuesto,{numero:p.numero_presupuesto,total:p.total_final});
  return {presupuesto:readOne('Presupuestos','id_presupuesto',p.id_presupuesto),items:readAll('Presupuesto_Items').filter(function(x){return String(x.id_presupuesto)===String(p.id_presupuesto);})};
}

function getPresupuesto(payload) {
  var id=payload&&payload.id_presupuesto;
  var pre=readOne('Presupuestos','id_presupuesto',id);
  if(!pre)throw apiError('NOT_FOUND','Presupuesto no encontrado.');
  var items=readAll('Presupuesto_Items').filter(function(x){return String(x.id_presupuesto)===String(id);});
  return {presupuesto:pre,items:items};
}

function setEstadoPresupuesto(payload) {
  var allowed=['borrador','enviado','aprobado','rechazado','vencido','convertido'];
  var state=String(payload.estado||'').toLowerCase();
  if(allowed.indexOf(state)===-1)throw apiError('VALIDATION_ERROR','Estado de presupuesto invalido.');
  var pre=readOne('Presupuestos','id_presupuesto',payload.id_presupuesto);
  if(!pre)throw apiError('NOT_FOUND','Presupuesto no encontrado.');
  if(String(pre.estado).toLowerCase()==='convertido'&&state!=='convertido')throw apiError('STATE_LOCKED','El presupuesto ya fue convertido en trabajo.');
  var saved=updateFields('Presupuestos','id_presupuesto',payload.id_presupuesto,{estado:state,fecha_actualizacion:timestamp()});
  audit('STATE','Presupuestos',payload.id_presupuesto,{from:pre.estado,to:state});
  return saved;
}

function deletePresupuesto(p) {
  var id=p&&p.id_presupuesto;
  var linked=readAll('Trabajos').filter(function(t){return String(t.id_presupuesto)===String(id);});
  if(linked.length)throw apiError('RELATION_CONFLICT','No se puede eliminar: el presupuesto ya tiene un trabajo asociado.');
  var saved=softDelete('Presupuestos','id_presupuesto',id,p.motivo||'');
  readAll('Presupuesto_Items',{includeDeleted:true}).filter(function(x){return String(x.id_presupuesto)===String(id);}).forEach(function(x){updateFields('Presupuesto_Items','id_item',x.id_item,{eliminado:'si',fecha_actualizacion:timestamp()});});
  audit('SOFT_DELETE','Presupuestos',id,{motivo:p.motivo||''});
  return saved;
}

// ---------------------------------------------------------------------------
// Trabajos, pagos, stock automation
// ---------------------------------------------------------------------------

function convertirEnTrabajo(payload) {
  payload=payload||{};
  var data=getPresupuesto({id_presupuesto:payload.id_presupuesto}),pre=data.presupuesto,items=data.items;
  if(String(pre.estado).toLowerCase()!=='aprobado') throw apiError('STATE_REQUIRED','Solo un presupuesto aprobado puede convertirse en trabajo.');
  var duplicate=readAll('Trabajos').filter(function(t){return String(t.id_presupuesto)===String(pre.id_presupuesto);});
  if(duplicate.length) throw apiError('DUPLICATE_WORK','Este presupuesto ya fue convertido en trabajo.');
  var sena=toNum(payload.sena);assertNonNegative(sena,'Sena');if(sena>toNum(pre.total_final))throw apiError('VALIDATION_ERROR','La sena no puede superar el total.');
  if(boolYes(getConfig().descontar_stock_al_convertir)) validateStockForItems(items);
  var now=timestamp();
  var t={
    id_trabajo:newId('TRA'),id_presupuesto:pre.id_presupuesto,id_cliente:pre.id_cliente,cliente_nombre:pre.cliente_nombre,
    titulo_trabajo:pre.titulo,descripcion:pre.descripcion,fecha_aprobacion:ymd(),fecha_estimada_entrega:payload.fecha_estimada_entrega||'',
    fecha_finalizacion:'',estado_trabajo:'pendiente',total_trabajo:toNum(pre.total_final),sena:0,saldo:toNum(pre.total_final),
    observaciones:payload.observaciones||'',costo_materiales:toNum(pre.costo_materiales),costo_mano_obra_interno:toNum(pre.costo_mano_obra_interno),
    otros_costos:toNum(pre.otros_costos),ganancia_estimada:toNum(pre.ganancia_estimada),margen_estimado:toNum(pre.margen_estimado),
    horas_estimadas:toNum(pre.horas_estimadas),horas_reales:0,eliminado:'no',fecha_creacion:now,fecha_actualizacion:now
  };
  writeObject('Trabajos','id_trabajo',t);
  if(boolYes(getConfig().descontar_stock_al_convertir)) consumeStockForWork(t,items);
  if(sena>0) savePagoInternal({id_trabajo:t.id_trabajo,id_cliente:t.id_cliente,fecha_pago:ymd(),medio_pago:payload.medio_pago_sena||'Efectivo',monto:sena,concepto:'Sena inicial',observaciones:''});
  if(t.fecha_estimada_entrega) ensureDeliveryEvent(t);
  updateFields('Presupuestos','id_presupuesto',pre.id_presupuesto,{estado:'convertido',fecha_actualizacion:now});
  audit('CONVERT','Presupuestos',pre.id_presupuesto,{id_trabajo:t.id_trabajo});
  return readOne('Trabajos','id_trabajo',t.id_trabajo);
}

function saveTrabajo(p) {
  p=p||{};assertRequired(p.id_trabajo,'id_trabajo');
  var old=readOne('Trabajos','id_trabajo',p.id_trabajo);if(!old)throw apiError('NOT_FOUND','Trabajo no encontrado.');
  var allowed=['pendiente','en proceso','listo para entregar','entregado','cobrado','cancelado'];
  var state=String(p.estado_trabajo||old.estado_trabajo).toLowerCase();
  if(allowed.indexOf(state)===-1)throw apiError('VALIDATION_ERROR','Estado de trabajo invalido.');
  if(p.horas_reales!==undefined)assertNonNegative(p.horas_reales,'Horas reales');
  if(state==='cobrado'&&toNum(old.saldo)>0.009)throw apiError('BALANCE_PENDING','No se puede marcar como cobrado: queda saldo pendiente.');
  var fields={
    estado_trabajo:state,
    fecha_estimada_entrega:p.fecha_estimada_entrega!==undefined?p.fecha_estimada_entrega:old.fecha_estimada_entrega,
    observaciones:p.observaciones!==undefined?p.observaciones:old.observaciones,
    horas_reales:p.horas_reales!==undefined?toNum(p.horas_reales):old.horas_reales,
    fecha_actualizacion:timestamp()
  };
  if((state==='entregado'||state==='cobrado')&&!old.fecha_finalizacion)fields.fecha_finalizacion=ymd();
  var saved=updateFields('Trabajos','id_trabajo',p.id_trabajo,fields);
  if(saved.fecha_estimada_entrega) ensureDeliveryEvent(saved);
  audit('UPDATE','Trabajos',p.id_trabajo,{from:old.estado_trabajo,to:state});
  return readOne('Trabajos','id_trabajo',p.id_trabajo);
}

function deleteTrabajo(p) {
  var t=readOne('Trabajos','id_trabajo',p.id_trabajo);if(!t)throw apiError('NOT_FOUND','Trabajo no encontrado.');
  var pagos=listPagos({id_trabajo:t.id_trabajo});
  if(pagos.length)throw apiError('RELATION_CONFLICT','No se puede eliminar un trabajo con pagos. Usa estado Cancelado y conserva el historial.');
  var saved=softDelete('Trabajos','id_trabajo',t.id_trabajo,p.motivo||'');
  audit('SOFT_DELETE','Trabajos',t.id_trabajo,{motivo:p.motivo||''});
  return saved;
}

function listPagos(payload) {
  var rows=readAll('Pagos');
  if(payload&&payload.id_trabajo)rows=rows.filter(function(x){return String(x.id_trabajo)===String(payload.id_trabajo);});
  return rows.sort(function(a,b){return String(b.fecha_pago).localeCompare(String(a.fecha_pago));});
}

function savePago(p) { return savePagoInternal(p||{}); }

function savePagoInternal(p) {
  assertRequired(p.id_trabajo,'id_trabajo');assertPositive(p.monto,'Monto del pago');
  if(p.id_pago&&readOne('Pagos','id_pago',p.id_pago,true))throw apiError('IMMUTABLE_PAYMENT','Los pagos no se editan. Anulalo y registra uno nuevo.');
  var t=readOne('Trabajos','id_trabajo',p.id_trabajo);if(!t)throw apiError('NOT_FOUND','Trabajo no encontrado.');
  var amount=round2(toNum(p.monto)),saldo=round2(toNum(t.saldo));
  if(amount>saldo+0.009)throw apiError('OVERPAYMENT','El pago supera el saldo pendiente de '+saldo+'.');
  p.id_pago=newId('PAG');p.id_cliente=p.id_cliente||t.id_cliente;p.fecha_pago=p.fecha_pago||ymd();p.monto=amount;p.medio_pago=p.medio_pago||'Efectivo';p.eliminado='no';p.fecha_creacion=timestamp();
  var saved=writeObject('Pagos','id_pago',p);
  createCajaForPago(saved,t);
  recalcTrabajoPagos(t.id_trabajo);
  audit('CREATE','Pagos',p.id_pago,{id_trabajo:t.id_trabajo,monto:amount});
  return saved;
}

function anularPago(p) {
  var pago=readOne('Pagos','id_pago',p.id_pago);if(!pago)throw apiError('NOT_FOUND','Pago no encontrado.');
  var now=timestamp();
  updateFields('Pagos','id_pago',p.id_pago,{eliminado:'si',fecha_anulacion:now,motivo_anulacion:String(p.motivo||'' )});
  var caja=readAll('Movimientos_Caja').filter(function(x){return String(x.id_pago)===String(p.id_pago);});
  caja.forEach(function(m){updateFields('Movimientos_Caja','id_movimiento',m.id_movimiento,{eliminado:'si',fecha_anulacion:now,motivo_anulacion:'Pago anulado: '+String(p.motivo||'')});});
  recalcTrabajoPagos(pago.id_trabajo);
  audit('VOID','Pagos',p.id_pago,{motivo:p.motivo||''});
  return {id_pago:p.id_pago,anulado:true};
}

function recalcTrabajoPagos(idTrabajo) {
  var t=readOne('Trabajos','id_trabajo',idTrabajo);if(!t)return;
  var total=0;listPagos({id_trabajo:idTrabajo}).forEach(function(p){total+=toNum(p.monto);});
  updateFields('Trabajos','id_trabajo',idTrabajo,{sena:round2(total),saldo:round2(toNum(t.total_trabajo)-total),fecha_actualizacion:timestamp()});
}

function validateStockForItems(items) {
  if(boolYes(getConfig().permitir_stock_negativo))return;
  var ins=readAll('Insumos_Stock'),byId={};ins.forEach(function(x){byId[String(x.id_insumo)]=x;});
  var need={};
  items.forEach(function(it){if(it.id_insumo)need[String(it.id_insumo)]=(need[String(it.id_insumo)]||0)+toNum(it.cantidad);});
  Object.keys(need).forEach(function(id){
    if(byId[id]&&toNum(byId[id].cantidad_stock)+0.000001<need[id])throw apiError('INSUFFICIENT_STOCK','Stock insuficiente de '+byId[id].nombre+'. Disponible: '+toNum(byId[id].cantidad_stock)+', requerido: '+need[id]+'.');
  });
}

function consumeStockForWork(t,items) {
  items.forEach(function(it){
    if(!it.id_insumo||toNum(it.cantidad)<=0)return;
    createStockMovement({
      fecha:ymd(),id_insumo:it.id_insumo,tipo:'SALIDA_TRABAJO',cantidad:toNum(it.cantidad),
      id_trabajo:t.id_trabajo,id_presupuesto:t.id_presupuesto,origen:'trabajo',
      referencia:t.id_trabajo+':'+it.id_item,observaciones:'Consumo al convertir presupuesto en trabajo'
    });
  });
}

// ---------------------------------------------------------------------------
