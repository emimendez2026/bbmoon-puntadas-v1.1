// Caja
// ---------------------------------------------------------------------------

function createCajaForPago(pago,t) {
  var existing=readAll('Movimientos_Caja',{includeDeleted:true}).filter(function(x){return String(x.id_pago)===String(pago.id_pago);});
  if(existing.length)return existing[0];
  return writeObject('Movimientos_Caja','id_movimiento',{
    id_movimiento:newId('CAJ'),fecha:pago.fecha_pago,tipo:'ingreso',categoria:'Cobro de cliente',
    concepto:pago.concepto||'Pago de trabajo',monto:toNum(pago.monto),medio_pago:pago.medio_pago||'',
    id_cliente:t.id_cliente,id_trabajo:t.id_trabajo,id_pago:pago.id_pago,origen:'pago',referencia:pago.id_pago,
    observaciones:pago.observaciones||'',eliminado:'no',fecha_creacion:timestamp()
  });
}

function listCaja(payload) {
  var rows=readAll('Movimientos_Caja');
  if(payload&&payload.mes&&payload.anio){
    rows=rows.filter(function(x){var d=parseFecha(x.fecha);return d&&(d.getMonth()+1)===parseInt(payload.mes,10)&&d.getFullYear()===parseInt(payload.anio,10);});
  }
  return rows.sort(function(a,b){return String(b.fecha).localeCompare(String(a.fecha));});
}

function saveMovimientoCaja(p) {
  p=p||{};var tipo=String(p.tipo||'').toLowerCase();if(['ingreso','egreso'].indexOf(tipo)===-1)throw apiError('VALIDATION_ERROR','Tipo de caja invalido.');
  assertPositive(p.monto,'Monto');assertRequired(p.concepto,'el concepto');
  p.id_movimiento=newId('CAJ');p.fecha=p.fecha||ymd();p.tipo=tipo;p.monto=round2(toNum(p.monto));p.origen='manual';p.eliminado='no';p.fecha_creacion=timestamp();
  var saved=writeObject('Movimientos_Caja','id_movimiento',p);audit('CREATE','Movimientos_Caja',p.id_movimiento,{tipo:tipo,monto:p.monto});return saved;
}

function anularMovimientoCaja(p) {
  var m=readOne('Movimientos_Caja','id_movimiento',p.id_movimiento);if(!m)throw apiError('NOT_FOUND','Movimiento de caja no encontrado.');
  if(String(m.origen)==='pago')throw apiError('LINKED_PAYMENT','Este movimiento proviene de un pago. Anula el pago desde el trabajo.');
  var saved=updateFields('Movimientos_Caja','id_movimiento',p.id_movimiento,{eliminado:'si',fecha_anulacion:timestamp(),motivo_anulacion:String(p.motivo||'')});
  audit('VOID','Movimientos_Caja',p.id_movimiento,{motivo:p.motivo||''});return saved;
}

// ---------------------------------------------------------------------------
// Stock ledger
// ---------------------------------------------------------------------------

function listMovimientosStock(payload) {
  var rows=readAll('Movimientos_Stock');
  if(payload&&payload.id_insumo)rows=rows.filter(function(x){return String(x.id_insumo)===String(payload.id_insumo);});
  return rows.sort(function(a,b){return String(b.fecha).localeCompare(String(a.fecha));});
}

function saveMovimientoStock(p) {
  p=p||{};assertRequired(p.id_insumo,'el insumo');assertPositive(p.cantidad,'Cantidad');
  var allowed=['ENTRADA','SALIDA','AJUSTE_POSITIVO','AJUSTE_NEGATIVO'];
  p.tipo=String(p.tipo||'').toUpperCase();if(allowed.indexOf(p.tipo)===-1)throw apiError('VALIDATION_ERROR','Tipo de movimiento de stock invalido.');
  p.origen='manual';return createStockMovement(p);
}

function createStockMovement(p) {
  if(p.referencia){
    var dup=readAll('Movimientos_Stock',{includeDeleted:true}).filter(function(x){return String(x.referencia)===String(p.referencia)&&!isDeleted(x);});
    if(dup.length)return dup[0];
  }
  var ins=readOne('Insumos_Stock','id_insumo',p.id_insumo);if(!ins)throw apiError('NOT_FOUND','Insumo no encontrado.');
  var qty=toNum(p.cantidad),old=toNum(ins.cantidad_stock),sign=1;
  var type=String(p.tipo||'').toUpperCase();
  if(type==='SALIDA'||type==='SALIDA_TRABAJO'||type==='AJUSTE_NEGATIVO')sign=-1;
  var next=round2(old+sign*qty);
  if(next<0&&!boolYes(getConfig().permitir_stock_negativo))throw apiError('INSUFFICIENT_STOCK','El movimiento dejaria stock negativo de '+ins.nombre+'.');
  var mov={
    id_movimiento_stock:newId('STK'),fecha:p.fecha||ymd(),id_insumo:ins.id_insumo,codigo_insumo:ins.codigo,nombre_insumo:ins.nombre,
    tipo:type,cantidad:round2(qty),stock_anterior:round2(old),stock_nuevo:next,id_trabajo:p.id_trabajo||'',id_presupuesto:p.id_presupuesto||'',
    origen:p.origen||'manual',referencia:p.referencia||'',observaciones:p.observaciones||'',eliminado:'no',fecha_creacion:timestamp()
  };
  writeObject('Movimientos_Stock','id_movimiento_stock',mov);
  updateFields('Insumos_Stock','id_insumo',ins.id_insumo,{cantidad_stock:next,fecha_actualizacion:timestamp()});
  audit('STOCK','Insumos_Stock',ins.id_insumo,{tipo:type,cantidad:qty,stock_nuevo:next});
  return mov;
}

