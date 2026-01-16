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
import { Customer, Transaction } from '@/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface PrintData {
    customer?: Customer;
    transactions: Transaction[];
    openingBalance: number;
    dateRange: { from?: Date, to?: Date };
}

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paper = searchParams.get('paper') || 'a4';
  const [printData, setPrintData] = useState<PrintData | null>(null);

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = decodeURIComponent(data);
        const parsedData = JSON.parse(decodedData);
        // Dates will be strings, so we need to convert them back
        parsedData.transactions = parsedData.transactions.map((t: Transaction) => ({...t, date: new Date(t.date)}));
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
    transactions,
    openingBalance,
    dateRange,
  } = printData;

  const closingBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : openingBalance;

  return (
    <div className={`print-root ${paper}`}>
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
          <CardContent className="print-content" id="print-area">
            <header className="text-center mb-6">
              <h1 className="text-2xl font-bold font-headline text-primary">
                M.C & SONS FISH COMPANY
              </h1>
              <p className="text-sm text-muted-foreground">
                No. 1, Fish Market, Palladam Road, Tiruppur-641604
              </p>
               <h2 className="text-lg font-semibold mt-4">Customer Statement</h2>
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
                  <span className="font-semibold">Statement Date:</span>{' '}
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

            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Billed (+)</TableHead>
                  <TableHead className="text-right">Received (-)</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="font-semibold">
                    <TableCell colSpan={4}>Opening Balance</TableCell>
                    <TableCell className="text-right font-mono">{openingBalance.toFixed(2)}</TableCell>
                </TableRow>
                {transactions.map((t, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(t.date, 'dd-MM-yyyy')}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell className="text-right font-mono text-green-700">
                      {t.billedAmount ? t.billedAmount.toFixed(2) : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-700">
                      {t.receivedAmount ? t.receivedAmount.toFixed(2) : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {t.balance.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                 <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={4}>Closing Balance</TableCell>
                    <TableCell className="text-right font-mono">₹{closingBalance.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <footer className="text-center mt-8 text-xs text-muted-foreground">
              <p>This is a computer-generated statement.</p>
            </footer>
          </CardContent>
        </Card>
        <style jsx global>{`
  /* ===== PRINT RESET ===== */
  @media print {
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .print\\:hidden {
      display: none !important;
    }
  }

  /* ===== THERMAL 79mm ===== */
  @media print {
    .print-root.thermal {
      width: 79mm;
      font-family: monospace;
      font-size: 11px;
    }

    .print-root.thermal .print-content {
      padding: 4mm;
    }

    .print-root.thermal table {
      width: 100%;
      border-collapse: collapse;
    }

    .print-root.thermal th,
    .print-root.thermal td {
      padding: 2px 0;
      font-size: 11px;
    }

    .print-root.thermal h1 {
      font-size: 15px;
    }

    @page {
      size: 79mm auto;
      margin: 0;
    }
  }

  /* ===== A4 / LETTER ===== */
  @media print {
    .print-root.a4 {
      width: 210mm;
      font-family: Arial, sans-serif;
      font-size: 14px;
    }

    .print-root.a4 .print-content {
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
      background: #f5f5f5;
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


export default function PrintPaymentsPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
        <PrintPageContent />
      </Suspense>
    );
  }
