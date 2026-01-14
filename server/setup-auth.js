#!/usr/bin/env node
/**
 * One-time OAuth setup script.
 * 
 * Run this once to authenticate with your Google account:
 *   node server/setup-auth.js
 * 
 * This will:
 * 1. Open a browser for you to log in to Google
 * 2. Save the refresh token to server/token.json
 * 3. The server can then use your account to access Drive/Sheets
 */

const readline = require('readline');
const { getAuthUrl, getTokenFromCode } = require('./lib/googleAuth');

async function setup() {
  console.log('\n🔐 Smart Invoice - Google Account Setup\n');
  console.log('This will connect your personal Google account to the app.');
  console.log('Files will be created in YOUR Google Drive.\n');

  // Generate auth URL
  const authUrl = getAuthUrl();
  
  console.log('1. Open this URL in your browser:\n');
  console.log('   ' + authUrl + '\n');
  console.log('2. Sign in with your Google account');
  console.log('3. Grant the requested permissions');
  console.log('4. Copy the authorization code\n');

  // Prompt for code
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the authorization code: ', async (code) => {
    rl.close();
    
    try {
      await getTokenFromCode(code.trim());
      console.log('\n✅ Success! Your account is now connected.');
      console.log('   The server can now create files in your Google Drive.\n');
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });
}

setup();

