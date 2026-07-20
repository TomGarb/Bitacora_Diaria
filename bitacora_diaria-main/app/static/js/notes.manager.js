document.addEventListener("DOMContentLoaded", () => {
    loadNotes();
    const form = document.getElementById("note-form");
    const cancelBtn = document.getElementById("btn-cancel-edit");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("note-id").value;
        const payload = {
            title: document.getElementById("title").value,
            priority: document.getElementById("priority").value,
            observations: document.getElementById("observations").value
        };

        const url = id ? `/notes/api/${id}` : `/notes/api`;
        const method = id ? "PUT" : "POST";

        try {
            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                resetForm();
                loadNotes();
            } else {
                showNotification('error',"Error al guardar la nota.");
            }
        } catch (error) { console.error("Error:", error); }
    });

    cancelBtn.addEventListener("click", resetForm);
});

async function loadNotes() {
    const response = await fetch("/notes/api/recent");
    const notes = await response.json();
    const tbody = document.getElementById("notes-body");
    tbody.innerHTML = "";

    notes.forEach(n => {
        const tr = document.createElement("tr");
        let badgeColor = n.priority === "Alta" ? "#ef4444" : (n.priority === "Baja" ? "#94a3b8" : "#3b82f6");
        
        tr.innerHTML = `
            <td style="font-weight: bold; color: #64748b;">${n.created_at}</td>
            <td>
                <strong>${n.title}</strong> 
                <span class="badge" style="background-color: ${badgeColor};">${n.priority}</span><br>
                <small>${n.observations}</small>
            </td>
            <td>
                <button onclick='editNote(${JSON.stringify(n)})' class="btn-sm btn-edit">Editar</button>
                <button onclick='deleteNote("${n.id}")' class="btn-sm btn-danger">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editNote = function(n) {
    document.getElementById("form-title").innerText = "Modificar Nota";
    document.getElementById("note-id").value = n.id;
    document.getElementById("title").value = n.title;
    document.getElementById("priority").value = n.priority;
    document.getElementById("observations").value = n.observations;
    document.getElementById("btn-cancel-edit").classList.remove("hidden");
};

window.deleteNote = async function(id) {
    if (confirm("¿Seguro que deseas eliminar esta nota?")) {
        await fetch(`/notes/api/${id}`, { method: "DELETE" });
        loadNotes();
    }
};

function resetForm() {
    document.getElementById("note-form").reset();
    document.getElementById("note-id").value = "";
    document.getElementById("priority").value = "Media";
    document.getElementById("form-title").innerText = "Nueva Nota";
    document.getElementById("btn-cancel-edit").classList.add("hidden");
}