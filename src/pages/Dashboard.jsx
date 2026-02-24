/**
 * Dashboard.jsx — UI principal de Gold Target App
 *
 * Layout responsive:
 *  - Mobile  (<768px):  1 columna
 *  - Tablet  (768px+):  2 columnas
 *  - Desktop (1280px+): 3 columnas
 *
 * Cards:
 *  Full-width: Precio (siempre arriba, prominente)
 *  En grid:    Indicadores | Targets | Pivot Points | Alertas | Alarma de Rebote
 */

import { useEffect, useRef, useState } from 'react';
import { useGoldTarget } from '../hooks/useGoldTarget';
import { useGoldStore } from '../store/goldStore';
import { formatChange, formatElapsed, formatPrice, formatRange } from '../utils/format';
import {
  getMarketQuietInfo,
  getNextMarketEvent,
  getSessionName,
} from '../utils/marketTime';

// ─── Componentes reutilizables ────────────────────────────────────────────────

function Row({ label, value, colorClass = 'text-white' }) {
  return (
    <div className='flex justify-between items-center text-sm'>
      <span className='text-gray-400'>{label}</span>
      <span className={colorClass}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className='border-t border-white/5 my-2' />;
}

// ─── RSI Bar ──────────────────────────────────────────────────────────────────

function RSIBar({ rsi }) {
  if (rsi == null) return <span className='text-gray-500 text-xs'>N/A</span>;
  const pct       = Math.min(Math.max(rsi, 0), 100);
  const label     = rsi >= 70 ? 'Overbought' : rsi <= 30 ? 'Oversold' : 'Neutral';
  const color     = rsi >= 70 ? 'bg-red-400' : rsi <= 30 ? 'bg-green-400' : 'bg-[#f5c77a]';
  const textColor = rsi >= 70 ? 'text-red-400' : rsi <= 30 ? 'text-green-400' : 'text-[#f5c77a]';
  return (
    <div className='flex items-center gap-2 flex-1 justify-end'>
      <div className='w-20 h-1.5 bg-white/10 rounded-full overflow-hidden'>
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor} w-20 text-right`}>
        {rsi.toFixed(1)} · {label}
      </span>
    </div>
  );
}

// ─── EMA Signal ───────────────────────────────────────────────────────────────

function EMASignal({ currentPrice, ema }) {
  if (ema == null || currentPrice == null)
    return <span className='text-gray-500 text-xs'>N/A</span>;
  const above  = currentPrice >= ema;
  const diff   = Math.abs(currentPrice - ema).toFixed(2);
  const color  = above ? 'text-green-400' : 'text-red-400';
  const signal = above ? 'Bullish' : 'Bearish';
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {above ? '↑' : '↓'} {formatPrice(ema)} · {signal} (${diff})
    </span>
  );
}

// ─── Toggle Switch (CSS Tailwind puro, sin shadcn) ────────────────────────────

function ToggleSwitch({ checked, onChange }) {
  return (
    <label className='relative inline-flex items-center cursor-pointer select-none'>
      <input type='checkbox' className='sr-only peer' checked={checked} onChange={onChange} />
      <div className='w-11 h-6 bg-white/10 rounded-full peer-checked:bg-[#f5c77a] transition-colors duration-200' />
      <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 peer-checked:translate-x-5' />
    </label>
  );
}

// ─── Status Badge (target alcanzado) ─────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'above_bullish')
    return <span className='text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400'>TARGET HIT ↑</span>;
  if (status === 'below_bearish')
    return <span className='text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400'>TARGET HIT ↓</span>;
  return <span className='text-xs text-gray-500'>Neutral</span>;
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    price, quoteData, data, indicators,
    timeframe, setTimeframe,
    loading, error, lastUpdated, refresh,
    alerts, addAlert, removeAlert,
  } = useGoldTarget();

  const {
    supportLevel, isAlarmActive, triggeredAlarms,
    setSupportLevel, toggleAlarm,
  } = useGoldStore();

  const marketQuiet = getMarketQuietInfo();
  const sessionName = getSessionName();
  const nextEvent   = getNextMarketEvent();

  // Contador "Updated X ago" (local, sin re-fetch)
  const [elapsed, setElapsed] = useState(null);
  useEffect(() => {
    if (!lastUpdated) return;
    const update = () => setElapsed(Math.floor((Date.now() - lastUpdated) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Input de alertas de precio
  const [alertInput, setAlertInput] = useState('');
  function handleAddAlert(e) {
    e.preventDefault();
    const val = parseFloat(alertInput);
    if (!isNaN(val) && val > 0) { addAlert(val); setAlertInput(''); }
  }

  // Input de soporte con debounce (600ms vanilla)
  const [supportInput, setSupportInput] = useState(String(supportLevel));
  const debounceRef = useRef(null);
  function handleSupportChange(e) {
    const raw = e.target.value;
    setSupportInput(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed > 0) setSupportLevel(parsed);
    }, 600);
  }
  // Sincronizar si el valor cambia desde fuera (rehydration de Zustand)
  useEffect(() => { setSupportInput(String(supportLevel)); }, [supportLevel]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const isPositive = (quoteData?.change ?? 0) >= 0;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className='min-h-screen bg-[#0b0c10] flex items-center justify-center'>
        <div className='text-center space-y-2'>
          <div className='w-6 h-6 border-2 border-[#f5c77a] border-t-transparent rounded-full animate-spin mx-auto' />
          <p className='text-gray-400 text-sm'>Cargando datos del mercado…</p>
        </div>
      </div>
    );
  }

  // ── Error fatal (sin precio aún) ──────────────────────────────────────────
  if (error && !price) {
    return (
      <div className='min-h-screen bg-[#0b0c10] text-red-400 flex items-center justify-center px-6 text-center'>
        <div className='space-y-3'>
          <p className='text-lg font-semibold'>Error de datos</p>
          <p className='text-sm opacity-80'>{error}</p>
          <button onClick={refresh}
            className='px-4 py-1.5 rounded-full bg-[#f5c77a] text-black text-sm font-semibold hover:opacity-90 transition'>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-[#0b0c10] text-white p-4'>
      <div className='w-full max-w-7xl mx-auto pb-8'>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className='flex items-center justify-between mb-4'>
          <span className='text-lg font-semibold text-gray-200'>Gold Target</span>
          {elapsed !== null && (
            <span className='text-xs text-gray-500'>Updated {formatElapsed(elapsed)}</span>
          )}
        </header>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* CARD 1: Precio — siempre full width                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg mb-4'>
          <div className='flex items-start justify-between'>
            <p className='text-sm text-gray-400'>XAU/USD</p>
            <button onClick={refresh} title='Actualizar'
              className='text-gray-500 hover:text-[#f5c77a] transition text-lg leading-none'>↻</button>
          </div>

          {/* Precio + cambio */}
          <div className='flex items-end gap-3 mt-1 flex-wrap'>
            <h1 className='text-4xl font-bold text-[#f5c77a]'>{formatPrice(price)}</h1>
            {quoteData && (
              <span className={`text-sm font-semibold mb-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '▲' : '▼'} {formatChange(quoteData.change, quoteData.percentChange)}
              </span>
            )}
          </div>
          <p className='text-xs text-gray-500 mt-0.5'>Live Price · GoldAPI.io</p>

          {/* Botones timeframe + info de sesión */}
          <div className='flex items-center justify-between mt-4 flex-wrap gap-3'>
            <div className='flex gap-2'>
              {['1H', '4H', '1D'].map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)}
                  disabled={marketQuiet.quiet && tf !== '1D'}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition
                    ${timeframe === tf ? 'bg-[#f5c77a] text-black' : 'bg-[#1f2027] text-gray-400 hover:bg-[#2a2b32]'}
                    ${marketQuiet.quiet && tf !== '1D' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  {tf}
                </button>
              ))}
            </div>
            <div className='flex items-center gap-3 text-xs text-gray-500'>
              <span>Session: <span className='text-gray-300'>{sessionName}</span></span>
              {!marketQuiet.quiet && (
                <span>Next: <span className='text-gray-300'>{nextEvent.label}</span></span>
              )}
            </div>
          </div>

          {/* Market quiet */}
          {marketQuiet.quiet && (
            <>
              <div className='mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-semibold'>
                <span className='w-2 h-2 rounded-full bg-yellow-400 animate-pulse' />
                Market quiet
              </div>
              <p className='text-xs text-gray-500 mt-2'>
                {marketQuiet.reason}. Intraday data may be limited.
                <br />Expected activity: <span className='text-gray-300'>{marketQuiet.resumeAt}</span>
              </p>
            </>
          )}

          {/* Error no fatal */}
          {error && price && (
            <p className='text-xs text-red-400/80 mt-2'>⚠ {error}</p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Grid responsive: 1→2→3 columnas                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>

          {/* CARD 2: Indicadores ──────────────────────────────────────── */}
          {indicators && (
            <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
              <p className='text-sm text-gray-400 mb-3'>Indicadores ({timeframe})</p>
              <div className='space-y-3'>
                <div className='flex justify-between items-center text-sm'>
                  <span className='text-gray-400'>RSI (14)</span>
                  <RSIBar rsi={indicators.rsi} />
                </div>
                <div className='flex justify-between items-center text-sm gap-2'>
                  <span className='text-gray-400 shrink-0'>EMA 9</span>
                  <EMASignal currentPrice={price} ema={indicators.ema9} />
                </div>
                <div className='flex justify-between items-center text-sm gap-2'>
                  <span className='text-gray-400 shrink-0'>EMA 21</span>
                  <EMASignal currentPrice={price} ema={indicators.ema21} />
                </div>
              </div>
            </div>
          )}

          {/* CARD 3: Targets ──────────────────────────────────────────── */}
          {data && (
            <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
              <p className='text-sm text-gray-400 mb-3'>Targets ({timeframe})</p>
              <div className='space-y-3'>
                <Row label='Close' value={formatPrice(data.close)} />
                <div className='flex justify-between items-center text-sm'>
                  <span className='text-green-400'>Bullish Target</span>
                  <div className='flex items-center gap-2'>
                    {data.status === 'above_bullish' && (
                      <span className='text-xs font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400'>HIT ↑</span>
                    )}
                    <span className='text-green-400'>{formatPrice(data.bullishTarget)}</span>
                  </div>
                </div>
                <div className='flex justify-between items-center text-sm'>
                  <span className='text-red-400'>Bearish Target</span>
                  <div className='flex items-center gap-2'>
                    {data.status === 'below_bearish' && (
                      <span className='text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400'>HIT ↓</span>
                    )}
                    <span className='text-red-400'>{formatPrice(data.bearishTarget)}</span>
                  </div>
                </div>
                <Row label='Range' value={formatRange(data.range)} colorClass='text-gray-400' />
                <Divider />
                <div className='flex justify-between items-center text-sm'>
                  <span className='text-gray-400'>Status</span>
                  <StatusBadge status={data.status} />
                </div>
                {data.atr != null && (
                  <Row label='ATR' value={formatRange(data.atr)} colorClass='text-gray-300' />
                )}
              </div>
            </div>
          )}

          {/* CARD 4: Pivot Points ─────────────────────────────────────── */}
          {data?.pivots && (
            <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
              <p className='text-sm text-gray-400 mb-3'>Pivot Points ({timeframe})</p>
              <div className='space-y-3'>
                <Row label='R2' value={formatPrice(data.pivots.R2)} colorClass='text-green-400/70' />
                <Row label='R1' value={formatPrice(data.pivots.R1)} colorClass='text-green-400' />
                <Row label='PP' value={formatPrice(data.pivots.PP)} colorClass='text-gray-200' />
                <Row label='S1' value={formatPrice(data.pivots.S1)} colorClass='text-red-400' />
                <Row label='S2' value={formatPrice(data.pivots.S2)} colorClass='text-red-400/70' />
              </div>
            </div>
          )}

          {/* CARD 5: Price Alerts ─────────────────────────────────────── */}
          <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
            <p className='text-sm text-gray-400 mb-3'>Price Alerts</p>
            <form onSubmit={handleAddAlert} className='flex gap-2 mb-3'>
              <input
                type='number' step='0.01' min='0'
                placeholder='ej. 3300.00'
                value={alertInput}
                onChange={e => setAlertInput(e.target.value)}
                className='flex-1 bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f5c77a]/50 transition'
              />
              <button type='submit'
                className='px-3 py-1.5 bg-[#f5c77a] text-black text-sm font-bold rounded-xl hover:opacity-90 transition'>
                +
              </button>
            </form>
            {alerts.length === 0 ? (
              <p className='text-xs text-gray-600 text-center py-2'>
                Sin alertas activas. Agrega un nivel arriba.
              </p>
            ) : (
              <div className='space-y-2'>
                {alerts.map(alert => {
                  const dist  = price ? Math.abs(price - alert.price) : null;
                  const above = price ? alert.price > price : null;
                  return (
                    <div key={alert.id}
                      className='flex items-center justify-between bg-white/5 rounded-xl px-3 py-2'>
                      <div>
                        <span className='text-sm font-semibold text-[#f5c77a]'>
                          {formatPrice(alert.price)}
                        </span>
                        {dist != null && (
                          <span className='text-xs text-gray-500 ml-2'>
                            ${dist.toFixed(2)} {above ? 'arriba' : 'abajo'}
                          </span>
                        )}
                      </div>
                      <button onClick={() => removeAlert(alert.id)}
                        className='text-gray-600 hover:text-red-400 transition text-lg leading-none'>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CARD 6: Alarma de Rebote en Soporte Alcista ─────────────── */}
          <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
            <p className='text-sm text-gray-400 mb-4'>Alarma de Rebote en Soporte</p>

            {/* Input de nivel de soporte */}
            <div className='mb-4'>
              <label className='block text-xs text-gray-500 mb-1.5'>
                Nivel de Soporte Clave (USD)
              </label>
              <input
                type='number'
                step='0.1'
                min='0'
                value={supportInput}
                onChange={handleSupportChange}
                placeholder='ej. 3300.00'
                className='w-full bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f5c77a]/50 transition'
              />
              {/* Distancia al soporte */}
              {price && supportLevel > 0 && (
                <p className='text-xs mt-1.5'>
                  Distancia:{' '}
                  <span className={price >= supportLevel ? 'text-green-400/80' : 'text-red-400/80'}>
                    ${Math.abs(price - supportLevel).toFixed(2)}{' '}
                    {price >= supportLevel ? '↑ sobre soporte' : '↓ bajo soporte'}
                  </span>
                </p>
              )}
            </div>

            {/* Toggle activar/desactivar */}
            <div className='flex items-center justify-between mb-4'>
              <span className='text-sm text-gray-300'>Activar alarma de rebote</span>
              <ToggleSwitch checked={isAlarmActive} onChange={toggleAlarm} />
            </div>

            {/* Indicador de estado */}
            <div className='flex items-center gap-2 text-sm'>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isAlarmActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className={isAlarmActive ? 'text-green-400 font-medium' : 'text-gray-500'}>
                {isAlarmActive
                  ? `Monitoreando ${formatPrice(supportLevel)}`
                  : 'Inactivo'}
              </span>
            </div>

            {isAlarmActive && (
              <p className='text-xs text-gray-600 mt-2 leading-relaxed'>
                Alerta cuando el precio cruce{' '}
                <span className='text-gray-400'>{formatPrice(supportLevel)}</span>{' '}
                hacia arriba → toast + notificación del browser.
              </p>
            )}

            {/* Historial de rebotes disparados */}
            {triggeredAlarms.length > 0 && (
              <div className='mt-4 pt-3 border-t border-white/5'>
                <p className='text-xs text-gray-500 mb-2'>Últimas alarmas disparadas</p>
                <div className='space-y-1.5'>
                  {triggeredAlarms.slice(0, 3).map((alarm, i) => (
                    <div key={i} className='flex justify-between text-xs'>
                      <span className='text-[#f5c77a] font-semibold'>
                        {formatPrice(alarm.price)}
                      </span>
                      <span className='text-gray-600'>
                        {formatElapsed(Math.floor((Date.now() - alarm.triggeredAt) / 1000))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>{/* /grid */}
      </div>
    </div>
  );
}
