#!/usr/bin/env node

/**
 * Simple web server for searching QuickBooks customers by name or email
 */

import express from 'express';
import { quickbooksClient } from './dist/clients/quickbooks-client.js';
import { searchQuickbooksCustomers } from './dist/handlers/search-quickbooks-customers.handler.js';
import { searchQuickbooksInvoices } from './dist/handlers/search-quickbooks-invoices.handler.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

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

    // Search for customers by name or email
    const customersResponse = await searchQuickbooksCustomers({
      filters: [
        { field: 'DisplayName', value: searchTerm, operator: 'LIKE' }
      ],
      limit: 50
    });

    if (customersResponse.isError) {
      return res.status(500).json({ error: customersResponse.error });
    }

    const customers = customersResponse.result || [];

    // For each customer, get their invoices
    const results = await Promise.all(
      customers.map(async (customer) => {
        const invoicesResponse = await searchQuickbooksInvoices({
          filters: [
            { field: 'CustomerRef', value: customer.Id, operator: '=' }
          ],
          limit: 100
        });

        const invoices = invoicesResponse.isError ? [] : (invoicesResponse.result || []);

        // Calculate total outstanding balance
        const outstandingBalance = invoices.reduce((sum, inv) => sum + parseFloat(inv.Balance || 0), 0);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.TotalAmt || 0), 0);

        return {
          id: customer.Id,
          name: customer.DisplayName,
          email: customer.PrimaryEmailAddr?.Address || 'N/A',
          phone: customer.PrimaryPhone?.FreeFormNumber || 'N/A',
          balance: parseFloat(customer.Balance || 0),
          address: customer.BillAddr ?
            `${customer.BillAddr.Line1 || ''} ${customer.BillAddr.City || ''}, ${customer.BillAddr.CountrySubDivisionCode || ''} ${customer.BillAddr.PostalCode || ''}`.trim()
            : 'N/A',
          invoiceCount: invoices.length,
          totalInvoiced: totalInvoiced,
          outstandingBalance: outstandingBalance,
          invoices: invoices.map(inv => ({
            id: inv.Id,
            docNumber: inv.DocNumber,
            date: inv.TxnDate,
            dueDate: inv.DueDate,
            total: parseFloat(inv.TotalAmt || 0),
            balance: parseFloat(inv.Balance || 0),
            status: parseFloat(inv.Balance || 0) > 0 ? 'Unpaid' : 'Paid'
          }))
        };
      })
    );

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 QuickBooks Search Server running at http://localhost:${PORT}`);
  console.log(`   Open your browser to start searching!\n`);
});
