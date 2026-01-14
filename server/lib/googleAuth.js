const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Paths for OAuth credentials and tokens
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
 */
function loadCredentials() {
  if (!fs.existsSync(OAUTH_CREDENTIALS_PATH)) {
    throw new Error(
      `OAuth credentials not found at ${OAUTH_CREDENTIALS_PATH}. ` +
      'Please create OAuth credentials in Google Cloud Console and download them.'
    );
  }

  const content = fs.readFileSync(OAUTH_CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content);
  
  // Handle both "installed" (desktop) and "web" credential types
  const { client_secret, client_id, redirect_uris } = 
    credentials.installed || credentials.web;
  
  oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  return oauth2Client;
}

/**
 * Load saved tokens and set them on the OAuth client
 */
function loadTokens() {
  if (!oauth2Client) {
    loadCredentials();
  }

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(
      `Token not found at ${TOKEN_PATH}. ` +
      'Please run "node server/setup-auth.js" to authenticate.'
    );
  }

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oauth2Client.setCredentials(token);

  // Set up token refresh handler
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // Save the new refresh token
      const existingToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      existingToken.refresh_token = tokens.refresh_token;
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(existingToken, null, 2));
    }
  });

  return oauth2Client;
}

/**
 * Get the authenticated OAuth2 client
 */
function getAuth() {
  if (!oauth2Client || !oauth2Client.credentials.access_token) {
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
    prompt: 'consent', // Force consent to get refresh token
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
  
  // Save tokens
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Token saved to', TOKEN_PATH);
  
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
