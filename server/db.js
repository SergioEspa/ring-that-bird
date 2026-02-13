require('dotenv').config();
const { Pool, types } = require('pg');

types.setTypeParser(1082, (val) => val);

console.log("🔌 DEBUG CONEXIÓN:", {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,     // <--- ESTO ES LO IMPORTANTE
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Creamos la conexión usando los datos del archivo .env
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Mensaje de confirmación cuando se conecta
pool.on('connect', () => {
    console.log('✅ Conectado a la Base de Datos Postgres');
});

// Exportamos "query" para usarlo en otros archivos
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool,
};