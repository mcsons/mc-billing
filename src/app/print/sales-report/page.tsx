'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Customer, SalesReportData, BillItem } from '@/lib/data';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

type SalesReportPrintData = SalesReportData;

const formatINR = (value: number) => {
  if (value == null || isNaN(value)) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

function PrintPageContent() {
  const router = useRouter();
  const [printData, setPrintData] = useState<SalesReportPrintData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [printWithoutPrevBal, setPrintWithoutPrevBal] = useState(false);
  const [isSharingNoBal, setIsSharingNoBal] = useState(false);

  useEffect(() => {
    const rawData = sessionStorage.getItem('salesReportData');
    if (rawData)  {
      try {
        const decodedData = JSON.parse(rawData, (key, value) => {
            if ((key === 'from' || key === 'to' || key === 'billDate') && value) {
                return new Date(value);
            }
            return value;
        });
        setPrintData(decodedData);
      } catch (error) {
        console.error('Failed to parse print data:', error);
        router.push('/dashboard/sales-report');
      }
    } else {
      router.push('/dashboard/sales-report');
    }
  
    return () => {
      sessionStorage.removeItem('salesReportData');
    };
  }, [router]);

  if (!printData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading report data...</p>
      </div>
    );
  }

  const {
    customer,
    itemsByDate,
    totalQty,
    totalAmount,
    previousBalance,
    netAmount,
    dateRange,
  } = printData;

  const totalQtyString = Object.entries(totalQty)
    .map(([uom, qty]) => {
         // Apply unit-specific formatting: BOX as whole numbers, others with decimals
         if (uom.toUpperCase() === 'BOX') {
          return `${Math.round(qty)}${uom}`;
      }
      return `${qty.toFixed(2)}${uom}`;
  })
  .join(', ');

   // ─────────────────────────────────────────────────────────────
  //  Share PDF: captures hidden #pdf-area-sales div
  // ─────────────────────────────────────────────────────────────
  const handleSharePDF = async (withoutBalance: boolean = false) => {
    const captureId = withoutBalance ? 'pdf-area-sales-no-bal' : 'pdf-area-sales';
    const captureEl = document.getElementById(captureId);
    if (!captureEl || !printData) return;

    if (withoutBalance) {
      setIsSharingNoBal(true);
    } else {
      setIsSharing(true);
    }
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
      const fileName = `MC_SalesReport_${custName}_${fromStr}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const phone = (customer?.phone || '').replace(/\D/g, '');
      const waMessage =
        `*M.C & SONS FISH COMPANY*\n*Sales Report*\n\nCustomer: ${custName}\nPeriod: ${fromStr} to ${toStr}\n\nPlease find the attached sales report PDF.\n\nThank you!`;
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Sales Report: ${custName} - M.C & SONS`,
            text: `Sales Report From: ${fromStr}, To: ${toStr} by M.C & SONS FISH COMPANY`,
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
      if (withoutBalance) {
        setIsSharingNoBal(false);
      } else {
        setIsSharing(false);
      }
    }
  };

  return (
    <div>
        {shareError && (
          <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">
            {shareError}
          </div>
        )}
        <div className="flex justify-between items-center mb-4 p-4 print:hidden">
          <Button variant="outline" onClick={() => window.close()} className="text-foreground">
            <X className="mr-2 h-4 w-4" />
            Close Preview
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSharePDF(true)}
              disabled={isSharingNoBal}
              className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
            >
              {isSharingNoBal
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</>
                : <><Share2 className="mr-2 h-4 w-4" /> Share PDF (Without Balance)</>}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSharePDF(false)}
              disabled={isSharing}
              className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
            >
              {isSharing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</>
                : <><Share2 className="mr-2 h-4 w-4" /> Share (PDF)</>}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPrintWithoutPrevBal(true);
                setTimeout(() => {
                  window.print();
                  setTimeout(() => {
                    setPrintWithoutPrevBal(false);
                  }, 500);
                }, 100);
              }}
              className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Without Prev Bal
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
        <div className={`print-root thermal`}>
          <div id="print-area">
            <header className="text-center">
              <h1 className="header-title">M.C & SONS FISH COMPANY</h1>
              <p className="header-sub">
                No. 1, Fish Market, Palladam Road,
                Tiruppur - 641604
              </p>
              <p className="header-sub header-phone">📞 9597833277, 9894089889</p>
            </header>
            <div className="hr-line"></div>
            <h2 className="text-lg font-semibold mt-2 text-center">Sales Report</h2>

            <div className="grid grid-cols-2 gap-4 mb-1 text-sm">
                <div></div>
                <div className="text-right">
                    {dateRange.from && (
                         <p><span className="font-semibold">From:</span> <strong>{format(new Date(dateRange.from), 'dd-MM-yyyy')}</strong></p>
                    )}
                    {dateRange.to && (
                         <p><span className="font-semibold">To:</span> <strong>{format(new Date(dateRange.to), 'dd-MM-yyyy')}</strong></p>
                    )}
                </div>
            </div>
            
            <div className="text-sm">
                <p>
                  <span className="font-semibold">Customer Name:</span>{" "}
                  <strong className="cust-name-highlight">
                    {customer?.name_ta || customer?.name_en || '-'}
                  </strong>
                </p>
            </div>
            
            <div className="py-1"></div>

            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="col-billdate">BillDate</TableHead>
                  <TableHead className="col-itemname">ItemName</TableHead>
                  <TableHead className="col-qty text-center">Qty</TableHead>
                  <TableHead className="col-rate text-right">Rate</TableHead>
                  <TableHead className="col-amount text-right">Amt</TableHead>
                </TableRow>
                 <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsByDate.map(({ date, items }) => (
                    items.map((item, itemIndex) => (
                        <TableRow key={`${date}-${item.id}`}>
                            <TableCell className="col-billdate">{itemIndex === 0 ? date : ''}</TableCell>
                            <TableCell className="col-itemname">{item.product}</TableCell>
                            <TableCell className="col-qty">
                            {item.product === 'Delivery' ? (
                                <span className="qty-uom"><strong>-</strong></span>
                              ) : (
                                <span className="qty-uom">
                                  <strong>{item.qty.toFixed(1)}</strong>
                                  <span className="uom-text">{item.uom}</span>
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="col-rate text-right">
                                {item.product === 'Delivery' ? '-' : Math.round(item.rate)}
                            </TableCell>
                            <TableCell className="col-amount text-right">{Math.round(item.amount)}</TableCell>
                        </TableRow>
                    ))
                ))}
                 <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <div className="table-header-line"></div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            <div className="totals-section mt-4 space-y-1">
                <div className="flex justify-between items-center font-bold">
                    <div className="flex gap-2 items-center whitespace-nowrap">
                        <span>Total ==&gt;</span>
                        <span className="qty-summary-text">{totalQtyString}</span>
                    </div>
                    <div className="text-right">
                        {!printWithoutPrevBal ? formatINR(totalAmount) : ''}
                    </div>
                </div>
                <div className="hr-line my-1"></div>
                <div className="flex justify-end mt-1">
                    <table className="summary-table">
                        <tbody>
                        {!printWithoutPrevBal ? (
                                <>
                        <tr>
                                <td className="summary-label font-bold">PREVIOUS BALANCE</td>
                                <td className="summary-colon">:</td> 
                                <td className="summary-value font-bold">{previousBalance.toFixed(2)}</td>
                            </tr>
                            <tr className="summary-divider-row summary-final-balance">
                                <td className="summary-label font-bold">NETT AMT</td>
                                <td className="summary-colon">:</td>
                                <td className="summary-value font-bold">{netAmount.toFixed(2)}</td>
                            </tr>
                            </>
                            ) : (
                                <tr className="summary-final-balance">
                                    <td className="summary-label">NETT AMT</td>
                                    <td className="summary-colon">:</td>
                                    <td className="summary-value font-mono">{formatINR(totalAmount)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <footer className="print-footer">Developed by MC & SONS</footer>
          </div>
        </div>

         {/* ── Hidden compact div for PDF capture (mobile-first) ── */}
        <div
          id="pdf-area-sales"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '480px',
            padding: '16px',
            background: '#fff',
            color: '#000',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            boxSizing: 'border-box',
          }}
        >
          
          <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '2px solid #333', paddingBottom: '6px' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}>M.C &amp; SONS FISH COMPANY</div>
            <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>No. 1, Fish Market, Palladam Road, Tiruppur - 641604</div>
            <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>📞 9597833277, 9894089889</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '5px' }}>Sales Report</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
            <div><strong>Customer:</strong> {customer?.name_ta || customer?.name_en || '-'}</div>
            <div style={{ textAlign: 'right' }}>
              {dateRange.from && <div><strong>From:</strong> {format(new Date(dateRange.from), 'dd-MM-yyyy')}</div>}
              {dateRange.to && <div><strong>To:</strong> {format(new Date(dateRange.to), 'dd-MM-yyyy')}</div>}
            </div>
          </div>
          <div style={{ borderTop: '1.5px solid #444', margin: '5px 0 8px' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ width: '14%', padding: '5px 3px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>Date</th>
                <th style={{ width: '34%', padding: '5px 3px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>Item</th>
                <th style={{ width: '16%', padding: '5px 3px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Qty</th>
                <th style={{ width: '16%', padding: '5px 3px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Rate</th>
                <th style={{ width: '20%', padding: '5px 3px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {itemsByDate.map(({ date, items }) =>
                items.map((item, itemIndex) => (
                  <tr key={`${date}-${item.id}`} style={{ background: itemIndex % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '10px' }}>{itemIndex === 0 ? date : ''}</td>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', wordBreak: 'break-word' }}>{item.product}</td>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.product === 'Delivery' ? '-' : `${item.qty.toFixed(1)} ${item.uom}`}</td>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.product === 'Delivery' ? '-' : formatINR(item.rate)}</td>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatINR(item.amount)}</td>
                  </tr>
                ))
              )}
              <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                <td colSpan={2} style={{ padding: '5px 3px', border: '1px solid #ccc', borderTop: '1.5px solid #444' }}>Total &nbsp;|&nbsp; {totalQtyString}</td>
                <td colSpan={3} style={{ padding: '5px 3px', border: '1px solid #ccc', borderTop: '1.5px solid #444', textAlign: 'right' }}>{formatINR(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
            <tbody>
              <tr><td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid #eee' }}>PREVIOUS BALANCE</td><td style={{ padding: '4px 2px', textAlign: 'center', color: '#555', borderBottom: '1px solid #eee', width: '12px' }}>:</td><td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>₹{formatINR(previousBalance)}</td></tr>
              <tr style={{ borderTop: '2px solid #333' }}><td style={{ padding: '6px 6px', fontWeight: 'bold', fontSize: '13px' }}>NETT AMT</td><td style={{ padding: '6px 2px', textAlign: 'center', color: '#555' }}>:</td><td style={{ padding: '6px 6px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '13px' }}>₹{formatINR(netAmount)}</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: '12px', fontSize: '9px', fontStyle: 'italic', color: '#1a6db5' }}>Developed by MC &amp; SONS</div>
        </div>


        {/* ── Hidden compact div for PDF capture (Without Balance) ── */}
        <div
          id="pdf-area-sales-no-bal"
          style={{ position: 'fixed', left: '-9999px', top: 0, width: '480px', padding: '16px', background: '#fff', color: '#000', fontFamily: 'Arial, sans-serif', fontSize: '12px', boxSizing: 'border-box' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '2px solid #333', paddingBottom: '6px' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}>M.C &amp; SONS FISH COMPANY</div>
            <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>No. 1, Fish Market, Palladam Road, Tiruppur - 641604</div>
            <div style={{ fontSize: '10px', color: '#444', margin: '1px 0' }}>📞 9597833277, 9894089889</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '5px' }}>Sales Report</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
            <div><strong>Customer:</strong> {customer?.name_ta || customer?.name_en || '-'}</div>
            <div style={{ textAlign: 'right' }}>
              {dateRange.from && <div><strong>From:</strong> {format(new Date(dateRange.from), 'dd-MM-yyyy')}</div>}
              {dateRange.to && <div><strong>To:</strong> {format(new Date(dateRange.to), 'dd-MM-yyyy')}</div>}
            </div>
          </div>
          <div style={{ borderTop: '1.5px solid #444', margin: '5px 0 8px' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ width: '14%', padding: '5px 3px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>Date</th>
                <th style={{ width: '34%', padding: '5px 3px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>Item</th>
                <th style={{ width: '16%', padding: '5px 3px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Qty</th>
                <th style={{ width: '16%', padding: '5px 3px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Rate</th>
                <th style={{ width: '20%', padding: '5px 3px', textAlign: 'right', border: '1px solid #ccc', fontWeight: 'bold' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {itemsByDate.map(({ date, items }) =>
                items.map((item, itemIndex) => (
                  <tr key={`${date}-${item.id}`} style={{ background: itemIndex % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '10px' }}>{itemIndex === 0 ? date : ''}</td>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', wordBreak: 'break-word' }}>{item.product}</td>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.product === 'Delivery' ? '-' : `${item.qty.toFixed(1)} ${item.uom}`}</td>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.product === 'Delivery' ? '-' : formatINR(item.rate)}</td>
                    <td style={{ padding: '4px 3px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatINR(item.amount)}</td>
                  </tr>
                ))
              )}
              <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                <td colSpan={2} style={{ padding: '5px 3px', border: '1px solid #ccc', borderTop: '1.5px solid #444' }}>Total &nbsp;|&nbsp; {totalQtyString}</td>
                <td colSpan={3} style={{ padding: '5px 3px', border: '1px solid #ccc', borderTop: '1.5px solid #444', textAlign: 'right' }}></td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
            <tbody>
              <tr style={{ borderTop: '2px solid #333' }}><td style={{ padding: '6px 6px', fontWeight: 'bold', fontSize: '13px' }}>NETT AMT</td><td style={{ padding: '6px 2px', textAlign: 'center', color: '#555' }}>:</td><td style={{ padding: '6px 6px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '13px' }}>₹{formatINR(totalAmount)}</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: '12px', fontSize: '9px', fontStyle: 'italic', color: '#1a6db5' }}>Developed by MC &amp; SONS</div>
        </div>
        <div
          id="pdf-area-sales-no-bal"
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
          <div style={{ width: '160mm', margin: '0 auto', padding: '15mm 0' }}>
          <header style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 3px 0' }}>M.C &amp; SONS FISH COMPANY</h1>
            <p style={{ fontSize: '11px', margin: '2px 0' }}>No. 1, Fish Market, Palladam Road,</p>
            <p style={{ fontSize: '11px', margin: '2px 0' }}>Tiruppur - 641604</p>
            <p style={{ fontSize: '11px', margin: '4px 0 0 0' }}>📞 9597833277, 9894089889</p>
          </header>
          <h2 style={{ textAlign: 'center', fontSize: '15px', fontWeight: 'bold', margin: '6px 0' }}>Sales Report</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
            <div>
              <p style={{ margin: '2px 0' }}><strong>Customer:</strong> {customer?.name_ta || customer?.name_en || '-'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {dateRange.from && <p style={{ margin: '2px 0' }}><strong>From:</strong> {format(new Date(dateRange.from), 'dd-MM-yyyy')}</p>}
              {dateRange.to && <p style={{ margin: '2px 0' }}><strong>To:</strong> {format(new Date(dateRange.to), 'dd-MM-yyyy')}</p>}
            </div>
          </div>
          <div style={{ borderTop: '1.5px solid #444', margin: '6px 0 10px' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #444', fontSize: '11px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #bbb', padding: '5px 6px', background: '#f4f4f4', fontWeight: 'bold', textAlign: 'left', width: '12%' }}>Date</th>
                <th style={{ border: '1px solid #bbb', padding: '5px 6px', background: '#f4f4f4', fontWeight: 'bold', textAlign: 'left', width: '38%' }}>Item</th>
                <th style={{ border: '1px solid #bbb', padding: '5px 6px', background: '#f4f4f4', fontWeight: 'bold', textAlign: 'right', width: '15%' }}>Qty</th>
                <th style={{ border: '1px solid #bbb', padding: '5px 6px', background: '#f4f4f4', fontWeight: 'bold', textAlign: 'right', width: '15%' }}>Rate</th>
                <th style={{ border: '1px solid #bbb', padding: '5px 6px', background: '#f4f4f4', fontWeight: 'bold', textAlign: 'right', width: '20%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {itemsByDate.map(({ date, items }) =>
                items.map((item, itemIndex) => (
                  <tr key={`${date}-${item.id}`} style={{ background: itemIndex % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ border: '1px solid #bbb', padding: '4px 6px', whiteSpace: 'nowrap' }}>{itemIndex === 0 ? date : ''}</td>
                    <td style={{ border: '1px solid #bbb', padding: '4px 6px' }}>{item.product}</td>
                    <td style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {item.product === 'Delivery' ? '-' : `${item.qty.toFixed(1)} ${item.uom}`}
                    </td>
                    <td style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {item.product === 'Delivery' ? '-' : formatINR(item.rate)}
                    </td>
                    <td style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatINR(item.amount)}</td>
                  </tr>
                ))
              )}
              <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                <td colSpan={2} style={{ border: '1px solid #bbb', padding: '5px 6px' }}>Total</td>
                <td style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'right' }}>{totalQtyString}</td>
                <td style={{ border: '1px solid #bbb', padding: '5px 6px' }}></td>
                <td style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'right' }}></td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '260px' }}>
              <tbody>
                {[
                  { label: 'NETT AMT', value: formatINR(totalAmount), bold: true },
                ].map(({ label, value, bold }) => (
                  <tr key={label}>
                    <td style={{ padding: '4px 8px', fontWeight: bold ? 'bold' : 600, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: bold ? '1.5px solid #333' : '1px solid #e0e0e0', borderTop: bold ? '1.5px solid #333' : undefined }}>{label}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', width: '18px', color: '#555', borderBottom: bold ? '1.5px solid #333' : '1px solid #e0e0e0', borderTop: bold ? '1.5px solid #333' : undefined }}>:</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: bold ? 'bold' : undefined, fontSize: bold ? '13px' : undefined, borderBottom: bold ? '1.5px solid #333' : '1px solid #e0e0e0', borderTop: bold ? '1.5px solid #333' : undefined }}>₹{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer style={{ marginTop: '28px', fontSize: '9px', fontStyle: 'italic', color: '#1a6db5', textAlign: 'left' }}>Developed by MC &amp; SONS</footer>
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
                width: 106mm;
                padding: 1rem;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
        }

        /* --- Global Print Reset --- */

        @media print {
          * { 
            color: #000 !important; 
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            page-break-before: auto !important;
            page-break-after: auto !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            background: white !important;
            overflow: visible !important;
            min-height: 100vh; 
          }
          #print-area { margin: 0; padding: 0; }
          .print\:hidden { display: none !important; }

          @page {
            size: 106mm auto;
            margin: 0;
          }
          
          thead {
            display: table-row-group !important;
          }
          .print-root, #print-area {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

        /* ===============================
          THERMAL STYLING (106mm)
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
        
        .header-title { font-size: 22px !important; font-weight: 700; letter-spacing: 0.5px; line-height: 1.2; white-space: nowrap; }
        .header-sub { display: block; text-align: center; font-size: 13px !important; font-weight: 700; line-height: 1.3; margin-top: 2px; }
        .header-phone { margin-top: 4px; }
        .hr-line { border-top: 2px solid #000; margin: 6px 0; }
        .table-header-line { border-top: 2px solid #000; margin: 0; }
        
        .qty-uom {
          display: inline-flex;
          justify-content: flex-end;
          align-items: center;
        }

        .uom-text {
          margin-left: 3px;
        }

        .cust-name-highlight {
          font-size: 16px !important;
          font-weight: bold !important;
        }

        .print-table { 
          width: 100%; 
          border-collapse: collapse; 
          table-layout: fixed; 
        }
        .print-table tr, .print-table th, .print-table td { 
          border: none; 
          vertical-align: top;
        }
        
        .print-table thead th { 
          font-weight: 800 !important; 
          font-size: 14px !important; 
          padding: 2px 1px; 
          color: #000; 
          white-space: nowrap;
          text-align: left;
        }
        .print-table thead th.text-right { text-align: right; }
        .print-table thead th.text-center { text-align: center; }
        
        .print-table tbody td { 
          padding: 2px 1px; 
          font-size: 13px;
          font-weight: 700 !important;
        }
        
        .col-billdate { width: 15%; white-space: nowrap; }
        .col-itemname { width: 49%; white-space: normal; font-size: 10px !important; padding-right: 4px; word-break: keep-all; }
        .col-qty { width: 12%; white-space: nowrap; font-size: 14px !important; text-align: right !important; padding-right: 4px; }
        .col-rate { width: 10%; text-align: right; white-space: nowrap; font-size: 14px !important; font-family: "Courier New", monospace; }
        .col-amount { width: 14%; text-align: right; white-space: nowrap; font-size: 14px !important; font-family: "Courier New", monospace; }

        .totals-section, .totals-section span { font-size: 15px !important; font-weight: 700 !important; }
        .qty-summary-text { white-space: nowrap; }
        .summary-table {
            width: 100%;
            max-width: 280px;
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
            border-top: 1px solid black;
          }
          .summary-final-balance td {
            font-size: 16px !important;
            font-weight: 800 !important;
          }
        .print-footer { margin-top: 18px; text-align: left; font-size: 10px; font-weight: 800; font-style: italic; }
        }
      `}</style>
    </div>
  );
}

export default function PrintSalesReportPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
        <PrintPageContent />
      </Suspense>
    );
  }
