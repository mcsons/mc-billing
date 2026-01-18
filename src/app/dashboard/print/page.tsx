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
import { Card, CardContent } from '@/components/ui/card';
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
    <div className={`print-root ${paper}`}>
      <div className="flex justify-between items-center mb-4 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Billing
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
      <Card className="print:shadow-none print:border-none print:bg-white">
        <CardContent className="print-content" id="print-area">
          <header className="text-center mb-6">
            <h1 className="text-1l font-bold font-headline text-primary">
              M.C & SONS FISH COMPANY
            </h1>
            <p className="text-sm text-muted-foreground">
              No. 1, Fish Market, Palladam Road, Tiruppur-641604
            </p>
            <p className="text-sm text-muted-foreground">📞 9894089889</p>
          </header>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
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
                {format(new Date(date), 'P')}
              </p>
            </div>
          </div>

          <Table className="print-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">S/N</TableHead>
                <TableHead>Product (பெயர்)</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Rate (₹)</TableHead>
                <TableHead className="text-right">Amount (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.product}</TableCell>
                  <TableCell className="text-center">
                    <span className="qty-uom">
                      <strong>{item.qty}</strong>
                      <span className="uom-text">{item.uom}</span>
                    </span>
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

          <div className="flex justify-end mt-6">
            <div className="w-full max-w-sm space-y-2 text-sm">
               <div className="flex justify-between">
                <span className="font-semibold">Items Total:</span>
                <span className="font-mono">₹{itemsTotal.toFixed(2)}</span>
              </div>
              {deliveryCharge > 0 && (
                <div className="flex justify-between">
                  <span className="font-semibold">Delivery Charge:</span>
                  <span className="font-mono">₹{deliveryCharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Bill Total:</span>
                <span className="font-mono">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Previous Balance:</span>
                <span className="font-mono">
                  ₹{previousBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Paid Amount:</span>
                <span className="font-mono">₹{paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <span>Final Balance:</span>
                <span className="font-mono">₹{finalBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <footer className="text-center mt-8 text-xs text-muted-foreground">
            <p>Thank you for your business!</p>
            <p>This is a computer-generated bill.</p>
          </footer>
        </CardContent>
      </Card>
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
    font-family: "Courier New", monospace;
    font-size: 12px;
  }

  #print-area {
    padding: 6mm 4mm 15mm 4mm; /* bottom gap */
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 2px 0;
    font-size: 12px;
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
    font-size: 14px;
  }

  .print-root.a4 #print-area {
    padding: 15mm;
  }

  .print-root.a4 table {
    width: 100%;
    border-collapse: collapse;
  }

  .print-root.a4 th,
  .print-root.a4 td {
    padding: 6px;
    border-bottom: 1px solid #ddd;
  }

  .print-root.a4 th {
    font-weight: bold;
  }

  @page {
    size: A4;
    margin: 10mm;
  }
}
`}</style>




    </div>
  );
}


export default function PrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}
