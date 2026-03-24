#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active sessions
const sessions = new Map();

// Initialize MCP client
let mcpClient = null;
let availableTools = [];

// AI Provider configuration
const AI_PROVIDER = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// Initialize AI clients
let anthropic = null;
let openai = null;

if (AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'claude') {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is required when using Anthropic provider');
    process.exit(1);
  }
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log(`Using Anthropic AI provider with model: ${ANTHROPIC_MODEL}`);
} else if (AI_PROVIDER === 'openai' || AI_PROVIDER === 'gpt') {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY is required when using OpenAI provider');
    process.exit(1);
  }
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log(`Using OpenAI AI provider with model: ${OPENAI_MODEL}`);
} else {
  console.error(`Error: Unknown AI_PROVIDER: ${AI_PROVIDER}. Use 'anthropic' or 'openai'`);
  process.exit(1);
}

async function initializeMCP() {
  try {
    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
    });

    mcpClient = new Client({
      name: 'qb-assistant-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    await mcpClient.connect(transport);

    // Get available tools
    const toolsResponse = await mcpClient.listTools();
    availableTools = toolsResponse.tools;

    console.log(`MCP client initialized with ${availableTools.length} tools`);
    return true;
  } catch (error) {
    console.error('Failed to initialize MCP client:', error);
    return false;
  }
}

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

4. **Your Workflow**:

   For QUERIES:
   - Execute the search/get operation
   - Present results clearly
   - If multiple results, format them in an easy-to-read way

   For MUTATIONS (create/update):
   - Parse the user's request
   - Search for any entities that need to be referenced (customers, items, accounts, etc.)
   - If ambiguous, ask for clarification
   - Once clear, create a detailed action plan
   - Present the plan in this format:
     **Action Plan:**
     - Operation: [create_customer | update_invoice | etc.]
     - Target: [entity description]
     - Changes: [list all fields and values]
     - Dependencies: [any related entities]

     **Do you want me to proceed? (yes/no)**
   - Wait for explicit "yes" before executing
   - Execute and show results

   For DELETE operations:
   - Immediately respond: "Delete operations are disabled for safety. If you need to delete a record, please use the QuickBooks Online interface directly."

5. **Available Tools**:
   You have access to QuickBooks MCP tools including:
   - search_customers, get_customer, create_customer, update_customer
   - search_vendors, get_vendor, create_vendor, update_vendor
   - search_invoices, read_invoice, create_invoice, update_invoice
   - search_items, read_item, create_item, update_item
   - search_bills, get_bill, create_bill, update_bill
   - search_estimates, get_estimate, create_estimate, update_estimate
   - And more...

6. **Response Format**:
   - Be conversational but precise
   - Use bullet points and formatting for clarity
   - Always include entity IDs when showing results
   - Show key fields (Name, Balance, Email, etc.) in results

**Example Interactions:**

User: "Show me all customers named John"
You: [Execute search_customers immediately, show results]

User: "Create a customer named John Smith"
You:
  **Action Plan:**
  - Operation: create_customer
  - Entity: Customer
  - Fields:
    * DisplayName: "John Smith"
    * GivenName: "John"
    * FamilyName: "Smith"

  **Do you want me to proceed? (yes/no)**

User: "Update John's email to john@example.com"
You: [Search for customers named John]
  Found 3 customers named John:
  1. John Smith (ID: 123) - john.smith@old.com
  2. John Doe (ID: 456) - jdoe@company.com
  3. John Wilson (ID: 789) - jwilson@biz.com

  Which customer do you want to update? Please specify by ID or provide more details.

