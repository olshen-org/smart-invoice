/**
 * Smart Invoice – Receipt Extraction via Vertex AI (Gemini)
 * ---------------------------------------------------------
 * Sends a receipt image to Vertex AI Gemini and returns
 * structured JSON with per-item VAT classification.
 *
 * Usage:
 *   node scripts/extract-receipt.js <image_path>
 *
 * Env vars required (add to .env):
 *   VERTEX_PROJECT_ID=your-gcp-project-id
 *   VERTEX_LOCATION=us-central1          (or europe-west1 etc.)
 *   VERTEX_ACCESS_TOKEN=AQ.Ab8RN6...     (your OAuth token)
 *   GEMINI_MODEL=google/gemini-3-flash-preview
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');

const PROJECT  = process.env.VERTEX_PROJECT_ID;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const TOKEN    = process.env.VERTEX_ACCESS_TOKEN;
const MODEL    = process.env.GEMINI_MODEL || 'google/gemini-3-flash-preview';

// ── Vertex AI endpoint ───────────────────────────────────────────────────────
// 'global' uses the non-regional host; all other locations use {region}-aiplatform
const API_HOST = LOCATION === 'global'
  ? 'aiplatform.googleapis.com'
  : `${LOCATION}-aiplatform.googleapis.com`;

const [publisher, modelId] = MODEL.split('/');
const ENDPOINT =
  `https://${API_HOST}/v1/projects/${PROJECT}` +
  `/locations/${LOCATION}/publishers/${publisher}` +
  `/models/${modelId}:generateContent`;

// ── Extraction prompt (Hebrew-first) ─────────────────────────────────────────
const EXTRACTION_PROMPT = `
אנא נתח את הקבלה הזו ותחלץ את כל המידע הרלוונטי.

חשוב מאוד:
- שמור טקסט עברי בעברית – אל תתרגם
- זהה כל שורה בקבלה, כולל הנחות ופיקדונות
- אם יש שורות מסומנות עם מרקר/הדגשה – סמן marked: true
- עבור כל פריט: נסה לזהות האם הוא ירק/פרי טרי (vat_exempt: true) לפי שם הפריט

החזר JSON תקין בלבד, ללא טקסט נוסף:
{
  "store_name": "שם העסק",
  "date": "YYYY-MM-DD",
  "receipt_number": "מספר קבלה",
  "total_amount": 0.00,
  "currency": "ILS",
  "line_items": [
    {
      "name": "שם פריט בעברית",
      "barcode": "ברקוד אם קיים",
      "quantity": 1,
      "unit_price": 0.00,
      "total": 0.00,
      "row_type": "item | discount | deposit",
      "marked": false,
      "vat_exempt": false,
      "confidence": "high | medium | low"
    }
  ]
}
`.trim();

// ── VAT classifier (post-processing) ─────────────────────────────────────────
const VAT_RATE = 0.18;

// Known 0% VAT patterns (fresh produce in Israel)
const EXEMPT_PATTERNS = [
  /עגבני/,     // tomatoes (fresh)
  /מלפפון/,    // cucumber
  /גזר/,       // carrot
  /תפוח/,      // apple
  /בננ/,       // banana
  /לימון/,     // lemon
  /תפוז/,      // orange
  /ענב/,       // grapes
  /אבטיח/,     // watermelon
  /מלון/,      // melon
  /תות/,       // strawberry
  /אבוקד/,     // avocado
  /פלפל.*טרי/, // fresh pepper
  /חסה/,       // lettuce
  /כרוב/,      // cabbage
  /פטריות.*טרי/, // fresh mushrooms
  /ירק/,       // generic vegetable
  /פרי.*טרי/,  // fresh fruit
];

// Patterns that OVERRIDE exempt (processed versions)
const TAXABLE_OVERRIDE = [
  /קופסא/,     // canned
  /שימור/,     // preserved
  /מיץ/,       // juice (processed)
  /רוטב/,      // sauce
  /קצוצות.*קופסא/, // canned chopped
  /מוקפא/,     // frozen
];

function classifyVAT(item) {
  if (item.row_type !== 'item') return { vat_rate: 0, vat_amount: 0, pre_vat: item.total, classification: 'N/A' };
  if (item.vat_exempt) return { vat_rate: 0, vat_amount: 0, pre_vat: item.total, classification: 'פטור – פרי/ירק טרי' };

  const name = item.name || '';

  // Check if model flagged as exempt
  const looksExempt = EXEMPT_PATTERNS.some(p => p.test(name));
  const hasOverride  = TAXABLE_OVERRIDE.some(p => p.test(name));

  if (looksExempt && !hasOverride) {
    return { vat_rate: 0, vat_amount: 0, pre_vat: item.total, classification: 'פטור – אולי ירק/פרי טרי', flag: true };
  }

  const total    = Math.abs(item.total || 0);
  const pre_vat  = +(total / (1 + VAT_RATE)).toFixed(2);
  const vat_amt  = +(total - pre_vat).toFixed(2);

  return {
    vat_rate: VAT_RATE,
    vat_amount: item.total < 0 ? -vat_amt : vat_amt,
    pre_vat:    item.total < 0 ? -pre_vat : pre_vat,
    classification: '18%',
    flag: false,
  };
}

function enrichItems(lineItems) {
  return lineItems.map((item, i) => ({
    ...item,
    index: i + 1,
    ...classifyVAT(item),
  }));
}

function summarize(items) {
  let taxable = 0, exempt = 0, totalVAT = 0, flagged = [];
  items.forEach(it => {
    if (it.row_type !== 'item') return;
    if (it.vat_rate === 0 && !it.flag) { exempt += it.total; }
    else if (it.flag) { flagged.push(it.name); taxable += it.total; }
    else { taxable += it.total; totalVAT += it.vat_amount; }
  });
  return { taxable: +taxable.toFixed(2), exempt: +exempt.toFixed(2), totalVAT: +totalVAT.toFixed(2), flagged };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function extractReceipt(imagePath) {
  if (!PROJECT || !TOKEN) {
    throw new Error('Missing VERTEX_PROJECT_ID or VERTEX_ACCESS_TOKEN in .env');
  }

  const ext      = path.extname(imagePath).toLowerCase();
  const mimeMap  = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf', '.heic': 'image/heic' };
  const mimeType = mimeMap[ext] || 'image/jpeg';
  const imgB64   = fs.readFileSync(imagePath).toString('base64');

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: imgB64 } },
        { text: EXTRACTION_PROMPT }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    }
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertex AI error ${res.status}: ${err}`);
  }

  const data   = await res.json();
  const raw    = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  let parsed;
  try {
    // Strip markdown code fences if present
    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Failed to parse Gemini JSON: ${raw.slice(0, 200)}`);
  }

  parsed.line_items = enrichItems(parsed.line_items || []);
  parsed.summary    = summarize(parsed.line_items);

  return parsed;
}

// ── CLI entry ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  const imgPath = process.argv[2];
  if (!imgPath) { console.error('Usage: node extract-receipt.js <image_path>'); process.exit(1); }

  extractReceipt(imgPath)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      const summary = result.summary;
      console.error('\n── Summary ──────────────────────');
      console.error(`Store:      ${result.store_name}`);
      console.error(`Total:      ₪${result.total_amount}`);
      console.error(`Taxable:    ₪${summary.taxable}  →  VAT: ₪${summary.totalVAT}`);
      console.error(`Exempt:     ₪${summary.exempt}`);
      if (summary.flagged.length) console.error(`Flagged:    ${summary.flagged.join(', ')}`);
    })
    .catch(err => { console.error('Error:', err.message); process.exit(1); });
}

module.exports = { extractReceipt, classifyVAT, summarize };
