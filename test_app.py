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

if __name__ == '__main__':
    unittest.main()