// ---------------------------------------------------------------------------
// Client measurements
// ---------------------------------------------------------------------------

function listMedidas(payload) {
  var rows=readAll('Medidas_Clientes');
  if(payload&&payload.id_cliente)rows=rows.filter(function(x){return String(x.id_cliente)===String(payload.id_cliente);});
  return rows.sort(function(a,b){return String(b.fecha).localeCompare(String(a.fecha));});
}

function saveMedida(p) {
  p=p||{};assertRequired(p.id_cliente,'el cliente');
  if(!readOne('Clientes','id_cliente',p.id_cliente))throw apiError('NOT_FOUND','Cliente no encontrado.');
  var numeric=['busto','cintura','cadera','espalda','hombro','largo_total','largo_manga','contorno_brazo','tiro','entrepierna'];
  numeric.forEach(function(k){if(p[k]!==undefined&&p[k]!=='')assertNonNegative(p[k],k);});
  var now=timestamp();if(!p.id_medida){p.id_medida=newId('MED');p.fecha_creacion=now;}p.fecha=p.fecha||ymd();p.nombre_ficha=p.nombre_ficha||('Medidas '+p.fecha);p.eliminado='no';p.fecha_actualizacion=now;
  var saved=writeObject('Medidas_Clientes','id_medida',p);audit('UPSERT','Medidas_Clientes',p.id_medida,{id_cliente:p.id_cliente});return saved;
}

