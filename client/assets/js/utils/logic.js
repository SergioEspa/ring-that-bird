// logic.js
import { filterState } from "./state.js";

export function filterRingings(allRingings) {
    return allRingings.filter(r => {
        // Usamos filterState en lugar de leer el DOM directamente
        
        // Especie
        if (filterState.species && 
            !r.common_name.toLowerCase().includes(filterState.species) && 
            !r.sci_name.toLowerCase().includes(filterState.species)) return false;

        // Fechas
        if (filterState.dateRange.length === 2) {
             const d = r.capture_date.split('-').reverse().join('-'); // Ajusta según tu formato
             const start = filterState.dateRange[0].toISOString().split('T')[0];
             const end = filterState.dateRange[1].toISOString().split('T')[0];
             if(d < start || d > end) return false;
        }

        // Estación
        if (filterState.station && r.station !== filterState.station) return false;

        // Sexo y Edad
        if (filterState.sex.length > 0 && !filterState.sex.includes(r.sex)) return false;
        if (filterState.age.length > 0 && !filterState.age.includes(r.age)) return false;

        // Sliders
        if (r.underskin_fat < filterState.fat[0] || r.underskin_fat > filterState.fat[1]) return false;
        if (r.muscle < filterState.muscle[0] || r.muscle > filterState.muscle[1]) return false;

        return true;
    });
}