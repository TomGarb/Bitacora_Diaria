// ==========================================================================
// UTILIDADES GLOBALES DEL SISTEMA
// ==========================================================================

/**
 * Muestra una notificación flotante en la pantalla.
 * @param {string} type - El tipo de notificación ('success' o 'error').
 * @param {string} message - El mensaje a mostrar.
 */
window.showNotification = function(type, message) {
    // 1. Verificar si el contenedor maestro existe, si no, crearlo
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    // 2. Crear la tarjeta de notificación
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    // Asignar ícono según el tipo
    const icon = type === 'success' ? '✅' : '❌';
    
    // Estructura interna
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;

    // 3. Agregarla a la pantalla
    container.appendChild(toast);

    // 4. Temporizador para desaparecer (4 segundos)
    setTimeout(() => {
        toast.classList.add("fade-out");
        // Esperar a que termine la animación de opacidad para eliminar del DOM
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// ==========================================================================
// AUTOCOMPLETADO DINÁMICO DE CLIENTES (DATALIST)
// ==========================================================================

window.injectClientDatalist = async function() {
    try {
        // 1. Buscar si la pantalla actual tiene inputs de cliente
        // Esto atrapa los name="client" de casos, accesos y external_cases
        const clientInputs = document.querySelectorAll('input[name="client"], input[id*="client"]');
        
        // Si no hay inputs de cliente en esta pantalla, no hacemos nada
        if (clientInputs.length === 0) return;

        // 2. Traer la lista de clientes desde el backend
        const res = await fetch("/shift/api/global-clients"); // Ajusta la URL si la pusiste en otro router
        const clients = await res.json();

        if (!clients || clients.length === 0) return;

        // 3. Crear la lista maestra (Datalist HTML5)
        let datalist = document.getElementById("global-client-list");
        if (!datalist) {
            datalist = document.createElement("datalist");
            datalist.id = "global-client-list";
            document.body.appendChild(datalist);
        }

        // 4. Llenar la lista con las opciones
        datalist.innerHTML = clients.map(c => `<option value="${c.name}">`).join('');

        // 5. Vincular la lista a todos los campos de cliente
        clientInputs.forEach(input => {
            input.setAttribute("list", "global-client-list");
            input.setAttribute("autocomplete", "off"); // Apaga el historial feo del navegador
            
            // Opcional: Un pequeño placeholder para que el usuario sepa que puede buscar
            if (!input.placeholder) {
                input.placeholder = "🔍 Escriba para buscar un cliente...";
            }
        });

    } catch (e) {
        console.error("Error cargando la lista de clientes:", e);
    }
};

// Ejecutar automáticamente al cargar cualquier página (o Iframe)
document.addEventListener("DOMContentLoaded", injectClientDatalist);

// ==========================================================================
// AUTOCOMPLETADO DINÁMICO DE SITIOS (DATALIST) - SOLO PARA PLANIFICADOS Y ACCESOS
// ==========================================================================

window.injectSiteDatalist = async function() {
    try {
        // 1. Buscamos SOLO los inputs a los que les hayamos puesto esta clase exacta
        const siteInputs = document.querySelectorAll('.autocomplete-site');
        
        if (siteInputs.length === 0) return;

        // 2. Traer la lista de sitios desde el backend
        const res = await fetch("/shift/api/global-sites");
        const sites = await res.json();

        if (!sites || sites.length === 0) return;

        // 3. Crear la lista maestra
        let datalist = document.getElementById("global-site-list");
        if (!datalist) {
            datalist = document.createElement("datalist");
            datalist.id = "global-site-list";
            document.body.appendChild(datalist);
        }

        // 4. Llenar la lista con las opciones
        datalist.innerHTML = sites.map(s => `<option value="${s.name}">`).join('');

        // 5. Vincular la lista a los campos específicos
        siteInputs.forEach(input => {
            input.setAttribute("list", "global-site-list");
            input.setAttribute("autocomplete", "off");
            
            if (!input.placeholder) {
                input.placeholder = "🔍 Buscar sitio en la base de datos...";
            }
        });

    } catch (e) {
        console.error("Error cargando la lista de sitios:", e);
    }
};

document.addEventListener("DOMContentLoaded", injectSiteDatalist);