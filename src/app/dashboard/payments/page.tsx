'use client';
import React, { useState, useRef, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save, Search, X, Pencil, Trash2, Calendar as CalendarIcon, Printer } from 'lucide-react'
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, startOfDay, addDays, subDays } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Transaction } from '@/lib/data';
import ReactSelect from 'react-select';
import { useLoading } from '@/context/LoadingContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Indian number format helper
const formatINR = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PaymentsPage() {
    const {
        customers, customerBalances, payments,
        addPayment, updatePayment, softDeletePayment,
        getCustomerLedger, currentUser,
    } = useData();
    const { toast } = useToast();
    const showAlertDialog = useAlertDialog();
    const { setLoading } = useLoading();
    const [recordDateOpen, setRecordDateOpen] = useState(false);

    // ── Record Payment form ──────────────────────────────────────────────────
    const [recordSelectedCustomerId, setRecordSelectedCustomerId] = useState('');
    const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentMode, setPaymentMode] = useState<"Cash" | "ACC" | "UPI">('Cash');

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
    const [isSaving, setIsSaving] = useState(false);
    const [editPaymentMode, setEditPaymentMode] = useState<"Cash" | "ACC" | "UPI">('Cash');
    const [editRecordDate, setEditRecordDate] = useState<Date | undefined>(new Date());
    const [editDateOpen, setEditDateOpen] = useState(false);
    

    // ── History filters ──────────────────────────────────────────────────────
    const [historyFilterCustomerId, setHistoryFilterCustomerId] = useState('');
    const [historyFilterDate, setHistoryFilterDate] = useState<Date | undefined>();

    const statementRef = useRef<HTMLDivElement>(null);

    const isManager = currentUser?.role === 'MANAGER';

    // ── Reactive statement ───────────────────────────────────────────────────
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

    const recordSelectedCustomer = customers.find(c => c.id === recordSelectedCustomerId);
    const currentBalance = recordSelectedCustomerId ? customerBalances[recordSelectedCustomerId] || 0 : 0;
    const newBalance = currentBalance - (parseFloat(amount) || 0);

    const historySelectedCustomer = customers.find(c => c.id === historySelectedCustomerId);

    const handleSubmitPayment = async () => {
        const paymentAmount = parseFloat(amount);
        if (!recordSelectedCustomerId || !paymentAmount || isNaN(paymentAmount)) {
            toast({
                variant: 'destructive',
                title: 'Invalid Payment',
                description: 'Please select a customer and enter a valid payment amount.',
            });
            return;
        }

        setIsSaving(true);
        setLoading(true, 'Recording Payment...');

        try {
            await addPayment({ customerId: recordSelectedCustomerId, amount: paymentAmount, notes, paymentMode, date: recordDate });
            toast({ title: 'Payment Recorded', description: `₹${formatINR(paymentAmount)} from ${recordSelectedCustomer?.name_en} on ${format(recordDate || new Date(), 'dd-MM-yyyy')}.` });
            setRecordSelectedCustomerId(''); setAmount(''); setNotes(''); setPaymentMode('Cash'); setRecordDate(new Date());
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to record payment.' });
        } finally {
            setIsSaving(false);
            setLoading(false);
        }
    };

    const handleRecordAndPrint = async () => {
        const paymentAmount = parseFloat(amount);
        if (!recordSelectedCustomerId || !paymentAmount || isNaN(paymentAmount)) {
            toast({ variant: 'destructive', title: 'Invalid Payment', description: 'Please select a customer and enter a valid amount.' });
            return;
        }

        setIsSaving(true);
        setLoading(true, 'Recording & Preparing Print...');

        try {
            await addPayment({ customerId: recordSelectedCustomerId, amount: paymentAmount, notes, paymentMode, date: recordDate });

            const printData = {
                customer: recordSelectedCustomer,
                receivedDate: recordDate ? recordDate.toISOString() : new Date().toISOString(),
                receivedCash: paymentAmount,
                paymentMode: paymentMode,
                prevBalance: currentBalance,
                finalBalance: newBalance
            };

            sessionStorage.setItem('paymentReceiptData', JSON.stringify(printData));
            window.open('/print/payment-receipt?paper=thermal', '_blank');

            toast({ title: 'Payment Recorded', description: `₹${formatINR(paymentAmount)} from ${recordSelectedCustomer?.name_en}.` });
            setRecordSelectedCustomerId(''); setAmount(''); setNotes(''); setPaymentMode('Cash'); setRecordDate(new Date());
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to record payment.' });
        } finally {
            setIsSaving(false);
            setLoading(false);
        }
    };

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
        setEditPaymentMode(modeToSet as "Cash" | "ACC" | "UPI");
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
            toast({ title: 'Payment Updated' });
            setEditModalOpen(false);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update payment.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (tx: Transaction) => {
        if (!tx.paymentId) return;
        showAlertDialog({
            title: 'Delete Payment Entry',
            description: `Delete received entry of ₹${formatINR(tx.receivedAmount ?? 0)}? This cannot be undone.`,
            onConfirm: async () => {
                try {
                    await softDeletePayment(tx.paymentId!);
                    toast({ title: 'Payment Deleted', description: 'Entry removed and balances updated.' });
                } catch {
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete payment.' });
                }
            },
        });
    };

    const openPaymentsPrint = async (paper: 'thermal' | 'a4') => {
        if (!historySelectedCustomerId || (!filteredTransactions.length && openingBalanceForLedger === 0)) {
            toast({
                variant: 'destructive',
                title: 'Nothing to Print',
                description: 'Please search for transactions first.',
            });
            return;
        }

        const customer = customers.find(c => c.id === historySelectedCustomerId);

        const printData = {
            customer,
            transactions: filteredTransactions,
            openingBalance: openingBalanceForLedger,
            dateRange: { from: fromDate?.toISOString(), to: toDate?.toISOString() },
        };

        sessionStorage.setItem('paymentsReportData', JSON.stringify(printData));
        window.open(`/print/payments?paper=${paper}`, '_blank');
    };

    const handleDateKeyDown = (e: React.KeyboardEvent, d: Date | undefined, set: (d: Date) => void) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault(); e.stopPropagation();
        const cur = d ? new Date(d) : new Date();
        e.key === 'ArrowUp' ? cur.setDate(cur.getDate() + 1) : cur.setDate(cur.getDate() - 1);
        set(new Date(cur));
    };

    const historyPayments = useMemo(() =>
        (payments || [])
            .filter(p => {
                if (p.isDeleted) return false;
                if (historyFilterCustomerId && p.customerId !== historyFilterCustomerId) return false;
                if (historyFilterDate) {
                    const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                    if (!isSameDay(pDate, historyFilterDate)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const da = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
                const db = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
                return db - da;
            }),
        [payments, historyFilterCustomerId, historyFilterDate]
    );

    const handleHistoryRowDoubleClick = (p: any) => {
        const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
        const day = startOfDay(pDate);
        setHistorySelectedCustomerId(p.customerId);
        setFromDate(day);
        setToDate(day);
        setHasSearched(true);
        setTimeout(() => statementRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const historyFilterCustomer = customers.find(c => c.id === historyFilterCustomerId);

    return (
        <div className="flex flex-col gap-6 md:gap-8 w-full max-w-full overflow-x-hidden">
            <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:grid-cols-2">
                <div className="grid auto-rows-max items-start gap-4 md:gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-xl md:text-2xl">Record Payment</CardTitle>
                            <CardDescription>
                                Record a payment received from a customer to update their balance.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 space-y-5">
                            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end">
                                <div className="grid flex-1 gap-2">
                                    <Label>Customer</Label>
                                    <ReactSelect instanceId="record-customer-select" placeholder="Select customer..." isClearable
                                        options={custOptions}
                                        value={recordSelectedCustomer ? { value: recordSelectedCustomer.id, label: `${recordSelectedCustomer.name_en} (${recordSelectedCustomer.name_ta})` } : null}
                                        onChange={o => setRecordSelectedCustomerId(o ? o.value : '')}
                                        styles={rsStyles} filterOption={filterOption} isDisabled={isManager} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Date</Label>
                                    <Popover open={recordDateOpen} onOpenChange={setRecordDateOpen} modal={true}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full sm:w-[180px] justify-start text-left font-normal h-11",
                                                    !recordDate && "text-muted-foreground"
                                                )}
                                                onFocus={() => { if (!recordDate) setRecordDate(new Date()); }}
                                                onKeyDown={(e) => {
                                                    if (!recordDate) return;
                                                    if (e.key === "ArrowUp") {
                                                        e.preventDefault();
                                                        setRecordDate(addDays(recordDate, 1));
                                                    } else if (e.key === "ArrowDown") {
                                                        e.preventDefault();
                                                        setRecordDate(subDays(recordDate, 1));
                                                    }
                                                }}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {recordDate ? format(recordDate, "dd-MM-yyyy") : "Pick a date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={recordDate} onSelect={(d) => { if (d) setRecordDate(d); setRecordDateOpen(false); }} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {recordSelectedCustomerId && (
                                <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                                    <div><Label>Current Balance</Label><p className="text-xl md:text-2xl font-bold font-mono">₹{formatINR(currentBalance)}</p></div>
                                    <div className="text-right"><Label>New Balance</Label><p className="text-xl md:text-2xl font-bold font-mono">₹{formatINR(newBalance)}</p></div>
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="amount">Payment Amount (₹)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    disabled={!recordSelectedCustomerId || isManager}
                                    className="w-full h-11 text-base"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="payment-mode">Payment Mode</Label>
                                <Select value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)} disabled={!recordSelectedCustomerId || isManager}>
                                    <SelectTrigger id="payment-mode" className="h-11 text-base"><SelectValue placeholder="Select Mode" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="ACC">ACC</SelectItem>
                                        <SelectItem value="UPI">UPI</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="e.g., Cash payment for last week's bill"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    disabled={!recordSelectedCustomerId || isManager}
                                    className="w-full text-base"
                                />
                            </div>

                        </CardContent>
                        <CardFooter className="p-4 md:p-6 pt-0">
                        <div className="flex w-full gap-3">
                            <Button size="lg" onClick={handleSubmitPayment} disabled={!recordSelectedCustomerId || !amount || isManager || isSaving} className="flex-1 h-12 text-base">
                                <Save className="mr-2 h-4 w-4" />
                                Record Payment
                            </Button>
                            <Button size="lg" variant="secondary" onClick={handleRecordAndPrint} disabled={!recordSelectedCustomerId || !amount || isManager || isSaving} className="flex-1 h-12 text-base">
                                    <Printer className="mr-2 h-4 w-4" /> Record & Print
                                </Button>
                        </div>
                        </CardFooter>
                    </Card>
                </div>

                <Card className="lg:row-span-2" ref={statementRef}>
                    <CardHeader>
                        <CardTitle className="font-headline text-xl md:text-2xl">Customer Statement</CardTitle>
                        <CardDescription>
                            View a customer's transaction history for a date range.
                        </CardDescription>
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
                                <Label htmlFor="from-date">From Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={'outline'}
                                            className={cn('w-full justify-start text-left font-normal select-none h-11', !fromDate && 'text-muted-foreground')}
                                            onFocus={() => { if (!fromDate) setFromDate(new Date()) }}
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
                                <Label htmlFor="to-date">To Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={'outline'}
                                            className={cn('w-full justify-start text-left font-normal select-none h-11', !toDate && 'text-muted-foreground')}
                                            onFocus={() => { if (!toDate) setToDate(new Date()) }}
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

                            {/* Desktop Table */}
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
                                                            <TableCell className="text-right font-mono text-green-600">{t.billedAmount != null ? formatINR(t.billedAmount) : ''}</TableCell>
                                                            <TableCell className="text-right font-mono text-red-600">{t.receivedAmount != null ? formatINR(t.receivedAmount) : ''}</TableCell>
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
                                                                <span className="font-mono text-green-600 font-semibold">{formatINR(t.billedAmount)}</span>
                                                            </div>
                                                        )}
                                                        {t.receivedAmount != null && (
                                                            <div className="flex flex-col items-start">
                                                                <span className="text-xs text-muted-foreground">Received (-)</span>
                                                                <span className="font-mono text-red-600 font-semibold">{formatINR(t.receivedAmount)}</span>
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
                    </CardFooter>
                </Card>
            </div>

            <Separator />

            {/* ── Payment History Card ── */}
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Payment History</CardTitle>
                    <CardDescription>Browse all received entries. Double-click to load into the statement.</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-4">
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:gap-4">
                        <div className="grid flex-1 min-w-0 gap-2">
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
                                    <Button variant="outline" className={cn('w-full sm:w-[180px] justify-start text-left font-normal select-none', !historyFilterDate && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {historyFilterDate ? format(historyFilterDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={historyFilterDate} onSelect={setHistoryFilterDate} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button variant="ghost" onClick={() => { setHistoryFilterCustomerId(''); setHistoryFilterDate(undefined); }} className="h-10 shrink-0">
                            <X className="mr-2 h-4 w-4" /> Clear
                        </Button>
                    </div>

                    {/* Desktop Table */}
                    <div className="payments-history-desktop w-full overflow-x-auto rounded-md border border-border">
                        <Table className="w-full table-fixed text-xs md:text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[140px]">Date</TableHead>
                                    <TableHead className="w-[200px]">Customer</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="text-right w-[160px]">Received Amt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historyPayments.length > 0 ? (
                                    historyPayments.map((p, i) => {
                                        const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                                        const cust = customers.find(c => c.id === p.customerId);
                                        return (
                                            <TableRow key={i} className="cursor-pointer hover:bg-muted/50 transition-colors" onDoubleClick={() => handleHistoryRowDoubleClick(p)}>
                                                <TableCell className="py-3">{!isNaN(pDate.getTime()) ? format(pDate, 'dd-MM-yyyy') : '-'}</TableCell>
                                                <TableCell className="py-3 truncate">{cust?.name_en || p.customerId}</TableCell>
                                                <TableCell className="py-3 text-muted-foreground truncate">{p.notes || '-'}</TableCell>
                                                <TableCell className="py-3 text-right font-mono text-red-600 font-semibold whitespace-nowrap">₹{formatINR(p.amount)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">No payment entries found.</TableCell></TableRow>
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
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col items-start gap-1.5">
                                                <span className="font-semibold text-sm">{cust?.name_en || p.customerId}</span>
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{p.paymentMode || 'Cash'}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground mt-0.5">
                                                {!isNaN(pDate.getTime()) ? format(pDate, 'dd-MM-yyyy') : '-'}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">{p.notes || '-'}</div>
                                        <div className="mt-2 flex justify-between text-sm">
                                            <span className="text-muted-foreground">Received:</span>
                                            <span className="font-mono font-semibold text-red-600">₹{formatINR(p.amount)}</span>
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
