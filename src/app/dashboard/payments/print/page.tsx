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
import { Customer, Payment } from '@/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface PrintData {
    customer?: Customer;
    payments: Payment[];
    dateRange: { from?: Date, to?: Date };
}

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [printData, setPrintData] = useState<PrintData | null>(null);

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = decodeURIComponent(data);
        const parsedData = JSON.parse(decodedData);
        // Dates will be strings, so we need to convert them back
        parsedData.payments = parsedData.payments.map((p: Payment) => ({...p, date: new Date(p.date)}));
        if(parsedData.dateRange.from) parsedData.dateRange.from = new Date(parsedData.dateRange.from);
        if(parsedData.dateRange.to) parsedData.dateRange.to = new Date(parsedData.dateRange.to);

        setPrintData(parsedData);
      } catch (error) {
        console.error('Failed to parse print data:', error);
        router.push('/dashboard/payments');
      }
    } else {
      router.push('/dashboard/payments');
    }
  }, [searchParams, router]);

  if (!printData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading print data...</p>
      </div>
    );
  }

  const {
    customer,
    payments,
    dateRange,
  } = printData;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payments
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
               <h2 className="text-lg font-semibold mt-4">Payment Summary</h2>
            </header>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="font-semibold">Customer:</p>
                <p>{customer?.name_en}</p>
                <p>{customer?.name_ta}</p>
                <p>{customer?.phone}</p>
              </div>
              <div className="text-right">
                <p>
                  <span className="font-semibold">Date:</span>{' '}
                  {new Date().toLocaleDateString()}
                </p>
                {dateRange.from && dateRange.to && (
                     <p>
                        <span className="font-semibold">Period:</span>{' '}
                        {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                    </p>
                )}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Notes / Description</TableHead>
                  <TableHead className="text-right">Amount Paid (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(payment.date, 'dd-MM-yyyy')}</TableCell>
                    <TableCell>{payment.notes || '---'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {payment.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end mt-6">
              <div className="w-full max-w-sm space-y-2 text-sm">
                <div className="flex justify-between border-t pt-2 font-bold text-base">
                  <span>Total Paid in Period:</span>
                  <span className="font-mono">₹{totalPaid.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <footer className="text-center mt-8 text-xs text-muted-foreground">
              <p>This is a computer-generated payment summary.</p>
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


export default function PrintPaymentsPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
        <PrintPageContent />
      </Suspense>
    );
  }
