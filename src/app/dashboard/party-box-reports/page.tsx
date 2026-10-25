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
import { Calendar as CalendarIcon, Search, Share, X } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface DateWiseRow {
  partyId: string;
  partyName: string;
  boxesTaken: number;
  emptyBoxes: number;
  balance: number;
}

interface CurrentBalanceRow {
  partyId: string;
  partyName: string;
  openingBalance: number;
  currentBalance: number;
  lastBillDate: string; // formatted dd-MM-yyyy or '-'
}

interface PartyRow {
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

export default function PartyBoxReportsPage() {
  const { parties, partyBoxBills, partyOpeningBoxBalances } = useData();
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

  const partyOptions = useMemo(() =>
    (parties || []).map((p) => ({ value: p.id, label: `${p.name} (${p.location || p.id})` })),
  [parties]);

  // ══════════════════════════════════════════════════════════════════════════
  //  LEFT – DATE-WISE REPORT
  // ══════════════════════════════════════════════════════════════════════════

  const [dateWiseDate, setDateWiseDate] = useState<Date | undefined>(undefined);
  const [dateWiseRows, setDateWiseRows] = useState<DateWiseRow[] | null>(null);
  const [dateWiseSearched, setDateWiseSearched] = useState(false);

  // ── Current Balance Report (no date selected) ──────────────────────────
  const [balanceRows, setBalanceRows] = useState<CurrentBalanceRow[] | null>(null);
  const [balanceSearched, setBalanceSearched] = useState(false);

  const handleDateWiseSearch = useCallback(() => {
    if (!dateWiseDate) {
      // ── Mode: All parties current balance ──
      const rows: CurrentBalanceRow[] = (parties || [])
        .map((p) => {
          const partyBills = partyBoxBills
            .filter((b) => b.partyId === p.id)
            .sort((a, b) => toDate(b.billDate).getTime() - toDate(a.billDate).getTime());

          const latestBill = partyBills[0] ?? null;
          const currentBalance = latestBill?.balanceBox ?? (partyOpeningBoxBalances[p.id] ?? 0);
          const lastBillDate = latestBill
            ? format(toDate(latestBill.billDate), 'dd-MM-yyyy')
            : '-';

          return {
            partyId: p.id,
            partyName: `${p.name} (${p.location || p.id})`,
            openingBalance: partyOpeningBoxBalances[p.id] ?? 0,
            currentBalance,
            lastBillDate,
          };
        })
        .sort((a, b) => parseInt(a.partyId, 10) - parseInt(b.partyId, 10));

      setBalanceRows(rows);
      setBalanceSearched(true);
      setDateWiseRows(null);
      setDateWiseSearched(false);
      return;
    }

    // ── Mode: Date-wise ──
    setBalanceRows(null);
    setBalanceSearched(false);

    const dayStart = startOfDay(dateWiseDate);
    const dayEnd = endOfDay(dateWiseDate);

    const billsOnDate = partyBoxBills.filter((b) => {
      const bd = toDate(b.billDate);
      return bd >= dayStart && bd <= dayEnd;
    });

    const rows: DateWiseRow[] = billsOnDate.map((b) => {
      const party = (parties || []).find((p) => p.id === b.partyId);
      return {
        partyId: b.partyId,
        partyName: party ? `${party.name} (${party.location || party.id})` : b.partyName || b.partyId,
        boxesTaken: b.todaysFishBox || 0,
        emptyBoxes: b.emptyBox || 0,
        balance: b.balanceBox || 0,
      };
    });

    rows.sort((a, b) => a.partyName.localeCompare(b.partyName));
    setDateWiseRows(rows);
    setDateWiseSearched(true);
  }, [dateWiseDate, partyBoxBills, parties, partyOpeningBoxBalances]);

  const handleDateChange = (d: Date | undefined) => {
    setDateWiseDate(d);
    setDateWiseRows(null);
    setDateWiseSearched(false);
    setBalanceRows(null);
    setBalanceSearched(false);
  };

  const dateWiseTotalTaken = useMemo(
    () => (dateWiseRows || []).reduce((s, r) => s + r.boxesTaken, 0),
    [dateWiseRows],
  );
  const dateWiseTotalEmpty = useMemo(
    () => (dateWiseRows || []).reduce((s, r) => s + r.emptyBoxes, 0),
    [dateWiseRows],
  );

  const balanceSumOpening = useMemo(
    () => (balanceRows || []).reduce((s, r) => s + r.openingBalance, 0),
    [balanceRows],
  );
  const balanceSumCurrent = useMemo(
    () => (balanceRows || []).reduce((s, r) => s + r.currentBalance, 0),
    [balanceRows],
  );

  const handleDateWiseSharePDF = useCallback(() => {
    if (!dateWiseRows || dateWiseRows.length === 0) {
      toast({ variant: 'destructive', title: 'No data', description: 'Search first to generate report.' });
      return;
    }
    const printData = {
      type: 'datewise',
      entityLabel: 'Party',
      date: dateWiseDate ? format(dateWiseDate, 'dd-MM-yyyy') : '',
      rows: dateWiseRows.map((r) => ({
        id: r.partyId,
        name: r.partyName,
        boxesTaken: r.boxesTaken,
        emptyBoxes: r.emptyBoxes,
        balance: r.balance,
      })),
      totalTaken: dateWiseTotalTaken,
      totalEmpty: dateWiseTotalEmpty,
    };
    sessionStorage.setItem('partyBoxReportPrintData', JSON.stringify(printData));
    window.open('/print/party-box-report', '_blank');
  }, [dateWiseRows, dateWiseDate, dateWiseTotalTaken, dateWiseTotalEmpty, toast]);

  const handleBalanceSharePDF = useCallback(() => {
    if (!balanceRows || balanceRows.length === 0) {
      toast({ variant: 'destructive', title: 'No data', description: 'Search first to generate report.' });
      return;
    }
    const printData = {
      type: 'currentbalance',
      entityLabel: 'Party',
      generatedDate: format(new Date(), 'dd-MM-yyyy'),
      rows: balanceRows,
      sumOpening: balanceSumOpening,
      sumCurrent: balanceSumCurrent,
    };
    sessionStorage.setItem('partyBoxReportPrintData', JSON.stringify(printData));
    window.open('/print/party-box-report', '_blank');
  }, [balanceRows, balanceSumOpening, balanceSumCurrent, toast]);

  // ══════════════════════════════════════════════════════════════════════════
  //  RIGHT – PARTY REPORT
  // ══════════════════════════════════════════════════════════════════════════

  const [partyId, setPartyId] = useState('');
  const [partyFrom, setPartyFrom] = useState<Date | undefined>(undefined);
  const [partyTo, setPartyTo] = useState<Date | undefined>(undefined);
  const [partyRows, setPartyRows] = useState<PartyRow[] | null>(null);
  const [partySearched, setPartySearched] = useState(false);
  const [partyOpeningBalance, setPartyOpeningBalance] = useState(0);

  /** Opening balance = balance before the range starts */
  const computeOpeningBalanceBeforeRange = useCallback(
    (pid: string, fromDate: Date): number => {
      const rangeStart = startOfDay(fromDate);
      const priorBills = partyBoxBills
        .filter((b) => {
          if (b.partyId !== pid) return false;
          const bd = toDate(b.billDate);
          return bd < rangeStart;
        })
        .sort((a, b) => toDate(b.billDate).getTime() - toDate(a.billDate).getTime());

      if (priorBills.length > 0) return priorBills[0].balanceBox;
      return partyOpeningBoxBalances[pid] || 0;
    },
    [partyBoxBills, partyOpeningBoxBalances],
  );

  const handlePartySearch = useCallback(() => {
    if (!partyId) {
      toast({ variant: 'destructive', title: 'Select a party first' });
      return;
    }
    if (!partyFrom || !partyTo) {
      toast({ variant: 'destructive', title: 'Select From and To dates' });
      return;
    }

    const from = startOfDay(partyFrom);
    const to = endOfDay(partyTo);

    const billsInRange = partyBoxBills
      .filter((b) => {
        if (b.partyId !== partyId) return false;
        const bd = toDate(b.billDate);
        return bd >= from && bd <= to;
      })
      .sort((a, b) => toDate(a.billDate).getTime() - toDate(b.billDate).getTime());

    const rows: PartyRow[] = billsInRange.map((b) => ({
      billId: b.id,
      billDate: toDate(b.billDate),
      boxesTaken: b.todaysFishBox || 0,
      emptyBoxes: b.emptyBox || 0,
      balance: b.balanceBox || 0,
    }));

    const openingBal = computeOpeningBalanceBeforeRange(partyId, partyFrom);
    setPartyOpeningBalance(openingBal);
    setPartyRows(rows);
    setPartySearched(true);
  }, [partyId, partyFrom, partyTo, partyBoxBills, computeOpeningBalanceBeforeRange, toast]);

  const partyTotalTaken = useMemo(
    () => (partyRows || []).reduce((s, r) => s + r.boxesTaken, 0),
    [partyRows],
  );
  const partyTotalEmpty = useMemo(
    () => (partyRows || []).reduce((s, r) => s + r.emptyBoxes, 0),
    [partyRows],
  );
  const partyFinalBalance = useMemo(
    () => (partyRows && partyRows.length > 0 ? partyRows[partyRows.length - 1].balance : partyOpeningBalance),
    [partyRows, partyOpeningBalance],
  );

  const handlePartySharePDF = useCallback(() => {
    if (!partyRows || partyRows.length === 0) {
      toast({ variant: 'destructive', title: 'No data', description: 'Search first to generate report.' });
      return;
    }
    const party = (parties || []).find((p) => p.id === partyId);
    const printData = {
      type: 'party',
      entityLabel: 'Party',
      partyName: party ? `${party.name} (${party.location || party.id})` : partyId,
      fromDate: partyFrom ? format(partyFrom, 'dd-MM-yyyy') : '',
      toDate: partyTo ? format(partyTo, 'dd-MM-yyyy') : '',
      openingBalance: partyOpeningBalance,
      rows: partyRows.map((r) => ({ ...r, billDate: format(r.billDate, 'dd-MM-yyyy') })),
      totalTaken: partyTotalTaken,
      totalEmpty: partyTotalEmpty,
      finalBalance: partyFinalBalance,
    };
    sessionStorage.setItem('partyBoxReportPrintData', JSON.stringify(printData));
    window.open('/print/party-box-report', '_blank');
  }, [partyRows, parties, partyId, partyFrom, partyTo, partyOpeningBalance, partyTotalTaken, partyTotalEmpty, partyFinalBalance, toast]);

  // ─── Calendar popup component ─────────────────────────────────────────────
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
        <h1 className="text-2xl font-headline font-bold text-foreground">Party Box Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate date-wise and party-specific box bill reports.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ═══════════════════════════ LEFT – DATE-WISE ════════════════════════ */}
        <Card className="section-box flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline text-lg">Date-wise Reports</CardTitle>
            <CardDescription>
              Select a date to view bills on that day, or leave date empty to see current balances of all parties.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-1.5 flex-1">
                <Label>Date <span className="text-muted-foreground font-normal text-xs">(optional – leave empty for balance report)</span></Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <DatePicker value={dateWiseDate} onChange={handleDateChange} placeholder="All parties (no date)" />
                  </div>
                  {dateWiseDate && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-[44px] w-[44px] shrink-0"
                      onClick={() => handleDateChange(undefined)}
                      title="Clear date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button onClick={handleDateWiseSearch} className="h-[44px] sm:w-auto w-full">
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </div>

            {/* ── Current Balance Report Results (no date) ── */}
            {balanceSearched && balanceRows !== null && (
              <>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                  Showing current balance for all parties as of {format(new Date(), 'dd-MM-yyyy')}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs uppercase">Party ID</TableHead>
                        <TableHead className="font-bold text-xs uppercase">Party Name</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Opening Bal</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Current Bal</TableHead>
                        <TableHead className="font-bold text-xs uppercase whitespace-nowrap">Last Bill Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceRows.length > 0 ? (
                        balanceRows.map((row) => (
                          <TableRow key={row.partyId}>
                            <TableCell className="font-mono text-xs">{row.partyId}</TableCell>
                            <TableCell className="whitespace-normal break-words">{row.partyName}</TableCell>
                            <TableCell className="text-center font-mono text-base">{row.openingBalance}</TableCell>
                            <TableCell className="text-center font-mono text-base font-bold text-primary">{row.currentBalance}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-sm whitespace-nowrap">{row.lastBillDate}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                            No parties found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="block md:hidden space-y-2">
                  {balanceRows.length > 0 ? (
                    balanceRows.map((row) => (
                      <div key={row.partyId} className="rounded-lg border p-3 bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm whitespace-normal break-words flex-1 pr-2">{row.partyName}</span>
                          <span className="text-xs text-muted-foreground font-mono">{row.partyId}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="text-center">
                            <span className="text-xs text-muted-foreground block">Opening</span>
                            <span className="font-mono">{row.openingBalance}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-xs text-muted-foreground block">Current</span>
                            <span className="font-mono font-bold text-primary">{row.currentBalance}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Last Bill</span>
                            <span className="font-mono text-xs">{row.lastBillDate}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-16 flex items-center justify-center text-sm text-muted-foreground border rounded-lg">
                      No parties found.
                    </div>
                  )}
                </div>

                {/* Totals */}
                {balanceRows.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Total Parties</span>
                        <span className="font-mono text-lg font-bold">{balanceRows.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Sum Opening Balance</span>
                        <span className="font-mono text-lg font-bold">{balanceSumOpening}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Sum Current Balance</span>
                        <span className="font-mono text-xl font-bold text-primary">{balanceSumCurrent}</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleBalanceSharePDF}
                      className="w-full border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                    >
                      <Share className="mr-2 h-4 w-4" /> Share (PDF)
                    </Button>
                  </>
                )}
              </>
            )}

            {/* ── Date-wise Results ── */}
            {dateWiseSearched && dateWiseRows !== null && (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs uppercase">Party ID</TableHead>
                        <TableHead className="font-bold text-xs uppercase">Party Name</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Boxes Taken</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-center">Empty Boxes</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dateWiseRows.length > 0 ? (
                        dateWiseRows.map((row) => (
                          <TableRow key={row.partyId}>
                            <TableCell className="font-mono text-xs">{row.partyId}</TableCell>
                            <TableCell className="whitespace-normal break-words">{row.partyName}</TableCell>
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
                      <div key={row.partyId} className="rounded-lg border p-3 bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm whitespace-normal break-words flex-1 pr-2">{row.partyName}</span>
                          <span className="text-xs text-muted-foreground font-mono">{row.partyId}</span>
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

        {/* ══════════════════════════ RIGHT – PARTY ═════════════════════════════ */}
        <Card className="section-box flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline text-lg">Party Reports</CardTitle>
            <CardDescription>View box bills for a party within a date range.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Controls */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Party</Label>
                <ReactSelect
                  instanceId="party-report-select"
                  placeholder="Select party..."
                  isClearable
                  options={partyOptions}
                  value={partyOptions.find((o) => o.value === partyId) || null}
                  onChange={(opt) => { setPartyId(opt ? opt.value : ''); setPartyRows(null); setPartySearched(false); }}
                  styles={reactSelectStyles}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>From</Label>
                  <DatePicker value={partyFrom} onChange={setPartyFrom} placeholder="From date" />
                </div>
                <div className="grid gap-1.5">
                  <Label>To</Label>
                  <DatePicker value={partyTo} onChange={setPartyTo} placeholder="To date" />
                </div>
              </div>
              <Button onClick={handlePartySearch} className="h-[44px] w-full">
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </div>

            {/* Results */}
            {partySearched && partyRows !== null && (
              <>
                {/* Opening Balance */}
                <div className="rounded-md bg-muted/50 border px-3 py-2 text-sm flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Opening Balance</span>
                  <span className="font-mono font-bold text-base">{partyOpeningBalance}</span>
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
                      {partyRows.length > 0 ? (
                        partyRows.map((row) => (
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
                  {partyRows.length > 0 ? (
                    partyRows.map((row) => (
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
                {partyRows.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Total Boxes Taken</span>
                        <span className="font-mono text-lg font-bold">{partyTotalTaken}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-muted-foreground">Total Empty Boxes</span>
                        <span className="font-mono text-lg font-bold">{partyTotalEmpty}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 mt-1">
                        <span className="text-base font-bold">Final Box Balance</span>
                        <span className="font-mono text-xl font-bold text-primary">{partyFinalBalance}</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handlePartySharePDF}
                      className="w-full border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                    >
                      <Share className="mr-2 h-4 w-4" /> Share (PDF)
                    </Button>
                  </>
                )}

                {partySearched && partyRows.length === 0 && (
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
