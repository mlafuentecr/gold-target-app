/**
 * goldApi.js — Capa de acceso a GoldAPI
 *
 * La app usa el endpoint público actual documentado en goldapi.net y envía
 * la clave en el querystring como `x-api-key`.
 */

const GOLD_API_URL = 'https://app.goldapi.net/price/XAU/USD';
const API_KEY = import.meta.env.VITE_GOLD_API_KEY;

// ─── Helper interno ───────────────────────────────────────────────────────────

async function fetchWithValidation(signal) {
  if (!API_KEY) {
    throw new Error('VITE_GOLD_API_KEY no está configurada en .env');
  }

  const url = new URL(GOLD_API_URL);
  url.searchParams.set('x-api-key', API_KEY);

  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('GoldAPI rechazó la clave o el método de autenticación');
    }
    if (res.status === 429) {
      throw new Error('GoldAPI alcanzó el límite de peticiones');
    }
    throw new Error(`GoldAPI HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();

  // GoldAPI devuelve { error: true, message: '...' } en algunos errores
  if (json?.error) {
    throw new Error(`GoldAPI error: ${json.message || 'Unknown error'}`);
  }

  return json;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Obtiene el precio spot actual de XAU/USD y el OHLC del día.
 * Usar para el polling de precio (reemplaza getGoldQuote de TwelveData).
 *
 * @param {AbortSignal} [signal]
 * @returns {Promise<{
 *   price: number,
 *   open_price: number,
 *   high_price: number,
 *   low_price: number,
 *   ch: number,
 *   chp: number,
 *   prev_close_price: number,
 *   timestamp: number,
 * }>}
 */
export async function getGoldSpot(signal) {
  return fetchWithValidation(signal);
}
