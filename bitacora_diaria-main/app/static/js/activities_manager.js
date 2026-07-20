document.addEventListener("DOMContentLoaded", () => {
    loadActivities();

    const form = document.getElementById("activity-form");
    const cancelBtn = document.getElementById("btn-cancel-edit");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const id = document.getElementById("act-id").value;
        const payload = {
            ticket_number: document.getElementById("ticket").value,
            title: document.getElementById("title").value,
            client: document.getElementById("client").value,
            site: document.getElementById("site").value,
            type: document.getElementById("type").value,
            status: document.getElementById("status").value,
            request_date: document.getElementById("req-date").value,
            start_date: document.getElementById("start-date").value,
            start_time: document.getElementById("start-time").value + ":00", // FastAPI Time format
            end_date: document.getElementById("end-date").value || null,
            end_time: document.getElementById("end-time").value ? document.getElementById("end-time").value + ":00" : null,
            observations: document.getElementById("observations").value,
            is_approved: document.getElementById('is_approved').checked
        };

        const url = id ? `/activities/api/${id}` : `/activities/api`;
        const method = id ? "PUT" : "POST";

        try {
            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                resetForm();
                loadActivities();
            } else {
                showNotification('error',"Error al guardar los datos.");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    });

    cancelBtn.addEventListener("click", resetForm);
});

async function loadActivities() {
    const response = await fetch("/activities/api/active");
    const activities = await response.json();
    const tbody = document.getElementById("activities-body");
    tbody.innerHTML = "";

    activities.forEach(a => {
        const tr = document.createElement("tr");
        
        // Estilo condicional si está cancelado
        if (a.status === "Cancelado") tr.style.opacity = "0.5";

        tr.innerHTML = `
            <td><strong>${a.ticket_number}</strong><br><small>${a.client}</small></td>
            <td>${a.title}<br><small>📍 ${a.site}</small></td>
            <td>${a.start_date}<br>${a.start_time}</td>
            <td>${a.end_date || 'Sin definir'}<br>${a.end_time || ''}</td>
            <td><span class="badge ${a.status.replace(" ", "-")}">${a.status}</span></td>
            <td>
                <button onclick='editActivity(${JSON.stringify(a)})' class="btn-sm btn-edit">Editar</button>
                <button onclick='deleteActivity("${a.id}")' class="btn-sm btn-danger">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editActivity = function(a) {
    document.getElementById("form-title").innerText = "Modificar Planificación";
    document.getElementById("act-id").value = a.id;
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
    document.getElementById('is_approved').checked = actividadData.is_approved;
    document.getElementById('type').value = actividadData.type;
    toggleAprobacion();
};

window.deleteActivity = async function(id) {
    if (confirm("¿Seguro que deseas eliminar esta tarea planificada?")) {
        await fetch(`/activities/api/${id}`, { method: "DELETE" });
        loadActivities();
    }
};

function resetForm() {
    document.getElementById("activity-form").reset();
    document.getElementById("act-id").value = "";
    document.getElementById("form-title").innerText = "Nueva Planificación";
    document.getElementById("btn-cancel-edit").classList.add("hidden");
}