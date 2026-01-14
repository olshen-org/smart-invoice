const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Paths for OAuth credentials and tokens (file-based, for local dev)
const OAUTH_CREDENTIALS_PATH = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH ||
  path.join(__dirname, '../oauth_credentials.json');
const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH ||
  path.join(__dirname, '../token.json');

// Scopes required for Sheets and Drive
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

let oauth2Client = null;
let sheetsClient = null;
let driveClient = null;

/**
 * Load OAuth credentials and create auth client
 * Supports both file-based (local) and env var (production) approaches
 */
function loadCredentials() {
  let client_id, client_secret, redirect_uri;

  // Option 1: Environment variables (production)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    client_id = process.env.GOOGLE_CLIENT_ID;
    client_secret = process.env.GOOGLE_CLIENT_SECRET;
    redirect_uri = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
    console.log('Using Google OAuth credentials from environment variables');
  }
  // Option 2: File-based (local development)
  else if (fs.existsSync(OAUTH_CREDENTIALS_PATH)) {
    const content = fs.readFileSync(OAUTH_CREDENTIALS_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    const creds = credentials.installed || credentials.web;
    client_id = creds.client_id;
    client_secret = creds.client_secret;
    redirect_uri = creds.redirect_uris?.[0] || 'urn:ietf:wg:oauth:2.0:oob';
    console.log('Using Google OAuth credentials from file');
  }
  else {
    throw new Error(
      `Google OAuth credentials not found. Either set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET ` +
      `environment variables, or create ${OAUTH_CREDENTIALS_PATH}`
    );
  }

  oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  return oauth2Client;
}

/**
 * Load saved tokens and set them on the OAuth client
 * Supports both file-based (local) and env var (production) approaches
 */
function loadTokens() {
  if (!oauth2Client) {
    loadCredentials();
  }

  let tokens;

  // Option 1: Environment variable (production)
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    tokens = {
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      // Access token will be fetched automatically using refresh token
    };
    console.log('Using Google refresh token from environment variable');
  }
  // Option 2: File-based (local development)
  else if (fs.existsSync(TOKEN_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    console.log('Using Google tokens from file');
  }
  else {
    throw new Error(
      `Google tokens not found. Either set GOOGLE_REFRESH_TOKEN environment variable, ` +
      `or run "node server/setup-auth.js" to authenticate locally.`
    );
  }

  oauth2Client.setCredentials(tokens);

  // Set up token refresh handler (only for file-based tokens)
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    oauth2Client.on('tokens', (newTokens) => {
      if (newTokens.refresh_token) {
        const existingToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        existingToken.refresh_token = newTokens.refresh_token;
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(existingToken, null, 2));
      }
    });
  }

  return oauth2Client;
}

/**
 * Get the authenticated OAuth2 client
 */
function getAuth() {
  if (!oauth2Client || !oauth2Client.credentials.refresh_token) {
    loadTokens();
  }
  return oauth2Client;
}

/**
 * Get Google Sheets client
 */
function getSheets() {
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: 'v4', auth: getAuth() });
  }
  return sheetsClient;
}

/**
 * Get Google Drive client
 */
function getDrive() {
  if (!driveClient) {
    driveClient = google.drive({ version: 'v3', auth: getAuth() });
  }
  return driveClient;
}

/**
 * Generate authorization URL (used by setup script)
 */
function getAuthUrl() {
  if (!oauth2Client) {
    loadCredentials();
  }
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens (used by setup script)
 */
async function getTokenFromCode(code) {
  if (!oauth2Client) {
    loadCredentials();
  }
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Save tokens to file (for local dev)
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Token saved to', TOKEN_PATH);

  // Also print the refresh token for production setup
  if (tokens.refresh_token) {
    console.log('\n📋 For production, set this environment variable:');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  }

  return tokens;
}

// Lazy-loaded exports
module.exports = {
  get auth() { return getAuth(); },
  get sheets() { return getSheets(); },
  get drive() { return getDrive(); },
  getAuthUrl,
  getTokenFromCode,
  SCOPES,
};
