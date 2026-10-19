import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Support audio uploads and structured payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS & Preflight Handling for API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// VAPID Configuration for Web Push
// Use provided env vars or fallback to a persistent default test keypair
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BDbXhM_5O1xdJcldjjBBWtrmUtw_iWWfbiHOQlKjBmo8OvNC68_YJd453m06CRG9wXMm9o3Y2r1Y-PTO6_NqqqE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'w3lBNFcdyiOsNFccs1K9LeFgGTo507T6PlbOCOuZDI8';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@studyflow.app';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error('[WebPush] Error setting VAPID details:', err);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'StudyFlow',
    timestamp: new Date().toISOString(),
    vapidConfigured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
  });
});

// 2. Get Public VAPID Key for client Web Push registration
app.get('/api/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// 3. Send direct test push notification
app.post('/api/push/send-test', async (req: Request, res: Response) => {
  const { subscription, title, body, url } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Falta el objeto de suscripción válido' });
  }

  const payload = JSON.stringify({
    title: title || 'StudyFlow — Notificación de Prueba',
    body: body || '¡Las notificaciones Web Push están funcionando correctamente!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: url || '/',
    tag: 'test-notification-' + Date.now(),
  });

  try {
    const result = await webpush.sendNotification(subscription, payload);
    return res.json({
      success: true,
      statusCode: result.statusCode,
      message: 'Notificación enviada con éxito',
    });
  } catch (error: any) {
    console.error('[WebPush] Error sending test notification:', error);
    // If 410 or 404, subscription expired
    const isExpired = error.statusCode === 410 || error.statusCode === 404;
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Error al enviar notificación push',
      statusCode: error.statusCode,
      expired: isExpired,
    });
  }
});

// 4. Trigger scheduled/manual reminders evaluation
app.post('/api/push/trigger-reminder', async (req: Request, res: Response) => {
  const { subscription, itemsSummary } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Falta la suscripción' });
  }

  const payload = JSON.stringify({
    title: 'StudyFlow — Recordatorio Académico',
    body: itemsSummary || 'Tienes tareas y revisiones académicas pendientes.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/',
    tag: 'daily-reminder-' + Date.now(),
  });

  try {
    const result = await webpush.sendNotification(subscription, payload);
    return res.json({ success: true, statusCode: result.statusCode });
  } catch (error: any) {
    console.error('[WebPush] Error triggering reminder:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Error al emitir recordatorio push',
    });
  }
});

// 5. Check Gemini Assistant API status
app.get('/api/gemini/status', (_req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10);
  res.json({
    available: isConfigured,
    model: 'gemini-3.8-flash',
  });
});

