const db = require('../db');

const sql = `
-- 0. LIMPIEZA TOTAL (Para asegurar que el nuevo esquema se aplique sin errores de tipos previos)
DROP TABLE IF EXISTS public.foto CASCADE;
DROP TABLE IF EXISTS public.anillamiento CASCADE;
DROP TABLE IF EXISTS public.anilla_identidad CASCADE;
DROP TABLE IF EXISTS public.usuario CASCADE;
DROP TABLE IF EXISTS public.ave CASCADE;
DROP TABLE IF EXISTS public.remitente CASCADE;

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. REMITENTE (Esquemas oficiales de España y Extranjero)
CREATE TABLE IF NOT EXISTS public.remitente (
    id SERIAL PRIMARY KEY,
    nombre text UNIQUE NOT NULL, 
    descripcion text
);

-- 3. AVE (Biblioteca taxonómica)
CREATE TABLE IF NOT EXISTS public.ave (
    sci_name text PRIMARY KEY,
    common_name text NOT NULL,
    family text,
    description text,
    peninsule text,
    canary_islands text,
    north_africa text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. LA ANILLA (Identidad única: El DNI del ave)
CREATE TABLE IF NOT EXISTS public.anilla_identidad (
    id SERIAL PRIMARY KEY,
    codigo text NOT NULL, 
    remitente_id integer REFERENCES public.remitente(id) ON DELETE SET NULL,
    sci_name text REFERENCES public.ave(sci_name) ON DELETE SET NULL,
    UNIQUE(codigo, remitente_id) 
);

-- 5. USUARIO
CREATE TABLE IF NOT EXISTS public.usuario (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text DEFAULT 'Usuario'::text,
    email text UNIQUE NOT NULL,
    hashed_password text NOT NULL,
    is_admin boolean DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 6. ANILLAMIENTO (Evento de captura / recaptura / control)
CREATE TABLE IF NOT EXISTS public.anillamiento (
    id SERIAL PRIMARY KEY,
    anilla_id integer NOT NULL REFERENCES public.anilla_identidad(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
    
    -- Datos del evento
    capture_date date NOT NULL,
    capture_location text NOT NULL,
    is_recapture boolean DEFAULT false,
    
    -- Biometría (Datos variables en cada captura)
    bird_weight real,
    max_wingspan real,
    third_primary_wing real,
    tail real,
    tarsus real,
    beak real,
    underskin_fat integer,
    muscle integer,
    brood_patch integer, -- Escala técnica 0-5
    sex text,
    age text,
    notes text,
    observation text,
    origin text,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. FOTO
CREATE TABLE IF NOT EXISTS public.foto (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anillamiento_id integer NOT NULL REFERENCES public.anillamiento(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. DATOS INICIALES: REMITENTES OFICIALES DE ESPAÑA
INSERT INTO public.remitente (nombre, descripcion) VALUES 
('MITECO', 'Ministerio para la Transición Ecológica (Remite oficial del Estado actual)'),
('ARANZADI', 'Sociedad de Ciencias Aranzadi (San Sebastián)'),
('ICO', 'Institut Català d''Ornitologia (Barcelona)'),
('EBD-CSIC', 'Estación Biológica de Doñana (Sevilla)'),
('ICONA', 'Instituto para la Conservación de la Naturaleza (Remite histórico)'),
('SEO-MADRID', 'Sociedad Española de Ornitología (Remite histórico)'),
('EXTRANJERA', 'Anilla de una oficina fuera de España (EURING)')
ON CONFLICT (nombre) DO NOTHING;


ALTER TABLE anillamiento 
ADD COLUMN station VARCHAR(100);
`;

async function createTables() {
    try {
        console.log("🏗️ Construyendo tablas con el nuevo esquema (Entidad-Evento)...");
        await db.query(sql);
        console.log("✅ ¡Esquema actualizado y remitentes precargados con éxito!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error creando tablas:", err);
        process.exit(1);
    }
}

createTables();