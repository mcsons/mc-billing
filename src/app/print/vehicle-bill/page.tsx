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
import { X, Printer } from 'lucide-react';
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
    <div>
        <div className="p-4 print:hidden flex justify-between items-center">
            <Button variant="outline" onClick={() => window.close()}>
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
          <header className="text-center mb-6">
            <h1 className="text-2xl font-bold font-headline">
              M.C & SONS FISH COMPANY
            </h1>
            <p className="text-sm">
              No. 1, Fish Market, Palladam Road, Tiruppur-641604
            </p>
            <p className="text-sm">📞 9843223078, 9944444497</p>
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
                {driverNames.length === 1 ? (
                    <TableRow>
                        <TableCell className="font-semibold">Driver Name</TableCell>
                        <TableCell className="text-right font-bold">{driverNames[0]}</TableCell>
                    </TableRow>
                ) : (
                    driverNames.map((name, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-semibold">Driver {index + 1}</TableCell>
                            <TableCell className="text-right font-bold">{name}</TableCell>
                        </TableRow>
                    ))
                )}
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
        </div>
      </div>
      <style jsx global>{`
        @media screen {
            #print-area {
                background: white;
                color: black;
                margin: 2rem auto;
            }
            .print-root.thermal #print-area {
                width: 79mm;
            }
            .print-root.a4 #print-area {
                width: 210mm;
                min-height: 297mm;
            }
        }
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

          .print\\:hidden {
            display: none !important;
          }
          
          #print-area {
              margin: 0;
              padding: 0;
          }
        }

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
