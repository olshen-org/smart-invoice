# Receipt Management App

A receipt management application for tracking and processing receipts in batches.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser** to the URL shown (usually `http://localhost:5173`)

## 📋 Features

- **Dashboard**: View all receipts with statistics
- **Batches**: Organize receipts into batches
- **Upload**: Upload and process receipts with AI extraction
- **Batch Details**: Review and approve/reject receipts in batches

## 🏗️ Architecture

This app has been migrated from Base44 to use local storage for development. See `MIGRATION.md` for details.

### Local Development
- Data is stored in browser localStorage
- Mock authentication (auto-login)
- Mock LLM integration (returns sample data)

### Production Migration
See `MIGRATION.md` for steps to migrate to your own backend infrastructure.

## 📁 Project Structure

```
src/
├── api/           # API clients (localClient replaces base44)
├── components/    # React components
├── pages/         # Page components
├── lib/           # Utilities and contexts
└── utils/         # Helper functions
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

## 📝 Notes

- All data persists in browser localStorage
- Clear localStorage in DevTools to reset data
- The LLM integration currently returns mock data - replace with your API in production
