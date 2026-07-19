/**
 * Derive Intra-state (CGST+SGST) vs Inter-state (IGST) from company vs supplier state.
 * Company State = Supplier State → Intra; otherwise → Inter.
 */

const STATE_ALIASES = {
  andamanandnicobarislands: 'andamanandnicobar',
  andamanandnicobar: 'andamanandnicobar',
  andhrapradesh: 'andhrapradesh',
  arunachalpradesh: 'arunachalpradesh',
  assam: 'assam',
  bihar: 'bihar',
  chandigarh: 'chandigarh',
  chhattisgarh: 'chhattisgarh',
  chattisgarh: 'chhattisgarh',
  dadraandnagarhavelianddamananddiu: 'dnhdd',
  dadraandnagarhaveli: 'dnhdd',
  damananddiu: 'dnhdd',
  delhi: 'delhi',
  nctofdelhi: 'delhi',
  newdelhi: 'delhi',
  goa: 'goa',
  gujarat: 'gujarat',
  haryana: 'haryana',
  himachalpradesh: 'himachalpradesh',
  hp: 'himachalpradesh',
  jammuandkashmir: 'jammuandkashmir',
  jammukashmir: 'jammuandkashmir',
  jharkhand: 'jharkhand',
  karnataka: 'karnataka',
  ka: 'karnataka',
  kerala: 'kerala',
  kl: 'kerala',
  ladakh: 'ladakh',
  lakshadweep: 'lakshadweep',
  madhyapradesh: 'madhyapradesh',
  mp: 'madhyapradesh',
  maharashtra: 'maharashtra',
  mh: 'maharashtra',
  manipur: 'manipur',
  meghalaya: 'meghalaya',
  mizoram: 'mizoram',
  nagaland: 'nagaland',
  odisha: 'odisha',
  orissa: 'odisha',
  puducherry: 'puducherry',
  pondicherry: 'puducherry',
  punjab: 'punjab',
  pb: 'punjab',
  rajasthan: 'rajasthan',
  rj: 'rajasthan',
  sikkim: 'sikkim',
  tamilnadu: 'tamilnadu',
  tn: 'tamilnadu',
  telangana: 'telangana',
  ts: 'telangana',
  tg: 'telangana',
  tripura: 'tripura',
  uttarpradesh: 'uttarpradesh',
  up: 'uttarpradesh',
  uttarakhand: 'uttarakhand',
  uttaranchal: 'uttarakhand',
  uk: 'uttarakhand',
  westbengal: 'westbengal',
  wb: 'westbengal',
  bengal: 'westbengal',
};

export const normalizeStateName = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const key = raw.replace(/[^a-z0-9]/g, '');
  return STATE_ALIASES[key] || key;
};

/**
 * @returns {'CGST_SGST'|'IGST'|null} null when either state is unknown
 */
export const resolveTaxModeFromStates = ({ companyState, supplierState }) => {
  const companyKey = normalizeStateName(companyState);
  const supplierKey = normalizeStateName(supplierState);
  if (!companyKey || !supplierKey) return null;
  return companyKey === supplierKey ? 'CGST_SGST' : 'IGST';
};

export const supplyTypeLabel = (taxMode) => (
  taxMode === 'IGST' ? 'Inter state (IGST)' : 'Intra state (CGST + SGST)'
);
