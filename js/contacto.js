/* Aplicación web publicada para el formulario de contacto. */
const CONTACTO_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxplWHtWBOpgbbwKx6YpFX4YtSkO4rTR8b9tyqlZJ5SOdRJ1EZWAwMJzO4DRAEtCxjFsQ/exec';

(function () {
  'use strict';
  const frame = document.getElementById('formularioContacto');
  const alternativa = document.getElementById('contactoAlternativa');
  const abrir = document.getElementById('abrirFormulario');
  document.querySelector('.contact-container').classList.add('visible');

  const url = CONTACTO_APPS_SCRIPT_URL.trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) return;
  frame.src = url;
  frame.hidden = false;
  abrir.href = url;
  abrir.hidden = false;
})();
