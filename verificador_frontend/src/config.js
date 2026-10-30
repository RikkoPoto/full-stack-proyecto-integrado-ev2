// Configuración leída de las variables de entorno (ver .env.example)
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export const PAGE_SIZE = 10;
