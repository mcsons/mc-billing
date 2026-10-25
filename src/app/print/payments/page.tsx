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
import { Customer, LiveBillSummary } from '@/lib/data';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';

interface PrintData {
    customer?: Customer;
    bills: LiveBillSummary[];
    date?: string;
    currentCustomerBalance?: number;
}

function PrintReceivedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paper = searchParams.get('paper') || 'thermal';
  const [printData, setPrintData] = useState<PrintData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('receivedReportData');
    if (stored) {
      try {
        const parsedData = JSON.parse(stored, (key, value) => {
            if ((key === 'from' || key === 'to' || key === 'date') && value) {
                return new Date(value);
            }
            return value;
        });
        setPrintData(parsedData);
      } catch (error) {
        console.error('Failed to parse print data:', error);
        router.push('/dashboard/received');
      }
    } else {
      router.push('/dashboard/received');
    }
    return () => {
      sessionStorage.removeItem('receivedReportData');
    };
  }, [router]);

  if (!printData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading print data...</p>
      </div>
    );
  }

  const {
    customer,
    bills,
    date,
    currentCustomerBalance
  } = printData;

  const totalReceivedAmount = bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
  const liveBalance = currentCustomerBalance || 0;
  const prevBalance = liveBalance + totalReceivedAmount;

  return (
    <div>
        <div className="p-4 print:hidden flex justify-between items-center">
          <Button variant="outline" onClick={() => window.close()} className="text-foreground">
            <X className="mr-2 h-4 w-4" />
            Close Preview
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
        <div className={`print-root ${paper}`}>
          <div id="print-area">
            <header className="text-center">
              <h1 className="header-title">M.C & SONS FISH COMPANY</h1>
              <p className="header-sub">
                No. 1, Fish Market, Palladam Road,
                <span className="city">Tiruppur - 641604</span>
              </p>
              <p className="header-sub header-phone">📞 9894089889, 9597833277</p>
            </header>
            <div className="hr-line"></div>
            <h2 className="text-lg font-semibold my-1 text-center">Received Amount</h2>

            <div className="grid grid-cols-2 gap-4 mb-2 text-sm">
                <div>
                    <p className="font-semibold">Cust Name:</p>
                    <p className="cust-name">{customer?.name_ta || '-'}</p>
                </div>
                <div className="text-right">
                    {date && (
                         <p className="bill-date">
                             <span className="font-semibold block">Recieved Date:</span> 
                             <strong>{format(new Date(date), 'dd-MM-yyyy')}</strong>
                         </p>
                    )}
                </div>
            </div>

            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="col-date">BillDate</TableHead>
                  <TableHead className="col-billno">BillNo</TableHead>
                  <TableHead className="col-billed text-right">Bill Amt</TableHead>
                  <TableHead className="col-received text-right">Recieved Cash</TableHead>
                </TableRow>
                 <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((t, index) => {
                    const bDate = t.date ? new Date(t.date) : null;
                    const isValidDate = bDate && !isNaN(bDate.getTime());
                    return (
                        <TableRow key={index}>
                            <TableCell className="col-date">{isValidDate ? format(bDate, 'dd-MM-yy') : '-'}</TableCell>
                            <TableCell className="col-billno">{t.billNo}</TableCell>
                            <TableCell className="col-billed text-right">
                                {t.amount > 0 ? t.amount.toFixed(2) : '-'}
                            </TableCell>
                            <TableCell className="col-received text-right">
                                {t.paidAmount && t.paidAmount > 0 ? t.paidAmount.toFixed(2) : '-'}
                            </TableCell>
                        </TableRow>
                    )
                })}
              </TableBody>
            </Table>
            
            <div className="flex justify-end mt-2">
                 <div className="w-full max-w-[300px] space-y-1 totals-section">
                    <div className="hr-line my-1"></div>
                    <div className="flex justify-between">
                        <span>Prev Balance</span>
                        <span>₹{prevBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Cash Received (-)</span>
                        <span>₹{totalReceivedAmount.toFixed(2)}</span>
                    </div>
                    <div className="hr-line my-1"></div>
                    <div className="flex justify-between final-balance">
                        <span>Final Balance</span>
                        <span>₹{liveBalance.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <footer className="print-footer">Developed by MC & SONS</footer>
          </div>
        </div>
        <style jsx global>{`
        /* ===============================
          SCREEN PREVIEW STYLES
        ================================ */
        @media screen {
            #print-area {
                background: white;
                color: black;
                margin: 2rem auto;
            }

            .print-root.thermal #print-area {
                width: 106mm;
            }
            .print-root.a4 #print-area {
                width: 210mm;
                min-height: 297mm;
            }
        }
        
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
          
          #print-area {
              margin: 0;
              padding: 0;
          }

          .print\\:hidden {
            display: none !important;
          }
        }

        /* ===============================
          THERMAL (106mm)
        ================================ */
        @media print {
          .print-root.thermal #print-area {
            padding: 2mm 4mm 18mm 4mm;
          }
          .print-root.thermal {
            width: 106mm;
            max-width: 106mm;
            margin: 0 auto;
            font-family: 'Courier New', 'Lucida Console', monospace !important;
          }

          h2.text-lg {
             font-size: 16px !important;
             line-height: 1.4;
             font-weight: 700;
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
            margin: 0;
          }

          .cust-name {
            font-weight: 700;
            font-size: 15px;
          }

          .bill-no > strong,
          .bill-date > strong {
            font-weight: 700;
          }
          
          .text-lg {
             font-size: 16px !important;
             line-height: 1.4;
             font-weight: 700;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .print-table tr,
          .print-table th,
          .print-table td {
            border: none;
          }

          .print-table thead th {
            font-weight: 800 !important;
            font-size: 13px !important;
            padding: 2px 4px;
            color: #000;
            vertical-align: middle;
          }

          .print-table tbody td {
            font-weight: 700 !important;
            font-size: 13px;
            padding: 2px 4px;
            vertical-align: top;
          }
          
          .col-date { width: 25%; text-align: left; }
          .col-billno { width: 25%; text-align: left; }
          .col-billed { width: 25%; text-align: right; }
          .col-received { width: 25%; text-align: right; }

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
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            font-style: italic;
          }
        }

        /* ===============================
          A4 PRINT
        ================================ */
        @media print {
          .print-root.a4 #print-area {
            padding: 15mm;
          }
          .print-root.a4 {
            width: 210mm;
            margin: 0 auto;
            font-family: Arial, sans-serif;
            font-size: 12px;
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


export default function PrintReceivedPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
        <PrintReceivedContent />
      </Suspense>
    );
  }
