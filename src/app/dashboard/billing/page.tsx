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
  Loader2,
} from 'lucide-react';
import { BillItem, BillPaymentEntry, Customer, LiveBillSummary, Payment } from '@/lib/data';
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
  onSnapshot,
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
  /** Non-zero received payments, shown in the receipt's Received block. */
  payments?: { mode: string; amount: number; date: string }[];
}

/** Received-payment modes offered on Main Billing. */
type PayMode = 'Cash' | 'UPI' | 'Bank' | 'LESS';
const PAY_MODES: PayMode[] = ['Cash', 'UPI', 'Bank', 'LESS'];
/** Stored mode -> dropdown mode. Legacy 'Bill Payment' / missing show as Cash. */
const toPayMode = (m?: string): PayMode =>
  m === 'UPI' ? 'UPI' : m === 'LESS' ? 'LESS' : (m === 'Bank' || m === 'Bank Transfer' || m === 'ACC') ? 'Bank' : 'Cash';
/** An additional received-payment row (row 1 is the existing Paid input). */
interface ExtraPayment {
  key: string;
  date: Date;
  amount: string;
  mode: PayMode;
  paymentId?: string;
  origMode?: string;
}
/** Mode to write: omitted when an existing payment's mode was not changed, so
 *  historical modes (e.g. 'Bill Payment', 'Bank Transfer') are never rewritten. */
const modeToWrite = (mode: PayMode, paymentId?: string, origMode?: string) =>
  paymentId && toPayMode(origMode) === mode ? undefined : mode;
const toJsDate = (v: any): Date | null => {
  if (!v) return null;
  const d = v instanceof Timestamp ? v.toDate() : (typeof v?.toDate === 'function' ? v.toDate() : new Date(v));
  return isNaN(d.getTime()) ? null : d;
};
/** A bill's live linked payments in entry order. */
const linkedPaymentsOf = (payments: Payment[] | undefined, billNo: string) =>
  (payments || [])
    .filter(p => p.linkedBillId === billNo && !p.isDeleted)
    .sort((a, b) => (a.entryIndex ?? 0) - (b.entryIndex ?? 0));

/** Price-card cell: whole rupees without decimals, otherwise 2 decimals. */
const formatPriceCell = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

// INR Currency Formatter Helper
const formatINR = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Products shown in the "Customer Prices" information card under the Customer
 * dropdown on Main Billing. Only the IDs are fixed here — the display names are
 * always read live from the Products data, so renaming a product updates the
 * card automatically.
 */
const CUSTOMER_PRICE_CARD_PRODUCT_IDS = ['002', '004', '037'];

/** How many of the customer's most recent bills to scan for a last-paid BOX rate.
 *  Bounds the Firestore reads for this card (worst case: this many getDocs).
 *  Deeper than a plain "latest purchase" scan because qualifying box-weight
 *  purchases can sit behind several ordinary KGS purchases. */
const CUSTOMER_PRICE_CARD_MAX_BILLS = 30;

/** One box of these products is always exactly this many KGS. */
const KGS_PER_BOX = 35;

/**
 * True when a historical bill item represents a BOX purchase for this card.
 *
 * These three products are always entered in KGS on Main Billing, never as
 * BOX, so a box purchase is identified by weight: the UOM must be KGS and the
 * quantity must be a whole number of 35-KGS boxes (35, 70, 105, 140, ...).
 *
 * Ordinary KGS purchases (10, 11.5, 20, 30) and non-multiples (36, 50, 80) do
 * NOT qualify, so they can never be mistaken for a box rate. The tolerance
 * keeps stored decimals such as 105.00 working without letting 34.99 through.
 */
const isBoxWeightPurchase = (item: { uom?: unknown; qty?: unknown }): boolean => {
  const uom = String(item?.uom ?? '').trim().toUpperCase();
  if (uom !== 'KGS') return false;

  const qty = typeof item?.qty === 'number' ? item.qty : parseFloat(String(item?.qty ?? ''));
  if (!Number.isFinite(qty) || qty < KGS_PER_BOX) return false;

  const boxes = qty / KGS_PER_BOX;
  const wholeBoxes = Math.round(boxes);
  // Reject anything that is not an exact multiple of 35 (within float tolerance).
  return wholeBoxes >= 1 && Math.abs(boxes - wholeBoxes) < 1e-6;
};

/**
 * True when a historical bill item is an ordinary loose-KGS purchase for the
 * card's KGS column: UOM KGS and less than one box (under 35 KGS).
 */
const isLooseKgsPurchase = (item: { uom?: unknown; qty?: unknown }): boolean => {
  const uom = String(item?.uom ?? '').trim().toUpperCase();
  if (uom !== 'KGS') return false;
  const qty = typeof item?.qty === 'number' ? item.qty : parseFloat(String(item?.qty ?? ''));
  return Number.isFinite(qty) && qty > 0 && qty < KGS_PER_BOX;
};

/** Last-paid rates per product for the Customer Prices card. */
type LastPaidRates = { box: Record<string, number>; kgs: Record<string, number> };

/** Product IDs appear both zero-padded ("004") and bare ("4") in existing data,
 *  so compare them numerically when possible. Never mutates stored data. */
