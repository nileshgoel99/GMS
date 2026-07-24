/**
 * Format company phone for documents with Indian country code (+91).
 * Strips a leading 0 / existing 91 prefix so we don't double the code.
 */
export function formatCompanyPhone(phone, countryCode = '+91') {
  if (phone == null) return '';
  const raw = String(phone).trim();
  if (!raw) return '';

  const compact = raw.replace(/[\s\-().]/g, '');
  const ccDigits = countryCode.replace(/\D/g, ''); // "91"

  let national = compact;
  if (national.startsWith('+')) {
    national = national.slice(1);
  }
  if (national.startsWith(ccDigits)) {
    national = national.slice(ccDigits.length);
  }
  national = national.replace(/^0+/, '');
  if (!national) return countryCode;

  // Keep readable grouping: +91 9876543210
  return `${countryCode} ${national}`;
}

/** Letterhead / footer contact lines from company profile. */
export function companyContactLines(company) {
  if (!company) return { phone: '', email: '', telLine: '', emailLine: '' };
  const phone = formatCompanyPhone(company.phone);
  const email = (company.email || '').trim();
  return {
    phone,
    email,
    telLine: phone ? `TEL: ${phone}` : '',
    emailLine: email ? `Email: ${email}` : '',
  };
}
