import unittest
import json
from datetime import datetime, date, timedelta, timezone
from App import create_app
from App.extensions import db
from App.Models import Usuario, Region, RegionConfig, Bitacora, Tarea, Subtarea, Feedback

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

        db.session.add_all([t_tec, t_eq, t_cred, t_mnt])
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

        # Test API JSON Credenciales
        r_api_cred = self.client.get(f'/api/tv/{self.region.id}/credenciales')
        self.assertEqual(r_api_cred.status_code, 200)
        data_cred = r_api_cred.get_json()
        self.assertEqual(len(data_cred['credenciales']), 1)
        self.assertEqual(data_cred['credenciales'][0]['codigo_alfanumerico'], 'CRD-9988')

        # Test API JSON Planificadas
        r_api_plan = self.client.get(f'/api/tv/{self.region.id}/planificadas')
        self.assertEqual(r_api_plan.status_code, 200)
        data_plan = r_api_plan.get_json()
        self.assertTrue(len(data_plan['planificadas']) >= 1)

if __name__ == '__main__':
    unittest.main()
