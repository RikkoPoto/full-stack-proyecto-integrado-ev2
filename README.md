# Integracion Frontend (React + Vite) y Backend (Django) - Verificador Ley N. 21.719

## 1. Estructura del Proyecto

El proyecto se encuentra separado en dos directorios independientes listos para desarrollo local y despliegue en produccion:

```text
proyecto_verificador_ley21719/
├── verificador_frontend/         # Aplicacion Frontend en React 19, Tailwind CSS 4 y Vite
├── backend_django/               # API REST y Motor de Verificacion en Django 5 + Playwright
├── docker-compose.yml            # Orquestacion completa para produccion (PostgreSQL + Django + Nginx)
└── integraciones_Api_django.md   # Documentacion tecnica de la arquitectura e interacciones
```

---

## 2. Flujo de Interaccion entre Frontend y Backend

El frontend en `verificador_frontend/src/api/realApi.js` se comunica con Django cuando la variable de entorno `VITE_USE_MOCK` esta configurada en `false`. Todas las llamadas utilizan `credentials: 'omit'` por principio de Privacidad desde el Diseno (sin cookies de sesion ni rastreo de usuarios).

### 2.1 Carga inicial del Catalogo (`GET /api/rules`)
Al montar la aplicacion, `CatalogProvider.jsx` solicita a Django el catalogo normativo. Django responde desde `auditor/catalog.py` con las 3 categorias (`PRI`, `CON`, `DER`) y las 15 reglas vinculadas a articulos especificos de la Ley N. 21.719.

### 2.2 Inicio de una Verificacion (`POST /api/scans`)
1. El usuario ingresa una URL y selecciona el alcance (`1`, `10` o `50` paginas) en `HomePage.jsx`.
2. El backend valida la sintaxis de la URL y ejecuta proteccion contra SSRF (`auditor/services/validators.py`), bloqueando `localhost`, `127.0.0.1` e IPs privadas (`10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`), incluyendo la resolucion DNS del dominio.
3. Se crea el registro `Scan` en estado `running` con identificador secuencial (`VER-YYYYMMDD-XXXX`), `step = 0` y `total = 17` (1 paso de conexion + 15 reglas + 1 paso de calculo final).
4. Se lanza un hilo de ejecucion en segundo plano (`auditor/services/scanner.py`) y se devuelve inmediatamente HTTP `201 Created` con la estructura JSON del escaneo.

### 2.3 Transmision de Avance en Tiempo Real (`GET /api/scans/{id}/events`)
1. Al navegar a `/verificaciones/:id`, el hook `useScanStream.js` abre una conexion `EventSource` hacia `/api/scans/{id}/events` y solicita en paralelo la foto actual mediante `GET /api/scans/{id}`.
2. Django sirve el flujo mediante `StreamingHttpResponse` con cabecera `Content-Type: text/event-stream; charset=utf-8` y `X-Accel-Buffering: no`.
3. A medida que el motor en `scanner.py` inspecciona el sitio con Playwright/HTTPX y BeautifulSoup4, persiste cada avance en base de datos y publica eventos en el broker en memoria (`auditor/services/events.py`):
   - `event: log` -> envia cada linea de registro con su marca de tiempo ISO 8601 y nivel (`info`, `ok`, `warn`, `fail`, `na`, `error`).
   - `event: progress` -> notifica el paso inicial de conexion (`{"step": 1, "total": 17}`).
   - `event: rule` -> emite el resultado de cada regla (`C` Cumple, `P` Parcial, `N` No cumple, `E` No evaluable) junto a la evidencia tecnica recolectada del DOM.
   - `event: done` -> emite el puntaje oficial (`score`), la clasificacion (`bajo`, `parcial`, `alto`) y la marca de tiempo de termino (`finishedAt`), cerrando el flujo SSE.
4. Si la conexion SSE se abre sobre una verificacion que ya finalizo (`done`, `error` o `cancelled`), Django emite inmediatamente el evento final correspondiente y cierra la conexion. Si SSE se interrumpe, el frontend cae automaticamente a polling cada 2 segundos sobre `GET /api/scans/{id}`.

