'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Printer, Share2, Search as SearchIcon, Loader2 } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import ReactSelect from 'react-select';
import { Timestamp } from 'firebase/firestore';
import { useLoading } from '@/context/LoadingContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { PartyBill, getPartyItemQty, getPartyItemUom, isLegacyPartyItem } from '@/lib/data';

export default function PartyReportsPage() {
    const { parties, partyBills } = useData();
    const { toast } = useToast();
    const { setLoading } = useLoading();

    const [selectedPartyId, setSelectedPartyId] = useState<string>('');
    const [fromDate, setFromDate] = useState<Date | undefined>();
    const [toDate, setToDate] = useState<Date | undefined>();
    const [reportData, setReportData] = useState<{ bills: PartyBill[]; party: any; dateRange: { from: Date; to: Date } } | null>(null);
    const [isShareLoading, setIsShareLoading] = useState(false);

    const reactSelectStyles = {
        container: (b: any) => ({ ...b, width: '100%' }),
        control: (b: any, s: any) => ({ ...b, backgroundColor: 'hsl(var(--background))', borderColor: s.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))', boxShadow: s.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none', minHeight: '44px', '&:hover': { borderColor: 'hsl(var(--ring))' } }),
        menu: (b: any) => ({ ...b, backgroundColor: 'hsl(var(--card))', zIndex: 50 }),
        option: (b: any, s: any) => ({ ...b, backgroundColor: s.isSelected ? 'hsl(var(--accent))' : s.isFocused ? 'hsl(var(--muted))' : 'transparent', color: s.isSelected ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))', '&:active': { backgroundColor: 'hsl(var(--accent))' } }),
        singleValue: (b: any) => ({ ...b, color: 'hsl(var(--foreground))' }),
        input: (b: any) => ({ ...b, color: 'hsl(var(--foreground))' }),
        placeholder: (b: any) => ({ ...b, color: 'hsl(var(--muted-foreground))' }),
    };

    const handleDateKeyDown = (e: React.KeyboardEvent, cur: Date | undefined, set: (d: Date) => void) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault(); e.stopPropagation();
        const d = cur ? new Date(cur) : new Date();
        d.setDate(d.getDate() + (e.key === 'ArrowUp' ? 1 : -1));
        set(d);
    };

    const handleSearch = () => {
        if (!selectedPartyId) { toast({ variant: 'destructive', title: 'Select a party' }); return; }
        if (!fromDate || !toDate) { toast({ variant: 'destructive', title: 'Select a date range' }); return; }
        setLoading(true, 'Generating report...');
        try {
            const from = startOfDay(fromDate);
            const to = endOfDay(toDate);
            const party = parties.find(p => p.id === selectedPartyId);
            const filtered = (partyBills || []).filter(bill => {
                if (bill.partyId !== selectedPartyId) return false;
                const d = bill.date instanceof Timestamp ? bill.date.toDate() : new Date(bill.date as any);
                return d >= from && d <= to;
            }).sort((a, b) => {
                const da = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date as any);
                const db = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date as any);
                return da.getTime() - db.getTime();
            });
            if (filtered.length === 0) { toast({ variant: 'destructive', title: 'No bills found for this range' }); setReportData(null); }
            else setReportData({ bills: filtered, party, dateRange: { from: fromDate, to: toDate } });
        } finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (!reportData) return;
        sessionStorage.setItem('partyReportData', JSON.stringify(reportData));
        window.open('/print/party-report', '_blank');
    };

    const handleSharePDF = async () => {
        if (!reportData) return;
        sessionStorage.setItem('partyReportData', JSON.stringify(reportData));
        setIsShareLoading(true);
        window.open('/print/party-report?share=pdf', '_blank');
        await new Promise(r => setTimeout(r, 500));
        setIsShareLoading(false);
    };

    const totalAmount = reportData?.bills.reduce((s, b) => s + (b.totalAmount || 0), 0) ?? 0;
    const totalDeductions = reportData?.bills.reduce((s, b) => s + (b.totalDeductions || 0), 0) ?? 0;
    const netAmount = reportData?.bills.reduce((s, b) => s + (b.netAmount || 0), 0) ?? 0;
    const totalBox = reportData?.bills.reduce((s, b) => s + (b.totalBox || 0), 0) ?? 0;
    const fmt = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const shareBtnClass = 'border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950';

    return (
        <div className="flex flex-col gap-6 pb-8 w-full max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-headline font-bold text-foreground">Party Reports</h1>
                <p className="text-muted-foreground text-sm mt-1">Generate party bill reports by date range.</p>
            </div>
            <Card className="section-box">
                <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="grid gap-2">
                        <Label>Party Name</Label>
                        <ReactSelect
                            instanceId="party-report-select"
                            placeholder="Select party..."
                            isClearable
                            options={parties.map(p => ({ value: p.id, label: p.name }))}
                            value={parties.map(p => ({ value: p.id, label: p.name })).find(p => p.value === selectedPartyId) || null}
                            onChange={(o) => { setSelectedPartyId(o ? o.value : ''); setReportData(null); }}
                            styles={reactSelectStyles}
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[{ label: 'From Date', val: fromDate, set: setFromDate }, { label: 'To Date', val: toDate, set: setToDate }].map(({ label, val, set }) => (
                            <div key={label} className="grid gap-2">
                                <Label>{label}</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal select-none', !val && 'text-muted-foreground')}
                                            onFocus={() => { if (!val) set(new Date()); }}
                                            onKeyDown={(e) => handleDateKeyDown(e, val, set as (d: Date) => void)}
                                            onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {val ? format(val, 'PPP') : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={val} onSelect={(d) => { (set as any)(d ?? undefined); setReportData(null); }} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
                        <Button onClick={handleSearch} className="w-full sm:flex-1 h-[44px]"><SearchIcon className="mr-2 h-4 w-4" />Search</Button>
                        <Button variant="outline" onClick={handlePrint} disabled={!reportData} className="w-full sm:flex-1 h-[44px]"><Printer className="mr-2 h-4 w-4" />Print</Button>
                        <Button variant="outline" onClick={handleSharePDF} disabled={!reportData || isShareLoading} className={`w-full sm:flex-1 h-[44px] ${shareBtnClass}`}>
                            {isShareLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</> : <><Share2 className="mr-2 h-4 w-4" />Share (PDF)</>}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {reportData && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle className="text-lg">Party Report — {reportData.party?.name}</CardTitle>
                        <CardDescription>{format(reportData.dateRange.from, 'dd/MM/yyyy')} to {format(reportData.dateRange.to, 'dd/MM/yyyy')} · {reportData.bills.length} bill(s)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table className="text-base">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-3 px-4 text-base font-semibold">Date</TableHead>
                                        <TableHead className="py-3 px-4 text-base font-semibold">Item</TableHead>
                                        <TableHead className="py-3 px-4 text-base font-semibold text-right">Qty</TableHead>
                                        <TableHead className="py-3 px-4 text-base font-semibold text-right">UOM</TableHead>
                                        <TableHead className="py-3 px-4 text-base font-semibold text-right">Rate</TableHead>
                                        <TableHead className="py-3 px-4 text-base font-semibold text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.bills.flatMap((bill: PartyBill, billIdx: number) => {
                                        const d = bill.date instanceof Timestamp ? (bill.date as any).toDate() : new Date(bill.date as any);
                                        const items = bill.items || [];
                                        const rows = items.map((item: any, itemIdx: number) => (
                                            <TableRow key={`${bill.id}-${itemIdx}`} className={itemIdx === 0 && billIdx > 0 ? 'border-t-2 border-border' : ''}>
                                                <TableCell className="whitespace-nowrap align-top font-semibold text-base py-3 px-4">
                                                    {itemIdx === 0 ? format(d, 'dd-MM-yyyy') : ''}
                                                </TableCell>
                                                <TableCell className="text-base py-3 px-4">{item.productName}</TableCell>
                                                <TableCell className="text-right font-mono text-base py-3 px-4">{getPartyItemQty(item)}</TableCell>
                                                <TableCell className="text-right font-mono text-base py-3 px-4">{isLegacyPartyItem(item) ? (item.kgs || 0).toFixed(2) : getPartyItemUom(item)}</TableCell>
                                                <TableCell className="text-right font-mono text-base py-3 px-4">{(item.rate || 0).toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-mono text-base py-3 px-4">{fmt(item.amount || 0)}</TableCell>
                                            </TableRow>
                                        ));
                                        // Bill subtotal row
                                        rows.push(
                                            <TableRow key={`${bill.id}-subtotal`} className="bg-muted/50 border-t-2 border-border">
                                                <TableCell colSpan={3} className="text-right text-base font-semibold text-foreground py-3 px-4">
                                                    Bill subtotal &nbsp;<span className="font-normal text-muted-foreground text-sm">(Box: {bill.totalBox}, Kgs: {(bill.totalKgs||0).toFixed(2)})</span>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-base font-medium text-foreground py-3 px-4">{fmt(bill.totalAmount)}</TableCell>
                                                <TableCell className="text-right font-mono text-base font-bold text-foreground py-3 px-4">-{fmt(bill.totalDeductions)}</TableCell>
                                                <TableCell className="text-right font-mono text-base font-bold text-foreground py-3 px-4">{fmt(bill.netAmount)}</TableCell>
                                            </TableRow>
                                        );
                                        return rows;
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        <Separator className="my-4" />
                        <div className="flex flex-col items-end space-y-2 text-base">
                            <div className="w-full max-w-[360px] flex justify-between"><span>Total Boxes:</span><span className="font-mono">{totalBox}</span></div>
                            <div className="w-full max-w-[360px] flex justify-between"><span>Total Bill Amount:</span><span className="font-mono">₹{fmt(totalAmount)}</span></div>
                            <div className="w-full max-w-[360px] flex justify-between"><span>Total Deductions:</span><span className="font-mono">₹{fmt(totalDeductions)}</span></div>
                            <div className="w-full max-w-[360px] flex justify-between font-bold text-lg border-t pt-3"><span>Net Amount:</span><span className="font-mono">₹{fmt(netAmount)}</span></div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 border-t pt-4 bg-muted/20">
                        <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Print</Button>
                        <Button variant="outline" onClick={handleSharePDF} disabled={isShareLoading} className={shareBtnClass}>
                            {isShareLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</> : <><Share2 className="mr-2 h-4 w-4" />Share (PDF)</>}
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
