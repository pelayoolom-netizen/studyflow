// Web Push & Service Worker Notification Engine for StudyFlow
// Robust dual-mode: Real Service Worker / Browser Notifications + Server Web Push (VAPID)

function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
  hasNotificationAPI: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  backendAvailable: boolean;
  backendLatencyMs?: number;
  error?: string;
}

export interface NotificationResult {
  success: boolean;
  message: string;
  method?: 'service_worker' | 'native_notification' | 'server_web_push';
  details?: string;
  error?: string;
}

// Helper to fetch with timeout and strict non-HTML JSON parsing
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// 1. REGISTRO SEGURO DEL SERVICE WORKER (Idempotente)
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    // Si ya hay un registro activo, reutilizarlo
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing && existing.active) {
      return existing;
    }

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err: any) {
    console.warn('[StudyFlow] Service Worker registration failed:', err?.message || err);
    return null;
  }
}

// 2. DIAGNÓSTICO COMPLETO DEL ESTADO DE NOTIFICACIONES
export async function getPushStatus(): Promise<PushStatus> {
  const isClient = typeof window !== 'undefined';
  const hasNotificationAPI = isClient && 'Notification' in window;
  const hasServiceWorker = isClient && 'serviceWorker' in navigator;
  const hasPushManager = isClient && 'PushManager' in window;

  const isIOS = isClient && /iPad|iPhone|iPod/.test(navigator.userAgent || '');
  const isStandalone = isClient && (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );

  let permission: NotificationPermission = 'default';
  if (hasNotificationAPI) {
    try {
      permission = Notification.permission;
    } catch {
      permission = 'default';
    }
  }

  let registration: ServiceWorkerRegistration | null = null;
  let subscription: PushSubscription | null = null;
  let isSubscribed = false;

  if (hasServiceWorker) {
    try {
      registration = (await navigator.serviceWorker.getRegistration('/')) || null;
      if (registration && hasPushManager) {
        subscription = await registration.pushManager.getSubscription();
        isSubscribed = Boolean(subscription);
      }
    } catch (e) {
      console.warn('[StudyFlow] Error checking push subscription:', e);
    }
  }

  // Comprobar disponibilidad del backend sin bloquear
  let backendAvailable = false;
  let backendLatencyMs: number | undefined;

  try {
    const start = performance.now();
    const res = await fetchWithTimeout('/api/health', { method: 'GET' }, 2500);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.status === 'ok') {
        backendAvailable = true;
        backendLatencyMs = Math.round(performance.now() - start);
      }
    }
  } catch {
    backendAvailable = false;
  }

  let errorMessage: string | undefined;
  if (isIOS && !isStandalone) {
    errorMessage = 'En iPhone / iPad, Apple requiere instalar StudyFlow en la pantalla de inicio desde Safari para habilitar notificaciones.';
  } else if (!hasNotificationAPI) {
    errorMessage = 'Tu navegador no cuenta con la API de Notificaciones estándar.';
  } else if (permission === 'denied') {
    errorMessage = 'Permiso denegado por el usuario en el navegador. Es necesario desbloquearlo en los ajustes del sitio.';
  }

  return {
    isSupported: (hasNotificationAPI && hasServiceWorker),
    permission,
    isSubscribed,
    subscription,
    registration,
    hasNotificationAPI,
    hasServiceWorker,
    hasPushManager,
    isIOS,
    isStandalone,
    backendAvailable,
    backendLatencyMs,
    error: errorMessage,
  };
}

// 3. SOLICITUD DE PERMISO CON GESTO DEL USUARIO
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    // Manejo compatible con Promise y con callback antiguo
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('[StudyFlow] Error requesting Notification permission:', err);
    return 'denied';
  }
}

