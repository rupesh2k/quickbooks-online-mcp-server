# QuickBooks AI Assistant

An intelligent, conversational interface for interacting with your QuickBooks Online data through natural language. Built with support for both **Claude AI (Anthropic)** and **GPT (OpenAI)**, this assistant provides a safe and user-friendly way to query and modify your QuickBooks data.

## Features

### 🤖 Natural Language Interface
- Ask questions in plain English
- No need to remember command syntax
- Conversational interaction with context awareness

### 🛡️ Safety First
- **Action Preview**: Always shows what it plans to do before executing
- **User Confirmation**: Requires explicit "yes" to proceed with any data modification
- **Single Operations Only**: No bulk operations - works with one record at a time
- **Delete Protection**: Delete operations are completely blocked for safety
- **Conflict Resolution**: When multiple matches are found, asks you to choose

### ✨ Capabilities

#### Queries (Execute Immediately)
- Search for customers, vendors, invoices, bills, etc.
- Get specific records by ID
- Filter and find data based on various criteria
- View balances, totals, and summaries

#### Mutations (Require Confirmation)
- Create new customers, vendors, invoices, etc.
- Update existing records
- Shows detailed action plan before execution
- Waits for your approval

#### Blocked Operations (For Safety)
- ❌ Delete operations
- ❌ Bulk operations
- ❌ Mass updates

## Installation

### Prerequisites
1. QuickBooks MCP Server installed and configured
2. Node.js 18+ installed
3. **AI Provider** (choose one):
   - **Anthropic API key** (for Claude) - Get from https://console.anthropic.com/
   - **OpenAI API key** (for GPT) - Get from https://platform.openai.com/api-keys

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Create a `.env` file with your chosen AI provider:

   **Option A: Using Anthropic (Claude)**
   ```env
   # AI Provider
   AI_PROVIDER=anthropic

   # Your Anthropic API key
   ANTHROPIC_API_KEY=sk-ant-...

   # Optional: Model selection (defaults to claude-3-5-sonnet-20241022)
   ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

   # Optional: Custom port (defaults to 3000)
   QB_ASSISTANT_PORT=3000

   # QuickBooks credentials (should already be set)
   QUICKBOOKS_CLIENT_ID=...
   QUICKBOOKS_CLIENT_SECRET=...
   QUICKBOOKS_ENVIRONMENT=sandbox
   ```

   **Option B: Using OpenAI (GPT)**
   ```env
   # AI Provider
   AI_PROVIDER=openai

   # Your OpenAI API key
   OPENAI_API_KEY=sk-...

   # Optional: Model selection (defaults to gpt-4o)
   OPENAI_MODEL=gpt-4o

   # Optional: Custom port (defaults to 3000)
   QB_ASSISTANT_PORT=3000

   # QuickBooks credentials (should already be set)
   QUICKBOOKS_CLIENT_ID=...
   QUICKBOOKS_CLIENT_SECRET=...
   QUICKBOOKS_ENVIRONMENT=sandbox
   ```

3. **Build the MCP server** (if not already built):
   ```bash
   npm run build
   ```

4. **Start the assistant**:
   ```bash
   npm run assistant
   ```

5. **Open in browser**:
   Navigate to http://localhost:3000

## Usage Examples

### Querying Data

**Simple Search:**
```
You: Show me all customers
Assistant: [Immediately executes search and displays results]
```

**Filtered Search:**
```
You: Find invoices over $1000
Assistant: [Searches and shows matching invoices with details]
```

**Specific Record:**
```
You: Get customer with ID 123
Assistant: [Retrieves and displays customer details]
```

### Creating Records

```
You: Create a new customer named Acme Corporation with email acme@example.com
Assistant:
  **Action Plan:**
  - Operation: create_customer
  - Entity: Customer
  - Fields:
    * DisplayName: "Acme Corporation"
    * PrimaryEmailAddr: "acme@example.com"

  **Do you want me to proceed? (yes/no)**

You: yes
Assistant: ✅ **Action Completed**
  Customer created successfully with ID: 456
  [Shows full customer details]
```

### Updating Records

**With Ambiguity:**
```
You: Update John's email to john.new@example.com
Assistant:
  Found 3 customers named John:
  1. John Smith (ID: 123) - john.smith@old.com
  2. John Doe (ID: 456) - jdoe@company.com
  3. John Wilson (ID: 789) - jwilson@biz.com

  Which customer do you want to update? Please specify by ID or provide more details.

You: Update customer 123
Assistant:
  **Action Plan:**
  - Operation: update_customer
  - Target: John Smith (ID: 123)
  - Changes:
    * PrimaryEmailAddr: "john.new@example.com"

  **Do you want me to proceed? (yes/no)**

You: yes
Assistant: ✅ **Action Completed**
  Customer updated successfully.
```

### Blocked Operations

```
You: Delete customer John Smith
Assistant: 🚫 **Delete operations are blocked for safety.** Please use the QuickBooks Online interface directly if you need to delete records.
```

## Architecture

### Components

1. **Express Server** (`server.js`)
   - REST API for chat interactions
   - Session management
   - MCP client integration

2. **AI Integration** (Anthropic Claude or OpenAI GPT)
   - Natural language understanding
   - Intent classification (query vs mutation)
   - Action planning and safety checks
   - Configurable provider and model selection

