'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { VehicleBill } from '@/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<VehicleBill | null>(null);
  const paper = searchParams.get('paper') || 'a4';

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(data));
        // Dates might be strings or Timestamp-like objects from the URL, convert them.
        if (decodedData.date) {
            if (typeof decodedData.date === 'object' && decodedData.date.seconds) {
                // Handle Firestore Timestamp that was JSON.stringified
                decodedData.date = new Date(decodedData.date.seconds * 1000);
            } else {
                // Handle ISO date string
                decodedData.date = new Date(decodedData.date);
            }
        }
        setBillData(decodedData);
      } catch (error) {
        console.error('Failed to parse bill data:', error);
        router.push('/dashboard/vehicle-bill');
      }
    } else {
      router.push('/dashboard/vehicle-bill');
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
    id,
    date,
    vehicleId,
    driverNames,
    partyName,
    destination,
    advance,
    expenses
  } = billData;
  
  const billDate = date; // date is now a valid Date object

  return (
    <div className={`print-root ${paper}`}>
      <div className="flex justify-between items-center mb-4 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Vehicle Billing
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
      <Card className="print:shadow-none print:border-none print:bg-white">
        <CardContent id="print-area" className="p-6 md:p-8">
          <header className="text-center mb-6">
            <h1 className="text-2xl font-bold font-headline text-primary">
              M.C & SONS FISH COMPANY
            </h1>
            <p className="text-sm text-muted-foreground">
              No. 1, Fish Market, Palladam Road, Tiruppur-641604
            </p>
            <p className="text-sm text-muted-foreground">📞 9894089889</p>
             <h2 className="text-lg font-semibold mt-4">Vehicle Bill</h2>
          </header>

          <Table className="print-table">
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">Bill No</TableCell>
                <TableCell className="text-right">{id.slice(0, 8).toUpperCase()}</TableCell>
              </TableRow>
               <TableRow>
                <TableCell className="font-semibold">Date</TableCell>
                <TableCell className="text-right font-bold">
                  {billDate instanceof Date && !isNaN(billDate.getTime()) ? format(billDate, 'P') : 'Invalid Date'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Vehicle Number</TableCell>
                <TableCell className="text-right font-bold">{vehicleId}</TableCell>
              </TableRow>
               <TableRow>
                <TableCell className="font-semibold">Party Name</TableCell>
                <TableCell className="text-right">{partyName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Driver Name(s)</TableCell>
                <TableCell className="text-right font-bold">{driverNames.join(', ')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Destination</TableCell>
                <TableCell className="text-right font-bold">{destination}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Advance Amount</TableCell>
                <TableCell className="text-right font-mono">₹{advance.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Expenses</TableCell>
                <TableCell className="text-right font-mono">₹{expenses.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow className="font-bold text-base border-t-2">
                <TableCell>Balance</TableCell>
                <TableCell className="text-right font-mono">₹{(advance - expenses).toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <footer className="text-center mt-8 text-xs text-muted-foreground">
            <p>This is a computer-generated bill.</p>
          </footer>
        </CardContent>
      </Card>
      <style jsx global>{`
/* ===============================
   GLOBAL PRINT ISOLATION (CRITICAL)
================================ */
@media print {
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Hide EVERYTHING */
  body * {
    visibility: hidden;
  }

  /* Show ONLY the bill */
  #print-area,
  #print-area * {
    visibility: visible;
  }

  /* Lock print area to page */
  #print-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }

  /* Hide UI-only elements */
  .print\\:hidden {
    display: none !important;
  }
}

/* ===============================
   THERMAL PRINT — 79mm
================================ */
@media print {
  .print-root.thermal {
    width: 79mm;
    font-family: monospace;
    font-size: 11px;
  }

  .print-root.thermal #print-area {
    padding: 4mm;
  }

  .print-root.thermal table {
    width: 100%;
    border-collapse: collapse;
  }

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

/* ===============================
   A4 PRINT
================================ */
@media print {
  .print-root.a4 {
    width: 210mm;
    font-family: Arial, sans-serif;
    font-size: 14px;
  }

  .print-root.a4 #print-area {
    padding: 15mm;
  }

  .print-root.a4 table {
    width: 100%;
    border-collapse: collapse;
  }

  .print-root.a4 td {
    padding: 6px;
    border-bottom: 1px solid #ddd;
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


export default function PrintVehicleBillPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}
