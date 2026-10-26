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
  /** Non-zero received payments (mode/amount/date). Absent on older print data. */
  payments?: { mode: string; amount: number; date: string }[];
}

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<BillPrintData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const paper = searchParams.get('paper') || 'thermal';
  /** 4-inch "Print Receipt" ('thermal') uses the same receipt format as the 3-inch print. */
  const isFourInch = paper === 'thermal';
  const layout = isFourInch ? 'thermal3' : paper;
  const autoShare = searchParams.get('share') === 'pdf';

  useEffect(() => {
    const sessionData = sessionStorage.getItem('billPrintData');
    if (sessionData) {
      try {
        setBillData(JSON.parse(sessionData));
        return; // Success from sessionStorage
      } catch (error) {
        console.error('Failed to parse bill data from sessionStorage:', error);
      }
    }
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = decodeURIComponent(data);
        setBillData(JSON.parse(decodedData));
      } catch (error) {
        console.error('Failed to parse bill data from URL:', error);
        router.push('/dashboard');
      }
    } else {
      router.push('/dashboard');
    }
  }, [searchParams, router]);

  // ─────────────────────────────────────────────────────────────
  //  Share PDF handler
  //  Captures the hidden #pdf-area div (inline-styled A4 layout)
  //  which is always rendered with the correct A4 look on screen.
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
      const billDateFormatted = billData.date
        ? format(new Date(billData.date), 'dd-MM-yyyy')
        : 'receipt';
      const fileName = `MC_Bill_${billDateFormatted}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const phone = (billData.customer?.phone || '').replace(/\D/g, '');
      const waMessage =
        `*M.C & SONS FISH COMPANY*\n*Bill PDF*\n\nBill Date: ${billDateFormatted}\nCustomer: ${billData.customer?.name_en || ''}\n\nPlease find the attached PDF bill.\n\nThank you!`;
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      // ── Mobile: try Web Share API (opens native share sheet → WhatsApp) ──
      // We attempt this first; if it fails for any non-user-cancel reason,
      // we fall through to the download + wa.me fallback.
      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          // Skip canShare() gate — it returns false on many Android browsers
          // even when sharing IS supported. Try directly and catch failures.
          await navigator.share({
            title: `Bill Date: ${billDateFormatted} - M.C & SONS`,
            text: `Bill Date: ${billDateFormatted} from M.C & SONS FISH COMPANY`,
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
        setShareError('Could not generate PDF. Please try printing to PDF instead.');
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

  // Received block (Print Receipt + Print 3-Inch): payments on the left, totals on the right.
  const receivedList = (billData.payments || []).filter(p => p.amount > 0);
  const showReceived = paper !== 'a4' && receivedList.length > 0;
  const receivedTotal = receivedList.reduce((s, p) => s + p.amount, 0);
  const fmtReceived = (n: number) => (layout === 'thermal3' ? String(Math.round(n)) : n.toFixed(2));
  const billDay = date ? format(new Date(date), 'yyyy-MM-dd') : '';

  const displayDeliveryCharge = parseFloat(deliveryCharge.toString()) || 0;

  // INR Formatting Helper (A4 Only)
  const formatINR = (value: number) => {
    if (value == null || isNaN(value)) return '0.00';
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Calculate Total Quantity for KGS and BOX
  const totalKgs = items
    .filter((i) => i.uom.toUpperCase() === 'KGS')
    .reduce((sum, i) => sum + i.qty, 0);
  const totalBox = items
    .filter((i) => i.uom.toUpperCase() === 'BOX')
    .reduce((sum, i) => sum + i.qty, 0);

  const qtyStrings: string[] = [];
  if (totalKgs > 0) qtyStrings.push(layout === 'thermal3' ? `${totalKgs.toFixed(1)}KGS` : `${totalKgs.toFixed(1)} KGS `);
  if (totalBox > 0) qtyStrings.push(layout === 'thermal3' ? `${Math.round(totalBox)}BOX` : `${Math.round(totalBox)} BOX `);
  const totalQtyString = layout === 'thermal3' ? qtyStrings.join(',') : qtyStrings.join(',').trim();

  // ─────────────────────────────────────────────────────────────
  //  Hidden A4 bill rendered with INLINE STYLES so html2canvas
  //  can capture it correctly (media-query print styles are
  //  invisible to html2canvas).
  //  This div is off-screen (left: -9999px) and never printed.
  // ─────────────────────────────────────────────────────────────
  const S = {
    cell: (extra?: React.CSSProperties): React.CSSProperties => ({
      border: '1px solid #ccc',
      padding: '5px 6px',
      fontSize: '12px',
      ...extra,
    }),
    hCell: (extra?: React.CSSProperties): React.CSSProperties => ({
      border: '1px solid #ccc',
      padding: '5px 6px',
      background: '#f0f0f0',
      fontWeight: 'bold' as const,
      fontSize: '12px',
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
        width: '480px',
        background: '#fff',
        color: '#000',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        padding: '16px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '2px solid #333', paddingBottom: '6px' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '0.3px' }}>M.C &amp; SONS FISH COMPANY</div>
        <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>No. 1, Fish Market, Palladam Road, Tiruppur - 641604</div>
        <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>📞 9597833277, 9894089889</div>
      </div>

      {/* Customer Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '6px 0', fontSize: '11px' }}>
        <div>
          <div style={{ fontWeight: 600 }}>ID: {customer?.id === 'WALK-IN' ? '-' : customer?.id}</div>
          <div style={{ fontWeight: 700, fontSize: '12px', marginTop: '2px' }}>
            {customer?.id === 'WALK-IN'
              ? customer?.name_en && customer.name_en !== '--' ? customer.name_en : '--'
              : customer?.name_ta && customer.name_ta !== '--' ? customer.name_ta : (customer?.name_en || '-')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span style={{ fontWeight: 600 }}>Bill No:</span> {billNo}</div>
          <div><span style={{ fontWeight: 600 }}>Date:</span> {format(new Date(date), 'dd-MM-yyyy')}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1.5px solid #444', margin: '5px 0 8px' }} />

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ width: '34%', padding: '5px 4px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>Product</th>
            <th style={{ width: '18%', padding: '5px 4px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Qty</th>
            <th style={{ width: '20%', padding: '5px 4px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Rate</th>
            <th style={{ width: '28%', padding: '5px 4px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 1 ? '#fafafa' : '#fff' }}>
              <td style={{ padding: '4px', border: '1px solid #ddd', fontSize: '11px', wordBreak: 'break-word' }}>{item.product}</td>
              <td style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{item.qty}{item.uom}</td>
              <td style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.rate.toFixed(2)}</td>
              <td style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{formatINR(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
            <td colSpan={2} style={{ padding: '5px 4px', border: '1px solid #ccc', borderTop: '1.5px solid #444', fontSize: '11px' }}>
              ITEMS: {items.length} &nbsp;|&nbsp; {totalQtyString ? `QTY: ${totalQtyString}` : ''}
            </td>
            <td colSpan={2} style={{ padding: '5px 4px', border: '1px solid #ccc', borderTop: '1.5px solid #444', textAlign: 'right', fontSize: '11px' }}>
              &nbsp;
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Summary */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
        <tbody>
          {[
            { label: 'Items Total', value: formatINR(itemsTotal) },
            ...(displayDeliveryCharge > 0 ? [{ label: 'Delivery Charge', value: formatINR(displayDeliveryCharge) }] : []),
            { label: 'Bill Total', value: formatINR(itemsTotal + displayDeliveryCharge) },
            { label: 'Old Balance', value: formatINR(previousBalance) },
            { label: 'Net Total', value: formatINR(itemsTotal + displayDeliveryCharge + previousBalance) },
            { label: 'Received Amount', value: formatINR(paidAmount) },
          ].map(({ label, value }) => (
            <tr key={label}>
              <td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid #eee' }}>{label}</td>
              <td style={{ padding: '4px 2px', textAlign: 'center', color: '#555', borderBottom: '1px solid #eee', width: '12px' }}>:</td>
              <td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>₹{value}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #333' }}>
            <td style={{ padding: '6px 6px', fontWeight: 'bold', fontSize: '13px' }}>Final Balance</td>
            <td style={{ padding: '6px 2px', textAlign: 'center', color: '#555' }}>:</td>
            <td style={{ padding: '6px 6px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '13px' }}>₹{formatINR(finalBalance)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '12px', fontSize: '9px', fontStyle: 'italic', color: '#1a6db5' }}>Developed by MC &amp; SONS</div>
    </div>
  );

  return (
    <div>
      {/* ── Green share banner (shown when opened via Share PDF button) ── */}
      {autoShare && (
        <div className="print:hidden bg-green-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Share2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm leading-tight">Your bill is ready to share!</p>
              <p className="text-xs text-green-100 leading-tight mt-0.5">
                Tap the button to send this bill as a PDF via WhatsApp.
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
        <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">
          {shareError}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="p-4 print:hidden flex justify-between items-center gap-2">
        <Button variant="outline" onClick={() => window.close()} className="text-foreground">
          <X className="mr-2 h-4 w-4" />
          Close Preview
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSharePDF}
            disabled={isSharing}
            className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
          >
            {isSharing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</>
              : <><Share2 className="mr-2 h-4 w-4" /> Share (PDF)</>}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* ── Original print-root (unchanged — used for browser Print) ── */}
      <div className={`print-root ${layout}${isFourInch ? ' four-inch' : ''}`}>
        <div id="print-area">
          <header className="text-center">
            {/* Logo on the 3-inch and 4-inch receipts (grayscale version made for thermal printing). */}
            {layout === 'thermal3' && <img src="/bill-logo.png" alt="M.C & Sons logo" className="bill-logo" />}
            <h1 className="header-title">M.C &amp; SONS FISH COMPANY</h1>
            <p className="header-sub">
              No. 1, Fish Market, Palladam Road,<br />
              Tiruppur - 641604
            </p>
            <p className="header-sub header-phone">📞 9597833277, 9894089889</p>
          </header>
          <div className="hr-line"></div>

          <div className="mb-2 text-sm font-mono flex justify-between">
            <table className="text-left table-fixed" style={{ width: '55%' }}>
              <tbody>
                <tr>
                  <td className="w-12 py-0">ID</td>
                  <td className="w-4 py-0 text-center">:</td>
                  <td className="py-0 truncate pr-2">
                    <strong>{customer?.id === 'WALK-IN' ? '-' : customer?.id}</strong>
                  </td>
                </tr>
                <tr>
                  <td className="py-0">Name</td>
                  <td className="py-0 text-center">:</td>
                  <td className="py-0 truncate pr-2">
                    <strong>
                      {customer?.id === 'WALK-IN'
                        ? (customer?.name_en && customer.name_en !== '--' ? customer.name_en : '--')
                        : (customer?.name_ta && customer.name_ta !== '--' ? customer.name_ta : (customer?.name_en || '-'))}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <table className="text-right">
              <tbody>
                <tr>
                  <td className="py-0 text-left whitespace-nowrap">Bill No</td>
                  <td className="w-4 py-0 text-center">:</td>
                  <td className="py-0 text-right whitespace-nowrap"><strong>{billNo}</strong></td>
                </tr>
                <tr>
                  <td className="py-0 text-left whitespace-nowrap">Date</td>
                  <td className="w-4 py-0 text-center">:</td>
                  <td className="py-0 text-right whitespace-nowrap">
                    <strong>{format(new Date(date), 'dd-MM-yyyy')}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Table className="print-table">
            {/* table-layout:fixed reads column widths from <col> first; without
                this the colSpan=4 divider row above the headings would force
                four equal columns. Only the 3-inch roll needs it. */}
            {layout === 'thermal3' && (
              <colgroup>
                <col className="col-product" />
                <col className="col-qty" />
                <col className="col-rate" />
                <col className="col-amount" />
              </colgroup>
            )}
            <TableHeader>
              <TableRow className="header-row-divider">
                <TableCell colSpan={4} className="p-0">
                  <div className="table-header-line"></div>
                </TableCell>
              </TableRow>
              <TableRow className="header-content-row">
                <TableHead className="col-product text-left">Product</TableHead>
                <TableHead className="col-qty text-right">Qty</TableHead>
                <TableHead className="col-rate text-right">Rate</TableHead>
                <TableHead className="col-amount text-right">Amount</TableHead>
              </TableRow>
              <TableRow className="header-row-divider">
                <TableCell colSpan={4} className="p-0">
                  <div className="table-header-line"></div>
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="col-product text-left">{item.product}</TableCell>
                  <TableCell className="col-qty text-right">
                    <span className="qty-uom">
                    <span className="qty-num">{item.qty}</span>
                    <strong className="uom-text">{layout === 'thermal3' && item.uom.toUpperCase() === 'KGS' ? 'KG' : item.uom}</strong>
                    </span>
                  </TableCell>
                  <TableCell className="col-rate text-right font-mono">
                    {layout === 'thermal3'
                      ? (Number.isInteger(item.rate) ? item.rate : item.rate.toFixed(2))
                      : item.rate.toFixed(2)}
                  </TableCell>
                  <TableCell className="col-amount text-right font-mono">
                    {paper === 'a4' ? formatINR(item.amount) : (layout === 'thermal3' ? Math.round(item.amount).toString() : item.amount.toFixed(2))}
                  </TableCell>
                </TableRow>
              ))}

              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <div className="table-header-line"></div>
                </TableCell>
              </TableRow>

              <TableRow className="combined-summary-row">
              <TableCell colSpan={4} className="px-1 py-1" style={{ overflow: 'visible' }}>
              <div className={layout === 'thermal3' ? "flex justify-between items-center w-full pr-[16px] whitespace-nowrap overflow-hidden font-bold text-[11px] uppercase" : "flex justify-between items-center w-full font-bold text-[11px] uppercase"}>
                    {layout === 'thermal3' ? (
                      <>
                        <span>{isFourInch ? "Total Items" : "Items"}:{items.length}</span>
                        {totalQtyString && (
                          <>
                          <span>•</span>
                          <span>Total Qty-&gt;{totalQtyString}</span>
                        </>
                        )}
                      </>
                    ) : (
                      <>
                        <span>Total Items: {items.length}</span>
                        {totalQtyString && (
                        <>
                          <span>•</span>
                          <span>Total Qty-&gt;{totalQtyString}</span>
                        </>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <div className="table-header-line"></div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className={`flex justify-end mt-2 summary-section-wrapper${showReceived ? ' has-received' : ''}`} style={{ breakInside: 'avoid' }}>
            {showReceived && (
              <div className="received-block">
                <div className="received-title">Received</div>
                <table className="received-table">
                  <tbody>
                    {receivedList.map((p, i) => {
                      const d = new Date(p.date);
                      const showDate = !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') !== billDay;
                      return (
                        <tr key={i}>
                          <td className="rcv-mode">
                            {p.mode}
                            {showDate && <span className="rcv-date">{format(d, 'dd-MM-yy')}</span>}
                          </td>
                          <td className="rcv-amt">{fmtReceived(p.amount)}</td>
                        </tr>
                      );
                    })}
                    {receivedList.length > 1 && (
                      <tr className="rcv-total">
                        <td className="rcv-mode">Total</td>
                        <td className="rcv-amt">{fmtReceived(receivedTotal)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <table className="summary-table">
              <tbody>
              {layout === 'thermal3' ? (
                  <>
                    <tr>
                      <td className="summary-label">Items Total</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{Math.round(itemsTotal)}</td>
                    </tr>
                    {displayDeliveryCharge > 0 && (
                      <tr>
                        <td className="summary-label">Delivery</td>
                        <td className="summary-colon">:</td>
                        <td className="summary-value font-mono">₹{Math.round(displayDeliveryCharge)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="summary-label">Old Balance</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{Math.round(previousBalance)}</td>
                    </tr>
                    <tr className="summary-divider-row summary-total-row">
                      <td className="summary-label">Bill Total</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{Math.round(itemsTotal + displayDeliveryCharge + previousBalance)}</td>
                    </tr>
                    <tr>
                      <td className="summary-label">Received Amount</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{Math.round(paidAmount)}</td>
                    </tr>
                    <tr className="summary-divider-row summary-total-row summary-final-balance">
                      <td className="summary-label">Final Balance</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{Math.round(finalBalance)}</td>
                    </tr>
                  </>
                ) : paper === 'thermal' ? (
                  <>
                    <tr>
                      <td className="summary-label">Items Total</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{itemsTotal.toFixed(2)}</td>
                    </tr>
                    {displayDeliveryCharge > 0 && (
                      <tr>
                        <td className="summary-label">Delivery Charge</td>
                        <td className="summary-colon">:</td>
                        <td className="summary-value font-mono">₹{displayDeliveryCharge.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="summary-label">Previous Balance</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{previousBalance.toFixed(2)}</td>
                    </tr>
                    <tr className="summary-divider-row summary-total-row">
                      <td className="summary-label">Bill Total</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{(itemsTotal + displayDeliveryCharge + previousBalance).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="summary-label">Received Amount</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{paidAmount.toFixed(2)}</td>
                    </tr>
                    <tr className="summary-divider-row summary-total-row summary-final-balance">
                      <td className="summary-label">Final Balance</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{finalBalance.toFixed(2)}</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td className="summary-label">Items Total</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{formatINR(itemsTotal)}</td>
                    </tr>
                    {displayDeliveryCharge > 0 && (
                      <tr>
                        <td className="summary-label">Delivery Charge</td>
                        <td className="summary-colon">:</td>
                        <td className="summary-value font-mono">₹{formatINR(displayDeliveryCharge)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="summary-label">Bill Total</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{formatINR(itemsTotal + displayDeliveryCharge)}</td>
                    </tr>
                    <tr>
                      <td className="summary-label">Old Balance</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{formatINR(previousBalance)}</td>
                    </tr>
                    <tr className="summary-divider-row summary-total-row">
                      <td className="summary-label">Net Total</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{formatINR(itemsTotal + displayDeliveryCharge + previousBalance)}</td>
                    </tr>
                    <tr>
                      <td className="summary-label">Received Amount</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{formatINR(paidAmount)}</td>
                    </tr>
                    <tr className="summary-divider-row summary-total-row summary-final-balance">
                      <td className="summary-label">Final Balance</td>
                      <td className="summary-colon">:</td>
                      <td className="summary-value font-mono">₹{formatINR(finalBalance)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <footer className="print-footer mt-4">Developed by MC &amp; SONS</footer>
        </div>
      </div>

      <div className="p-4 print:hidden flex justify-end">
        <Button size="lg" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {/* ── Hidden A4 div for PDF capture (inline styles — html2canvas compatible) ── */}
      {hiddenA4}

      <style jsx global>{`
        /* ===============================
          SCREEN PREVIEW STYLES
        ================================ */
        @media screen {
            #print-area {
                background: white;
                color: black;
                padding: 2rem;
                margin: 2rem auto;
            }

            .print-root.thermal #print-area {
                width: 106mm;
            }
            /* 3-inch preview is styled by the shared block further down so
               the preview and the paper are identical; only centred here. */
            .print-root.thermal3 { margin: 1rem auto !important; }
            .print-root.a4 #print-area {
                width: 210mm;
                min-height: 297mm;
            }
        }
        
        /* ===============================
          GLOBAL PRINT
        ================================ */
        @media print {
          * {
            color: #000 !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            background: white !important;
            overflow: visible !important;
          }
          
          div.min-h-screen {
            min-height: 0 !important;
            height: auto !important;
          }

          #print-area {
              margin: 0;
              padding: 0;
          }

          .print\:hidden {
            display: none !important;
          }

          @page {
            /* Roll papers deliberately set no size: the printer's own roll
               width governs and the sheet stays continuous. (A '<width> auto'
               value is invalid CSS and silently voids the whole rule.) */
            ${paper === 'a4' ? 'size: A4;' : ''}
            margin: 0;
          }
        }

        /* ===============================
          THERMAL BILL (106mm)
        ================================ */
        @media print {
          .print-root.thermal {
            width: 106mm;
            margin: 0 auto;
            display: block;
            font-family: 'Courier New', 'Lucida Console', monospace !important;
          }

          .print-root.thermal #print-area {
            padding: 1.5cm 4mm 10mm 4mm;
            margin: 0 !important;
          }

          .print-root.thermal .header-title {
            font-size: 22px !important;
            font-weight: 700;
            letter-spacing: 0.5px;
            line-height: 1.2;
            white-space: nowrap;
          }
          .print-root.thermal .header-sub {
            display: block;
            text-align: center;
            font-size: 13px !important;
            font-weight: 700;
            line-height: 1.3;
            margin-top: 2px;
          }
          .print-root.thermal .header-phone {
            margin-top: 4px;
          }
          .print-root.thermal .hr-line {
            border-top: 2px solid #000;
            margin: 6px 0;
          }
          .print-root.thermal .table-header-line {
            border-top: 1px solid #000;
            margin: 0;
          }

          .print-root.thermal .cust-name {
            font-weight: 700;
            font-size: 13px;
          }

          .print-root.thermal .bill-no, .print-root.thermal .bill-date {
            font-size: 13px;
          }

          .print-root.thermal .bill-no > strong,
          .print-root.thermal .bill-date > strong {
            font-weight: 700;
          }

          .print-root.thermal .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .print-root.thermal .print-table th,
          .print-root.thermal .print-table td {
            border: none;
            padding: 0px 2px;
            vertical-align: middle !important;
          }

          .print-root.thermal .print-table thead th {
            font-weight: 800 !important;
            font-size: 14px !important;
            padding-top: 0px !important;
            padding-bottom: 0px !important;
          }
          
          .print-root.thermal .header-row-divider td {
            padding: 0 !important;
          }

          .print-root.thermal .text-center {
            text-align: center !important;
          }
          .print-root.thermal .text-left {
            text-align: left !important;
          }
          .print-root.thermal .text-right {
            text-align: right !important;
          }

          .print-root.thermal .print-table tbody td {
            font-weight: 700 !important;
            font-size: 13px;
            line-height: 1.4;
          }

          .print-root.thermal .col-product { 
            width: 60%; 
            font-size: 11px !important;
            line-height: 1.2;
            white-space: normal; 
            word-break: keep-all; 
          }

          .print-root.thermal .col-qty {
            width: 14%;
          }

          .print-root.thermal .col-rate {
            width: 12%;
          }

          .print-root.thermal .col-amount {
            width: 14%;
          }

          .print-root.thermal .uom-text {
            margin-left: 3px;
          }
          
          .print-root.thermal .summary-table {
            width: 100%;
            max-width: 280px;
            border-collapse: collapse;
            font-size: 15px;
            font-weight: 700;
          }
          .print-root.thermal .summary-table td {
            padding: 1px 4px;
          }
          .print-root.thermal .summary-label {
            text-align: left;
            white-space: nowrap;
          }
          .print-root.thermal .summary-colon {
            width: 10px;
            text-align: center;
          }
          .print-root.thermal .summary-value {
            text-align: right;
            white-space: nowrap;
          }
          .print-root.thermal .summary-total-row td {
            font-weight: bold;
          }
          .print-root.thermal .summary-divider-row td {
            border-top: 1px solid black;
          }
           .print-root.thermal .summary-final-balance td {
            font-size: 16px;
            font-weight: 800;
          }

          .print-root.thermal .print-footer {
            margin-top: 10mm;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            font-style: italic;
            padding-bottom: 5mm;
          }
        }
        /* ===============================
           RECEIVED BLOCK (Print Receipt + Print 3-Inch)
           Payments on the left, totals on the right, side by side
           inside the existing receipt width.
        ================================ */
        @media all {
          .received-block { font-weight: 700; min-width: 0; }
          .received-title { text-align: center; text-decoration: underline; margin-bottom: 1px; }
          .received-table { width: 100%; border-collapse: collapse; }
          .received-table td { padding: 0; border: none; vertical-align: top; line-height: 1.25; }
          .received-table .rcv-mode { text-align: left; white-space: nowrap; }
          .received-table .rcv-amt { text-align: right; white-space: nowrap; padding-left: 2px; font-variant-numeric: tabular-nums; }
          .received-table .rcv-date { display: block; font-size: 0.8em; font-weight: 600; }
          .received-table .rcv-total td { border-top: 1px solid #000; }
          .summary-section-wrapper.has-received { display: flex; justify-content: space-between; align-items: flex-start; }
        }
        @media print {
          .print-root.thermal .has-received { gap: 3mm; }
          .print-root.thermal .received-block { flex: 0 0 30%; font-size: 13px; }
          .print-root.thermal .has-received .summary-table { flex: 1 1 auto; width: auto; max-width: none; font-size: 13px; }
          .print-root.thermal .has-received .summary-table td { padding: 1px 2px; }
          .print-root.thermal .has-received .summary-final-balance td { font-size: 14px; }
        }

        /* ===============================
           3-INCH THERMAL.
             The printer driver adds its own left offset (~4-5mm) to browser
             prints, so a full 72mm-wide receipt gets cut on the right.
             The content is therefore a narrower block that always fits:
               --receipt-width : printed content width (default 64mm)
               --receipt-left  : extra left shift (default 0)
             Still cut on the right? lower --receipt-width (e.g. 62mm).
             Gap on the left too big? use a negative --receipt-left.
           Not inside @media print: the preview shows exactly what prints.
        ================================ */
        @media all {
          .print-root.thermal3 {
            --receipt-width: 64mm;
            --receipt-left: 0mm;
            width: var(--receipt-width);
            max-width: var(--receipt-width);
            margin: 0 0 0 var(--receipt-left);
            padding: 0;
            display: block;
            font-family: Arial, 'Nirmala UI', Latha, 'Noto Sans Tamil', sans-serif !important;
            font-weight: 700;
          }

          .print-root.thermal3 #print-area {
            width: var(--receipt-width);
            max-width: var(--receipt-width);
            box-sizing: border-box;
            padding: 3mm 0 8mm 0;
            margin: 0 !important;
            overflow: hidden;
          }

          /* ---- Header ---- */
          /* Margins are set explicitly: browser defaults on h1/p would
             otherwise open big gaps in the middle of the receipt. */
          .print-root.thermal3 header { text-align: center !important; margin: 0 !important; }
          .print-root.thermal3 .bill-logo {
            display: block;
            width: 24mm;              /* 3-inch: 24mm; 4-inch (zoom 1.2): ~29mm */
            height: auto;
            margin: 0 auto 1.5mm;     /* centred over the company name */
          }
          .print-root.thermal3 .header-title {
            font-size: 12.5pt !important;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 1.25;
            white-space: normal;
            margin: 0 !important;
          }
          .print-root.thermal3 .header-sub {
            display: block;
            text-align: center;
            font-size: 9pt !important;
            font-weight: 700;
            line-height: 1.3;
            margin: 1px 0 0 !important;
          }
          .print-root.thermal3 .header-phone { margin-top: 2px !important; }
          .print-root.thermal3 .hr-line {
            border-top: 1px solid #000;
            margin: 3px 0 !important;
          }
          .print-root.thermal3 .mb-2 { margin-bottom: 2px !important; }
          .print-root.thermal3 .table-header-line {
            border-top: 1px solid #000;
            margin: 0;
          }

          /* ---- Customer / bill info ---- */
          .print-root.thermal3 .mb-2.font-mono {
            font-family: inherit !important;
            font-size: 9pt !important;
            display: flex !important;
            justify-content: space-between !important;
            gap: 0;
            align-items: flex-start;
          }
          .print-root.thermal3 .truncate {
            overflow: hidden !important;
            white-space: normal !important;
            text-overflow: clip !important;
            word-break: break-word;
          }
          /* Left block takes the slack and wraps; the Bill No / Date block
             keeps its natural width so the date can never spill off the roll. */
          .print-root.thermal3 .mb-2.font-mono > table:first-child {
            width: auto !important;
            flex: 1 1 auto;
            min-width: 0;
            table-layout: auto !important;
          }
          .print-root.thermal3 .mb-2.font-mono > table:last-child {
            width: auto !important;
            flex: 0 0 auto;
            table-layout: auto !important;
            text-align: left !important;
          }
          .print-root.thermal3 .mb-2.font-mono > table:last-child td {
            text-align: left !important;
            white-space: nowrap;
            padding: 0 1px;
          }
          .print-root.thermal3 .mb-2.font-mono > table.text-right { text-align: left !important; }
          .print-root.thermal3 .mb-2.font-mono .w-4,
          .print-root.thermal3 .mb-2.font-mono .w-12 {
            width: auto !important;
            padding: 0 2px !important;
          }
          .print-root.thermal3 .mb-2.font-mono td { padding: 0 1px; white-space: nowrap; }
          /* Value column takes all spare width: no gap after 'ID' or 'Name'. */
          .print-root.thermal3 .mb-2.font-mono > table:first-child td:last-child { width: 100%; }
          .print-root.thermal3 .mb-2.font-mono > table:first-child td:first-child,
          .print-root.thermal3 .mb-2.font-mono > table:last-child td:first-child { width: 1%; }
          .print-root.thermal3 .mb-2.font-mono .truncate { white-space: normal !important; }

          /* ---- Items table ---- */
          .print-root.thermal3 .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .print-root.thermal3 .print-table th,
          .print-root.thermal3 .print-table td {
            border: none;
            padding: 1px 0;
            font-family: inherit !important;
            vertical-align: top !important;
            overflow: hidden;
          }
          .print-root.thermal3 .print-table thead th {
            font-weight: 700 !important;
            font-size: 9pt !important;
            /* shadcn's TableHead is h-12 (48px) — that was the empty band
               between the column headings and the first item. */
            height: auto !important;
            line-height: 1.25 !important;
            padding-top: 1px !important;
            padding-bottom: 1px !important;
            white-space: nowrap;
            color: inherit !important;
            vertical-align: bottom !important;
          }
          /* shadcn puts border-b on every TableRow; the receipt draws its own rules. */
          .print-root.thermal3 .print-table tr { border: 0 !important; }
          .print-root.thermal3 .print-table > div,
          .print-root.thermal3 .print-table { overflow: visible !important; }
          .print-root.thermal3 .header-row-divider td { padding: 0 !important; }
          .print-root.thermal3 .print-table tbody td {
            font-weight: 700 !important;
            font-size: 9pt;
            line-height: 0.18in;      /* C# lineHeight = 18 (1/100 in) */
          }

          .print-root.thermal3 .text-center { text-align: center !important; }
          .print-root.thermal3 .text-left   { text-align: left !important; }
          .print-root.thermal3 .text-right  { text-align: right !important; }

          /* Column widths = the C# receipt: item 115 | qty 60 | rate 45 | amount 60
             (1/100 in, over 280 of content). Qty/Rate/Amount right-aligned. */
          .print-root.thermal3 .col-product {
            width: 41.07%;
            padding-left: 0 !important;
            font-size: 8pt !important;   /* smaller so long product names fit */
            line-height: 0.18in;
            white-space: normal !important;
            word-wrap: break-word;
            word-break: break-word;
            padding-right: 2px;
          }
          /* Rate and Amount wrap rather than clip, so an unusually long value
             can never lose digits. Normal bills fit on one line. */
          .print-root.thermal3 .col-rate,
          .print-root.thermal3 .col-amount {
            white-space: normal !important;
            overflow-wrap: anywhere;
          }
          /* Qty stays on one line so the unit never splits off the number. */
          .print-root.thermal3 .col-qty {
            white-space: nowrap !important;
            width: 21.43%;
            padding-right: 0 !important;
          }
          .print-root.thermal3 .col-rate   { width: 16.07%; padding-left: 2px !important; padding-right: 0 !important; }
          .print-root.thermal3 .col-amount { width: 21.43%; padding-left: 2px !important; padding-right: 0 !important; }
          .print-root.thermal3 .col-qty,
          .print-root.thermal3 .col-rate,
          .print-root.thermal3 .col-amount { font-size: 9pt !important; }

          .print-root.thermal3 .uom-text {
            font-size: 7pt !important;
            margin-left: 2px;
            font-weight: 700;
          }

          .print-root.thermal3 .combined-summary-row div {
            font-family: inherit !important;
            font-size: 8pt !important;
            padding-right: 0 !important;
          }

          /* ---- Summary ---- */
          .print-root.thermal3 .summary-section-wrapper {
            display: block !important;
            width: 100%;
          }
          .print-root.thermal3 .summary-table {
            width: 100%;
            max-width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 10pt;
            font-weight: 700;
          }
          .print-root.thermal3 .summary-table td { padding: 1px 1px; }
          .print-root.thermal3 .summary-label {
            text-align: left;
            white-space: nowrap;
            width: 55%;
          }
          .print-root.thermal3 .summary-colon { width: 4mm; text-align: center; }
          .print-root.thermal3 .summary-value {
            text-align: right;
            white-space: nowrap;
            font-size: 12pt;
            font-family: inherit !important;
            font-variant-numeric: tabular-nums;
          }
          .print-root.thermal3 .summary-total-row td { font-weight: 700; }
          .print-root.thermal3 .summary-divider-row td { border-top: 1px solid #000; }
          .print-root.thermal3 .summary-final-balance td { font-size: 12pt; font-weight: 700; }
          /* C#: labels stay 10pt even on the final line; only the value is 12pt. */
          .print-root.thermal3 .summary-final-balance .summary-label,
          .print-root.thermal3 .summary-final-balance .summary-colon { font-size: 10pt; }

          /* With a Received block: payments left (~31%), compact totals right. */
          .print-root.thermal3 .summary-section-wrapper.has-received { display: flex !important; gap: 1.5mm; }
          .print-root.thermal3 .received-block { flex: 0 1 31%; font-size: 8pt; }  /* may shrink to its content when totals need room */
          .print-root.thermal3 .received-table .rcv-date { font-size: 6.5pt; }
          /* Totals hug their content and sit at the right edge, so the free
             space falls between the Received block and the totals. */
          .print-root.thermal3 .has-received .summary-table { flex: 0 1 auto; width: auto; min-width: 0; margin-left: auto; table-layout: auto; font-size: 8pt; }
          .print-root.thermal3 .has-received .summary-value { padding-left: 2mm; }
          .print-root.thermal3 .has-received .summary-label { width: 1%; white-space: nowrap; line-height: 1.15; padding-right: 0.5mm; }
          .print-root.thermal3 .has-received .summary-colon { width: 2mm; }

          /* Totals: label column hugs the longest label so the colon sits right
             after the titles; the free space goes before the right-aligned value. */
          .print-root.thermal3 .summary-table { table-layout: auto; }
          .print-root.thermal3 .summary-label { width: 1%; white-space: nowrap; padding-right: 1.5mm; }
          .print-root.thermal3 .summary-value { width: auto; }
          .print-root.thermal3 .has-received .summary-value,
          .print-root.thermal3 .has-received .summary-final-balance .summary-value { font-size: 10pt; }
          .print-root.thermal3 .has-received .summary-final-balance .summary-label,
          .print-root.thermal3 .has-received .summary-final-balance .summary-colon { font-size: 8pt; }

          /* 4-inch Print Receipt: the 3-inch receipt scaled 1.2x (text ~15%
             smaller than the earlier 1.4x). Same paper footprint as before:
             81.7mm x 1.2 = 98mm wide, starting 6.67mm x 1.2 = 8mm in.
             Text size: change zoom AND keep width x zoom = 98mm, left x zoom = 8mm.
             Off-centre? Change --receipt-left (+0.83mm moves the print 1mm right). */
          .print-root.thermal3.four-inch {
            --receipt-width: 81.7mm;
            --receipt-left: 6.67mm;
            zoom: 1.2;
          }

          .print-root.thermal3 .print-footer {
            margin-top: 6mm;
            text-align: left;
            font-size: 6pt;           /* C# footer: Arial 6pt bold */
            font-weight: 700;
            font-style: italic;
            padding-bottom: 4mm;
          }

          /* 3-inch thermal: no page breaks, continuous feed */
          @media print {
            thead { display: table-row-group !important; }
            tr { page-break-inside: avoid; }
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
          
          .print-root.a4 .header-title {
            font-size: 20px;
            font-weight: bold;
          }
          .print-root.a4 .header-sub {
            font-size: 12px;
          }
          .print-root.a4 .hr-line,
          .print-root.a4 .table-header-line {
            display: none;
          }

          .print-root.a4 .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10mm;
          }
          .print-root.a4 .print-table th,
          .print-root.a4 .print-table td {
            padding: 8px;
            border: 1px solid #ddd;
            text-align: left;
          }
          .print-root.a4 .print-table th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          .print-root.a4 .print-table .text-right {
            text-align: right;
          }
          .print-root.a4 .print-table .text-center {
            text-align: center;
          }
          
          .print-root.a4 .summary-table {
            width: 100%;
            max-width: 350px;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 10mm;
          }
          .print-root.a4 .summary-table td {
            padding: 6px;
            border: 1px solid #ddd;
          }
          .print-root.a4 .summary-label {
            font-weight: bold;
          }
          .print-root.a4 .summary-value {
            text-align: right;
          }
          .print-root.a4 .summary-final-balance td {
            font-weight: bold;
            font-size: 14px;
          }

          .print-root.a4 .print-footer {
            margin-top: 20mm;
            font-size: 10px;
          }
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