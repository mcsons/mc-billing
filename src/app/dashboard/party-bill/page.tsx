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
  Check,
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
    container: (baseStyles: any) => ({
      ...baseStyles,
      width: '100%',
    }),
    control: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      minHeight: '44px',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    menu: (baseStyles: any) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--card))',
      zIndex: 50,
    }),
    menuList: (baseStyles: any) => ({
      ...baseStyles,
      maxHeight: '40vh',
      WebkitOverflowScrolling: 'touch',
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
    // Inline row edit state (double-click to edit an existing line item)
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

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
    const mobileProductSelectRef = useRef<any>(null);
    // Entry-row refs used to walk focus Product → Box → Kgs → Rate → Add
    const productSelectRef = useRef<any>(null);
    const boxInputRef = useRef<HTMLInputElement>(null);
    const kgsInputRef = useRef<HTMLInputElement>(null);
    const mobileBoxRef = useRef<HTMLInputElement>(null);
    const mobileKgsRef = useRef<HTMLInputElement>(null);
    const mobileRateRef = useRef<HTMLInputElement>(null);

    // Focus the Product dropdown for whichever entry form is visible.
    // The hidden one is display:none, so focus() there is a no-op.
    const focusProductEntry = useCallback(() => {
        productSelectRef.current?.focus();
        mobileProductSelectRef.current?.focus();
    }, []);

    // Enter behaves like Tab: move to the next control in the entry form.
    const handleEntryKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        nextRef: React.RefObject<HTMLInputElement | null>
    ) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
            nextRef.current?.select?.();
        }
    };
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
        // Exit inline row edit mode and clear the entry controls.
        setEditingItemId(null);
        setSelectedProductId('');
        setRate('');
        setBox('');
        setKgs('');
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

    // Warn on browser tab close / reload with unsaved changes
    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasUnsavedChanges]);

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
                setEditingItemId(null);
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

    // Clear only the item-entry controls and leave edit mode.
    const clearItemEntry = useCallback(() => {
        setEditingItemId(null);
        setSelectedProductId('');
        setRate('');
        setBox('');
        setKgs('');
    }, []);

    // Double-click a line item to load it into the entry controls for editing.
    const handleStartEditItem = useCallback((item: PartyBillItem) => {
        setEditingItemId(item.id);
        setSelectedProductId(item.productId);
        setBox((item.box ?? 0).toString());
        setKgs((item.kgs ?? 0).toString());
        setRate((item.rate ?? 0).toString());
    }, []);

    // Esc exits edit mode without touching the row.
    useEffect(() => {
        if (!editingItemId) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') clearItemEntry();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [editingItemId, clearItemEntry]);

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

        // Edit mode: update the selected row in place instead of appending.
        if (editingItemId) {
            setItems(prev => prev.map(item =>
                item.id === editingItemId
                    ? {
                        ...item,
                        productId: product.id,
                        productName: product.name_en,
                        rate: rateNum,
                        box: boxNum,
                        kgs: kgsNum,
                        amount: amount,
                    }
                    : item
            ));
            clearItemEntry();
            focusProductEntry();
            return;
        }

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
        // Return focus to the Product dropdown so the next item can be typed
        // straight away, on both desktop and mobile.
        focusProductEntry();
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
            if (editingItemId === itemId) clearItemEntry();
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
    <div className="grid w-full max-w-full grid-cols-1 auto-rows-max gap-4 overflow-x-hidden md:gap-6 lg:gap-8">
        <Card>
            <CardHeader>
                <div className="lg:relative">
                    <div className="text-center">
                        <p className="font-bold text-base sm:text-lg">M.C & SONS FISH COMPANY</p>
                        <p className="text-xs sm:text-sm">Cell : 98432 23078, 99444 44497</p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:items-end lg:mt-0 lg:absolute lg:top-0 lg:right-0 lg:flex-row lg:items-center">
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                variant={'outline'}
                                className={cn('w-full min-h-[44px] justify-start text-left font-normal select-none sm:w-[220px] lg:w-[180px]',!date && 'text-muted-foreground')}
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
                        <Button variant="outline" onClick={handleNewBill} className="w-full min-h-[44px] sm:w-[220px] lg:w-auto">
                            <FilePlus className="mr-2 h-4 w-4" />New Bill
                        </Button>
                    </div>
                </div>
                <Separator className="my-2"/>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end lg:flex lg:justify-between lg:items-center lg:gap-4">
                    <div className="w-full min-w-0 lg:w-2/3">
                        <Label className="mb-2 block">To M/S :</Label>
                         <ReactSelect
                            ref={partySelectRef}
                            instanceId="party-select"
                            options={parties.map(p => ({ value: p.id, label: p.name }))}
                            value={parties.map(p => ({ value: p.id, label: p.name })).find(p => p.value === partyId) || null}
                            onChange={(option) => setPartyId(option ? option.value : '')}
                            placeholder="Select Party..."
                            isClearable
                            styles={reactSelectStyles}
                            menuPortalTarget={isMounted ? document.body : null}
                            menuPosition='fixed'
                        />
                    </div>
                     <div className="w-full min-w-0 lg:w-auto lg:flex lg:items-center lg:gap-2">
                        <Label className="mb-2 block lg:mb-0 lg:whitespace-nowrap">Total Box :</Label>
                        <Input
                            type="number"
                            value={totalBox}
                            onChange={e => setTotalBox(e.target.value)}
                            className="h-11 w-full lg:h-10 lg:w-24"
                            placeholder={calculatedTotalBox.toString()}
                        />
                    </div>
                    <div className="w-full min-w-0 lg:w-auto lg:flex lg:items-center lg:gap-2">
                        <Label className="mb-2 block lg:mb-0 lg:whitespace-nowrap">Total Weight :</Label>
                        <Input
                            type="number"
                            value={totalKgs}
                            onChange={e => setTotalKgs(e.target.value)}
                            className="h-11 w-full lg:h-10 lg:w-24"
                            placeholder={calculatedTotalKgs.toString()}
                        />
                    </div>
                </div>
                <Separator className="my-2"/>
            </CardHeader>
            <CardContent>
                {/* Mobile Items List (cards — no horizontal scrolling) */}
                <div className="flex flex-col gap-3 md:hidden">
                    {items.length === 0 && (
                        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                            No items added yet.
                        </p>
                    )}
                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            onDoubleClick={() => handleStartEditItem(item)}
                            className={cn(
                                'rounded-lg border bg-card p-3 shadow-sm',
                                editingItemId === item.id && 'border-primary bg-primary/10 ring-1 ring-primary'
                            )}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-2">
                                    <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                        {index + 1}
                                    </span>
                                    <p className="min-w-0 break-words font-semibold leading-snug">{item.productName}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() => handleRemoveItem(item.id)}
                                    aria-label="Remove item"
                                >
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                                <div className="grid gap-1">
                                    <Label className="text-xs text-muted-foreground">Box</Label>
                                    <Input
                                        type="number"
                                        value={item.box || ''}
                                        onChange={(e) => handleItemUpdate(item.id, 'box', e.target.value)}
                                        className="h-11 w-full text-center font-mono text-base"
                                        placeholder="Box"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs text-muted-foreground">Kgs / box</Label>
                                    <Input
                                        type="number"
                                        value={item.kgs || ''}
                                        onChange={(e) => handleItemUpdate(item.id, 'kgs', e.target.value)}
                                        className="h-11 w-full text-center font-mono text-base"
                                        placeholder="Kgs"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs text-muted-foreground">Rate</Label>
                                    <Input
                                        type="number"
                                        value={item.rate}
                                        onChange={(e) => handleItemUpdate(item.id, 'rate', e.target.value)}
                                        className="h-11 w-full text-center font-mono text-base"
                                    />
                                </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                                <span className="text-xs text-muted-foreground">Amount</span>
                                <span className="font-mono text-base font-bold">{item.amount.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Items Table (tablet & desktop) */}
                <div className="hidden w-full overflow-x-auto md:block">
                <Table className="min-w-[640px]">
                    <TableHeader className="sticky top-0 bg-card z-10">
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
                            <TableRow
                                key={item.id}
                                onDoubleClick={() => handleStartEditItem(item)}
                                className={cn(
                                    'cursor-pointer',
                                    editingItemId === item.id && 'bg-primary/10 ring-1 ring-inset ring-primary'
                                )}
                            >
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
                         <TableRow className="hidden md:table-row">
                            <TableCell>
                                <ReactSelect
                                    ref={productSelectRef}
                                    instanceId="product-select"
                                    options={products.map(p => ({ value: p.id, label: p.name_en }))}
                                    value={products.map(p => ({ value: p.id, label: p.name_en })).find(p => p.value === selectedProductId) || null}
                                    onChange={(option) => {
                                        setSelectedProductId(option ? option.value : '');
                                        if (option) setTimeout(() => boxInputRef.current?.focus(), 0);
                                    }}
                                    placeholder="Select Product..."
                                    styles={reactSelectStyles}
                                    menuPortalTarget={isMounted ? document.body : null}
                                    menuPosition='fixed'
                                />
                            </TableCell>
                            <TableCell>
                                <Input
                                    ref={boxInputRef}
                                    placeholder="Box"
                                    type="number"
                                    value={box}
                                    onChange={e => setBox(e.target.value)}
                                    onKeyDown={e => handleEntryKeyDown(e, kgsInputRef)}
                                    className="w-full text-center text-base font-mono"
                                />
                            </TableCell>
                            <TableCell>
                                <Input
                                    ref={kgsInputRef}
                                    placeholder="Kgs"
                                    type="number"
                                    value={kgs}
                                    onChange={e => setKgs(e.target.value)}
                                    onKeyDown={e => handleEntryKeyDown(e, rateInputRef)}
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
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                                    className="w-full text-center text-base font-mono"
                                />
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="icon"
                                        onClick={handleAddItem}
                                        title={editingItemId ? 'Update Item' : 'Add Item'}
                                        aria-label={editingItemId ? 'Update Item' : 'Add Item'}
                                    >
                                        {editingItemId ? <Check className="h-4 w-4"/> : <PlusCircle className="h-4 w-4"/>}
                                    </Button>
                                    {editingItemId && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={clearItemEntry}
                                            title="Cancel Edit (Esc)"
                                            aria-label="Cancel Edit"
                                        >
                                            <X className="h-4 w-4"/>
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                </div>

                <Separator className="my-4 md:hidden"/>
                {/* Mobile Item Entry (stacked) */}
                <div className={cn(
                    "flex flex-col gap-2 md:hidden",
                    editingItemId && "rounded-lg border border-primary bg-primary/5 p-3"
                )}>
                    {editingItemId && (
                        <p className="text-sm font-semibold text-primary">Editing item — press Cancel to discard</p>
                    )}
                    <div className="grid gap-2">
                        <Label>Product</Label>
                        <ReactSelect
                            ref={mobileProductSelectRef}
                            instanceId="product-select-mobile"
                            options={products.map(p => ({ value: p.id, label: p.name_en }))}
                            value={products.map(p => ({ value: p.id, label: p.name_en })).find(p => p.value === selectedProductId) || null}
                            onChange={(option) => {
                                setSelectedProductId(option ? option.value : '');
                                if (option) setTimeout(() => mobileBoxRef.current?.focus(), 0);
                            }}
                            placeholder="Select Product..."
                            styles={reactSelectStyles}
                            menuPortalTarget={isMounted ? document.body : null}
                            menuPosition='fixed'
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Box</Label>
                        <Input
                            ref={mobileBoxRef}
                            placeholder="Box"
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="next"
                            value={box}
                            onChange={e => setBox(e.target.value)}
                            onKeyDown={e => handleEntryKeyDown(e, mobileKgsRef)}
                            className="h-11 w-full text-center text-base font-mono"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Kgs (per box)</Label>
                        <Input
                            ref={mobileKgsRef}
                            placeholder="Kgs"
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="next"
                            value={kgs}
                            onChange={e => setKgs(e.target.value)}
                            onKeyDown={e => handleEntryKeyDown(e, mobileRateRef)}
                            className="h-11 w-full text-center text-base font-mono"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Rate</Label>
                        <Input
                            ref={mobileRateRef}
                            placeholder="Rate"
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="done"
                            value={rate}
                            onChange={e => setRate(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                            className="h-11 w-full text-center text-base font-mono"
                        />
                    </div>
                    <Button onClick={handleAddItem} className="w-full min-h-[44px]">
                        {editingItemId
                            ? <><Check className="mr-2 h-4 w-4"/>Update Item</>
                            : <><PlusCircle className="mr-2 h-4 w-4"/>Add Item</>}
                    </Button>
                    {editingItemId && (
                        <Button variant="outline" onClick={clearItemEntry} className="w-full min-h-[44px]">
                            <X className="mr-2 h-4 w-4"/>Cancel Edit
                        </Button>
                    )}
                </div>
                <Separator className="my-4"/>
                {/* Totals Section */}
                <div className="grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-6 md:gap-y-2 lg:gap-x-12">
                    <div className="space-y-2 order-1 md:order-none">
                         <div className="flex justify-between items-center gap-2">
                            <Label>Commission (%)</Label>
                            <Input className="h-11 w-32 max-w-32 md:h-10" type="number" value={commission} onChange={e => setCommission(e.target.value)} />
                        </div>
                         <div className="flex justify-between items-center gap-2"><Label>Expenses</Label><Input className="h-11 w-32 max-w-32 md:h-10" type="number" value={expenses} onChange={e => setExpenses(e.target.value)} /></div>
                         <div className="flex justify-between items-center gap-2"><Label>Rent</Label><Input className="h-11 w-32 max-w-32 md:h-10" type="number" value={rent} onChange={e => setRent(e.target.value)} /></div>
                         <Separator/>
                         <div className="flex justify-between items-center gap-2 font-semibold"><Label>Total Less</Label><span>{formatINR(totalDeductions)}</span></div>
                    </div>
                    <div className="space-y-2 order-3 md:order-none">
                        <div className="flex justify-between items-center gap-2 font-bold text-base sm:text-lg"><Label>Live Total Box</Label><span>{calculatedTotalBox}</span></div>
                        <Separator />
                        <div className="flex justify-between items-center gap-2 font-bold text-base sm:text-lg"><Label>Total Bill Value</Label><span>{formatINR(totalAmount)}</span></div>
                        <Separator/>
                        <div className="flex justify-between items-center gap-2 font-bold"><Label>Net Bill Value</Label><span>{formatINR(netAmount)}</span></div>
                    </div>

                    <div className="space-y-2 order-2 md:order-none">
                        <div className="flex justify-between items-center gap-2"><Label>Cash</Label><Input className="h-11 w-32 max-w-32 md:h-10" type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)} /></div>
                        <div className="flex justify-between items-center gap-2"><Label>Bank / Acc</Label><Input className="h-11 w-32 max-w-32 md:h-10" type="number" value={bankReceived} onChange={e => setBankReceived(e.target.value)} /></div>
                        <Separator/>
                         <div className="flex justify-between items-center gap-2 font-semibold"><Label>Total Received</Label><span>{formatINR(totalReceived)}</span></div>
                    </div>

                     <div className="space-y-2 text-right order-4 md:order-none">
                         <div className="flex justify-between items-center gap-2">
                            <Label>Previous Balance</Label>
                            <Input
                                className={cn(
                                    "ml-auto h-11 w-32 max-w-32 text-right font-mono md:h-10",
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
                         <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 py-1">
                             <Label className="text-[20px] font-[700] sm:text-[22px]">Final Balance</Label>
                             <span className="min-w-0 break-all text-right text-[26px] font-[800] leading-tight tracking-tight sm:text-[32px]">{formatINR(finalBalance)}</span>
                         </div>
                         <Separator/>
                     </div>
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button onClick={onSaveClick} disabled={isSaving} className="w-full min-h-[44px] sm:w-auto"><Save className="mr-2 h-4 w-4"/>{isSaving ? "Saving..." : (editingBillId ? 'Update Bill' : 'Save Bill')}</Button>
                    <Button
                        variant="outline"
                        onClick={handleSharePDF}
                        disabled={!partyId || isShareLoading}
                        className="w-full min-h-[44px] border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950 sm:w-auto sm:order-3"
                    >
                        {isShareLoading
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</>
                            : <><Share2 className="mr-2 h-4 w-4" />Share (PDF)</>}
                    </Button>
                    <Button onClick={handlePrint} className="w-full min-h-[44px] sm:w-auto sm:order-2"><Printer className="mr-2 h-4 w-4"/>Print Receipt</Button>
                    <Button variant="outline" onClick={handleNewBill} className="w-full min-h-[44px] sm:hidden">
                        <FilePlus className="mr-2 h-4 w-4"/>New Bill
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
                                menuPortalTarget={isMounted ? document.body : null}
                                menuPosition='fixed'
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    className={cn('w-full min-h-[44px] justify-start text-left font-normal select-none', !historyDate && 'text-muted-foreground')}
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
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={handleSearchHistory} className="w-full min-h-[44px] sm:w-auto"><Search className="mr-2 h-4 w-4" /> Search</Button>
                    <Button variant="ghost" onClick={clearSearchHistory} className="w-full min-h-[44px] sm:w-auto"><X className="mr-2 h-4 w-4" /> Clear</Button>
                </div>

                {/* Mobile History Cards */}
                <div className="flex flex-col gap-3 md:hidden">
                    {filteredHistory.map(bill => {
                        const prev = bill.previousBalance !== undefined
                            ? bill.previousBalance
                            : (partyBalances[bill.partyId] || 0) - ((bill.netAmount || 0) - (bill.totalReceived || 0));
                        const final = bill.finalBalance !== undefined
                            ? bill.finalBalance
                            : (partyBalances[bill.partyId] || 0);

                        return (
                            <div
                                key={bill.id}
                                onDoubleClick={() => router.push(`/dashboard/party-bill?partyBillId=${bill.id}`)}
                                tabIndex={0}
                                onKeyDown={(e) => handleHistoryRowKeyDown(e as any, bill.id)}
                                className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold">{bill.partyName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(bill.date instanceof Timestamp ? bill.date.toDate() : new Date(bill.date), 'dd-MM-yyyy')}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/dashboard/party-bill?partyBillId=${bill.id}`);
                                        }}>
                                            <Pencil className="h-4 w-4 text-primary"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={(e) => { e.stopPropagation(); handleDelete(bill.id); }}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </div>
                                </div>
                                <Separator className="my-3"/>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Prev Balance</span>
                                        <span className="font-mono font-bold">{formatINR(prev)}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Bill Amount</span>
                                        <span className="font-mono">{formatINR(bill.netAmount)}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Final Balance</span>
                                        <span className="font-mono font-bold">{formatINR(final)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="relative hidden min-h-[500px] overflow-x-auto overflow-y-auto md:block">
                    <Table className="min-w-[720px]">
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

