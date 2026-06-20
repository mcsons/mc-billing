'use client';
import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Search, Share } from 'lucide-react';
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import ReactSelect from 'react-select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Timestamp } from 'firebase/firestore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DateWiseRow {
  customerId: string;
  customerName: string;
  boxesTaken: number;   // todaysFishBox
  emptyBoxes: number;   // emptyBox
  balance: number;      // balanceBox
}

interface CustomerRow {
  billId: string;
  billDate: Date;
  boxesTaken: number;
  emptyBoxes: number;
  balance: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(d: any): Date {
  if (!d) return new Date(0);
  if (d?.toDate) return d.toDate();
  return new Date(d);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BoxReportsPage() {
  const { customers, boxBills, openingBoxBalances } = useData();
  const { toast } = useToast();

  // ── Shared ReactSelect Styles ────────────────────────────────────────────
  const reactSelectStyles = {
    container: (b: any) => ({ ...b, width: '100%' }),
    control: (b: any, s: any) => ({
      ...b,
      backgroundColor: 'hsl(var(--background))',
      borderColor: s.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: s.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      minHeight: '44px',
      '&:hover': { borderColor: 'hsl(var(--ring))' },
    }),
    menu: (b: any) => ({ ...b, backgroundColor: 'hsl(var(--card))', zIndex: 50 }),
    option: (b: any, s: any) => ({
      ...b,
      backgroundColor: s.isSelected ? 'hsl(var(--accent))' : s.isFocused ? 'hsl(var(--muted))' : 'transparent',
      color: s.isSelected ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
      '&:active': { backgroundColor: 'hsl(var(--accent))' },
    }),
    singleValue: (b: any) => ({ ...b, color: 'hsl(var(--foreground))' }),
    input: (b: any) => ({ ...b, color: 'hsl(var(--foreground))' }),
    placeholder: (b: any) => ({ ...b, color: 'hsl(var(--muted-foreground))' }),
  };

  const customerOptions = useMemo(() =>
    customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` })),
  [customers]);

  // ══════════════════════════════════════════════════════════════════════════
  //  LEFT – DATE-WISE REPORT
  // ══════════════════════════════════════════════════════════════════════════

  const [dateWiseDate, setDateWiseDate] = useState<Date | undefined>(new Date());
  const [dateWiseRows, setDateWiseRows] = useState<DateWiseRow[] | null>(null);
  const [dateWiseSearched, setDateWiseSearched] = useState(false);

  const handleDateWiseSearch = useCallback(() => {
    if (!dateWiseDate) {
      toast({ variant: 'destructive', title: 'Select a date first' });
      return;
    }
    const dayStart = startOfDay(dateWiseDate);
    const dayEnd = endOfDay(dateWiseDate);

    const billsOnDate = boxBills.filter((b) => {
      const bd = toDate(b.billDate);
      return bd >= dayStart && bd <= dayEnd;
    });

    const rows: DateWiseRow[] = billsOnDate.map((b) => {
      const cust = customers.find((c) => c.id === b.customerId);
      return {
        customerId: b.customerId,
        customerName: cust ? `${cust.name_en} (${cust.name_ta})` : b.customerName || b.customerId,
        boxesTaken: b.todaysFishBox || 0,
        emptyBoxes: b.emptyBox || 0,
        balance: b.balanceBox || 0,
      };
    });

    // Sort by customer name
    rows.sort((a, b) => a.customerName.localeCompare(b.customerName));
    setDateWiseRows(rows);
    setDateWiseSearched(true);
  }, [dateWiseDate, boxBills, customers, toast]);

  const dateWiseTotalTaken = useMemo(
    () => (dateWiseRows || []).reduce((s, r) => s + r.boxesTaken, 0),
    [dateWiseRows],
  );
  const dateWiseTotalEmpty = useMemo(
    () => (dateWiseRows || []).reduce((s, r) => s + r.emptyBoxes, 0),
    [dateWiseRows],
  );

  const handleDateWiseSharePDF = useCallback(() => {
    if (!dateWiseRows || dateWiseRows.length === 0) {
      toast({ variant: 'destructive', title: 'No data', description: 'Search first to generate report.' });
      return;
    }
    const printData = {
      type: 'datewise',
      date: dateWiseDate ? format(dateWiseDate, 'dd-MM-yyyy') : '',
      rows: dateWiseRows,
      totalTaken: dateWiseTotalTaken,
      totalEmpty: dateWiseTotalEmpty,
    };
    sessionStorage.setItem('boxReportPrintData', JSON.stringify(printData));
    window.open('/print/box-report', '_blank');
  }, [dateWiseRows, dateWiseDate, dateWiseTotalTaken, dateWiseTotalEmpty, toast]);

  // ══════════════════════════════════════════════════════════════════════════
  //  RIGHT – CUSTOMER REPORT
  // ══════════════════════════════════════════════════════════════════════════

  const [custId, setCustId] = useState('');
  const [custFrom, setCustFrom] = useState<Date | undefined>(undefined);
  const [custTo, setCustTo] = useState<Date | undefined>(undefined);
  const [custRows, setCustRows] = useState<CustomerRow[] | null>(null);
  const [custSearched, setCustSearched] = useState(false);
  const [custOpeningBalance, setCustOpeningBalance] = useState(0);

  /** Opening balance = balance before the range starts */
  const computeOpeningBalanceBeforeRange = useCallback(
    (customerId: string, fromDate: Date): number => {
      const rangeStart = startOfDay(fromDate);
      const priorBills = boxBills
        .filter((b) => {
          if (b.customerId !== customerId) return false;
          const bd = toDate(b.billDate);
          return bd < rangeStart;
        })
        .sort((a, b) => toDate(b.billDate).getTime() - toDate(a.billDate).getTime());

      if (priorBills.length > 0) return priorBills[0].balanceBox;
      return openingBoxBalances[customerId] || 0;
    },
    [boxBills, openingBoxBalances],
  );

  const handleCustomerSearch = useCallback(() => {
    if (!custId) {
      toast({ variant: 'destructive', title: 'Select a customer first' });
      return;
    }
    if (!custFrom || !custTo) {
      toast({ variant: 'destructive', title: 'Select From and To dates' });
      return;
    }

    const from = startOfDay(custFrom);
    const to = endOfDay(custTo);

    const billsInRange = boxBills
      .filter((b) => {
        if (b.customerId !== custId) return false;
        const bd = toDate(b.billDate);
        return bd >= from && bd <= to;
      })
      .sort((a, b) => toDate(a.billDate).getTime() - toDate(b.billDate).getTime());

    const rows: CustomerRow[] = billsInRange.map((b) => ({
      billId: b.id,
      billDate: toDate(b.billDate),
      boxesTaken: b.todaysFishBox || 0,
      emptyBoxes: b.emptyBox || 0,
      balance: b.balanceBox || 0,
    }));

    const openingBal = computeOpeningBalanceBeforeRange(custId, custFrom);
    setCustOpeningBalance(openingBal);
    setCustRows(rows);
    setCustSearched(true);
  }, [custId, custFrom, custTo, boxBills, computeOpeningBalanceBeforeRange, toast]);

  const custTotalTaken = useMemo(
    () => (custRows || []).reduce((s, r) => s + r.boxesTaken, 0),
    [custRows],
  );
  const custTotalEmpty = useMemo(
    () => (custRows || []).reduce((s, r) => s + r.emptyBoxes, 0),
    [custRows],
  );
  const custFinalBalance = useMemo(
    () => (custRows && custRows.length > 0 ? custRows[custRows.length - 1].balance : custOpeningBalance),
    [custRows, custOpeningBalance],
  );

  const handleCustomerSharePDF = useCallback(() => {
    if (!custRows || custRows.length === 0) {
      toast({ variant: 'destructive', title: 'No data', description: 'Search first to generate report.' });
      return;
    }
    const customer = customers.find((c) => c.id === custId);
    const printData = {
      type: 'customer',
      customerName: customer ? `${customer.name_en} (${customer.name_ta})` : custId,
      fromDate: custFrom ? format(custFrom, 'dd-MM-yyyy') : '',
      toDate: custTo ? format(custTo, 'dd-MM-yyyy') : '',
      openingBalance: custOpeningBalance,
      rows: custRows.map((r) => ({ ...r, billDate: format(r.billDate, 'dd-MM-yyyy') })),
      totalTaken: custTotalTaken,
      totalEmpty: custTotalEmpty,
      finalBalance: custFinalBalance,
    };
    sessionStorage.setItem('boxReportPrintData', JSON.stringify(printData));
    window.open('/print/box-report', '_blank');
  }, [custRows, customers, custId, custFrom, custTo, custOpeningBalance, custTotalTaken, custTotalEmpty, custFinalBalance, toast]);

  // ─── Calendar popup component (date picker reused pattern) ─────────────
  const DatePicker = ({
    value,
    onChange,
    placeholder,
  }: {
    value: Date | undefined;
    onChange: (d: Date | undefined) => void;
    placeholder?: string;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full justify-start text-left font-normal h-[44px]', !value && 'text-muted-foreground')}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'dd-MM-yyyy') : <span>{placeholder || 'Pick a date'}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 pb-8 w-full max-w-full overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-headline font-bold text-foreground">Box Bill Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate date-wise and customer-specific box bill reports.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ═══════════════════════════ LEFT – DATE-WISE ════════════════════════ */}
        <Card className="section-box flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline text-lg">Date-wise Reports</CardTitle>
            <CardDescription>View all box bills for a selected date.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-1.5 flex-1">
                <Label>Date</Label>
                <DatePicker value={dateWiseDate} onChange={setDateWiseDate} />
              </div>
              <Button onClick={handleDateWiseSearch} className="h-[44px] sm:w-auto w-full">
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </div>

            {/* Results */}
            {dateWiseSearched && dateWiseRows !== null && (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs uppercase">Cust ID</TableHead>
                        <TableHead className="font-bold text-xs uppercase">Customer Name</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Boxes Taken</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Empty Boxes</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dateWiseRows.length > 0 ? (
                        dateWiseRows.map((row) => (
                          <TableRow key={row.customerId}>
                            <TableCell className="font-mono text-xs">{row.customerId}</TableCell>
                            <TableCell className="whitespace-normal break-words">{row.customerName}</TableCell>
                            <TableCell className="text-center font-mono text-base font-bold">{row.boxesTaken}</TableCell>
                            <TableCell className="text-center font-mono text-base font-bold">{row.emptyBoxes}</TableCell>
                            <TableCell className="text-right font-mono text-base font-bold text-primary">{row.balance}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                            No bills found for {dateWiseDate ? format(dateWiseDate, 'dd-MM-yyyy') : 'selected date'}.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="block md:hidden space-y-2">
                  {dateWiseRows.length > 0 ? (
                    dateWiseRows.map((row) => (
                      <div key={row.customerId} className="rounded-lg border p-3 bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm whitespace-normal break-words flex-1 pr-2">{row.customerName}</span>
                          <span className="text-xs text-muted-foreground font-mono">{row.customerId}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="text-center">
                            <span className="text-xs text-muted-foreground block">Taken</span>
                            <span className="font-mono font-semibold">{row.boxesTaken}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-xs text-muted-foreground block">Empty</span>
                            <span className="font-mono">{row.emptyBoxes}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Balance</span>
                            <span className="font-mono font-bold text-primary">{row.balance}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-16 flex items-center justify-center text-sm text-muted-foreground border rounded-lg">
                      No bills found.
                    </div>
                  )}
                </div>

                {/* Totals */}
                {dateWiseRows.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Total Boxes Taken</span>
                        <span className="font-mono text-lg font-bold">{dateWiseTotalTaken}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Total Empty Boxes</span>
                        <span className="font-mono text-lg font-bold">{dateWiseTotalEmpty}</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleDateWiseSharePDF}
                      className="w-full border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                    >
                      <Share className="mr-2 h-4 w-4" /> Share (PDF)
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════ RIGHT – CUSTOMER ═════════════════════════ */}
        <Card className="section-box flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline text-lg">Customer Reports</CardTitle>
            <CardDescription>View box bills for a customer within a date range.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Controls */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Customer</Label>
                <ReactSelect
                  instanceId="cust-report-select"
                  placeholder="Select customer..."
                  isClearable
                  options={customerOptions}
                  value={customerOptions.find((o) => o.value === custId) || null}
                  onChange={(opt) => { setCustId(opt ? opt.value : ''); setCustRows(null); setCustSearched(false); }}
                  styles={reactSelectStyles}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>From</Label>
                  <DatePicker value={custFrom} onChange={setCustFrom} placeholder="From date" />
                </div>
                <div className="grid gap-1.5">
                  <Label>To</Label>
                  <DatePicker value={custTo} onChange={setCustTo} placeholder="To date" />
                </div>
              </div>
              <Button onClick={handleCustomerSearch} className="h-[44px] w-full">
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </div>

            {/* Results */}
            {custSearched && custRows !== null && (
              <>
                {/* Opening Balance */}
                <div className="rounded-md bg-muted/50 border px-3 py-2 text-sm flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Opening Balance</span>
                  <span className="font-mono font-bold text-base">{custOpeningBalance}</span>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs uppercase">Bill Date</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Boxes Taken</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Empty Boxes</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {custRows.length > 0 ? (
                        custRows.map((row) => (
                          <TableRow key={row.billId}>
                            <TableCell className="font-mono text-base font-bold">{format(row.billDate, 'dd-MM-yyyy')}</TableCell>
                            <TableCell className="text-center font-mono text-base font-bold">{row.boxesTaken}</TableCell>
                            <TableCell className="text-center font-mono text-base font-bold">{row.emptyBoxes}</TableCell>
                            <TableCell className="text-right font-mono text-base font-bold text-primary">{row.balance}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                            No bills found in the selected range.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="block md:hidden space-y-2">
                  {custRows.length > 0 ? (
                    custRows.map((row) => (
                      <div key={row.billId} className="rounded-lg border p-3 bg-card">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold font-mono">{format(row.billDate, 'dd-MM-yyyy')}</span>
                          <span className="font-mono font-bold text-primary">{row.balance}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground block">Boxes Taken</span>
                            <span className="font-mono">{row.boxesTaken}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Empty Boxes</span>
                            <span className="font-mono">{row.emptyBoxes}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-16 flex items-center justify-center text-sm text-muted-foreground border rounded-lg">
                      No bills found.
                    </div>
                  )}
                </div>

                {/* Totals */}
                {custRows.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Total Boxes Taken</span>
                        <span className="font-mono text-lg font-bold">{custTotalTaken}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Total Empty Boxes</span>
                        <span className="font-mono text-lg font-bold">{custTotalEmpty}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 mt-1">
                        <span className="text-base font-bold">Final Box Balance</span>
                        <span className="font-mono text-xl font-bold text-primary">{custFinalBalance}</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleCustomerSharePDF}
                      className="w-full border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                    >
                      <Share className="mr-2 h-4 w-4" /> Share (PDF)
                    </Button>
                  </>
                )}

                {custSearched && custRows.length === 0 && (
                  <div className="h-16 flex items-center justify-center text-sm text-muted-foreground border rounded-lg">
                    No bills found in the selected range.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
