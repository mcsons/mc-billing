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
import { Customer } from '@/lib/data';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface PrintData {
    customer?: Customer;
    receivedDate: string;
    receivedCash: number;
    prevBalance: number;
    finalBalance: number;
    paymentMode?: string;
}

function PrintPaymentReceiptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paper = searchParams.get('paper') || 'thermal';
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [printedDate, setPrintedDate] = useState<Date>(new Date());
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  /** Opened via a "Share" button: show the share banner (sharing still needs a tap). */
  const autoShare = searchParams.get('share') === 'pdf';

  useEffect(() => {
    const stored = sessionStorage.getItem('paymentReceiptData');
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        setPrintData(parsedData);
      } catch (error) {
        console.error('Failed to parse print data:', error);
        router.push('/dashboard/payments');
      }
    } else {
      router.push('/dashboard/payments');
    }
    return () => {
      sessionStorage.removeItem('paymentReceiptData');
    };
  }, [router]);

  // ─────────────────────────────────────────────────────────────
  //  Share PDF — same flow as the bill print page: capture the hidden,
  //  inline-styled receipt (#pdf-area-receipt), build a PDF, then
  //  navigator.share() on mobile, or download + open WhatsApp on desktop.
  //  Shares the PDF file only, no caption text.
  // ─────────────────────────────────────────────────────────────
  const handleSharePDF = useCallback(async () => {
    const captureEl = document.getElementById('pdf-area-receipt');
    if (!captureEl || !printData) return;

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

      // Receipt-sized page (100 mm wide), height follows the content.
      const pageW = 100;
      const pageH = pageW * (canvas.height / canvas.width);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, pageH], compress: true });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);

      const pdfBlob = pdf.output('blob');
      const d = new Date(printData.receivedDate);
      const dateStr = !isNaN(d.getTime()) ? format(d, 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy');
      const fileName = `MC_Received_${dateStr}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const phone = (printData.customer?.phone || '').replace(/\D/g, '');
      const waUrl = phone ? `https://wa.me/${phone}` : 'https://wa.me/';

      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ files: [file] });
          sharedViaWebShare = true;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return; // user closed the share sheet
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
  }, [printData]);

  if (!printData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading print data...</p>
      </div>
    );
  }

  const {
    customer,
    receivedDate,
    receivedCash,
    prevBalance,
    finalBalance,
    paymentMode,
  } = printData;

  const bDate = new Date(receivedDate);
  const isValidDate = !isNaN(bDate.getTime());

  return (
    <div>
        {/* ── Green share banner (opened via a Share button) ── */}
        {autoShare && (
          <div className="print:hidden bg-green-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Share2 className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-semibold text-sm leading-tight">Your receipt is ready to share!</p>
                <p className="text-xs text-green-100 leading-tight mt-0.5">
                  Tap the button to send this receipt as a PDF via WhatsApp.
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
        <div className={`print-root ${paper}`}>
          <div id="print-area">
            <header className="text-center">
              {paper === 'thermal' && <img src="/bill-logo.png" alt="M.C & Sons logo" className="bill-logo" />}
              <h1 className="header-title">M.C & SONS FISH COMPANY</h1>
              <p className="header-sub">
                No. 1, Fish Market, Palladam Road,
                <span className="city">Tiruppur - 641604</span>
              </p>
              <p className="header-sub header-phone">📞 9894089889, 9597833277</p>
            </header>
            <div className="hr-line"></div>
            <h2 className="text-lg font-semibold my-1 text-center">Received Amount</h2>

            <div className="grid grid-cols-2 gap-4 mb-2 text-sm">
                <div>
                    <p className="font-semibold">Cust Name:</p>
                    <p className="cust-name">{customer?.name_ta || '-'}</p>
                </div>
                <div className="text-right">
                     <p className="bill-date">
                         <span className="font-semibold block">Date:</span> 
                         <strong>{format(printedDate, 'dd-MM-yyyy')}</strong>
                     </p>
                </div>
            </div>

            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableCell colSpan={2} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="col-date">Received Date</TableHead>
                  <TableHead className="col-received text-right">Received Cash</TableHead>
                </TableRow>
                 <TableRow>
                  <TableCell colSpan={2} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                 <TableRow>
                    <TableCell className="col-date">{isValidDate ? format(bDate, 'dd-MM-yy') : '-'}</TableCell>
                    <TableCell className="col-received text-right">
                        {receivedCash > 0 ? receivedCash.toFixed(2) : '-'}
                    </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            <div className="flex justify-end mt-2">
                 <div className="w-full max-w-[300px] totals-section">
                    <table className="summary-table">
                        <tbody>
                            <tr>
                                <td className="summary-label">Prev Balance</td>
                                <td className="summary-colon">:</td>
                                <td className="summary-value font-mono">₹{prevBalance.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td className="summary-label">Cash Received (-)</td>
                                <td className="summary-colon">:</td>
                                <td className="summary-value font-mono">₹{receivedCash.toFixed(2)}</td>
                            </tr>
                            <tr className="summary-divider-row summary-final-balance">
                                <td className="summary-label">Final Balance</td>
                                <td className="summary-colon">:</td>
                                <td className="summary-value font-mono">₹{finalBalance.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <footer className="print-footer">Developed by MC & SONS</footer>
          </div>
        </div>

        {/* ── Hidden receipt for Share PDF (inline styles — html2canvas compatible) ── */}
        <div
          id="pdf-area-receipt"
          aria-hidden="true"
          style={{
            position: 'fixed', left: '-9999px', top: 0, width: '420px', padding: '20px',
            background: '#ffffff', color: '#000000', fontFamily: "Arial, 'Nirmala UI', Latha, 'Noto Sans Tamil', sans-serif",
            fontSize: '14px', fontWeight: 700, boxSizing: 'border-box',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <img src="/bill-logo.png" alt="" style={{ width: '110px', height: 'auto', display: 'block', margin: '0 auto 6px' }} />
            <div style={{ fontSize: '19px', fontWeight: 700 }}>M.C &amp; SONS FISH COMPANY</div>
            <div style={{ fontSize: '13px', marginTop: '2px' }}>No. 1, Fish Market, Palladam Road,</div>
            <div style={{ fontSize: '13px' }}>Tiruppur - 641604</div>
            <div style={{ fontSize: '13px', marginTop: '2px' }}>9894089889, 9597833277</div>
          </div>
          <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '16px', margin: '2px 0 8px' }}>Received Amount</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
            <div>Cust Name: {customer?.name_ta || customer?.name_en || '-'}</div>
            <div>Date: {format(printedDate, 'dd-MM-yyyy')}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Received Date</th>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Mode</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Received</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0' }}>{isValidDate ? format(bDate, 'dd-MM-yy') : '-'}</td>
                <td style={{ padding: '4px 0' }}>{paymentMode || 'Cash'}</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>₹{receivedCash.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ borderTop: '1px solid #000', margin: '6px 0 8px' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
            <tbody>
              <tr><td style={{ padding: '2px 0' }}>Prev Balance</td><td style={{ width: '16px' }}>:</td><td style={{ textAlign: 'right' }}>₹{prevBalance.toFixed(2)}</td></tr>
              <tr><td style={{ padding: '2px 0' }}>Received (-)</td><td>:</td><td style={{ textAlign: 'right' }}>₹{receivedCash.toFixed(2)}</td></tr>
              <tr style={{ borderTop: '1px solid #000' }}>
                <td style={{ padding: '4px 0', fontSize: '16px' }}>Final Balance</td><td>:</td>
                <td style={{ textAlign: 'right', fontSize: '17px' }}>₹{finalBalance.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: '14px', fontSize: '10px', fontStyle: 'italic' }}>Developed by MC &amp; SONS</div>
        </div>
        <style jsx global>{`
        /* Logo on the 4-inch thermal print (same image and size as the 4-inch bill). */
        .print-root.thermal .bill-logo { display: block; width: 29mm; height: auto; margin: 0 auto 1.5mm; }
        /* ===============================
          SCREEN PREVIEW STYLES
        ================================ */
        @media screen {
            #print-area {
                background: white;
                color: black;
                margin: 2rem auto;
            }

            .print-root.thermal #print-area {
                width: 106mm;
            }
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
            -webkit-font-smoothing: none;
            font-smoothing: none;
            text-rendering: optimizeSpeed;
          }
          body {
            margin: 0;
            padding: 0;
            background: white !important;
            print-color-adjust: exact;
          }
          
          #print-area {
              margin: 0;
              padding: 0;
          }

          .print\\:hidden {
            display: none !important;
          }
        }

        /* ===============================
          THERMAL (106mm)
        ================================ */
        @media print {
          .print-root.thermal #print-area {
            padding: 2mm 4mm 18mm 4mm;
          }
          .print-root.thermal {
            width: 106mm;
            max-width: 106mm;
            margin: 0 auto;
            font-family: 'Courier New', 'Lucida Console', monospace !important;
          }

          h2.text-lg {
             font-size: 16px !important;
             line-height: 1.4;
             font-weight: 700;
          }

          .header-title {
            font-size: 22px !important;
            font-weight: 700;
            letter-spacing: 0.5px;
            line-height: 1.2;
            white-space: nowrap;
          }
          .header-sub {
            display: block;
            text-align: center;
            font-size: 13px !important;
            font-weight: 700;
            line-height: 1.3;
            margin-top: 2px;
          }
          .header-sub .city {
            display: block;
          }
          .header-phone {
            margin-top: 4px;
          }
          .hr-line {
            border-top: 2px solid #000;
            margin: 6px 0;
          }
          .table-header-line {
            border-top: 2px solid #000;
            margin: 0;
          }

          .cust-name {
            font-weight: 700;
            font-size: 15px;
          }

          .bill-no > strong,
          .bill-date > strong {
            font-weight: 700;
          }
          
          .text-lg {
             font-size: 16px !important;
             line-height: 1.4;
             font-weight: 700;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .print-table tr,
          .print-table th,
          .print-table td {
            border: none;
          }

          .print-table thead th {
            font-weight: 800 !important;
            font-size: 13px !important;
            padding: 2px 4px;
            color: #000;
            vertical-align: middle;
          }

          .print-table tbody td {
            font-weight: 700 !important;
            font-size: 13px;
            padding: 2px 4px;
            vertical-align: top;
          }
          
          .col-date { width: 50%; text-align: left; }
          .col-received { width: 50%; text-align: right; }

          .summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 15px;
            font-weight: 700;
          }
          .summary-table td {
            padding: 1px 4px;
          }
          .summary-label {
            text-align: left;
            white-space: nowrap;
          }
          .summary-colon {
            width: 10px;
            text-align: center;
          }
          .summary-value {
            text-align: right;
            white-space: nowrap;
          }
          .summary-divider-row td {
            border-top: 2px solid black;
            padding-top: 4px;
            margin-top: 2px;
          }

          .summary-final-balance td {
            font-size: 16px;
            font-weight: 800;
          }

          .print-footer {
            margin-top: 18px;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            font-style: italic;
          }
        }

        /* ===============================
          A4 PRINT
        ================================ */
        @media print {
          .print-root.a4 #print-area {
            padding: 15mm;
          }
          .print-root.a4 {
            width: 210mm;
            margin: 0 auto;
            font-family: Arial, sans-serif;
            font-size: 12px;
          }

          .print-root.a4 .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
          }

          .print-root.a4 .print-table th,
          .print-root.a4 .print-table td {
            padding: 5px;
            border-bottom: 1px solid #eee;
          }
           .print-root.a4 .print-table th {
             font-weight: bold;
             text-align: left;
           }

          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}


export default function PrintPaymentReceiptPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
        <PrintPaymentReceiptContent />
      </Suspense>
    );
  }
