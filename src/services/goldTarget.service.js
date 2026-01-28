export function calculateDailyTarget(data) {
  if (!data?.values?.length) return null;

  const today = data.values[0];

  const high = Number(today.high);
  const low = Number(today.low);
  const close = Number(today.close);

  const range = high - low;

  return {
    close,
    bullishTarget: +(high + range).toFixed(2),
    bearishTarget: +(low - range).toFixed(2),
    range: +range.toFixed(2),
  };
}
