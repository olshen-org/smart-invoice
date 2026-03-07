/**
 * Gmail Invoice Watcher for Mary Happy
 *
 * How it works:
 * 1. You receive an invoice email
 * 2. You manually add the "smart-invoice" label to it
 * 3. This script runs every 5 minutes and processes labeled emails
 * 4. After processing: removes "smart-invoice", adds "processed" (green) or "failed" (red)
 *
 * Supports two email patterns:
 *   A) Direct attachment (PDF or image) — Ituran, City Wash, Wolt, etc.
 *   B) Tokenized URL in email body (no attachment) — Bezeq, Hot, etc.
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

// ============ TOKENIZED URL HANDLING ============

/**
 * Extract URLs from HTML email body that look like invoice links.
 * Handles HTML entity decoding (&amp; → &) for URL correctness.
 */
function extractInvoiceUrls(htmlBody) {
  // Decode HTML entities so URLs are valid
  const decoded = htmlBody
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  const urls = [];
  const seen = {};

  // Extract all href values
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(decoded)) !== null) {
    const url = match[1].trim();

    // Only HTTP(S) URLs, no duplicates
    if (!url.startsWith('http') || seen[url]) continue;
    seen[url] = true;

    // Skip unsubscribe / tracking / image links
    const skipKeywords = ['unsubscribe', 'optout', 'pixel', 'track', 'open.php',
                          'click.php', 'beacon', 'analytics', 'utm_'];
    if (skipKeywords.some(kw => url.toLowerCase().includes(kw))) continue;

    // Keep URLs that look like invoice/document links
    const invoiceKeywords = [
      'invoice', 'חשבונית', 'receipt', 'bill', 'חשבון',
      'myinvoice', 'download', 'pdf', 'document', 'view-bill',
      'statement', 'e-bill', 'ebill', 'billing'
    ];
    const urlLower = url.toLowerCase();
    if (invoiceKeywords.some(kw => urlLower.includes(kw.toLowerCase()))) {
      urls.push(url);
      Logger.log('Candidate invoice URL: ' + url);
    }
  }

  return urls;
}

/**
 * Attempt to download a PDF from a given URL.
 * If URL returns HTML, scans it for PDF download links.
 */
function fetchPdfFromUrl(landingUrl) {
  try {
    Logger.log('Fetching invoice page: ' + landingUrl);
    const response = UrlFetchApp.fetch(landingUrl, {
      followRedirects: true,
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoogleAppsScript/1.0)' }
    });

    const code = response.getResponseCode();
    const contentType = (response.getHeaders()['Content-Type'] || '').toLowerCase();
    Logger.log('Response: HTTP ' + code + ', Content-Type: ' + contentType);

    if (code !== 200) {
      Logger.log('Non-200 response, skipping');
      return null;
    }

    // ── Direct PDF returned ──────────────────────────────────────
    if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
      const blob = response.getBlob();
      const bytes = blob.getBytes();
      // Verify PDF magic bytes: %PDF
      if (bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70) {
        const suggestedName = landingUrl.split('/').pop().split('?')[0] || 'invoice.pdf';
        const fileName = suggestedName.toLowerCase().endsWith('.pdf')
          ? suggestedName : 'invoice.pdf';
        Logger.log('Direct PDF (' + Math.round(bytes.length / 1024) + 'KB): ' + fileName);
        return blob.setName(fileName);
      }
    }

    // ── HTML page — scan for PDF links ──────────────────────────
    const html = response.getContentText();
    const baseUrlMatch = landingUrl.match(/^(https?:\/\/[^\/]+)/);
    const baseUrl = baseUrlMatch ? baseUrlMatch[0] : '';

    // Patterns to find PDF download links inside the page
    const linkPatterns = [
      // Explicit .pdf extension in href
      /href=["']([^"']*\.pdf[^"']*)["']/gi,
      // Download / export / print endpoints
      /href=["']([^"']*(?:download|Export|Print|GetPdf|generatePDF)[^"']*)["']/gi,
      // Form actions pointing at pdf-generating endpoints
      /action=["']([^"']*(?:pdf|invoice|receipt|bill)[^"']*)["']/gi,
    ];

    for (const pattern of linkPatterns) {
      let m;
      while ((m = pattern.exec(html)) !== null) {
        let href = m[1].replace(/&amp;/g, '&').trim();

        // Skip anchors / javascript / mailto
        if (href.startsWith('#') || href.startsWith('javascript:') ||
            href.startsWith('mailto:')) continue;

        // Build absolute URL
        if (href.startsWith('//')) {
          href = 'https:' + href;
        } else if (href.startsWith('/')) {
          href = baseUrl + href;
        } else if (!href.startsWith('http')) {
          continue;
        }

        Logger.log('Trying PDF link from page: ' + href);
        const pdfBlob = fetchDirectPdf(href);
        if (pdfBlob) return pdfBlob;
      }
    }

    Logger.log('No PDF found in page: ' + landingUrl);
    return null;

  } catch (e) {
    Logger.log('fetchPdfFromUrl error: ' + e.message);
    return null;
  }
}

