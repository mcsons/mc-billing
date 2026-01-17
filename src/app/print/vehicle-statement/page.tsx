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
import { format } from 'date-fns';

interface PrintData {
    type: 'Vehicle' | 'Driver';
    name: string;
    id: string;
    transactions: VehicleStatementTransaction[];
    openingBalance: number;
    dateRange: { from?: string, to?: string };
}

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const paper = searchParams.get('paper') || 'a4';

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
    return null;
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
    <div>
        <div className="flex justify-between items-center mb-4 p-4 print:hidden">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
        <div className={`print-root ${paper}`}>
          <div id="print-area">
            <header className="text-center mb-4">
              <h1 className="text-2xl font-bold">
                M.C & SONS FISH COMPANY
              </h1>
              <p>
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
                <div className="text-center font-semibold mb-4 period-section">
                    <span>From: {format(dateRange.from, 'dd-MM-yyyy')}</span>
                    <span className="mx-4">To: {format(dateRange.to, 'dd-MM-yyyy')}</span>
                </div>
            )}

            <div className="mb-4">
                <p className="font-semibold">{type} Details:</p>
                <p>{name} ({id})</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Advance (₹)</TableHead>
                  <TableHead className="text-right">Expenses (₹)</TableHead>
                  <TableHead className="text-right">Balance (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                    <TableCell colSpan={4} className="font-semibold">Opening Balance for Period</TableCell>
                    <TableCell className="text-right font-semibold">{openingBalance.toFixed(2)}</TableCell>
                </TableRow>
                {transactions.map((t, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(t.date, 'dd-MM-yyyy')}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell className="text-right">{t.advance > 0 ? t.advance.toFixed(2) : '-'}</TableCell>
                    <TableCell className="text-right">{t.expenses > 0 ? t.expenses.toFixed(2) : '-'}</TableCell>
                    <TableCell className="text-right">{t.balance.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <table className="w-full max-w-sm ml-auto balance-summary mt-4">
                <tbody>
                    <tr>
                        <td>Opening Balance</td>
                        <td className="text-right">₹{openingBalance.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Add: Total Advance</td>
                        <td className="text-right">{totalAdvance.toFixed(2)}</td>
                    </tr>
                    <tr className="border-t">
                        <td className="pt-1 font-semibold">Subtotal</td>
                        <td className="pt-1 text-right font-semibold">{(openingBalance + totalAdvance).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Less: Total Expenses</td>
                        <td className="text-right">- {totalExpenses.toFixed(2)}</td>
                    </tr>
                    <tr className="border-t-2 border-current final-balance-row">
                        <td className="pt-2 font-bold text-base">Final Balance</td>
                        <td className="pt-2 text-right font-bold text-lg">₹{finalBalance.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <footer className="text-center mt-8 text-xs">
              <p>This is a computer-generated statement.</p>
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
          .print\\:hidden {
            display: none !important;
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
            color: black;
        }
        .print-root.thermal {
            width: 83mm;
            font-family: "Courier New", monospace;
            font-size: 10px;
        }
        .print-root.thermal #print-area {
            padding: 6mm 4mm 15mm 4mm;
        }
        .print-root.thermal h1, .print-root.thermal h2 { font-size: 12px; font-weight: bold; }
        .print-root.thermal .period-section { font-size: 9px; }
        .print-root.thermal table {
            width: 100%;
            border-collapse: collapse;
        }
        .print-root.thermal th, .print-root.thermal td {
            padding: 1.5px 0;
        }
        .print-root.thermal .balance-summary td { padding: 1.5px 0; }
        .print-root.thermal .final-balance-row td { font-size: 12px !important; }

        .print-root.a4 {
            width: 210mm;
            font-family: Arial, sans-serif;
            font-size: 12px;
        }
        .print-root.a4 #print-area {
            padding: 15mm;
        }
        .print-root.a4 h1 { font-size: 20px; }
        .print-root.a4 h2 { font-size: 16px; }
        .print-root.a4 table {
            width: 100%;
            border-collapse: collapse;
        }
        .print-root.a4 th, .print-root.a4 td {
            padding: 5px;
            border-bottom: 1px solid #eee;
        }
        .print-root.a4 .balance-summary { font-size: 14px; }
        .print-root.a4 .balance-summary td { padding: 4px; }
        .print-root.a4 .final-balance-row td { font-size: 16px !important; }
      `}</style>
    </div>
  );
}


export default function PrintVehicleStatementPage() {
    return (
      <Suspense>
        <PrintPageContent />
      </Suspense>
    );
  }
