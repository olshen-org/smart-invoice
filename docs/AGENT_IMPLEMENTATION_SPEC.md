# Smart Invoice – Agent Implementation Spec

> **For:** Claude Code or any coding agent
> **Goal:** Implement the client session + grocery receipt AI workflow on top of the existing running app
> **Dev mode:** `npm run dev` (Vite, port 5173) + `node server/index.js` (Express, port 3000)
> **Stack:** React 18 + Vite + TailwindCSS + shadcn/ui + Express + Google Sheets/Drive + Vertex AI Gemini
> **Language:** All UI text in Hebrew (RTL). Code in English.

---

## Current State (What Already Works)

- Periods (batches) stored as Google Spreadsheets in Drive
- Receipts stored as rows in each spreadsheet (columns A–P, see `server/lib/googleSheets.js`)
- Gemini AI extraction via `POST /api/process-receipt`
- Full UI: Dashboard → Batches → BatchDetails → ReceiptReviewModal
- PDF report generation (`BatchReport.jsx`)
- Auth via Google OAuth (`server/lib/googleAuth.js`)
- API client: `src/lib/apiClient.js` — `api.entities.Batch`, `api.entities.Receipt`, `api.integrations`

**Known issue:** The codebase assumes at most one "active" open period. Adding client sessions breaks this assumption.

---

## What to Build (Prioritised)

### Phase 1 — Period Types (prerequisite for everything else)
### Phase 2 — Vertex AI upgrade (Gemini 3 Flash)
### Phase 3 — Client Session UI (the grocery receipt agent flow)
### Phase 4 — VAT Classification Engine

---

## Phase 1: Period Types

### 1.1 Data Model Change

Each period (Google Spreadsheet) gets a `type` metadata field stored in the spreadsheet's **App Properties** via the Drive API.

**Period types:**
- `"personal"` — the accountant's own monthly expenses. Always exactly one open at a time. Existing periods are implicitly `personal`.
- `"client"` — a scratchpad session for processing a client's receipts. Multiple can be open simultaneously. Has a `client_name`.

#### File: `server/lib/googleDrive.js`

Add to `createPeriodSheet(name, options = {})`:

```js
// options: { type: 'personal' | 'client', client_name: string }
const type = options.type || 'personal';
const clientName = options.client_name || '';

// After creating the spreadsheet, set app properties:
await drive.files.update({
  fileId: newFileId,
  requestBody: {
    appProperties: {
      period_type: type,
      client_name: clientName,
    }
  }
});
```

Update `listPeriods()` to include `appProperties` in the fields query:

```js
fields: 'files(id, name, createdTime, modifiedTime, appProperties)',
```

Map the response to include `type` and `client_name`:

```js
return response.data.files.map(file => ({
  id: file.id,
  batch_name: file.name,
  type: file.appProperties?.period_type || 'personal',
  client_name: file.appProperties?.client_name || '',
  created_date: file.createdTime,
  updated_date: file.modifiedTime,
  status: 'open',
  lifecycle_stage: 'collecting',
}));
```

Do the same for `getPeriod(fileId)`.

Add `renamePeriod` to also accept `appProperties` update if `options.client_name` is passed.

#### File: `server/index.js`

Update `POST /api/periods` to accept and pass `type` and `client_name`:

```js
app.post('/api/periods', async (req, res) => {
  const { batch_name, type = 'personal', client_name = '' } = req.body;
  const period = await googleDrive.createPeriodSheet(batch_name, { type, client_name });
  res.json(period);
});
```

### 1.2 Frontend: CreateBatchDialog

**File:** `src/components/batches/CreateBatchDialog.jsx`

Add a **type selector** at the top of the form:

