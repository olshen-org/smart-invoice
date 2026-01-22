/**
 * Gmail Invoice Watcher for Mary Happy
 *
 * How it works:
 * 1. You receive an invoice email
 * 2. You manually add the "smart-invoice" label to it
 * 3. This script runs every 5 minutes and processes labeled emails
 * 4. After processing: removes "smart-invoice", adds "processed" (green) or "failed" (red)
 *
 * Setup:
 * 1. Create labels in Gmail:
 *    - "smart-invoice" (trigger label - you add this manually)
 *    - "smart-invoice/processed" (set to GREEN color)
 *    - "smart-invoice/failed" (set to RED color)
 * 2. Go to https://script.google.com
 * 3. Create new project, paste this code
 * 4. Set your API_URL below
 * 5. Run processInvoiceEmails() once to authorize
 * 6. Add trigger: Edit > Triggers > Add > processInvoiceEmails > Time-driven > Every 5 minutes
 */

// ============ CONFIGURATION ============
const CONFIG = {
  // Your production API URL
  API_URL: 'https://your-app-url.com',

  // Default batch/period ID to add receipts to (or leave empty to use most recent open period)
  DEFAULT_BATCH_ID: '',

  // Label names (create these in Gmail with colors)
  LABEL_INBOX: 'smart-invoice',           // You add this label to trigger processing
  LABEL_PROCESSED: 'smart-invoice/processed', // Green - success
  LABEL_FAILED: 'smart-invoice/failed',       // Red - failed
};

// ============ HELPERS ============

function getLabel(name) {
  const label = GmailApp.getUserLabelByName(name);
  if (!label) {
    throw new Error('Label "' + name + '" not found. Please create it in Gmail first.');
  }
  return label;
}

/**
 * Filter attachments to find the actual invoice, ignoring logos/signatures
 */
function findInvoiceAttachment(attachments) {
  const validAttachments = [];

  for (const attachment of attachments) {
    const mimeType = attachment.getContentType().toLowerCase();
    const fileName = attachment.getName().toLowerCase();
    const sizeBytes = attachment.getSize();

    // Skip non-document files
    const isValidType = mimeType.includes('pdf') ||
                        mimeType.includes('image/jpeg') ||
                        mimeType.includes('image/png') ||
                        fileName.endsWith('.pdf') ||
                        fileName.endsWith('.jpg') ||
                        fileName.endsWith('.jpeg') ||
                        fileName.endsWith('.png');

    if (!isValidType) {
      Logger.log('Skipping (wrong type): ' + fileName);
      continue;
    }

    // Skip tiny files - likely logos/signatures (< 15KB)
    if (sizeBytes < 15000) {
      Logger.log('Skipping (too small, ' + Math.round(sizeBytes/1024) + 'KB): ' + fileName);
      continue;
    }

    // Skip common logo/signature filenames
    const skipPatterns = ['logo', 'signature', 'footer', 'header', 'banner', 'icon', 'avatar'];
    const hasSkipPattern = skipPatterns.some(pattern => fileName.includes(pattern));
    if (hasSkipPattern) {
      Logger.log('Skipping (filename pattern): ' + fileName);
      continue;
    }

    // Skip GIFs entirely - almost never invoices
    if (mimeType.includes('gif') || fileName.endsWith('.gif')) {
      Logger.log('Skipping (gif): ' + fileName);
      continue;
    }

    validAttachments.push({
      attachment,
      fileName,
      mimeType,
      sizeBytes,
      isPdf: mimeType.includes('pdf') || fileName.endsWith('.pdf')
    });
  }

  if (validAttachments.length === 0) {
    return null;
  }

  // Prefer PDFs over images
  const pdfs = validAttachments.filter(a => a.isPdf);
  if (pdfs.length > 0) {
    // If multiple PDFs, pick the largest one
    pdfs.sort((a, b) => b.sizeBytes - a.sizeBytes);
    Logger.log('Selected PDF: ' + pdfs[0].fileName + ' (' + Math.round(pdfs[0].sizeBytes/1024) + 'KB)');
    return pdfs[0].attachment;
  }

  // Otherwise pick the largest image
  validAttachments.sort((a, b) => b.sizeBytes - a.sizeBytes);
  Logger.log('Selected image: ' + validAttachments[0].fileName + ' (' + Math.round(validAttachments[0].sizeBytes/1024) + 'KB)');
  return validAttachments[0].attachment;
}

// ============ MAIN PROCESSING ============

/**
 * Main function - processes invoice emails with "smart-invoice" label
 * Set this to run every 5 minutes via Triggers
 */
function processInvoiceEmails() {
  // Get all required labels (will throw if not found)
  const inboxLabel = getLabel(CONFIG.LABEL_INBOX);
  const processedLabel = getLabel(CONFIG.LABEL_PROCESSED);
  const failedLabel = getLabel(CONFIG.LABEL_FAILED);

  // Search for emails with the inbox label
  const searchQuery = `label:${CONFIG.LABEL_INBOX}`;

  Logger.log('Searching: ' + searchQuery);
  const threads = GmailApp.search(searchQuery, 0, 10); // Process max 10 at a time

  Logger.log('Found ' + threads.length + ' threads to process');

  for (const thread of threads) {
    const messages = thread.getMessages();
    let threadSuccess = false;
    let threadError = null;

    for (const message of messages) {
      const attachments = message.getAttachments();
      
      // Smart filter: find the actual invoice, skip logos/signatures
      const invoiceAttachment = findInvoiceAttachment(attachments);
      
      if (invoiceAttachment) {
        Logger.log('Processing: ' + invoiceAttachment.getName());

        try {
          const result = uploadAndProcessAttachment(invoiceAttachment, message);
          if (result.success) {
            Logger.log('Success: ' + JSON.stringify(result));
            threadSuccess = true;
          } else {
            Logger.log('Failed: ' + result.error);
            threadError = result.error;
          }
        } catch (error) {
          Logger.log('Error: ' + error.message);
          threadError = error.message;
        }
      } else {
        Logger.log('No valid invoice attachment found in message');
        threadError = 'No valid invoice attachment found';
      }
    }

    // Always remove the inbox label (we've processed this thread)
    thread.removeLabel(inboxLabel);

    // Add result label
    if (threadSuccess) {
      thread.addLabel(processedLabel);
      Logger.log('Marked as processed');
    } else {
      thread.addLabel(failedLabel);
      Logger.log('Marked as failed: ' + (threadError || 'No valid attachments found'));
    }
  }

  Logger.log('Processing complete');
}

