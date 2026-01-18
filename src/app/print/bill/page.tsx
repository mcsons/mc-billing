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
import { ArrowLeft, Printer } from 'lucide-react';
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
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Billing
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
      <div className={`print-root ${paper}`}>
        <div id="print-area">
          <header className="text-center mb-6">
            <h1 className="text-2xl font-bold">
              M.C & SONS FISH COMPANY
            </h1>
            <p>
              No. 1, Fish Market, Palladam Road, Tiruppur-641604
            </p>
            <p>📞 9894089889</p>
          </header>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="font-semibold">Bill To:</p>
              <p>{customer.name_en}</p>
              <p>{customer.name_ta}</p>
              <p>{customer.phone}</p>
            </div>
            <div className="text-right">
              <p>
                <span className="font-semibold">Bill No:</span> {billNo}
              </p>
              <p>
                <span className="font-semibold">Date:</span>{' '}
                {format(new Date(date), 'dd-MM-yyyy')}
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S/N</TableHead>
                <TableHead className="product-col">Product (பெயர்)</TableHead>
                <TableHead className="qty-col">Qty</TableHead>
                <TableHead className="rate-col">Rate</TableHead>
                <TableHead className="amount-col">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="product-col">{item.product}</TableCell>
                  <TableCell className="qty-col">
                    <span className="qty-uom">
                      <strong>{item.qty}</strong>
                      <span className="uom-text">{item.uom}</span>
                    </span>
                  </TableCell>
                  <TableCell className="rate-col">
                    {item.rate.toFixed(2)}
                  </TableCell>
                  <TableCell className="amount-col">
                    {item.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-4">
            <div className="w-full max-w-[250px] space-y-1">
              <div className="flex justify-between">
                <span>Items Total:</span>
                <span>₹{itemsTotal.toFixed(2)}</span>
              </div>
              {deliveryCharge > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Charge:</span>
                  <span>₹{deliveryCharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t bill-total">
                <span>Bill Total:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Previous Balance:</span>
                <span>
                  ₹{previousBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Paid Amount:</span>
                <span>₹{paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t final-balance">
                <span>Final Balance:</span>
                <span>₹{finalBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <footer className="text-center mt-6 text-xs">
            <p>Thank you for your business!</p>
            <p>This is a computer-generated bill.</p>
          </footer>
        </div>
      </div>
      <style jsx global>{`
        /* ===============================
          GLOBAL PRINT
        ================================ */
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print\\:hidden {
            display: none !important;
          }
        }

        /* ===============================
          THERMAL 4-INCH (83mm)
        ================================ */
        @media print {
          .print-root.thermal {
            width: 83mm;
            max-width: 83mm;
            margin: 0 auto;
            font-family: "Courier New", "Lucida Console", monospace !important;
            font-size: 12px;
            color: #000 !important;
            -webkit-font-smoothing: none;
            font-smoothing: none;
            text-rendering: optimizeSpeed;
          }

          .print-root.thermal #print-area {
            padding: 5mm 4mm 14mm 4mm;
          }
          
          .print-root.thermal .qty-uom strong {
            font-weight: 700;
          }

          .print-root.thermal .bill-total {
            font-weight: 700 !important;
            color: #000 !important;
          }

          .print-root.thermal .final-balance {
            font-weight: 700 !important;
            font-size: 14px;
            margin-top: 4px;
            color: #000 !important;
          }

          .print-root.thermal table {
            width: 100%;
            border-collapse: collapse;
          }

          .print-root.thermal th {
            padding: 2px 0;
            font-size: 12px;
            font-weight: 700 !important;
            color: #000 !important;
            letter-spacing: 0.5px;
          }
          
          .print-root.thermal td {
            padding: 2px 0;
            font-size: 12px;
            font-weight: 500;
            color: #000 !important;
          }

          .print-root.thermal .product-col {
            width: 40%;
            word-break: break-all;
          }

          .print-root.thermal .qty-col {
            width: 16%;
            text-align: center;
          }

          .print-root.thermal .rate-col,
          .print-root.thermal .amount-col {
            text-align: right;
            font-family: "Courier New", monospace;
            width: 22%;
          }

          @page {
            size: 83mm auto;
            margin: 0;
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
            font-size: 12px; /* Base font size for A4 */
          }

          .print-root.a4 #print-area {
            padding: 15mm;
          }
          
          .print-root.a4 .qty-uom strong {
            font-weight: 700;
          }

          .print-root.a4 .bill-total {
            font-weight: 700;
          }

          .print-root.a4 .final-balance {
            font-weight: 800;
            font-size: 14px; /* A bit larger for A4 */
            margin-top: 4px;
          }

          .print-root.a4 table {
            width: 100%;
            border-collapse: collapse;
          }

          .print-root.a4 th,
          .print-root.a4 td {
            padding: 5px;
            border-bottom: 1px solid #eee;
          }

          .print-root.a4 th {
            font-weight: bold;
            text-align: left;
          }
          
          .print-root.a4 .text-right {
             text-align: right;
          }
          
          .print-root.a4 .text-center {
             text-align: center;
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
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}
