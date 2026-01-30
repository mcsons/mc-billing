'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { VehicleBill } from '@/lib/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<VehicleBill | null>(null);
  const paper = searchParams.get('paper') || 'thermal';

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
          <header className="text-center">
            <h1 className="header-title">M.C & SONS FISH COMPANY</h1>
            <p className="header-sub">
              No. 1, Fish Market, Palladam Road,
              <span className="city">Tiruppur - 641604</span>
            </p>
            <p className="header-sub header-phone">📞 9843223078, 9944444497</p>
          </header>
          <div className="hr-line"></div>
          <h2 className="text-lg font-semibold mt-2 mb-2 text-center">Vehicle Bill</h2>
          
          <div className="flex justify-between mb-2 text-sm">
            <p className="bill-no"><span className="font-semibold">Bill No:</span> <strong>{id.slice(0, 8).toUpperCase()}</strong></p>
            <p className="bill-date">
                <span className="font-semibold">Date:</span>{' '}
                <strong>{billDate instanceof Date && !isNaN(billDate.getTime()) ? format(billDate, 'dd-MM-yyyy') : 'Invalid Date'}</strong>
            </p>
          </div>
        
          <div className="space-y-1 totals-section text-base my-2">
            <div className="hr-line"></div>
            <div className="flex justify-between"><span className="font-semibold">Vehicle No:</span><span>{vehicleId}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Party Name:</span><span>{partyName}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Driver Name:</span><span>{driverNames.join(', ')}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Destination:</span><span>{destination}</span></div>
            <div className="hr-line my-1"></div>
            <div className="flex justify-between"><span className="font-semibold">Advance:</span><span>₹{advance.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Expenses:</span><span>₹{expenses.toFixed(2)}</span></div>
            <div className="hr-line my-1"></div>
            <div className="flex justify-between final-balance"><span className="font-semibold">Balance:</span><span>₹{(advance - expenses).toFixed(2)}</span></div>
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

          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .print-table tr,
          .print-table th {
            border: none;
          }
          
          .print-table td {
             border: none;
          }

          .print-table thead th {
            font-weight: 800 !important;
            font-size: 14px !important;
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

          .col-sn {
            width: 8%;
            text-align: left;
            white-space: nowrap;
          }
          .col-product {
            width: 36%;
            text-align: left;
            word-break: break-word;
            white-space: normal;
          }
          .col-qty {
            width: 18%;
            text-align: center;
            white-space: nowrap;
          }
          .col-rate {
            width: 18%;
            text-align: right;
            white-space: nowrap;
          }
          .col-amount {
            width: 20%;
            text-align: right;
            white-space: nowrap;
          }

          .qty-uom {
            white-space: nowrap;
          }
          .uom-text {
            font-weight: 700 !important;
            margin-left: 2px;
          }

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
          .print-root.a4 {
            width: 210mm;
            margin: 0 auto;
            font-family: Arial, sans-serif;
            font-size: 12px;
          }

          .print-root.a4 #print-area {
            padding: 15mm;
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
