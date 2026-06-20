'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface BoxBillPrintData {
  id: string;
  customerId: string;
  customerName: string;
  billDate: any;
  prevBalanceBox: number;
  todaysFishBox: number;
  totalBox: number;
  emptyBox: number;
  balanceBox: number;
  description?: string;
  driverMobile?: string;
  driverName?: string;
  vehicleNo?: string;
}

function PrintPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billData, setBillData] = useState<BoxBillPrintData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const paper = searchParams.get('paper') || 'thermal';
  const autoShare = searchParams.get('share') === 'pdf';

  useEffect(() => {
    const sessionData = sessionStorage.getItem('boxBillPrintData');
    if (sessionData) {
      try {
        setBillData(JSON.parse(sessionData));
        return;
      } catch (error) {
        console.error('Failed to parse box bill data from sessionStorage:', error);
      }
    }
    const data = searchParams.get('data');
    if (data) {
      try {
        setBillData(JSON.parse(decodeURIComponent(data)));
      } catch {
        router.push('/dashboard');
      }
    } else {
      router.push('/dashboard');
    }
  }, [searchParams, router]);

  // ─── Share PDF (same engine as Main Billing) ───
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
      const parsedDateRaw = billData.billDate?.seconds
        ? new Date(billData.billDate.seconds * 1000)
        : new Date(billData.billDate || Date.now());
      const billDateFormatted = format(parsedDateRaw, 'dd-MM-yyyy');
      const fileName = `MC_BoxBill_${billDateFormatted}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const waMessage = `*M.C & SONS FISH COMPANY*\n*Box Bill PDF*\n\nBill Date: ${billDateFormatted}\nCustomer: ${billData.customerName || ''}\n\nPlease find the attached PDF box bill.\n\nThank you!`;
      const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: `Box Bill: ${billDateFormatted} - M.C & SONS`, text: waMessage, files: [file] });
          sharedViaWebShare = true;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
          console.warn('Web Share API failed, using fallback:', shareErr);
        }
      }

      if (!sharedViaWebShare) {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => { URL.revokeObjectURL(url); window.open(waUrl, '_blank'); }, 400);
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
    return <div className="flex justify-center items-center h-screen"><p>Loading bill data...</p></div>;
  }

  const { id: billNo, customerId, customerName, billDate, prevBalanceBox, todaysFishBox, totalBox, emptyBox, balanceBox, description, driverMobile, driverName, vehicleNo } = billData;
  const parsedDate = billDate?.seconds ? new Date(billDate.seconds * 1000) : new Date(billDate || Date.now());

  // ─── Table row styles (shared) ───
  const tdBorder: React.CSSProperties = { border: '1px dashed #333', padding: '5px 8px', fontSize: '12px' };
  const tdLabel: React.CSSProperties = { ...tdBorder, fontWeight: 'bold', width: '45%' };
  const tdValue: React.CSSProperties = { ...tdBorder, fontWeight: 'bold', textAlign: 'center', width: '18%' };
  const tdRight: React.CSSProperties = { ...tdBorder, width: '37%' };

  // ─── Hidden A4 PDF area (inline styles for html2canvas) ───
  const hiddenA4 = (
    <div
      id="pdf-area"
      style={{
        position: 'fixed', left: '-9999px', top: 0,
        width: '480px', background: '#fff', color: '#000',
        fontFamily: '"Calibri", "Arial", sans-serif', fontSize: '12px',
        boxSizing: 'border-box', padding: '20px',
      }}
    >
      {/* Company Header */}
      <div style={{ textAlign: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '2px solid #000' }}>
        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1E40AF', marginBottom: '6px' }}>
          M.C &amp; SONS FISH COMPANY
        </div>
        <div style={{ fontSize: '11px', fontWeight: 'bold' }}>Shop No 1 : Fish Market, Santhaipettai,</div>
        <div style={{ fontSize: '11px', fontWeight: 'bold' }}>Thennampalayam, Palladam Road - Tiruppur - 641604</div>
      </div>

      {/* ID / Customer / Bill No / Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '12px', borderBottom: '1px dashed #555', paddingBottom: '8px' }}>
        <div>
          <div><strong>Id</strong> : {customerId}</div>
          <div><strong>Name</strong> : {customerName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>Bill No</strong> : {billNo}</div>
          <div><strong>Bill Date</strong> : {format(parsedDate, 'dd-MM-yyyy')}</div>
        </div>
      </div>

      {/* Main 2-column Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginTop: '6px' }}>
        <tbody>
          <tr>
            <td style={tdLabel}>Previous Balance Box</td>
            <td style={tdValue}>{prevBalanceBox}</td>
            <td style={tdRight}>Driver Name &nbsp;: {driverName || ''}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Today's Fish Box</td>
            <td style={tdValue}>{todaysFishBox}</td>
            <td style={tdRight}>Mobile No &nbsp;&nbsp;: {driverMobile || ''}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Total Box</td>
            <td style={tdValue}>{totalBox}</td>
            <td style={tdRight}>Vehicle No : {vehicleNo || ''}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Empty Box</td>
            <td style={tdValue}>{emptyBox}</td>
            <td style={tdRight}></td>
          </tr>
          <tr>
            <td style={tdLabel}>Total Balance Box</td>
            <td style={tdValue}>{balanceBox}</td>
            <td style={tdRight}></td>
          </tr>
        </tbody>
      </table>

      {/* NOTE */}
      <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 'bold' }}>
        NOTE : <span style={{ fontWeight: 'normal' }}>{description || '-'}</span>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '24px', fontSize: '10px', fontStyle: 'italic', fontWeight: 'bold' }}>
        Developed By MC &amp; SONS
      </div>
    </div>
  );

  return (
    <div>
      {/* Share banner */}
      {autoShare && (
        <div className="print:hidden bg-green-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Share2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm leading-tight">Your box bill is ready to share!</p>
              <p className="text-xs text-green-100 leading-tight mt-0.5">Tap the button to send this bill as a PDF via WhatsApp.</p>
            </div>
          </div>
          <Button onClick={handleSharePDF} disabled={isSharing} className="w-full sm:w-auto bg-white text-green-700 hover:bg-green-50 font-bold text-sm px-6 shrink-0">
            {isSharing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating PDF...</> : <><Share2 className="mr-2 h-4 w-4" /> Share via WhatsApp</>}
          </Button>
        </div>
      )}
      {shareError && (
        <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">{shareError}</div>
      )}

      {/* Toolbar */}
      <div className="p-4 print:hidden flex justify-between items-center gap-2">
        <Button variant="outline" onClick={() => window.close()} className="text-foreground">
          <X className="mr-2 h-4 w-4" /> Close
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSharePDF} disabled={isSharing} className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
            {isSharing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</> : <><Share2 className="mr-2 h-4 w-4" /> Share (PDF)</>}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* ── Thermal Print Layout ── */}
      <div className={`print-root ${paper}`}>
        <div id="print-area">
          <header className="text-center">
            <h1 className="header-title">M.C &amp; SONS FISH COMPANY</h1>
            <p className="header-sub">Shop No 1 : Fish Market, Santhaipettai,<br />Thennampalayam, Palladam Road - Tiruppur - 641604</p>
          </header>
          <div className="hr-line"></div>

          {/* ID / Name / Bill No / Bill Date */}
          <div className="mb-2 text-[13px] font-mono leading-tight flex flex-col gap-1">
            <div className="flex justify-between items-start">
              <div className="flex"><span className="inline-block w-10">Id</span><span className="mr-1">:</span><strong>{customerId}</strong></div>
              <div className="whitespace-nowrap text-right"><span>Bill No</span><span className="mx-1">:</span><strong>{billNo}</strong></div>
            </div>
            <div className="flex flex-wrap justify-between items-start gap-x-2 gap-y-1">
              <div className="flex flex-1"><span className="inline-block w-10 shrink-0">Name</span><span className="mr-1 shrink-0">:</span><strong className="whitespace-normal break-words">{customerName}</strong></div>
              <div className="whitespace-nowrap text-right shrink-0"><span>Date</span><span className="mx-1">:</span><strong>{format(parsedDate, 'dd-MM-yyyy')}</strong></div>
            </div>
          </div>

          <div className="hr-line mb-2"></div>

          {/* 2-Column Box Table */}
          <table className="box-main-table w-full">
            <tbody>
              <tr>
                <td className="box-label">Previous Balance Box</td>
                <td className="box-value">{prevBalanceBox}</td>
                <td className="box-driver align-top">
                  <div className="flex"><span className="whitespace-nowrap">Driver Name:</span><span className="ml-1 flex-1 break-words">{driverName || ''}</span></div>
                </td>
              </tr>
              <tr>
                <td className="box-label">Today's Fish Box</td>
                <td className="box-value">{todaysFishBox}</td>
                <td className="box-driver align-top">
                  <div className="flex"><span className="whitespace-nowrap">Mobile No &nbsp;:</span><span className="ml-1 flex-1 break-words">{driverMobile || ''}</span></div>
                </td>
              </tr>
              <tr>
                <td className="box-label">Total Box</td>
                <td className="box-value">{totalBox}</td>
                <td className="box-driver align-top">
                  <div className="flex"><span className="whitespace-nowrap">Vehicle No :</span><span className="ml-1 flex-1 break-words">{vehicleNo || ''}</span></div>
                </td>
              </tr>
              <tr>
                <td className="box-label">Empty Box</td>
                <td className="box-value">{emptyBox}</td>
                <td className="box-driver"></td>
              </tr>
              <tr className="box-final-row">
                <td className="box-label">Total Balance Box</td>
                <td className="box-value">{balanceBox}</td>
                <td className="box-driver"></td>
              </tr>
            </tbody>
          </table>

          {/* NOTE */}
          <div className="note-section">
            <span className="font-bold">NOTE : </span>{description || '-'}
          </div>

          <footer className="print-footer mt-4">Developed By MC &amp; SONS</footer>
        </div>
      </div>

      <div className="p-4 print:hidden flex justify-end">
        <Button size="lg" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      {/* Hidden A4 for PDF */}
      {hiddenA4}

      <style jsx global>{`
        @media screen {
          #print-area { background: white; color: black; padding: 2rem; margin: 2rem auto; }
          .print-root.thermal #print-area { width: 106mm; }
          .print-root.a4 #print-area { width: 210mm; min-height: 297mm; }
        }

        @media print {
          * { color: #000 !important; -webkit-font-smoothing: antialiased; }
          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; background: white !important; overflow: visible !important; }
          div.min-h-screen { min-height: 0 !important; height: auto !important; }
          #print-area { margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          @page { size: ${paper === 'thermal' ? '78mm auto' : 'A4'}; margin: 0; }
        }

        /* Thermal 78mm (3-Inch) */
        @media print {
          .print-root.thermal {
            width: 78mm;
            max-width: 78mm;
            margin: 0 auto;
            display: block;
            font-family: 'Courier New', 'Noto Sans Tamil', monospace !important;
          }
          .print-root.thermal #print-area { padding: 1.5cm 4mm 10mm 4mm; margin: 0 !important; }

          .print-root.thermal .header-title {
            font-size: 18px !important;
            font-weight: 700;
            letter-spacing: 0.5px;
            line-height: 1.2;
            text-align: center;
            margin-bottom: 6px;
            white-space: nowrap;
          }
          .print-root.thermal .header-sub {
            display: block;
            text-align: center;
            font-size: 11px !important;
            font-weight: 700;
            line-height: 1.3;
            margin-top: 2px;
          }
          .print-root.thermal .hr-line { border-top: 2px solid #000; margin: 5px 0; }

          /* Box table */
          .print-root.thermal .box-main-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            font-size: 12px;
            font-weight: 700;
            table-layout: fixed;
          }
          .print-root.thermal .box-main-table td {
            border: 1px dashed #333;
            padding: 3px 4px;
            vertical-align: middle;
          }
          .print-root.thermal .box-label { text-align: left; font-weight: 700; width: 38%; white-space: normal; line-height: 1.1; padding-right: 1px; }
          .print-root.thermal .box-value { text-align: center; font-weight: 800; width: 10%; padding-left: 0; padding-right: 0; }
          .print-root.thermal .box-driver { text-align: left; font-size: 10px; width: 52%; white-space: normal; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.1; }
          .print-root.thermal .box-final-row td { border-top: 1px solid #000; font-size: 12px; font-weight: 800; }

          .print-root.thermal .note-section {
            margin-top: 10px;
            font-size: 12px;
            font-weight: 700;
            min-height: 24px;
          }

          .print-root.thermal .print-footer {
            margin-top: 8mm;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            font-style: italic;
            padding-bottom: 5mm;
          }
        }
      `}</style>
    </div>
  );
}

export default function BoxBillPrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}