```jsx
// Add to form state:
const [periodType, setPeriodType] = useState('personal');
const [clientName, setClientName] = useState('');

// UI: two big toggle buttons before all other fields
<div className="grid grid-cols-2 gap-3 mb-4">
  <button
    type="button"
    onClick={() => setPeriodType('personal')}
    className={cn(
      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all",
      periodType === 'personal'
        ? "border-blue-500 bg-blue-50 text-blue-700"
        : "border-gray-200 text-gray-500 hover:border-gray-300"
    )}
  >
    <span className="text-2xl">🏠</span>
    <span>הוצאות אישיות</span>
    <span className="text-xs font-normal text-gray-400">חודשי רגיל</span>
  </button>
  <button
    type="button"
    onClick={() => setPeriodType('client')}
    className={cn(
      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all",
      periodType === 'client'
        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
        : "border-gray-200 text-gray-500 hover:border-gray-300"
    )}
  >
    <span className="text-2xl">👤</span>
    <span>סשן לקוח</span>
    <span className="text-xs font-normal text-gray-400">קבלות לקוח</span>
  </button>
</div>

{/* Show client name field only for client type */}
{periodType === 'client' && (
  <div className="mb-4">
    <Label>שם לקוח *</Label>
    <Input
      value={clientName}
      onChange={e => setClientName(e.target.value)}
      placeholder="לדוגמה: כהן משפחה"
      required
    />
  </div>
)}
```

Pass to API call:

```js
await api.entities.Batch.create({
  batch_name: formData.batch_name,
  type: periodType,
  client_name: clientName,
  // ...rest of fields
});
```

### 1.3 Frontend: Batch List Display

**File:** `src/pages/Batches.jsx`

Show a `👤` chip on client periods and a `🏠` chip on personal periods in `BatchCard`.
Group the list: personal periods first, then client sessions.

**File:** `src/components/batches/BatchCard.jsx`

```jsx
// Add type badge in the card header area
{batch.type === 'client' && (
  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
    👤 {batch.client_name || 'לקוח'}
  </span>
)}
{batch.type === 'personal' && (
  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
    🏠 אישי
  </span>
)}
```

### 1.4 Fix the "Default Open Period" Assumption

**File:** `src/pages/Dashboard.jsx`

Current code auto-redirects to the first active batch. Fix to only auto-redirect to the **personal** period, and show a separate card list for open client sessions:

```jsx
const personalBatch = batches?.find(b => b.type === 'personal' && b.status !== 'completed');
const clientSessions = batches?.filter(b => b.type === 'client' && b.status !== 'completed') || [];

// Auto-redirect only for personal:
useEffect(() => {
  if (personalBatch) navigate(createPageUrl('BatchDetails') + `?id=${personalBatch.id}`);
}, [personalBatch]);

// Show client sessions separately on dashboard
```

---

## Phase 2: Vertex AI Upgrade

**Replace** the current `@google/generative-ai` (deprecated) with direct Vertex AI REST calls.

### 2.1 Environment Variables

Ensure `.env` has:

```
VERTEX_PROJECT_ID=smart-invoice-olsh
VERTEX_LOCATION=global
VERTEX_ACCESS_TOKEN=<token from gcloud auth print-access-token>
GEMINI_MODEL=google/gemini-3-flash-preview
```

> **Note on token refresh:** Vertex AI OAuth tokens expire. In production, use a service account with `GOOGLE_APPLICATION_CREDENTIALS`. For dev, refresh with: `gcloud auth print-access-token`.

### 2.2 New Extraction Module

**Create:** `server/lib/geminiExtract.js`

```js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const PROJECT  = process.env.VERTEX_PROJECT_ID;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const TOKEN    = process.env.VERTEX_ACCESS_TOKEN;
const MODEL    = process.env.GEMINI_MODEL || 'google/gemini-3-flash-preview';

// 'global' uses non-regional host
const API_HOST = LOCATION === 'global'
  ? 'aiplatform.googleapis.com'
  : `${LOCATION}-aiplatform.googleapis.com`;

const [publisher, modelId] = MODEL.split('/');
const ENDPOINT =
  `https://${API_HOST}/v1/projects/${PROJECT}` +
  `/locations/${LOCATION}/publishers/${publisher}` +
  `/models/${modelId}:generateContent`;

