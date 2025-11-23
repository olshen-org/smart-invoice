# Smart Invoice - חשבונית חכמה

A receipt management application for tracking and processing receipts in batches with AI-powered data extraction.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account (for database and storage)
- Google Gemini API key (for receipt extraction)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_API_KEY=your_supabase_anon_key
   ```

3. **Start the backend server:**
   ```bash
   node server/index.js
   ```

4. **Start the development server (in another terminal):**
   ```bash
   npm run dev
   ```

5. **Open your browser** to `http://localhost:5173`

## 📋 Features

- **Dashboard**: View all receipts with statistics and summaries
- **Batches**: Organize receipts into batches for different clients/projects
- **AI Upload**: Upload receipt images/PDFs with automatic data extraction using Google Gemini
- **Review & Approve**: Review extracted data, edit if needed, and approve/reject receipts
- **Bulk Operations**: Select multiple receipts for batch approval/rejection/deletion

## 🏗️ Architecture

### Frontend
- **React** with Vite for fast development
- **TailwindCSS** + **shadcn/ui** for styling
- **React Query** for data fetching and caching
- **React Router** for navigation

### Backend
- **Express.js** server for file uploads and AI processing
- **Supabase** for PostgreSQL database and file storage
- **Google Gemini AI** (gemini-2.5-flash) for receipt OCR and data extraction

### Database Tables
- `batches` - Receipt batches with metadata
- `receipts` - Individual receipts with extracted data

### Deployment
- Docker containerization with multi-stage builds
- GitHub Actions CI/CD to infraworks.net
- Knative serving on GKE

## 📁 Project Structure

```
src/
├── api/              # API client (apiClient.js, localClient.js)
├── components/       # React components
├── pages/            # Page components (Dashboard, Batches, Upload, etc.)
├── hooks/            # Custom React hooks (useReceiptUpload)
├── lib/              # Utilities and contexts (AuthContext, etc.)
└── utils/            # Helper functions

server/
└── index.js          # Express backend server

.github/workflows/    # GitHub Actions for deployment
```

## 🔧 Available Scripts

- `npm run dev` - Start frontend development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm start` - Start backend server (production)
- `npm run server` - Start backend server (development)

## 🐳 Docker

Build and run with Docker:
```bash
docker build -t smart-invoice .
docker run -p 3000:3000 --env-file .env smart-invoice
```

## 📝 Notes

- All data is stored in Supabase (PostgreSQL)
- File uploads are stored in Supabase Storage
- Receipt extraction uses Google Gemini AI for accurate OCR
- Hebrew language support (RTL layout)
