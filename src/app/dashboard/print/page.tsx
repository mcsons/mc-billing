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

interface BillPrintData {
  billNo: string;
  date: string;
  customer: Customer;
  items: BillItem[];
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
    totalAmount,
    previousBalance,
    paidAmount,
    finalBalance,
  } = billData;

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
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
          <CardContent className="p-6 md:p-8" id="print-area">
            <header className="text-center mb-6">
              <h1 className="text-2xl font-bold font-headline text-primary">
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
                  {new Date(date).toLocaleDateString()}
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">S/N</TableHead>
                  <TableHead>Product (பெயர்)</TableHead>
                  <TableHead className="text-center">UOM</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate (₹)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.product}</TableCell>
                    <TableCell className="text-center">{item.uom}</TableCell>
                    <TableCell className="text-right">
                      {item.qty.toFixed(3)}
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
                  <span className="font-semibold">Total:</span>
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
      </div>
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            background-color: #fff;
          }
          .print\\:hidden {
            display: none;
          }
          .print\\:shadow-none {
            box-shadow: none;
          }
          .print\\:border-none {
            border: none;
          }
          .print\\:bg-white {
            background-color: #fff !important;
          }
          .bg-gray-100 {
            background-color: #fff !important;
          }
          @page {
            size: auto;
            margin: 0.5in;
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
