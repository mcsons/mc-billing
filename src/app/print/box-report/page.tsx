'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateWiseRow {
  customerId: string;
  customerName: string;
  boxesTaken: number;
  emptyBoxes: number;
  balance: number;
}

interface CustomerRow {
  billId?: string;
  billDate: string;
  boxesTaken: number;
  emptyBoxes: number;
  balance: number;
}

type PrintData =
  | {
      type: 'datewise';
      date: string;
      rows: DateWiseRow[];
      totalTaken: number;
      totalEmpty: number;
    }
  | {
      type: 'customer';
      customerName: string;
      fromDate: string;
      toDate: string;
      openingBalance: number;
      rows: CustomerRow[];
      totalTaken: number;
      totalEmpty: number;
      finalBalance: number;
    };

// ─── Main Content ─────────────────────────────────────────────────────────────

function BoxReportPrintContent() {
  const router = useRouter();
  const [data, setData] = useState<PrintData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('boxReportPrintData');
    if (raw) {
      try {
        setData(JSON.parse(raw));
        return;
      } catch (err) {
        console.error('Failed to parse box report data', err);
      }
    }
    router.push('/dashboard/box-reports');
  }, [router]);

  // ── Share PDF (same engine as Box Bill) ───────────────────────────────────
  const handleSharePDF = useCallback(async () => {
    const captureEl = document.getElementById('pdf-area');
    if (!captureEl || !data) return;
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

      const fileName =
        data.type === 'datewise'
          ? `MC_BoxReport_${data.date}.pdf`
          : `MC_BoxReport_${data.customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${data.fromDate}_${data.toDate}.pdf`;

      const waMessage =
        data.type === 'datewise'
          ? `*M.C & SONS FISH COMPANY*\n*Box Bill Report – Date-wise*\n\nDate: ${data.date}\nTotal Boxes Taken: ${data.totalTaken}\nTotal Empty Boxes: ${data.totalEmpty}\n\nThank you!`
          : `*M.C & SONS FISH COMPANY*\n*Box Bill Report – Customer*\n\nCustomer: ${data.customerName}\nPeriod: ${data.fromDate} – ${data.toDate}\nOpening Balance: ${data.openingBalance}\nTotal Boxes Taken: ${data.totalTaken}\nTotal Empty Boxes: ${data.totalEmpty}\nFinal Box Balance: ${data.finalBalance}\n\nThank you!`;

      const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: 'MC Box Report', text: waMessage, files: [file] });
          sharedViaWebShare = true;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
          console.warn('Web Share API failed, using fallback:', shareErr);
        }
      }

      if (!sharedViaWebShare) {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => { URL.revokeObjectURL(url); window.open(waUrl, '_blank'); }, 400);
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
  }, [data]);

  if (!data) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  // ── Hidden A4 PDF capture area (always white/black, inline styles) ────────
  const pdfArea = (
    <div
      id="pdf-area"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '480px',
        background: '#fff',
        color: '#000',
        fontFamily: '"Calibri", "Arial", sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        padding: '20px',
      }}
    >
      {/* Company header */}
      <div style={{ textAlign: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '2px solid #000' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1E40AF', marginBottom: '4px' }}>
          M.C &amp; SONS FISH COMPANY
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700 }}>BOX BILL REPORT</div>
      </div>

      {data.type === 'datewise' ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Date-wise Box Report</div>
            <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>Date: {data.date}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'left', textTransform: 'uppercase' }}>Cust ID</th>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'left', textTransform: 'uppercase' }}>Customer Name</th>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'center', textTransform: 'uppercase' }}>Boxes Taken</th>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'center', textTransform: 'uppercase' }}>Empty Boxes</th>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'right', textTransform: 'uppercase' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', fontFamily: 'monospace' }}>{row.customerId}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', wordBreak: 'break-word' }}>{row.customerName}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{row.boxesTaken}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{row.emptyBoxes}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{row.balance}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #333', backgroundColor: '#f3f4f6' }}>
                <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right', border: '1px solid #333' }}>TOTAL</td>
                <td style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', border: '1px solid #333' }}>{data.totalTaken}</td>
                <td style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', border: '1px solid #333' }}>{data.totalEmpty}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #333' }}>—</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: '12px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Total Boxes Taken</span><strong>{data.totalTaken}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Empty Boxes</span><strong>{data.totalEmpty}</strong>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Customer Box Report</div>
            <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>{data.customerName}</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{data.fromDate} — {data.toDate}</div>
          </div>
          <div style={{ marginBottom: '10px', padding: '6px 10px', backgroundColor: '#f3f4f6', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', border: '1px solid #e5e7eb' }}>
            <span>Opening Balance</span><strong>{data.openingBalance}</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'left', textTransform: 'uppercase' }}>Bill Date</th>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'center', textTransform: 'uppercase' }}>Boxes Taken</th>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'center', textTransform: 'uppercase' }}>Empty Boxes</th>
                <th style={{ padding: '6px 8px', border: '1px solid #333', fontSize: '11px', textAlign: 'right', textTransform: 'uppercase' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', fontFamily: 'monospace' }}>{row.billDate}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{row.boxesTaken}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{row.emptyBoxes}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{row.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '12px', fontSize: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Total Boxes Taken</span><strong>{data.totalTaken}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Total Empty Boxes</span><strong>{data.totalEmpty}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #333', paddingTop: '6px', marginTop: '6px' }}>
              <strong>Final Box Balance</strong><strong style={{ fontSize: '14px' }}>{data.finalBalance}</strong>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: '24px', fontSize: '10px', fontStyle: 'italic', fontWeight: 700 }}>
        Developed By MC &amp; SONS
      </div>
    </div>
  );

  // ── On-screen preview (uses Tailwind / theme) ─────────────────────────────
  const isDatewise = data.type === 'datewise';

  return (
    <div>
      {/* Share error banner */}
      {shareError && (
        <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
          {shareError}
        </div>
      )}

      {/* Toolbar */}
      <div className="p-4 print:hidden flex justify-between items-center gap-2 border-b"
        style={{ backgroundColor: 'hsl(215 28% 17%)', borderColor: 'hsl(215 28% 22%)' }}>
        <Button variant="outline" onClick={() => window.close()}
          style={{ borderColor: 'hsl(215 20% 45%)', color: '#e2e8f0', backgroundColor: 'transparent' }}
          className="hover:bg-slate-700">
          <X className="mr-2 h-4 w-4" /> Close
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSharePDF}
            disabled={isSharing}
            style={{ borderColor: '#16a34a', color: '#4ade80', backgroundColor: 'transparent' }}
            className="hover:bg-green-950"
          >
            {isSharing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</>
              : <><Share2 className="mr-2 h-4 w-4" /> Share (PDF)</>}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* On-screen preview card */}
      <div className="max-w-2xl mx-auto px-4 py-6 print:px-0 print:py-0">
        <div id="print-area" className="bg-background text-foreground rounded-lg border p-6 print:border-none print:p-0">

          {/* Company header */}
          <div className="text-center mb-5 pb-4 border-b">
            <div className="text-xl font-extrabold text-blue-700 dark:text-blue-400">M.C &amp; SONS FISH COMPANY</div>
            <div className="text-xs font-bold mt-1 text-muted-foreground">BOX BILL REPORT</div>
          </div>

          {isDatewise && data.type === 'datewise' ? (
            <>
              <div className="text-center mb-4">
                <div className="text-base font-bold">Date-wise Box Report</div>
                <div className="text-sm text-muted-foreground mt-1">Date: {data.date}</div>
              </div>

              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Cust ID</th>
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Customer Name</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Boxes Taken</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Empty Boxes</th>
                      <th className="px-3 py-2 text-right text-xs uppercase font-bold border-b">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                        <td className="px-3 py-2 font-mono text-xs border-b">{row.customerId}</td>
                        <td className="px-3 py-2 border-b whitespace-normal break-words">{row.customerName}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold border-b">{row.boxesTaken}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold border-b">{row.emptyBoxes}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-primary border-b">{row.balance}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 border-t-2">
                      <td colSpan={2} className="px-3 py-2 font-bold text-right text-sm">TOTAL</td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-sm">{data.totalTaken}</td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-sm">{data.totalEmpty}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Separator className="my-4" />
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-muted-foreground">Total Boxes Taken</span>
                  <span className="font-mono text-lg font-bold">{data.totalTaken}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-muted-foreground">Total Empty Boxes</span>
                  <span className="font-mono text-lg font-bold">{data.totalEmpty}</span>
                </div>
              </div>
            </>
          ) : data.type === 'customer' ? (
            <>
              <div className="text-center mb-4">
                <div className="text-base font-bold">Customer Box Report</div>
                <div className="text-sm text-muted-foreground mt-1">{data.customerName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{data.fromDate} — {data.toDate}</div>
              </div>

              {/* Opening balance */}
              <div className="rounded-md bg-muted/50 border px-3 py-2 text-sm flex justify-between items-center mb-3">
                <span className="text-muted-foreground font-medium">Opening Balance</span>
                <span className="font-mono font-bold text-base">{data.openingBalance}</span>
              </div>

              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Bill Date</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Boxes Taken</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Empty Boxes</th>
                      <th className="px-3 py-2 text-right text-xs uppercase font-bold border-b">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                        <td className="px-3 py-2 font-mono font-bold border-b">{row.billDate}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold border-b">{row.boxesTaken}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold border-b">{row.emptyBoxes}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-primary border-b">{row.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator className="my-4" />
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-muted-foreground">Total Boxes Taken</span>
                  <span className="font-mono text-lg font-bold">{data.totalTaken}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-muted-foreground">Total Empty Boxes</span>
                  <span className="font-mono text-lg font-bold">{data.totalEmpty}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2 mt-1">
                  <span className="text-base font-bold">Final Box Balance</span>
                  <span className="font-mono text-xl font-bold text-primary">{data.finalBalance}</span>
                </div>
              </div>
            </>
          ) : null}

          <div className="mt-8 text-xs italic text-muted-foreground print:text-black">Developed By MC &amp; SONS</div>
        </div>

        {/* Bottom Share + Print */}
        <div className="print:hidden flex justify-end gap-3 mt-4">
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
          <Button size="lg" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Hidden pdf-area for html2canvas capture */}
      {pdfArea}

      <style>{`
        @media print {
          * { color: #000 !important; -webkit-print-color-adjust: exact; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          #print-area { margin: 0 !important; border: none !important; border-radius: 0 !important; }
          .print\\:hidden { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}

export default function BoxReportPrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
      <BoxReportPrintContent />
    </Suspense>
  );
}
