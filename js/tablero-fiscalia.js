crearTablero({
    archivosReportes: ["datos/fiscalia/enero-2025.json"],
    selectores: {
        filtroMes: true,
        filtroMunicipio: true,
        selectorGrafica: true
    },
    idsCards: {
        totalCasos: "totalCasos",
        totalMujeres: "totalMujeres",
        totalHombres: "totalHombres",
        totalDelitos: "totalDelitos"
    },

    actualizarCards: function (datos) {
        const cards = this.idsCards;

        document.getElementById(cards.totalCasos).textContent =
            datos.reduce((suma, item) => suma + totalMunicipio(item), 0);

        document.getElementById(cards.totalMujeres).textContent =
            datos.reduce((suma, item) => suma + totalMujeresMunicipio(item), 0);

        document.getElementById(cards.totalHombres).textContent =
            datos.reduce((suma, item) => suma + totalHombresMunicipio(item), 0);

        document.getElementById(cards.totalDelitos).textContent =
            new Set(datos.flatMap(item => item.delitos.map(delito => delito.nombre))).size;
    },

    actualizarTabla: function (datos) {
        const encabezado = document.getElementById("encabezadoTablaFiscalia");
        const tabla = document.getElementById("tablaReportes");

        encabezado.innerHTML = "";
        tabla.innerHTML = "";

        const municipios = datos.map(function (item) { return item.municipio; });
        const delitosBase = datos[0]?.delitos.map(function (d) { return d.nombre; }) || [];

        encabezado.innerHTML = `
            <tr>
                <th class="col-delito" rowspan="3">DELITOS</th>
                ${municipios.map(function (municipio) {
                    return `<th class="grupo-municipio" colspan="4">${municipio}</th>`;
                }).join("")}
            </tr>
            <tr>
                ${municipios.map(function () {
                    return `<th class="grupo-sexo" colspan="2">Mujer</th>
                            <th class="grupo-sexo" colspan="2">Hombre</th>`;
                }).join("")}
            </tr>
            <tr>
                ${municipios.map(function () {
                    return `<th class="grupo-edad">0 a 12 años</th>
                            <th class="grupo-edad">13 a 17 años</th>
                            <th class="grupo-edad">0 a 12 años</th>
                            <th class="grupo-edad">13 a 17 años</th>`;
                }).join("")}
            </tr>
        `;

        delitosBase.forEach(function (nombreDelito) {
            let fila = `<tr><td class="col-delito">${nombreDelito}</td>`;
            datos.forEach(function (municipio) {
                const delito = municipio.delitos.find(function (d) { return d.nombre === nombreDelito; }) || {};
                fila += `
                    <td>${delito.mujer_0_12 || 0}</td>
                    <td>${delito.mujer_13_17 || 0}</td>
                    <td>${delito.hombre_0_12 || 0}</td>
                    <td>${delito.hombre_13_17 || 0}</td>`;
            });
            fila += "</tr>";
            tabla.innerHTML += fila;
        });
    },

    construirGrafica: function (datos, estado) {
        const tipo = estado.selectorGrafica.value;
        const ctx = document.getElementById("graficaPrincipal").getContext("2d");
        const titulo = document.getElementById("tituloGrafica");

        if (tipo === "municipio") {
            titulo.textContent = "Casos por municipio";
            const data = obtenerCasosPorMunicipio(datos);
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(data),
                    datasets: [{ label: "Casos", data: Object.values(data), backgroundColor: "#0073A8" }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        if (tipo === "delito") {
            titulo.textContent = "Casos por tipo de delito";
            const data = obtenerCasosPorDelito(datos);
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(data),
                    datasets: [{ label: "Casos", data: Object.values(data), backgroundColor: "#004F73" }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        if (tipo === "sexo") {
            titulo.textContent = "Distribución por sexo";
            const sexo = obtenerDistribucionSexo(datos);
            return new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: Object.keys(sexo),
                    datasets: [{ data: Object.values(sexo), backgroundColor: ["#0073A8", "#8CC7DD"] }]
                }
            });
        }

        if (tipo === "edad") {
            titulo.textContent = "Distribución por rango de edad";
            const edad = obtenerDistribucionEdad(datos);
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(edad),
                    datasets: [{ label: "Casos", data: Object.values(edad), backgroundColor: "#0073A8" }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        if (tipo === "comparativo") {
            titulo.textContent = "Comparativo por municipio y sexo";
            const comparativo = obtenerComparativoMunicipioSexo(datos);
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: comparativo.labels,
                    datasets: [
                        { label: "Mujeres", data: comparativo.mujeres, backgroundColor: "#0073A8" },
                        { label: "Hombres", data: comparativo.hombres, backgroundColor: "#8CC7DD" }
                    ]
                },
                options: { responsive: true }
            });
        }
    }
});

function totalDelito(delito) {
    return (
        (delito.mujer_0_12 || 0) +
        (delito.mujer_13_17 || 0) +
        (delito.hombre_0_12 || 0) +
        (delito.hombre_13_17 || 0)
    );
}
function totalMunicipio(item) {
    return item.delitos.reduce((suma, delito) => suma + totalDelito(delito), 0);
}
function totalMujeresMunicipio(item) {
    return item.delitos.reduce((suma, delito) => suma + (delito.mujer_0_12 || 0) + (delito.mujer_13_17 || 0), 0);
}
function totalHombresMunicipio(item) {
    return item.delitos.reduce((suma, delito) => suma + (delito.hombre_0_12 || 0) + (delito.hombre_13_17 || 0), 0);
}

function obtenerCasosPorMunicipio(datos) {
    return datos.reduce(function (resultado, item) {
        resultado[item.municipio] = (resultado[item.municipio] || 0) + totalMunicipio(item);
        return resultado;
    }, {});
}

function obtenerCasosPorDelito(datos) {
    return datos.reduce(function (resultado, item) {
        item.delitos.forEach(function (delito) {
            resultado[delito.nombre] = (resultado[delito.nombre] || 0) + totalDelito(delito);
        });
        return resultado;
    }, {});
}

function obtenerDistribucionSexo(datos) {
    return {
        Mujeres: datos.reduce((suma, item) => suma + totalMujeresMunicipio(item), 0),
        Hombres: datos.reduce((suma, item) => suma + totalHombresMunicipio(item), 0)
    };
}

function obtenerDistribucionEdad(datos) {
    return {
        "0 a 12 años": datos.reduce((suma, item) => {
            return suma + item.delitos.reduce((sub, delito) =>
                sub + (delito.mujer_0_12 || 0) + (delito.hombre_0_12 || 0), 0);
        }, 0),
        "13 a 17 años": datos.reduce((suma, item) => {
            return suma + item.delitos.reduce((sub, delito) =>
                sub + (delito.mujer_13_17 || 0) + (delito.hombre_13_17 || 0), 0);
        }, 0)
    };
}

function obtenerComparativoMunicipioSexo(datos) {
    return {
        labels: datos.map(function (item) { return item.municipio; }),
        mujeres: datos.map(function (item) { return totalMujeresMunicipio(item); }),
        hombres: datos.map(function (item) { return totalHombresMunicipio(item); })
    };
}
