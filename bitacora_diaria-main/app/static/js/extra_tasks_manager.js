document.addEventListener("DOMContentLoaded", () => {
    loadTasks();

    const form = document.getElementById("extra-task-form");
    const cancelBtn = document.getElementById("btn-cancel-edit");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const id = document.getElementById("task-id").value;
        const payload = {
            title: document.getElementById("title").value,
            duration_hours: parseInt(document.getElementById("hours").value) || 0,
            duration_minutes: parseInt(document.getElementById("minutes").value) || 0,
            observations: document.getElementById("observations").value
        };

        // Validación simple para evitar guardar tareas con 0 horas y 0 minutos
        if (payload.duration_hours === 0 && payload.duration_minutes === 0) {
            showNotification('error',"Debes registrar al menos 1 minuto de tiempo empleado.");
            return;
        }

        const url = id ? `/extra-tasks/api/${id}` : `/extra-tasks/api`;
        const method = id ? "PUT" : "POST";

        try {
            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                resetForm();
                loadTasks();
            } else {
                showNotification('error',"Error al guardar la tarea.");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    });

    cancelBtn.addEventListener("click", resetForm);
});

async function loadTasks() {
    const response = await fetch("/extra-tasks/api/recent");
    const tasks = await response.json();
    const tbody = document.getElementById("tasks-body");
    tbody.innerHTML = "";

    tasks.forEach(t => {
        const tr = document.createElement("tr");
        
        // Formatear el tiempo visualmente (Ej. "1h 30m" o solo "45m")
        let timeString = "";
        if (t.duration_hours > 0) timeString += `${t.duration_hours}h `;
        if (t.duration_minutes > 0) timeString += `${t.duration_minutes}m`;
        if (timeString === "") timeString = "0m";

        tr.innerHTML = `
            <td><strong>${t.title}</strong></td>
            <td><span class="time-badge">⏱️ ${timeString.trim()}</span></td>
            <td>
                <button onclick='editTask(${JSON.stringify(t)})' class="btn-sm btn-edit">Editar</button>
                <button onclick='deleteTask("${t.id}")' class="btn-sm btn-danger">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editTask = function(t) {
    document.getElementById("form-title").innerText = "Modificar Tarea Extra";
    document.getElementById("task-id").value = t.id;
    document.getElementById("title").value = t.title;
    document.getElementById("hours").value = t.duration_hours;
    document.getElementById("minutes").value = t.duration_minutes;
    document.getElementById("observations").value = t.observations;
    
    document.getElementById("btn-cancel-edit").classList.remove("hidden");
};

window.deleteTask = async function(id) {
    if (confirm("¿Seguro que deseas eliminar esta tarea extra del turno?")) {
        await fetch(`/extra-tasks/api/${id}`, { method: "DELETE" });
        loadTasks();
    }
};

function resetForm() {
    document.getElementById("extra-task-form").reset();
    document.getElementById("task-id").value = "";
    // Restablecer valores numéricos por defecto a cero
    document.getElementById("hours").value = "0";
    document.getElementById("minutes").value = "0";
    document.getElementById("form-title").innerText = "Registrar Tarea Extra";
    document.getElementById("btn-cancel-edit").classList.add("hidden");
}