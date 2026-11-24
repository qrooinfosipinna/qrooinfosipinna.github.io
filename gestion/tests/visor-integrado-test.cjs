const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = path.resolve(process.cwd(), 'js/indicador.js');
const context = {
  document: { addEventListener() {} },
  window: { addEventListener() {} },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(source, 'utf8'), context, { filename: source });
const header = ['Entidad', 'Periodo / categoría', 'Valor', 'Referencia original'];
const views = rows => JSON.parse(JSON.stringify(context.construirVistasIntegradas([header, ...rows])));

test('excluye filas vacías, notas y observaciones sin entidad, categoría o cifra', () => {
  const result = views([
    null, undefined, [], ['', '2020 / Total', 12], ['Quintana Roo', '', 13],
    ['Fuente: INEGI'], ['Quintana Roo', '2020 / Total', 'N/D'],
    ['Quintana Roo', '2020 / Total', 0],
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].labels, ['Total']);
  assert.deepEqual(result[0].datasets, [{ label: 'Quintana Roo', data: [0] }]);
});

test('un solo año se muestra por categorías con cifras de cada entidad', () => {
  const [view] = views([
    ['Nacional', '2020 / Hombres', 15], ['Quintana Roo', '2020 / Hombres', 5],
    ['Nacional', '2020 / Mujeres', 20], ['Quintana Roo', '2020 / Mujeres', 7],
  ]);
  assert.equal(view.tituloVista, '2020');
  assert.equal(view.modo, 'categorias-integradas');
  assert.deepEqual(view.labels, ['Hombres', 'Mujeres']);
  assert.deepEqual(view.datasets, [
    { label: 'Nacional', data: [15, 20] }, { label: 'Quintana Roo', data: [5, 7] },
  ]);
  assert.deepEqual(view.tabla, {
    columnas: ['Categoría', 'Nacional', 'Quintana Roo'],
    filas: [['Hombres', 15, 5], ['Mujeres', 20, 7]],
  });
});

test('varios años conservan huecos, ceros y cifras negativas sin cruzar entidades', () => {
  const [view] = views([
    ['Nacional', '2020 / Total', 100], ['Quintana Roo', '2021 / Total', 0],
    ['Quintana Roo', '2022 / Total', -2],
  ]);
  assert.equal(view.tituloVista, 'Total');
  assert.equal(view.modo, 'serie-integrada');
  assert.deepEqual(view.labels, ['2020', '2021', '2022']);
  assert.deepEqual(view.datasets, [
    { label: 'Nacional', data: [100, null, null] },
    { label: 'Quintana Roo', data: [null, 0, -2] },
  ]);
  assert.deepEqual(view.tabla, {
    columnas: ['Año', 'Nacional', 'Quintana Roo'],
    filas: [['2020', 100, null], ['2021', null, 0], ['2022', null, -2]],
  });
});

test('separa grupos de edad y sexo sin mezclar sus series', () => {
  const result = views([
    ['Quintana Roo', '2020 / 0 a 17 años / Mujeres', 4],
    ['Quintana Roo', '2021 / 0 a 17 años / Mujeres', 6],
    ['Quintana Roo', '2020 / 0 a 17 años / Hombres', 3],
    ['Quintana Roo', '2021 / 0 a 17 años / Hombres', 5],
  ]);
  assert.deepEqual(result.map(v => [v.tituloVista, v.datasets[0].data]), [
    ['0 a 17 años / Mujeres', [4, 6]], ['0 a 17 años / Hombres', [3, 5]],
  ]);
});