// ============ API INTEGRATION ============

/**
 * Upload attachment to your API and trigger processing
 */
function uploadAndProcessAttachment(attachment, message) {
  const blob = attachment.copyBlob();
  const fileName = attachment.getName();

  // Step 1: Upload file to Google Drive via your API (multipart form data)
  const uploadResponse = UrlFetchApp.fetch(CONFIG.API_URL + '/api/upload', {
    method: 'post',
    payload: {
      file: blob
    },
    muteHttpExceptions: true
  });

  if (uploadResponse.getResponseCode() !== 200) {
    return { success: false, error: 'Upload failed: ' + uploadResponse.getContentText() };
  }

  const uploadResult = JSON.parse(uploadResponse.getContentText());
  const fileUrl = uploadResult.url || uploadResult.webViewLink;

  if (!fileUrl) {
    return { success: false, error: 'No file URL returned' };
  }

  // Step 2: Process with Gemini OCR
  const processResponse = UrlFetchApp.fetch(CONFIG.API_URL + '/api/process-receipt', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      file_url: fileUrl
    }),
    muteHttpExceptions: true
  });

  if (processResponse.getResponseCode() !== 200) {
    return { success: false, error: 'Processing failed: ' + processResponse.getContentText() };
  }

  const receiptData = JSON.parse(processResponse.getContentText());

  // Step 3: Get batch ID (use configured or find open period)
  let batchId = CONFIG.DEFAULT_BATCH_ID;
  if (!batchId) {
    const periodsResponse = UrlFetchApp.fetch(CONFIG.API_URL + '/api/periods', {
      method: 'get',
      muteHttpExceptions: true
    });

    if (periodsResponse.getResponseCode() === 200) {
      const periods = JSON.parse(periodsResponse.getContentText());
      const openPeriod = periods.find(p => p.status !== 'completed' && p.lifecycle_stage !== 'completed');
      if (openPeriod) {
        batchId = openPeriod.id;
      }
    }
  }

  if (!batchId) {
    return { success: false, error: 'No open period found' };
  }

  // Step 4: Create receipt in the period
  const createResponse = UrlFetchApp.fetch(CONFIG.API_URL + '/api/periods/' + batchId + '/receipts', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      ...receiptData,
      receipt_image_url: fileUrl,
      status: 'pending', // Mark as pending for manual review
      source: 'email',
      email_subject: message.getSubject(),
      email_from: message.getFrom(),
      email_date: message.getDate().toISOString()
    }),
    muteHttpExceptions: true
  });

  if (createResponse.getResponseCode() !== 200) {
    return { success: false, error: 'Create receipt failed: ' + createResponse.getContentText() };
  }

  const receipt = JSON.parse(createResponse.getContentText());

  return {
    success: true,
    receiptId: receipt.id,
    vendor: receiptData.vendor_name,
    total: receiptData.total_amount
  };
}

// ============ MANUAL TESTING ============

/**
 * Test that all labels exist
 */
function testLabels() {
  try {
    getLabel(CONFIG.LABEL_INBOX);
    Logger.log('✓ Found: ' + CONFIG.LABEL_INBOX);

    getLabel(CONFIG.LABEL_PROCESSED);
    Logger.log('✓ Found: ' + CONFIG.LABEL_PROCESSED);

    getLabel(CONFIG.LABEL_FAILED);
    Logger.log('✓ Found: ' + CONFIG.LABEL_FAILED);

    Logger.log('All labels OK!');
  } catch (error) {
    Logger.log('✗ ' + error.message);
  }
}

/**
 * Test API connectivity
 */
function testApiConnection() {
  try {
    const response = UrlFetchApp.fetch(CONFIG.API_URL + '/health');
    Logger.log('API Status: ' + response.getContentText());
  } catch (error) {
    Logger.log('API Error: ' + error.message);
  }
}

/**
 * Dry run - see what would be processed without actually processing
 */
function dryRun() {
  const searchQuery = `label:${CONFIG.LABEL_INBOX}`;
  const threads = GmailApp.search(searchQuery, 0, 10);

  Logger.log('Found ' + threads.length + ' threads with label "' + CONFIG.LABEL_INBOX + '"');

  for (const thread of threads) {
    const message = thread.getMessages()[0];
    const attachments = message.getAttachments();

    Logger.log('---');
    Logger.log('Subject: ' + message.getSubject());
    Logger.log('From: ' + message.getFrom());
    Logger.log('All attachments: ' + attachments.map(a => 
      a.getName() + ' (' + Math.round(a.getSize()/1024) + 'KB)'
    ).join(', '));

    // Show what would actually be selected
    const selected = findInvoiceAttachment(attachments);
    if (selected) {
      Logger.log('→ Would process: ' + selected.getName());
    } else {
      Logger.log('→ No valid invoice found (would fail)');
    }
  }
}
