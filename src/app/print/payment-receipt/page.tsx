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
}

function PrintPaymentReceiptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paper = searchParams.get('paper') || 'thermal';
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [printedDate, setPrintedDate] = useState<Date>(new Date());
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

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
  //  Share PDF handler — same flow as the main bill print page:
  //  capture the hidden inline-styled #pdf-area, navigator.share()
  //  on mobile, download + wa.me fallback on desktop.
  // ─────────────────────────────────────────────────────────────
  const handleSharePDF = useCallback(async () => {
    const captureEl = document.getElementById('pdf-area');
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

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = pageWidth * (canvas.height / canvas.width);

      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(imgHeight, pageHeight));

      const pdfBlob = pdf.output('blob');
      const rDate = new Date(printData.receivedDate);
      const receivedDateFormatted = !isNaN(rDate.getTime()) ? format(rDate, 'dd-MM-yyyy') : 'receipt';
      const fileName = `MC_Receipt_${receivedDateFormatted}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const phone = (printData.customer?.phone || '').replace(/\D/g, '');
      const waMessage =
        `*M.C & SONS FISH COMPANY*\n*Payment Receipt PDF*\n\nReceived Date: ${receivedDateFormatted}\nCustomer: ${printData.customer?.name_en || ''}\nReceived: ₹${printData.receivedCash.toFixed(2)}\n\nPlease find the attached PDF receipt.\n\nThank you!`;
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      // ── Mobile: Web Share API (native share sheet → WhatsApp) ──
      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          // Skip canShare() gate — it returns false on many Android browsers.
          await navigator.share({
            title: `Receipt Date: ${receivedDateFormatted} - M.C & SONS`,
            text: `Payment Receipt (${receivedDateFormatted}) from M.C & SONS FISH COMPANY`,
            files: [file],
          });
          sharedViaWebShare = true;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return; // user dismissed the sheet
          console.warn('Web Share API failed, using fallback:', shareErr);
        }
      }

      // ── Desktop / fallback: download PDF + open WhatsApp ──
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
    finalBalance
  } = printData;

  const bDate = new Date(receivedDate);
  const isValidDate = !isNaN(bDate.getTime());

  // Hidden receipt rendered with INLINE STYLES for html2canvas (print media
  // queries are invisible to it). Mirrors the printed receipt structure.
  const cell: React.CSSProperties = { padding: '5px 6px', border: '1px solid #ccc', fontSize: '12px' };
  const hiddenPdf = (
    <div
      id="pdf-area"
      style={{
        position: 'fixed', left: '-9999px', top: 0, width: '480px',
        background: '#fff', color: '#000', fontFamily: 'Arial, sans-serif',
        fontSize: '12px', boxSizing: 'border-box', padding: '16px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '2px solid #333', paddingBottom: '6px' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '0.3px' }}>M.C &amp; SONS FISH COMPANY</div>
        <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>No. 1, Fish Market, Palladam Road, Tiruppur - 641604</div>
        <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>📞 9894089889, 9597833277</div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 8px' }}>Received Amount</div>

      {/* Customer Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '6px 0', fontSize: '11px' }}>
        <div>
          <div style={{ fontWeight: 600 }}>Cust Name:</div>
          <div style={{ fontWeight: 700, fontSize: '12px', marginTop: '2px' }}>
            {customer?.name_ta && customer.name_ta !== '--' ? customer.name_ta : (customer?.name_en || '-')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600 }}>Date:</div>
          <div style={{ fontWeight: 700, marginTop: '2px' }}>{format(printedDate, 'dd-MM-yyyy')}</div>
        </div>
      </div>

      <div style={{ borderTop: '1.5px solid #444', margin: '5px 0 8px' }} />

      {/* Received table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ ...cell, width: '50%', textAlign: 'left', fontWeight: 'bold' }}>Received Date</th>
            <th style={{ ...cell, width: '50%', textAlign: 'right', fontWeight: 'bold' }}>Received Cash</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cell, fontWeight: 600 }}>{isValidDate ? format(bDate, 'dd-MM-yyyy') : '-'}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{receivedCash > 0 ? receivedCash.toFixed(2) : '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Summary */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
        <tbody>
          {[
            { label: 'Prev Balance', value: prevBalance.toFixed(2) },
            { label: 'Cash Received (-)', value: receivedCash.toFixed(2) },
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
            <td style={{ padding: '6px 6px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '13px' }}>₹{finalBalance.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '12px', fontSize: '9px', fontStyle: 'italic', color: '#1a6db5' }}>Developed by MC &amp; SONS</div>
    </div>
  );

  return (
    <div>
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
        {hiddenPdf}
        <div className={`print-root ${paper}`}>
          <div id="print-area">
            <header className="text-center">
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
        <style jsx global>{`
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
