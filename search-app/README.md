# QuickBooks Search Web Application

A standalone Express-based web application for searching QuickBooks customers and viewing their invoice details.

## Overview

This web application provides an intuitive interface to search QuickBooks customers by name or email and displays comprehensive customer information including:
- Customer details (name, email, phone, address)
- Account balance
- Invoice history with payment status
- Total invoiced amount and outstanding balance

## Prerequisites

Before running the search application, ensure you have:

1. Completed the authentication setup in the main QuickBooks MCP server (see root README.md)
2. Built the MCP server TypeScript code:
   ```bash
   cd ..
   npm run build
   ```

## Running the Search Application

You can run the search application from either directory:

### Option 1: From the root directory (recommended):

```bash
npm run search
```

### Option 2: From the search-app directory:

```bash
cd search-app
node server.js
```

Both methods will start the server at http://localhost:3000

The server automatically loads environment variables from the root `.env` file and serves static files from the `search-app/public` directory, regardless of where you run the command from.

## Usage

1. Open your browser and navigate to http://localhost:3000
2. Enter a customer name or email address in the search box
3. Press Enter or click the Search button
4. View customer details and invoice information

## Architecture

The search application:
- **server.js**: Express server that handles API requests
- **public/index.html**: Frontend UI with search interface
- Uses compiled handlers from the MCP server (`../dist/handlers/`)
- Shares the QuickBooks client authentication with the MCP server

## API Endpoints

### GET /api/search

Search for customers by name or email.

**Query Parameters:**
- `q` (string): Search term (customer name or email)

**Response:**
```json
{
  "results": [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234",
      "balance": 100.50,
      "address": "123 Main St, City, ST 12345",
      "invoiceCount": 5,
      "totalInvoiced": 1500.00,
      "outstandingBalance": 100.50,
      "invoices": [...]
    }
  ]
}
```

## Configuration

The search application uses the same `.env` configuration as the main MCP server. Ensure the following environment variables are set in the root `.env` file:

```env
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_REFRESH_TOKEN=your_refresh_token
QUICKBOOKS_REALM_ID=your_realm_id
QUICKBOOKS_ENVIRONMENT=sandbox
```

## Development

To modify the search functionality:

1. Update `server.js` for backend changes
2. Update `public/index.html` for frontend changes
3. Rebuild the MCP server if you modify handlers:
   ```bash
   cd ..
   npm run build
   ```

## Port Configuration

The search application runs on port 3000 by default. To change the port, modify the `PORT` constant in `server.js`:

```javascript
const PORT = 3000; // Change to your preferred port
```

## Troubleshooting

### "QuickBooks not connected" error
- Ensure you've completed the OAuth authentication flow
- Check that your `.env` file contains valid tokens
- Verify that the MCP server has been built (`npm run build`)

### No results found
- Verify that customers exist in your QuickBooks account
- Try searching with a partial name
- Check that you're connected to the correct QuickBooks company

### Server won't start
- Ensure port 3000 is not already in use
- Verify that dependencies are installed (`npm install` in root directory)
- Check that the MCP server has been built successfully
