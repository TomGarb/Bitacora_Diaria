document.addEventListener("DOMContentLoaded", () => {
    loadCases();

    const caseForm = document.getElementById("case-form");
    const cancelEditBtn = document.getElementById("btn-cancel-edit");
    const subtaskForm = document.getElementById("subtask-form");

    // Guardar Caso Padre
    caseForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const caseId = document.getElementById("case-id").value;
        const payload = {
            ticket_number: document.getElementById("ticket").value,
            title: document.getElementById("title").value,
            client: document.getElementById("client").value,
            status: document.getElementById("status").value,
            observations: document.getElementById("observations").value
        };

        const url = caseId ? `/cases/api/${caseId}` : `/cases/api`;
        const method = caseId ? "PUT" : "POST";

        await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        resetForm();
        loadCases();
    });

    cancelEditBtn.addEventListener("click", resetForm);

    // Guardar Subtarea desde el Modal
    subtaskForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const caseId = document.getElementById("modal-case-id").value;
        
        const payload = {
            subtask_number: document.getElementById("st-ticket").value,
            title: document.getElementById("st-title").value,
            status: document.getElementById("st-status").value,
            observations: document.getElementById("st-obs").value
        };

        const response = await fetch(`/cases/api/${caseId}/subtasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            closeSubtaskModal();
            loadCases(); // Recarga la tabla para mostrar la nueva subtarea
        }
    });
});

// Cargar tabla con Acordeón
async function loadCases() {
    const response = await fetch("/cases/api/recent");
    const cases = await response.json();
    const tbody = document.getElementById("cases-body");
    tbody.innerHTML = "";

    cases.forEach(c => {
        const tr = document.createElement("tr");
        
        // Botones dinámicos
        const toggleBtn = c.subtasks.length > 0 
            ? `<button onclick='toggleSubtasks("${c.id}")' class="btn-sm btn-dark">🔽 Subtareas (${c.subtasks.length})</button>` 
            : '';
            
        tr.innerHTML = `
            <td><strong>${c.ticket_number}</strong></td>
            <td>${c.client}</td>
            <td>${c.title}</td>
            <td><span class="badge ${c.status.replace(" ", "-")}">${c.status}</span></td>
            <td>
                ${toggleBtn}
                <button onclick='openSubtaskModal("${c.id}", "${c.ticket_number}")' class="btn-sm btn-info">+ Subtarea</button>
                <button onclick='editCase(${JSON.stringify(c)})' class="btn-sm btn-edit">Editar</button>
                <button onclick='deleteCase("${c.id}")' class="btn-sm btn-danger">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);

        // Fila oculta de subtareas (Acordeón)
        if (c.subtasks.length > 0) {
            const stRow = document.createElement("tr");
            stRow.id = `subtasks-for-${c.id}`;
            stRow.className = "subtask-row hidden"; // Oculto por defecto
            
            const stContent = c.subtasks.map(st => `
                <tr>
                    <td style="width: 15%;">↳ <strong>${st.subtask_number}</strong></td>
                    <td>${st.title}</td>
                    <td style="width: 15%;"><span class="badge ${st.status.replace(" ", "-")}">${st.status}</span></td>
                </tr>
            `).join("");

            stRow.innerHTML = `<td colspan="5"><table class="subtask-table"><tbody>${stContent}</tbody></table></td>`;
            tbody.appendChild(stRow);
        }
    });
}

// Funciones del Modal
window.openSubtaskModal = function(caseId, ticketNumber) {
    document.getElementById("modal-case-id").value = caseId;
    document.getElementById("modal-case-ticket").innerText = ticketNumber;
    document.getElementById("subtask-modal").classList.remove("hidden");
};

window.closeSubtaskModal = function() {
    document.getElementById("subtask-form").reset();
    document.getElementById("subtask-modal").classList.add("hidden");
};

// Función para abrir/cerrar el acordeón
window.toggleSubtasks = function(caseId) {
    const row = document.getElementById(`subtasks-for-${caseId}`);
    if (row) row.classList.toggle("hidden");
};

window.editCase = function(c) {
    document.getElementById("case-id").value = c.id;
    document.getElementById("ticket").value = c.ticket_number;
    document.getElementById("title").value = c.title;
    document.getElementById("client").value = c.client;
    document.getElementById("status").value = c.status;
    document.getElementById("observations").value = c.observations || "";
    document.getElementById("btn-cancel-edit").classList.remove("hidden");
};

window.deleteCase = async function(id) {
    if (confirm("¿Eliminar este caso?")) {
        await fetch(`/cases/api/${id}`, { method: "DELETE" });
        loadCases();
    }
};

function resetForm() {
    document.getElementById("case-form").reset();
    document.getElementById("case-id").value = "";
    document.getElementById("btn-cancel-edit").classList.add("hidden");
}