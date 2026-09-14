/*
 * CONFIGURACIÓN ÚNICA DEL VISOR DE INDICADORES INEGI
 *
 * El catálogo contiene la relación entre:
 *   - tema
 *   - id del indicador
 *   - archivo T (tabulado/gráfica)
 *   - archivo M (metadato)
 *
 * Los valores NO se duplican aquí. Se leen directamente de los XLS/XLSX.
 */

const TEMAS_CONFIG = {
  al25: {
    nombre: "25 al 25",
    titulo: "Indicadores 25 al 25",
    descripcion: "Indicadores del Sistema Nacional de Información relacionados con los derechos de niñas, niños y adolescentes.",
    colorPrincipal: "#154f39",
    colorSecundario: "#4f8c70",
    imagen: "images/25al25.png"
  },

  participacion: {
    nombre: "Participación",
    titulo: "Indicadores de Participación",
    descripcion: "Indicadores relacionados con la participación, acceso a la información, cultura, deporte y tecnologías de niñas, niños y adolescentes.",
    colorPrincipal: "#6f35a5",
    colorSecundario: "#9c27b0",
    imagen: "images/participacion.png"
  },

  proteccion: {
    nombre: "Protección",
    titulo: "Indicadores de Protección",
    descripcion: "Indicadores relacionados con protección integral, asistencia social, justicia para adolescentes, trabajo infantil, violencia y maltrato.",
    colorPrincipal: "#a4163d",
    colorSecundario: "#72122a",
    imagen: "images/proteccion.png"
  },

  demografico: {
    nombre: "Demográfico",
    titulo: "Indicadores Demográficos",
    descripcion: "Indicadores sobre las características poblacionales de niñas, niños y adolescentes.",
    colorPrincipal: "#0d6efd",
    colorSecundario: "#6610f2",
    imagen: "images/demografico.png"
  },

  desarrollo: {
    nombre: "Desarrollo",
    titulo: "Indicadores de Desarrollo",
    descripcion: "Indicadores relacionados con educación, desarrollo y condiciones socioeconómicas.",
    colorPrincipal: "#17a2b8",
    colorSecundario: "#20c997",
    imagen: "images/desarrollo.png"
  },

  supervivencia: {
    nombre: "Supervivencia",
    titulo: "Indicadores de Supervivencia",
    descripcion: "Indicadores relacionados con mortalidad, nacimientos y condiciones de supervivencia.",
    colorPrincipal: "#fd7e14",
    colorSecundario: "#e83e4a",
    imagen: "images/supervivencia.png"
  }
};

const CONFIG_DATOS = "datos-indicadores/catalogo.json";

/* SheetJS: lectura de XLS y XLSX directamente en el navegador. */
const XLSX_LIB_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

/*
 * Paleta institucional del visor. Se mantiene separada del color del tema
 * para que las gráficas tengan una lectura consistente.
 */
const PALETA_GRAFICAS = [
  "#6f35a5",
  "#70ad47",
  "#f4b400",
  "#e83e8c",
  "#4f8c70",
  "#4c78a8"
];
