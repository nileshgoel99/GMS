const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

function ordinalSuffix(day) {
  const d = day % 100;
  if (d >= 11 && d <= 13) return 'TH';
  switch (day % 10) {
    case 1:
      return 'ST';
    case 2:
      return 'ND';
    case 3:
      return 'RD';
    default:
      return 'TH';
  }
}

/** Build e.g. 20TH FEBRUARY 2026 (EX-FACTORY DATE) from yyyy-MM-dd */
export function formatDispatchFromIso(isoDate, suffix = ' (EX-FACTORY DATE)') {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const [ys, ms, ds] = isoDate.split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  const d = parseInt(ds, 10);
  if (!y || !m || !d) return '';
  const dayStr = `${d}${ordinalSuffix(d)}`;
  return `${dayStr} ${MONTHS[m - 1]} ${y}${suffix}`;
}
