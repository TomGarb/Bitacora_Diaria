let allHistoryData = [];

document.addEventListener("DOMContentLoaded", () => {
    fetchHistory();

    // Eventos para filtrar en tiempo real
    document.getElementById("filter-type").addEventListener("change", renderTable);
    document.getElementById("search-box").addEventListener("keyup", renderTable);
});

async function fetchHistory() {
    try {
        const response = await fetch("/history/api/data");
        allHistoryData = await response.json();
        renderTable();
    } catch (error) {
        console.error("Error cargando histórico:", error);
        document.getElementById("history-body").innerHTML = `<tr><td colspan="9" class="empty-msg" style="color:red !important;">Error de conexión.</td></tr>`;
    }
}

function renderTable() {
    const tbody = document.getElementById("history-body");
    const typeFilter = document.getElementById("filter-type").value;
    const searchTerm = document.getElementById("search-box").value.toLowerCase();
    
    tbody.innerHTML = "";

    // Aplicar filtros
    const filteredData = allHistoryData.filter(item => {
        const matchesType = typeFilter === "Todos" || item.type === typeFilter;
        const searchString = `${item.title} ${item.ticket} ${item.observations}`.toLowerCase();
        const matchesSearch = searchString.includes(searchTerm);
        
        return matchesType && matchesSearch;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-msg">No se encontraron registros que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    filteredData.forEach(item => {
        const tr = document.createElement("tr");
        
        // Estilos de color (Badges) según el tipo
        let typeBadge = "";
        if (item.type === "Caso") typeBadge = `<span class="badge" style="background:#ef4444;">${item.type}</span>`;
        if (item.type === "Subtarea") typeBadge = `<span class="badge" style="background:#f59e0b;">${item.type}</span>`;
        if (item.type === "Tarea Extra") typeBadge = `<span class="badge" style="background:#64748b;">${item.type}</span>`;
        if (item.type === "Nota") typeBadge = `<span class="badge" style="background:#d946ef;">${item.type}</span>`;

        // Formatear fechas
        const createdDate = new Date(item.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
        const modifiedDate = new Date(item.modified_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

        tr.innerHTML = `
            <td>${typeBadge}</td>
            <td><strong>${item.ticket}</strong></td>
            <td>${item.title}</td>
            <td class="history-obs" title="Haz clic o mantén el ratón para expandir">${item.observations}</td>
            <td style="color:#64748b;">${createdDate}</td>
            <td style="color:#64748b;">${modifiedDate}</td>
            <td>👤 ${item.created_by}</td>
            <td>👤 ${item.modified_by}</td>
            <td><small>${item.shift}</small></td>
        `;
        tbody.appendChild(tr);
    });
}

