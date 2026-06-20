'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Printer, Share, Search as SearchIcon } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import ReactSelect from 'react-select';
import { useFirestore } from '@/firebase';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { useLoading } from '@/context/LoadingContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ReportsPage() {
    const { customers, products, getSalesReport, liveBillSummaries } = useData();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { setLoading } = useLoading();

    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [fromDate, setFromDate] = useState<Date | undefined>();
    const [toDate, setToDate] = useState<Date | undefined>();

    const [reportMode, setReportMode] = useState<'CUSTOMER' | 'PRODUCT' | 'CUSTOMER_PRODUCT' | null>(null);
    const [reportData, setReportData] = useState<any>(null);

    const reactSelectStyles = {
        container: (baseStyles: any) => ({ ...baseStyles, width: '100%' }),
        control: (baseStyles: any, state: any) => ({
            ...baseStyles,
            backgroundColor: 'hsl(var(--background))',
            borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
            boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
            minHeight: '44px',
            '&:hover': { borderColor: 'hsl(var(--ring))' },
        }),
        menu: (baseStyles: any) => ({
            ...baseStyles,
            backgroundColor: 'hsl(var(--card))',
            zIndex: 50,
        }),
        option: (baseStyles: any, state: any) => ({
            ...baseStyles,
            backgroundColor: state.isSelected ? 'hsl(var(--accent))' : state.isFocused ? 'hsl(var(--muted))' : 'transparent',
            color: state.isSelected ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
            '&:active': { backgroundColor: 'hsl(var(--accent))' },
        }),
        singleValue: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--foreground))' }),
        input: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--foreground))' }),
        placeholder: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--muted-foreground))' }),
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

    const handleSearch = async () => {
        if (!fromDate || !toDate) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a date range.' });
            return;
        }

        if (!selectedCustomerId && !selectedProductId) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a Customer or Product.' });
            return;
        }

        setLoading(true, "Generating report...");
        try {
            if (selectedCustomerId && !selectedProductId) {
                // CUSTOMER REPORT
                const data = await getSalesReport(selectedCustomerId, { from: fromDate, to: toDate });
                if (data) {
                    setReportMode('CUSTOMER');
                    setReportData(data);
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not generate the report.' });
                }
            } else if (selectedProductId) {
                // PRODUCT OR CUSTOMER_PRODUCT REPORT
                if (!firestore) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Database connection not ready.' });
                    setLoading(false);
                    return;
                }

                const fromDateStart = startOfDay(fromDate);
                const toDateEnd = endOfDay(toDate);

                let targetBills = liveBillSummaries.filter(b => b.date && b.amount > 0);
                targetBills = targetBills.filter(b => {
                    const d = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
                    return d >= fromDateStart && d <= toDateEnd;
                });

                if (selectedCustomerId) {
                    targetBills = targetBills.filter(b => b.customerId === selectedCustomerId);
                }

                const billItemsPromises = targetBills.map(bill => 
                    getDocs(collection(firestore, 'bills', bill.billNo, 'billItems')).then(snap => {
                        const billDate = bill.date instanceof Timestamp ? bill.date.toDate() : new Date(bill.date);
                        return snap.docs.map(doc => ({ 
                            ...doc.data(), 
                            billDate, 
                            billNo: bill.billNo, 
                            customerId: bill.customerId, 
                            customerName: bill.customerName 
                        })) as any[];
                    })
                );

                const itemsArrays = await Promise.all(billItemsPromises);
                const allItems = itemsArrays.flat();
                
                const productItems = allItems.filter(item => item.productId === selectedProductId);
                
                productItems.sort((a, b) => a.billDate.getTime() - b.billDate.getTime());

                let totalQty = 0;
                let totalAmount = 0;
                productItems.forEach(item => {
                    totalQty += Number(item.qty) || 0;
                    totalAmount += Number(item.amount) || 0;
                });

                const product = products.find(p => p.id === selectedProductId);
                const customer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : undefined;

                if (selectedCustomerId && selectedProductId) {
                    setReportMode('CUSTOMER_PRODUCT');
                } else {
                    setReportMode('PRODUCT');
                }

                setReportData({
                    productName: product ? `${product.name_en} (${product.name_ta})` : 'Unknown Product',
                    customerName: customer ? `${customer.name_en} (${customer.name_ta})` : undefined,
                    items: productItems,
                    totalQty,
                    totalAmount,
                    dateRange: { from: fromDate, to: toDate }
                });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate report.' });
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (!reportMode || !reportData) return;
        sessionStorage.setItem('unifiedReportData', JSON.stringify({ mode: reportMode, data: reportData }));
        window.open('/print/sales-report', '_blank');
    };

    const handleSharePDF = () => {
        if (!reportMode || !reportData) return;
        sessionStorage.setItem('unifiedReportData', JSON.stringify({ mode: reportMode, data: reportData }));
        window.open('/print/sales-report?share=pdf', '_blank');
    };

    const selectedCustomerData = customers.find(c => c.id === selectedCustomerId);
    const selectedProductData = products.find(p => p.id === selectedProductId);

    const formatINR = (value: number) => {
        if (value == null || isNaN(value)) return '0.00';
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    return (
        <div className="flex flex-col gap-6 pb-8 w-full max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-headline font-bold text-foreground">Reports</h1>
                <p className="text-muted-foreground text-sm mt-1">Generate Sales or Product reports.</p>
            </div>

            <Card className="section-box">
                <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="customer-report">Customer</Label>
                            <ReactSelect
                                instanceId="report-customer-select"
                                inputId="customer-report"
                                placeholder="Select customer..."
                                isClearable
                                options={customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }))}
                                value={selectedCustomerData ? { value: selectedCustomerData.id, label: `${selectedCustomerData.name_en} (${selectedCustomerData.name_ta})` } : null}
                                onChange={(option) => { setSelectedCustomerId(option ? option.value : ''); setReportMode(null); }}
                                styles={reactSelectStyles}
                                filterOption={(option, input) => {
                                    if (!input) return true;
                                    const isNumeric = /^\d+$/.test(input);
                                    if (isNumeric) return option.value === input || option.value === String(parseInt(input, 10));
                                    return option.label.toLowerCase().includes(input.toLowerCase());
                                }}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="product-report">Product</Label>
                            <ReactSelect
                                instanceId="report-product-select"
                                inputId="product-report"
                                placeholder="Select product..."
                                isClearable
                                options={products.map((p) => ({ value: p.id, label: `${p.name_en} (${p.name_ta})` }))}
                                value={selectedProductData ? { value: selectedProductData.id, label: `${selectedProductData.name_en} (${selectedProductData.name_ta})` } : null}
                                onChange={(option) => { setSelectedProductId(option ? option.value : ''); setReportMode(null); }}
                                styles={reactSelectStyles}
                                filterOption={(option, input) => {
                                    if (!input) return true;
                                    const lowerInput = input.toLowerCase();
                                    return option.label.toLowerCase().includes(lowerInput) || option.value.toLowerCase().includes(lowerInput);
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="from-date">From Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="from-date"
                                        variant={'outline'}
                                        className={cn('w-full justify-start text-left font-normal select-none', !fromDate && 'text-muted-foreground')}
                                        onFocus={() => { if (!fromDate) setFromDate(new Date()); }}
                                        onKeyDown={(e) => handleDateKeyDown(e, fromDate, setFromDate as (d: Date) => void)}
                                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {fromDate ? format(fromDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={fromDate} onSelect={(d) => { setFromDate(d); setReportMode(null); }} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="to-date">To Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="to-date"
                                        variant={'outline'}
                                        className={cn('w-full justify-start text-left font-normal select-none', !toDate && 'text-muted-foreground')}
                                        onFocus={() => { if (!toDate) setToDate(new Date()); }}
                                        onKeyDown={(e) => handleDateKeyDown(e, toDate, setToDate as (d: Date) => void)}
                                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); }}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {toDate ? format(toDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={toDate} onSelect={(d) => { setToDate(d); setReportMode(null); }} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
                        <Button onClick={handleSearch} className="w-full sm:flex-1 h-[44px]">
                            <SearchIcon className="mr-2 h-4 w-4" />
                            Search
                        </Button>
                        <Button variant="outline" onClick={handlePrint} disabled={!reportMode} className="w-full sm:flex-1 h-[44px]">
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                        <Button variant="outline" onClick={handleSharePDF} disabled={!reportMode} className="w-full sm:flex-1 h-[44px] border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
                            <Share className="mr-2 h-4 w-4" />
                            Share (PDF)
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* RESULTS DISPLAY */}
            {reportMode === 'CUSTOMER' && reportData && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle className="text-lg">Customer Sales Report</CardTitle>
                        <CardDescription>{reportData.customer?.name_en} • {format(reportData.dateRange.from, 'dd/MM/yyyy')} to {format(reportData.dateRange.to, 'dd/MM/yyyy')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Rate</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.itemsByDate.map((dateGroup: any, idx: number) => (
                                        <React.Fragment key={idx}>
                                            {dateGroup.items.map((item: any, i: number) => (
                                                <TableRow key={`${idx}-${i}`}>
                                                    <TableCell className="whitespace-nowrap">{i === 0 ? dateGroup.date : ''}</TableCell>
                                                    <TableCell>{item.product}</TableCell>
                                                    <TableCell className="text-right">{item.qty}</TableCell>
                                                    <TableCell className="text-right">{formatINR(item.rate)}</TableCell>
                                                    <TableCell className="text-right">{formatINR(item.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-6 flex flex-col items-end space-y-2 text-sm">
                            <div className="w-full max-w-[300px] flex justify-between font-medium">
                                <span>Total Qty:</span>
                                <span>{Object.entries(reportData.totalQty).map(([uom, qty]) => `${qty} ${uom}`).join(', ')}</span>
                            </div>
                            <div className="w-full max-w-[300px] flex justify-between font-medium">
                                <span>Total Amount:</span>
                                <span>₹{formatINR(reportData.totalAmount)}</span>
                            </div>
                            <div className="w-full max-w-[300px] flex justify-between font-medium">
                                <span>Prev Balance:</span>
                                <span>₹{formatINR(reportData.previousBalance)}</span>
                            </div>
                            <div className="w-full max-w-[300px] flex justify-between font-bold text-base border-t pt-2">
                                <span>Net Amount:</span>
                                <span>₹{formatINR(reportData.netAmount)}</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 border-t pt-4 bg-muted/20">
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                        <Button variant="outline" onClick={handleSharePDF} className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
                            <Share className="mr-2 h-4 w-4" /> Share (PDF)
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {reportMode === 'PRODUCT' && reportData && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle className="text-lg">Product Report</CardTitle>
                        <CardDescription>{reportData.productName} • {format(reportData.dateRange.from, 'dd/MM/yyyy')} to {format(reportData.dateRange.to, 'dd/MM/yyyy')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Cust ID</TableHead>
                                        <TableHead>Cust Name</TableHead>
                                        <TableHead>Product Name</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Rate</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.items.map((item: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell className="whitespace-nowrap">{format(item.billDate, 'dd-MM-yyyy')}</TableCell>
                                            <TableCell>{item.customerId}</TableCell>
                                            <TableCell>{item.customerName}</TableCell>
                                            <TableCell>{item.product}</TableCell>
                                            <TableCell className="text-right">{item.qty}</TableCell>
                                            <TableCell className="text-right">{formatINR(item.rate)}</TableCell>
                                            <TableCell className="text-right">{formatINR(item.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {reportData.items.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">No records found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-6 flex flex-col items-end space-y-2 text-sm">
                            <div className="w-full max-w-[300px] flex justify-between font-bold text-base">
                                <span>Total Qty Purchased:</span>
                                <span>{Number(reportData.totalQty).toFixed(2)}</span>
                            </div>
                            <div className="w-full max-w-[300px] flex justify-between font-bold text-base">
                                <span>Total Amount:</span>
                                <span>₹{formatINR(reportData.totalAmount)}</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 border-t pt-4 bg-muted/20">
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                        <Button variant="outline" onClick={handleSharePDF} className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
                            <Share className="mr-2 h-4 w-4" /> Share (PDF)
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {reportMode === 'CUSTOMER_PRODUCT' && reportData && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle className="text-lg">Customer Product Report</CardTitle>
                        <CardDescription>{reportData.customerName} • {reportData.productName} • {format(reportData.dateRange.from, 'dd/MM/yyyy')} to {format(reportData.dateRange.to, 'dd/MM/yyyy')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Product Name</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Rate</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.items.map((item: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell className="whitespace-nowrap">{format(item.billDate, 'dd-MM-yyyy')}</TableCell>
                                            <TableCell>{item.product}</TableCell>
                                            <TableCell className="text-right">{item.qty}</TableCell>
                                            <TableCell className="text-right">{formatINR(item.rate)}</TableCell>
                                            <TableCell className="text-right">{formatINR(item.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {reportData.items.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No records found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-6 flex flex-col items-end space-y-2 text-sm">
                            <div className="w-full max-w-[300px] flex justify-between font-bold text-base">
                                <span>Total Qty:</span>
                                <span>{Number(reportData.totalQty).toFixed(2)}</span>
                            </div>
                            <div className="w-full max-w-[300px] flex justify-between font-bold text-base">
                                <span>Total Amount:</span>
                                <span>₹{formatINR(reportData.totalAmount)}</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 border-t pt-4 bg-muted/20">
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                        <Button variant="outline" onClick={handleSharePDF} className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
                            <Share className="mr-2 h-4 w-4" /> Share (PDF)
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