test('los municipios conservan sus nombres, categorías y cifras fuera de la serie estatal', () => {
  const result = views([
    ['Quintana Roo', '2020 / Total', 30],
    ['Benito Juárez', '2020 / Total', 20], ['Othón P. Blanco', '2020 / Total', 10],
    ['Benito Juárez', '2020 / Mujeres', 11],
  ]);
  assert.equal(result.length, 3);
  assert.deepEqual(result[0].datasets, [{ label: 'Quintana Roo', data: [30] }]);
  assert.equal(result[1].tituloVista, 'Municipios · 2020 / Total');
  assert.equal(result[1].modo, 'municipios-integrados');
  assert.deepEqual(result[1].labels, ['Benito Juárez', 'Othón P. Blanco']);
  assert.deepEqual(result[1].tabla, {
    columnas: ['Municipio', 'Valor'], filas: [['Benito Juárez', 20], ['Othón P. Blanco', 10]],
  });
  assert.deepEqual(result[2].datasets[0].data, [11]);
});

test('un libro sin observaciones no inventa vistas', () => {
  assert.deepEqual(views([]), []);
  assert.deepEqual(views([['Fuente: INEGI']]), []);
});

test('las categorías sin sexo y las series etiquetadas solo por año conservan sus títulos', () => {
  const [categories] = views([
    ['Quintana Roo', 'Zona urbana', '1,234.5'], ['Quintana Roo', 'Zona rural', 200],
  ]);
  assert.equal(categories.tituloVista, 'Comparación');
  assert.equal(categories.modo, 'categorias-integradas');
  assert.deepEqual(categories.labels, ['Zona urbana', 'Zona rural']);
  assert.deepEqual(categories.datasets[0].data, [1234.5, 200]);
  const [series] = views([['Quintana Roo', '2020', 12], ['Quintana Roo', '2021', 15]]);
  assert.equal(series.tituloVista, 'Comparación');
  assert.equal(series.modo, 'serie-integrada');
  assert.deepEqual(series.labels, ['2020', '2021']);
  assert.deepEqual(series.datasets[0].data, [12, 15]);
});

test('los indicadores ocultos no aparecen en el selector ni se abren por identificador', () => {
  vm.runInContext(`catalogoCache = { indicadores: [
    { id: '1.10', tema: 'desarrollo', visible: true },
    { id: '1.2', tema: 'desarrollo' },
    { id: '1.1', tema: 'desarrollo', visible: false },
    { id: '1.3', tema: 'supervivencia' }
  ] };`, context);
  assert.deepEqual(Array.from(context.obtenerIndicadoresTema('desarrollo'), i => i.id), ['1.2', '1.10']);
  assert.equal(context.obtenerIndicador('1.1', 'desarrollo'), null);
  assert.equal(context.obtenerIndicador('1.2', 'supervivencia'), null);
  assert.equal(context.obtenerIndicador('1.2', 'desarrollo').id, '1.2');
});

test('las tasas conservan cuatro decimales y los periodos integrados se representan con líneas', () => {
  assert.equal(context.formatearValorTabla(-0.317166, 4), '-0.3172');
  assert.equal(context.formatearValorTabla(0), '0');
  assert.equal(context.formatearValorTabla(null), '—');
  assert.equal(context.tipoChartParaVista({ modo: 'serie-integrada' }), 'line');
  assert.equal(context.tipoChartParaVista({ modo: 'municipios-integrados' }), 'bar');
});

test('la ficha se lee de Metadato y reúne las notas que continúan en otra fila', async () => {
  context.XLSX = { utils: { sheet_to_json: sheet => sheet.rows } };
  context.testWorkbook = {
    SheetNames: ['Gráfica', 'Metadato'],
    Sheets: {
      'Gráfica': { rows: [['Título', 'No es la ficha']] },
      Metadato: { rows: [['Nota', 'Primera parte'], ['Nota (continuación 1)', 'Segunda parte']] },
    },
  };
  vm.runInContext('cargarWorkbook = async () => testWorkbook;', context);
  const metadata = await context.cargarMetadatos({ archivoMetadato: 'ficha-prueba.xlsx' });
  assert.equal(metadata.nota, 'Primera parte\nSegunda parte');
  assert.equal(metadata.titulo, undefined);
});
