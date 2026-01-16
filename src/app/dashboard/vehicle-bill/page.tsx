'use client';
import React, { useState, useEffect, useMemo } from 'react';
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
import { VehicleBill } from '@/lib/data';
import { Timestamp } from 'firebase/firestore';

export default function VehicleBillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();

  const {
    vehicles,
    drivers,
    vehicleBills,
    currentUser,
    addOrUpdateVehicleBill,
    deleteVehicleBill,
  } = useData();

  // Form state
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [destination, setDestination] = useState('');
  const [advance, setAdvance] = useState('');
  const [expenses, setExpenses] = useState('');
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  
  // History state
  const [historyDate, setHistoryDate] = useState<Date | undefined>();
  const [historyVehicleId, setHistoryVehicleId] = useState('');
  const [historyDriverId, setHistoryDriverId] = useState('');
  const [filteredBills, setFilteredBills] = useState<VehicleBill[]>([]);

  // Load bill for editing from URL param
  useEffect(() => {
    const billIdFromParams = searchParams.get('billId');
    if (billIdFromParams) {
      const billToEdit = vehicleBills.find(b => b.id === billIdFromParams);
      if (billToEdit) {
        setEditingBillId(billToEdit.id);
        setDate(billToEdit.date instanceof Timestamp ? billToEdit.date.toDate() : new Date(billToEdit.date));
        setVehicleId(billToEdit.vehicleId);
        setDriverId(billToEdit.driverId);
        setDestination(billToEdit.destination);
        setAdvance(billToEdit.advance.toString());
        setExpenses(billToEdit.expenses.toString());
      }
    }
  }, [searchParams, vehicleBills]);

  useEffect(() => {
    setFilteredBills(vehicleBills);
  }, [vehicleBills]);

  const handleNewBill = () => {
    setEditingBillId(null);
    setDate(new Date());
    setVehicleId('');
    setDriverId('');
    setDestination('');
    setAdvance('');
    setExpenses('');
    router.replace('/dashboard/vehicle-bill');
  };

  const handleSaveBill = async () => {
    if (!date || !vehicleId || !driverId || !currentUser) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill out Date, Vehicle, and Driver.'});
      return null;
    }

    const vehicle = vehicles.find(v => v.id === vehicleId);
    const driver = drivers.find(d => d.id === driverId);

    if (!vehicle || !driver) {
        toast({ variant: 'destructive', title: 'Invalid Selection', description: 'Selected vehicle or driver not found.' });
        return null;
    }

    const billData: Omit<VehicleBill, 'id' | 'createdBy'> = {
      date,
      vehicleId,
      vehicleName: vehicle.name,
      driverId,
      driverName: driver.name,
      destination,
      advance: parseFloat(advance) || 0,
      expenses: parseFloat(expenses) || 0,
    };
    
    try {
        const savedBill = await addOrUpdateVehicleBill(billData, editingBillId || undefined);
        if (savedBill) {
            toast({ title: editingBillId ? 'Bill Updated' : 'Bill Saved', description: `Vehicle bill for ${vehicleId} has been saved.`});
            if (!editingBillId) {
                handleNewBill();
            }
        }
        return savedBill;
    } catch(e) {
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the vehicle bill.' });
        return null;
    }
  };

  const handlePrint = async () => {
    const savedBill = await handleSaveBill();
    if (savedBill) {
      const encodedData = encodeURIComponent(JSON.stringify(savedBill));
      window.open(`/dashboard/vehicle-bill/print?data=${encodedData}&paper=a4`, '_blank');
    }
  };

  const handleEditFromHistory = (bill: VehicleBill) => {
    router.push(`/dashboard/vehicle-bill?billId=${bill.id}`);
  };

  const handleDeleteFromHistory = (bill: VehicleBill) => {
    showAlertDialog({
        title: 'Delete Vehicle Bill?',
        description: `Are you sure you want to delete the bill for vehicle ${bill.vehicleId} on ${format(bill.date.toDate(), 'PPP')}?`,
        onConfirm: () => deleteVehicleBill(bill.id),
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
        results = results.filter(b => b.driverId === historyDriverId);
    }
    setFilteredBills(results);
  };

  const handleClearHistorySearch = () => {
    setHistoryDate(undefined);
    setHistoryVehicleId('');
    setHistoryDriverId('');
    setFilteredBills(vehicleBills);
  };

  const activeVehicles = useMemo(() => vehicles.filter(v => v.active), [vehicles]);
  const activeDrivers = useMemo(() => drivers.filter(d => d.active), [drivers]);

  return (
    <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
      <Card>
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="font-headline">
              {editingBillId ? `Editing Bill ${editingBillId.slice(0,5)}...` : 'Create Vehicle Bill'}
            </CardTitle>
            <CardDescription>
              Enter details for vehicle trips, expenses, and advances.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={'outline'} className={cn('w-[240px] justify-start text-left font-normal', !date && 'text-muted-foreground')}>
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
          <div className="grid gap-6 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="vehicle">Vehicle Number</Label>
              <ReactSelect
                instanceId="vehicle-select"
                options={activeVehicles.map(v => ({ value: v.id, label: `${v.id} (${v.name})` }))}
                value={activeVehicles.map(v => ({ value: v.id, label: `${v.id} (${v.name})` })).find(v => v.value === vehicleId) || null}
                onChange={(option) => setVehicleId(option ? option.value : '')}
                placeholder="Select vehicle..."
                isClearable
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driver">Driver Name</Label>
              <ReactSelect
                instanceId="driver-select"
                options={activeDrivers.map(d => ({ value: d.id, label: d.name }))}
                value={activeDrivers.map(d => ({ value: d.id, label: d.name })).find(d => d.value === driverId) || null}
                onChange={(option) => setDriverId(option ? option.value : '')}
                placeholder="Select driver..."
                isClearable
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
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
            <Button size="lg" variant="outline" onClick={handleSaveBill}>
                <Save className="mr-2 h-4 w-4" /> Save Bill
            </Button>
            <Button size="lg" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Save & Print
            </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="font-headline">Vehicle Bill History</CardTitle>
            <CardDescription>Search and manage previous vehicle bills.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="grid gap-2 flex-1">
                    <Label>Vehicle</Label>
                    <ReactSelect
                        options={vehicles.map(v => ({ value: v.id, label: `${v.id} (${v.name})`}))}
                        value={vehicles.map(v => ({ value: v.id, label: `${v.id} (${v.name})`})).find(v => v.value === historyVehicleId) || null}
                        onChange={(o) => setHistoryVehicleId(o ? o.value : '')}
                        isClearable
                        placeholder="Filter by vehicle..."
                    />
                </div>
                 <div className="grid gap-2 flex-1">
                    <Label>Driver</Label>
                    <ReactSelect
                        options={drivers.map(d => ({ value: d.id, label: d.name}))}
                        value={drivers.map(d => ({ value: d.id, label: d.name})).find(d => d.value === historyDriverId) || null}
                        onChange={(o) => setHistoryDriverId(o ? o.value : '')}
                        isClearable
                        placeholder="Filter by driver..."
                    />
                </div>
                 <div className="grid gap-2">
                    <Label>Date</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('w-[240px] justify-start text-left font-normal', !historyDate && 'text-muted-foreground')}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {historyDate ? format(historyDate, 'PPP') : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} /></PopoverContent>
                    </Popover>
                </div>
                <div className="self-end flex gap-2">
                    <Button onClick={handleSearchHistory}><Search className="mr-2 h-4 w-4" /> Search</Button>
                    <Button variant="ghost" onClick={handleClearHistorySearch}><X className="mr-2 h-4 w-4" /> Clear</Button>
                </div>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Destination</TableHead>
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
                                <TableCell>{bill.driverName}</TableCell>
                                <TableCell>{bill.destination}</TableCell>
                                <TableCell className="text-right font-mono">{bill.advance.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono">{bill.expenses.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFromHistory(bill)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">No vehicle bills found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}

    