import os
import sys
from datetime import datetime, date, timedelta
from App import create_app
from App.extensions import db
from App.Models.usuario import Usuario
from App.Models.region import Region
from App.Models.region_config import RegionConfig, TIPOS_TAREA_DEFAULT, CAMPOS_EXTRA_DEFAULT, TURNOS_DEFAULT
from App.Models.bitacora import Bitacora
from App.Models.tarea import Tarea
from App.Models.subtarea import Subtarea

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

            # Configuración para Buenos Aires (Habilita todos los tipos de tarea)
            config_ar = RegionConfig(
                region_id=region_ar.id,
                tipos_tarea_habilitados=[t["id"] for t in TIPOS_TAREA_DEFAULT],
                campos_extra=CAMPOS_EXTRA_DEFAULT,
                turnos_config=TURNOS_DEFAULT,
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

            # Configuración para Santiago (personalizada con subconjunto de tareas)
            config_cl = RegionConfig(
                region_id=region_cl.id,
                tipos_tarea_habilitados=[
                    "manos_remotas", "manos_inteligentes", "backup", "restore", 
                    "snapshot", "mantenimiento", "incidente", "alta_credencial_especial"
                ],
                campos_extra=CAMPOS_EXTRA_DEFAULT,
                turnos_config=TURNOS_DEFAULT,
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
                supervisor_id=usuarios_creados["supervisor_ar"].id
            )
            db.session.add(bitacora_hoy)
            db.session.flush()

        db.session.commit()

        # 4. Crear Tareas de Prueba representativas
        print("4. Verificando Tareas y Subtareas de ejemplo...")
        op_user = usuarios_creados["op_buenosaires"]
        
        if Tarea.query.filter_by(bitacora_id=bitacora_hoy.id).count() == 0:
            # Tarea 1: Alta de Credencial Especial (con campos extra requeridos)
            t1 = Tarea(
                bitacora_id=bitacora_hoy.id,
                operador_id=op_user.id,
                tipo_tarea="alta_credencial_especial",
                ticket="SEC-8921",
                titulo="Habilitacion de tarjeta magnetica para datacenter sala A",
                cliente="Banco Nacional",
                estado="completada",
                descripcion="Se proceso la solicitud de acceso nivel 3 para personal externo de mantenimiento electrico.",
                es_actividad_programada=False,
                campos_extra={
                    "persona_propietaria": "Gonzalo Mendez",
                    "ticket_cliente": "BN-TK-4421",
                    "codigo_alfanumerico": "CRD-9902-SEC"
                }
            )
            db.session.add(t1)

            # Tarea 2: Backup con Subtareas
            t2 = Tarea(
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
            db.session.add(t2)
            db.session.flush()

            # Subtareas para T2
            sub1 = Subtarea(
                tarea_id=t2.id,
                ticket="BKP-4012-A",
                titulo="Verificacion de espacio en Storage SAN",
                estado="completada",
                descripcion="Espacio libre verificado: 14.2 TB disponibles."
            )
            sub2 = Subtarea(
                tarea_id=t2.id,
                ticket="BKP-4012-B",
                titulo="Ejecucion de job de volcado RMAN",
                estado="en_progreso",
                descripcion="Job iniciado a las 08:30 con 6 canales paralelos."
            )
            db.session.add_all([sub1, sub2])

            # Tarea 3: Actividad Programada (Visible para todos en el mail)
            ahora = datetime.utcnow()
            t3 = Tarea(
                bitacora_id=bitacora_hoy.id,
                operador_id=usuarios_creados["supervisor_ar"].id,
                tipo_tarea="mantenimiento",
                ticket="MNT-2026-09",
                titulo="Ventana de Mantenimiento de UPS Central y Generador Diesel",
                cliente="Infraestructura Interna DC",
                estado="pendiente",
                descripcion="Corte preventivo programado y testeo de conmutacion automatica de generadores de emergencia.",
                es_actividad_programada=True,
                fecha_programada_inicio=ahora + timedelta(hours=2),
                fecha_programada_fin=ahora + timedelta(hours=4),
                campos_extra={}
            )
            db.session.add(t3)

            # Tarea 4: Manos Remotas
            t4 = Tarea(
                bitacora_id=bitacora_hoy.id,
                operador_id=op_user.id,
                tipo_tarea="manos_remotas",
                ticket="RH-5510",
                titulo="Reinicio fisico de servidor rack 12 unidad 4",
                cliente="Fintech Global",
                estado="completada",
                descripcion="Se verifico led de estado en panel frontal y se procedio a ciclo de energia manual.",
                es_actividad_programada=False,
                campos_extra={}
            )
            db.session.add(t4)

            db.session.commit()

        print("[OK] Seed Data cargada exitosamente!")
        print("Usuarios disponibles:")
        print("   - supervisor_ar (Supervisor DOC Buenos Aires) [demo123]")
        print("   - op_buenosaires (Operador Buenos Aires) [demo123]")
        print("   - op_santiago (Operador Santiago) [demo123]")
        print("   - admin_global (Administrador Global) [demo123]")

if __name__ == '__main__':
    seed()
