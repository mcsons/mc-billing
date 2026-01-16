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
import { VehicleBill } from '@/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

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
    vehicleName,
    driverName,
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
        <CardContent className="print-content" id="print-area">
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

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p><span className="font-semibold">Vehicle:</span> {vehicleId} ({vehicleName})</p>
              <p><span className="font-semibold">Driver:</span> {driverName}</p>
              <p><span className="font-semibold">Destination:</span> {destination}</p>
            </div>
            <div className="text-right">
              <p>
                <span className="font-semibold">Bill No:</span> {id.slice(0, 8).toUpperCase()}
              </p>
              <p>
                <span className="font-semibold">Date:</span>{' '}
                {billDate instanceof Date && !isNaN(billDate.getTime()) ? format(billDate, 'P') : 'Invalid Date'}
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <div className="w-full max-w-sm space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">Advance Amount:</span>
                <span className="font-mono">₹{advance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Expenses:</span>
                <span className="font-mono">
                  ₹{expenses.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <span>Balance:</span>
                <span className="font-mono">₹{(advance - expenses).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <footer className="text-center mt-8 text-xs text-muted-foreground">
            <p>This is a computer-generated bill.</p>
          </footer>
        </CardContent>
      </Card>
      <style jsx global>{`
/* ===============================
   GLOBAL PRINT RESET
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
  
  #print-area,
  #print-area * {
    visibility: visible;
  }

  #print-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }

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

  .print-root.thermal h1 {
    font-size: 16px;
    margin-bottom: 4px;
  }
  
  .print-root.thermal h2 {
    font-size: 14px;
  }

  .print-root.thermal p {
    margin: 2px 0;
  }

  @page {
    size: 79mm auto;
    margin: 0;
  }
}

/* ===============================
   A4 / DESKTOP PRINT
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

  .print-root.a4 h1 {
    font-size: 22px;
    margin-bottom: 8px;
  }
  
  .print-root.a4 h2 {
    font-size: 18px;
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
