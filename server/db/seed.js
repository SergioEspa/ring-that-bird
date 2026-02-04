const db = require('../db');
const fs = require('fs');
const path = require('path');

async function seedBirds() {
    try {
        console.log("🌱 Iniciando siembra de datos de aves...");

        // 1. Leer los archivos JSON
        const listPath = path.join(__dirname, 'bird_data', 'birds_spain.json');
        const descPath = path.join(__dirname, 'bird_data', 'descriptions.json');

        const birdsList = JSON.parse(fs.readFileSync(listPath, 'utf8'));
        const descriptions = JSON.parse(fs.readFileSync(descPath, 'utf8'));

        console.log(`🦅 Se han encontrado ${birdsList.length} aves para procesar.`);

        // 2. Iterar e insertar
        let insertedCount = 0;

        for (const bird of birdsList) {
            // Buscamos si existe descripción para este nombre científico
            // Usamos bird.sciName tal cual viene en el JSON
            const descriptionText = descriptions[bird.sciName] || "Descripción no disponible.";

            await db.query(
                `INSERT INTO ave (
                    sci_name, 
                    common_name, 
                    family, 
                    description, 
                    peninsule, 
                    canary_islands, 
                    north_africa
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (sci_name) 
                DO UPDATE SET 
                    description = EXCLUDED.description,
                    peninsule = EXCLUDED.peninsule,
                    canary_islands = EXCLUDED.canary_islands,
                    north_africa = EXCLUDED.north_africa;`,
                [
                    bird.sciName,       // sci_name
                    bird.especie,       // common_name
                    bird.familia,       // family
                    descriptionText,    // description (Cruzado del otro JSON)
                    bird.PB || null,    // peninsule (Status Code)
                    bird.CA || null,    // canary_islands (Status Code)
                    bird.NA || null     // north_africa (Status Code)
                ]
            );
            insertedCount++;
            // Un pequeño log cada 50 aves para saber que avanza
            if (insertedCount % 50 === 0) process.stdout.write('.');
        }

        console.log(`\n✅ ¡Proceso finalizado! ${insertedCount} aves insertadas/actualizadas correctamente.`);
        process.exit(0);

    } catch (err) {
        console.error("\n❌ Error crítico importando datos:", err);
        process.exit(1);
    }
}

seedBirds();