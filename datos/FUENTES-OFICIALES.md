# Fuentes y controles de los tableros oficiales

## Víctimas de delitos de 0 a 17 años

- **Institución:** Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública (SESNSP).
- **Fuente:** [Datos Abiertos de Incidencia Delictiva](https://www.datos.gob.mx/dataset/incidencia_delictiva).
- **Recurso consultado:** [Víctimas del fuero común](https://www.datos.gob.mx/dataset/incidencia_delictiva/resource/386f17d2-a488-4da2-9c85-99765b5a9cdc/view/96b2e9b8-9fd6-4385-8655-31e362cd3fb1).
- **Filtros aplicados:** Entidad = Quintana Roo; rango de edad = Menores de edad (0-17); años = 2024 y 2025.
- **Fecha de consulta:** 15 de septiembre de 2026.
- **Corte de la serie:** diciembre de 2025.
- **Control:** 66 filas por año; 1,049 víctimas NNA en 2024 y 1,076 en 2025.

El tablero conserva los 12 valores mensuales y la clasificación oficial por sexo, bien jurídico, tipo, subtipo y modalidad. Todos los registros incluidos corresponden al rango de 0 a 17 años. La base de víctimas solo tiene desagregación estatal; por ello no se presenta ni se infiere información municipal. El SESNSP puede actualizar retrospectivamente la base histórica.

## Nacimientos registrados

- **Institución:** Instituto Nacional de Estadística y Geografía (INEGI).
- **Fuente:** [Estadística de Nacimientos Registrados, Datos abiertos](https://www.inegi.org.mx/programas/natalidad/#Datos_abiertos).
- **Archivo utilizado:** [Microdatos ENR 2024 en CSV](https://www.inegi.org.mx/contenidos/programas/natalidad/datosabiertos/2024/conjunto_de_datos_enr2024_csv.zip).
- **Diccionario:** [Diccionario de datos ENR 2024](https://www.inegi.org.mx/rnm/index.php/catalog/1131/data-dictionary).
- **Filtro aplicado:** entidad de residencia habitual de la madre = 23, Quintana Roo.
- **Publicación:** 25 de septiembre de 2025.
- **Control:** 1,672,227 registros nacionales procesados; 21,990 con residencia materna en Quintana Roo; 14,617 ocurrieron en 2024.

La cifra de 21,990 no tiene que coincidir con los totales construidos por entidad de registro o entidad de ocurrencia. El tablero usa residencia habitual de la madre para representar mejor el municipio de pertenencia. Incluye nacimientos inscritos durante 2024 que ocurrieron en años anteriores.

## Transformación

El archivo `scripts/generar-datos-oficiales.mjs` agrega las descargas oficiales y genera los JSON publicados. No estima, redistribuye ni completa valores. Los totales de control quedan guardados dentro de cada JSON.