/**
 * Fetch a URL and return its content as a PDF blob only if it is actually a PDF.
 */
function fetchDirectPdf(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      followRedirects: true,
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) return null;

    const blob = response.getBlob();
    const bytes = blob.getBytes();

    // Check PDF magic bytes (%PDF)
    if (bytes.length > 4 &&
        bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70) {
      const raw = url.split('/').pop().split('?')[0] || 'invoice.pdf';
      const fileName = raw.toLowerCase().endsWith('.pdf') ? raw : 'invoice.pdf';
      Logger.log('Confirmed PDF (' + Math.round(bytes.length / 1024) + 'KB): ' + fileName);
      return blob.setName(fileName);
    }

    return null;
  } catch (e) {
    Logger.log('fetchDirectPdf error: ' + e.message);
    return null;
  }
}

/**
 * Try to retrieve an invoice PDF from URLs found in the email body.
 * This handles "click to view" emails like Bezeq, Hot, etc.
 * Returns a Blob if successful, or null.
 */
function fetchInvoiceFromEmailBody(message) {
  const htmlBody = message.getBody();
  if (!htmlBody) {
    Logger.log('Empty email body');
    return null;
  }

  const invoiceUrls = extractInvoiceUrls(htmlBody);

  if (invoiceUrls.length === 0) {
    Logger.log('No invoice URLs found in email body');
    return null;
  }

  Logger.log('Trying ' + invoiceUrls.length + ' candidate URLs...');

  for (const url of invoiceUrls) {
    const blob = fetchPdfFromUrl(url);
    if (blob) {
      Logger.log('✓ PDF obtained from URL: ' + url);
      return blob;
    }
  }

  Logger.log('Could not obtain a PDF from any URL in email body');
  return null;
}

// ============ MAIN PROCESSING ============

/**
 * Main function - processes invoice emails with "smart-invoice" label.
 * Set this to run every 5 minutes via Triggers.
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

      // ── Path A: direct attachment ───────────────────────────────
      const invoiceAttachment = findInvoiceAttachment(attachments);

      if (invoiceAttachment) {
        Logger.log('Processing attachment: ' + invoiceAttachment.getName());
        try {
          const result = uploadAndProcessBlob(invoiceAttachment.copyBlob(), message);
          if (result.success) {
            Logger.log('Success (attachment): ' + JSON.stringify(result));
            threadSuccess = true;
          } else {
            Logger.log('Failed (attachment): ' + result.error);
            threadError = result.error;
          }
        } catch (error) {
          Logger.log('Error (attachment): ' + error.message);
          threadError = error.message;
        }

      } else {
        // ── Path B: no attachment — try tokenized URL in body ──────
        Logger.log('No attachment found — scanning email body for invoice URL...');
        const urlBlob = fetchInvoiceFromEmailBody(message);

        if (urlBlob) {
          Logger.log('Processing PDF from URL: ' + urlBlob.getName());
          try {
            const result = uploadAndProcessBlob(urlBlob, message);
            if (result.success) {
              Logger.log('Success (URL): ' + JSON.stringify(result));
              threadSuccess = true;
            } else {
              Logger.log('Failed (URL): ' + result.error);
              threadError = result.error;
            }
          } catch (error) {
            Logger.log('Error (URL): ' + error.message);
            threadError = error.message;
          }

        } else {
          Logger.log('No valid invoice attachment or URL found in message');
          threadError = 'No valid invoice attachment or URL found';
        }
      }
    }

    // Always remove the inbox label (we've processed this thread)
    thread.removeLabel(inboxLabel);

    // Add result label
    if (threadSuccess) {
      thread.addLabel(processedLabel);
      Logger.log('Marked as processed ✓');
    } else {
      thread.addLabel(failedLabel);
      Logger.log('Marked as failed: ' + (threadError || 'Unknown error'));
    }
  }

  Logger.log('Processing complete');
}

// ============ API INTEGRATION ============

/**
 * Upload a blob (PDF or image) to the API and create a receipt.
 * Accepts either a GmailAttachment blob or any Blob obtained via UrlFetchApp.
 */
