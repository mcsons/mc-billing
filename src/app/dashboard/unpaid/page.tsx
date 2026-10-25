'use client';
import React, { useMemo, useState } from 'react';
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { useData, UNPAID_AFTER_DAYS } from '@/context/DataContext';

// Indian number format helper — same one the Payments page uses.
const formatINR = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function UnpaidPage() {
    const { unpaidCustomers, isUnpaidLoading, customers } = useData();
    const [search, setSearch] = useState('');

    const query = search.trim().toLowerCase();

    const rows = useMemo(() => {
        if (!query) return unpaidCustomers;
        return unpaidCustomers.filter(row =>
            row.customerName.toLowerCase().includes(query)
            || (row.customerNameTa || '').toLowerCase().includes(query)
            || row.customerId.toLowerCase().includes(query)
        );
    }, [unpaidCustomers, query]);

    /** A searched customer who exists but simply isn't overdue gets a clearer message. */
    const searchMatchesAnyCustomer = useMemo(() => {
        if (!query) return false;
        return customers.some(c =>
            c.name_en.toLowerCase().includes(query)
            || (c.name_ta || '').toLowerCase().includes(query)
            || c.id.toLowerCase().includes(query)
        );
    }, [customers, query]);

    const emptyMessage = !query
        ? 'No unpaid customers.'
        : searchMatchesAnyCustomer
            ? 'No unpaid customers found matching your search.'
            : 'No items present';

    const lastPaidDateText = (ms: number | null) =>
        ms === null ? 'Never paid' : format(new Date(ms), 'dd/MM/yyyy');
    const lastPaidAmountText = (amount: number | null) =>
        amount === null ? '—' : `₹${formatINR(amount)}`;

    return (
        <Card className="max-w-full overflow-hidden">
            <CardHeader>
                <CardTitle className="font-headline text-xl md:text-2xl">Unpaid</CardTitle>
                <CardDescription>
                    Customers with an outstanding balance and no payment for more than {UNPAID_AFTER_DAYS} days.
                    Longest overdue first.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Search */}
                <div className="mb-4 flex items-center gap-2">
                    <div className="relative min-w-0 flex-1 sm:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search customer name..."
                            className="h-11 w-full pl-9 md:h-10"
                            aria-label="Search unpaid customers"
                        />
                    </div>
                    {search !== '' && (
                        <Button variant="ghost" className="h-11 shrink-0 md:h-10" onClick={() => setSearch('')}>
                            <X className="mr-2 h-4 w-4" /> Clear
                        </Button>
                    )}
                </div>

                {isUnpaidLoading ? (
                    <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                        Loading...
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden overflow-x-auto rounded-md border md:block">
                            <Table className="w-full min-w-[560px] text-sm">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer Name</TableHead>
                                        <TableHead>Last Paid Date</TableHead>
                                        <TableHead className="text-right">Last Paid Amount</TableHead>
                                        <TableHead className="text-right">Current Balance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length > 0 ? (
                                        rows.map(row => (
                                            <TableRow key={row.customerId}>
                                                <TableCell className="font-medium">{row.customerName}</TableCell>
                                                <TableCell className={row.lastPaidDate === null ? 'text-muted-foreground' : undefined}>
                                                    {lastPaidDateText(row.lastPaidDate)}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-right font-mono">
                                                    {lastPaidAmountText(row.lastPaidAmount)}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-right font-mono font-bold">
                                                    ₹{formatINR(row.currentBalance)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">{emptyMessage}</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile cards */}
                        <div className="space-y-3 md:hidden">
                            {rows.length > 0 ? (
                                rows.map(row => (
                                    <div key={row.customerId} className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="min-w-0 truncate font-semibold text-sm">{row.customerName}</span>
                                            <span className={`shrink-0 text-xs ${row.lastPaidDate === null ? 'text-muted-foreground' : ''}`}>
                                                {lastPaidDateText(row.lastPaidDate)}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex justify-between gap-2 text-sm">
                                            <span className="text-muted-foreground">Last Paid</span>
                                            <span className="font-mono">{lastPaidAmountText(row.lastPaidAmount)}</span>
                                        </div>
                                        <div className="mt-1 flex justify-between gap-2 text-sm">
                                            <span className="text-muted-foreground">Current Balance</span>
                                            <span className="font-mono font-bold">₹{formatINR(row.currentBalance)}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                                    {emptyMessage}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
