import { USE_MOCK } from '../config.js';
import { mockApi } from './mock/mockApi.js';
import { realApi } from './realApi.js';

// Por defecto usa el simulador. Para el backend real: VITE_USE_MOCK=false
export const api = USE_MOCK ? mockApi : realApi;
export { ApiError } from './http.js';
