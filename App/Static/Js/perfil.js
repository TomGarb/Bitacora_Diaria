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

    // 1. Renderizar Mis Equipos en la cabecera y tarjetas
    const badgesContainer = document.getElementById('mis-equipos-badges');
    const cardsContainer = document.getElementById('equipos-cards-grid');

    if (badgesContainer && cardsContainer) {
      badgesContainer.innerHTML = '';
      cardsContainer.innerHTML = '';

      if (!data.mis_equipos || data.mis_equipos.length === 0) {
        badgesContainer.innerHTML = '<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-muted); font-size: 0.75rem;">Sin equipo asignado</span>';
        cardsContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Actualmente no te encuentras asignado a ningún grupo específico en esta sede.</p>';
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

          // Tarjeta de equipo
          const card = document.createElement('div');
          card.className = 'member-card';
          card.innerHTML = `
            <div class="member-avatar" style="color:var(--primary); border-color:rgba(14, 165, 233, 0.4); background:rgba(14, 165, 233, 0.1);">
              <i class="bi bi-people-fill" style="font-size:1.2rem;"></i>
            </div>
            <div class="member-info">
              <div class="member-name">${eq.nombre}</div>
              <div class="member-role" style="color:var(--text-secondary); font-size:0.8rem;">
                ${eq.descripcion || 'Grupo de operaciones especializadas en Datacenter'}
              </div>
            </div>
          `;
          cardsContainer.appendChild(card);
        });
      }
    }

    // 2. Renderizar Supervisores
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

    // 3. Renderizar Compañeros de Equipo
    const compContainer = document.getElementById('companeros-grid');
    if (compContainer) {
      compContainer.innerHTML = '';
      if (!data.companeros || data.companeros.length === 0) {
        compContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No hay otros operadores registrados en esta sede.</p>';
      } else {
        data.companeros.forEach(c => {
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
