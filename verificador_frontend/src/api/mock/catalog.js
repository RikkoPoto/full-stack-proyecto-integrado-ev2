// Catálogo de reglas de DEMOSTRACIÓN (solo para el simulador).
// En producción lo entrega el backend en GET /api/rules, cada regla con su referencia normativa.

const LAW = 'Ley N.º 21.719';

export const CATALOG = {
  categories: [
    { id: 'PRI', label: 'Política de privacidad' },
    { id: 'CON', label: 'Consentimiento y cookies' },
    { id: 'DER', label: 'Derechos de las personas' },
  ],
  rules: [
    { id: 'PRI-01', category: 'PRI', title: 'Enlace a la política de privacidad visible en el inicio', fix: 'Agregar un enlace visible a la política en el encabezado o el pie de página.', legalRef: LAW },
    { id: 'PRI-02', category: 'PRI', title: 'Política enlazada desde todas las páginas revisadas', fix: 'Incluir el enlace en la plantilla común de todas las páginas.', legalRef: LAW },
    { id: 'PRI-03', category: 'PRI', title: 'Identifica al responsable y su medio de contacto', fix: 'Indicar quién es el responsable del tratamiento y cómo contactarlo.', legalRef: LAW },
    { id: 'PRI-04', category: 'PRI', title: 'Describe las finalidades del tratamiento', fix: 'Detallar la finalidad de cada tipo de dato que se recolecta.', legalRef: LAW },
    { id: 'PRI-05', category: 'PRI', title: 'Informa el plazo de conservación de los datos', fix: 'Declarar el plazo de conservación o el criterio para definirlo.', legalRef: LAW },
    { id: 'CON-01', category: 'CON', title: 'Pide consentimiento antes de cargar cookies no esenciales', fix: 'Bloquear las cookies no esenciales hasta recibir el consentimiento.', legalRef: LAW },
    { id: 'CON-02', category: 'CON', title: 'Permite rechazar cookies tan fácil como aceptarlas', fix: 'Agregar un botón Rechazar al mismo nivel que Aceptar.', legalRef: LAW },
    { id: 'CON-03', category: 'CON', title: 'Permite elegir cookies por categoría', fix: 'Permitir aceptar o rechazar cada categoría por separado.', legalRef: LAW },
    { id: 'CON-04', category: 'CON', title: 'Formularios sin casillas de consentimiento premarcadas', fix: 'Dejar las casillas sin marcar por defecto.', legalRef: LAW },
    { id: 'CON-05', category: 'CON', title: 'Formularios enlazan a la política de privacidad', fix: 'Agregar el enlace a la política junto al botón de envío.', legalRef: LAW },
    { id: 'DER-01', category: 'DER', title: 'Canal para solicitar acceso a los datos', fix: 'Habilitar un formulario o un correo para solicitar acceso.', legalRef: LAW },
    { id: 'DER-02', category: 'DER', title: 'Canal para solicitar rectificación', fix: 'Habilitar un canal para solicitar rectificación.', legalRef: LAW },
    { id: 'DER-03', category: 'DER', title: 'Canal para solicitar cancelación (supresión)', fix: 'Agregar la opción de solicitar cancelación (supresión).', legalRef: LAW },
    { id: 'DER-04', category: 'DER', title: 'Canal para ejercer oposición al tratamiento', fix: 'Habilitar un canal para ejercer el derecho de oposición.', legalRef: LAW },
    { id: 'DER-05', category: 'DER', title: 'Canal para solicitar portabilidad', fix: 'Habilitar un canal para solicitar portabilidad.', legalRef: LAW },
  ],
};

// Textos de evidencia que el simulador entrega por resultado (en producción, los genera el backend).
const EVIDENCE = {
  'PRI-01': ['Enlace encontrado en el pie de página: a[href="/privacidad"].', 'No hay enlaces con texto o ruta de privacidad en la página de inicio.'],
  'PRI-02': ['El enlace aparece en 10 de 10 páginas revisadas.', 'El enlace falta en 4 de 10 páginas revisadas.'],
  'PRI-03': ['Se nombra al responsable y se indica un correo de contacto.', 'El texto de /privacidad no nombra al responsable ni da un medio de contacto.'],
  'PRI-04': ['Las finalidades se detallan por tipo de dato.', 'Se mencionan finalidades generales, sin vincularlas a cada tipo de dato recolectado.'],
  'PRI-05': ['Se declara un plazo de conservación.', 'No hay ninguna mención a plazos de conservación en la política.'],
  'CON-01': ['No se cargan cookies no esenciales antes de aceptar.', 'Se cargaron 3 cookies de analítica antes de que la persona interactuara con el banner.'],
  'CON-02': ['El banner ofrece Aceptar y Rechazar con el mismo peso visual.', 'El banner tiene un botón Aceptar, pero rechazar exige abrir la configuración.'],
  'CON-03': ['El banner ofrece las categorías necesarias, analítica y marketing.', 'El banner no permite elegir por categoría.'],
  'CON-04': ['Se revisaron 2 formularios; ninguna casilla viene marcada.', 'Hay casillas de consentimiento marcadas de antemano.'],
  'CON-05': ['Los 2 formularios revisados enlazan a la política.', 'Los formularios no enlazan a la política de privacidad.'],
  'DER-01': ['/derechos incluye la opción Acceso a mis datos.', 'No se encontró un canal para pedir acceso.'],
  'DER-02': ['/derechos incluye la opción Rectificar mis datos.', 'No se encontró un canal para pedir rectificación.'],
  'DER-03': ['/derechos incluye la opción Eliminar mis datos.', '/derechos no incluye una opción para solicitar la supresión de datos.'],
  'DER-04': ['/derechos incluye la opción Oponerme al tratamiento.', 'No se encontró un canal para oponerse al tratamiento.'],
  'DER-05': ['/derechos incluye la opción Portabilidad.', 'No se encontró un canal para pedir portabilidad.'],
};
const NOT_EVALUABLE = 'La página de derechos carga su contenido con scripts y no se pudo leer de forma automática. Requiere revisión manual.';

export function evidenceFor(ruleId, status) {
  if (status === 'C') return EVIDENCE[ruleId]?.[0] ?? 'Cumple el criterio.';
  if (status === 'E') return NOT_EVALUABLE;
  return EVIDENCE[ruleId]?.[1] ?? 'No cumple el criterio.';
}

// Pasos de un escaneo: conexión + una por regla + cálculo final
export const TOTAL_STEPS = CATALOG.rules.length + 2;
