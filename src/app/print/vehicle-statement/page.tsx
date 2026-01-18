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
  const paper = searchParams.get('paper') || 'thermal';

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
            <header className="text-center">
              <h1 className="header-title">
                M.C & SONS FISH COMPANY
              </h1>
              <p className="header-sub">
                No. 1, Fish Market, Palladam Road,
                <span className="city">Tiruppur - 641604</span>
              </p>
              <p className="header-sub header-phone">📞 9894089889</p>
            </header>
            <div className="hr-line"></div>
            <h2 className="text-lg font-semibold mt-2 text-center">{type} Statement</h2>

            <div className="grid grid-cols-2 gap-4 mb-2 text-sm">
                <div>
                    <p className="font-semibold">{type} Details:</p>
                    <p className="cust-name">{name} ({id})</p>
                </div>
                <div className="text-right">
                     {dateRange.from && (
                         <p><span className="font-semibold">From:</span> <strong>{format(dateRange.from, 'dd-MM-yyyy')}</strong></p>
                    )}
                    {dateRange.to && (
                         <p><span className="font-semibold">To:</span> <strong>{format(dateRange.to, 'dd-MM-yyyy')}</strong></p>
                    )}
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
                  <TableHead className="col-date">Date</TableHead>
                  <TableHead className="col-desc">Description</TableHead>
                  <TableHead className="col-adv">Advance</TableHead>
                  <TableHead className="col-exp">Expenses</TableHead>
                  <TableHead className="col-bal">Balance</TableHead>
                </TableRow>
                 <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                    <TableCell colSpan={4} className="font-semibold">Opening Balance for Period</TableCell>
                    <TableCell className="col-bal font-semibold">{openingBalance.toFixed(2)}</TableCell>
                </TableRow>
                {transactions.map((t, index) => (
                  <TableRow key={index}>
                    <TableCell className="col-date">{format(t.date, 'dd-MM-yyyy')}</TableCell>
                    <TableCell className="col-desc">{t.description}</TableCell>
                    <TableCell className="col-adv">{t.advance > 0 ? t.advance.toFixed(2) : '-'}</TableCell>
                    <TableCell className="col-exp">{t.expenses > 0 ? t.expenses.toFixed(2) : '-'}</TableCell>
                    <TableCell className="col-bal">{t.balance.toFixed(2)}</TableCell>
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
                 <div className="w-full max-w-[300px] space-y-1 totals-section">
                    <div className="flex justify-between">
                        <span>Total Advance:</span>
                        <span>₹{totalAdvance.toFixed(2)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span>Total Expenses:</span>
                        <span>₹{totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="hr-line my-1"></div>
                    <div className="flex justify-between final-balance">
                        <span>Final Balance:</span>
                        <span>₹{finalBalance.toFixed(2)}</span>
                    </div>
                </div>
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
            margin: 4px 0;
          }

          .cust-name {
            font-weight: 700;
            font-size: 15px;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .print-table tr, .print-table th, .print-table td {
            border: none;
            word-wrap: break-word; 
            white-space: pre-wrap;
          }
          
          .print-table thead th {
            font-weight: 800 !important;
            font-size: 14px !important;
            padding: 2px 4px;
            color: #000;
            vertical-align: middle;
            text-align: left;
          }

          .print-table tbody td {
            font-weight: 700 !important;
            font-size: 13px;
            padding: 2px 4px;
            vertical-align: top;
          }
          
          .col-date { width: 15%; text-align: left;}
          .col-desc { width: 35%; text-align: left;}
          .col-adv { width: 15%; text-align: right;}
          .col-exp { width: 15%; text-align: right;}
          .col-bal { width: 20%; text-align: right;}

          .totals-section > div,
          .totals-section span {
            font-size: 15px !important;
            font-weight: 700 !important;
          }
          
          .totals-section .hr-line {
            margin: 2px 0;
          }

          .final-balance,
          .final-balance span {
            font-size: 16px !important;
            font-weight: 800 !important;
          }

          .print-footer {
            margin-top: 18px;
            text-align: center;
            font-size: 12px;
            font-weight: 800;
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

          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
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