const normalizeProductId = (id: unknown): string => {
  const raw = String(id ?? '').trim();
  if (!raw) return '';
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? String(numeric) : raw.toLowerCase();
};

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const d = new Date(value);
  return isNaN(d.getTime()) ? 0 : d.getTime();
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
    getCustomerProductPrice,
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
  /** Prev Bal is read-only until the user ticks the box next to it — guards
   *  against typos in a field that moves the customer's running balance. */
  const [isPrevBalUnlocked, setIsPrevBalUnlocked] = useState(false);
  const [description, setDescription] = useState('');

  // Derived numeric value from input
  const staticPrevBalance = useMemo(() => parseFloat(prevBalInput) || 0, [prevBalInput]);

  /**
   * Ticking the box opens Prev Bal for editing; unticking it puts the loaded
   * balance back and drops the "modified" flag, so an accidental edit can be
   * undone without reloading the bill.
   */
  const handlePrevBalUnlockChange = useCallback((unlocked: boolean) => {
    setIsPrevBalUnlocked(unlocked);
    if (!unlocked) {
      setPrevBalInput(originalPrevBalance.toFixed(2));
      setIsPrevBalModified(false);
    }
  }, [originalPrevBalance]);

  // Form state for new item entry
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [uom, setUom] = useState('KGS');
  const [paidAmount, setPaidAmount] = useState('');
  /** Date the paid amount was received; null = same as the bill date. */
  const [paidDate, setPaidDate] = useState<Date | null>(null);
  /** Mode of the first (existing Paid) payment row, and its stored payment doc. */
  const [paidMode, setPaidMode] = useState<PayMode>('Cash');
  const [paidMeta, setPaidMeta] = useState<{ paymentId?: string; origMode?: string }>({});
  /** Payment rows added with "+". */
  const [extraPayments, setExtraPayments] = useState<ExtraPayment[]>([]);
  /** Total Received = Paid row + every extra row; used wherever Paid was used. */
  const totalReceived = useMemo(
    () => (parseFloat(paidAmount) || 0) + extraPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
    [paidAmount, extraPayments]
  );
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
      extraPayments.length > 0 ||
      deliveryCharge !== '' ||
      activeBillNo !== null ||
      isPrevBalModified ||
      description !== '';
    
    setIsDirty(hasChanges, handleSaveBill);
  }, [selectedCustomerId, localBillItems, qty, rate, paidAmount, extraPayments, deliveryCharge, activeBillNo, isPrevBalModified, description, setIsDirty]);

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
  const desktopBillTableRef = useRef<HTMLDivElement>(null);
  const historyTableBodyRef = useRef<HTMLTableSectionElement>(null);
  const manualCustomerNameRef = useRef<HTMLInputElement>(null);
  const ignoreUrlBillNoRef = useRef<string | null>(null);
  const lastSessionKeyRef = useRef('');
  // Tracks item IDs added in THIS browser session so the realtime listener
  // can distinguish local vs. remote additions.
  const localSessionItemIdsRef = useRef<Set<string>>(new Set());
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
      // Compact rows, same for Customer, Product and UOM lists.
      padding: '8px 12px',
      fontSize: '1.05rem',
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

  /**
   * UI-ONLY: Caps the open dropdown list to ~3 visible rows (~120 px) so that
   * the Customer Prices card below the Customer selector is not hidden when the
   * menu is open. All other behaviour (scrolling, keyboard nav, search, etc.)
   * is unaffected. Only used on the Customer and Product selectors.
   */
  const compact3RowMenuStyles = {
    ...reactSelectStyles,
    menuList: (baseStyles: any) => ({
      ...baseStyles,
      // ~3 rows (≈40 px each) + 8 px top/bottom padding
      maxHeight: '128px',
      overflowY: 'auto' as const,
      WebkitOverflowScrolling: 'touch',
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
    if (workId === lastSessionKeyRef.current) {
      setLoading(false);
      return;
  }
    lastSessionKeyRef.current = workId;

    if (!selectedCustomerId && !billNoFromParams) {
        // Reset state if no context
        setActiveBillNo(null);
        setLocalBillItems([]);
        setPrevBalInput('0.00');
        setIsPrevBalUnlocked(false);
        setDescription('');
        setLoading(false);
        return;
    }

    const initializeSession = async () => {
      try {
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
            {
              // Restore every received payment (amount, date, mode) from the bill's linked payments.
              // Row 1 is the existing Paid input; a single/legacy payment keeps using bill.paidAmount.
              const linked = linkedPaymentsOf(payments, billToLoad.billNo);
              const first = linked[0];
              const billDate = toJsDate(billToLoad.date);
              setPaidAmount(linked.length > 1 ? String(first.amount) : (billToLoad.paidAmount?.toString() || ''));
              const linkedDate = toJsDate(first?.date);
              setPaidDate(linkedDate && !(billDate && isSameDay(linkedDate, billDate)) ? linkedDate : null);
              setPaidMode(toPayMode(first?.paymentMode));
              setPaidMeta({ paymentId: first?.id, origMode: first?.paymentMode });
              setExtraPayments(linked.slice(1).map(p => ({
                key: p.id,
                date: toJsDate(p.date) ?? billDate ?? new Date(),
                amount: String(p.amount),
                mode: toPayMode(p.paymentMode),
                paymentId: p.id,
                origMode: p.paymentMode,
              })));
            }
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
            setIsPrevBalUnlocked(false);

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
            setPaidDate(null);
            setPaidMode('Cash');
            setPaidMeta({});
            setExtraPayments([]);
            setLocalBillItems([]);
            setDescription('');
            // Previous Balance Logic: "Always latest customer balance"
            const prev = selectedCustomerId === 'WALK-IN' ? 0 : (customerBalances[selectedCustomerId] || 0);
            setPrevBalInput(prev.toFixed(2));
            setOriginalPrevBalance(prev);
            setIsPrevBalModified(false);
            setIsPrevBalUnlocked(false);
          } 
        } finally {
          setLoading(false);
        } 
    };

    initializeSession();
  // customerBalances intentionally omitted: the lastSessionKeyRef guard already
  // prevents re-initialization when only balances change, and the async closure
  // captures the current value at the time initializeSession() is called.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, date, searchParams, getBill, findBillForCustomerOnDate, firestore]);

  // ── Realtime concurrent-user listener ──────────────────────────────────
  // Subscribes to billItems of the active bill and merges any external
  // changes (from other logged-in users) into the local view.
  useEffect(() => {
    if (!activeBillNo || !firestore) return;

    const itemsRef = collection(firestore, 'bills', activeBillNo, 'billItems');
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      // Skip the very first snapshot — it's the initial load, not a remote change.
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }

      const remoteItems: BillItem[] = snapshot.docs.map(
        (d) => ({ ...d.data(), id: d.id } as BillItem)
      );

      setLocalBillItems((prev) => {
        // Items added by THIS session are in localSessionItemIdsRef.
        // Remote items are anything NOT in that set.
        const sessionIds = localSessionItemIdsRef.current;

        // Build a map of existing local items by ID for O(1) lookup.
        const localMap = new Map(prev.map((i) => [i.id, i]));

        // Detect truly new items from remote (not known locally at all).
        const brandNewRemote = remoteItems.filter(
          (ri) => !localMap.has(ri.id) && !sessionIds.has(ri.id)
        );

        if (brandNewRemote.length > 0) {
          // Show a toast notification for the external additions.
          toast({
            title: 'Bill updated by another user',
            description: `${brandNewRemote.length} new item${brandNewRemote.length > 1 ? 's' : ''} added.`,
            duration: 4000,
          });
        }

        // Detect items that were deleted remotely (existed locally but
        // are no longer in the remote snapshot AND were NOT added by this session).
        const remoteIds = new Set(remoteItems.map((r) => r.id));
        const survivingLocal = prev.filter(
          (item) => remoteIds.has(item.id) || sessionIds.has(item.id)
        );

        // Merge: start with surviving local items (preserves any unsaved local edits),
        // then append brand-new remote items.
        const merged = [...survivingLocal];
        for (const ri of brandNewRemote) {
          if (!merged.some((m) => m.id === ri.id)) {
            merged.push(ri);
          }
        }

        return merged;
      });
    });

    return () => unsubscribe();
    // NOTE: toast is stable from useToast, no need to list it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBillNo, firestore]);

  // ─────────────────────────────────────────────────────────────────────────
  // Customer Prices information card (below the Customer dropdown).
  // Read-only display: it never changes the rate used by Add Item.
  // ─────────────────────────────────────────────────────────────────────────

  // The customer's most recent bills, taken from the ALREADY-CACHED
  // liveBillSummaries collection — no new listener is created for this card.
  const priceCardBills = useMemo(() => {
    if (!selectedCustomerId || selectedCustomerId === 'WALK-IN') return [];
    return (liveBillSummaries || [])
      .filter((b) => b.customerId === selectedCustomerId && b.billNo)
      .sort((a, b) => toMillis(b.date) - toMillis(a.date))
      .slice(0, CUSTOMER_PRICE_CARD_MAX_BILLS);
  }, [liveBillSummaries, selectedCustomerId]);

  // Signature changes only when this customer's set of recent bills changes,
  // so saving a bill refreshes the card but re-renders do not re-query.
  const priceCardSignature = useMemo(
    () => priceCardBills.map((b) => b.billNo).join(','),
    [priceCardBills]
  );

  const priceCardBillsRef = useRef(priceCardBills);
  priceCardBillsRef.current = priceCardBills;

  // customerId|signature -> last-paid BOX and KGS rates per normalized product id
  const lastPaidRatesCache = useRef<Map<string, LastPaidRates>>(new Map());
  const priceCardRequestRef = useRef(0);

  const [lastPaidRates, setLastPaidRates] = useState<LastPaidRates | null>(null);
  const [isPriceCardLoading, setIsPriceCardLoading] = useState(false);
  const [priceCardError, setPriceCardError] = useState(false);

  useEffect(() => {
    const customerId = selectedCustomerId;

    if (!customerId || customerId === 'WALK-IN' || !firestore) {
      setLastPaidRates(null);
      setIsPriceCardLoading(false);
      setPriceCardError(false);
      return;
    }

    const cacheKey = `${customerId}|${priceCardSignature}`;
    const cached = lastPaidRatesCache.current.get(cacheKey);
    if (cached && cached.box && cached.kgs) {
      setLastPaidRates(cached);
      setIsPriceCardLoading(false);
      setPriceCardError(false);
      return;
    }

    const requestId = ++priceCardRequestRef.current;
    let cancelled = false;
    const isStale = () => cancelled || requestId !== priceCardRequestRef.current;

    setLastPaidRates(null);
    setPriceCardError(false);
    setIsPriceCardLoading(true);

    (async () => {
      try {
        const wanted = new Set(CUSTOMER_PRICE_CARD_PRODUCT_IDS.map(normalizeProductId));
        const found: LastPaidRates = { box: {}, kgs: {} };
        const done = () =>
          Object.keys(found.box).length === wanted.size && Object.keys(found.kgs).length === wanted.size;

        // Newest bill first; stop as soon as every product has both rates.
        for (const bill of priceCardBillsRef.current) {
          if (isStale()) return;
          if (done()) break;

          const snap = await getDocs(
            collection(firestore, 'bills', bill.billNo, 'billItems')
          );
          snap.forEach((d) => {
            const item = d.data() as BillItem;
            const key = normalizeProductId(item?.productId);
            if (!wanted.has(key)) return;
            // BOX column: whole-box KGS purchases (35, 70, 105 ...) — unchanged rule.
            // KGS column: ordinary purchases under 35 KGS.
            // First hit wins for each column because bills are walked newest-first.
            const target = isBoxWeightPurchase(item) ? found.box : isLooseKgsPurchase(item) ? found.kgs : null;
            if (!target || target[key] !== undefined) return;
            // Use the rate stored on the historical item — never derived
            // from amount/qty and never scaled by the number of boxes.
            const rate =
              typeof item?.rate === 'number' ? item.rate : parseFloat(String(item?.rate ?? ''));
            if (Number.isFinite(rate)) target[key] = rate;
          });
        }

        if (isStale()) return;
        lastPaidRatesCache.current.set(cacheKey, found);
        setLastPaidRates(found);
      } catch (err) {
        console.error('Customer price card: could not read previous prices', err);
        if (isStale()) return;
        // Billing stays fully usable; the card falls back to configured prices.
        setPriceCardError(true);
        setLastPaidRates({ box: {}, kgs: {} });
      } finally {
        if (!cancelled && requestId === priceCardRequestRef.current) {
          setIsPriceCardLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId, priceCardSignature, firestore]);

  // Each column: last paid rate (BOX: whole-box purchase, KGS: under 35 KGS)
  //   -> customer-specific price -> default price.
  const customerPriceRows = useMemo(() => {
    if (!selectedCustomerId || selectedCustomerId === 'WALK-IN') return [];

    return CUSTOMER_PRICE_CARD_PRODUCT_IDS.map((targetId) => {
      const key = normalizeProductId(targetId);
      const product = products.find((p) => normalizeProductId(p.id) === key);
      if (!product) return null;

      const uoms = product.uom_allowed || [];
      const priceMap = productPrices[product.id] || {};

      // Configured fallback (customer price, then default), preferring `prefer` UOM.
      const configuredPrice = (prefer?: string): number | null => {
        const order = prefer ? [prefer, ...uoms.filter((u) => u !== prefer)] : uoms;
        for (const u of order) {
          const c = getCustomerProductPrice(selectedCustomerId, product.id, u);
          if (c !== undefined && c !== null) return c;
        }
        for (const u of order) {
          if (priceMap[u] !== undefined && priceMap[u] !== null) return priceMap[u];
        }
        const anyDefault = Object.values(priceMap).find((v) => typeof v === 'number');
        return anyDefault !== undefined ? (anyDefault as number) : null;
      };

      // `?.` on box/kgs too: tolerates older cached data without those maps.
      const box = lastPaidRates?.box?.[key] ?? configuredPrice();
      const kgs = lastPaidRates?.kgs?.[key] ?? configuredPrice('KGS');
      return { id: product.id, name: product.name_en, kgs, box };
    }).filter(Boolean) as {
      id: string;
      name: string;
      kgs: number | null;
      box: number | null;
    }[];
  }, [selectedCustomerId, products, lastPaidRates, getCustomerProductPrice, productPrices]);

  const showCustomerPriceCard =
    !!selectedCustomerId && selectedCustomerId !== 'WALK-IN' && customerPriceRows.length > 0;

  useEffect(() => {
    if (isEditingRef.current) {
      return;
    }
    if (selectedProductId && uom) {
      // 1. Try customer-specific price first
      const custPrice =
        selectedCustomerId && selectedCustomerId !== 'WALK-IN'
          ? getCustomerProductPrice(selectedCustomerId, selectedProductId, uom)
          : undefined;
      if (custPrice !== undefined && custPrice !== null) {
        setRate(custPrice.toString());
        return;
      }
      // 2. Fall back to default product price
      const defaultPrice = productPrices[selectedProductId]?.[uom];
      if (defaultPrice !== undefined && defaultPrice !== null) {
        setRate(defaultPrice.toString());
      } else {
        setRate('1');
      }
    } else {
      setRate('');
    }
  }, [selectedProductId, uom, selectedCustomerId, productPrices, getCustomerProductPrice]);

  useEffect(() => {
    if (localBillItems.length === 0) return;
    // Use a tiny timeout so the DOM has painted the new row before we scroll
    const timer = setTimeout(() => {
      // Mobile container
      if (billItemsContainerRef.current) {
        const mobileLastRow = billItemsContainerRef.current.querySelector('[data-last-item]');
        if (mobileLastRow) {
          mobileLastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          billItemsContainerRef.current.scrollTo({ top: billItemsContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
      }
      // Desktop container
      if (desktopBillTableRef.current) {
        const desktopLastRow = desktopBillTableRef.current.querySelector('[data-last-item]');
        if (desktopLastRow) {
          desktopLastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          desktopBillTableRef.current.scrollTo({ top: desktopBillTableRef.current.scrollHeight, behavior: 'smooth' });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
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

    const addNow = () => {
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

    // Register this item as session-local so the realtime listener
    // won't treat it as a remote addition when Firestore echoes it back.
    localSessionItemIdsRef.current.add(newItem.id);
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
    };

    // Boxes are counted in whole numbers: a decimal BOX qty is almost always
    // a KGS entry with the wrong unit picked, so ask before adding it.
    if (uom.toUpperCase() === 'BOX' && !Number.isInteger(qtyNum)) {
      showAlertDialog({
        title: 'Decimal quantity in BOX?',
        description: `${qty} BOX for ${productInfo.name_ta}. Did you mean KGS?`,
        showClose: true,
        // Answers to "Did you mean KGS?": Yes -> switch to KGS, No -> keep BOX.
        confirmText: 'No, add as BOX',
        cancelText: 'Yes, change to KGS',
        onConfirm: addNow,
        onCancel: () => setUom('KGS'),
      });
      return;
    }

    addNow();
  }, [selectedProductId, qty, rate, uom, currentUser, products, activeBillNo, toast, showAlertDialog]);

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
    localSessionItemIdsRef.current = new Set(); // clear session tracking for fresh bill
    
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
    setPaidDate(null);
    setPaidMode('Cash');
    setPaidMeta({});
    setExtraPayments([]);
    setDeliveryCharge('');
    setInitialBillTotal(0);
    setWalkInConfirmed(false);
    setLocalBillItems([]);
    setPrevBalInput('0.00');
    setOriginalPrevBalance(0);
    setIsPrevBalModified(false);
    setIsPrevBalUnlocked(false);
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
    const paidAmountNum = totalReceived;
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
        stall: '1',
        payments: [
          { mode: paidMode, amount: parseFloat(paidAmount) || 0, date: (paidDate ?? date ?? new Date()).toISOString() },
          ...extraPayments.map(p => ({ mode: p.mode, amount: parseFloat(p.amount) || 0, date: p.date.toISOString() })),
        ].filter(p => p.amount > 0),
    };
  }, [customers, selectedCustomerId, localBillItems, activeBillNo, deliveryCharge, paidAmount, paidDate, paidMode, extraPayments, totalReceived, staticPrevBalance, date, manualCustomerName]);

  // ── Billing Guard: sync unsaved state & expose save callback ─────────
  const hasUnsavedChanges = useMemo(() => {
    return (
      selectedCustomerId !== '' ||
      (localBillItems && localBillItems.length > 0) ||
      qty !== '' ||
      rate !== '' ||
      paidAmount !== '' ||
      extraPayments.length > 0 ||
      deliveryCharge !== '' ||
      description !== '' ||
      activeBillNo !== null ||
      isPrevBalModified
    );
  }, [selectedCustomerId, localBillItems, qty, rate, paidAmount, extraPayments, deliveryCharge, description, activeBillNo, isPrevBalModified]);

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

    // Received payments: every filled amount must be a valid non-negative number.
    const badPayment = [paidAmount, ...extraPayments.map(p => p.amount)].some(a => {
      if (a.trim() === '') return false;
      const n = Number(a);
      return !isFinite(n) || n < 0;
    }) || extraPayments.some(p => isNaN(p.date.getTime()));
    if (badPayment) {
      toast({ variant: 'destructive', title: 'Invalid Payment', description: 'Payment amounts must be valid non-negative numbers with a valid date.' });
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

    /// Merge-safe save: only delete items that the current user explicitly
    // removed locally. Items added by other concurrent users are preserved.
    if (activeBillNo && firestore) {
      try {
        const itemsSnap = await getDocs(collection(firestore, 'bills', activeBillNo, 'billItems'));
        const localItemIds = new Set(localBillItems.map((i) => i.id));
        const deleteBatch = writeBatch(firestore);
        let hasDeletes = false;
        itemsSnap.forEach((d) => {
          // Only delete if the item is NOT in the current local list.
          if (!localItemIds.has(d.id)) {
            deleteBatch.delete(d.ref);
            hasDeletes = true;
          }
        });
        if (hasDeletes) await deleteBatch.commit();
      } catch (e) { console.error('Item selective delete error:', e); }
    }

    const billSummary = {
      customerName: customer ? `${customer.name_en} (${customer.name_ta})` : (manualCustomerName || '--'),
      customerId: selectedCustomerId || 'WALK-IN',
      stall: '1',
      createdBy: activeBillNo ? getBill(activeBillNo)?.createdBy : undefined,
      description: description,
      prevBalance: staticPrevBalance,
    };

    const parsedPaid = totalReceived;
    const parsedDelivery = parseFloat(deliveryCharge) || 0;
    const itemsTotal = localBillItems.reduce((sum, item) => sum + item.amount, 0);
    const finalBalanceCalc = staticPrevBalance + itemsTotal + parsedDelivery - parsedPaid;
    
    const billDateForSave = date || new Date();
    const paymentEntries: BillPaymentEntry[] = [
      {
        paymentId: paidMeta.paymentId,
        amount: parseFloat(paidAmount) || 0,
        date: paidDate ?? billDateForSave,
        mode: modeToWrite(paidMode, paidMeta.paymentId, paidMeta.origMode),
      },
      ...extraPayments.map(p => ({
        paymentId: p.paymentId,
        amount: parseFloat(p.amount) || 0,
        date: p.date,
        mode: modeToWrite(p.mode, p.paymentId, p.origMode),
      })),
    ];

    const { billNo, commitPromise, paymentIds } = createOrUpdateLiveBill(
      billSummary,
      localBillItems,
      totalReceived,
      parseFloat(deliveryCharge) || 0,
      billDateForSave,
      activeBillNo,
      undefined,
      paidDate ?? undefined,
      paymentEntries
    );

    try {
      await commitPromise;
      // Remember the saved payment docs so a later save of this same bill
      // updates them instead of creating new ones.
      if (paymentIds) {
        const writtenMode = (e: BillPaymentEntry, old?: string) => e.mode ?? old;
        setPaidMeta(m => ({ paymentId: paymentIds[0], origMode: paymentIds[0] ? writtenMode(paymentEntries[0], m.origMode) : undefined }));
        setExtraPayments(rows => rows.map((r, i) => ({
          ...r,
          paymentId: paymentIds[i + 1],
          origMode: paymentIds[i + 1] ? writtenMode(paymentEntries[i + 1], r.origMode) : undefined,
        })));
      }
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
    // NOTE: intentionally NOT calling performReset() — sharing is read-only,
    // the user should be able to continue editing the same bill after sharing.
    sessionStorage.setItem('billPrintData', JSON.stringify(savedData));
    window.open(`/print/bill?paper=a4&share=pdf`, '_blank');
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
    const billsToRestore: { summary: LiveBillSummary, items: BillItem[], paymentEntries?: BillPaymentEntry[] }[] = [];
    try {
      for (const billNo of selectedBills) {
        const summary = liveBillSummaries.find(b => b.billNo === billNo);
        if (summary && firestore) {
          const itemsSnap = await getDocs(collection(firestore, 'bills', billNo, 'billItems'));
          const items = itemsSnap.docs.map(d => ({ ...d.data(), id: d.id } as BillItem));
          // Bills with several received payments restore each one (amount, date, mode).
          const linked = linkedPaymentsOf(payments, billNo);
          const paymentEntries = linked.length > 1
            ? linked.map(p => ({ amount: p.amount, date: toJsDate(p.date) ?? new Date(), mode: p.paymentMode || 'Cash' }))
            : undefined;
          billsToRestore.push({ summary, items, paymentEntries });
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
                  data.summary.billNo,
                  undefined,
                  undefined,
                  data.paymentEntries
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

  const handleEditBill = async (billNo: string) => {
    setLoading(true, 'Loading Bill...');
    if (searchParams.get('billNo') === billNo) {
        setTimeout(() => setLoading(false), 300);
        return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    router.push(`/dashboard/billing?billNo=${billNo}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearHistorySearch = () => {
    setHistoryDate(undefined);
    setHistorySelectedCustomer('');
    setHistorySearchText('');
  };

  /** Small date button used by each received-payment row. */
  const renderDatePicker = (effective: Date, highlighted: boolean, onPick: (d: Date) => void, buttonClass = '') => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-10 px-3 text-sm font-mono font-normal select-none lg:h-11 lg:px-4 lg:text-base', highlighted && 'border-amber-500 font-bold', buttonClass)}
          title="Date the payment was received"
          aria-label="Payment date"
        >
          <CalendarIcon className="mr-1.5 h-4 w-4 shrink-0" />
          {format(effective, 'dd-MM-yy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={effective}
          onSelect={(d) => { if (d) onPick(d); }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );

  /** Small date button beside "Paid": the date the paid amount was received. */
  const renderPaidDatePicker = (buttonClass: string) =>
    renderDatePicker(
      paidDate ?? date ?? new Date(),
      !!paidDate,
      // Picking the bill date itself means "no separate paid date".
      (d) => setPaidDate(date && isSameDay(d, date) ? null : d),
      buttonClass
    );

  /** Cash / UPI / Bank dropdown of a payment row. */
  const renderModeSelect = (value: PayMode, onChange: (m: PayMode) => void) => (
    <select
      aria-label="Payment mode"
      title="Payment mode"
      value={value}
      onChange={(e) => onChange(e.target.value as PayMode)}
      className="h-10 rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground focus:outline-none focus:ring-1 focus:ring-ring lg:h-11 lg:px-3 lg:text-base"
    >
      {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  );

  const addPaymentRow = () =>
    setExtraPayments(rows => [...rows, { key: `new-${Date.now()}-${rows.length}`, date: new Date(), amount: '', mode: 'Cash' }]);
  const updatePaymentRow = (key: string, patch: Partial<ExtraPayment>) =>
    setExtraPayments(rows => rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const removePaymentRow = (key: string) =>
    setExtraPayments(rows => rows.filter(r => r.key !== key));

  const renderAddPaymentButton = () => (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 lg:h-10 lg:w-10" onClick={addPaymentRow} title="Add another payment" aria-label="Add another payment">
      <PlusCircle className="h-4 w-4 lg:h-5 lg:w-5" />
    </Button>
  );

  /** The rows added with "+": [date][mode][remove] | amount, in the same two-column grid. */
  const renderExtraPaymentRows = (labelClass: string, inputClass: string, labelSpacer = false) => (
    <>
      {extraPayments.map(p => (
        <React.Fragment key={p.key}>
          <span className={labelClass}>
            {renderDatePicker(p.date, false, (d) => updatePaymentRow(p.key, { date: d }))}
            {renderModeSelect(p.mode, (m) => updatePaymentRow(p.key, { mode: m }))}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:text-destructive lg:h-10 lg:w-10" onClick={() => removePaymentRow(p.key)} title="Remove payment" aria-label="Remove payment">
              <Trash2 className="h-4 w-4" />
            </Button>
            {/* Invisible "Paid:" keeps the controls aligned under the Paid row. */}
            {labelSpacer && <span className="invisible" aria-hidden="true">Paid:</span>}
          </span>
          <Input
            className={inputClass}
            inputMode="decimal"
            value={p.amount}
            onChange={(e) => updatePaymentRow(p.key, { amount: e.target.value })}
            onFocus={(e) => e.target.select()}
            aria-label="Payment amount"
          />
        </React.Fragment>
      ))}
    </>
  );

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
        return;
    }
    // A customer is already chosen, so focus is legitimately on the product
    // field: scroll the Add Item row up to the bottom of the viewport. That
    // keeps Product / Qty / UOM / Rate in view while the Current Bill items
    // and totals on the right stay visible above them. The
    // delay lets the browser's own focus scroll and react-select's menu
    // opening settle first, otherwise this scroll gets undone.
    if (typeof window === 'undefined') return;
    setTimeout(() => {
        document.getElementById('product-section')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 120);
  };

  const itemsTotal = useMemo(() => localBillItems.reduce((sum, item) => sum + item.amount, 0), [localBillItems]);
  const totalAmount = itemsTotal + (parseFloat(deliveryCharge) || 0);
  const finalBalance = staticPrevBalance + totalAmount - totalReceived;

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
    /* Desktop (lg+): one fixed screen, POS style — left column: top bar, add-item row,
       items table (scrolls inside), description; right column: totals + buttons, then
       a compact bill search list (scrolls inside). Phones/tablets keep the stacked layout. */
    <div className="billing-root flex flex-col gap-8 pb-32 md:pb-8 max-w-full lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(460px,1fr)] lg:gap-3 lg:pb-0" onKeyDown={handleGlobalTab}>
      <div className="grid auto-rows-max items-start gap-4 lg:flex lg:flex-col lg:items-stretch lg:min-h-0 lg:gap-3">
      <div className="grid auto-rows-max gap-4 section-box lg:contents">
        <Card className="border-none shadow-none bg-transparent lg:order-1 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(18rem,1.25fr)] lg:items-center lg:gap-x-4 lg:gap-y-2 lg:rounded-xl lg:border-2 lg:border-solid lg:border-border lg:bg-card lg:px-3 lg:py-2">
          <CardHeader className="flex flex-col items-start gap-4 md:flex-row md:items-start md:justify-between pb-2 lg:contents lg:space-y-0">
              <div className="lg:col-start-1 lg:row-start-1">
                <CardTitle className="font-headline lg:text-xl lg:whitespace-nowrap">
                  {activeBillNo ? `Editing Bill ${activeBillNo}` : 'Create Bill'}
                </CardTitle>
                <CardDescription className="lg:hidden">Manage active transaction.</CardDescription>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:items-end lg:contents">
                <div className="grid gap-1 lg:col-start-2 lg:row-start-1">
                  <Label className="text-xs text-muted-foreground lg:hidden">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                  <Button variant={'outline'}  className={cn('w-full justify-start text-left font-normal h-[44px] md:w-[240px] lg:w-[145px] lg:h-10 select-none', !date && 'text-muted-foreground')}
                         onFocus={() => { if(!date) setDate(new Date()) }} 
                         onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }} 
                         onKeyDown={(e) => handleDateKeyDown(e, date, (d) => {
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
                </div>
                <Button variant="outline" className="w-full md:w-auto h-[44px] lg:h-10 lg:col-start-2 lg:row-start-2 lg:w-full" onClick={handleNewBill}>
                  <FilePlus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 lg:contents">
              <div className="grid gap-2 lg:contents">
                <Label htmlFor="customer" className="lg:hidden">Customer</Label>
                <ReactSelect
                  className="lg:col-start-1 lg:row-start-2 lg:min-w-0"
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
                  styles={compact3RowMenuStyles}
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
                  <div className="mt-2 grid gap-1.5 lg:col-start-1 lg:row-start-3 lg:mt-0">
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

                {/* Customer Prices — read-only info panel, does not affect Add Item */}
                {showCustomerPriceCard && (
                  <div className="mt-2 w-full max-w-full min-w-0 rounded-md border bg-muted/40 px-3 py-2 lg:col-start-3 lg:row-start-1 lg:row-span-3 lg:self-stretch lg:mt-0 lg:max-h-[9.5rem] lg:overflow-y-auto lg:px-4 lg:py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Customer Prices
                      </p>
                      {isPriceCardLoading && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    {isPriceCardLoading ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Loading previous prices...
                      </p>
                    ) : (
                      <>
                        <table className="mt-1.5 w-full border-collapse text-sm lg:mt-1 lg:text-base">
                          <thead>
                            <tr className="text-xs font-semibold uppercase text-muted-foreground lg:text-sm">
                              <th className="pb-0.5 text-left font-semibold">Product</th>
                              <th className="w-[5.5rem] pb-0.5 text-right font-semibold">KGS</th>
                              <th className="w-[5.5rem] pb-0.5 text-right font-semibold">BOX</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerPriceRows.map((row) => (
                              <tr key={row.id}>
                                <td className="min-w-0 break-words py-0.5 pr-2 font-medium">{row.name}</td>
                                <td className="py-0.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                                  {row.kgs !== null ? `₹${formatPriceCell(row.kgs)}` : '—'}
                                </td>
                                <td className="py-0.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                                  {row.box !== null ? `₹${formatPriceCell(row.box)}` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {priceCardError && (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Showing configured prices — previous bills could not be read.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card id="product-section" className="border-none shadow-none bg-transparent mt-4 pt-4 border-t scroll-mt-4 scroll-mb-40 md:scroll-mb-28 lg:order-2 lg:mt-0 lg:rounded-xl lg:border-2 lg:border-solid lg:border-border lg:bg-card lg:px-3 lg:py-2">
            <CardHeader className="pb-2 lg:hidden"><CardTitle className="font-headline text-lg">Add Item</CardTitle></CardHeader>
            <CardContent className="p-4 md:p-6 lg:p-0">
            <div className="flex flex-wrap md:flex-nowrap items-end gap-2">
              <div className="grid gap-1.5 w-full md:w-auto md:flex-1 min-w-0" onClick={handleProductSelectInteraction}>
                  <Label htmlFor="product" className="text-xs lg:text-sm">Product</Label>
                  <ReactSelect
                    instanceId="product-select"
                    placeholder="Select product..."
                    isClearable
                    tabSelectsValue={true}
                    openMenuOnFocus={true}
                    options={products.map((p) => ({ value: p.id, label: `${p.name_en} (${p.name_ta})` }))}
                    value={products.find(p => p.id === selectedProductId) ? { value: selectedProductId, label: products.find(p => p.id === selectedProductId)?.name_en + ' (' + products.find(p => p.id === selectedProductId)?.name_ta + ')' } : null}
                    onChange={(option) => {
                      if (!option) {
                        setSelectedProductId('');
                        setRate('');
                        isEditingRef.current = false;
                        return;
                      }
                      setSelectedProductId(option.value);
                      const product = products.find(p => p.id === option.value);
                      if (product && product.uom_allowed.length > 0) setUom(product.uom_allowed.includes('KGS') ? 'KGS' : product.uom_allowed[0]);
                      setTimeout(() => qtyInputRef.current?.focus(), 0);
                    }}
                    styles={compact3RowMenuStyles}
                    ref={productSelectRef}
                    onFocus={handleProductSelectInteraction}
                  />
                </div>
                <div className="grid gap-1.5 flex-1 md:flex-none md:w-[80px] shrink-0 min-w-[60px]">
                  <Label htmlFor="qty" className="text-xs lg:text-sm">Qty</Label>
                  <Input id="qty" type="number" placeholder="0.00" value={qty} onChange={(e) => setQty(e.target.value)} ref={qtyInputRef} onKeyDown={handleQtyKeyDown} className="h-11 px-2 text-center" />
                </div>
                <div className="grid gap-1.5 flex-1 md:flex-none shrink-0 min-w-[80px]">
                  <Label className="text-xs lg:text-sm">UOM</Label>
                  <ReactSelect
                    ref={uomSelectRef}
                    instanceId="uom-select"
                    placeholder="UOM"
                    options={(() => {
                      const opts = selectedProduct?.uom_allowed.map((o: string) => ({ value: o, label: o })) || [];
                      return [...opts].sort((a, b) => a.value === 'KGS' ? -1 : b.value === 'KGS' ? 1 : 0);
                    })()}
                    value={uom ? { value: uom, label: uom } : null}
                    onChange={(option: any) => {
                      setUom(option ? option.value : 'KGS');
                      setTimeout(() => rateInputRef.current?.focus(), 50);
                    }}
                    onKeyDown={(e: any) => {
                      if (e.key === 'Tab') {
                        setTimeout(() => rateInputRef.current?.focus(), 50);
                      }
                    }}
                    styles={reactSelectStyles}
                    tabSelectsValue={true}
                    openMenuOnFocus={true}
                    isSearchable={false}
                    isDisabled={!selectedProductId}
                  />
                </div>
                <div className="grid gap-1.5 flex-1 md:flex-none md:w-[72px] shrink-0 min-w-[60px]">
                  <Label htmlFor="rate" className="text-xs lg:text-sm">Rate</Label>
                  <Input
                    id="rate"
                    type="number"
                    placeholder="0.00"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    ref={rateInputRef}
                    onKeyDown={handleRateKeyDown}
                    onFocus={(e) => e.target.select()}
                    className="h-11 px-2 text-right"
                  />
                </div>
                <div className="shrink-0 self-end">
                  <Button onClick={handleAddItem} className="h-11 w-11 p-0 flex items-center justify-center">
                    <PlusCircle className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:order-4 lg:shrink-0 lg:border-2">
            <CardHeader className="pb-2 lg:hidden">
              <CardTitle className="text-lg font-headline">Description (optional)</CardTitle>
            </CardHeader>
            <CardContent className="lg:p-2">
              <Textarea
                className="min-h-[70px] w-full resize-none text-sm lg:min-h-0 lg:h-10 lg:py-2"
                placeholder="Enter notes (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:order-3 lg:flex lg:flex-1 lg:min-h-0 lg:flex-col">
          <Card className="section-box lg:flex lg:flex-1 lg:min-h-0 lg:flex-col lg:!p-0 lg:overflow-hidden">
            <CardHeader className="pb-2 lg:hidden">
              <CardTitle className="font-headline">Current Bill</CardTitle>
              <CardDescription className="truncate">{selectedCustomerId === 'WALK-IN' ? 'Items added for Walk-in Customer.' : selectedCustomerId ? `Items added for ${customers.find(c => c.id === selectedCustomerId)?.name_en}.` : 'No customer selected.'}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 lg:flex lg:flex-1 lg:min-h-0 lg:flex-col">
              {/* Mobile Card List */}
              <div ref={billItemsContainerRef} className="block md:hidden border-t max-h-[300px] overflow-y-auto">
                {isItemsLoading ? (
                  <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
                ) : localBillItems.length > 0 ? (
                  <div className="divide-y">
                    {localBillItems.map((item, index) => (
                      <div
                        key={item.id}
                        data-last-item={index === localBillItems.length - 1 ? 'true' : undefined}
                        className="p-3 bg-card hover:bg-muted/40 active:bg-muted/70"
                        onDoubleClick={() => {
                          isEditingRef.current = true;
                          setSelectedProductId(item.productId);
                          setQty(item.qty.toString());
                          setUom(item.uom);
                          setRate(item.rate.toString());
                          setLocalBillItems(prev => prev.filter(i => i.id !== item.id));
                          setTimeout(() => productSelectRef.current?.focus(), 50);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-sm flex-1 pr-2">{item.product}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive shrink-0 -mt-1 -mr-1" onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground block">Qty ({item.uom})</span>
                            <Input
                              type="number"
                              defaultValue={item.qty}
                              onBlur={(e) => persistItemUpdate(item.id, 'qty', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="h-8 text-center font-mono text-sm px-1 mt-0.5"
                            />
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Rate</span>
                            <Input
                              type="number"
                              defaultValue={item.rate}
                              onBlur={(e) => persistItemUpdate(item.id, 'rate', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="h-8 text-right font-mono text-sm px-1 mt-0.5"
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Amount</span>
                            <span className="font-mono font-semibold text-sm block mt-1.5">₹{item.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">No items added.</div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block border-t overflow-x-auto lg:border-t-0 lg:flex lg:flex-1 lg:min-h-0 lg:flex-col">
                <div ref={desktopBillTableRef} className="max-h-[240px] overflow-y-auto live-bill-container lg:max-h-none lg:flex-1 lg:min-h-0">
                  <Table className="min-w-[650px] lg:min-w-[560px] table-fixed border-collapse">
                    {/* Cream header row (items table). */}
                    <TableHeader className="bg-[#F5E9D0] lg:sticky lg:top-0 lg:z-10 [&_th]:!text-[#3B2A14]">
                      <TableRow className="bg-[#F5E9D0] hover:bg-[#F5E9D0] border-b border-[#E3D3B0]">
                        <TableHead className="w-[45px] px-1 text-center font-bold text-sm lg:text-base uppercase">S/N</TableHead>
                        <TableHead className="px-1 text-left font-bold text-sm lg:text-base uppercase">Product</TableHead>
                        <TableHead className="w-[60px] px-1 text-center font-bold text-sm lg:text-base uppercase">UOM</TableHead>
                        <TableHead className="w-[100px] px-1 text-center font-bold text-sm lg:text-base uppercase">Qty</TableHead>
                        <TableHead className="w-[120px] px-1 text-right font-bold text-sm lg:text-base uppercase">Rate</TableHead>
                        <TableHead className="w-[130px] px-1 text-right font-bold text-sm lg:text-base uppercase">Amt</TableHead>
                        <TableHead className="w-[45px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TooltipProvider delayDuration={200}>
                        {isItemsLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow> : localBillItems.length > 0 ? (
                          localBillItems.map((item, index) => {
                            const creator = users.find((u) => u.id === item.addedBy);
                            const username = creator?.username || item.addedBy || 'Unknown';
                            const isLast = index === localBillItems.length - 1;
                            return (
                              <TableRow key={item.id} data-last-item={isLast ? 'true' : undefined} className="h-14 hover:bg-muted/50 border-b relative" onDoubleClick={() => {
                                isEditingRef.current = true;
                                setSelectedProductId(item.productId);
                                setQty(item.qty.toString());
                                setUom(item.uom);
                                setRate(item.rate.toString());
                                setLocalBillItems(prev => prev.filter(i => i.id !== item.id));
                                setTimeout(() => productSelectRef.current?.focus(), 50);
                              }}>
                                <TableCell className="px-1 text-center text-muted-foreground lg:text-base">{index + 1}</TableCell>
                                <TableCell className="px-1 max-w-[120px]">
                                  <Tooltip key={item.id}>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-default block w-full whitespace-normal break-words text-base lg:text-lg leading-normal">{item.product}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p>Created by: {username}</p></TooltipContent>
                                  </Tooltip>
                                </TableCell>
                                <TableCell className="px-1 text-center lg:text-base">{item.uom}</TableCell>
                                <TableCell className="px-1"><Input type="number" defaultValue={item.qty} onBlur={(e) => persistItemUpdate(item.id, 'qty', e.target.value)} onFocus={(e) => e.target.select()} className="mx-auto h-10 w-[90px] text-center font-mono text-base lg:h-11 lg:text-lg px-1" /></TableCell>
                                <TableCell className="px-1 text-right"><Input type="number" defaultValue={item.rate} onBlur={(e) => persistItemUpdate(item.id, 'rate', e.target.value)} onFocus={(e) => e.target.select()} className="ml-auto h-10 w-[110px] text-right font-mono text-base lg:h-11 lg:text-lg px-1" /></TableCell>
                                <TableCell className="px-1 text-right font-mono font-semibold text-base lg:text-lg whitespace-nowrap">{item.amount.toFixed(2)}</TableCell>
                                <TableCell className="px-1 text-right"><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                              </TableRow>
                            );
                          })
                        ) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground lg:text-lg">No items.</TableCell></TableRow>}
                      </TooltipProvider>
                    </TableBody>
                  </Table>
                </div>
              </div>

            </CardContent>
              
              {localBillItems.length > 0 && (
                <div className="total-qty-ui text-right px-4 pt-3 pb-1 text-sm lg:shrink-0 lg:border-t lg:py-2" style={{ fontWeight: 500, color: '#9ca3af' }}>
                  <span>Total Qty →</span>
                  <span className="text-foreground">
                    {totalKgs > 0 ? `${totalKgs.toFixed(1)} KGS` : ''}
                    {totalKgs > 0 && totalBox > 0 ? ', ' : ''}
                    {totalBox > 0 ? `${Math.round(totalBox)} BOX` : ''}
                  </span>
                </div>
              )}
          </Card>
        </div>
      </div>

      {/* Right column (desktop): totals + buttons, then bill search. */}
      <div className="flex flex-col gap-8 lg:min-h-0 lg:gap-3">
          <Card className="section-box lg:shrink-0 lg:!px-5 lg:!py-5">
              <CardFooter className="flex flex-col items-stretch gap-2 p-0 sm:items-end">
                {/* Mobile totals — compact two-column grid, full width */}
                <div className="w-full md:hidden rounded-lg bg-muted/40 border p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-sm">
                    <span className="font-medium text-muted-foreground">Items Total</span>
                    <span className="font-mono font-semibold text-right">₹{itemsTotal.toFixed(2)}</span>

                    <span className="font-medium text-muted-foreground flex items-center">Delivery</span>
                    <Input className="h-10 text-right font-mono text-base px-2 border-primary/20" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} onFocus={(e) => e.target.select()} />

                    <span className="font-medium text-muted-foreground">Bill Total</span>
                    <span className="font-mono font-bold text-right">₹{totalAmount.toFixed(2)}</span>

                    <span className="font-medium text-muted-foreground flex items-center gap-2">
                      <Checkbox
                        id="prev-bal-unlock-mobile"
                        className="h-4 w-4 rounded-full shrink-0"
                        checked={isPrevBalUnlocked}
                        onCheckedChange={(c) => handlePrevBalUnlockChange(c === true)}
                        disabled={!canEditBalances}
                        aria-label="Allow editing previous balance"
                      />
                      <label htmlFor="prev-bal-unlock-mobile" className="cursor-pointer select-none">Prev Bal</label>
                    </span>
                    <Input
                      className={cn(
                        "h-10 text-right font-mono text-base px-2 border-primary/20",
                        isPrevBalModified && "bg-amber-50 dark:bg-amber-950/30 border-amber-500 font-bold",
                        !isPrevBalUnlocked && "bg-muted text-muted-foreground"
                      )}
                      value={prevBalInput}
                      onChange={(e) => { setPrevBalInput(e.target.value); setIsPrevBalModified(true); }}
                      onFocus={(e) => e.target.select()}
                      readOnly={!isPrevBalUnlocked}
                      tabIndex={isPrevBalUnlocked ? undefined : -1}
                      disabled={!canEditBalances}
                    />

                    <span className="font-medium text-muted-foreground flex flex-wrap items-center gap-2">Paid {renderPaidDatePicker('')}{renderModeSelect(paidMode, setPaidMode)}{renderAddPaymentButton()}</span>
                    <Input className="h-10 text-right font-mono text-base px-2 border-primary/20" value={paidAmount} onChange={(e) => e.target.value === '' ? setPaidAmount('') : setPaidAmount(e.target.value)} onFocus={(e) => e.target.select()} />
                    {renderExtraPaymentRows('flex flex-wrap items-center gap-2', 'h-10 text-right font-mono text-base px-2 border-primary/20')}
                    {extraPayments.length > 0 && (
                      <>
                        <span className="font-medium text-muted-foreground">Total Received</span>
                        <span className="font-mono font-bold text-right">₹{formatINR(totalReceived)}</span>
                      </>
                    )}

                    <span className="font-semibold text-base border-t pt-3">Balance</span>
                    <span className="font-mono font-bold text-right text-base text-primary border-t pt-3">₹{finalBalance.toFixed(2)}</span>
                  </div>
                </div>
                {/* Desktop totals — unchanged */}
                <div className="hidden md:grid w-full grid-cols-[minmax(0,1fr)_minmax(8rem,auto)] gap-x-4 gap-y-1 self-end text-right text-base md:text-lg lg:text-xl lg:gap-x-4 lg:gap-y-2.5">
                  <span className="font-semibold">Items Total:</span><span className="font-mono">₹{formatINR(itemsTotal)}</span>
                  <span className="font-semibold">Delivery:</span><Input className="ml-auto max-w-40 h-9 md:h-10 lg:h-11 lg:text-lg text-right font-mono" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} onFocus={(e) => e.target.select()} />
                  <span className="font-semibold">Bill Total:</span><span className="font-mono font-bold">₹{formatINR(totalAmount)}</span>
                  <span className="font-semibold flex items-center justify-end gap-2">
                    <Checkbox
                      id="prev-bal-unlock"
                      className="h-4 w-4 rounded-full shrink-0"
                      checked={isPrevBalUnlocked}
                      onCheckedChange={(c) => handlePrevBalUnlockChange(c === true)}
                      disabled={!canEditBalances}
                      aria-label="Allow editing previous balance"
                    />
                    <label htmlFor="prev-bal-unlock" className="cursor-pointer select-none">Prev Bal:</label>
                  </span>
                  <Input 
                    className={cn(
                      "ml-auto max-w-40 h-9 md:h-10 lg:h-11 lg:text-lg text-right font-mono",
                      isPrevBalModified && "bg-amber-50 dark:bg-amber-950/30 border-amber-500 font-bold",
                      !isPrevBalUnlocked && "bg-muted text-muted-foreground"
                    )} 
                    value={prevBalInput} 
                    onChange={(e) => {
                      setPrevBalInput(e.target.value);
                      setIsPrevBalModified(true);
                    }} 
                    onFocus={(e) => e.target.select()}
                    readOnly={!isPrevBalUnlocked}
                    tabIndex={isPrevBalUnlocked ? undefined : -1}
                    disabled={!canEditBalances}
                  />
                  <span className="font-semibold flex flex-wrap items-center justify-end gap-2">{renderPaidDatePicker('')}{renderModeSelect(paidMode, setPaidMode)}{renderAddPaymentButton()}Paid:</span><Input className="ml-auto max-w-40 h-9 md:h-10 lg:h-11 lg:text-lg text-right font-mono" value={paidAmount} onChange={(e) => e.target.value === '' ? setPaidAmount('') : setPaidAmount(e.target.value)} onFocus={(e) => e.target.select()} />
                  {extraPayments.length > 0 && (
                    <>
                      {renderExtraPaymentRows('font-semibold flex flex-wrap items-center justify-end gap-2', 'ml-auto max-w-40 h-9 md:h-10 lg:h-11 lg:text-lg text-right font-mono', true)}
                      <span className="font-semibold">Total Received:</span>
                      <span className="font-mono font-bold">₹{formatINR(totalReceived)}</span>
                    </>
                  )}
                  <span className="font-semibold text-lg lg:text-2xl pt-1">Balance:</span>
                  <span className={cn(
                    "font-mono font-bold text-xl md:text-2xl lg:text-[2.1rem] lg:leading-tight pt-1",
                    finalBalance >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"
                  )}>
                    ₹{formatINR(finalBalance)}
                  </span>
                </div>

                {/* Desktop/tablet buttons, one right-aligned row:
                    << < Save | Print 4' | Print 3' > >> Share (bill PDF to WhatsApp).
                    On a very narrow panel the row may wrap rather than overflow. */}
                <div className="hidden md:flex flex-wrap items-center justify-end gap-2 lg:gap-1.5 lg:mt-2 [&_.nav-btn]:min-w-[3rem] lg:[&_button]:h-11 lg:[&_button]:text-base">
                  <Button variant="outline" className="nav-btn lg:px-4" onClick={goToFirstBillOfDay} disabled={sortedBills.length === 0}>{"<<"}</Button>
                  <Button variant="outline" className="nav-btn lg:px-4" onClick={() => {
                    if (currentBillIndex === -1 && sortedBills.length > 0) {
                      router.push(`/dashboard/billing?billNo=${sortedBills[0].billNo}`);
                    } else if (currentBillIndex >= 0 && currentBillIndex < sortedBills.length - 1) {
                      router.push(`/dashboard/billing?billNo=${sortedBills[currentBillIndex + 1].billNo}`);
                    }
                  }} disabled={sortedBills.length === 0 || currentBillIndex >= sortedBills.length - 1}>{"<"}</Button>
                  <Button id="save-bill-btn" size="lg" className="btn-save lg:h-10 lg:px-4" onClick={handleSaveBill} disabled={!selectedCustomerId || isSaving}><Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save"}</Button>
                  <Button className="lg:px-3" onClick={() => handlePrintBill('thermal')} disabled={!selectedCustomerId}>Print 4&apos;</Button>
                  {/* TEMP DISABLED
                  <Button className="btn-print" onClick={() => handlePrintBill('a4')} disabled={!selectedCustomerId}>Print A4</Button>
                  */}
                  <Button className="lg:px-3 bg-blue-600 text-white font-semibold hover:bg-blue-500 focus-visible:ring-blue-400" onClick={handlePrint3Inch} disabled={!selectedCustomerId}>Print 3&apos;</Button>
                  <Button variant="outline" className="nav-btn lg:px-4" onClick={() => {
                    if (currentBillIndex > 0) {
                      router.push(`/dashboard/billing?billNo=${sortedBills[currentBillIndex - 1].billNo}`);
                    } else if (currentBillIndex === 0) {
                      router.push(`/dashboard/billing`);
                    }
                  }} disabled={currentBillIndex === -1}>{">"}</Button>
                  <Button variant="outline" className="nav-btn lg:px-4" onClick={goToLastBillOfDay} disabled={sortedBills.length === 0}>{">>"}</Button>
                  <Button
                    variant="outline"
                    onClick={handleSharePDF}
                    disabled={!selectedCustomerId}
                    title="Share bill PDF on WhatsApp"
                    className="lg:px-3 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                  >
                    <Share className="mr-2 h-4 w-4" /> Share
                  </Button>
                </div>
              </CardFooter>
          </Card>

      <Separator className="lg:hidden" />

      <Card className="max-w-full overflow-hidden section-box lg:flex lg:flex-1 lg:min-h-0 lg:flex-col lg:!p-3">
        <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between lg:p-0 lg:pb-0 lg:gap-2">
          <div className="lg:hidden">
            <CardTitle className="font-headline text-xl md:text-2xl lg:text-base">Bill History</CardTitle>
            <CardDescription className="lg:hidden">Search and view past bills. Double-click or Enter to load for editing.</CardDescription>
          </div>
          {selectedBills.size > 0 && (currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && (
            <Button variant="destructive" onClick={handleDeleteSelected}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedBills.size})
            </Button>
          )}
        </CardHeader>
        <CardContent className="lg:flex lg:flex-1 lg:min-h-0 lg:flex-col lg:p-0">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end lg:mb-2 lg:flex-wrap lg:gap-2">
            <div className="grid flex-1 gap-2 lg:basis-full lg:gap-1">
              <Label className="lg:hidden">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or bill no..."
                  className="pl-9 h-11 md:h-10 lg:h-10 lg:text-base"
                  value={historySearchText}
                  onChange={(e) => setHistorySearchText(e.target.value)}
                />
              </div>
            </div>
            <div className="grid flex-1 gap-2 lg:min-w-0 lg:gap-1">
              <Label className="lg:hidden">Customer Filter</Label>
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
            <div className="grid gap-2 lg:gap-1">
              <Label className="lg:hidden">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                <Button variant={'outline'} className={cn('w-full sm:w-[240px] lg:w-[150px] lg:text-base justify-start text-left font-normal select-none', !historyDate && 'text-muted-foreground')} onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }} onKeyDown={(e) => handleDateKeyDown(e, historyDate, setHistoryDate as (d: Date | undefined) => void)}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {historyDate ? format(historyDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} initialFocus /></PopoverContent>
              </Popover>
            </div>
            <Button variant="ghost" onClick={handleClearHistorySearch} className="h-11 md:h-10 lg:px-2" title="Clear filters"><X className="mr-2 h-4 w-4 lg:mr-0" /><span className="lg:hidden">Clear</span></Button>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-md border lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
            <Table className="w-full table-fixed text-sm">
              <TableHeader className="lg:sticky lg:top-0 lg:z-10 lg:bg-muted">
                <TableRow className="bg-muted/50 border-b border-border">
                  {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
                    <TableHead className="w-[40px] text-center px-[10px] py-[12px] text-[14px] lg:text-base font-semibold text-muted-foreground"></TableHead>
                  )}
                  <TableHead className="w-[90px] lg:w-[80px] px-[10px] lg:px-2 py-[12px] lg:py-2 text-[14px] lg:text-base font-semibold text-muted-foreground">Bill No</TableHead>
                  <TableHead className="w-[150px] lg:w-[108px] px-[10px] lg:px-2 py-[12px] lg:py-2 text-[14px] lg:text-base font-semibold text-muted-foreground">Date</TableHead>
                  <TableHead className="px-[10px] py-[12px] text-[14px] lg:text-base font-semibold text-muted-foreground">Customer</TableHead>
                  <TableHead className="w-32 px-4 text-right lg:hidden">Prev Bal</TableHead>
                  <TableHead className="w-[130px] lg:w-[124px] text-right px-[10px] lg:px-2 py-[12px] lg:py-2 text-[14px] lg:text-base font-semibold text-muted-foreground">Amt</TableHead>
                  <TableHead className="w-[150px] text-right px-[10px] py-[12px] text-[14px] lg:text-base font-semibold text-muted-foreground lg:hidden">Final Bal</TableHead>
                  <TableHead className="w-[120px] px-[10px] py-[12px] text-[14px] lg:text-base font-semibold text-muted-foreground lg:hidden">Created By</TableHead>
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
                        <TableCell className="px-[10px] lg:px-2 py-[12px] lg:py-1.5 text-[14px] lg:text-base font-semibold text-foreground truncate">{bill.billNo}</TableCell>
                        <TableCell className="px-[10px] lg:px-2 py-[12px] lg:py-1.5 text-[14px] lg:text-base text-foreground truncate">{bDate ? format(bDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                        <TableCell className="px-[10px] lg:px-2 py-[12px] lg:py-1.5 text-[14px] lg:text-base text-foreground truncate">{bill.customerName}</TableCell>
                        <TableCell className="px-4 text-right font-mono font-bold whitespace-nowrap lg:hidden">₹{formatINR(bill.prevBalForHistory)}</TableCell>
                        <TableCell className="text-right px-[10px] lg:px-2 py-[12px] lg:py-1.5 text-[14px] lg:text-base font-medium text-foreground font-mono">₹{formatINR(bill.amount)}</TableCell>
                        <TableCell className="text-right px-[10px] py-[12px] text-[14px] lg:text-base font-bold text-foreground font-mono lg:hidden">
                        {`₹${formatINR(bill.computedFinalBalance)}`}
                      </TableCell>
                        <TableCell className="px-[10px] py-[12px] text-[14px] lg:text-base text-muted-foreground truncate lg:hidden">{creator?.username || bill.createdBy || '--'}</TableCell>
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
      /* Desktop billing screen is laid out for ~800px of screen height. On shorter
         screens (small laptops, 125-150% Windows scaling) the whole billing area is
         scaled down in fixed steps, so it looks the same on every PC and always fits
         one screen. Height is divided by the same factor so it still fills the screen
         exactly (3.5rem = the dashboard header above it). */
      @media (min-width: 1024px) {
        .billing-root { --bz: 1; zoom: var(--bz); height: calc((100vh - 3.5rem) / var(--bz)); }
      }
      @media (min-width: 1024px) and (max-height: 799px) { .billing-root { --bz: 0.92; } }
      @media (min-width: 1024px) and (max-height: 719px) { .billing-root { --bz: 0.84; } }
      @media (min-width: 1024px) and (max-height: 639px) { .billing-root { --bz: 0.76; } }
      @media (min-width: 1024px) and (max-height: 559px) { .billing-root { --bz: 0.7; } }
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
