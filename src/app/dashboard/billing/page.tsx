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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { format, isSameDay, startOfWeek, endOfWeek  } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { useNavigationGuard } from '@/context/NavigationGuardContext';
import { useLoading } from '@/context/LoadingContext';
import { useBillingGuard } from '@/context/BillingGuardContext';
import { FishLoader } from '@/components/ui/fish-loader';
import ReactSelect from 'react-select';
import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';


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

// INR Currency Formatter Helper
const formatINR = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();
  const firestore = useFirestore();
  const { isDirty, setIsDirty } = useNavigationGuard();
  const { setLoading } = useLoading();
  const billingGuard = useBillingGuard();

  const {
    customers,
    products,
    productPrices,
    customerBalances,
    currentUser,
    findBillForCustomerOnDate,
    createOrUpdateLiveBill,
    getBill,
    liveBillSummaries,
    users,
    deleteBills,
    openingBalances,
    setOpeningBalance,
    payments,
  } = useData();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [activeBillNo, setActiveBillNo] = useState<string | null>(null);
  const [initialBillTotal, setInitialBillTotal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const canEditBalances = currentUser?.role === 'ADMIN' || currentUser?.role === 'CREATOR';

  // SESSION STATE: Local items and static balance
  const [localBillItems, setLocalBillItems] = useState<BillItem[]>([]);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [prevBalInput, setPrevBalInput] = useState('0.00');
  const [originalPrevBalance, setOriginalPrevBalance] = useState(0);
  const [isPrevBalModified, setIsPrevBalModified] = useState(false);
  const [description, setDescription] = useState('');

  // Derived numeric value from input
  const staticPrevBalance = useMemo(() => parseFloat(prevBalInput) || 0, [prevBalInput]);

  // Form state for new item entry
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [uom, setUom] = useState('KGS');
  const [paidAmount, setPaidAmount] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [manualCustomerName, setManualCustomerName] = useState('');

  const [isSavingAndPrinting, setIsSavingAndPrinting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Walk-in mode state
  const [showWalkInConfirm, setShowWalkInConfirm] = useState(false);
  const [walkInSelectedIndex, setWalkInSelectedIndex] = useState(0);
  const walkInModalRef = useRef<HTMLDivElement>(null);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = 
      selectedCustomerId !== '' || 
      (localBillItems && localBillItems.length > 0) || 
      qty !== '' || 
      rate !== '' || 
      paidAmount !== '' || 
      deliveryCharge !== '' ||
      activeBillNo !== null ||
      isPrevBalModified ||
      description !== '';
    
    setIsDirty(hasChanges, handleSaveBill);
  }, [selectedCustomerId, localBillItems, qty, rate, paidAmount, deliveryCharge, activeBillNo, isPrevBalModified, description, setIsDirty]);

  // Handle Walk-in Selection Logic
  const handleWalkInSelection = useCallback((index: number) => {
    if (index === 0) {
      // Continue as Walk-in
      setWalkInConfirmed(true); 
      setSelectedCustomerId('WALK-IN'); 
      setShowWalkInConfirm(false); 
      setTimeout(() => manualCustomerNameRef.current?.focus(), 50); 
    } else if (index === 1) {
      // Select Customer
      setShowWalkInConfirm(false); 
      setTimeout(() => customerSelectRef.current?.focus(), 50); 
    } else {
      // Cancel
      setShowWalkInConfirm(false);
    }
  }, [setSelectedCustomerId]);

  // Walk-in Modal keyboard/focus effect
  useEffect(() => {
    if (showWalkInConfirm) {
      setWalkInSelectedIndex(0);
      const timer = setTimeout(() => {
        walkInModalRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showWalkInConfirm]);

  // Clear manual name if a non-walk-in customer is selected
  useEffect(() => {
    if (selectedCustomerId !== 'WALK-IN') {
      setManualCustomerName('');
    }
  }, [selectedCustomerId]);
  
  // Print confirmation dialog state
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [printPaperType, setPrintPaperType] = useState<'a4' | 'thermal' | 'thermal3'>('thermal');
  

  const [walkInConfirmed, setWalkInConfirmed] = useState(false);

  // WhatsApp share state
  const [showWhatsAppShareConfirm, setShowWhatsAppShareConfirm] = useState(false);

  // History states
  const [historyDate, setHistoryDate] = useState<Date | undefined>();
  const [historySelectedCustomer, setHistorySelectedCustomer] = useState<string>('');
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [filteredHistoryBills, setFilteredHistoryBills] = useState<LiveBillSummary[]>([]);
  const [historySearchText, setHistorySearchText] = useState('');

  // Refs
  const customerSelectRef = useRef<any>(null);
  const productSelectRef = useRef<any>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const uomSelectRef = useRef<any>(null);
  const billItemsContainerRef = useRef<HTMLDivElement>(null);
  const historyTableBodyRef = useRef<HTMLTableSectionElement>(null);
  const manualCustomerNameRef = useRef<HTMLInputElement>(null);
  const ignoreUrlBillNoRef = useRef<string | null>(null);
  const lastSessionKeyRef = useRef('');
  const isEditingRef = useRef(false);

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

  const goToFirstBillOfDay = () => {
    if (!date) return;
    const billsOfDay = sortedBills.filter(b => {
      const bDate = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date)) : new Date(0);
      return isSameDay(bDate, date);
    });
    // sortedBills is descending, so oldest is at the end
    if (billsOfDay.length > 0) {
      router.push(`/dashboard/billing?billNo=${billsOfDay[billsOfDay.length - 1].billNo}`);
    }
  };

  const goToLastBillOfDay = () => {
    if (!date) return;
    const billsOfDay = sortedBills.filter(b => {
      const bDate = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date)) : new Date(0);
      return isSameDay(bDate, date);
    });
    // sortedBills is descending, so newest is at the beginning
    if (billsOfDay.length > 0) {
      router.push(`/dashboard/billing?billNo=${billsOfDay[0].billNo}`);
    }
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
    option: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: state.isSelected
        ? 'hsl(var(--primary))'
        : state.isFocused
        ? 'hsl(var(--primary) / 0.15)'
        : 'transparent',
      color: state.isSelected
        ? 'hsl(var(--primary-foreground))'
        : 'hsl(var(--foreground))',
      '&:active': {
        backgroundColor: 'hsl(var(--primary))',
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

  // SESSION INITIALIZATION: Capture items and static balance when customer/bill/date changes
  useEffect(() => {
    const billNoFromParams = searchParams.get('billNo');
    
    // Safety: Reset the ignore ref if we are explicitly navigating to a specific bill
    if (billNoFromParams && billNoFromParams !== ignoreUrlBillNoRef.current) {
        ignoreUrlBillNoRef.current = null;
    }
    
    // Skip if we are mid-reset
    if (billNoFromParams && billNoFromParams === ignoreUrlBillNoRef.current) return;

    // Isolation: include date in the session key to re-initialize on date changes
    const dateKey = date ? format(date, 'yyyy-MM-dd') : 'no-date';
    const workId = billNoFromParams ? `load-${billNoFromParams}` : (selectedCustomerId ? `new-${selectedCustomerId}-${dateKey}` : `reset-${dateKey}`);
    if (workId === lastSessionKeyRef.current) return;
    lastSessionKeyRef.current = workId;

    if (!selectedCustomerId && !billNoFromParams) {
        // Reset state if no context
        setActiveBillNo(null);
        setLocalBillItems([]);
        setPrevBalInput('0.00');
        setDescription('');
        return;
    }

    const initializeSession = async () => {
        let billToLoad = null;
        if (billNoFromParams) {
            billToLoad = getBill(billNoFromParams);
            
            // Fallback: If not in local summaries (likely just saved or snapshot lag), try a direct Firestore fetch
            if (!billToLoad && firestore) {
                try {
                    const snap = await getDoc(doc(firestore, 'bills', billNoFromParams));
                    if (snap.exists()) {
                        billToLoad = { ...snap.data(), billNo: snap.id } as LiveBillSummary;
                    }
                } catch (e) { console.error("Summary fallback fetch failed", e); }
            }
        } else if (selectedCustomerId && selectedCustomerId !== 'WALK-IN') {
            // Isolation Rule: Load bill for specific selected date, not just today
            billToLoad = findBillForCustomerOnDate(selectedCustomerId, date || new Date());
        }

        if (billToLoad) {
            setSelectedCustomerId(billToLoad.customerId);
            setActiveBillNo(billToLoad.billNo);
            setInitialBillTotal(billToLoad.amount);
            setDeliveryCharge(billToLoad.deliveryCharge?.toString() || '');
            setPaidAmount(billToLoad.paidAmount?.toString() || '');
            setDescription(billToLoad.description || '');

            // Fetch items from Firestore once
            setIsItemsLoading(true);
            try {
                const snap = await getDocs(collection(firestore!, 'bills', billToLoad.billNo, 'billItems'));
                const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as BillItem));
                setLocalBillItems(items);
            } catch (e) { console.error("Failed to load items", e); }
            setIsItemsLoading(false);

            // Previous Balance Logic: 
            // Today -> customer live balance
            // Past -> stored snapshot in bill
            const dbBal = billToLoad.customerId === 'WALK-IN' ? 0 : (customerBalances[billToLoad.customerId] || 0);
            const bDate = billToLoad.date ? (billToLoad.date instanceof Timestamp ? billToLoad.date.toDate() : new Date(billToLoad.date)) : new Date();
            const isToday = isSameDay(bDate, new Date());
            let prev = 0;
            if (isToday) {
              prev = dbBal - billToLoad.amount;
            } else {
              prev = billToLoad.prevBalance !== undefined ? billToLoad.prevBalance : (dbBal - billToLoad.amount);
            }
            setPrevBalInput(prev.toFixed(2));
            setOriginalPrevBalance(prev);
            setIsPrevBalModified(false);

            if (billToLoad.date) {
                setDate(billToLoad.date instanceof Timestamp ? billToLoad.date.toDate() : new Date(billToLoad.date));
            }
            
            if (billToLoad.customerId === 'WALK-IN' && billToLoad.customerName && billToLoad.customerName !== 'Walk-in Customer' && billToLoad.customerName !== '--') {
                setManualCustomerName(billToLoad.customerName);
            } else {
                setManualCustomerName('');
            }
        } else if (selectedCustomerId) {
            // New Bill for selected customer on selected date (Clean state)
            setActiveBillNo(null);
            setInitialBillTotal(0);
            setDeliveryCharge('');
            setPaidAmount('');
            setLocalBillItems([]);
            setDescription('');
            // Previous Balance Logic: "Always latest customer balance"
            const prev = selectedCustomerId === 'WALK-IN' ? 0 : (customerBalances[selectedCustomerId] || 0);
            setPrevBalInput(prev.toFixed(2));
            setOriginalPrevBalance(prev);
            setIsPrevBalModified(false);
        } 
    };

    initializeSession();
  }, [selectedCustomerId, date, searchParams, customerBalances, getBill, findBillForCustomerOnDate, firestore]);

  useEffect(() => {
    if (isEditingRef.current) {
      return;
    }
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
    if (historySearchText) {
      const query = historySearchText.toLowerCase();
      results = results.filter(bill => {
        const searchableName = bill.customerId === 'WALK-IN' 
          ? (bill.customerName || 'WALK-IN') 
          : bill.customerName;
        return (
          searchableName.toLowerCase().includes(query) ||
          bill.billNo.toLowerCase().includes(query)
        );
      });
    }

    if (!historySelectedCustomer && !historyDate) {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endOfWeek(new Date(), { weekStartsOn: 1 });
      
      results = results.filter(bill => {
        if (!bill.date) return false;
        const d = (bill.date as Timestamp).toDate ? (bill.date as Timestamp).toDate() : new Date(bill.date as any);
        return d >= start && d <= end;
      });
    }

    setFilteredHistoryBills(sortBills(results));
  }, [liveBillSummaries, historySelectedCustomer, historyDate, historySearchText, sortBills]);

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
      amount: Number((qtyNum * rateNum).toFixed(2)),
      addedBy: currentUser?.id || 'unknown-user',
      stall: '1',
      billId: activeBillNo || undefined
    };

    setLocalBillItems(prev => [...prev, newItem]);
    
    // Clear inputs
    setQty('');
    setRate('');
    isEditingRef.current = false;
    setUom('KGS'); // Default reset to KGS
    if (productSelectRef.current) productSelectRef.current.clearValue();
    setSelectedProductId('');
    setProductSearchText('');
    
    // UX: Fast Entry - focus back to product search
    setTimeout(() => {
        productSelectRef.current?.focus();
    }, 50);
  }, [selectedProductId, qty, rate, uom, currentUser, products, activeBillNo, toast]);

  const persistItemUpdate = (itemId: string, field: 'rate' | 'qty', value: string) => {
    const parsedValue = parseFloat(value) || 0;
    setLocalBillItems(prev => prev.map(item => {
        if (item.id === itemId) {
            const newQty = field === 'qty' ? parsedValue : item.qty;
            const newRate = field === 'rate' ? parsedValue : item.rate;
            return { ...item, [field]: parsedValue, amount: Number((newQty * newRate).toFixed(2)) };
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
    setProductSearchText('');
    setQty('');
    setRate('');
    setUom('KGS'); // Default reset to KGS
    setPaidAmount('');
    setDeliveryCharge('');
    setInitialBillTotal(0);
    setWalkInConfirmed(false);
    setLocalBillItems([]);
    setPrevBalInput('0.00');
    setOriginalPrevBalance(0);
    setIsPrevBalModified(false);
    setManualCustomerName('');
    setDescription('');
    isEditingRef.current = false;
    
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
    if (isDirty) {
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
  }, [isDirty, showAlertDialog, performReset]);

  const getBillPrintData = useCallback((overrideBillNo?: string): BillPrintData | null => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const deliveryChargeNum = parseFloat(deliveryCharge) || 0;
    const paidAmountNum = parseFloat(paidAmount) || 0;
    const finalItemsTotal = localBillItems.reduce((sum, item) => sum + item.amount, 0);
    const finalTotalAmount = finalItemsTotal + deliveryChargeNum;
    const finalFinalBalance = staticPrevBalance + finalTotalAmount - paidAmountNum;

    const printCustomer = customer || { id: 'WALK-IN', name_en: manualCustomerName || '--', name_ta: 'வாடிக்கையாளர்', phone: '-' };

    return {
        billNo: overrideBillNo || activeBillNo || 'New Bill',
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
  }, [customers, selectedCustomerId, localBillItems, activeBillNo, deliveryCharge, paidAmount, staticPrevBalance, date, manualCustomerName]);

  // ── Billing Guard: sync unsaved state & expose save callback ─────────
  const hasUnsavedChanges = useMemo(() => {
    return (
      selectedCustomerId !== '' ||
      (localBillItems && localBillItems.length > 0) ||
      qty !== '' ||
      rate !== '' ||
      paidAmount !== '' ||
      deliveryCharge !== '' ||
      description !== '' ||
      activeBillNo !== null ||
      isPrevBalModified
    );
  }, [selectedCustomerId, localBillItems, qty, rate, paidAmount, deliveryCharge, description, activeBillNo, isPrevBalModified]);

  useEffect(() => {
    billingGuard.setHasUnsavedChanges(hasUnsavedChanges);
    return () => billingGuard.setHasUnsavedChanges(false);
  }, [hasUnsavedChanges]);

  // Warn on browser tab close / reload with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    billingGuard.saveBillRef.current = async (): Promise<boolean> => {
      if (isSaving) return false;
      if (!selectedCustomerId) {
        toast({ variant: 'destructive', title: 'Customer Required', description: 'Please select a customer or confirm as walk-in to save.' });
        return false;
      }
      try {
        setIsSaving(true);
        setLoading(true, 'Saving bill...');
        const savedData = await handleSaveAndGetData();
        setLoading(false);
        if (savedData) {
          performReset();
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    };
    return () => { billingGuard.saveBillRef.current = null; };
  });
  // ────────────────────────────────────────────────────────────────────────

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

    // Persist Manual Balance Override if active (Today Only)
    if (isPrevBalModified && selectedCustomerId && selectedCustomerId !== 'WALK-IN') {
      const isToday = isSameDay(date || new Date(), new Date());
      if (isToday) {
        const delta = staticPrevBalance - originalPrevBalance;
        if (delta !== 0) {
          const currentOpening = openingBalances[selectedCustomerId] || 0;
          setOpeningBalance(selectedCustomerId, currentOpening + delta);
        }
      }
    }

    // Purge old items from DB if editing to ensure local state becomes the single source of truth
    if (activeBillNo && firestore) {
        try {
            const itemsSnap = await getDocs(collection(firestore, 'bills', activeBillNo, 'billItems'));
            const purgeBatch = writeBatch(firestore);
            itemsSnap.forEach(d => purgeBatch.delete(d.ref));
            await purgeBatch.commit();
        } catch (e) { console.error("Item update error:", e); }
    }

    const billSummary = {
      customerName: customer ? `${customer.name_en} (${customer.name_ta})` : (manualCustomerName || '--'),
      customerId: selectedCustomerId || 'WALK-IN',
      stall: '1',
      createdBy: activeBillNo ? getBill(activeBillNo)?.createdBy : undefined,
      description: description,
      prevBalance: staticPrevBalance,
    };

    const parsedPaid = parseFloat(paidAmount) || 0;
    const parsedDelivery = parseFloat(deliveryCharge) || 0;
    const itemsTotal = localBillItems.reduce((sum, item) => sum + item.amount, 0);
    const finalBalanceCalc = staticPrevBalance + itemsTotal + parsedDelivery - parsedPaid;
    
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
      
      // Explicitly mark as clean after successful save
      setIsDirty(false);
      
      // Return freshly generated ID data for immediate printing
      return getBillPrintData(billNo);
    } catch (error) {
      console.error('Save failed:', error);
      toast({ variant: 'destructive', title: 'Save failed' });
      return null;
    }
  };

  const handleSaveBill = async () => {
    if (isSaving) return; // 🔒 prevents duplicate saves
    if (!selectedCustomerId) {
        toast({ variant: 'destructive', title: 'Customer Required', description: 'Please select a customer or confirm as walk-in to save.' });
        return;
    }

    try {
      setIsSaving(true);
      setLoading(true, 'Saving bill...');
      const savedData = await handleSaveAndGetData();
      setLoading(false);
      if (savedData) performReset();
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintBill = async (paper: 'thermal' | 'a4') => {
    if (localBillItems.length === 0 && !activeBillNo) {
        toast({ variant: 'destructive', title: 'Cannot Print', description: 'Please add at least one item.' });
        return;
    }
    setPrintPaperType(paper);
    setShowPrintConfirm(true);
  };

  const handlePrint3Inch = async () => {
    // Same flow as Print Receipt — shows the same Save/Print dialog, just with 3-inch paper
    if (localBillItems.length === 0 && !activeBillNo) {
      toast({ variant: 'destructive', title: 'Cannot Print', description: 'Please add at least one item.' });
      return;
    }
    setPrintPaperType('thermal3');
    setShowPrintConfirm(true);
  };

  const handleShareWhatsApp = async () => {
    if (localBillItems.length === 0 && !activeBillNo) {
        toast({ variant: 'destructive', title: 'Cannot Share', description: 'Please add at least one item.' });
        return;
    }
    setShowWhatsAppShareConfirm(true);
  };

  const handleSharePDF = async () => {
    if (localBillItems.length === 0 && !activeBillNo) {
      toast({ variant: 'destructive', title: 'Cannot Share', description: 'Please add at least one item.' });
      return;
    }
    setLoading(true, 'Preparing PDF...');
    const savedData = await handleSaveAndGetData();
    setLoading(false);
    if (!savedData) return;
    // Open the A4 print page with share=pdf flag — it auto-triggers the Web Share API
    sessionStorage.setItem('billPrintData', JSON.stringify(savedData));
    window.open(`/print/bill?paper=a4&share=pdf`, '_blank');
    performReset();
  };

  const handlePrintModalAction = async (action: string) => {
    if (action === "save") {
      if (isSavingAndPrinting) return;
      setIsSavingAndPrinting(true);
      setLoading(true, "Saving & Printing...");
      try {
        const d = await handleSaveAndGetData();
        if (d) {
          sessionStorage.setItem('billPrintData', JSON.stringify(d));
          window.open(`/print/bill?paper=${printPaperType}`, '_blank');
          performReset();
          setShowPrintConfirm(false);
        }
      } finally {
        setLoading(false);
        setIsSavingAndPrinting(false);
      }
    } else if (action === "printWithoutSave") {
      const d = getBillPrintData();
      if (d) {
        sessionStorage.setItem('billPrintData', JSON.stringify(d));
        window.open(`/print/bill?paper=${printPaperType}`, '_blank');
      }
      setShowPrintConfirm(false);
    } else if (action === "cancel") {
      setShowPrintConfirm(false);
    }
  };

  const handlePrintModalActionRef = useRef(handlePrintModalAction);
  handlePrintModalActionRef.current = handlePrintModalAction;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPrintConfirm || isSavingAndPrinting) return;

      const options = ["save", "printWithoutSave", "cancel"];

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlePrintModalActionRef.current(options[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowPrintConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, showPrintConfirm, isSavingAndPrinting]);

  useEffect(() => {
    if (showPrintConfirm) {
      setSelectedIndex(0);
    }
  }, [showPrintConfirm]);


  const handleDeleteSelected = async () => {
    if (selectedBills.size === 0) return;

    // Capture data for undo
    const billsToRestore: { summary: LiveBillSummary, items: BillItem[] }[] = [];
    try {
      for (const billNo of selectedBills) {
        const summary = liveBillSummaries.find(b => b.billNo === billNo);
        if (summary && firestore) {
          const itemsSnap = await getDocs(collection(firestore, 'bills', billNo, 'billItems'));
          const items = itemsSnap.docs.map(d => ({ ...d.data(), id: d.id } as BillItem));
          billsToRestore.push({ summary, items });
        }
      }
    } catch (err) {
      console.error("Undo data capture failed:", err);
    }

    showAlertDialog({
      title: 'Are you sure?',
      description: `This will permanently delete ${selectedBills.size} bill(s). This action cannot be undone.`,
      onConfirm: async () => {
        let undoClicked = false;
        const billNosToDelete = Array.from(selectedBills);
        
        await deleteBills(billNosToDelete);
        setSelectedBills(new Set());

        toast({
          title: "Bill deleted — Undo?",
          description: "Undo is available for 10 seconds.",
          duration: 10000,
          action: (
            <ToastAction altText="Undo" onClick={() => {
              undoClicked = true;
              billsToRestore.forEach(data => {
                createOrUpdateLiveBill(
                  data.summary,
                  data.items,
                  data.summary.paidAmount || 0,
                  data.summary.deliveryCharge || 0,
                  data.summary.date instanceof Timestamp ? data.summary.date.toDate() : new Date(data.summary.date),
                  data.summary.billNo
                );
              });
              toast({ title: "Bills restored" });
            }}>Undo</ToastAction>
          ),
        });

        // After 10 seconds, show the "permanently deleted" message if not undone
        setTimeout(() => {
          if (!undoClicked) {
            toast({
              title: "Bills Deleted",
              description: `${billNosToDelete.length} bill(s) and their items have been permanently deleted.`
            });
          }
        }, 10500);
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
    setHistorySearchText('');
  };

  const handleDateKeyDown = (e: React.KeyboardEvent, currentDate: Date | undefined, setDateFn: (d: Date | undefined) => void) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const baseDate = currentDate || new Date();
    const current = new Date(baseDate);

    if (e.key === 'ArrowUp') {
      current.setDate(current.getDate() + 1);
    } else if (e.key === 'ArrowDown') {
      current.setDate(current.getDate() - 1);
    }
    
    setDateFn(new Date(current));
  };

  // Keyboard navigation
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        uomSelectRef.current?.focus(); 
    }
  };
  
  const handleRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    // Selection logic via TAB
    if (e.key === 'Tab' && !e.shiftKey && !selectedCustomerId) {
      // CRITICAL: We must accurately check if any suggestions match the user's typing.
      // If matches exist, we must let ReactSelect's tabSelectsValue logic handle the selection.
      // This prevents the Walk-in Customer fallback from popping up when a valid match is found.
      const query = customerSearchText.toLowerCase();
      const matches = customerOptions.filter(opt => 
        opt.label.toLowerCase().includes(query) || 
        opt.value.toLowerCase().includes(query)
      );

      // Mandatory Debug Logs for tracking selection flow
      console.log("TAB pressed. Current input:", customerSearchText);
      console.log("Matching suggestions:", matches.length);

      // If suggestions are visible, do NOT intercept the TAB key.
      // ReactSelect will select the highlighted item and trigger our focus routing via onChange.
      if (customerSearchText && matches.length > 0) {
        return;
      }

      // If no suggestions match OR the input is empty, trigger the Walk-in Confirmation
      e.preventDefault(); 
      setShowWalkInConfirm(true);
    }
  };

  const handleManualCustomerNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      productSelectRef.current?.focus();
    }
  };

  // UX: Walk-in detection on product select click
  const handleProductSelectInteraction = () => {
    if (!selectedCustomerId) {
        setShowWalkInConfirm(true);
    }
  };

  const itemsTotal = useMemo(() => localBillItems.reduce((sum, item) => sum + item.amount, 0), [localBillItems]);
  const totalAmount = itemsTotal + (parseFloat(deliveryCharge) || 0);
  const finalBalance = staticPrevBalance + totalAmount - (parseFloat(paidAmount) || 0);

  const { totalKgs, totalBox } = useMemo(() => {
    return localBillItems.reduce(
      (acc, item) => {
        const uomVal = item.uom.toUpperCase();
        if (uomVal === 'KGS') acc.totalKgs += item.qty;
        if (uomVal === 'BOX') acc.totalBox += item.qty;
        return acc;
      },
      { totalKgs: 0, totalBox: 0 }
    );
  }, [localBillItems]);

  const customerOptions = useMemo(() => {
    const opts = customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }));
    opts.unshift({ value: 'WALK-IN', label: 'Walk-in Customer' });
    return opts;
  }, [customers]);

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

  const enrichedHistoryBills = useMemo(() => {
    return filteredHistoryBills.map(bill => {
      let prevBalForHistory = 0;
      if (bill.customerId !== 'WALK-IN') {
        const initialBalance = openingBalances[bill.customerId] || 0;
        const bDateObj = bill.date ? ((bill.date as any).toDate ? (bill.date as any).toDate() : new Date(bill.date)) : new Date();
        const bTime = bDateObj.getTime();

        const priorBills = liveBillSummaries
          .filter(b => b.customerId === bill.customerId && b.billNo !== bill.billNo)
          .filter(b => {
             const d = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date)) : new Date();
             return d.getTime() < bTime;
          })
          .reduce((sum, b) => sum + b.amount + (b.deliveryCharge || 0), 0);

        const priorPayments = payments
          .filter(p => p.customerId === bill.customerId && !p.isDeleted)
          .filter(p => {
             const d = p.date ? ((p.date as any).toDate ? (p.date as any).toDate() : new Date(p.date)) : new Date();
             return d.getTime() < bTime;
          })
          .reduce((sum, p) => sum + p.amount, 0);

        prevBalForHistory = initialBalance + priorBills - priorPayments;
      }

      let finalBal = bill.finalBalance;
      if (!finalBal) {
        const dbBal = customerBalances[bill.customerId] || 0;
        const bDate = bill.date ? ((bill.date as any).toDate ? (bill.date as any).toDate() : new Date(bill.date)) : null;
        const isToday = bDate ? isSameDay(bDate, new Date()) : false;
        let prev = 0;
        if (isToday) {
          prev = dbBal - bill.amount;
        } else {
          prev = bill.prevBalance !== undefined ? bill.prevBalance : (dbBal - bill.amount);
        }
        finalBal = prev + bill.amount + (bill.deliveryCharge || 0) - (bill.paidAmount || 0);
      }
      return { ...bill, computedFinalBalance: finalBal, prevBalForHistory };
    });
  }, [filteredHistoryBills, openingBalances, liveBillSummaries, payments]);

  const handleGlobalTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    const active = document.activeElement;
    if (!active) return;

    // Optional safety: Ignore if a modal/dialog is open
    if (document.querySelector('[role="dialog"]')) return;

    const isInsideProduct = document.getElementById('product-section')?.contains(active);
    const isSaveBtn = active.id === 'save-bill-btn';
    
    const ignoreFields = ['TEXTAREA'];
    if (ignoreFields.includes(active.tagName) || isSaveBtn) return;

    if (!isInsideProduct) {
      e.preventDefault();
      document.getElementById('save-bill-btn')?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-32 md:pb-8 max-w-full" onKeyDown={handleGlobalTab}>
      <div className="grid auto-rows-max items-start gap-4 lg:grid-cols-2 lg:gap-8">
      <div className="grid auto-rows-max gap-4 section-box">
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between pb-2">
              <div>
                <CardTitle className="font-headline">
                  {activeBillNo ? `Editing Bill ${activeBillNo}` : 'Create Bill'}
                </CardTitle>
                <CardDescription>Manage active transaction.</CardDescription>
              </div>
              <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto sm:items-end">
                <Popover>
                  <PopoverTrigger asChild>
                  <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal sm:w-[240px] select-none', !date && 'text-muted-foreground')} onFocus={() => { if(!date) setDate(new Date()) }} onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }} onKeyDown={(e) => handleDateKeyDown(e, date, (d) => {
                      if (isDirty && d) {
                        showAlertDialog({
                           title: 'Unsaved Changes',
                           description: 'You have unsaved changes. Switching the date will discard them. Continue?',
                           onConfirm: () => setDate(d),
                        });
                      } else if (d) {
                        setDate(d);
                      }
                    })}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'dd-MM-yyyy') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar 
                      mode="single" 
                      selected={date} 
                      onSelect={(newDate) => {
                        if (isDirty) {
                          showAlertDialog({
                            title: 'Unsaved Changes',
                            description: 'You have unsaved changes. Switching the date will discard them. Continue?',
                            onConfirm: () => setDate(newDate),
                          });
                        } else {
                          setDate(newDate);
                        }
                      }} 
                      initialFocus 
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" onClick={handleNewBill} className="h-11 md:h-10">
                  <FilePlus className="mr-2 h-4 w-4" />
                  New Bill
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="grid gap-2">
                <Label htmlFor="customer">Customer</Label>
                <ReactSelect
                  ref={customerSelectRef}
                  instanceId="customer-select"
                  placeholder="Select customer..."
                  isClearable
                  tabSelectsValue={true}
                  openMenuOnFocus={true}
                  options={customerOptions}
                  value={customerOptions.find(o => o.value === selectedCustomerId) || null}
                  onInputChange={(val) => setCustomerSearchText(val)}
                  onChange={(option) => {
                    const id = option ? option.value : '';
                    setSelectedCustomerId(id);
                    if (!id) {
                      setWalkInConfirmed(false);
                    } else if (id === 'WALK-IN') {
                      // Case 2: Walk-in Customer -> Move focus to name input
                      setTimeout(() => manualCustomerNameRef.current?.focus(), 50);
                    } else {
                      // Case 1: Regular Customer -> Move focus to product search
                      setTimeout(() => productSelectRef.current?.focus(), 50);
                    }
                  }}
                  onKeyDown={handleCustomerKeyDown}
                  styles={reactSelectStyles}
                  filterOption={(option, rawInput) => {
                    if (!rawInput) return true;
                    const searchInput = rawInput.trim();
                    const isNumericSearch = /^\d+$/.test(searchInput);
                    
                    if (isNumericSearch) {
                      return String(option.value) === searchInput || String(option.value) === String(Number(searchInput));
                    } else {
                      return option.label.toLowerCase().startsWith(searchInput.toLowerCase()) || 
                             (option.value === 'WALK-IN' && option.label.toLowerCase().includes(searchInput.toLowerCase()));
                    }
                  }}
                  noOptionsMessage={() => "No customer found"}
                />
                {selectedCustomerId === 'WALK-IN' && (
                  <div className="mt-2 grid gap-1.5">
                    <Label htmlFor="manualCustomerName" className="text-xs text-muted-foreground">Enter Customer Name (optional)</Label>
                    <Input
                      id="manualCustomerName"
                      ref={manualCustomerNameRef}
                      placeholder="Enter customer name (optional)"
                      value={manualCustomerName}
                      onChange={(e) => setManualCustomerName(e.target.value)}
                      onKeyDown={handleManualCustomerNameKeyDown}
                      className="h-11 md:h-10"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card id="product-section" className="border-none shadow-none bg-transparent mt-4 pt-4 border-t">
            <CardHeader className="pb-2"><CardTitle className="font-headline text-lg">Add Item</CardTitle></CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-3">
                <div className="grid w-full md:flex-[4] min-w-0 gap-1.5" onClick={handleProductSelectInteraction}>
                  <Label htmlFor="product" className="text-xs">Product</Label>
                  <ReactSelect
                    instanceId="product-select"
                    placeholder="Select product..."
                    isClearable
                    tabSelectsValue={true}
                    openMenuOnFocus={true}
                    options={products.map((p) => ({ value: p.id, label: `${p.name_en} (${p.name_ta})` }))}
                    value={products.find(p => p.id === selectedProductId) ? { value: selectedProductId, label: products.find(p => p.id === selectedProductId)?.name_en + ' (' + products.find(p => p.id === selectedProductId)?.name_ta + ')' } : null}
                    inputValue={productSearchText}
                    onInputChange={(val) => setProductSearchText(val)}
                    onChange={(option) => {
                      if (!option) { 
                        setSelectedProductId(''); 
                        setRate(''); 
                        isEditingRef.current = false;
                        setProductSearchText('');
                        return; 
                      }
                      setSelectedProductId(option.value);
                      setProductSearchText('');
                      const product = products.find(p => p.id === option.value);
                      if (product && product.uom_allowed.length > 0) {
                        const defaultUom = product.uom_allowed.includes('KGS') ? 'KGS' : product.uom_allowed[0];
                        setUom(defaultUom);
                      }
                      setTimeout(() => qtyInputRef.current?.focus(), 0);
                    }}
                    styles={reactSelectStyles}
                    ref={productSelectRef}
                    onFocus={handleProductSelectInteraction}
                  />
                </div>
                <div className="grid w-full md:w-24 shrink-0 gap-1.5">
                  <Label htmlFor="qty" className="text-xs">Qty</Label>
                  <Input id="qty" type="number" placeholder="0.00" value={qty} onChange={(e) => setQty(e.target.value)} ref={qtyInputRef} onKeyDown={handleQtyKeyDown} className="h-11 md:h-10 w-full" />
                </div>
                <div className="grid w-full md:flex-1 shrink-0 gap-1.5 min-w-0 md:min-w-[100px]">
                  <Label className="text-xs">UOM</Label>
                  <ReactSelect
                    ref={uomSelectRef}
                    instanceId="uom-select"
                    placeholder="UOM"
                    options={useMemo(() => {
                      const opts = selectedProduct?.uom_allowed.map(o => ({ value: o, label: o })) || [];
                      // Force KGS to the top of the list so it is highlighted by default when the menu opens
                      return [...opts].sort((a, b) => a.value === 'KGS' ? -1 : b.value === 'KGS' ? 1 : 0);
                    }, [selectedProduct])}
                    value={uom ? { value: uom, label: uom } : null}
                    onChange={(option: any) => {
                      setUom(option ? option.value : 'KGS');
                      setTimeout(() => rateInputRef.current?.focus(), 50);
                    } }
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        // Confirm selection and move to Rate
                        setTimeout(() => rateInputRef.current?.focus(), 50);
                      }
                    }}
                    styles={reactSelectStyles}
                    tabSelectsValue={true}
                    openMenuOnFocus={true}
                    isSearchable={false}
                    className="h-11 md:h-10" // ManualEdits
                  />
                </div>
                <div className="grid w-full md:w-24 shrink-0 gap-1.5">
                  <Label htmlFor="rate" className="text-xs">Rate</Label>
                  <Input 
                    id="rate" 
                    type="number" 
                    placeholder="0.00" 
                    value={rate} 
                    onChange={(e) => setRate(e.target.value)} 
                    ref={rateInputRef} 
                    onKeyDown={handleRateKeyDown} 
                    onFocus={(e) => e.target.select()}
                    className="h-11 md:h-10 w-full" 
                  />
                </div>
                <div className="w-full md:w-auto shrink-0"><Button onClick={handleAddItem} className="h-11 md:h-10 w-full md:w-10 p-0" size={null as any}><PlusCircle className="h-5 w-5 mr-2 md:mr-0" /><span className="md:hidden">Add Item</span></Button></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline">Description (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[70px] w-full resize-none text-sm"
                placeholder="Enter notes (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20">
          <Card className="section-box">
            <CardHeader className="pb-2">
              <CardTitle className="font-headline">Current Bill</CardTitle>
              <CardDescription className="truncate">{selectedCustomerId === 'WALK-IN' ? 'Items added for Walk-in Customer.' : selectedCustomerId ? `Items added for ${customers.find(c => c.id === selectedCustomerId)?.name_en}.` : 'No customer selected.'}</CardDescription>
            </CardHeader>
            <CardContent ref={billItemsContainerRef} className="max-h-[240px] p-0 border-t overflow-y-auto overflow-x-auto live-bill-container">
              <div className="min-w-[600px] w-full">
                <Table className="w-full md:table-fixed border-collapse">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b">
                      <TableHead className="w-[40px] px-1 text-center font-bold text-xs md:text-sm uppercase">S/N</TableHead>
                      <TableHead className="px-1 text-left font-bold text-xs md:text-sm uppercase min-w-[200px] md:min-w-0">Product</TableHead>
                      <TableHead className="w-[60px] px-1 text-center font-bold text-xs md:text-sm uppercase">UOM</TableHead>
                      <TableHead className="w-[80px] md:w-[100px] px-1 text-center font-bold text-xs md:text-sm uppercase">Qty</TableHead>
                      <TableHead className="w-[100px] md:w-[120px] px-1 text-right font-bold text-xs md:text-sm uppercase">Rate</TableHead>
                      <TableHead className="w-[100px] md:w-[130px] px-1 text-right font-bold text-xs md:text-sm uppercase">Amount</TableHead>
                      <TableHead className="w-[40px] md:w-[45px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  <TooltipProvider delayDuration={200}>
                    {isItemsLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow> : localBillItems.length > 0 ? (
                      localBillItems.map((item, index) => {
                        const itemAddedBy = users.find(u => u.id === item.addedBy)?.username || '--';
                        return (
                          <TableRow 
                            key={item.id} 
                            className="h-14 hover:bg-muted/50 border-b relative cursor-pointer select-none" 
                            onDoubleClick={() => {
                              isEditingRef.current = true;
                              setSelectedProductId(item.productId);
                              
                              // Sync highlight logic
                              const productInfo = products.find(p => p.id === item.productId);
                              if (productInfo) {
                                  setProductSearchText(`${productInfo.name_en} (${productInfo.name_ta})`);
                              }
                              
                              setQty(item.qty.toString());
                              setUom(item.uom);
                              setRate(item.rate.toString());
                              setLocalBillItems(prev => prev.filter(i => i.id !== item.id));
                              setTimeout(() => productSelectRef.current?.focus(), 50);
                            }}
                          >
                            <TableCell className="px-1 text-center text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="px-1 min-w-[200px] md:min-w-0 md:max-w-[250px]">
                                  <Tooltip key={item.id}>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-default block w-full whitespace-normal break-words text-xs md:text-base leading-tight md:leading-normal font-medium">{item.product}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Added by: {itemAddedBy}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                            <TableCell className="px-1 text-center">{item.uom}</TableCell>
                            <TableCell className="px-1 md:px-1"><Input type="number" defaultValue={item.qty} onBlur={(e) => persistItemUpdate(item.id, 'qty', e.target.value)} onFocus={(e) => e.target.select()} className="mx-auto h-9 w-full text-center font-mono text-sm md:text-base px-1" /></TableCell>
                            <TableCell className="px-1 md:px-1 text-right"><Input type="number" defaultValue={item.rate} onBlur={(e) => persistItemUpdate(item.id, 'rate', e.target.value)} onFocus={(e) => e.target.select()} className="ml-auto h-9 w-full text-right font-mono text-sm md:text-base px-1" /></TableCell>
                            <TableCell className="px-1 text-right font-mono font-semibold">{formatINR(item.amount)}</TableCell>
                            <TableCell className="px-1 text-right"><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                          </TableRow>
                        );
                      })
                    ) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No items.</TableCell></TableRow>}
                    </TooltipProvider>
                  </TableBody>
                </Table>
              </div>
              
              {localBillItems.length > 0 && (
                <div className="mt-2 px-4 py-2 text-sm font-medium text-muted-foreground border-t bg-muted/5 flex gap-1">
                  <span>Total Qty →</span>
                  <span className="text-foreground">
                    {totalKgs > 0 ? `${totalKgs.toFixed(1)} KGS` : ''}
                    {totalKgs > 0 && totalBox > 0 ? ', ' : ''}
                    {totalBox > 0 ? `${Math.round(totalBox)} BOX` : ''}
                  </span>
                </div>
              )}
            </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-2 border-t pt-4 sm:items-end">
                {/* Mobile totals — compact two-column grid, full width */}
                <div className="w-full md:hidden rounded-lg bg-muted/40 border p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-sm">
                    <span className="font-medium text-muted-foreground">Items Total</span>
                    <span className="font-mono font-semibold text-right">₹{itemsTotal.toFixed(2)}</span>

                    <span className="font-medium text-muted-foreground flex items-center">Delivery</span>
                    <Input className="h-10 text-right font-mono text-base px-2 border-primary/20" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} onFocus={(e) => e.target.select()} />

                    <span className="font-medium text-muted-foreground">Bill Total</span>
                    <span className="font-mono font-bold text-right">₹{totalAmount.toFixed(2)}</span>

                    <span className="font-medium text-muted-foreground flex items-center">Prev Bal</span>
                    <Input
                      className={cn(
                        "h-10 text-right font-mono text-base px-2 border-primary/20",
                        isPrevBalModified && "bg-amber-50 dark:bg-amber-950/30 border-amber-500 font-bold"
                      )}
                      value={prevBalInput}
                      onChange={(e) => { setPrevBalInput(e.target.value); setIsPrevBalModified(true); }}
                      onFocus={(e) => e.target.select()}
                      disabled={!canEditBalances}
                    />

                    <span className="font-medium text-muted-foreground flex items-center">Paid</span>
                    <Input className="h-10 text-right font-mono text-base px-2 border-primary/20" value={paidAmount} onChange={(e) => e.target.value === '' ? setPaidAmount('') : setPaidAmount(e.target.value)} onFocus={(e) => e.target.select()} />

                    <span className="font-semibold text-base border-t pt-3">Balance</span>
                    <span className="font-mono font-bold text-right text-base text-primary border-t pt-3">₹{finalBalance.toFixed(2)}</span>
                  </div>
                </div>
                {/* Desktop totals — unchanged */}
                <div className="hidden md:grid w-full max-sm grid-cols-2 gap-x-4 gap-y-1 self-end text-right text-base md:text-lg">
                  <span className="font-semibold">Items Total:</span><span className="font-mono">₹{formatINR(itemsTotal)}</span>
                  <span className="font-semibold">Delivery:</span><Input className="ml-auto max-w-32 h-9 md:h-10 text-right font-mono" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} onFocus={(e) => e.target.select()} />
                  <span className="font-semibold">Bill Total:</span><span className="font-mono font-bold">₹{formatINR(totalAmount)}</span>
                  <span className="font-semibold">Prev Bal:</span>
                  <Input 
                    className={cn(
                      "ml-auto max-w-32 h-9 md:h-10 text-right font-mono",
                      isPrevBalModified && "bg-amber-50 dark:bg-amber-950/30 border-amber-500 font-bold"
                    )} 
                    value={prevBalInput} 
                    onChange={(e) => {
                      setPrevBalInput(e.target.value);
                      setIsPrevBalModified(true);
                    }} 
                    onFocus={(e) => e.target.select()}
                    disabled={!canEditBalances}
                  />
                  <span className="font-semibold">Paid:</span><Input className="ml-auto max-w-32 h-9 md:h-10 text-right font-mono" value={paidAmount} onChange={(e) => e.target.value === '' ? setPaidAmount('') : setPaidAmount(e.target.value)} onFocus={(e) => e.target.select()} />
                  <span className="font-semibold text-lg pt-1">Balance:</span>
                  <span className={cn(
                    "font-mono font-bold text-xl md:text-2xl pt-1",
                    finalBalance >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"
                  )}>
                    ₹{formatINR(finalBalance)}
                  </span>
                </div>

                <div className="hidden flex-wrap justify-end gap-2 md:flex">
                  <Button variant="outline" className="nav-btn" onClick={goToFirstBillOfDay} disabled={sortedBills.length === 0}>{"<<"}</Button>
                  <Button variant="outline" className="nav-btn" onClick={() => {
                    if (currentBillIndex === -1 && sortedBills.length > 0) {
                      router.push(`/dashboard/billing?billNo=${sortedBills[0].billNo}`);
                    } else if (currentBillIndex >= 0 && currentBillIndex < sortedBills.length - 1) {
                      router.push(`/dashboard/billing?billNo=${sortedBills[currentBillIndex + 1].billNo}`);
                    }
                  }} disabled={sortedBills.length === 0 || currentBillIndex >= sortedBills.length - 1}>{"<"}</Button>
                  <Button id="save-bill-btn" size="lg" className="btn-save" onClick={handleSaveBill} disabled={!selectedCustomerId || isSaving}><Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save Bill"}</Button>
                  <Button onClick={() => handlePrintBill('thermal')} disabled={!selectedCustomerId}>Print Receipt</Button>
                  {/* TEMP DISABLED
                  <Button className="btn-print" onClick={() => handlePrintBill('a4')} disabled={!selectedCustomerId}>Print A4</Button>
                  */}
                  <Button variant="secondary" onClick={handlePrint3Inch} disabled={!selectedCustomerId}>Print 3-Inch</Button>
                  <Button variant="outline" className="nav-btn" onClick={() => {
                    if (currentBillIndex > 0) {
                      router.push(`/dashboard/billing?billNo=${sortedBills[currentBillIndex - 1].billNo}`);
                    } else if (currentBillIndex === 0) {
                      router.push(`/dashboard/billing`);
                    }
                  }} disabled={currentBillIndex === -1}>{">"}</Button>
                  <Button variant="outline" className="nav-btn" onClick={goToLastBillOfDay} disabled={sortedBills.length === 0}>{">>"}</Button>
                  <Button variant="outline" onClick={handleShareWhatsApp} disabled={!selectedCustomerId}><Share className="mr-2 h-4 w-4" /> Share</Button>
                  <Button
                    variant="outline"
                    onClick={handleSharePDF}
                    disabled={!selectedCustomerId}
                    className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                  >
                    <Share className="mr-2 h-4 w-4" /> Share (PDF)
                  </Button>
                </div>
              </CardFooter>
          </Card>
        </div>
      </div>

      <Separator />

      <Card className="max-w-full overflow-hidden section-box">
        <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline text-xl md:text-2xl">Bill History</CardTitle>
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
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or bill no..."
                  className="pl-9 h-11 md:h-10"
                  value={historySearchText}
                  onChange={(e) => setHistorySearchText(e.target.value)}
                />
              </div>
            </div>
            <div className="grid flex-1 gap-2">
              <Label>Customer Filter</Label>
              <ReactSelect
                instanceId="history-customer-select"
                options={customerOptions}
                value={customerOptions.find(o => o.value === historySelectedCustomer) || null}
                onChange={(option) => setHistorySelectedCustomer(option ? option.value : '')}
                isClearable
                placeholder="Filter by customer..."
                styles={reactSelectStyles}
                filterOption={(option, rawInput) => {
                  if (!rawInput) return true;
                  const searchInput = rawInput.trim();
                  const isNumericSearch = /^\d+$/.test(searchInput);
                  
                  if (isNumericSearch) {
                    return String(option.value) === searchInput || String(option.value) === String(Number(searchInput));
                  } else {
                    return option.label.toLowerCase().startsWith(searchInput.toLowerCase()) || 
                           (option.value === 'WALK-IN' && option.label.toLowerCase().includes(searchInput.toLowerCase()));
                  }
                }}
                noOptionsMessage={() => "No customer found"}
              />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                <Button variant={'outline'} className={cn('w-full sm:w-[240px] justify-start text-left font-normal select-none', !historyDate && 'text-muted-foreground')} onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }} onKeyDown={(e) => handleDateKeyDown(e, historyDate, setHistoryDate as (d: Date | undefined) => void)}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {historyDate ? format(historyDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} initialFocus /></PopoverContent>
              </Popover>
            </div>
            <Button variant="ghost" onClick={handleClearHistorySearch} className="h-11 md:h-10"><X className="mr-2 h-4 w-4" /> Clear</Button>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-md border">
            <Table className="w-full table-fixed text-sm">
              <TableHeader>
                <TableRow className="bg-muted/50 border-b border-border">
                  {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
                    <TableHead className="w-[40px] text-center px-[10px] py-[12px] text-[14px] font-semibold text-muted-foreground"></TableHead>
                  )}
                  <TableHead className="w-[90px] px-[10px] py-[12px] text-[14px] font-semibold text-muted-foreground">Bill No</TableHead>
                  <TableHead className="w-[150px] px-[10px] py-[12px] text-[14px] font-semibold text-muted-foreground">Date</TableHead>
                  <TableHead className="px-[10px] py-[12px] text-[14px] font-semibold text-muted-foreground">Customer</TableHead>
                  <TableHead className="w-32 px-4 text-right">Prev Bal</TableHead>
                  <TableHead className="w-[130px] text-right px-[10px] py-[12px] text-[14px] font-semibold text-muted-foreground">Amt</TableHead>
                  <TableHead className="w-[150px] text-right px-[10px] py-[12px] text-[14px] font-semibold text-muted-foreground">Final Bal</TableHead>
                  <TableHead className="w-[120px] px-[10px] py-[12px] text-[14px] font-semibold text-muted-foreground">Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody ref={historyTableBodyRef}>
                {enrichedHistoryBills.length > 0 ? (
                  enrichedHistoryBills.map((bill) => {
                    const creator = users.find((user) => user.id === bill.createdBy);
                    const bDate = bill.date ? ((bill.date as any).toDate ? (bill.date as any).toDate() : new Date(bill.date)) : null;
                    return (
                      <TableRow 
                        key={bill.billNo} 
                        className="cursor-pointer hover:bg-muted/50 border-b border-border" 
                        onDoubleClick={() => handleEditBill(bill.billNo)} 
                        tabIndex={0} 
                        onKeyDown={(e) => e.key === 'Enter' && handleEditBill(bill.billNo)}
                      >
                        {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
                          <TableCell className="w-[40px] text-center px-[10px] py-[12px]">
                            <Checkbox checked={selectedBills.has(bill.billNo)} onCheckedChange={(checked) => handleSelectBill(bill.billNo, !!checked)} />
                          </TableCell>
                        )}
                        <TableCell className="px-[10px] py-[12px] text-[14px] font-semibold text-foreground truncate">{bill.billNo}</TableCell>
                        <TableCell className="px-[10px] py-[12px] text-[14px] text-foreground truncate">{bDate ? format(bDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell className="px-[10px] py-[12px] text-[14px] text-foreground truncate">{bill.customerName}</TableCell>
                        <TableCell className="px-4 text-right font-mono font-bold whitespace-nowrap">₹{formatINR(bill.prevBalForHistory)}</TableCell>
                        <TableCell className="text-right px-[10px] py-[12px] text-[14px] font-medium text-foreground font-mono">₹{formatINR(bill.amount)}</TableCell>
                        <TableCell className="text-right px-[10px] py-[12px] text-[14px] font-bold text-foreground font-mono">
                        {`₹${formatINR(bill.computedFinalBalance)}`}
                      </TableCell>
                        <TableCell className="px-[10px] py-[12px] text-[14px] text-muted-foreground truncate">{creator?.username || bill.createdBy || '--'}</TableCell>
                      </TableRow>
                    );
                  })
                ) : <TableRow><TableCell colSpan={7} className="h-24 text-center">No results found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Card List */}
      <div className="block md:hidden space-y-3">
            {enrichedHistoryBills.length > 0 ? (
              enrichedHistoryBills.map((bill) => {
                const creator = users.find((u) => u.id === bill.createdBy);
                const bDate = bill.date ? ((bill.date as any).toDate ? (bill.date as any).toDate() : new Date(bill.date)) : null;
                return (
                  <div
                    key={bill.billNo}
                    className="rounded-lg border p-3 shadow-sm bg-card text-card-foreground cursor-pointer active:opacity-70"
                    style={{ minHeight: '80px' }}
                    onDoubleClick={() => handleEditBill(bill.billNo)}
                  >
                    {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && (
                      <div className="flex justify-end mb-1">
                        <Checkbox checked={selectedBills.has(bill.billNo)} onCheckedChange={(checked) => handleSelectBill(bill.billNo, !!checked)} />
                      </div>
                    )}
                    {/* Top Row: Bill No + Date */}
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm">{bill.billNo}</span>
                      <span className="text-xs text-muted-foreground">
                        {bDate ? format(bDate, 'dd-MM-yyyy') : 'N/A'}
                      </span>
                    </div>
                    {/* Customer */}
                    <div className="mt-1 text-sm font-medium">{bill.customerName}</div>
                    {/* Amount Row */}
                    <div className="mt-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">Prev Bal:</span>
                      <span className="font-mono font-semibold">₹{formatINR(bill.prevBalForHistory)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amt:</span>
                      <span className="font-mono">₹{bill.amount.toFixed(2)}</span>
                    </div>
                    {/* Final Balance */}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Final Bal:</span>
                      <span className="font-mono font-semibold">₹{formatINR(bill.computedFinalBalance)}</span>
                    </div>
                    {/* Created By */}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {creator?.username || bill.createdBy}
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

      {/* Sticky Mobile Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-10 h-[72px] border-t bg-background/95 px-4 py-2 md:hidden flex items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground font-semibold uppercase">Total Bal</span>
          <span className="font-mono text-black dark:text-white font-bold">₹{finalBalance.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
        <Button size="lg" className="flex-1 max-w-[150px] btn-save" onClick={handleSaveBill} disabled={!selectedCustomerId || (localBillItems.length === 0 && !activeBillNo) || isSaving}>
        <Save className="mr-2 h-5 w-5" /> {isSaving ? "Saving..." : "Save"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" variant="outline" className="px-3 bg-background border-2 border-border/60 text-black dark:text-white" style={{ zIndex: 20 }}>
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mb-2 w-48">
              <DropdownMenuItem onClick={handleNewBill}><FilePlus className="mr-2 h-4 w-4" /><span>New Bill</span></DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintBill('thermal')}><Printer className="mr-2 h-4 w-4" /><span>Print Receipt</span></DropdownMenuItem>
              {/* TEMP DISABLED: Print A4
              <DropdownMenuItem onClick={() => handlePrintBill('a4')}><Printer className="mr-2 h-4 w-4" /><span>Print A4</span></DropdownMenuItem>
              */}
              <DropdownMenuItem onClick={handlePrint3Inch}><Printer className="mr-2 h-4 w-4" /><span>Print 3-Inch</span></DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareWhatsApp}><Share className="mr-2 h-4 w-4" /><span>Share WhatsApp</span></DropdownMenuItem>
              <DropdownMenuItem onClick={handleSharePDF}><Share className="mr-2 h-4 w-4" /><span>Share (PDF)</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Dialogs */}
      <AlertDialog open={showPrintConfirm} onOpenChange={setShowPrintConfirm}>
      <AlertDialogContent className="modal-overlay pointer-events-auto">
          <AlertDialogHeader><AlertDialogTitle>Confirm Printing</AlertDialogTitle><AlertDialogDescription>Do you want to save this bill before printing?</AlertDialogDescription></AlertDialogHeader>
          <div className="flex flex-col gap-2 pt-2">
          <Button
              className={selectedIndex === 0 ? "ring-2 ring-primary ring-offset-2" : ""}
              onClick={() => handlePrintModalAction('save')}
              disabled={!selectedCustomerId || isSavingAndPrinting}
            >
              {isSavingAndPrinting ? "Saving & Printing..." : "Save & Print"}
            </Button>
            <Button
              variant="outline"
              className={selectedIndex === 1 ? "ring-2 ring-primary ring-offset-2" : ""}
              onClick={() => handlePrintModalAction('printWithoutSave')}
              disabled={isSavingAndPrinting}
            >
              Print Without Saving
            </Button>
            <Button
              variant="ghost"
              className={selectedIndex === 2 ? "ring-2 ring-primary ring-offset-2" : ""}
              onClick={() => handlePrintModalAction('cancel')}
              disabled={isSavingAndPrinting}
            >
              Cancel
            </Button>
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
              let message = `*M.C & SONS FISH COMPANY*\n*BILL SUMMARY*\n\nBill No: ${activeBillNo || 'New'}\nDate: ${format(date || new Date(), 'dd-MM-yyyy')}\nCustomer: ${customerName}\n\n-------------------------\n\n`;
              localBillItems.forEach((item, index) => { message += `${index + 1}. ${item.product} (${item.qty} ${item.uom}) = ₹${Math.round(item.amount)}\n`; });
              message += `\n-------------------------\n\nBill Total: ₹${Math.round(totalAmount)}\nPrevious Balance: ₹${Math.round(staticPrevBalance)}\nFinal Balance: ₹${Math.round(finalBalance)}\n\nThank you!`;
              window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
              setShowWhatsAppShareConfirm(false);
            }}>Open WhatsApp</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWalkInConfirm} onOpenChange={setShowWalkInConfirm}>
        <AlertDialogContent 
          className="outline-none" 
          tabIndex={0} 
          ref={walkInModalRef}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setWalkInSelectedIndex((prev) => (prev + 1) % 3);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setWalkInSelectedIndex((prev) => (prev - 1 + 3) % 3);
            } else if (e.key === "Enter") {
              e.preventDefault();
              handleWalkInSelection(walkInSelectedIndex);
            }
          }}
        >
            <AlertDialogHeader>
                <AlertDialogTitle>Walk-in Customer Confirmation</AlertDialogTitle>
                <AlertDialogDescription>
                    You are about to continue in Walk-in Customer mode.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 pt-2">
                <Button 
                  onClick={() => handleWalkInSelection(0)}
                  className={cn(walkInSelectedIndex === 0 && "bg-blue-600 text-white hover:bg-blue-700")}
                >
                  Continue as Walk-in
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleWalkInSelection(1)}
                  className={cn(walkInSelectedIndex === 1 && "bg-blue-600 text-white hover:bg-blue-700")}
                >
                  Select Customer
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => handleWalkInSelection(2)}
                  className={cn(walkInSelectedIndex === 2 && "bg-blue-600 text-white hover:bg-blue-700")}
                >
                  Cancel
                </Button>
            </div>
        </AlertDialogContent>
      </AlertDialog>
      <style jsx global>{`
      .nav-btn {
        width: 40px;
        padding: 0;
        background-color: hsl(var(--foreground)) !important;
        color: hsl(var(--background)) !important;
        border: none !important;
      }
      .nav-btn:hover:not(:disabled) {
        background-color: var(--btn-save-bg) !important;
        color: white !important;
        opacity: 1;
      }
      .nav-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .section-box {
        border: 2px solid hsl(var(--border));
        border-radius: 12px;
        padding: 16px;
        background-color: hsl(var(--card));
        box-shadow: 0 2px 4px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05);
        transition: border-color 0.2s ease-in-out;
      }
      .section-box:hover {
        border-color: hsl(var(--primary) / 0.5);
      }
    `}</style>
    </div>
  );
}
