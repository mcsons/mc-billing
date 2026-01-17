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
    return null;
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
                <TableHead>Product (பெயர்)</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.product}</TableCell>
                  <TableCell className="text-center">
                    {item.qty} {item.uom}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.rate.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
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
              <div className="flex justify-between font-semibold border-t">
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
              <div className="flex justify-between font-bold text-base border-t">
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
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-root.thermal {
            @page {
              size: 83mm auto;
              margin: 0;
            }
          }
          .print-root.a4 {
            @page {
              size: A4;
              margin: 10mm;
            }
          }
        }
        .print-root {
            margin: 0 auto;
        }
        .print-root.thermal {
            width: 83mm;
            font-family: "Courier New", monospace;
            font-size: 10px;
        }
        .print-root.thermal #print-area {
            padding: 6mm 4mm 15mm 4mm;
        }
        .print-root.thermal h1 { font-size: 14px; }
        .print-root.thermal p, .print-root.thermal div, .print-root.thermal span { font-size: 10px; }
        .print-root.thermal .text-base { font-size: 11px; }
        .print-root.thermal .text-xs { font-size: 9px; }
        .print-root.thermal table {
            width: 100%;
            border-collapse: collapse;
        }
        .print-root.thermal th, .print-root.thermal td {
            padding: 1.5px 0;
        }

        .print-root.a4 {
            width: 210mm;
            font-family: Arial, sans-serif;
            font-size: 12px;
        }
        .print-root.a4 #print-area {
            padding: 15mm;
        }
        .print-root.a4 table {
            width: 100%;
            border-collapse: collapse;
        }
        .print-root.a4 th, .print-root.a4 td {
            padding: 5px;
            border-bottom: 1px solid #eee;
        }
        .print-root.a4 h1 { font-size: 20px; }
      `}</style>
    </div>
  );
}

export default function PrintBillPage() {
  return (
    <Suspense>
      <PrintPageContent />
    </Suspense>
  );
}
