import type { Request, Response } from 'express';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BDbXhM_5O1xdJcldjjBBWtrmUtw_iWWfbiHOQlKjBmo8OvNC68_YJd453m06CRG9wXMm9o3Y2r1Y-PTO6_NqqqE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'w3lBNFcdyiOsNFccs1K9LeFgGTo507T6PlbOCOuZDI8';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@studyflow.app';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn('VAPID setup warning:', e);
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { subscription, title, body, url } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Suscripción requerida' });
  }

  const payload = JSON.stringify({
    title: title || 'StudyFlow — Notificación de Prueba',
    body: body || '¡Notificaciones Web Push funcionando correctamente!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: url || '/',
    tag: 'test-' + Date.now(),
  });

  try {
    const result = await webpush.sendNotification(subscription, payload);
    return res.status(200).json({
      success: true,
      statusCode: result.statusCode,
      message: 'Notificación enviada con éxito',
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Error emitiendo notificación push',
      statusCode: err.statusCode,
    });
  }
}
