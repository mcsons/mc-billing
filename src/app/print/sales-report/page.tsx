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
import { setupTamilFont } from '@/lib/pdf-fonts';

type SalesReportPrintData = any;

function PrintPageContent() {
  const router = useRouter();
  const [printData, setPrintData] = useState<SalesReportPrintData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSharingNoBal, setIsSharingNoBal] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [printWithoutPrevBal, setPrintWithoutPrevBal] = useState(false);

  useEffect(() => {
    const rawData = sessionStorage.getItem('unifiedReportData');
    if (rawData) {
      try {
        const decodedData = JSON.parse(rawData, (key, value) => {
            if ((key === 'from' || key === 'to' || key === 'billDate') && value) {
                return new Date(value);
            }
            return value;
        });
        
        let normalizedData = decodedData;
        if (decodedData && decodedData.mode && decodedData.mode !== 'CUSTOMER') {
           const groups: Record<string, any[]> = {};
           decodedData.data.items.forEach((item: any) => {
              const dateStr = format(new Date(item.billDate), 'dd-MM-yy');
              if (!groups[dateStr]) groups[dateStr] = [];
              groups[dateStr].push({
                 ...item,
                 product: decodedData.mode === 'PRODUCT' ? item.customerName : item.product,
                 qty: item.qty,
                 uom: item.uom || '',
                 rate: item.rate,
                 amount: item.amount
              });
           });
           const itemsByDate = Object.keys(groups).map(date => ({
              date,
              items: groups[date]
           }));
           normalizedData.data.itemsByDate = itemsByDate;
           if (typeof decodedData.data.totalQty === 'number') {
              normalizedData.data.totalQty = { '': decodedData.data.totalQty };
           }
           normalizedData.data.previousBalance = 0;
           normalizedData.data.netAmount = decodedData.data.totalAmount;
        }
        setPrintData(normalizedData);

      } catch (error) {
        console.error('Failed to parse print data:', error);
        router.push('/dashboard/sales-report');
      }
    } else {
      router.push('/dashboard/sales-report');
    }

    return () => {
      sessionStorage.removeItem('unifiedReportData');
    };
  }, [router]);

  if (!printData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading report data...</p>
      </div>
    );
  }

  const mode = printData.mode || 'CUSTOMER';
  const data = printData.data || printData;
  const {
    customer,
    itemsByDate,
    totalQty,
    totalAmount,
    previousBalance,
    netAmount,
    dateRange,
  } = data;
  const productName = data.productName;
  const customerName = data.customerName;

  const formatINR = (value: number) => {
    if (value == null || isNaN(value)) return '0.00';
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const totalQtyString = Object.entries(totalQty || {})
    .map(([uom, qty]: [string, any]) => {
        const numericQty = Number(qty) || 0;
        // Apply unit-specific formatting: BOX as whole numbers, others with decimals
        if (uom.toUpperCase() === 'BOX') {
            return `${Math.round(numericQty)}${uom}`;
        }
        return `${numericQty.toFixed(2)}${uom}`;
    })
    .join(', ');

  // ─────────────────────────────────────────────────────────────
  //  Share PDF: captures hidden #pdf-area-sales div
  // ─────────────────────────────────────────────────────────────
  const handleSharePDF = async (withoutBalance: boolean = false) => {
    if (!printData) return;

    if (withoutBalance) setIsSharingNoBal(true);
    else setIsSharing(true);
    setShareError(null);

    try {
      const { jsPDF } = await import('jspdf');

      // ── Page constants ──────────────────────────────────────────
      const PAGE_W   = 210;   // A4 mm
      const PAGE_H   = 297;
      const ML       = 10;    // left margin
      const MR       = 10;    // right margin
      const MT       = 10;    // top margin
      const MB       = 12;    // bottom margin
      const CW       = PAGE_W - ML - MR;  // content width

      // Column widths
      const C_DATE   = 18;
      const C_AMT    = 26;
      const C_RATE   = 22;
      const C_QTY    = 24;
      const C_ITEM   = CW - C_DATE - C_QTY - C_RATE - C_AMT;

      const X: number[] = [
        ML,
        ML + C_DATE,
        ML + C_DATE + C_ITEM,
        ML + C_DATE + C_ITEM + C_QTY,
        ML + C_DATE + C_ITEM + C_QTY + C_RATE,
      ];

      const ROW_H    = 5.5;
      const HDR_H    = 6.5;
      const TOTALS_RESERVE = 32; // mm reserved at page bottom for totals block

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      await setupTamilFont(pdf);
      let y = MT;
      let pageNum = 1;

      // ── Helpers ─────────────────────────────────────────────────
      const setFont = (style: 'normal' | 'bold' | 'italic', size: number, color = 0) => {
        // Use the registered 'Tamil' font which supports both English and Tamil
        // Style support depends on the font file, for now we map all to 'normal' 
        // as we only embedded the Regular weight.
        pdf.setFont('Tamil', 'normal'); 
        pdf.setFontSize(size);
        pdf.setTextColor(color, color, color);
      };

      const hline = (yy: number, w = 0.4, x1 = ML, x2 = PAGE_W - MR) => {
        pdf.setDrawColor(100, 100, 100);
        pdf.setLineWidth(w);
        pdf.line(x1, yy, x2, yy);
      };

      const drawTableHeader = () => {
        pdf.setFillColor(235, 235, 235);
        pdf.rect(ML, y, CW, HDR_H, 'F');
        setFont('bold', 9);
        const ty = y + HDR_H - 1.8;
        pdf.text('Date',                          X[0] + 1,              ty);
        pdf.text(mode === 'PRODUCT' ? 'Cust Name' : 'Item', X[1] + 1,  ty);
        pdf.text('Qty',    X[2] + C_QTY  - 1,    ty, { align: 'right' });
        pdf.text('Rate',   X[3] + C_RATE - 1,    ty, { align: 'right' });
        pdf.text('Amount', X[4] + C_AMT  - 1,    ty, { align: 'right' });
        hline(y + HDR_H, 0.3);
        y += HDR_H;
      };

      const addPage = () => {
        pdf.addPage();
        pageNum++;
        y = MT;
        drawTableHeader();
        setFont('normal', 9);
      };

      // ── Page 1 Header ────────────────────────────────────────────
      setFont('bold', 15);
      pdf.text('M.C & SONS FISH COMPANY', PAGE_W / 2, y + 1, { align: 'center' });
      y += 7;

      setFont('normal', 8, 60);
      pdf.text('No. 1, Fish Market, Palladam Road, Tiruppur - 641604', PAGE_W / 2, y, { align: 'center' });
      y += 4.5;
      pdf.text('Ph: 9894089889, 9597833277', PAGE_W / 2, y, { align: 'center' });
      y += 5;

      hline(y, 0.5);
      y += 4;

      const reportTitle = mode === 'PRODUCT'
        ? 'Product Report'
        : mode === 'CUSTOMER_PRODUCT'
          ? 'Customer Product Report'
          : 'Sales Report';

      setFont('bold', 13, 0);
      pdf.text(reportTitle, PAGE_W / 2, y, { align: 'center' });
      y += 6;

      // Customer / Product label
      const custLabel = mode === 'PRODUCT' ? 'Product:' : 'Customer:';
      const custValue = mode === 'PRODUCT'
        ? (productName || '')
        : mode === 'CUSTOMER_PRODUCT'
          ? `${customerName || ''} | ${productName || ''}`
          : (customer?.name_ta || customer?.name_en || '-');

      const fromStr = dateRange?.from ? format(new Date(dateRange.from), 'dd-MM-yyyy') : '';
      const toStr   = dateRange?.to   ? format(new Date(dateRange.to),   'dd-MM-yyyy') : '';

      setFont('bold', 10);
      pdf.text(custLabel, ML, y);
      setFont('normal', 10);
      const labelW = pdf.getTextWidth(custLabel) + 1;
      // Truncate customer name if too wide
      let cvDisplay = custValue;
      const maxCvW  = CW - labelW - (fromStr ? 38 : 0);
      while (pdf.getTextWidth(cvDisplay) > maxCvW && cvDisplay.length > 4)
        cvDisplay = cvDisplay.slice(0, -1);
      if (cvDisplay !== custValue) cvDisplay += '…';
      pdf.text(cvDisplay, ML + labelW, y);

      if (fromStr) {
        setFont('normal', 9, 60);
        pdf.text(`From: ${fromStr}`, PAGE_W - MR, y, { align: 'right' });
        y += 4.5;
        if (toStr) pdf.text(`To:   ${toStr}`, PAGE_W - MR, y, { align: 'right' });
      } else {
        y -= 0;
      }
      y += 6;

      hline(y, 0.5);
      y += 4;

      // ── Table header (page 1) ────────────────────────────────────
      drawTableHeader();
      setFont('normal', 9, 0);

      // ── Data rows ────────────────────────────────────────────────
      itemsByDate.forEach(({ date, items }: { date: string; items: any[] }) => {
        items.forEach((item: any, idx: number) => {
          // Reserve bottom space for totals on every page check
          const spaceNeeded = ROW_H + (idx === items.length - 1 ? TOTALS_RESERVE : 0);
          if (y + spaceNeeded > PAGE_H - MB) addPage();

          // Alternating row tint
          if (idx % 2 === 1) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(ML, y, CW, ROW_H, 'F');
          }

          setFont('normal', 9, 0);
          const ty = y + ROW_H - 1.5;

          // Date (first item of group only)
          if (idx === 0) pdf.text(date, X[0] + 1, ty);

          // Item name – truncate to fit column
          let iName = String(item.product || '');
          const maxIW = C_ITEM - 3;
          while (pdf.getTextWidth(iName) > maxIW && iName.length > 3)
            iName = iName.slice(0, -1);
          if (iName !== String(item.product || '')) iName += '…';
          pdf.text(iName, X[1] + 1, ty);

          const isDelivery = item.product === 'Delivery';

          // Qty
          pdf.text(
            isDelivery ? '-' : `${Number(item.qty).toFixed(1)} ${item.uom || ''}`,
            X[2] + C_QTY - 1, ty, { align: 'right' }
          );

          // Rate
          pdf.text(
            isDelivery ? '-' : String(Math.round(item.rate)),
            X[3] + C_RATE - 1, ty, { align: 'right' }
          );

          // Amount
          setFont('bold', 9, 0);
          pdf.text(String(Math.round(item.amount)), X[4] + C_AMT - 1, ty, { align: 'right' });
          setFont('normal', 9, 0);

          y += ROW_H;
        });
      });

      // ── Divider after rows ───────────────────────────────────────
      hline(y, 0.5);
      y += 3;

      // ── Totals – always on the final page ───────────────────────
      // Total row
      setFont('bold', 10);
      pdf.text('Total  ==>', X[0] + 1, y + 4);
      pdf.text(totalQtyString,            X[1] + 1,              y + 4);
      pdf.text(
        String(Math.round(totalAmount)),  X[4] + C_AMT - 1,     y + 4,
        { align: 'right' }
      );
      y += 8;
      hline(y, 0.3);
      y += 5;

      // Summary box (right-aligned)
      const SX  = PAGE_W - MR - 72; // label start x
      const CX  = SX + 52;           // colon x
      const VX  = PAGE_W - MR;       // value x (right-aligned)

      if (mode === 'CUSTOMER' && !withoutBalance) {
        setFont('normal', 10);
        pdf.text('PREVIOUS BALANCE', SX, y + 4.5);
        pdf.text(':',                CX, y + 4.5);
        pdf.text(
          String(Math.round(previousBalance)),
          VX, y + 4.5, { align: 'right' }
        );
        y += 7;
        hline(y, 0.3, SX - 2, VX);
        y += 1;
      }

      setFont('bold', 12);
      const nettAmt = withoutBalance ? Math.round(totalAmount) : Math.round(netAmount);
      pdf.text('NETT AMT', SX, y + 5.5);
      pdf.text(':',        CX, y + 5.5);
      pdf.text(String(nettAmt), VX, y + 5.5, { align: 'right' });
      y += 9;
      hline(y, 0.5, SX - 2, VX);
      y += 8;

      // Footer
      setFont('italic', 8, 26);
      pdf.setTextColor(26, 109, 181);
      pdf.text('Developed by MC & SONS', ML, y);

      // ── Output / Share ───────────────────────────────────────────
      const pdfBlob = pdf.output('blob');
      let title = 'Sales Report';
      let custName = customer?.name_en || 'Customer';
      if (mode === 'PRODUCT') { title = 'Product Report'; custName = productName; }
      else if (mode === 'CUSTOMER_PRODUCT') { title = 'Customer Product Report'; custName = customerName; }

      const fileName = `MC_${title.replace(/\s+/g, '')}_${custName}_${fromStr}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const phone = (mode === 'CUSTOMER' && customer?.phone) ? customer.phone.replace(/\D/g, '') : '';
      const waMessage =
        `*M.C & SONS FISH COMPANY*\n*${title}*\n\n${mode === 'PRODUCT' ? 'Product' : 'Customer'}: ${custName}\nPeriod: ${fromStr} to ${toStr}\n\nPlease find the attached report PDF.\n\nThank you!`;
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `${title}: ${custName} - M.C & SONS`,
            text: `${title} From: ${fromStr}, To: ${toStr} by M.C & SONS FISH COMPANY`,
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
      if (withoutBalance) setIsSharingNoBal(false);
      else setIsSharing(false);
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
            {mode === 'CUSTOMER' && (
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
            )}
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
            {mode === 'CUSTOMER' && (
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
            )}
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
                <span className="city">Tiruppur - 641604</span>
              </p>
              <p className="header-sub header-phone">📞 9894089889, 9597833277</p>
            </header>
            <div className="hr-line"></div>
            <h2 className="text-lg font-semibold mt-2 text-center">
      {mode === 'PRODUCT' ? 'Product Report' : mode === 'CUSTOMER_PRODUCT' ? 'Customer Product Report' : 'Sales Report'}
  </h2>

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
                  <span className="font-semibold">{mode === 'PRODUCT' ? 'Product Name:' : 'Customer Name:'}</span>{" "}
                  <strong className="cust-name-highlight">
                    {mode === 'PRODUCT' ? productName : mode === 'CUSTOMER_PRODUCT' ? `${customerName} | ${productName}` : (customer?.name_ta || customer?.name_en || '-')}
                  </strong>
                </p>
            </div>
            
            {/* Blank line for spacing */}
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
                  <TableHead className="col-itemname">{mode === 'PRODUCT' ? 'Cust Name' : 'ItemName'}</TableHead>
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
                {itemsByDate.map(({ date, items }: { date: string, items: any[] }) => (
                    items.map((item: any, itemIndex: number) => (
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
                <div className="flex">
                    <span className="w-[40%] font-bold">Total ==&gt;</span>
                    <span className="w-[30%] text-center">{totalQtyString}</span>
                    <span className="w-[30%] text-right font-bold">
                        {!printWithoutPrevBal ? Math.round(totalAmount) : ''}
                    </span>
                </div>
                <div className="hr-line my-1"></div>
                <div className="flex justify-end mt-1">
                    <table className="summary-table">
                        <tbody>
                            {mode === 'CUSTOMER' ? (
                                !printWithoutPrevBal ? (
                                    <>
                                        <tr>
                                            <td className="summary-label">PREVIOUS BALANCE</td>
                                            <td className="summary-colon">:</td>
                                            <td className="summary-value font-mono">{Math.round(previousBalance)}</td>
                                        </tr>
                                        <tr className="summary-divider-row summary-final-balance">
                                            <td className="summary-label">NETT AMT</td>
                                            <td className="summary-colon">:</td>
                                            <td className="summary-value font-mono">{Math.round(netAmount)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr className="summary-final-balance">
                                        <td className="summary-label">NETT AMT</td>
                                        <td className="summary-colon">:</td>
                                        <td className="summary-value font-mono">{Math.round(totalAmount)}</td>
                                    </tr>
                                )
                            ) : (
                                <tr className="summary-final-balance">
                                    <td className="summary-label">NETT AMT</td>
                                    <td className="summary-colon">:</td>
                                    <td className="summary-value font-mono">{Math.round(totalAmount)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <footer className="print-footer">Developed by MC & SONS</footer>
          </div>
        </div>

        {/* ── PDF rendered programmatically via jsPDF – these stubs are kept for ID compatibility ── */}
        <div id="pdf-area-sales" style={{ display: 'none' }} />
        <div id="pdf-area-sales-no-bal" style={{ display: 'none' }} />
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
        }

        /* ===============================
          THERMAL (106mm)
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
          /* --- Base styles copied from Main Bill Print --- */
          .header-title { font-size: 22px !important; font-weight: 700; letter-spacing: 0.5px; line-height: 1.2; white-space: nowrap; }
          .header-sub { display: block; text-align: center; font-size: 13px !important; font-weight: 700; line-height: 1.3; margin-top: 2px; }
          .header-sub .city { display: block; }
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

          /* --- Customer Name Highlight --- */
          .cust-name-highlight {
            font-size: 16px !important;
            font-weight: bold !important;
          }

          /* --- Sales Report Table Layout --- */
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
          .print-table td.col-qty,
          .print-table th.col-qty {
            text-align: right !important;
            padding-right: 4px;
          }
          
          /* --- Column Specific Styles (Adjusted for Alignment) --- */
          .col-billdate { 
            width: 12%; 
            white-space: nowrap;
          }
          .col-itemname { 
            width: 52%; 
            white-space: normal;
            font-size: 10px !important; 
            padding-right: 4px;
            word-break: keep-all;
          }
          .col-qty { 
            width: 12%; 
            white-space: nowrap;
            font-size: 14px !important;
          }
          .col-rate { 
            width: 10%; 
            text-align: right; 
            white-space: nowrap;
            font-size: 14px !important;
            font-family: "Courier New", monospace;
          }
          .col-amount { 
            width: 14%; 
            text-align: right; 
            white-space: nowrap;
            font-size: 14px !important;
            font-family: "Courier New", monospace;
          }

          /* --- Totals and Footer --- */
          .totals-section, .totals-section span { font-size: 15px !important; font-weight: 700 !important; }
          .totals-section .hr-line { margin: 2px 0; }
          
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
