'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { BoxBillTemplate } from '@/components/dashboard/BoxBillTemplate';

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

  const handleSharePDF = useCallback(async () => {
    const captureEl = document.getElementById('pdf-area');
    if (!captureEl || !billData) return;
    
    setIsSharing(true);
    setShareError(null);
    let shouldClose = false;

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
        windowWidth: 480,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = pageWidth * (canvas.height / canvas.width);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(imgHeight, pdf.internal.pageSize.getHeight()));

      const pdfBlob = pdf.output('blob');
      const parsedDateRaw = billData.billDate?.seconds
        ? new Date(billData.billDate.seconds * 1000)
        : new Date(billData.billDate || Date.now());
      const billDateFormatted = format(parsedDateRaw, 'dd-MM-yyyy');
      const fileName = `MC_BoxBill_${billDateFormatted}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: `Box Bill: ${billDateFormatted}`, files: [file] });
          sharedViaWebShare = true;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            shouldClose = true;
          } else {
            console.warn('Web Share API failed:', shareErr);
          }
        }
      }

      if (!sharedViaWebShare && !shouldClose) {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        setShareError('PDF generated and downloaded.');
      }
    } catch (err: any) {
      console.error('Share PDF failed:', err);
      setShareError('Could not generate PDF.');
    } finally {
      setIsSharing(false);
    }
  }, [billData]);

  if (!billData) {
    return <div className="flex justify-center items-center h-screen"><p>Loading bill data...</p></div>;
  }

  return (
    <div>
      {isSharing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm text-foreground">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Preparing PDF...</h2>
        </div>
      )}

      {autoShare && (
        <div className="print:hidden bg-green-600 text-white px-4 py-3 flex items-center justify-between">
          <p className="font-semibold text-sm">Your box bill is ready to share!</p>
          <Button onClick={handleSharePDF} disabled={isSharing} className="bg-white text-green-700 hover:bg-green-50">
            <Share2 className="mr-2 h-4 w-4" /> Share via WhatsApp
          </Button>
        </div>
      )}

      {/* ── Hidden inline-styled PDF capture area (off-screen, always rendered) ──
           html2canvas reads computed styles — not CSS classes. This div has full
           inline styles so the PDF looks correct regardless of class resolution. */}
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
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1E40AF', marginBottom: '6px' }}>M.C &amp; SONS FISH COMPANY</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold' }}>Shop No 1 : Fish Market, Santhaipettai,</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold' }}>Thennampalayam, Palladam Road - Tiruppur - 641604</div>
        </div>
        {/* Customer / Bill Info */}
        {billData && (() => {
          const { id: billNo, customerId, customerName, billDate, prevBalanceBox, todaysFishBox, totalBox, emptyBox, balanceBox, description, driverMobile, driverName, vehicleNo } = billData;
          const parsedDate = billDate?.seconds ? new Date(billDate.seconds * 1000) : new Date(billDate || Date.now());
          const tdBorder: React.CSSProperties = { border: '1px dashed #333', padding: '5px 8px', fontSize: '12px' };
          const tdLabel: React.CSSProperties = { ...tdBorder, fontWeight: 'bold', width: '45%' };
          const tdValue: React.CSSProperties = { ...tdBorder, fontWeight: 'bold', textAlign: 'center', width: '18%' };
          const tdRight: React.CSSProperties = { ...tdBorder, width: '37%' };
          return (
            <>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginTop: '6px' }}>
                <tbody>
                  <tr><td style={tdLabel}>Previous Balance Box</td><td style={tdValue}>{prevBalanceBox}</td><td style={tdRight}>Driver Name : {driverName || ''}</td></tr>
                  <tr><td style={tdLabel}>Today's Fish Box</td><td style={tdValue}>{todaysFishBox}</td><td style={tdRight}>Mobile No : {driverMobile || ''}</td></tr>
                  <tr><td style={tdLabel}>Total Box</td><td style={tdValue}>{totalBox}</td><td style={tdRight}>Vehicle No : {vehicleNo || ''}</td></tr>
                  <tr><td style={tdLabel}>Empty Box</td><td style={tdValue}>{emptyBox}</td><td style={tdRight}></td></tr>
                  <tr><td style={{...tdLabel,borderTop:'1px solid #000',fontWeight:800}}>Total Balance Box</td><td style={{...tdValue,borderTop:'1px solid #000',fontWeight:800}}>{balanceBox}</td><td style={{...tdRight,borderTop:'1px solid #000'}}></td></tr>
                </tbody>
              </table>
              <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 'bold' }}>NOTE : <span style={{ fontWeight: 'normal' }}>{description || '-'}</span></div>
              <div style={{ marginTop: '24px', fontSize: '10px', fontStyle: 'italic', fontWeight: 'bold' }}>Developed By MC &amp; SONS</div>
            </>
          );
        })()}
      </div>

      {shareError && (
        <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">{shareError}</div>
      )}

      {/* Toolbar */}
      <div className="p-4 print:hidden flex justify-between items-center gap-2 bg-background border-b z-10 sticky top-0">
        <Button variant="outline" onClick={() => window.close()} className="text-foreground"><X className="mr-2 h-4 w-4" /> Close</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSharePDF} disabled={isSharing} className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
            {isSharing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</> : <><Share2 className="mr-2 h-4 w-4" /> Share (PDF)</>}
          </Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        </div>
      </div>

      {/* ── Visible Screen/Print Layout (CSS class-based, preserved for print) ── */}
      <div className={`print-root ${paper}`}>
        <BoxBillTemplate billData={billData} />
      </div>

      <style jsx global>{`
        .box-bill-template-root { background: #fff; color: #000; font-family: "Calibri", "Arial", sans-serif; font-size: 12px; box-sizing: border-box; padding: 20px; width: 480px; }
        .bb-header { text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #000; }
        .bb-company-name { font-size: 22px; font-weight: bold; color: #1E40AF; margin-bottom: 6px; }
        .bb-address { font-size: 11px; font-weight: bold; }
        .bb-info-section { display: flex; justify-content: space-between; margin: 8px 0; font-size: 12px; border-bottom: 1px dashed #555; padding-bottom: 8px; }
        .bb-info-right { text-align: right; }
        .bb-main-table { width: 100%; border-collapse: collapse; border: 1px solid #333; margin-top: 6px; }
        .bb-main-table td { border: 1px dashed #333; padding: 5px 8px; font-size: 12px; }
        .bb-td-label { font-weight: bold; width: 45%; }
        .bb-td-value { font-weight: bold; text-align: center; width: 18%; }
        .bb-td-right { width: 37%; }
        .bb-driver-row { display: inline; }
        .bb-note-section { margin-top: 12px; font-size: 12px; }
        .bb-note-bold { font-weight: bold; }
        .bb-note-text { font-weight: normal; }
        .bb-footer { margin-top: 24px; font-size: 10px; font-style: italic; font-weight: bold; }
        .bb-final-row td { border-top: 1px solid #000; font-weight: 800; }
        @media screen {
          body { background-color: #111 !important; }
          .print-root { display: flex; justify-content: center; padding: 2rem 1rem; min-height: calc(100vh - 70px); }
          .box-bill-template-root { box-shadow: 0 4px 20px rgba(0,0,0,0.5); margin: 0 auto; }
        }
        @media print {
          * { color: #000 !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .print-root { padding: 0; display: block; }
          .print\\:hidden { display: none !important; }
          @page { size: ${paper === 'thermal' ? '78mm auto' : 'A4'}; margin: 0; }
        }
        @media print {
          .print-root.thermal { width: 78mm; max-width: 78mm; margin: 0 auto; display: block; font-family: 'Courier New', monospace !important; }
          .print-root.thermal .box-bill-template-root { padding: 1.5cm 4mm 10mm 4mm; margin: 0 !important; width: 100%; box-shadow: none; }
          .print-root.thermal .bb-company-name { font-size: 18px !important; font-weight: 700; color: #000 !important; white-space: nowrap; }
          .print-root.thermal .bb-address { display: block; text-align: center; font-size: 11px !important; font-weight: 700; }
          .print-root.thermal .bb-header { border-bottom: 2px solid #000; margin-bottom: 5px; padding-bottom: 5px; }
          .print-root.thermal .bb-info-section { display: block; border-bottom: 2px solid #000; margin-bottom: 5px; padding-bottom: 5px; font-size: 13px; }
          .print-root.thermal .bb-info-right { text-align: left; margin-top: 4px; }
          .print-root.thermal .bb-info-label { display: inline-block; width: 50px; }
          .print-root.thermal .bb-main-table { border: 1px solid #000; font-size: 12px; font-weight: 700; table-layout: fixed; }
          .print-root.thermal .bb-main-table td { border: 1px dashed #333; padding: 3px 4px; vertical-align: middle; }
          .print-root.thermal .bb-td-label { text-align: left; font-weight: 700; width: 38%; white-space: normal; line-height: 1.1; }
          .print-root.thermal .bb-td-value { text-align: center; font-weight: 800; width: 10%; padding: 0; }
          .print-root.thermal .bb-td-right { text-align: left; font-size: 10px; width: 52%; white-space: normal; word-wrap: break-word; line-height: 1.1; padding: 0 4px; }
          .print-root.thermal .bb-driver-row { display: flex; }
          .print-root.thermal .bb-driver-label { white-space: nowrap; }
          .print-root.thermal .bb-driver-val { margin-left: 4px; flex: 1; word-break: break-word; }
          .print-root.thermal .bb-final-row td { border-top: 1px solid #000; font-size: 12px; font-weight: 800; }
          .print-root.thermal .bb-note-section { margin-top: 10px; font-size: 12px; font-weight: 700; min-height: 24px; }
          .print-root.thermal .bb-footer { margin-top: 8mm; font-size: 10px; font-weight: 800; font-style: italic; padding-bottom: 5mm; }
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

