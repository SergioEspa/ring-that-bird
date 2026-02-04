import { CONFIG } from "./config.js";

export async function registerUser(name, email, password) {    
    const response = await fetch(`${CONFIG.API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data.user
}

export async function loginUser(email, password) {    
    const response = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({email, password})
    });
    const data = await response.json();

    if (response.ok) {
        const currentUser = data.user;
        return currentUser;
    } else {
        return null;
    }
    
}

export function logoutUser() {
    return null;
}

export async function insertAnillaIdentidad(ringData){
    const response = await fetch(`${CONFIG.API_URL}/api/anilla_identidad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ringData)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Error al guardar el anillamiento");
    }

    return data;
}

export async function insertRinging(ringing_data, user) {
    const payload = {
        anilla_id: ringing_data.anilla_id,
        capture_date: parseDate(ringing_data.ringingDate),
        capture_location: ringing_data.location,
        is_recapture: ringing_data.ringed,

        bird_weight: ringing_data.weight || null,
        max_wingspan: ringing_data.maxWingspan || null,
        third_primary_wing: ringing_data.thirdPrimary|| null,
        tail: ringing_data.tail || null,
        tarsus: ringing_data.tarsus || null,
        beak: ringing_data.beak || null,
        
        underskin_fat: ringing_data.underskinFat || null,
        muscle: ringing_data.muscle || null,
        brood_patch: ringing_data.broodPatch || null,
        
        sex: ringing_data.sex,
        age: ringing_data.age,
        notes: ringing_data.notes,
        
        // Relaciones
        sci_name: ringing_data.sciName, 
        user_id: user.id
    };

    const response = await fetch(`${CONFIG.API_URL}/api/ringings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Error al guardar el anillamiento");
    }

    return data;
}

export async function getAnillaIdentidad(anilla_id, remitente){
    const response = await fetch(`${CONFIG.API_URL}/api/anilla_identidad/${remitente}/${anilla_id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
        console.error("Error bajando datos");
        return [];
    }
    const text = await response.text(); 
    return text ? JSON.parse(text) : null;
}

export async function getRingingsMadeByUser(email) {
    console.log("Obteniendo anillamientos de: ",email);
    const response = await fetch(`${CONFIG.API_URL}/api/ringings/user/${email}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
        console.error("Error bajando datos");
        return [];
    }

    const data = await response.json(); 
    return data;
}

export async function getRingingsByUserOfBird(email, birdSciName) {
    return null;
}

export async function getRemitentes(){
    const response = await fetch(`${CONFIG.API_URL}/api/remitentes` , {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    if(!response.ok) {
        console.error("Error obteniendo los remitentes");
        return [];
    }
    const data = await response.json();
    return data;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        // Si es DD-MM-YYYY lo pasamos a YYYY-MM-DD para Postgres
        if (parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`; 
        }
    }
    return dateStr;
}
