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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, Save, Search, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
import { Payment } from '@/lib/data';

export default function PaymentsPage() {
  const { customers, customerBalances, addPayment, payments } = useData();
  const { toast } = useToast();

  // State for Record Payment form
  const [recordCustomerPopoverOpen, setRecordCustomerPopoverOpen] = useState(false);
  const [recordSelectedCustomerId, setRecordSelectedCustomerId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  // State for Payment History search
  const [historyCustomerPopoverOpen, setHistoryCustomerPopoverOpen] = useState(false);
  const [historySelectedCustomerId, setHistorySelectedCustomerId] = useState<string>('');
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);


  const recordSelectedCustomer = customers.find(c => c.id === recordSelectedCustomerId);
  const currentBalance = recordSelectedCustomerId ? customerBalances[recordSelectedCustomerId] || 0 : 0;
  const newBalance = currentBalance - (parseFloat(amount) || 0);
  
  const handleRecordCustomerSelect = (customerId: string) => {
    setRecordSelectedCustomerId(customerId === recordSelectedCustomerId ? '' : customerId);
    setRecordCustomerPopoverOpen(false);
  };
  
  const handleHistoryCustomerSelect = (customerId: string) => {
    setHistorySelectedCustomerId(customerId === historySelectedCustomerId ? '' : customerId);
    setHistoryCustomerPopoverOpen(false);
  };

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
    const results = payments.filter(p => {
        const isCustomerMatch = p.customerId === historySelectedCustomerId;
        if (!fromDate || !toDate) {
            return isCustomerMatch;
        }
        return isCustomerMatch && isWithinInterval(p.date, { start: fromDate, end: toDate });
    });
    setFilteredPayments(results);
  };
  
  const handleClearSearch = () => {
      setHistorySelectedCustomerId('');
      setFromDate(undefined);
      setToDate(undefined);
      setFilteredPayments([]);
  };

  const handlePrint = () => {
    if (filteredPayments.length === 0 || !historySelectedCustomerId) {
        toast({ variant: 'destructive', title: 'Nothing to Print', description: 'Please search for payments first.'});
        return;
    }
    const customer = customers.find(c => c.id === historySelectedCustomerId);
    const printData = {
        customer,
        payments: filteredPayments,
        dateRange: { from: fromDate, to: toDate }
    };
    const encodedData = encodeURIComponent(JSON.stringify(printData));
    window.open(`/dashboard/payments/print?data=${encodedData}`, '_blank');
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
                <Popover
                    open={recordCustomerPopoverOpen}
                    onOpenChange={setRecordCustomerPopoverOpen}
                >
                    <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={recordCustomerPopoverOpen}
                        className="justify-between"
                        onClick={() => setRecordCustomerPopoverOpen(!recordCustomerPopoverOpen)}
                    >
                        {recordSelectedCustomer
                        ? `${recordSelectedCustomer.name_en} (${recordSelectedCustomer.name_ta})`
                        : 'Select customer...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                    <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                            {customers.map((customer) => (
                            <CommandItem
                                key={customer.id}
                                value={`${customer.name_en} ${customer.name_ta} ${customer.id}`}
                                onSelect={() => handleRecordCustomerSelect(customer.id)}
                            >
                                <Check
                                className={cn(
                                    'mr-2 h-4 w-4',
                                    recordSelectedCustomerId === customer.id
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                                />
                                {customer.name_en} ({customer.name_ta})
                            </CommandItem>
                            ))}
                        </CommandGroup>
                        </CommandList>
                    </Command>
                    </PopoverContent>
                </Popover>
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
                <CardTitle className="font-headline">Payment History</CardTitle>
                <CardDescription>
                View and print a customer's payment history for a date range.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid gap-2">
                    <Label htmlFor="customer-history">Customer</Label>
                    <Popover
                        open={historyCustomerPopoverOpen}
                        onOpenChange={setHistoryCustomerPopoverOpen}
                    >
                        <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={historyCustomerPopoverOpen}
                            className="justify-between"
                            onClick={() => setHistoryCustomerPopoverOpen(!historyCustomerPopoverOpen)}
                        >
                            {historySelectedCustomer
                            ? `${historySelectedCustomer.name_en} (${historySelectedCustomer.name_ta})`
                            : 'Select customer...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                        <Command>
                            <CommandInput placeholder="Search customer..." />
                            <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup>
                                {customers.map((customer) => (
                                <CommandItem
                                    key={customer.id}
                                    value={`${customer.name_en} ${customer.name_ta} ${customer.id}`}
                                    onSelect={() => handleHistoryCustomerSelect(customer.id)}
                                >
                                    <Check
                                    className={cn(
                                        'mr-2 h-4 w-4',
                                        historySelectedCustomerId === customer.id
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                    )}
                                    />
                                    {customer.name_en} ({customer.name_ta})
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            </CommandList>
                        </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="from-date">From Date</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={'outline'}
                                className={cn('justify-start text-left font-normal', !fromDate && 'text-muted-foreground')}
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
                                className={cn('justify-start text-left font-normal', !toDate && 'text-muted-foreground')}
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
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Amount (₹)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPayments.length > 0 ? (
                                filteredPayments.map(payment => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{format(payment.date, 'dd-MM-yyyy')}</TableCell>
                                        <TableCell>{payment.notes}</TableCell>
                                        <TableCell className="text-right font-mono">{payment.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">No payments found for this criteria.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                 <Button size="lg" onClick={handlePrint} disabled={filteredPayments.length === 0}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Summary
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
