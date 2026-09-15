(function () {
  'use strict';
  const prefix = 'delitos-';
  const $ = id => document.getElementById(prefix + id);
  const fmt = new Intl.NumberFormat('es-MX');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const sum = rows => rows.reduce((total, row) => total + row.valor, 0);
  const colors = ['#821b3f', '#154f39', '#b88b39', '#8b71aa', '#d66b3e', '#3f718e', '#b74d73', '#568c72', '#c4a45c', '#65547b', '#99614b', '#547b91'];
  let source;
  let chart;
  const state = { anio: 2025, mes: 'todos', sexo: 'todos', bien: 'todos', vista: 'tendencia' };

  function selectedRows() {
    return source.registros.filter(row => row.anio === state.anio &&
      (state.sexo === 'todos' || row.sexo === state.sexo) &&
      (state.bien === 'todos' || row.bien_juridico === state.bien)).map(row => ({
        ...row,
        valor: state.mes === 'todos' ? row.total : row.meses[Number(state.mes)]
      }));
  }

  function group(rows, key) {
    const grouped = new Map();
    rows.forEach(row => grouped.set(row[key], (grouped.get(row[key]) || 0) + row.valor));
    return [...grouped].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }

  function populate() {
    const years = [...new Set(source.registros.map(row => row.anio))].sort((a, b) => b - a);
    const sexes = [...new Set(source.registros.map(row => row.sexo))].sort((a, b) => a.localeCompare(b, 'es'));
    const legalGoods = [...new Set(source.registros.map(row => row.bien_juridico))].sort((a, b) => a.localeCompare(b, 'es'));
    $('anio').innerHTML = years.map(year => option(year, year)).join('');
    $('mes').innerHTML = option('todos', 'Todos los meses') + source.meses.map((month, index) => option(index, month)).join('');
    $('sexo').innerHTML = option('todos', 'Todos') + sexes.map(value => option(value, value)).join('');
    $('bien').innerHTML = option('todos', 'Todos los bienes jurídicos') + legalGoods.map(value => option(value, value)).join('');
    $('anio').value = state.anio;
  }

  function cards(rows) {
    const total = sum(rows);
    const women = rows.filter(row => row.sexo === 'Mujer').reduce((total, row) => total + row.valor, 0);
    const men = rows.filter(row => row.sexo === 'Hombre').reduce((total, row) => total + row.valor, 0);
    const types = group(rows, 'tipo_delito').filter(item => item.value > 0);
    const periodLabel = state.mes === 'todos' ? 'Suma de enero a diciembre' : source.meses[Number(state.mes)];
    const items = [
      ['Víctimas NNA', total, `${periodLabel} de ${state.anio}; rango 0 a 17 años`],
      ['Mujeres de 0 a 17', women, 'Víctimas clasificadas por sexo como mujer'],
      ['Hombres de 0 a 17', men, 'Víctimas clasificadas por sexo como hombre'],
      ['Tipos con víctimas NNA', types.length, 'Clasificación oficial con cifra mayor a cero']
    ];
    $('kpis').innerHTML = items.map(([label, value, note]) => `<article class="of-kpi"><span>${esc(label)}</span><strong>${fmt.format(value)}</strong><small>${esc(note)}</small></article>`).join('');
  }

  function chartData(rows) {
    if (state.vista === 'tendencia') {
      const base = source.registros.filter(row => row.anio === state.anio && (state.sexo === 'todos' || row.sexo === state.sexo) && (state.bien === 'todos' || row.bien_juridico === state.bien));
      return { title: 'Evolución mensual', items: source.meses.map((label, index) => ({ label, value: base.reduce((total, row) => total + row.meses[index], 0) })), type: 'line' };
    }
    const settings = {
      sexo: ['Víctimas NNA por sexo', 'sexo'],
      tipo: ['Víctimas NNA por tipo de delito', 'tipo_delito'],
      bien: ['Víctimas NNA por bien jurídico', 'bien_juridico']
    };
    const [title, key] = settings[state.vista];
    return { title, items: group(rows, key).filter(item => item.value > 0).slice(0, 20), type: 'bar' };
  }

  function renderChart(rows) {
    const view = chartData(rows);
    $('grafica-titulo').textContent = view.title;
    if (chart) chart.destroy();
    const horizontal = view.type === 'bar' && view.items.length > 8;
    chart = new Chart($('grafica'), {
      type: view.type,
      data: { labels: view.items.map(item => item.label), datasets: [{ label: 'Víctimas de 0 a 17 años', data: view.items.map(item => item.value), backgroundColor: colors, borderColor: '#821b3f', borderWidth: view.type === 'line' ? 3 : 0, tension: .28, fill: view.type === 'line', pointRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: view.type === 'line' }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${fmt.format(context.raw)}` } } }, scales: { x: { beginAtZero: true, grid: { color: '#eceef2' } }, y: { beginAtZero: true, grid: { color: '#eceef2' } } } }
    });
  }

  function renderTable(rows) {
    const visible = rows.filter(row => row.valor > 0).sort((a, b) => b.valor - a.valor);
    $('conteo').textContent = `${fmt.format(visible.length)} clasificaciones con registro. Se muestran las primeras 150, ordenadas de mayor a menor.`;
    $('tabla').innerHTML = visible.length ? visible.slice(0, 150).map(row => `<tr><td>${esc(row.sexo)}</td><td>${esc(row.bien_juridico)}</td><td>${esc(row.tipo_delito)}</td><td>${esc(row.subtipo_delito)}<br><small>${esc(row.modalidad)}</small></td><td><strong>${fmt.format(row.valor)}</strong></td></tr>`).join('') : '<tr><td class="of-empty" colspan="5">No hay registros para esta selección.</td></tr>';
  }

  function renderMethod() {
    const meta = source.metadata;
    $('metodo').innerHTML = `<h3>Definición</h3><p>${esc(meta.definicion)}</p><h3>Cobertura</h3><p>${esc(meta.cobertura)}. Periodo disponible en este tablero: ${esc(meta.periodo)}.</p><h3>Fuente comprobable</h3><p><a href="${esc(meta.fuente)}" target="_blank" rel="noopener noreferrer">Conjunto de datos oficial en datos.gob.mx</a> · <a href="${esc(meta.recurso)}" target="_blank" rel="noopener noreferrer">Recurso de víctimas consultado</a>.</p><ul>${meta.notas.map(note => `<li>${esc(note)}</li>`).join('')}</ul>`;
  }

  function render() {
    const rows = selectedRows();
    const period = state.mes === 'todos' ? `enero a diciembre de ${state.anio}` : `${source.meses[Number(state.mes)]} de ${state.anio}`;
    $('cobertura').textContent = `${period}; Quintana Roo; ${state.sexo === 'todos' ? 'mujeres y hombres de 0 a 17 años' : state.sexo + ' de 0 a 17 años'}; ${state.bien === 'todos' ? 'todos los bienes jurídicos' : state.bien}.`;
    cards(rows);
    renderChart(rows);
    renderTable(rows);
  }

  function reset() {
    Object.assign(state, { anio: 2025, mes: 'todos', sexo: 'todos', bien: 'todos', vista: 'tendencia' });
    ['anio', 'mes', 'sexo', 'bien', 'vista'].forEach(key => { $(key).value = state[key]; });
    render();
  }

  async function init() {
    try {
      const response = await fetch('datos/delitos/victimas-nna-2024-2025.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      source = await response.json();
      if (!Array.isArray(source.registros) || source.registros.length !== 132 || source.registros.some(row => row.rango_edad !== 'Menores de edad (0-17)')) throw new Error('Formato, edad o número de filas inesperado');
      populate();
      ['anio', 'mes', 'sexo', 'bien', 'vista'].forEach(key => $(key).addEventListener('change', () => { state[key] = key === 'anio' ? Number($(key).value) : $(key).value; render(); }));
      $('limpiar').addEventListener('click', reset);
      renderMethod();
      $('contenido').hidden = false;
      $('estado').hidden = true;
      reset();
    } catch (error) {
      $('estado').textContent = 'No fue posible cargar los datos oficiales. Actualiza la página o vuelve a intentarlo más tarde.';
      console.error('Tablero de delitos:', error);
    }
  }
  init();
})();
