# Smart Invoice (חשבונית חכמה) - Complete Project Recreation Prompt

## Overview

Build a **Hebrew RTL receipt/invoice management web application** for freelancers and small businesses to track income and expenses by period (monthly batches). The app uses AI-powered OCR to extract data from uploaded receipts/invoices and generates tax reports.

**Key Features:**
- Period-based receipt collection ("batches" representing accounting periods like months)
- AI-powered receipt scanning using Google Gemini Vision
- Income vs Expense tracking with VAT calculations
- Batch lifecycle management with automatic reminders
- PDF report generation for accountants
- Mobile-first responsive design with bottom navigation
- Hebrew RTL interface throughout

---

## Tech Stack

### Frontend
- **Framework:** React 18 with Vite
- **Routing:** react-router-dom v6
- **State Management:** TanStack React Query v5
- **UI Components:** Radix UI primitives with shadcn/ui component library
- **Styling:** TailwindCSS with custom CSS variables for theming
- **Charts:** Recharts
- **Date Handling:** date-fns with Hebrew (he) locale
- **PDF Generation:** jsPDF + html2canvas
- **Notifications:** Sonner toast

### Backend
- **Runtime:** Node.js with Express
- **File Upload:** Multer (memory storage)
- **AI/OCR:** Google Generative AI SDK (@google/generative-ai) - Gemini 2.5 Flash
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage for receipt images/PDFs

### Key Dependencies
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.84.0",
    "@tanstack/react-query": "^5.84.1",
    "date-fns": "^3.6.0",
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.2",
    "lucide-react": "^0.475.0",
    "react": "^18.2.0",
    "react-router-dom": "^6.26.0",
    "recharts": "^2.15.4",
    "sonner": "^2.0.1"
  }
}
```

---

## Database Schema (Supabase)

### Table: `batches`
Represents accounting periods (e.g., "January 2025")

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| batch_name | text | - | Display name (e.g., "תקופת ינואר 2025") |
| customer_name | text | null | Optional client name |
| notes | text | null | Batch notes |
| status | text | 'open' | 'open', 'processing', 'completed' |
| lifecycle_stage | text | null | 'draft', 'collecting', 'waiting', 'ready_to_close', 'completed' |
| total_receipts | integer | 0 | Count of receipts |
| processed_receipts | integer | 0 | Count of approved receipts |
| total_amount | numeric | 0 | Sum of all amounts |
| income_total | numeric | null | Sum of income receipts |
| expense_total | numeric | null | Sum of expense receipts |
| period_start | date | null | Period start date |
| period_end | date | null | Period end date |
| period_label | text | null | Hebrew month label |
| last_upload_at | timestamptz | null | Last receipt upload time |
| next_reminder_at | timestamptz | null | Next reminder time |
| finalized_date | date | null | When batch was closed |
| created_date | timestamptz | now() | Created timestamp |
| updated_date | timestamptz | now() | Updated timestamp |

### Table: `receipts`
Individual receipts/invoices

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| batch_id | uuid | null | FK to batches.id |
| vendor_name | text | null | Vendor/client name |
| receipt_number | text | null | Receipt/invoice number |
| date | date | null | Transaction date |
| total_amount | numeric | null | Total including VAT |
| vat_amount | numeric | null | VAT amount |
| currency | text | 'ILS' | Currency code |
| payment_method | text | null | Payment method |
| category | text | null | Category code |
| receipt_image_url | text | null | URL to uploaded image/PDF |
| line_items | jsonb | null | Array of line items |
| status | text | 'pending' | 'pending', 'approved', 'rejected' |
| type | text | 'expense' | 'income' or 'expense' |
| notes | jsonb | '{}' | Additional metadata |
| created_date | timestamptz | now() | Created timestamp |
| updated_date | timestamptz | now() | Updated timestamp |

### Supabase Storage
- Bucket: `receipts` (public access for images/PDFs)

---

## Backend API (Express Server)

### Endpoints

#### `POST /api/upload`
Upload file to Supabase Storage
- Input: multipart/form-data with `file` field
- Output: `{ file_url: string, file_path: string }`

#### `POST /api/process-receipt`
Process receipt image with Gemini AI
- Input: multipart/form-data with `file` OR json with `file_url`, optional `prompt`
- Process: Sends image to Gemini 2.5 Flash with extraction prompt
- Output: Extracted receipt data as JSON

### Gemini Extraction Prompt (Hebrew)
```
אנא נתח את הקבלה או החשבונית הזו ותחלץ את כל המידע הרלוונטי.

חשוב מאוד - שפת המערכת הראשית עברית:
- אל תתרגם לאנגלית טקסט בעברית

