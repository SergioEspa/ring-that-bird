const IS_PRODUCTION = false; 

export const CONFIG = {
    API_URL: IS_PRODUCTION 
        ? 'https://api.tu-dominio.com'
        : 'http://localhost:3000',
    // Nueva variable para las imágenes
    IMAGES_URL: IS_PRODUCTION
        ? 'https://api.tu-dominio.com/api/assets/birds'
        : 'http://localhost:3000/api/assets/birds'
};