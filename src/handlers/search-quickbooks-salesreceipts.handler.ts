import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { buildQuickbooksSearchCriteria, QuickbooksSearchCriteriaInput } from "../helpers/build-quickbooks-search-criteria.js";

export type SalesReceiptSearchCriteria = QuickbooksSearchCriteriaInput;

/**
 * Search for sales receipts in QuickBooks Online using criteria supported by node-quickbooks findSalesReceipts.
 */
export async function searchQuickbooksSalesReceipts(criteria: SalesReceiptSearchCriteria): Promise<ToolResponse<any[]>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();
    const normalizedCriteria = buildQuickbooksSearchCriteria(criteria);

    return new Promise((resolve) => {
      (quickbooks as any).findSalesReceipts(normalizedCriteria, (err: any, salesReceipts: any) => {
        if (err) {
          resolve({ result: null, isError: true, error: formatError(err) });
        } else {
          resolve({
            result: salesReceipts.QueryResponse.SalesReceipt || [],
            isError: false,
            error: null,
          });
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
