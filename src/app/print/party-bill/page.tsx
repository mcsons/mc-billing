'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PartyBillItem } from '@/lib/data';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

function PartyBillPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<any | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const autoShare = searchParams.get('share') === 'pdf';

  useEffect(() => {
    // Try localStorage first (used by Share PDF flow)
    const sessionData = localStorage.getItem('partyBillPrintData');
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        if (parsed.date) {
          if (typeof parsed.date === 'object' && parsed.date.seconds) {
            parsed.date = new Date(parsed.date.seconds * 1000);
          } else {
            parsed.date = new Date(parsed.date);
          }
        }
        setBillData(parsed);
        return;
      } catch (e) { console.error('Failed to parse localStorage data:', e); }
    }
    // Fallback to URL param
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
    } else {
      router.push('/dashboard/party-bill');
    }
  }, [searchParams, router]);

  // ─────────────────────────────────────────────────────────────
  //  Share PDF handler
  //  Captures the hidden #pdf-area div (inline-styled layout)
  //  which is always rendered with the correct look on screen.
  //  navigator.share() on mobile, wa.me download fallback on desktop.
  // ─────────────────────────────────────────────────────────────
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
      const storedName = localStorage.getItem('partyBillFileName');
      const billDateFormatted = billData.date ? format(new Date(billData.date), 'dd-MM-yyyy') : 'bill';
      const partyName = (billData.partyName || 'Party').replace(/\s+/g, '_');
      const fileName = storedName || `MC_PartyBill_${partyName}_${billDateFormatted}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const waMessage =
        `*M.C & SONS FISH COMPANY*\n*Party Bill PDF*\n\nParty Bill Date: ${billDateFormatted}\nParty: ${billData.partyName || ''}\n\nPlease find the attached PDF party bill.\n\nThank you!`;
      const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      // ── Mobile: try Web Share API (opens native share sheet → WhatsApp) ──
      // We attempt this first; if it fails for any non-user-cancel reason,
      // we fall through to the download + wa.me fallback.
      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          // Skip canShare() gate — it returns false on many Android browsers
          // even when sharing IS supported. Try directly and catch failures.
          await navigator.share({
            title: `Party Bill Date: ${billDateFormatted} - M.C & SONS`,
            text: `Party Bill Date: ${billDateFormatted} from M.C & SONS FISH COMPANY`,
            files: [file],
          });
          sharedViaWebShare = true;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            // User dismissed the share sheet — do nothing
            return;
          }
          // Any other error (e.g. file type not supported, permission denied):
          // fall through to the download + wa.me fallback below
          console.warn('Web Share API failed, using fallback:', shareErr);
        }
      }

      // ── Desktop / Web Share fallback: download PDF + open WhatsApp ──
      if (!sharedViaWebShare) {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        // Must be in the DOM for reliable download on mobile browsers
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Small delay so the download initiates before WhatsApp opens
        setTimeout(() => {
          URL.revokeObjectURL(url);
          window.open(waUrl, '_blank');
        }, 400);
        setShareError('PDF downloaded! Attach it to the WhatsApp chat that just opened.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Share PDF failed:', err);
        setShareError('Could not generate PDF. Please try printing instead.');
      }
    } finally {
      setIsSharing(false);
    }
  }, [billData]);

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
  
  // Calculate sums for the new summary row
  const sumWeight = items.reduce((sum: number, item: PartyBillItem) => sum + ((item.box || 0) * (item.kgs || 0)), 0);
  
  const totalBoxes = billData.totalBox;

  // ─────────────────────────────────────────────────────────────
  //  Hidden party bill rendered with INLINE STYLES so html2canvas
  //  can capture it correctly (media-query print styles are
  //  invisible to html2canvas).
  //  This div is off-screen (left: -9999px) and never printed.
  //  Mirrors the exact same layout as #print-area.
  // ─────────────────────────────────────────────────────────────
  const cellBorder = '1.5px solid black';

  const hiddenPdfArea = (
    <div
      id="pdf-area"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '480px', // ~127mm at 96dpi — matches the main billing reference
        background: '#fff',
        color: '#000',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10pt',
        boxSizing: 'border-box',
        padding: '16px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', paddingBottom: '6px', marginBottom: '6px', width: '100%' }}>
        <div style={{ fontWeight: 'bold', fontSize: '16pt', margin: 0 }}>M.C &amp; SONS FISH COMPANY</div>
        <div style={{ fontSize: '10pt', margin: '1px 0', fontWeight: 500 }}>Dealer : SEA &amp; TANK FOODS</div>
        <div style={{ fontSize: '9pt', margin: '1px 0' }}>Shop No. 1, Fish Market, Palladam Road, Tiruppur - 641604</div>
        <div style={{ fontSize: '9pt', margin: '1px 0' }}>📞 9843223078, 9944444497</div>
      </div>

      {/* Party Details Grid */}
      <div style={{
        border: cellBorder,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Row 1 */}
        <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'row', alignItems: 'baseline', borderBottom: cellBorder, borderRight: cellBorder }}>
          <span style={{ fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap', width: '28mm', display: 'inline-block', flexShrink: 0 }}>Party Name :</span>
          <span style={{ fontSize: '10pt', overflowWrap: 'anywhere', fontWeight: 'bold' }}>{partyName}</span>
        </div>
        <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'row', alignItems: 'baseline', borderBottom: cellBorder }}>
          <span style={{ fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap', width: '28mm', display: 'inline-block', flexShrink: 0 }}>Date :</span>
          <span style={{ fontSize: '10pt', fontWeight: 'bold' }}>{format(new Date(date), 'dd/MM/yyyy')}</span>
        </div>
        {/* Row 2 */}
        <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'row', alignItems: 'baseline', borderRight: cellBorder }}>
          <span style={{ fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap', width: '28mm', display: 'inline-block', flexShrink: 0 }}>Address :</span>
          <span style={{ fontSize: '10pt', overflowWrap: 'anywhere', fontWeight: 'bold' }}>{partyLocation}</span>
        </div>
        <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap', width: '28mm', display: 'inline-block', flexShrink: 0 }}>Total Boxes :</span>
          <span style={{ fontSize: '10pt', fontWeight: 'bold' }}>{totalBoxes}</span>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse', tableLayout: 'fixed', boxSizing: 'border-box' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ width: '6%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>S/N</th>
            <th style={{ width: '30%', border: cellBorder, padding: '5px 4px', textAlign: 'left', fontWeight: 'bold', fontSize: '9pt' }}>Item Name</th>
            <th style={{ width: '10%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>Box</th>
            <th style={{ width: '14%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>Kgs</th>
            <th style={{ width: '14%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>Rate</th>
            <th style={{ width: '26%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: PartyBillItem, index: number) => (
            <tr key={item.id}>
              <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{index + 1}</td>
              <td style={{ border: cellBorder, padding: '5px 4px', wordBreak: 'break-word', textAlign: 'left', fontSize: '10pt', verticalAlign: 'top' }}><strong>{item.productName}</strong></td>
              <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{item.box}</td>
              <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'right', fontWeight: 'bold', color: '#444', verticalAlign: 'top' }}>{(item.kgs ?? 0).toFixed(2)}</td>
              <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'right', fontFamily: '"Courier New", monospace', verticalAlign: 'top' }}><strong>{(item.rate ?? 0).toFixed(2)}</strong></td>
              <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontWeight: 'bold', verticalAlign: 'top' }}>{(item.amount ?? 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Table Summary Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10mm',
        padding: '5px 6px',
        border: cellBorder,
        borderTop: 'none',
        backgroundColor: '#f9f9f9',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', fontSize: '9pt' }}>Total Weight:</span>
          <span style={{ fontWeight: 600, fontSize: '10pt' }}>{sumWeight.toFixed(2)} KGS</span>
        </div>
      </div>

      {/* Totals Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', width: '100%', boxSizing: 'border-box' }}>
        {/* Left: Deductions & Payments */}
        <div style={{ width: '50%' }}>
          {/* Deductions group */}
          <div style={{ marginBottom: 0 }}>
            {(commissionPercent > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold' }}>Commission ({commissionPercent.toFixed(1)}%):</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{commissionAmount.toFixed(2)}</strong></span>
              </div>
            )}
            {(expenses > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold' }}>Expenses:</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{expenses.toFixed(2)}</strong></span>
              </div>
            )}
            {(rent > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold' }}>Rent:</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{rent.toFixed(2)}</strong></span>
              </div>
            )}
          </div>
          {/* Separator */}
          <div style={{ borderTop: '1px solid black', margin: '4px 0' }} />
          {/* Payments group */}
          <div style={{ marginTop: '4px' }}>
            {(cashReceived > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold' }}>By Cash:</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{cashReceived.toFixed(2)}</strong></span>
              </div>
            )}
            {(bankReceived > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold' }}>By Bank:</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{bankReceived.toFixed(2)}</strong></span>
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid black', margin: '4px 0' }} />
        </div>

        {/* Right: Boxed Summary Table */}
        <table style={{ border: cellBorder, borderCollapse: 'collapse', width: '48%' }}>
          <tbody>
            <tr>
              <td style={{ border: 'none', borderBottom: cellBorder, borderRight: cellBorder, padding: '4px 6px', fontWeight: 'bold' }}>Bill Amount:</td>
              <td style={{ border: 'none', borderBottom: cellBorder, padding: '4px 6px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontSize: '12pt', fontWeight: 'bold' }}>₹{totalAmount.toFixed(2)}</td>
            </tr>
            {billData.totalDeductions > 0 && (
              <tr>
                <td style={{ border: 'none', borderBottom: cellBorder, borderRight: cellBorder, padding: '4px 6px', fontWeight: 'bold' }}>Total Deductions:</td>
                <td style={{ border: 'none', borderBottom: cellBorder, padding: '4px 6px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontWeight: 'bold' }}>₹{billData.totalDeductions.toFixed(2)}</td>
              </tr>
            )}
            <tr>
              <td style={{ border: 'none', borderBottom: cellBorder, borderRight: cellBorder, padding: '4px 6px', fontWeight: 'bold' }}>Net Amount:</td>
              <td style={{ border: 'none', borderBottom: cellBorder, padding: '4px 6px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontSize: '12pt', fontWeight: 'bold' }}>₹{billData.netAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ border: 'none', borderBottom: cellBorder, borderRight: cellBorder, padding: '4px 6px', fontWeight: 'bold' }}>Previous Balance:</td>
              <td style={{ border: 'none', borderBottom: cellBorder, padding: '4px 6px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontWeight: 'bold' }}>₹{previousBalance.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ border: 'none', borderBottom: cellBorder, borderRight: cellBorder, padding: '4px 6px', fontWeight: 'bold' }}>Total Amount:</td>
              <td style={{ border: 'none', borderBottom: cellBorder, padding: '4px 6px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontSize: '12pt', fontWeight: 'bold' }}>₹{totalAfterPrevious.toFixed(2)}</td>
            </tr>
            {totalReceived > 0 && (
              <tr>
                <td style={{ border: 'none', borderBottom: cellBorder, borderRight: cellBorder, padding: '4px 6px', fontWeight: 'bold' }}>Total Paid:</td>
                <td style={{ border: 'none', borderBottom: cellBorder, padding: '4px 6px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontWeight: 'bold' }}>₹{totalReceived.toFixed(2)}</td>
              </tr>
            )}
            <tr>
              <td style={{ border: 'none', borderRight: cellBorder, padding: '4px 6px', fontWeight: 'bold' }}>Net Balance:</td>
              <td style={{ border: 'none', padding: '4px 6px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontSize: '12pt', fontWeight: 'bold' }}>₹{finalBalance.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '6px', textAlign: 'left', fontSize: '9pt', fontWeight: 800, fontStyle: 'italic' }}>
        Developed by MC &amp; SONS
      </div>
    </div>
  );

  return (
    <div className="preview-wrapper">
      {/* Green share banner (shown when opened via Share PDF button) */}
      {autoShare && (
        <div className="print:hidden bg-green-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Share2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm leading-tight">Your party bill is ready to share!</p>
              <p className="text-xs text-green-100 leading-tight mt-0.5">
                Tap the button to send this party bill as a PDF via WhatsApp.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSharePDF}
            disabled={isSharing}
            className="w-full sm:w-auto bg-white text-green-700 hover:bg-green-50 font-bold text-sm px-6 shrink-0"
          >
            {isSharing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating PDF...</>
              : <><Share2 className="mr-2 h-4 w-4" /> Share via WhatsApp</>}
          </Button>
        </div>
      )}
      {shareError && (
        <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">{shareError}</div>
      )}
      <div className="p-4 print:hidden flex justify-between items-center bg-background">
        <Button variant="outline" onClick={() => window.close()} className="text-foreground">
          <X className="mr-2 h-4 w-4" />
          Close
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSharePDF}
            disabled={isSharing}
            className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
          >
            {isSharing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</>
              : <><Share2 className="mr-2 h-4 w-4" />Share (PDF)</>}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>
      <div className="party-bill-invoice">
        <div id="print-area">
          <header className="invoice-header">
            <h1 className="company-name">M.C &amp; SONS FISH COMPANY</h1>
            <p className="sub-header">Dealer : SEA &amp; TANK FOODS</p>
            <p className="sub-header-address">Shop No. 1, Fish Market, Palladam Road, Tiruppur - 641604</p>
            <p className="sub-header-address">📞 9843223078, 9944444497</p>
          </header>

          <section className="party-details">
            <div className="grid-item">
                <span className="label">Supplier Name :</span>
                <span className="value font-bold">{partyName}</span>
            </div>
             <div className="grid-item">
                <span className="label">Date :</span>
                <span className="value font-bold">{format(date, 'dd/MM/yyyy')}</span>
            </div>
            <div className="grid-item">
                 <span className="label">Address :</span>
                <span className="value font-bold">{partyLocation}</span>
            </div>
            <div className="grid-item">
                <span className="label">Total Boxes :</span>
                <span className="value font-bold">{totalBoxes}</span>
            </div>
          </section>

          <table className="items-table">
            <thead>
              <tr>
                <th className="col-sn">S/N</th>
                <th className="col-item">Item Name</th>
                <th className="col-box">Box</th>
                <th className="col-kgs">Kgs</th>
                <th className="col-rate">Rate</th>
                <th className="col-total">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: PartyBillItem, index: number) => (
                <tr key={item.id}>
                  <td className="col-sn">{index + 1}</td>
                  <td className="col-item"><strong>{item.productName}</strong></td>
                  <td className="col-box">{item.box}</td>
                  <td className="col-kgs">{item.kgs.toFixed(2)}</td>
                  <td className="col-rate"><strong>{item.rate.toFixed(2)}</strong></td>
                  <td className="col-total">{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* New Totals Summary Row */}
          <div className="table-summary-row">
            <div className="summary-item">
              <span className="label">Total Weight:</span>
              <span className="value">{sumWeight.toFixed(2)} KGS</span>
            </div>
          </div>

          <section className="totals-container" style={{breakInside: 'avoid', pageBreakInside: 'avoid'}}>
            <div className="left-totals">
                <div className="deductions-group">
                    {commission > 0 && <div className="detail-row"><span>Commission ({commissionPercent.toFixed(1)}%):</span><span><strong>₹{commissionAmount.toFixed(2)}</strong></span></div>}
                    {expenses > 0 && <div className="detail-row"><span>Expenses:</span><span><strong>₹{expenses.toFixed(2)}</strong></span></div>}
                    {rent > 0 && <div className="detail-row"><span>Rent:</span><span><strong>₹{rent.toFixed(2)}</strong></span></div>}
                </div>
                <Separator className="my-1 border-black" />
                <div className="payments-group">
                    {cashReceived > 0 && <div className="detail-row"><span>By Cash:</span><span><strong>₹{cashReceived.toFixed(2)}</strong></span></div>}
                    {bankReceived > 0 && <div className="detail-row"><span>By Bank:</span><span><strong>₹{bankReceived.toFixed(2)}</strong></span></div>}
                </div>
                <Separator className="my-1 border-black" />
            </div>
             <table className="right-totals boxed-summary-table">
                <tbody>
                    <tr><td>Bill Amount:</td><td className="val-total-amount">₹{totalAmount.toFixed(2)}</td></tr>
                    {billData.totalDeductions > 0 ? (<tr><td>Total Deductions:</td><td className="val-total-deductions">₹{billData.totalDeductions.toFixed(2)}</td></tr>) : null}
                    <tr className="font-bold"><td>Net Amount:</td><td className="val-net-amount">₹{billData.netAmount.toFixed(2)}</td></tr>
                    <tr><td>Previous Balance:</td><td className="val-previous-balance">₹{previousBalance.toFixed(2)}</td></tr>
                    <tr className="font-bold"><td>Total Amount:</td><td className="val-total">₹{totalAfterPrevious.toFixed(2)}</td></tr>
                    {totalReceived > 0 ? (<tr><td>Total Paid:</td><td className="val-total-received">₹{totalReceived.toFixed(2)}</td></tr>) : null}
                    <tr className="font-bold"><td>Net Balance:</td><td className="val-final-balance">₹{finalBalance.toFixed(2)}</td></tr>
                </tbody>
            </table>
          </section>
          <footer className="print-footer">Developed by MC &amp; SONS</footer>
        </div>
      </div>

      <div className="p-4 print:hidden flex justify-end">
        <Button size="lg" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {/* ── Hidden inline-styled div for PDF capture (html2canvas compatible) ── */}
      {hiddenPdfArea}

      <style jsx global>{`
        /* ===============================
          PRINT SETUP (145mm x 210mm)
        ================================ */
        @media print {
          @page {
            size: 145mm 210mm;
            margin: 5mm;
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
            padding: 0;
            box-sizing: border-box;
          }
          .print\\:hidden { display: none !important; }
        }

        /* Screen-only styles for preview */
        @media screen {
            .preview-wrapper {
                background-color: #1e293b;
                min-height: 100vh;
                padding-bottom: 2rem;
            }
            .party-bill-invoice {
                margin: 2rem auto;
                width: 800px !important;
                max-width: 95vw !important;
                padding: 40px !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
                border-radius: 4px;
            }
        }

        /* ===============================
          BASE LAYOUT & FONTS
        ================================ */
        .party-bill-invoice {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          width: 97%;
          max-width: 97%;
          background: white;
          color: black;
          box-sizing: border-box;
          margin: 0 auto;
        }

        .font-bold { font-weight: bold; }
        .text-lg { font-size: 11pt; }
        
        /* ===============================
          HEADER
        ================================ */
        .invoice-header {
          text-align: center;
          padding-bottom: 6px;
          margin-bottom: 6px;
          width: 100%;
        }
        .invoice-header .company-name { font-weight: bold; font-size: 16pt; margin: 0; }
        .invoice-header .sub-header { font-size: 10pt; margin: 1px 0; font-weight: 500; }
        .invoice-header .sub-header-address { font-size: 9pt; margin: 1px 0; }

        /* ===============================
          PARTY DETAILS BOX
        ================================ */
        .party-details {
          border: 1.5px solid black;
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          box-sizing: border-box;
        }
        .party-details .grid-item { 
          padding: 4px 6px; 
          display: flex; 
          flex-direction: row; 
          align-items: baseline;
          border-bottom: 1.5px solid black; 
        }
        .party-details .grid-item:nth-child(odd) { border-right: 1.5px solid black; }
        .party-details .grid-item:last-child { border-bottom: none; }
        .party-details .grid-item:nth-last-child(2) { border-bottom: none; }
        .party-details .label { 
          font-weight: bold; 
          font-size: 9pt; 
          white-space: nowrap; 
          width: 28mm; 
          display: inline-block;
          flex-shrink: 0;
        }
        .party-details .value { font-size: 10pt; overflow-wrap: anywhere; }

        /* ===============================
          ITEMS TABLE
        ================================ */
        .items-table { width: 100%; margin-top: 8px; border-collapse: collapse; table-layout: fixed; box-sizing: border-box; }
        .items-table th, .items-table td { border: 1.5px solid black; padding: 5px 4px; vertical-align: top; }
        .items-table thead tr { background-color: #f2f2f2 !important; }
        .items-table thead th { font-weight: bold; text-align: center; font-size: 9pt; }
        
        .items-table .col-sn  { width: 6%;  text-align: center; white-space: nowrap; }
        .items-table .col-item { width: 30%; word-break: break-word; text-align: left; font-size: 10pt; }
        .items-table .col-box  { width: 10%; text-align: center; white-space: nowrap; }
        .items-table .col-kgs  { width: 14%; text-align: center; white-space: nowrap; }
        .items-table .col-rate { width: 14%; white-space: nowrap; text-align: center; }
        .items-table .col-total{ width: 26%; white-space: nowrap; text-align: center; }

        .items-table td.col-box {
            text-align: right;
            font-weight: bold;
        }
        
        .items-table td.col-kgs {
            text-align: right;
            font-weight: bold;
            color: #444;
        }

        .items-table td.col-rate { 
            text-align: right; 
            font-family: "Courier New", monospace; 
        }
        
        .items-table td.col-total { 
            text-align: right; 
            font-family: "Courier New", monospace; 
            font-weight: bold;
        }

        /* ===============================
          TABLE SUMMARY ROW
        ================================ */
        .table-summary-row {
          display: flex;
          justify-content: flex-end;
          gap: 10mm;
          padding: 5px 6px;
          border: 1.5px solid black;
          border-top: none;
          background-color: #f9f9f9;
          width: 100%;
          box-sizing: border-box;
        }
        .table-summary-row .summary-item {
          display: flex;
          gap: 4px;
          align-items: baseline;
        }
        .table-summary-row .label { font-weight: bold; font-size: 9pt; }
        .table-summary-row .value { font-weight: 600; font-size: 10pt; }

        /* ===============================
          TOTALS SECTION
        ================================ */
        .totals-container { display: flex; justify-content: space-between; margin-top: 8px; width: 100%; break-inside: avoid; page-break-inside: avoid; box-sizing: border-box; }
        .left-totals { width: 50%; }
        .right-totals { width: 48%; }
        .left-totals .detail-row { display: flex; justify-content: space-between; padding: 1px 4px; font-size: 10pt; }
        .left-totals .detail-row span:first-child { font-weight: bold; }
        .left-totals .detail-row span:last-child { font-family: "Courier New", monospace; }
        
        .deductions-group { margin-bottom: 0; }
        .payments-group { margin-top: 4px; }

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

        /* Typography Overrides for numeric values */
        .val-total-amount { font-size: 12pt !important; font-weight: bold !important; }
        .val-net-amount { font-size: 12pt !important; font-weight: bold !important; }
        .val-total { font-size: 12pt !important; font-weight: bold !important; }
        .val-final-balance { font-size: 12pt !important; font-weight: bold !important; }
        .val-total-deductions { font-weight: bold !important; }
        .val-previous-balance { font-weight: bold !important; }
        .val-total-received { font-weight: bold !important; }

        /* ===============================
          FOOTER
        ================================ */
        .print-footer {
          margin-top: 6px;
          text-align: left;
          font-size: 9pt;
          font-weight: 800;
          font-style: italic;
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
