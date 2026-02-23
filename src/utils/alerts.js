/**
 * alerts.js — Sistema de alertas de precio client-side
 * Cero llamadas a la API. Usa localStorage para persistencia y
 * Browser Notification API para notificar al usuario.
 */

const STORAGE_KEY = 'gold_target_alerts';

// ─── Persistencia ────────────────────────────────────────────────────────────

/**
 * Lee las alertas guardadas en localStorage.
 * @returns {Array<{id: string, price: number, createdAt: number, triggered: boolean}>}
 */
export function getAlerts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Guarda el array completo de alertas en localStorage.
 * @param {Array} alerts
 */
function saveAlerts(alerts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

/**
 * Agrega una alerta a un precio específico.
 * @param {number} price
 * @returns {Array} — Lista actualizada de alertas
 */
export function addAlert(price) {
  const parsed = Number(price);
  if (isNaN(parsed) || parsed <= 0) return getAlerts();

  const alerts = getAlerts();
  const newAlert = {
    id: `alert_${Date.now()}`,
    price: parsed,
    createdAt: Date.now(),
    triggered: false,
  };

  const updated = [...alerts, newAlert];
  saveAlerts(updated);
  return updated;
}

/**
 * Elimina una alerta por su id.
 * @param {string} id
 * @returns {Array} — Lista actualizada de alertas
 */
export function removeAlert(id) {
  const updated = getAlerts().filter(a => a.id !== id);
  saveAlerts(updated);
  return updated;
}

// ─── Evaluación ───────────────────────────────────────────────────────────────

/**
 * Compara el precio actual con las alertas activas.
 * Marca como triggered y devuelve las que fueron disparadas.
 * Una alerta se dispara cuando el precio cruza su nivel (no solo se acerca).
 *
 * @param {number} currentPrice
 * @param {number} previousPrice — Precio del refresh anterior (para detectar el cruce)
 * @param {Array}  alerts
 * @returns {{ triggered: Array, remaining: Array }}
 */
export function checkAlerts(currentPrice, previousPrice, alerts) {
  if (!alerts || alerts.length === 0) return { triggered: [], remaining: alerts };

  const triggered = [];
  const remaining = [];

  for (const alert of alerts) {
    const { price } = alert;

    // Detectar cruce: el precio anterior estaba de un lado y el actual del otro
    const crossedUp = previousPrice < price && currentPrice >= price;
    const crossedDown = previousPrice > price && currentPrice <= price;

    if (crossedUp || crossedDown) {
      triggered.push({ ...alert, direction: crossedUp ? 'up' : 'down' });
    } else {
      remaining.push(alert);
    }
  }

  // Guardar solo las no disparadas (las disparadas se consumen)
  saveAlerts(remaining);
  return { triggered, remaining };
}

// ─── Browser Notifications ───────────────────────────────────────────────────

/**
 * Solicita permiso del browser para enviar notificaciones.
 * @returns {Promise<boolean>} — true si el permiso fue concedido
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Envía una notificación del browser.
 * @param {string} title
 * @param {string} body
 */
export function sendNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'gold-target-alert',
    });
  } catch {
    // Algunos browsers (ej. iOS Safari) no soportan la API completa
    console.warn('Browser notification failed:', title, body);
  }
}
