// ==========================================
// INICIALIZACIÓN GLOBAL (Al cargar la página)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Configurar módulos base
    setupForms();
    setupDropZones();
    setupModalSubmit();

    // 2. Cargar tabla de usuarios si existe en el HTML actual
    if (document.getElementById("tbody-users")) {
        loadUsers(); 
    }
    
    // 3. Lógica de Seguridad (Ocultar Pestañas)
    const btnUsers = document.getElementById("btn-tab-users");
    const currentRole = localStorage.getItem("operator_role") || "Operador";
    const currentName = localStorage.getItem("operator_name") || "";
    const isAuthorized = currentRole === "Administrador" || currentName.toLowerCase().includes("admin");
    
    // TEMPORALMENTE COMENTADO PARA DESARROLLO:
    // if (!isAuthorized && btnUsers) {
    //     btnUsers.style.display = "none"; 
    // }
});

// ==========================================
// SISTEMA DE PESTAÑAS (TABS) DINÁMICO
// ==========================================
window.switchTab = function(tabId) {
    // 1. Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // 2. Desmarcar todos los botones
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // 3. Mostrar la pestaña destino
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }

    // 4. Marcar visualmente el botón correspondiente
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 5. Refrescar datos específicos si se entra a la pestaña
    if (tabId === 'tab-gestion') {
        loadManagementTables();
    } else if (tabId === 'tab-users') {
        loadUsers();
    }
};

// ==========================================
// CONFIGURACIÓN DE FORMULARIOS MAESTROS
// ==========================================
function setupForms() {
    document.getElementById("form-client").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = { name: document.getElementById("c-name").value, code: document.getElementById("c-code").value };
        sendData("/master-data/api/client", payload, e.target);
    });

    document.getElementById("form-dc").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = { name: document.getElementById("dc-name").value };
        sendData("/master-data/api/datacenter", payload, e.target);
    });
}

async function sendData(url, payload, formElement) {
    try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        if(res.ok) {
            if (typeof showNotification === "function") showNotification('success', "¡Registro guardado correctamente!");
            formElement.reset();
        } else { 
            if (typeof showNotification === "function") showNotification('error', "Error: " + data.detail); 
        }
    } catch(err) { console.error(err); }
}

// ==========================================
// TABLAS DE GESTIÓN (LISTAR, EDITAR, ELIMINAR)
// ==========================================
async function loadManagementTables() {
    // 1. Clientes
    const resClients = await fetch("/master-data/api/clients");
    const clients = await resClients.json();
    const tbodyClients = document.getElementById("tbody-manage-clients");
    tbodyClients.innerHTML = clients.length ? "" : "<tr><td colspan='3' class='empty-msg'>No hay clientes</td></tr>";
    clients.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${c.name}</strong></td><td><code>${c.code}</code></td>
        <td>
            <button onclick="openEditModal('client', '${c.id}', '${c.name}', '${c.code}')" class="btn-sm btn-edit">Editar</button>
            <button onclick="deleteMasterRecord('client', '${c.id}')" class="btn-sm btn-danger">🗑️</button>
        </td>`;
        tbodyClients.appendChild(tr);
    });

    // 2. DataCenters
    const resDcs = await fetch("/master-data/api/datacenters");
    const dcs = await resDcs.json();
    const tbodyDcs = document.getElementById("tbody-manage-dcs");
    tbodyDcs.innerHTML = dcs.length ? "" : "<tr><td colspan='2' class='empty-msg'>No hay sedes</td></tr>";
    dcs.forEach(d => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${d.name}</strong></td>
        <td>
            <button onclick="openEditModal('datacenter', '${d.id}', '${d.name}', '')" class="btn-sm btn-edit">Editar</button>
            <button onclick="deleteMasterRecord('datacenter', '${d.id}')" class="btn-sm btn-danger">🗑️</button>
        </td>`;
        tbodyDcs.appendChild(tr);
    });
}

