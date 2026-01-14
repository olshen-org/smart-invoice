const { sheets } = require('./googleAuth');

// Column mapping for receipts (0-indexed)
const COLUMNS = {
  id: 0,
  vendor_name: 1,
  receipt_number: 2,
  date: 3,
  total_amount: 4,
  vat_amount: 5,
  currency: 6,
  payment_method: 7,
  category: 8,
  type: 9,
  status: 10,
  receipt_image_url: 11,
  created_date: 12,
  updated_date: 13,
  notes: 14,
  line_items: 15,
};

const COLUMN_NAMES = Object.keys(COLUMNS);

/**
 * Convert a row array to a receipt object
 */
function rowToReceipt(row, rowIndex) {
  if (!row || row.length === 0) return null;

  const receipt = { _rowIndex: rowIndex };
  COLUMN_NAMES.forEach((col, idx) => {
    let value = row[idx] || null;
    // Parse numeric fields
    if ((col === 'total_amount' || col === 'vat_amount') && value) {
      value = parseFloat(value) || 0;
    }
    // Parse JSON fields
    if (col === 'line_items' && value) {
      try {
        value = JSON.parse(value);
      } catch {
        value = [];
      }
    }
    receipt[col] = value;
  });
  return receipt;
}

/**
 * Convert a receipt object to a row array
 */
function receiptToRow(receipt) {
  return COLUMN_NAMES.map(col => {
    const value = receipt[col];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Generate a unique ID for a receipt
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Get all receipts from a period spreadsheet
 * @param {string} spreadsheetId - The spreadsheet ID
 * @returns {Promise<Array>} Array of receipt objects
 */
async function getReceipts(spreadsheetId) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A2:P', // Skip header row, columns A-P
  });

  const rows = response.data.values || [];
  return rows
    .map((row, idx) => rowToReceipt(row, idx + 2)) // +2 because row 1 is header, arrays are 0-indexed
    .filter(r => r && r.id); // Filter out empty rows
}

/**
 * Get a single receipt by ID
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} receiptId - The receipt ID
 * @returns {Promise<Object|null>} Receipt object or null
 */
async function getReceipt(spreadsheetId, receiptId) {
  const receipts = await getReceipts(spreadsheetId);
  return receipts.find(r => r.id === receiptId) || null;
}

/**
 * Add a new receipt to a period spreadsheet
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {Object} data - Receipt data
 * @returns {Promise<Object>} Created receipt with ID
 */
async function addReceipt(spreadsheetId, data) {
  const now = new Date().toISOString();
  const receipt = {
    id: generateId(),
    vendor_name: data.vendor_name || '',
    receipt_number: data.receipt_number || '',
    date: data.date || '',
    total_amount: data.total_amount || 0,
    vat_amount: data.vat_amount || 0,
    currency: data.currency || 'ILS',
    payment_method: data.payment_method || '',
    category: data.category || '',
    type: data.type || 'expense',
    status: data.status || 'pending',
    receipt_image_url: data.receipt_image_url || '',
    created_date: now,
    updated_date: now,
    notes: data.notes || '',
    line_items: data.line_items || [],
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A:P',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [receiptToRow(receipt)],
    },
  });

  return receipt;
}

/**
 * Update a receipt in a period spreadsheet
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} receiptId - The receipt ID to update
 * @param {Object} data - Updated receipt data
 * @returns {Promise<Object>} Updated receipt
 */
async function updateReceipt(spreadsheetId, receiptId, data) {
  // First, find the receipt to get its row index
  const receipts = await getReceipts(spreadsheetId);
  const existing = receipts.find(r => r.id === receiptId);
  
  if (!existing) {
    throw new Error(`Receipt ${receiptId} not found`);
  }

  const rowIndex = existing._rowIndex;
  const now = new Date().toISOString();

  // Merge existing data with updates
  const updated = {
    ...existing,
    ...data,
    id: receiptId, // Preserve original ID
    updated_date: now,
  };
  delete updated._rowIndex;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Sheet1!A${rowIndex}:P${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [receiptToRow(updated)],
    },
  });

  return updated;
}

/**
 * Delete a receipt from a period spreadsheet
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} receiptId - The receipt ID to delete
 * @returns {Promise<void>}
 */
async function deleteReceipt(spreadsheetId, receiptId) {
  // Find the receipt to get its row index
  const receipts = await getReceipts(spreadsheetId);
  const existing = receipts.find(r => r.id === receiptId);
  
  if (!existing) {
    throw new Error(`Receipt ${receiptId} not found`);
  }

  const rowIndex = existing._rowIndex;

  // Get spreadsheet info to find the sheet ID
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

  // Delete the row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-indexed
            endIndex: rowIndex,
          },
        },
      }],
    },
  });
}

/**
 * Get period metadata (stats computed from receipts)
 * @param {string} spreadsheetId - The spreadsheet ID
 * @returns {Promise<Object>} Period stats
 */
async function getPeriodStats(spreadsheetId) {
  const receipts = await getReceipts(spreadsheetId);
  
  const approvedReceipts = receipts.filter(r => r.status === 'approved');
  const incomeReceipts = approvedReceipts.filter(r => r.type === 'income');
  const expenseReceipts = approvedReceipts.filter(r => r.type !== 'income');

  return {
    total_receipts: receipts.length,
    income_total: incomeReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0),
    expense_total: expenseReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0),
    pending_count: receipts.filter(r => r.status === 'pending').length,
    approved_count: approvedReceipts.length,
  };
}

module.exports = {
  getReceipts,
  getReceipt,
  addReceipt,
  updateReceipt,
  deleteReceipt,
  getPeriodStats,
};

