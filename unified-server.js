#!/usr/bin/env node

/**
 * Unified QuickBooks Server
 * Combines Auth, Search, and AI Assistant into one server
 *
 * Routes:
 * - /auth/*     - OAuth authentication flow
 * - /search/*   - Customer search functionality
 * - /assistant/* - AI assistant chat
 */

import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import OAuthClient from 'intuit-oauth';
import open from 'open';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Import QuickBooks handlers
import { quickbooksClient } from './dist/clients/quickbooks-client.js';
import { getQuickbooksCustomer } from './dist/handlers/get-quickbooks-customer.handler.js';
import { searchQuickbooksCustomers } from './dist/handlers/search-quickbooks-customers.handler.js';
import { searchQuickbooksInvoices } from './dist/handlers/search-quickbooks-invoices.handler.js';
import { searchQuickbooksSalesReceipts } from './dist/handlers/search-quickbooks-salesreceipts.handler.js';
import { readQuickbooksInvoice } from './dist/handlers/read-quickbooks-invoice.handler.js';
import { tokenManager } from './dist/helpers/token-manager.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============================================================================
// AUTH ROUTES - /auth/*
// =============================================================================

const oauthClient = new OAuthClient({
  clientId: process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
  environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
  redirectUri: process.env.QUICKBOOKS_REDIRECTURI || `http://localhost:${PORT}/auth/callback`,
});

