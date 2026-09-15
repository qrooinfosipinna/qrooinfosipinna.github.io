(function () {
  'use strict';
  const prefix = 'nacimientos-';
  const $ = id => document.getElementById(prefix + id);
  const fmt = new Intl.NumberFormat('es-MX');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const sum = rows => rows.reduce((total, row) => total + row.total, 0);
  const colors = ['#821b3f', '#154f39', '#b88b39', '#8b71aa', '#d66b3e', '#3f718e', '#b74d73', '#568c72', '#c4a45c', '#65547b', '#99614b', '#547b91'];
  const ageOrder = ['10 a 14 años', '15 a 19 años', '20 a 24 años', '25 a 29 años', '30 a 34 años', '35 a 39 años', '40 a 44 años', '45 a 50 años', 'No especificada'];
  let source;
  let chart;
  const state = { anio: 2024, mes: 'todos', municipio: 'todos', sexo: 'todos', edad: 'todos', vista: 'mes' };

  function selectedRows() {
    return source.registros.filter(row => row.anio_registro === state.anio &&
      (state.mes === 'todos' || row.mes_registro === Number(state.mes)) &&
      (state.municipio === 'todos' || row.municipio === state.municipio) &&
      (state.sexo === 'todos' || row.sexo === state.sexo) &&
      (state.edad === 'todos' || row.grupo_edad_madre === state.edad));
  }

  function group(rows, key, order) {
    const grouped = new Map();
    rows.forEach(row => grouped.set(row[key], (grouped.get(row[key]) || 0) + row.total));
    const items = [...grouped].map(([label, value]) => ({ label, value }));
    return order ? order.map(label => items.find(item => item.label === label) || { label, value: 0 }) : items.sort((a, b) => b.value - a.value);
  }

  function populate() {
    const years = [...new Set(source.registros.map(row => row.anio_registro))].sort((a, b) => b - a);
    const municipalities = [...new Set(source.registros.map(row => row.municipio))].sort((a, b) => a.localeCompare(b, 'es'));
    const sexes = [...new Set(source.registros.map(row => row.sexo))].sort((a, b) => a.localeCompare(b, 'es'));
    $('anio').innerHTML = years.map(year => option(year, year)).join('');
    $('mes').innerHTML = option('todos', 'Todos los meses') + source.meses.map((month, index) => option(index + 1, month)).join('');
    $('municipio').innerHTML = option('todos', 'Todos los municipios') + municipalities.map(value => option(value, value)).join('');
    $('sexo').innerHTML = option('todos', 'Todos') + sexes.map(value => option(value, value)).join('');
    $('edad').innerHTML = option('todos', 'Todas las edades') + ageOrder.map(value => option(value, value)).join('');
  }

  function cards(rows) {
    const total = sum(rows);
    const born2024 = sum(rows.filter(row => row.ocurrencia === '2024'));
    const adolescent = sum(rows.filter(row => ['10 a 14 años', '15 a 19 años'].includes(row.grupo_edad_madre)));
    const multiple = sum(rows.filter(row => ['Doble', 'Triple o más'].includes(row.tipo_nacimiento)));
    const items = [
      ['Nacimientos registrados', total, `Inscritos en ${state.anio}`],
      ['Ocurrieron en 2024', born2024, 'El resto corresponde a registro extemporáneo o no especificado'],
      ['Madres de 10 a 19 años', adolescent, 'Edad al momento del nacimiento'],
      ['Nacimiento doble o mayor', multiple, 'Registros clasificados como doble, triple o más']
    ];
    $('kpis').innerHTML = items.map(([label, value, note]) => `<article class="of-kpi"><span>${esc(label)}</span><strong>${fmt.format(value)}</strong><small>${esc(note)}</small></article>`).join('');
  }

  function chartData(rows) {
    const settings = {
      municipio: ['Nacimientos registrados por municipio de residencia de la madre', 'municipio'],
      sexo: ['Nacimientos registrados por sexo', 'sexo'],
      edad: ['Nacimientos registrados por edad de la madre', 'grupo_edad_madre'],
      ocurrencia: ['Nacimientos registrados por año de ocurrencia', 'ocurrencia']
    };
    if (state.vista === 'mes') return { title: 'Nacimientos por mes de registro', items: group(rows, 'mes_registro').map(item => ({ label: source.meses[Number(item.label) - 1] || 'No especificado', value: item.value })).sort((a, b) => source.meses.indexOf(a.label) - source.meses.indexOf(b.label)), type: 'line' };
    const [title, key] = settings[state.vista];
    const order = state.vista === 'edad' ? ageOrder : state.vista === 'ocurrencia' ? ['2024', '2023', '2022 o anterior', 'No especificado'] : null;
    return { title, items: group(rows, key, order).filter(item => item.value > 0), type: 'bar' };
  }

  function renderChart(rows) {
    const view = chartData(rows);
    $('grafica-titulo').textContent = view.title;
    if (chart) chart.destroy();
    const horizontal = view.type === 'bar' && view.items.length > 7;
    chart = new Chart($('grafica'), {
      type: view.type,
      data: { labels: view.items.map(item => item.label), datasets: [{ label: 'Nacimientos registrados', data: view.items.map(item => item.value), backgroundColor: colors, borderColor: '#154f39', borderWidth: view.type === 'line' ? 3 : 0, tension: .28, fill: view.type === 'line', pointRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: view.type === 'line' }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${fmt.format(context.raw)}` } } }, scales: { x: { beginAtZero: true, grid: { color: '#eceef2' } }, y: { beginAtZero: true, grid: { color: '#eceef2' } } } }
    });
  }

  function renderTable(rows) {
    const grouped = new Map();
    rows.forEach(row => {
      const key = [row.municipio, row.mes_registro, row.sexo, row.grupo_edad_madre, row.ocurrencia].join('|');
      grouped.set(key, (grouped.get(key) || 0) + row.total);
    });
    const visible = [...grouped].map(([key, total]) => ({ values: key.split('|'), total })).sort((a, b) => b.total - a.total);
    $('conteo').textContent = `${fmt.format(visible.length)} combinaciones. Se muestran las primeras 150, ordenadas de mayor a menor.`;
    $('tabla').innerHTML = visible.length ? visible.slice(0, 150).map(row => `<tr><td>${esc(row.values[0])}</td><td>${esc(source.meses[Number(row.values[1]) - 1] || 'No especificado')}</td><td>${esc(row.values[2])}</td><td>${esc(row.values[3])}</td><td>${esc(row.values[4])}</td><td><strong>${fmt.format(row.total)}</strong></td></tr>`).join('') : '<tr><td class="of-empty" colspan="6">No hay registros para esta selección.</td></tr>';
  }

  function renderMethod() {
    const meta = source.metadata;
    $('metodo').innerHTML = `<h3>Definición</h3><p>${esc(meta.definicion)}</p><h3>Cobertura</h3><p>${esc(meta.cobertura)}. El año 2024 es la publicación oficial más reciente disponible para este conjunto.</p><h3>Fuente comprobable</h3><p><a href="${esc(meta.fuente)}" target="_blank" rel="noopener noreferrer">Página oficial de la ENR</a> · <a href="${esc(meta.descarga)}" target="_blank" rel="noopener noreferrer">Microdatos CSV utilizados</a> · <a href="${esc(meta.diccionario)}" target="_blank" rel="noopener noreferrer">Diccionario de datos</a>.</p><ul>${meta.notas.map(note => `<li>${esc(note)}</li>`).join('')}</ul>`;
  }

  function render() {
    const rows = selectedRows();
    const period = state.mes === 'todos' ? `todo ${state.anio}` : `${source.meses[Number(state.mes) - 1]} de ${state.anio}`;
    $('cobertura').textContent = `${period}; ${state.municipio === 'todos' ? 'todas las residencias municipales' : state.municipio}; ${state.sexo === 'todos' ? 'todos los sexos' : state.sexo}.`;
    cards(rows);
    renderChart(rows);
    renderTable(rows);
  }

  function reset() {
    Object.assign(state, { anio: 2024, mes: 'todos', municipio: 'todos', sexo: 'todos', edad: 'todos', vista: 'mes' });
    ['anio', 'mes', 'municipio', 'sexo', 'edad', 'vista'].forEach(key => { $(key).value = state[key]; });
    render();
  }

  async function init() {
    try {
      const response = await fetch('datos/nacimientos/enr-quintana-roo-2024.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      source = await response.json();
      if (!Array.isArray(source.registros) || source.controles.nacimientos_residencia_quintana_roo !== 21990) throw new Error('Formato o total de control inesperado');
      populate();
      ['anio', 'mes', 'municipio', 'sexo', 'edad', 'vista'].forEach(key => $(key).addEventListener('change', () => { state[key] = key === 'anio' ? Number($(key).value) : $(key).value; render(); }));
      $('limpiar').addEventListener('click', reset);
      renderMethod();
      $('contenido').hidden = false;
      $('estado').hidden = true;
      reset();
    } catch (error) {
      $('estado').textContent = 'No fue posible cargar los datos oficiales. Actualiza la página o vuelve a intentarlo más tarde.';
      console.error('Tablero de nacimientos:', error);
    }
  }
  init();
})();
