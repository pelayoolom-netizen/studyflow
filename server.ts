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

// 6. Gemini Voice / Text Academic Assistant with Automatic Model Fallbacks
app.post('/api/gemini/analyze-voice', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, text, clientDate, timezone, existingSubjects } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
      return res.status(400).json({
        error: 'No se ha configurado la variable GEMINI_API_KEY en el servidor.',
        missingKey: true,
      });
    }

    const hasAudio = Boolean(audioBase64 && typeof audioBase64 === 'string' && audioBase64.trim().length > 100);
    const hasText = Boolean(text && typeof text === 'string' && text.trim().length > 0);

    if (!hasAudio && !hasText) {
      return res.status(400).json({
        error: 'No se recibió audio válido ni texto para procesar.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

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

    const systemInstruction = `Eres el asistente académico inteligente de StudyFlow.
Tu misión es interpretar lo que dice o escribe el estudiante y estructurarlo con absoluta fidelidad en registros de "deber" y "examen".

ANCLAJE TEMPORAL OBLIGATORIO:
- Fecha de referencia (hoy): ${dateFormatted} (${currentDayName}).
- Hora actual del estudiante: ${timeFormatted}.
- Zona horaria de referencia: ${tz}.
- Año de referencia: ${refDate.getFullYear()}.
- Asignaturas registradas del alumno: ${subjectsListStr}.

REGLAS DE CLASIFICACIÓN Y EXTRACCIÓN:
1. DISTINCIÓN:
   - "examen", "control", "parcial", "recuperación", "prueba", "evaluación", "test" -> type: "examen"
   - "deberes", "ejercicios", "tarea", "trabajo", "entrega", "proyecto", "redacción", "ficha", "leer" -> type: "deber"

2. CÁLCULO DE FECHAS RELATIVAS (ZONA HORARIA ${tz}):
   - No generes fechas en el pasado respecto a ${dateFormatted}.
   - "mañana": el día siguiente. Si es deber y no especifica hora, usa las 18:00 (18:00:00). Si es examen, las 09:30 (09:30:00).
   - "pasado mañana": dos días después.
   - "el jueves", "el viernes", etc.: el próximo jueves/viernes más cercano hacia adelante.
   - "el martes de la semana que viene": el martes de la próxima semana.
   - Siempre devuelve el campo 'date' en formato ISO 8601 completo estricto (ejemplo: "YYYY-MM-DDTHH:mm:ss"). No devuelvas palabras en el campo 'date'.
   - En el campo 'dateDescription', añade una frase explicativa legible en español (ej: "Mañana a las 18:00", "Jueves 22 de octubre").

3. ASIGNATURAS:
   - Asocia cada tarea a la asignatura que mencione el estudiante ("Física", "Lengua", "Matemáticas").
   - Si coincide con alguna de las asignaturas existentes (${subjectsListStr}), normalízala exactamente.
   - Si no nombra asignatura pero se deduce (ej: "ejercicios de matrices" -> "Matemáticas"), asígnala inteligentemente.

4. PRIORIDAD:
   - Para exámenes: 'alta' por defecto.
   - Para entregas urgentes o trabajos: 'alta' o 'media'.
   - Para deberes cotidianos: 'media' o 'baja'.

5. TRANSCRIPCIÓN:
   - En 'transcription', incluye el texto completo de lo que el alumno dijo o escribió.`;

    const parts: any[] = [];

    // Attach audio inline data if provided
    if (hasAudio) {
      let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
      if (!cleanMime || cleanMime === 'audio') cleanMime = 'audio/webm';
      // Strip potential extra spaces
      parts.push({
        inlineData: {
          mimeType: cleanMime,
          data: audioBase64.replace(/\s/g, ''),
        },
      });
    }

    if (hasText) {
      parts.push({
        text: `Texto proporcionado por el alumno: "${text.trim()}"`,
      });
    }

    parts.push({
      text: `Analiza el contenido anterior y extrae todos los deberes y exámenes mencionados. Devuelve la lista estructurada con fechas concretas relativas a hoy (${dateFormatted}, ${currentDayName}).`,
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        transcription: {
          type: Type.STRING,
          description: 'Transcripción fiel del audio o texto expresado por el alumno.',
        },
        items: {
          type: Type.ARRAY,
          description: 'Lista de deberes y exámenes identificados.',
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "Tipo de registro: estrictamente 'deber' o 'examen'",
              },
              title: {
                type: Type.STRING,
                description: 'Título claro y concreto de la tarea o examen.',
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
                description: 'Explicación legible en español de la fecha (ej: Mañana a las 18:00)',
              },
              priority: {
                type: Type.STRING,
                description: "Prioridad: 'alta', 'media' o 'baja'",
              },
              notes: {
                type: Type.STRING,
                description: 'Detalles adicionales, temario o páginas de ejercicios.',
              },
            },
            required: ['type', 'title', 'subject', 'date', 'priority'],
          },
        },
      },
      required: ['transcription', 'items'],
    };

    // Candidates in prioritized order with automatic fallback in case of high-demand spikes
    const CANDIDATE_MODELS = [
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];

    let lastError: any = null;
    let successfulResponse: any = null;
    let modelUsed = '';

    for (const model of CANDIDATE_MODELS) {
      try {
        console.log(`[Gemini Assistant] Intentando procesar con modelo: ${model}...`);
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts,
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        if (response && response.text) {
          successfulResponse = response;
          modelUsed = model;
          console.log(`[Gemini Assistant] Éxito con modelo: ${model}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Assistant] Modelo ${model} no disponible (${err.status || err.message}). Evaluando alternativa...`);
      }
    }

    if (!successfulResponse || !successfulResponse.text) {
      throw lastError || new Error('No se pudo procesar la solicitud con ninguno de los modelos de Gemini disponibles.');
    }

    let outputText = successfulResponse.text.trim();
    // Clean markdown wrapper if any
    if (outputText.startsWith('```json')) {
      outputText = outputText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (outputText.startsWith('```')) {
      outputText = outputText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(outputText);

    // Normalize items
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const normalizedItems = rawItems.map((item: any, idx: number) => {
      const rawType = String(item.type || '').toLowerCase();
      const isExam =
        rawType.includes('exam') ||
        rawType.includes('control') ||
        rawType.includes('parcial') ||
        rawType.includes('test') ||
        rawType.includes('prueba') ||
        rawType.includes('evalu');

      const type: 'deber' | 'examen' = isExam ? 'examen' : 'deber';

      let cleanPriority = String(item.priority || '').toLowerCase();
      if (!['alta', 'media', 'baja'].includes(cleanPriority)) {
        cleanPriority = isExam ? 'alta' : 'media';
      }

      // Validate date
      let parsedDate = item.date;
      const testD = new Date(parsedDate);
      if (!parsedDate || isNaN(testD.getTime())) {
        // Fallback relative date
        const fallback = new Date(refDate);
        fallback.setDate(fallback.getDate() + 1);
        if (isExam) {
          fallback.setHours(9, 30, 0, 0);
        } else {
          fallback.setHours(18, 0, 0, 0);
        }
        parsedDate = fallback.toISOString();
      } else {
        parsedDate = testD.toISOString();
      }

      return {
        id: `gemini-${Date.now()}-${idx}`,
        type,
        title: item.title?.trim() || (isExam ? 'Examen' : 'Tarea'),
        subject: item.subject?.trim() || 'General',
        date: parsedDate,
        dateDescription: item.dateDescription || undefined,
        priority: cleanPriority,
        notes: item.notes?.trim() || '',
      };
    });

    return res.json({
      success: true,
      modelUsed,
      transcription: parsed.transcription || text || '',
      items: normalizedItems,
    });
  } catch (error: any) {
    console.error('[Gemini Voice Assistant] Error general:', error);
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