// ==========================================
// CONTROL DEL MODAL DE EDICIÓN MAESTRA
// ==========================================
window.openEditModal = function(type, id, name, code) {
    document.getElementById("modal-id").value = id;
    document.getElementById("modal-type").value = type;
    document.getElementById("modal-name").value = name;
    
    const codeContainer = document.getElementById("modal-code-container");
    if (type === 'client') {
        codeContainer.classList.remove("hidden");
        document.getElementById("modal-code").value = code;
        document.getElementById("modal-title").innerText = "Modificar Cliente";
    } else {
        codeContainer.classList.add("hidden");
        document.getElementById("modal-title").innerText = "Modificar Sede DataCenter";
    }
    document.getElementById("edit-modal").classList.remove("hidden");
};

window.closeModal = function() {
    document.getElementById("edit-modal").classList.add("hidden");
};

function setupModalSubmit() {
    document.getElementById("form-modal-edit").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("modal-id").value;
        const type = document.getElementById("modal-type").value;
        const payload = { name: document.getElementById("modal-name").value };
        
        if (type === 'client') {
            payload.code = document.getElementById("modal-code").value;
        }

        const url = `/master-data/api/${type}/${id}`;
        const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        
        if (res.ok) {
            closeModal();
            loadManagementTables();
            if (typeof showNotification === "function") showNotification('success', "Registro actualizado correctamente.");
        } else {
            const data = await res.json();
            if (typeof showNotification === "function") showNotification('error', "Error: " + data.detail);
        }
    });
}

window.deleteMasterRecord = async function(type, id) {
    if (confirm("¿Estás seguro de eliminar este registro maestro? Esta acción no se puede deshacer.")) {
        const res = await fetch(`/master-data/api/${type}/${id}`, { method: "DELETE" });
        if (res.ok) {
            if (typeof showNotification === "function") showNotification('success', "Registro eliminado.");
            loadManagementTables();
        }
    }
};

// ==========================================
// DROPZONES EXCEL (CARGA MASIVA)
// ==========================================
function setupDropZones() {
    initSingleDropZone("drop-zone-clients", "input-clients", "/master-data/api/bulk/clients", "result-clients", "Clientes");
    initSingleDropZone("drop-zone-dcs", "input-dcs", "/master-data/api/bulk/datacenters", "result-dcs", "Sedes DataCenter");
}

function initSingleDropZone(zoneId, inputId, apiUrl, resultDivId, entityLabel) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const resultDiv = document.getElementById(resultDivId);
    if (!zone || !input || !resultDiv) return;

    zone.addEventListener("click", () => input.click());
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
        e.preventDefault(); zone.classList.remove("dragover");
        if(e.dataTransfer.files.length) handleExcelUpload(e.dataTransfer.files[0], apiUrl, resultDiv, entityLabel);
    });
    input.addEventListener("change", () => {
        if(input.files.length) handleExcelUpload(input.files[0], apiUrl, resultDiv, entityLabel);
    });
}

async function handleExcelUpload(file, apiUrl, resultDiv, entityLabel) {
    resultDiv.style.color = "#475569";
    resultDiv.innerText = `⏳ Procesando archivo...`;
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch(apiUrl, { method: "POST", body: formData });
        const data = await res.json();
        if(res.ok) {
            resultDiv.style.color = "#10b981";
            resultDiv.innerHTML = `✅ ¡Carga completada!<br><small>${data.message}</small>`;
            if (typeof showNotification === "function") showNotification('success', `Carga masiva de ${entityLabel} finalizada.`);
        } else { 
            resultDiv.style.color = "#ef4444"; 
            resultDiv.innerText = "❌ Error en el archivo."; 
            if (typeof showNotification === "function") showNotification('error', "Error procesando el Excel.");
        }
    } catch (err) { 
        resultDiv.style.color = "#ef4444"; 
        resultDiv.innerText = "❌ Error de conexión."; 
    }
}

