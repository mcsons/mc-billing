'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PartyBillItem } from '@/lib/data';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';

function PartyBillPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<any | null>(null);

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
    id, date, partyName, partyLocation, items, totalAmount, commission, expenses, rent, 
    cashReceived, bankReceived, totalReceived, previousBalance, totalAfterPrevious, finalBalance
  } = billData;

  const commissionPercent = commission;
  const commissionAmount = (totalAmount * commissionPercent) / 100;
  
  const totalBoxes = billData.totalBox;


  const formatQty = (item: PartyBillItem) => {
    if (item.box > 0) return `${item.box} BOX`;
    if (item.kgs > 0) return `${item.kgs.toFixed(1)} KGS`;
    return '-';
  };

  return (
    <>
      <div className="p-4 print:hidden flex justify-between items-center">
        <Button variant="outline" onClick={() => window.close()} className="text-foreground">
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
            <p className="sub-header">Dealer : SEA & TANK FOODS</p>
            <p className="sub-header-address">Shop No. 1, Fish Market, Palladam Road, Tiruppur - 641604</p>
            <p className="sub-header-address">📞 9843223078, 9944444497</p>
          </header>

          <section className="party-details">
            <div className="grid-item">
                <span className="label">Supplier Name:</span>
                <span className="value">{partyName}</span>
                 <span className="label mt-2">Address:</span>
                <span className="value">{partyLocation}</span>
            </div>
             <div className="grid-item">
                <span className="label">Date:</span>
                <span className="value font-bold">{format(date, 'dd/MM/yyyy')}</span>
                <span className="label mt-2">Total Boxes:</span>
                <span className="value">{totalBoxes}</span>
            </div>
          </section>

          <table className="items-table">
            <thead>
              <tr>
                <th className="col-sn">S/N</th>
                <th className="col-item">Item Name</th>
                <th className="col-qty">Qty</th>
                <th className="col-price">Unit Price</th>
                <th className="col-total">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="col-sn">{index + 1}</td>
                  <td className="col-item">{item.productName}</td>
                  <td className="col-qty">{formatQty(item)}</td>
                  <td className="col-price">{item.rate.toFixed(2)}</td>
                  <td className="col-total">{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="totals-container" style={{breakInside: 'avoid', pageBreakInside: 'avoid'}}>
            <div className="left-totals">
                <div className="deductions-group">
                    {commission > 0 && <div className="detail-row"><span>Commission ({commissionPercent.toFixed(1)}%):</span><span>₹{commissionAmount.toFixed(2)}</span></div>}
                    {expenses > 0 && <div className="detail-row"><span>Expenses:</span><span>₹{expenses.toFixed(2)}</span></div>}
                    {rent > 0 && <div className="detail-row"><span>Rent:</span><span>₹{rent.toFixed(2)}</span></div>}
                </div>
                <div className="payments-group">
                    {cashReceived > 0 && <div className="detail-row"><span>Cash Received:</span><span>₹{cashReceived.toFixed(2)}</span></div>}
                    {bankReceived > 0 && <div className="detail-row"><span>Bank Received:</span><span>₹{bankReceived.toFixed(2)}</span></div>}
                </div>
            </div>
             <table className="right-totals boxed-summary-table">
                <tbody>
                    <tr><td>Total Amount:</td><td>₹{totalAmount.toFixed(2)}</td></tr>
                    {billData.totalDeductions > 0 ? (<tr><td>Total Deductions:</td><td>₹{billData.totalDeductions.toFixed(2)}</td></tr>) : null}
                    <tr className="font-bold"><td>Net Amount:</td><td>₹{billData.netAmount.toFixed(2)}</td></tr>
                    <tr><td>Previous Balance:</td><td>₹{previousBalance.toFixed(2)}</td></tr>
                    <tr className="font-bold"><td>Total:</td><td>₹{totalAfterPrevious.toFixed(2)}</td></tr>
                    {totalReceived > 0 ? (<tr><td>Total Received:</td><td>₹{totalReceived.toFixed(2)}</td></tr>) : null}
                    <tr className="font-bold"><td>Final Balance:</td><td>₹{finalBalance.toFixed(2)}</td></tr>
                </tbody>
            </table>
          </section>
          <footer className="print-footer">Developed by MC & SONS</footer>
        </div>
      </div>
      <style jsx global>{`
        /* Screen-only styles for preview */
        @media screen {
            .party-bill-invoice {
                margin: 2rem auto;
            }
        }
        /* ===============================
          PRINT SETUP (114mm x 210mm)
        ================================ */
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
          body * {
            visibility: hidden;
            color: #000 !important;
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

        /* ===============================
          BASE LAYOUT & FONTS
        ================================ */
        .party-bill-invoice {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          width: 102mm; /* 114mm - 2*6mm margin */
          background: white;
          color: black;
        }

        .font-bold { font-weight: bold; }
        .text-lg { font-size: 11pt; }
        
        /* ===============================
          HEADER
        ================================ */
        .invoice-header {
          text-align: center;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .invoice-header .company-name { font-weight: bold; font-size: 14pt; margin: 0; }
        .invoice-header .sub-header { font-size: 10pt; margin: 1px 0; font-weight: 500; }
        .invoice-header .sub-header-address { font-size: 9pt; margin: 1px 0; }

        /* ===============================
          PARTY DETAILS BOX
        ================================ */
        .party-details {
          border: 1.5px solid black;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .party-details .grid-item { padding: 4px 6px; display: flex; flex-direction: column; border-bottom: 1.5px solid black; }
        .party-details .grid-item:nth-child(odd) { border-right: 1.5px solid black; }
        .party-details .grid-item:last-child { border-bottom: none; }
        .party-details .grid-item:nth-last-child(2) { border-bottom: none; }
        .party-details .label { font-weight: bold; font-size: 9pt; }
        .party-details .value { font-size: 10pt; }

        /* ===============================
          ITEMS TABLE
        ================================ */
        .items-table { width: 100%; margin-top: 8px; border-collapse: collapse; table-layout: fixed; }
        .items-table th, .items-table td { border: 1.5px solid black; padding: 6px; vertical-align: top; }
        .items-table thead tr { background-color: #f2f2f2 !important; }
        .items-table thead th { font-weight: bold; text-align: center; }
        
        .items-table .col-sn { width: 8mm; text-align: center; white-space: nowrap; }
        .items-table .col-item { width: auto; word-break: break-word; text-align: left; }
        .items-table .col-qty { width: 22mm; text-align: center; white-space: nowrap; }
        .items-table .col-price { width: 22mm; text-align: right; white-space: nowrap; font-family: "Courier New", monospace; }
        .items-table .col-total { width: 26mm; text-align: right; white-space: nowrap; font-family: "Courier New", monospace; font-weight: bold;}

        /* ===============================
          TOTALS SECTION
        ================================ */
        .totals-container { display: flex; justify-content: space-between; margin-top: 8px; width: 100%; break-inside: avoid; page-break-inside: avoid; }
        .left-totals { width: 50%; }
        .right-totals { width: 48%; }
        .left-totals .detail-row { display: flex; justify-content: space-between; padding: 1px 4px; font-size: 10pt;}
        .left-totals .detail-row span:first-child { font-weight: bold; }
        .left-totals .detail-row span:last-child { font-family: "Courier New", monospace; }
        
        .deductions-group { margin-bottom: 0; }
        .payments-group { margin-top: 20px; }

        .boxed-summary-table {
            border: 1.5px solid black;
            border-collapse: collapse;
            width: 100%;
        }
        .boxed-summary-table td {
            border-bottom: 1.5px solid black;
            padding: 4px 6px;
        }
        .boxed-summary-table tr.font-bold td {
            font-weight: bold;
        }
        .boxed-summary-table tr:last-child td {
            border-bottom: none;
        }
        .boxed-summary-table td:first-child {
            border-right: 1.5px solid black;
            font-weight: bold;
        }
        .boxed-summary-table td:last-child {
            text-align: right;
            font-family: "Courier New", monospace;
        }

        /* ===============================
          FOOTER
        ================================ */
        .print-footer {
          margin-top: calc(3 * 1.2em);
          text-align: left;
          font-size: 10px;
          font-weight: 800;
          font-style: italic;
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
