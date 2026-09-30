/**
 * twelveData.js — Capa de acceso a la API de TwelveData
 *
 * Mejoras respecto a la versión anterior:
 * - fetchWithValidation: chequea res.ok + status de error de TwelveData
 * - AbortSignal: todas las funciones aceptan `signal` para cancelar en cleanup
 * - API_KEY consistente: eliminado el uso inline de import.meta.env
 * - Nuevos endpoints: /quote (precio enriquecido), /rsi, /ema
 * - Eliminada getGoldCurrentPrice (reemplazada por getGoldQuote)
 */

import { isValidApiResponse } from '../utils/validate';

const API_KEY  = import.meta.env.VITE_TWELVE_API_KEY;
const BASE_URL = 'https://api.twelvedata.com';
// Defaults disponibles en la cuenta actual: dólar local y Treasury 2Y.
// Para fortaleza global del dólar se puede usar UUP; para un 10Y depende del
// catálogo/plan del proveedor.
const DOLLAR_SYMBOL = import.meta.env.VITE_DOLLAR_SYMBOL || 'USD/CRC';
const BOND_SYMBOL = import.meta.env.VITE_BOND_SYMBOL || 'US2Y';

// ─── Helper interno ───────────────────────────────────────────────────────────

/**
 * Fetch con validación de HTTP status y respuesta de TwelveData.
 * Lanza un Error descriptivo si algo falla.
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
async function fetchWithValidation(url, signal) {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();

  if (!isValidApiResponse(json)) {
    const msg = json?.message || json?.status || 'API error';
    throw new Error(`TwelveData error: ${msg}`);
  }

  return json;
}

// ─── Precio enriquecido ───────────────────────────────────────────────────────

/**
 * Devuelve un quote completo de XAU/USD en una sola llamada:
 * price, change, percent_change, previous_close, fifty_two_week.high/low, etc.
 *
 * Más eficiente que time_series para obtener el precio actual porque:
 * 1. El endpoint /quote refleja el último tick (no el cierre del último minuto)
 * 2. Incluye change y 52-week range sin llamadas adicionales
 *
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function getGoldQuote(signal) {
  const url = `${BASE_URL}/quote?symbol=XAU/USD&apikey=${API_KEY}`;
  return fetchWithValidation(url, signal);
}

/**
 * Devuelve el contexto macro mínimo para interpretar el oro.
 *
 * El dólar (por defecto USD/CRC) y un rendimiento Treasury (por defecto US2Y)
 * aportan contexto para interpretar el oro. Se consultan juntos para gastar
 * una sola llamada HTTP
 * (los créditos siguen contando por símbolo en TwelveData).
 *
 * Los símbolos se pueden cambiar sin tocar código mediante:
 * VITE_DOLLAR_SYMBOL y VITE_BOND_SYMBOL.
 *
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ dollar: Object|null, bond: Object|null }>}
 */
export async function getMacroQuotes(signal) {
  const symbols = `${DOLLAR_SYMBOL},${BOND_SYMBOL}`;
  const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbols)}&apikey=${API_KEY}`;
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  if (json?.status === 'error') {
    throw new Error(`TwelveData error: ${json.message || json.status}`);
  }

  // El batch devuelve un objeto indexado por símbolo. Mantener también el
  // caso de respuesta individual hace la integración tolerante a cambios del
  // proveedor o a un proxy que reduzca la consulta a un solo símbolo.
  const getQuote = (symbol) => {
    const quote = json?.[symbol] || (json?.symbol === symbol ? json : null);
    return quote && quote.status !== 'error' ? quote : null;
  };

  const dollar = getQuote(DOLLAR_SYMBOL);
  const bond = getQuote(BOND_SYMBOL);

  if (!dollar && !bond) {
    throw new Error('TwelveData no devolvió datos macro válidos');
  }

  return {
    dollar,
    bond,
    symbols: { dollar: DOLLAR_SYMBOL, bond: BOND_SYMBOL },
  };
}

// ─── Series de tiempo ─────────────────────────────────────────────────────────

/**
 * Serie diaria. Se solicitan suficientes velas para calcular indicadores
 * localmente sin consumir endpoints RSI/EMA adicionales.
 * @param {AbortSignal} [signal]
 */
export async function getGoldDaily(signal, outputsize = 100) {
  const url = `${BASE_URL}/time_series?symbol=XAU/USD&interval=1day&outputsize=${outputsize}&apikey=${API_KEY}`;
  return fetchWithValidation(url, signal);
}

/**
 * Serie intraday flexible.
 * @param {'1min'|'5min'|'15min'|'30min'|'1h'} interval
 * @param {number} points — Número de velas a obtener
 * @param {AbortSignal} [signal]
 */
export async function getGoldIntraday(interval, points, signal) {
  const url = `${BASE_URL}/time_series?symbol=XAU/USD&interval=${interval}&outputsize=${points}&apikey=${API_KEY}`;
  return fetchWithValidation(url, signal);
}

// ─── Indicadores técnicos ─────────────────────────────────────────────────────

/**
 * RSI (Relative Strength Index) de 14 períodos.
 * Señal de sobrecompra (>70) o sobreventa (<30).
 * Solo necesitamos el último valor → outputsize=1
 *
 * @param {'1h'|'4h'|'1day'} interval
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} — { values: [{ rsi, datetime }], ... }
 */
export async function getGoldRSI(interval, signal) {
  const url = `${BASE_URL}/rsi?symbol=XAU/USD&interval=${interval}&time_period=14&series_type=close&outputsize=1&apikey=${API_KEY}`;
  return fetchWithValidation(url, signal);
}

/**
 * EMA (Exponential Moving Average).
 * Usamos EMA9 (corto plazo) y EMA21 (medio plazo) para detectar tendencia.
 * Solo necesitamos el último valor → outputsize=1
 *
 * @param {'1h'|'4h'|'1day'} interval
 * @param {9|21|50} period
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} — { values: [{ ema, datetime }], ... }
 */
export async function getGoldEMA(interval, period, signal) {
  const url = `${BASE_URL}/ema?symbol=XAU/USD&interval=${interval}&time_period=${period}&series_type=close&outputsize=1&apikey=${API_KEY}`;
  return fetchWithValidation(url, signal);
}
