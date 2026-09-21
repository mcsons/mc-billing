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
import { PartyBill, PartyBillItem, getPartyItemQty, getPartyItemUom, getPartyBillCashEntries, getPartyBillBankEntries, getPartyBillAmounts } from '@/lib/data';
import { Timestamp } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';

/**
 * Coerces a stored date value into a Date. Handles Firestore Timestamp,
 * serialized {seconds} objects, ISO strings and Date. Returns `fallback` when
 * the value is missing or unparseable, so legacy Party Bills saved before the
 * received-date fields existed never crash and are never back-filled on disk.
 */
const toSafeDate = (value: any, fallback: Date): Date => {
    if (!value) return fallback;
    if (value instanceof Date) return isNaN(value.getTime()) ? fallback : value;
    if (typeof value?.toDate === 'function') {
        const d = value.toDate();
        return isNaN(d.getTime()) ? fallback : d;
    }
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const d = new Date(value);
    return isNaN(d.getTime()) ? fallback : d;
};

/** One editable Cash or Bank row in the form. `amount` is the raw input text. */
type PaymentRow = { id: string; date: Date; amount: string };

const newPaymentRow = (date: Date = new Date(), amount = ''): PaymentRow => ({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    amount,
});

/** Sum of a set of rows; blank / non-numeric amounts count as 0. */
const sumPaymentRows = (rows: PaymentRow[]): number =>
    rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);

/**
 * Stored payment list for a set of rows: zero / blank rows are dropped (so no
 * meaningless entries are saved) and the entered order is preserved.
 */