3. **MCP Client**
   - Connects to QuickBooks MCP server
   - Executes tool calls
   - Returns structured results

4. **Web UI** (`public/index.html`)
   - Chat interface
   - Real-time messaging
   - Confirmation dialogs

### Security Features

#### Multi-Layer Safety
1. **AI System Prompt**: Claude is instructed to never execute unsafe operations
2. **Tool Classification**: Server identifies mutation vs query operations
3. **Confirmation Flow**: User must explicitly approve mutations
4. **Session Isolation**: Each user session is independent

#### Data Protection
- No bulk operations allowed
- Delete operations completely blocked at server level
- Single-record operations only
- Explicit confirmation required for all writes

## API Reference

### POST /api/chat

Send a message to the assistant.

**Request:**
```json
{
  "message": "Show me all customers",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "response": "Found 5 customers: ...",
  "requiresConfirmation": false,
  "pendingActions": []
}
```

### GET /api/health

Check server status.

**Response:**
```json
{
  "status": "ok",
  "mcpConnected": true,
  "toolsAvailable": 45
}
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | No | anthropic | AI provider to use: 'anthropic' or 'openai' |
| `ANTHROPIC_API_KEY` | Conditional | - | Your Anthropic API key (required if AI_PROVIDER=anthropic) |
| `ANTHROPIC_MODEL` | No | claude-3-5-sonnet-20241022 | Anthropic model to use |
| `OPENAI_API_KEY` | Conditional | - | Your OpenAI API key (required if AI_PROVIDER=openai) |
| `OPENAI_MODEL` | No | gpt-4o | OpenAI model to use |
| `QB_ASSISTANT_PORT` | No | 3000 | Port for web server |
| `QUICKBOOKS_CLIENT_ID` | Yes | - | QuickBooks OAuth client ID |
| `QUICKBOOKS_CLIENT_SECRET` | Yes | - | QuickBooks OAuth client secret |
| `QUICKBOOKS_ENVIRONMENT` | Yes | sandbox | QuickBooks environment |

### Customization

#### Switch AI Provider
Change the `AI_PROVIDER` in your `.env` file:
```env
# Use Anthropic Claude
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OR use OpenAI GPT
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

#### Change AI Model
Update the model in your `.env` file:

**For Anthropic:**
```env
# Options: claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-sonnet-20240229
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**For OpenAI:**
```env
# Options: gpt-4o, gpt-4-turbo, gpt-4, gpt-3.5-turbo
OPENAI_MODEL=gpt-4o
```

#### Adjust Safety Rules
Modify the `SYSTEM_PROMPT` in `server.js` to customize behavior.

## Troubleshooting

### "Failed to initialize MCP"
- Ensure MCP server is built: `npm run build`
- Check QuickBooks credentials in `.env`
- Verify OAuth token is valid

### "MCP connection is not established"
- The MCP server may have failed to start
- Check console for error messages
- Verify `dist/index.js` exists

### "Error: Missing ANTHROPIC_API_KEY" or "Error: Missing OPENAI_API_KEY"
- Add the appropriate API key to your `.env` file based on your `AI_PROVIDER`
- For Anthropic: Get API key from https://console.anthropic.com/
- For OpenAI: Get API key from https://platform.openai.com/api-keys

### Assistant not confirming mutations
- Check the system prompt includes confirmation requirements
- Verify `isMutationTool()` function is working correctly
- Review session state in browser console

## Development

### Running in Development Mode

1. **Watch mode for TypeScript**:
   ```bash
   npm run watch
   ```

2. **In another terminal, run assistant**:
   ```bash
   npm run assistant
   ```

3. **Enable debug logging**:
   ```javascript
   // In server.js, add:
   const DEBUG = true;
   console.log('Debug:', ...);
   ```

### Adding New Features

1. **Custom Tools**: Add new MCP tools in the main server
2. **UI Enhancements**: Modify `public/index.html`
3. **AI Behavior**: Adjust `SYSTEM_PROMPT` in `server.js`

## Best Practices

### For Users

1. **Be Specific**: "Update customer Acme Corp" is better than "update customer"
2. **Review Plans**: Always read the action plan before confirming
3. **Use IDs**: When multiple matches exist, reference by ID
4. **Ask Questions**: The assistant can explain what operations are available

### For Developers

1. **Test Mutations**: Always test create/update operations in sandbox
2. **Session Management**: Consider implementing session cleanup
3. **Error Handling**: Add comprehensive error messages
4. **Logging**: Log all mutation operations for audit trail

## Limitations

- **No Batch Operations**: Cannot create/update multiple records at once
- **No Deletes**: Delete operations are blocked for safety
- **Single Session**: Currently single-user (no multi-user auth)
- **Token Limits**: Long conversations may hit Claude token limits
- **Rate Limits**: Subject to Anthropic and QuickBooks API rate limits

## Future Enhancements

- [ ] Multi-user authentication
- [ ] Audit log for all mutations
- [ ] Export conversation history
- [ ] Advanced filtering and reporting
- [ ] Scheduled operations
- [ ] Undo functionality for mutations
- [ ] Voice input support
- [ ] Mobile-responsive UI improvements

## Support

For issues or questions:
1. Check QuickBooks MCP Server documentation
2. Review Anthropic Claude API docs
3. Check server logs for errors
4. Open an issue on GitHub

## License

MIT License - See main project LICENSE file
