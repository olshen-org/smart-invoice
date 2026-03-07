const VAT_RATE = 0.18;

// Hebrew patterns for 0% VAT items (fresh produce under Israeli law)
const EXEMPT_PATTERNS = [
  /^עגבני/,
  /לימון.*טרי/,
  /^תפוח(?!.*קופסא)/,
  /^בננ/,
  /^ענב/,
  /^אבטיח/,
  /^מלון(?!.*קופסא)/,
  /^תות/,
  /^אבוקד/,
  /פירות.*טרי/,
  /ירק.*טרי/,
  /^גזר(?!.*מוקפא)/,
  /^מלפפון/,
  /^חסה/,
  /^כרוב/,
  /^פלפל(?!.*קופסא)/,
];

// These override exempt (processed/packaged versions)
const TAXABLE_OVERRIDE = [
  /קופסא/, /שימור/, /מקופסא/, /מוקפא/, /מרוסק/,
  /רוטב/, /מיץ/, /ממרח/, /מעובד/,
];

export function classifyItem(item) {
  if (item.row_type !== 'item') {
    return { ...item, vat_status: 'n/a', pre_vat: item.total, vat_amount: 0 };
  }

  const name = (item.name || '').trim();
  const total = Math.abs(item.total || 0);

  const modelSaysExempt = item.possibly_exempt === true;
  const patternSaysExempt = EXEMPT_PATTERNS.some(p => p.test(name));
  const hasOverride = TAXABLE_OVERRIDE.some(p => p.test(name));

  if ((modelSaysExempt || patternSaysExempt) && !hasOverride) {
    return {
      ...item,
      vat_status: 'flag',
      flag_reason: 'ייתכן פטור – ירק/פרי טרי',
      pre_vat: total,
      vat_amount: 0,
    };
  }

  const pre_vat = +(total / (1 + VAT_RATE)).toFixed(2);
  const vat_amount = +(total - pre_vat).toFixed(2);

  return {
    ...item,
    vat_status: 'taxable',
    pre_vat:    item.total < 0 ? -pre_vat    : pre_vat,
    vat_amount: item.total < 0 ? -vat_amount : vat_amount,
  };
}

export function classifyVATItems(lineItems) {
  return lineItems.map(classifyItem);
}

export function calcSessionSummary(items) {
  let taxableBase = 0, vatTotal = 0, exemptTotal = 0, flagTotal = 0;
  items.forEach(item => {
    if (item.row_type !== 'item') return;
    if (item.vat_status === 'taxable') { taxableBase += item.pre_vat;         vatTotal  += item.vat_amount; }
    if (item.vat_status === 'exempt')  { exemptTotal += item.total; }
    if (item.vat_status === 'flag')    { flagTotal   += Math.abs(item.total); }
  });
  return {
    taxableBase: +taxableBase.toFixed(2),
    vatTotal:    +vatTotal.toFixed(2),
    exemptTotal: +exemptTotal.toFixed(2),
    flagTotal:   +flagTotal.toFixed(2),
  };
}