// 6. Gemini Voice / Text Academic Assistant
app.post('/api/gemini/analyze-voice', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, text, clientDate, timezone, existingSubjects } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
      return res.status(400).json({
        error: 'No se ha configurado la variable GEMINI_API_KEY en el servidor. Configura tu API Key en la variable de entorno GEMINI_API_KEY para habilitar el análisis con Gemini.',
        missingKey: true,
      });
    }

    if (!audioBase64 && (!text || !text.trim())) {
      return res.status(400).json({
        error: 'No se recibió audio ni texto para procesar.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Temporal context anchoring
    const refDate = clientDate ? new Date(clientDate) : new Date();
    const tz = timezone || 'Europe/Madrid';

    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const currentDayName = dayNames[refDate.getDay()];
    const dateFormatted = refDate.toLocaleDateString('es-ES', {
      timeZone: tz,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = refDate.toLocaleTimeString('es-ES', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    });

    const subjectsListStr = Array.isArray(existingSubjects) && existingSubjects.length > 0
      ? existingSubjects.join(', ')
      : 'Matemáticas, Física, Lengua, Historia, Inglés, Química, Biología, Filosofía';

    const systemInstruction = `Eres el asistente de voz inteligente de StudyFlow, una plataforma académica para estudiantes.
Tu misión es interpretar lo que dice o escribe el estudiante y estructurarlo con absoluta precisión en registros de "deber" (tareas/entregas) y "examen" (evaluaciones/controles).

ANCLAJE TEMPORAL OBLIGATORIO:
- Fecha de hoy: ${dateFormatted} (${currentDayName}).
- Hora actual del estudiante: ${timeFormatted}.
- Zona horaria de referencia: ${tz}.
- Año de referencia: ${refDate.getFullYear()}.
- Asignaturas actuales del alumno: ${subjectsListStr}.

REGLAS DE CLASIFICACIÓN Y EXTRACCIÓN:
1. DISTINCIÓN ENTRE DEBER Y EXAMEN:
   - "examen", "control", "parcial", "recuperación", "prueba", "evaluación", "test" -> type: "examen"
   - "deberes", "ejercicios", "tarea", "trabajo", "entrega", "proyecto", "redacción", "ficha", "leer" -> type: "deber"

2. CÁLCULO DE FECHAS RELATIVAS (ZONA HORARIA ${tz}):
   - IMPORTANTE: No uses fechas pasadas. Todo lo asignado se refiere al futuro respecto a ${dateFormatted}.
   - "mañana": exactamente el día siguiente a ${dateFormatted}. Si es un deber y no dice hora, pon las 18:00 (18:00:00). Si es examen, pon las 09:30 (09:30:00).
   - "pasado mañana": dos días después.
   - "el jueves", "el viernes", etc.: el próximo jueves/viernes más cercano hacia adelante.
   - "el martes de la semana que viene" / "el próximo martes": el martes de la siguiente semana.
   - Fechas con día de mes (ej: "28 de octubre"): calcula la fecha completa de ese mes y año actual.
   - Las fechas deben devolverse en formato ISO 8601 estricto (ejemplo: "YYYY-MM-DDTHH:mm:ss").

3. ASIGNATURAS:
   - Si el estudiante menciona una materia ("Física", "Lengua", "Matemáticas"), asóciala a esa asignatura. Si coincide con alguna de las existentes (${subjectsListStr}), normalízala a ese nombre exacto.
   - Si menciona una materia no listada, indícala con su nombre con mayúscula inicial (ej: "Filosofía", "Economía").
   - Si no nombra materia pero se deduce del contexto (ej: "ejercicios de matrices" -> "Matemáticas"), asígnala razonablemente.

4. PRIORIDAD:
   - Para exámenes: 'alta' por defecto.
   - Para entregas urgentes o proyectos: 'alta' o 'media'.
   - Para deberes cotidianos: 'media' o 'baja'.

5. TRANSCRIPCIÓN:
   - En el campo 'transcription', incluye el texto completo fiel de lo que el alumno dijo o proporcionó.`;

    const parts: any[] = [];

    // Attach audio inline data if provided
    if (audioBase64) {
      let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
      if (!cleanMime) cleanMime = 'audio/webm';

      parts.push({
        inlineData: {
          mimeType: cleanMime,
          data: audioBase64,
        },
      });
    }

    if (text && text.trim()) {
      parts.push({
        text: `Texto proporcionado / transcrito por el alumno: "${text.trim()}"`,
      });
    }

    parts.push({
      text: `Analiza el audio o texto anterior y extrae todos los deberes y exámenes mencionados. Devuelve la lista estructurada con fechas concretas relativas a hoy (${dateFormatted}, ${currentDayName}).`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts,
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: {
              type: Type.STRING,
              description: 'Transcripción fiel del audio o texto.',
            },
            items: {
              type: Type.ARRAY,
              description: 'Lista de deberes y exámenes identificados.',
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "Tipo: 'deber' o 'examen'",
                  },
                  title: {
                    type: Type.STRING,
                    description: 'Título descriptivo de la tarea o examen.',
                  },
                  subject: {
                    type: Type.STRING,
                    description: 'Nombre de la materia o asignatura.',
                  },
                  date: {
                    type: Type.STRING,
                    description: 'Fecha en formato ISO 8601 (YYYY-MM-DDTHH:mm:ss)',
                  },
                  dateDescription: {
                    type: Type.STRING,
                    description: 'Explicación legible en español de la fecha (ej: Mañana a las 18:00, Jueves 22 de octubre)',
                  },
                  priority: {
                    type: Type.STRING,
                    description: "Prioridad: 'alta', 'media' o 'baja'",
                  },
                  notes: {
                    type: Type.STRING,
                    description: 'Detalles adicionales, temario o indicaciones especiales.',
                  },
                },
                required: ['type', 'title', 'subject', 'date', 'priority'],
              },
            },
          },
          required: ['transcription', 'items'],
        },
      },
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Gemini devolvió una respuesta vacía');
    }

    const parsed = JSON.parse(outputText);
    return res.json({
      success: true,
      transcription: parsed.transcription || text || '',
      items: parsed.items || [],
    });
  } catch (error: any) {
    console.error('[Gemini Voice Assistant] Error:', error);
    return res.status(500).json({
      error: error.message || 'Error al procesar la petición con Gemini',
    });
  }
});

// ----------------------------------------------------
// VITE INTEGRATION
// ----------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StudyFlow] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[StudyFlow] Failed to start server:', err);
  process.exit(1);
});