חשוב במיוחד:
- זהה את שם העסק/הספק (vendor_name) - בעברית
- מספר קבלה/חשבונית (receipt_number)
- תאריך (date) - בפורמט YYYY-MM-DD בדיוק
- סכום כולל (total_amount) - מספר
- סכום מע"ם (vat_amount) - מספר
- מטבע (currency) - ברירת מחדל ILS
- אמצעי תשלום (payment_method) - בעברית
- קטגוריה (category) - בעברית
- הערות (notes) - כל מידע נוסף
- כל הפריטים/שורות בקבלה (line_items) עם: description, quantity, unit_price, total

חשב את הסכומים הכוללים בדיוק. החזר רק JSON תקין ללא טקסט נוסף.
```

---

## Application Pages & Components

### Pages

#### 1. Dashboard (`/`)
- Shows current active batch with stats (receipts count, income, expenses)
- Stage indicator (draft, collecting, waiting, ready_to_close, completed)
- Quick upload button
- Recent receipts preview (click opens receipt detail modal)
- Previous completed batches list

#### 2. Batches (`/batches`)
- Grid of all batches organized by status
- Create new batch button
- Delete batch functionality
- BatchCard component for each batch

#### 3. BatchDetails (`/batchdetails?id=xxx`)
- Full batch management page
- BatchHeader with stats
- BatchTimeline showing lifecycle stages
- UploadSection with drag-drop support
- ReceiptsGrid organized by status (pending/approved/rejected)
- Bulk actions (select multiple, approve/reject/delete all)
- Report generation and batch closing
- Activity timeline sidebar
- Checklist for closing readiness

### Key Components

#### ReceiptReviewModal
- Full-screen modal for reviewing/editing extracted receipt data
- Toggle between income/expense type
- Edit vendor name, date, category, line items
- VAT calculation with adjustable percentage
- Image/PDF preview (Google Docs viewer for PDFs)
- Approve/Reject buttons

#### BatchReport
- Generates PDF report with:
  - Summary cards (income, expenses, profit)
  - VAT summary (collected vs paid, net VAT to pay)
  - Expense breakdown pie chart
  - Transaction details table
- Print and PDF download functionality

#### CreateBatchDialog
- Form for creating new period
- Period name, start/end dates, customer name, notes
- Auto-generates period label from dates

---

## Batch Lifecycle System

### Stages
1. **draft** - Period created, no receipts yet
2. **collecting** - Actively collecting receipts (< 48 hours since last upload)
3. **waiting** - 48+ hours since last upload, prompting for more
4. **ready_to_close** - All receipts approved, ready for report
5. **completed** - Report generated, period closed

### Stage Computation Logic
```javascript
const computeStage = ({ storedStage, status, stats, lastUpload }) => {
  if (status === "completed") return "completed";
  if (stats.total === 0) return "draft";
  if (stats.pending === 0 && stats.total > 0) return "ready_to_close";

  if (lastUpload) {
    const hoursSinceUpload = differenceInHours(new Date(), lastUpload);
    if (hoursSinceUpload >= 48) return "waiting";
  }

  return "collecting";
};
```

### Reminder System
- 48-hour reminder delay after last upload
- Automatic reminder date calculation
- Visual indicators for overdue reminders

---

## UI/UX Design Patterns

### Theme
- Clean, modern Hebrew interface
- Blue primary color (#2563eb range)
- Slate neutral colors
- Soft gradients and shadows
- Rounded corners (1rem radius)
- Rubik font for Hebrew text

### RTL Layout
```css
@layer base {
  * { direction: rtl; }
  body { direction: rtl; }
}
```

### Responsive Design
- Mobile-first approach
- Desktop sidebar navigation (collapsible)
- Mobile bottom navigation bar
- Floating action button on mobile for quick upload
- Safe area padding for iOS

### Color Coding
- **Income:** Green (emerald-600)
- **Expense:** Red/Rose (red-600, slate for neutral)
- **Pending:** Yellow/Amber
- **Approved:** Green
- **Rejected:** Red

---

## Receipt Categories

### Expense Categories
```javascript
const CATEGORIES = [
  { value: "office_supplies", label: "ציוד משרדי" },
  { value: "utilities", label: "שירותים" },
  { value: "travel", label: "נסיעות" },
  { value: "meals", label: "ארוחות" },
  { value: "equipment", label: "ציוד" },
  { value: "services", label: "שירותים מקצועיים" },
  { value: "rent", label: "שכירות" },
  { value: "insurance", label: "ביטוח" },
  { value: "marketing", label: "שיווק" },
  { value: "salary", label: "משכורות" },
  { value: "other", label: "אחר" }
];
```

### Income Categories
```javascript
const INCOME_CATEGORIES = [
  { value: "sales", label: "מכירות" },
  { value: "services", label: "שירותים" },
  { value: "other_income", label: "הכנסה אחרת" }
];
```

---

## Environment Variables

```env
# Backend (.env)
PORT=3000
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_API_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key