// ==========================================
// LÓGICA DE USUARIOS (Sincronización Local)
// ==========================================
async function loadUsers() {
    try {
        const res = await fetch("/master-data/api/users");
        const data = await res.json();
        const tbody = document.getElementById("tbody-users");

        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No hay usuarios registrados.</td></tr>";
            return;
        }

        tbody.innerHTML = data.map(u => `
            <tr>
                <td style="font-weight:bold;">${u.username}</td>
                <td>
                    <span class="badge" style="background: ${u.role === 'Administrador' ? '#ef4444' : '#3b82f6'}; padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.85em; font-weight: bold;">
                        ${u.role}
                    </span>
                </td>
                <td>
                    <button class="btn-sm btn-edit" onclick="editUser('${u.id}', '${u.username}', '${u.role}')">✏️ Editar Rol</button>
                    <button class="btn-sm btn-danger" onclick="deleteUser('${u.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { 
        console.error("Error cargando usuarios:", e); 
    }
}

window.saveUser = async function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
        const res = await fetch("/master-data/api/users", { method: "POST", body: formData });
        if (res.ok) {
            if (typeof showNotification === "function") showNotification('success', 'Rol actualizado correctamente.');
            resetUserForm();
            loadUsers();
        } else {
            const error = await res.json();
            if (typeof showNotification === "function") showNotification('error', error.detail || 'Error al actualizar permisos.');
        }
    } catch (err) {
        if (typeof showNotification === "function") showNotification('error', 'Error de conexión.');
    }
}

window.editUser = function(id, username, role) {
    document.getElementById("u-id").value = id;
    document.getElementById("u-username").value = username;
    document.getElementById("u-role").value = role;
}

window.deleteUser = async function(id) {
    if (!confirm("¿Seguro que deseas eliminar este usuario del sistema local? Volverá a crearse si inicia sesión nuevamente.")) return;
    try {
        const res = await fetch(`/master-data/api/users/${id}`, { method: "DELETE" });
        if (res.ok) {
            if (typeof showNotification === "function") showNotification('success', 'Usuario removido localmente.');
            loadUsers();
            resetUserForm();
        }
    } catch (e) {
        console.error(e);
    }
}

window.resetUserForm = function() {
    document.getElementById("form-user").reset();
    document.getElementById("u-id").value = "";
}

window.saveUser = async function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
        const res = await fetch("/shift/api/users", { method: "POST", body: formData });
        if (res.ok) {
            if (typeof showNotification === "function") showNotification('success', 'Usuario guardado exitosamente.');
            resetUserForm();
            loadUsers();
        } else {
            const error = await res.json();
            if (typeof showNotification === "function") showNotification('error', error.detail || 'Error al guardar el usuario.');
        }
    } catch (err) { 
        if (typeof showNotification === "function") showNotification('error', 'Error de conexión.'); 
    }
}

window.editUser = function(id, username, role) {
    document.getElementById("u-id").value = id;
    document.getElementById("u-username").value = username;
    document.getElementById("u-role").value = role;
    document.getElementById("u-username").focus();
}

window.deleteUser = async function(id) {
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
    try {
        await fetch(`/shift/api/users/${id}`, { method: "DELETE" });
        if (typeof showNotification === "function") showNotification('success', 'Usuario eliminado.');
        loadUsers();
    } catch (e) {
        console.error(e);
    }
}

window.resetUserForm = function() {
    document.getElementById("form-user").reset();
    document.getElementById("u-id").value = "";
}

function filterTable(tbodyId, query) {
    const tbody = document.getElementById(tbodyId);
    const rows = tbody.getElementsByTagName('tr');
    const filter = query.toLowerCase();

    for (let i = 0; i < rows.length; i++) {
        const rowText = rows[i].textContent.toLowerCase();
        // Si el texto de la fila contiene lo que escribiste, se muestra; si no, se oculta
        rows[i].style.display = rowText.includes(filter) ? "" : "none";
    }
}