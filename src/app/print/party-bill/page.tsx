'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PartyBillItem, getPartyItemQty, getPartyItemUom, isLegacyPartyItem, getPartyBillCashEntries, getPartyBillBankEntries } from '@/lib/data';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

/** Actual M.C & SONS logo (background removed), served from /public. */
const PARTY_BILL_LOGO_SRC = '/party-bill-logo.png';
/** Professional dark blue for the company name — print and Share PDF. */
const COMPANY_NAME_BLUE = '#1e40af';
/** Net Balance row height: lifts the paid box to end level with "Total Paid". */
const PAID_BOX_BOTTOM_OFFSET_PX = 29.5;
/**
 * Font for the company name only — the visiting-card font.
 * 'MC Company Name' = the installed Balloon XBd BT (already bold + slanted, so
 * it is declared as an italic 700 face and never gets a fake slant on top).
 * 'MC Company Name Fallback' = bundled Chewy (Apache-2.0) for devices without
 * Balloon, e.g. phones; it is slanted/bolded by the browser to match.
 */
const COMPANY_NAME_FONT = "'MC Company Name', 'MC Company Name Fallback', Arial, Helvetica, sans-serif";
/** Share PDF company-name font (requested separately from the print). */
const SHARE_PDF_COMPANY_NAME_FONT = '"Arial Rounded MT Bold", Arial, sans-serif';

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

      // The company-name web font must be ready too, or the PDF shows Arial.
      await document.fonts.ready;
      // Make sure the header logo has finished loading, or html2canvas
      // would capture an empty box in its place.
      await Promise.all(Array.from(captureEl.querySelectorAll('img')).map(img =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })
      ));

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

      // Share the PDF alone — no caption/message text.
      const waUrl = 'https://wa.me/';

      // ── Mobile: try Web Share API (opens native share sheet → WhatsApp) ──
      // We attempt this first; if it fails for any non-user-cancel reason,
      // we fall through to the download + wa.me fallback.
      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          // Skip canShare() gate — it returns false on many Android browsers
          // even when sharing IS supported. Try directly and catch failures.
          await navigator.share({ files: [file] });
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
    id, date, partyName, partyLocation, items, totalAmount, commission, expenses, rent, advance = 0, 
    totalReceived, previousBalance, totalAfterPrevious, finalBalance
  } = billData;

  const commissionPercent = commission;
  const commissionAmount = (totalAmount * commissionPercent) / 100;
  
  // True only when EVERY item is in the pre-qty/UOM shape. Such bills keep the
  // original Box / Kgs columns so historical prints stay exactly as they were.
  const isLegacyItemsBill = items.length > 0 && items.every((item: PartyBillItem) => isLegacyPartyItem(item));

  // Calculate sums for the new summary row.
  // Legacy rows: box x kgs-per-box. New rows: the qty already expressed in KGS.
  const sumWeight = items.reduce((sum: number, item: PartyBillItem) => {
    if (isLegacyPartyItem(item)) return sum + ((item.box || 0) * (item.kgs || 0));
    return getPartyItemUom(item).toUpperCase() === 'KGS' ? sum + getPartyItemQty(item) : sum;
  }, 0);
  
  // Top-of-bill "Total Boxes" — the header value, which the user may override.
  const totalBoxes = billData.totalBox;

  // Live box count for the summary row under the items table. Derived from the
  // items with exactly the same rule as the Party Billing page's
  // "Live Total Box" (calculatedTotalBox), so the printed figure always matches
  // what the items actually add up to rather than the header override.
  const liveTotalBoxes = items.reduce((sum: number, item: PartyBillItem) => {
    if (isLegacyPartyItem(item)) return sum + (item.box || 0);
    return getPartyItemUom(item).toUpperCase() === 'BOX' ? sum + getPartyItemQty(item) : sum;
  }, 0);

  /**
   * Received dates. Handles Firestore Timestamp, serialized {seconds}, ISO
   * strings and Date. Legacy bills have no received-date field, so they fall
   * back to the bill's own date — no date is invented, and nothing is written.
   */
  const toReceivedDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') {
      const d = value.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };
  const billDateForFallback = date ? new Date(date) : null;
  /** "By Cash (08/09/2026):" — falls back to the plain label if no date exists. */
  const paymentLabel = (kind: 'Cash' | 'Bank', value: any) => {
    const d = toReceivedDate(value) || billDateForFallback;
    return d ? `By ${kind} (${format(d, 'dd/MM/yyyy')}):` : `By ${kind}:`;
  };
  /**
   * Every payment printed on its own line, in the order entered: Advance,
   * then each Cash entry, then each Bank entry. Legacy single-amount bills are
   * read as one-entry lists by the shared helpers.
   */
  const paymentLines: { key: string; label: string; amount: number }[] = [
    ...(advance > 0 ? [{ key: 'advance', label: 'Advance(LESS):', amount: advance }] : []),
    ...getPartyBillCashEntries(billData)
      .filter(entry => (entry.amount || 0) > 0)
      .map((entry, i) => ({ key: `cash-${i}`, label: paymentLabel('Cash', entry.date), amount: entry.amount })),
    ...getPartyBillBankEntries(billData)
      .filter(entry => (entry.amount || 0) > 0)
      .map((entry, i) => ({ key: `bank-${i}`, label: paymentLabel('Bank', entry.date), amount: entry.amount })),
  ];

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
      {/* Header — same structure as #print-area: logo | company identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '6px', marginBottom: '6px', width: '100%', boxSizing: 'border-box' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PARTY_BILL_LOGO_SRC} alt="M.C & SONS" style={{ height: '73px', width: 'auto', flexShrink: 0, display: 'block', marginLeft: '15px' }} />
        <div style={{ flex: '1 1 auto', minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '17pt', lineHeight: 1.15, margin: 0, color: COMPANY_NAME_BLUE, whiteSpace: 'nowrap', fontFamily: SHARE_PDF_COMPANY_NAME_FONT }}>M.C &amp; SONS FISH COMPANY</div>
          <div style={{ fontSize: '10pt', margin: '2px 0 1px', fontWeight: 600 }}>Dealer : SEA &amp; TANK FOODS</div>
          <div style={{ fontSize: '9pt', margin: '1px 0' }}>Shop No. 1, Fish Market, Palladam Road, Tiruppur - 641604</div>
          <div style={{ fontSize: '9pt', margin: '1px 0' }}>📞 9843223078, 9944444497</div>
        </div>
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
            <th style={{ width: '10%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>{isLegacyItemsBill ? 'Box' : 'Qty'}</th>
            <th style={{ width: '14%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>{isLegacyItemsBill ? 'Kgs' : 'UOM'}</th>
            <th style={{ width: '14%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>Rate</th>
            <th style={{ width: '26%', border: cellBorder, padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: PartyBillItem, index: number) => (
            <tr key={item.id}>
              <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{index + 1}</td>
              <td style={{ border: cellBorder, padding: '5px 4px', wordBreak: 'break-word', textAlign: 'left', fontSize: '10pt', verticalAlign: 'top' }}><strong>{item.productName}</strong></td>
              <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{getPartyItemQty(item)}</td>
              <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'right', fontWeight: 'bold', color: '#444', verticalAlign: 'top' }}>{isLegacyPartyItem(item) ? (item.kgs ?? 0).toFixed(2) : getPartyItemUom(item)}</td>
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
          <span style={{ fontWeight: 'bold', fontSize: '9pt' }}>Total Box:</span>
          <span style={{ fontWeight: 600, fontSize: '10pt' }}>{liveTotalBoxes}</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', fontSize: '9pt' }}>Total Weight:</span>
          <span style={{ fontWeight: 600, fontSize: '10pt' }}>{sumWeight.toFixed(2)} KGS</span>
        </div>
      </div>

      {/* Totals Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px', marginTop: '8px', width: '100%', boxSizing: 'border-box' }}>
        {/* Left: Deductions & Payments.
            Flex column: the deductions sit at the top, a flexible spacer pushes
            the payments group down, and a fixed bottom offset equal to one
            summary row lifts it so it ends level with the "Total Paid" row of
            the table on the right. Offset measured against the rendered table. */}
        {/* Never narrower than its widest payment line, so the box never clips. */}
        <div style={{ width: '50%', minWidth: 'max-content', display: 'flex', flexDirection: 'column' }}>
          {/* Deductions box */}
          {(commissionPercent > 0 || expenses > 0 || rent > 0) && (
          <div style={{ border: cellBorder, padding: '3px 2px' }}>
            {(commissionPercent > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold' }}>Commission:</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{commissionAmount.toFixed(2)}</strong></span>
              </div>
            )}
            {(expenses > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold' }}>Expenses:</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{expenses.toFixed(2)}</strong></span>
              </div>
            )}
            {(rent > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold' }}>Rent:</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{rent.toFixed(2)}</strong></span>
              </div>
            )}
          </div>
          )}
          {/* Spacer: pushes the payments box down to the Total Paid row */}
          <div style={{ flex: '1 1 auto', minHeight: '6px' }} />
          {/* Paid box */}
          {paymentLines.length > 0 && (
          <div style={{ border: cellBorder, padding: '3px 2px' }}>
            {paymentLines.map(line => (
              <div key={line.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', padding: '1px 4px', fontSize: '10pt' }}>
                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{line.label}</span>
                <span style={{ fontFamily: '"Courier New", monospace' }}><strong>₹{line.amount.toFixed(2)}</strong></span>
              </div>
            ))}
          </div>
          )}
          {/* Height of the "Net Balance" row, so the paid box ends level with
              the bottom of "Total Paid" rather than the bottom of the table. */}
          <div style={{ flex: '0 0 auto', height: `${PAID_BOX_BOTTOM_OFFSET_PX}px` }} />
        </div>

        {/* Right: Boxed Summary Table */}
        <table style={{ border: cellBorder, borderCollapse: 'collapse', width: '48%', alignSelf: 'flex-end' }}>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="header-logo" src={PARTY_BILL_LOGO_SRC} alt="M.C & SONS" />
            <div className="header-text">
              <h1 className="company-name">M.C &amp; SONS FISH COMPANY</h1>
              <p className="sub-header">Dealer : SEA &amp; TANK FOODS</p>
              <p className="sub-header-address">Shop No. 1, Fish Market, Palladam Road, Tiruppur - 641604</p>
              <p className="sub-header-address">📞 9843223078, 9944444497</p>
            </div>
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
                <th className="col-box">{isLegacyItemsBill ? 'Box' : 'Qty'}</th>
                <th className="col-kgs">{isLegacyItemsBill ? 'Kgs' : 'UOM'}</th>
                <th className="col-rate">Rate</th>
                <th className="col-total">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: PartyBillItem, index: number) => (
                <tr key={item.id}>
                  <td className="col-sn">{index + 1}</td>
                  <td className="col-item"><strong>{item.productName}</strong></td>
                  <td className="col-box">{getPartyItemQty(item)}</td>
                  <td className="col-kgs">{isLegacyPartyItem(item) ? (item.kgs ?? 0).toFixed(2) : getPartyItemUom(item)}</td>
                  <td className="col-rate"><strong>{item.rate.toFixed(2)}</strong></td>
                  <td className="col-total">{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* New Totals Summary Row */}
          <div className="table-summary-row">
            <div className="summary-item">
              <span className="label">Total Box:</span>
              <span className="value">{liveTotalBoxes}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Weight:</span>
              <span className="value">{sumWeight.toFixed(2)} KGS</span>
            </div>
          </div>

          <section className="totals-container" style={{breakInside: 'avoid', pageBreakInside: 'avoid'}}>
            <div className="left-totals">
                {(commission > 0 || expenses > 0 || rent > 0) && <div className="deductions-group">
                    {commission > 0 && <div className="detail-row"><span>Commission:</span><span><strong>₹{commissionAmount.toFixed(2)}</strong></span></div>}
                    {expenses > 0 && <div className="detail-row"><span>Expenses:</span><span><strong>₹{expenses.toFixed(2)}</strong></span></div>}
                    {rent > 0 && <div className="detail-row"><span>Rent:</span><span><strong>₹{rent.toFixed(2)}</strong></span></div>}
                </div>}
                <div className="pay-spacer" />
                {paymentLines.length > 0 && <div className="payments-group">
                    {paymentLines.map(line => (
                        <div key={line.key} className="detail-row"><span className="pay-label">{line.label}</span><span><strong>₹{line.amount.toFixed(2)}</strong></span></div>
                    ))}
                </div>}
                <div className="totals-bottom-offset" />
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
        @font-face {
          font-family: 'MC Company Name';
          /* Bundled copy first so every browser (incl. Brave, which hides
             installed fonts) and every phone gets it; installed copy as backup. */
          src: url('/fonts/balloon-xbd.ttf') format('truetype'), local('Balloon XBd BT'), local('Balloon Extra Bold BT'), local('BalloonBT-ExtraBold');
          font-display: block;
          font-style: italic;
          font-weight: 700;
        }
        @font-face {
          font-family: 'MC Company Name Fallback';
          src: url('/fonts/chewy-400.woff2') format('woff2');
          size-adjust: 108%; /* measured: matches Balloon's width */
          font-display: block;
        }
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
          /* The rule above prints all text black; the company name stays blue. */
          #print-area .invoice-header .company-name { color: #1e40af /* COMPANY_NAME_BLUE */ !important; }
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
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 6px;
          margin-bottom: 6px;
          width: 100%;
          box-sizing: border-box;
          break-inside: avoid;
          page-break-inside: avoid;
          break-after: avoid;
          page-break-after: avoid;
        }
        /* Logo keeps its own aspect ratio (height fixed, width auto). */
        /* Logo spans the full text block — top of the company name to the
           phone line (measured: 73px ≈ 19.3mm) — so both read as one unit. */
        .invoice-header .header-logo { height: 19.3mm; width: auto; flex-shrink: 0; display: block; margin-left: 4mm; }
        .invoice-header .header-text { flex: 1 1 auto; min-width: 0; text-align: center; }
        .invoice-header .company-name {
          font-weight: 700;
          font-style: italic;
          /* Measured: at 17pt the name uses ~72% of the width beside the
             logo at 145mm, so it always stays on one line. */
          /* Sized for Balloon (a wide face); the Chewy fallback is scaled up
             via size-adjust so both fill the same width. */
          font-size: 20pt;
          letter-spacing: 0.5px;
          line-height: 1.1;
          margin: 0;
          color: #1e40af /* COMPANY_NAME_BLUE */;
          font-family: 'MC Company Name', 'MC Company Name Fallback', Arial, Helvetica, sans-serif /* COMPANY_NAME_FONT */;
          white-space: nowrap;
        }
        .invoice-header .sub-header { font-size: 10pt; margin: 2px 0 1px; font-weight: 600; }
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
        .totals-container { display: flex; justify-content: space-between; gap: 5px; margin-top: 8px; width: 100%; break-inside: avoid; page-break-inside: avoid; box-sizing: border-box; }
        /* Flex column so the payments group can be pushed down to align with
           the "Total Paid" row of the summary table on the right. */
        .left-totals { width: 50%; display: flex; flex-direction: column; }
        .left-totals .pay-label { white-space: nowrap; }
        .pay-spacer { flex: 1 1 auto; }
        /* One summary row tall ("Net Balance"), measured against the rendered
           table, so the received block ends level with "Total Paid". */
        .totals-bottom-offset { flex: 0 0 auto; height: 29.5px; }
        /* Bottom-aligned: when many payment lines make the left column the
           taller one, the table sits at the bottom instead of being stretched,
           so "Total Paid" stays level with the last payment line. When the
           table is taller (the usual case) this changes nothing. */
        .right-totals { width: 48%; align-self: flex-end; }
        .left-totals .detail-row { display: flex; justify-content: space-between; gap: 6px; padding: 1px 4px; font-size: 10pt; }
        .left-totals .detail-row span:first-child { font-weight: bold; }
        .left-totals .detail-row span:last-child { font-family: "Courier New", monospace; }
        
        /* Boxed deductions / paid sections, same rule as the totals table. */
        .deductions-group, .payments-group { border: 1.5px solid black; padding: 3px 2px; }
        .pay-spacer { min-height: 6px; }

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
