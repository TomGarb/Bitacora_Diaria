/**
 * Dashboard JS - Métricas y resúmenes en vivo
 */

document.addEventListener('DOMContentLoaded', () => {
  cargarEstadisticas();

  const refreshBtn = document.getElementById('btn-refresh-dashboard');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.querySelector('i').classList.add('bi-spin');
      cargarEstadisticas().finally(() => {
        setTimeout(() => refreshBtn.querySelector('i').classList.remove('bi-spin'), 600);
      });
    });
  }
});

async function cargarEstadisticas() {
  try {
    const data = await fetchAPI('/api/dashboard/stats');
    if (!data) return;

    // Actualizar KPIs
    document.getElementById('kpi-total').textContent = data.kpis.total_tareas;
    document.getElementById('kpi-pendientes').textContent = data.kpis.pendientes;
    document.getElementById('kpi-en-progreso').textContent = data.kpis.en_progreso;
    document.getElementById('kpi-completadas').textContent = data.kpis.completadas;
    document.getElementById('kpi-programadas').textContent = data.kpis.programadas;
    document.getElementById('kpi-mis-tareas').textContent = data.kpis.mis_tareas;

    // Actualizar barras de distribución
    const container = document.getElementById('type-distribution-container');
    if (container) {
      container.innerHTML = '';
      const total = data.kpis.total_tareas || 1;
      const tipos = Object.entries(data.distribucion_tipos);

      if (tipos.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No hay tareas registradas en esta bitácora.</p>';
      } else {
        tipos.sort((a, b) => b[1] - a[1]).forEach(([tipo, count]) => {
          const pct = Math.round((count / total) * 100);
          const tipoFormateado = tipo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

          const item = document.createElement('div');
          item.className = 'type-item';
          item.innerHTML = `
            <div class="type-header">
              <span class="type-name">${tipoFormateado}</span>
              <span class="type-count">${count} (${pct}%)</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
          `;
          container.appendChild(item);
        });
      }
    }

    // Actualizar tabla de tareas recientes
    const tbody = document.getElementById('recent-tasks-tbody');
    if (tbody && data.ultimas_tareas) {
      tbody.innerHTML = '';
      if (data.ultimas_tareas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No hay tareas recientes cargadas</td></tr>';
      } else {
        data.ultimas_tareas.forEach(tarea => {
          const tr = document.createElement('tr');
          const tipoLabel = tarea.tipo_tarea.replace(/_/g, ' ');
          tr.innerHTML = `
            <td><strong style="color:var(--primary);">${tarea.ticket}</strong></td>
            <td>
              <div><strong>${tarea.titulo}</strong></div>
              <small style="color:var(--text-secondary);">${tarea.cliente}</small>
            </td>
            <td><span class="badge badge-programada" style="background:var(--bg-surface-hover); color:var(--text-secondary);">${tipoLabel}</span></td>
            <td><span class="badge badge-${tarea.estado}">${tarea.estado.replace('_', ' ')}</span></td>
            <td><small>${tarea.operador_nombre}</small></td>
            <td>
              ${tarea.es_actividad_programada ? '<span class="badge badge-programada"><i class="bi bi-clock"></i> Programada</span>' : '<span style="color:var(--text-muted);">-</span>'}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

  } catch (error) {
    console.error('Error cargando estadísticas del dashboard:', error);
  }
}
