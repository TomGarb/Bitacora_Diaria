/**
 * Dashboard JS - Métricas, segmentación por equipos y resúmenes en vivo
 */

let equipoSeleccionadoId = null;

document.addEventListener('DOMContentLoaded', () => {
  setupTeamTabs();
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

function setupTeamTabs() {
  document.querySelectorAll('.team-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.team-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      equipoSeleccionadoId = btn.dataset.equipoId ? parseInt(btn.dataset.equipoId) : null;
      cargarEstadisticas();
    });
  });
}

function renderTeamTabs(equipos, activoId) {
  const container = document.getElementById('team-tabs-bar');
  if (!container || !equipos) return;

  container.innerHTML = '';

  // Tab consolidado
  const btnConsolidado = document.createElement('button');
  btnConsolidado.className = `team-tab-btn ${!activoId ? 'active' : ''}`;
  btnConsolidado.dataset.equipoId = '';
  btnConsolidado.innerHTML = '<i class="bi bi-buildings"></i> Consolidado Sede';
  btnConsolidado.addEventListener('click', () => {
    document.querySelectorAll('.team-tab-btn').forEach(b => b.classList.remove('active'));
    btnConsolidado.classList.add('active');
    equipoSeleccionadoId = null;
    cargarEstadisticas();
  });
  container.appendChild(btnConsolidado);

  // Tabs de equipos dinámicos
  equipos.forEach(eq => {
    const btn = document.createElement('button');
    btn.className = `team-tab-btn ${activoId === eq.id ? 'active' : ''}`;
    btn.dataset.equipoId = eq.id;
    btn.innerHTML = `<i class="bi bi-people-fill"></i> ${eq.nombre}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.team-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      equipoSeleccionadoId = eq.id;
      cargarEstadisticas();
    });
    container.appendChild(btn);
  });
}

async function cargarEstadisticas() {
  try {
    const url = equipoSeleccionadoId 
      ? `/api/dashboard/stats?equipo_id=${equipoSeleccionadoId}`
      : '/api/dashboard/stats';

    const data = await fetchAPI(url);
    if (!data) return;

    // Actualizar tabs si se recibieron de la API
    if (data.equipos_disponibles) {
      renderTeamTabs(data.equipos_disponibles, data.equipo_id_activo);
    }

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
        container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">No hay tareas registradas para este filtro (${data.equipo_seleccionado ? data.equipo_seleccionado.nombre : 'Sede General'}).</p>`;
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No hay tareas recientes cargadas para este equipo</td></tr>';
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
