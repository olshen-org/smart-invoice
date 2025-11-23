# Migration from Base44 to Local Infrastructure

This document describes the migration from Base44 to a local development setup.

## Changes Made

### 1. Removed Base44 Dependencies
- Removed `@base44/vite-plugin` from `vite.config.js`
- The app now uses a local API client instead of the Base44 SDK

### 2. Local API Client
Created `src/api/localClient.js` which provides:
- **Entities**: Local storage-based CRUD operations for Batch and Receipt entities
- **Auth**: Mock authentication for local development
- **Integrations**: Mock implementations for:
  - `UploadFile`: Converts files to base64 data URLs
  - `InvokeLLM`: Returns mock receipt data (replace with your LLM API)
  - `SendEmail`, `SendSMS`, `GenerateImage`: Mock implementations

### 3. Local Storage
- All data is stored in browser localStorage
- Data persists across page refreshes
- Storage keys are prefixed with `olsh_app_`

### 4. Environment Variables
The app now uses local environment variables:
- `VITE_APP_ID`: App identifier (defaults to "local_app")
- `VITE_BACKEND_URL`: Backend URL (defaults to "http://localhost:3000")
- `VITE_ACCESS_TOKEN`: Access token (defaults to "local_token")

## Running Locally

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Create `.env` file** (optional, defaults are provided):
   ```bash
   cp .env.example .env
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** to the URL shown in the terminal (usually `http://localhost:5173`)

## Next Steps for Production Migration

### 1. Replace Mock Integrations
The `InvokeLLM` integration currently returns mock data. You'll need to:
- Replace it with your actual LLM API (OpenAI, Anthropic, etc.)
- Update `src/api/localClient.js` → `IntegrationsClient.invokeLLM()`

### 2. Replace Local Storage with Backend API
Currently, all data is stored in localStorage. For production:
- Create a backend API (Node.js, Python, etc.)
- Replace `EntityClient` methods to call your API instead of localStorage
- Update `src/api/localClient.js` → `EntityClient` class

### 3. Implement Real Authentication
- Replace the mock `AuthClient` with your authentication system
- Update `src/lib/AuthContext.jsx` if needed

### 4. File Storage
Currently, files are converted to base64 data URLs. For production:
- Implement file upload to your storage service (S3, Cloudinary, etc.)
- Update `IntegrationsClient.uploadFile()` to upload to your storage

### 5. Remove Base44 Dependencies (Optional)
You can remove these from `package.json` if you're not using them:
- `@base44/sdk`
- `@base44/vite-plugin`

## Data Migration

If you have existing data in Base44:
1. Export your data from Base44
2. Import it into your new backend
3. Update the localStorage initialization in `src/api/localStorage.js` if needed

## Troubleshooting

### App doesn't load
- Check browser console for errors
- Ensure all dependencies are installed: `npm install`
- Clear browser localStorage if you see storage errors

### Data not persisting
- Check browser localStorage in DevTools
- Ensure localStorage is not disabled in your browser

### Mock LLM not working
- The mock LLM returns sample data
- Replace `InvokeLLM` implementation with your actual LLM API

