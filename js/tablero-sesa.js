crearTablero({
    archivosReportes: ["datos/sesa/enero-2025.json"],
    selectores: {
        filtroMes: true,
        filtroMunicipio: true,
        selectorGrafica: true
    },
    idsCards: {
        totalEmbarazos: "totalEmbarazos",
        totalNacidosVivos: "totalNacidosVivos",
        totalMortalidadFetal: "totalMortalidadFetal",
        totalGeneral: "totalGeneral"
    },

    actualizarCards: function (datos) {
        const cards = this.idsCards;

        document.getElementById(cards.totalEmbarazos).textContent =
            datos.reduce((suma, item) => suma + totalEmbarazos(item), 0);

        document.getElementById(cards.totalNacidosVivos).textContent =
            datos.reduce((suma, item) => suma + totalNacidosVivos(item), 0);

        document.getElementById(cards.totalMortalidadFetal).textContent =
            datos.reduce((suma, item) => suma + totalMortalidadFetal(item), 0);

        document.getElementById(cards.totalGeneral).textContent =
            datos.reduce((suma, item) => suma + totalGeneral(item), 0);
    },

    actualizarTabla: function (datos) {
        const tabla = document.getElementById("tablaReportes");
        tabla.innerHTML = "";

        datos.forEach(function (item) {
            const filas = [
                { tipo: "Embarazos adolescentes", datos: item.embarazos_adolescentes },
                { tipo: "Nacidos vivos", datos: item.nacidos_vivos },
                { tipo: "Mortalidad fetal / bebés nacidos muertos", datos: item.mortalidad_fetal }
            ];

            filas.forEach(function (fila) {
                tabla.innerHTML += `
                    <tr>
                        <td>${item.municipio}</td>
                        <td>${item.mes}</td>
                        <td>${fila.tipo}</td>
                        <td>${fila.datos.edad_10 || 0}</td>
                        <td>${fila.datos.edad_11 || 0}</td>
                        <td>${fila.datos.edad_12 || 0}</td>
                        <td>${fila.datos.edad_13 || 0}</td>
                        <td>${fila.datos.edad_14 || 0}</td>
                        <td>${fila.datos.edad_15 || 0}</td>
                        <td>${fila.datos.edad_16 || 0}</td>
                        <td>${fila.datos.edad_17 || 0}</td>
                        <td>${fila.datos.edad_18_mas || 0}</td>
                        <td><strong>${sumarEdades(fila.datos)}</strong></td>
                    </tr>
                `;
            });
        });
    },

    construirGrafica: function (datos, estado) {
        const tipo = estado.selectorGrafica.value;
        const ctx = document.getElementById("graficaPrincipal").getContext("2d");
        const titulo = document.getElementById("tituloGrafica");

        if (tipo === "municipio") {
            titulo.textContent = "Totales por municipio";
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(obtenerTotalesPorMunicipio(datos)),
                    datasets: [{
                        label: "Total de casos",
                        data: Object.values(obtenerTotalesPorMunicipio(datos)),
                        backgroundColor: "#154F39"
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        if (tipo === "tipo") {
            const distribucion = obtenerDistribucionTipo(datos);
            titulo.textContent = "Distribución por tipo de reporte";
            return new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: Object.keys(distribucion),
                    datasets: [{
                        data: Object.values(distribucion),
                        backgroundColor: ["#154F39", "#1E6B4B", "#4F8C70"]
                    }]
                }
            });
        }

        if (tipo === "edad") {
            const edades = obtenerTotalesEdad(datos);
            titulo.textContent = "Distribución por edad de la madre";
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(edades),
                    datasets: [{
                        label: "Casos",
                        data: Object.values(edades),
                        backgroundColor: "#154F39"
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        if (tipo === "rangoEdad") {
            const rangos = obtenerTotalesRangoEdad(datos);
            titulo.textContent = "Distribución por rango de edad";
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(rangos),
                    datasets: [{
                        label: "Casos",
                        data: Object.values(rangos),
                        backgroundColor: "#4F8C70"
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        if (tipo === "comparativo") {
            const comparativo = obtenerComparativoMunicipio(datos);
            titulo.textContent = "Comparativo por municipio y tipo";
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: comparativo.labels,
                    datasets: [
                        { label: "Embarazos adolescentes", data: comparativo.embarazos, backgroundColor: "#154F39" },
                        { label: "Nacidos vivos", data: comparativo.nacidos, backgroundColor: "#1E6B4B" },
                        { label: "Mortalidad fetal", data: comparativo.mortalidad, backgroundColor: "#4F8C70" }
                    ]
                },
                options: { responsive: true }
            });
        }
    }
});

function sumarEdades(grupo) {
    return Object.values(grupo).reduce((suma, valor) => suma + valor, 0);
}
function totalEmbarazos(item) { return sumarEdades(item.embarazos_adolescentes); }
function totalNacidosVivos(item) { return sumarEdades(item.nacidos_vivos); }
function totalMortalidadFetal(item) { return sumarEdades(item.mortalidad_fetal); }
function totalGeneral(item) { return totalEmbarazos(item) + totalNacidosVivos(item) + totalMortalidadFetal(item); }

function obtenerTotalesPorMunicipio(datos) {
    return datos.reduce((resultado, item) => {
        resultado[item.municipio] = (resultado[item.municipio] || 0) + totalGeneral(item);
        return resultado;
    }, {});
}

function obtenerDistribucionTipo(datos) {
    return {
        "Embarazos adolescentes": datos.reduce((suma, item) => suma + totalEmbarazos(item), 0),
        "Nacidos vivos": datos.reduce((suma, item) => suma + totalNacidosVivos(item), 0),
        "Mortalidad fetal": datos.reduce((suma, item) => suma + totalMortalidadFetal(item), 0)
    };
}

function obtenerTotalesEdad(datos) {
    const edades = { "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0, "16": 0, "17": 0, "18+": 0 };
    datos.forEach(function (item) {
        const grupos = [item.embarazos_adolescentes, item.nacidos_vivos, item.mortalidad_fetal];
        grupos.forEach(function (grupo) {
            edades["10"] += grupo.edad_10 || 0;
            edades["11"] += grupo.edad_11 || 0;
            edades["12"] += grupo.edad_12 || 0;
            edades["13"] += grupo.edad_13 || 0;
            edades["14"] += grupo.edad_14 || 0;
            edades["15"] += grupo.edad_15 || 0;
            edades["16"] += grupo.edad_16 || 0;
            edades["17"] += grupo.edad_17 || 0;
            edades["18+"] += grupo.edad_18_mas || 0;
        });
    });
    return edades;
}

function obtenerTotalesRangoEdad(datos) {
    const rangos = { "10 a 14 años": 0, "15 a 17 años": 0, "18 años o más": 0 };
    datos.forEach(function (item) {
        const grupos = [item.embarazos_adolescentes, item.nacidos_vivos, item.mortalidad_fetal];
        grupos.forEach(function (grupo) {
            rangos["10 a 14 años"] +=
                (grupo.edad_10 || 0) + (grupo.edad_11 || 0) + (grupo.edad_12 || 0) +
                (grupo.edad_13 || 0) + (grupo.edad_14 || 0);
            rangos["15 a 17 años"] +=
                (grupo.edad_15 || 0) + (grupo.edad_16 || 0) + (grupo.edad_17 || 0);
            rangos["18 años o más"] += grupo.edad_18_mas || 0;
        });
    });
    return rangos;
}

function obtenerComparativoMunicipio(datos) {
    return {
        labels: datos.map(function (item) { return item.municipio; }),
        embarazos: datos.map(function (item) { return totalEmbarazos(item); }),
        nacidos: datos.map(function (item) { return totalNacidosVivos(item); }),
        mortalidad: datos.map(function (item) { return totalMortalidadFetal(item); })
    };
}
