document.addEventListener("DOMContentLoaded", () => {
    loadAccesses();

    const form = document.getElementById("access-form");
    const cancelBtn = document.getElementById("btn-cancel-edit");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const id = document.getElementById("acc-id").value;
        const payload = {
            ticket_number: document.getElementById("ticket").value,
            title: document.getElementById("title").value,
            client: document.getElementById("client").value,
            site: document.getElementById("site").value,
            type: document.getElementById("type").value,
            status: document.getElementById("status").value,
            request_date: document.getElementById("req-date").value,
            start_date: document.getElementById("start-date").value,
            start_time: document.getElementById("start-time").value + ":00", 
            end_date: document.getElementById("end-date").value || null,
            end_time: document.getElementById("end-time").value ? document.getElementById("end-time").value + ":00" : null,
            observations: document.getElementById("observations").value
        };

        const url = id ? `/accesses/api/${id}` : `/accesses/api`;
        const method = id ? "PUT" : "POST";

        try {
            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                resetForm();
                loadAccesses();
            } else {
                showNotification('error',"Error al guardar los datos.");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    });

    cancelBtn.addEventListener("click", resetForm);
});

async function loadAccesses() {
    const response = await fetch("/accesses/api/active");
    const accesses = await response.json();
    const tbody = document.getElementById("accesses-body");
    tbody.innerHTML = "";

    accesses.forEach(a => {
        const tr = document.createElement("tr");
        
        if (a.status === "Cancelado") tr.style.opacity = "0.5";

        tr.innerHTML = `
            <td><strong>${a.ticket_number}</strong><br><small>${a.client}</small></td>
            <td><strong>${a.type}</strong><br>${a.title}<br><small>📍 ${a.site}</small></td>
            <td>${a.start_date}<br>${a.start_time}</td>
            <td>${a.end_date || 'Sin definir'}<br>${a.end_time || ''}</td>
            <td><span class="badge ${a.status.replace(" ", "-")}">${a.status}</span></td>
            <td>
                <button onclick='editAccess(${JSON.stringify(a)})' class="btn-sm btn-edit">Editar</button>
                <button onclick='deleteAccess("${a.id}")' class="btn-sm btn-danger">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editAccess = function(a) {
    document.getElementById("form-title").innerText = "Modificar Acceso";
    document.getElementById("acc-id").value = a.id;
    document.getElementById("ticket").value = a.ticket_number;
    document.getElementById("title").value = a.title;
    document.getElementById("client").value = a.client;
    document.getElementById("site").value = a.site;
    document.getElementById("type").value = a.type;
    document.getElementById("status").value = a.status;
    document.getElementById("req-date").value = a.request_date;
    document.getElementById("start-date").value = a.start_date;
    document.getElementById("start-time").value = a.start_time;
    document.getElementById("end-date").value = a.end_date;
    document.getElementById("end-time").value = a.end_time;
    document.getElementById("observations").value = a.observations;
    
    document.getElementById("btn-cancel-edit").classList.remove("hidden");
};

window.deleteAccess = async function(id) {
    if (confirm("¿Seguro que deseas eliminar este registro de acceso?")) {
        await fetch(`/accesses/api/${id}`, { method: "DELETE" });
        loadAccesses();
    }
};

function resetForm() {
    document.getElementById("access-form").reset();
    document.getElementById("acc-id").value = "";
    document.getElementById("form-title").innerText = "Registrar Nuevo Acceso";
    document.getElementById("btn-cancel-edit").classList.add("hidden");
}