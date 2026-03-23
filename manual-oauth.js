import dotenv from 'dotenv';
import OAuthClient from 'intuit-oauth';
import open from 'open';
import readline from 'readline';
import { tokenManager } from './dist/helpers/token-manager.js';

dotenv.config();

const client_id = process.env.QUICKBOOKS_CLIENT_ID;
const client_secret = process.env.QUICKBOOKS_CLIENT_SECRET;
const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
const redirect_uri = process.env.QUICKBOOKS_REDIRECTURI;

console.log('\n'.repeat(60));
console.log('='.repeat(60));
console.log('QuickBooks OAuth Manual Token Retrieval');
console.log('='.repeat(60));
console.log('\nConfiguration:');
console.log(`  Environment: ${environment}`);
console.log(`  Client ID: ${client_id ? '✓ Set' : '✗ Not Set'}`);
console.log(`  Client Secret: ${client_secret ? '✓ Set' : '✗ Not Set'}`);
console.log(`  Redirect URI: ${redirect_uri}`);
console.log('\n' + '='.repeat(60));

if (!client_id || !client_secret || !redirect_uri) {
  console.error('\n❌ Missing required environment variables!');
  process.exit(1);
}

const oauthClient = new OAuthClient({
  clientId: client_id,
  clientSecret: client_secret,
  environment: environment,
  redirectUri: redirect_uri,
});

// Generate authorization URL
const authUri = oauthClient.authorizeUri({
  scope: [OAuthClient.scopes.Accounting],
  state: 'manual-auth'
});

console.log('\n📋 INSTRUCTIONS:');
console.log('='.repeat(60));
console.log('1. A browser window will open with QuickBooks OAuth');
console.log('2. Log in to your QuickBooks account');
console.log('3. Authorize the application');
console.log('4. After authorization, you will be redirected to your Azure URL');
console.log('5. The page will show an error (this is expected!)');
console.log('6. COPY THE ENTIRE URL from your browser address bar');
console.log('7. Paste it back here when prompted');
console.log('='.repeat(60));

console.log('\n🌐 Opening browser for OAuth authorization...\n');

// Open browser
await open(authUri);

console.log('If the browser did not open, visit this URL:\n');
console.log(authUri);
console.log('\n' + '='.repeat(60));

// Wait for user to paste the callback URL
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\n📎 Paste the full callback URL here: ', async (callbackUrl) => {
  try {
    console.log('\n🔄 Exchanging authorization code for tokens...\n');

    const authResponse = await oauthClient.createToken(callbackUrl);
    const token = authResponse.getToken();

    console.log('✅ SUCCESS! Tokens retrieved:\n');
    console.log('='.repeat(60));
    console.log(`Realm ID: ${token.realmId}`);
    console.log(`Refresh Token: ${token.refresh_token}`);
    console.log(`Access Token: ${token.access_token.substring(0, 50)}...`);
    console.log(`Expires In: ${token.expires_in} seconds (${token.expires_in / 3600} hours)`);
    console.log('='.repeat(60));

    // Save tokens using token manager
    tokenManager.updateTokens({
      refreshToken: token.refresh_token,
      accessToken: token.access_token,
      realmId: token.realmId,
      expiresIn: token.expires_in,
      refreshTokenExpiresIn: token.x_refresh_token_expires_in,
    });

    console.log('\n✅ Tokens saved to .qb-tokens.json');
    console.log('\n📝 Next steps:');
    console.log('1. The tokens are now stored locally in .qb-tokens.json');
    console.log('2. Update Azure secrets with the new refresh token');
    console.log('3. Restart the Azure container');
    console.log('\n' + '='.repeat(60));

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error exchanging token:', error.message);
    console.error('\nPlease make sure you copied the ENTIRE URL from your browser.');
    rl.close();
    process.exit(1);
  }
});