function uploadAndProcessBlob(blob, message) {
  const fileName = blob.getName() || 'invoice.pdf';

  // Step 1: Upload file via multipart form data
  const uploadResponse = UrlFetchApp.fetch(CONFIG.API_URL + '/api/upload', {
    method: 'post',
    payload: { file: blob },
    muteHttpExceptions: true
  });

  if (uploadResponse.getResponseCode() !== 200) {
    return { success: false, error: 'Upload failed: ' + uploadResponse.getContentText() };
  }

  const uploadResult = JSON.parse(uploadResponse.getContentText());
  const fileUrl = uploadResult.file_url;

  if (!fileUrl) {
    return { success: false, error: 'No file URL returned from upload' };
  }

  // Step 2: Process with Gemini OCR
  const processResponse = UrlFetchApp.fetch(CONFIG.API_URL + '/api/process-receipt', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ file_url: fileUrl }),
    muteHttpExceptions: true
  });

  if (processResponse.getResponseCode() !== 200) {
    return { success: false, error: 'Processing failed: ' + processResponse.getContentText() };
  }

  const receiptData = JSON.parse(processResponse.getContentText());

  // Step 3: Resolve batch/period ID
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

/**
 * @deprecated Use uploadAndProcessBlob() directly.
 * Kept for backward compatibility if called from other scripts.
 */
function uploadAndProcessAttachment(attachment, message) {
  return uploadAndProcessBlob(attachment.copyBlob(), message);
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
 * Dry run - see what would be processed without actually processing.
 * Also shows whether email body URLs are found for no-attachment emails.
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
    Logger.log('All attachments: ' + (attachments.length > 0
      ? attachments.map(a => a.getName() + ' (' + Math.round(a.getSize()/1024) + 'KB)').join(', ')
      : '(none)'));

    // Show what would actually be selected
    const selected = findInvoiceAttachment(attachments);
    if (selected) {
      Logger.log('→ Path A: Would process attachment: ' + selected.getName());
    } else {
      Logger.log('→ No attachment. Scanning email body for URLs...');
      const urls = extractInvoiceUrls(message.getBody());
      if (urls.length > 0) {
        Logger.log('→ Path B: Found ' + urls.length + ' candidate URL(s): ' + urls.join(', '));
        Logger.log('→ (Use testFetchUrl to verify PDF download)');
      } else {
        Logger.log('→ No invoice found — would fail');
      }
    }
  }
}

/**
 * Test fetching a PDF from a specific URL (useful for debugging Bezeq etc.)
 * Usage: set TEST_URL below and run this function
 */
function testFetchUrl() {
  const TEST_URL = 'https://myinvoice.bezeq.co.il/?MailID=YOUR_TOKEN_HERE';

  Logger.log('Testing URL fetch: ' + TEST_URL);
  const blob = fetchPdfFromUrl(TEST_URL);
  if (blob) {
    Logger.log('✓ Success! Got PDF: ' + blob.getName() + ' (' + Math.round(blob.getBytes().length / 1024) + 'KB)');
  } else {
    Logger.log('✗ Could not retrieve PDF from this URL');
  }
}