const toPaymentEntries = (rows: PaymentRow[]) =>
    rows
        .filter(row => (parseFloat(row.amount) || 0) !== 0)
        .map(row => ({ date: Timestamp.fromDate(row.date), amount: parseFloat(row.amount) || 0 }));

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
    
    // Item entry state — quantity + UOM, matching Main Billing's Add Item flow.
    const [rate, setRate] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [qty, setQty] = useState('');
    const [uom, setUom] = useState('KGS');
    // Inline row edit state (double-click to edit an existing line item)
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    // Deductions & Payments
    const [commission, setCommission] = useState('10');
    const [expenses, setExpenses] = useState('');
    const [rent, setRent] = useState('');
    // Advance is a PAYMENT (first row of the paid section), never a deduction.
    const [advance, setAdvance] = useState('');
    // Dated Cash and Bank payments. Each row has its own independent date; the
    // first row of each type is permanent, further rows are added with "+".
    const [cashEntries, setCashEntries] = useState<PaymentRow[]>(() => [newPaymentRow()]);
    const [bankEntries, setBankEntries] = useState<PaymentRow[]>(() => [newPaymentRow()]);
    
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
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const uomSelectRef = useRef<any>(null);
    const mobileQtyRef = useRef<HTMLInputElement>(null);
    const mobileUomSelectRef = useRef<any>(null);
    const mobileRateRef = useRef<HTMLInputElement>(null);

    // Focus the Product dropdown for whichever entry form is visible.
    // The hidden one is display:none, so focus() there is a no-op.
    const focusProductEntry = useCallback(() => {
        productSelectRef.current?.focus();
        mobileProductSelectRef.current?.focus();
    }, []);

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
        setQty('');
        setUom('KGS');
        setCommission('10');
        setExpenses('');
        setAdvance('');
        setRent('');
        // New bill: one empty Cash and one empty Bank row, dated today.
        setCashEntries([newPaymentRow()]);
        setBankEntries([newPaymentRow()]);
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
        advance !== '' ||
        rent !== '' ||
        cashEntries.length > 1 || cashEntries.some(row => row.amount !== '') ||
        bankEntries.length > 1 || bankEntries.some(row => row.amount !== '') ||
        editingBillId !== null ||
        isPrevBalModified,
    [partyId, items, expenses, advance, rent, cashEntries, bankEntries, editingBillId, isPrevBalModified]);

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
                // Bills created before Advance existed simply read as 0. Bills
                // saved while Advance was a deduction load it here, as a payment.
                setAdvance((billToEdit.advance ?? 0).toString());
                // Restore every dated payment. Legacy single-amount bills are
                // converted to one-entry lists in memory (nothing is written).
                // Dates missing on legacy bills fall back to the bill's own
                // date rather than today's — the bill is never silently re-dated.
                const billDateValue = billToEdit.date instanceof Timestamp
                    ? billToEdit.date.toDate()
                    : new Date(billToEdit.date);
                const toRows = (entries: { date: any; amount: number }[], emptyDate: any): PaymentRow[] =>
                    entries.length > 0
                        ? entries.map(entry => newPaymentRow(toSafeDate(entry.date, billDateValue), String(entry.amount)))
                        : [newPaymentRow(toSafeDate(emptyDate, billDateValue))];
                setCashEntries(toRows(getPartyBillCashEntries(billToEdit), billToEdit.cashReceivedDate));
                setBankEntries(toRows(getPartyBillBankEntries(billToEdit), billToEdit.bankReceivedDate));

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
    // Deductions are Commission + Expenses + Rent only. Advance is a payment.
    const totalDeductions = useMemo(() => commissionAmount + (parseFloat(expenses) || 0) + (parseFloat(rent) || 0), [commissionAmount, expenses, rent]);
    const netAmount = useMemo(() => totalAmount - totalDeductions, [totalAmount, totalDeductions]);
    const cashTotal = useMemo(() => sumPaymentRows(cashEntries), [cashEntries]);
    const bankTotal = useMemo(() => sumPaymentRows(bankEntries), [bankEntries]);
    // Total paid = Advance + every Cash entry + every Bank entry. This is the
    // single figure the existing balance chain (finalBalance, partyBalances,
    // statements) already consumes as `totalReceived`.
    const totalReceived = useMemo(() => (parseFloat(advance) || 0) + cashTotal + bankTotal, [advance, cashTotal, bankTotal]);

    /** Payment fields shared by the saved bill and the print/PDF data. */
    const paymentFields = useMemo(() => {
        const cashPayments = toPaymentEntries(cashEntries);
        const bankPayments = toPaymentEntries(bankEntries);
        return {
            advance: parseFloat(advance) || 0,
            cashPayments,
            bankPayments,
            // Kept in sync for anything still reading the single-value fields.
            cashReceived: Number(cashTotal.toFixed(2)),
            bankReceived: Number(bankTotal.toFixed(2)),
            totalReceived,
            cashReceivedDate: cashPayments[0]?.date ?? Timestamp.fromDate(cashEntries[0]?.date ?? new Date()),
            bankReceivedDate: bankPayments[0]?.date ?? Timestamp.fromDate(bankEntries[0]?.date ?? new Date()),
        };
    }, [advance, cashEntries, bankEntries, cashTotal, bankTotal, totalReceived]);
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
    
    // Selected product drives the UOM options, exactly as in Main Billing.
    const selectedProduct = useMemo(
        () => products.find(p => p.id === selectedProductId),
        [products, selectedProductId]
    );

    // Auto-calculated totals from items.
    // New items are aggregated by UOM using the same rule as Main Billing
    // (KGS -> weight, BOX -> box count). Legacy items keep their old meaning:
    // box = box count, box * kgs = weight.
    const calculatedTotalBox = useMemo(() => items.reduce((sum, item) => {
        if (item.qty !== undefined || item.uom !== undefined) {
            return getPartyItemUom(item).toUpperCase() === 'BOX' ? sum + getPartyItemQty(item) : sum;
        }
        return sum + (item.box || 0);
    }, 0), [items]);

    const calculatedTotalKgs = useMemo(() => items.reduce((sum, item) => {
        if (item.qty !== undefined || item.uom !== undefined) {
            return getPartyItemUom(item).toUpperCase() === 'KGS' ? sum + getPartyItemQty(item) : sum;
        }
        return sum + ((item.box || 0) * (item.kgs || 0));
    }, 0), [items]);

    // Clear only the item-entry controls and leave edit mode.
    const clearItemEntry = useCallback(() => {
        setEditingItemId(null);
        setSelectedProductId('');
        setRate('');
        setQty('');
        setUom('KGS');
    }, []);

    // Double-click a line item to load it into the entry controls for editing.
    const handleStartEditItem = useCallback((item: PartyBillItem) => {
        setEditingItemId(item.id);
        setSelectedProductId(item.productId);
        // Legacy items resolve to their box count in BOX, so editing an old
        // row pre-fills correctly without inventing data.
        setQty(getPartyItemQty(item).toString());
        setUom(getPartyItemUom(item));
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
        // Same validation shape as Main Billing: product + qty + rate.
        if (!product || !qty || !rate || !uom) {
            toast({ variant: 'destructive', title: 'Missing Item Info', description: 'Please select a product and enter quantity and rate.' });
            return;
        }
        const rateNum = parseFloat(rate);
        const qtyNum = parseFloat(qty);
        if (!Number.isFinite(qtyNum) || !Number.isFinite(rateNum)) {
            toast({ variant: 'destructive', title: 'Invalid Item Info', description: 'Quantity and rate must be numbers.' });
            return;
        }
        // Amount is strictly Qty x Rate. The UOM only labels the quantity —
        // it never multiplies it.
        const amount = Number((qtyNum * rateNum).toFixed(2));

        // Edit mode: update the selected row in place instead of appending.
        if (editingItemId) {
            setItems(prev => prev.map(item => {
                if (item.id !== editingItemId) return item;
                // Drop the legacy box/kgs fields on edit so the row is stored
                // purely in the new shape.
                const { box: _legacyBox, kgs: _legacyKgs, ...rest } = item;
                return {
                    ...rest,
                    productId: product.id,
                    productName: product.name_en,
                    rate: rateNum,
                    qty: qtyNum,
                    uom: uom,
                    amount: amount,
                };
            }));
            clearItemEntry();
            focusProductEntry();
            return;
        }

        const newItem: PartyBillItem = {
            id: Date.now().toString(),
            productId: product.id,
            productName: product.name_en,
            rate: rateNum,
            qty: qtyNum,
            uom: uom,
            amount: amount,
        };
        setItems(prev => [...prev, newItem]);
        // Reset item form (Main Billing resets qty/rate and defaults UOM back).
        setSelectedProductId('');
        setRate('');
        setQty('');
        setUom('KGS');
        // Return focus to the Product dropdown so the next item can be typed
        // straight away, on both desktop and mobile.
        focusProductEntry();
    };

    const handleItemUpdate = useCallback((itemId: string, field: 'rate' | 'qty', value: string) => {
      setItems(prevItems =>
          prevItems.map(item => {
              if (item.id !== itemId) return item;
              const newValue = parseFloat(value) || 0;
              // Editing a legacy row inline converts it to the new shape,
              // carrying its box count over as the quantity in BOX.
              const currentQty = getPartyItemQty(item);
              const currentUom = getPartyItemUom(item);
              const { box: _legacyBox, kgs: _legacyKgs, ...rest } = item;

              const updatedItem: PartyBillItem = {
                  ...rest,
                  qty: field === 'qty' ? newValue : currentQty,
                  uom: currentUom,
                  rate: field === 'rate' ? newValue : item.rate,
                  amount: 0,
              };
              // Financial amount is strictly Qty x Rate
              updatedItem.amount = Number(((updatedItem.qty ?? 0) * updatedItem.rate).toFixed(2));
              return updatedItem;
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
            ...paymentFields,
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
            ...paymentFields,
            previousBalance: staticPrevBalance,
            totalAfterPrevious,
            finalBalance,
        };
        return data;
    }, [
        partyId, parties, editingBillId, date, items, totalAmount, commission, 
        expenses, rent, paymentFields, previousBalance, netAmount, totalDeductions, finalBalance, totalBox, totalKgs, calculatedTotalBox, calculatedTotalKgs
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

  // ── Dated Cash / Bank payment rows ───────────────────────────────
  // Every update is scoped to one row id, so editing one entry's date or
  // amount never touches another. The first row of each type is permanent
  // (it carries "+"); later rows carry a remove button instead.
  const updatePaymentRow = (
    setRows: React.Dispatch<React.SetStateAction<PaymentRow[]>>,
    id: string,
    patch: Partial<Omit<PaymentRow, 'id'>>,
  ) => setRows(prev => prev.map(row => (row.id === id ? { ...row, ...patch } : row)));

  const addPaymentRow = (setRows: React.Dispatch<React.SetStateAction<PaymentRow[]>>) =>
    setRows(prev => [...prev, newPaymentRow()]);

  const removePaymentRow = (setRows: React.Dispatch<React.SetStateAction<PaymentRow[]>>, id: string) =>
    setRows(prev => (prev.length > 1 ? prev.filter(row => row.id !== id) : prev));

  const renderPaymentRows = (
    label: string,
    rows: PaymentRow[],
    setRows: React.Dispatch<React.SetStateAction<PaymentRow[]>>,
  ) => rows.map((row, index) => (
    <div key={row.id} className="flex flex-wrap justify-between items-center gap-2">
      {index === 0
        ? <Label className="shrink-0">{label}</Label>
        : <span className="shrink-0" aria-hidden="true" />}
      <div className="flex min-w-0 items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-11 w-[120px] shrink-0 justify-start px-2 text-left text-xs font-normal select-none md:h-10"
              onKeyDown={(e) => handleDateKeyDown(e, row.date, (d) => updatePaymentRow(setRows, row.id, { date: d }))}
              onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}
              aria-label={`${label} date ${index + 1}`}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              {format(row.date, 'dd-MM-yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={row.date} onSelect={(d) => updatePaymentRow(setRows, row.id, { date: d || new Date() })} initialFocus />
          </PopoverContent>
        </Popover>
        <Input
          className="h-11 w-32 max-w-32 min-w-0 md:h-10"
          type="number"
          value={row.amount}
          onChange={e => updatePaymentRow(setRows, row.id, { amount: e.target.value })}
          aria-label={`${label} amount ${index + 1}`}
        />
        {index === 0 ? (
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 md:h-10 md:w-10" onClick={() => addPaymentRow(setRows)} aria-label={`Add ${label} entry`}>
            <PlusCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 md:h-10 md:w-10" onClick={() => removePaymentRow(setRows, row.id)} aria-label={`Remove ${label} entry ${index + 1}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  ));

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
                                    <Label className="text-xs text-muted-foreground">Qty</Label>
                                    <Input
                                        type="number"
                                        value={getPartyItemQty(item) || ''}
                                        onChange={(e) => handleItemUpdate(item.id, 'qty', e.target.value)}
                                        className="h-11 w-full text-center font-mono text-base"
                                        placeholder="Qty"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs text-muted-foreground">UOM</Label>
                                    <div className="flex h-11 w-full items-center justify-center rounded-md border bg-muted/50 px-2 font-mono text-base">
                                        {getPartyItemUom(item)}
                                    </div>
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
                            <TableHead className="w-[100px] font-bold text-base text-center">Qty</TableHead>
                            <TableHead className="w-[100px] font-bold text-base text-center">UOM</TableHead>
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
                                      value={getPartyItemQty(item) || ''}
                                      onChange={(e) => handleItemUpdate(item.id, 'qty', e.target.value)}
                                      className="h-8 w-full text-center font-mono text-base"
                                      placeholder="Qty"
                                  />
                                </TableCell>
                                <TableCell className="text-center font-mono text-base">{getPartyItemUom(item)}</TableCell>
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
                                        // Default UOM exactly as Main Billing does it.
                                        if (option) {
                                            const prod = products.find(p => p.id === option.value);
                                            if (prod && prod.uom_allowed.length > 0) {
                                                setUom(prod.uom_allowed.includes('KGS') ? 'KGS' : prod.uom_allowed[0]);
                                            }
                                            setTimeout(() => qtyInputRef.current?.focus(), 0);
                                        }
                                    }}
                                    placeholder="Select Product..."
                                    styles={reactSelectStyles}
                                    menuPortalTarget={isMounted ? document.body : null}
                                    menuPosition='fixed'
                                />
                            </TableCell>
                            <TableCell>
                                <Input
                                    ref={qtyInputRef}
                                    placeholder="0.00"
                                    type="number"
                                    value={qty}
                                    onChange={e => setQty(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); uomSelectRef.current?.focus(); } }}
                                    className="w-full text-center text-base font-mono"
                                />
                            </TableCell>
                            <TableCell>
                                <ReactSelect
                                    ref={uomSelectRef}
                                    instanceId="party-uom-select"
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
                                        if (e.key === 'Tab') setTimeout(() => rateInputRef.current?.focus(), 50);
                                    }}
                                    styles={reactSelectStyles}
                                    tabSelectsValue={true}
                                    openMenuOnFocus={true}
                                    isSearchable={false}
                                    isDisabled={!selectedProductId}
                                    menuPortalTarget={isMounted ? document.body : null}
                                    menuPosition='fixed'
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
                                if (option) {
                                    const prod = products.find(p => p.id === option.value);
                                    if (prod && prod.uom_allowed.length > 0) {
                                        setUom(prod.uom_allowed.includes('KGS') ? 'KGS' : prod.uom_allowed[0]);
                                    }
                                    setTimeout(() => mobileQtyRef.current?.focus(), 0);
                                }
                            }}
                            placeholder="Select Product..."
                            styles={reactSelectStyles}
                            menuPortalTarget={isMounted ? document.body : null}
                            menuPosition='fixed'
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Qty</Label>
                        <Input
                            ref={mobileQtyRef}
                            placeholder="0.00"
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="next"
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); mobileUomSelectRef.current?.focus(); } }}
                            className="h-11 w-full text-center text-base font-mono"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>UOM</Label>
                        <ReactSelect
                            ref={mobileUomSelectRef}
                            instanceId="party-uom-select-mobile"
                            placeholder="UOM"
                            options={(() => {
                                const opts = selectedProduct?.uom_allowed.map((o: string) => ({ value: o, label: o })) || [];
                                return [...opts].sort((a, b) => a.value === 'KGS' ? -1 : b.value === 'KGS' ? 1 : 0);
                            })()}
                            value={uom ? { value: uom, label: uom } : null}
                            onChange={(option: any) => {
                                setUom(option ? option.value : 'KGS');
                                setTimeout(() => mobileRateRef.current?.focus(), 50);
                            }}
                            styles={reactSelectStyles}
                            isSearchable={false}
                            isDisabled={!selectedProductId}
                            menuPortalTarget={isMounted ? document.body : null}
                            menuPosition='fixed'
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
                        {/* Paid: Advance, then every dated Cash and Bank entry. */}
                        <div className="flex justify-between items-center gap-2"><Label>Advance</Label><Input className="h-11 w-32 max-w-32 md:h-10" type="number" value={advance} onChange={e => setAdvance(e.target.value)} /></div>
                        {renderPaymentRows('Cash', cashEntries, setCashEntries)}
                        {renderPaymentRows('Bank / Acc', bankEntries, setBankEntries)}
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
                        // Amount and Paid for THIS bill only, read straight off the bill
                        // document — no per-row payment query. Paid = Advance + all Cash +
                        // all Bank. Older bills are normalised in memory by the helper.
                        const { netAmount: billAmount, totalPaid: paid } = getPartyBillAmounts(bill);

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
                                        <span className="font-mono">{formatINR(billAmount)}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Paid</span>
                                        <span className="font-mono">{formatINR(paid)}</span>
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
                                <TableHead className="text-right">Paid</TableHead>
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
                                // Amount and Paid for THIS bill only, read straight off the bill
                                // document — no per-row payment query. Paid = Advance + all Cash +
                                // all Bank. Older bills are normalised in memory by the helper.
                                const { netAmount: billAmount, totalPaid: paid } = getPartyBillAmounts(bill);

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
                                    <TableCell className="text-right whitespace-nowrap">{formatINR(billAmount)}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap">{formatINR(paid)}</TableCell>
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

