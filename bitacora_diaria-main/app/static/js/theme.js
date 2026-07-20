// Aplicar tema al cargar cualquier pantalla
document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
        updateThemeIcon(true);
    }
});

// Función global para alternar
window.toggleTheme = function(event) {
    if (event) event.preventDefault();
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    updateThemeIcon(isDark);
    
    // Sincronizar el Iframe de Operaciones (si existe en la pantalla actual)
    try {
        const iframe = document.getElementById("ops-frame");
        if (iframe && iframe.contentDocument) {
            iframe.contentDocument.body.classList.toggle("dark-mode", isDark);
        }
    } catch(e) {}
};

// Actualizar el botón
function updateThemeIcon(isDark) {
    document.querySelectorAll(".theme-toggle-icon").forEach(icon => {
        icon.innerHTML = isDark ? "☀️ Modo Claro" : "🌙 Modo Oscuro";
    });
}