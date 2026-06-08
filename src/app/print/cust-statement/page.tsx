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
import { Customer, Transaction } from '@/lib/data';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface PrintData {
    customer?: Customer;
    transactions: Transaction[];
    openingBalance: number;
    dateRange: { from?: string, to?: string };
}

function PrintPaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paper = searchParams.get('paper') || 'thermal';
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('paymentsReportData');
    if (stored) {
      try {
        const parsedData = JSON.parse(stored, (key, value) => {
            if ((key === 'from' || key === 'to' || key === 'date') && value) {
                return new Date(value);
            }
            return value;
        });
        setPrintData(parsedData);
      } catch (error) {
        console.error('Failed to parse print data:', error);
        router.push('/dashboard/cust-statement');
      }
    } else {
      router.push('/dashboard/cust-statement');
    }
    return () => {
      sessionStorage.removeItem('paymentsReportData');
    };
  }, [router]);

  if (!printData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading print data...</p>
      </div>
    );
  }

  const {
    customer,
    transactions,
    openingBalance,
    dateRange,
  } = printData;

  const totalBilled = transactions.reduce((sum, t) => sum + (t.billedAmount || 0), 0);
  const totalReceived = transactions.reduce((sum, t) => sum + (t.receivedAmount || 0), 0);

  const prevBalance = openingBalance;
  const nettAmount = prevBalance + totalBilled;
  const finalBalance = nettAmount - totalReceived;

  const formatINR = (value: number) => {
    if (value == null || isNaN(value)) return '0.00';
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // ─────────────────────────────────────────────────────────────
  //  Share PDF: captures hidden #pdf-area-payments A4 div
  // ─────────────────────────────────────────────────────────────
  const handleSharePDF = async () => {
    const captureEl = document.getElementById('pdf-area-payments');
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
      const custName = customer?.name_en || 'Customer';
      const fromStr = dateRange.from ? format(new Date(dateRange.from), 'dd-MM-yyyy') : '';
      const toStr = dateRange.to ? format(new Date(dateRange.to), 'dd-MM-yyyy') : '';
      const fileName = `MC_Statement_${custName}_${fromStr}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const phone = (customer?.phone || '').replace(/\D/g, '');
      const waMessage =
        `*M.C & SONS FISH COMPANY*\n*Customer Statement*\n\nCustomer: ${custName}\nPeriod: ${fromStr} to ${toStr}\n\nPlease find the attached statement PDF.\n\nThank you!`;
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Statement: ${custName} - M.C & SONS`,
            text: `Customer Statement From: ${fromStr}, To: ${toStr} by M.C & SONS FISH COMPANY`,
            files: [file],
          });
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
  };


  return (
    <div>
        {shareError && (
          <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">
            {shareError}
          </div>
        )}
        <div className="p-4 print:hidden flex justify-between items-center">
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
              <h1 className="header-title">M.C & SONS FISH COMPANY</h1>
              <p className="header-sub">
                No. 1, Fish Market, Palladam Road,<br />
                Tiruppur - 641604
              </p>
              <p className="header-sub header-phone">📞 9597833277, 9894089889</p>
            </header>
            <div className="hr-line"></div>
            <h2 className="text-lg font-semibold my-1 text-center">Customer Statement</h2>

            <div className="grid grid-cols-2 gap-4 mb-2 text-sm">
                <div>
                    <p className="font-semibold">Cust Name:</p>
                    <p className="cust-name">{customer?.name_ta || '-'}</p>
                </div>
                <div className="text-right">
                    {dateRange.from && (
                         <p className="bill-date"><span className="font-semibold">From:</span> <strong>{format(new Date(dateRange.from), 'dd-MM-yyyy')}</strong></p>
                    )}
                    {dateRange.to && (
                         <p className="bill-date"><span className="font-semibold">To:</span> <strong>{format(new Date(dateRange.to), 'dd-MM-yyyy')}</strong></p>
                    )}
                </div>
            </div>

            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableCell colSpan={3} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="col-date">Date</TableHead>
                  <TableHead className="col-billed text-right">Billed (₹)</TableHead>
                  <TableHead className="col-received text-right">Received (₹)</TableHead>
                </TableRow>
                 <TableRow>
                  <TableCell colSpan={3} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.map((t, index) => (
                    <TableRow key={index}>
                      <TableCell className="col-date">{format(t.date, 'dd-MM-yyyy')}</TableCell>
                      <TableCell className="col-billed text-right">
                        {t.billedAmount ? t.billedAmount.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="col-received text-right">
                        {t.receivedAmount ? t.receivedAmount.toFixed(2) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4">No transactions</TableCell>
                  </TableRow>
                )}
                 <TableRow>
                  <TableCell colSpan={3} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="col-date font-bold">Total</TableCell>
                    <TableCell className="col-billed text-right font-bold">{totalBilled.toFixed(2)}</TableCell>
                    <TableCell className="col-received text-right font-bold">{totalReceived.toFixed(2)}</TableCell>
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
                                <td className="summary-label">Bill Amount (+)</td>
                                <td className="summary-colon">:</td>
                                <td className="summary-value font-mono">₹{totalBilled.toFixed(2)}</td>
                            </tr>
                            <tr className="summary-divider-row">
                                <td className="summary-label">NETT Amount</td>
                                <td className="summary-colon">:</td>
                                <td className="summary-value font-mono">₹{nettAmount.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td className="summary-label">Received (-)</td>
                                <td className="summary-colon">:</td>
                                <td className="summary-value font-mono">₹{totalReceived.toFixed(2)}</td>
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

        {/* ── Hidden A4 div for PDF capture (inline styles — html2canvas compatible) ── */}
        <div
          id="pdf-area-payments"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '210mm',
            minHeight: '297mm',
            padding: '15mm',
            background: '#fff',
            color: '#000',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '2px solid #333', paddingBottom: '6px' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold' }}>M.C &amp; SONS FISH COMPANY</div>
            <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>No. 1, Fish Market, Palladam Road, Tiruppur - 641604</div>
            <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>📞 9597833277, 9894089889</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '5px' }}>Customer Statement</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
            <div><strong>Customer:</strong> {customer?.name_ta || customer?.name_en || '-'}</div>
            <div style={{ textAlign: 'right' }}>
              {dateRange.from && <div><strong>From:</strong> {format(new Date(dateRange.from), 'dd-MM-yyyy')}</div>}
              {dateRange.to && <div><strong>To:</strong> {format(new Date(dateRange.to), 'dd-MM-yyyy')}</div>}
            </div>
          </div>
          <div style={{ borderTop: '1.5px solid #444', margin: '6px 0 10px' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #444', fontSize: '12px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #bbb', padding: '6px 8px', background: '#f4f4f4', fontWeight: 'bold', textAlign: 'left', width: '30%' }}>Date</th>
                <th style={{ border: '1px solid #bbb', padding: '6px 8px', background: '#f4f4f4', fontWeight: 'bold', textAlign: 'right', width: '35%' }}>Billed (₹)</th>
                <th style={{ border: '1px solid #bbb', padding: '6px 8px', background: '#f4f4f4', fontWeight: 'bold', textAlign: 'right', width: '35%' }}>Received (₹)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={{ border: '1px solid #bbb', padding: '5px 8px', whiteSpace: 'nowrap' }}>{format(t.date, 'dd-MM-yyyy')}</td>
                  <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t.billedAmount ? formatINR(t.billedAmount) : '-'}</td>
                  <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t.receivedAmount ? formatINR(t.receivedAmount) : '-'}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                <td style={{ border: '1px solid #bbb', padding: '5px 8px' }}>Total</td>
                <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatINR(totalBilled)}</td>
                <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatINR(totalReceived)}</td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
            <tbody>
              <tr><td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid #eee' }}>Prev Balance</td><td style={{ padding: '4px 2px', textAlign: 'center', color: '#555', borderBottom: '1px solid #eee', width: '12px' }}>:</td><td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>₹{formatINR(prevBalance)}</td></tr>
              <tr><td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid #eee' }}>Bill Amount (+)</td><td style={{ padding: '4px 2px', textAlign: 'center', color: '#555', borderBottom: '1px solid #eee', width: '12px' }}>:</td><td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>₹{formatINR(totalBilled)}</td></tr>
              <tr><td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid #eee' }}>NETT Amount</td><td style={{ padding: '4px 2px', textAlign: 'center', color: '#555', borderBottom: '1px solid #eee', width: '12px' }}>:</td><td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>₹{formatINR(nettAmount)}</td></tr>
              <tr><td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid #eee' }}>Received (-)</td><td style={{ padding: '4px 2px', textAlign: 'center', color: '#555', borderBottom: '1px solid #eee', width: '12px' }}>:</td><td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>₹{formatINR(totalReceived)}</td></tr>
              <tr style={{ borderTop: '2px solid #333' }}><td style={{ padding: '6px 6px', fontWeight: 'bold', fontSize: '13px' }}>Final Balance</td><td style={{ padding: '6px 2px', textAlign: 'center', color: '#555' }}>:</td><td style={{ padding: '6px 6px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '13px' }}>₹{formatINR(finalBalance)}</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: '12px', fontSize: '9px', fontStyle: 'italic', color: '#1a6db5' }}>Developed by MC &amp; SONS</div>
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
            font-size: 14px !important;
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
          
          /* Opening Balance Custom Styles */
          .opening-value {
            text-align: center !important;
            font-size: 14.5px !important; /* 13px base + 1.5px */
            font-weight: 800 !important;
          }
          
          .col-date { width: 40%; text-align: left; }
          .col-billed { width: 30%; text-align: right; }
          .col-received { width: 30%; text-align: right; }

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


export default function PrintPaymentsPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
        <PrintPaymentsContent />
      </Suspense>
    );
  }
