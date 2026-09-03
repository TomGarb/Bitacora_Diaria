import os
import sys
from datetime import datetime, date, timedelta
from App import create_app
from App.extensions import db
from App.Models.usuario import Usuario
from App.Models.region import Region
from App.Models.region_config import RegionConfig, TIPOS_TAREA_DEFAULT, CAMPOS_EXTRA_DEFAULT, TURNOS_DEFAULT, SALAS_DEFAULT
from App.Models.bitacora import Bitacora
from App.Models.tarea import Tarea
from App.Models.subtarea import Subtarea
from App.Models.feedback import Feedback
from App.Models.equipo import Equipo, usuario_equipos

def seed():
    app = create_app()
    with app.app_context():
        print(">> Iniciando creacion de datos iniciales (Seed Data)...")
        
        # Asegurar creación de tablas
        db.create_all()

        # 1. Crear Regiones
        print("1. Verificando Regiones...")
        region_ar = Region.query.filter_by(codigo='AR-BA').first()
        if not region_ar:
            region_ar = Region(
                nombre="Datacenter Buenos Aires",
                codigo="AR-BA",
                descripcion="Centro de Operaciones Principal - CABA",
                activa=True
            )
            db.session.add(region_ar)
            db.session.flush()

            # Configuración para Buenos Aires
            config_ar = RegionConfig(
                region_id=region_ar.id,
                tipos_tarea_habilitados=[t["id"] for t in TIPOS_TAREA_DEFAULT],
                campos_extra=CAMPOS_EXTRA_DEFAULT,
                turnos_config=TURNOS_DEFAULT,
                salas_datacenter=SALAS_DEFAULT,
                config_ui={"titulo_bitacora": "Bitacora DOC Buenos Aires"}
            )
            db.session.add(config_ar)

        region_cl = Region.query.filter_by(codigo='CL-SCL').first()
        if not region_cl:
            region_cl = Region(
                nombre="Datacenter Santiago",
                codigo="CL-SCL",
                descripcion="Centro de Operaciones Secundario - Santiago de Chile",
                activa=True
            )
            db.session.add(region_cl)
            db.session.flush()

            # Configuración para Santiago
            config_cl = RegionConfig(
                region_id=region_cl.id,
                tipos_tarea_habilitados=[
                    "manos_remotas", "manos_inteligentes", "acceso_equipos", "retiro_equipos",
                    "acceso_tecnicos", "backup", "restore", "snapshot", "mantenimiento", 
                    "incidente", "manejo_sitio_externo", "alta_credencial_especial"
                ],
                campos_extra=CAMPOS_EXTRA_DEFAULT,
                turnos_config=TURNOS_DEFAULT,
                salas_datacenter=[
                    "Sala Principal Santiago", "Meet-Me Room SCL", "Subestación Eléctrica SCL"
                ],
                config_ui={"titulo_bitacora": "Bitacora DOC Santiago"}
            )
            db.session.add(config_cl)

        db.session.commit()

        # 2. Crear Usuarios (Roles: Admin, Sub-Admin, Operador)
        print("2. Verificando Usuarios...")
        usuarios_data = [
            {
                "username": "admin_global",
                "email": "admin@datacenter.corp",
                "nombre": "Administrador Global DOC",
                "rol": "admin",
                "region_id": None,
                "password": "demo123"
            },
            {
                "username": "supervisor_ar",
                "email": "supervisor.ba@datacenter.corp",
                "nombre": "Esteban Ramos (Supervisor AR)",
                "rol": "sub_admin",
                "region_id": region_ar.id,
                "password": "demo123"
            },
            {
                "username": "op_buenosaires",
                "email": "operador1.ba@datacenter.corp",
                "nombre": "Martin Silva (Operador)",
                "rol": "operador",
                "region_id": region_ar.id,
                "password": "demo123"
            },
            {
                "username": "op_santiago",
                "email": "operador1.cl@datacenter.corp",
                "nombre": "Rodrigo Fuentes (Operador CL)",
                "rol": "operador",
                "region_id": region_cl.id,
                "password": "demo123"
            }
        ]

        usuarios_creados = {}
        for u_data in usuarios_data:
            user = Usuario.query.filter_by(username=u_data["username"]).first()
            if not user:
                user = Usuario(
                    username=u_data["username"],
                    email=u_data["email"],
                    nombre_completo=u_data["nombre"],
                    rol=u_data["rol"],
                    region_id=u_data["region_id"],
                    activo=True
                )
                user.set_password(u_data["password"])
                db.session.add(user)
                db.session.flush()
            usuarios_creados[u_data["username"]] = user

        db.session.commit()

        # 3. Crear Bitácora de prueba para Buenos Aires
        print("3. Verificando Bitacora Activa...")
        bitacora_hoy = Bitacora.query.filter_by(region_id=region_ar.id, fecha=date.today(), turno='manana').first()
        if not bitacora_hoy:
            bitacora_hoy = Bitacora(
                region_id=region_ar.id,
                fecha=date.today(),
                turno='manana',
                estado='abierta',
                supervisor_id=usuarios_creados["supervisor_ar"].id,
                observaciones_cierre="Sin cortes imprevistos de suministro. Se ejecuto con exito la conmutacion de generador de prueba."
            )
            db.session.add(bitacora_hoy)
            db.session.flush()

        db.session.commit()

        # 4. Crear Tareas de Prueba representativas
        print("4. Verificando Tareas y Subtareas de ejemplo...")
        op_user = usuarios_creados["op_buenosaires"]
        sup_user = usuarios_creados["supervisor_ar"]
        ahora = datetime.utcnow()
        
        # Limpiar tareas previas para recrear con el esquema enriquecido
        Tarea.query.filter_by(bitacora_id=bitacora_hoy.id).delete()
        db.session.commit()

        # Tarea 1: Alta de Credenciales Especiales Múltiples (Programada con fechas obligatorias)
        t1 = Tarea(
            bitacora_id=bitacora_hoy.id,
            operador_id=op_user.id,
            tipo_tarea="alta_credencial_especial",
            ticket="SEC-8921",
            titulo="Alta de Credenciales Especiales - BN-TK-4421",
            cliente="Banco Nacional",
            estado="completada",
            descripcion="Se procesaron las tarjetas de proximidad y biometricos para tecnicos de auditoria externa.",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora - timedelta(hours=4),
            fecha_programada_fin=ahora + timedelta(hours=2),
            campos_extra={
                "ticket_cliente": "BN-TK-4421",
                "credenciales_lista": [
                    {"persona_propietaria": "Gonzalo Mendez", "codigo_alfanumerico": "CRD-9902-SEC"},
                    {"persona_propietaria": "Mariana Lopez", "codigo_alfanumerico": "CRD-9903-SEC"},
                    {"persona_propietaria": "Lucas Benitez", "codigo_alfanumerico": "CRD-9904-SEC"}
                ]
            }
        )

        # Tarea 2: Ingreso de Equipos (Programado, inicio oblig., fin opcional, sala DC)
        t2 = Tarea(
            bitacora_id=bitacora_hoy.id,
            operador_id=op_user.id,
            tipo_tarea="acceso_equipos",
            ticket="EQ-5100",
            titulo="Ingreso y despaletizado de 4 Switches Cisco Nexus 9000",
            cliente="Telecomunicaciones Sur",
            estado="en_progreso",
            descripcion="Ingreso por darsena de carga y traslado hacia sala de racks.",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora - timedelta(hours=1),
            fecha_programada_fin=None, # Fin opcional
            campos_extra={
                "sala_datacenter": "Sala B - Racks de Red"
            }
        )

        # Tarea 3: Acceso de Técnicos
        t3 = Tarea(
            bitacora_id=bitacora_hoy.id,
            operador_id=op_user.id,
            tipo_tarea="acceso_tecnicos",
            ticket="ACC-209",
            titulo="Acceso de cuadrilla de fibra optica para empalme en ODF",
            cliente="Carrier Global Telecom",
            estado="completada",
            descripcion="Personal acreditado de Level3 / Lumen realizando medicion reflectometrica.",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora - timedelta(hours=3),
            fecha_programada_fin=ahora - timedelta(hours=1),
            campos_extra={
                "sala_datacenter": "Meet-Me Room (MMR)",
                "empresa_tecnico": "Lumen Technologies"
            }
        )

        # Tarea 4: Mantenimiento Programado (Inicio y Fin obligatorios, sitio DC/Subestacion)
        t4 = Tarea(
            bitacora_id=bitacora_hoy.id,
            operador_id=sup_user.id,
            tipo_tarea="mantenimiento",
            ticket="MNT-2026-09",
            titulo="Mantenimiento preventivo semestral de Celda de Media Tension",
            cliente="Infraestructura Interna DC",
            estado="pendiente",
            descripcion="Pruebas de aislamiento y revision de transformadores de aislamiento.",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora + timedelta(hours=2),
            fecha_programada_fin=ahora + timedelta(hours=5),
            campos_extra={
                "sitio_mantenimiento": "Subestación Transformadora Principal"
            }
        )

        # Tarea 5: Manejo de Sitios Externos (Chile / Miami + cantidad contactos)
        t5 = Tarea(
            bitacora_id=bitacora_hoy.id,
            operador_id=op_user.id,
            tipo_tarea="manejo_sitio_externo",
            ticket="EXT-104",
            titulo="Coordinacion de enlace transandino y verificacion de latencia",
            cliente="Red Corporativa DC",
            estado="en_progreso",
            descripcion="Monitoreo conjunto con NOC regional por fluctuacion en fibra submarina.",
            es_actividad_programada=False,
            campos_extra={
                "sitio_externo": "Chile",
                "cantidad_contactos": 4
            }
        )

        # Tarea 6: Tarea Extra Aplicada
        t6 = Tarea(
            bitacora_id=bitacora_hoy.id,
            operador_id=op_user.id,
            tipo_tarea="tarea_extra",
            ticket="EXTR-88",
            titulo="Reetiquetado de patchcords en Rack 14 fila central",
            cliente="Fintech Alpha",
            estado="completada",
            descripcion="Reordenamiento estético y normalización de cableado UTP Cat6A.",
            es_actividad_programada=False,
            campos_extra={}
        )

        # Tarea 7: Backup con Subtareas y Comentarios
        t7 = Tarea(
            bitacora_id=bitacora_hoy.id,
            operador_id=op_user.id,
            tipo_tarea="backup",
            ticket="BKP-4012",
            titulo="Backup Full Semanal de Base de Datos Core",
            cliente="Telecomunicaciones Sur",
            estado="en_progreso",
            descripcion="Ejecucion de snapshot y respaldo en cinta LTO-8 de base de datos Oracle RAC.",
            es_actividad_programada=False,
            campos_extra={}
        )

        db.session.add_all([t1, t2, t3, t4, t5, t6, t7])
        db.session.flush()

        # Subtareas con comentarios
        sub1 = Subtarea(
            tarea_id=t7.id,
            ticket="BKP-4012-A",
            titulo="Verificacion de espacio en Storage SAN",
            estado="completada",
            descripcion="Operador: Espacio libre verificado: 14.2 TB disponibles sin alarmas."
        )
        sub2 = Subtarea(
            tarea_id=t7.id,
            ticket="BKP-4012-B",
            titulo="Ejecucion de job de volcado RMAN",
            estado="en_progreso",
            descripcion="Operador: Job iniciado a las 08:30 con 6 canales paralelos, velocidad 420MB/s."
        )
        db.session.add_all([sub1, sub2])

        # 5. Feedbacks de prueba
        print("5. Verificando Feedbacks de ejemplo...")
        Feedback.query.delete()
        fb1 = Feedback(
            usuario_id=op_user.id,
            region_id=region_ar.id,
            tipo="modificacion_tarea",
            asunto="Agregar Jaula de Servidores en Salas de Buenos Aires",
            mensaje="En el DOC Buenos Aires sumamos una nueva jaula privada en el piso 2 para clientes bancarios. Solicito agregarla a la lista de salas seleccionables.",
            estado="resuelto",
            respuesta_admin="Agregada exitosamente a la configuracion de la region."
        )
        fb2 = Feedback(
            usuario_id=op_user.id,
            region_id=region_ar.id,
            tipo="sugerencia_mejora",
            asunto="Aviso visual en tareas programadas proximas a iniciar",
            mensaje="Seria util que las tareas programadas cambien de color cuando falten menos de 30 minutos para su inicio.",
            estado="en_revision"
        )
        # 6. Equipos / Grupos de Trabajo de ejemplo
        print("6. Verificando Equipos de Trabajo por sede...")
        db.session.execute(usuario_equipos.delete())
        Equipo.query.delete()
        db.session.commit()

        eq_ar1 = Equipo(
            nombre="Equipo Manos Inteligentes",
            descripcion="Soporte avanzado de hardware, ruteo y diagnóstico en racks",
            region_id=region_ar.id,
            activo=True
        )
        eq_ar2 = Equipo(
            nombre="Equipo Backups",
            descripcion="Operaciones de respaldo, restore, cintas y snapshots",
            region_id=region_ar.id,
            activo=True
        )

        op_scl = usuarios_creados["op_santiago"]
        eq_cl1 = Equipo(
            nombre="Equipo Virtualización",
            descripcion="Gestión de hipervisores VMware ESXi, Nutanix y Cloud Stack",
            region_id=region_cl.id,
            activo=True
        )
        eq_cl2 = Equipo(
            nombre="Equipo Manos Remotas",
            descripcion="Soporte físico directo en planta, cableado estructurado y accesos",
            region_id=region_cl.id,
            activo=True
        )

        db.session.add_all([eq_ar1, eq_ar2, eq_cl1, eq_cl2])
        db.session.flush()

        eq_ar1.miembros.append(op_user)
        eq_ar1.miembros.append(sup_user)
        eq_ar2.miembros.append(op_user)
        eq_cl1.miembros.append(op_scl)
        eq_cl2.miembros.append(op_scl)

        db.session.commit()

        print("[OK] Seed Data cargada exitosamente!")
        print("Usuarios disponibles:")
        print("   - supervisor_ar (Supervisor DOC Buenos Aires) [demo123]")
        print("   - op_buenosaires (Operador Buenos Aires) [demo123]")
        print("   - op_santiago (Operador Santiago) [demo123]")
        print("   - admin_global (Administrador Global) [demo123]")

if __name__ == '__main__':
    seed()
