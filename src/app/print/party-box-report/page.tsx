'use client';

import React, { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X, Printer, Share2, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateWiseRow {
  id: string;       // partyId
  name: string;     // partyName
  boxesTaken: number;
  emptyBoxes: number;
  balance: number;
}

interface PartyRow {
  billId?: string;
  billDate: string;
  boxesTaken: number;
  emptyBoxes: number;
  balance: number;
}

interface CurrentBalanceRow {
  partyId: string;
  partyName: string;
  openingBalance: number;
  currentBalance: number;
  lastBillDate: string;
}

type PrintData =
  | {
      type: 'datewise';
      entityLabel: string; // 'Party'
      date: string;
      rows: DateWiseRow[];
      totalTaken: number;
      totalEmpty: number;
    }
  | {
      type: 'party';
      entityLabel: string; // 'Party'
      partyName: string;
      fromDate: string;
      toDate: string;
      openingBalance: number;
      rows: PartyRow[];
      totalTaken: number;
      totalEmpty: number;
      finalBalance: number;
    }
  | {
      type: 'currentbalance';
      entityLabel: string; // 'Party'
      generatedDate: string;
      rows: CurrentBalanceRow[];
      sumOpening: number;
      sumCurrent: number;
    };

// ─── PDF page geometry ────────────────────────────────────────────────────────
// Readability on a phone comes down to one ratio: text height divided by page
// width. A viewer fits the page to the screen, so 14px text on a 480px-wide
// capture always lands at the same apparent size no matter how tall the page
// is. That is why each PDF page is given a CUSTOM height matching its own
// content instead of being squeezed into a fixed A4 box — that squeeze is what
// shrank the text and forced pinch-zooming (and cropped the last column).
const PDF_PAGE_WIDTH_PX = 480;
const PDF_PAGE_WIDTH_MM = 210; // page width; the capture fills it exactly
const PDF_PAGE_PADDING_PX = 20;

// Rows per printed page. Pages grow to fit their rows, so these only control
// how much lands on each sheet — no row can overflow or be clipped.
const ROWS_PER_PAGE_WIDE = 12;   // datewise / currentbalance (5 columns)
const ROWS_PER_PAGE_NARROW = 16; // party (4 columns, no wrapping names)
// Row slots reserved on the final page for the TOTAL row and summary block.
const LAST_PAGE_RESERVE = 3;

// ─── Main Content ─────────────────────────────────────────────────────────────

function PartyBoxReportPrintContent() {
  const router = useRouter();
  const [data, setData] = useState<PrintData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // The PDF is built up front and cached here. Building it on click took long
  // enough (several pages of html2canvas) that the browser dropped the tap's
  // "transient user activation", so navigator.share() was rejected and we fell
  // through to the download path. With the blob already in hand the share call
  // happens synchronously inside the tap and the native sheet opens.
  const pdfCacheRef = useRef<{ blob: Blob; fileName: string; waMessage: string } | null>(null);
  const [isPdfReady, setIsPdfReady] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('partyBoxReportPrintData');
    if (raw) {
      try {
        setData(JSON.parse(raw));
        return;
      } catch (err) {
        console.error('Failed to parse party box report data', err);
      }
    }
    router.push('/dashboard/party-box-reports');
  }, [router]);

  // ── Share PDF ─────────────────────────────────────────────────────────────
  // Each [data-pdf-page] element is captured separately and becomes one A4
  // page in the output, so a 50-party report simply runs onto as many pages as
  // it needs instead of being squeezed onto one.
  // ── Build the PDF (runs in the background, not on the share tap) ──────────
  const buildPdf = useCallback(async () => {
    const pageEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-pdf-page]')
    );
    if (!pageEls.length || !data) return null;
    {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jsPDFModule;

      let pdf: any = null;

      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i];
        // Capture the element's FULL scroll box. Capturing only its 480px
        // border box meant any cell that overflowed (a long name, a date set
        // to nowrap) was silently sliced off the right edge of the page.
        const canvas = await html2canvas(el, {
          scale: 3, // higher raster density so pinch-zoom stays sharp
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: el.scrollWidth,
          height: el.scrollHeight,
          windowWidth: el.scrollWidth,
          windowHeight: el.scrollHeight,
        });

        // PNG, not JPEG — lossless, so small text and hairline table borders
        // stay crisp instead of picking up compression fringing.
        const imgData = canvas.toDataURL('image/png');

        // Give this page its own height so the capture fills it exactly:
        // no letterboxing, no shrink-to-fit, no cropping.
        const pageHeightMm = PDF_PAGE_WIDTH_MM * (canvas.height / canvas.width);

        if (!pdf) {
          pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [PDF_PAGE_WIDTH_MM, pageHeightMm],
            // REQUIRED. canvas.toDataURL('image/png') always produces an RGBA
            // image, and jsPDF writes that alpha channel into the file as an
            // uncompressed stream unless compression is on — which is what
            // made a 5-page report ~44MB. With this flag the same pixels are
            // Flate-compressed to a few hundred KB. The output is byte-for-byte
            // identical on screen: this is lossless, not a quality reduction.
            compress: true,
          });
        } else {
          pdf.addPage([PDF_PAGE_WIDTH_MM, pageHeightMm], 'portrait');
        }
        pdf.addImage(imgData, 'PNG', 0, 0, PDF_PAGE_WIDTH_MM, pageHeightMm);
      }

      if (!pdf) return null;

      const pdfBlob = pdf.output('blob');

      let fileName: string;
      let waMessage: string;

      if (data.type === 'datewise') {
        fileName = `MC_PartyBoxReport_${data.date}.pdf`;
        waMessage = `*M.C & SONS FISH COMPANY*\n*Party Box Bill Report – Date-wise*\n\nDate: ${data.date}\nTotal Boxes Taken: ${data.totalTaken}\nTotal Empty Boxes: ${data.totalEmpty}\n\nThank you!`;
      } else if (data.type === 'party') {
        fileName = `MC_PartyBoxReport_${data.partyName.replace(/[^a-zA-Z0-9]/g, '_')}_${data.fromDate}_${data.toDate}.pdf`;
        waMessage = `*M.C & SONS FISH COMPANY*\n*Party Box Bill Report*\n\nParty: ${data.partyName}\nPeriod: ${data.fromDate} – ${data.toDate}\nOpening Balance: ${data.openingBalance}\nTotal Boxes Taken: ${data.totalTaken}\nTotal Empty Boxes: ${data.totalEmpty}\nFinal Box Balance: ${data.finalBalance}\n\nThank you!`;
      } else {
        // currentbalance
        fileName = `MC_PartyBoxBalance_${data.generatedDate}.pdf`;
        waMessage = `*M.C & SONS FISH COMPANY*\n*Party Box Balance Report*\n\nAs of: ${data.generatedDate}\nTotal Parties: ${data.rows.length}\nSum Opening Balance: ${data.sumOpening}\nSum Current Balance: ${data.sumCurrent}\n\nThank you!`;
      }

      return { blob: pdfBlob, fileName, waMessage };
    }
  }, [data]);

  // Prepare the PDF as soon as the report data is on screen, so the Share
  // button is instant when tapped.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setIsPdfReady(false);
    pdfCacheRef.current = null;
    // Give the off-screen pages one frame to lay out before capturing.
    const timer = setTimeout(() => {
      buildPdf()
        .then((result) => {
          if (cancelled || !result) return;
          pdfCacheRef.current = result;
          setIsPdfReady(true);
        })
        .catch((err) => {
          console.error('PDF preparation failed:', err);
          if (!cancelled) setShareError('Could not prepare the PDF. Please try printing instead.');
        });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [data, buildPdf]);

  // ── Share PDF ─────────────────────────────────────────────────────────────
  // No await runs before navigator.share(), so the tap's user activation is
  // still valid and the native share sheet opens.
  const handleSharePDF = useCallback(async () => {
    const cached = pdfCacheRef.current;
    if (!cached) return;

    const file = new File([cached.blob], cached.fileName, { type: 'application/pdf' });
    const canShareFiles =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));

    if (canShareFiles) {
      setIsSharing(true);
      try {
        await navigator.share({ title: 'MC Party Box Report', text: cached.waMessage, files: [file] });
        return;
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') return;
        console.warn('Web Share API failed, using fallback:', shareErr);
      } finally {
        setIsSharing(false);
      }
    }

    // Fallback: this browser cannot share files (desktop Chrome, Firefox, …)
    const waUrl = `https://wa.me/?text=${encodeURIComponent(cached.waMessage)}`;
    const url = URL.createObjectURL(cached.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cached.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { URL.revokeObjectURL(url); window.open(waUrl, '_blank'); }, 400);
    setShareError('PDF downloaded! Attach it to the WhatsApp chat that just opened.');
  }, []);

  if (!data) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  // ── Shared inline style helpers ───────────────────────────────────────────
  const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 6px',
    border: '1px solid #ddd',
    fontFamily: 'monospace',
    // Nothing may ever exceed its column — overflow is what pushed the last
    // column off the edge of the sheet.
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    ...extra,
  });
  const thStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 6px',
    border: '1px solid #333',
    fontSize: '11px',
    textTransform: 'uppercase',
    backgroundColor: '#f3f4f6',
    ...extra,
  });

  // ── Split rows into printed pages ─────────────────────────────────────────
  const rowsPerPage = data.type === 'party' ? ROWS_PER_PAGE_NARROW : ROWS_PER_PAGE_WIDE;
  const allRows = data.rows as any[];
  const rowChunks: any[][] = [];
  {
    let i = 0;
    while (i < allRows.length) {
      const remaining = allRows.length - i;
      // The final page also carries the TOTAL row and the summary block, so it
      // holds fewer rows. If the tail would not fit alongside them, split the
      // remainder across two pages instead of overflowing.
      if (remaining <= rowsPerPage - LAST_PAGE_RESERVE) {
        rowChunks.push(allRows.slice(i));
        break;
      }
      const take = remaining <= rowsPerPage ? Math.ceil(remaining / 2) : rowsPerPage;
      rowChunks.push(allRows.slice(i, i + take));
      i += take;
    }
  }
  if (rowChunks.length === 0) rowChunks.push([]);
  const totalPages = rowChunks.length;
  // Starting row index of each page (chunk sizes can vary on the last split).
  const chunkOffsets: number[] = [];
  rowChunks.reduce((acc, c) => { chunkOffsets.push(acc); return acc + c.length; }, 0);

  // ── Per-page chrome ───────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    width: `${PDF_PAGE_WIDTH_PX}px`,
    // No fixed height: the sheet grows to fit its rows and the PDF page is cut
    // to match, so a wrapped party name can never be pushed off the sheet.
    background: '#fff',
    color: '#000',
    fontFamily: '"Calibri", "Arial", sans-serif',
    fontSize: '14px',
    boxSizing: 'border-box',
    padding: `${PDF_PAGE_PADDING_PX}px`,
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '16px',
  };

  const companyHeader = (
    <div style={{ textAlign: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '2px solid #000' }}>
      <div style={{ fontSize: '23px', fontWeight: 'bold', color: '#1E40AF', marginBottom: '4px' }}>
        M.C &amp; SONS FISH COMPANY
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700 }}>PARTY BOX BILL REPORT</div>
    </div>
  );

  const pageFooter = (pageIdx: number) => (
    <div
      style={{
        marginTop: '16px',
        paddingTop: '10px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        fontSize: '11px',
        fontStyle: 'italic',
        fontWeight: 700,
      }}
    >
      <span>Developed By MC &amp; SONS</span>
      <span style={{ fontStyle: 'normal', fontWeight: 400, color: '#555' }}>
        Page {pageIdx + 1} of {totalPages}
      </span>
    </div>
  );

  // ── Hidden A4 PDF capture area (one child element per printed page) ───────
  const pdfArea = (
    <div
      id="pdf-area"
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: '-99999px',
        top: 0,
        width: `${PDF_PAGE_WIDTH_PX}px`,
        background: '#fff',
      }}
    >
      {rowChunks.map((chunk, pageIdx) => {
        const isLastPage = pageIdx === totalPages - 1;
        const offset = chunkOffsets[pageIdx];

        return (
          <div key={pageIdx} data-pdf-page={pageIdx} style={pageStyle}>
            {companyHeader}

            {data.type === 'datewise' ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700 }}>Date-wise Party Box Report</div>
                  <div style={{ fontSize: '14px', color: '#444', marginTop: '2px' }}>Date: {data.date}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={thStyle({ textAlign: 'left', width: '11%' })}>Party ID</th>
                      <th style={thStyle({ textAlign: 'left', width: '41%' })}>Party Name</th>
                      <th style={thStyle({ textAlign: 'center', width: '16%' })}>Boxes Taken</th>
                      <th style={thStyle({ textAlign: 'center', width: '16%' })}>Empty Boxes</th>
                      <th style={thStyle({ textAlign: 'right', width: '16%' })}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(chunk as DateWiseRow[]).map((row, i) => (
                      <tr key={offset + i} style={{ backgroundColor: (offset + i) % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={cellStyle()}>{row.id}</td>
                        <td style={cellStyle({ fontSize: '12px' })}>{row.name}</td>
                        <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.boxesTaken}</td>
                        <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.emptyBoxes}</td>
                        <td style={cellStyle({ textAlign: 'right', fontWeight: 700 })}>{row.balance}</td>
                      </tr>
                    ))}
                    {isLastPage && (
                      <tr style={{ borderTop: '2px solid #333', backgroundColor: '#f3f4f6' }}>
                        <td colSpan={2} style={{ padding: '6px 6px', fontWeight: 700, textAlign: 'right', border: '1px solid #333' }}>TOTAL</td>
                        <td style={{ padding: '6px 6px', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', border: '1px solid #333' }}>{data.totalTaken}</td>
                        <td style={{ padding: '6px 6px', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', border: '1px solid #333' }}>{data.totalEmpty}</td>
                        <td style={{ padding: '6px 6px', border: '1px solid #333' }}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {isLastPage && (
                  <div style={{ marginTop: '12px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Total Boxes Taken</span><strong>{data.totalTaken}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Empty Boxes</span><strong>{data.totalEmpty}</strong>
                    </div>
                  </div>
                )}
              </>
            ) : data.type === 'party' ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700 }}>Party Box Report</div>
                  <div style={{ fontSize: '14px', color: '#444', marginTop: '2px' }}>{data.partyName}</div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{data.fromDate} — {data.toDate}</div>
                </div>
                {pageIdx === 0 && (
                  <div style={{ marginBottom: '10px', padding: '6px 10px', backgroundColor: '#f3f4f6', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', border: '1px solid #e5e7eb' }}>
                    <span>Opening Balance</span><strong>{data.openingBalance}</strong>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={thStyle({ textAlign: 'left', width: '31%' })}>Bill Date</th>
                      <th style={thStyle({ textAlign: 'center', width: '23%' })}>Boxes Taken</th>
                      <th style={thStyle({ textAlign: 'center', width: '23%' })}>Empty Boxes</th>
                      <th style={thStyle({ textAlign: 'right', width: '23%' })}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(chunk as PartyRow[]).map((row, i) => (
                      <tr key={offset + i} style={{ backgroundColor: (offset + i) % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={cellStyle()}>{row.billDate}</td>
                        <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.boxesTaken}</td>
                        <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.emptyBoxes}</td>
                        <td style={cellStyle({ textAlign: 'right', fontWeight: 700 })}>{row.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {isLastPage && (
                  <div style={{ marginTop: '12px', fontSize: '14px', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Total Boxes Taken</span><strong>{data.totalTaken}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Total Empty Boxes</span><strong>{data.totalEmpty}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #333', paddingTop: '6px', marginTop: '6px' }}>
                      <strong>Final Box Balance</strong><strong style={{ fontSize: '16px' }}>{data.finalBalance}</strong>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* currentbalance */
              <>
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700 }}>Party Box Balance Report</div>
                  <div style={{ fontSize: '14px', color: '#444', marginTop: '2px' }}>As of: {data.generatedDate}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={thStyle({ textAlign: 'left', width: '10%' })}>Party ID</th>
                      <th style={thStyle({ textAlign: 'left', width: '41%' })}>Party Name</th>
                      <th style={thStyle({ textAlign: 'center', width: '13%' })}>Opening Bal</th>
                      <th style={thStyle({ textAlign: 'center', width: '13%' })}>Current Bal</th>
                      <th style={thStyle({ textAlign: 'right', width: '23%' })}>Last Bill Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(chunk as CurrentBalanceRow[]).map((row, i) => (
                      <tr key={offset + i} style={{ backgroundColor: (offset + i) % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={cellStyle()}>{row.partyId}</td>
                        <td style={cellStyle({ fontSize: '12px' })}>{row.partyName}</td>
                        <td style={cellStyle({ textAlign: 'center' })}>{row.openingBalance}</td>
                        <td style={cellStyle({ textAlign: 'center', fontWeight: 700 })}>{row.currentBalance}</td>
                        <td style={cellStyle({ textAlign: 'right', fontSize: '12px' })}>{row.lastBillDate}</td>
                      </tr>
                    ))}
                    {isLastPage && (
                      <tr style={{ borderTop: '2px solid #333', backgroundColor: '#f3f4f6' }}>
                        <td colSpan={2} style={{ padding: '6px 6px', fontWeight: 700, textAlign: 'right', border: '1px solid #333' }}>TOTAL</td>
                        <td style={{ padding: '6px 6px', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', border: '1px solid #333' }}>{data.sumOpening}</td>
                        <td style={{ padding: '6px 6px', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', border: '1px solid #333' }}>{data.sumCurrent}</td>
                        <td style={{ padding: '6px 6px', border: '1px solid #333' }}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {isLastPage && (
                  <div style={{ marginTop: '12px', fontSize: '14px', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Total Parties</span><strong>{data.rows.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Sum Opening Balance</span><strong>{data.sumOpening}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #333', paddingTop: '6px', marginTop: '6px' }}>
                      <strong>Sum Current Balance</strong><strong style={{ fontSize: '16px' }}>{data.sumCurrent}</strong>
                    </div>
                  </div>
                )}
              </>
            )}

            {pageFooter(pageIdx)}
          </div>
        );
      })}
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
            disabled={isSharing || !isPdfReady}
            style={{ borderColor: '#16a34a', color: '#4ade80', backgroundColor: 'transparent' }}
            className="hover:bg-green-950"
          >
            {isSharing || !isPdfReady
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
            <div className="text-xs font-bold mt-1 text-muted-foreground">PARTY BOX BILL REPORT</div>
          </div>

          {data.type === 'datewise' ? (
            <>
              <div className="text-center mb-4">
                <div className="text-base font-bold">Date-wise Party Box Report</div>
                <div className="text-sm text-muted-foreground mt-1">Date: {data.date}</div>
              </div>

              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Party ID</th>
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Party Name</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Boxes Taken</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Empty Boxes</th>
                      <th className="px-3 py-2 text-right text-xs uppercase font-bold border-b">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                        <td className="px-3 py-2 font-mono text-xs border-b">{row.id}</td>
                        <td className="px-3 py-2 border-b whitespace-normal break-words">{row.name}</td>
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
          ) : data.type === 'party' ? (
            <>
              <div className="text-center mb-4">
                <div className="text-base font-bold">Party Box Report</div>
                <div className="text-sm text-muted-foreground mt-1">{data.partyName}</div>
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
                <div className="text-base font-bold">Party Box Balance Report</div>
                <div className="text-sm text-muted-foreground mt-1">As of: {data.generatedDate}</div>
              </div>

              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Party ID</th>
                      <th className="px-3 py-2 text-left text-xs uppercase font-bold border-b">Party Name</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Opening Bal</th>
                      <th className="px-3 py-2 text-center text-xs uppercase font-bold border-b">Current Bal</th>
                      <th className="px-3 py-2 text-right text-xs uppercase font-bold border-b">Last Bill Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                        <td className="px-3 py-2 font-mono text-xs border-b">{row.partyId}</td>
                        <td className="px-3 py-2 border-b whitespace-normal break-words">{row.partyName}</td>
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
                  <span className="text-base font-semibold text-muted-foreground">Total Parties</span>
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
        <div className="print:hidden flex flex-col gap-3 mt-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleSharePDF}
            disabled={isSharing || !isPdfReady}
            className="w-full min-h-[44px] border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950 sm:w-auto"
          >
            {isSharing || !isPdfReady
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</>
              : <><Share2 className="mr-2 h-4 w-4" /> Share (PDF)</>}
          </Button>
          <Button size="lg" onClick={() => window.print()} className="w-full min-h-[44px] sm:w-auto">
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
          #pdf-area { display: none !important; }
          /* Let long tables flow onto as many sheets as needed, repeating the
             header row and never slicing a row in half. */
          #print-area thead { display: table-header-group; }
          #print-area tr { page-break-inside: avoid; break-inside: avoid; }
          #print-area table { page-break-inside: auto; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}

export default function PartyBoxReportPrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
      <PartyBoxReportPrintContent />
    </Suspense>
  );
}
