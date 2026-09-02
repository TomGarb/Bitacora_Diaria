/**
 * TV Planificadas JS - Cartelera de Tareas y Mantenimientos Planificados del Día
 */

const REFRESH_INTERVAL_MS = 30000; // Refresco cada 30 segundos
const SCROLL_STEP_DELAY_MS = 3500; // Desplazamiento cada 3.5 segundos

let regionId = 1;
let scrollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  regionId = document.getElementById('tv-region-id')?.value || 1;
  
  iniciarReloj();
  cargarDatosPlanificadas();
  setInterval(cargarDatosPlanificadas, REFRESH_INTERVAL_MS);
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

async function cargarDatosPlanificadas() {
  try {
    const res = await fetch(`/api/tv/${regionId}/planificadas`);
    if (!res.ok) return;
    const data = await res.json();

    // Actualizar contadores
    document.getElementById('stat-total-plan').textContent = data.total_planificadas || 0;
    document.getElementById('stat-en-curso').textContent = data.en_curso_count || 0;
    if (data.turno) document.getElementById('tv-shift-label').textContent = `TURNO ${data.turno}`;

    renderPlanificadas(data.planificadas || []);

  } catch (error) {
    console.error('Error actualizando TV Planificadas:', error);
  }
}

function renderPlanificadas(lista) {
  const wrapper = document.getElementById('rows-wrapper');
  if (!wrapper) return;

  clearInterval(scrollInterval);
  wrapper.style.transform = 'translateY(0px)';
  wrapper.innerHTML = '';

  if (lista.length === 0) {
    wrapper.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh; color:var(--tv-text-muted); font-size:1.4rem; gap:1rem;">
        <i class="bi bi-calendar2-check-fill" style="font-size:3.5rem; color:var(--tv-neon-cyan);"></i>
        <div>No hay tareas o mantenimientos planificados registrados para hoy</div>
      </div>
    `;
    return;
  }

  lista.forEach(item => {
    const row = document.createElement('div');
    row.className = `tv-board-row ${item.estado_tiempo}`;

    let statusBadgeText = 'PRÓXIMA';
    if (item.estado_tiempo === 'en_curso') statusBadgeText = 'EN CURSO';
    if (item.estado_tiempo === 'pasada') statusBadgeText = 'FINALIZADA';

    row.innerHTML = `
      <div class="col-horario">
        <i class="bi bi-clock-fill" style="color:var(--tv-neon-cyan);"></i>
        <span>${item.hora_inicio} — ${item.hora_fin}</span>
      </div>

      <div class="col-ticket">
        ${item.ticket}
      </div>

      <div class="col-cliente" title="${item.cliente}">
        ${item.cliente}
      </div>

      <div>
        <span class="col-tipo">${item.tipo_label}</span>
      </div>

      <div class="col-detalle">
        <div class="col-titulo">${item.titulo}</div>
        <div class="col-desc" title="${item.descripcion}">${item.descripcion}</div>
      </div>

      <div class="col-sitio">
        <i class="bi bi-geo-alt-fill"></i>
        <span>${item.sitio}</span>
      </div>

      <div class="col-estado">
        <span class="tv-badge-time badge-${item.estado_tiempo}">${statusBadgeText}</span>
      </div>
    `;
    wrapper.appendChild(row);
  });

  // Configurar auto-scroll si excede
  configurarAutoScrollBoard();
}

function configurarAutoScrollBoard() {
  const viewport = document.getElementById('board-viewport');
  const wrapper = document.getElementById('rows-wrapper');
  if (!viewport || !wrapper) return;

  setTimeout(() => {
    const vHeight = viewport.clientHeight;
    const wHeight = wrapper.scrollHeight;

    if (wHeight > vHeight) {
      let currentOffset = 0;
      const scrollStep = 90; // Desplazamiento aproximado por fila
      const maxScroll = wHeight - vHeight + 40;

      scrollInterval = setInterval(() => {
        currentOffset += scrollStep;
        if (currentOffset > maxScroll) {
          currentOffset = 0;
        }
        wrapper.style.transform = `translateY(-${currentOffset}px)`;
      }, SCROLL_STEP_DELAY_MS);
    }
  }, 1000);
}