// 4. EMISIÓN DIRECTA DE NOTIFICACIÓN REAL (Garantizada mediante Service Worker o Notification API)
export async function showDirectNotification(
  title: string,
  options: {
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
  }
): Promise<{ success: boolean; method: string; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, method: 'none', error: 'Entorno no soportado.' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, method: 'none', error: 'Permiso no concedido.' };
  }

  const notificationOptions = {
    body: options.body,
    icon: options.icon || '/icon-192.png',
    badge: options.badge || '/icon-192.png',
    tag: options.tag || 'studyflow-' + Date.now(),
    data: {
      url: options.url || '/',
      timestamp: Date.now(),
    },
    // vibrate no soportado en todos los navegadores, pero no causa error
    vibrate: [100, 50, 100],
  };

  // Método 1: ServiceWorkerRegistration.showNotification (el estándar recomendado para PWAs)
  try {
    let reg = await navigator.serviceWorker?.getRegistration('/');
    if (!reg) {
      reg = (await registerServiceWorker()) || undefined;
    }

    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, notificationOptions);
      return { success: true, method: 'service_worker' };
    }
  } catch (err) {
    console.warn('[StudyFlow] SW showNotification failed, trying fallback:', err);
  }

  // Método 2: Mensaje al Service Worker activo
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: notificationOptions,
      });
      return { success: true, method: 'service_worker_message' };
    }
  } catch (err) {
    console.warn('[StudyFlow] SW postMessage failed:', err);
  }

  // Método 3: API Notification estándar del navegador
  try {
    if ('Notification' in window) {
      const n = new Notification(title, {
        body: notificationOptions.body,
        icon: notificationOptions.icon,
        badge: notificationOptions.badge,
        tag: notificationOptions.tag,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return { success: true, method: 'native_notification' };
    }
  } catch (err: any) {
    return {
      success: false,
      method: 'none',
      error: err?.message || 'Error al invocar la API de notificaciones del sistema.',
    };
  }

  return { success: false, method: 'none', error: 'No se encontró un canal de notificación válido.' };
}

// 5. SUSCRIPCIÓN A WEB PUSH (Para recepción con navegador en segundo plano)
export async function subscribeToPush(): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  try {
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') {
      return {
        success: false,
        error: perm === 'denied'
          ? 'Has bloqueado las notificaciones en tu navegador. Debes hacer clic en el icono de candado o configuración del sitio y cambiarlas a "Permitir".'
          : 'Permiso cancelado por el usuario.',
      };
    }

    const reg = await registerServiceWorker();
    if (!reg) {
      return { success: false, error: 'No se pudo inicializar el Service Worker en este dispositivo.' };
    }

    if (!('pushManager' in reg)) {
      return { success: false, error: 'Este navegador no soporta la Push API para segundo plano.' };
    }

    // Comprobar si ya existe suscripción
    let existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      localStorage.setItem('studyflow_push_subscription', JSON.stringify(existingSub));
      return { success: true, subscription: existingSub };
    }

    // Obtener clave pública VAPID del backend con timeout
    let publicKey = '';
    try {
      const keyRes = await fetchWithTimeout('/api/vapid-public-key', {}, 3500);
      const contentType = keyRes.headers.get('content-type') || '';
      if (keyRes.ok && contentType.includes('application/json')) {
        const keyData = await keyRes.json();
        publicKey = keyData.publicKey || '';
      }
    } catch {
      // Backend no disponible
    }

    // Fallback a clave VAPID pública oficial si el backend está en Vercel estático
    if (!publicKey) {
      publicKey = 'BDbXhM_5O1xdJcldjjBBWtrmUtw_iWWfbiHOQlKjBmo8OvNC68_YJd453m06CRG9wXMm9o3Y2r1Y-PTO6_NqqqE';
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    localStorage.setItem('studyflow_push_subscription', JSON.stringify(subscription));
    return { success: true, subscription };
  } catch (err: any) {
    console.warn('[WebPush] Subscription error:', err);
    return {
      success: false,
      error: err?.message || 'No se pudo completar la suscripción Web Push en este navegador.',
    };
  }
}

