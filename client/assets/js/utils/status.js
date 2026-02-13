// state.js

// 1. Estado inicial (Valores por defecto)
export const filterState = {
    species: '',
    dateRange: [], // [DateStart, DateEnd]
    station: '',
    sex: [],       // ['macho', 'hembra']...
    age: [],       // ['juvenil']...
    underskin_fat: [0, 9],
    muscle: [0, 3],
    showOtherUser: false,
    // Aquí puedes guardar también el orden de la tabla
    tableSort: 'date_desc' 
};

// 2. Función para reiniciar (Limpiar)
export function resetFilterState() {
    filterState.species = '';
    filterState.dateRange = [];
    filterState.station = '';
    filterState.sex = [];
    filterState.age = [];
    filterState.fat = [0, 9];
    filterState.muscle = [0, 3];
    filterState.showOtherUser = false;
}