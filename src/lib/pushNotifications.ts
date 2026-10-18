// Web Push & Service Worker Client Manager

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  registration: ServiceWorkerRegistration | null;
  error?: string;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('[PWA] Service Worker registration failed:', err);
    return null;
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      isSupported: false,
      permission: 'default',
      isSubscribed: false,
      subscription: null,
      registration: null,
      error: 'Tu navegador o dispositivo no soporta la Web Push API directamente.',
    };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const permission = Notification.permission;
    let subscription: PushSubscription | null = null;

    if (reg) {
      subscription = await reg.pushManager.getSubscription();
    }

    return {
      isSupported: true,
      permission,
      isSubscribed: Boolean(subscription),
      subscription,
      registration: reg || null,
    };
  } catch (err: any) {
    return {
      isSupported: true,
      permission: Notification.permission,
      isSubscribed: false,
      subscription: null,
      registration: null,
      error: err.message,
    };
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

export async function subscribeToPush(): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  try {
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') {
      return { success: false, error: 'Permiso de notificaciones no concedido.' };
    }

    const reg = await registerServiceWorker();
    if (!reg) {
      return { success: false, error: 'No se pudo inicializar el Service Worker.' };
    }

    // Fetch VAPID public key from backend
    const keyRes = await fetch('/api/vapid-public-key');
    if (!keyRes.ok) {
      throw new Error('No se pudo obtener la clave pública VAPID del servidor');
    }
    const { publicKey } = await keyRes.json();
    if (!publicKey) {
      throw new Error('Clave VAPID no configurada en el servidor');
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Save subscription in localStorage for quick retrieval
    localStorage.setItem('studyflow_push_subscription', JSON.stringify(subscription));

    return { success: true, subscription };
  } catch (err: any) {
    console.error('[WebPush] Error subscribing:', err);
    return { success: false, error: err.message || 'Error en la suscripción Web Push' };
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        localStorage.removeItem('studyflow_push_subscription');
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('Error unsubscribing:', err);
    return false;
  }
}

export async function sendTestNotification(): Promise<{ success: boolean; message: string }> {
  try {
    const status = await getPushStatus();
    if (!status.isSubscribed || !status.subscription) {
      // Try subscribing first
      const subRes = await subscribeToPush();
      if (!subRes.success || !subRes.subscription) {
        return { success: false, message: subRes.error || 'Primero debes activar las notificaciones.' };
      }
      status.subscription = subRes.subscription;
    }

    const res = await fetch('/api/push/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: status.subscription,
        title: 'StudyFlow — Notificación de Prueba',
        body: '¡Excelente! Las notificaciones Push de StudyFlow están 100% operativas en tu dispositivo.',
        url: '/',
      }),
    });

    const data = await res.json();
    if (res.ok) {
      return { success: true, message: 'Notificación de prueba enviada al dispositivo.' };
    } else {
      return { success: false, message: data.error || 'Error del servidor al emitir notificación' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Error de conexión' };
  }
}

export async function triggerDailyReminderNow(summaryText: string): Promise<{ success: boolean; message: string }> {
  try {
    const status = await getPushStatus();
    if (!status.subscription) {
      return { success: false, message: 'Dispositivo no suscrito a notificaciones Push.' };
    }

    const res = await fetch('/api/push/trigger-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: status.subscription,
        itemsSummary: summaryText,
      }),
    });

    if (res.ok) {
      return { success: true, message: 'Recordatorio push emitido.' };
    }
    return { success: false, message: 'Error emitiendo recordatorio.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
