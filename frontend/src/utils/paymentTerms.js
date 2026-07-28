/**
 * Extract credit days from free-text payment terms (mirrors backend parse_payment_days).
 * @returns {number|null}
 */
export function parsePaymentDays(paymentTerms) {
  if (!paymentTerms || !String(paymentTerms).trim()) return null;
  const text = String(paymentTerms).trim().toUpperCase();

  if (/(ADVANCE|IMMEDIATE|COD|CASH ON DELIVERY|UPFRONT|PREPAID)/.test(text)) {
    return 0;
  }

  const patterns = [
    /(?:NET|WITHIN|IN)\s*(\d+)\s*DAYS?/,
    /(\d+)\s*DAYS?\s*(?:FROM|AFTER|@|$)/,
    /(\d+)\s*DAYS?/,
    /(\d+)\s*D\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Compute purchase-bill payment due date from terms + bill/received date.
 * @returns {string} ISO date YYYY-MM-DD or ''
 */
export function computeBillPaymentDueDate({
  paymentTerms = '',
  billDate = '',
  receivedDate = '',
} = {}) {
  const days = parsePaymentDays(paymentTerms);
  const bill = String(billDate || '').trim();
  const received = String(receivedDate || billDate || '').trim();
  if (days == null) return bill || '';

  const termsU = String(paymentTerms || '').toUpperCase();
  const useReceipt = /(DELIVERY|RECEIPT|GRN|DISPATCH|SUPPLY)/.test(termsU);
  const baseIso = useReceipt ? (received || bill) : (bill || received);
  if (!baseIso) return '';

  const base = new Date(`${baseIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
