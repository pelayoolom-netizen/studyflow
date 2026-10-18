import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

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
