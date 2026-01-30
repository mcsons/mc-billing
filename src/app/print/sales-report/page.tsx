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
import { Customer, SalesReportData, BillItem } from '@/lib/data';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';

type SalesReportPrintData = SalesReportData;

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [printData, setPrintData] = useState<SalesReportPrintData | null>(null);

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(data), (key, value) => {
            if ((key === 'from' || key === 'to' || key === 'billDate') && value) {
                return new Date(value);
            }
            return value;
        });
        setPrintData(decodedData);
      } catch (error) {
        console.error('Failed to parse print data:', error);
        router.push('/dashboard/sales-report');
      }
    } else {
      router.push('/dashboard/sales-report');
    }
  }, [searchParams, router]);

  if (!printData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading report data...</p>
      </div>
    );
  }

  const {
    customer,
    itemsByDate,
    totalQty,
    totalAmount,
    previousBalance,
    netAmount,
    dateRange,
  } = printData;

  const totalQtyString = Object.entries(totalQty)
    .map(([uom, qty]) => `${qty.toFixed(2)}${uom}`)
    .join(', ');

  return (
    <div>
        <div className="flex justify-between items-center mb-4 p-4 print:hidden">
          <Button variant="outline" onClick={() => window.close()}>
            <X className="mr-2 h-4 w-4" />
            Close Preview
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
        <div className={`print-root thermal`}>
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
            <h2 className="text-lg font-semibold mt-2 text-center">Sales Report</h2>

            <div className="grid grid-cols-2 gap-4 mb-1 text-sm">
                <div></div>
                <div className="text-right">
                    {dateRange.from && (
                         <p><span className="font-semibold">From:</span> <strong>{format(new Date(dateRange.from), 'dd-MM-yyyy')}</strong></p>
                    )}
                    {dateRange.to && (
                         <p><span className="font-semibold">To:</span> <strong>{format(new Date(dateRange.to), 'dd-MM-yyyy')}</strong></p>
                    )}
                </div>
            </div>
            
            <div className="text-sm">
                <p><span className="font-semibold">Customer Name:</span> {customer?.name_ta || customer?.name_en || '-'}</p>
            </div>
            
            {/* Blank line for spacing */}
            <div className="py-1"></div>

            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="col-billdate">BillDate</TableHead>
                  <TableHead className="col-itemname">ItemName</TableHead>
                  <TableHead className="col-qty text-center">Qty</TableHead>
                  <TableHead className="col-rate text-right">Rate</TableHead>
                  <TableHead className="col-amount text-right">Amt</TableHead>
                </TableRow>
                 <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsByDate.map(({ date, items }) => (
                    items.map((item, itemIndex) => (
                        <TableRow key={`${date}-${item.id}`}>
                            <TableCell className="col-billdate">{itemIndex === 0 ? date : ''}</TableCell>
                            <TableCell className="col-itemname">{item.product}</TableCell>
                            <TableCell className="col-qty text-center">{item.qty.toFixed(1)} {item.uom}</TableCell>
                            <TableCell className="col-rate text-right">{item.rate.toFixed(2)}</TableCell>
                            <TableCell className="col-amount text-right">{item.amount.toFixed(2)}</TableCell>
                        </TableRow>
                    ))
                ))}
                 <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            <div className="totals-section mt-4 space-y-1">
                <div className="flex">
                    <span className="w-[40%] font-bold">Total ==&gt;</span>
                    <span className="w-[30%] text-center">{totalQtyString}</span>
                    <span className="w-[30%] text-right font-bold">{totalAmount.toFixed(2)}</span>
                </div>
                <div className="hr-line"></div>
                <div className="flex justify-between mt-2">
                    <span className="font-bold">PREVIOUS BALANCE</span>
                    <span className="font-bold">{previousBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1 final-balance">
                    <span className="font-bold">NETT AMT</span>
                    <span className="font-bold">{netAmount.toFixed(2)}</span>
                </div>
                <div className="hr-line"></div>
            </div>

            <footer className="print-footer">Developed by MC & SONS</footer>
          </div>
        </div>
        <style jsx global>{`
        /* --- Global Print Reset --- */
        @media print {
          * { color: #000 !important; -webkit-font-smoothing: none; font-smoothing: none; text-rendering: optimizeSpeed; }
          body { margin: 0; padding: 0; background: white !important; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }

        /* ===============================
          THERMAL (106mm)
        ================================ */
        @media print {
          /* --- Base styles copied from Main Bill Print --- */
          .print-root.thermal { width: 106mm; max-width: 106mm; margin: 0 auto; font-family: 'Courier New', 'Lucida Console', monospace !important; }
          #print-area { padding: 2mm 4mm 18mm 4mm; margin-top: 0; }
          .header-title { font-size: 22px !important; font-weight: 700; letter-spacing: 0.5px; line-height: 1.2; white-space: nowrap; }
          .header-sub { display: block; text-align: center; font-size: 13px !important; font-weight: 700; line-height: 1.3; margin-top: 2px; }
          .header-sub .city { display: block; }
          .header-phone { margin-top: 4px; }
          .hr-line { border-top: 2px solid #000; margin: 6px 0; }
          .table-header-line { border-top: 2px solid #000; margin: 0; }

          /* --- Sales Report Table Layout --- */
          .print-table { 
            width: 100%; 
            border-collapse: collapse; 
            table-layout: fixed; 
          }
          .print-table tr, .print-table th, .print-table td { 
            border: none; 
            vertical-align: top;
          }
          
          .print-table thead th { 
            font-weight: 800 !important; 
            font-size: 14px !important; 
            padding: 2px 1px; 
            color: #000; 
            white-space: nowrap;
            text-align: left;
          }
          .print-table thead th.text-right { text-align: right; }
          .print-table thead th.text-center { text-align: center; }
          
          .print-table tbody td { 
            padding: 2px 1px; 
            font-size: 13px;
            font-weight: 700 !important;
          }
          
          /* --- Column Specific Styles --- */
          .col-billdate { 
            width: 15%; 
            white-space: nowrap;
          }
          .col-itemname { 
            width: 40%; 
            white-space: normal;
          }
          .col-qty { 
            width: 15%; 
            text-align: center;
            white-space: nowrap;
            font-size: 14px !important;
          }
          .col-rate { 
            width: 15%; 
            text-align: right; 
            white-space: nowrap;
            font-size: 14px !important;
            font-family: "Courier New", monospace;
          }
          .col-amount { 
            width: 15%; 
            text-align: right; 
            white-space: nowrap;
            font-size: 14px !important;
            font-family: "Courier New", monospace;
          }

          /* --- Totals and Footer --- */
          .totals-section, .totals-section span { font-size: 15px !important; font-weight: 700 !important; }
          .totals-section .hr-line { margin: 2px 0; }
          .final-balance, .final-balance span { font-size: 16px !important; font-weight: 800 !important; }
          .print-footer { margin-top: 18px; text-align: left; font-size: 10px; font-weight: 800; font-style: italic; }
        }

        /* ===============================
          A4 PRINT (Unchanged)
        ================================ */
        @media print {
          .print-root.a4 { width: 210mm; margin: 0 auto; font-family: Arial, sans-serif; font-size: 12px; }
          .print-root.a4 #print-area { padding: 15mm; }
          .print-root.a4 .print-table { width: 100%; border-collapse: collapse; table-layout: auto; }
          .print-root.a4 .print-table th, .print-root.a4 .print-table td { padding: 5px; border-bottom: 1px solid #eee; }
          .print-root.a4 .print-table th { font-weight: bold; text-align: left; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

export default function PrintSalesReportPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
        <PrintPageContent />
      </Suspense>
    );
  }
