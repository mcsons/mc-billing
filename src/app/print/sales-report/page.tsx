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

const formatINR = (value: number) => {
  if (value == null || isNaN(value)) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

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
    .map(([uom, qty]) => {
        // Apply unit-specific formatting: BOX as whole numbers, others with decimals
        const uomUpper = uom.toUpperCase();
        if (uomUpper === 'BOX') {
            return `${Math.round(qty)} BOX`;
        }
        return `${qty.toFixed(2)} ${uomUpper}`;
    })
    .join(', ');

  return (
    <div>
        <div className="flex justify-between items-center mb-4 p-4 print:hidden">
          <Button variant="outline" onClick={() => window.close()} className="text-foreground">
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
                No. 1, Fish Market, Palladam Road,<br />
                Tiruppur - 641604
              </p>
              <p className="header-sub header-phone">📞 9597833277, 9894089889</p>
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
                <p>
                  <span className="font-semibold">Customer Name:</span>{" "}
                  <strong className="cust-name-highlight">
                    {customer?.name_ta || customer?.name_en || '-'}
                  </strong>
                </p>
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
                            <TableCell className="col-qty">
                            {item.product === 'Delivery' ? (
                                <span className="qty-uom"><strong>-</strong></span>
                              ) : (
                                <span className="qty-uom">
                                  <strong>{item.qty.toFixed(1)}</strong>
                                  <span className="uom-text">{item.uom}</span>
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="col-rate text-right">
                                {item.product === 'Delivery' ? '-' : Math.round(item.rate)}
                            </TableCell>
                            <TableCell className="col-amount text-right">{Math.round(item.amount)}</TableCell>
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
                <div className="flex justify-between items-center font-bold">
                    <div className="flex gap-2 items-center whitespace-nowrap">
                        <span>Total ==&gt;</span>
                        <span className="qty-summary-text">{totalQtyString}</span>
                    </div>
                    <div className="text-right">
                        {formatINR(totalAmount)}
                    </div>
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
        /* ===============================
          SCREEN PREVIEW STYLES
        ================================ */
        @media screen {
            #print-area {
                background: white;
                color: black;
                margin: 2rem auto;
                width: 106mm;
            }
        }

        /* --- Global Print Reset --- */
        @media print {
          * { color: #000 !important; -webkit-font-smoothing: none; font-smoothing: none; text-rendering: optimizeSpeed; }
          body { margin: 0; padding: 0; background: white !important; print-color-adjust: exact; }
          #print-area { margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
        }

        /* ===============================
          THERMAL (106mm)
        ================================ */
        @media print {
          #print-area {
             padding: 2mm 4mm 18mm 4mm;
          }
          /* --- Base styles copied from Main Bill Print --- */
          .print-root.thermal { width: 106mm; max-width: 106mm; margin: 0 auto; font-family: 'Courier New', 'Lucida Console', monospace !important; }
          .header-title { font-size: 22px !important; font-weight: 700; letter-spacing: 0.5px; line-height: 1.2; white-space: nowrap; }
          .header-sub { display: block; text-align: center; font-size: 13px !important; font-weight: 700; line-height: 1.3; margin-top: 2px; }
          .header-sub .city { display: block; }
          .header-phone { margin-top: 4px; }
          .hr-line { border-top: 2px solid #000; margin: 6px 0; }
          .table-header-line { border-top: 2px solid #000; margin: 0; }
          .qty-uom {
            display: inline-flex;
            justify-content: flex-end;
            align-items: center;
          }

          .uom-text {
            margin-left: 3px;
          }

          /* --- Customer Name Highlight --- */
          .cust-name-highlight {
            font-size: 16px !important;
            font-weight: bold !important;
          }

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
          .print-table td.col-qty,
          .print-table th.col-qty {
            text-align: right !important;
            padding-right: 4px;
          }
          
          /* --- Column Specific Styles (Adjusted for Alignment) --- */
          .col-billdate { 
            width: 15%; 
            white-space: nowrap;
          }
          .col-itemname { 
            width: 49%; 
            white-space: normal;
            font-size: 10px !important; 
            padding-right: 4px;
            word-break: keep-all; 
          }
          .col-qty { 
            width: 12%; 
            white-space: nowrap;
            font-size: 14px !important;
          }
          .col-rate { 
            width: 10%; 
            text-align: right; 
            white-space: nowrap;
            font-size: 14px !important;
            font-family: "Courier New", monospace;
          }
          .col-amount { 
            width: 14%; 
            text-align: right; 
            white-space: nowrap;
            font-size: 14px !important;
            font-family: "Courier New", monospace;
          }

          /* --- Totals and Footer --- */
          .totals-section, .totals-section span { font-size: 15px !important; font-weight: 700 !important; }
          .qty-summary-text { white-space: nowrap; }
          .totals-section .hr-line { margin: 2px 0; }
          .final-balance, .final-balance span { font-size: 16px !important; font-weight: 800 !important; }
          .print-footer { margin-top: 18px; text-align: left; font-size: 10px; font-weight: 800; font-style: italic; }
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