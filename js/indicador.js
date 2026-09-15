/* ============================================================
   VISOR ÚNICO DE INDICADORES INEGI
   - Un solo HTML para todos los temas e indicadores.
   - Lee directamente T_*.XLS/XLSX y M_*.XLSX.
   - No depende de JSON con datos duplicados.
   - Detecta automáticamente las hojas "Gráfica" del Excel.
   ============================================================ */

let catalogoCache = null;
let workbookCache = new Map();
let metadataCache = new Map();
let graficaActual = null;
let indicadorActual = null;
let temaActual = null;
let vistaGraficaActual = null;

const PARAM_TEMA = "tema";
const PARAM_INDICADOR = "indicador";

/* ---------- Utilidades generales ---------- */

function qs(id) {
  return document.getElementById(id);
}

function escaparHTML(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function esNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor !== "string") return false;
  const limpio = valor.replace(/,/g, "").trim();
  return limpio !== "" && Number.isFinite(Number(limpio));
}

function numero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatearNumero(valor) {
  const n = numero(valor);
  if (n === null) return "N/D";

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2
  }).format(n);
}

function formatearValorTabla(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  return esNumero(valor) ? formatearNumero(valor) : escaparHTML(valor);
}

function ordenarAnios(a, b) {
  const na = numero(a);
  const nb = numero(b);
  if (na !== null && nb !== null) return na - nb;
  return String(a).localeCompare(String(b), "es", { numeric: true });
}

function esEntidadNacional(valor) {
  const n = normalizarTexto(valor);
  return n === "nacional" || n.includes("nacional");
}

function esQuintanaRoo(valor) {
  return normalizarTexto(valor).includes("quintana roo");
}

function limpiarNombreHoja(nombre) {
  const original = String(nombre || "").trim();
  const n = normalizarTexto(original);

  if (n.includes("estatal") || n.includes("quintana roo")) return "Quintana Roo";
  if (n.includes("nacional")) return "Nacional";
  if (n.includes("ciudad")) return "Ciudades";
  if (n.includes("ninas y ninos")) return "Niñas y niños";
  if (n.includes("adolescentes")) return "Adolescentes";

  return original
    .replace(/^gráfica[_\s-]*/i, "")
    .replace(/^grafica[_\s-]*/i, "")
    .replace(/_/g, " ")
    .trim() || "Vista";
}

/* ---------- Catálogo ---------- */

