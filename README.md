# QuickBooks Online MCP Server

This is a Model Context Protocol (MCP) server implementation for QuickBooks Online integration.

## Project Structure

This repository contains three separate applications:

1. **MCP Server** (`src/`) - Model Context Protocol server for QuickBooks Online integration
2. **Search Web App** (`search-app/`) - Standalone Express web application for searching customers and invoices
3. **QB AI Assistant** (`qb-assistant/`) - 🤖 AI-powered conversational interface with safety controls for QuickBooks

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_ENVIRONMENT=sandbox
```

3. Get your Client ID and Client Secret:
   - Go to the [Intuit Developer Portal](https://developer.intuit.com/)
   - Create a new app or select an existing one
   - Get the Client ID and Client Secret from the app's keys section
   - Add `http://localhost:8000/callback` to the app's Redirect URIs

4. Build the TypeScript code:
```bash
npm run build
```

## Authentication

There are two ways to authenticate with QuickBooks Online:

### Option 1: Using Environment Variables

If you already have a refresh token and realm ID, you can add them directly to your `.env` file:

```env
QUICKBOOKS_REFRESH_TOKEN=your_refresh_token
QUICKBOOKS_REALM_ID=your_realm_id
```

### Option 2: Using the OAuth Flow

If you don't have a refresh token, you can use the built-in OAuth flow:

```bash
npm run auth
```

This will:
- Start a temporary local server
- Open your default browser automatically
- Redirect you to QuickBooks for authentication
- Save the tokens to your `.env` file once authenticated
- Close automatically when complete

## Usage

### MCP Server

After authentication is set up, you can use the MCP server to interact with QuickBooks Online. The server provides various tools for managing customers, estimates, bills, and more.

Configure your MCP client (like Claude Desktop) to use this server via the stdio transport.

### Search Web Application

To run the web-based customer search interface:

```bash
npm run search
```

Then open http://localhost:3000 in your browser. See [search-app/README.md](search-app/README.md) for more details.

### QuickBooks AI Assistant 🤖

An intelligent conversational interface for interacting with QuickBooks through natural language. Supports both **Claude (Anthropic)** and **GPT (OpenAI)**. The AI Assistant provides:

- **Natural Language Interface**: Ask questions in plain English
- **Safety First**: Always shows action plans and requires confirmation before mutations
- **Conflict Resolution**: Asks for clarification when multiple matches are found
- **Single Operations Only**: No bulk operations for safety
- **Delete Protection**: Delete operations are completely blocked
- **Flexible AI Provider**: Choose between Anthropic Claude or OpenAI GPT

**Setup:**

1. Choose your AI provider and get an API key:
   - **Anthropic Claude**: Get key from https://console.anthropic.com/
   - **OpenAI GPT**: Get key from https://platform.openai.com/api-keys

2. Add to your `.env` file:
   ```env
   # For Anthropic (default)
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...

   # OR for OpenAI
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   ```

3. Run the assistant:
   ```bash
   npm run assistant
   ```
4. Open http://localhost:3000 in your browser

**Example Usage:**
```
You: Show me all customers named John
Assistant: [Searches and displays results]

You: Create a customer named Acme Corp
Assistant: **Action Plan:**
- Operation: create_customer
- Fields: DisplayName: "Acme Corp"

**Do you want me to proceed? (yes/no)**

You: yes
Assistant: ✅ Customer created successfully!
```

See [qb-assistant/README.md](qb-assistant/README.md) for detailed documentation.

## Available MCP Tools

The MCP server provides tools for Create, Read, Update, Delete, and Search operations for the following QuickBooks entities:

- **Account** - Chart of accounts management
- **Bill Payment** - Bill payment tracking
- **Bill** - Vendor bill management
- **Customer** - Customer information management
- **Employee** - Employee records
- **Estimate** - Sales estimates/quotes
- **Invoice** - Customer invoices
- **Item** - Products and services
- **Journal Entry** - Manual journal entries
- **Purchase** - Purchase transactions
- **Vendor** - Vendor information management

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for development
- `npm run auth` - Run OAuth authentication flow
- `npm run search` - Start the search web application
- `npm run assistant` - Start the AI Assistant (requires ANTHROPIC_API_KEY)
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Docker Deployment

### Quick Start with Docker

```bash
# Build the Docker image
docker build -t quickbooks-search-app .

# Run with environment file
docker run -p 3000:3000 --env-file .env quickbooks-search-app
```

### Deploy to Azure Container Apps

Use the automated deployment script:

```bash
# Set your image and credentials
export CONTAINER_IMAGE="ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest"
export QUICKBOOKS_CLIENT_ID="your_client_id"
export QUICKBOOKS_CLIENT_SECRET="your_client_secret"
export QUICKBOOKS_REFRESH_TOKEN="your_refresh_token"
export QUICKBOOKS_REALM_ID="your_realm_id"
export QUICKBOOKS_ENVIRONMENT="sandbox"

# Deploy to Azure
./deploy-azure-container.sh
```

### GitHub Container Registry (GHCR)

The repository includes automated CI/CD via GitHub Actions. Every push to `main` or `develop` automatically builds and publishes Docker images to GHCR.

**Available image tags:**
- `latest` - Latest stable version
- `main` - Latest from main branch
- `v1.0.0` - Semantic version releases
- `main-abc1234` - Branch with git SHA

**Pull the image:**
```bash
docker pull ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest
```

### Documentation

- **[DOCKER-QUICKSTART.md](./DOCKER-QUICKSTART.md)** - Quick reference guide for Docker deployment
- **[DOCKER-DEPLOYMENT.md](./DOCKER-DEPLOYMENT.md)** - Comprehensive deployment documentation with GHCR and Azure

## Error Handling

If you see an error message like "QuickBooks not connected", make sure to:

1. Check that your `.env` file contains all required variables
2. Verify that your tokens are valid and not expired
3. Run `npm run build` to ensure the TypeScript is compiled

