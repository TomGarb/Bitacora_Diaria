# Walkthrough — Bitácora Diaria para Centros de Operaciones (DOC)

Sistema web multi-región, genérico y configurable en caliente por supervisores (sub-admin) para operadores de Datacenter.

---

## 1. Arquitectura y Estructura del Repositorio

El proyecto implementa estrictamente una arquitectura modular donde **cada pantalla cuenta con su propio archivo `.py`, `.html`, `.css` y `.js`**:

```
Bitacora Centro Operaciones/
├── App/
│   ├── __init__.py              ← Application Factory create_app()
│   ├── config.py                ← Configuración (PostgreSQL y fallback a SQLite)
│   ├── extensions.py            ← Instancia de SQLAlchemy
│   ├── auth.py                  ← Decorators @login_required, @role_required, soporte Keycloak
│   ├── Models/
│   │   ├── __init__.py          ← Exportación unificada de modelos
│   │   ├── usuario.py           ← Modelo Usuario (roles: admin, sub_admin, operador)
│   │   ├── region.py            ← Modelo Region (AR-BA, CL-SCL, etc.)
│   │   ├── region_config.py     ← Configuración dinámica (turnos, salas, tipos, campos extra)
│   │   ├── bitacora.py          ← Modelo Bitácora de turno
│   │   ├── tarea.py             ← Modelo Tarea base con campos JSON
│   │   └── subtarea.py          ← Modelo Subtarea con comentarios del operador
│   ├── Routes/
│   │   ├── __init__.py          ← Registro central de Blueprints
│   │   ├── auth_routes.py       ← Login/Logout mock
│   │   ├── dashboard.py         ← Dashboard con KPIs en vivo
│   │   ├── tareas.py            ← CRUD de Tareas con filtros y validaciones
│   │   ├── subtareas.py         ← Endpoints de Subtareas
│   │   ├── bitacora.py          ← Apertura y cierre de turnos
│   │   ├── config_region.py     ← Editor dinámico para supervisores
│   │   ├── mail_preview.py      ← Vista previa del mail de resumen en tablas
│   │   └── admin.py             ← Administración global de regiones y usuarios
│   ├── Static/
│   │   ├── Css/
│   │   │   ├── base.css         ← Estilos globales, sidebar y modales
│   │   │   ├── login.css        ← Estilos de login
│   │   │   ├── dashboard.css    ← Estilos de métricas y gráficos
│   │   │   ├── tareas.css       ← Estilos de tareas, credenciales múltiples y scroll
│   │   │   ├── subtareas.css    ← Estilos de subtareas
│   │   │   ├── bitacora.css     ← Estilos de tarjetas de bitácora
│   │   │   ├── config_region.css← Estilos de editor de salas y tipos
│   │   │   ├── mail_preview.css ← Estilos de tablas ejecutivas del mail
│   │   │   └── admin.css        ← Estilos del panel de administración
│   │   └── Js/
│   │       ├── base.js          ← Helpers globales (fetchAPI, modales, toasts)
│   │       ├── login.js         ← Lógica de login
│   │       ├── dashboard.js     ← KPIs y distribución
│   │       ├── tareas.js        ← Constructor dinámico de tareas y credenciales
│   │       ├── subtareas.js     ← Subtareas modulares
│   │       ├── bitacora.js      ← Control de aperturas y cierres de turno
│   │       ├── config_region.js ← Guardado en caliente de configuración
│   │       ├── mail_preview.js  ← Renderizado estructurado por tablas del mail
│   │       └── admin.js         ← Manejo de usuarios y sedes
│   └── Templates/
│       ├── base.html            ← Layout maestro
│       ├── login.html           ← Login interactivo
│       ├── dashboard.html       ← Dashboard de control
│       ├── tareas.html          ← Formulario modal y tabla de tareas
│       ├── subtareas.html       ← Vista complementaria de subtareas
│       ├── bitacora.html        ← Gestión de bitácoras y novedades de cierre
│       ├── config_region.html   ← Editor de front por región (supervisores)
│       ├── mail_preview.html    ← Vista previa del mail organizada en tablas
│       └── admin.html           ← Panel de administración
├── Run.py                       ← Entry point del servidor
├── init_db.sql                  ← Script de creación de base de datos PostgreSQL
├── requirements.txt             ← Dependencias Python
├── seed_data.py                 ← Datos de prueba y roles
├── test_app.py                  ← Suite de tests unitarios
├── IMPLEMENTATION_PLAN.md       ← Plan de implementación y decisiones
├── WALKTHROUGH.md               ← Documentación y guía de uso
└── README.md                    ← Manual de inicio rápido
```

