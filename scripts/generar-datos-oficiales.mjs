import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const tempDir = process.env.TEMP || process.env.TMP || '.';
const generatedAt = '2026-09-15';
const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ensureDir = dir => fs.mkdirSync(dir, { recursive: true });
const cleanCsvValue = value => String(value ?? '').replace(/^"|"$/g, '').replaceAll('""', '"');

function writeJson(relativePath, data) {
  const output = path.join(projectDir, relativePath);
  ensureDir(path.dirname(output));
  fs.writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Generado ${relativePath}`);
}

function generateCrime() {
  const rows = [];
  const controls = [];

  for (const year of [2024, 2025]) {
    const input = path.join(tempDir, `sesnsp-victimas-nna-${year}.json`);
    const response = JSON.parse(fs.readFileSync(input, 'utf8'));
    if (response.recordsFiltered !== 66 || response.data.length !== 66) {
      throw new Error(`El SESNSP devolvió ${response.data.length} de ${response.recordsFiltered} filas para ${year}.`);
    }

    let total = 0;
    for (const source of response.data) {
      const values = months.map(month => Number(source[month]) || 0);
      total += values.reduce((sum, value) => sum + value, 0);
      rows.push({
        id_fuente: Number(source._id),
        anio: Number(source.Ano),
        sexo: source.Sexo,
        rango_edad: source['Rango de edad'],
        bien_juridico: source['Bien juridico afectado'],
        tipo_delito: source['Tipo de delito'],
        subtipo_delito: source['Subtipo de delito'],
        modalidad: source.Modalidad,
        meses: values,
        total: values.reduce((sum, value) => sum + value, 0)
      });
    }
    controls.push({ anio: year, filas: response.data.length, total_victimas_nna: total });
  }

  writeJson('datos/delitos/victimas-nna-2024-2025.json', {
    metadata: {
      titulo: 'Víctimas de delitos de 0 a 17 años en Quintana Roo',
      institucion: 'Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública (SESNSP)',
      definicion: 'Víctimas de hechos delictivos del fuero común, clasificadas por el SESNSP en el rango de edad Menores de edad (0-17).',
      cobertura: 'Estatal, Quintana Roo',
      periodo: 'Enero de 2024 a diciembre de 2025',
      corte: 'Diciembre de 2025',
      generado: generatedAt,
      fuente: 'https://www.datos.gob.mx/dataset/incidencia_delictiva',
      recurso: 'https://www.datos.gob.mx/dataset/incidencia_delictiva/resource/386f17d2-a488-4da2-9c85-99765b5a9cdc/view/96b2e9b8-9fd6-4385-8655-31e362cd3fb1',
      notas: [
        'Todos los registros incluidos tienen el rango de edad oficial Menores de edad (0-17).',
        'La fuente ofrece edad y sexo únicamente con desagregación estatal; no publica municipio para estas víctimas.',
        'Las cifras representan víctimas registradas en carpetas de investigación y no sentencias ni población en riesgo.',
        'La base histórica puede actualizarse de forma retroactiva por el SESNSP.',
        'Se conserva la clasificación oficial por sexo, bien jurídico, tipo, subtipo y modalidad.'
      ]
    },
    meses: months,
    controles: controls,
    registros: rows
  });
}

function maternalAgeGroup(value) {
  const age = Number(value);
  if (age === 99 || !Number.isFinite(age)) return 'No especificada';
  if (age <= 14) return '10 a 14 años';
  if (age <= 19) return '15 a 19 años';
  if (age <= 24) return '20 a 24 años';
  if (age <= 29) return '25 a 29 años';
  if (age <= 34) return '30 a 34 años';
  if (age <= 39) return '35 a 39 años';
  if (age <= 44) return '40 a 44 años';
  return '45 a 50 años';
}

function occurrenceGroup(value) {
  const year = Number(value);
  if (year === 9999 || !Number.isFinite(year)) return 'No especificado';
  if (year === 2024) return '2024';
  if (year === 2023) return '2023';
  return '2022 o anterior';
}

async function generateBirths() {
  const root = path.join(tempDir, 'enr2024');
  const input = path.join(root, 'conjunto_de_datos', 'conjunto_de_datos_enr2024.csv');
  const catalog = path.join(root, 'catalogos', 'catemlna24.csv');
  const municipalities = {};

  for (const line of fs.readFileSync(catalog, 'utf8').split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const [entity, municipality, locality, name] = line.split(',').map(cleanCsvValue);
    if (entity === '23' && locality === '0000') municipalities[municipality] = name;
  }

  const grouped = new Map();
  let sourceRows = 0;
  let selectedRows = 0;
  const stream = readline.createInterface({ input: fs.createReadStream(input), crlfDelay: Infinity });
  let header = true;

  for await (const line of stream) {
    if (header) { header = false; continue; }
    sourceRows += 1;
    const values = line.split(',').map(cleanCsvValue);
    if (values[4] !== '23') continue;
    selectedRows += 1;

    const municipalityCode = values[5];
    const record = {
      anio_registro: Number(values[21]),
      mes_registro: Number(values[20]),
      clave_municipio: `23${municipalityCode}`,
      municipio: municipalities[municipalityCode] || 'Municipio no especificado',
      sexo: values[12] === '1' ? 'Hombre' : values[12] === '2' ? 'Mujer' : 'No especificado',
      grupo_edad_madre: maternalAgeGroup(values[14]),
      ocurrencia: occurrenceGroup(values[18]),
      tipo_nacimiento: values[24] === '1' ? 'Simple' : values[24] === '2' ? 'Doble' : values[24] === '3' ? 'Triple o más' : 'No especificado'
    };
    const key = Object.values(record).join('|');
    const existing = grouped.get(key);
    if (existing) existing.total += 1;
    else grouped.set(key, { ...record, total: 1 });
  }

  const records = [...grouped.values()].sort((a, b) =>
    a.clave_municipio.localeCompare(b.clave_municipio) ||
    a.mes_registro - b.mes_registro ||
    a.sexo.localeCompare(b.sexo, 'es') ||
    a.grupo_edad_madre.localeCompare(b.grupo_edad_madre, 'es')
  );
  const born2024 = records.filter(record => record.ocurrencia === '2024').reduce((sum, record) => sum + record.total, 0);

  writeJson('datos/nacimientos/enr-quintana-roo-2024.json', {
    metadata: {
      titulo: 'Nacimientos registrados de madres residentes en Quintana Roo',
      institucion: 'Instituto Nacional de Estadística y Geografía (INEGI)',
      definicion: 'Nacimientos inscritos durante 2024 en el Registro Civil, clasificados por el municipio de residencia habitual de la madre.',
      cobertura: 'Municipios de residencia habitual de la madre en Quintana Roo',
      periodo: 'Año de registro 2024',
      actualizado: '25 de septiembre de 2025',
      generado: generatedAt,
      fuente: 'https://www.inegi.org.mx/programas/natalidad/#Datos_abiertos',
      descarga: 'https://www.inegi.org.mx/contenidos/programas/natalidad/datosabiertos/2024/conjunto_de_datos_enr2024_csv.zip',
      diccionario: 'https://www.inegi.org.mx/rnm/index.php/catalog/1131/data-dictionary',
      notas: [
        'La unidad de observación es el nacimiento registrado; no equivale exclusivamente a nacimientos ocurridos en 2024 porque puede incluir registros extemporáneos.',
        'La geografía corresponde a la residencia habitual de la madre, no al municipio de registro ni al lugar del parto.',
        'Los datos se agregaron desde los microdatos públicos del INEGI sin estimaciones ni imputaciones adicionales.'
      ]
    },
    meses: months,
    controles: {
      filas_fuente_nacional: sourceRows,
      nacimientos_residencia_quintana_roo: selectedRows,
      nacidos_en_2024: born2024,
      registros_agregados: records.length
    },
    registros: records
  });
}

generateCrime();
await generateBirths();