// Home page for auth
app.get('/auth', (req, res) => {
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

// OAuth callback handler (shared logic)
async function handleOAuthCallback(req, res) {
  const parseRedirect = req.url;

  try {
    const authResponse = await oauthClient.createToken(parseRedirect);
    const token = authResponse.getToken();

    // Update token manager
    tokenManager.updateTokens({
      refreshToken: token.refresh_token,
      accessToken: token.access_token,
      realmId: token.realmId,
      expiresIn: token.expires_in,
      refreshTokenExpiresIn: token.x_refresh_token_expires_in,
    });

    console.log('\n' + '='.repeat(60));
    console.log('✓ Authentication Successful!');
    console.log('='.repeat(60));
    console.log('\nNew Tokens:');
    console.log(`  Refresh Token: ${token.refresh_token}`);
    console.log(`  Realm ID: ${token.realmId}`);
    console.log('='.repeat(60));

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

          <p>Your QuickBooks tokens have been stored and are ready to use.</p>

          <div class="token-box">
            <div class="label">QUICKBOOKS_REFRESH_TOKEN:</div>
            <div class="value">${token.refresh_token}</div>

            <div class="label">QUICKBOOKS_REALM_ID:</div>
            <div class="value">${token.realmId}</div>
          </div>

          <div class="warning">
            <strong>✓ Tokens Stored:</strong> The tokens have been saved to .qb-tokens.json and are ready for use by the search and assistant features.
          </div>

          <p>You can now use:</p>
          <ul>
            <li><strong>/search</strong> - Search for customers</li>
            <li><strong>/assistant</strong> - Chat with AI assistant</li>
          </ul>
        </div>
      </body>
      </html>
    `);
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
}

// OAuth callback routes (handle both /callback and /auth/callback)
app.get('/auth/callback', handleOAuthCallback);
app.get('/callback', handleOAuthCallback);

// API endpoint to update token programmatically
app.post('/auth/update-token', async (req, res) => {
  try {
    const { refreshToken, realmId } = req.body;

    if (!refreshToken || !realmId) {
      return res.status(400).json({
        error: 'Missing required fields: refreshToken and realmId'
      });
    }

    tokenManager.updateTokens({
      refreshToken,
      realmId,
    });

    console.log('✓ Refresh token updated via API');

    res.json({
      success: true,
      message: 'Refresh token updated successfully',
      realmId
    });
  } catch (error) {
    console.error('Error updating token:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// SEARCH ROUTES - /search/*
// =============================================================================

// Serve search UI
app.use('/search', express.static(path.join(__dirname, 'search-app', 'public')));

// Search API (at root level to match HTML expectations)
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req;
    const searchTerm = query.q || '';

    if (!searchTerm) {
      return res.json({ results: [] });
    }

    await quickbooksClient.authenticate();

    const customersResponse = await searchQuickbooksCustomers({
      fetchAll: true
    });

    if (customersResponse.isError) {
      return res.status(500).json({ error: customersResponse.error });
    }

    const allCustomers = customersResponse.result || [];
    const searchLower = searchTerm.toLowerCase();

    const customers = allCustomers.filter(customer => {
      const customerId = (customer.Id || '').toLowerCase();
      const displayName = (customer.DisplayName || '').toLowerCase();
      const companyName = (customer.CompanyName || '').toLowerCase();
      const givenName = (customer.GivenName || '').toLowerCase();
      const familyName = (customer.FamilyName || '').toLowerCase();
      const middleName = (customer.MiddleName || '').toLowerCase();
      const fullName = (customer.FullyQualifiedName || '').toLowerCase();
      const primaryEmail = (customer.PrimaryEmailAddr?.Address || '').toLowerCase();
      const alternateEmail = (customer.AlternateEmailAddr?.Address || '').toLowerCase();
      const primaryPhone = (customer.PrimaryPhone?.FreeFormNumber || '').toLowerCase();
      const mobile = (customer.Mobile?.FreeFormNumber || '').toLowerCase();
      const alternatePhone = (customer.AlternatePhone?.FreeFormNumber || '').toLowerCase();
      const fax = (customer.Fax?.FreeFormNumber || '').toLowerCase();

      const searchDigits = searchTerm.replace(/\D/g, '');
      const primaryPhoneDigits = primaryPhone.replace(/\D/g, '');
      const mobileDigits = mobile.replace(/\D/g, '');
      const alternatePhoneDigits = alternatePhone.replace(/\D/g, '');

      return customerId.includes(searchLower) ||
             displayName.includes(searchLower) ||
             companyName.includes(searchLower) ||
             givenName.includes(searchLower) ||
             familyName.includes(searchLower) ||
             middleName.includes(searchLower) ||
             fullName.includes(searchLower) ||
             primaryEmail.includes(searchLower) ||
             alternateEmail.includes(searchLower) ||
             primaryPhone.includes(searchLower) ||
             mobile.includes(searchLower) ||
             alternatePhone.includes(searchLower) ||
             fax.includes(searchLower) ||
             (searchDigits.length >= 3 && (
               primaryPhoneDigits.includes(searchDigits) ||
               mobileDigits.includes(searchDigits) ||
               alternatePhoneDigits.includes(searchDigits)
             ));
    }).slice(0, 50);

    const results = await Promise.all(
      customers.map(async (customer) => {
        const invoicesResponse = await searchQuickbooksInvoices({
          filters: [
            { field: 'CustomerRef', value: customer.Id, operator: '=' }
          ],
          limit: 100
        });

        const salesReceiptsResponse = await searchQuickbooksSalesReceipts({
          filters: [
            { field: 'CustomerRef', value: customer.Id, operator: '=' }
          ],
          limit: 100
        });

        const invoices = invoicesResponse.isError ? [] : (invoicesResponse.result || []);
        const salesReceipts = salesReceiptsResponse.isError ? [] : (salesReceiptsResponse.result || []);

        const allTransactions = [
          ...invoices.map(inv => ({ ...inv, TransactionType: 'Invoice' })),
          ...salesReceipts.map(sr => ({ ...sr, TransactionType: 'SalesReceipt' }))
        ];

        const outstandingBalance = invoices.reduce((sum, inv) => sum + parseFloat(inv.Balance || 0), 0);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.TotalAmt || 0), 0);
        const totalSalesReceipts = salesReceipts.reduce((sum, sr) => sum + parseFloat(sr.TotalAmt || 0), 0);

        return {
          id: customer.Id,
          name: customer.DisplayName,
          companyName: customer.CompanyName || '',
          givenName: customer.GivenName || '',
          familyName: customer.FamilyName || '',
          email: customer.PrimaryEmailAddr?.Address || 'N/A',
          phone: customer.PrimaryPhone?.FreeFormNumber || 'N/A',
          mobile: customer.Mobile?.FreeFormNumber || 'N/A',
          balance: parseFloat(customer.Balance || 0),
          address: customer.BillAddr ?
            `${customer.BillAddr.Line1 || ''} ${customer.BillAddr.City || ''}, ${customer.BillAddr.CountrySubDivisionCode || ''} ${customer.BillAddr.PostalCode || ''}`.trim()
            : 'N/A',
          invoiceCount: invoices.length,
          salesReceiptCount: salesReceipts.length,
          transactionCount: allTransactions.length,
          totalInvoiced: totalInvoiced,
          totalSalesReceipts: totalSalesReceipts,
          totalRevenue: totalInvoiced + totalSalesReceipts,
          outstandingBalance: outstandingBalance,
          transactions: allTransactions.map(txn => ({
            id: txn.Id,
            type: txn.TransactionType,
            docNumber: txn.DocNumber,
            date: txn.TxnDate,
            dueDate: txn.DueDate || (txn.TransactionType === 'SalesReceipt' ? 'N/A' : ''),
            total: parseFloat(txn.TotalAmt || 0),
            balance: parseFloat(txn.Balance || 0),
            status: txn.TransactionType === 'SalesReceipt' ? 'Paid' : (parseFloat(txn.Balance || 0) > 0 ? 'Unpaid' : 'Paid')
          })).sort((a, b) => new Date(b.date) - new Date(a.date))
        };
      })
    );

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search test endpoint
app.get('/api/test', async (req, res) => {
  try {
    await quickbooksClient.authenticate();
    const customersResponse = await searchQuickbooksCustomers({ limit: 5 });

    res.json({
      success: true,
      authenticated: true,
      customerCount: customersResponse.result?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// ASSISTANT ROUTES - /assistant/*
// =============================================================================

// Serve assistant UI
app.use('/assistant', express.static(path.join(__dirname, 'qb-assistant', 'public')));

// Assistant API endpoints (at root level to match HTML expectations)
// Assistant chat endpoint
let mcpClient = null;
let availableTools = [];
const sessions = new Map();

// AI Provider configuration
const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

let anthropic = null;
let openai = null;

if (AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'claude') {
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
} else if (AI_PROVIDER === 'openai' || AI_PROVIDER === 'gpt') {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
}

async function initializeMCP() {
  try {
    const serverPath = path.join(__dirname, 'dist', 'index.js');
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: process.env, // Pass environment variables to MCP server subprocess
    });

    mcpClient = new Client({
      name: 'qb-assistant-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    await mcpClient.connect(transport);
    const toolsResponse = await mcpClient.listTools();
    availableTools = toolsResponse.tools;

    console.log(`✓ MCP client initialized with ${availableTools.length} tools`);
    return true;
  } catch (error) {
    console.error('Failed to initialize MCP client:', error);
    return false;
  }
}

// System prompt for assistant
const SYSTEM_PROMPT = `You are a QuickBooks AI Assistant that helps users interact with their QuickBooks Online account safely and intelligently.

**Your Core Responsibilities:**

1. **Safety First**: You MUST follow these safety rules:
   - NEVER execute bulk operations (operations affecting multiple records at once)
   - NEVER execute delete/remove operations - always inform user these are blocked for safety
   - ALWAYS work with single entities only
   - ALWAYS show your plan before executing any mutation (create/update)
   - ALWAYS ask for confirmation before executing mutations

2. **Handling Ambiguity**:
   - If a user request is ambiguous (e.g., "update customer John" when multiple Johns exist), you MUST:
     a. Search for matching entities
     b. Present ALL matches to the user with clear identifying information
     c. Ask the user to select the specific entity by ID or unique identifier
     d. Wait for confirmation before proceeding

3. **Query vs Mutation**:
   - **Queries** (search, read, get): Execute immediately and show results
   - **Mutations** (create, update): Show plan first, get confirmation, then execute

4. **Response Format**:
   - Be conversational but precise
   - Use bullet points and formatting for clarity
   - Always include entity IDs when showing results
   - Show key fields (Name, Balance, Email, etc.) in results

Remember: ALWAYS prioritize user safety and data integrity. When in doubt, ask for clarification.`;

// Helper functions
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      conversationHistory: [],
      pendingAction: null,
    });
  }
  return sessions.get(sessionId);
}

function isConfirmation(message) {
  const confirmWords = ['yes', 'y', 'confirm', 'proceed', 'go ahead', 'do it', 'execute', 'ok', 'okay'];
  const rejectWords = ['no', 'n', 'cancel', 'stop', 'abort', 'nevermind', 'never mind'];
  const normalized = message.toLowerCase().trim();
  if (confirmWords.some(word => normalized === word || normalized.startsWith(word + ' '))) {
    return 'yes';
  }
  if (rejectWords.some(word => normalized === word || normalized.startsWith(word + ' '))) {
    return 'no';
  }
  return null;
}

function isMutationTool(toolName) {
  return toolName.startsWith('create_') || toolName.startsWith('update_');
}

function isDeleteTool(toolName) {
  return toolName.startsWith('delete_') || toolName.includes('delete');
}

function sanitizeSchemaForOpenAI(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const sanitized = Array.isArray(schema) ? [...schema] : { ...schema };
  if (sanitized.type === 'array') {
    if (!sanitized.items) {
      sanitized.items = { type: 'object' };
    } else {
      sanitized.items = sanitizeSchemaForOpenAI(sanitized.items);
    }
  }
  if (sanitized.properties && typeof sanitized.properties === 'object') {
    const sanitizedProps = {};
    for (const [key, value] of Object.entries(sanitized.properties)) {
      sanitizedProps[key] = sanitizeSchemaForOpenAI(value);
    }
    sanitized.properties = sanitizedProps;
  }
  if (sanitized.additionalProperties && typeof sanitized.additionalProperties === 'object') {
    sanitized.additionalProperties = sanitizeSchemaForOpenAI(sanitized.additionalProperties);
  }
  ['allOf', 'anyOf', 'oneOf'].forEach(key => {
    if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map(item => sanitizeSchemaForOpenAI(item));
    }
  });
  return sanitized;
}

function convertToOpenAITools(mcpTools) {
  return mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: sanitizeSchemaForOpenAI(tool.inputSchema),
    },
  }));
}

function convertToAnthropicTools(mcpTools) {
  return mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

async function callAnthropic(messages, tools) {
  return await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: messages,
    tools: tools,
  });
}

async function callOpenAI(messages, tools) {
  const openaiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];
  return await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: openaiMessages,
    tools: tools,
    tool_choice: 'auto',
  });
}

function formatMcpResult(result) {
  if (!result || !result.content) {
    return 'No result returned';
  }

  // Extract text from MCP content array
  const textContent = result.content
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n');

  return textContent || JSON.stringify(result.content, null, 2);
}

async function executePendingAction(action) {
  try {
    const result = await mcpClient.callTool({
      name: action.toolName,
      arguments: action.toolInput,
    });
    return `Operation: ${action.toolName}\nResult: ${formatMcpResult(result)}`;
  } catch (error) {
    console.error('Error executing action:', error);
    return `❌ Error executing action: ${error.message}`;
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!mcpClient) {
      return res.status(503).json({
        error: 'AI Assistant not initialized. MCP connection required.',
        response: '⚠️ AI Assistant is not initialized. Please ensure QuickBooks authentication is complete.'
      });
    }

    if (!anthropic && !openai) {
      return res.status(503).json({
        error: 'AI provider not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env',
        response: '⚠️ AI provider not configured. Please check your .env file.'
      });
    }

    const session = getSession(sessionId);

    // Check for confirmation if there's a pending action
    if (session.pendingAction) {
      const confirmation = isConfirmation(message);

      if (confirmation === 'yes') {
        const result = await executePendingAction(session.pendingAction);
        session.pendingAction = null;
        return res.json({
          response: `✅ **Action Completed**\n\n${result}`,
          requiresConfirmation: false,
        });
      } else if (confirmation === 'no') {
        session.pendingAction = null;
        return res.json({
          response: '❌ Action cancelled. How else can I help you?',
          requiresConfirmation: false,
        });
      }
    }

    // Add user message to history
    session.conversationHistory.push({
      role: 'user',
      content: message,
    });

    let assistantMessage = '';
    let requiresConfirmation = false;
    let pendingToolCalls = [];

    if (AI_PROVIDER === 'openai' || AI_PROVIDER === 'gpt') {
      // OpenAI flow
      const tools = convertToOpenAITools(availableTools);
      const response = await callOpenAI(session.conversationHistory, tools);
      const choice = response.choices[0];
      const responseMessage = choice.message;

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        session.conversationHistory.push(responseMessage);
        const toolMessages = [];

        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const rawToolInput = JSON.parse(toolCall.function.arguments);
          const toolInput = rawToolInput.params ? rawToolInput : { params: rawToolInput };

          if (isDeleteTool(toolName)) {
            assistantMessage += '\n\n🚫 **Delete operations are blocked for safety.**';
            continue;
          }

          if (isMutationTool(toolName)) {
            const hasConfirmationRequest = responseMessage.content &&
              (responseMessage.content.toLowerCase().includes('do you want') ||
               responseMessage.content.toLowerCase().includes('proceed'));

            if (hasConfirmationRequest) {
              session.pendingAction = { toolName, toolInput, toolCallId: toolCall.id };
              requiresConfirmation = true;
              pendingToolCalls.push({ toolName, toolInput });
              assistantMessage = responseMessage.content || '';
            } else {
              try {
                const result = await mcpClient.callTool({ name: toolName, arguments: toolInput });
                toolMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: formatMcpResult(result),
                });
              } catch (error) {
                toolMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Error: ${error.message}`,
                });
              }
            }
          } else {
            try {
              const result = await mcpClient.callTool({ name: toolName, arguments: toolInput });
              toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: formatMcpResult(result),
              });
            } catch (error) {
              toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: ${error.message}`,
              });
            }
          }
        }

        if (toolMessages.length > 0) {
          session.conversationHistory.push(...toolMessages);
          const finalResponse = await callOpenAI(session.conversationHistory, tools);
          assistantMessage = finalResponse.choices[0].message.content || 'I processed the request but have no additional response.';
          session.conversationHistory.push({
            role: 'assistant',
            content: assistantMessage,
          });
        }
      } else {
        assistantMessage = responseMessage.content;
        session.conversationHistory.push({
          role: 'assistant',
          content: assistantMessage,
        });
      }
    }

    res.json({
      response: assistantMessage,
      requiresConfirmation: requiresConfirmation,
      pendingActions: pendingToolCalls,
    });

  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({
      error: 'Failed to process your request',
      details: error.message,
    });
  }
});

app.get('/api/assistant/health', (req, res) => {
  res.json({
    status: 'ok',
    aiProvider: AI_PROVIDER,
    mcpConnected: mcpClient !== null,
    toolsAvailable: availableTools.length,
  });
});

// =============================================================================
// ROOT & HEALTH
// =============================================================================

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QuickBooks Unified Server</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
          color: #2c5282;
          margin-bottom: 30px;
        }
        .route {
          background: #f7fafc;
          padding: 20px;
          margin: 15px 0;
          border-radius: 8px;
          border-left: 4px solid #4299e1;
        }
        .route h3 {
          margin: 0 0 10px 0;
          color: #2d3748;
        }
        .route p {
          margin: 5px 0;
          color: #4a5568;
        }
        a {
          color: #4299e1;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 QuickBooks Unified Server</h1>

        <div class="route">
          <h3>🔐 <a href="/auth">/auth</a></h3>
          <p>OAuth authentication flow to connect your QuickBooks account</p>
          <p><strong>Start here first</strong> to authenticate and get tokens</p>
        </div>

        <div class="route">
          <h3>🔍 <a href="/search">/search</a></h3>
          <p>Search for customers, view invoices and transactions</p>
          <p>Requires authentication first</p>
        </div>

        <div class="route">
          <h3>🤖 <a href="/assistant">/assistant</a></h3>
          <p>AI-powered QuickBooks assistant</p>
          <p>Chat with AI to manage your QuickBooks data</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    routes: {
      auth: '/auth',
      search: '/search',
      assistant: '/assistant'
    },
    authenticated: !!tokenManager.getTokenStatus().hasRefreshToken
  });
});

// =============================================================================
// START SERVER
// =============================================================================

async function startServer() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 QuickBooks Unified Server');
  console.log('='.repeat(60));

  // Initialize MCP for assistant (optional)
  if (AI_PROVIDER && (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)) {
    await initializeMCP();
  }

  app.listen(PORT, () => {
    console.log(`\n✓ Server running at http://localhost:${PORT}`);
    console.log('\nAvailable routes:');
    console.log(`  🔐 Auth:      http://localhost:${PORT}/auth`);
    console.log(`  🔍 Search:    http://localhost:${PORT}/search`);
    console.log(`  🤖 Assistant: http://localhost:${PORT}/assistant`);
    console.log('\n' + '='.repeat(60) + '\n');
  });
}

startServer();
