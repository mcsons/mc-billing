'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar as CalendarIcon,
  PlusCircle,
  Save,
  Printer,
  Trash2,
  Search,
  X,
  FilePlus,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import ReactSelect from 'react-select';
import { PartyBill, PartyBillItem } from '@/lib/data';
import { Timestamp } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';

const reactSelectStyles = {
    control: (baseStyles, state) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    menu: (baseStyles) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--card))',
      zIndex: 50,
    }),
    option: (baseStyles, state) => ({
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
    singleValue: (baseStyles) => ({
      ...baseStyles,
      color: 'hsl(var(--foreground))',
    }),
    input: (baseStyles) => ({
      ...baseStyles,
      color: 'hsl(var(--foreground))',
    }),
     placeholder: (baseStyles) => ({
      ...baseStyles,
      color: 'hsl(var(--muted-foreground))',
    }),
  };

export default function PartyBillPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const showAlertDialog = useAlertDialog();

    const {
        products,
        parties,
        partyBills,
        partyBalances,
        addOrUpdatePartyBill,
        deletePartyBill,
        currentUser,
    } = useData();

    // Form State
    const [date, setDate] = useState<Date>(new Date());
    const [partyId, setPartyId] = useState('');
    const [totalBox, setTotalBox] = useState('');
    const [items, setItems] = useState<PartyBillItem[]>([]);
    
    // Item entry state
    const [rate, setRate] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [box, setBox] = useState('');

    // Deductions & Payments
    const [commission, setCommission] = useState('');
    const [expenses, setExpenses] = useState('');
    const [rent, setRent] = useState('');
    const [cashReceived, setCashReceived] = useState('');
    const [bankReceived, setBankReceived] = useState('');
    
    // Editing state
    const [editingBillId, setEditingBillId] = useState<string | null>(null);
    const [billOriginalState, setBillOriginalState] = useState<PartyBill | null>(null);

    // History State
    const [historyPartyId, setHistoryPartyId] = useState('');
    const [historyDate, setHistoryDate] = useState<Date|undefined>();
    const [filteredHistory, setFilteredHistory] = useState<PartyBill[]>([]);

    useEffect(() => {
        setFilteredHistory(partyBills.sort((a,b) => b.date.toDate().getTime() - a.date.toDate().getTime()));
    }, [partyBills]);
    
    const resetForm = useCallback(() => {
        setDate(new Date());
        setPartyId('');
        setTotalBox('');
        setItems([]);
        setCommission('');
        setExpenses('');
        setRent('');
        setCashReceived('');
        setBankReceived('');
        setEditingBillId(null);
        setBillOriginalState(null);
        router.replace('/dashboard/party-bill');
    }, [router]);

    // Load bill for editing from URL param
    useEffect(() => {
        const billIdParam = searchParams.get('partyBillId');
        if (billIdParam) {
            const billToEdit = partyBills.find(b => b.id === billIdParam);
            if (billToEdit) {
                setEditingBillId(billToEdit.id);
                setBillOriginalState(billToEdit);
                setDate(billToEdit.date.toDate());
                setPartyId(billToEdit.partyId);
                setTotalBox(billToEdit.totalBox.toString());
                setItems(billToEdit.items);
                setCommission(billToEdit.commission.toString());
                setExpenses(billToEdit.expenses.toString());
                setRent(billToEdit.rent.toString());
                setCashReceived(billToEdit.cashReceived.toString());
                setBankReceived(billToEdit.bankReceived.toString());
            }
        } else {
            resetForm();
        }
    }, [searchParams, partyBills, resetForm]);


    // Calculations
    const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);
    const totalDeductions = useMemo(() => (parseFloat(commission) || 0) + (parseFloat(expenses) || 0) + (parseFloat(rent) || 0), [commission, expenses, rent]);
    const netAmount = useMemo(() => totalAmount - totalDeductions, [totalAmount, totalDeductions]);
    const totalReceived = useMemo(() => (parseFloat(cashReceived) || 0) + (parseFloat(bankReceived) || 0), [cashReceived, bankReceived]);
    const previousBalance = useMemo(() => {
        if (!partyId) return 0;
        const currentBalance = partyBalances[partyId] || 0;
        if (editingBillId && billOriginalState) {
            // Revert the effect of the original bill to get the balance *before* this bill was saved
            const originalNetAmount = billOriginalState.netAmount;
            const originalReceived = billOriginalState.totalReceived;
            return currentBalance - (originalNetAmount - originalReceived);
        }
        return currentBalance;
    }, [partyId, partyBalances, editingBillId, billOriginalState]);
    const finalBalance = useMemo(() => previousBalance + netAmount - totalReceived, [previousBalance, netAmount, totalReceived]);
    

    const handleAddItem = () => {
        const product = products.find(p => p.id === selectedProductId);
        if (!product || !rate || !box) {
            toast({ variant: 'destructive', title: 'Missing Item Info' });
            return;
        }
        const rateNum = parseFloat(rate);
        const boxNum = parseFloat(box);
        const newItem: PartyBillItem = {
            id: Date.now().toString(),
            productId: product.id,
            productName: product.name_en,
            rate: rateNum,
            box: boxNum,
            amount: rateNum * boxNum,
        };
        setItems(prev => [...prev, newItem]);
        // Reset item form
        setSelectedProductId('');
        setRate('');
        setBox('');
    };

    const handleRemoveItem = (itemId: string) => {
        setItems(prev => prev.filter(item => item.id !== itemId));
    };

    const handleSave = async () => {
        const party = parties.find(p => p.id === partyId);
        if (!party || !currentUser) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        
        const billData: Omit<PartyBill, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> = {
            date: Timestamp.fromDate(date),
            partyId,
            partyName: party.name,
            totalBox: parseFloat(totalBox) || 0,
            items,
            totalAmount,
            commission: parseFloat(commission) || 0,
            expenses: parseFloat(expenses) || 0,
            rent: parseFloat(rent) || 0,
            totalDeductions,
            netAmount,
            cashReceived: parseFloat(cashReceived) || 0,
            bankReceived: parseFloat(bankReceived) || 0,
            totalReceived,
        };
        
        const savedBill = await addOrUpdatePartyBill(billData, editingBillId);
        if (savedBill) {
            if (!editingBillId) { // If it was a new bill
                resetForm();
            } else { // If editing, update original state
                setBillOriginalState(savedBill);
            }
        }
    };
    
    const handleDelete = (billId: string) => {
        showAlertDialog({
            title: 'Delete Party Bill?',
            description: 'This will permanently delete this bill and update the party balance. This cannot be undone.',
            onConfirm: () => {
                const billToDelete = partyBills.find(b => b.id === billId);
                if (billToDelete) {
                    deletePartyBill(billToDelete);
                    if (editingBillId === billId) {
                        resetForm();
                    }
                }
            },
        });
    };

    const handlePrint = () => {
         const party = parties.find(p => p.id === partyId);
        if (!party) {
            toast({ variant: 'destructive', title: 'Cannot Print', description: 'Please select a party.' });
            return;
        }

        const billToPrint: Omit<PartyBill, 'createdBy'> = {
            id: editingBillId || 'N/A',
            date: Timestamp.fromDate(date),
            partyId,
            partyName: party.name,
            totalBox: parseFloat(totalBox) || 0,
            items,
            totalAmount,
            commission: parseFloat(commission) || 0,
            expenses: parseFloat(expenses) || 0,
            rent: parseFloat(rent) || 0,
            totalDeductions,
            netAmount,
            cashReceived: parseFloat(cashReceived) || 0,
            bankReceived: parseFloat(bankReceived) || 0,
            totalReceived,
        };

        const printData = { ...billToPrint, previousBalance, finalBalance };
        const encodedData = encodeURIComponent(JSON.stringify(printData));
        window.open(`/print/party-bill?data=${encodedData}`, '_blank');
    };

    const handleSearchHistory = () => {
        let results = partyBills;
        if (historyPartyId) {
            results = results.filter(b => b.partyId === historyPartyId);
        }
        if (historyDate) {
            results = results.filter(b => b.date && isSameDay(b.date.toDate(), historyDate));
        }
        setFilteredHistory(results.sort((a,b) => b.date.toDate().getTime() - a.date.toDate().getTime()));
    };

    const clearSearchHistory = () => {
        setHistoryPartyId('');
        setHistoryDate(undefined);
        setFilteredHistory(partyBills.sort((a,b) => b.date.toDate().getTime() - a.date.toDate().getTime()));
    };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 auto-rows-max">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <div className="text-center">
                        <p className="font-bold">M.C & SONS FISH COMPANY</p>
                        <p className="text-sm">Dealer : SEA & TANK FOODS</p>
                        <p className="text-sm">Shop No. 1, Fish Market, Santhaipettai,</p>
                        <p className="text-sm">Palladam Road, Tiruppur – 641604</p>
                        <p className="text-sm">Cell : 98432 23078, 99444 44497</p>
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center">
                        <div className="w-1/2">
                            <Label>To M/S :</Label>
                             <ReactSelect
                                instanceId="party-select"
                                options={parties.map(p => ({ value: p.id, label: p.name }))}
                                value={parties.map(p => ({ value: p.id, label: p.name })).find(p => p.value === partyId) || null}
                                onChange={(option) => setPartyId(option ? option.value : '')}
                                placeholder="Select Party..."
                                isClearable
                                styles={reactSelectStyles}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                           <Popover>
                                <PopoverTrigger asChild>
                                <Button variant={'outline'} className={cn('w-[180px] justify-start text-left font-normal',!date && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? `Date : ${format(date, 'dd-MM-yyyy')}` : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={(d) => setDate(d || new Date())} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                         <div className="flex items-center gap-2 w-1/4">
                            <Label>Box :</Label>
                            <Input type="number" value={totalBox} onChange={e => setTotalBox(e.target.value)} />
                        </div>
                    </div>
                    <Separator className="my-2"/>
                </CardHeader>
                <CardContent>
                    {/* Items Table */}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/4">Rate</TableHead>
                                <TableHead>Particulars</TableHead>
                                <TableHead className="w-1/4">Box</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.rate.toFixed(2)}</TableCell>
                                    <TableCell>{item.productName}</TableCell>
                                    <TableCell>{item.box}</TableCell>
                                    <TableCell className="text-right">{item.amount.toFixed(2)}</TableCell>
                                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))}
                            {/* Item Entry Row */}
                             <TableRow>
                                <TableCell><Input placeholder="Rate" type="number" value={rate} onChange={e => setRate(e.target.value)} /></TableCell>
                                <TableCell>
                                    <ReactSelect
                                        instanceId="product-select"
                                        options={products.map(p => ({ value: p.id, label: p.name_en }))}
                                        value={products.map(p => ({ value: p.id, label: p.name_en })).find(p => p.value === selectedProductId) || null}
                                        onChange={(option) => setSelectedProductId(option ? option.value : '')}
                                        placeholder="Select Product..."
                                        styles={reactSelectStyles}
                                    />
                                </TableCell>
                                <TableCell><Input placeholder="Box" type="number" value={box} onChange={e => setBox(e.target.value)} /></TableCell>
                                <TableCell></TableCell>
                                <TableCell><Button size="icon" onClick={handleAddItem}><PlusCircle className="h-4 w-4"/></Button></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    <Separator className="my-4"/>
                    {/* Totals Section */}
                    <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                        <div className="space-y-2">
                             <div className="flex justify-between items-center"><Label>Commission</Label><Input className="max-w-32" type="number" value={commission} onChange={e => setCommission(e.target.value)} /></div>
                             <div className="flex justify-between items-center"><Label>Expenses</Label><Input className="max-w-32" type="number" value={expenses} onChange={e => setExpenses(e.target.value)} /></div>
                             <div className="flex justify-between items-center"><Label>Rent</Label><Input className="max-w-32" type="number" value={rent} onChange={e => setRent(e.target.value)} /></div>
                             <Separator/>
                             <div className="flex justify-between items-center font-semibold"><Label>Total Less</Label><span>{totalDeductions.toFixed(2)}</span></div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center font-bold text-lg"><Label>Total Bill Value</Label><span>{totalAmount.toFixed(2)}</span></div>
                            <Separator/>
                            <div className="flex justify-between items-center font-bold"><Label>Net Bill Value</Label><span>{netAmount.toFixed(2)}</span></div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center"><Label>Cash</Label><Input className="max-w-32" type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)} /></div>
                            <div className="flex justify-between items-center"><Label>Bank / Acc</Label><Input className="max-w-32" type="number" value={bankReceived} onChange={e => setBankReceived(e.target.value)} /></div>
                            <Separator/>
                            <div className="flex justify-between items-center font-semibold"><Label>Total Received</Label><span>{totalReceived.toFixed(2)}</span></div>
                        </div>

                         <div className="space-y-2 text-right">
                             <div className="flex justify-between items-center"><Label>Previous Balance</Label><span>{previousBalance.toFixed(2)}</span></div>
                             <Separator/>
                             <div className="flex justify-between items-center font-bold text-xl"><Label>Final Balance</Label><span>{finalBalance.toFixed(2)}</span></div>
                             <Separator/>
                         </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={resetForm}><FilePlus className="mr-2 h-4 w-4"/>New</Button>
                        <Button onClick={handleSave}><Save className="mr-2 h-4 w-4"/>{editingBillId ? 'Update' : 'Save'}</Button>
                        <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Party Bill History</CardTitle>
                    <CardDescription>Search and manage previously created party bills.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid sm:grid-cols-2 items-end gap-4">
                        <div className="grid gap-2">
                            <Label>Party</Label>
                            <ReactSelect
                                options={parties.map(p => ({ value: p.id, label: p.name}))}
                                value={parties.map(p => ({ value: p.id, label: p.name})).find(p => p.value === historyPartyId) || null}
                                onChange={(o) => setHistoryPartyId(o ? o.value : '')}
                                isClearable
                                placeholder="Filter by party..."
                                styles={reactSelectStyles}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !historyDate && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {historyDate ? format(historyDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} /></PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSearchHistory} className="w-full sm:w-auto"><Search className="mr-2 h-4 w-4" /> Search</Button>
                        <Button variant="ghost" onClick={clearSearchHistory} className="w-full sm:w-auto"><X className="mr-2 h-4 w-4" /> Clear</Button>
                    </div>
                    <div className="relative h-96 overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card">
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Party</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHistory.map(bill => (
                                    <TableRow key={bill.id} onDoubleClick={() => router.push(`/dashboard/party-bill?partyBillId=${bill.id}`)} className="cursor-pointer">
                                        <TableCell>{format(bill.date.toDate(), 'dd-MM-yy')}</TableCell>
                                        <TableCell>{bill.partyName}</TableCell>
                                        <TableCell className="text-right">{bill.netAmount.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(bill.id);}}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
