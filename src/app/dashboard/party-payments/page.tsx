'use client';
import React, { useState, useRef, useMemo } from 'react';
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save, X, Pencil, Trash2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, isSameDay, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Transaction } from '@/lib/data';
import ReactSelect from 'react-select';
import { useLoading } from '@/context/LoadingContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Indian number format helper
const formatINR = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReceivedPage() {
    const {
        parties, partyBalances, partyPayments,
        addPartyPayment, updatePartyPayment, softDeletePartyPayment,
         currentUser,
    } = useData();
    const { toast } = useToast();
    const showAlertDialog = useAlertDialog();
    const { setLoading } = useLoading();

    const [recordSelectedPartyId, setRecordSelectedPartyId] = useState('');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentMode, setPaymentMode] = useState<"Cash" | "ACC" | "UPI">('Cash');
    const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
    const [recordDateOpen, setRecordDateOpen] = useState(false);

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
    const [historyFilterPartyId, setHistoryFilterPartyId] = useState('');
    const [historyFilterDate, setHistoryFilterDate] = useState<Date | undefined>();

    const isManager = currentUser?.role === 'MANAGER';

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

    const custOptions = parties.map(c => ({ value: c.id, label: c.name }));

    // ── Handlers ─────────────────────────────────────────────────────────────
    const recordSelectedParty = parties.find(c => c.id === recordSelectedPartyId);
    const currentBalance = recordSelectedPartyId ? partyBalances[recordSelectedPartyId] || 0 : 0;
    const newBalance = currentBalance - (parseFloat(amount) || 0);

    const handleSubmitPayment = async () => {
        const paymentAmount = parseFloat(amount);
        if (!recordSelectedPartyId || !paymentAmount || isNaN(paymentAmount)) {
            toast({ variant: 'destructive', title: 'Invalid Payment', description: 'Please select a party and enter a valid amount.' });
            return;
        }

        setIsSaving(true);
        setLoading(true, 'Recording Payment...');

        try {
            await addPartyPayment({ partyId: recordSelectedPartyId, amount: paymentAmount, notes, paymentMode, date: recordDate });
            toast({ title: 'Payment Recorded', description: `₹${formatINR(paymentAmount)} from .` });
            setRecordSelectedPartyId(''); setAmount(''); setNotes(''); setPaymentMode('Cash'); setRecordDate(new Date());
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to record payment.' });
        } finally {
            setIsSaving(false);
            setLoading(false);
        }
    };

    const handleRecordAndPrint = async () => {
        const paymentAmount = parseFloat(amount);
        if (!recordSelectedPartyId || !paymentAmount || isNaN(paymentAmount)) {
            toast({ variant: 'destructive', title: 'Invalid Payment', description: 'Please select a party and enter a valid amount.' });
            return;
        }

        setIsSaving(true);
        setLoading(true, 'Recording & Preparing Print...');

        try {
            await addPartyPayment({ partyId: recordSelectedPartyId, amount: paymentAmount, notes, paymentMode, date: recordDate });

            const printData = {
                party: recordSelectedParty,
                receivedDate: recordDate ? recordDate.toISOString() : new Date().toISOString(),
                receivedCash: paymentAmount,
                paymentMode: paymentMode,
                prevBalance: currentBalance,
                finalBalance: newBalance
            };

            localStorage.setItem('partyPaymentReceiptData', JSON.stringify(printData));
            window.open('/print/party-payment?paper=thermal', '_blank');

            toast({ title: 'Payment Recorded', description: `₹${formatINR(paymentAmount)} from .` });
            setRecordSelectedPartyId(''); setAmount(''); setNotes(''); setPaymentMode('Cash'); setRecordDate(new Date());
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to record payment.' });
        } finally {
            setIsSaving(false);
            setLoading(false);
        }
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
            await updatePartyPayment(editingTx.paymentId, { amount: newAmt, notes: editNotes, paymentMode: editPaymentMode, date: editRecordDate });
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
                    await softDeletePartyPayment(tx.paymentId!);
                    toast({ title: 'Payment Deleted', description: 'Entry removed and balances updated.' });
                } catch {
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete payment.' });
                }
            },
        });
    };

    const handleDateKeyDown = (e: React.KeyboardEvent, d: Date | undefined, set: (d: Date) => void) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault(); e.stopPropagation();
        const cur = d ? new Date(d) : new Date();
        e.key === 'ArrowUp' ? cur.setDate(cur.getDate() + 1) : cur.setDate(cur.getDate() - 1);
        set(new Date(cur));
    };

    // History section
    const historyPayments = useMemo(() => {
        let results = (partyPayments || []).filter(p => !p.isDeleted);
        
        if (historyFilterPartyId) {
            results = results.filter(p => p.partyId === historyFilterPartyId);
        }
        if (historyFilterDate) {
            results = results.filter(p => {
                const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                return isSameDay(pDate, historyFilterDate);
            });
        }

        if (!historyFilterPartyId && !historyFilterDate) {
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
    }, [partyPayments, historyFilterPartyId, historyFilterDate]);

    const historyFilterParty = parties.find(c => c.id === historyFilterPartyId);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6 md:gap-8 w-full max-w-full overflow-x-hidden">

            {/* ── Record Payment ── */}
            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="space-y-1.5">
                        <CardTitle className="font-headline text-xl md:text-2xl">Record Payment</CardTitle>
                        <CardDescription>Record a payment made to a party to update their balance.</CardDescription>
                    </div>
                    <div className="grid gap-2 w-full sm:w-[180px]">
                        <Label>Date</Label>
                        <Popover open={recordDateOpen} onOpenChange={setRecordDateOpen} modal={true}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-11', !recordDate && 'text-muted-foreground')}
                                    onFocus={() => { if (!recordDate) setRecordDate(new Date()); }}
                                    onKeyDown={e => handleDateKeyDown(e, recordDate, setRecordDate)}
                                    onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {recordDate ? format(recordDate, 'dd-MM-yyyy') : <span>Pick</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar mode="single" selected={recordDate} onSelect={(d) => { if (d) setRecordDate(d); setRecordDateOpen(false); }} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-5">
                    <div className="grid gap-2">
                        <Label>Party</Label>
                        <ReactSelect instanceId="record-party-select" placeholder="Select party..." isClearable
                            options={custOptions}
                            value={recordSelectedParty ? { value: recordSelectedParty.id, label: recordSelectedParty.name } : null}
                            onChange={o => setRecordSelectedPartyId(o ? o.value : '')}
                            styles={rsStyles} filterOption={filterOption} isDisabled={isManager} />
                    </div>
                    {recordSelectedPartyId && (
                        <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                            <div><Label>Current Balance</Label><p className="text-xl md:text-2xl font-bold font-mono">₹{formatINR(currentBalance)}</p></div>
                            <div className="text-right"><Label>New Balance</Label><p className="text-xl md:text-2xl font-bold font-mono">₹{formatINR(newBalance)}</p></div>
                        </div>
                    )}
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Payment Amount (₹)</Label>
                        <Input id="amount" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} disabled={!recordSelectedPartyId || isManager} className="w-full h-11 text-base" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="payment-mode">Payment Mode</Label>
                        <Select value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)} disabled={!recordSelectedPartyId || isManager}>
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
                        <Textarea id="notes" placeholder="e.g., Cash payment" value={notes} onChange={e => setNotes(e.target.value)} disabled={!recordSelectedPartyId || isManager} className="w-full text-base" />
                    </div>
                </CardContent>
                <CardFooter className="p-4 md:p-6 pt-0">
                    <div className="flex w-full gap-3">
                        <Button size="lg" onClick={handleSubmitPayment} disabled={!recordSelectedPartyId || !amount || isManager || isSaving} className="flex-1 h-12 text-base">
                            <Save className="mr-2 h-4 w-4" /> Record Payment
                        </Button>
                        <Button size="lg" variant="secondary" onClick={handleRecordAndPrint} disabled={!recordSelectedPartyId || !amount || isManager || isSaving} className="flex-1 h-12 text-base">
                            <Printer className="mr-2 h-4 w-4" /> Record & Print
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            <Separator />

            {/* ── Payment History ── */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Payment History</CardTitle>
                    <CardDescription>Browse all received entries.</CardDescription>
                    {!historyFilterPartyId && !historyFilterDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Showing current week's partyPayments (Mon–Sun)
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end">
                        <div className="grid flex-1 gap-2">
                            <Label>Party</Label>
                            <ReactSelect instanceId="history-filter-party"
                                options={custOptions}
                                value={historyFilterParty ? { value: historyFilterParty.id, label: historyFilterParty.name } : null}
                                onChange={o => setHistoryFilterPartyId(o ? o.value : '')}
                                isClearable placeholder="Filter by party..." styles={rsStyles} filterOption={filterOption} />
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
                        <Button variant="ghost" onClick={() => { setHistoryFilterPartyId(''); setHistoryFilterDate(undefined); }}>
                            <X className="mr-2 h-4 w-4" /> Clear
                        </Button>
                    </div>

                    {/* Desktop Table */}
                    <div className="payments-history-desktop overflow-x-auto rounded-md border">
                        <Table className="w-full min-w-[500px] text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Party</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="text-right">Received Amt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historyPayments.length > 0 ? (
                                    historyPayments.map((p, i) => {
                                        const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                                        const cust = parties.find(c => c.id === p.partyId);
                                        return (
                                            <TableRow key={i} className="cursor-pointer hover:bg-muted/50">
                                                <TableCell>{!isNaN(pDate.getTime()) ? format(pDate, 'dd-MM-yyyy') : '-'}</TableCell>
                                                <TableCell>{cust?.name || p.partyId}</TableCell>
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
                                const cust = parties.find(c => c.id === p.partyId);
                                return (
                                    <div
                                        key={i}
                                        className="rounded-lg border p-3 shadow-sm bg-card text-card-foreground cursor-pointer active:opacity-70"
                                        style={{ minHeight: '80px', padding: '12px' }}
                                    >
                                        {/* Top Row: Party + Date */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col items-start gap-1.5">
                                                <span className="font-semibold text-sm">{cust?.name || p.partyId}</span>
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
