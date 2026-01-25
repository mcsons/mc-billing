'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PartyBill, PartyBillItem } from '@/lib/data';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';

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
    id, date, partyName, items, totalAmount, commission, expenses, rent, totalDeductions, netAmount, cashReceived, bankReceived, totalReceived, previousBalance, finalBalance
  } = billData;

  const formatQty = (item: PartyBillItem) => {
    if (item.box > 0) return `${item.box} BOX`;
    if (item.kgs > 0) return `${item.kgs} KGS`;
    return '-';
  };

  return (
    <>
      <div className="p-4 print:hidden flex justify-between items-center">
        <Button variant="outline" onClick={() => window.close()}>
          <X className="mr-2 h-4 w-4" />
          Close
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
      <div className="party-bill-invoice">
        <div id="print-area">
          <header className="invoice-header">
            <h1 className="company-name">M.C & SONS FISH COMPANY</h1>
            <p className="sub-header">ICE FISH MERCHANTS</p>
            <p className="address">Shop No. 1, Fish Market, Santhaipettai, Tiruppur – 641604</p>
          </header>

          <section className="party-details">
            <div className="grid-item label-cell">Supplier Name</div>
            <div className="grid-item value-cell">{partyName}</div>
            <div className="grid-item label-cell">Purchase No</div>
            <div className="grid-item value-cell">{id.slice(0, 8).toUpperCase()}</div>
            <div className="grid-item label-cell address-label">Address</div>
            <div className="grid-item value-cell address-value">{partyName}</div>
            <div className="grid-item label-cell date-label">Date</div>
            <div className="grid-item value-cell date-value">{format(date, 'dd/MM/yyyy')}</div>
          </section>

          <table className="items-table">
            <thead>
              <tr>
                <th className="col-no">No</th>
                <th className="col-item">Item Name</th>
                <th className="col-price">Unit Price</th>
                <th className="col-qty">Box/Kg</th>
                <th className="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="col-no">{index + 1}</td>
                  <td className="col-item">{item.productName}</td>
                  <td className="col-price">{item.rate.toFixed(2)}</td>
                  <td className="col-qty">{formatQty(item)}</td>
                  <td className="col-total">{item.amount.toFixed(2)}</td>
                </tr>
              ))}
               {/* Add blank rows to extend table if needed */}
              {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
                 <tr key={`blank-${i}`} className="blank-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
              ))}
            </tbody>
          </table>

          <div className="summary-container">
            <div className="notes-area">
                {/* This area can be used for notes if needed */}
            </div>
            <div className="summary-box">
                <div className="summary-row">
                    <span className="summary-label">Total Amount</span>
                    <span className="summary-value">₹{totalAmount.toFixed(2)}</span>
                </div>
                {commission > 0 && <div className="summary-row"><span className="summary-label">Commission</span><span className="summary-value">₹{commission.toFixed(2)}</span></div>}
                {expenses > 0 && <div className="summary-row"><span className="summary-label">Expenses</span><span className="summary-value">₹{expenses.toFixed(2)}</span></div>}
                {rent > 0 && <div className="summary-row"><span className="summary-label">Rent</span><span className="summary-value">₹{rent.toFixed(2)}</span></div>}
                {totalDeductions > 0 && <div className="summary-row total-row"><span className="summary-label">Total Deductions</span><span className="summary-value">₹{totalDeductions.toFixed(2)}</span></div>}
                <div className="summary-row final-total-row"><span className="summary-label">Net Amount</span><span className="summary-value">₹{netAmount.toFixed(2)}</span></div>
                
                {cashReceived > 0 && <div className="summary-row received-row"><span className="summary-label">Cash Received</span><span className="summary-value">₹{cashReceived.toFixed(2)}</span></div>}
                {bankReceived > 0 && <div className="summary-row received-row"><span className="summary-label">Bank Received</span><span className="summary-value">₹{bankReceived.toFixed(2)}</span></div>}
                {totalReceived > 0 && <div className="summary-row total-row"><span className="summary-label">Total Received</span><span className="summary-value">₹{totalReceived.toFixed(2)}</span></div>}
                
                <div className="summary-row"><span className="summary-label">Previous Balance</span><span className="summary-value">₹{previousBalance.toFixed(2)}</span></div>
                <div className="summary-row final-total-row"><span className="summary-label">Final Balance</span><span className="summary-value">₹{finalBalance.toFixed(2)}</span></div>

            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page {
            size: 114mm 210mm;
            margin: 6mm;
          }
          body {
            background: white !important;
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Critical: Hide everything BUT the print area */
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden { display: none !important; }
        }

        .party-bill-invoice {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          width: 102mm; /* 114mm - 2*6mm margin */
          margin: 0 auto;
          background: white;
          color: black;
          display: flex;
          flex-direction: column;
        }

        .invoice-header {
          text-align: center;
          border-bottom: 1.5px solid black;
          padding-bottom: 8px;
        }
        .invoice-header .company-name {
          font-weight: bold;
          font-size: 16pt;
          margin: 0;
        }
        .invoice-header .sub-header,
        .invoice-header .address {
          font-size: 9pt;
          margin: 1px 0;
        }


        .party-details {
          border: 1.5px solid black;
          margin-top: 8px;
          display: grid;
          grid-template-columns: auto 1fr;
          grid-template-rows: auto auto;
        }
        .party-details .grid-item {
          padding: 4px 6px;
          display: flex;
          align-items: center;
        }
        .party-details .label-cell {
          font-weight: bold;
          border-right: 1.5px solid black;
          white-space: nowrap;
        }
         .party-details .address-label, .party-details .date-label {
            border-top: 1.5px solid black;
         }
         .party-details .address-value, .party-details .date-value {
             border-top: 1.5px solid black;
         }

        .items-table {
          width: 100%;
          margin-top: 8px;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 10pt;
        }
        .items-table th, .items-table td {
          border: 1.5px solid black;
          padding: 4px;
          vertical-align: top;
        }
        .items-table thead tr {
          background-color: #e9e9e9 !important;
        }
        .items-table thead th {
          font-weight: bold;
          text-align: center;
        }
        
        .items-table .blank-row td {
          border-left: 1.5px solid black;
          border-right: 1.5px solid black;
        }
        .items-table tr:not(:last-child) .blank-row td {
            border-bottom: none;
        }

        .items-table .col-no { width: 8%; text-align: center; }
        .items-table .col-item { width: 42%; word-wrap: break-word; }
        .items-table .col-price { width: 15%; text-align: right; font-family: "Courier New", monospace; white-space: nowrap; }
        .items-table .col-qty { width: 15%; text-align: center; font-family: "Courier New", monospace; white-space: nowrap; }
        .items-table .col-total { width: 20%; text-align: right; font-family: "Courier New", monospace; white-space: nowrap; }

        .summary-container {
            display: flex;
            width: 100%;
            margin-top: -1.5px; /* Overlap with table bottom border */
        }
        .notes-area {
            flex-grow: 1;
            border-left: 1.5px solid black;
            border-bottom: 1.5px solid black;
        }
        .summary-box {
            width: 60%; /* Adjust as needed */
            border: 1.5px solid black;
            font-size: 10pt;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 6px;
            border-bottom: 1.5px solid black;
        }
        .summary-row:last-child {
            border-bottom: none;
        }
        .summary-label {
            font-weight: bold;
            text-align: left;
        }
        .summary-value {
            font-family: "Courier New", monospace;
            text-align: right;
            font-weight: bold;
        }
        .summary-row.total-row {
            border-top: 1.5px solid black;
        }
        .summary-row.final-total-row {
            font-size: 11pt;
            border-top: 2px solid black;
        }
         .summary-row.received-row {
            border-top: 1px dashed black;
        }
      `}</style>
    </>
  );
}

export default function PrintPartyBillPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center">Loading Preview...</div>}>
            <PartyBillPrintContent />
        </Suspense>
    )
}
