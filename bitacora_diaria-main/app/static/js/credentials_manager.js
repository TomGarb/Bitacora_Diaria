document.addEventListener("DOMContentLoaded", () => {
    loadCredentials();

    document.getElementById("bulk-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Recopilar ingresantes dinámicos
        const people = [];
        document.querySelectorAll(".person-row").forEach(row => {
            people.push({
                first_name: row.querySelector(".p-fname").value,
                last_name: row.querySelector(".p-lname").value,
                credential_code: row.querySelector(".p-code").value
            });
        });

        const payload = {
            our_ticket: document.getElementById("our-ticket").value,
            client_ticket: document.getElementById("client-ticket").value,
            authorized_by: document.getElementById("auth-by").value,
            received_date: document.getElementById("recv-date").value,
            start_date: document.getElementById("start-date").value,
            start_time: document.getElementById("start-time").value + ":00",
            end_date: document.getElementById("end-date").value || null,
            end_time: document.getElementById("end-time").value ? document.getElementById("end-time").value + ":00" : null,
            observations: document.getElementById("observations").value,
            people: people
        };

        try {
            const res = await fetch("/credentials/api/bulk", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (res.ok) {
                document.getElementById("bulk-form").reset();
                // Limpiar filas extra
                const container = document.getElementById("people-container");
                while (container.children.length > 1) { container.lastChild.remove(); }
                loadCredentials();
            }
        } catch (error) { console.error(error); }
    });

    document.getElementById("edit-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit-id").value;
        const payload = {
            first_name: document.getElementById("e-fname").value,
            last_name: document.getElementById("e-lname").value,
            credential_code: document.getElementById("e-code").value,
            authorized_by: document.getElementById("e-auth").value,
            our_ticket: document.getElementById("e-oticket").value,
            client_ticket: document.getElementById("e-cticket").value,
            end_date: document.getElementById("e-enddate").value || null,
            end_time: document.getElementById("e-endtime").value ? document.getElementById("e-endtime").value + ":00" : null,
            // Recuperamos los ocultos
            received_date: document.getElementById("e-recvdate").value,
            start_date: document.getElementById("e-startdate").value,
            start_time: document.getElementById("e-starttime").value,
            observations: document.getElementById("e-obs").value
        };

        await fetch(`/credentials/api/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        closeEditModal();
        loadCredentials();
    });
});

// Funciones para UI Masiva
window.addPersonRow = function() {
    const container = document.getElementById("people-container");
    const newRow = container.children[0].cloneNode(true);
    newRow.querySelectorAll("input").forEach(i => i.value = ""); // limpiar
    newRow.querySelector(".btn-danger").disabled = false; // habilitar borrado
    container.appendChild(newRow);
    container.children[0].querySelector(".btn-danger").disabled = true; // proteger la primera
};

window.removeRow = function(btn) {
    btn.parentElement.remove();
};

// Cargar Tabla
async function loadCredentials() {
    const res = await fetch("/credentials/api/active");
    const creds = await res.json();
    const tbody = document.getElementById("cred-body");
    tbody.innerHTML = "";

    creds.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${c.first_name} ${c.last_name}</strong><br><small>👤 ${c.authorized_by}</small></td>
            <td><span class="badge" style="background:#8e44ad;">${c.credential_code}</span></td>
            <td>${c.our_ticket}<br>${c.client_ticket}</td>
            <td>${c.end_date || 'Sin vencimiento'}<br>${c.end_time || ''}</td>
            <td>
                <button onclick='openEditModal(${JSON.stringify(c)})' class="btn-sm btn-edit">Editar</button>
                <button onclick='deactivateCred("${c.id}")' class="btn-sm btn-secondary" title="Inactivar">Inactivar</button>
                <button onclick='deleteCred("${c.id}")' class="btn-sm btn-danger">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal y Acciones Individuales
window.openEditModal = function(c) {
    document.getElementById("edit-id").value = c.id;
    document.getElementById("e-fname").value = c.first_name;
    document.getElementById("e-lname").value = c.last_name;
    document.getElementById("e-code").value = c.credential_code;
    document.getElementById("e-auth").value = c.authorized_by;
    document.getElementById("e-oticket").value = c.our_ticket;
    document.getElementById("e-cticket").value = c.client_ticket;
    document.getElementById("e-enddate").value = c.end_date;
    document.getElementById("e-endtime").value = c.end_time;
    // Ocultos
    document.getElementById("e-recvdate").value = c.received_date;
    document.getElementById("e-startdate").value = c.start_date;
    document.getElementById("e-starttime").value = c.start_time;
    document.getElementById("e-obs").value = c.observations;

    document.getElementById("edit-modal").classList.remove("hidden");
};

window.closeEditModal = function() { document.getElementById("edit-modal").classList.add("hidden"); };

window.deactivateCred = async function(id) {
    if (confirm("¿Marcar como inactiva para ocultarla de la pantalla?")) {
        await fetch(`/credentials/api/${id}/deactivate`, { method: "PUT" });
        loadCredentials();
    }
};

window.deleteCred = async function(id) {
    if (confirm("¿Borrar definitivamente esta credencial?")) {
        await fetch(`/credentials/api/${id}`, { method: "DELETE" });
        loadCredentials();
    }
};