async function cargarCatalogo() {
  if (catalogoCache) return catalogoCache;

  const respuesta = await fetch(CONFIG_DATOS, { cache: "no-cache" });
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar el catálogo (${respuesta.status}).`);
  }

  catalogoCache = await respuesta.json();
  return catalogoCache;
}

function obtenerIndicadoresTema(tema) {
  if (!catalogoCache?.indicadores) return [];
  return catalogoCache.indicadores
    .filter(ind => ind.tema === tema)
    .sort((a, b) => compararIds(a.id, b.id));
}

function compararIds(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number.isFinite(pa[i]) ? pa[i] : 0;
    const y = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function obtenerIndicador(id, tema) {
  if (!catalogoCache?.indicadores) return null;
  return catalogoCache.indicadores.find(ind =>
    String(ind.id) === String(id) && (!tema || ind.tema === tema)
  ) || null;
}

/* ---------- Rutas de archivos ---------- */

function rutaArchivo(indicador, campo) {
  const ruta = indicador?.[campo];
  if (!ruta) return null;

  /* encodeURI conserva la estructura de carpetas y codifica espacios. */
  return encodeURI(ruta);
}

/* ---------- Lectura de XLS/XLSX ---------- */

async function cargarWorkbook(ruta) {
  if (!ruta) throw new Error("El indicador no tiene archivo de datos configurado.");
  if (workbookCache.has(ruta)) return workbookCache.get(ruta);

  if (typeof XLSX === "undefined") {
    throw new Error("No se encontró la librería SheetJS para leer Excel.");
  }

  const respuesta = await fetch(ruta, { cache: "no-cache" });
  if (!respuesta.ok) {
    throw new Error(`No se pudo abrir el archivo Excel: ${ruta}`);
  }

  const buffer = await respuesta.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellNF: false,
    cellStyles: false
  });

  workbookCache.set(ruta, workbook);
  return workbook;
}

function hojaAMatriz(workbook, nombreHoja) {
  const ws = workbook.Sheets[nombreHoja];
  if (!ws) return [];

  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false
  });
}

function filasNoVacias(matriz) {
  return matriz
    .map((fila, indice) => ({
      indice,
      fila: fila || []
    }))
    .filter(item => item.fila.some(valor => valor !== null && valor !== undefined && String(valor).trim() !== ""));
}

function primeraColumnaUtil(fila) {
  if (!Array.isArray(fila)) return null;
  for (const valor of fila) {
    if (valor !== null && valor !== undefined && String(valor).trim() !== "") return valor;
  }
  return null;
}

function compactarFila(fila) {
  if (!Array.isArray(fila)) return [];
  let inicio = 0;
  while (inicio < fila.length && (fila[inicio] === null || fila[inicio] === undefined || String(fila[inicio]).trim() === "")) inicio++;
  return fila.slice(inicio);
}

function indicePrimero(fila, predicado) {
  return fila.findIndex(predicado);
}

/* ---------- Metadatos ---------- */

async function cargarMetadatos(indicador) {
  const ruta = rutaArchivo(indicador, "archivoMetadato");
  if (!ruta) return {};
  if (metadataCache.has(ruta)) return metadataCache.get(ruta);

  const workbook = await cargarWorkbook(ruta);
  const nombreHoja = workbook.SheetNames[0];
  const matriz = hojaAMatriz(workbook, nombreHoja);
  const metadata = {};

  matriz.forEach(fila => {
    if (!fila || fila.length < 2) return;

    let clave = null;
    let valor = null;

    for (let i = 0; i < fila.length; i++) {
      const celda = fila[i];
      if (celda !== null && celda !== undefined && String(celda).trim() !== "") {
        if (clave === null) {
          clave = String(celda).trim().replace(/:$/, "");
        } else {
          valor = fila[i];
          break;
        }
      }
    }

    if (clave) metadata[normalizarTexto(clave)] = valor;
  });

  metadataCache.set(ruta, metadata);
  return metadata;
}

function metadataValor(meta, ...claves) {
  for (const clave of claves) {
    const valor = meta[normalizarTexto(clave)];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") return valor;
  }
  return "";
}

function pintarMetadatos(meta, indicador) {
  const contenedor = qs("metadatosContenido");
  if (!contenedor) return;

  const campos = [
    ["Nombre del indicador", metadataValor(meta, "Nombre del indicador") || indicador.nombre],
    ["Definición", metadataValor(meta, "Definición") || indicador.definicion],
    ["Algoritmo de cálculo", metadataValor(meta, "Algoritmo de cálculo")],
    ["Fuente", metadataValor(meta, "Fuente") || indicador.fuente],
    ["Unidad de medida", metadataValor(meta, "Unidad de medida") || indicador.unidad],
    ["Cobertura geográfica", metadataValor(meta, "Cobertura geográfica") || indicador.cobertura],
    ["Referencia temporal", metadataValor(meta, "Referencia temporal") || indicador.referencia],
    ["Tipo de estudio", metadataValor(meta, "Tipo de estudio")],
    ["Nota", metadataValor(meta, "Nota")]
  ];

  contenedor.innerHTML = campos
    .filter(([, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== "")
    .map(([etiqueta, valor]) => `
      <article class="metadato-item">
        <span>${escaparHTML(etiqueta)}</span>
        <p>${escaparHTML(valor).replace(/\n/g, "<br>")}</p>
      </article>
    `)
    .join("");

  qs("metadatosCard").hidden = false;
}

/* ---------- Identificación de hojas ---------- */

function obtenerHojasGrafica(workbook) {
  return workbook.SheetNames.filter(nombre => {
    const n = normalizarTexto(nombre);
    return n.includes("grafica") || n.includes("gráfica");
  });
}

function prioridadHojaGrafica(nombre) {
  const n = normalizarTexto(nombre);

  /* Preferimos la vista que explícitamente contiene Q. Roo o estatal. */
  if (n.includes("quintana roo")) return 100;
  if (n.includes("estatal") || n.includes("entidad")) return 90;
  if (n.includes("nac_qroo")) return 85;
  if (n.includes("nacional") && !n.includes("ent")) return 70;
  if (n === "grafica" || n === "gráfica") return 60;
  return 50;
}

function ordenarHojasGrafica(hojas) {
  return hojas.slice().sort((a, b) => prioridadHojaGrafica(b) - prioridadHojaGrafica(a));
}

/* ---------- Detección de estructura gráfica ---------- */

function buscarFilaCabecera(matriz, predicado) {
  const filas = filasNoVacias(matriz);
  for (const item of filas) {
    if (predicado(item.fila)) return item.indice;
  }
  return -1;
}

function construirVistaDesdeHoja(nombreHoja, matriz) {
  const filas = filasNoVacias(matriz);
  if (!filas.length) return null;

  const hojaNormalizada = normalizarTexto(nombreHoja);

  /* ----------------------------------------------------------
     Regla 1: hoja con columnas Nacional / Quintana Roo.
     Ejemplos: 1.1, 1.2, 1.14, 1.17, 3.2-3.5, 4.2, 5.3.
     ---------------------------------------------------------- */
  const idxNQ = buscarFilaCabecera(matriz, fila => {
    const valores = fila.map(v => normalizarTexto(v));
    return valores.includes("nacional") && valores.includes("quintana roo");
  });

  if (idxNQ >= 0) {
    const header = matriz[idxNQ];
    const iN = header.findIndex(v => normalizarTexto(v) === "nacional");
    const iQ = header.findIndex(v => normalizarTexto(v) === "quintana roo");
    const registros = [];

    for (let r = idxNQ + 1; r < matriz.length; r++) {
      const fila = matriz[r] || [];
      const n = numero(fila[iN]);
      const q = numero(fila[iQ]);
      if (n === null && q === null) continue;

      let etiqueta = null;
      for (let c = 0; c < Math.min(iN, iQ); c++) {
        const v = fila[c];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          etiqueta = v;
          break;
        }
      }

      if (etiqueta === null) etiqueta = registros.length + 1;
      registros.push({ etiqueta: String(etiqueta), nacional: n, qroo: q });
    }

    if (!registros.length) return null;

    const esTemporal = registros.every(r => esNumero(r.etiqueta));

    return {
      hoja: nombreHoja,
      tituloVista: limpiarNombreHoja(nombreHoja),
      modo: esTemporal ? "comparacion-temporal" : "comparacion-categorias",
      labels: registros.map(r => r.etiqueta),
      datasets: [
        { label: "Nacional", data: registros.map(r => r.nacional) },
        { label: "Quintana Roo", data: registros.map(r => r.qroo) }
      ],
      tabla: {
        columnas: ["Periodo / categoría", "Nacional", "Quintana Roo"],
        filas: registros.map(r => [r.etiqueta, r.nacional, r.qroo])
      }
    };
  }

  /* ----------------------------------------------------------
     Regla 2: hojas con "Sexo" + años.
     Ejemplo: Nacional / Quintana Roo + Total/Hombres/Mujeres.
     ---------------------------------------------------------- */
  const idxSexoAnios = buscarFilaCabecera(matriz, fila => {
    const vals = fila.map(v => normalizarTexto(v));
    const tieneSexo = vals.includes("sexo");
    const tieneAnio = fila.some(v => {
      const n = numero(v);
      return n !== null && n >= 1900 && n <= 2100;
    });
    return tieneSexo && tieneAnio;
  });

  if (idxSexoAnios >= 0) {
    const header = matriz[idxSexoAnios];
    const indicesAnio = header
      .map((v, i) => ({ v, i }))
      .filter(x => {
        const n = numero(x.v);
        return n !== null && n >= 1900 && n <= 2100;
      })
      .map(x => x.i);

    const categorias = [];
    const filasDatos = [];
    let entidadActual = null;

    for (let r = idxSexoAnios + 1; r < matriz.length; r++) {
      const fila = matriz[r] || [];
      const textoEntidad = fila.find(v => esEntidadNacional(v) || esQuintanaRoo(v));
      if (textoEntidad) entidadActual = String(textoEntidad).trim();

      let categoria = null;
      for (const v of fila) {
        const n = normalizarTexto(v);
        if (n === "total" || n === "hombres" || n === "mujeres") {
          categoria = String(v).trim();
          break;
        }
      }
      if (!categoria) continue;

      const valores = indicesAnio.map(i => numero(fila[i]));
      if (!valores.some(v => v !== null)) continue;

      filasDatos.push({
        entidad: entidadActual || inferirEntidadDesdeHoja(hojaNormalizada),
        categoria,
        valores
      });

      if (!categorias.some(c => normalizarTexto(c) === normalizarTexto(categoria))) {
        categorias.push(categoria);
      }
    }

    if (filasDatos.length) {
      const entidadesOrden = [];
      filasDatos.forEach(r => {
        if (r.entidad && !entidadesOrden.includes(r.entidad)) entidadesOrden.push(r.entidad);
      });

      const labels = [];
      const datasets = categorias.map(c => ({ label: c, data: [] }));

      /* Se organiza entidad -> año, para conservar la lectura del Excel. */
      const anios = indicesAnio.map(i => String(header[i]));
      for (const entidad of entidadesOrden) {
        for (let ai = 0; ai < anios.length; ai++) {
          const etiqueta = entidad ? `${entidad} ${anios[ai]}` : anios[ai];
          labels.push(etiqueta);
          categorias.forEach((categoria, ci) => {
            const registro = filasDatos.find(r =>
              r.entidad === entidad && normalizarTexto(r.categoria) === normalizarTexto(categoria)
            );
            datasets[ci].data.push(registro ? registro.valores[ai] : null);
          });
        }
      }

      const tablaFilas = [];
      for (let i = 0; i < labels.length; i++) {
        tablaFilas.push([labels[i], ...datasets.map(d => d.data[i])]);
      }

      return {
        hoja: nombreHoja,
        tituloVista: limpiarNombreHoja(nombreHoja),
        modo: "sexo-temporal",
        labels,
        datasets,
        tabla: {
          columnas: ["Entidad / año", ...categorias],
          filas: tablaFilas
        }
      };
    }
  }

  /* ----------------------------------------------------------
     Regla 3: series con años + categorías/rangos.
     Aquí entran estructuras como:
       Entidad | 2017 | ... | 2019 | ...
       Año     | categoría 1 | categoría 2 | ...
       Entidad | Año | categoría 1 | categoría 2 | ...
       Año     | categoría 1 | categoría 2 | ...
     ---------------------------------------------------------- */

  const candidatoSeries = filas.find(item => {
    const f = item.fila;
    const tienePalabraAnio = f.some(v => { const n = normalizarTexto(v); return n === "ano" || n === "año" || n.includes("anos") || n.includes("años"); });
    const tieneAnioNumerico = f.some(v => {
      const n = numero(v);
      return n !== null && n >= 1900 && n <= 2100;
    });
    return tienePalabraAnio || tieneAnioNumerico;
  });

  if (candidatoSeries) {
    const idxHeader = candidatoSeries.indice;
    const header = matriz[idxHeader] || [];
    const nextRow = matriz[idxHeader + 1] || [];

    const indicesAnioHeader = header
      .map((v, i) => ({ v, i }))
      .filter(x => {
        const n = numero(x.v);
        return n !== null && n >= 1900 && n <= 2100;
      });

    const idxPalabraAnio = header.findIndex(v => {
      const n = normalizarTexto(v);
      return n === "ano" || n === "año" || n.includes("anos") || n.includes("años");
    });

    /* Caso A: la cabecera ya contiene los años. 1.5 utiliza años agrupados
       y la siguiente fila contiene las categorías de cada año. */
    if (indicesAnioHeader.length >= 1) {
      const aniosHeader = indicesAnioHeader.map(x => ({ anio: String(x.v), indice: x.i }));
      const categoriasPorPosicion = nextRow;
      const primeraFilaDatos = matriz[idxHeader + 2] || [];

      /* Si debajo de cada año hay categorías, construimos el esquema
         según las posiciones reales de las celdas. */
      const categorias = [];
      for (let c = 0; c < Math.max(header.length, nextRow.length); c++) {
        const categoria = nextRow[c];
        if (categoria !== null && categoria !== undefined && String(categoria).trim() !== "") {
          categorias.push({ indice: c, nombre: String(categoria).trim() });
        }
      }

      const registros = [];
      let entidadActual = inferirEntidadDesdeHoja(hojaNormalizada);

      for (let r = idxHeader + 2; r < matriz.length; r++) {
        const fila = matriz[r] || [];
        const entidadCelda = fila.find(v => esEntidadNacional(v) || esQuintanaRoo(v));
        if (entidadCelda) entidadActual = String(entidadCelda).trim();

        /* Una fila válida debe tener varios valores numéricos. */
        const numerosFila = fila.map((v, i) => ({ v: numero(v), i })).filter(x => x.v !== null);
        if (numerosFila.length < 2) continue;

        for (let ai = 0; ai < aniosHeader.length; ai++) {
          const inicio = aniosHeader[ai].indice;
          const fin = ai + 1 < aniosHeader.length ? aniosHeader[ai + 1].indice : fila.length;
          const candidatos = [];

          for (let c = inicio; c < fin; c++) {
            const v = numero(fila[c]);
            if (v !== null) candidatos.push({ indice: c, valor: v });
          }

          if (!candidatos.length) continue;

          const valores = [];
          for (let c = inicio; c < fin; c++) {
            const v = numero(fila[c]);
            if (v !== null) valores.push(v);
          }

          const nombres = categorias
            .filter(c => c.indice >= inicio && c.indice < fin)
            .map(c => c.nombre);

          if (!nombres.length) {
            /* Año + N/Q sin categorías ya fue tratado en Regla 1. */
            continue;
          }

          registros.push({ entidad: entidadActual, anio: aniosHeader[ai].anio, nombres, valores });
        }
      }

      if (registros.length) {
        const nombresSeries = [];
        registros.forEach(r => r.nombres.forEach(n => {
          if (!nombresSeries.includes(n)) nombresSeries.push(n);
        }));

        const labels = [];
        const datasets = nombresSeries.map(n => ({ label: n, data: [] }));

        registros.forEach(r => {
          labels.push(r.entidad ? `${r.entidad} ${r.anio}` : r.anio);
          nombresSeries.forEach(dsName => {
            const pos = r.nombres.indexOf(dsName);
            datasets.find(d => d.label === dsName).data.push(pos >= 0 ? r.valores[pos] : null);
          });
        });

        return {
          hoja: nombreHoja,
          tituloVista: limpiarNombreHoja(nombreHoja),
          modo: "temporal-categorias",
          labels,
          datasets,
          tabla: {
            columnas: ["Entidad / año", ...nombresSeries],
            filas: labels.map((label, i) => [label, ...datasets.map(d => d.data[i])])
          }
        };
      }
    }

    /* Caso B: la cabecera dice Año y las categorías están en esa misma fila. */
    if (idxPalabraAnio >= 0) {
      const nombresSeries = header
        .slice(idxPalabraAnio + 1)
        .filter(v => v !== null && v !== undefined && String(v).trim() !== "")
        .map(v => String(v).trim());

      const registros = [];
      const entidadHoja = inferirEntidadDesdeHoja(hojaNormalizada);

      for (let r = idxHeader + 1; r < matriz.length; r++) {
        const fila = matriz[r] || [];
        const idxAnio = fila.findIndex(v => {
          const n = numero(v);
          return n !== null && n >= 1900 && n <= 2100;
        });
        if (idxAnio < 0) continue;

        const valores = fila.slice(idxAnio + 1).map(numero);
        if (!valores.some(v => v !== null)) continue;

        let entidad = fila.find(v => esEntidadNacional(v) || esQuintanaRoo(v));
        if (!entidad) entidad = entidadHoja;

        registros.push({
          entidad: entidad ? String(entidad).trim() : "",
          anio: String(fila[idxAnio]),
          valores
        });
      }

      if (registros.length && nombresSeries.length) {
        const labels = registros.map(r => r.entidad ? `${r.entidad} ${r.anio}` : r.anio);
        const datasets = nombresSeries.map((nombre, i) => ({
          label: nombre,
          data: registros.map(r => r.valores[i] ?? null)
        }));

        return {
          hoja: nombreHoja,
          tituloVista: limpiarNombreHoja(nombreHoja),
          modo: "temporal-categorias",
          labels,
          datasets,
          tabla: {
            columnas: ["Entidad / año", ...nombresSeries],
            filas: labels.map((label, i) => [label, ...datasets.map(d => d.data[i])])
          }
        };
      }
    }

    /* Caso C: hoja con categorías en cabecera y año en los datos.
       Ejemplo: Gráfica de 4.8. */
    if (header.some(v => normalizarTexto(v).includes("anos")) || header.filter(v => v !== null && v !== undefined && String(v).trim() !== "").length >= 2) {
      const nombresSeries = header
        .filter((v, i) => i > 0 && v !== null && v !== undefined && String(v).trim() !== "")
        .map(v => String(v).trim());

      const registros = [];
      const entidadHoja = inferirEntidadDesdeHoja(hojaNormalizada);

      for (let r = idxHeader + 1; r < matriz.length; r++) {
        const fila = matriz[r] || [];
        const idxAnio = fila.findIndex(v => {
          const n = numero(v);
          return n !== null && n >= 1900 && n <= 2100;
        });
        if (idxAnio < 0) continue;

        const valores = fila.slice(idxAnio + 1).map(numero);
        if (!valores.some(v => v !== null)) continue;

        let entidad = fila.find(v => esEntidadNacional(v) || esQuintanaRoo(v));
        if (!entidad) entidad = entidadHoja;

        registros.push({ entidad: entidad ? String(entidad).trim() : "", anio: String(fila[idxAnio]), valores });
      }

      if (registros.length && nombresSeries.length) {
        const labels = registros.map(r => r.entidad ? `${r.entidad} ${r.anio}` : r.anio);
        const datasets = nombresSeries.map((nombre, i) => ({
          label: nombre,
          data: registros.map(r => r.valores[i] ?? null)
        }));

        return {
          hoja: nombreHoja,
          tituloVista: limpiarNombreHoja(nombreHoja),
          modo: "temporal-categorias",
          labels,
          datasets,
          tabla: {
            columnas: ["Entidad / año", ...nombresSeries],
            filas: labels.map((label, i) => [label, ...datasets.map(d => d.data[i])])
          }
        };
      }
    }
  }

  /* ----------------------------------------------------------
     Regla 4: Total/Hombres/Mujeres sin años en la cabecera.
     Ejemplos: 4.20 y varias gráficas por entidad.
     ---------------------------------------------------------- */
  const idxSexo = buscarFilaCabecera(matriz, fila => {
    const vals = fila.map(v => normalizarTexto(v));
    return vals.includes("total") && vals.includes("hombres") && vals.includes("mujeres");
  });

  if (idxSexo >= 0) {
    const header = matriz[idxSexo];
    const indices = {
      total: header.findIndex(v => normalizarTexto(v) === "total"),
      hombres: header.findIndex(v => normalizarTexto(v) === "hombres"),
      mujeres: header.findIndex(v => normalizarTexto(v) === "mujeres")
    };

    const registros = [];
    const entidadHoja = inferirEntidadDesdeHoja(hojaNormalizada);

    for (let r = idxSexo + 1; r < matriz.length; r++) {
      const fila = matriz[r] || [];
      const vals = {
        total: numero(fila[indices.total]),
        hombres: numero(fila[indices.hombres]),
        mujeres: numero(fila[indices.mujeres])
      };

      if (vals.total === null && vals.hombres === null && vals.mujeres === null) continue;

      let contexto = null;
      for (let c = 0; c < Math.min(...Object.values(indices).filter(i => i >= 0)); c++) {
        const v = fila[c];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          contexto = String(v).trim();
          break;
        }
      }

      const posibleAnio = fila.find(v => {
        const n = numero(v);
        return n !== null && n >= 1900 && n <= 2100;
      });

      const etiqueta = posibleAnio !== undefined
        ? String(posibleAnio)
        : (contexto || String(registros.length + 1));

      registros.push({
        etiqueta: entidadHoja ? `${entidadHoja} ${etiqueta}`.trim() : etiqueta,
        total: vals.total,
        hombres: vals.hombres,
        mujeres: vals.mujeres
      });
    }

    if (registros.length) {
      return {
        hoja: nombreHoja,
        tituloVista: limpiarNombreHoja(nombreHoja),
        modo: "categorias-sexo",
        labels: registros.map(r => r.etiqueta),
        datasets: [
          { label: "Total", data: registros.map(r => r.total) },
          { label: "Hombres", data: registros.map(r => r.hombres) },
          { label: "Mujeres", data: registros.map(r => r.mujeres) }
        ],
        tabla: {
          columnas: ["Entidad / periodo", "Total", "Hombres", "Mujeres"],
          filas: registros.map(r => [r.etiqueta, r.total, r.hombres, r.mujeres])
        }
      };
    }
  }

  return null;
}

function inferirEntidadDesdeHoja(hojaNormalizada) {
  if (hojaNormalizada.includes("quintana roo") || hojaNormalizada.includes("estatal")) return "Quintana Roo";
  if (hojaNormalizada.includes("nacional")) return "Nacional";
  return "";
}

/* ---------- Selección de la vista correcta ---------- */

async function construirVistasWorkbook(workbook) {
  const hojas = ordenarHojasGrafica(obtenerHojasGrafica(workbook));
  const vistas = [];

  for (const nombreHoja of hojas) {
    const matriz = hojaAMatriz(workbook, nombreHoja);
    const vista = construirVistaDesdeHoja(nombreHoja, matriz);
    if (vista) vistas.push(vista);
  }

  return vistas;
}

function elegirVistaPrincipal(vistas) {
  if (!vistas.length) return null;

  const qroo = vistas.find(v =>
    v.tabla?.filas?.some(f => f.some(c => esQuintanaRoo(c)))
  );
  if (qroo) return qroo;

  const estatal = vistas.find(v => normalizarTexto(v.hoja).includes("estatal"));
  if (estatal) return estatal;

  return vistas[0];
}

/* ---------- Gráficas Chart.js ---------- */

function destruirGrafica() {
  if (graficaActual) {
    graficaActual.destroy();
    graficaActual = null;
  }
}

function coloresDataset(index) {
  const color = PALETA_GRAFICAS[index % PALETA_GRAFICAS.length];
  return {
    backgroundColor: color,
    borderColor: color
  };
}

function tipoChartParaVista(vista) {
  /* Las hojas "Gráfica" de los Excel suministrados son gráficas de barras. */
  if (vista?.modo === "comparacion-temporal" || vista?.modo === "comparacion-categorias") return "bar";
  if (vista?.modo === "temporal-sexo" || vista?.modo === "entidad-categorias") return "bar";
  return "bar";
}

function construirGrafica(vista, indicador) {
  destruirGrafica();

  const canvas = qs("graficaIndicador");
  if (!canvas || !vista) return;

  const ctx = canvas.getContext("2d");
  const tipo = tipoChartParaVista(vista);
  const unidad = indicador.unidad || "";

  const datasets = vista.datasets.map((ds, index) => ({
    ...ds,
    ...coloresDataset(index),
    borderWidth: 1,
    borderRadius: 5,
    maxBarThickness: 70
  }));

  graficaActual = new Chart(ctx, {
    type: tipo,
    data: {
      labels: vista.labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 450
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            padding: 18,
            font: { family: "Montserrat", weight: "600" }
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatearNumero(context.raw)}${unidad ? ` ${unidad.toLowerCase()}` : ""}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 0,
            font: { family: "Montserrat" }
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { family: "Montserrat" },
            callback: value => formatearNumero(value)
          }
        }
      }
    }
  });

  qs("tituloGrafica").textContent = indicador.nombre || "Gráfica del indicador";
  qs("tipoVisualizacion").textContent = `Barras · ${vista.tituloVista}`;
}

/* ---------- Pestañas de hojas de gráfica ---------- */

function construirTabsGraficas(vistas, vistaSeleccionada) {
  const contenedor = qs("tabsGraficas");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  if (vistas.length <= 1) {
    contenedor.hidden = true;
    return;
  }

  contenedor.hidden = false;

  vistas.forEach((vista, index) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "tab-grafica" + (vista === vistaSeleccionada ? " active" : "");
    boton.textContent = vista.tituloVista || `Vista ${index + 1}`;
    boton.title = vista.hoja;

    boton.addEventListener("click", () => {
      vistaGraficaActual = vista;
      contenedor.querySelectorAll(".tab-grafica").forEach(b => b.classList.remove("active"));
      boton.classList.add("active");
      construirGrafica(vista, indicadorActual);
      construirTablaVista(vista, indicadorActual);
    });

    contenedor.appendChild(boton);
  });
}

/* ---------- Tabla: únicamente datos relevantes ---------- */

function filaContieneQroo(fila) {
  return fila.some(c => esQuintanaRoo(c));
}

function filaContieneNacional(fila) {
  return fila.some(c => esEntidadNacional(c));
}

function construirTablaVista(vista, indicador) {
  const contenedor = qs("tablaIndicador");
  if (!contenedor || !vista?.tabla) return;

  let filas = vista.tabla.filas || [];

  /*
   * Regla institucional del visor:
   * - Si el Excel tiene Nacional y Q. Roo, mostramos ambos.
   * - Si es una vista estatal/Q. Roo, mostramos sus registros.
   * - Si es municipal, mostramos los municipios de Q. Roo.
   * No mostramos las 32 entidades en el visor principal.
   */
  const hayNacional = filas.some(filaContieneNacional);
  const hayQroo = filas.some(filaContieneQroo);

  if (hayNacional || hayQroo) {
    const relevantes = filas.filter(fila => filaContieneNacional(fila) || filaContieneQroo(fila));
    if (relevantes.length) filas = relevantes;
  }

  /* Cuando la vista es explícitamente estatal y no trae el texto Quintana Roo,
     se mantiene porque "Estatal" representa Q. Roo en estos archivos. */
  const esEstatal = normalizarTexto(vista.hoja).includes("estatal") || normalizarTexto(vista.hoja).includes("quintana roo");
  if (!hayNacional && !hayQroo && esEstatal) {
    filas = vista.tabla.filas || [];
  }

  const columnas = vista.tabla.columnas || [];

  let html = `
    <div class="table-responsive tabla-scroll">
      <table class="table table-bordered table-hover align-middle text-center tabla-datos">
        <thead><tr>
          ${columnas.map(c => `<th>${escaparHTML(c)}</th>`).join("")}
        </tr></thead>
        <tbody>
          ${filas.map(fila => `
            <tr>
              ${fila.map((valor, indice) => `
                <td class="${indice === 0 ? "dato-contexto" : ""}">${formatearValorTabla(valor)}</td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  if (!filas.length) {
    html = `<div class="alert alert-info">El Excel no contiene registros Nacional/Quintana Roo en esta vista. Consulta la gráfica para visualizar la información disponible.</div>`;
  }

  contenedor.innerHTML = html;
  qs("origenTabla").textContent = `Excel · hoja ${vista.hoja}`;

  if (esEstatal && !hayNacional && !hayQroo) {
    qs("tituloTabla").textContent = "Datos de Quintana Roo";
  } else if (filas.some(fila => fila.some(esQuintanaRoo))) {
    qs("tituloTabla").textContent = "Datos de Quintana Roo y Nacional";
  } else {
    qs("tituloTabla").textContent = "Datos del indicador";
  }
}

/* ---------- Tarjetas resumen ---------- */

function obtenerValoresNumericos(vista) {
  return (vista?.datasets || []).flatMap(ds => ds.data || []).map(numero).filter(v => v !== null);
}

function construirCardsResumen(indicador, vista, meta) {
  const contenedor = qs("cardsResumen");
  if (!contenedor) return;

  const valores = obtenerValoresNumericos(vista);
  const años = (indicador.years || []).slice().sort(ordenarAnios);
  const fuente = metadataValor(meta, "Fuente") || indicador.fuente || "INEGI";
  const unidad = metadataValor(meta, "Unidad de medida") || indicador.unidad || "N/D";

  const minimo = valores.length ? Math.min(...valores) : null;
  const maximo = valores.length ? Math.max(...valores) : null;

  contenedor.innerHTML = `
    <article class="card-resumen">
      <span>Unidad de medida</span>
      <strong>${escaparHTML(unidad)}</strong>
    </article>
    <article class="card-resumen qroo">
      <span>Fuente</span>
      <strong>${escaparHTML(resumirFuente(fuente))}</strong>
    </article>
    <article class="card-resumen variacion">
      <span>Periodo disponible</span>
      <strong>${años.length ? `${escaparHTML(años[0])}${años.length > 1 ? ` – ${escaparHTML(años[años.length - 1])}` : ""}` : "N/D"}</strong>
    </article>
    <article class="card-resumen">
      <span>Valores visualizados</span>
      <strong>${formatearNumero(valores.length)}</strong>
    </article>
    ${valores.length ? `
      <article class="card-resumen">
        <span>Rango de valores</span>
        <strong>${formatearNumero(minimo)} – ${formatearNumero(maximo)}</strong>
      </article>
    ` : ""}
  `;
}

function resumirFuente(texto) {
  const s = String(texto || "N/D").replace(/\s+/g, " ").trim();
  return s.length > 42 ? `${s.slice(0, 42)}…` : s;
}

/* ---------- Encabezado / tema ---------- */

function aplicarTema(tema) {
  const config = TEMAS_CONFIG[tema] || TEMAS_CONFIG.al25;
  document.documentElement.style.setProperty("--color-principal", config.colorPrincipal);
  document.documentElement.style.setProperty("--color-secundario", config.colorSecundario || config.colorPrincipal);

  qs("visorFuente").textContent = "INEGI";
  qs("visorTitulo").textContent = config.titulo || "Indicadores";
  qs("visorDescripcion").textContent = config.descripcion || "";

  const logo = qs("visorLogo");
  if (logo && config.imagen) {
    logo.src = config.imagen;
    logo.alt = config.nombre || "Indicadores";
  }

  const volver = qs("btnVolverListado");
  if (volver) volver.href = `listado.html?tema=${encodeURIComponent(tema)}`;
}

function pintarEncabezadoIndicador(indicador) {
  qs("indicadorClave").textContent = `Indicador ${indicador.id}`;
  qs("indicadorNombre").textContent = indicador.nombre || "Indicador";
  qs("indicadorDescripcion").textContent = indicador.definicion || "Consulta la ficha técnica del indicador.";

  const excel = qs("btnDescargarExcel");
  const meta = qs("btnDescargarMetadatos");

  if (excel) {
    const ruta = rutaArchivo(indicador, "archivoExcel");
    if (ruta) {
      excel.href = ruta;
      excel.style.display = "inline-flex";
    } else {
      excel.style.display = "none";
    }
  }

  if (meta) {
    const ruta = rutaArchivo(indicador, "archivoMetadato");
    if (ruta) {
      meta.href = ruta;
      meta.style.display = "inline-flex";
    } else {
      meta.style.display = "none";
    }
  }
}

/* ---------- Tab Bar horizontal ---------- */

function construirTabs(indicadores, tema, actualId) {
  const contenedor = qs("tabsIndicadores");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  indicadores.forEach(ind => {
    const boton = document.createElement("a");
    boton.href = `indicador.html?tema=${encodeURIComponent(tema)}&indicador=${encodeURIComponent(ind.id)}`;
    boton.className = "tab-btn" + (String(ind.id) === String(actualId) ? " active" : "");
    boton.setAttribute("aria-current", String(ind.id) === String(actualId) ? "page" : "false");
    boton.title = ind.nombre || `Indicador ${ind.id}`;

    boton.innerHTML = `
      <span class="tab-num">${escaparHTML(ind.id)}</span>
      <span class="tab-text">${escaparHTML(ind.nombre || `Indicador ${ind.id}`)}</span>
    `;

    boton.addEventListener("click", evento => {
      evento.preventDefault();
      const id = ind.id;
      window.history.pushState({}, "", boton.href);
      cargarIndicadorDetallado(tema, id);
    });

    contenedor.appendChild(boton);
  });
}

/* ---------- Estados ---------- */

function mostrarEstado(mensaje, tipo = "info") {
  const estado = qs("estadoCarga");
  if (!estado) return;

  if (!mensaje) {
    estado.hidden = true;
    estado.textContent = "";
    estado.className = "estado-carga";
    return;
  }

  estado.hidden = false;
  estado.textContent = mensaje;
  estado.className = `estado-carga estado-${tipo}`;
}

function limpiarContenido() {
  destruirGrafica();
  qs("cardsResumen").innerHTML = "";
  qs("tablaIndicador").innerHTML = "";
  qs("metadatosCard").hidden = true;
  qs("tabsGraficas").hidden = true;
}

function mostrarError(mensaje) {
  limpiarContenido();
  mostrarEstado(mensaje, "error");
  qs("tablaIndicador").innerHTML = `
    <div class="alert alert-danger">
      <strong>No fue posible cargar el indicador.</strong><br>
      ${escaparHTML(mensaje)}
    </div>
  `;
}

function mostrarPlaceholderData(indicador, tema) {
  limpiarContenido();

  const config = TEMAS_CONFIG[tema] || TEMAS_CONFIG.al25;
  document.documentElement.style.setProperty("--color-principal", config.colorPrincipal);
  document.documentElement.style.setProperty("--color-secundario", config.colorSecundario || config.colorPrincipal);

  const excelBtn = qs("btnDescargarExcel");
  const metaBtn = qs("btnDescargarMetadatos");
  if (excelBtn) excelBtn.style.display = "none";
  if (metaBtn) metaBtn.style.display = "none";

  if (qs("tituloGrafica")) qs("tituloGrafica").textContent = "Datos no disponibles";
  if (qs("tituloTabla")) qs("tituloTabla").textContent = "Datos no disponibles";

  qs("tablaIndicador").innerHTML = `
    <div class="placeholder-container text-center">
      <div class="placeholder-icon" aria-hidden="true">&#9201;</div>
      <h3 class="text-muted mb-3">En construcción / Actualización</h3>
      <p class="text-secondary mb-2">
        El indicador <strong>${escaparHTML(indicador?.clave || indicador?.nombre || "seleccionado")}</strong>
        aún no tiene los archivos de datos configurados en el sistema.
      </p>
      <p class="text-muted">
        Estamos trabajando en la integración de la información. Vuelve pronto para consultar los datos completos.
      </p>
      <a href="listado.html" class="btn-institucional mt-3" style="max-width: 260px; margin: 20px auto;">
        Volver a indicadores
      </a>
    </div>
  `;

  mostrarEstado("", "");
}

function esErrorArchivoFaltante(error) {
  return error?.code === "FILE_NOT_FOUND" ||
    /no se pudo abrir el archivo/i.test(error?.message || "") ||
    /archivo de datos configurado/i.test(error?.message || "");
}

function esErrorSinDatos(error) {
  return /sin\s*hoja\s*de\s*gráfica|contiene una hoja/i.test(error?.message || "");
}

/* ---------- Carga principal ---------- */

async function cargarIndicadorDetallado(tema, indicadorId) {
  temaActual = tema;
  aplicarTema(tema);
  limpiarContenido();

  const config = TEMAS_CONFIG[tema] || {};

  if (config.sinDatos) {
    const indicadoresTema = obtenerIndicadoresTema(tema);
    construirTabs(indicadoresTema, tema, indicadorId);

    const indicador = obtenerIndicador(indicadorId, tema) ||
      { id: indicadorId, nombre: config.titulo };
    pintarEncabezadoIndicador(indicador);
    mostrarPlaceholderData(indicador, tema);
    return;
  }

  const indicadoresTema = obtenerIndicadoresTema(tema);
  construirTabs(indicadoresTema, tema, indicadorId);

  const indicador = obtenerIndicador(indicadorId, tema);
  if (!indicador) {
    mostrarError(`No se encontró el indicador ${indicadorId} dentro del tema ${tema}.`);
    return;
  }

  if (!rutaArchivo(indicador, "archivoExcel")) {
    pintarEncabezadoIndicador(indicador);
    mostrarPlaceholderData(indicador, tema);
    return;
  }

  indicadorActual = indicador;
  pintarEncabezadoIndicador(indicador);
  mostrarEstado("Leyendo archivo Excel y metadatos…");

  try {
    const rutaExcel = rutaArchivo(indicador, "archivoExcel");
    const rutaMeta = rutaArchivo(indicador, "archivoMetadato");

    if (!rutaExcel) throw new Error("El catálogo no tiene configurado el archivo T del indicador.");

    const [workbook, meta] = await Promise.all([
      cargarWorkbook(rutaExcel),
      rutaMeta ? cargarMetadatos(indicador) : Promise.resolve({})
    ]);

    /* Validación adicional: el título del Excel debe corresponder al indicador. */
    validarCorrespondencia(indicador, workbook, meta);

    const vistas = await construirVistasWorkbook(workbook);

    if (!vistas.length) {
      throw new Error("El Excel no contiene una hoja de gráfica reconocible. Revisa las hojas cuyo nombre comienza con Gráfica.");
    }

    const vistaPrincipal = elegirVistaPrincipal(vistas);
    vistaGraficaActual = vistaPrincipal;

    construirTabsGraficas(vistas, vistaPrincipal);
    construirGrafica(vistaPrincipal, indicador);
    construirTablaVista(vistaPrincipal, indicador);
    construirCardsResumen(indicador, vistaPrincipal, meta);

    pintarMetadatos(meta, indicador);

    mostrarEstado("");
  } catch (error) {
    console.error("Visor INEGI:", error);

    if (esErrorArchivoFaltante(error) || esErrorSinDatos(error)) {
      mostrarPlaceholderData(indicador, tema);
      return;
    }

    mostrarError(error.message || "Error desconocido al leer el indicador.");
  }
}

function validarCorrespondencia(indicador, workbook, meta) {
  const nombreMeta = metadataValor(meta, "Nombre del indicador");
  if (nombreMeta && normalizarTexto(nombreMeta) !== normalizarTexto(indicador.nombre)) {
    console.warn("El nombre del metadato no coincide exactamente con el catálogo:", nombreMeta, indicador.nombre);
  }

  const primeraHoja = workbook.SheetNames[0];
  const matriz = hojaAMatriz(workbook, primeraHoja);
  const textoInicial = filasNoVacias(matriz).slice(0, 3).map(x => x.fila.join(" ")).join(" ");

  if (textoInicial && !normalizarTexto(textoInicial).includes(normalizarTexto(indicador.nombre).slice(0, 30))) {
    console.warn("La hoja principal del Excel no coincide claramente con el nombre del catálogo:", indicador.nombre, primeraHoja);
  }
}

/* ---------- Inicialización ---------- */

async function inicializarVisor() {
  const params = new URLSearchParams(window.location.search);
  const tema = params.get(PARAM_TEMA);
  const indicadorId = params.get(PARAM_INDICADOR);

  if (!tema) {
    window.location.href = "index.html";
    return;
  }

  const configTema = TEMAS_CONFIG[tema];

  /* Temas sin datos → página de placeholder dedicada */
  if (configTema?.sinDatos) {
    window.location.replace(`placeholder.html?tema=${encodeURIComponent(tema)}`);
    return;
  }

  if (!TEMAS_CONFIG[tema]) {
    aplicarTema("al25");
    mostrarError(`Tema no reconocido: ${tema}`);
    return;
  }

  try {
    await cargarCatalogo();

    const indicadores = obtenerIndicadoresTema(tema);
    if (!indicadores.length) {
      aplicarTema(tema);
      mostrarError(`El tema ${tema} todavía no tiene indicadores registrados en el catálogo.`);
      return;
    }

    const idInicial = indicadorId || indicadores[0].id;

    if (!indicadorId) {
      window.history.replaceState(
        {},
        "",
        `indicador.html?tema=${encodeURIComponent(tema)}&indicador=${encodeURIComponent(idInicial)}`
      );
    }

    await cargarIndicadorDetallado(tema, idInicial);
  } catch (error) {
    console.error(error);
    mostrarError(error.message || "No fue posible iniciar el visor.");
  }
}

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  const tema = params.get(PARAM_TEMA);
  const indicadorId = params.get(PARAM_INDICADOR);
  if (tema && indicadorId) cargarIndicadorDetallado(tema, indicadorId);
});

document.addEventListener("DOMContentLoaded", () => {
  const cerrar = qs("btnCerrarMetadatos");
  if (cerrar) {
    cerrar.addEventListener("click", () => {
      qs("metadatosCard").hidden = true;
    });
  }
  inicializarVisor();
});