// 6. CANCELAR SUSCRIPCIÓN
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/');
    if (reg && 'pushManager' in reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
    }
    localStorage.removeItem('studyflow_push_subscription');
    return true;
  } catch (err) {
    console.error('Error unsubscribing:', err);
    return false;
  }
}

// 7. NOTIFICACIÓN DE PRUEBA (Flujo único, transparente y verificado)
export async function sendTestNotification(): Promise<NotificationResult> {
  const isClient = typeof window !== 'undefined';
  if (!isClient) {
    return { success: false, message: 'Operación no disponible fuera del navegador.' };
  }

  // Paso 1: Comprobar soporte del navegador
  if (!('Notification' in window)) {
    return {
      success: false,
      message: 'Tu navegador actual no admite notificaciones del sistema.',
      details: 'Prueba a abrir StudyFlow en Chrome, Edge, Firefox o instala la PWA en iOS.',
    };
  }

  // Paso 2: Comprobar y solicitar permiso si está pendiente
  let currentPerm = Notification.permission;
  if (currentPerm === 'denied') {
    return {
      success: false,
      message: 'El permiso de notificaciones está bloqueado.',
      details: 'Para desbloquearlo: pulsa en el icono de candado o ajustes junto a la URL del navegador, busca "Notificaciones", selecciona "Permitir" y recarga la página.',
    };
  }

  if (currentPerm === 'default') {
    currentPerm = await requestNotificationPermission();
    if (currentPerm !== 'granted') {
      return {
        success: false,
        message: 'No se concedió el permiso de notificaciones.',
        details: 'Debes pulsar "Permitir" en el diálogo del navegador cuando se te solicite.',
      };
    }
  }

  // Paso 3: Emisión de la notificación en el dispositivo
  const directResult = await showDirectNotification('StudyFlow — Notificación de Prueba', {
    body: '¡Todo listo! Las notificaciones de StudyFlow están funcionando correctamente en tu dispositivo.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'test-notification-' + Date.now(),
    url: '/',
  });

  if (!directResult.success) {
    return {
      success: false,
      message: 'No se pudo mostrar la notificación en la pantalla.',
      details: directResult.error || 'Verifica que tu sistema operativo no tenga activado el modo "No molestar" o "Concentración".',
    };
  }

  // Paso 4: Si existe suscripción push y backend, validar también canal push secundario
  let pushDetail = '';
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/');
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      const res = await fetchWithTimeout(
        '/api/push/send-test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub,
            title: 'StudyFlow — Notificación de Prueba (Push)',
            body: '¡Todo listo! Canal Web Push confirmado desde el servidor.',
          }),
        },
        3000
      );
      if (res.ok) {
        pushDetail = ' (Validado canal Web Push con el servidor)';
      }
    }
  } catch {
    // Si falla el canal de red secundario, la notificación local ya se mostró correctamente
  }

  return {
    success: true,
    message: `¡Notificación de prueba emitida con éxito en tu pantalla!${pushDetail}`,
    method: directResult.method as any,
  };
}

// 8. DISPARAR RECORDATORIO DIARIO AHORA (Manual)
export async function triggerDailyReminderNow(summaryText: string): Promise<NotificationResult> {
  const perm = Notification.permission;
  if (perm !== 'granted') {
    return {
      success: false,
      message: 'El permiso de notificaciones no está concedido.',
      details: 'Pulsa primero en "Activar Notificaciones" y concede el permiso en el navegador.',
    };
  }

  const direct = await showDirectNotification('StudyFlow — Resumen Diario', {
    body: summaryText || 'Tienes tareas y revisiones académicas programadas para hoy.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'daily-reminder-' + Date.now(),
    url: '/',
  });

  if (direct.success) {
    return {
      success: true,
      message: 'Resumen diario emitido en tu pantalla.',
      method: direct.method as any,
    };
  }

  return {
    success: false,
    message: 'Error al emitir el resumen diario.',
    details: direct.error,
  };
}
