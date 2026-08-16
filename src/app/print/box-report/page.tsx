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

interface CurrentBalanceRow {
  customerId: string;
  customerName: string;
  openingBalance: number;
  currentBalance: number;
  lastBillDate: string;
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
    }
  | {
      type: 'currentbalance';
      entityLabel: string; // 'Customer'
      generatedDate: string;
      rows: CurrentBalanceRow[];
      sumOpening: number;
      sumCurrent: number;
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

  // ── Share PDF ─────────────────────────────────────────────────────────────
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

      let fileName: string;
      let waMessage: string;

      if (data.type === 'datewise') {
        fileName = `MC_BoxReport_${data.date}.pdf`;
        waMessage = `*M.C & SONS FISH COMPANY*\n*Box Bill Report – Date-wise*\n\nDate: ${data.date}\nTotal Boxes Taken: ${data.totalTaken}\nTotal Empty Boxes: ${data.totalEmpty}\n\nThank you!`;
      } else if (data.type === 'customer') {
        fileName = `MC_BoxReport_${data.customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${data.fromDate}_${data.toDate}.pdf`;
        waMessage = `*M.C & SONS FISH COMPANY*\n*Box Bill Report – Customer*\n\nCustomer: ${data.customerName}\nPeriod: ${data.fromDate} – ${data.toDate}\nOpening Balance: ${data.openingBalance}\nTotal Boxes Taken: ${data.totalTaken}\nTotal Empty Boxes: ${data.totalEmpty}\nFinal Box Balance: ${data.finalBalance}\n\nThank you!`;
      } else {
        // currentbalance
        fileName = `MC_CustomerBoxBalance_${data.generatedDate}.pdf`;
        waMessage = `*M.C & SONS FISH COMPANY*\n*Customer Box Balance Report*\n\nAs of: ${data.generatedDate}\nTotal Customers: ${data.rows.length}\nSum Opening Balance: ${data.sumOpening}\nSum Current Balance: ${data.sumCurrent}\n\nThank you!`;
      }

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

  // ── Hidden A4 PDF capture area ────────────────────────────────────────────
  const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 8px',
    border: '1px solid #ddd',
    fontFamily: 'monospace',
    ...extra,
  });
  const thStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 8px',
    border: '1px solid #333',
    fontSize: '11px',
    textTransform: 'uppercase',
    backgroundColor: '#f3f4f6',
    ...extra,
  });

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
              <tr>
                <th style={thStyle({ textAlign: 'left' })}>Cust ID</th>
                <th style={thStyle({ textAlign: 'left' })}>Customer Name</th>
                <th style={thStyle({ textAlign: 'center' })}>Boxes Taken</th>
                <th style={thStyle({ textAlign: 'center' })}>Empty Boxes</th>
                <th style={thStyle({ textAlign: 'right' })}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={cellStyle()}>{row.customerId}</td>
                  <td style={cellStyle({ wordBreak: 'break-word' })}>{row.customerName}</td>
                  <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.boxesTaken}</td>
                  <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.emptyBoxes}</td>
                  <td style={cellStyle({ textAlign: 'right', fontWeight: 700 })}>{row.balance}</td>
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
      ) : data.type === 'customer' ? (
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
              <tr>
                <th style={thStyle({ textAlign: 'left' })}>Bill Date</th>
                <th style={thStyle({ textAlign: 'center' })}>Boxes Taken</th>
                <th style={thStyle({ textAlign: 'center' })}>Empty Boxes</th>
                <th style={thStyle({ textAlign: 'right' })}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={cellStyle()}>{row.billDate}</td>
                  <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.boxesTaken}</td>
                  <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.emptyBoxes}</td>
                  <td style={cellStyle({ textAlign: 'right', fontWeight: 700 })}>{row.balance}</td>
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
      ) : (
        /* currentbalance */
        <>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Customer Box Balance Report</div>
            <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>As of: {data.generatedDate}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333' }}>
            <thead>
              <tr>
                <th style={thStyle({ textAlign: 'left' })}>Cust ID</th>
                <th style={thStyle({ textAlign: 'left' })}>Customer Name</th>
                <th style={thStyle({ textAlign: 'center' })}>Opening Bal</th>
                <th style={thStyle({ textAlign: 'center' })}>Current Bal</th>
                <th style={thStyle({ textAlign: 'right' })}>Last Bill Date</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={cellStyle()}>{row.customerId}</td>
                  <td style={cellStyle({ wordBreak: 'break-word' })}>{row.customerName}</td>
                  <td style={cellStyle({ textAlign: 'center' })}>{row.openingBalance}</td>
                  <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.currentBalance}</td>
                  <td style={cellStyle({ textAlign: 'right', fontSize: '11px' })}>{row.lastBillDate}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #333', backgroundColor: '#f3f4f6' }}>
                <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right', border: '1px solid #333' }}>TOTAL</td>
                <td style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', border: '1px solid #333' }}>{data.sumOpening}</td>
                <td style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', border: '1px solid #333' }}>{data.sumCurrent}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #333' }}></td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: '12px', fontSize: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Total Customers</span><strong>{data.rows.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Sum Opening Balance</span><strong>{data.sumOpening}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #333', paddingTop: '6px', marginTop: '6px' }}>
              <strong>Sum Current Balance</strong><strong style={{ fontSize: '14px' }}>{data.sumCurrent}</strong>
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

  // ── On-screen preview ─────────────────────────────────────────────────────

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

          {data.type === 'datewise' ? (
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
          ) : (
            /* currentbalance */
            <>
              <div className="text-center mb-4">
                <div className="text-base font-bold">Customer Box Balance Report</div>
                <div className="text-sm text-muted-foreground mt-1">As of: {data.generatedDate}</div>
              </div>

              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Cust ID</th>
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Customer Name</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Opening Bal</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Current Bal</th>
                      <th className="px-3 py-2 text-right text-xs uppercase font-bold border-b">Last Bill Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                        <td className="px-3 py-2 font-mono text-xs border-b">{row.customerId}</td>
                        <td className="px-3 py-2 border-b whitespace-normal break-words">{row.customerName}</td>
                        <td className="px-3 py-2 text-center font-mono border-b">{row.openingBalance}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-primary border-b">{row.currentBalance}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs border-b">{row.lastBillDate}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 border-t-2">
                      <td colSpan={2} className="px-3 py-2 font-bold text-right text-sm">TOTAL</td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-sm">{data.sumOpening}</td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-sm text-primary">{data.sumCurrent}</td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Separator className="my-4" />
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-muted-foreground">Total Customers</span>
                  <span className="font-mono text-lg font-bold">{data.rows.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-muted-foreground">Sum Opening Balance</span>
                  <span className="font-mono text-lg font-bold">{data.sumOpening}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2 mt-1">
                  <span className="text-base font-bold">Sum Current Balance</span>
                  <span className="font-mono text-xl font-bold text-primary">{data.sumCurrent}</span>
                </div>
              </div>
            </>
          )}

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
