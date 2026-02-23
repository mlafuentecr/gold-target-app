/**
 * validate.js — Helpers de validación de datos
 * Usados por la capa de API, OHLC y el hook principal.
 */

/**
 * Verifica que un valor sea un número finito válido.
 * Acepta tanto números como strings numéricos (tal como devuelve TwelveData).
 * @param {*} v
 * @returns {boolean}
 */
export function isValidNumber(v) {
  const n = Number(v);
  return !isNaN(n) && isFinite(n);
}

/**
 * Verifica que una vela OHLC sea válida:
 * - Tiene los campos open, high, low, close
 * - Todos son números válidos
 * - high >= low (sanidad de datos)
 * @param {*} candle
 * @returns {boolean}
 */
export function isValidOHLC(candle) {
  if (!candle || typeof candle !== 'object') return false;
  const { open, high, low, close } = candle;
  if (!isValidNumber(open) || !isValidNumber(high) || !isValidNumber(low) || !isValidNumber(close)) {
    return false;
  }
  return Number(high) >= Number(low);
}

/**
 * Verifica que la respuesta JSON de TwelveData no sea un error.
 * TwelveData devuelve { status: 'error', message: '...' } incluso con HTTP 200
 * cuando hay errores de API key, rate limit, símbolo inválido, etc.
 * @param {*} res
 * @returns {boolean}
 */
export function isValidApiResponse(res) {
  if (res == null) return false;
  if (res.status === 'error') return false;
  if (typeof res.code !== 'undefined') return false; // TwelveData error objects incluyen `code`
  return true;
}

/**
 * Verifica que un array de values (time_series) sea usable:
 * - Existe y tiene al menos un elemento
 * - Cada elemento pasa isValidOHLC
 * @param {Array} values
 * @returns {boolean}
 */
export function validateSeriesValues(values) {
  if (!Array.isArray(values) || values.length === 0) return false;
  return values.every(isValidOHLC);
}
