-- Script de inicialización para PostgreSQL (Bitácora DOC)
-- Ejecutar en PostgreSQL con: psql -U postgres -f init_db.sql

-- 1. Crear base de datos si no existe
CREATE DATABASE bitacora_doc
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    CONNECTION LIMIT = -1;

\c bitacora_doc;

-- 2. Esquemas y Tablas Principales

-- Regiones
CREATE TABLE IF NOT EXISTS regiones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    descripcion TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Configuración Dinámica de Región (Frontend y Reglas de Negocio)
CREATE TABLE IF NOT EXISTS region_configs (
    id SERIAL PRIMARY KEY,
    region_id INTEGER NOT NULL UNIQUE REFERENCES regiones(id) ON DELETE CASCADE,
    tipos_tarea_habilitados JSONB NOT NULL DEFAULT '["manos_remotas", "manos_inteligentes", "acceso_equipos", "retiro_equipos", "acceso_tecnicos", "restore", "backup", "snapshot", "mantenimiento", "nota_de_turno", "tarea_extra", "virtualizacion", "incidente", "manejo_sitio_externo", "alta_credencial_especial"]'::jsonb,
    campos_extra JSONB NOT NULL DEFAULT '{
        "alta_credencial_especial": [
            {"nombre": "persona_propietaria", "tipo": "text", "requerido": true, "label": "Persona Propietaria"},
            {"nombre": "ticket_cliente", "tipo": "text", "requerido": true, "label": "Ticket de Cliente"},
            {"nombre": "codigo_alfanumerico", "tipo": "text", "requerido": true, "label": "Código Alfanumérico"}
        ]
    }'::jsonb,
    turnos_config JSONB NOT NULL DEFAULT '[
        {"id": "manana", "nombre": "Mañana", "horario": "07:00 a 15:00", "dias": "Lunes a Domingo"},
        {"id": "tarde", "nombre": "Tarde", "horario": "15:00 a 23:00", "dias": "Lunes a Domingo"},
        {"id": "noche", "nombre": "Noche", "horario": "23:00 a 07:00", "dias": "Lunes a Domingo"},
        {"id": "central", "nombre": "Central", "horario": "09:00 a 18:00", "dias": "Lunes a Viernes"}
    }'::jsonb,
    config_ui JSONB NOT NULL DEFAULT '{
        "titulo": "Bitácora de Centro de Operaciones",
        "tema_color": "#1e293b",
        "mostrar_subtareas": true
    }'::jsonb,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios (Preparado para Keycloak con 'sub' o ID federado)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(120) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'operador', -- 'admin', 'sub_admin', 'operador'
    region_id INTEGER REFERENCES regiones(id) ON DELETE SET NULL,
    keycloak_sub VARCHAR(100), -- ID único de Keycloak para integración futura
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bitácoras de Turno
CREATE TABLE IF NOT EXISTS bitacoras (
    id SERIAL PRIMARY KEY,
    region_id INTEGER NOT NULL REFERENCES regiones(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(30) NOT NULL, -- 'manana', 'tarde', 'noche', 'central' o custom
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta', -- 'abierta', 'cerrada'
    supervisor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    observaciones_cierre TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITHOUT TIME ZONE
);

-- Tareas
CREATE TABLE IF NOT EXISTS tareas (
    id SERIAL PRIMARY KEY,
    bitacora_id INTEGER NOT NULL REFERENCES bitacoras(id) ON DELETE CASCADE,
    operador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_tarea VARCHAR(60) NOT NULL,
    ticket VARCHAR(80) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    cliente VARCHAR(120) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'en_progreso', 'completada', 'cancelada'
    descripcion TEXT NOT NULL,
    es_actividad_programada BOOLEAN DEFAULT FALSE,
    fecha_programada_inicio TIMESTAMP WITHOUT TIME ZONE,
    fecha_programada_fin TIMESTAMP WITHOUT TIME ZONE,
    campos_extra JSONB DEFAULT '{}'::jsonb, -- Almacena persona_propietaria, ticket_cliente, etc.
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subtareas
CREATE TABLE IF NOT EXISTS subtareas (
    id SERIAL PRIMARY KEY,
    tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    ticket VARCHAR(80) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    descripcion TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_tareas_bitacora ON tareas(bitacora_id);
CREATE INDEX IF NOT EXISTS idx_tareas_operador ON tareas(operador_id);
CREATE INDEX IF NOT EXISTS idx_subtareas_tarea ON subtareas(tarea_id);
CREATE INDEX IF NOT EXISTS idx_bitacoras_region_fecha ON bitacoras(region_id, fecha);
