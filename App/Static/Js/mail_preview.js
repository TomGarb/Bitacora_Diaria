/**
 * Mail Preview JS - Vista previa del mail de resumen con reglas de visibilidad por rol
 */

document.addEventListener('DOMContentLoaded', () => {
  cargarVistaPreviaMail();

  document.getElementById('selector-bitacora-mail')?.addEventListener('change', (e) => {
    cargarVistaPreviaMail(e.target.value);
  });

  document.getElementById('btn-copy-mail')?.addEventListener('click', copiarContenidoMail);
  document.getElementById('btn-send-simulated-mail')?.addEventListener('click', simularEnvioMail);
});

async function cargarVistaPreviaMail(bitacoraId = '') {
  const container = document.getElementById('mail-tasks-container');
  if (!container) return;

  try {
    const url = bitacoraId ? `/api/mail-preview/data?bitacora_id=${bitacoraId}` : '/api/mail-preview/data';
    const data = await fetchAPI(url);

    if (!data || !data.bitacora) {
      document.getElementById('mail-subject').textContent = 'Sin bitácora activa';
      container.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;">No hay registros disponibles para generar el mail de resumen.</div>';
      return;
    }

    // Cabecera del Mail
    document.getElementById('mail-to').textContent = data.destinatarios_sugeridos;
    document.getElementById('mail-subject').textContent = data.asunto;
    document.getElementById('mail-generated-by').textContent = `${data.generado_por} (${data.generado_en})`;
    document.getElementById('mail-region-name').textContent = data.region_nombre;
    document.getElementById('mail-shift-name').textContent = `TURNO ${data.bitacora.turno.toUpperCase()}`;
    document.getElementById('mail-date-name').textContent = data.bitacora.fecha;

    // Resumen numérico
    document.getElementById('stat-total').textContent = data.estadisticas.total;
    document.getElementById('stat-comp').textContent = data.estadisticas.completadas;
    document.getElementById('stat-prog').textContent = data.estadisticas.en_progreso;
    document.getElementById('stat-pend').textContent = data.estadisticas.pendientes;
    document.getElementById('stat-prog-act').textContent = data.estadisticas.programadas;

    // Regla de Visibilidad Banner
    const visBanner = document.getElementById('mail-visibility-banner');
    if (visBanner) {
      if (data.es_vista_operador) {
        visBanner.innerHTML = `
          <i class="bi bi-shield-check"></i>
          <span><strong>Vista de Operador:</strong> Mostrando únicamente tus tareas asignadas (${data.estadisticas.total - data.estadisticas.programadas}) + todas las actividades programadas del Datacenter (${data.estadisticas.programadas}).</span>
        `;
      } else {
        visBanner.innerHTML = `
          <i class="bi bi-person-badge"></i>
          <span><strong>Vista de Supervisión / Admin:</strong> Mostrando el resumen consolidado de todas las tareas del equipo para el turno.</span>
        `;
      }
    }

    // Tareas
    container.innerHTML = '';
    if (data.tareas.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;">No hay tareas que coincidan con sus criterios de visibilidad.</div>';
      return;
    }

    data.tareas.forEach(t => {
      const card = document.createElement('div');
      card.className = `mail-task-card ${t.es_actividad_programada ? 'is-programada' : ''}`;

      // Extra fields format
      let extraHtml = '';
      if (t.campos_extra && Object.keys(t.campos_extra).length > 0) {
        extraHtml = '<div style="margin-top:0.5rem; background:#f8fafc; padding:0.5rem; border-radius:4px; font-size:0.8rem; border:1px solid #e2e8f0;">';
        for (const [k, v] of Object.entries(t.campos_extra)) {
          if (v) {
            extraHtml += `<div style="margin-bottom:2px;"><strong>${k.replace(/_/g, ' ')}:</strong> <span style="font-family:monospace; background:#e2e8f0; padding:1px 4px; border-radius:3px;">${v}</span></div>`;
          }
        }
        extraHtml += '</div>';
      }

      // Subtareas format
      let subHtml = '';
      if (t.subtareas && t.subtareas.length > 0) {
        subHtml = '<div style="margin-top:0.5rem; padding-left:0.5rem; border-left:2px solid #cbd5e1; font-size:0.8rem;">';
        subHtml += '<strong style="color:#475569;">Subtareas asociadas:</strong>';
        t.subtareas.forEach(s => {
          subHtml += `<div style="margin-top:2px;">• <strong>${s.ticket}:</strong> ${s.titulo} <span style="color:#64748b;">[${s.estado}]</span></div>`;
        });
        subHtml += '</div>';
      }

      // Banner programada
      let progTag = '';
      if (t.es_actividad_programada) {
        progTag = `<span class="mail-badge mail-badge-prog"><i class="bi bi-clock"></i> ACTIVIDAD PROGRAMADA (${t.fecha_programada_inicio || 'Horario a confirmar'})</span>`;
      }

      card.innerHTML = `
        <div class="mail-task-header">
          <div>
            <strong style="color:#1e40af; font-size:0.95rem;">[${t.ticket}] ${t.titulo}</strong>
            <div style="font-size:0.8rem; color:#64748b;">Cliente: <strong>${t.cliente}</strong> | Tipo: <strong>${t.tipo_tarea.replace(/_/g, ' ')}</strong> | Operador: <strong>${t.operador_nombre}</strong></div>
          </div>
          <div>
            <span class="mail-badge mail-badge-${t.estado}">${t.estado.replace('_', ' ')}</span>
          </div>
        </div>

        <div style="font-size:0.85rem; color:#334155; margin-top:0.4rem; white-space:pre-wrap;">${t.descripcion}</div>

        ${progTag}
        ${extraHtml}
        ${subHtml}
      `;
      container.appendChild(card);
    });

  } catch (error) {
    console.error('Error cargando vista previa de correo:', error);
  }
}

function copiarContenidoMail() {
  const mailContent = document.getElementById('mail-printable-area').innerText;
  navigator.clipboard.writeText(mailContent).then(() => {
    showToast('Contenido del mail copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('No se pudo copiar el texto', 'warning');
  });
}

function simularEnvioMail() {
  showToast('Módulo de envío preparado: En producción esto enviará el correo mediante SMTP / servicio corporativo.', 'info', 5000);
}