### 2.4 Cancelacion y Reintento Incremental (`POST /api/scans/{id}/cancel` y `POST /api/scans/{id}/retry`)
- **Cancelacion**: Si el escaneo esta en estado `running`, activa la bandera de interrupcion del hilo trabajador, guarda el estado `cancelled`, emite `event: cancelled` por SSE y conserva el paso actual (`step`) y las reglas ya evaluadas. Si ya habia terminado, devuelve HTTP `409 Conflict`.
- **Reintento**: Solo permitido para estados `error` o `cancelled` (de lo contrario devuelve HTTP `409`). Incrementa el contador `retries`, limpia los campos de error, emite `event: retry` y reanuda la ejecucion exactamente desde `scan.step` sin repetir las reglas previamente evaluadas.

### 2.5 Historial, Comparacion y Eliminacion (`GET /api/scans` y `DELETE /api/scans/{id}`)
- `GET /api/scans?q=&status=&page=&pageSize=`: Filtra por coincidencia en la URL (`q`) y estado (`status`), devolviendo resultados paginados del mas reciente al mas antiguo.
- Cuando se abre un informe en `ReportPage.jsx`, el frontend consulta automaticamente el historial del mismo dominio para comparar que reglas mejoraron o empeoraron respecto de la auditoria anterior.
- `DELETE /api/scans/{id}`: Cancela el escaneo si estaba en curso, elimina el registro de la base de datos y responde HTTP `204 No Content`.

### 2.6 Exportacion de Informes e Integridad Criptografica (`GET /api/scans/{id}/report?format=pdf|csv|json`)
- Al finalizar cada escaneo, `Scan.compute_integrity_hash()` calcula una firma inmutable `SHA-256` sobre el resultado completo (cumpliendo con el requerimiento no funcional RNF-02 de integridad probatoria).
- `auditor/services/exporters.py` genera en el servidor:
  - **PDF**: Documento estructurado con ReportLab que incluye tabla de resumen, hash SHA-256, desglose de las 15 reglas, evidencias y acciones correctivas.
  - **CSV**: Archivo codificado en UTF-8 con BOM para compatibilidad directa con Microsoft Excel y sanitizacion contra inyeccion de formulas.
  - **JSON**: Estructura completa de auditoria incluyendo el sello `sha256`.

---

## 3. Ejecucion en Entorno de Desarrollo Local

### Paso 1: Levantar el Backend en Django (Puerto 8000)

```bash
cd backend_django
python -m venv venv
# En Windows:
venv\Scripts\activate
# En Linux / macOS:
source venv/bin/activate

pip install -r requirements.txt
playwright install chromium

python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Paso 2: Levantar el Frontend en React + Vite (Puerto 5173)

El archivo `verificador_frontend/.env` ya viene configurado con `VITE_USE_MOCK=false` y `VITE_API_PROXY=http://localhost:8000`. Vite redirige automaticamente todas las peticiones `/api` hacia Django sin requerir configuracion adicional.

```bash
cd verificador_frontend
npm install
npm run dev
```

Abrir `http://localhost:5173` en el navegador.

---

## 4. Despliegue en Produccion

Para desplegar el sistema completo en produccion con PostgreSQL 16, Gunicorn + Playwright y Nginx sirviendo el build optimizado de React y actuando como reverse proxy para la API y SSE:

```bash
docker compose up --build -d
```

- **Configuracion de Base de Datos**: En `backend_django/.env`, cambiar `DB_ENGINE=postgresql` y definir `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` y `DB_PORT` para utilizar PostgreSQL en lugar de SQLite.
- **Soporte SSE en Nginx**: El archivo `verificador_frontend/nginx.conf` incluye `proxy_buffering off;` y `proxy_cache off;` en el bloque `location /api/` para garantizar que los eventos Server-Sent Events lleguen en tiempo real al navegador sin retencion de buffer.
