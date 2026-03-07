const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import Google API modules
const googleDrive = require('./lib/googleDrive');
const { extractReceipt, classifyItemVAT } = require('./lib/geminiExtract');
const googleSheets = require('./lib/googleSheets');

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Add logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Configure Multer for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// PERIODS (BATCHES) API
// ============================================

// List all periods
app.get('/api/periods', async (req, res) => {
  try {
    const periods = await googleDrive.listPeriods();
    
    // Enrich with stats from each spreadsheet
    const enrichedPeriods = await Promise.all(
      periods.map(async (period) => {
        try {
          const stats = await googleSheets.getPeriodStats(period.id);
          return { ...period, ...stats };
        } catch (err) {
          console.error(`Error getting stats for period ${period.id}:`, err.message);
          return period;
        }
      })
    );
    
    res.json(enrichedPeriods);
  } catch (error) {
    console.error('Error listing periods:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single period
app.get('/api/periods/:id', async (req, res) => {
  try {
    const period = await googleDrive.getPeriod(req.params.id);
    const stats = await googleSheets.getPeriodStats(req.params.id);
    res.json({ ...period, ...stats });
  } catch (error) {
    console.error('Error getting period:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new period
app.post('/api/periods', async (req, res) => {
  try {
    const { batch_name, type = 'personal', client_name = '' } = req.body;
    if (!batch_name) {
      return res.status(400).json({ error: 'batch_name is required' });
    }
    const period = await googleDrive.createPeriodSheet(batch_name, { type, client_name });
    res.json(period);
  } catch (error) {
    console.error('Error creating period:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update period (rename)
app.put('/api/periods/:id', async (req, res) => {
  try {
    const { batch_name, status, lifecycle_stage, finalized_date, client_name } = req.body;
    if (batch_name) {
      await googleDrive.renamePeriod(req.params.id, batch_name);
    }
    await googleDrive.updatePeriodProps(req.params.id, { status, lifecycle_stage, finalized_date, client_name });
    const period = await googleDrive.getPeriod(req.params.id);
    const stats = await googleSheets.getPeriodStats(req.params.id);
    res.json({ ...period, ...stats });
  } catch (error) {
    console.error('Error updating period:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete period
app.delete('/api/periods/:id', async (req, res) => {
  try {
    await googleDrive.deletePeriod(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting period:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RECEIPTS API
// ============================================

// List receipts in a period
app.get('/api/periods/:periodId/receipts', async (req, res) => {
  try {
    const receipts = await googleSheets.getReceipts(req.params.periodId);
    
    // Apply ordering if specified
    const orderBy = req.query.orderBy;
    if (orderBy) {
      const descending = orderBy.startsWith('-');
      const field = descending ? orderBy.slice(1) : orderBy;
      receipts.sort((a, b) => {
        const aVal = a[field] || '';
        const bVal = b[field] || '';
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return descending ? -cmp : cmp;
      });
    }
    
    res.json(receipts);
  } catch (error) {
    console.error('Error listing receipts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single receipt
app.get('/api/periods/:periodId/receipts/:receiptId', async (req, res) => {
  try {
    const receipt = await googleSheets.getReceipt(req.params.periodId, req.params.receiptId);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json(receipt);
  } catch (error) {
    console.error('Error getting receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create receipt
app.post('/api/periods/:periodId/receipts', async (req, res) => {
  try {
    const receipt = await googleSheets.addReceipt(req.params.periodId, req.body);
    res.json(receipt);
  } catch (error) {
    console.error('Error creating receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update receipt
app.put('/api/periods/:periodId/receipts/:receiptId', async (req, res) => {
  try {
    const receipt = await googleSheets.updateReceipt(
      req.params.periodId, 
      req.params.receiptId, 
      req.body
    );
    res.json(receipt);
  } catch (error) {
    console.error('Error updating receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete receipt
app.delete('/api/periods/:periodId/receipts/:receiptId', async (req, res) => {
  try {
    await googleSheets.deleteReceipt(req.params.periodId, req.params.receiptId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FILE UPLOAD API (Google Drive)
// ============================================

// Proxy endpoint to serve files from Google Drive (avoids CORS issues)
// Supports optional extension for frontend PDF detection: /api/files/abc123.pdf
app.get('/api/files/:fileId', async (req, res) => {
  try {
    const { drive } = require('./lib/googleAuth');
    // Strip extension if present (e.g., "abc123.pdf" -> "abc123")
    const fileId = req.params.fileId.replace(/\.[^.]+$/, '');
    const response = await drive.files.get({
      fileId,
      alt: 'media',
    }, {
      responseType: 'stream',
    });
    
    // Get file metadata for content type
    const metadata = await drive.files.get({
      fileId,
      fields: 'mimeType',
    });
    
    res.setHeader('Content-Type', metadata.data.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    response.data.pipe(res);
  } catch (error) {
    console.error('Error serving file:', error.message);
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log(`Processing file upload: ${req.file.originalname}`);
    
    const result = await googleDrive.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.json(result);
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: 'Failed to upload file to storage' });
  }
});

// ============================================
// RECEIPT PROCESSING (Gemini AI)
// ============================================


app.post('/api/process-receipt', upload.single('file'), async (req, res) => {
  console.log('Received receipt processing request');
  try {
    let imageBuffer, mimeType;

    if (req.file) {
      imageBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body.file_url) {
      const fetchRes = await fetch(req.body.file_url);
      if (!fetchRes.ok) throw new Error('Failed to fetch image from URL');
      imageBuffer = Buffer.from(await fetchRes.arrayBuffer());

      // Detect MIME type from magic bytes (Google Drive returns application/octet-stream)
      mimeType = fetchRes.headers.get('content-type');
      if (!mimeType || mimeType === 'application/octet-stream') {
        if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) mimeType = 'image/jpeg';
        else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) mimeType = 'image/png';
        else if (imageBuffer[0] === 0x25 && imageBuffer[1] === 0x50) mimeType = 'application/pdf';
        else mimeType = 'image/jpeg';
        console.log('Detected MIME type:', mimeType);
      }
    } else {
      return res.status(400).json({ error: 'No file or file_url provided' });
    }

    const extracted = await extractReceipt(imageBuffer, mimeType);
    res.json(extracted);
  } catch (error) {
    console.error('Error processing receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

// VAT classification for a single item name
app.post('/api/classify-vat', async (req, res) => {
  try {
    const { item_name } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name is required' });
    const result = await classifyItemVAT(item_name);
    res.json(result);
  } catch (err) {
    console.error('VAT classification error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// LEGACY ENDPOINTS (for backwards compatibility)
// ============================================

// Map old /api/batches to /api/periods
app.get('/api/batches', async (req, res) => {
  try {
    const periods = await googleDrive.listPeriods();
    const enrichedPeriods = await Promise.all(
      periods.map(async (period) => {
        try {
          const stats = await googleSheets.getPeriodStats(period.id);
          return { ...period, ...stats };
        } catch (err) {
          return period;
        }
      })
    );
    res.json(enrichedPeriods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches', async (req, res) => {
  try {
    const { batch_name } = req.body;
    if (!batch_name) {
      return res.status(400).json({ error: 'batch_name is required' });
    }
    const period = await googleDrive.createPeriodSheet(batch_name);
    res.json(period);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/batches/:id', async (req, res) => {
  try {
    const { batch_name, status, lifecycle_stage, finalized_date, client_name } = req.body;
    if (batch_name) {
      await googleDrive.renamePeriod(req.params.id, batch_name);
    }
    await googleDrive.updatePeriodProps(req.params.id, { status, lifecycle_stage, finalized_date, client_name });
    const period = await googleDrive.getPeriod(req.params.id);
    const stats = await googleSheets.getPeriodStats(req.params.id);
    res.json({ ...period, ...stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/batches/:id', async (req, res) => {
  try {
    await googleDrive.deletePeriod(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy receipts endpoints
app.get('/api/receipts', async (req, res) => {
  try {
    const { batch_id, orderBy } = req.query;
    if (!batch_id) {
      return res.status(400).json({ error: 'batch_id query param required' });
    }
    const receipts = await googleSheets.getReceipts(batch_id);
    
    if (orderBy) {
      const descending = orderBy.startsWith('-');
      const field = descending ? orderBy.slice(1) : orderBy;
      receipts.sort((a, b) => {
        const aVal = a[field] || '';
        const bVal = b[field] || '';
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return descending ? -cmp : cmp;
      });
    }
    
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/receipts', async (req, res) => {
  try {
    const { batch_id, ...data } = req.body;
    if (!batch_id) {
      return res.status(400).json({ error: 'batch_id is required' });
    }
    const receipt = await googleSheets.addReceipt(batch_id, data);
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/receipts/:id', async (req, res) => {
  try {
    const { batch_id, ...data } = req.body;
    if (!batch_id) {
      return res.status(400).json({ error: 'batch_id is required' });
    }
    const receipt = await googleSheets.updateReceipt(batch_id, req.params.id, data);
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/receipts/:id', async (req, res) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) {
      return res.status(400).json({ error: 'batch_id query param required' });
    }
    await googleSheets.deleteReceipt(batch_id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATIC FILES & SPA ROUTING
// ============================================

const distPath = path.resolve(__dirname, process.env.NODE_ENV === 'production' ? './dist' : '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.url.startsWith('/api')) {
      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Index file not found');
      }
    } else {
      next();
    }
  });
} else {
  console.log('Warning: ../dist directory not found. Run "npm run build" for production.');
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
