'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BillItem, Customer } from '@/lib/data';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';

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
  stall: string;
}

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<BillPrintData | null>(null);
  // The 'paper' prop from the query is no longer used, as this is now a single-purpose page.

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = decodeURIComponent(data);
        setBillData(JSON.parse(decodedData));
      } catch (error) {
        console.error('Failed to parse bill data:', error);
        router.push('/dashboard');
      }
    } else {
      router.push('/dashboard');
    }
  }, [searchParams, router]);

  if (!billData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading bill data...</p>
      </div>
    );
  }

  const {
    billNo,
    date,
    customer,
    items,
    itemsTotal,
    deliveryCharge,
    totalAmount,
    previousBalance,
    paidAmount,
    finalBalance,
  } = billData;

  return (
    <div>
      <div className="p-4 print:hidden flex justify-between items-center">
        <Button variant="outline" onClick={() => window.close()}>
          <X className="mr-2 h-4 w-4" />
          Close Preview
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
      <div className="print-root">
        <div id="print-area">
          <header className="text-center">
            <h1 className="header-title">M.C & SONS FISH COMPANY</h1>
            <p className="header-sub">
              No. 1, Fish Market, Palladam Road, Tiruppur - 641604
            </p>
            <p className="header-sub header-phone">📞 9894089889</p>
          </header>
          <div className="hr-line"></div>

          <div className="grid grid-cols-2 gap-4 mb-2 text-sm">
            <div>
              <p className="font-semibold">Cust Name:</p>
              <p className="cust-name">{customer?.name_ta || '-'}</p>
            </div>
            <div className="text-right">
              <p className="bill-no">
                <span className="font-semibold">Bill No:</span>{' '}
                <strong>{billNo}</strong>
              </p>
              <p className="bill-date">
                <span className="font-semibold">Date:</span>{' '}
                <strong>{format(new Date(date), 'dd-MM-yyyy')}</strong>
              </p>
            </div>
          </div>

          <Table className="print-table">
            <TableHeader>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <div className="table-header-line"></div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead className="col-sn">S/N</TableHead>
                <TableHead className="col-product">Product</TableHead>
                <TableHead className="col-qty">Qty</TableHead>
                <TableHead className="col-rate text-right">Rate</TableHead>
                <TableHead className="col-amount text-right">Amount</TableHead>
              </TableRow>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <div className="table-header-line"></div>
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="col-sn">{index + 1}</TableCell>
                  <TableCell className="col-product">{item.product}</TableCell>
                  <TableCell className="col-qty">
                    <span className="qty-uom">
                      <strong>{item.qty}</strong>
                      <span className="uom-text">{item.uom}</span>
                    </span>
                  </TableCell>
                  <TableCell className="col-rate text-right font-mono">
                    {item.rate.toFixed(2)}
                  </TableCell>
                  <TableCell className="col-amount text-right font-mono">
                    {item.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <div className="table-header-line"></div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="flex justify-end mt-2">
            <table className="summary-table">
                <tbody>
                    <tr>
                        <td className="summary-label">Items Total:</td>
                        <td className="summary-value font-mono">₹{itemsTotal.toFixed(2)}</td>
                    </tr>
                    {deliveryCharge > 0 && (
                        <tr>
                            <td className="summary-label">Delivery Charge:</td>
                            <td className="summary-value font-mono">₹{deliveryCharge.toFixed(2)}</td>
                        </tr>
                    )}
                    <tr className="summary-total-row">
                        <td className="summary-label">Bill Total:</td>
                        <td className="summary-value font-mono">₹{totalAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td className="summary-label">Previous Balance:</td>
                        <td className="summary-value font-mono">₹{previousBalance.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td className="summary-label">Paid Amount:</td>
                        <td className="summary-value font-mono">₹{paidAmount.toFixed(2)}</td>
                    </tr>
                    <tr className="summary-total-row summary-final-balance">
                        <td className="summary-label">Final Balance:</td>
                        <td className="summary-value font-mono">₹{finalBalance.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
          </div>
          <footer className="print-footer">Developed by MC & SONS</footer>
        </div>
      </div>
      <style jsx global>{`
        /* ===============================
          GLOBAL PRINT
        ================================ */
        @media print {
          * {
            color: #000 !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          body {
            margin: 0;
            padding: 0;
            background: white !important;
            print-color-adjust: exact;
          }

          .print\\:hidden {
            display: none !important;
          }

          /* Define the page size and margins for the laserjet printout */
          @page {
            size: 114mm 210mm;
            margin: 6mm;
          }
        }

        /* ===============================
          LASERJET BILL (114mm x 210mm)
        ================================ */
        @media print {
          .print-root {
            width: 102mm; /* 114mm - 2*6mm margin */
            margin: 0 auto;
            font-family: Arial, sans-serif;
            font-size: 12px;
          }

          #print-area {
            padding-top: 2mm;
          }

          .header-title {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .header-sub {
            font-size: 10px;
            line-height: 1.3;
          }
          .header-phone {
            font-size: 11px;
            margin-top: 2px;
          }
          .hr-line {
            border-top: 1px solid #000;
            margin: 4px 0;
          }
          .table-header-line {
            border-top: 1px solid #000;
          }

          .cust-name {
            font-weight: bold;
            font-size: 14px;
          }

          .bill-no, .bill-date {
            font-size: 11px;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 11px;
          }

          .print-table th,
          .print-table td {
            border: none;
            padding: 2px;
            vertical-align: top;
          }

          .print-table thead th {
            font-weight: bold;
            text-align: left;
          }
          .print-table .text-right {
            text-align: right;
          }
          .print-table .text-center {
            text-align: center;
          }

          .col-sn { width: 8%; }
          .col-product { width: 42%; word-wrap: break-word; }
          .col-qty { width: 15%; text-align: center; }
          .col-rate { width: 15%; text-align: right; }
          .col-amount { width: 20%; text-align: right; }

          .uom-text {
            margin-left: 3px;
          }
          
          .summary-table {
            width: 100%;
            max-width: 250px; /* Adjust as needed */
            border: 1px solid black;
            border-collapse: collapse;
            font-size: 11px;
          }
          .summary-table td {
            padding: 3px 6px;
            border-bottom: 1px solid black;
          }
           .summary-table tr:last-child td {
            border-bottom: none;
          }
          .summary-label {
            text-align: left;
            white-space: nowrap;
            font-weight: bold;
          }
          .summary-value {
            text-align: right;
            white-space: nowrap;
          }
          .summary-total-row td {
            border-top: 1px solid black;
            font-weight: bold;
          }
           .summary-final-balance td {
            font-size: 13px;
            font-weight: bold;
          }

          .print-footer {
            position: fixed;
            bottom: 6mm;
            left: 6mm;
            right: 6mm;
            text-align: center;
            font-size: 9px;
            color: #555 !important;
          }
        }
      `}</style>
    </div>
  );
}


export default function PrintBillPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}
