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
        if (decodedData.date) {
            if (typeof decodedData.date === 'object' && decodedData.date.seconds) {
                decodedData.date = new Date(decodedData.date.seconds * 1000);
            } else {
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
    return null;
  }

  const {
    id,
    date,
    vehicleId,
    driverName,
    partyName,
    destination,
    advance,
    expenses
  } = billData;
  
  const billDate = date;

  return (
    <div>
      <div className="flex justify-between items-center mb-4 p-4 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Vehicle Billing
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
      <div className={`print-root ${paper}`}>
        <div id="print-area">
          <header className="text-center mb-6">
            <h1 className="text-2xl font-bold">
              M.C & SONS FISH COMPANY
            </h1>
            <p>
              No. 1, Fish Market, Palladam Road, Tiruppur-641604
            </p>
            <p>📞 9894089889</p>
             <h2 className="text-lg font-semibold mt-4">Vehicle Bill</h2>
          </header>

          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">Bill No</TableCell>
                <TableCell className="text-right">{id.slice(0, 8).toUpperCase()}</TableCell>
              </TableRow>
               <TableRow>
                <TableCell className="font-semibold">Date</TableCell>
                <TableCell className="text-right font-bold">
                  {billDate instanceof Date && !isNaN(billDate.getTime()) ? format(billDate, 'dd-MM-yyyy') : 'Invalid Date'}
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
                <TableCell className="font-semibold">Driver Name</TableCell>
                <TableCell className="text-right font-bold">{driverName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Destination</TableCell>
                <TableCell className="text-right font-bold">{destination}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Advance Amount</TableCell>
                <TableCell className="text-right">₹{advance.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Expenses</TableCell>
                <TableCell className="text-right">₹{expenses.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow className="font-bold text-base border-t-2">
                <TableCell>Balance</TableCell>
                <TableCell className="text-right">₹{(advance - expenses).toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <footer className="text-center mt-8 text-xs">
            <p>This is a computer-generated bill.</p>
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
        .print-root.thermal table {
            width: 100%;
            border-collapse: collapse;
        }
        .print-root.thermal td {
            padding: 1.5px 0;
        }

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
        .print-root.a4 td {
            padding: 5px;
            border-bottom: 1px solid #eee;
        }
      `}</style>
    </div>
  );
}


export default function PrintVehicleBillPage() {
  return (
    <Suspense>
      <PrintPageContent />
    </Suspense>
  );
}
