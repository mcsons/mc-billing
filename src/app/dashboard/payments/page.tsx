'use client';
import React, { useState } from 'react';
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

import { Check, ChevronsUpDown, Save, Search, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
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

export default function PaymentsPage() {
    const { customers, customerBalances, addPayment, getCustomerLedger } = useData();
    const { toast } = useToast();

    // State for Record Payment form

    const [recordSelectedCustomerId, setRecordSelectedCustomerId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');

    // State for Payment History search

    const [historySelectedCustomerId, setHistorySelectedCustomerId] = useState<string>('');
    const [fromDate, setFromDate] = useState<Date | undefined>();
    const [toDate, setToDate] = useState<Date | undefined>();
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [openingBalance, setOpeningBalance] = useState<number>(0);


    const recordSelectedCustomer = customers.find(c => c.id === recordSelectedCustomerId);
    const currentBalance = recordSelectedCustomerId ? customerBalances[recordSelectedCustomerId] || 0 : 0;
    const newBalance = currentBalance - (parseFloat(amount) || 0);


    const handleSubmitPayment = () => {
        const paymentAmount = parseFloat(amount);
        if (!recordSelectedCustomerId || !paymentAmount || isNaN(paymentAmount)) {
            toast({
                variant: 'destructive',
                title: 'Invalid Payment',
                description: 'Please select a customer and enter a valid payment amount.',
            });
            return;
        }

        addPayment({
            customerId: recordSelectedCustomerId,
            amount: paymentAmount,
            notes: notes,
        });

        toast({
            title: 'Payment Recorded',
            description: `₹${paymentAmount.toFixed(2)} payment from ${recordSelectedCustomer?.name_en} has been recorded.`,
        });

        // Reset form
        setRecordSelectedCustomerId('');
        setAmount('');
        setNotes('');
    };

    const handleSearchPayments = () => {
        if (!historySelectedCustomerId) {
            toast({ variant: 'destructive', title: 'Customer not selected', description: 'Please select a customer to view history.' });
            return;
        }
        if (!fromDate || !toDate) {
            toast({ variant: 'destructive', title: 'Date range not selected', description: 'Please select a "From" and "To" date.' });
            return;
        }

        const { transactions, openingBalance } = getCustomerLedger(historySelectedCustomerId, { from: fromDate, to: toDate });
        setFilteredTransactions(transactions);
        setOpeningBalance(openingBalance);
    };

    const handleClearSearch = () => {
        setHistorySelectedCustomerId('');
        setFromDate(undefined);
        setToDate(undefined);
        setFilteredTransactions([]);
        setOpeningBalance(0);
    };

    const openPaymentsPrint = (paper: 'thermal' | 'a4') => {
        if (!historySelectedCustomerId || (!filteredTransactions.length && openingBalance === 0)) {
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
            openingBalance,
            dateRange: { from: fromDate, to: toDate },
        };

        const encodedData = encodeURIComponent(JSON.stringify(printData));

        window.open(
            `/dashboard/payments/print?data=${encodedData}&paper=${paper}`,
            '_blank'
        );
    };


    const historySelectedCustomer = customers.find(c => c.id === historySelectedCustomerId);

    return (
        <div className="grid gap-8 lg:grid-cols-2">
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
                            options={customers.map((c) => ({
                                value: c.id,
                                label: `${c.name_en} (${c.name_ta})`,
                            }))}
                            value={
                                recordSelectedCustomer
                                    ? {
                                        value: recordSelectedCustomer.id,
                                        label: `${recordSelectedCustomer.name_en} (${recordSelectedCustomer.name_ta})`,
                                    }
                                    : null
                            }
                            onChange={(option) => {
                                setRecordSelectedCustomerId(option ? option.value : '');
                            }}
                            styles={{
                                menu: (base) => ({ ...base, zIndex: 50 }),
                            }}
                            filterOption={(option, input) =>
                                option.label.toLowerCase().includes(input.toLowerCase()) ||
                                option.value.toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </div>

                    {recordSelectedCustomerId && (
                        <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                            <div>
                                <Label>Current Balance</Label>
                                <p className="text-2xl font-bold font-mono">₹{currentBalance.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <Label>New Balance</Label>
                                <p className="text-2xl font-bold font-mono">₹{newBalance.toFixed(2)}</p>
                            </div>
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
                            disabled={!recordSelectedCustomerId}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="e.g., Cash payment for last week's bill"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            disabled={!recordSelectedCustomerId}
                        />
                    </div>

                </CardContent>
                <CardFooter>
                    <Button size="lg" onClick={handleSubmitPayment} disabled={!recordSelectedCustomerId || !amount}>
                        <Save className="mr-2 h-4 w-4" />
                        Record Payment
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Customer Statement</CardTitle>
                    <CardDescription>
                        View a customer's transaction history for a date range.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="customer-history">Customer</Label>
                        <ReactSelect
                            instanceId="history-customer-select"
                            placeholder="Select customer..."
                            isClearable
                            options={customers.map((c) => ({
                                value: c.id,
                                label: `${c.name_en} (${c.name_ta})`,
                            }))}
                            value={
                                historySelectedCustomer
                                    ? {
                                        value: historySelectedCustomer.id,
                                        label: `${historySelectedCustomer.name_en} (${historySelectedCustomer.name_ta})`,
                                    }
                                    : null
                            }
                            onChange={(option) => {
                                setHistorySelectedCustomerId(option ? option.value : '');
                            }}
                            styles={{
                                menu: (base) => ({ ...base, zIndex: 50 }),
                            }}
                            filterOption={(option, input) =>
                                option.label.toLowerCase().includes(input.toLowerCase()) ||
                                option.value.toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="from-date">From Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={'outline'}
                                        className={cn('w-full justify-start text-left font-normal', !fromDate && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {fromDate ? format(fromDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="to-date">To Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={'outline'}
                                        className={cn('w-full justify-start text-left font-normal', !toDate && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {toDate ? format(toDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSearchPayments}><Search className="mr-2 h-4 w-4" /> Search</Button>
                        <Button variant="ghost" onClick={handleClearSearch}><X className="mr-2 h-4 w-4" /> Clear</Button>
                    </div>

                    <Separator />

                    <div className="max-h-60 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Billed (+)</TableHead>
                                    <TableHead className="text-right">Received (-)</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historySelectedCustomerId ? (
                                    filteredTransactions.length > 0 || openingBalance !== 0 ? (
                                        <>
                                            <TableRow className="bg-muted/50">
                                                <TableCell colSpan={4} className="font-semibold">Opening Balance</TableCell>
                                                <TableCell className="text-right font-mono font-semibold">{openingBalance.toFixed(2)}</TableCell>
                                            </TableRow>
                                            {filteredTransactions.map((t, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{format(t.date, 'dd-MM-yy')}</TableCell>
                                                    <TableCell>{t.description}</TableCell>
                                                    <TableCell className="text-right font-mono text-green-600">{t.billedAmount?.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-red-600">{t.receivedAmount?.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right font-mono">{t.balance.toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </>
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">No transactions found for this criteria.</TableCell>
                                        </TableRow>
                                    )
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">Select a customer and date range.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={() => openPaymentsPrint('thermal')}>
                        🧾 Print Receipt (79mm)
                    </Button>

                    <Button variant="outline" onClick={() => openPaymentsPrint('a4')}>
                        📄 Print A4 Statement
                    </Button>

                </CardFooter>
            </Card>
        </div>
    );
}
