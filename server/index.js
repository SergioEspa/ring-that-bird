require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./db');
const fs = require('fs')

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/assets/birds', express.static(path.join(__dirname, 'bird_images')));

// --- 1. AUTENTICACIÓN ---

// Registro de Usuario
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await db.query(
            'INSERT INTO usuario (name, email, hashed_password) VALUES ($1, $2, $3) RETURNING id, name, email, is_admin',
            [name, email, hashedPassword]
        );
        
        res.json({ message: "Usuario registrado", user: newUser.rows[0] });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') return res.status(400).json({ error: "El email ya existe" });
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// Login de Usuario
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM usuario WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.hashed_password);
        if (!validPassword) return res.status(401).json({ error: "Credenciales inválidas" });

        // Actualizamos última conexión
        await db.query('UPDATE usuario SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        res.json({
            message: "Login correcto",
            user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error de servidor" });
    }
});

// --- 2. DATOS MAESTROS ---

// Obtener todas las aves
app.get('/api/aves', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM ave ORDER BY common_name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/images', async (req, res) => {
    const bird_name = req.query.name;
    const folder_path = path.join(__dirname, 'bird_images');
    const pathJPG = path.join(folder_path, `${bird_name}_thumb.jpg`);
    const pathJPEG = path.join(folder_path, `${bird_name}_thumb.jpeg`);
    if(fs.existsSync(pathJPG)){
        res.sendFile(pathJPG);
    }
    else if(fs.existsSync(pathJPEG)){
        res.sendFile(pathJPEG);
    }
    else{
        res.sendFile(path.join(folder_path, 'generic_bird.png'));
    }
});

// --- 3. ANILLAMIENTOS (TRANSACCIÓN) ---

app.post('/api/ringings', async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN'); // Empieza la transacción (Todo o nada)

        const d = req.body; // Datos del formulario
        
        const birdQuery = await client.query(
            'SELECT sci_name FROM ave WHERE sci_name = $1', 
            [d.sci_name]
        );
        
        if (birdQuery.rows.length === 0) {
            throw new Error(`La especie "${d.sci_name}" no existe en la base de datos.`);
        }

        const realBirdId = birdQuery.rows[0].sci_name;

        // 1. Insertar el anillamiento
        const insertRingingText = `
            INSERT INTO anillamiento (
                anilla_id, capture_date, capture_location,
                bird_weight, max_wingspan, third_primary_wing, tail, tarsus, beak,
                underskin_fat, muscle, brood_patch, 
                sex, age, notes, is_recapture, observation, origin, user_id, station
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            ) RETURNING id`;

        const ringingValues = [
            d.anilla_id, d.capture_date, d.capture_location,
            d.bird_weight || null, d.max_wingspan || null, d.third_primary_wing || null, 
            d.tail || null, d.tarsus || null, d.beak || null,
            d.underskin_fat || null, d.muscle || null, d.brood_patch || 0,
            d.sex, d.age, d.notes, d.is_recapture || false, d.observation, d.origin, d.user_id, d.station
        ];

        const resRinging = await client.query(insertRingingText, ringingValues);
        const newRingingId = resRinging.rows[0].id;

        // 2. Insertar la foto (si viene una URL) en la tabla separada
        if (d.image_url) {
            await client.query(
                'INSERT INTO foto (anillamiento_id, image_url) VALUES ($1, $2)',
                [newRingingId, d.image_url]
            );
        }

        await client.query('COMMIT'); // Confirmar cambios
        res.json({ message: "Guardado correctamente", id: newRingingId });

    } catch (err) {
        await client.query('ROLLBACK'); // Deshacer si falla
        console.error("Error en transacción:", err);
        res.status(500).json({ error: "Error al guardar los datos" });
    } finally {
        client.release();
    }
});

app.post('/api/anilla_identidad', async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN'); // Empieza la transacción (Todo o nada)

        const d = req.body; // Datos del formulario

        // 1. Insertar el anillamiento
        const anillaIdentidadText = `
            INSERT INTO anilla_identidad (
                codigo, remitente_id, sci_name
            ) VALUES (
                $1, $2, $3
            ) RETURNING id`;

        const AnillaIdentidadValues = [
            d.ringNumber, d.remitente, d.sciName
        ];

        const resAnillaIdentidad = await client.query(anillaIdentidadText, AnillaIdentidadValues);
        const newAnillaIdentidadId = resAnillaIdentidad.rows[0].id;

        await client.query('COMMIT'); // Confirmar cambios
        res.json({ message: "Guardado correctamente", id: newAnillaIdentidadId });

    } catch (err) {
        await client.query('ROLLBACK'); // Deshacer si falla
        console.error("Error en transacción:", err);
        res.status(500).json({ error: "Error al guardar los datos" });
    } finally {
        client.release();
    }
});

app.get('/api/anilla_identidad/:remitente/:codigo', async (req, res) => {
    try{
        const query = `
            SELECT a.* 
            FROM anilla_identidad a
            INNER JOIN remitente r ON r.id = a.remitente_id
            WHERE a.codigo=$1 AND r.nombre=$2
        `;
        const result = await db.query(query, [req.params.codigo, req.params.remitente])
        res.json(result.rows[0]);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener anillamientos de un usuario
app.get('/api/ringings/user/:email', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.id, 
                a.capture_date, 
                a.capture_location,
                a.bird_weight,
                a.underskin_fat,
                a.muscle,
                a.sex,
                a.age,
                a.notes,
                a.station,
                av.common_name, 
                av.sci_name,
                ai.codigo as codigo_anilla,
                r.nombre as nombre_remitente,
                f.image_url
            FROM anillamiento a
            JOIN usuario u ON a.user_id = u.id
            
            -- EL PUENTE: Conectamos el evento con la anilla física
            JOIN anilla_identidad ai ON a.anilla_id = ai.id
            
            -- EL DESTINO: Con la anilla, sabemos qué especie es
            JOIN ave av ON ai.sci_name = av.sci_name
            
            -- EXTRA: Sacamos el nombre del remitente (Aranzadi, etc)
            JOIN remitente r ON ai.remitente_id = r.id
            
            LEFT JOIN foto f ON a.id = f.anillamiento_id
            WHERE u.email = $1
            ORDER BY a.capture_date DESC
        `;
            
        const result = await db.query(query, [req.params.email]);
    
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/remitentes', async (req, res) => {
    try {
        const query = `
            SELECT * FROM remitente
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(400).json({ error: err.message});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});