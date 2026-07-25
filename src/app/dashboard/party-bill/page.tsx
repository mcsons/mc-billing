'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Share2,
  Loader2,
  Pencil,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useLoading } from '@/context/LoadingContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import ReactSelect from 'react-select';
import { PartyBill, PartyBillItem } from '@/lib/data';
import { Timestamp } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';

const formatINR = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val.toString().replace(/,/g, '')) : val;
    if (isNaN(num)) return '0.00';
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

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
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
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

export default function PartyBillPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const showAlertDialog = useAlertDialog();
    const { setLoading } = useLoading();
    const [isSaving, setIsSaving] = useState(false);
    const [isShareLoading, setIsShareLoading] = useState(false);

    const {
        products,
        parties,
        partyBills,
        partyBalances,
        addOrUpdatePartyBill,
        deletePartyBill,
        setPartyBalance,
        currentUser,
    } = useData();

    // Form State
    const [date, setDate] = useState<Date>(new Date());
    const [partyId, setPartyId] = useState('');
    const [totalBox, setTotalBox] = useState('');
    const [totalKgs, setTotalKgs] = useState('');
    const [items, setItems] = useState<PartyBillItem[]>([]);
    
    // Item entry state
    const [rate, setRate] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [box, setBox] = useState('');
    const [kgs, setKgs] = useState('');

    // Deductions & Payments
    const [commission, setCommission] = useState('10');
    const [expenses, setExpenses] = useState('');
    const [rent, setRent] = useState('');
    const [cashReceived, setCashReceived] = useState('');
    const [bankReceived, setBankReceived] = useState('');
    
    // Editing state
    const [editingBillId, setEditingBillId] = useState<string | null>(null);
    const [billOriginalState, setBillOriginalState] = useState<PartyBill | null>(null);

    // Session state for previous balance
    const [prevBalInput, setPrevBalInput] = useState('0');
    const [originalPrevBalance, setOriginalPrevBalance] = useState(0);
    const [isPrevBalModified, setIsPrevBalModified] = useState(false);
    const [isPrevBalFocused, setIsPrevBalFocused] = useState(false);
    
    // Derived numeric value from input
    const staticPrevBalance = useMemo(() => parseFloat(prevBalInput.toString().replace(/,/g, '')) || 0, [prevBalInput]);

    // History State
    const [historyPartyId, setHistoryPartyId] = useState('');
    const [historyDate, setHistoryDate] = useState<Date|undefined>();
    const [filteredHistory, setFilteredHistory] = useState<PartyBill[]>([]);

    const lastSessionRef = useRef({ billId: '', partyId: '' });

    const [isMounted, setIsMounted] = useState(false);
    const rateInputRef = useRef<HTMLInputElement>(null);
    const partySelectRef = useRef<any>(null);
    const [showPrintConfirm, setShowPrintConfirm] = useState(false);
    const historyTableBodyRef = useRef<HTMLTableSectionElement>(null);

    const [showWhatsAppShareConfirm, setShowWhatsAppShareConfirm] = useState(false);


    useEffect(() => {
        setIsMounted(true);
        partySelectRef.current?.focus();
    }, []);

    const filterAndSortBills = useCallback(() => {
        let results = partyBills || [];
        if (historyPartyId) {
            results = results.filter(b => b.partyId === historyPartyId);
        }
        if (historyDate) {
            results = results.filter(b => {
                const bDate = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
                return isSameDay(bDate, historyDate);
            });
        }
        if (!historyPartyId && !historyDate) {
            const start = startOfWeek(new Date(), { weekStartsOn: 1 });
            const end = endOfWeek(new Date(), { weekStartsOn: 1 });
            results = results.filter(b => {
                const bDate = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
                return bDate >= start && bDate <= end;
            });
        }
        setFilteredHistory(results.sort((a,b) => {
            const dateA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
            const dateB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
            return dateB.getTime() - dateA.getTime();
        }));
    }, [partyBills, historyPartyId, historyDate]);

    useEffect(() => {
        filterAndSortBills();
    }, [filterAndSortBills]);
    
    const resetForm = useCallback(() => {
        setDate(new Date());
        setPartyId('');
        setTotalBox('');
        setTotalKgs('');
        setItems([]);
        setCommission('10');
        setExpenses('');
        setRent('');
        setCashReceived('');
        setBankReceived('');
        setEditingBillId(null);
        setBillOriginalState(null);
        setPrevBalInput('0');
        setOriginalPrevBalance(0);
        setIsPrevBalModified(false);
        router.replace('/dashboard/party-bill');
        partySelectRef.current?.focus();
    }, [router]);

    const hasUnsavedChanges = useMemo(() =>
        partyId !== '' ||
        items.length > 0 ||
        expenses !== '' ||
        rent !== '' ||
        cashReceived !== '' ||
        bankReceived !== '' ||
        editingBillId !== null ||
        isPrevBalModified,
    [partyId, items, expenses, rent, cashReceived, bankReceived, editingBillId, isPrevBalModified]);

    const handleNewBill = useCallback(() => {
        if (hasUnsavedChanges) {
            showAlertDialog({
                title: 'Unsaved Changes',
                description: 'You have unsaved changes. Are you sure you want to start a new bill? All current data will be lost.',
                confirmText: 'Yes, Discard and Start New',
                cancelText: 'Cancel',
                onConfirm: resetForm,
            });
        } else {
            resetForm();
        }
    }, [hasUnsavedChanges, showAlertDialog, resetForm]);

    // Load bill for editing from URL param or handle party change
    useEffect(() => {
        const billIdParam = searchParams.get('partyBillId');
        
        if (billIdParam) {
            if (lastSessionRef.current.billId === billIdParam) return;
            const billToEdit = (partyBills || []).find(b => b.id === billIdParam);
            if (billToEdit) {
                setEditingBillId(billToEdit.id);
                setBillOriginalState(billToEdit);
                setDate(billToEdit.date instanceof Timestamp ? billToEdit.date.toDate() : new Date(billToEdit.date));
                setPartyId(billToEdit.partyId);
                setTotalBox((billToEdit.totalBox ?? 0).toString());
                setTotalKgs((billToEdit.totalKgs ?? 0).toString());
                setItems(billToEdit.items || []);
                setCommission((billToEdit.commission ?? 0).toString());
                setExpenses((billToEdit.expenses ?? 0).toString());
                setRent((billToEdit.rent ?? 0).toString());
                setCashReceived((billToEdit.cashReceived ?? 0).toString());
                setBankReceived((billToEdit.bankReceived ?? 0).toString());

                const currentBalance = partyBalances[billToEdit.partyId] || 0;
                const originalNetAmount = billToEdit.netAmount;
                const originalReceived = billToEdit.totalReceived;
                const prev = currentBalance - (originalNetAmount - originalReceived);
                
                setPrevBalInput(prev.toString());
                setOriginalPrevBalance(prev);
                setIsPrevBalModified(false);
                
                lastSessionRef.current = { billId: billIdParam, partyId: billToEdit.partyId };
            }
        } else {
            // New Bill Mode
            if (partyId && lastSessionRef.current.partyId !== partyId) {
                const prev = partyBalances[partyId] || 0;
                setPrevBalInput(prev.toString());
                setOriginalPrevBalance(prev);
                setIsPrevBalModified(false);
                lastSessionRef.current = { billId: '', partyId };
            } else if (!partyId && (lastSessionRef.current.partyId || lastSessionRef.current.billId)) {
               lastSessionRef.current = { billId: '', partyId: '' };
            }
        }
    }, [searchParams, partyBills, partyId, partyBalances, resetForm]);


    // Calculations
    const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);
    const commissionAmount = useMemo(() => (totalAmount * (parseFloat(commission) || 0)) / 100, [totalAmount, commission]);
    const totalDeductions = useMemo(() => commissionAmount + (parseFloat(expenses) || 0) + (parseFloat(rent) || 0), [commissionAmount, expenses, rent]);
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
    const finalBalance = useMemo(() => staticPrevBalance + netAmount - totalReceived, [staticPrevBalance, netAmount, totalReceived]);
    
    // Auto-calculated totals from items
    const calculatedTotalBox = useMemo(() => items.reduce((sum, item) => sum + (item.box || 0), 0), [items]);
    const calculatedTotalKgs = useMemo(() => items.reduce((sum, item) => sum + ((item.box || 0) * (item.kgs || 0)), 0), [items]);

    const handleAddItem = () => {
        const product = products.find(p => p.id === selectedProductId);
        if (!product || !rate || !box || !kgs) {
            toast({ variant: 'destructive', title: 'Missing Item Info', description: 'Please enter Rate, Product, Box count and Kgs per box.' });
            return;
        }
        const rateNum = parseFloat(rate);
        const boxNum = parseFloat(box) || 0;
        const kgsNum = parseFloat(kgs) || 0;
        const amount = boxNum * rateNum; // Corrected: Amount is Box x Rate
        
        const newItem: PartyBillItem = {
            id: Date.now().toString(),
            productId: product.id,
            productName: product.name_en,
            rate: rateNum,
            box: boxNum,
            kgs: kgsNum,
            amount: amount,
        };
        setItems(prev => [...prev, newItem]);
        // Reset item form
        setSelectedProductId('');
        setRate('');
        setBox('');
        setKgs('');
        rateInputRef.current?.focus();
    };

    const handleItemUpdate = useCallback((itemId: string, field: 'rate' | 'box' | 'kgs', value: string) => {
      setItems(prevItems =>
          prevItems.map(item => {
              if (item.id === itemId) {
                  const newValue = parseFloat(value) || 0;
                  const updatedItem = { ...item };
  
                  if (field === 'rate') {
                      updatedItem.rate = newValue;
                  } else if (field === 'box') {
                      updatedItem.box = newValue;
                  } else if (field === 'kgs') {
                      updatedItem.kgs = newValue;
                  }
                  
                  // Financial amount is strictly Box x Rate
                  updatedItem.amount = updatedItem.box * updatedItem.rate;
  
                  return updatedItem;
              }
              return item;
          })
      );
  }, []);

    const handleRemoveItem = (itemId: string) => {
        const itemToDelete = items.find(item => item.id === itemId);
        if (!itemToDelete) return;

        showAlertDialog({
          title: 'Delete Item?',
          description: 'Are you sure you want to remove this item from the bill?',
          onConfirm: () => {
            setItems(prev => prev.filter(item => item.id !== itemId));
            toast({
              title: "Item removed",
              duration: 10000,
              action: (
                <ToastAction altText="Undo" onClick={() => setItems(prev => [...prev, itemToDelete])}>Undo</ToastAction>
              )
            });
          },
        });
    };

    const handleSave = async () => {
        const party = parties.find(p => p.id === partyId);
        if (!party || !currentUser) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return null;
        }
        
        const billData: Omit<PartyBill, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> = {
            date: Timestamp.fromDate(date),
            partyId,
            partyName: party.name,
            totalBox: totalBox !== '' ? parseFloat(totalBox) || 0 : calculatedTotalBox,
            totalKgs: totalKgs !== '' ? parseFloat(totalKgs) || 0 : calculatedTotalKgs,
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
            previousBalance: staticPrevBalance,
            finalBalance,
        };
        
        const savedBill = await addOrUpdatePartyBill(billData, editingBillId);
        
        if (savedBill && isPrevBalModified && partyId) {
            await setPartyBalance(partyId, finalBalance);
        }
        
        return savedBill;
    };
    
    const onSaveClick = async () => {
      if (isSaving) return;
      
      try {
        setIsSaving(true);
        setLoading(true, 'Saving party bill...');
        const savedBill = await handleSave();
        if (savedBill) {
          if (!editingBillId) {
              resetForm();
          } else {
              setBillOriginalState(savedBill);
          }
        }
      } finally {
        setIsSaving(false);
        setLoading(false);
      }
    };
    
    const handleDelete = (billId: string) => {
        const billToDelete = (partyBills || []).find(b => b.id === billId);
        if (!billToDelete) return;

        showAlertDialog({
            title: 'Delete Party Bill?',
            description: 'This will permanently delete this bill and update the party balance. This cannot be undone.',
            onConfirm: async () => {
                let undoClicked = false;
                await deletePartyBill(billToDelete);
                if (editingBillId === billId) {
                    resetForm();
                }
                toast({
                  title: "Bill removed",
                  description: "Undo is available for 10 seconds.",
                  duration: 10000,
                  action: (
                    <ToastAction altText="Undo" onClick={() => {
                      undoClicked = true;
                      addOrUpdatePartyBill(billToDelete, billToDelete.id);
                      toast({ title: "Bill restored" });
                    }}>Undo</ToastAction>
                  )
                });

                setTimeout(() => {
                  if (!undoClicked) {
                    toast({
                      title: "Party Bill Deleted",
                      description: "The party bill has been permanently deleted."
                    });
                  }
                }, 10500);
            },
        });
    };

    const getPrintData = useCallback(() => {
        const party = parties.find(p => p.id === partyId);
        if (!party) return null;
        
        const finalBoxValue = totalBox !== '' ? parseFloat(totalBox) || 0 : calculatedTotalBox;
        const finalKgsValue = totalKgs !== '' ? parseFloat(totalKgs) || 0 : calculatedTotalKgs;

        const totalAfterPrevious = netAmount + previousBalance;

        const data = {
            id: editingBillId || 'N/A',
            date: Timestamp.fromDate(date),
            partyId,
            partyName: party.name,
            partyLocation: party.location,
            totalBox: finalBoxValue,
            totalKgs: finalKgsValue,
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
            previousBalance: staticPrevBalance,
            totalAfterPrevious,
            finalBalance,
        };
        return data;
    }, [
        partyId, parties, editingBillId, date, items, totalAmount, commission, 
        expenses, rent, cashReceived, bankReceived, previousBalance, netAmount, totalDeductions, totalReceived, finalBalance, totalBox, totalKgs, calculatedTotalBox, calculatedTotalKgs
    ]);
    
    const proceedToPrint = useCallback((data: any) => {
        if (!data) {
            toast({ variant: 'destructive', title: 'Cannot Print', description: 'Missing bill data.' });
            return;
        }
        localStorage.setItem('partyBillPrintData', JSON.stringify(data));
        window.open(`/print/party-bill`, '_blank');
    }, [toast]);

    const handlePrint = () => {
         const party = parties.find(p => p.id === partyId);
        if (!party) {
            toast({ variant: 'destructive', title: 'Cannot Print', description: 'Please select a party.' });
            return;
        }
        setShowPrintConfirm(true);
    };

    const handleSaveAndPrint = async () => {
        if (isSaving) return;
        setShowPrintConfirm(false);

        try {
            setIsSaving(true);
            setLoading(true, 'Saving and printing...');
            const savedBill = await handleSave();
            if (savedBill) {
                const printData = getPrintData();
                // Use the savedBill id for printing, which might be new
                proceedToPrint({ ...printData, id: savedBill.id });
                if (!editingBillId) {
                    resetForm();
                } else {
                    setBillOriginalState(savedBill);
                }
            }
        } finally {
            setIsSaving(false);
            setLoading(false);
        }
    };

    const handlePrintWithoutSaving = () => {
        setShowPrintConfirm(false);
        const data = getPrintData();
        proceedToPrint(data);
    };

    const handleSharePDF = async () => {
        const party = parties.find(p => p.id === partyId);
        if (!party) {
            toast({ variant: 'destructive', title: 'Cannot Share', description: 'Please select a party.' });
            return;
        }
        if (isShareLoading) return;

        setIsShareLoading(true);
        try {
            // Save first, then open print page with share=pdf flag
            setLoading(true, 'Preparing PDF...');
            const savedBill = await handleSave();
            setLoading(false);
            if (!savedBill) return;

            const printData = getPrintData();
            if (!printData) return;
            const finalData = { ...printData, id: savedBill.id };

            const partyName = party.name.replace(/\s+/g, '_');
            const formattedDate = format(date, 'dd-MM-yyyy');
            localStorage.setItem('partyBillPrintData', JSON.stringify(finalData));
            localStorage.setItem('partyBillFileName', `MC_PartyBill_${partyName}_${formattedDate}.pdf`);
            window.open(`/print/party-bill?share=pdf`, '_blank');

            if (!editingBillId) {
                resetForm();
            } else {
                setBillOriginalState(savedBill);
            }
        } finally {
            setIsShareLoading(false);
            setLoading(false);
        }
    };


    const handleSearchHistory = useCallback(() => {
        filterAndSortBills();
    }, [filterAndSortBills]);

    const clearSearchHistory = () => {
        setHistoryPartyId('');
        setHistoryDate(undefined);
    };

    const handleHistoryPartyKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          const firstRow = historyTableBodyRef.current?.querySelector('tr');
          if (firstRow) {
              (firstRow as HTMLElement).focus();
          }
      }
    };
  
    const handleHistoryRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, billId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            router.push(`/dashboard/party-bill?partyBillId=${billId}`);
        } else if (e.key === 'ArrowDown') {
            // No default behavior change needed
        } else if (e.key === 'ArrowUp') {
            // No default behavior change needed
        }
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

  return (
    <>
    <div className="grid grid-cols-1 gap-8 auto-rows-max">
        <Card>
            <CardHeader>
                <div className="relative">
                    <div className="text-center">
                        <p className="font-bold text-lg">M.C & SONS FISH COMPANY</p>
                        <p className="text-sm">Cell : 98432 23078, 99444 44497</p>
                    </div>
                    <div className="absolute top-0 right-0 flex items-center gap-2">
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button 
                                variant={'outline'} 
                                className={cn('w-[180px] justify-start text-left font-normal select-none',!date && 'text-muted-foreground')}
                                onFocus={() => { if (!date) setDate(new Date()); }}
                                onKeyDown={(e) => handleDateKeyDown(e, date, setDate as (d: Date) => void)}
                                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? `Date : ${format(date, 'dd-MM-yyyy')}` : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={(d) => setDate(d || new Date())} initialFocus /></PopoverContent>
                        </Popover>
                        <Button variant="outline" onClick={handleNewBill}>
                            <FilePlus className="mr-2 h-4 w-4" />New Bill
                        </Button>
                    </div>
                </div>
                <Separator className="my-2"/>
                <div className="flex justify-between items-center">
                    <div className="w-2/3">
                        <Label>To M/S :</Label>
                         <ReactSelect
                            ref={partySelectRef}
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
                        <Label>Total Box :</Label>
                        <Input 
                            type="number" 
                            value={totalBox} 
                            onChange={e => setTotalBox(e.target.value)} 
                            className="w-24"
                            placeholder={calculatedTotalBox.toString()}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label>Total Weight :</Label>
                        <Input 
                            type="number" 
                            value={totalKgs} 
                            onChange={e => setTotalKgs(e.target.value)} 
                            className="w-24"
                            placeholder={calculatedTotalKgs.toString()}
                        />
                    </div>
                </div>
                <Separator className="my-2"/>
            </CardHeader>
            <CardContent>
                {/* Items Table */}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold text-base">Particulars</TableHead>
                            <TableHead className="w-[100px] font-bold text-base text-center">Box</TableHead>
                            <TableHead className="w-[100px] font-bold text-base text-center">Kgs (per box)</TableHead>
                            <TableHead className="w-[120px] font-bold text-base text-center">Rate</TableHead>
                            <TableHead className="text-right w-[150px] font-bold text-base">Amount</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell>
                                  <Input
                                      type="number"
                                      value={item.box || ''}
                                      onChange={(e) => handleItemUpdate(item.id, 'box', e.target.value)}
                                      className="h-8 w-full text-center font-mono text-base"
                                      placeholder="Box"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                      type="number"
                                      value={item.kgs || ''}
                                      onChange={(e) => handleItemUpdate(item.id, 'kgs', e.target.value)}
                                      className="h-8 w-full text-center font-mono text-base"
                                      placeholder="Kgs"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                      type="number"
                                      value={item.rate}
                                      onChange={(e) => handleItemUpdate(item.id, 'rate', e.target.value)}
                                      className="h-8 w-full text-center font-mono text-base"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono text-base">{item.amount.toFixed(2)}</TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                            </TableRow>
                        ))}
                        {/* Item Entry Row */}
                         <TableRow>
                            <TableCell>
                                <ReactSelect
                                    instanceId="product-select"
                                    options={products.map(p => ({ value: p.id, label: p.name_en }))}
                                    value={products.map(p => ({ value: p.id, label: p.name_en })).find(p => p.value === selectedProductId) || null}
                                    onChange={(option) => setSelectedProductId(option ? option.value : '')}
                                    placeholder="Select Product..."
                                    styles={reactSelectStyles}
                                    menuPortalTarget={isMounted ? document.body : null}
                                    menuPosition='fixed'
                                />
                            </TableCell>
                            <TableCell>
                                <Input 
                                    placeholder="Box" 
                                    type="number" 
                                    value={box} 
                                    onChange={e => setBox(e.target.value)} 
                                    className="w-full text-center text-base font-mono"
                                />
                            </TableCell>
                            <TableCell>
                                <Input 
                                    placeholder="Kgs" 
                                    type="number" 
                                    value={kgs} 
                                    onChange={e => setKgs(e.target.value)} 
                                    className="w-full text-center text-base font-mono"
                                />
                            </TableCell>
                            <TableCell>
                                <Input 
                                    ref={rateInputRef} 
                                    placeholder="Rate" 
                                    type="number" 
                                    value={rate} 
                                    onChange={e => setRate(e.target.value)}
                                    className="w-full text-center text-base font-mono"
                                />
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell><Button size="icon" onClick={handleAddItem}><PlusCircle className="h-4 w-4"/></Button></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                <Separator className="my-4"/>
                {/* Totals Section */}
                <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                    <div className="space-y-2">
                         <div className="flex justify-between items-center">
                            <Label>Commission (%)</Label>
                            <Input className="max-w-32" type="number" value={commission} onChange={e => setCommission(e.target.value)} />
                        </div>
                         <div className="flex justify-between items-center"><Label>Expenses</Label><Input className="max-w-32" type="number" value={expenses} onChange={e => setExpenses(e.target.value)} /></div>
                         <div className="flex justify-between items-center"><Label>Rent</Label><Input className="max-w-32" type="number" value={rent} onChange={e => setRent(e.target.value)} /></div>
                         <Separator/>
                         <div className="flex justify-between items-center font-semibold"><Label>Total Less</Label><span>{formatINR(totalDeductions)}</span></div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center font-bold text-lg"><Label>Live Total Box</Label><span>{calculatedTotalBox}</span></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-lg"><Label>Total Bill Value</Label><span>{formatINR(totalAmount)}</span></div>
                        <Separator/>
                        <div className="flex justify-between items-center font-bold"><Label>Net Bill Value</Label><span>{formatINR(netAmount)}</span></div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center"><Label>Cash</Label><Input className="max-w-32" type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)} /></div>
                        <div className="flex justify-between items-center"><Label>Bank / Acc</Label><Input className="max-w-32" type="number" value={bankReceived} onChange={e => setBankReceived(e.target.value)} /></div>
                        <Separator/>
                         <div className="flex justify-between items-center font-semibold"><Label>Total Received</Label><span>{formatINR(totalReceived)}</span></div>
                    </div>

                     <div className="space-y-2 text-right">
                         <div className="flex justify-between items-center">
                            <Label>Previous Balance</Label>
                            <Input
                                className={cn(
                                    "ml-auto max-w-32 text-right font-mono",
                                    isPrevBalModified && "bg-amber-50 dark:bg-amber-950/30 border-amber-500 font-bold"
                                )}
                                value={isPrevBalFocused ? prevBalInput : formatINR(prevBalInput)}
                                onChange={(e) => {
                                    setPrevBalInput(e.target.value);
                                    setIsPrevBalModified(true);
                                }}
                                onFocus={(e) => {
                                    setIsPrevBalFocused(true);
                                    e.target.select();
                                }}
                                onBlur={() => setIsPrevBalFocused(false)}
                            />
                         </div>
                         <Separator/>
                         <div className="flex justify-between items-center py-1">
                             <Label className="text-[20px] font-[700] sm:text-[22px]">Final Balance</Label>
                             <span className="text-[28px] font-[800] sm:text-[32px] tracking-tight">{formatINR(finalBalance)}</span>
                         </div>
                         <Separator/>
                     </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button onClick={onSaveClick} disabled={isSaving}><Save className="mr-2 h-4 w-4"/>{isSaving ? "Saving..." : (editingBillId ? 'Update Bill' : 'Save Bill')}</Button>
                    <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Print Receipt</Button>
                    <Button
                        variant="outline"
                        onClick={handleSharePDF}
                        disabled={!partyId || isShareLoading}
                        className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                    >
                        {isShareLoading
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</>
                            : <><Share2 className="mr-2 h-4 w-4" />Share (PDF)</>}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Party Bill History</CardTitle>
                <CardDescription>Search and manage previously created party bills.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid sm:grid-cols-2 items-end gap-4">
                    <div className="grid gap-2">
                        <Label>Party</Label>
                        <div onKeyDown={handleHistoryPartyKeyDown}>
                            <ReactSelect
                                options={parties.map(p => ({ value: p.id, label: p.name}))}
                                value={parties.map(p => ({ value: p.id, label: p.name})).find(p => p.value === historyPartyId) || null}
                                onChange={(option) => {
                                    setHistoryPartyId(option ? option.value : '');
                                }}
                                isClearable
                                placeholder="Filter by party..."
                                styles={reactSelectStyles}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    className={cn('w-full justify-start text-left font-normal select-none', !historyDate && 'text-muted-foreground')}
                                    onFocus={() => { if (!historyDate) setHistoryDate(new Date()); }}
                                    onKeyDown={(e) => handleDateKeyDown(e, historyDate, setHistoryDate as (d: Date) => void)}
                                    onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}
                                >
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
                <div className="relative min-h-[500px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Party</TableHead>
                                <TableHead className="text-right">Prev Bal</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Final Balance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody ref={historyTableBodyRef}>
                            {filteredHistory.map(bill => {
                                const prev = bill.previousBalance !== undefined
                                    ? bill.previousBalance
                                    : (partyBalances[bill.partyId] || 0) - ((bill.netAmount || 0) - (bill.totalReceived || 0));
                                const final = bill.finalBalance !== undefined
                                    ? bill.finalBalance
                                    : (partyBalances[bill.partyId] || 0);

                                return (
                                <TableRow 
                                    key={bill.id} 
                                    onDoubleClick={() => router.push(`/dashboard/party-bill?partyBillId=${bill.id}`)} 
                                    className="cursor-pointer"
                                    tabIndex={0}
                                    onKeyDown={(e) => handleHistoryRowKeyDown(e, bill.id)}
                                >
                                    <TableCell>{format(bill.date instanceof Timestamp ? bill.date.toDate() : new Date(bill.date), 'dd-MM-yy')}</TableCell>
                                    <TableCell>{bill.partyName}</TableCell>
                                    <TableCell className="text-right font-bold whitespace-nowrap">{formatINR(prev)}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap">{formatINR(bill.netAmount)}</TableCell>
                                    <TableCell className="text-right font-bold whitespace-nowrap">{formatINR(final)}</TableCell>
                                    <TableCell className="text-right flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={(e) => { 
                                            e.stopPropagation(); 
                                            router.push(`/dashboard/party-bill?partyBillId=${bill.id}`); 
                                        }}>
                                            <Pencil className="h-4 w-4 text-primary"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(bill.id);}}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
    <AlertDialog open={showPrintConfirm} onOpenChange={setShowPrintConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Before Printing</AlertDialogTitle>
                <AlertDialogDescription>
                    How would you like to proceed with printing this party bill?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 pt-2">
                <Button onClick={handleSaveAndPrint} disabled={isSaving}>{isSaving ? "Saving..." : "Save & Print"}</Button>
                <Button variant="outline" onClick={handlePrintWithoutSaving}>Print Without Saving</Button>
                <Button variant="ghost" onClick={() => setShowPrintConfirm(false)}>Cancel</Button>
            </div>
        </AlertDialogContent>
      </AlertDialog>


    </>
  );
}