const HEBREW_EXTRACTION_PROMPT = `
אנא נתח את הקבלה הזו ותחלץ את כל המידע.

כללים חשובים:
- שמור טקסט עברי בעברית – אל תתרגם לאנגלית
- זהה כל שורת פריט, כולל הנחות (מספר שלילי) ופיקדונות
- אם יש שורות מסומנות עם מרקר/הדגשה צהובה – סמן marked: true
- לכל פריט נסה לזהות אם הוא ירק/פרי טרי לפי שמו (possibly_exempt)
- ברקוד: ספרות בלבד
- vat_rate ברירת מחדל: 0.18 (18%)

החזר JSON תקין בלבד, ללא markdown ובלי טקסט נוסף:
{
  "store_name": "",
  "store_address": "",
  "date": "YYYY-MM-DD",
  "receipt_number": "",
  "total_amount": 0.00,
  "currency": "ILS",
  "line_items": [
    {
      "name": "",
      "barcode": "",
      "quantity": 1,
      "unit_price": 0.00,
      "total": 0.00,
      "row_type": "item|discount|deposit",
      "marked": false,
      "possibly_exempt": false,
      "confidence": "high|medium|low"
    }
  ]
}
`.trim();

async function extractReceipt(imageBuffer, mimeType) {
  const b64 = imageBuffer.toString('base64');

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: b64 } },
        { text: HEBREW_EXTRACTION_PROMPT }
      ]
    }],
    generationConfig: {
      temperature: 0.05,
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
    throw new Error(`Vertex AI ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  // Strip markdown fences if model wrapped response
  const clean = raw.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim();
  return JSON.parse(clean);
}

module.exports = { extractReceipt };
```

### 2.3 Update `server/index.js`

Replace the existing `POST /api/process-receipt` handler:

```js
const { extractReceipt } = require('./lib/geminiExtract');

app.post('/api/process-receipt', upload.single('file'), async (req, res) => {
  try {
    let imageBuffer, mimeType;

    if (req.file) {
      imageBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body.file_url) {
      // Fetch from Drive proxy
      const driveRes = await fetch(req.body.file_url);
      imageBuffer = Buffer.from(await driveRes.arrayBuffer());
      mimeType = driveRes.headers.get('content-type') || 'image/jpeg';
    } else {
      return res.status(400).json({ error: 'file or file_url required' });
    }

    const extracted = await extractReceipt(imageBuffer, mimeType);
    res.json(extracted);
  } catch (err) {
    console.error('Extraction error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
```

> **Keep** the existing GEMINI_API_KEY fallback if VERTEX_ACCESS_TOKEN is not set, so the app still works for users without Vertex.

---

## Phase 3: Client Session UI

This is the main new feature. A client session is a special BatchDetails view with an **agent panel** for processing grocery receipts.

### 3.1 Route

No new route needed. Reuse `BatchDetails`. Add detection: if `batch.type === 'client'`, render `ClientSessionView` instead of the default receipt list.

**File:** `src/pages/BatchDetails.jsx`

```jsx
// At the top of the component, after loading the batch:
if (batch?.type === 'client') {
  return <ClientSessionView batch={batch} />;
}
// ...existing personal BatchDetails render
```

### 3.2 New Component: `ClientSessionView`

**Create:** `src/components/batch-details/ClientSessionView.jsx`

This is the main new component. It has three visual areas:

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: client name, session status, totals bar             │
├──────────────────┬──────────────────────────────────────────┤
│ LEFT PANEL       │ MAIN TABLE                               │
│ - Upload area    │ - Items from all receipts in this session│
│ - Receipt list   │ - VAT classification per item            │
│   (thumbnails)   │ - Flagged items highlighted              │
│ - Agent messages │ - Editable VAT pills                     │
│ - VAT summary    │ - Inline quantity/price edit             │
└──────────────────┴──────────────────────────────────────────┘
```

#### State Management

```jsx
const [sessionReceipts, setSessionReceipts] = useState([]); // array of {id, file_url, extracted, status}
const [allItems, setAllItems] = useState([]);   // flattened from all receipts
const [agentMessages, setAgentMessages] = useState([]);
const [isProcessing, setIsProcessing] = useState(false);
```

#### Upload Flow

```jsx
async function handleUpload(file) {
  setIsProcessing(true);
  addAgentMessage(`מעבד קבלה ${sessionReceipts.length + 1}...`);

  // 1. Upload to Drive
  const { file_url } = await api.integrations.Core.UploadFile({ file });

  // 2. Extract via Gemini
  const extracted = await api.integrations.Core.InvokeLLM({
    file_urls: [file_url],
    prompt: null  // server uses default Hebrew prompt
  });

  // 3. Run VAT classification on extracted items
  const classified = classifyVATItems(extracted.line_items || []);

  // 4. Add to session
  const receipt = { id: nanoid(), file_url, extracted, items: classified, status: 'pending' };
  setSessionReceipts(prev => [...prev, receipt]);
  setAllItems(prev => mergeItems(prev, classified, receipt.id));

  // 5. Report to agent
  const flaggedCount = classified.filter(i => i.vat_status === 'flag').length;
  const unreadCount  = classified.filter(i => i.confidence === 'low').length;
  addAgentMessage(
    `נמצאו ${classified.length} פריטים. ` +
    (flaggedCount ? `⚠️ ${flaggedCount} לבדיקה. ` : '') +
    (unreadCount ? `📷 ${unreadCount} לא נקראו. ` : '') +
    `מע"מ מחושב: ₪${calcVAT(classified).toFixed(2)}`
  );

  setIsProcessing(false);
}
```

#### VAT Classification Function

**Create:** `src/lib/vatClassifier.js`

```js
const VAT_RATE = 0.18;

// Hebrew patterns for 0% VAT items (fresh produce under Israeli law)
const EXEMPT_PATTERNS = [
  /^עגבני/,        // tomatoes (unless: קופסא, מרוסקות, שימורים)
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

  // Model explicitly flagged as possibly exempt
  const modelSaysExempt = item.possibly_exempt === true;
  const patternSaysExempt = EXEMPT_PATTERNS.some(p => p.test(name));
  const hasOverride = TAXABLE_OVERRIDE.some(p => p.test(name));

  if ((modelSaysExempt || patternSaysExempt) && !hasOverride) {
    return {
      ...item,
      vat_status: 'flag',                 // needs human confirmation
      flag_reason: 'ייתכן פטור – ירק/פרי טרי',
      pre_vat: total,
      vat_amount: 0,
    };
  }

  const pre_vat   = +(total / (1 + VAT_RATE)).toFixed(2);
  const vat_amount = +(total - pre_vat).toFixed(2);

  return {
    ...item,
    vat_status: 'taxable',
    pre_vat:    item.total < 0 ? -pre_vat   : pre_vat,
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
    if (item.vat_status === 'taxable') { taxableBase += item.pre_vat; vatTotal += item.vat_amount; }
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
```

#### Items Table Component

**Create:** `src/components/batch-details/SessionItemsTable.jsx`

The table renders all `allItems` (merged from all receipts in session).

Columns: `#` | `פריט` | `כמות` | `מחיר יח'` | `סה"כ` | `מע"מ` | `לפני מע"מ` | `סכום מע"מ` | `ביטחון`

Row styling rules:
- `vat_status === 'flag'` → yellow left border + amber background `bg-amber-50 border-l-4 border-amber-400`
- `confidence === 'low'` → red left border `border-l-4 border-red-300 bg-red-50`
- `row_type === 'discount'` → muted gray text, italic
- `row_type === 'deposit'` → muted gray text

VAT pill is a **clickable** 3-state toggle per item:
- `flag` → amber pill `❓ בדיקה` (click → cycles to 18% or 0%)
- `taxable` → blue pill `18%`
- `exempt` → green pill `0% פטור`

When pill is toggled, update `allItems` state and recalculate session summary.

```jsx
function VATToggle({ item, onUpdate }) {
  const states = ['flag', 'taxable', 'exempt'];
  const labels = { flag: '❓ בדיקה', taxable: '18%', exempt: '0% פטור' };
  const styles = {
    flag:    'bg-amber-100 text-amber-800 border border-amber-300',
    taxable: 'bg-blue-100 text-blue-800 border border-blue-300',
    exempt:  'bg-emerald-100 text-emerald-800 border border-emerald-300',
  };

  function next() {
    const idx = states.indexOf(item.vat_status);
    const newStatus = states[(idx + 1) % states.length];
    const reclassified = newStatus === 'taxable'
      ? { ...item, vat_status: 'taxable', pre_vat: +(Math.abs(item.total)/1.18).toFixed(2), vat_amount: +(Math.abs(item.total) - Math.abs(item.total)/1.18).toFixed(2) }
      : { ...item, vat_status: newStatus, pre_vat: Math.abs(item.total), vat_amount: 0 };
    onUpdate(reclassified);
  }

  return (
    <button
      onClick={item.row_type === 'item' ? next : undefined}
      className={`text-xs font-bold px-2 py-1 rounded-full ${styles[item.vat_status]} ${item.row_type !== 'item' ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
    >
      {labels[item.vat_status] || '—'}
    </button>
  );
}
```

#### Agent Messages Panel

```jsx
function AgentPanel({ messages }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-3">
      <div className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-2">
        🤖 סוכן החשבונית
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className="text-xs text-slate-600 leading-relaxed">{msg}</div>
        ))}
      </div>
    </div>
  );
}
```

#### Session Summary Bar

A sticky totals bar (like the existing `StickyTotalsBar`) showing:

```
[חייב מע"מ: ₪XXX] [מע"מ 18%: ₪XX] [פטור: ₪XX] [לבדיקה: ₪XX (N פריטים)]
```

### 3.3 Marked Lines Detection

The existing `extractReceipt` in `geminiExtract.js` already asks Gemini to return `marked: true` on highlighted lines.

In `SessionItemsTable`, show a small yellow dot `●` next to items where `item.marked === true`:

```jsx
{item.marked && (
  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-1" title="מסומן בקבלה" />
)}
```

When a receipt has marked items, show an agent message:
```
`זוהו ${markedCount} שורות מסומנות בקבלה. מוצגות בצהוב.`
```

If no marked items were found:
```
`לא זוהה סימון מרקר — כל שורות הקבלה עובדו.`
```

### 3.4 Session Commit

When the user clicks **"אשרי וסגרי סשן"**:

1. For each item in `allItems` with `row_type === 'item'` and `vat_status !== 'flag'`, create a receipt record via `api.entities.Receipt.create(...)` grouped by source receipt ID.
2. Update batch `status` to `'completed'`, `lifecycle_stage` to `'completed'`.
3. Navigate to the `BatchReport` view for PDF generation.

```jsx
async function commitSession() {
  // Group items by receipt_source_id
  const byReceipt = groupBy(allItems, 'receipt_source_id');

  for (const [sourceId, items] of Object.entries(byReceipt)) {
    const src = sessionReceipts.find(r => r.id === sourceId);
    const approvedItems = items.filter(i => i.vat_status !== 'flag' && i.row_type === 'item');

    const total = approvedItems.reduce((sum, i) => sum + i.total, 0);
    const vatAmount = approvedItems.reduce((sum, i) => sum + (i.vat_amount || 0), 0);

    await api.entities.Receipt.create({
      batch_id: batch.id,
      vendor_name: src.extracted.store_name,
      date: src.extracted.date,
      total_amount: total,
      vat_amount: vatAmount,
      status: 'approved',
      type: 'expense',
      receipt_image_url: src.file_url,
      line_items: approvedItems,
    });
  }

  // Mark batch as completed
  await api.entities.Batch.update(batch.id, {
    status: 'completed',
    lifecycle_stage: 'completed',
  });

  // Show report
  navigate(createPageUrl('BatchDetails') + `?id=${batch.id}&report=1`);
}
```

---

## Phase 4: VAT Classification — Edge Cases

### 4.1 Web Search Fallback (Optional Enhancement)

For items flagged as uncertain, add an **"בדוק אונליין"** button per row that calls a new server endpoint:

**New endpoint:** `POST /api/classify-vat`

```js
app.post('/api/classify-vat', async (req, res) => {
  const { item_name } = req.body;

  const prompt = `
האם הפריט הבא חייב במע"מ בישראל (18%) או פטור ממע"מ (0% - פרי/ירק טרי)?
פריט: "${item_name}"
ענה JSON בלבד: {"vat_rate": 0 או 0.18, "reason": "הסבר קצר בעברית", "confidence": "high|medium|low"}
  `.trim();

  const { extractReceipt } = require('./lib/geminiExtract');
  // Re-use Gemini but with text-only prompt (no image)
  // Call with a 1x1 transparent pixel to satisfy image requirement, or use text-only API
  res.json(await classifyWithGemini(prompt));
});
```

In `SessionItemsTable`, add a small 🔍 button on flagged rows that calls this endpoint and auto-updates the pill.

### 4.2 Session-level Learning

Within a session, if the user resolves a flag (e.g., marks "עגבניות קצוצות" as 18%), remember that decision and auto-apply to identical item names in subsequent receipts in the same session.

```js
// In ClientSessionView state:
const [vatOverrides, setVatOverrides] = useState({}); // { "עגבניות קצוצות": "taxable" }

