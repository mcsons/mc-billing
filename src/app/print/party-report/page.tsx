'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Timestamp } from 'firebase/firestore';

function PartyReportPrintContent() {
    const searchParams = useSearchParams();
    const [reportData, setReportData] = useState<any | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const autoShare = searchParams.get('share') === 'pdf';

    useEffect(() => {
        const raw = sessionStorage.getItem('partyReportData');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                // Revive date fields
                if (parsed.dateRange) {
                    parsed.dateRange.from = new Date(parsed.dateRange.from);
                    parsed.dateRange.to = new Date(parsed.dateRange.to);
                }
                if (parsed.bills) {
                    parsed.bills = parsed.bills.map((b: any) => {
                        if (b.date && typeof b.date === 'object' && b.date.seconds) {
                            b.date = new Date(b.date.seconds * 1000);
                        } else if (b.date) {
                            b.date = new Date(b.date);
                        }
                        return b;
                    });
                }
                setReportData(parsed);
            } catch (e) { console.error('Failed to parse party report data', e); }
        }
    }, []);

    const handleSharePDF = useCallback(async () => {
        const captureEl = document.getElementById('print-area');
        if (!captureEl || !reportData) return;
        setIsSharing(true);
        setShareError(null);
        try {
            const [html2canvasModule, jsPDFModule] = await Promise.all([import('html2canvas'), import('jspdf')]);
            const html2canvas = html2canvasModule.default;
            const { jsPDF } = jsPDFModule;
            const canvas = await html2canvas(captureEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: captureEl.scrollWidth, windowHeight: captureEl.scrollHeight });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfWidth = 147;
            const pdfHeight = (canvas.height / canvas.width) * pdfWidth;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, Math.max(pdfHeight, 200)] });
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            const pdfBlob = pdf.output('blob');
            const partyName = (reportData.party?.name || 'Party').replace(/\s+/g, '_');
            const fromFmt = reportData.dateRange?.from ? format(new Date(reportData.dateRange.from), 'dd-MM-yyyy') : 'from';
            const toFmt = reportData.dateRange?.to ? format(new Date(reportData.dateRange.to), 'dd-MM-yyyy') : 'to';
            const fileName = `MC_PartyReport_${partyName}_${fromFmt}_${toFmt}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            let shared = false;
            if (typeof navigator !== 'undefined' && navigator.share) {
                try { await navigator.share({ title: fileName, text: `Party Report - ${partyName}`, files: [file] }); shared = true; }
                catch (err: any) { if (err?.name === 'AbortError') return; }
            }
            if (!shared) {
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a'); a.href = url; a.download = fileName;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 400);
                setShareError('PDF downloaded! You can now share it.');
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') setShareError('Could not generate PDF. Please try printing instead.');
        } finally { setIsSharing(false); }
    }, [reportData]);

    if (!reportData) {
        return <div className="flex justify-center items-center h-screen"><p>Loading report data...</p></div>;
    }

    const { party, bills, dateRange } = reportData;
    const totalAmount = bills.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0);
    const totalDeductions = bills.reduce((s: number, b: any) => s + (b.totalDeductions || 0), 0);
    const netAmount = bills.reduce((s: number, b: any) => s + (b.netAmount || 0), 0);
    const totalBox = bills.reduce((s: number, b: any) => s + (b.totalBox || 0), 0);
    const totalKgs = bills.reduce((s: number, b: any) => s + (b.totalKgs || 0), 0);

    const commissionTotal = bills.reduce((s: number, b: any) => s + (b.totalAmount * (b.commission || 0) / 100), 0);
    const expensesTotal = bills.reduce((s: number, b: any) => s + (b.expenses || 0), 0);
    const rentTotal = bills.reduce((s: number, b: any) => s + (b.rent || 0), 0);

    const getDate = (d: any) => d instanceof Date ? d : (d?.seconds ? new Date(d.seconds * 1000) : new Date(d));

    return (
        <>
            {autoShare && (
                <div className="print:hidden bg-green-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Share2 className="h-6 w-6 shrink-0" />
                        <div>
                            <p className="font-semibold text-sm">Party report ready to share!</p>
                            <p className="text-xs text-green-100 mt-0.5">Tap to send as PDF.</p>
                        </div>
                    </div>
                    <Button onClick={handleSharePDF} disabled={isSharing} className="w-full sm:w-auto bg-white text-green-700 hover:bg-green-50 font-bold text-sm px-6 shrink-0">
                        {isSharing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Share2 className="mr-2 h-4 w-4" />Share via WhatsApp</>}
                    </Button>
                </div>
            )}
            {shareError && <div className="print:hidden bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">{shareError}</div>}

            <div className="p-4 print:hidden flex justify-between items-center">
                <Button variant="outline" onClick={() => window.close()} className="text-foreground"><X className="mr-2 h-4 w-4" />Close</Button>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleSharePDF} disabled={isSharing} className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
                        {isSharing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</> : <><Share2 className="mr-2 h-4 w-4" />Share (PDF)</>}
                    </Button>
                    <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
                </div>
            </div>

            <div className="party-bill-invoice">
                <div id="print-area">
                    <header className="invoice-header">
                        <h1 className="company-name">M.C &amp; SONS FISH COMPANY</h1>
                        <p className="sub-header">Dealer : SEA &amp; TANK FOODS</p>
                        <p className="sub-header-address">Shop No. 1, Fish Market, Palladam Road, Tiruppur - 641604</p>
                        <p className="sub-header-address">📞 9843223078, 9944444497</p>
                    </header>

                    <section className="party-details">
                        <div className="grid-item"><span className="label">Supplier :</span><span className="value font-bold">{party?.name}</span></div>
                        <div className="grid-item"><span className="label">From :</span><span className="value font-bold">{dateRange?.from ? format(new Date(dateRange.from), 'dd/MM/yyyy') : ''}</span></div>
                        <div className="grid-item"><span className="label">Address :</span><span className="value font-bold">{party?.location}</span></div>
                        <div className="grid-item"><span className="label">To :</span><span className="value font-bold">{dateRange?.to ? format(new Date(dateRange.to), 'dd/MM/yyyy') : ''}</span></div>
                    </section>

                    <table className="items-table" style={{ marginTop: '8px' }}>
                        <thead>
                            <tr>
                                <th className="col-sn">#</th>
                                <th className="col-date">Date</th>
                                <th className="col-item">Item</th>
                                <th className="col-box">Box</th>
                                <th className="col-kgs">Kgs</th>
                                <th className="col-rate">Rate</th>
                                <th className="col-total">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bills.flatMap((bill: any, billIdx: number) => {
                                const d = getDate(bill.date);
                                const items = bill.items || [];
                                const rows = items.map((item: any, itemIdx: number) => (
                                    <tr key={`${bill.id}-${itemIdx}`} style={itemIdx === 0 && billIdx > 0 ? { borderTop: '2px solid #333' } : {}}>
                                        <td className="col-sn">{itemIdx === 0 ? billIdx + 1 : ''}</td>
                                        <td className="col-date" style={{ fontWeight: itemIdx === 0 ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>
                                            {itemIdx === 0 ? format(d, 'dd/MM/yy') : ''}
                                        </td>
                                        <td className="col-item"><strong>{item.productName}</strong></td>
                                        <td className="col-box">{item.box}</td>
                                        <td className="col-kgs">{(item.kgs || 0).toFixed(2)}</td>
                                        <td className="col-rate"><strong>{(item.rate || 0).toFixed(2)}</strong></td>
                                        <td className="col-total">{(item.amount || 0).toFixed(2)}</td>
                                    </tr>
                                ));
                                // Bill subtotal row
                                rows.push(
                                    <tr key={`${bill.id}-sub`} style={{ background: '#ebebeb', fontSize: '10pt', fontWeight: 'bold', borderTop: '2px solid #444' }}>
                                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', padding: '5px 6px', borderBottom: '1.5px solid #aaa' }}>
                                            Bill Subtotal&nbsp;<span style={{ fontWeight: 'normal', fontSize: '8.5pt' }}>(Box: {bill.totalBox}, Kgs: {(bill.totalKgs||0).toFixed(2)})</span>
                                        </td>
                                        <td className="col-kgs" style={{ textAlign: 'right', fontFamily: '"Courier New", monospace', borderTop: '1px solid #aaa', padding: '5px 6px' }}>{(bill.totalAmount||0).toFixed(2)}</td>
                                        <td className="col-rate" style={{ textAlign: 'right', fontFamily: '"Courier New", monospace', fontWeight: '900', color: '#000', borderTop: '1px solid #aaa', padding: '5px 6px' }}>-{(bill.totalDeductions||0).toFixed(2)}</td>
                                        <td className="col-total" style={{ textAlign: 'right', fontFamily: '"Courier New", monospace', fontWeight: 'bold', borderTop: '1px solid #aaa', padding: '5px 6px' }}>{(bill.netAmount||0).toFixed(2)}</td>
                                    </tr>
                                );
                                return rows;
                            })}
                        </tbody>
                    </table>

                    <div className="table-summary-row">
                        <div className="summary-item"><span className="label">Total Boxes:</span><span className="value">{totalBox}</span></div>
                        <div className="summary-item"><span className="label">Total Weight:</span><span className="value">{totalKgs.toFixed(2)} KGS</span></div>
                    </div>

                    <section className="totals-container" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <div className="left-totals">
                            <div className="deductions-group">
                                {commissionTotal > 0 && <div className="detail-row"><span>Commission:</span><span><strong>₹{commissionTotal.toFixed(2)}</strong></span></div>}
                                {expensesTotal > 0 && <div className="detail-row"><span>Expenses:</span><span><strong>₹{expensesTotal.toFixed(2)}</strong></span></div>}
                                {rentTotal > 0 && <div className="detail-row"><span>Rent:</span><span><strong>₹{rentTotal.toFixed(2)}</strong></span></div>}
                            </div>
                            <Separator className="my-1 border-black" />
                        </div>
                        <table className="right-totals boxed-summary-table">
                            <tbody>
                                <tr><td>Bill Amount:</td><td className="val-total-amount">₹{totalAmount.toFixed(2)}</td></tr>
                                {totalDeductions > 0 && <tr><td>Total Deductions:</td><td className="val-total-deductions">₹{totalDeductions.toFixed(2)}</td></tr>}
                                <tr className="font-bold"><td>Net Amount:</td><td className="val-net-amount">₹{netAmount.toFixed(2)}</td></tr>
                            </tbody>
                        </table>
                    </section>
                    <footer className="print-footer">Developed by MC &amp; SONS</footer>
                </div>
            </div>

            <style jsx global>{`
                @media screen { .party-bill-invoice { margin: 2rem auto; } }
                @media print {
                    @page { size: 147mm auto; margin: 0mm; }
                    body { background: white !important; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    body * { visibility: hidden; color: #000 !important; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 4mm 6mm 6mm 6mm; box-sizing: border-box; }
                    .print\\:hidden { display: none !important; }
                }
                .party-bill-invoice { font-family: Arial, sans-serif; font-size: 10pt; width: 135mm; background: white; color: black; }
                .font-bold { font-weight: bold; }
                .invoice-header { text-align: center; padding-bottom: 8px; margin-bottom: 8px; }
                .invoice-header .company-name { font-weight: bold; font-size: 16pt; margin: 0; }
                .invoice-header .sub-header { font-size: 10pt; margin: 1px 0; font-weight: 500; }
                .invoice-header .sub-header-address { font-size: 9pt; margin: 1px 0; }
                .party-details { border: 1.5px solid black; display: grid; grid-template-columns: 1fr 1fr; }
                .party-details .grid-item { padding: 4px 6px; display: flex; flex-direction: row; align-items: baseline; border-bottom: 1.5px solid black; }
                .party-details .grid-item:nth-child(odd) { border-right: 1.5px solid black; }
                .party-details .grid-item:last-child { border-bottom: none; }
                .party-details .grid-item:nth-last-child(2) { border-bottom: none; }
                .party-details .label { font-weight: bold; font-size: 9pt; white-space: nowrap; width: 28mm; display: inline-block; flex-shrink: 0; }
                .party-details .value { font-size: 10pt; }
                .items-table { width: 100%; margin-top: 8px; border-collapse: collapse; table-layout: fixed; }
                .items-table th, .items-table td { border: 1.5px solid black; padding: 6px; vertical-align: top; }
                .items-table thead tr { background-color: #f2f2f2 !important; }
                .items-table thead th { font-weight: bold; text-align: center; font-size: 9pt; }
                .items-table .col-sn { width: 6mm; text-align: center; white-space: nowrap; }
                .items-table .col-date { width: 16mm; text-align: center; white-space: nowrap; }
                .items-table .col-item { width: auto; word-break: break-word; text-align: left; font-size: 9pt; }
                .items-table .col-box { width: 11mm; text-align: right; font-weight: bold; }
                .items-table .col-kgs { width: 23mm; text-align: right; font-weight: bold; }
                .items-table .col-rate { width: 23mm; text-align: right; font-family: "Courier New", monospace; }
                .items-table .col-total { width: 25mm; text-align: right; font-family: "Courier New", monospace; font-weight: bold; }
                .table-summary-row { display: flex; justify-content: flex-end; gap: 15mm; padding: 6px; border: 1.5px solid black; border-top: none; background-color: #f9f9f9; }
                .table-summary-row .summary-item { display: flex; gap: 4px; align-items: baseline; }
                .table-summary-row .label { font-weight: bold; font-size: 9pt; }
                .table-summary-row .value { font-weight: 600; font-size: 10pt; }
                .totals-container { display: flex; justify-content: space-between; margin-top: 8px; width: 100%; break-inside: avoid; page-break-inside: avoid; }
                .left-totals { width: 50%; }
                .right-totals { width: 48%; }
                .left-totals .detail-row { display: flex; justify-content: space-between; padding: 1px 4px; font-size: 10pt; }
                .left-totals .detail-row span:first-child { font-weight: bold; }
                .left-totals .detail-row span:last-child { font-family: "Courier New", monospace; }
                .deductions-group { margin-bottom: 0; }
                .boxed-summary-table { border: 1.5px solid black; border-collapse: collapse; width: 100%; }
                .boxed-summary-table td { border-bottom: 1.5px solid black; padding: 4px 6px; }
                .boxed-summary-table tr.font-bold td { font-weight: bold; }
                .boxed-summary-table tr:last-child td { border-bottom: none; }
                .boxed-summary-table td:first-child { border-right: 1.5px solid black; font-weight: bold; }
                .boxed-summary-table td:last-child { text-align: right; font-family: "Courier New", monospace; }
                .val-total-amount { font-size: 12pt !important; font-weight: bold !important; }
                .val-net-amount { font-size: 12pt !important; font-weight: bold !important; }
                .val-total-deductions { font-weight: bold !important; }
                .print-footer { margin-top: calc(2 * 1.2em); text-align: left; font-size: 10px; font-weight: 800; font-style: italic; }
            `}</style>
        </>
    );
}

export default function PrintPartyReportPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center">Loading Preview...</div>}>
            <PartyReportPrintContent />
        </Suspense>
    );
}
