/**
 * useGoldTarget.js — Hook principal de datos de la app
 *
 * ARQUITECTURA DIVIDIDA EN DOS EFFECTS (fix del error 429 de TwelveData):
 *
 * Effect 1 — "Price Refresh" [retryCount]
 *   → Llama a TwelveData para precio + OHLC diario
 *   → Calcula targets y pivots del OHLC diario del spot
 *   → Chequea alarma de rebote (Zustand) y alertas de precio (localStorage)
 *   → Auto-refresh cada 2 min (solo mercado abierto)
 *
 * Effect 2 — "Macro Refresh" [macroRetryCount]
 *   → Consulta dólar + Treasury agrupados cada 10 minutos
 *
 * Effect 3 — "Indicators Refresh" [timeframe, dailySeries]
 *   → Calcula RSI + EMA9 + EMA21 localmente desde las velas
 *   → Solo pide una serie intradía al cambiar a 1H/4H
 *   → Actualiza indicators y ATR sin tocar el precio
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  getGoldDaily,
  getGoldIntraday,
  getGoldQuote,
  getMacroQuotes,
} from '../api/twelveData';
import {
  calculateATR,
  calculateEMA,
  calculatePivotPoints,
  calculateRSI,
  getPriceStatus,
} from '../services/goldTarget.service';
import { useGoldStore } from '../store/goldStore';
import { extractOHLC } from '../utils/ohlc';
import {
  addAlert as persistAddAlert,
  checkAlerts,
  getAlerts,
  removeAlert as persistRemoveAlert,
  requestNotificationPermission,
  sendNotification,
} from '../utils/alerts';
import { isMarketOpen } from '../utils/marketTime';
import { isValidNumber } from '../utils/validate';

// Cinco minutos reduce el riesgo de agotar créditos sin perder contexto útil.
const PRICE_REFRESH_MS = 5 * 60 * 1000;
const MACRO_REFRESH_MS = 10 * 60 * 1000;
const MARKET_CACHE_KEY = 'gold-target-market-cache';

function readMarketCache() {
  try {
    const raw = localStorage.getItem(MARKET_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMarketCache(snapshot) {
  try {
    localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // El cache es opcional; no debe bloquear el dashboard.
  }
}

function normalizeMacroQuote(quote, type) {
  if (!quote) return null;

  const value = Number(quote.price ?? quote.close);
  if (!isValidNumber(value)) return null;

  const change = Number(quote.change ?? 0);
  const percentChange = Number(quote.percent_change ?? 0);

  return {
    type,
    symbol: quote.symbol,
    name: quote.name,
    value: +value.toFixed(type === 'bond' ? 3 : 2),
    change: isValidNumber(change) ? +change.toFixed(3) : 0,
    percentChange: isValidNumber(percentChange) ? +percentChange.toFixed(2) : 0,
    timestamp: Number(quote.timestamp ?? Date.now() / 1000),
  };
}

function getMacroRegime(dollar, bond) {
  const dollarUp = dollar?.percentChange > 0.1;
  const dollarDown = dollar?.percentChange < -0.1;
  const bondUp = bond?.percentChange > 0.1;
  const bondDown = bond?.percentChange < -0.1;

  if (dollarUp && bondUp) {
    return { label: 'Presión bajista', tone: 'headwind', detail: 'Dólar y rendimiento suben' };
  }
  if (dollarDown && bondDown) {
    return { label: 'Viento a favor', tone: 'tailwind', detail: 'Dólar y rendimiento bajan' };
  }
  if (dollarUp || bondUp) {
    return { label: 'Mixto / presión', tone: 'mixed', detail: 'Un factor resta apoyo al oro' };
  }
  if (dollarDown || bondDown) {
    return { label: 'Mixto / apoyo', tone: 'mixed', detail: 'Un factor favorece al oro' };
  }
  return { label: 'Sin señal clara', tone: 'neutral', detail: 'Cambios diarios moderados' };
}

export function useGoldTarget() {
  const [initialMarket]               = useState(readMarketCache);
  const [price, setPrice]             = useState(initialMarket?.price ?? null);
  const [quoteData, setQuoteData]     = useState(initialMarket?.quoteData ?? null);   // change, %, prevClose
  const [macroData, setMacroData]     = useState(null);   // Dollar + Treasury context
  const [data, setData]               = useState(initialMarket?.data ?? null);   // targets, pivots, atr, status
  const [indicators, setIndicators]   = useState(null);   // rsi, ema9, ema21
  const [timeframe, setTimeframe]     = useState('1D');
  const [loading, setLoading]         = useState(!initialMarket?.price);
  const [error, setError]             = useState(null);
  const [priceSource, setPriceSource] = useState('TwelveData');
  const [lastUpdated, setLastUpdated] = useState(initialMarket?.lastUpdated ?? null);
  const [alerts, setAlerts]           = useState(() => getAlerts());
  const [retryCount, setRetryCount]   = useState(0);
  const [macroRetryCount, setMacroRetryCount] = useState(0);
  const [dailySeries, setDailySeries] = useState(null);

  const prevPriceRef = useRef(null);

  // Zustand: alarma de rebote
  const { checkBounceAlarm, supportLevel } = useGoldStore();

  // Pedir permiso de notificaciones al montar
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // ── Effect 1: Price Refresh — TwelveData ──────────────────────────────────
  // Solo depende de retryCount (NO de timeframe).
  // El auto-refresh y el botón refresh incrementan retryCount.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadPrice() {
      try {
        setError(null);

        const [quote, daily] = await Promise.all([
          getGoldQuote(signal),
          getGoldDaily(signal, 100),
        ]);

        const currentCandle = daily?.values?.[0];
        const previousCandle = daily?.values?.[1];

        const spot = {
          price: Number(quote.price ?? quote.close ?? currentCandle?.close),
          open_price: Number(currentCandle?.open ?? quote.open),
          high_price: Number(currentCandle?.high ?? quote.high),
          low_price: Number(currentCandle?.low ?? quote.low),
          ch: Number(quote.change ?? 0),
          chp: Number(quote.percent_change ?? 0),
          prev_close_price: Number(quote.previous_close ?? previousCandle?.close ?? 0),
          timestamp: Number(quote.last_quote_at ?? quote.timestamp ?? Date.now() / 1000),
        };

        // Validar precio
        const livePrice = Number(spot.price);
        if (!isValidNumber(livePrice)) {
          throw new Error('TwelveData devolvió un precio inválido');
        }

        // OHLC diario del spot (open/high/low/price)
        const open  = Number(spot.open_price);
        const high  = Number(spot.high_price);
        const low   = Number(spot.low_price);
        const close = livePrice;
        const range = high - low;

        // Targets (range breakout: Bullish = High + Range, Bearish = Low - Range)
        const targets = {
          open:          +open.toFixed(2),
          high:          +high.toFixed(2),
          low:           +low.toFixed(2),
          close:         +close.toFixed(2),
          bullishTarget: +(high + range).toFixed(2),
          bearishTarget: +(low  - range).toFixed(2),
          range:         +range.toFixed(2),
        };

        const pivots = calculatePivotPoints(high, low, close);
        const status = getPriceStatus(livePrice, targets);

        // Cambio del día
        const change        = Number(spot.ch  ?? 0);
        const percentChange = Number(spot.chp ?? 0);
        const prevClose     = Number(spot.prev_close_price ?? 0);

        // ── Alarma de rebote (Zustand store) ─────────────────────────────
        const prevPrice = prevPriceRef.current;
        const bounced   = checkBounceAlarm(prevPrice, livePrice);
        if (bounced) {
          toast.success(
            `¡Rebote en soporte! Oro en $${livePrice.toFixed(2)} — Posible entrada long 🚀`,
            { duration: 10000 }
          );
          sendNotification(
            '¡Rebote en soporte alcista! 🚀',
            `XAU/USD cruzó soporte $${Number(supportLevel).toFixed(2)} → ahora $${livePrice.toFixed(2)}`
          );
        }

        // ── Alertas de precio (localStorage) ─────────────────────────────
        if (prevPrice !== null) {
          const activeAlerts = getAlerts();
          const { triggered, remaining } = checkAlerts(livePrice, prevPrice, activeAlerts);
          if (triggered.length > 0) {
            triggered.forEach(alert => {
              const dir = alert.direction === 'up' ? '↑' : '↓';
              sendNotification(
                `Gold Alert ${dir}`,
                `XAU/USD cruzó $${alert.price.toFixed(2)} → ahora $${livePrice.toFixed(2)}`
              );
            });
            setAlerts(remaining);
          }
        }
        prevPriceRef.current = livePrice;

        // Actualizar estado (preservando atr e indicators del último fetch de timeframe)
        setPrice(livePrice);
        setQuoteData({
          change:        isValidNumber(change) ? +change.toFixed(2) : 0,
          percentChange: isValidNumber(percentChange) ? +percentChange.toFixed(2) : 0,
          prevClose:     isValidNumber(prevClose) && prevClose > 0 ? +prevClose.toFixed(2) : null,
          week52High:    isValidNumber(quote?.fifty_two_week?.high) ? +Number(quote.fifty_two_week.high).toFixed(2) : null,
          week52Low:     isValidNumber(quote?.fifty_two_week?.low) ? +Number(quote.fifty_two_week.low).toFixed(2) : null,
        });
        setData(prev => ({
          ...targets,
          atr:    prev?.atr    ?? null,
          pivots,
          status,
        }));
        setPriceSource('TwelveData');
        setLastUpdated(Date.now());
        setDailySeries(daily);
        saveMarketCache({
          price: livePrice,
          quoteData: {
            change: isValidNumber(change) ? +change.toFixed(2) : 0,
            percentChange: isValidNumber(percentChange) ? +percentChange.toFixed(2) : 0,
            prevClose: isValidNumber(prevClose) && prevClose > 0 ? +prevClose.toFixed(2) : null,
            week52High: isValidNumber(quote?.fifty_two_week?.high) ? +Number(quote.fifty_two_week.high).toFixed(2) : null,
            week52Low: isValidNumber(quote?.fifty_two_week?.low) ? +Number(quote.fifty_two_week.low).toFixed(2) : null,
          },
          data: { ...targets, atr: data?.atr ?? null, pivots, status },
          lastUpdated: Date.now(),
        });

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Price provider error:', err.message);
        setError(price ? `${err.message || 'Error al obtener precio del mercado'} — mostrando el último dato disponible` : err.message || 'Error al obtener precio del mercado');
      } finally {
        setLoading(false);
      }
    }

    loadPrice();
    return () => controller.abort();
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Macro Refresh — dollar + Treasury ─────────────────────────
  // Se actualiza mucho menos que el precio del oro: el dólar y los bonos
  // sirven como contexto, no como un tick-by-tick trigger.
  useEffect(() => {
    const controller = new AbortController();

    async function loadMacro() {
      try {
        const quotes = await getMacroQuotes(controller.signal);
        const dollar = normalizeMacroQuote(quotes.dollar, 'dollar');
        const bond = normalizeMacroQuote(quotes.bond, 'bond');

        setMacroData({
          dollar,
          bond,
          regime: getMacroRegime(dollar, bond),
          symbols: quotes.symbols,
          updatedAt: Date.now(),
        });
      } catch (err) {
        if (err.name === 'AbortError') return;
        // El panel macro es informativo: no debe tumbar el precio del oro.
        console.warn('Macro context fetch failed (non-blocking):', err.message);
      }
    }

    loadMacro();
    return () => controller.abort();
  }, [macroRetryCount]);

  useEffect(() => {
    if (!isMarketOpen()) return;
    const id = setInterval(() => setMacroRetryCount(c => c + 1), MACRO_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // ── Effect 3: Indicators Refresh — local + one series ─────────────────────
  // RSI y EMA se calculan localmente. Solo 1H/4H necesita una serie nueva;
  // 1D reutiliza las velas diarias que ya pidió el efecto de precio.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadIndicators() {
      try {
        let seriesJson = dailySeries;
        if (timeframe === '1H') seriesJson = await getGoldIntraday('1min', 120, signal);
        if (timeframe === '4H') seriesJson = await getGoldIntraday('15min', 32, signal);

        // ATR desde series de velas
        let atr = null;
        let rsi = null;
        let ema9 = null;
        let ema21 = null;
        if (seriesJson?.values?.length) {
          const candles = extractOHLC(seriesJson.values);
          atr = calculateATR(candles);
          rsi = calculateRSI(candles);
          ema9 = calculateEMA(candles, 9);
          ema21 = calculateEMA(candles, 21);
        }

        setData(prev => prev ? { ...prev, atr } : null);
        setIndicators({ rsi, ema9, ema21 });

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Indicators fetch failed (non-blocking):', err.message);
        // No bloquea la app si los indicadores fallan
      }
    }

    loadIndicators();
    return () => controller.abort();
  }, [timeframe, dailySeries]);

  // ── Auto-refresh de precio (solo mercado abierto) ─────────────────────────
  useEffect(() => {
    if (!isMarketOpen()) return;
    const id = setInterval(() => setRetryCount(c => c + 1), PRICE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // ── API pública ───────────────────────────────────────────────────────────

  const refresh = useCallback(() => {
    setRetryCount(c => c + 1);
    setMacroRetryCount(c => c + 1);
  }, []);

  const addAlert = useCallback((price) => {
    setAlerts(persistAddAlert(price));
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts(persistRemoveAlert(id));
  }, []);

  return {
    price,
    quoteData,
    macroData,
    data,
    indicators,
    timeframe,
    setTimeframe,
    loading,
    error,
    priceSource,
    lastUpdated,
    refresh,
    alerts,
    addAlert,
    removeAlert,
  };
}
