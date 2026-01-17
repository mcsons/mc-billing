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
import { format } from 'date-fns';

interface PrintData {
    customer?: Customer;
    transactions: Transaction[];
    openingBalance: number;
    dateRange: { from?: string, to?: string };
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
        const parsedData = JSON.parse(decodedData, (key, value) => {
            if ((key === 'from' || key === 'to' || key === 'date') && value) {
                return new Date(value);
            }
            return value;
        });
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
    return null;
  }

  const {
    customer,
    transactions,
    openingBalance,
    dateRange,
  } = printData;

  const dailySummary = transactions.reduce((acc, t) => {
    const dateStr = format(t.date, 'yyyy-MM-dd');
    if (!acc[dateStr]) {
        acc[dateStr] = { date: t.date, billed: 0, received: 0 };
    }
    acc[dateStr].billed += t.billedAmount || 0;
    acc[dateStr].received += t.receivedAmount || 0;
    return acc;
  }, {} as Record<string, { date: Date; billed: number; received: number; }>);

  const dailyTransactions = Object.values(dailySummary).sort((a,b) => a.date.getTime() - b.date.getTime());

  const totalBilled = dailyTransactions.reduce((sum, day) => sum + day.billed, 0);
  const totalReceived = dailyTransactions.reduce((sum, day) => sum + day.received, 0);

  const subtotal = openingBalance + totalBilled;
  const finalBalance = subtotal - totalReceived;

  return (
    <div>
        <div className="flex justify-between items-center mb-4 p-4 print:hidden">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payments
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
               <h2 className="text-lg font-semibold mt-2">Customer Statement</h2>
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
                <p className="font-semibold">Customer Details:</p>
                <p>{customer?.name_en} ({customer?.name_ta})</p>
                <p>{customer?.phone}</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Billed (₹)</TableHead>
                  <TableHead className="text-right">Received (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyTransactions.map((t, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(t.date, 'dd-MM-yyyy')}</TableCell>
                    <TableCell className="text-right">
                      {t.billed > 0 ? t.billed.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.received > 0 ? t.received.toFixed(2) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <div className="w-full max-w-sm ml-auto text-right font-semibold space-y-1 my-4">
                <p>Total Billed Amount: <span>₹{totalBilled.toFixed(2)}</span></p>
                <p>Total Received Amount: <span>₹{totalReceived.toFixed(2)}</span></p>
            </div>

            <table className="w-full max-w-sm ml-auto balance-summary">
                <tbody>
                    <tr>
                        <td>Opening Balance</td>
                        <td className="text-right">₹{openingBalance.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Add: Total Billed Amount</td>
                        <td className="text-right">{totalBilled.toFixed(2)}</td>
                    </tr>
                    <tr className="border-t">
                        <td className="pt-1 font-semibold">Subtotal</td>
                        <td className="pt-1 text-right font-semibold">{subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Less: Total Received Amount</td>
                        <td className="text-right">- {totalReceived.toFixed(2)}</td>
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


export default function PrintPaymentsPage() {
    return (
      <Suspense>
        <PrintPageContent />
      </Suspense>
    );
  }
