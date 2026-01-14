const { drive, sheets } = require('./googleAuth');
const { Readable } = require('stream');

const ROOT_FOLDER_ID = process.env.GOOGLE_ROOT_FOLDER_ID;
const FILES_FOLDER_ID = process.env.GOOGLE_FILES_FOLDER_ID;

/**
 * List all period spreadsheets in the root folder
 * @returns {Promise<Array>} List of period objects with id, name, createdTime, modifiedTime
 */
async function listPeriods() {
  const response = await drive.files.list({
    q: `'${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name, createdTime, modifiedTime)',
    orderBy: 'createdTime desc',
  });

  return response.data.files.map(file => ({
    id: file.id,
    batch_name: file.name,
    created_date: file.createdTime,
    updated_date: file.modifiedTime,
    // These will be populated from sheet data
    status: 'open',
    lifecycle_stage: 'collecting',
  }));
}

/**
 * Get a single period by ID
 * @param {string} fileId - The spreadsheet file ID
 * @returns {Promise<Object>} Period object
 */
async function getPeriod(fileId) {
  const response = await drive.files.get({
    fileId,
    fields: 'id, name, createdTime, modifiedTime',
  });

  return {
    id: response.data.id,
    batch_name: response.data.name,
    created_date: response.data.createdTime,
    updated_date: response.data.modifiedTime,
    status: 'open',
    lifecycle_stage: 'collecting',
  };
}

/**
 * Create a new period spreadsheet
 * @param {string} name - Name of the period (e.g., "January 2026")
 * @returns {Promise<Object>} Created period object with id
 */
async function createPeriodSheet(name) {
  // Create a new spreadsheet in the root folder
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [ROOT_FOLDER_ID],
    },
    fields: 'id, name, createdTime, modifiedTime',
  });

  const fileId = response.data.id;

  // Initialize the sheet with headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: 'Sheet1!A1:P1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'id',
        'vendor_name',
        'receipt_number',
        'date',
        'total_amount',
        'vat_amount',
        'currency',
        'payment_method',
        'category',
        'type',
        'status',
        'receipt_image_url',
        'created_date',
        'updated_date',
        'notes',
        'line_items',
      ]],
    },
  });

  return {
    id: fileId,
    batch_name: response.data.name,
    created_date: response.data.createdTime,
    updated_date: response.data.modifiedTime,
    status: 'open',
    lifecycle_stage: 'draft',
  };
}

/**
 * Rename a period spreadsheet
 * @param {string} fileId - The spreadsheet file ID
 * @param {string} newName - New name for the period
 * @returns {Promise<Object>} Updated period object
 */
async function renamePeriod(fileId, newName) {
  const response = await drive.files.update({
    fileId,
    requestBody: { name: newName },
    fields: 'id, name, createdTime, modifiedTime',
  });

  return {
    id: response.data.id,
    batch_name: response.data.name,
    created_date: response.data.createdTime,
    updated_date: response.data.modifiedTime,
  };
}

/**
 * Delete a period spreadsheet
 * @param {string} fileId - The spreadsheet file ID
 * @returns {Promise<void>}
 */
async function deletePeriod(fileId) {
  await drive.files.delete({ fileId });
}

/**
 * Upload a file to the files folder
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - File MIME type
 * @returns {Promise<Object>} Object with file_url and file_id
 */
async function uploadFile(buffer, filename, mimeType) {
  // Create a readable stream from the buffer
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: `${Date.now()}_${filename}`,
      parents: [FILES_FOLDER_ID],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  const fileId = response.data.id;

  // Make the file publicly accessible
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // Use Google Drive's uc?id= format - works for both server-side fetching and frontend display
  // Frontend components will extract the fileId and use appropriate display URLs
  const isPdf = mimeType === 'application/pdf';
  const file_url = `https://drive.google.com/uc?id=${fileId}${isPdf ? '&.pdf' : ''}`;

  return {
    file_id: fileId,
    file_url,
  };
}

/**
 * Delete a file from Drive
 * @param {string} fileId - The file ID to delete
 * @returns {Promise<void>}
 */
async function deleteFile(fileId) {
  await drive.files.delete({ fileId });
}

module.exports = {
  listPeriods,
  getPeriod,
  createPeriodSheet,
  renamePeriod,
  deletePeriod,
  uploadFile,
  deleteFile,
};

