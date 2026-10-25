'use client';
import React, { useState, useRef, useMemo } from 'react';
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save, Search, X, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfDay, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Transaction } from '@/lib/data';
import ReactSelect from 'react-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Indian number format helper
const formatINR = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PaymentsPage() {
    const {
        customers, customerBalances, payments,
        updatePayment, softDeletePayment,
        getCustomerLedger, currentUser,
        addStatementPrintHistory, getStatementPrintHistoryForCustomer, deleteStatementPrintHistory
    } = useData();
    const { toast } = useToast();
    const showAlertDialog = useAlertDialog();

    // ── Customer Statement ───────────────────────────────────────────────────
    const [historySelectedCustomerId, setHistorySelectedCustomerId] = useState('');
    const [fromDate, setFromDate] = useState<Date | undefined>();
    const [toDate, setToDate] = useState<Date | undefined>();
    // hasSearched = true triggers reactive computation; reset when filters change
    const [hasSearched, setHasSearched] = useState(false);

    // ── Edit modal ───────────────────────────────────────────────────────────
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editPaymentMode, setEditPaymentMode] = useState<"Cash" | "ACC" | "UPI" | "Bill Payment">('Cash');
    const [editRecordDate, setEditRecordDate] = useState<Date | undefined>(new Date());
    const [editDateOpen, setEditDateOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ── History filters ──────────────────────────────────────────────────────
    const [historyFilterCustomerId, setHistoryFilterCustomerId] = useState('');
    const [historyFilterDate, setHistoryFilterDate] = useState<Date | undefined>();

    const statementRef = useRef<HTMLDivElement>(null);
    const isManager = currentUser?.role === 'MANAGER';

    // ── Reactive statement ───────────────────────────────────────────────────
    // getCustomerLedger is a useCallback whose ref changes whenever `payments`
    // changes in DataContext. So this memo auto-recomputes on every edit/delete.
    const { transactions: filteredTransactions, openingBalance: openingBalanceForLedger } =
        useMemo(() => {
            if (!hasSearched || !historySelectedCustomerId || !fromDate || !toDate) {
                return { transactions: [], openingBalance: 0 };
            }
            return getCustomerLedger(historySelectedCustomerId, { from: fromDate, to: toDate });
        }, [hasSearched, historySelectedCustomerId, fromDate, toDate, getCustomerLedger]);

    // ── Shared ReactSelect config ────────────────────────────────────────────
    const filterOption = (option: any, input: string) => {
        if (!input) return true;
        const isNumeric = /^\d+$/.test(input);
        if (isNumeric) return option.value === input || option.value === String(parseInt(input, 10));
        return option.label.toLowerCase().startsWith(input.toLowerCase());
    };

    const rsStyles = {
        container: (b: any) => ({ ...b, width: '100%' }),
        control: (b: any, s: any) => ({ ...b, backgroundColor: 'hsl(var(--background))', borderColor: s.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))', boxShadow: s.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none', '&:hover': { borderColor: 'hsl(var(--ring))' }, minHeight: '44px' }),
        menu: (b: any) => ({ ...b, backgroundColor: 'hsl(var(--card))', zIndex: 50 }),
        option: (b: any, s: any) => ({ ...b, backgroundColor: s.isSelected ? 'hsl(var(--accent))' : s.isFocused ? 'hsl(var(--muted))' : 'transparent', color: s.isSelected ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))', '&:active': { backgroundColor: 'hsl(var(--accent))' } }),
        singleValue: (b: any) => ({ ...b, color: 'hsl(var(--foreground))' }),
        input: (b: any) => ({ ...b, color: 'hsl(var(--foreground))' }),
        placeholder: (b: any) => ({ ...b, color: 'hsl(var(--muted-foreground))' }),
    };

    const custOptions = customers.map(c => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }));

    // ── Handlers ─────────────────────────────────────────────────────────────



    const handleSearchPayments = () => {
        if (!historySelectedCustomerId) { toast({ variant: 'destructive', title: 'Customer not selected' }); return; }
        if (!fromDate || !toDate) { toast({ variant: 'destructive', title: 'Date range not selected' }); return; }
        setHasSearched(true);
    };

    const handleClearSearch = () => {
        setHistorySelectedCustomerId(''); setFromDate(undefined); setToDate(undefined); setHasSearched(false);
    };

    const handleEditClick = (tx: Transaction) => {
        setEditingTx(tx);
        setEditAmount(String(tx.receivedAmount ?? ''));
        const desc = tx.description || '';
        setEditNotes(desc === 'Payment Received' || desc.endsWith('Payment') ? '' : desc);
        let modeToSet: string = tx.paymentMode || 'Cash';
        if (modeToSet === 'Bank') modeToSet = 'ACC';
        // Bill Payment mode is auto-managed; default to Cash for editing
        if (modeToSet === 'Bill Payment') modeToSet = 'Cash';
        setEditPaymentMode(modeToSet as "Cash" | "ACC" | "UPI" | "Bill Payment");
        setEditRecordDate(tx.date);
        setEditModalOpen(true);
    };

    const handleEditSave = async () => {
        if (!editingTx?.paymentId) return;
        const newAmt = parseFloat(editAmount);
        if (isNaN(newAmt) || newAmt <= 0) {
            toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Amount must be greater than 0.' });
            return;
        }
        setIsSaving(true);
        try {
            await updatePayment(editingTx.paymentId, { amount: newAmt, notes: editNotes, paymentMode: editPaymentMode, date: editRecordDate });
            // Statement auto-refreshes via the reactive useMemo above
            toast({ title: 'Payment Updated' });
            setEditModalOpen(false);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update payment.' });
        } finally {
            setIsSaving(false);
        }
    };

    // Delete
    const handleDeleteClick = (tx: Transaction) => {
        if (!tx.paymentId) return;
        showAlertDialog({
            title: 'Delete Payment Entry',
            description: `Delete received entry of ₹${formatINR(tx.receivedAmount ?? 0)}? This cannot be undone.`,
            onConfirm: async () => {
                try {
                    await softDeletePayment(tx.paymentId!);
                    // Statement auto-refreshes via reactive useMemo
                    toast({ title: 'Payment Deleted', description: 'Entry removed and balances updated.' });
                } catch {
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete payment.' });
                }
            },
        });
    };

    const openPaymentsPrint = (paper: 'thermal' | 'a4' | 'share') => {
        if (!historySelectedCustomerId || (!filteredTransactions.length && openingBalanceForLedger === 0)) {
            toast({ variant: 'destructive', title: 'Nothing to Print', description: 'Please search for transactions first.' });
            return;
        }
        const customer = customers.find(c => c.id === historySelectedCustomerId);
        const totalBilled = filteredTransactions.reduce((sum, t) => sum + (t.billedAmount || 0), 0);
        const printData = { customer, transactions: filteredTransactions, openingBalance: openingBalanceForLedger, dateRange: { from: fromDate?.toISOString(), to: toDate?.toISOString() } };
        sessionStorage.setItem('paymentsReportData', JSON.stringify(printData));

        // Save print history
        if (customer && fromDate && toDate) {
            addStatementPrintHistory({
                customerId: customer.id,
                customerName: customer.name_en,
                fromDate: fromDate,
                toDate: toDate,
                statementAmount: totalBilled,
                printedBy: currentUser?.username || currentUser?.id || 'unknown',
            });
        }

        if (paper === 'share') {
            window.open(`/print/cust-statement?paper=a4&share=true`, '_blank');
        } else {
            window.open(`/print/cust-statement?paper=${paper}`, '_blank');
        }
    };

    const handleDateKeyDown = (e: React.KeyboardEvent, d: Date | undefined, set: (d: Date) => void) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault(); e.stopPropagation();
        const cur = d ? new Date(d) : new Date();
        e.key === 'ArrowUp' ? cur.setDate(cur.getDate() + 1) : cur.setDate(cur.getDate() - 1);
        set(new Date(cur));
    };

    // Print history for selected customer
    const printHistoryRecords = useMemo(() => {
        if (!historySelectedCustomerId) return [];
        return getStatementPrintHistoryForCustomer(historySelectedCustomerId);
    }, [historySelectedCustomerId, getStatementPrintHistoryForCustomer]);

    // Double-click print history row → auto-load that statement
    const handlePrintHistoryDoubleClick = (record: any) => {
        const from = record.fromDate?.toDate ? record.fromDate.toDate() : new Date(record.fromDate);
        const to = record.toDate?.toDate ? record.toDate.toDate() : new Date(record.toDate);
        setHistorySelectedCustomerId(record.customerId);
        setFromDate(from);
        setToDate(to);
        setHasSearched(true);
        setTimeout(() => statementRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const handleDeletePrintHistory = (e: React.MouseEvent, record: any) => {
        e.stopPropagation(); // prevent double click
        if (!record.id) return;
        showAlertDialog({
            title: 'Delete Print History',
            description: `Delete print record for ₹${formatINR(record.statementAmount)}? This cannot be undone.`,
            onConfirm: async () => {
                try {
                    await deleteStatementPrintHistory(record.id);
                    toast({ title: 'Record Deleted', description: 'Print history record removed.' });
                } catch {
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete record.' });
                }
            },
        });
    };

    // History section for received payments
    const historyPayments = useMemo(() => {
        let results = (payments || []).filter(p => !p.isDeleted);
        
        if (historyFilterCustomerId) {
            results = results.filter(p => p.customerId === historyFilterCustomerId);
        }
        if (historyFilterDate) {
            results = results.filter(p => {
                const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                return isSameDay(pDate, historyFilterDate);
            });
        }

        if (!historyFilterCustomerId && !historyFilterDate) {
            const start = startOfWeek(new Date(), { weekStartsOn: 1 });
            const end = endOfWeek(new Date(), { weekStartsOn: 1 });
            results = results.filter(p => {
                if (!p.date) return false;
                const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                return pDate >= start && pDate <= end;
            });
        }

        return results.sort((a, b) => {
            const da = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const db = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return db - da;
        });
    }, [payments, historyFilterCustomerId, historyFilterDate]);

    // Double-click history row → auto-load statement (no search button needed)
    const handleHistoryRowDoubleClick = (p: any) => {
        const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
        const day = startOfDay(pDate);
        setHistorySelectedCustomerId(p.customerId);
        setFromDate(day);
        setToDate(day);
        setHasSearched(true);
        setTimeout(() => statementRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const historySelectedCustomer = customers.find(c => c.id === historySelectedCustomerId);
    const historyFilterCustomer = customers.find(c => c.id === historyFilterCustomerId);

    return (
        <div className="flex flex-col gap-6 md:gap-8 w-full max-w-full overflow-x-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-8 items-start">
                {/* ── Customer Statement (Left) ── */}
                <Card ref={statementRef as any} className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="font-headline text-xl md:text-2xl">Customer Statement</CardTitle>
                        <CardDescription>View a customer's transaction history for a date range.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 space-y-5">
                        <div className="grid gap-2">
                            <Label>Customer</Label>
                            <ReactSelect instanceId="history-customer-select" placeholder="Select customer..." isClearable
                                options={custOptions}
                                value={historySelectedCustomer ? { value: historySelectedCustomer.id, label: `${historySelectedCustomer.name_en} (${historySelectedCustomer.name_ta})` } : null}
                                onChange={o => { setHistorySelectedCustomerId(o ? o.value : ''); setHasSearched(false); }}
                                styles={rsStyles} filterOption={filterOption} />
                        </div>
                        <div className="flex flex-col gap-3 md:flex-row md:items-end">
                            <div className="grid flex-1 gap-2">
                                <Label>From Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal select-none h-11', !fromDate && 'text-muted-foreground')}
                                            onFocus={() => { if (!fromDate) setFromDate(new Date()); }}
                                            onKeyDown={e => handleDateKeyDown(e, fromDate, d => { setFromDate(d); setHasSearched(false); })}
                                            onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {fromDate ? format(fromDate, 'PPP') : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={fromDate} onSelect={d => { setFromDate(d); setHasSearched(false); }} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid flex-1 gap-2">
                                <Label>To Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal select-none h-11', !toDate && 'text-muted-foreground')}
                                            onFocus={() => { if (!toDate) setToDate(new Date()); }}
                                            onKeyDown={e => handleDateKeyDown(e, toDate, d => { setToDate(d); setHasSearched(false); })}
                                            onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {toDate ? format(toDate, 'PPP') : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={toDate} onSelect={d => { setToDate(d); setHasSearched(false); }} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button onClick={handleSearchPayments} className="w-full sm:w-auto h-11 text-base"><Search className="mr-2 h-4 w-4" /> Search</Button>
                            <Button variant="ghost" onClick={handleClearSearch} className="w-full sm:w-auto h-11"><X className="mr-2 h-4 w-4" /> Clear</Button>
                        </div>

                        <Separator />

                        <div className="max-h-72 overflow-y-auto">

                            {/* Desktop Table - hidden on mobile via style tag below */}
                            <div className="payments-desktop-table overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Mode</TableHead>
                                            <TableHead className="text-right">Billed (+)</TableHead>
                                            <TableHead className="text-right">Received (-)</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {hasSearched && historySelectedCustomerId ? (
                                            filteredTransactions.length > 0 || openingBalanceForLedger !== 0 ? (
                                                <>
                                                    <TableRow className="bg-muted/50">
                                                        <TableCell colSpan={5} className="font-semibold text-right pr-6">Opening Balance for Period</TableCell>
                                                        <TableCell className="text-right font-mono font-semibold">{formatINR(openingBalanceForLedger)}</TableCell>
                                                        <TableCell></TableCell>
                                                    </TableRow>
                                                    {filteredTransactions.map((t, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell>{format(t.date, 'dd-MM-yy')}</TableCell>
                                                            <TableCell>{t.description}</TableCell>
                                                            <TableCell>{t.paymentMode || '-'}</TableCell>
                                                            <TableCell className="text-right font-mono text-green-600 font-bold text-base">{t.billedAmount != null ? formatINR(t.billedAmount) : ''}</TableCell>
                                                            <TableCell className="text-right font-mono text-foreground font-bold text-base">{t.receivedAmount != null ? formatINR(t.receivedAmount) : ''}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatINR(t.balance)}</TableCell>
                                                            <TableCell className="text-right">
                                                                {(t.type === 'payment' || t.type === 'both') && t.paymentId && (
                                                                    <div className="flex gap-1 justify-end">
                                                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditClick(t)} title="Edit">
                                                                            <Pencil className="h-3 w-3" />
                                                                        </Button>
                                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(t)} title="Delete">
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </>
                                            ) : (
                                                <TableRow><TableCell colSpan={7} className="h-24 text-center">No transactions found for this criteria.</TableCell></TableRow>
                                            )
                                        ) : (
                                            <TableRow><TableCell colSpan={7} className="h-24 text-center">Select a customer and date range.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Card List - hidden on desktop via style tag below */}
                            <div className="payments-mobile-cards space-y-2">
                                {hasSearched && historySelectedCustomerId ? (
                                    filteredTransactions.length > 0 || openingBalanceForLedger !== 0 ? (
                                        <>
                                            {/* Opening Balance Banner */}
                                            <div className="rounded-md bg-muted/60 px-3 py-2 flex justify-between items-center text-sm">
                                                <span className="font-semibold text-muted-foreground">Opening Balance</span>
                                                <span className="font-mono font-semibold">{formatINR(openingBalanceForLedger)}</span>
                                            </div>
                                            {filteredTransactions.map((t, i) => (
                                                <div key={i} className="rounded-lg border bg-card text-card-foreground p-3 space-y-1.5">
                                                    {/* Top: Date + Description */}
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{format(t.date, 'dd-MM-yy')}</span>
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{t.paymentMode || 'Cash'}</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-right leading-tight">{t.description}</span>
                                                    </div>
                                                    {/* Amounts row */}
                                                    <div className="flex justify-between gap-2 text-sm">
                                                        {t.billedAmount != null && (
                                                            <div className="flex flex-col items-start">
                                                                <span className="text-xs text-muted-foreground">Billed (+)</span>
                                                                <span className="font-mono text-green-600 font-bold text-base">{formatINR(t.billedAmount)}</span>
                                                            </div>
                                                        )}
                                                        {t.receivedAmount != null && (
                                                            <div className="flex flex-col items-start">
                                                                <span className="text-xs text-muted-foreground">Received (-)</span>
                                                                <span className="font-mono text-foreground font-bold text-base">{formatINR(t.receivedAmount)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col items-end ml-auto">
                                                            <span className="text-xs text-muted-foreground">Balance</span>
                                                            <span className="font-mono font-bold">{formatINR(t.balance)}</span>
                                                        </div>
                                                    </div>
                                                    {/* Edit/Delete actions for payment entries */}
                                                    {(t.type === 'payment' || t.type === 'both') && t.paymentId && (
                                                        <div className="flex gap-2 justify-end pt-1">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditClick(t)} title="Edit">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(t)} title="Delete">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
                                            No transactions found for this criteria.
                                        </div>
                                    )
                                ) : (
                                    <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
                                        Select a customer and date range.
                                    </div>
                                )}
                            </div>

                        </div>
                    </CardContent>
                    <CardFooter className="flex-wrap gap-2">
                        <Button onClick={() => openPaymentsPrint('thermal')}>🧾 Print Receipt (106mm)</Button>
                        <Button variant="outline" onClick={() => openPaymentsPrint('a4')}>📄 Print A4 Statement</Button>
                        <Button variant="outline" onClick={() => openPaymentsPrint('share')} className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">📤 Share PDF</Button>
                    </CardFooter>
                </Card>

                {/* ── Last Printed Statements (Right) ── */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="font-headline text-xl md:text-2xl">Last Printed</CardTitle>
                        <CardDescription>Statement print records.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 space-y-5">
                        {historySelectedCustomerId ? (
                            printHistoryRecords.length > 0 ? (
                                <div className="overflow-x-auto rounded-md border">
                                    <Table className="w-full text-sm">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date Printed</TableHead>
                                                <TableHead>From</TableHead>
                                                <TableHead>To</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {printHistoryRecords.map((record, i) => {
                                                const printedDate = record.printedAt?.toDate ? record.printedAt.toDate() : new Date(record.printedAt);
                                                const fromDate = record.fromDate?.toDate ? record.fromDate.toDate() : new Date(record.fromDate);
                                                const toDate = record.toDate?.toDate ? record.toDate.toDate() : new Date(record.toDate);
                                                return (
                                                    <TableRow key={record.id || i} className="cursor-pointer hover:bg-muted/50" onDoubleClick={() => handlePrintHistoryDoubleClick(record)}>
                                                        <TableCell className="whitespace-nowrap">{!isNaN(printedDate.getTime()) ? format(printedDate, 'dd-MM-yy') : '-'}</TableCell>
                                                        <TableCell className="whitespace-nowrap">{!isNaN(fromDate.getTime()) ? format(fromDate, 'dd-MM-yy') : '-'}</TableCell>
                                                        <TableCell className="whitespace-nowrap">{!isNaN(toDate.getTime()) ? format(toDate, 'dd-MM-yy') : '-'}</TableCell>
                                                        <TableCell className="text-right font-mono font-semibold whitespace-nowrap">₹{formatINR(record.statementAmount)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => handleDeletePrintHistory(e, record)} title="Delete">
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="h-24 flex items-center justify-center text-sm text-muted-foreground rounded-lg border">
                                    No print history found.
                                </div>
                            )
                        ) : (
                            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground rounded-lg border text-center p-2">
                                Select a customer to view history.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Separator />

            {/* ── Payment History ── */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Payment History</CardTitle>
                    <CardDescription>Browse all received entries.</CardDescription>
                    {!historyFilterCustomerId && !historyFilterDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Showing current week's payments (Mon–Sun)
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end">
                        <div className="grid flex-1 gap-2">
                            <Label>Customer</Label>
                            <ReactSelect instanceId="history-filter-customer"
                                options={custOptions}
                                value={historyFilterCustomer ? { value: historyFilterCustomer.id, label: `${historyFilterCustomer.name_en} (${historyFilterCustomer.name_ta})` } : null}
                                onChange={o => setHistoryFilterCustomerId(o ? o.value : '')}
                                isClearable placeholder="Filter by customer..." styles={rsStyles} filterOption={filterOption} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal select-none h-11', !historyFilterDate && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {historyFilterDate ? format(historyFilterDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={historyFilterDate} onSelect={setHistoryFilterDate} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button variant="ghost" onClick={() => { setHistoryFilterCustomerId(''); setHistoryFilterDate(undefined); }}>
                            <X className="mr-2 h-4 w-4" /> Clear
                        </Button>
                    </div>

                    {/* Desktop Table */}
                    <div className="payments-history-desktop overflow-x-auto rounded-md border">
                        <Table className="w-full min-w-[500px] text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="text-right">Received Amt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historyPayments.length > 0 ? (
                                    historyPayments.map((p, i) => {
                                        const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                                        const cust = customers.find(c => c.id === p.customerId);
                                        return (
                                            <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onDoubleClick={() => handleHistoryRowDoubleClick(p)}>
                                                <TableCell>{!isNaN(pDate.getTime()) ? format(pDate, 'dd-MM-yyyy') : '-'}</TableCell>
                                                <TableCell>{cust?.name_en || p.customerId}</TableCell>
                                                <TableCell>
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                                        {p.paymentMode || 'Cash'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">{p.notes || '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-foreground font-bold text-base">₹{formatINR(p.amount)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No payment entries found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card List */}
                    <div className="payments-history-mobile space-y-3">
                        {historyPayments.length > 0 ? (
                            historyPayments.map((p, i) => {
                                const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                                const cust = customers.find(c => c.id === p.customerId);
                                return (
                                    <div
                                        key={i}
                                        className="rounded-lg border p-3 shadow-sm bg-card text-card-foreground cursor-pointer active:opacity-70"
                                        style={{ minHeight: '80px', padding: '12px' }}
                                        onDoubleClick={() => handleHistoryRowDoubleClick(p)}
                                    >
                                        {/* Top Row: Customer + Date */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col items-start gap-1.5">
                                                <span className="font-semibold text-sm">{cust?.name_en || p.customerId}</span>
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{p.paymentMode || 'Cash'}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground mt-0.5">
                                                {!isNaN(pDate.getTime()) ? format(pDate, 'dd-MM-yyyy') : '-'}
                                            </span>
                                        </div>
                                        {/* Notes - always visible */}
                                        <div className="mt-1 text-xs text-muted-foreground">{p.notes || '-'}</div>
                                        {/* Amount */}
                                        <div className="mt-2 flex justify-between text-sm">
                                            <span className="text-muted-foreground">Received:</span>
                                            <span className="font-mono font-bold text-base text-foreground">₹{formatINR(p.amount)}</span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground rounded-lg border">
                                No payment entries found.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Edit Modal ── */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Received Entry</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-amount">Amount (₹)</Label>
                                <Input id="edit-amount" type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} autoFocus onFocus={e => e.target.select()} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Date</Label>
                                <Popover open={editDateOpen} onOpenChange={setEditDateOpen} modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal select-none h-10', !editRecordDate && 'text-muted-foreground')}
                                            onFocus={() => { if (!editRecordDate) setEditRecordDate(new Date()); }}
                                            onKeyDown={e => handleDateKeyDown(e, editRecordDate, setEditRecordDate)}
                                            onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {editRecordDate ? format(editRecordDate, 'dd-MM-yyyy') : <span>Pick</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={editRecordDate} onSelect={(d) => { if (d) setEditRecordDate(d); setEditDateOpen(false); }} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-payment-mode">Payment Mode</Label>
                            <Select value={editPaymentMode} onValueChange={(v: any) => setEditPaymentMode(v)}>
                                <SelectTrigger id="edit-payment-mode"><SelectValue placeholder="Select Mode" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="ACC">ACC</SelectItem>
                                    <SelectItem value="UPI">UPI</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-notes">Notes</Label>
                            <Textarea id="edit-notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Optional note" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditModalOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleEditSave} disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4" />{isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