function handleVATUpdate(item, newStatus) {
  setVatOverrides(prev => ({ ...prev, [item.name]: newStatus }));
  // Apply override to all matching items
  setAllItems(prev => prev.map(i =>
    i.name === item.name && i.row_type === 'item'
      ? { ...i, vat_status: newStatus }
      : i
  ));
}
```

---

## File Change Summary

### New files to create:
| File | Purpose |
|------|---------|
| `src/components/batch-details/ClientSessionView.jsx` | Main client session UI |
| `src/components/batch-details/SessionItemsTable.jsx` | Interactive items table with VAT toggles |
| `src/lib/vatClassifier.js` | VAT classification logic |
| `server/lib/geminiExtract.js` | Vertex AI extraction module |

### Files to modify:
| File | Change |
|------|--------|
| `server/lib/googleDrive.js` | Add `type` + `client_name` via appProperties |
| `server/index.js` | Accept `type`/`client_name` in POST /api/periods; swap extraction to geminiExtract.js |
| `src/components/batches/CreateBatchDialog.jsx` | Add personal/client type selector |
| `src/components/batches/BatchCard.jsx` | Show type badge |
| `src/pages/Dashboard.jsx` | Fix default period assumption; separate personal/client |
| `src/pages/BatchDetails.jsx` | Route to ClientSessionView if type==='client' |
| `.env` | Add VERTEX_PROJECT_ID, VERTEX_LOCATION, VERTEX_ACCESS_TOKEN, GEMINI_MODEL |

---

## Environment Setup

`.env` in project root (already created):

```
VERTEX_PROJECT_ID=smart-invoice-olsh
VERTEX_LOCATION=global
VERTEX_ACCESS_TOKEN=<run: gcloud auth print-access-token>
GEMINI_MODEL=google/gemini-3-flash-preview

