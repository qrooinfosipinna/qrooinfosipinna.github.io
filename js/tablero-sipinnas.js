crearTablero({
    archivosReportes: ["datos/sipinnas-municipales/enero-2025.json"],
    selectores: {
        filtroMes: true,
        filtroMunicipio: true,
        selectorGrafica: true
    },
    idsCards: {
        totalBeneficiarios: "totalBeneficiarios",
        totalActividades: "totalActividades",
        totalMujeres: "totalMujeres",
        totalHombres: "totalHombres"
    },

    actualizarCards: function (datos) {
        const cards = this.idsCards;

        document.getElementById(cards.totalBeneficiarios).textContent =
            datos.reduce((suma, item) => suma + item.totales.global, 0);

        document.getElementById(cards.totalActividades).textContent =
            datos.reduce((suma, item) => suma + item.totales.actividades_realizadas, 0);

        document.getElementById(cards.totalMujeres).textContent =
            datos.reduce((suma, item) => suma + item.totales.mujeres, 0);

        document.getElementById(cards.totalHombres).textContent =
            datos.reduce((suma, item) => suma + item.totales.hombres, 0);
    },

    actualizarTabla: function (datos) {
        const tabla = document.getElementById("tablaReportes");
        tabla.innerHTML = "";

        datos.forEach(function (item) {
            item.actividades.forEach(function (actividad) {
                tabla.innerHTML += `
                    <tr>
                        <td>${item.municipio}</td>
                        <td>${item.mes}</td>
                        <td>${actividad.nombre}</td>
                        <td>${actividad.fecha}</td>
                        <td>${actividad.mujeres}</td>
                        <td>${actividad.hombres}</td>
                        <td>${actividad.total}</td>
                    </tr>
                `;
            });
        });
    },

    construirGrafica: function (datos, estado) {
        const tipo = estado.selectorGrafica.value;
        const ctx = document.getElementById("graficaPrincipal").getContext("2d");
        const titulo = document.getElementById("tituloGrafica");

        if (tipo === "municipios") {
            titulo.textContent = "Beneficiarios por municipio";
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(agruparPorMunicipio(datos)),
                    datasets: [{
                        label: "Beneficiarios",
                        data: Object.values(agruparPorMunicipio(datos)),
                        backgroundColor: "#a8325a"
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        if (tipo === "sexo") {
            titulo.textContent = "Distribución por sexo";
            return new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: ["Mujeres", "Hombres"],
                    datasets: [{
                        data: [
                            datos.reduce((suma, item) => suma + item.totales.mujeres, 0),
                            datos.reduce((suma, item) => suma + item.totales.hombres, 0)
                        ],
                        backgroundColor: ["#a8325a", "#2f80ed"]
                    }]
                }
            });
        }

        if (tipo === "edad") {
            titulo.textContent = "Beneficiarios por rango de edad";
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(obtenerTotalesEdad(datos)),
                    datasets: [{
                        label: "Beneficiarios",
                        data: Object.values(obtenerTotalesEdad(datos)),
                        backgroundColor: "#7a1f3d"
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        if (tipo === "condiciones") {
            titulo.textContent = "Condiciones registradas";
            return new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(obtenerTotalesCondiciones(datos)),
                    datasets: [{
                        label: "Personas registradas",
                        data: Object.values(obtenerTotalesCondiciones(datos)),
                        backgroundColor: "#c96b8a"
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }
    }
});

function agruparPorMunicipio(datos) {
    return datos.reduce((resultado, item) => {
        resultado[item.municipio] =
            (resultado[item.municipio] || 0) + item.totales.global;
        return resultado;
    }, {});
}

function obtenerTotalesEdad(datos) {
    return {
        "0-5": datos.reduce((suma, item) =>
            suma + item.clasificacion.mujeres.edad_0_5 + item.clasificacion.hombres.edad_0_5, 0),
        "6-10": datos.reduce((suma, item) =>
            suma + item.clasificacion.mujeres.edad_6_10 + item.clasificacion.hombres.edad_6_10, 0),
        "11-14": datos.reduce((suma, item) =>
            suma + item.clasificacion.mujeres.edad_11_14 + item.clasificacion.hombres.edad_11_14, 0),
        "15-17": datos.reduce((suma, item) =>
            suma + item.clasificacion.mujeres.edad_15_17 + item.clasificacion.hombres.edad_15_17, 0),
        "18+": datos.reduce((suma, item) =>
            suma + item.clasificacion.mujeres.edad_18_mas + item.clasificacion.hombres.edad_18_mas, 0)
    };
}

function obtenerTotalesCondiciones(datos) {
    return {
        "Afrodescendientes": datos.reduce((suma, item) =>
            suma + item.clasificacion.mujeres.afrodescendiente + item.clasificacion.hombres.afrodescendiente, 0),
        "Situación de discapacidad": datos.reduce((suma, item) =>
            suma + item.clasificacion.mujeres.discapacidad + item.clasificacion.hombres.discapacidad, 0)
    };
}