function deleteMedida(p) {
  var saved=updateFields('Medidas_Clientes','id_medida',p.id_medida,{eliminado:'si',fecha_actualizacion:timestamp()});audit('SOFT_DELETE','Medidas_Clientes',p.id_medida,{});return saved;
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

function listAgenda(payload) {
  var rows=readAll('Agenda');
  if(payload&&payload.desde)rows=rows.filter(function(x){return String(x.fecha)>=String(payload.desde);});
  if(payload&&payload.hasta)rows=rows.filter(function(x){return String(x.fecha)<=String(payload.hasta);});
  if(payload&&payload.id_trabajo)rows=rows.filter(function(x){return String(x.id_trabajo)===String(payload.id_trabajo);});
  return rows.sort(function(a,b){var ka=String(a.fecha)+' '+String(a.hora||''),kb=String(b.fecha)+' '+String(b.hora||'');return ka.localeCompare(kb);});
}

function saveEventoAgenda(p) {
  p=p||{};assertRequired(p.fecha,'la fecha');assertRequired(p.titulo,'el titulo del evento');
  var now=timestamp();if(!p.id_evento){p.id_evento=newId('AGE');p.fecha_creacion=now;}p.estado=p.estado||'pendiente';p.prioridad=p.prioridad||'normal';p.eliminado='no';p.fecha_actualizacion=now;
  if(p.id_cliente&&!p.cliente_nombre){var c=readOne('Clientes','id_cliente',p.id_cliente);if(c)p.cliente_nombre=c.nombre;}
  var saved=writeObject('Agenda','id_evento',p);audit('UPSERT','Agenda',p.id_evento,{fecha:p.fecha,titulo:p.titulo});return saved;
}

function deleteEventoAgenda(p) {
  var saved=updateFields('Agenda','id_evento',p.id_evento,{eliminado:'si',fecha_actualizacion:timestamp()});audit('SOFT_DELETE','Agenda',p.id_evento,{});return saved;
}

function ensureDeliveryEvent(t) {
  if(!t.fecha_estimada_entrega)return;
  var ref='ENTREGA:'+t.id_trabajo;
  var existing=readAll('Agenda',{includeDeleted:true}).filter(function(x){return String(x.observaciones||'').indexOf(ref)!==-1&&!isDeleted(x);});
  var p={
    fecha:t.fecha_estimada_entrega,hora:'',tipo:'entrega',titulo:'Entrega - '+(t.titulo_trabajo||'Trabajo'),
    id_cliente:t.id_cliente,cliente_nombre:t.cliente_nombre,id_trabajo:t.id_trabajo,estado:'pendiente',prioridad:'alta',
    observaciones:ref
  };
  if(existing.length)p.id_evento=existing[0].id_evento;
  saveEventoAgenda(p);
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

function saveProveedor(p) {
  p=p||{};assertRequired(p.nombre,'el nombre del proveedor');var now=timestamp();if(!p.id_proveedor){p.id_proveedor=newId('PROV');p.fecha_creacion=now;}p.fecha_actualizacion=now;p.eliminado='no';var saved=writeObject('Proveedores','id_proveedor',p);audit('UPSERT','Proveedores',p.id_proveedor,{nombre:p.nombre});return saved;
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function getKPIs(payload) {
  payload=payload||{};var now=new Date(),mes=payload.mes?parseInt(payload.mes,10):now.getMonth()+1,anio=payload.anio?parseInt(payload.anio,10):now.getFullYear();
  function enMes(v){var d=parseFecha(v);return !!d&&(d.getMonth()+1)===mes&&d.getFullYear()===anio;}
  var presup=readAll('Presupuestos'),trab=readAll('Trabajos'),pagos=readAll('Pagos'),ins=readAll('Insumos_Stock'),items=readAll('Presupuesto_Items'),clientes=readAll('Clientes'),caja=readAll('Movimientos_Caja');
  var presMes=presup.filter(function(p){return enMes(p.fecha_emision);}),aprob=0,montoPres=0,montoAprob=0;
  presMes.forEach(function(p){montoPres+=toNum(p.total_final);var e=String(p.estado).toLowerCase();if(['aprobado','convertido'].indexOf(e)!==-1){aprob++;montoAprob+=toNum(p.total_final);}});
  var trabMes=trab.filter(function(t){return enMes(t.fecha_aprobacion);}),vendido=0,ganancia=0;trabMes.forEach(function(t){vendido+=toNum(t.total_trabajo);ganancia+=toNum(t.ganancia_estimada);});
  var cobrado=0;pagos.filter(function(p){return enMes(p.fecha_pago);}).forEach(function(p){cobrado+=toNum(p.monto);});
  var ingresos=0,egresos=0;caja.filter(function(m){return enMes(m.fecha);}).forEach(function(m){if(String(m.tipo).toLowerCase()==='egreso')egresos+=toNum(m.monto);else ingresos+=toNum(m.monto);});
  var pend=0,proceso=0,finalizados=0,saldoPend=0;trab.forEach(function(t){var e=String(t.estado_trabajo).toLowerCase();if(e==='pendiente')pend++;if(e==='en proceso'||e==='listo para entregar')proceso++;if(e==='entregado'||e==='cobrado')finalizados++;if(e!=='cancelado')saldoPend+=Math.max(0,toNum(t.saldo));});
  var bajo=ins.filter(function(i){return String(i.estado).toLowerCase()!=='inactivo'&&toNum(i.stock_minimo)>0&&toNum(i.cantidad_stock)<=toNum(i.stock_minimo);});
  var uso={};items.forEach(function(it){var k=it.nombre_insumo||it.id_insumo;if(k)uso[k]=(uso[k]||0)+toNum(it.cantidad);});
  var topInsumos=Object.keys(uso).map(function(k){return{nombre:k,cantidad:uso[k]};}).sort(function(a,b){return b.cantidad-a.cantidad;}).slice(0,5);
  var uc={};presup.forEach(function(p){var k=p.cliente_nombre||p.id_cliente;if(k)uc[k]=(uc[k]||0)+1;});
  var topClientes=Object.keys(uc).map(function(k){return{nombre:k,cantidad:uc[k]};}).sort(function(a,b){return b.cantidad-a.cantidad;}).slice(0,5);
  var today=ymd(),future=new Date();future.setDate(future.getDate()+7);var hasta=ymd(future);var agenda=listAgenda({desde:today,hasta:hasta}).filter(function(e){return String(e.estado).toLowerCase()!=='completado';}).slice(0,8);
  var vencidos=presup.filter(function(p){var v=parseFecha(p.fecha_vencimiento),e=String(p.estado).toLowerCase();return e==='vencido'||(v&&v<now&&(e==='borrador'||e==='enviado'));}).length;
  return {
    mes:mes,anio:anio,cantidad_presupuestos:presMes.length,monto_presupuestado:round2(montoPres),cantidad_aprobados:aprob,
    monto_aprobado:round2(montoAprob),tasa_conversion:presMes.length?round2(aprob/presMes.length*100):0,total_vendido:round2(vendido),
    total_cobrado:round2(cobrado),saldo_pendiente:round2(saldoPend),ingresos_caja:round2(ingresos),egresos_caja:round2(egresos),resultado_caja:round2(ingresos-egresos),
    ticket_promedio:trabMes.length?round2(vendido/trabMes.length):0,trabajos_pendientes:pend,trabajos_en_proceso:proceso,trabajos_finalizados:finalizados,
    presupuestos_vencidos:vencidos,insumos_bajo_stock:bajo.length,lista_bajo_stock:bajo.map(function(i){return{nombre:i.nombre,stock:toNum(i.cantidad_stock),minimo:toNum(i.stock_minimo)};}),
    clientes_activos:clientes.length,ganancia_estimada:round2(ganancia),top_insumos:topInsumos,top_clientes:topClientes,agenda_proxima:agenda
  };
}
