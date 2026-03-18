
'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Lock,
  PlusCircle,
  Unlock,
  Printer,
  FilePlus,
  Save,
  Trash2,
  MoreVertical,
  Share,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { BillItem, Customer, LiveBillSummary } from '@/lib/data';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import ReactSelect from 'react-select';
import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface BillPrintData {
  billNo: string;
  date: string;
  customer: Customer;
  items: BillItem[];
  itemsTotal: number;
  deliveryCharge: number;
  totalAmount: number;
  previousBalance: number;
  paidAmount: number;
  finalBalance: number;
  stall: string;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();
  const firestore = useFirestore();

  const {
    customers,
    products,
    productPrices,
    customerBalances,
    currentUser,
    findBillForCustomerToday,
    createOrUpdateLiveBill,
    getBill,
    liveBillSummaries,
    users,
    deleteBills,
  } = useData();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [activeBillNo, setActiveBillNo] = useState<string | null>(null);
  const [initialBillTotal, setInitialBillTotal] = useState(0);

  // SESSION STATE: Local items and static balance
  const [localBillItems, setLocalBillItems] = useState<BillItem[]>([]);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [staticPrevBalance, setStaticPrevBalance] = useState(0);

  // Form state for new item entry
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [uom, setUom] = useState('KGS');
  const [paidAmount, setPaidAmount] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  
  // Print confirmation dialog state
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [printPaperType, setPrintPaperType] = useState<'a4' | 'thermal'>('thermal');

  const [walkInConfirmed, setWalkInConfirmed] = useState(false);

  // WhatsApp share state
  const [showWhatsAppShareConfirm, setShowWhatsAppShareConfirm] = useState(false);

  // History states
  const [historyDate, setHistoryDate] = useState<Date | undefined>();
  const [historySelectedCustomer, setHistorySelectedCustomer] = useState<string>('');
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [filteredHistoryBills, setFilteredHistoryBills] = useState<LiveBillSummary[]>([]);

  // Refs
  const customerSelectRef = useRef<any>(null);
  const productSelectRef = useRef<any>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const uomTriggerRef = useRef<HTMLButtonElement>(null);
  const billItemsContainerRef = useRef<HTMLDivElement>(null);
  const historyTableBodyRef = useRef<HTMLTableSectionElement>(null);
  const ignoreUrlBillNoRef = useRef<string | null>(null);
  const lastSessionKeyRef = useRef('');

  // Bill Navigation and History Sorting
  const sortBills = useCallback((bills: LiveBillSummary[]): LiveBillSummary[] => {
    return [...bills]
      .filter(b => b.amount > 0)
      .sort((a, b) => {
        const dateA = a.date ? ((a.date as any).toDate ? (a.date as any).toDate() : new Date(a.date as any)) : new Date(0);
        const dateB = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date as any)) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }, []);

  const sortedBills = useMemo(() => sortBills(liveBillSummaries), [liveBillSummaries, sortBills]);

  const currentBillIndex = useMemo(() => {
    if (!activeBillNo) return -1;
    return sortedBills.findIndex(b => b.billNo === activeBillNo);
  }, [activeBillNo, sortedBills]);

  const handlePrevBill = () => {
    if (currentBillIndex > 0) {
      const prevBill = sortedBills[currentBillIndex - 1];
      router.push(`/dashboard/billing?billNo=${prevBill.billNo}`);
    }
  };

  const handleNextBill = () => {
    if (currentBillIndex < sortedBills.length - 1 && currentBillIndex !== -1) {
      const nextBill = sortedBills[currentBillIndex + 1];
      router.push(`/dashboard/billing?billNo=${nextBill.billNo}`);
    }
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
  
  useEffect(() => {
    customerSelectRef.current?.focus();
  }, []);

  // SESSION INITIALIZATION: Capture items and static balance when customer/bill changes
  useEffect(() => {
    const billNoFromParams = searchParams.get('billNo');
    const sessionKey = `${selectedCustomerId}-${billNoFromParams || 'new'}`;
    
    if (sessionKey === lastSessionKeyRef.current) return;
    if (!selectedCustomerId && !billNoFromParams) {
        lastSessionKeyRef.current = sessionKey;
        return;
    }

    if (billNoFromParams && billNoFromParams === ignoreUrlBillNoRef.current) return;

    const initializeSession = async () => {
        let billToLoad = null;
        if (billNoFromParams) {
            billToLoad = getBill(billNoFromParams);
        } else if (selectedCustomerId) {
            billToLoad = findBillForCustomerToday(selectedCustomerId);
        }

        if (billToLoad) {
            setSelectedCustomerId(billToLoad.customerId);
            setActiveBillNo(billToLoad.billNo);
            setInitialBillTotal(billToLoad.amount);
            setDeliveryCharge(billToLoad.deliveryCharge?.toString() || '');
            setPaidAmount('');

            // Fetch items from Firestore once
            setIsItemsLoading(true);
            try {
                const snap = await getDocs(collection(firestore!, 'bills', billToLoad.billNo, 'billItems'));
                const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as BillItem));
                setLocalBillItems(items);
            } catch (e) { console.error("Failed to load items", e); }
            setIsItemsLoading(false);

            // Calculate Static Previous Balance: Current DB Total minus this bill's saved contribution
            const dbBal = customerBalances[billToLoad.customerId] || 0;
            setStaticPrevBalance(dbBal - billToLoad.amount);

            if (billToLoad.date) {
                setDate(billToLoad.date instanceof Timestamp ? billToLoad.date.toDate() : new Date(billToLoad.date));
            }
        } else if (selectedCustomerId) {
            // New Bill for selected customer
            setActiveBillNo(null);
            setInitialBillTotal(0);
            setDeliveryCharge('');
            setLocalBillItems([]);
            setStaticPrevBalance(customerBalances[selectedCustomerId] || 0);
        }
        
        lastSessionKeyRef.current = sessionKey;
    };

    initializeSession();
  }, [selectedCustomerId, searchParams, customerBalances, getBill, findBillForCustomerToday, firestore]);

  useEffect(() => {
    if (selectedProductId && uom) {
      const price = productPrices[selectedProductId]?.[uom];
      if (price !== undefined && price !== null) {
        setRate(price.toString());
      } else {
        setRate('1');
      }
    } else {
      setRate('');
    }
  }, [selectedProductId, uom, productPrices]);

  useEffect(() => {
    if (billItemsContainerRef.current) {
        const { scrollHeight } = billItemsContainerRef.current;
        billItemsContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
  }, [localBillItems]);

  // History filtering effect
  useEffect(() => {
    let results = liveBillSummaries;
    if (historySelectedCustomer) {
      results = results.filter(bill => bill.customerId === historySelectedCustomer);
    }
    if (historyDate) {
      results = results.filter(bill => {
        if (!bill.date) return false;
        const billDate = (bill.date as Timestamp).toDate ? (bill.date as Timestamp).toDate() : bill.date;
        return isSameDay(billDate, historyDate);
      });
    }
    setFilteredHistoryBills(sortBills(results));
  }, [liveBillSummaries, historySelectedCustomer, historyDate, sortBills]);

  // LOCAL INTERACTIONS: operate on localBillItems without DB writes
  const handleAddItem = useCallback(() => {
    const productInfo = products.find((p) => p.id === selectedProductId);
    if (!productInfo || !qty || !rate) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a product and enter quantity and rate.' });
      return;
    }

    const qtyNum = parseFloat(qty);
    const rateNum = parseFloat(rate);

    const newItem: BillItem = {
      id: Date.now().toString(),
      product: productInfo.name_ta,
      productId: productInfo.id,
      uom: uom,
      qty: qtyNum,
      rate: rateNum,
      amount: qtyNum * rateNum,
      addedBy: currentUser?.id || 'unknown-user',
      stall: '1',
      billId: activeBillNo || undefined
    };

    setLocalBillItems(prev => [...prev, newItem]);
    
    // Clear inputs
    setQty('');
    setRate('');
    if (productSelectRef.current) productSelectRef.current.clearValue();
    setSelectedProductId('');
    productSelectRef.current?.focus();
  }, [selectedProductId, qty, rate, uom, currentUser, products, activeBillNo, toast]);

  const persistItemUpdate = (itemId: string, field: 'rate' | 'qty', value: string) => {
    const parsedValue = parseFloat(value) || 0;
    setLocalBillItems(prev => prev.map(item => {
        if (item.id === itemId) {
            const newQty = field === 'qty' ? parsedValue : item.qty;
            const newRate = field === 'rate' ? parsedValue : item.rate;
            return { ...item, [field]: parsedValue, amount: newQty * newRate };
        }
        return item;
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    const itemToDelete = localBillItems.find(i => i.id === itemId);
    if (!itemToDelete) return;

    showAlertDialog({
      title: 'Delete Item?',
      description: 'Are you sure you want to remove this item from the bill?',
      onConfirm: () => {
        setLocalBillItems(prev => prev.filter(i => i.id !== itemId));
        toast({
          title: 'Item Removed',
          duration: 5000,
          action: (
            <ToastAction altText="Undo" onClick={() => setLocalBillItems(prev => [...prev, itemToDelete])}>Undo</ToastAction>
          )
        });
      },
    });
  };

  const performReset = useCallback(() => {
    ignoreUrlBillNoRef.current = searchParams.get('billNo');
    lastSessionKeyRef.current = '';
    
    setSelectedCustomerId('');
    setCustomerSearchText('');
    setActiveBillNo(null);
    setDate(new Date());
    setSelectedProductId('');
    setQty('');
    setRate('');
    setPaidAmount('');
    setDeliveryCharge('');
    setInitialBillTotal(0);
    setWalkInConfirmed(false);
    setLocalBillItems([]);
    setStaticPrevBalance(0);
    
    if (productSelectRef.current) {
      productSelectRef.current.clearValue();
    }
    if (customerSelectRef.current) {
      customerSelectRef.current.clearValue();
    }
    
    router.replace('/dashboard/billing');
    setTimeout(() => customerSelectRef.current?.focus(), 100);
  }, [router, searchParams]);

  const handleNewBill = useCallback(() => {
    const hasChanges = 
      selectedCustomerId !== '' || 
      (localBillItems && localBillItems.length > 0) || 
      qty !== '' || 
      rate !== '' || 
      paidAmount !== '' || 
      deliveryCharge !== '' ||
      activeBillNo !== null;

    if (hasChanges) {
      showAlertDialog({
        title: 'Unsaved Changes',
        description: 'You have unsaved changes. Are you sure you want to create a new bill?',
        confirmText: 'Yes, Discard and Start New',
        cancelText: 'Cancel',
        onConfirm: performReset,
      });
    } else {
      performReset();
    }
  }, [selectedCustomerId, localBillItems, qty, rate, paidAmount, deliveryCharge, activeBillNo, showAlertDialog, performReset]);

  const handleSaveAndGetData = async (): Promise<BillPrintData | null> => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    
    if (localBillItems.length === 0 && !activeBillNo) {
      toast({ variant: 'destructive', title: 'Cannot Save Bill', description: 'Please add at least one item for a new bill.' });
      return null;
    }
    
    if (!customer && selectedCustomerId && selectedCustomerId !== 'WALK-IN') {
        toast({ variant: 'destructive', title: 'Customer Not Found', description: 'The selected customer ID is invalid.' });
        return null;
    }

    // Purge old items from DB if editing to ensure local state becomes the single source of truth
    if (activeBillNo && firestore) {
        try {
            const itemsSnap = await getDocs(collection(firestore, 'bills', activeBillNo, 'billItems'));
            const purgeBatch = writeBatch(firestore);
            itemsSnap.forEach(d => purgeBatch.delete(d.ref));
            await purgeBatch.commit();
        } catch (e) { console.error("Item purge failed", e); }
    }

    const billSummary = {
      customerName: customer ? `${customer.name_en} (${customer.name_ta})` : 'Walk-in Customer',
      customerId: selectedCustomerId || 'WALK-IN',
      stall: '1',
    };
    
    const { billNo, commitPromise } = createOrUpdateLiveBill(
      billSummary,
      localBillItems,
      parseFloat(paidAmount) || 0,
      parseFloat(deliveryCharge) || 0,
      date || new Date(),
      activeBillNo
    );

    try {
      await commitPromise;
      toast({ title: activeBillNo ? 'Bill Updated' : 'Bill Saved', description: `Bill ${billNo} saved.` });
      if (!activeBillNo) setActiveBillNo(billNo);
      return getBillPrintData();
    } catch (error) {
      console.error('Save failed:', error);
      toast({ variant: 'destructive', title: 'Save failed' });
      return null;
    }
  };

  const getBillPrintData = useCallback((): BillPrintData | null => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const deliveryChargeNum = parseFloat(deliveryCharge) || 0;
    const paidAmountNum = parseFloat(paidAmount) || 0;
    const finalItemsTotal = localBillItems.reduce((sum, item) => sum + item.amount, 0);
    const finalTotalAmount = finalItemsTotal + deliveryChargeNum;
    const finalFinalBalance = staticPrevBalance + finalTotalAmount - paidAmountNum;

    const printCustomer = customer || { id: 'WALK-IN', name_en: 'Walk-in Customer', name_ta: 'வாடிக்கையாளர்', phone: '-' };

    return {
        billNo: activeBillNo || 'New Bill',
        date: date?.toISOString() || new Date().toISOString(),
        customer: printCustomer as Customer,
        items: localBillItems,
        itemsTotal: finalItemsTotal,
        deliveryCharge: deliveryChargeNum,
        totalAmount: finalTotalAmount,
        previousBalance: staticPrevBalance,
        paidAmount: paidAmountNum,
        finalBalance: finalFinalBalance,
        stall: '1'
    };
  }, [customers, selectedCustomerId, localBillItems, activeBillNo, deliveryCharge, paidAmount, staticPrevBalance, date]);

  const handleSaveBill = async () => {
    if (!selectedCustomerId) {
        toast({ variant: 'destructive', title: 'Customer Required', description: 'Please select a customer or confirm as walk-in to save.' });
        return;
    }
    const savedData = await handleSaveAndGetData();
    if (savedData) performReset();
  };

  const handlePrintBill = async (paper: 'thermal' | 'a4') => {
    if (localBillItems.length === 0 && !activeBillNo) {
        toast({ variant: 'destructive', title: 'Cannot Print', description: 'Please add at least one item.' });
        return;
    }
    setPrintPaperType(paper);
    setShowPrintConfirm(true);
  };

  const handleShareWhatsApp = async () => {
    if (localBillItems.length === 0 && !activeBillNo) {
        toast({ variant: 'destructive', title: 'Cannot Share', description: 'Please add at least one item.' });
        return;
    }
    setShowWhatsAppShareConfirm(true);
  };

  const handleSelectBill = (billNo: string, checked: boolean) => {
    setSelectedBills((prev) => {
      const newSelection = new Set(prev);
      if (checked) {
        newSelection.add(billNo);
      } else {
        newSelection.delete(billNo);
      }
      return newSelection;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedBills.size === 0) return;
    showAlertDialog({
      title: 'Are you sure?',
      description: `Permanently delete ${selectedBills.size} bill(s)?`,
      onConfirm: async () => {
        const billNosToDelete = Array.from(selectedBills);
        await deleteBills(billNosToDelete);
        setSelectedBills(new Set());
        toast({ title: "Bills removed" });
      },
    });
  };

  const handleEditBill = (billNo: string) => {
    router.push(`/dashboard/billing?billNo=${billNo}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearHistorySearch = () => {
    setHistoryDate(undefined);
    setHistorySelectedCustomer('');
  };

  // Keyboard navigation
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); uomTriggerRef.current?.focus(); }
  };
  
  const handleRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey && !selectedCustomerId && !customerSearchText && !walkInConfirmed) {
      e.preventDefault(); 
      showAlertDialog({
        title: 'Confirm Walk-In Customer',
        description: 'Create this bill as a Walk-In customer?',
        confirmText: 'Yes, Walk-In',
        cancelText: 'No, Select',
        onConfirm: () => { setWalkInConfirmed(true); setSelectedCustomerId('WALK-IN'); setTimeout(() => productSelectRef.current?.focus(), 50); },
        onCancel: () => setTimeout(() => customerSelectRef.current?.focus(), 50),
      });
    }
  };

  const itemsTotal = useMemo(() => localBillItems.reduce((sum, item) => sum + item.amount, 0), [localBillItems]);
  const totalAmount = itemsTotal + (parseFloat(deliveryCharge) || 0);
  const finalBalance = staticPrevBalance + totalAmount - (parseFloat(paidAmount) || 0);

  const customerOptions = useMemo(() => {
    const opts = customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }));
    opts.unshift({ value: 'WALK-IN', label: 'Walk-in Customer' });
    return opts;
  }, [customers]);

  return (
    <div className="flex flex-col gap-8 pb-24 md:pb-8">
      <div className="grid auto-rows-max items-start gap-4 lg:grid-cols-2 lg:gap-8">
        <div className="grid auto-rows-max gap-4">
          <Card>
            <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between pb-2">
              <div>
                <CardTitle className="font-headline">
                  {activeBillNo ? `Editing Bill ${activeBillNo}` : 'Create Bill'}
                </CardTitle>
                <CardDescription>Manage active transaction.</CardDescription>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal sm:w-[240px]', !date && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'dd-MM-yyyy') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" onClick={handleNewBill}>
                  <FilePlus className="mr-2 h-4 w-4" /> New Bill
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor="customer">Customer</Label>
                <ReactSelect
                  ref={customerSelectRef}
                  instanceId="customer-select"
                  placeholder="Select customer or leave blank for walk-in..."
                  isClearable
                  tabSelectsValue={true}
                  options={customerOptions}
                  value={customerOptions.find(o => o.value === selectedCustomerId) || null}
                  onChange={(option) => {
                    const id = option ? option.value : '';
                    setSelectedCustomerId(id);
                    if (!id) setWalkInConfirmed(false);
                  }}
                  onKeyDown={handleCustomerKeyDown}
                  styles={reactSelectStyles}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-headline text-lg">Add Item</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-nowrap items-end gap-3">
                <div className="grid flex-[4] min-w-0 gap-1.5">
                  <Label htmlFor="product" className="text-xs">Product</Label>
                  <ReactSelect
                    instanceId="product-select"
                    placeholder="Select product..."
                    isClearable
                    tabSelectsValue={true}
                    openMenuOnFocus={true}
                    options={products.map((p) => ({ value: p.id, label: `${p.name_en} (${p.name_ta})` }))}
                    value={products.find(p => p.id === selectedProductId) ? { value: selectedProductId, label: products.find(p => p.id === selectedProductId)?.name_en + ' (' + products.find(p => p.id === selectedProductId)?.name_ta + ')' } : null}
                    onChange={(option) => {
                      if (!option) { setSelectedProductId(''); setRate(''); return; }
                      setSelectedProductId(option.value);
                      const product = products.find(p => p.id === option.value);
                      if (product && product.uom_allowed.length > 0) setUom(product.uom_allowed.includes('KGS') ? 'KGS' : product.uom_allowed[0]);
                      setTimeout(() => qtyInputRef.current?.focus(), 0);
                    }}
                    styles={reactSelectStyles}
                    ref={productSelectRef}
                  />
                </div>
                <div className="grid w-24 shrink-0 gap-1.5">
                  <Label htmlFor="qty" className="text-xs">Qty</Label>
                  <Input id="qty" type="number" placeholder="0.00" value={qty} onChange={(e) => setQty(e.target.value)} ref={qtyInputRef} onKeyDown={handleQtyKeyDown} />
                </div>
                <div className="grid w-24 shrink-0 gap-1.5">
                  <Label htmlFor="uom" className="text-xs">UOM</Label>
                  <Select value={uom} onValueChange={(val) => { setUom(val); setTimeout(() => rateInputRef.current?.focus(), 50); }} disabled={!selectedProductId}>
                    <SelectTrigger id="uom" ref={uomTriggerRef}><SelectValue placeholder="Select" /></SelectValue></SelectTrigger>
                    <SelectContent>{products.find(p => p.id === selectedProductId)?.uom_allowed.map((uom) => (<SelectItem key={uom} value={uom}>{uom}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="grid w-24 shrink-0 gap-1.5">
                  <Label htmlFor="rate" className="text-xs">Rate</Label>
                  <Input id="rate" type="number" placeholder="0.00" value={rate} onChange={(e) => setRate(e.target.value)} ref={rateInputRef} onKeyDown={handleRateKeyDown} />
                </div>
                <div className="shrink-0"><Button onClick={handleAddItem} className="h-10 w-10 p-0" size="icon"><PlusCircle className="h-5 w-5" /></Button></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-headline">Current Bill</CardTitle>
              <CardDescription>{selectedCustomerId === 'WALK-IN' ? 'Items added for Walk-in Customer.' : selectedCustomerId ? `Items added for ${customers.find(c => c.id === selectedCustomerId)?.name_en}.` : 'No customer selected.'}</CardDescription>
            </CardHeader>
            <CardContent ref={billItemsContainerRef} className="max-h-[calc(100vh-26rem)] min-h-[22rem] overflow-auto p-0 border-t">
              <Table className="w-full table-fixed border-collapse">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="w-[45px] px-1 text-center font-bold text-sm uppercase">S/N</TableHead>
                    <TableHead className="px-1 text-left font-bold text-sm uppercase">Product</TableHead>
                    <TableHead className="w-[60px] px-1 text-center font-bold text-sm uppercase">UOM</TableHead>
                    <TableHead className="w-[100px] px-1 text-center font-bold text-sm uppercase">Qty</TableHead>
                    <TableHead className="w-[120px] px-1 text-right font-bold text-sm uppercase">Rate</TableHead>
                    <TableHead className="w-[130px] px-1 text-right font-bold text-sm uppercase">Amount</TableHead>
                    <TableHead className="w-[45px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isItemsLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow> : localBillItems.length > 0 ? (
                    localBillItems.map((item, index) => (
                      <TableRow key={item.id} className="h-14 hover:bg-muted/50 border-b">
                        <TableCell className="px-1 text-center text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="px-1 truncate">{item.product}</TableCell>
                        <TableCell className="px-1 text-center">{item.uom}</TableCell>
                        <TableCell className="px-1"><Input type="number" defaultValue={item.qty} onBlur={(e) => persistItemUpdate(item.id, 'qty', e.target.value)} onFocus={(e) => e.target.select()} className="mx-auto h-10 w-[90px] text-center font-mono text-base px-1" /></TableCell>
                        <TableCell className="px-1 text-right"><Input type="number" defaultValue={item.rate} onBlur={(e) => persistItemUpdate(item.id, 'rate', e.target.value)} onFocus={(e) => e.target.select()} className="ml-auto h-10 w-[110px] text-right font-mono text-base px-1" /></TableCell>
                        <TableCell className="px-1 text-right font-mono font-semibold">{item.amount.toFixed(2)}</TableCell>
                        <TableCell className="px-1 text-right"><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))
                  ) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No items.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
            {(localBillItems.length > 0) && (
              <CardFooter className="flex flex-col items-stretch gap-2 border-t pt-4 sm:items-end">
                <div className="grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-1 self-end text-right text-lg">
                  <span className="font-semibold">Items Total:</span><span className="font-mono">₹{itemsTotal.toFixed(2)}</span>
                  <span className="font-semibold">Delivery:</span><Input className="ml-auto max-w-32 text-right font-mono" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} />
                  <span className="font-semibold">Bill Total:</span><span className="font-mono font-bold">₹{totalAmount.toFixed(2)}</span>
                  <span className="font-semibold">Prev Bal:</span><span className="font-mono">₹{staticPrevBalance.toFixed(2)}</span>
                  <span className="font-semibold">Paid:</span><Input className="ml-auto max-w-32 text-right font-mono" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                  <span className="font-semibold">Balance:</span><span className="font-mono font-bold">₹{finalBalance.toFixed(2)}</span>
                </div>
                <div className="hidden flex-wrap justify-end gap-2 md:flex">
                  <Button size="icon" variant="outline" onClick={handlePrevBill} disabled={currentBillIndex <= 0}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="lg" variant="outline" onClick={handleSaveBill} disabled={!selectedCustomerId}><Save className="mr-2 h-4 w-4" /> Save Bill</Button>
                  <Button onClick={() => handlePrintBill('thermal')}>Print Receipt</Button>
                  <Button variant="outline" onClick={() => handlePrintBill('a4')}>Print A4</Button>
                  <Button size="icon" variant="outline" onClick={handleNextBill} disabled={currentBillIndex === -1 || currentBillIndex >= sortedBills.length - 1}><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={handleShareWhatsApp}><Share className="mr-2 h-4 w-4" /> Share</Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      <Separator />

      <Card>
        <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline text-2xl">Bill History</CardTitle>
            <CardDescription>Search and view past bills. Double-click or Enter to load for editing.</CardDescription>
          </div>
          {selectedBills.size > 0 && (currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && (
            <Button variant="destructive" onClick={handleDeleteSelected}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedBills.size})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="grid flex-1 gap-2">
              <Label>Customer</Label>
              <ReactSelect
                instanceId="history-customer-select"
                options={customerOptions}
                value={customerOptions.find(o => o.value === historySelectedCustomer) || null}
                onChange={(option) => setHistorySelectedCustomer(option ? option.value : '')}
                isClearable
                placeholder="Filter by customer..."
                styles={reactSelectStyles}
              />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={'outline'} className={cn('w-full sm:w-[240px] justify-start text-left font-normal', !historyDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {historyDate ? format(historyDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} /></PopoverContent>
              </Popover>
            </div>
            <Button variant="ghost" onClick={handleClearHistorySearch}><X className="mr-2 h-4 w-4" /> Clear</Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && <TableHead className="w-[40px]"></TableHead>}
                  <TableHead>Bill No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody ref={historyTableBodyRef}>
                {filteredHistoryBills.length > 0 ? (
                  filteredHistoryBills.map((bill) => {
                    const creator = users.find((user) => user.id === bill.createdBy);
                    const bDate = bill.date ? ((bill.date as any).toDate ? (bill.date as any).toDate() : new Date(bill.date)) : null;
                    return (
                      <TableRow key={bill.billNo} className="cursor-pointer hover:bg-muted/50" onDoubleClick={() => handleEditBill(bill.billNo)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleEditBill(bill.billNo)}>
                        {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && (
                          <TableCell className="w-[40px]"><Checkbox checked={selectedBills.has(bill.billNo)} onCheckedChange={(checked) => handleSelectBill(bill.billNo, !!checked)} /></TableCell>
                        )}
                        <TableCell className="font-medium">{bill.billNo}</TableCell>
                        <TableCell>{bDate ? format(bDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell>{bill.customerName}</TableCell>
                        <TableCell className="text-right font-mono">₹{bill.amount.toFixed(2)}</TableCell>
                        <TableCell>{creator?.username || bill.createdBy}</TableCell>
                      </TableRow>
                    );
                  })
                ) : <TableRow><TableCell colSpan={6} className="h-24 text-center">No results found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Mobile Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-10 h-20 border-t bg-background/95 px-4 py-2 md:hidden">
        <div className="flex h-full w-full items-center justify-between gap-4">
          <div className="text-left">
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="font-mono text-lg font-bold">₹{finalBalance.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="lg" className="flex-1" onClick={handleAddItem} disabled={!qty || !rate}><PlusCircle className="h-5 w-5" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="lg" variant="outline" className="px-3"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="mb-2">
                <DropdownMenuItem onClick={handleSaveBill} disabled={!selectedCustomerId}><Save className="mr-2 h-4 w-4" /><span>Save & New</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrintBill('thermal')}><Printer className="mr-2 h-4 w-4" /><span>Print Receipt</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrintBill('a4')}><Printer className="mr-2 h-4 w-4" /><span>Print A4</span></DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareWhatsApp}><Share className="mr-2 h-4 w-4" /><span>Share WhatsApp</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AlertDialog open={showPrintConfirm} onOpenChange={setShowPrintConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirm Printing</AlertDialogTitle><AlertDialogDescription>Do you want to save this bill before printing?</AlertDialogDescription></AlertDialogHeader>
            <div className="flex flex-col gap-2 pt-2">
                <Button onClick={async () => { const d = await handleSaveAndGetData(); if (d) { window.open(`/print/bill?data=${encodeURIComponent(JSON.stringify(d))}&paper=${printPaperType}`, '_blank'); performReset(); } setShowPrintConfirm(false); }} disabled={!selectedCustomerId}>Save & Print</Button>
                <Button variant="outline" onClick={() => { const d = getBillPrintData(); if (d) window.open(`/print/bill?data=${encodeURIComponent(JSON.stringify(d))}&paper=${printPaperType}`, '_blank'); setShowPrintConfirm(false); }}>Print Without Saving</Button>
                <Button variant="ghost" onClick={() => setShowPrintConfirm(false)}>Cancel</Button>
            </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWhatsAppShareConfirm} onOpenChange={setShowWhatsAppShareConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Share on WhatsApp</AlertDialogTitle><AlertDialogDescription>Open WhatsApp to share this bill summary?</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowWhatsAppShareConfirm(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  const customer = customers.find((c) => c.id === selectedCustomerId);
                  const phone = customer?.phone || '';
                  const customerName = customer ? `${customer.name_en} (${customer.name_ta})` : 'Walk-in Customer';
                  let message = `*M.C & SONS FISH COMPANY*\n*BILL SUMMARY*\nBill No: ${activeBillNo || 'New'}\nDate: ${format(date || new Date(), 'dd-MM-yyyy')}\nCustomer: ${customerName}\n-------------------------\n`;
                  localBillItems.forEach((item, index) => { message += `${index + 1}. ${item.product} (${item.qty} ${item.uom}) = ₹${item.amount.toFixed(2)}\n`; });
                  message += `-------------------------\n*Final Bal: ₹${finalBalance.toFixed(2)}*\nThank you!`;
                  window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                  setShowWhatsAppShareConfirm(false);
                }}>Open WhatsApp</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
