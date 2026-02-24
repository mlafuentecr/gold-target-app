/**
 * goldApi.js — Capa de acceso a GoldAPI.io
 *
 * Reemplaza getGoldQuote() de TwelveData para el precio live.
 * Ventajas:
 *  - Una sola llamada devuelve precio + OHLC diario + cambio del día
 *  - No consume créditos de TwelveData (evita el error 429)
 *  - Plan gratuito: 30 req/hora (más que suficiente con refresh cada 2 min)
 *
 * Endpoint: GET https://www.goldapi.io/api/XAU/USD
 * Header: x-access-token: <VITE_GOLD_API_KEY>
 *
 * Response: {
 *   price: number,           — precio spot actual
 *   open_price: number,      — apertura del día
 *   high_price: number,      — máximo del día
 *   low_price: number,       — mínimo del día
 *   ch: number,              — cambio absoluto vs cierre anterior
 *   chp: number,             — cambio porcentual
 *   prev_close_price: number,— cierre anterior
 *   ask: number,
 *   bid: number,
 *   timestamp: number,
 * }
 *
 * Error response: { error: true, message: '...' }
 */

const GOLD_API_URL = 'https://www.goldapi.io/api/XAU/USD';
const API_KEY = import.meta.env.VITE_GOLD_API_KEY;

// ─── Helper interno ───────────────────────────────────────────────────────────

async function fetchWithValidation(signal) {
  if (!API_KEY) {
    throw new Error('VITE_GOLD_API_KEY no está configurada en .env');
  }

  const res = await fetch(GOLD_API_URL, {
    signal,
    headers: {
      'x-access-token': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    // 401 = API key inválida, 429 = rate limit, 403 = plan insuficiente
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
