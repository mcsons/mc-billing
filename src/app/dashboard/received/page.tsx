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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

import { Save, Search, Printer, X, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { LiveBillSummary } from '@/lib/data';
import ReactSelect from 'react-select';

export default function ReceivedPage() {
    const { customers, customerBalances, updateBillPayment, currentUser, liveBillSummaries } = useData();
    const { toast } = useToast();

    // State for Record Payment form
    const [recordSelectedCustomerId, setRecordSelectedCustomerId] = useState<string>('');
    const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');

    // State for Received Amount Bill search
    const [historySelectedCustomerId, setHistorySelectedCustomerId] = useState<string>('');
    const [historyDate, setHistoryDate] = useState<Date | undefined>();

    // State for Main History Section
    const [globalHistoryCustomerId, setGlobalHistoryCustomerId] = useState<string>('');
    const [globalHistoryRecDate, setGlobalHistoryRecDate] = useState<Date | undefined>();
    const [globalHistoryBillDate, setGlobalHistoryBillDate] = useState<Date | undefined>();

    const isManager = currentUser?.role === 'MANAGER';

    const reactSelectStyles = {
        control: (baseStyles: any, state: any) => ({
            ...baseStyles,
            backgroundColor: 'hsl(var(--background))',
            borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
            boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
            '&:hover': {
                borderColor: 'hsl(var(--ring))',
            },
        }),
        menu: (baseStyles: any) => ({
            ...baseStyles,
            backgroundColor: 'hsl(var(--card))',
            zIndex: 50,
        }),
        option: (baseStyles: any, state: any) => ({
            ...baseStyles,
            backgroundColor: state.isSelected
                ? 'hsl(var(--accent))'
                : state.isFocused
                ? 'hsl(var(--muted))'
                : 'transparent',
            color: state.isSelected
                ? 'hsl(var(--accent-foreground))'
                : 'hsl(var(--foreground))',
            '&:active': {
                backgroundColor: 'hsl(var(--accent))',
            },
        }),
        singleValue: (baseStyles: any) => ({
            ...baseStyles,
            color: 'hsl(var(--foreground))',
        }),
        input: (baseStyles: any) => ({
            ...baseStyles,
            color: 'hsl(var(--foreground))',
        }),
        placeholder: (baseStyles: any) => ({
            ...baseStyles,
            color: 'hsl(var(--muted-foreground))',
        }),
    };

    const targetBill = useMemo(() => {
        if (!recordSelectedCustomerId || !recordDate) return null;
        return (liveBillSummaries || []).find(b => {
            if (b.customerId !== recordSelectedCustomerId) return false;
            const bDate = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date)) : null;
            if (!bDate) return false;
            return isSameDay(bDate, recordDate);
        });
    }, [liveBillSummaries, recordSelectedCustomerId, recordDate]);

    const recordSelectedCustomer = customers.find(c => c.id === recordSelectedCustomerId);
    const billAmount = targetBill ? targetBill.amount : 0;
    const currentFinalBalance = recordSelectedCustomerId ? (customerBalances[recordSelectedCustomerId] || 0) : 0;
    const newFinalBalance = recordSelectedCustomerId ? currentFinalBalance - (parseFloat(amount) || 0) : 0;

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

        if (!targetBill) {
             toast({
                variant: 'destructive',
                title: 'Bill Not Found',
                description: 'No bill found for this customer on the selected date.',
            });
            return;
        }

        await updateBillPayment(targetBill.billNo, paymentAmount, notes);

        toast({
            title: 'Payment Recorded',
            description: `₹${paymentAmount.toFixed(2)} payment applied to bill ${targetBill.billNo} for ${recordSelectedCustomer?.name_en}.`,
        });

        // Reset form
        setRecordSelectedCustomerId('');
        setRecordDate(new Date());
        setAmount('');
        setNotes('');
    };

    const handleClearSearch = () => {
        setHistorySelectedCustomerId('');
        setHistoryDate(undefined);
    };

    const handleGlobalClearSearch = () => {
        setGlobalHistoryCustomerId('');
        setGlobalHistoryRecDate(undefined);
        setGlobalHistoryBillDate(undefined);
    };

    // Filtered bills for "Received Amount Bill"
    const filteredReceivedBills = useMemo(() => {
        if (!historySelectedCustomerId || !historyDate) return [];
        return (liveBillSummaries || []).filter(b => {
            if (b.customerId !== historySelectedCustomerId) return false;
            const bDate = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date)) : null;
            if (!bDate) return false;
            return isSameDay(bDate, historyDate) && (b.paidAmount && b.paidAmount > 0);
        });
    }, [liveBillSummaries, historySelectedCustomerId, historyDate]);

    // Filtered bills for "History Section"
    const globalHistoryBills = useMemo(() => {
        let bills = (liveBillSummaries || []).filter(b => b.paidAmount && b.paidAmount > 0);
        
        if (globalHistoryCustomerId) {
            bills = bills.filter(b => b.customerId === globalHistoryCustomerId);
        }
        
        if (globalHistoryBillDate) {
            bills = bills.filter(b => {
                const bDate = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date((b.date as any).seconds ? (b.date as any).seconds * 1000 : b.date)) : null;
                return bDate && isSameDay(bDate, globalHistoryBillDate);
            });
        }

        if (globalHistoryRecDate) {
            bills = bills.filter(b => {
                const rDateRaw = (b as any).updatedAt || (b as any).createdAt || b.date;
                const rDate = rDateRaw ? (rDateRaw.toDate ? rDateRaw.toDate() : new Date(rDateRaw.seconds ? rDateRaw.seconds * 1000 : rDateRaw)) : null;
                return rDate && isSameDay(rDate, globalHistoryRecDate);
            });
        }
        
        return bills.sort((a, b) => {
            const rDateRawA = (a as any).updatedAt || (a as any).createdAt || a.date;
            const rDateA = rDateRawA ? (rDateRawA.toDate ? rDateRawA.toDate() : new Date(rDateRawA.seconds ? rDateRawA.seconds * 1000 : rDateRawA)).getTime() : 0;
            const rDateRawB = (b as any).updatedAt || (b as any).createdAt || b.date;
            const rDateB = rDateRawB ? (rDateRawB.toDate ? rDateRawB.toDate() : new Date(rDateRawB.seconds ? rDateRawB.seconds * 1000 : rDateRawB)).getTime() : 0;
            return rDateB - rDateA; // Descending
        });
    }, [liveBillSummaries, globalHistoryCustomerId, globalHistoryRecDate, globalHistoryBillDate]);

    const openPaymentsPrint = async (paper: 'thermal' | 'a4') => {
        if (!historySelectedCustomerId || !historyDate || filteredReceivedBills.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Nothing to Print',
                description: 'Please select a customer and date with received bills.',
            });
            return;
        }

        const customer = customers.find(c => c.id === historySelectedCustomerId);

        const printData = {
            customer,
            bills: filteredReceivedBills.map(b => {
                let safeDate = null;
                if (b.date) {
                    if (b.date.toDate) safeDate = b.date.toDate().toISOString();
                    else if (b.date instanceof Date) safeDate = b.date.toISOString();
                    else if (typeof b.date === 'string') safeDate = new Date(b.date).toISOString();
                    else if (b.date.seconds) safeDate = new Date(b.date.seconds * 1000).toISOString();
                }
                return { ...b, date: safeDate };
            }),
            date: historyDate?.toISOString(),
            currentCustomerBalance: customerBalances[historySelectedCustomerId] || 0
        };

        sessionStorage.setItem('receivedReportData', JSON.stringify(printData));
        window.open(
            `/print/received?paper=${paper}`,
            '_blank'
        );
    };

    const handleDateKeyDown = (e: React.KeyboardEvent, currentDate: Date | undefined, setDateFn: (d: Date) => void) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            const current = currentDate ? new Date(currentDate) : new Date();
            if (e.key === 'ArrowUp') {
                current.setDate(current.getDate() + 1);
            } else {
                current.setDate(current.getDate() - 1);
            }
            setDateFn(new Date(current));
        }
    };

    const historySelectedCustomer = customers.find(c => c.id === historySelectedCustomerId);
    const globalSelectedCustomer = customers.find(c => c.id === globalHistoryCustomerId);

    const onRowDoubleClick = (record: LiveBillSummary) => {
        setHistorySelectedCustomerId(record.customerId);
        const bDate = record.date ? ((record.date as any).toDate ? (record.date as any).toDate() : new Date(record.date)) : null;
        if (bDate) setHistoryDate(bDate);
        document.getElementById("received-amount-bill")?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="flex flex-col gap-6 md:gap-8 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden">
            <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:grid-cols-2">
                <div className="grid auto-rows-max items-start gap-4 md:gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">Record Payment</CardTitle>
                            <CardDescription>
                                Record a payment received from a customer to update their balance.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-2">
                                <Label htmlFor="customer-record">Customer</Label>
                                <ReactSelect
                                    instanceId="record-customer-select"
                                    placeholder="Select customer..."
                                    isClearable
                                    options={customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})`}))}
                                    value={ recordSelectedCustomer ? { value: recordSelectedCustomer.id, label: `${recordSelectedCustomer.name_en} (${recordSelectedCustomer.name_ta})` } : null }
                                    onChange={(option) => setRecordSelectedCustomerId(option ? option.value : '')}
                                    styles={reactSelectStyles}
                                    filterOption={(option, input) => {
                                        if (!input) return true;
                                        const isNumeric = /^\d+$/.test(input);
                                        if (isNumeric) return option.value === input || option.value === String(parseInt(input, 10));
                                        return option.label.toLowerCase().startsWith(input.toLowerCase());
                                    }}
                                    isDisabled={isManager}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="record-date">Bill Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={'outline'}
                                            className={cn('w-full justify-start text-left font-normal select-none', !recordDate && 'text-muted-foreground')}
                                            onFocus={() => { if (!recordDate) setRecordDate(new Date()); }}
                                            onKeyDown={(e) => handleDateKeyDown(e, recordDate, setRecordDate as (d: Date) => void)}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {recordDate ? format(recordDate, 'PPP') : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={recordDate} onSelect={setRecordDate} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {recordSelectedCustomerId && targetBill && (
                                <div className="grid grid-cols-3 gap-4 rounded-lg border p-4">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Bill Amount</Label>
                                        <p className="text-lg font-bold font-mono">₹{billAmount.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Current Final Bal</Label>
                                        <p className="text-lg font-bold font-mono">₹{currentFinalBalance.toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                        <Label className="text-xs text-muted-foreground">New Final Bal</Label>
                                        <p className="text-lg font-bold font-mono text-primary">₹{newFinalBalance.toFixed(2)}</p>
                                    </div>
                                </div>
                            )}

                            {recordSelectedCustomerId && !targetBill && (
                                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                                    No bill found for the selected customer on this date.
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
                                    disabled={!recordSelectedCustomerId || !targetBill || isManager}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="e.g., Cash payment for last week's bill"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    disabled={!recordSelectedCustomerId || !targetBill || isManager}
                                />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button size="lg" onClick={handleSubmitPayment} disabled={!recordSelectedCustomerId || !targetBill || !amount || isManager}>
                                <Save className="mr-2 h-4 w-4" />
                                Record Payment
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <Card className="lg:row-span-2" id="received-amount-bill">
                    <CardHeader>
                        <CardTitle className="font-headline">Received Amount Bill</CardTitle>
                        <CardDescription>
                            View received entries mapped to bills for a specific date.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="customer-history">Customer</Label>
                                <ReactSelect
                                    instanceId="history-customer-select"
                                    placeholder="Select customer..."
                                    isClearable
                                    options={customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }))}
                                    value={ historySelectedCustomer ? { value: historySelectedCustomer.id, label: `${historySelectedCustomer.name_en} (${historySelectedCustomer.name_ta})` } : null }
                                    onChange={(option) => setHistorySelectedCustomerId(option ? option.value : '')}
                                    styles={reactSelectStyles}
                                    filterOption={(option, input) => option.label.toLowerCase().includes(input.toLowerCase()) || option.value.toLowerCase().includes(input.toLowerCase()) }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="history-date">Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={'outline'}
                                            className={cn('w-full justify-start text-left font-normal select-none', !historyDate && 'text-muted-foreground')}
                                            onFocus={() => { if (!historyDate) setHistoryDate(new Date()); }}
                                            onKeyDown={(e) => handleDateKeyDown(e, historyDate, setHistoryDate as (d: Date) => void)}
                                            onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {historyDate ? format(historyDate, 'PPP') : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handleClearSearch}><X className="mr-2 h-4 w-4" /> Clear</Button>
                        </div>

                        <Separator />

                        <div className="hidden md:block overflow-x-auto rounded-md border">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>BillDate</TableHead>
                                            <TableHead>BillNo</TableHead>
                                            <TableHead className="text-right">Bill Amt</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                            <TableHead className="text-right">Recieved</TableHead>
                                            <TableHead className="text-right">Final Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historySelectedCustomerId && historyDate ? (
                                            filteredReceivedBills.length > 0 ? (
                                                filteredReceivedBills.map((b, i) => {
                                                    const bDate = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date((b.date as any).seconds ? (b.date as any).seconds * 1000 : b.date)) : null;
                                                    const receivedAmount = b.paidAmount || 0;
                                                    const finalBalance = customerBalances[b.customerId] || 0;
                                                    const prevBalance = finalBalance + receivedAmount;
                                                    return (
                                                        <TableRow key={i}>
                                                            <TableCell>{bDate && !isNaN(bDate.getTime()) ? format(bDate, 'dd-MM-yy') : '-'}</TableCell>
                                                            <TableCell>{b.billNo}</TableCell>
                                                            <TableCell className="text-right font-mono text-muted-foreground">{b.amount.toFixed(2)}</TableCell>
                                                            <TableCell className="text-right font-mono text-muted-foreground">{prevBalance.toFixed(2)}</TableCell>
                                                            <TableCell className="text-right font-mono text-green-600 font-semibold">{receivedAmount.toFixed(2)}</TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-primary">{finalBalance.toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center">No received entries mapped to bills found.</TableCell>
                                                </TableRow>
                                            )
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center">Select a customer and date.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-wrap gap-2">
                        <Button onClick={() => openPaymentsPrint('thermal')} disabled={!historySelectedCustomerId || !historyDate || filteredReceivedBills.length === 0}>
                            🧾 Print Receipt (106mm)
                        </Button>
                        <Button variant="outline" onClick={() => openPaymentsPrint('a4')} disabled={!historySelectedCustomerId || !historyDate || filteredReceivedBills.length === 0}>
                            📄 Print A4 Statement
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <Separator />

            {/* History Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Received History</CardTitle>
                    <CardDescription>Search and view past received entries. Double-click to load.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end">
                        <div className="grid flex-1 gap-2">
                            <Label>Customer</Label>
                            <ReactSelect
                                instanceId="global-history-customer"
                                options={customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }))}
                                value={ globalSelectedCustomer ? { value: globalSelectedCustomer.id, label: `${globalSelectedCustomer.name_en} (${globalSelectedCustomer.name_ta})` } : null }
                                onChange={(option) => setGlobalHistoryCustomerId(option ? option.value : '')}
                                isClearable
                                placeholder="Filter by customer..."
                                styles={reactSelectStyles}
                                filterOption={(option, input) => {
                                    if (!input) return true;
                                    const isNumeric = /^\d+$/.test(input);
                                    if (isNumeric) return option.value === input || option.value === String(parseInt(input, 10));
                                    return option.label.toLowerCase().startsWith(input.toLowerCase());
                                }}
                            />
                        </div>
                        <div className="grid gap-2">
                        <Label>Rec. Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={'outline'}
                                        className={cn('w-full sm:w-[180px] justify-start text-left font-normal select-none', !globalHistoryRecDate && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {globalHistoryRecDate ? format(globalHistoryRecDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={globalHistoryRecDate} onSelect={setGlobalHistoryRecDate} /></PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid gap-2">
                            <Label>Bill Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={'outline'}
                                        className={cn('w-full sm:w-[180px] justify-start text-left font-normal select-none', !globalHistoryBillDate && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {globalHistoryBillDate ? format(globalHistoryBillDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={globalHistoryBillDate} onSelect={setGlobalHistoryBillDate} /></PopoverContent>
                            </Popover>
                        </div>
                        <Button variant="ghost" onClick={handleGlobalClearSearch}><X className="mr-2 h-4 w-4" /> Clear</Button>
                    </div>

                    <div className="hidden md:block overflow-x-auto rounded-md border">
                        <Table className="w-full min-w-[600px] text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="px-4">Rec. Date</TableHead>
                                    <TableHead className="px-4">Bill Date</TableHead>
                                    <TableHead className="px-4">Customer</TableHead>
                                    <TableHead className="px-4 text-right">Received Amt</TableHead>
                                    <TableHead className="px-4 text-right">Final Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {globalHistoryBills.length > 0 ? (
                                    globalHistoryBills.map((bill, index) => {
                                        const bDate = bill.date ? ((bill.date as any).toDate ? (bill.date as any).toDate() : new Date((bill.date as any).seconds ? (bill.date as any).seconds * 1000 : bill.date)) : null;
                                        const rDateRaw = (bill as any).updatedAt || (bill as any).createdAt || bill.date;
                                        const rDate = rDateRaw ? (rDateRaw.toDate ? rDateRaw.toDate() : new Date(rDateRaw.seconds ? rDateRaw.seconds * 1000 : rDateRaw)) : null;
                                        
                                        const receivedAmount = bill.paidAmount || 0;
                                        const finalBalance = customerBalances[bill.customerId] || 0;
                                        const prevBalance = finalBalance + receivedAmount;
                                        return (
                                            <TableRow key={index} className="cursor-pointer hover:bg-muted/50" onDoubleClick={() => onRowDoubleClick(bill)}>
                                                <TableCell className="px-4">{rDate && !isNaN(rDate.getTime()) ? format(rDate, 'dd-MM-yyyy') : '-'}</TableCell>
                                                <TableCell className="px-4">{bDate && !isNaN(bDate.getTime()) ? format(bDate, 'dd-MM-yyyy') : '-'}</TableCell>
                                                <TableCell className="px-4 whitespace-normal break-words">{bill.customerName}</TableCell>
                                                <TableCell className="px-4 text-right font-mono text-green-600 font-semibold">₹{receivedAmount.toFixed(2)}</TableCell>
                                                <TableCell className="px-4 text-right font-mono font-bold">₹{finalBalance.toFixed(2)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card List */}
                    <div className="block md:hidden space-y-3">
                        {globalHistoryBills.length > 0 ? (
                            globalHistoryBills.map((bill, index) => {
                                const bDate = bill.date ? ((bill.date as any).toDate ? (bill.date as any).toDate() : new Date((bill.date as any).seconds ? (bill.date as any).seconds * 1000 : bill.date)) : null;
                                const rDateRaw = (bill as any).updatedAt || (bill as any).createdAt || bill.date;
                                const rDate = rDateRaw ? (rDateRaw.toDate ? rDateRaw.toDate() : new Date(rDateRaw.seconds ? rDateRaw.seconds * 1000 : rDateRaw)) : null;
                                const receivedAmount = bill.paidAmount || 0;
                                const finalBalance = customerBalances[bill.customerId] || 0;
                                return (
                                    <div
                                        key={index}
                                        className="rounded-lg border p-3 shadow-sm bg-card cursor-pointer active:opacity-70"
                                        style={{ minHeight: '80px', padding: '12px' }}
                                        onDoubleClick={() => onRowDoubleClick(bill)}
                                    >
                                        {/* Top Row: Customer + Rec Date */}
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-sm">{bill.customerName}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {rDate && !isNaN(rDate.getTime()) ? format(rDate, 'dd-MM-yyyy') : '-'}
                                            </span>
                                        </div>
                                        {/* Bill Date */}
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Bill: {bDate && !isNaN(bDate.getTime()) ? format(bDate, 'dd-MM-yyyy') : '-'}
                                        </div>
                                        {/* Received Amount */}
                                        <div className="mt-2 flex justify-between text-sm">
                                            <span className="text-muted-foreground">Received:</span>
                                            <span className="font-mono font-semibold text-green-600">₹{receivedAmount.toFixed(2)}</span>
                                        </div>
                                        {/* Final Balance */}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Final Bal:</span>
                                            <span className="font-mono font-bold">₹{finalBalance.toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground rounded-lg border">
                                No results found.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
