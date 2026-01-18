'use server';

// This module is currently stubbed out. The 'escpos-usb' package, which is required
// for direct communication with USB printers from the server, has a native dependency
// that failed to install in the cloud-based development environment. Native dependencies
// often require system-level build tools (like Python and C++ compilers) that are not
// available in this sandboxed environment.
//
// As a result, direct thermal printing from the server is disabled to allow the rest
// of the application to build and run correctly.
//
// To re-enable this feature in a local development environment, you would need to:
// 1. Install Python and C++ build tools (e.g., `windows-build-tools` on Windows).
// 2. Re-install the dependencies: `npm install escpos escpos-usb iconv-lite`
// 3. Restore the original code for this file which uses these libraries.

import { BillItem, Customer } from './data';

interface BillPrintData {
  billNo: string;
  date: string;
  customer: Customer;
  items: BillItem[];
  itemsTotal: number;
  deliveryCharge: number;
  totalAmount: number;
  previousBalance: number;
  paidAmount: number;
  finalBalance: number;
}

export async function printThermalBill(billData: BillPrintData) {
  const errorMessage =
    'Direct thermal printing is unavailable because a required native dependency (for USB access) could not be installed in the current environment.';
  console.error('Thermal Printing Error:', errorMessage);
  return { success: false, error: errorMessage };
}
