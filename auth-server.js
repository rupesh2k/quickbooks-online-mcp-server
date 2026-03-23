#!/usr/bin/env node

/**
 * QuickBooks OAuth Authentication Server
 * Run this to get fresh OAuth tokens for QuickBooks
 */

import dotenv from 'dotenv';
import express from 'express';
import OAuthClient from 'intuit-oauth';
import open from 'open';

dotenv.config();

const app = express();
const PORT = 8000;

// Initialize OAuth client
const oauthClient = new OAuthClient({
  clientId: process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
  environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
  redirectUri: process.env.QUICKBOOKS_REDIRECTURI || `http://localhost:${PORT}/callback`,
});

console.log('\n='.repeat(60));
console.log('QuickBooks OAuth Authentication Server');
console.log('='.repeat(60));
console.log('\nConfiguration:');
console.log(`  Environment: ${oauthClient.environment}`);
console.log(`  Client ID: ${process.env.QUICKBOOKS_CLIENT_ID ? '✓ Set' : '✗ Missing'}`);
console.log(`  Client Secret: ${process.env.QUICKBOOKS_CLIENT_SECRET ? '✓ Set' : '✗ Missing'}`);
console.log(`  Redirect URI: ${oauthClient.redirectUri}`);
console.log('\n' + '='.repeat(60));

// Home route - start OAuth flow
app.get('/', (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'quickbooks-mcp-auth',
  });

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QuickBooks OAuth</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
          color: #333;
          margin-bottom: 20px;
        }
        .info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .btn {
          display: inline-block;
          padding: 15px 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 16px;
          transition: transform 0.2s;
        }
        .btn:hover {
          transform: translateY(-2px);
        }
        code {
          background: #f8f9fa;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: 'Monaco', 'Courier New', monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 QuickBooks OAuth Authentication</h1>

        <div class="info">
          <p><strong>Environment:</strong> ${oauthClient.environment}</p>
          <p><strong>Redirect URI:</strong> <code>${oauthClient.redirectUri}</code></p>
        </div>

        <p>Click the button below to authenticate with QuickBooks and get fresh OAuth tokens.</p>

        <p style="margin: 30px 0;">
          <a href="${authUri}" class="btn">Connect to QuickBooks</a>
        </p>

        <p style="color: #666; font-size: 14px;">
          After authorization, you'll be redirected back here with your new tokens.
        </p>
      </div>
    </body>
    </html>
  `);
});

// OAuth callback route
app.get('/callback', async (req, res) => {
  const parseRedirect = req.url;

  try {
    const authResponse = await oauthClient.createToken(parseRedirect);
    const token = authResponse.getToken();

    console.log('\n' + '='.repeat(60));
    console.log('✓ Authentication Successful!');
    console.log('='.repeat(60));
    console.log('\nNew Tokens:');
    console.log(`  Refresh Token: ${token.refresh_token}`);
    console.log(`  Realm ID: ${token.realmId}`);
    console.log(`  Access Token Expires: ${new Date(token.expires_in * 1000 + Date.now())}`);
    console.log(`  Refresh Token Expires: ${new Date(token.x_refresh_token_expires_in * 1000 + Date.now())}`);
    console.log('\n' + '='.repeat(60));
    console.log('\nUpdate your .env file with these values:');
    console.log('='.repeat(60));
    console.log(`QUICKBOOKS_REFRESH_TOKEN=${token.refresh_token}`);
    console.log(`QUICKBOOKS_REALM_ID=${token.realmId}`);
    console.log('='.repeat(60));
    console.log('\n');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Success</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          }
          h1 {
            color: #28a745;
            margin-bottom: 20px;
          }
          .success-icon {
            font-size: 64px;
            text-align: center;
            margin: 20px 0;
          }
          .token-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
          }
          .label {
            font-weight: 600;
            color: #666;
            margin-bottom: 5px;
          }
          .value {
            background: white;
            padding: 10px;
            border-radius: 5px;
            word-break: break-all;
            margin-bottom: 15px;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Authentication Successful!</h1>

          <p>Your QuickBooks tokens have been generated. Copy these values to your <code>.env</code> file:</p>

          <div class="token-box">
            <div class="label">QUICKBOOKS_REFRESH_TOKEN:</div>
            <div class="value">${token.refresh_token}</div>

            <div class="label">QUICKBOOKS_REALM_ID:</div>
            <div class="value">${token.realmId}</div>
          </div>

          <div class="warning">
            <strong>⚠️ Important:</strong> These tokens are also displayed in your terminal. Make sure to update your <code>.env</code> file and restart your application.
          </div>

          <p>You can close this window and return to your terminal.</p>
        </div>
      </body>
      </html>
    `);

    // Don't auto-close server so user can copy tokens
    console.log('\n✓ Press Ctrl+C to stop the server when done.\n');
  } catch (e) {
    console.error('\n✗ Error during authentication:');
    console.error(e);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          }
          .error {
            color: #dc3545;
          }
          pre {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="error">❌ Authentication Failed</h1>
          <p>An error occurred during authentication:</p>
          <pre>${e.message}</pre>
          <p>Please check your credentials and try again.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✓ Server running at http://localhost:${PORT}`);
  console.log(`\nOpening browser to start OAuth flow...`);
  console.log('\nIf browser doesn\'t open automatically, visit:');
  console.log(`  http://localhost:${PORT}`);
  console.log('\n' + '='.repeat(60) + '\n');

  // Automatically open browser
  open(`http://localhost:${PORT}`).catch(() => {
    console.log('Could not open browser automatically. Please open manually.');
  });
});
