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
  const paper = searchParams.get('paper') || 'thermal';

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
      <div className={`print-root ${paper}`}>
        <div id="print-area">
          <header className="text-center">
            <h1 className="header-title">M.C & SONS FISH COMPANY</h1>
            <p className="header-sub">
              No. 1, Fish Market, Palladam Road,
              <span className="city">Tiruppur - 641604</span>
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

                  <TableCell className="col-rate text-right">
                    {item.rate.toFixed(2)}
                  </TableCell>
                  <TableCell className="col-amount text-right">
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
                        <td className="summary-value">₹{itemsTotal.toFixed(2)}</td>
                    </tr>
                    {deliveryCharge > 0 && (
                        <tr>
                            <td className="summary-label">Delivery Charge:</td>
                            <td className="summary-value">₹{deliveryCharge.toFixed(2)}</td>
                        </tr>
                    )}
                    <tr className="summary-total-row">
                        <td className="summary-label">Bill Total:</td>
                        <td className="summary-value">₹{totalAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td className="summary-label">Previous Balance:</td>
                        <td className="summary-value">₹{previousBalance.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td className="summary-label">Paid Amount:</td>
                        <td className="summary-value">₹{paidAmount.toFixed(2)}</td>
                    </tr>
                    <tr className="summary-total-row summary-final-balance">
                        <td className="summary-label">Final Balance:</td>
                        <td className="summary-value">₹{finalBalance.toFixed(2)}</td>
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
            -webkit-font-smoothing: none;
            font-smoothing: none;
            text-rendering: optimizeSpeed;
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
        }

        /* ===============================
          THERMAL (106mm)
        ================================ */
        @media print {
          .print-root.thermal {
            width: 106mm;
            max-width: 106mm;
            margin: 0 auto;
            font-family: 'Courier New', 'Lucida Console', monospace !important;
          }

          #print-area {
            padding: 2mm 4mm 18mm 4mm;
            margin-top: 0;
          }

          .header-title {
            font-size: 22px !important;
            font-weight: 700;
            letter-spacing: 0.5px;
            line-height: 1.2;
            white-space: nowrap;
          }
          .header-sub {
            display: block;
            text-align: center;
            font-size: 13px !important;
            font-weight: 700;
            line-height: 1.3;
            margin-top: 2px;
          }
          .header-sub .city {
            display: block;
          }
          .header-phone {
            margin-top: 4px;
          }
          .hr-line {
            border-top: 2px solid #000;
            margin: 6px 0;
          }
          .table-header-line {
            border-top: 2px solid #000;
            margin: 0;
          }

          .cust-name {
            font-weight: 700;
            font-size: 15px;
          }

          .bill-no > strong,
          .bill-date > strong {
            font-weight: 700;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .print-table tr,
          .print-table th,
          .print-table td {
            border: none;
          }

          .print-table thead th {
            font-weight: 800 !important;
            font-size: 14px !important;
            padding: 2px 4px;
            color: #000;
            vertical-align: middle;
          }

          .print-table tbody td {
            font-weight: 700 !important;
            font-size: 11px;
            padding: 2px 4px;
            vertical-align: top;
          }

          .col-sn {
            width: 8%;
            text-align: left;
            white-space: nowrap;
          }
          .col-product {
            width: 36%;
            text-align: left;
            word-wrap: break-word;
          }
          .col-qty {
            width: 18%;
            text-align: center;
            white-space: nowrap;
          }
          .col-rate {
            width: 18%;
            text-align: right;
            white-space: nowrap;
          }
          .col-amount {
            width: 20%;
            text-align: right;
            white-space: nowrap;
          }

          .qty-uom {
            white-space: nowrap;
          }
          .uom-text {
            font-weight: 700 !important;
            margin-left: 2px;
          }
          
          /* NEW SUMMARY TABLE STYLES */
          .summary-table {
            width: 100%;
            max-width: 300px;
            border: 2px solid black;
            border-collapse: collapse;
          }
          .summary-table td {
            font-weight: 700 !important;
            font-size: 15px !important;
            padding: 2px 5px;
            border-bottom: 1px solid black;
          }
           .summary-table tr:last-child td {
            border-bottom: none;
          }
          .summary-label {
            text-align: left;
            white-space: nowrap;
          }
          .summary-value {
            text-align: right;
            font-family: 'Courier New', monospace;
            white-space: nowrap;
          }
          .summary-total-row td {
            font-weight: 800 !important;
            border-top: 2px solid black;
          }
           .summary-final-balance td {
            font-size: 16px !important;
            font-weight: 800 !important;
          }

          .print-footer {
            margin-top: 18px;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            font-style: italic;
          }
        }

        /* ===============================
          A4 PRINT
        ================================ */
        @media print {
          .print-root.a4 {
            width: 210mm;
            margin: 0 auto;
            font-family: Arial, sans-serif;
            font-size: 12px;
          }

          .print-root.a4 #print-area {
            padding: 15mm;
          }

          .print-root.a4 .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
          }

          .print-root.a4 .print-table th,
          .print-root.a4 .print-table td {
            padding: 5px;
            border-bottom: 1px solid #eee;
          }

          .print-root.a4 .print-table th {
            font-weight: bold;
            text-align: left;
          }
          
          .print-root.a4 .col-product {
            word-break: normal;
          }

          .print-root.a4 .text-right {
            text-align: right;
          }

          .print-root.a4 .text-center {
            text-align: center;
          }
          
          .print-root.a4 .print-footer {
            font-weight: normal;
          }
          
          .print-root.a4 .summary-table {
            border: 1px solid #999;
          }
          
          .print-root.a4 .summary-table td {
             font-size: 12px !important;
             font-family: Arial, sans-serif;
             border-bottom: 1px solid #eee;
          }
          .print-root.a4 .summary-total-row td {
             border-top: 1px solid #999;
             font-weight: 700 !important;
          }
          .print-root.a4 .summary-final-balance td {
             font-size: 14px !important;
             font-weight: 800 !important;
          }


          @page {
            size: A4;
            margin: 10mm;
          }
        }

        /* --- Shared styles --- */
        .qty-uom {
          white-space: nowrap;
        }
        .uom-text {
          margin-left: 4px;
        }
      `}</style>
    </div>
  );
}

export default function PrintBillPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          Loading Print Preview...
        </div>
      }
    >
      <PrintPageContent />
    </Suspense>
  );
}
