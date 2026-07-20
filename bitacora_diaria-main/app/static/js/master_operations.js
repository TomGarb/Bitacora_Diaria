window.switchOpTab = function(url, element) {
    // 1. Quitar la clase 'active' de todos los botones
    document.querySelectorAll('.ops-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });

    // 2. Activar el botón seleccionado
    element.classList.add('active');

    // 3. Cambiar la URL del Iframe
    document.getElementById('ops-frame').src = url;
};