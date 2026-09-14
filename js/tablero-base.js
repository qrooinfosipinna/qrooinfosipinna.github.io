(function (global) {
    "use strict";

    function crearTablero(config) {
        const estado = {
            datos: [],
            graficaPrincipal: null,
            filtroMes: config.selectores.filtroMes && document.getElementById("filtroMes"),
            filtroMunicipio: config.selectores.filtroMunicipio && document.getElementById("filtroMunicipio"),
            selectorGrafica: config.selectores.selectorGrafica && document.getElementById("selectorGrafica"),
            idsCards: config.idsCards || {}
        };

        async function cargarReportes() {
            const respuestas = await Promise.all(
                config.archivosReportes.map(function (archivo) {
                    return fetch(archivo).then(function (res) {
                        return res.json();
                    });
                })
            );

            estado.datos = respuestas.flatMap(function (reporte) {
                return reporte.registros.map(function (registro) {
                    return Object.assign({}, registro, {
                        mes: reporte.periodo.mes,
                        anio: reporte.periodo.anio,
                        institucion: reporte.institucion
                    });
                });
            });

            cargarFiltros();
            actualizarTablero();
        }

        function cargarFiltros() {
            const meses = [...new Set(estado.datos.map(function (item) {
                return item.mes;
            }))];
            const municipios = [...new Set(estado.datos.map(function (item) {
                return item.municipio;
            }))];

            meses.forEach(function (mes) {
                estado.filtroMes.innerHTML += '<option value="' + mes + '">' + mes + "</option>";
            });

            municipios.forEach(function (municipio) {
                estado.filtroMunicipio.innerHTML += '<option value="' + municipio + '">' + municipio + "</option>";
            });
        }

        function obtenerDatosFiltrados() {
            return estado.datos.filter(function (item) {
                const coincideMes =
                    estado.filtroMes.value === "todos" || item.mes === estado.filtroMes.value;
                const coincideMunicipio =
                    estado.filtroMunicipio.value === "todos" ||
                    item.municipio === estado.filtroMunicipio.value;

                return coincideMes && coincideMunicipio;
            });
        }

        function actualizarTablero() {
            const datos = obtenerDatosFiltrados();

            actualizarCards(datos);
            actualizarTabla(datos);
            actualizarGrafica(datos);
        }

        function actualizarCards(datos) {
            if (!config.actualizarCards) return;
            config.actualizarCards(datos, estado.idsCards);
        }

        function actualizarTabla(datos) {
            config.actualizarTabla(datos);
        }

        function actualizarGrafica(datos) {
            if (estado.graficaPrincipal) {
                estado.graficaPrincipal.destroy();
            }

            if (!config.construirGrafica) return;
            estado.graficaPrincipal = config.construirGrafica(datos, estado);
        }

        function bindEvents() {
            if (estado.filtroMes) {
                estado.filtroMes.addEventListener("change", actualizarTablero);
            }
            if (estado.filtroMunicipio) {
                estado.filtroMunicipio.addEventListener("change", actualizarTablero);
            }
            if (estado.selectorGrafica) {
                estado.selectorGrafica.addEventListener("change", actualizarTablero);
            }
        }

        bindEvents();
        cargarReportes();

        return {
            obtenerDatosFiltrados: obtenerDatosFiltrados,
            actualizarTablero: actualizarTablero
        };
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = { crearTablero: crearTablero };
    }

    global.crearTablero = crearTablero;
})(typeof window !== "undefined" ? window : this);
