/**
 * ohlc.js — Helpers para procesar datos OHLC de TwelveData
 *
 * FIX CRÍTICO: El service anterior solo miraba values[0] (la vela más reciente).
 * Para 1H con 60 velas de 1min, el high/low de UNA vela es ~$2-3.
 * El high/low real del período completo puede ser $15-20.
 * aggregateOHLC soluciona esto tomando el max/min de todas las velas.
 */

import { isValidOHLC } from './validate';

/**
 * Convierte el array `values` de TwelveData (strings) a objetos numéricos limpios.
 * Filtra automáticamente las velas que no pasen validación.
 *
 * @param {Array} values — Array de TwelveData con campos string: open, high, low, close, datetime
 * @returns {Array<{open, high, low, close, datetime}>}
 */
export function extractOHLC(values) {
  if (!Array.isArray(values)) return [];

  return values
    .map(v => ({
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      datetime: v.datetime,
    }))
    .filter(isValidOHLC);
}

/**
 * Agrega múltiples velas OHLC en una sola vela representando el período completo.
 * - open: apertura de la vela más antigua (TwelveData devuelve newest-first)
 * - high: máximo de todas las velas del período
 * - low:  mínimo de todas las velas del período
 * - close: cierre de la vela más reciente (index 0)
 *
 * @param {Array<{open, high, low, close}>} candles — Array ya numérico (usar extractOHLC primero)
 * @returns {{open, high, low, close} | null}
 */
export function aggregateOHLC(candles) {
  if (!candles || candles.length === 0) return null;

  // TwelveData devuelve newest-first → la más antigua es la última del array
  const open = candles[candles.length - 1].open;
  const close = candles[0].close;
  const high = Math.max(...candles.map(c => c.high));
  const low = Math.min(...candles.map(c => c.low));

  return { open, high, low, close };
}
