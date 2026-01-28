import { useGoldTarget } from '../hooks/useGoldTarget';
import { getMarketQuietInfo } from '../utils/marketTime';

export default function Dashboard() {
  const { price, data, timeframe, setTimeframe, loading, error } = useGoldTarget();

  const marketQuiet = getMarketQuietInfo();

  if (loading) {
    return (
      <div className='min-h-screen bg-[#0b0c10] text-gray-400 flex items-center justify-center'>
        Loading market data…
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-[#0b0c10] text-red-400 flex items-center justify-center px-6 text-center'>
        <div>
          <p className='text-lg font-semibold'>Market data error</p>
          <p className='text-sm mt-2 opacity-80'>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-[#0b0c10] text-white p-4 flex justify-center'>
      <div className='w-full max-w-sm space-y-4'>
        {/* Header */}
        <header className='text-lg font-semibold text-gray-200'>Gold Target</header>

        {/* PRICE CARD */}
        <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
          <p className='text-sm text-gray-400'>XAU/USD</p>

          <h1 className='text-3xl font-bold text-[#f5c77a] mt-1'>${price?.toFixed(2)}</h1>

          <p className='text-xs text-gray-500 mt-1'>Reference Price (1m)</p>

          {/* Timeframe Buttons */}
          <div className='flex gap-2 mt-4'>
            {['1H', '4H', '1D'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                disabled={marketQuiet.quiet && tf !== '1D'}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition
                  ${
                    timeframe === tf
                      ? 'bg-[#f5c77a] text-black'
                      : 'bg-[#1f2027] text-gray-400 hover:bg-[#2a2b32]'
                  }
                  ${marketQuiet.quiet && tf !== '1D' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {tf}
              </button>
            ))}
          </div>

          {/* Market Quiet Badge */}
          {marketQuiet.quiet && (
            <>
              <div
                className='mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full
                              bg-yellow-500/10 text-yellow-400 text-xs font-semibold'>
                <span className='w-2 h-2 rounded-full bg-yellow-400 animate-pulse'></span>
                Market quiet
              </div>

              <p className='text-xs text-gray-500 mt-2'>
                {marketQuiet.reason}. Intraday data may be limited.
                <br />
                Expected activity: <span className='text-gray-300'>{marketQuiet.resumeAt}</span>
              </p>
            </>
          )}
        </div>

        {/* TARGETS CARD */}
        <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
          <p className='text-sm text-gray-400 mb-3'>Targets ({timeframe})</p>

          <div className='space-y-3 text-sm'>
            <div className='flex justify-between'>
              <span className='text-gray-400'>Close</span>
              <span>${data.close}</span>
            </div>

            <div className='flex justify-between text-green-400'>
              <span>Bullish Target</span>
              <span>${data.bullishTarget}</span>
            </div>

            <div className='flex justify-between text-red-400'>
              <span>Bearish Target</span>
              <span>${data.bearishTarget}</span>
            </div>

            <div className='flex justify-between text-gray-400'>
              <span>Range</span>
              <span>${data.range}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