# Frontend (built into bundle via vite)
# Uses same Supabase URL with anon key hardcoded in supabaseClient.js
```

---

## Key Business Logic

### VAT Calculation
- Default VAT rate: 17% (Israel)
- VAT collected (from income) vs VAT paid (on expenses)
- Net VAT = VAT collected - VAT paid
- Positive = pay to government, Negative = refund

### Receipt Total Calculation
```javascript
const calculateTotals = () => {
  const itemsTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const vatAmount = itemsTotal * (vatPercent / 100);
  const totalWithVat = itemsTotal + vatAmount;
};
```

### Batch Statistics
```javascript
const enrichBatchLifecycle = (batch, receipts) => {
  const incomeTotal = receipts
    .filter(r => r.type === 'income' && r.status === 'approved')
    .reduce((sum, r) => sum + r.total_amount, 0);

  const expenseTotal = receipts
    .filter(r => r.type !== 'income' && r.status === 'approved')
    .reduce((sum, r) => sum + r.total_amount, 0);

  // ... compute lifecycle_stage, stats, etc.
};
```

---

## File Structure

```
/
├── server/
│   └── index.js          # Express server with API routes
├── src/
│   ├── App.jsx           # Main app with routing
│   ├── Layout.jsx        # Shell with sidebar/bottom nav
│   ├── index.css         # Tailwind + theme variables
│   ├── pages.config.js   # Page registry
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Batches.jsx
│   │   ├── BatchDetails.jsx
│   │   └── Upload.jsx
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   ├── batches/
│   │   │   ├── BatchCard.jsx
│   │   │   └── CreateBatchDialog.jsx
│   │   ├── batch-details/
│   │   │   ├── BatchHeader.jsx
│   │   │   ├── BatchTimeline.jsx
│   │   │   ├── BatchReport.jsx
│   │   │   ├── ReceiptsGrid.jsx
│   │   │   ├── ReceiptReviewModal.jsx
│   │   │   ├── UploadSection.jsx
│   │   │   └── ActivityTimeline.jsx
│   │   └── dashboard/
│   │       └── ReceiptDetailsModal.jsx
│   ├── lib/
│   │   ├── apiClient.js      # Supabase entity operations
│   │   ├── supabaseClient.js # Supabase connection
│   │   ├── batchLifecycle.js # Lifecycle logic
│   │   ├── useReceiptUpload.js # Upload hook
│   │   ├── AuthContext.jsx
│   │   └── query-client.js
│   └── utils/
│       └── index.ts          # createPageUrl helper
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## Implementation Notes

1. **Authentication:** Currently stubbed with mock user. Implement proper Supabase Auth for production.

2. **RLS Policies:** Enable Row Level Security on Supabase tables and configure policies for user isolation.

3. **File Validation:** Add proper file type/size validation on both client and server.

4. **Error Handling:** The extraction can fail - handle gracefully with retry options.

5. **Offline Support:** Consider adding service worker for offline receipt capture.

6. **Multi-tenant:** Current design is single-user. For multi-tenant, add user_id foreign keys.

7. **Exports:** Consider adding CSV/Excel export options alongside PDF.

8. **Tax Integration:** The report calculates estimated tax. Real integration would need proper tax authority APIs.

---

## Setup Instructions

1. Create Supabase project with tables as defined above
2. Create `receipts` storage bucket with public access
3. Get Gemini API key from Google AI Studio
4. Configure environment variables
5. Install dependencies: `npm install` in both root and server/
6. Run frontend: `npm run dev`
7. Run backend: `cd server && npm start`

---

## Hebrew UI Text Reference

Key Hebrew terms used throughout:
- קבלה (Kabala) = Receipt
- חשבונית (Kheshbonit) = Invoice
- הוצאה (Hotza'a) = Expense
- הכנסה (Hakhnasa) = Income
- מע"ם (Ma'am) = VAT
- ספק (Sapak) = Vendor/Supplier
- לקוח (Lakoakh) = Customer/Client
- תקופה (Tkufa) = Period
- כרטיס (Kartis) = Card/Batch (accounting term)
- דוח (Doch) = Report
- אשר (Asher) = Approve
- דחה (Dakheh) = Reject
