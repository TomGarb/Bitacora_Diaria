/**
 * Perfil JS - Carga del perfil de usuario y equipo de la sede
 */

document.addEventListener('DOMContentLoaded', () => {
  cargarEquipo();
});

async function cargarEquipo() {
  try {
    const data = await fetchAPI('/api/perfil/equipo');
    if (!data) return;

    // 1. Renderizar Supervisores
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

    // 2. Renderizar Compañeros de Equipo
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
