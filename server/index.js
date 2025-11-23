const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://sqeduciomhmlnuukbwwe.supabase.co';
const supabaseKey = process.env.SUPABASE_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseKey) {
  console.warn("Warning: SUPABASE_API_KEY is not set!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

// API Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  console.log('Received upload request');
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    console.log(`Uploading ${fileName} to Supabase Storage bucket 'receipts'...`);

    const { data, error } = await supabase
      .storage
      .from('receipts')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('receipts')
      .getPublicUrl(fileName);

    console.log(`Upload successful. Public URL: ${publicUrl}`);
    res.json({ file_url: publicUrl, file_path: data.path });

  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: 'Failed to upload file to storage' });
  }
});

app.post('/api/process-receipt', upload.single('file'), async (req, res) => {
  console.log('Received receipt processing request');
  let imagePart;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    if (req.file) {
      imagePart = {
        inlineData: {
          data: req.file.buffer.toString('base64'),
          mimeType: req.file.mimetype
        },
      };
    } else if (req.body.file_url) {
      const fetchRes = await fetch(req.body.file_url);
      if (!fetchRes.ok) throw new Error('Failed to fetch image from URL');
      const buffer = Buffer.from(await fetchRes.arrayBuffer());
      imagePart = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: fetchRes.headers.get('content-type') || 'image/jpeg'
        },
      };
    } else {
      return res.status(400).json({ error: 'No file or file_url provided' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    
    const prompt = req.body.prompt || "Extract data from this receipt and return ONLY valid JSON.";
    
    console.log('Calling Gemini API...');
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let text = response.text();
    console.log('Gemini raw response:', text.substring(0, 200));
    
    // Clean up markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
    
    try {
      const jsonResponse = JSON.parse(text);
      console.log('Successfully parsed JSON response');
      res.json(jsonResponse);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", text);
      res.status(500).json({ 
        error: "Failed to parse JSON from Gemini", 
        raw_response: text.substring(0, 500)
      });
    }
  } catch (error) {
    console.error('Error processing receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the React app build directory
// This allows the Express server to serve the frontend as well
// In Docker, dist is at ./dist, in local dev it's at ../dist
const distPath = path.resolve(__dirname, process.env.NODE_ENV === 'production' ? './dist' : '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Catch-all route to serve index.html for client-side routing
  // Express 5.x requires a regex or specific format for catch-all
  app.use((req, res, next) => {
    // Only handle GET requests that are not API calls
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
  console.log('Warning: ../dist directory not found. Ensure you have run "npm run build".');
  console.log('In development, run "npm run dev" separately for the frontend.');
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
