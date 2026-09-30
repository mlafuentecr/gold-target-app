/**
 * goldTarget.service.js — Lógica de negocio para análisis de oro
 *
 * Mejoras respecto a la versión anterior:
 * - calculateTargets: usa aggregateOHLC para calcular el OHLC REAL del período
 *   (antes solo miraba values[0], lo que daba targets incorrectos en 1H/4H)
 * - calculatePivotPoints: niveles R1/R2/S1/S2 clásicos
 * - calculateATR: Average True Range del período
 * - getPriceStatus: indica si el precio está sobre/bajo/dentro de los targets
 */

import { extractOHLC, aggregateOHLC } from '../utils/ohlc';
import { isValidNumber } from '../utils/validate';

// ─── Target principal ─────────────────────────────────────────────────────────

/**
 * Calcula los targets bullish/bearish del período seleccionado.
 *
 * Metodología (range breakout):
 *   Range = High_período - Low_período
 *   Bullish Target = High + Range
 *   Bearish Target = Low - Range
 *
 * CAMBIO CRÍTICO vs versión anterior: ahora usa aggregateOHLC que toma el
 * High máximo y Low mínimo de TODAS las velas del período, no solo la última.
 *
 * @param {Object} series — Respuesta cruda de TwelveData time_series
 * @returns {{ close, open, high, low, bullishTarget, bearishTarget, range } | null}
 */
export function calculateTargets(series) {
  if (!series?.values?.length) return null;

  const candles = extractOHLC(series.values);
  if (candles.length === 0) return null;

  const agg = aggregateOHLC(candles);
  if (!agg) return null;

  const { open, high, low, close } = agg;
  const range = high - low;

  return {
    open:          +open.toFixed(2),
    high:          +high.toFixed(2),
    low:           +low.toFixed(2),
    close:         +close.toFixed(2),
    bullishTarget: +(high + range).toFixed(2),
    bearishTarget: +(low  - range).toFixed(2),
    range:         +range.toFixed(2),
  };
}

// ─── Pivot Points ─────────────────────────────────────────────────────────────

/**
 * Calcula los pivot points clásicos (floor pivots).
 *
 * Fórmulas:
 *   PP = (High + Low + Close) / 3
 *   R1 = 2×PP − Low
 *   R2 = PP + (High − Low)
 *   S1 = 2×PP − High
 *   S2 = PP − (High − Low)
 *
 * @param {number} high
 * @param {number} low
 * @param {number} close
 * @returns {{ PP, R1, R2, S1, S2 } | null}
 */
export function calculatePivotPoints(high, low, close) {
  if (!isValidNumber(high) || !isValidNumber(low) || !isValidNumber(close)) return null;

  const h = Number(high);
  const l = Number(low);
  const c = Number(close);
  const range = h - l;

  const PP = (h + l + c) / 3;
  const R1 = 2 * PP - l;
  const R2 = PP + range;
  const S1 = 2 * PP - h;
  const S2 = PP - range;

  return {
    PP: +PP.toFixed(2),
    R1: +R1.toFixed(2),
    R2: +R2.toFixed(2),
    S1: +S1.toFixed(2),
    S2: +S2.toFixed(2),
  };
}

// ─── ATR ──────────────────────────────────────────────────────────────────────

/**
 * Calcula el Average True Range (ATR) simplificado del período.
 *
 * True Range por vela = High - Low
 * (Versión simplificada: usa High-Low de cada vela en lugar de la fórmula
 * completa que requiere el cierre anterior. Adecuada para análisis intraday.)
 *
 * @param {Array<{high, low}>} candles — Array numérico (usar extractOHLC primero)
 * @returns {number | null}
 */
export function calculateATR(candles) {
  if (!candles || candles.length === 0) return null;

  const trValues = candles.map(c => c.high - c.low).filter(v => isValidNumber(v) && v >= 0);
  if (trValues.length === 0) return null;

  const atr = trValues.reduce((sum, tr) => sum + tr, 0) / trValues.length;
  return +atr.toFixed(2);
}

// ─── Indicadores locales ─────────────────────────────────────────────────────

/**
 * RSI local para evitar una llamada adicional al proveedor por timeframe.
 * TwelveData entrega las velas newest-first; aquí se recorren en orden
 * cronológico para que el cálculo sea consistente.
 */
export function calculateRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;

  const closes = [...candles].reverse().map(c => Number(c.close));
  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  const recent = changes.slice(-period);
  const gains = recent.filter(change => change > 0).reduce((sum, change) => sum + change, 0);
  const losses = recent.filter(change => change < 0).reduce((sum, change) => sum + Math.abs(change), 0);

  if (losses === 0) return 100;
  const relativeStrength = (gains / period) / (losses / period);
  return +(100 - (100 / (1 + relativeStrength))).toFixed(1);
}

/**
 * EMA local usando todas las velas disponibles del timeframe.
 */
export function calculateEMA(candles, period = 9) {
  if (!candles || candles.length < period) return null;

  const closes = [...candles].reverse().map(c => Number(c.close));
  let ema = closes.slice(0, period).reduce((sum, close) => sum + close, 0) / period;
  const multiplier = 2 / (period + 1);

  for (const close of closes.slice(period)) {
    ema = (close - ema) * multiplier + ema;
  }

  return +ema.toFixed(2);
}

// ─── Price Status ─────────────────────────────────────────────────────────────

/**
 * Determina si el precio actual ha alcanzado algún target.
 *
 * @param {number} currentPrice
 * @param {{ bullishTarget: number, bearishTarget: number }} targets
 * @returns {'above_bullish' | 'below_bearish' | 'neutral'}
 */
export function getPriceStatus(currentPrice, targets) {
  if (!isValidNumber(currentPrice) || !targets) return 'neutral';

  const price = Number(currentPrice);

  if (price >= targets.bullishTarget) return 'above_bullish';
  if (price <= targets.bearishTarget) return 'below_bearish';
  return 'neutral';
}
