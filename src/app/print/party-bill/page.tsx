'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PartyBill } from '@/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function PartyBillPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<(PartyBill & { previousBalance: number; finalBalance: number; }) | null>(null);

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(data));
        if (decodedData.date) {
            // Handle date conversion from string or timestamp-like object
            if (typeof decodedData.date === 'object' && decodedData.date.seconds) {
                decodedData.date = new Date(decodedData.date.seconds * 1000);
            } else {
                decodedData.date = new Date(decodedData.date);
            }
        }
        setBillData(decodedData);
      } catch (error) {
        console.error('Failed to parse bill data:', error);
        router.push('/dashboard/party-bill');
      }
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
    date, partyName, totalBox, items, totalAmount, commission, expenses,
    rent, totalDeductions, netAmount, cashReceived, bankReceived,
    totalReceived, previousBalance, finalBalance
  } = billData;

  return (
    <div>
      <div className="p-4 print:hidden flex justify-between items-center">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
      <div className="print-root">
        <div id="print-area">
          <div className="content-wrapper">
              <header className="text-center">
                <h1 className="company-name">M.C & SONS FISH COMPANY</h1>
                <p className="text-sm">Dealer : SEA & TANK FOODS</p>
                <p className="text-sm">Shop No. 1, Fish Market, Santhaipettai,</p>
                <p className="text-sm">Palladam Road, Tiruppur – 641604</p>
                <p className="text-sm">Cell : 98432 23078, 99444 44497</p>
              </header>
              <Separator className="my-2 bg-black" />
              <div className="flex justify-between items-start text-sm">
                <div className="w-2/3">
                  <p>To M/S : <strong>{partyName}</strong></p>
                </div>
                <div className="w-1/3 text-right space-y-1">
                  <p>Date : {format(date, 'dd-MM-yyyy')}</p>
                  <p>Box : {totalBox}</p>
                </div>
              </div>
              <Separator className="my-2 bg-black" />
              <div className="table-section">
                  <Table className="text-sm print-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/4">Rate</TableHead>
                        <TableHead>Particulars</TableHead>
                        <TableHead className="w-1/4">Box</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>{item.rate.toFixed(2)}</TableCell>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.box}</TableCell>
                          <TableCell className="text-right">{item.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </div>
          </div>
          <div className="totals-section">
              <Separator className="my-2 bg-black" />
              <div className="flex justify-end">
                <div className="w-1/2 space-y-1 text-sm">
                  <div className="flex justify-between font-bold"><p>Total</p><p>{totalAmount.toFixed(2)}</p></div>
                  <Separator className="bg-black" />
                  <div className="flex justify-between"><p>Commission</p><p>{commission.toFixed(2)}</p></div>
                  <div className="flex justify-between"><p>Expenses</p><p>{expenses.toFixed(2)}</p></div>
                  <div className="flex justify-between"><p>Rent</p><p>{rent.toFixed(2)}</p></div>
                  <Separator className="bg-black" />
                  <div className="flex justify-between"><p>Total Less</p><p>{totalDeductions.toFixed(2)}</p></div>
                  <Separator className="bg-black" />
                  <div className="flex justify-between font-bold"><p>Net Bill Value</p><p>{netAmount.toFixed(2)}</p></div>
                  <Separator className="bg-black" />
                  <div className="flex justify-between"><p>Cash Received</p><p>{cashReceived.toFixed(2)}</p></div>
                  <div className="flex justify-between"><p>Bank Received</p><p>{bankReceived.toFixed(2)}</p></div>
                  <div className="flex justify-between"><p>Total Received</p><p>{totalReceived.toFixed(2)}</p></div>
                  <Separator className="bg-black" />
                  <div className="flex justify-between"><p>Previous Balance</p><p>{previousBalance.toFixed(2)}</p></div>
                  <Separator className="my-2 bg-black" />
                  <div className="flex justify-between font-bold text-base"><p>Final Balance</p><p>{finalBalance.toFixed(2)}</p></div>
                  <Separator className="my-2 bg-black" />
                </div>
              </div>
          </div>
          <footer className="print-footer">
            <p>Developed by MC & SONS</p>
          </footer>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page {
            size: 150mm; /* Fixed width, auto height */
            margin: 5mm;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-root {
            width: 150mm;
            margin: 0 auto;
          }

          .print\\:hidden { display: none !important; }

          #print-area {
            display: flex;
            flex-direction: column;
            min-height: calc(148mm - 10mm); /* Ensure content can fill at least one "page" before breaking */
            font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
          }

          .content-wrapper {
            flex-grow: 1; /* Allow content to grow and push totals down */
          }
          
          .company-name {
            font-size: 1.1rem;
            font-weight: bold;
            text-decoration: underline;
            text-decoration-thickness: 1px;
            text-underline-offset: 3px;
          }

          .bg-black {
            background-color: #000 !important;
            border-color: #000 !important;
            height: 1px !important;
          }

          .print-table tr {
            break-inside: avoid; /* Prevent table rows from splitting across pages */
          }

          .totals-section {
            flex-shrink: 0; /* Prevent totals from shrinking */
            page-break-before: auto;
          }

          footer.print-footer {
            text-align: left;
            font-style: italic;
            font-size: 0.7rem;
            color: #555;
            margin-top: 1rem;
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function PrintPartyBillPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center">Loading Preview...</div>}>
            <PartyBillPrintContent />
        </Suspense>
    )
}
