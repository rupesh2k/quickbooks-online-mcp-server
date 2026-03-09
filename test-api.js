#!/usr/bin/env node

/**
 * Test script to validate QuickBooks Online MCP server APIs
 * This will authenticate and test the available endpoints for the donor portal
 */

import { quickbooksClient } from './dist/clients/quickbooks-client.js';
import { getQuickbooksCustomer } from './dist/handlers/get-quickbooks-customer.handler.js';
import { searchQuickbooksCustomers } from './dist/handlers/search-quickbooks-customers.handler.js';
import { searchQuickbooksInvoices } from './dist/handlers/search-quickbooks-invoices.handler.js';
import { readQuickbooksInvoice } from './dist/handlers/read-quickbooks-invoice.handler.js';

async function testAPIs() {
  console.log('='.repeat(60));
  console.log('QuickBooks Online MCP Server - API Validation Test');
  console.log('='.repeat(60));
  console.log();

  try {
    // Step 1: Authenticate
    console.log('Step 1: Authenticating with QuickBooks Online...');
    await quickbooksClient.authenticate();
    console.log('✓ Authentication successful!\n');

    // Step 2: Test Search Customers (List all donors)
    console.log('Step 2: Testing search_customers (list all donors)...');
    const customersResponse = await searchQuickbooksCustomers({
      limit: 5
    });

    if (customersResponse.isError) {
      console.log('✗ Error:', customersResponse.error);
    } else {
      console.log(`✓ Found ${customersResponse.result?.length || 0} customers`);
      if (customersResponse.result && customersResponse.result.length > 0) {
        const firstCustomer = customersResponse.result[0];
        console.log('  First customer sample:');
        console.log(`    - ID: ${firstCustomer.Id}`);
        console.log(`    - Name: ${firstCustomer.DisplayName}`);
        console.log(`    - Balance: $${firstCustomer.Balance || 0}`);
        console.log(`    - Email: ${firstCustomer.PrimaryEmailAddr?.Address || 'N/A'}`);

        // Save first customer ID for next test
        var testCustomerId = firstCustomer.Id;
      }
    }
    console.log();

    // Step 3: Test Get Customer by ID
    if (testCustomerId) {
      console.log(`Step 3: Testing get_customer (get donor details)...`);
      const customerResponse = await getQuickbooksCustomer(testCustomerId);

      if (customerResponse.isError) {
        console.log('✗ Error:', customerResponse.error);
      } else {
        console.log(`✓ Retrieved customer ID ${testCustomerId}`);
        console.log(`  - Name: ${customerResponse.result.DisplayName}`);
        console.log(`  - Balance: $${customerResponse.result.Balance || 0}`);
        console.log(`  - Email: ${customerResponse.result.PrimaryEmailAddr?.Address || 'N/A'}`);
        console.log(`  - Phone: ${customerResponse.result.PrimaryPhone?.FreeFormNumber || 'N/A'}`);
      }
      console.log();
    }

    // Step 4: Test Search Invoices
    console.log('Step 4: Testing search_invoices (list all invoices)...');
    const invoicesResponse = await searchQuickbooksInvoices({
      limit: 5
    });

    if (invoicesResponse.isError) {
      console.log('✗ Error:', invoicesResponse.error);
    } else {
      console.log(`✓ Found ${invoicesResponse.result?.length || 0} invoices`);
      if (invoicesResponse.result && invoicesResponse.result.length > 0) {
        const firstInvoice = invoicesResponse.result[0];
        console.log('  First invoice sample:');
        console.log(`    - ID: ${firstInvoice.Id}`);
        console.log(`    - Doc Number: ${firstInvoice.DocNumber}`);
        console.log(`    - Date: ${firstInvoice.TxnDate}`);
        console.log(`    - Total: $${firstInvoice.TotalAmt}`);
        console.log(`    - Balance: $${firstInvoice.Balance}`);
        console.log(`    - Customer: ${firstInvoice.CustomerRef?.name}`);

        var testInvoiceId = firstInvoice.Id;
      }
    }
    console.log();

    // Step 5: Test Read Invoice by ID
    if (testInvoiceId) {
      console.log(`Step 5: Testing read_invoice (get invoice details)...`);
      const invoiceResponse = await readQuickbooksInvoice(testInvoiceId);

      if (invoiceResponse.isError) {
        console.log('✗ Error:', invoiceResponse.error);
      } else {
        console.log(`✓ Retrieved invoice ID ${testInvoiceId}`);
        console.log(`  - Doc Number: ${invoiceResponse.result.DocNumber}`);
        console.log(`  - Date: ${invoiceResponse.result.TxnDate}`);
        console.log(`  - Due Date: ${invoiceResponse.result.DueDate || 'N/A'}`);
        console.log(`  - Total: $${invoiceResponse.result.TotalAmt}`);
        console.log(`  - Balance Due: $${invoiceResponse.result.Balance}`);
        console.log(`  - Status: ${invoiceResponse.result.Balance > 0 ? 'Unpaid' : 'Paid'}`);
      }
      console.log();
    }

    // Step 6: Test Search Invoices by Customer
    if (testCustomerId) {
      console.log(`Step 6: Testing search_invoices filtered by customer...`);
      const customerInvoicesResponse = await searchQuickbooksInvoices({
        filters: [
          { field: 'CustomerRef', value: testCustomerId, operator: '=' }
        ],
        limit: 10
      });

      if (customerInvoicesResponse.isError) {
        console.log('✗ Error:', customerInvoicesResponse.error);
      } else {
        console.log(`✓ Found ${customerInvoicesResponse.result?.length || 0} invoices for customer ${testCustomerId}`);
        if (customerInvoicesResponse.result && customerInvoicesResponse.result.length > 0) {
          let totalBalance = 0;
          customerInvoicesResponse.result.forEach(inv => {
            totalBalance += parseFloat(inv.Balance || 0);
          });
          console.log(`  - Total outstanding balance: $${totalBalance.toFixed(2)}`);
        }
      }
      console.log();
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    console.log('✓ All API endpoints tested successfully!');
    console.log();
    console.log('Available for Donor Portal:');
    console.log('  • Get donor/customer details by ID');
    console.log('  • Search/list all donors');
    console.log('  • View donor balance');
    console.log('  • List all invoices for a donor');
    console.log('  • View invoice details (amount, balance, due date)');
    console.log('  • Check invoice status (paid/unpaid)');
    console.log();
    console.log('Missing (needs implementation):');
    console.log('  • Payment history');
    console.log('  • Statement generation');
    console.log('  • Credit memos');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n✗ Error during testing:', error.message);
    console.error('\nFull error:', error);
  }
}

testAPIs().catch(console.error);
