# Verificador 2.0 — Front End

Interfaz web (React 19 + Tailwind CSS 4 + Vite) del sistema de verificación automática del cumplimiento de la Ley N.º 21.719 en sitios web. Parte del mockup original (misma paleta, tipografías y textos) y lo convierte en una aplicación real, lista para conectar con el backend.

## Ejecutar

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas de la lógica y del simulador
npm run build    # genera /dist
```

Por defecto funciona en **modo simulación**: no necesita backend y guarda los datos en el navegador.
Para conectarlo al backend real: copia `.env.example` a `.env`, pon `VITE_USE_MOCK=false` y sigue `docs/INTEGRACION_API.md`.

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/` | Ingresar la dirección y el alcance, ver qué se revisa y las últimas verificaciones |
| `/verificaciones/:id` | Escaneo en vivo: avance, etapas, registro, incumplimientos, cancelar y reintentar |
| `/verificaciones/:id/informe` | Informe: puntaje, clasificación, categorías, reglas con evidencia y qué corregir, comparación con la verificación anterior del mismo sitio, exportar PDF / CSV / JSON |
| `/historial` | Búsqueda, filtro por estado, paginación (filtros en la URL), reintentar y eliminar |
| `/integracion` | Referencia de la API para el equipo de backend |

## Qué se mejoró respecto del mockup

- **Aplicación real, no maqueta**: React con rutas, estados de carga, error y vacío en cada pantalla, avisos, y un `ErrorBoundary` contra pantallas en blanco.
- **Tiempo real sin perder eventos**: el estado del escaneo se arma aplicando eventos (SSE) sobre una "foto" inicial, de forma idempotente; si SSE falla, cae solo a consultas periódicas.
- **Capa de API intercambiable**: `src/api/mock/mockApi.js` y `src/api/realApi.js` tienen la misma interfaz; el simulador emite los mismos eventos que enviará el backend.
- **Reglas desde el catálogo** (`GET /rules`): la interfaz no tiene reglas escritas a mano, y cada una trae su referencia normativa.
- **Reintento real**: continúa desde el último paso, también desde el historial. Cancelar pide confirmación.
- **Verificación en curso visible desde cualquier pantalla** (indicador en el encabezado) y aviso al terminar.
- **Informe**: comparación con la verificación anterior (mejoraron / empeoraron), exportación CSV protegida contra inyección de fórmulas en Excel, PDF por impresión (o por el servidor cuando exista).
- **Tema claro, oscuro o automático**, accesibilidad (foco, lectores de pantalla, `prefers-reduced-motion`, enlace "Saltar al contenido") y diseño responsive probado en móvil.
- **Privacidad desde el diseño**: sin cookies, sin analítica, tipografías servidas desde la propia app (el mockup cargaba Google Fonts y el CDN de Tailwind), `credentials: 'omit'` y `referrer` desactivado.

## Estructura

```
src/
  api/        http.js · realApi.js · mock/ (simulador y catálogo de reglas de demostración)
  domain/     reglas de negocio puras: puntaje, clasificación, eventos, etapas, comparación
  context/    tema, avisos, catálogo de reglas, verificación activa
  hooks/      useScanStream (tiempo real), useAsync, utilidades
  lib/        formato de fechas, validación de URL, exportación
  components/ ui/ · layout/ · scan/ · report/ · history/
  pages/      una por ruta
  test/       pruebas (vitest)
docs/INTEGRACION_API.md
```

## Probar estados en modo simulación

En el pie de página, **Simulación** permite forzar un error a mitad del próximo escaneo. También falla cualquier dirección con «error» en el dominio, y recargar la página mientras corre un escaneo lo deja interrumpido.

## Pendiente de acordar con el backend

- Umbrales de clasificación (en el mockup: Bajo < 50, Parcial 50–84, Alto ≥ 85) y quién los calcula.
- Artículo exacto de la ley en cada regla (`legalRef`); en el simulador solo dice «Ley N.º 21.719».
- Exportación PDF desde el servidor (hoy, en simulación, usa la impresión del navegador).
