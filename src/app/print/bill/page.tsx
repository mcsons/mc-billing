'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
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
import { BillItem, Customer } from '@/lib/data';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface BillPrintData {
  billNo: string;
  date: string;
  customer: Customer;
  items: BillItem[];
  itemsTotal: number;
  deliveryCharge: number;
  totalAmount: number;
  previousBalance: number;
  paidAmount: number;
  finalBalance: number;
  stall: string;
}

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<BillPrintData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const paper = searchParams.get('paper') || 'thermal';
  const autoShare = searchParams.get('share') === 'pdf';

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = decodeURIComponent(data);
        setBillData(JSON.parse(decodedData));
      } catch (error) {
        console.error('Failed to parse bill data:', error);
        router.push('/dashboard');
      }
    } else {
      router.push('/dashboard');
    }
  }, [searchParams, router]);

  const handleSharePDF = useCallback(async () => {
    const captureEl = document.getElementById('pdf-area');
    if (!captureEl || !billData) return;

    setIsSharing(true);
    setShareError(null);

    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jsPDFModule;

      const canvas = await html2canvas(captureEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: captureEl.scrollWidth,
        windowHeight: captureEl.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = pageWidth * (canvas.height / canvas.width);

      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(imgHeight, pageHeight));

      const pdfBlob = pdf.output('blob');
      const billDateFormatted = billData.date
        ? format(new Date(billData.date), 'dd-MM-yyyy')
        : 'receipt';
      const fileName = `MC_Bill_${billDateFormatted}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Build WhatsApp Message Fallback
      const phone = (billData.customer?.phone || '').replace(/\D/g, '');
      const waMessage = `*M.C & SONS FISH COMPANY*\n*Bill PDF*\n\nBill Date: ${billDateFormatted}\nCustomer: ${billData.customer?.name_en || ''}\n\nPlease find the attached PDF bill.\n\nThank you!`;
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Bill Date: ${billDateFormatted} - M.C & SONS`,
            text: `Bill Date: ${billDateFormatted} from M.C & SONS FISH COMPANY`,
            files: [file],
          });
          sharedViaWebShare = true;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            setIsSharing(false);
            return;
          }
          console.warn('Native share failed, falling back:', shareErr);
        }
      }

      // Fallback: Download + Open WhatsApp
      if (!sharedViaWebShare) {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          URL.revokeObjectURL(url);
          window.open(waUrl, '_blank');
        }, 400);
        setShareError('PDF downloaded! Attach it to the WhatsApp chat that just opened.');
      }
    } catch (err: any) {
      console.error('Share PDF failed:', err);
      setShareError('Could not generate PDF. Please try printing to PDF instead.');
    } finally {
      setIsSharing(false);
    }
  }, [billData]);

  if (!billData) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <p>Loading bill data...</p>
      </div>
    );
  }

  const {
    billNo,
    date,
    customer,
    items,
    itemsTotal,
    deliveryCharge,
    totalAmount,
    previousBalance,
    paidAmount,
    finalBalance,
  } = billData;

  const displayDeliveryCharge = parseFloat(deliveryCharge.toString()) || 0;

  const formatINR = (value: number) => {
    if (value == null || isNaN(value)) return "0.00";
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const totalKgs = items
    .filter((i) => i.uom.toUpperCase() === 'KGS')
    .reduce((sum, i) => sum + i.qty, 0);
  const totalBox = items
    .filter((i) => i.uom.toUpperCase() === 'BOX')
    .reduce((sum, i) => sum + i.qty, 0);

  const qtyStrings = [];
  if (totalKgs > 0) qtyStrings.push(`${totalKgs.toFixed(1)} KGS`);
  if (totalBox > 0) qtyStrings.push(`${Math.round(totalBox)} BOX`);
  const totalQtyString = qtyStrings.join(', ').trim();

  const S = {
    cell: (extra?: React.CSSProperties): React.CSSProperties => ({
      border: '1px solid #bbb',
      padding: '7px 9px',
      ...extra,
    }),
    hCell: (extra?: React.CSSProperties): React.CSSProperties => ({
      border: '1px solid #bbb',
      padding: '7px 9px',
      background: '#f4f4f4',
      fontWeight: 'bold' as const,
      ...extra,
    }),
  };

  const hiddenA4 = (
    <div
      id="pdf-area"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '210mm',
        minHeight: '297mm',
        padding: '15mm',
        background: '#fff',
        color: '#000',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 3px 0' }}>
          M.C & SONS FISH COMPANY
        </h1>
        <p style={{ fontSize: '11px', margin: '2px 0' }}>No. 1, Fish Market, Palladam Road,</p>
        <p style={{ fontSize: '11px', margin: '2px 0' }}>Tiruppur - 641604</p>
        <p style={{ fontSize: '11px', margin: '4px 0 0 0' }}>📞 9894089889</p>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 6px', fontSize: '12px' }}>
        <div style={{ width: '55%' }}>
          <p><strong>ID:</strong> {customer?.id === 'WALK-IN' ? '-' : customer?.id}</p>
          <p><strong>Name:</strong> {customer?.name_en || customer?.name_ta || '-'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p><strong>Bill No:</strong> {billNo}</p>
          <p><strong>Date:</strong> {format(new Date(date), 'dd-MM-yyyy')}</p>
        </div>
      </div>

      <div style={{ borderTop: '1.5px solid #444', margin: '6px 0 10px' }} />

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #444' }}>
        <thead>
          <tr>
            <th style={S.hCell({ textAlign: 'left' })}>Product</th>
            <th style={S.hCell({ textAlign: 'right', width: '80px' })}>Qty</th>
            <th style={S.hCell({ textAlign: 'right', width: '80px' })}>Rate</th>
            <th style={S.hCell({ textAlign: 'right', width: '100px' })}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 1 ? '#fafafa' : '#fff' }}>
              <td style={S.cell({ textAlign: 'left' })}>{item.product}</td>
              <td style={S.cell({ textAlign: 'right' })}>{item.qty}{item.uom}</td>
              <td style={S.cell({ textAlign: 'right' })}>{item.rate.toFixed(2)}</td>
              <td style={S.cell({ textAlign: 'right' })}>{formatINR(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={S.hCell({ textAlign: 'left' })}>TOTAL ITEMS: {items.length}</td>
            <td colSpan={2} style={S.hCell({ textAlign: 'right' })}>{totalQtyString ? `TOTAL QTY: ${totalQtyString}` : ''}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '260px' }}>
          <tbody>
            <tr><td style={{ padding: '4px' }}>Items Total:</td><td style={{ padding: '4px', textAlign: 'right' }}>₹{formatINR(itemsTotal)}</td></tr>
            {displayDeliveryCharge > 0 && (
              <tr><td style={{ padding: '4px' }}>Delivery:</td><td style={{ padding: '4px', textAlign: 'right' }}>₹{formatINR(displayDeliveryCharge)}</td></tr>
            )}
            <tr><td style={{ padding: '4px' }}>Old Balance:</td><td style={{ padding: '4px', textAlign: 'right' }}>₹{formatINR(previousBalance)}</td></tr>
            <tr style={{ fontWeight: 'bold', borderTop: '1px solid #000' }}><td style={{ padding: '4px' }}>Final Balance:</td><td style={{ padding: '4px', textAlign: 'right' }}>₹{formatINR(finalBalance)}</td></tr>
          </tbody>
        </table>
      </div>
      <footer style={{ marginTop: '20px', fontSize: '10px', fontStyle: 'italic' }}>Developed by MC & SONS</footer>
    </div>
  );

  return (
    <div>
      {autoShare && (
        <div className="print:hidden bg-green-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Share2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm leading-tight">Your bill is ready to share!</p>
              <p className="text-xs text-green-100 leading-tight mt-0.5">Tap the button to send this bill as a PDF via WhatsApp.</p>
            </div>
          </div>
          <Button onClick={handleSharePDF} disabled={isSharing} className="bg-white text-green-700 hover:bg-green-50">
            {isSharing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Share2 className="mr-2 h-4 w-4" /> Share via WhatsApp</>}
          </Button>
        </div>
      )}

      {shareError && (
        <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">{shareError}</div>
      )}

      <div className="p-4 print:hidden flex justify-between items-center gap-2">
        <Button variant="outline" onClick={() => window.close()} className="text-foreground">
          <X className="mr-2 h-4 w-4" /> Close Preview
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSharePDF} disabled={isSharing} className="border-green-500 text-green-700 hover:bg-green-50">
            {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share (PDF)
          </Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        </div>
      </div>

      <div className={`print-root ${paper}`}>
        <div id="print-area">
          <header className="text-center">
            <h1 className="header-title">M.C & SONS FISH COMPANY</h1>
            <p className="header-sub">No. 1, Fish Market, Palladam Road,<br />Tiruppur - 641604</p>
            <p className="header-sub header-phone">📞 9894089889</p>
          </header>
          <div className="hr-line" />
          
          <div className="mb-2 text-sm font-mono flex justify-between">
            <div style={{ width: '55%' }}>
              <p>ID: <strong>{customer?.id === 'WALK-IN' ? '-' : customer?.id}</strong></p>
              <p>Name: <strong>{customer?.id === 'WALK-IN' ? (customer?.name_en && customer.name_en !== '--' ? customer.name_en : '--') : (customer?.name_en || customer?.name_ta || '-')}</strong></p>
            </div>
            <div className="text-right">
              <p>Bill No: <strong>{billNo}</strong></p>
              <p>Date: <strong>{format(new Date(date), 'dd-MM-yyyy')}</strong></p>
            </div>
          </div>

          <Table className="print-table">
            <TableHeader>
              <TableRow className="header-row-divider"><TableCell colSpan={4} className="p-0"><div className="table-header-line" /></TableCell></TableRow>
              <TableRow className="header-content-row">
                <TableHead className="col-product text-left">Product</TableHead>
                <TableHead className="col-qty text-right">Qty</TableHead>
                <TableHead className="col-rate text-right">Rate</TableHead>
                <TableHead className="col-amount text-right">Amount</TableHead>
              </TableRow>
              <TableRow className="header-row-divider"><TableCell colSpan={4} className="p-0"><div className="table-header-line" /></TableCell></TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="col-product text-left">{item.product}</TableCell>
                  <TableCell className="col-qty text-right"><strong>{item.qty}</strong><span className="text-[10px] ml-0.5">{item.uom}</span></TableCell>
                  <TableCell className="col-rate text-right font-mono">{item.rate.toFixed(2)}</TableCell>
                  <TableCell className="col-amount text-right font-mono">{paper === 'a4' ? formatINR(item.amount) : item.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow><TableCell colSpan={4} className="p-0"><div className="table-header-line" /></TableCell></TableRow>
              <TableRow>
                <TableCell colSpan={4} className="px-1 py-1">
                  <div className="flex justify-between items-center font-bold text-[11px] uppercase">
                    <span>Items: {items.length}</span>
                    {totalQtyString && <span>Total: {totalQtyString}</span>}
                  </div>
                </TableCell>
              </TableRow>
              <TableRow><TableCell colSpan={4} className="p-0"><div className="table-header-line" /></TableCell></TableRow>
            </TableBody>
          </Table>

          <div className="flex justify-end mt-2">
            <table className="summary-table">
              <tbody>
                <tr><td>Items Total</td><td>:</td><td className="text-right">₹{paper === 'a4' ? formatINR(itemsTotal) : itemsTotal.toFixed(2)}</td></tr>
                {displayDeliveryCharge > 0 && (
                  <tr><td>Delivery</td><td>:</td><td className="text-right">₹{paper === 'a4' ? formatINR(displayDeliveryCharge) : displayDeliveryCharge.toFixed(2)}</td></tr>
                )}
                <tr><td>Prev Balance</td><td>:</td><td className="text-right">₹{paper === 'a4' ? formatINR(previousBalance) : previousBalance.toFixed(2)}</td></tr>
                <tr className="border-t border-black font-bold"><td>Final Balance</td><td>:</td><td className="text-right">₹{paper === 'a4' ? formatINR(finalBalance) : finalBalance.toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>
          <footer className="print-footer mt-4">Developed by MC & SONS</footer>
        </div>
      </div>
      
      {hiddenA4}

      <style jsx global>{`
        @media screen {
          #print-area { background: white; color: black; padding: 2rem; margin: 2rem auto; }
          .print-root.thermal #print-area { width: 106mm; }
          .print-root.a4 #print-area { width: 210mm; min-height: 297mm; }
        }
        @media print {
          * { color: #000 !important; }
          body { margin: 0; padding: 0; background: white !important; }
          .print\:hidden { display: none !important; }
          @page { size: ${paper === 'thermal' ? '106mm auto' : 'A4'}; margin: 0; }
          .print-root.thermal { width: 106mm; margin: 0 auto; font-family: monospace; }
          .print-root.thermal #print-area { padding: 1.5cm 4mm 10mm 4mm; }
          .header-title { font-size: 22px; font-weight: bold; }
          .hr-line { border-top: 2px solid #000; margin: 6px 0; }
          .table-header-line { border-top: 1px solid #000; margin: 0; }
          .print-table { width: 100%; border-collapse: collapse; }
          .col-product { width: 60%; font-size: 11px; }
          .summary-table { width: 100%; max-width: 280px; font-weight: bold; font-size: 14px; }
          .print-footer { font-size: 10px; font-style: italic; margin-top: 10mm; }
        }
      `}</style>
    </div>
  );
}

export default function PrintBillPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen text-white">Loading Preview...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}