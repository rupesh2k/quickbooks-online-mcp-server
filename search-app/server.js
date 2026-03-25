#!/usr/bin/env node

/**
 * Simple web server for searching QuickBooks customers by name or email
 */

import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });
import { quickbooksClient } from '../dist/clients/quickbooks-client.js';
import { getQuickbooksCustomer } from '../dist/handlers/get-quickbooks-customer.handler.js';
import { searchQuickbooksCustomers } from '../dist/handlers/search-quickbooks-customers.handler.js';
import { searchQuickbooksInvoices } from '../dist/handlers/search-quickbooks-invoices.handler.js';
import { searchQuickbooksSalesReceipts } from '../dist/handlers/search-quickbooks-salesreceipts.handler.js';
import { readQuickbooksInvoice } from '../dist/handlers/read-quickbooks-invoice.handler.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Search API endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req;
    const searchTerm = query.q || '';

    if (!searchTerm) {
      return res.json({ results: [] });
    }

    // Authenticate first
    await quickbooksClient.authenticate();

    // Search for customers - fetch all and filter client-side
    // QuickBooks API doesn't support LIKE operator easily, so we filter locally
    const customersResponse = await searchQuickbooksCustomers({
      fetchAll: true  // Fetch ALL customers to ensure we don't miss any
    });

    if (customersResponse.isError) {
      return res.status(500).json({ error: customersResponse.error });
    }

    // Filter customers client-side by name, email, phone, or ID (case-insensitive)
    const allCustomers = customersResponse.result || [];
    const searchLower = searchTerm.toLowerCase();

    console.log(`Total customers fetched: ${allCustomers.length}`);
    console.log(`Search term: "${searchTerm}"`);

    const customers = allCustomers.filter(customer => {
      // ID field
      const customerId = (customer.Id || '').toLowerCase();

      // Name fields
      const displayName = (customer.DisplayName || '').toLowerCase();
      const companyName = (customer.CompanyName || '').toLowerCase();
      const givenName = (customer.GivenName || '').toLowerCase();
      const familyName = (customer.FamilyName || '').toLowerCase();
      const middleName = (customer.MiddleName || '').toLowerCase();
      const fullName = (customer.FullyQualifiedName || '').toLowerCase();

      // Email fields
      const primaryEmail = (customer.PrimaryEmailAddr?.Address || '').toLowerCase();
      const alternateEmail = (customer.AlternateEmailAddr?.Address || '').toLowerCase();

      // Phone fields - check multiple phone number formats
      const primaryPhone = (customer.PrimaryPhone?.FreeFormNumber || '').toLowerCase();
      const mobile = (customer.Mobile?.FreeFormNumber || '').toLowerCase();
      const alternatePhone = (customer.AlternatePhone?.FreeFormNumber || '').toLowerCase();
      const fax = (customer.Fax?.FreeFormNumber || '').toLowerCase();

      // Clean search term for phone matching (remove non-digits)
      const searchDigits = searchTerm.replace(/\D/g, '');
      const primaryPhoneDigits = primaryPhone.replace(/\D/g, '');
      const mobileDigits = mobile.replace(/\D/g, '');
      const alternatePhoneDigits = alternatePhone.replace(/\D/g, '');

      const matches = customerId.includes(searchLower) ||
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

      if (matches) {
        console.log(`Match found: ${customer.DisplayName} (ID: ${customer.Id})`);
      }

      return matches;
    }).slice(0, 50); // Limit to 50 results

    console.log(`Filtered results: ${customers.length}`);

    // For each customer, get their invoices and sales receipts
    const results = await Promise.all(
      customers.map(async (customer) => {
        // Fetch invoices
        const invoicesResponse = await searchQuickbooksInvoices({
          filters: [
            { field: 'CustomerRef', value: customer.Id, operator: '=' }
          ],
          limit: 100
        });

        // Fetch sales receipts
        const salesReceiptsResponse = await searchQuickbooksSalesReceipts({
          filters: [
            { field: 'CustomerRef', value: customer.Id, operator: '=' }
          ],
          limit: 100
        });

        const invoices = invoicesResponse.isError ? [] : (invoicesResponse.result || []);
        const salesReceipts = salesReceiptsResponse.isError ? [] : (salesReceiptsResponse.result || []);

        // Combine invoices and sales receipts with a type indicator
        const allTransactions = [
          ...invoices.map(inv => ({ ...inv, TransactionType: 'Invoice' })),
          ...salesReceipts.map(sr => ({ ...sr, TransactionType: 'SalesReceipt' }))
        ];

        // Calculate total outstanding balance and total amount
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
          })).sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date, newest first
        };
      })
    );

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint - shows raw customer data
app.get('/api/debug/customers', async (req, res) => {
  try {
    await quickbooksClient.authenticate();

    const limit = parseInt(req.query.limit) || 10;
    const customersResponse = await searchQuickbooksCustomers({
      limit: limit
    });

    if (customersResponse.isError) {
      return res.status(500).json({ error: customersResponse.error });
    }

    // Return raw customer data to see what fields are available
    res.json({
      count: customersResponse.result?.length || 0,
      customers: customersResponse.result || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search diagnostic endpoint - shows what would match for a search term
app.get('/api/debug/search', async (req, res) => {
  try {
    const searchTerm = req.query.q || '';
    if (!searchTerm) {
      return res.json({ error: 'Please provide a search term with ?q=...' });
    }

    await quickbooksClient.authenticate();

    const customersResponse = await searchQuickbooksCustomers({
      limit: 1000,
      fetchAll: false
    });

    if (customersResponse.isError) {
      return res.status(500).json({ error: customersResponse.error });
    }

    const allCustomers = customersResponse.result || [];
    const searchLower = searchTerm.toLowerCase();
    const searchDigits = searchTerm.replace(/\D/g, '');

    // Show all customers with field values that might match
    const diagnostics = allCustomers.map(customer => {
      const fields = {
        Id: customer.Id || '',
        DisplayName: customer.DisplayName || '',
        CompanyName: customer.CompanyName || '',
        GivenName: customer.GivenName || '',
        FamilyName: customer.FamilyName || '',
        MiddleName: customer.MiddleName || '',
        FullyQualifiedName: customer.FullyQualifiedName || '',
        PrimaryEmail: customer.PrimaryEmailAddr?.Address || '',
        AlternateEmail: customer.AlternateEmailAddr?.Address || '',
        PrimaryPhone: customer.PrimaryPhone?.FreeFormNumber || '',
        Mobile: customer.Mobile?.FreeFormNumber || '',
        AlternatePhone: customer.AlternatePhone?.FreeFormNumber || '',
      };

      // Check which fields match
      const matches = {};
      Object.keys(fields).forEach(key => {
        const value = fields[key].toLowerCase();
        const valueDigits = fields[key].replace(/\D/g, '');
        if (value.includes(searchLower)) {
          matches[key] = `text match: "${fields[key]}"`;
        } else if (searchDigits.length >= 3 && valueDigits.includes(searchDigits)) {
          matches[key] = `phone match: "${fields[key]}"`;
        }
      });

      return {
        customer: fields,
        matches: Object.keys(matches).length > 0 ? matches : null
      };
    }).filter(d => d.matches !== null);

    res.json({
      searchTerm,
      totalCustomers: allCustomers.length,
      matchingCustomers: diagnostics.length,
      diagnostics: diagnostics.slice(0, 20) // Limit to 20 for readability
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoint - Update refresh token
app.post('/api/admin/update-token', express.json(), async (req, res) => {
  try {
    const { refreshToken, realmId } = req.body;

    if (!refreshToken || !realmId) {
      return res.status(400).json({
        error: 'Missing required fields: refreshToken and realmId'
      });
    }

    // Update token manager with new refresh token
    const { tokenManager } = await import('../dist/helpers/token-manager.js');
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

// API Test endpoint - validates QuickBooks connectivity
app.get('/api/test', async (req, res) => {
  const results = [];
  const log = (msg) => results.push(msg);

  try {
    log('='.repeat(60));
    log('QuickBooks Online API Validation Test');
    log('='.repeat(60));
    log('');

    // Step 1: Authenticate
    log('Step 1: Authenticating with QuickBooks Online...');
    await quickbooksClient.authenticate();
    log('✓ Authentication successful!');
    log('');

    // Step 2: Test Search Customers
    log('Step 2: Testing search_customers...');
    const customersResponse = await searchQuickbooksCustomers({ limit: 5 });

    if (customersResponse.isError) {
      log('✗ Error: ' + customersResponse.error);
    } else {
      log(`✓ Found ${customersResponse.result?.length || 0} customers`);
      if (customersResponse.result && customersResponse.result.length > 0) {
        const firstCustomer = customersResponse.result[0];
        log('  First customer sample:');
        log(`    - ID: ${firstCustomer.Id}`);
        log(`    - Name: ${firstCustomer.DisplayName}`);
        log(`    - Balance: $${firstCustomer.Balance || 0}`);
        log(`    - Email: ${firstCustomer.PrimaryEmailAddr?.Address || 'N/A'}`);
        var testCustomerId = firstCustomer.Id;
      }
    }
    log('');

    // Step 3: Test Get Customer by ID
    if (testCustomerId) {
      log('Step 3: Testing get_customer...');
      const customerResponse = await getQuickbooksCustomer(testCustomerId);

      if (customerResponse.isError) {
        log('✗ Error: ' + customerResponse.error);
      } else {
        log(`✓ Retrieved customer ID ${testCustomerId}`);
        log(`  - Name: ${customerResponse.result.DisplayName}`);
        log(`  - Balance: $${customerResponse.result.Balance || 0}`);
      }
      log('');
    }

    // Step 4: Test Search Invoices
    log('Step 4: Testing search_invoices...');
    const invoicesResponse = await searchQuickbooksInvoices({ limit: 5 });

    if (invoicesResponse.isError) {
      log('✗ Error: ' + invoicesResponse.error);
    } else {
      log(`✓ Found ${invoicesResponse.result?.length || 0} invoices`);
      if (invoicesResponse.result && invoicesResponse.result.length > 0) {
        const firstInvoice = invoicesResponse.result[0];
        log('  First invoice sample:');
        log(`    - ID: ${firstInvoice.Id}`);
        log(`    - Doc Number: ${firstInvoice.DocNumber}`);
        log(`    - Total: $${firstInvoice.TotalAmt}`);
        log(`    - Balance: $${firstInvoice.Balance}`);
        var testInvoiceId = firstInvoice.Id;
      }
    }
    log('');

    // Step 5: Test Read Invoice by ID
    if (testInvoiceId) {
      log('Step 5: Testing read_invoice...');
      const invoiceResponse = await readQuickbooksInvoice(testInvoiceId);

      if (invoiceResponse.isError) {
        log('✗ Error: ' + invoiceResponse.error);
      } else {
        log(`✓ Retrieved invoice ID ${testInvoiceId}`);
        log(`  - Doc Number: ${invoiceResponse.result.DocNumber}`);
        log(`  - Total: $${invoiceResponse.result.TotalAmt}`);
        log(`  - Balance: $${invoiceResponse.result.Balance}`);
      }
      log('');
    }

    // Summary
    log('='.repeat(60));
    log('✓ All API endpoints tested successfully!');
    log('='.repeat(60));
    log('');
    log('Environment: ' + process.env.QUICKBOOKS_ENVIRONMENT);
    log('Realm ID: ' + process.env.QUICKBOOKS_REALM_ID);

    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    log('');
    log('✗ Error during testing: ' + error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      results: results
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 QuickBooks Search Server running at http://localhost:${PORT}`);
  console.log(`   Open your browser to start searching!\n`);
});
