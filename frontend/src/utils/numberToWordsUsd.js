const SMALL = (
  'ZERO ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE THIRTEEN FOURTEEN FIFTEEN ' +
  'SIXTEEN SEVENTEEN EIGHTEEN NINETEEN'
).split(/\s+/);

const TENS = 'TWENTY THIRTY FORTY FIFTY SIXTY SEVENTY EIGHTY NINETY'.split(/\s+/);
const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION'];

function belowThousand(n) {
  if (n < 20) return SMALL[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10) - 2];
    return n % 10 ? `${t} ${SMALL[n % 10]}` : t;
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${SMALL[h]} HUNDRED`;
  return rest ? `${head} ${belowThousand(rest)}` : head;
}

function intToWords(n) {
  if (n === 0) return 'ZERO';
  if (n < 0) return `MINUS ${intToWords(-n)}`;
  const parts = [];
  let idx = 0;
  let num = n;
  while (num > 0) {
    const chunk = num % 1000;
    if (chunk) {
      const scale = SCALES[idx];
      const w = belowThousand(chunk);
      parts.push(scale ? `${w} ${scale}` : w);
    }
    num = Math.floor(num / 1000);
    idx += 1;
  }
  return parts.reverse().join(' ');
}

/** USD amount (number) to words for PI preview — matches backend style */
export function usdAmountToWords(amount) {
  if (amount == null || Number.isNaN(amount) || amount === 0) {
    return 'USD ZERO AND ZERO/100 ONLY';
  }
  const q = Math.round(amount * 100) / 100;
  const dollars = Math.floor(q + 1e-9);
  const cents = Math.round((q - dollars) * 100);
  return `USD ${intToWords(dollars)} AND ${intToWords(cents)}/100 ONLY`;
}
