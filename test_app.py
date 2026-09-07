import unittest
import json
from datetime import datetime, date, timedelta, timezone
from App import create_app
from App.extensions import db
from App.Models import Usuario, Region, RegionConfig, Bitacora, Tarea, Subtarea, Feedback, Equipo

class TestBitacoraDOC(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # Crear región
        self.region = Region(nombre="Datacenter Test", codigo="TS-01", activa=True)
        db.session.add(self.region)
        db.session.flush()

        self.config = RegionConfig(
            region_id=self.region.id,
            tipos_tarea_habilitados=["manos_remotas", "alta_credencial_especial", "mantenimiento", "acceso_equipos", "manejo_sitio_externo"],
            salas_datacenter=["Sala A", "Sala B", "Subestación 1"]
        )
        db.session.add(self.config)

        # Usuario operador 1
        self.operador = Usuario(
            username="operador_test",
            email="op@test.corp",
            nombre_completo="Operador Test",
            rol="operador",
            region_id=self.region.id,
            activo=True
        )
        self.operador.set_password("demo123")

        # Usuario operador 2 (compañero)
        self.operador2 = Usuario(
            username="operador_test2",
            email="op2@test.corp",
            nombre_completo="Operador Dos",
            rol="operador",
            region_id=self.region.id,
            activo=True
        )
        self.operador2.set_password("demo123")

        # Usuario supervisor
        self.supervisor = Usuario(
            username="supervisor_test",
            email="sup@test.corp",
            nombre_completo="Supervisor Test",
            rol="sub_admin",
            region_id=self.region.id,
            activo=True
        )
        self.supervisor.set_password("demo123")

        # Usuario admin global
        self.admin = Usuario(
            username="admin_global",
            email="admin@test.corp",
            nombre_completo="Admin Global",
            rol="admin",
            region_id=None,
            activo=True
        )
        self.admin.set_password("demo123")

        db.session.add_all([self.operador, self.operador2, self.supervisor, self.admin])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def login_as(self, user):
        with self.client.session_transaction() as sess:
            sess['user_id'] = user.id
            sess['username'] = user.username
            sess['rol'] = user.rol
            sess['region_id'] = user.region_id

    def test_01_login_and_dashboard(self):
        self.login_as(self.operador)
        res = self.client.get('/dashboard')
        self.assertEqual(res.status_code, 200)

        res_stats = self.client.get('/api/dashboard/stats')
        self.assertEqual(res_stats.status_code, 200)
        data = res_stats.get_json()
        self.assertIn('kpis', data)

    def test_02_crear_tarea_credenciales_multiples_y_fechas(self):
        self.login_as(self.operador)
        ahora = datetime.now(timezone.utc)
        
        # Debe fallar si faltan fechas obligatorias
        res_fail = self.client.post('/api/tareas', json={
            "ticket": "SEC-100",
            "cliente": "Cliente Alpha",
            "tipo_tarea": "alta_credencial_especial",
            "estado": "completada",
            "descripcion": "Acceso biométrico",
            "campos_extra": {
                "ticket_cliente": "TK-CLI-900",
                "credenciales_lista": [{"persona_propietaria": "Laura Torres", "codigo_alfanumerico": "CR-LAURA-88"}]
            }
        })
        self.assertEqual(res_fail.status_code, 400)

        # Con fechas de inicio y fin debe pasar y autogenerar título
        payload = {
            "ticket": "SEC-100",
            "cliente": "Cliente Alpha",
            "tipo_tarea": "alta_credencial_especial",
            "estado": "completada",
            "descripcion": "Acceso biométrico habilitado",
            "fecha_programada_inicio": ahora.isoformat(),
            "fecha_programada_fin": (ahora + timedelta(hours=4)).isoformat(),
            "campos_extra": {
                "ticket_cliente": "TK-CLI-900",
                "credenciales_lista": [
                    {"persona_propietaria": "Laura Torres", "codigo_alfanumerico": "CR-LAURA-88"},
                    {"persona_propietaria": "Pedro Gómez", "codigo_alfanumerico": "CR-PEDRO-89"}
                ]
            },
            "subtareas": [
                {"ticket": "SEC-100-A", "titulo": "Enrolar huella", "estado": "completada", "descripcion": "Enrolado ok"}
            ]
        }

        res = self.client.post('/api/tareas', json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertTrue(data['tarea']['es_actividad_programada'])
        self.assertEqual(len(data['tarea']['campos_extra']['credenciales_lista']), 2)
        self.assertIn('Alta de Credenciales Especiales', data['tarea']['titulo'])

    def test_03_validacion_fechas_equipos_y_mantenimiento(self):
        self.login_as(self.operador)
        
        # Equipos sin fecha inicio debe fallar
        res_fail = self.client.post('/api/tareas', json={
            "ticket": "EQ-1",
            "titulo": "Ingreso servidor",
            "cliente": "Cli",
            "tipo_tarea": "acceso_equipos",
            "estado": "en_progreso",
            "descripcion": "desc",
            "campos_extra": {"sala_datacenter": "Sala A"}
        })
        self.assertEqual(res_fail.status_code, 400)

        # Mantenimiento con inicio y fin debe pasar
        ahora = datetime.now(timezone.utc)
        res_ok = self.client.post('/api/tareas', json={
            "ticket": "MNT-1",
            "titulo": "Mantenimiento UPS",
            "cliente": "DC",
            "tipo_tarea": "mantenimiento",
            "estado": "pendiente",
            "descripcion": "desc",
            "fecha_programada_inicio": ahora.isoformat(),
            "fecha_programada_fin": (ahora + timedelta(hours=2)).isoformat(),
            "campos_extra": {"sitio_mantenimiento": "Subestación 1"}
        })
        self.assertEqual(res_ok.status_code, 201)
        self.assertTrue(res_ok.get_json()['tarea']['es_actividad_programada'])

    def test_04_mail_preview_secciones_y_visibilidad(self):
        self.login_as(self.operador)
        
        bitacora = Bitacora(region_id=self.region.id, fecha=date.today(), turno="manana", estado="abierta")
        db.session.add(bitacora)
        db.session.flush()

        # Tarea 1: del operador
        t1 = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.operador.id,
            tipo_tarea="manos_remotas",
            ticket="RH-1",
            titulo="Tarea de operador",
            cliente="Cli 1",
            estado="completada",
            descripcion="Desc 1",
            es_actividad_programada=False
        )

        # Tarea 2: Mantenimiento programado de supervisor (visible en tabla de mantenimientos)
        t2 = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.supervisor.id,
            tipo_tarea="mantenimiento",
            ticket="MNT-99",
            titulo="Corte Programado Generador",
            cliente="Datacenter",
            estado="pendiente",
            descripcion="Mantenimiento general",
            es_actividad_programada=True,
            campos_extra={"sitio_mantenimiento": "Subestación 1"}
        )

        db.session.add_all([t1, t2])
        db.session.commit()

        res = self.client.get(f'/api/mail-preview/data?bitacora_id={bitacora.id}')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        
        secciones = data['secciones']
        self.assertEqual(len(secciones['casos_operador']), 1)
        self.assertEqual(secciones['casos_operador'][0]['ticket'], 'RH-1')
        self.assertEqual(len(secciones['programados_mantenimientos']), 1)

    def test_05_perfil_equipo_y_supervisores(self):
        self.login_as(self.operador)
        res = self.client.get('/api/perfil/equipo')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        
        # Debe mostrar al supervisor
        self.assertEqual(len(data['supervisores']), 1)
        self.assertEqual(data['supervisores'][0]['username'], 'supervisor_test')

        # Debe mostrar a su compañero operador pero no a él mismo
        self.assertEqual(len(data['companeros']), 1)
        self.assertEqual(data['companeros'][0]['username'], 'operador_test2')

        # No debe figurar admin_global en supervisores ni compañeros
        all_usernames = [s['username'] for s in data['supervisores']] + [c['username'] for c in data['companeros']]
        self.assertNotIn('admin_global', all_usernames)

    def test_06_feedback_creacion_y_resolucion(self):
        self.login_as(self.operador)
        
        # 1. Crear reporte de error
        res_crear = self.client.post('/api/feedbacks', json={
            "tipo": "error_sistema",
            "asunto": "Error al procesar botón",
            "mensaje": "En la pantalla de bitácora el botón tardó en responder."
        })
        self.assertEqual(res_crear.status_code, 201)
        fb_id = res_crear.get_json()['feedback']['id']

        # 2. Listar feedbacks como operador
        res_list = self.client.get('/api/feedbacks')
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(len(res_list.get_json()), 1)

        # 3. Responder reporte como supervisor
        self.login_as(self.supervisor)
        res_resp = self.client.put(f'/api/feedbacks/{fb_id}/responder', json={
            "estado": "resuelto",
            "respuesta_admin": "Corregido en la última versión."
        })
        self.assertEqual(res_resp.status_code, 200)
        self.assertEqual(res_resp.get_json()['feedback']['estado'], 'resuelto')

    def test_07_tv_dashboards_endpoints(self):
        # 1. Crear bitacora y tareas de TV para la región
        bitacora = Bitacora(region_id=self.region.id, fecha=date.today(), turno="tarde", estado="abierta")
        db.session.add(bitacora)
        db.session.flush()

        ahora = datetime.now(timezone.utc)

        # Acceso técnico
        t_tec = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.operador.id,
            tipo_tarea="acceso_tecnicos",
            ticket="TEC-01",
            titulo="Acceso fibra",
            cliente="Lumen",
            estado="completada",
            descripcion="Empalme ODF",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora,
            campos_extra={"sala_datacenter": "Meet-Me Room"}
        )

        # Inbound equipo
        t_eq = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.operador.id,
            tipo_tarea="acceso_equipos",
            ticket="EQ-01",
            titulo="Ingreso switches",
            cliente="Telecom",
            estado="en_progreso",
            descripcion="Switches Nexus",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora,
            campos_extra={"sala_datacenter": "Sala A"}
        )

        # Credencial especial
        t_cred = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.operador.id,
            tipo_tarea="alta_credencial_especial",
            ticket="SEC-01",
            titulo="Credenciales auditoria",
            cliente="Banco Test",
            estado="completada",
            descripcion="Auditoria",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora - timedelta(hours=1),
            fecha_programada_fin=ahora + timedelta(hours=2),
            campos_extra={
                "ticket_cliente": "TK-BN-01",
                "credenciales_lista": [{"persona_propietaria": "Juan Perez", "codigo_alfanumerico": "CRD-9988"}]
            }
        )

        # Mantenimiento programado
        t_mnt = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.supervisor.id,
            tipo_tarea="mantenimiento",
            ticket="MNT-01",
            titulo="Corte UPS",
            cliente="DC Ops",
            estado="pendiente",
            descripcion="Prueba generador",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora + timedelta(hours=1),
            fecha_programada_fin=ahora + timedelta(hours=3),
            campos_extra={"sitio_mantenimiento": "Subestación 1"}
        )

        # Credencial vencida (debe ser excluida)
        t_cred_vencida = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.operador.id,
            tipo_tarea="alta_credencial_especial",
            ticket="SEC-EXPIRED",
            titulo="Credencial vencida",
            cliente="Banco Test",
            estado="completada",
            descripcion="Auditoria pasada",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora - timedelta(hours=5),
            fecha_programada_fin=ahora - timedelta(hours=2),
            campos_extra={
                "ticket_cliente": "TK-BN-OLD",
                "credenciales_lista": [{"persona_propietaria": "Persona Vieja", "codigo_alfanumerico": "OLD-0000"}]
            }
        )

        # Mantenimiento pasado (debe ser excluido)
        t_mnt_pasado = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.supervisor.id,
            tipo_tarea="mantenimiento",
            ticket="MNT-OLD",
            titulo="Corte Pasado",
            cliente="DC Ops",
            estado="completada",
            descripcion="Mantenimiento ya terminado",
            es_actividad_programada=True,
            fecha_programada_inicio=ahora - timedelta(hours=4),
            fecha_programada_fin=ahora - timedelta(hours=1),
            campos_extra={"sitio_mantenimiento": "Subestación 1"}
        )

        db.session.add_all([t_tec, t_eq, t_cred, t_cred_vencida, t_mnt, t_mnt_pasado])
        db.session.commit()

        # Test HTML Views
        r_v1 = self.client.get(f'/tv/{self.region.id}/accesos')
        self.assertEqual(r_v1.status_code, 200)

        r_v2 = self.client.get(f'/tv/{self.region.id}/credenciales')
        self.assertEqual(r_v2.status_code, 200)

        r_v3 = self.client.get(f'/tv/{self.region.id}/planificadas')
        self.assertEqual(r_v3.status_code, 200)

        # Test API JSON Accesos
        r_api_acc = self.client.get(f'/api/tv/{self.region.id}/accesos')
        self.assertEqual(r_api_acc.status_code, 200)
        data_acc = r_api_acc.get_json()
        self.assertEqual(len(data_acc['tecnicos']), 1)
        self.assertEqual(len(data_acc['equipos']), 1)

        # Test API JSON Credenciales (debe incluir la vigente y excluir la vencida)
        r_api_cred = self.client.get(f'/api/tv/{self.region.id}/credenciales')
        self.assertEqual(r_api_cred.status_code, 200)
        data_cred = r_api_cred.get_json()
        self.assertEqual(len(data_cred['credenciales']), 1)
        self.assertEqual(data_cred['credenciales'][0]['codigo_alfanumerico'], 'CRD-9988')
        # Verificar que no está la vieja
        codigos = [c['codigo_alfanumerico'] for c in data_cred['credenciales']]
        self.assertNotIn('OLD-0000', codigos)

        # Test API JSON Planificadas (debe excluir la pasada)
        r_api_plan = self.client.get(f'/api/tv/{self.region.id}/planificadas')
        self.assertEqual(r_api_plan.status_code, 200)
        data_plan = r_api_plan.get_json()
        tickets_plan = [p['ticket'] for p in data_plan['planificadas']]
        self.assertIn('MNT-01', tickets_plan)
        self.assertNotIn('MNT-OLD', tickets_plan)

    def test_08_sub_admin_crud_usuarios_regional(self):
        # 1. Login como sub_admin (supervisor de region 1)
        self.login_as(self.supervisor)

        # Listar usuarios: solo debe ver los de su región (operador_test y operador_test2 y supervisor_test), NO admin_global ni usuarios de otra region
        r_list = self.client.get('/api/admin/usuarios')
        self.assertEqual(r_list.status_code, 200)
        users = r_list.get_json()
        usernames = [u['username'] for u in users]
        self.assertNotIn('admin_global', usernames)

        # 2. Crear un nuevo operador en su región
        r_create = self.client.post('/api/admin/usuarios', json={
            "username": "op_nuevo_regional",
            "email": "nuevo@regional.com",
            "nombre_completo": "Operador Nuevo Regional",
            "rol": "operador",
            "password": "password123"
        })
        self.assertEqual(r_create.status_code, 201)
        new_u_id = r_create.get_json()['usuario']['id']
        self.assertEqual(r_create.get_json()['usuario']['region_id'], self.region.id)

        # 3. Editar usuario de su región
        r_edit = self.client.put(f'/api/admin/usuarios/{new_u_id}', json={
            "nombre_completo": "Operador Modificado",
            "email": "modificado@regional.com",
            "rol": "operador",
            "activo": True
        })
        self.assertEqual(r_edit.status_code, 200)
        self.assertEqual(r_edit.get_json()['usuario']['nombre_completo'], 'Operador Modificado')

        # 4. Intento inválido: Sub_admin intenta elevar a admin global (debe rechazarse)
        r_elevate = self.client.put(f'/api/admin/usuarios/{new_u_id}', json={
            "rol": "admin"
        })
        self.assertEqual(r_elevate.status_code, 403)

        # 5. Eliminar usuario de su región
        r_del = self.client.delete(f'/api/admin/usuarios/{new_u_id}')
        self.assertEqual(r_del.status_code, 200)

    def test_09_equipos_crud_y_metricas_segmentadas(self):
        # 1. Login como sub_admin de region 1 (Buenos Aires)
        self.login_as(self.supervisor)

        # 2. Crear un equipo en su región
        r_create = self.client.post('/api/equipos', json={
            "nombre": "Equipo Manos Inteligentes Test",
            "descripcion": "Equipo especializado en racks y ruteo",
            "miembros_ids": [self.operador.id]
        })
        self.assertEqual(r_create.status_code, 201)
        eq_id = r_create.get_json()['equipo']['id']
        self.assertEqual(r_create.get_json()['equipo']['total_miembros'], 1)

        # 3. Listar equipos como operador (debe ver el equipo creado en su región)
        self.login_as(self.operador)
        r_list = self.client.get('/api/equipos')
        self.assertEqual(r_list.status_code, 200)
        equipos = r_list.get_json()
        nombres = [e['nombre'] for e in equipos]
        self.assertIn("Equipo Manos Inteligentes Test", nombres)

        # 4. Verificar que en el perfil del operador figura en mis_equipos
        r_perfil = self.client.get('/api/perfil/equipo')
        self.assertEqual(r_perfil.status_code, 200)
        mis_eqs = r_perfil.get_json()['mis_equipos']
        self.assertEqual(len(mis_eqs), 1)
        self.assertEqual(mis_eqs[0]['nombre'], "Equipo Manos Inteligentes Test")

        # 5. Modificar equipo (agregar al supervisor también al equipo)
        self.login_as(self.supervisor)
        r_edit = self.client.put(f'/api/equipos/{eq_id}', json={
            "nombre": "Equipo Manos Inteligentes y Redes",
            "miembros_ids": [self.operador.id, self.supervisor.id]
        })
        self.assertEqual(r_edit.status_code, 200)
        self.assertEqual(r_edit.get_json()['equipo']['total_miembros'], 2)

        # 6. Probar aislamiento regional: Crear region 2 y verificar que supervisor 1 no pueda editar equipos de region 2
        r2 = Region(nombre="Santiago", codigo="CL-SCL-TEST", activa=True)
        db.session.add(r2)
        db.session.flush()

        eq_r2 = Equipo(nombre="Equipo Chile", region_id=r2.id, activo=True)
        db.session.add(eq_r2)
        db.session.commit()

        r_hack = self.client.put(f'/api/equipos/{eq_r2.id}', json={
            "nombre": "Intento Modificar Chile"
        })
        self.assertEqual(r_hack.status_code, 403)

        # 7. Métricas del Dashboard segmentadas por equipo_id
        r_stats = self.client.get(f'/api/dashboard/stats?equipo_id={eq_id}')
        self.assertEqual(r_stats.status_code, 200)
        stats_data = r_stats.get_json()
        self.assertIn('kpis', stats_data)
        self.assertEqual(stats_data['equipo_id_activo'], eq_id)
        self.assertEqual(stats_data['equipo_seleccionado']['nombre'], "Equipo Manos Inteligentes y Redes")

    def test_10_actualizaciones_y_subtareas_separadas(self):
        # 1. Operador 1 crea una tarea general
        self.login_as(self.operador)
        r_create = self.client.post('/api/tareas', json={
            "ticket": "INC-7701",
            "titulo": "Falla de conectividad en switch de acceso",
            "cliente": "Banco Nacional",
            "tipo_tarea": "manos_remotas",
            "estado": "pendiente",
            "descripcion": "Puerto Gigabit 0/1 sin link físico."
        })
        self.assertEqual(r_create.status_code, 201)
        tarea_id = r_create.get_json()['tarea']['id']

        # 2. Operador 2 (compañero) agrega una NOTA / ACTUALIZACIÓN (sin ticket requerido)
        self.login_as(self.operador2)
        r_act = self.client.post(f'/api/tareas/{tarea_id}/actualizaciones', json={
            "descripcion": "Operador 2: Se testeó el patchcord con reflectómetro. Cable dañado, se procede al reemplazo.",
            "estado": "en_progreso"
        })
        self.assertEqual(r_act.status_code, 201)
        act_data = r_act.get_json()
        self.assertEqual(act_data['entrada']['tipo_entrada'], 'actualizacion')
        self.assertIsNone(act_data['entrada']['ticket'])
        self.assertEqual(act_data['tarea_estado'], 'en_progreso')

        # 3. Operador 2 agrega una SUBTAREA con Ticket
        r_sub = self.client.post(f'/api/tareas/{tarea_id}/subtareas', json={
            "tipo_entrada": "subtarea",
            "ticket": "SUB-7701-A",
            "titulo": "Reetiquetado y certificación de nuevo patchcord",
            "estado": "completada",
            "descripcion": "Patchcord Cat6A certificado con Fluke."
        })
        self.assertEqual(r_sub.status_code, 201)
        sub_data = r_sub.get_json()
        self.assertEqual(sub_data['entrada']['tipo_entrada'], 'subtarea')
        self.assertEqual(sub_data['entrada']['ticket'], 'SUB-7701-A')

        # 4. Consultar detalle de tarea y verificar que separa ambas colecciones
        r_get = self.client.get(f'/api/tareas/{tarea_id}')
        self.assertEqual(r_get.status_code, 200)
        t_data = r_get.get_json()
        self.assertEqual(len(t_data['actualizaciones']), 1)
        self.assertEqual(len(t_data['subtareas']), 1)
        self.assertEqual(t_data['actualizaciones'][0]['descripcion'], "Operador 2: Se testeó el patchcord con reflectómetro. Cable dañado, se procede al reemplazo.")
        self.assertEqual(t_data['subtareas'][0]['ticket'], 'SUB-7701-A')
        self.assertEqual(t_data['estado'], 'en_progreso')

    def test_11_crear_tipo_tarea_custom_y_campos_dinamicos(self):
        # 1. Supervisor configura un nuevo tipo de tarea personalizada con campos dinámicos
        self.login_as(self.supervisor)
        
        # Obtener configuración actual
        r_cfg = self.client.get(f'/api/config/{self.region.id}')
        self.assertEqual(r_cfg.status_code, 200)
        cfg_actual = r_cfg.get_json()['config']

        nuevo_tipo_custom = {
            "id": "reemplazo_discos",
            "nombre": "Reemplazo de Discos / Storage",
            "icono": "bi-hdd-fill",
            "descripcion": "Sustitución de unidades de almacenamiento",
            "es_programada_default": False,
            "es_custom": True
        }

        campos_custom = [
            {"nombre": "nro_serie_viejo", "label": "N° Serie Retirado", "tipo": "text", "requerido": True},
            {"nombre": "tipo_disco", "label": "Tecnología de Disco", "tipo": "select", "opciones": ["SAS 10K", "SATA SSD", "NVMe Gen4"], "requerido": True},
            {"nombre": "slot_rack", "label": "Slot / Bahía", "tipo": "text", "requerido": False}
        ]

        tipos_habilitados = list(cfg_actual['tipos_tarea_habilitados']) + ["reemplazo_discos"]
        campos_extra = dict(cfg_actual['campos_extra'])
        campos_extra['reemplazo_discos'] = campos_custom

        r_save = self.client.put(f'/api/config/{self.region.id}', json={
            "tipos_tarea_custom": [nuevo_tipo_custom],
            "tipos_tarea_habilitados": tipos_habilitados,
            "campos_extra": campos_extra,
            "salas_datacenter": cfg_actual['salas_datacenter'],
            "turnos_config": cfg_actual['turnos_config'],
            "config_ui": cfg_actual['config_ui']
        })

        self.assertEqual(r_save.status_code, 200)
        cfg_guardada = r_save.get_json()['config']
        self.assertEqual(len(cfg_guardada['tipos_tarea_custom']), 1)
        self.assertIn("reemplazo_discos", cfg_guardada['tipos_tarea_habilitados'])
        self.assertTrue(any(t['id'] == 'reemplazo_discos' for t in cfg_guardada['catalogo_completo_tipos']))

        # 2. Operador intenta crear tarea sin completar campo obligatorio custom (nro_serie_viejo)
        self.login_as(self.operador)
        r_fail = self.client.post('/api/tareas', json={
            "ticket": "STG-9941",
            "titulo": "Cambio de disco en Storage SAN 01",
            "cliente": "Telco Corp",
            "tipo_tarea": "reemplazo_discos",
            "estado": "en_progreso",
            "descripcion": "Disco en slot 04 en estado Predictive Failure.",
            "campos_extra": {
                "tipo_disco": "NVMe Gen4",
                "slot_rack": "Slot 04"
                # Falta nro_serie_viejo
            }
        })
        self.assertEqual(r_fail.status_code, 400)
        self.assertIn("N° Serie Retirado", r_fail.get_json()['error'])

        # 3. Operador completa todos los campos requeridos y crea la tarea exitosamente
        r_ok = self.client.post('/api/tareas', json={
            "ticket": "STG-9941",
            "titulo": "Cambio de disco en Storage SAN 01",
            "cliente": "Telco Corp",
            "tipo_tarea": "reemplazo_discos",
            "estado": "en_progreso",
            "descripcion": "Disco en slot 04 en estado Predictive Failure.",
            "campos_extra": {
                "nro_serie_viejo": "SN-WD-9912044",
                "tipo_disco": "NVMe Gen4",
                "slot_rack": "Slot 04"
            }
        })
        self.assertEqual(r_ok.status_code, 201)
        tarea_creada = r_ok.get_json()['tarea']
        self.assertEqual(tarea_creada['tipo_tarea'], 'reemplazo_discos')
        self.assertEqual(tarea_creada['campos_extra']['nro_serie_viejo'], 'SN-WD-9912044')
        self.assertEqual(tarea_creada['campos_extra']['tipo_disco'], 'NVMe Gen4')

        # 4. Consultar tarea por ID
        r_get_t = self.client.get(f"/api/tareas/{tarea_creada['id']}")
        self.assertEqual(r_get_t.status_code, 200)
        self.assertEqual(r_get_t.get_json()['campos_extra']['slot_rack'], 'Slot 04')

    def test_12_historico_casos_endpoints_y_categorias(self):
        # 1. Crear bitácoras históricas (de días pasados)
        ayer = date.today() - timedelta(days=2)
        antier = date.today() - timedelta(days=5)

        b_ayer = Bitacora(region_id=self.region.id, fecha=ayer, turno="tarde", estado="cerrada")
        b_antier = Bitacora(region_id=self.region.id, fecha=antier, turno="manana", estado="cerrada")
        db.session.add_all([b_ayer, b_antier])
        db.session.flush()

        # Crear tareas en cada una de las 8 categorías
        t_normal = Tarea(
            bitacora_id=b_antier.id, operador_id=self.operador.id, tipo_tarea="manos_inteligentes",
            ticket="RH-HST-01", titulo="Reemplazo SFP+", cliente="Cliente A", estado="completada", descripcion="SFP cambiado"
        )
        t_personal = Tarea(
            bitacora_id=b_antier.id, operador_id=self.operador.id, tipo_tarea="acceso_tecnicos",
            ticket="TEC-HST-01", titulo="Técnico de fibra", cliente="Level 3", estado="completada", descripcion="Empalme ODF",
            campos_extra={"empresa_tecnico": "Lumen", "sala_datacenter": "Meet-Me Room"}
        )
        t_equipos = Tarea(
            bitacora_id=b_ayer.id, operador_id=self.operador.id, tipo_tarea="acceso_equipos",
            ticket="EQ-HST-01", titulo="Ingreso Servidor Dell", cliente="Banco B", estado="completada", descripcion="Servidor 2U",
            campos_extra={"sala_datacenter": "Sala A"}
        )
        t_mantenimiento = Tarea(
            bitacora_id=b_ayer.id, operador_id=self.supervisor.id, tipo_tarea="mantenimiento",
            ticket="MNT-HST-01", titulo="Corte de grupo electrógeno", cliente="DC Infra", estado="completada", descripcion="Prueba con carga",
            es_actividad_programada=True, fecha_programada_inicio=datetime.now(timezone.utc) - timedelta(days=2, hours=3),
            fecha_programada_fin=datetime.now(timezone.utc) - timedelta(days=2, hours=1),
            campos_extra={"sitio_mantenimiento": "Subestación 1"}
        )
        t_credencial = Tarea(
            bitacora_id=b_antier.id, operador_id=self.operador.id, tipo_tarea="alta_credencial_especial",
            ticket="CRD-HST-01", titulo="Credencial Auditoría", cliente="Financiera C", estado="completada", descripcion="Acceso auditores",
            es_actividad_programada=True, fecha_programada_inicio=datetime.now(timezone.utc) - timedelta(days=5, hours=8),
            fecha_programada_fin=datetime.now(timezone.utc) - timedelta(days=5, hours=2),
            campos_extra={"ticket_cliente": "TK-AUDIT-99", "credenciales_lista": [{"persona_propietaria": "Ana Gómez", "codigo_alfanumerico": "CRD-ANA-10"}]}
        )
        t_externo = Tarea(
            bitacora_id=b_ayer.id, operador_id=self.operador.id, tipo_tarea="manejo_sitio_externo",
            ticket="EXT-HST-01", titulo="Enlace Santiago", cliente="Telecom Chile", estado="completada", descripcion="Coordinación NOC",
            campos_extra={"sitio_externo": "Chile", "cantidad_contactos": 3}
        )
        t_nota = Tarea(
            bitacora_id=b_antier.id, operador_id=self.operador.id, tipo_tarea="nota_de_turno",
            ticket="NOT-HST-01", titulo="Relevo sin novedades", cliente="Interno", estado="completada", descripcion="Todo en orden durante el turno."
        )
        t_extra = Tarea(
            bitacora_id=b_ayer.id, operador_id=self.operador.id, tipo_tarea="tarea_extra",
            ticket="EXTR-HST-01", titulo="Ordenamiento de cableado", cliente="DC Ops", estado="completada", descripcion="Peinado de cables en Rack 14"
        )

        db.session.add_all([t_normal, t_personal, t_equipos, t_mantenimiento, t_credencial, t_externo, t_nota, t_extra])
        db.session.commit()

        # 2. Test vista HTML /historico
        self.login_as(self.operador)
        res_view = self.client.get('/historico')
        self.assertEqual(res_view.status_code, 200)

        # 3. Test API /api/historico general
        res_api = self.client.get('/api/historico')
        self.assertEqual(res_api.status_code, 200)
        items = res_api.get_json()
        self.assertGreaterEqual(len(items), 8)

        # 4. Test filtrado por categoría individual
        res_cred = self.client.get('/api/historico?categoria=credenciales')
        self.assertEqual(res_cred.status_code, 200)
        cred_items = res_cred.get_json()
        self.assertTrue(all(c['tipo_tarea'] == 'alta_credencial_especial' for c in cred_items))
        self.assertTrue(any(c['ticket'] == 'CRD-HST-01' for c in cred_items))

        res_mnt = self.client.get('/api/historico?categoria=mantenimientos')
        self.assertEqual(res_mnt.status_code, 200)
        mnt_items = res_mnt.get_json()
        self.assertTrue(all(m['tipo_tarea'] == 'mantenimiento' for m in mnt_items))

        # 5. Test filtro de fechas
        res_rango = self.client.get(f'/api/historico?fecha_desde={ayer.strftime("%Y-%m-%d")}&fecha_hasta={ayer.strftime("%Y-%m-%d")}')
        self.assertEqual(res_rango.status_code, 200)
        rango_items = res_rango.get_json()
        tickets_rango = [t['ticket'] for t in rango_items]
        self.assertIn('EQ-HST-01', tickets_rango)
        self.assertNotIn('RH-HST-01', tickets_rango) # Pertenece a antier

        # 6. Test Exportación a CSV
        res_csv = self.client.get('/api/historico?export=csv')
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn('text/csv', res_csv.content_type)
        csv_text = res_csv.data.decode('utf-8-sig')
        self.assertIn('CRD-HST-01', csv_text)
        self.assertIn('RH-HST-01', csv_text)

        # 7. Test Aislamiento Regional en histórico
        r2 = Region(nombre="Sede Remota", codigo="RM-02", activa=True)
        db.session.add(r2)
        db.session.flush()
        b_r2 = Bitacora(region_id=r2.id, fecha=date.today(), turno="manana", estado="cerrada")
        db.session.add(b_r2)
        db.session.flush()
        t_r2 = Tarea(
            bitacora_id=b_r2.id, operador_id=self.operador.id, tipo_tarea="manos_remotas",
            ticket="REM-HST-99", titulo="Tarea en Sede Remota", cliente="Cli R2", estado="completada", descripcion="desc"
        )
        db.session.add(t_r2)
        db.session.commit()

        # Operador de region 1 no debe ver la tarea de region 2
        res_op = self.client.get('/api/historico')
        op_tickets = [t['ticket'] for t in res_op.get_json()]
        self.assertNotIn('REM-HST-99', op_tickets)

        # Admin global sí puede consultarla o filtrar por region 2
        self.login_as(self.admin)
        res_adm = self.client.get(f'/api/historico?region_id={r2.id}')
        adm_tickets = [t['ticket'] for t in res_adm.get_json()]
        self.assertIn('REM-HST-99', adm_tickets)

    def test_13_operador_modificar_salas_dc(self):
        # 1. Operador normal accede a la vista /salas
        self.login_as(self.operador)
        r_view = self.client.get('/salas')
        self.assertEqual(r_view.status_code, 200)

        # 2. Operador modifica las salas de su propio Datacenter
        nuevas_salas = ["Sala A - Mainframe", "Sala B - Telecom", "Meet-Me Room 01", "Almacén Racks"]
        r_put = self.client.put(f'/api/config/{self.region.id}/salas', json={
            "salas_datacenter": nuevas_salas
        })
        self.assertEqual(r_put.status_code, 200)
        data_res = r_put.get_json()
        self.assertEqual(data_res['salas_datacenter'], nuevas_salas)

        # Verificar persistencia en configuración de la región
        cfg = RegionConfig.query.filter_by(region_id=self.region.id).first()
        self.assertEqual(cfg.salas_datacenter, nuevas_salas)

        # 3. Operador intenta modificar salas de otra región (aislamiento regional)
        r2 = Region(nombre="DC Montevideo", codigo="UY-MVD", activa=True)
        db.session.add(r2)
        db.session.commit()

        r_hack = self.client.put(f'/api/config/{r2.id}/salas', json={
            "salas_datacenter": ["Sala Hackeada"]
        })
        self.assertEqual(r_hack.status_code, 403)

    def test_14_perfil_usuario_info_completa_y_casos_normales(self):
        # 1. Asignar operador y operador2 a un equipo de trabajo
        self.login_as(self.supervisor)
        r_eq = self.client.post('/api/equipos', json={
            "nombre": "Equipo Datacenter Alfa",
            "descripcion": "Operadores de guardia en sala fría",
            "miembros_ids": [self.operador.id, self.operador2.id]
        })
        self.assertEqual(r_eq.status_code, 201)

        # Crear bitacora activa
        b_hoy = Bitacora(region_id=self.region.id, fecha=date.today(), turno="manana", estado="abierta")
        db.session.add(b_hoy)
        db.session.flush()

        # 2. Crear tareas para self.operador:
        # a) Casos normales no planificados (deben sumar a total_casos_normales)
        t_normal_1 = Tarea(
            bitacora_id=b_hoy.id, operador_id=self.operador.id, tipo_tarea="manos_inteligentes",
            ticket="RH-NORM-01", titulo="Cableado patchcord", cliente="Cliente X", estado="en_progreso",
            descripcion="Tendido de fibra", es_actividad_programada=False
        )
        t_normal_2 = Tarea(
            bitacora_id=b_hoy.id, operador_id=self.operador.id, tipo_tarea="virtualizacion",
            ticket="VM-NORM-02", titulo="Deploy VM Debian", cliente="Cliente Y", estado="completada",
            descripcion="Creación de VM", es_actividad_programada=False
        )
        # b) Caso normal PERO PLANIFICADO (NO debe sumar)
        t_planificada = Tarea(
            bitacora_id=b_hoy.id, operador_id=self.operador.id, tipo_tarea="manos_remotas",
            ticket="RH-PLAN-03", titulo="Upgrade switch programado", cliente="Cliente Z", estado="pendiente",
            descripcion="Upgrade", es_actividad_programada=True,
            fecha_programada_inicio=datetime.now(timezone.utc),
            fecha_programada_fin=datetime.now(timezone.utc) + timedelta(hours=2)
        )
        # c) Credencial especial (NO debe sumar)
        t_cred = Tarea(
            bitacora_id=b_hoy.id, operador_id=self.operador.id, tipo_tarea="alta_credencial_especial",
            ticket="CRD-NORM-04", titulo="Credencial Proveedor", cliente="Cliente W", estado="completada",
            descripcion="Credencial", es_actividad_programada=True
        )
        # d) Tarea de otro operador (NO debe sumar)
        t_otro_op = Tarea(
            bitacora_id=b_hoy.id, operador_id=self.operador2.id, tipo_tarea="manos_inteligentes",
            ticket="RH-OP2-05", titulo="Tarea de compañero", cliente="Cliente V", estado="completada",
            descripcion="Tarea de op 2", es_actividad_programada=False
        )
        db.session.add_all([t_normal_1, t_normal_2, t_planificada, t_cred, t_otro_op])
        db.session.commit()

        # 3. Login como operador y consultar perfil
        self.login_as(self.operador)

        # GET vista /perfil
        r_perfil_view = self.client.get('/perfil')
        self.assertEqual(r_perfil_view.status_code, 200)

        # GET API /api/perfil/equipo
        r_api = self.client.get('/api/perfil/equipo')
        self.assertEqual(r_api.status_code, 200)
        data = r_api.get_json()

        # Verificar datos de usuario y sitio
        self.assertEqual(data['usuario']['username'], self.operador.username)
        self.assertEqual(data['usuario']['email'], self.operador.email)
        self.assertEqual(data['sitio'], self.region.nombre)
        self.assertEqual(data['sitio_codigo'], self.region.codigo)

        # Verificar KPI total_casos_normales (exactamente 2)
        self.assertEqual(data['total_casos_normales'], 2)

        # Verificar Supervisores
        supervisores_nombres = [s['nombre_completo'] for s in data['supervisores']]
        self.assertIn(self.supervisor.nombre_completo, supervisores_nombres)

        # Verificar Compañeros de la Sede (Sitio)
        comp_sitio_ids = [c['id'] for c in data['companeros_sitio']]
        self.assertIn(self.operador2.id, comp_sitio_ids)
        self.assertNotIn(self.operador.id, comp_sitio_ids) # No debe incluirse a sí mismo

        # Verificar Equipos asignados y Compañeros por Equipo
        mis_equipos = data['mis_equipos']
        self.assertEqual(len(mis_equipos), 1)
        self.assertEqual(mis_equipos[0]['nombre'], "Equipo Datacenter Alfa")
        comp_equipo_ids = [m['id'] for m in mis_equipos[0]['companeros_equipo']]
        self.assertIn(self.operador2.id, comp_equipo_ids)
        self.assertNotIn(self.operador.id, comp_equipo_ids)

if __name__ == '__main__':
    unittest.main()

