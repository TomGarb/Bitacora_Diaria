# Bitácora de Centro de Operaciones (DOC)

Sistema web multi-región, genérico y configurable en caliente por supervisores para operadores de Datacenter. Desarrollado con **Python Flask**, **SQLAlchemy** (PostgreSQL con fallback automático a SQLite) y una arquitectura modular estricta donde cada pantalla cuenta con su propio archivo `.py`, `.html`, `.css` y `.js`.

---

## 🚀 Inicio Rápido

### 1. Clonar el repositorio y acceder
```bash
git clone <url-del-repositorio>
cd "Bitacora Centro Operaciones"
```

### 2. Configurar el entorno virtual e instalar dependencias
```bash
python -m venv .venv
# En Windows (PowerShell):
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

### 3. Configurar variables de entorno
Copia la plantilla de ejemplo y ajusta si deseas conectar a PostgreSQL:
```bash
cp .env.example .env
```
*(Nota: Si no hay servidor PostgreSQL disponible, el sistema iniciará automáticamente con base de datos SQLite local `bitacora_dev.db`).*

### 4. Inicializar base de datos con datos de demostración
```bash
py seed_data.py
```

### 5. Iniciar el servidor
```bash
py Run.py
```
Abre en tu navegador: **`http://localhost:5000`**

---

## 🖥️ Módulos Principales del Sistema

1. **📊 Dashboard Operativo (`/dashboard`)**:
   - KPIs en tiempo real: Tareas totales, en progreso, completadas y tasa de eficiencia.
   - Pestañas dinámicas segmentadas por grupos de trabajo y filtros temporales (Hoy, Semana, Mes).
2. **📝 Tareas Diarias y Bitácora Activa (`/tareas`, `/bitacora`)**:
   - Pestañas organizadas: Casos Normales, Credenciales Especiales, Tareas Planificadas.
   - Formularios dinámicos con campos configurables por sede y reglas de obligatoriedad según el tipo de tarea.
   - Subtareas y notas de seguimiento con auditoría de operadores.
   - Regla de ocultamiento automático de credenciales y tareas planificadas vencidas.
3. **🏛️ Histórico de Casos y Auditoría (`/historico`)**:
   - 8 pestañas temáticas de navegación rápida (*Casos Normales, Ingreso Personal, Ingreso/Egreso Equipos, Mantenimientos, Credenciales, Casos Externos, Notas, Tareas Extras*).
   - Filtros por rango de fechas, estados, texto libre y exportación a **CSV** en UTF-8 con BOM.
4. **📺 Dashboards Pasivos para Pantallas de TV (`/tv/<region_id>/...`)**:
   - Vistas pasivas en alto contraste con auto-refresh y auto-scroll:
     - `/tv/<region_id>/accesos`: Control de accesos de técnicos y equipamiento a salas.
     - `/tv/<region_id>/credenciales`: Proyección en tiempo real de credenciales vigentes (excluye vencidas).
     - `/tv/<region_id>/planificadas`: Agenda de mantenimientos y tareas programadas activas.
5. **🏢 Salas y Sitios del Datacenter (`/salas`)**:
   - Los operadores de cada sede pueden gestionar, renombrar y agregar salas y subestaciones de su datacenter con aislamiento regional estricto.
6. **👥 Equipos de Trabajo por Datacenter (`/equipos`, `/api/equipos`)**:
   - Creación y asignación de operadores a grupos especializados por sede (*Virtualización, Manos Remotas, Redes, etc.*).
7. **👤 Perfil de Usuario (`/perfil`)**:
   - Acceso con un clic en el avatar/nombre en la barra lateral.
   - Detalle de identidad, Datacenter, supervisores, compañeros de sede y desglose de compañeros por equipo.
   - Contador KPI exclusivo de **Casos Normales No Planificados**.
8. **✉️ Vista Previa del Reporte de Turno (`/mail-preview`)**:
   - Resumen estructurado en tablas ejecutivas para relevo de guardia y exportación/copia a correo.
9. **🛡️ Supervisión y Control RBAC (`/admin`, `/config`)**:
   - Sub-admins supervisan exclusivamente su sede; Admin global administra todas las regiones.
   - Editor en caliente de tipos de tareas, campos dinámicos y turnos.

---

## 👥 Cuentas Demo Disponibles

| Usuario | Contraseña | Rol | Sede |
| :--- | :--- | :--- | :--- |
| **`supervisor_ar`** | `demo123` | `sub_admin` | Datacenter Buenos Aires |
| **`op_buenosaires`** | `demo123` | `operador` | Datacenter Buenos Aires |
| **`op_santiago`** | `demo123` | `operador` | Datacenter Santiago |
| **`admin_global`** | `demo123` | `admin` | Global / Todas las Sedes |

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite completa de pruebas unitarias y de integración:
```bash
py test_app.py
```
*(14/14 tests pasando con 100% de cobertura funcional y aislamiento regional).*

---

## 📚 Documentación Técnica Adicional

- Consulta [WALKTHROUGH.md](WALKTHROUGH.md) para el detalle de cada pantalla, flujos y arquitectura completa.
- Consulta [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) para el modelo entidad-relación y especificaciones de base de datos.

