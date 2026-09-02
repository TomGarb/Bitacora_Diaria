/**
 * TV Credenciales JS - Dashboard pasivo de Credenciales Especiales Activas
 */

const REFRESH_INTERVAL_MS = 30000; // Refresco cada 30s
const SCROLL_STEP_DELAY_MS = 4000; // Desplazamiento cada 4s

let regionId = 1;
let scrollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  regionId = document.getElementById('tv-region-id')?.value || 1;
  
  iniciarReloj();
  cargarDatosCredenciales();
  setInterval(cargarDatosCredenciales, REFRESH_INTERVAL_MS);
});

function iniciarReloj() {
  const clockEl = document.getElementById('tv-clock');
  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;
  }
  update();
  setInterval(update, 1000);
}

async function cargarDatosCredenciales() {
  try {
    const res = await fetch(`/api/tv/${regionId}/credenciales`);
    if (!res.ok) return;
    const data = await res.json();

    // Actualizar contadores
    document.getElementById('count-activas').textContent = data.total_activas || 0;
    document.getElementById('count-total').textContent = data.total_credenciales || 0;
    if (data.turno) document.getElementById('tv-shift-label').textContent = `TURNO ${data.turno}`;

    renderCredenciales(data.credenciales || []);

  } catch (error) {
    console.error('Error actualizando TV Credenciales:', error);
  }
}

function renderCredenciales(lista) {
  const grid = document.getElementById('credenciales-grid');
  if (!grid) return;

  clearInterval(scrollInterval);
  grid.style.transform = 'translateY(0px)';
  grid.innerHTML = '';

  if (lista.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh; color:var(--tv-text-muted); font-size:1.4rem; gap:1rem;">
        <i class="bi bi-key-fill" style="font-size:3.5rem; color:var(--tv-neon-purple);"></i>
        <div>No hay credenciales especiales activas o programadas para el día de hoy</div>
      </div>
    `;
    return;
  }

  lista.forEach(c => {
    const card = document.createElement('div');
    card.className = `tv-cred-card ${c.estado_vigencia}`;

    let statusLabel = 'VIGENTE AHORA';
    if (c.estado_vigencia === 'programada') statusLabel = 'PROGRAMADA';
    if (c.estado_vigencia === 'finalizada') statusLabel = 'FINALIZADA';

    card.innerHTML = `
      <div class="tv-cred-header">
        <div>
          <div class="tv-cred-persona">${c.persona_propietaria}</div>
          <div class="tv-cred-cliente">${c.cliente}</div>
        </div>
        <div class="tv-status-badge badge-${c.estado_vigencia}">${statusLabel}</div>
      </div>

      <div class="tv-cred-code-box">
        <div class="tv-cred-code-label">Código Alfanumérico de Acceso</div>
        <div class="tv-cred-code-value">${c.codigo_alfanumerico}</div>
      </div>

      <div class="tv-cred-footer">
        <div class="tv-cred-window">
          <i class="bi bi-clock-history" style="color:var(--tv-neon-cyan);"></i>
          <span>${c.hora_inicio} a ${c.hora_fin}</span>
        </div>
        <div class="tv-cred-ticket-cli">
          <i class="bi bi-tag-fill"></i> ${c.ticket_cliente}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Configurar auto-scroll si excede
  configurarAutoScrollCredenciales();
}

function configurarAutoScrollCredenciales() {
  const container = document.getElementById('viewport-container');
  const grid = document.getElementById('credenciales-grid');
  if (!container || !grid) return;

  setTimeout(() => {
    const cHeight = container.clientHeight;
    const gHeight = grid.scrollHeight;

    if (gHeight > cHeight) {
      let currentOffset = 0;
      const scrollStep = 220;
      const maxScroll = gHeight - cHeight + 50;

      scrollInterval = setInterval(() => {
        currentOffset += scrollStep;
        if (currentOffset > maxScroll) {
          currentOffset = 0;
        }
        grid.style.transform = `translateY(-${currentOffset}px)`;
      }, SCROLL_STEP_DELAY_MS);
    }
  }, 1000);
}
