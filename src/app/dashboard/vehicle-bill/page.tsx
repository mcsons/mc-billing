'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Calendar as CalendarIcon,
  FilePlus,
  Save,
  Printer,
  Trash2,
  Search,
  X,
  PlusCircle,
  MinusCircle,
  Share,
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
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useLoading } from '@/context/LoadingContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { useNavigationGuard } from '@/context/NavigationGuardContext';
import ReactSelect from 'react-select';
import { VehicleBill, VehicleStatementTransaction } from '@/lib/data';
import { Timestamp } from 'firebase/firestore';

export default function VehicleBillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();
  const { setIsDirty } = useNavigationGuard();
  const { setLoading } = useLoading();
  const [isSaving, setIsSaving] = useState(false);

  const {
    vehicles,
    drivers,
    parties,
    vehicleBills,
    currentUser,
    addOrUpdateVehicleBill,
    deleteVehicleBill,
  } = useData();

  // Form state
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [vehicleId, setVehicleId] = useState('');
  const [driverIds, setDriverIds] = useState<string[]>(['']);
  const [partyId, setPartyId] = useState('');
  const [destination, setDestination] = useState('');
  const [advance, setAdvance] = useState('');
  const [expenses, setExpenses] = useState('');
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  
  // Track unsaved changes
  useEffect(() => {
    const hasChanges = 
        vehicleId !== '' || 
        driverIds.some(id => id !== '') || 
        partyId !== '' || 
        destination !== '' || 
        advance !== '' || 
        expenses !== '';
    
    setIsDirty(hasChanges, handleSaveBill);
  }, [vehicleId, driverIds, partyId, destination, advance, expenses, setIsDirty]);

  // History state
  const [historyDate, setHistoryDate] = useState<Date | undefined>();
  const [historyVehicleId, setHistoryVehicleId] = useState('');
  const [historyDriverId, setHistoryDriverId] = useState('');
  const [filteredBills, setFilteredBills] = useState<VehicleBill[]>([]);

  // Statement State
  const [statementType, setStatementType] = useState<'Vehicle' | 'Driver' | ''>('');
  const [statementId, setStatementId] = useState('');
  const [statementFromDate, setStatementFromDate] = useState<Date | undefined>();
  const [statementToDate, setStatementToDate] = useState<Date | undefined>();

  // WhatsApp share state
  const [showWhatsAppShareConfirm, setShowWhatsAppShareConfirm] = useState(false);

  const vehicleSelectRef = useRef<any>(null);

  useEffect(() => {
    vehicleSelectRef.current?.focus();
  }, []);


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

  // Load bill for editing from URL param
  useEffect(() => {
    const billIdFromParams = searchParams.get('billId');
    if (billIdFromParams) {
      const billToEdit = vehicleBills.find(b => b.id === billIdFromParams);
      if (billToEdit) {
        setEditingBillId(billToEdit.id);
        setDate(billToEdit.date instanceof Timestamp ? billToEdit.date.toDate() : new Date(billToEdit.date));
        setVehicleId(billToEdit.vehicleId);
        setDriverIds(billToEdit.driverIds || ['']);
        setPartyId(billToEdit.partyId);
        setDestination(billToEdit.destination);
        setAdvance(billToEdit.advance.toString());
        setExpenses(billToEdit.expenses.toString());
      }
    }
  }, [searchParams, vehicleBills]);

  useEffect(() => {
    setFilteredBills(vehicleBills.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()));
  }, [vehicleBills]);

  const handleNewBill = () => {
    setEditingBillId(null);
    setDate(new Date());
    setVehicleId('');
    setDriverIds(['']);
    setPartyId('');
    setDestination('');
    setAdvance('');
    setExpenses('');
    setIsDirty(false);
    router.replace('/dashboard/vehicle-bill');
    vehicleSelectRef.current?.focus();
  };

  const handleSaveBill = async () => {
    if (isSaving) return null; // 🔒 prevents duplicate saves
    const validDriverIds = driverIds.filter(id => id);
    if (!date || !vehicleId || validDriverIds.length === 0 || !partyId || !currentUser) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill out Date, Vehicle, Driver, and Party.'});
      return null;
    }

    const selectedDrivers = drivers.filter(d => validDriverIds.includes(d.id));
    const party = parties.find(p => p.id === partyId);

    if (selectedDrivers.length !== validDriverIds.length || !party) {
        toast({ variant: 'destructive', title: 'Invalid Selection', description: 'Selected driver or party not found.' });
        return null;
    }

    const billData: Omit<VehicleBill, 'id' | 'createdBy'|'createdAt'|'updatedAt'> = {
      date,
      vehicleId,
      driverIds: validDriverIds,
      driverNames: selectedDrivers.map(d => d.name),
      partyId,
      partyName: party.name,
      destination,
      advance: parseFloat(advance) || 0,
      expenses: parseFloat(expenses) || 0,
    };
    
    try {
        setIsSaving(true);
        setLoading(true, 'Saving vehicle bill...');
        const savedBill = await addOrUpdateVehicleBill(billData, editingBillId || undefined);
        if (savedBill) {
            toast({ title: editingBillId ? 'Bill Updated' : 'Bill Saved', description: `Vehicle bill for ${vehicleId} has been saved.`});
            setIsDirty(false); // Mark as clean
            if (!editingBillId) {
                setEditingBillId(savedBill.id);
                router.replace(`/dashboard/vehicle-bill?billId=${savedBill.id}`, { scroll: false });
            }
        }
        return savedBill;
    } catch(e) {
        console.error('Vehicle bill save error:', e);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the vehicle bill.' });
        return null;
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  const handlePrintBill = (billToPrint: VehicleBill) => {
    if (!billToPrint) return;
    const encodedData = encodeURIComponent(JSON.stringify(billToPrint));
    window.open(`/print/vehicle-bill?data=${encodedData}&paper=a4`, '_blank');
  };

  const handleSaveAndPrint = async () => {
    if (isSaving) return; // 🔒 prevents duplicate saves
    const savedBill = await handleSaveBill();
    if (savedBill) {
      handlePrintBill(savedBill);
    }
  };
  
  const handleDirectPrint = () => {
    if (!editingBillId) {
        toast({ variant: 'destructive', title: 'No Bill Loaded', description: 'Please load a bill from history to print it.' });
        return;
    }
    const billToPrint = vehicleBills.find(b => b.id === editingBillId);
    if (billToPrint) {
        handlePrintBill(billToPrint);
    } else {
        toast({ variant: 'destructive', title: 'Bill Not Found', description: 'Could not find the bill to print.' });
    }
  };

  const handleShareWhatsApp = async () => {
    const validDriverIds = driverIds.filter(id => id);
    if (!date || !vehicleId || validDriverIds.length === 0 || !partyId) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill out all required fields first.'});
        return;
    }
    
    setShowWhatsAppShareConfirm(true);
  };

  const confirmOpenWhatsApp = () => {
    const party = parties.find(p => p.id === partyId);
    const selectedDrivers = drivers.filter(d => driverIds.includes(d.id));
    const driverNames = selectedDrivers.map(d => d.name).join(', ');
    const formattedDate = format(date || new Date(), 'dd-MM-yyyy');
    
    const adv = parseFloat(advance) || 0;
    const exp = parseFloat(expenses) || 0;
    const bal = adv - exp;

    let message = `*M.C & SONS FISH COMPANY*\n`;
    message += `*VEHICLE BILL SUMMARY*\n`;
    message += `Date: ${formattedDate}\n`;
    message += `Vehicle No: ${vehicleId}\n`;
    message += `Party: ${party?.name || ''}\n`;
    message += `Driver: ${driverNames}\n`;
    message += `Destination: ${destination}\n`;
    message += `-------------------------\n`;
    message += `Advance Amt: ₹${adv.toFixed(2)}\n`;
    message += `Expenses: ₹${exp.toFixed(2)}\n`;
    message += `-------------------------\n`;
    message += `*Balance: ₹${bal.toFixed(2)}*\n`;
    message += `-------------------------\n`;
    message += `Thank you!`;

    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
    setShowWhatsAppShareConfirm(false);
  };


  const handleEditFromHistory = (bill: VehicleBill) => {
    router.push(`/dashboard/vehicle-bill?billId=${bill.id}`);
  };

  const handleDeleteFromHistory = (bill: VehicleBill) => {
    showAlertDialog({
        title: 'Delete Vehicle Bill?',
        description: `Are you sure you want to delete the bill for vehicle ${bill.vehicleId} on ${bill.date instanceof Timestamp ? format(bill.date.toDate(), 'PPP') : 'this date'}?`,
        onConfirm: async () => {
            let undoClicked = false;
            await deleteVehicleBill(bill.id);
            toast({
              title: "Bill removed",
              description: "Undo is available for 10 seconds.",
              duration: 10000,
              action: (
                <ToastAction altText="Undo" onClick={() => {
                  undoClicked = true;
                  addOrUpdateVehicleBill(bill, bill.id);
                  toast({ title: "Vehicle bill restored" });
                }}>Undo</ToastAction>
              )
            });

            setTimeout(() => {
              if (!undoClicked) {
                toast({
                  title: "Vehicle Bill Deleted",
                  description: `The vehicle bill for ${bill.vehicleId} has been permanently deleted.`
                });
              }
            }, 10500);
        },
    });
  };

  const handleSearchHistory = () => {
    let results = vehicleBills;
    if (historyDate) {
        results = results.filter(b => b.date && isSameDay(b.date.toDate(), historyDate));
    }
    if (historyVehicleId) {
        results = results.filter(b => b.vehicleId === historyVehicleId);
    }
    if (historyDriverId) {
        results = results.filter(b => b.driverIds && b.driverIds.includes(historyDriverId));
    }
    setFilteredBills(results.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()));
  };

  const handleClearHistorySearch = () => {
    setHistoryDate(undefined);
    setHistoryVehicleId('');
    setHistoryDriverId('');
    setFilteredBills(vehicleBills.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()));
  };

  const handlePrintStatement = () => {
    if (!statementType || !statementId || !statementFromDate || !statementToDate) {
        toast({ variant: 'destructive', title: 'Missing Info', description: 'Please select a type, an item, and a date range.' });
        return;
    }

    let transactions: VehicleBill[] = [];
    let name = '';
    
    if (statementType === 'Vehicle') {
        transactions = vehicleBills.filter(b => b.vehicleId === statementId);
        name = vehicles.find(v => v.id === statementId)?.name || statementId;
    } else if (statementType === 'Driver') {
        transactions = vehicleBills.filter(b => b.driverIds && b.driverIds.includes(statementId));
        name = drivers.find(d => d.id === statementId)?.name || statementId;
    }

    const fromDateStart = startOfDay(statementFromDate);
    const toDateEnd = endOfDay(statementToDate);

    const filteredTransactions = transactions.filter(t => {
        const tDate = t.date.toDate();
        return tDate >= fromDateStart && tDate <= toDateEnd;
    }).sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
    
    // For this simple statement, we assume opening balance is 0
    let balance = 0;
    const statementTransactions: VehicleStatementTransaction[] = filteredTransactions.map(t => {
        balance = balance + t.advance - t.expenses;
        return {
            date: t.date.toDate(),
            description: `${t.destination} (Party: ${t.partyName})`,
            advance: t.advance,
            expenses: t.expenses,
            balance: balance,
        };
    });

    const printData = {
        type: statementType,
        name: name,
        id: statementId,
        transactions: statementTransactions,
        openingBalance: 0,
        dateRange: { from: statementFromDate.toISOString(), to: statementToDate.toISOString() },
    };

    const encodedData = encodeURIComponent(JSON.stringify(printData));
    window.open(`/print/vehicle-statement?data=${encodedData}&paper=a4`, '_blank');
};


  const activeVehicles = useMemo(() => vehicles.filter(v => v.active), [vehicles]);
  const activeDrivers = useMemo(() => drivers.filter(d => d.active), [drivers]);
  const activeParties = useMemo(() => (parties || []).filter(p => p.active), [parties]);

  const balance = useMemo(() => (parseFloat(advance) || 0) - (parseFloat(expenses) || 0), [advance, expenses]);
  
  const statementOptions = useMemo(() => {
    if (statementType === 'Vehicle') return vehicles.map(v => ({ value: v.id, label: `${v.id} (${v.name})` }));
    if (statementType === 'Driver') return drivers.map(d => ({ value: d.id, label: d.name }));
    return [];
  }, [statementType, vehicles, drivers]);

  const handleDriverChange = (index: number, selectedId: string) => {
    const newDriverIds = [...driverIds];
    newDriverIds[index] = selectedId;
    setDriverIds(newDriverIds);
  };

  const addDriverSlot = () => {
    if (driverIds.length < 3) {
      setDriverIds([...driverIds, '']);
    }
  };

  const removeDriverSlot = (index: number) => {
    if (driverIds.length > 1) {
      const newDriverIds = [...driverIds];
      newDriverIds.splice(index, 1);
      setDriverIds(newDriverIds);
    }
  };


  return (
    <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <CardTitle className="font-headline">
              {editingBillId ? `Editing Bill ${editingBillId.slice(0,5)}...` : 'Create Vehicle Bill'}
            </CardTitle>
            <CardDescription>
              Enter details for vehicle trips, expenses, and advances.
            </CardDescription>
          </div>
          <div className="flex flex-col items-stretch sm:items-end w-full sm:w-auto gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={'outline'} className={cn('w-full sm:w-[240px] justify-start text-left font-normal', !date && 'text-muted-foreground')} onFocus={() => { if(!date) setDate(new Date()) }} onKeyDown={(e) => handleDateKeyDown(e, date, setDate)}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={handleNewBill}>
              <FilePlus className="mr-2 h-4 w-4" />
              New Bill
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                 <div className="grid gap-2">
                    <Label htmlFor="vehicle">Vehicle Number</Label>
                    <ReactSelect
                        ref={vehicleSelectRef}
                        instanceId="vehicle-select"
                        options={activeVehicles.map(v => ({ value: v.id, label: `${v.id}` }))}
                        value={activeVehicles.map(v => ({ value: v.id, label: v.id })).find(v => v.value === vehicleId) || null}
                        onChange={(option) => setVehicleId(option ? option.value : '')}
                        placeholder="Select vehicle..."
                        isClearable
                        styles={reactSelectStyles}
                    />
                </div>
                 <div className="grid gap-2">
                    <Label>Driver Name(s)</Label>
                    <div className="space-y-2">
                      {driverIds.map((id, index) => {
                         const availableDrivers = activeDrivers.filter(
                          (d) => !driverIds.filter((_, i) => i !== index).includes(d.id)
                        );
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <ReactSelect
                                className="flex-1"
                                instanceId={`driver-select-${index}`}
                                options={availableDrivers.map(d => ({ value: d.id, label: d.name }))}
                                value={availableDrivers.map(d => ({ value: d.id, label: d.name })).find(d => d.value === id) || null}
                                onChange={(option) => handleDriverChange(index, option ? option.value : '')}
                                placeholder={`Select driver ${index + 1}...`}
                                isClearable
                                styles={reactSelectStyles}
                            />
                             {driverIds.length > 1 && (
                                <Button variant="ghost" size="icon" onClick={() => removeDriverSlot(index)}>
                                    <MinusCircle className="text-destructive"/>
                                </Button>
                            )}
                            {index === driverIds.length - 1 && driverIds.length < 3 && (
                                <Button variant="ghost" size="icon" onClick={addDriverSlot}>
                                    <PlusCircle className="text-primary"/>
                                </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="party">Party Name</Label>
                    <ReactSelect
                        instanceId="party-select"
                        options={activeParties.map(p => ({ value: p.id, label: p.name }))}
                        value={activeParties.map(p => ({ value: p.id, label: p.name })).find(p => p.value === partyId) || null}
                        onChange={(option) => setPartyId(option ? option.value : '')}
                        placeholder="Select party..."
                        isClearable
                        styles={reactSelectStyles}
                    />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="destination">Destination</Label>
                    <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="advance">Advance (₹)</Label>
                    <Input id="advance" type="number" value={advance} onChange={(e) => setAdvance(e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="expenses">Expenses (₹)</Label>
                    <Input id="expenses" type="number" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
                </div>
            </div>
             <div className="mt-6 border-t pt-4">
                <Label>Balance (₹)</Label>
                <p className="text-2xl font-bold font-mono">₹{balance.toFixed(2)}</p>
            </div>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
            <Button size="lg" variant="outline" onClick={handleSaveBill} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save Bill"}
            </Button>
            <Button size="lg" variant="secondary" onClick={handleDirectPrint} disabled={!editingBillId}>
                <Printer className="mr-2 h-4 w-4" /> Print Bill
            </Button>
            <Button size="lg" onClick={handleSaveAndPrint} disabled={isSaving}>
                <Printer className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save & Print"}
            </Button>
            <Button size="lg" variant="outline" onClick={handleShareWhatsApp}>
                <Share className="mr-2 h-4 w-4" /> Share
            </Button>
        </CardFooter>
      </Card>

      <div className="grid auto-rows-max items-start gap-8 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
            <CardHeader>
                <CardTitle className="font-headline">Vehicle Bill History</CardTitle>
                <CardDescription>Search and manage previous vehicle bills.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 items-end gap-4">
                    <div className="grid gap-2">
                        <Label>Vehicle</Label>
                        <ReactSelect
                            options={vehicles.map(v => ({ value: v.id, label: `${v.id} (${v.name})`}))}
                            value={vehicles.map(v => ({ value: v.id, label: `${v.id} (${v.name})`})).find(v => v.value === historyVehicleId) || null}
                            onChange={(o) => setHistoryVehicleId(o ? o.value : '')}
                            isClearable
                            placeholder="Filter by vehicle..."
                            styles={reactSelectStyles}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Driver</Label>
                        <ReactSelect
                            options={drivers.map(d => ({ value: d.id, label: d.name}))}
                            value={drivers.map(d => ({ value: d.id, label: d.name})).find(d => d.value === historyDriverId) || null}
                            onChange={(o) => setHistoryDriverId(o ? o.value : '')}
                            isClearable
                            placeholder="Filter by driver..."
                            styles={reactSelectStyles}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !historyDate && 'text-muted-foreground')} onKeyDown={(e) => handleDateKeyDown(e, historyDate, setHistoryDate)}>
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
                    <Button variant="ghost" onClick={handleClearHistorySearch} className="w-full sm:w-auto"><X className="mr-2 h-4 w-4" /> Clear</Button>
                </div>
                <div className="relative flex-1 min-h-[300px]">
                  <div className="absolute inset-0 overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Vehicle</TableHead>
                                <TableHead>Party</TableHead>
                                <TableHead className="text-right">Advance (₹)</TableHead>
                                <TableHead className="text-right">Expenses (₹)</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredBills.length > 0 ? (
                                filteredBills.map(bill => (
                                    <TableRow key={bill.id} onDoubleClick={() => handleEditFromHistory(bill)} className="cursor-pointer">
                                        <TableCell>{bill.date instanceof Timestamp ? format(bill.date.toDate(), 'dd-MM-yy') : 'Invalid Date'}</TableCell>
                                        <TableCell>{bill.vehicleId}</TableCell>
                                        <TableCell>{bill.partyName}</TableCell>
                                        <TableCell className="text-right font-mono">{bill.advance.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono">{bill.expenses.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end">
                                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handlePrintBill(bill); }}>
                                                  <Printer className="h-4 w-4" />
                                                  <span className="sr-only">Print</span>
                                              </Button>
                                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteFromHistory(bill); }}>
                                                  <Trash2 className="h-4 w-4 text-destructive" />
                                                  <span className="sr-only">Delete</span>
                                              </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">No vehicle bills found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                  </div>
                </div>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Vehicle/Driver Statement</CardTitle>
            <CardDescription>Generate a statement for a specific vehicle or driver for a period of time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button variant={statementType === 'Vehicle' ? 'default' : 'outline'} onClick={() => { setStatementType('Vehicle'); setStatementId(''); }}>Vehicle Statement</Button>
              <Button variant={statementType === 'Driver' ? 'default' : 'outline'} onClick={() => { setStatementType('Driver'); setStatementId(''); }}>Driver Statement</Button>
            </div>
            {statementType && (
              <ReactSelect
                instanceId="statement-select"
                options={statementOptions}
                placeholder={`Select a ${statementType}...`}
                onChange={(o) => setStatementId(o ? o.value : '')}
                styles={reactSelectStyles}
                isClearable
                value={statementOptions.find(o => o.value === statementId) || null}
              />
            )}
            <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>From Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !statementFromDate && 'text-muted-foreground')} onFocus={() => { if(!statementFromDate) setStatementFromDate(new Date()) }} onKeyDown={(e) => handleDateKeyDown(e, statementFromDate, setStatementFromDate)}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {statementFromDate ? format(statementFromDate, 'PPP') : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={statementFromDate} onSelect={setStatementFromDate} /></PopoverContent>
                    </Popover>
                </div>
                 <div className="grid gap-2">
                    <Label>To Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !statementToDate && 'text-muted-foreground')} onFocus={() => { if(!statementToDate) setStatementToDate(new Date()) }} onKeyDown={(e) => handleDateKeyDown(e, statementToDate, setStatementToDate)}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {statementToDate ? format(statementToDate, 'PPP') : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={statementToDate} onSelect={setStatementToDate} /></PopoverContent>
                    </Popover>
                </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handlePrintStatement} 
              className="w-full" 
              disabled={!statementType || !statementId || !statementFromDate || !statementToDate}
            >
                <Printer className="mr-2 h-4 w-4"/> Generate &amp; Print Statement
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={showWhatsAppShareConfirm} onOpenChange={setShowWhatsAppShareConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Share on WhatsApp</AlertDialogTitle>
                <AlertDialogDescription>
                    Do you want to open WhatsApp now to share this vehicle bill summary?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowWhatsAppShareConfirm(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmOpenWhatsApp}>Open WhatsApp</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
