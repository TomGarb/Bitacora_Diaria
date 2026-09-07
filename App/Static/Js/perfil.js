/**
 * Perfil JS - Carga del perfil de usuario, sus equipos y compañeros de sede
 */

document.addEventListener('DOMContentLoaded', () => {
  cargarEquipo();
});

async function cargarEquipo() {
  try {
    const data = await fetchAPI('/api/perfil/equipo');
    if (!data) return;

    // 1. Actualizar contador KPI de Total Casos Normales (No planificados)
    const statCasos = document.getElementById('stat-casos-normales');
    if (statCasos && data.total_casos_normales !== undefined) {
      statCasos.textContent = data.total_casos_normales;
    }

    // 2. Renderizar Mis Equipos y Compañeros por Equipo
    const badgesContainer = document.getElementById('mis-equipos-badges');
    const teamsContainer = document.getElementById('equipos-cards-container');

    if (badgesContainer && teamsContainer) {
      badgesContainer.innerHTML = '';
      teamsContainer.innerHTML = '';

      if (!data.mis_equipos || data.mis_equipos.length === 0) {
        badgesContainer.innerHTML = '<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-muted); font-size: 0.75rem;">Sin equipo asignado</span>';
        teamsContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding: 0.5rem 0;">Actualmente no te encuentras asignado a ningún equipo específico en esta sede.</p>';
      } else {
        data.mis_equipos.forEach(eq => {
          // Badge en header
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.style.background = 'rgba(14, 165, 233, 0.18)';
          badge.style.color = 'var(--primary)';
          badge.style.border = '1px solid rgba(14, 165, 233, 0.4)';
          badge.style.fontWeight = '700';
          badge.innerHTML = `<i class="bi bi-diagram-3-fill"></i> ${eq.nombre}`;
          badgesContainer.appendChild(badge);

          // Tarjeta de Grupo con Compañeros
          const teamCard = document.createElement('div');
          teamCard.className = 'team-group-card';

          let membersHtml = '';
          if (eq.companeros_equipo && eq.companeros_equipo.length > 0) {
            membersHtml = `
              <div style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); margin-bottom:0.6rem;">
                <i class="bi bi-people-fill"></i> Compañeros en este equipo (${eq.companeros_equipo.length}):
              </div>
              <div class="team-sub-members">
                ${eq.companeros_equipo.map(m => `
                  <div class="member-card" style="padding: 0.65rem 0.85rem;">
                    <div class="member-avatar" style="width:36px; height:36px; font-size:0.85rem; color:var(--primary); border-color:rgba(14, 165, 233, 0.3);">
                      ${m.nombre_completo.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="member-info">
                      <div class="member-name" style="font-size:0.85rem;">${m.nombre_completo}</div>
                      <div class="member-role" style="font-size:0.75rem;">
                        <span>${m.email}</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `;
          } else {
            membersHtml = `
              <div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">
                <i class="bi bi-info-circle"></i> Eres el único operador actualmente asignado a este equipo en la sede.
              </div>
            `;
          }

          teamCard.innerHTML = `
            <div class="team-group-header">
              <div class="team-group-title">
                <i class="bi bi-diagram-3-fill" style="color:var(--primary);"></i>
                <span>${eq.nombre}</span>
              </div>
              <span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-secondary); font-size: 0.75rem;">
                Total miembros: ${eq.total_miembros || 1}
              </span>
            </div>
            <div style="color:var(--text-secondary); font-size:0.82rem; margin-bottom: 0.85rem;">
              ${eq.descripcion || 'Equipo de operaciones especializadas en Datacenter'}
            </div>
            ${membersHtml}
          `;
          teamsContainer.appendChild(teamCard);
        });
      }
    }

    // 3. Renderizar Supervisores
    const supContainer = document.getElementById('supervisores-grid');
    if (supContainer) {
      supContainer.innerHTML = '';
      if (!data.supervisores || data.supervisores.length === 0) {
        supContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No hay supervisores asignados a esta sede.</p>';
      } else {
        data.supervisores.forEach(s => {
          const card = document.createElement('div');
          card.className = 'member-card';
          card.innerHTML = `
            <div class="member-avatar" style="color:var(--purple); border-color:rgba(139, 92, 246, 0.4);">
              ${s.nombre_completo.substring(0, 2).toUpperCase()}
            </div>
            <div class="member-info">
              <div class="member-name">${s.nombre_completo}</div>
              <div class="member-role">
                <span class="badge badge-programada">Supervisor DOC</span>
                <span>${s.email}</span>
              </div>
            </div>
          `;
          supContainer.appendChild(card);
        });
      }
    }

    // 4. Renderizar Compañeros de la Sede / Datacenter
    const compContainer = document.getElementById('companeros-grid');
    if (compContainer) {
      compContainer.innerHTML = '';
      const companeros = data.companeros_sitio || data.companeros || [];
      if (companeros.length === 0) {
        compContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No hay otros operadores registrados en esta sede.</p>';
      } else {
        companeros.forEach(c => {
          const card = document.createElement('div');
          card.className = 'member-card';
          card.innerHTML = `
            <div class="member-avatar" style="color:var(--primary);">
              ${c.nombre_completo.substring(0, 2).toUpperCase()}
            </div>
            <div class="member-info">
              <div class="member-name">${c.nombre_completo}</div>
              <div class="member-role">
                <span class="badge badge-en_progreso">Operador</span>
                <span>${c.email}</span>
              </div>
            </div>
          `;
          compContainer.appendChild(card);
        });
      }
    }

  } catch (error) {
    console.error('Error cargando datos de perfil y equipo:', error);
  }
}
