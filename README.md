# Bitácora de Centro de Operaciones (DOC)

Aplicación web integral para la gestión de bitácoras diarias de operadores de Datacenter. Sistema multi-región, genérico y configurable en caliente por supervisores.

---

## 🚀 Inicio Rápido

### 1. Clonar el repositorio y acceder
```bash
cd "Bitacora Centro Operaciones"
```

### 2. Instalar dependencias
```bash
py -m pip install -r requirements.txt
```

### 3. Poblar datos iniciales
```bash
py seed_data.py
```

### 4. Iniciar el servidor
```bash
py Run.py
```
Abre en tu navegador: **`http://localhost:5000`**

---

## 👥 Cuentas Demo Disponibles

- **Supervisor DOC Buenos Aires:** `supervisor_ar` / `demo123` *(Rol: sub_admin)*
- **Operador Buenos Aires:** `op_buenosaires` / `demo123` *(Rol: operador)*
- **Operador Santiago:** `op_santiago` / `demo123` *(Rol: operador)*
- **Administrador Global:** `admin_global` / `demo123` *(Rol: admin)*

---

## 📚 Documentación

- Consulta [WALKTHROUGH.md](WALKTHROUGH.md) para el detalle de cada pantalla, flujo de trabajo y módulos.
- Consulta [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) para la arquitectura de datos y catálogo de tipos de tareas.
