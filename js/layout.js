(function () {
    "use strict";

    const RUTA_HEADER = "partials/header.html";
    const RUTA_FOOTER = "partials/footer.html";

    function cargarParcial(ruta, elementoId) {
        return fetch(ruta)
            .then(function (respuesta) {
                if (!respuesta.ok) {
                    throw new Error(
                        "No se pudo cargar " + ruta + ". Código: " + respuesta.status
                    );
                }
                return respuesta.text();
            })
            .then(function (contenido) {
                var elemento = document.getElementById(elementoId);
                if (elemento) {
                    elemento.innerHTML = contenido;
                }
                if (elementoId === "header") {
                    inicializarNavToggle();
                }
            })
            .catch(function (error) {
                console.error(error);
            });
    }

    function inicializarNavToggle() {
        var boton = document.querySelector(".nav-toggle");
        var nav = document.getElementById("main-nav");

        if (!boton || !nav) {
            document.addEventListener("click", function (event) {
                var toggle = event.target.closest(".nav-toggle");
                if (!toggle) return;

                var navegacion = document.getElementById("main-nav");
                if (navegacion) {
                    navegacion.classList.toggle("nav-open");
                }
            });
            return;
        }

        boton.addEventListener("click", function () {
            nav.classList.toggle("nav-open");
        });
    }

    function cargarLayout() {
        cargarParcial(RUTA_HEADER, "header");
        cargarParcial(RUTA_FOOTER, "footer");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", cargarLayout);
    } else {
        cargarLayout();
    }

    window.cargarParciales = cargarLayout;
})();