Remember: ALWAYS prioritize user safety and data integrity. When in doubt, ask for clarification.`;

// Session management
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      conversationHistory: [],
      pendingAction: null,
    });
  }
  return sessions.get(sessionId);
}

// Check if message is a confirmation
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

// Check if a tool is a mutation
function isMutationTool(toolName) {
  return toolName.startsWith('create_') || toolName.startsWith('update_');
}

// Check if a tool is a delete operation
function isDeleteTool(toolName) {
  return toolName.startsWith('delete_') || toolName.includes('delete');
}

// Sanitize JSON Schema for OpenAI compatibility
// OpenAI requires all array types to have an 'items' property
function sanitizeSchemaForOpenAI(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // Create a copy to avoid mutating the original
  const sanitized = Array.isArray(schema) ? [...schema] : { ...schema };

  // Handle array type - ensure it has items
  if (sanitized.type === 'array') {
    if (!sanitized.items) {
      // Add a permissive items definition if missing
      sanitized.items = { type: 'object' };
    } else {
      // Recursively sanitize items
      sanitized.items = sanitizeSchemaForOpenAI(sanitized.items);
    }
  }

  // Recursively sanitize properties
  if (sanitized.properties && typeof sanitized.properties === 'object') {
    const sanitizedProps = {};
    for (const [key, value] of Object.entries(sanitized.properties)) {
      sanitizedProps[key] = sanitizeSchemaForOpenAI(value);
    }
    sanitized.properties = sanitizedProps;
  }

  // Recursively sanitize additionalProperties
  if (sanitized.additionalProperties && typeof sanitized.additionalProperties === 'object') {
    sanitized.additionalProperties = sanitizeSchemaForOpenAI(sanitized.additionalProperties);
  }

  // Recursively sanitize array items in definitions/defs
  if (sanitized.definitions) {
    const sanitizedDefs = {};
    for (const [key, value] of Object.entries(sanitized.definitions)) {
      sanitizedDefs[key] = sanitizeSchemaForOpenAI(value);
    }
    sanitized.definitions = sanitizedDefs;
  }

  if (sanitized.$defs) {
    const sanitizedDefs = {};
    for (const [key, value] of Object.entries(sanitized.$defs)) {
      sanitizedDefs[key] = sanitizeSchemaForOpenAI(value);
    }
    sanitized.$defs = sanitizedDefs;
  }

  // Handle allOf, anyOf, oneOf
  ['allOf', 'anyOf', 'oneOf'].forEach(key => {
    if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map(item => sanitizeSchemaForOpenAI(item));
    }
  });

  return sanitized;
}

// Convert MCP tools to OpenAI function format
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

// Convert MCP tools to Anthropic format
function convertToAnthropicTools(mcpTools) {
  return mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

// Call AI with Anthropic
async function callAnthropic(messages, tools) {
  return await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: messages,
    tools: tools,
  });
}

// Call AI with OpenAI
async function callOpenAI(messages, tools) {
  // Prepend system message
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

// Process chat message
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    const session = getSession(sessionId);

    // Check for confirmation if there's a pending action
    if (session.pendingAction) {
      const confirmation = isConfirmation(message);

      if (confirmation === 'yes') {
        // Execute the pending action
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
      // If not a clear confirmation, continue to AI
    }

    // Add user message to history
    session.conversationHistory.push({
      role: 'user',
      content: message,
    });

    let assistantMessage = '';
    let requiresConfirmation = false;
    let pendingToolCalls = [];

    if (AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'claude') {
      // ===== ANTHROPIC FLOW =====
      const tools = convertToAnthropicTools(availableTools);
      const response = await callAnthropic(session.conversationHistory, tools);

      // Process response
      let toolResults = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          assistantMessage += block.text;
        } else if (block.type === 'tool_use') {
          const toolName = block.name;
          const toolInput = block.input;

          // Block delete operations
          if (isDeleteTool(toolName)) {
            assistantMessage += '\n\n🚫 **Delete operations are blocked for safety.** Please use the QuickBooks Online interface directly if you need to delete records.';
            continue;
          }

          // For mutations, check if we should execute or plan
          if (isMutationTool(toolName)) {
            // If assistant already included a plan and "Do you want me to proceed", store as pending
            if (assistantMessage.toLowerCase().includes('do you want') || assistantMessage.toLowerCase().includes('proceed')) {
              session.pendingAction = { toolName, toolInput, toolUseId: block.id };
              requiresConfirmation = true;
              pendingToolCalls.push({ toolName, toolInput });
            } else {
              // Assistant didn't ask for confirmation, execute
              const result = await mcpClient.callTool({ name: toolName, arguments: toolInput });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            }
          } else {
            // For queries, execute immediately
            const result = await mcpClient.callTool({ name: toolName, arguments: toolInput });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }
      }

      // If we have tool results, need to continue conversation
      if (toolResults.length > 0) {
        session.conversationHistory.push({
          role: 'assistant',
          content: response.content,
        });

        session.conversationHistory.push({
          role: 'user',
          content: toolResults,
        });

        // Get final response from Claude
        const finalResponse = await callAnthropic(session.conversationHistory, tools);

        assistantMessage = '';
        for (const block of finalResponse.content) {
          if (block.type === 'text') {
            assistantMessage += block.text;
          }
        }

        session.conversationHistory.push({
          role: 'assistant',
          content: assistantMessage,
        });
      } else {
        // Add assistant response to history
        session.conversationHistory.push({
          role: 'assistant',
          content: assistantMessage,
        });
      }

    } else if (AI_PROVIDER === 'openai' || AI_PROVIDER === 'gpt') {
      // ===== OPENAI FLOW =====
      const tools = convertToOpenAITools(availableTools);
      const response = await callOpenAI(session.conversationHistory, tools);

      const choice = response.choices[0];
      const responseMessage = choice.message;

      // Check if there are tool calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Add assistant message with tool calls to history
        session.conversationHistory.push(responseMessage);

        const toolMessages = [];

        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const rawToolInput = JSON.parse(toolCall.function.arguments);

          // Debug logging
          console.log('OpenAI tool call:', { toolName, rawToolInput });

          // OpenAI respects the schema structure, so if it already has 'params', don't wrap again
          // Check if the input already has a 'params' key (OpenAI follows the schema exactly)
          const toolInput = rawToolInput.params ? rawToolInput : { params: rawToolInput };
          console.log('Tool input for MCP:', toolInput);

          // Block delete operations
          if (isDeleteTool(toolName)) {
            assistantMessage += '\n\n🚫 **Delete operations are blocked for safety.** Please use the QuickBooks Online interface directly if you need to delete records.';
            continue;
          }

          // For mutations, check if we should execute or plan
          if (isMutationTool(toolName)) {
            // Check if assistant asked for confirmation in the content
            const hasConfirmationRequest = responseMessage.content &&
              (responseMessage.content.toLowerCase().includes('do you want') ||
               responseMessage.content.toLowerCase().includes('proceed'));

            if (hasConfirmationRequest) {
              session.pendingAction = { toolName, toolInput, toolCallId: toolCall.id };
              requiresConfirmation = true;
              pendingToolCalls.push({ toolName, toolInput });
              assistantMessage = responseMessage.content || '';
            } else {
              // Execute the mutation
              try {
                const result = await mcpClient.callTool({ name: toolName, arguments: toolInput });
                console.log('Mutation result:', result);
                toolMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(result),
                });
              } catch (error) {
                console.error('Error calling mutation tool:', error);
                toolMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: error.message }),
                });
              }
            }
          } else {
            // For queries, execute immediately
            try {
              const result = await mcpClient.callTool({ name: toolName, arguments: toolInput });
              console.log('Query result:', result);
              toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              });
            } catch (error) {
              console.error('Error calling query tool:', error);
              toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message }),
              });
            }
          }
        }

        // If we have tool results, continue conversation
        if (toolMessages.length > 0) {
          session.conversationHistory.push(...toolMessages);

          // Get final response from OpenAI
          const finalResponse = await callOpenAI(session.conversationHistory, tools);
          assistantMessage = finalResponse.choices[0].message.content;

          session.conversationHistory.push({
            role: 'assistant',
            content: assistantMessage,
          });
        }
      } else {
        // No tool calls, just text response
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

// Execute pending action
async function executePendingAction(action) {
  try {
    console.log('Executing pending action:', { toolName: action.toolName, toolInput: action.toolInput });
    const result = await mcpClient.callTool({
      name: action.toolName,
      arguments: action.toolInput,
    });

    console.log('Action result:', result);
    return `Operation: ${action.toolName}\nResult: ${JSON.stringify(result.content, null, 2)}`;
  } catch (error) {
    console.error('Error executing action:', error);
    return `❌ Error executing action: ${error.message}`;
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiProvider: AI_PROVIDER,
    model: AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'claude' ? ANTHROPIC_MODEL : OPENAI_MODEL,
    mcpConnected: mcpClient !== null,
    toolsAvailable: availableTools.length,
  });
});

// Start server
const PORT = process.env.QB_ASSISTANT_PORT || 3000;

async function startServer() {
  const mcpReady = await initializeMCP();

  if (!mcpReady) {
    console.error('Failed to initialize MCP. Please check your QuickBooks configuration.');
    process.exit(1);
  }

  const providerInfo = AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'claude'
    ? `Claude (${ANTHROPIC_MODEL})`
    : `GPT (${OPENAI_MODEL})`;

  app.listen(PORT, () => {
    console.log(`\n🤖 QuickBooks AI Assistant running on http://localhost:${PORT}`);
    console.log(`🧠 AI Provider: ${providerInfo}`);
    console.log(`📊 Connected to QuickBooks MCP with ${availableTools.length} tools\n`);
  });
}

startServer();
