/**
 * Shared receipt calculation utilities
 * For an accounting app - precision is critical!
 */

/**
 * Calculate item total from quantity × unit_price
 * Handles negative values for refunds/credits
 */
export function calculateItemTotal(quantity, unitPrice) {
  const q = Number(quantity) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
}

/**
 * Sum all line item totals
 */
export function sumLineItems(lineItems) {
  if (!lineItems || !Array.isArray(lineItems)) return 0;
  return lineItems.reduce((sum, item) => {
    const total = Number(item.total) || 0;
    return Math.round((sum + total) * 100) / 100;
  }, 0);
}

/**
 * Validate receipt numbers for consistency
 * Returns { isValid: boolean, issues: string[] }
 */
export function validateReceipt(data) {
  const issues = [];

  if (!data) return { isValid: true, issues };

  const lineItems = data.line_items || [];
  const itemsSum = sumLineItems(lineItems);
  const vatAmount = Number(data.vat_amount) || 0;
  const totalAmount = Number(data.total_amount) || 0;

  // Check if items sum + VAT ≈ total (tolerance for rounding: 0.1)
  if (lineItems.length > 0) {
    const expectedTotal = Math.round((itemsSum + vatAmount) * 100) / 100;
    const diff = Math.abs(expectedTotal - totalAmount);
    if (diff > 0.1) {
      issues.push(
        `סכום פריטים (${itemsSum.toFixed(2)}) + מע"מ (${vatAmount.toFixed(2)}) = ${expectedTotal.toFixed(2)}, אבל הסה"כ הוא ${totalAmount.toFixed(2)}`
      );
    }
  }

  // Check each item: total should match quantity × price
  lineItems.forEach((item, i) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const itemTotal = Number(item.total) || 0;
    const expected = calculateItemTotal(quantity, unitPrice);

    if (Math.abs(expected - itemTotal) > 0.01) {
      issues.push(
        `פריט ${i + 1}: ${quantity} × ${unitPrice.toFixed(2)} = ${expected.toFixed(2)}, אבל הסה"כ הוא ${itemTotal.toFixed(2)}`
      );
    }
  });

  return { isValid: issues.length === 0, issues };
}

/**
 * Recalculate receipt values based on options
 * @param {Object} data - Receipt data
 * @param {Object} options - What to recalculate
 * @param {boolean} options.recalculateItemTotals - Recalc each item's total from qty × price
 * @param {boolean} options.recalculateVat - Recalc VAT from items sum
 * @param {number} options.vatPercent - VAT percentage (default 18)
 * @param {boolean} options.recalculateGrandTotal - Recalc grand total from items + VAT
 */
export function recalculateReceipt(data, options = {}) {
  const {
    recalculateItemTotals = false,
    recalculateVat = false,
    vatPercent = 18,
    recalculateGrandTotal = true,
  } = options;

  let lineItems = [...(data.line_items || [])];

  // Step 1: Recalculate each item's total from quantity × unit_price
  if (recalculateItemTotals) {
    lineItems = lineItems.map(item => ({
      ...item,
      total: calculateItemTotal(item.quantity, item.unit_price)
    }));
  }

  const itemsSum = sumLineItems(lineItems);

  // Step 2: Recalculate VAT if requested
  let vatAmount = Number(data.vat_amount) || 0;
  if (recalculateVat) {
    vatAmount = Math.round((itemsSum * vatPercent / 100) * 100) / 100;
  }

  // Step 3: Recalculate grand total
  let totalAmount = Number(data.total_amount) || 0;
  if (recalculateGrandTotal) {
    totalAmount = Math.round((itemsSum + vatAmount) * 100) / 100;
  }

  return {
    ...data,
    line_items: lineItems,
    vat_amount: vatAmount,
    total_amount: totalAmount
  };
}

/**
 * Parse a numeric value, preserving negatives
 * Returns 0 only for truly invalid input (empty string, NaN, null)
 */
export function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}