---

## 2. Requerimientos Clave y Reglas de Negocio Implementadas

### A. Múltiples Credenciales Especiales por Ticket
- En el tipo de tarea `alta_credencial_especial`, bajo un mismo Ticket y Ticket de Cliente, se permite asociar **múltiples personas** (con su respectivo Nombre y Apellido y Código Alfanumérico).
- El constructor en el modal cuenta con scroll independiente para admitir 1 a N credenciales sin desbordar la pantalla.

### B. Ingresos / Retiros de Equipos y Acceso de Técnicos
- Se marcan automáticamente como **actividades programadas**.
- Requieren obligatoriamente **Fecha y Hora de Inicio** (la fecha de fin es opcional).
- Permiten seleccionar la **Sala de Datacenter** correspondiente (ej: *Sala A, Sala B, Meet-Me Room, Jaula Telecom*).

### C. Mantenimientos Programados
- Se marcan automáticamente como **actividades programadas**.
- Requieren obligatoriamente **Fecha y Hora de Inicio Y Fecha y Hora de Fin**.
- Requieren especificar el **Sitio de Trabajo** (*Salas DC o Subestaciones*).

### D. Manejo de Sitios Externos
- Permite registrar el **Sitio Externo** (*Chile, Miami, Brasil, etc.*) y la **Cantidad de Contactos con Nosotros**.

### E. Gestión de Salas por Región / País
- En el panel de supervisor [`/config`](file:///c:/Users/Tomas/Desktop/Code/Bitacora%20Centro%20Operaciones/App/Templates/config_region.html), los supervisores pueden cargar y modificar las **Salas de Datacenter** específicas de su país/sede.

### F. Mail de Resumen en Tablas Ejecutivas
En [`/mail-preview`](file:///c:/Users/Tomas/Desktop/Code/Bitacora%20Centro%20Operaciones/App/Templates/mail_preview.html), el correo se genera en formato de tablas ordenadas:
1. **Notas de Turno / Novedades de Pase de Guardia** (arriba de todo).
2. **Contador Resumen de Actividades** (Total, Completadas, En Progreso, Pendientes, Programadas).
3. **Tabla 1: Casos del Operador del Turno** (Ticket, Cliente, Título, Tipo Tarea, Descripción, Estado).
4. **Tabla 2: Actividades Programadas** (Ingresos/Retiros de Equipos, Accesos de Técnicos y Mantenimientos desglosados con salas y horarios).
5. **Tabla 3: Altas de Credenciales Especiales** (Ticket, Cliente, Ticket Cliente, Tabla de personas y códigos alfanuméricos).
6. **Tabla 4: Manejo de Sitios Externos** (Ticket, Cliente, Sitio Externo [Chile/Miami], Cantidad de Contactos, Detalle).
7. **Tabla 5: Tareas Extras Aplicadas** (Ticket, Cliente, Título, Descripción, Estado).

- **Regla de visibilidad:** El operador ve únicamente **sus tareas cargadas + todas las actividades programadas del datacenter**. Supervisores y administradores ven el reporte consolidado.

---

## 3. Cuentas de Acceso Preconfiguradas

| Usuario | Contraseña | Rol | Región | Permisos |
| :--- | :--- | :--- | :--- | :--- |
| **`supervisor_ar`** | `demo123` | `sub_admin` | Buenos Aires | Configurar front en caliente, salas, turnos, cerrar bitácora |
| **`op_buenosaires`** | `demo123` | `operador` | Buenos Aires | Carga y gestión de tareas en Buenos Aires |
| **`op_santiago`** | `demo123` | `operador` | Santiago | Carga y gestión de tareas en Santiago |
| **`admin_global`** | `demo123` | `admin` | Global | Control total de regiones y usuarios |

---

## 4. Guía de Ejecución

1. **Instalación:**
   ```bash
   py -m pip install -r requirements.txt
   ```
2. **Carga de datos:**
   ```bash
   py seed_data.py
   ```
3. **Ejecución del servidor:**
   ```bash
   py Run.py
   ```
4. **Abrir en navegador:** `http://localhost:5000`
