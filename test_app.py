import unittest
import json
from datetime import datetime, date
from App import create_app
from App.extensions import db
from App.Models import Usuario, Region, RegionConfig, Bitacora, Tarea, Subtarea

class TestBitacoraDOC(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # Crear región y usuario
        self.region = Region(nombre="Datacenter Test", codigo="TS-01", activa=True)
        db.session.add(self.region)
        db.session.flush()

        self.config = RegionConfig(
            region_id=self.region.id,
            tipos_tarea_habilitados=["manos_remotas", "alta_credencial_especial", "mantenimiento"],
            campos_extra={
                "alta_credencial_especial": [
                    {"nombre": "persona_propietaria", "label": "Persona Propietaria", "tipo": "text", "requerido": True},
                    {"nombre": "ticket_cliente", "label": "Ticket de Cliente", "tipo": "text", "requerido": True},
                    {"nombre": "codigo_alfanumerico", "label": "Código Alfanumérico", "tipo": "text", "requerido": True}
                ]
            }
        )
        db.session.add(self.config)

        # Usuario operador
        self.operador = Usuario(
            username="operador_test",
            email="op@test.corp",
            nombre_completo="Operador Test",
            rol="operador",
            region_id=self.region.id,
            activo=True
        )
        self.operador.set_password("demo123")

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

        db.session.add_all([self.operador, self.supervisor])
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

    def test_02_crear_tarea_credencial_especial_con_campos_extra(self):
        self.login_as(self.operador)
        
        # Payload con campos extra requeridos
        payload = {
            "ticket": "SEC-100",
            "titulo": "Entrega credencial sala fría",
            "cliente": "Cliente Alpha",
            "tipo_tarea": "alta_credencial_especial",
            "estado": "completada",
            "descripcion": "Acceso biométrico habilitado",
            "campos_extra": {
                "persona_propietaria": "Laura Torres",
                "ticket_cliente": "TK-CLI-900",
                "codigo_alfanumerico": "CR-LAURA-88"
            },
            "subtareas": [
                {"ticket": "SEC-100-A", "titulo": "Enrolar huella", "estado": "completada"}
            ]
        }

        res = self.client.post('/api/tareas', json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['tarea']['campos_extra']['persona_propietaria'], "Laura Torres")
        self.assertEqual(len(data['tarea']['subtareas']), 1)

    def test_03_configuracion_dinamica_supervisor(self):
        # Solo sub_admin o admin puede modificar config
        self.login_as(self.supervisor)
        
        update_payload = {
            "tipos_tarea_habilitados": ["manos_remotas", "virtualizacion"],
            "campos_extra": {
                "virtualizacion": [
                    {"nombre": "ip_asignada", "label": "IP Asignada", "tipo": "text", "requerido": True}
                ]
            },
            "turnos_config": [
                {"id": "manana", "nombre": "Mañana", "horario": "06:00 a 14:00", "dias": "Lun a Dom"}
            ]
        }

        res = self.client.put(f'/api/config/{self.region.id}', json=update_payload)
        self.assertEqual(res.status_code, 200)
        
        # Verificar que se guardó
        res_get = self.client.get(f'/api/config/{self.region.id}')
        cfg = res_get.get_json()['config']
        self.assertEqual(cfg['tipos_tarea_habilitados'], ["manos_remotas", "virtualizacion"])
        self.assertIn("virtualizacion", cfg['campos_extra'])

    def test_04_mail_preview_regla_visibilidad(self):
        self.login_as(self.operador)
        
        # Crear bitácora
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

        # Tarea 2: de otro usuario y NO programada (el operador NO debe verla)
        t2 = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.supervisor.id,
            tipo_tarea="manos_remotas",
            ticket="RH-2",
            titulo="Tarea privada de supervisor",
            cliente="Cli 2",
            estado="completada",
            descripcion="Desc 2",
            es_actividad_programada=False
        )

        # Tarea 3: de otro usuario pero SI PROGRAMADA (el operador SI debe verla)
        t3 = Tarea(
            bitacora_id=bitacora.id,
            operador_id=self.supervisor.id,
            tipo_tarea="mantenimiento",
            ticket="MNT-99",
            titulo="Corte Programado Generador",
            cliente="Datacenter",
            estado="pendiente",
            descripcion="Mantenimiento general",
            es_actividad_programada=True
        )

        db.session.add_all([t1, t2, t3])
        db.session.commit()

        # Consultar vista previa de mail como operador
        res = self.client.get(f'/api/mail-preview/data?bitacora_id={bitacora.id}')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        
        tickets_visibles = [t['ticket'] for t in data['tareas']]
        self.assertIn("RH-1", tickets_visibles)   # Suya
        self.assertIn("MNT-99", tickets_visibles) # Programada (visible a todos)
        self.assertNotIn("RH-2", tickets_visibles) # De otro y no programada (oculta)

if __name__ == '__main__':
    unittest.main()
