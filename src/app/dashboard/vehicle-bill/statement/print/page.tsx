'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableHead,
} from '@/components/ui/table';
import { VehicleStatementTransaction } from '@/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface PrintData {
    type: 'Vehicle' | 'Driver';
    name: string;
    id: string;
    transactions: VehicleStatementTransaction[];
    openingBalance: number;
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
        const parsedData: PrintData = JSON.parse(decodedData, (key, value) => {
            if (key === 'date' || key === 'from' || key === 'to') {
                return value ? new Date(value) : undefined;
            }
            return value;
        });
        setPrintData(parsedData);
      } catch (error) {
        console.error('Failed to parse print data:', error);
        router.push('/dashboard/vehicle-bill');
      }
    } else {
      router.push('/dashboard/vehicle-bill');
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
    type,
    name,
    id,
    transactions,
    openingBalance,
    dateRange,
  } = printData;

  const totalAdvance = transactions.reduce((sum, day) => sum + day.advance, 0);
  const totalExpenses = transactions.reduce((sum, day) => sum + day.expenses, 0);
  const finalBalance = openingBalance + totalAdvance - totalExpenses;

  return (
    <div className={`print-root a4`}>
        <div className="flex justify-between items-center mb-4 print:hidden">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
        <Card className="print:shadow-none print:border-none print:bg-white">
          <CardContent className="print-content" id="print-area">
            <header className="text-center mb-4">
              <h1 className="text-2xl font-bold font-headline text-primary">
                M.C & SONS FISH COMPANY
              </h1>
              <p className="text-sm text-muted-foreground">
                No. 1, Fish Market, Palladam Road, Tiruppur-641604
              </p>
               <h2 className="text-lg font-semibold mt-2">{type} Statement</h2>
            </header>

            <div className="text-right text-sm mb-4">
                <p>
                  <span className="font-semibold">Statement Date:</span>{' '}
                  {format(new Date(), 'dd-MM-yyyy')}
                </p>
            </div>

            {dateRange.from && dateRange.to && (
                <div className="text-center text-sm font-semibold mb-4 period-section">
                    <span>From: {format(dateRange.from, 'dd-MM-yyyy')}</span>
                    <span className="mx-4">To: {format(dateRange.to, 'dd-MM-yyyy')}</span>
                </div>
            )}

            <div className="mb-4 text-sm">
                <p className="font-semibold">{type} Details:</p>
                <p>{name} ({id})</p>
            </div>

            <Table className="print-table mb-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Advance (₹)</TableHead>
                  <TableHead className="text-right">Expenses (₹)</TableHead>
                  <TableHead className="text-right">Balance (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">Opening Balance for Period</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{openingBalance.toFixed(2)}</TableCell>
                </TableRow>
                {transactions.map((t, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(t.date, 'dd-MM-yyyy')}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{t.advance > 0 ? t.advance.toFixed(2) : '-'}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{t.expenses > 0 ? t.expenses.toFixed(2) : '-'}</TableCell>
                    <TableCell className="text-right font-mono">{t.balance.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <table className="w-full max-w-sm ml-auto balance-summary mt-4">
                <tbody>
                    <tr>
                        <td>Opening Balance</td>
                        <td className="text-right font-mono">₹{openingBalance.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Add: Total Advance</td>
                        <td className="text-right font-mono">{totalAdvance.toFixed(2)}</td>
                    </tr>
                    <tr className="border-t">
                        <td className="pt-1 font-semibold">Subtotal</td>
                        <td className="pt-1 text-right font-mono font-semibold">{(openingBalance + totalAdvance).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Less: Total Expenses</td>
                        <td className="text-right font-mono">- {totalExpenses.toFixed(2)}</td>
                    </tr>
                    <tr className="border-t-2 border-foreground final-balance-row">
                        <td className="pt-2 font-bold text-base">Final Balance</td>
                        <td className="pt-2 text-right font-mono font-bold text-lg">₹{finalBalance.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <footer className="text-center mt-8 text-xs text-muted-foreground">
              <p>This is a computer-generated statement.</p>
            </footer>
          </CardContent>
        </Card>
        <style jsx global>{\`
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

    .print\\\\:hidden {
      display: none !important;
    }
  }

  @media print {
    .print-root.a4 {
      width: 210mm;
      font-family: Arial, sans-serif;
      font-size: 12px;
    }

    .print-root.a4 .print-content {
      padding: 15mm;
    }
    
    .print-root.a4 h1 { font-size: 20px; }
    .print-root.a4 h2 { font-size: 16px; }

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
      background: #f9f9f9;
    }
    
    .print-root.a4 .balance-summary {
        font-size: 14px;
    }
    .print-root.a4 .balance-summary td {
        padding: 4px;
    }
    .print-root.a4 .final-balance-row td {
        font-size: 16px !important;
    }

    @page {
      size: A4;
      margin: 10mm;
    }
  }
\`}</style>

    </div>
  );
}


export default function PrintVehicleStatementPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
        <PrintPageContent />
      </Suspense>
    );
  }
