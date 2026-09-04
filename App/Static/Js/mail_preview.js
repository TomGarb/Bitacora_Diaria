/**
 * Mail Preview JS - Renderizador de tablas ejecutivas para el mail de resumen de turno
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
  try {
    const url = bitacoraId ? `/api/mail-preview/data?bitacora_id=${bitacoraId}` : '/api/mail-preview/data';
    const data = await fetchAPI(url);

    if (!data || !data.bitacora) {
      document.getElementById('mail-subject').textContent = 'Sin bitácora activa';
      return;
    }

    // Cabecera del Mail
    document.getElementById('mail-to').textContent = data.destinatarios_sugeridos;
    document.getElementById('mail-subject').textContent = data.asunto;
    document.getElementById('mail-generated-by').textContent = `${data.generado_por} (${data.generado_en})`;
    document.getElementById('mail-region-name').textContent = data.region_nombre;
    document.getElementById('mail-shift-name').textContent = `TURNO ${data.bitacora.turno.toUpperCase()}`;
    document.getElementById('mail-date-name').textContent = data.bitacora.fecha;

    // Resumen numérico de contadores
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
          <span><strong>Vista de Operador:</strong> Mostrando únicamente tus tareas asignadas + todas las actividades programadas del Datacenter.</span>
        `;
      } else {
        visBanner.innerHTML = `
          <i class="bi bi-person-badge"></i>
          <span><strong>Vista de Supervisión / Admin:</strong> Mostrando el resumen consolidado de todas las tareas del equipo de operaciones.</span>
        `;
      }
    }

    const sec = data.secciones;

    // 1. NOTAS DE TURNO (ARRIBA DE TODO)
    const secNotas = document.getElementById('section-notas-turno');
    const notasContent = document.getElementById('notas-turno-content');
    
    let notasHtml = '';
    if (data.observaciones_cierre_bitacora) {
      notasHtml += `<div style="margin-bottom:0.5rem;"><strong>Novedades de Cierre de Turno:</strong> ${data.observaciones_cierre_bitacora}</div>`;
    }
    if (sec.notas_turno && sec.notas_turno.length > 0) {
      sec.notas_turno.forEach(n => {
        notasHtml += `<div style="margin-top:0.4rem; padding-top:0.4rem; border-top:1px dashed #bfdbfe;"><strong>[${n.ticket}] ${n.titulo}:</strong> ${n.descripcion} <small style="color:#64748b;">(Cargado por: ${n.operador_nombre})</small></div>`;
      });
    }

    if (notasHtml) {
      secNotas.style.display = 'block';
      notasContent.innerHTML = notasHtml;
    } else {
      secNotas.style.display = 'none';
    }

    // 2. CASOS DEL OPERADOR DEL TURNO
    const tbodyCasos = document.getElementById('tbody-casos-operador');
    tbodyCasos.innerHTML = '';
    if (sec.casos_operador.length === 0) {
      tbodyCasos.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay tareas generales en este turno</td></tr>';
    } else {
      sec.casos_operador.forEach(t => {
        let subHtml = renderSubtareasInline(t);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#2563eb;">${t.ticket}</strong></td>
          <td><strong>${t.cliente}</strong></td>
          <td>${t.titulo}</td>
          <td><span style="font-size:0.75rem; text-transform:capitalize; background:#f1f5f9; padding:2px 6px; border-radius:3px;">${t.tipo_tarea.replace(/_/g, ' ')}</span></td>
          <td>
            <div>${t.descripcion}</div>
            ${subHtml}
          </td>
          <td style="text-align:center;"><span class="m-badge m-badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
        `;
        tbodyCasos.appendChild(tr);
      });
    }

    // 3. ACTIVIDADES PROGRAMADAS
    // 3.1 Ingresos y Retiros de Equipos
    const tbodyEquipos = document.getElementById('tbody-prog-equipos');
    tbodyEquipos.innerHTML = '';
    if (sec.programados_equipos.length === 0) {
      tbodyEquipos.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b;">Sin ingresos/retiros de equipos programados</td></tr>';
    } else {
      sec.programados_equipos.forEach(t => {
        const sala = t.campos_extra?.sala_datacenter || 'No especificada';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#2563eb;">${t.ticket}</strong></td>
          <td><strong>${t.cliente}</strong></td>
          <td><i class="bi bi-door-open"></i> ${sala}</td>
          <td>${t.fecha_programada_inicio || '-'}</td>
          <td>${t.fecha_programada_fin || '<span style="color:#64748b;">(A confirmar)</span>'}</td>
          <td>
            <strong>${t.titulo}</strong>
            <div style="font-size:0.8rem; color:#475569;">${t.descripcion}</div>
          </td>
          <td style="text-align:center;"><span class="m-badge m-badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
        `;
        tbodyEquipos.appendChild(tr);
      });
    }

    // 3.2 Accesos de Técnicos
    const tbodyTecnicos = document.getElementById('tbody-prog-tecnicos');
    tbodyTecnicos.innerHTML = '';
    if (sec.programados_tecnicos.length === 0) {
      tbodyTecnicos.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b;">Sin accesos de técnicos programados</td></tr>';
    } else {
      sec.programados_tecnicos.forEach(t => {
        const sala = t.campos_extra?.sala_datacenter || 'No especificada';
        const empresa = t.campos_extra?.empresa_tecnico ? ` (${t.campos_extra.empresa_tecnico})` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#2563eb;">${t.ticket}</strong></td>
          <td><strong>${t.cliente}</strong>${empresa}</td>
          <td><i class="bi bi-door-open"></i> ${sala}</td>
          <td>${t.fecha_programada_inicio || '-'}</td>
          <td>${t.fecha_programada_fin || '<span style="color:#64748b;">(A confirmar)</span>'}</td>
          <td>
            <strong>${t.titulo}</strong>
            <div style="font-size:0.8rem; color:#475569;">${t.descripcion}</div>
          </td>
          <td style="text-align:center;"><span class="m-badge m-badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
        `;
        tbodyTecnicos.appendChild(tr);
      });
    }

    // 3.3 Mantenimientos
    const tbodyMnt = document.getElementById('tbody-prog-mantenimientos');
    tbodyMnt.innerHTML = '';
    if (sec.programados_mantenimientos.length === 0) {
      tbodyMnt.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b;">Sin mantenimientos programados</td></tr>';
    } else {
      sec.programados_mantenimientos.forEach(t => {
        const sitio = t.campos_extra?.sitio_mantenimiento || 'DC General';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#2563eb;">${t.ticket}</strong></td>
          <td><strong>${t.cliente}</strong></td>
          <td><strong><i class="bi bi-tools"></i> ${sitio}</strong></td>
          <td><strong style="color:#1e40af;">${t.fecha_programada_inicio || '-'}</strong></td>
          <td><strong style="color:#1e40af;">${t.fecha_programada_fin || '-'}</strong></td>
          <td>
            <strong>${t.titulo}</strong>
            <div style="font-size:0.8rem; color:#475569;">${t.descripcion}</div>
          </td>
          <td style="text-align:center;"><span class="m-badge m-badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
        `;
        tbodyMnt.appendChild(tr);
      });
    }

    // 3.4 Otros programados
    const boxOtros = document.getElementById('box-prog-otros');
    const tbodyOtros = document.getElementById('tbody-prog-otros');
    if (sec.programados_otros && sec.programados_otros.length > 0) {
      boxOtros.style.display = 'block';
      tbodyOtros.innerHTML = '';
      sec.programados_otros.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#2563eb;">${t.ticket}</strong></td>
          <td><strong>${t.cliente}</strong></td>
          <td>${t.titulo}</td>
          <td>${t.fecha_programada_inicio || 'Horario a confirmar'}</td>
          <td>${t.descripcion}</td>
          <td style="text-align:center;"><span class="m-badge m-badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
        `;
        tbodyOtros.appendChild(tr);
      });
    } else {
      boxOtros.style.display = 'none';
    }

    // 4. ALTAS DE CREDENCIALES ESPECIALES
    const tbodyCreds = document.getElementById('tbody-credenciales');
    tbodyCreds.innerHTML = '';
    if (sec.credenciales_especiales.length === 0) {
      tbodyCreds.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">No hay altas de credenciales especiales registradas</td></tr>';
    } else {
      sec.credenciales_especiales.forEach(t => {
        const ticketCli = t.campos_extra?.ticket_cliente || '-';
        const creds = t.campos_extra?.credenciales_lista || [];
        
        let listaHtml = '';
        if (creds.length > 0) {
          listaHtml = '<table style="width:100%; border-collapse:collapse; font-size:0.8rem;">';
          creds.forEach(c => {
            listaHtml += `
              <tr>
                <td style="padding:2px 4px; border:none;">• <strong>${c.persona_propietaria}</strong></td>
                <td style="padding:2px 4px; border:none; font-family:monospace; color:#2563eb;">[Código: ${c.codigo_alfanumerico}]</td>
              </tr>
            `;
          });
          listaHtml += '</table>';
        } else if (t.campos_extra?.persona_propietaria) {
          listaHtml = `• <strong>${t.campos_extra.persona_propietaria}</strong> [Código: <span style="font-family:monospace; color:#2563eb;">${t.campos_extra.codigo_alfanumerico || ''}</span>]`;
        } else {
          listaHtml = '<span style="color:#64748b;">(Sin personas especificadas)</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#2563eb;">${t.ticket}</strong></td>
          <td><strong>${t.cliente}</strong></td>
          <td><strong>${ticketCli}</strong></td>
          <td>
            <div style="font-weight:600; margin-bottom:2px;">${t.titulo}</div>
            ${listaHtml}
            <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${t.descripcion}</div>
          </td>
          <td style="text-align:center;"><span class="m-badge m-badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
        `;
        tbodyCreds.appendChild(tr);
      });
    }

    // 5. MANEJO DE SITIOS EXTERNOS
    const tbodySitios = document.getElementById('tbody-sitios-externos');
    tbodySitios.innerHTML = '';
    if (sec.sitios_externos.length === 0) {
      tbodySitios.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay registros de sitios externos</td></tr>';
    } else {
      sec.sitios_externos.forEach(t => {
        const sitioExt = t.campos_extra?.sitio_externo || 'Exterior';
        const contactos = t.campos_extra?.cantidad_contactos !== undefined ? t.campos_extra.cantidad_contactos : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#2563eb;">${t.ticket}</strong></td>
          <td><strong>${t.cliente}</strong></td>
          <td><strong style="color:#7c3aed;"><i class="bi bi-geo-alt"></i> ${sitioExt}</strong></td>
          <td style="text-align:center;"><strong style="font-size:1rem; color:#2563eb;">${contactos}</strong></td>
          <td>
            <strong>${t.titulo}</strong>
            <div style="font-size:0.8rem; color:#475569;">${t.descripcion}</div>
          </td>
          <td style="text-align:center;"><span class="m-badge m-badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
        `;
        tbodySitios.appendChild(tr);
      });
    }

    // 6. TAREAS EXTRAS APLICADAS
    const tbodyExtras = document.getElementById('tbody-tareas-extras');
    tbodyExtras.innerHTML = '';
    if (sec.tareas_extras.length === 0) {
      tbodyExtras.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">No hay tareas extras aplicadas</td></tr>';
    } else {
      sec.tareas_extras.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#2563eb;">${t.ticket}</strong></td>
          <td><strong>${t.cliente}</strong></td>
          <td>${t.titulo}</td>
          <td>${t.descripcion}</td>
          <td style="text-align:center;"><span class="m-badge m-badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
        `;
        tbodyExtras.appendChild(tr);
      });
    }

  } catch (error) {
    console.error('Error cargando vista previa de correo:', error);
  }
}

function renderSubtareasInline(tarea = {}) {
  const subtareas = tarea.subtareas || [];
  const actuals = tarea.actualizaciones || [];
  
  if (subtareas.length === 0 && actuals.length === 0) return '';
  
  let html = '<div style="margin-top:6px; padding-left:8px; border-left:2px solid #94a3b8; font-size:0.75rem; color:#475569;">';
  
  if (actuals.length > 0) {
    html += '<div style="font-weight:700; color:#0284c7; margin-bottom:2px;">Notas de Seguimiento:</div>';
    actuals.forEach(a => {
      html += `<div style="margin-bottom:2px;">• <span style="color:#0f172a; font-weight:600;">[${a.operador_nombre || 'Operador'} - ${a.created_at || ''}]:</span> ${a.descripcion} ${a.estado ? '<span style="font-size:0.7rem; color:#0284c7;">(' + a.estado + ')</span>' : ''}</div>`;
    });
  }

  if (subtareas.length > 0) {
    html += '<div style="font-weight:700; color:#7c3aed; margin-top:4px; margin-bottom:2px;">Subtareas Asignadas:</div>';
    subtareas.forEach(s => {
      html += `<div style="margin-bottom:2px;">• <strong>${s.ticket}:</strong> ${s.titulo} [${s.estado}] ${s.descripcion ? '- ' + s.descripcion : ''}</div>`;
    });
  }

  html += '</div>';
  return html;
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
  showToast('Reporte en formato tabla preparado para integración con SMTP corporativo.', 'info', 5000);
}
