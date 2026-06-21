/**
 * Format ISO date (YYYY-MM-DD) or datetime string as DD-MM-YYYY for display.
 * Avoids timezone shifts by parsing the date portion directly.
 */
export function formatDateDMY(value) {
  if (value == null || value === '') return '';
  const str = String(value).trim();
  const iso = str.split('T')[0];
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  const dt = new Date(str);
  if (!Number.isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return str;
}

/** formatDateDMY with em-dash fallback for empty values. */
export function formatDateDisplay(value) {
  return formatDateDMY(value) || '—';
}
