# Unified Server API Routes

## UI Routes (Serve HTML)

- `GET /` - Home page with links to all features
- `GET /auth` - OAuth authentication UI
- `GET /search` - Customer search UI
- `GET /assistant` - AI assistant chat UI

## API Routes

### Auth APIs
- `GET /auth/callback` - OAuth callback handler (stores tokens automatically)
- `POST /auth/update-token` - Programmatically update refresh token
  - Body: `{ refreshToken: string, realmId: string }`

### Search APIs
- `GET /api/search?q=<query>` - Search for customers by name, email, phone
- `GET /api/test` - Test QuickBooks connectivity

### Assistant APIs
- `POST /api/chat` - Chat with AI assistant
  - Body: `{ message: string, sessionId?: string }`
- `GET /api/assistant/health` - Assistant health check

### System APIs
- `GET /health` - Overall system health check

## Usage Flow

1. **First**: Visit `/auth` to authenticate with QuickBooks
   - Click "Connect to QuickBooks"
   - Authorize the app
   - Tokens are automatically stored in `.qb-tokens.json`

2. **Then**: Use `/search` or `/assistant`
   - Both will use the stored tokens automatically
   - If tokens are expired, they'll be refreshed automatically

## For Azure Deployment

After deploying to Azure:
1. Visit `https://your-app.azurecontainerapps.io/auth`
2. Authenticate
3. Tokens are stored in the container
4. Use `/search` and `/assistant` features

To manually update tokens on Azure:
```bash
curl -X POST https://your-app.azurecontainerapps.io/auth/update-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_TOKEN",
    "realmId": "YOUR_REALM_ID"
  }'
```
