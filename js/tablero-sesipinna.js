(function (global) {
  'use strict';
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fmt = new Intl.NumberFormat('es-MX');
  const numero = n => n === null || n === undefined ? '—' : fmt.format(n);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const grupo = r => r.linea === 'nna' ? (r.programa || 'Sin programa reportado') : r.tipo;
  const suma = (rs,key) => {
    const v = rs.map(r => r[key]).filter(x => typeof x === 'number');
    return v.length ? v.reduce((a,b) => a+b,0) : null;
  };
  function filtrar(data, f) {
    return data.registros.filter(r => r.linea === f.linea && Number(r.periodo.slice(5)) >= f.desde && Number(r.periodo.slice(5)) <= f.hasta
      && (f.municipio === 'todos' || r.municipio === f.municipio)
      && (f.tipo === 'todos' || grupo(r) === f.tipo)
      && (!f.busqueda || normalizar([r.nombre,r.objetivo,r.texto_adicional,r.programa,r.lugar,r.fecha_reportada].join(' ')).includes(normalizar(f.busqueda))));
  }
  function resumen(rs) {
    const actividades = rs.filter(r => r.tipo !== 'Encuesta');
    const conciliados = actividades.filter(r => r.total_reportado !== null && r.suma_desglose === r.total_reportado);
    return {registros:rs.length,total:suma(actividades,'total_reportado'),mujeres:suma(conciliados,'mujeres'),hombres:suma(conciliados,'hombres'),
      conciliados:conciliados.length,actividades:actividades.length,encuestas:rs.filter(r => r.tipo === 'Encuesta').length,
      alcance:suma(rs,'alcance'),interacciones:suma(rs,'interacciones'),observados:rs.filter(r => r.observaciones.length).length};
  }
  const api = {filtrar,resumen,suma};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById('se-'+id);
  let data;
  const state = {linea:'nna',desde:1,hasta:8,municipio:'todos',tipo:'todos',busqueda:''};
  const municipio = code => data.municipios[code] || (code === 'estatal' ? 'Estatal / sin desglose' : 'No especificado');
  const option = (v,t) => `<option value="${esc(v)}">${esc(t)}</option>`;
  function cargarOpciones() {
    const digital = state.linea === 'comunicacion';
    $('municipio').innerHTML = digital ? option('todos','Sin desglose territorial') : option('todos','Todos los registros')
      + Object.entries(data.municipios).map(([k,v]) => option(k,v)).join('') + option('estatal','Estatal / sin desglose') + option('sin_especificar','No especificado');
    $('municipio').disabled = digital;
    $('municipio').value = state.municipio;
    const grupos = [...new Set(data.registros.filter(r => r.linea===state.linea).map(grupo))].sort((a,b)=>a.localeCompare(b,'es'));
    $('tipo').innerHTML = option('todos','Todos') + grupos.map(g=>option(g,g)).join('');
    $('tipo').value=state.tipo;
    document.querySelector('label[for="se-tipo"]').textContent=state.linea==='nna'?'Programa':'Tipo de registro';
  }
  function barras(id, items, color) {
    if (!items.length) { $(id).innerHTML='<p class="se-empty">No hay datos para esta selección.</p>'; return; }
    const max = Math.max(1,...items.map(x=>typeof x.value==='number'?x.value:0));
    $(id).innerHTML=items.map(x=>`<div class="se-bar-row"><span class="se-bar-label">${esc(x.label)}</span><div class="se-bar-track" aria-hidden="true"><div class="se-bar-fill" style="width:${typeof x.value==='number'?100*x.value/max:0}%;${color?'background:'+color:''}"></div></div><span class="se-bar-value">${x.value===null?esc(x.empty || '—'):numero(x.value)}</span></div>`).join('');
  }
  function cards(items) {
    $('kpis').innerHTML=items.map(([t,v,n])=>`<article class="se-kpi"><span>${esc(t)}</span><strong>${numero(v)}</strong><small>${esc(n)}</small></article>`).join('');
  }
  function metricas(rs) {
    const summary=resumen(rs),digital=state.linea==='comunicacion',soloEncuestas=rs.length>0 && rs.every(r=>r.tipo==='Encuesta');
    if (digital) cards([
      ['Contenidos registrados',rs.length,'Filas reportadas; no publicaciones únicas'],
      ['Alcance reportado',summary.alcance,'Suma por contenido; no personas únicas'],
      ['Interacciones reportadas',summary.interacciones,'Suma de las cifras capturadas'],
      ['Registros de campañas',rs.filter(r=>r.tipo==='Campaña').length,'Incluidos en los contenidos registrados']]);
    else cards([
      ['Registros de actividad',rs.length,'Una fila puede reunir varias fechas'],
      [soloEncuestas?'Periodos de encuesta':'Participaciones reportadas',soloEncuestas?new Set(rs.map(r=>r.periodo)).size:summary.total,soloEncuestas?'Las cifras se consultan por mes; no se acumulan':(summary.encuestas?'Excluye encuestas; no personas únicas':'Total de filas; no personas únicas')],
      ['Municipios identificados',new Set(rs.filter(r=>data.municipios[r.municipio]).map(r=>r.municipio)).size,'No incluye cobertura estatal sin desglose'],
      ['Registros por revisar',summary.observados,'Consulta sus observaciones en el detalle']]);

    $('chart1-title').textContent=digital?'Alcance reportado':soloEncuestas?'Cifras de encuesta por mes':'Participaciones reportadas';
    const monthly=[];
    for(let m=state.desde;m<=state.hasta;m++) {
      const period=`2026-${String(m).padStart(2,'0')}`;
      const rows=rs.filter(r=>r.periodo===period && (digital || soloEncuestas || r.tipo!=='Encuesta'));
      const coverage=data.cobertura_reportes.find(c=>c.linea===state.linea && c.periodo===period);
      monthly.push({label:meses[m-1],value:suma(rows,digital?'alcance':'total_reportado'),empty:!coverage?'Sin reporte':coverage.registros===0?'Sin captura':'—'});
    }
    barras('chart1',monthly);
    if(digital || soloEncuestas) {
      $('chart2-title').textContent=digital?'Contenidos por tipo':'Registros de encuesta por mes';
      const grouped=new Map();rs.forEach(r=>{const k=digital?r.tipo:meses[Number(r.periodo.slice(5))-1];grouped.set(k,(grouped.get(k)||0)+1);});
      barras('chart2',[...grouped].map(([label,value])=>({label,value})),'#154f39');
      $('chart2-note').textContent=digital?'El archivo no identifica plataformas, usuarios únicos, municipios de audiencia ni compartidos. No se infieren esos datos.':'Los reportes no aclaran si las encuestas son acumuladas. No se presenta una suma entre meses.';
    } else {
      $('chart2-title').textContent='Desglose por sexo';
      barras('chart2',[{label:'Mujeres',value:summary.mujeres},{label:'Hombres',value:summary.hombres}],'#154f39');
      $('chart2-note').textContent=`Incluye ${summary.conciliados} de ${summary.actividades} registros de actividad cuyo desglose coincide con el total reportado. Excluye encuestas y registros sin desglose conciliado. No representa personas únicas.`;
    }
    $('territorio').hidden=digital;
    if(!digital) {
      const codes=state.municipio==='todos'?[...Object.keys(data.municipios),'estatal','sin_especificar']:[state.municipio];
      $('municipios').innerHTML='<div class="se-municipal-grid">'+codes.map(code=>{
        const rows=rs.filter(r=>r.municipio===code),total=suma(rows.filter(r=>r.tipo!=='Encuesta'),'total_reportado');
        return `<article class="se-municipal"><span>${esc(municipio(code))}</span><strong>${numero(total)}</strong><small>${rows.length?`${rows.length} registro(s). ${rows.some(r=>r.tipo==='Encuesta')?'Las encuestas no se suman.':'Participaciones reportadas.'}`:'Sin registro en la selección.'}</small></article>`;
      }).join('')+'</div>';
    }
  }
  function desglose(obj) {
    return `<dl>${Object.entries(obj).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${v===null?'No reportado':numero(v)}</dd>`).join('')}</dl>`;
  }
  function tabla(rs) {
    const digital=state.linea==='comunicacion';
    $('conteo').textContent=`${rs.length} registro(s) en la selección.`;
    $('thead').innerHTML=`<tr><th scope="col">Actividad / contenido</th><th scope="col">Fecha capturada</th><th scope="col">${digital?'Interacciones':'Cobertura'}</th><th scope="col">${digital?'Alcance':'Total reportado'}</th></tr>`;
    if(!rs.length){$('tbody').innerHTML='<tr><td colspan="4"><p class="se-empty">No hay registros para estos filtros. Revisa la cobertura del reporte o restablece la selección.</p></td></tr>';return;}
    $('tbody').innerHTML=rs.map(r=>{
      const details=`<div class="se-reg-details"><p><strong>Objetivo:</strong> ${esc(r.objetivo || 'No reportado')}</p>${r.texto_adicional?`<p><strong>Texto desplazado conservado de la columna A:</strong> ${esc(r.texto_adicional)}</p>`:''}
        ${r.programa?`<p><strong>Programa:</strong> ${esc(r.programa)}</p>`:''}<p><strong>Tipo:</strong> ${esc(r.tipo)} · <strong>Modalidad:</strong> ${esc(r.modalidad)}</p>
        ${!digital?`<p><strong>Lugar:</strong> ${esc(r.lugar || 'No reportado')}<br><strong>Municipio capturado:</strong> ${esc(r.municipio_reportado || 'No reportado')}</p><strong>Desglose de población capturado</strong>${desglose(r.desglose)}<p><strong>Suma de categorías:</strong> ${numero(r.suma_desglose)} · <strong>Total reportado:</strong> ${numero(r.total_reportado)}</p><strong>Condiciones registradas</strong>${desglose(r.condiciones)}`:'<p><strong>Compartidos:</strong> No reportado. <strong>Plataforma y audiencia territorial:</strong> No reportadas.</p>'}
        ${r.observaciones.length?`<ul>${r.observaciones.map(o=>`<li>${esc(o)}</li>`).join('')}</ul>`:''}
        <p><strong>Fuente:</strong> ${esc(data.fuentes.find(f=>f.id===r.fuente.id).archivo)} · hoja ${esc(r.fuente.hoja)} · fila ${r.fuente.fila}.</p></div>`;
      return `<tr><td><details><summary>${esc(r.nombre)}</summary>${details}</details><span class="se-reg-period">${meses[Number(r.periodo.slice(5))-1]} 2026 · ${esc(r.id)}</span>${r.observaciones.length?'<span class="se-warning">Revisar captura</span>':''}</td><td>${esc(r.fecha_iso || r.fecha_reportada || 'No reportada')}</td><td>${digital?numero(r.interacciones):esc(municipio(r.municipio))}</td><td>${numero(digital?r.alcance:r.total_reportado)}</td></tr>`;
    }).join('');
  }
  function render() {
    const rs=filtrar(data,state),source=data.fuentes.find(f=>f.id===state.linea);
    $('linea-titulo').textContent=source.nombre;
    const disponibles=data.cobertura_reportes.filter(c=>c.linea===state.linea).map(c=>meses[Number(c.periodo.slice(5))-1]);
    $('cobertura').textContent=`Fuente disponible: ${disponibles.join(', ')} de 2026. Selección: ${meses[state.desde-1]}–${meses[state.hasta-1]}.`;
    const notas={
      nna:'Los totales reportados y los desgloses presentan diferencias en algunas filas y subtotales. Enero contiene una plantilla sin actividades capturadas. Se conserva el total de cada fila y se señalan los casos por revisar.',
      fortalecimiento:'Incluye actividades para familias, personal y docentes, además de encuestas. Las encuestas se muestran por separado y se excluyen de las participaciones. La hoja de marzo contiene columnas desplazadas y conceptos pendientes de confirmar.',
      gestion:'Solo se recibió agosto. Cinco registros no contienen cifras de participantes. La solicitud de información con 127 participaciones refiere acciones de Capacitación y puede volver a contar resultados de esa línea.',
      comunicacion:'Se recibieron reportes de enero a julio. El alcance suma las cifras por contenido y puede contar a una misma persona varias veces. No hay reporte de agosto ni desglose territorial de audiencia.'};
    $('contexto').textContent=notas[state.linea];
    metricas(rs);tabla(rs);
    const issues=data.observaciones_fuentes.filter(a=>a.linea===state.linea && (()=>{const c=data.cobertura_reportes.find(c=>c.linea===a.linea && meses[Number(c.periodo.slice(5))-1].toUpperCase()===a.hoja.split(' ')[0].toUpperCase());return c && Number(c.periodo.slice(5))>=state.desde && Number(c.periodo.slice(5))<=state.hasta;})());
    $('auditoria').innerHTML=issues.length?`<h4>Observaciones de la fuente para este periodo</h4><ul>${issues.map(a=>`<li>${esc(a.hoja)}, fila ${a.fila}: ${esc(a.detalle)}</li>`).join('')}</ul>`:'<p>No se detectaron diferencias aritméticas en las filas de esta fuente para el periodo seleccionado.</p>';
    $('estado').textContent='';
  }
  function restablecer(){Object.assign(state,{desde:1,hasta:8,municipio:'todos',tipo:'todos',busqueda:''});$('desde').value=1;$('hasta').value=8;$('buscar').value='';cargarOpciones();render();}
  async function init() {
    try {
      const response=await fetch('datos/sesipinna/2026.json',{cache:'no-cache'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      data=await response.json();
      if(!Array.isArray(data.registros)||!Array.isArray(data.fuentes))throw new Error('Formato de datos no reconocido');
      $('desde').innerHTML=$('hasta').innerHTML=meses.slice(0,8).map((m,i)=>option(i+1,m)).join('');
      $('fuentes').innerHTML='<h4>Reportes institucionales recibidos</h4><ul>'+data.fuentes.map(f=>`<li>${esc(f.archivo)}</li>`).join('')+'</ul>';
      for(const id of ['desde','hasta','municipio','tipo'])$(id).addEventListener('change',()=>{
        state[id]=['desde','hasta'].includes(id)?Number($(id).value):$(id).value;
        if(state.desde>state.hasta){if(id==='desde'){state.hasta=state.desde;$('hasta').value=state.hasta;}else{state.desde=state.hasta;$('desde').value=state.desde;}}
        render();
      });
      $('buscar').addEventListener('input',()=>{state.busqueda=$('buscar').value.trim();render();});
      $('limpiar').addEventListener('click',restablecer);
      document.querySelectorAll('[data-linea]').forEach(b=>b.addEventListener('click',()=>{
        state.linea=b.dataset.linea;state.municipio='todos';state.tipo='todos';state.busqueda='';$('buscar').value='';
        document.querySelectorAll('[data-linea]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));cargarOpciones();render();
      }));
      $('contenido').hidden=false;restablecer();
    } catch(error) {
      $('contenido').hidden=true;
      $('estado').textContent='No fue posible cargar los reportes. Actualiza la página o vuelve a intentarlo más tarde.';
      console.error('SESIPINNA:',error);
    }
  }
  init();
})(typeof window!=='undefined'?window:this);