# Existing (keep):
GOOGLE_ROOT_FOLDER_ID=<drive folder id>
GOOGLE_FILES_FOLDER_ID=<drive folder id>
```

> Token refresh: `VERTEX_ACCESS_TOKEN` lasts ~1 hour. For long dev sessions, create a helper:
> `node -e "require('./server/lib/geminiExtract'); console.log('endpoint:', ENDPOINT)"`
> Or configure a service account key and use `google-auth-library` for auto-refresh.

---

## Dev Run Commands

```bash
# Terminal 1 – backend
node server/index.js

# Terminal 2 – frontend
npm run dev

# Test extraction directly
node scripts/extract-receipt.js /path/to/receipt.jpg
```

---

## Important Design Constraints

1. **Hebrew everywhere in UI.** All labels, messages, agent output — in Hebrew. Code in English.
2. **No blind automation.** The agent presents results, the user approves. `commitSession()` is only called on explicit user action.
3. **Scratchpad nature of client sessions.** Do not auto-save anything until the user clicks commit. All state lives in React until that point.
4. **Graceful degradation.** If Vertex AI token is missing or expired, fall back to the existing `GEMINI_API_KEY` extraction path. Show a warning in the UI but don't break.
5. **RTL layout.** Use `dir="rtl"` on containers. Tailwind classes work correctly with RTL when using `ltr:` prefix for LTR overrides (e.g., numbers, barcodes).
6. **shadcn/ui components only.** Use existing components from `src/components/ui/`. Do not add new UI libraries.
7. **Existing receipt flow unchanged.** The personal period BatchDetails view should remain exactly as it is today.
