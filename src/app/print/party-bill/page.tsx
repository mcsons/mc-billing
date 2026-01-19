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
            decodedData.date = new Date(decodedData.date.seconds * 1000);
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
          <header className="text-center">
            <p className="font-bold text-lg">M.C & SONS FISH COMPANY</p>
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
          <Table className="text-sm">
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
      </div>
      <style jsx global>{`
        @media print {
          .print-root {
            width: 150mm;
            height: 148mm;
            overflow: hidden;
          }
          @page {
            size: 150mm 148mm;
            margin: 5mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden { display: none; }
          #print-area {
            font-family: monospace;
          }
          .bg-black {
            background-color: #000 !important;
            height: 1px !important;
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
