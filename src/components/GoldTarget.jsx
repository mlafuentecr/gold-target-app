import { useGoldTarget } from '../hooks/useGoldTarget';

export default function GoldTarget() {
  const { data, loading } = useGoldTarget();

  if (loading) return <p className='text-gray-400'>Loading gold data…</p>;
  if (!data) return <p className='text-red-400'>No data</p>;

  return (
    <div className='bg-zinc-900 p-6 rounded-xl shadow-lg text-center space-y-3'>
      <h2 className='text-xl font-bold text-yellow-400'>XAU/USD – Daily Target</h2>
      <p>
        Close: <strong>${data.close}</strong>
      </p>
      <p className='text-green-400'>Bullish Target: ${data.bullishTarget}</p>
      <p className='text-red-400'>Bearish Target: ${data.bearishTarget}</p>
      <p className='text-sm text-gray-400'>Range: ${data.range}</p>
    </div>
  );
}
