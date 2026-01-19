'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import ReactSelect from 'react-select';

export default function SalesReportPage() {
    const { customers, getSalesReport } = useData();
    const { toast } = useToast();

    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [fromDate, setFromDate] = useState<Date | undefined>();
    const [toDate, setToDate] = useState<Date | undefined>();

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

    const handleGenerateReport = async () => {
        if (!selectedCustomerId || !fromDate || !toDate) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a customer and a date range.' });
            return;
        }
        
        const reportData = await getSalesReport(selectedCustomerId, { from: fromDate, to: toDate });
        
        if (!reportData) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate the report.' });
            return;
        }

        const encodedData = encodeURIComponent(JSON.stringify(reportData));
        window.open(`/print/sales-report?data=${encodedData}`, '_blank');
    };

    const selectedCustomerData = customers.find(c => c.id === selectedCustomerId);

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="font-headline">Sales Report</CardTitle>
                <CardDescription>Generate a sales report for a specific customer within a date range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid gap-2">
                    <Label htmlFor="customer-report">Customer</Label>
                    <ReactSelect
                        instanceId="report-customer-select"
                        inputId='customer-report'
                        placeholder="Select customer..."
                        isClearable
                        options={customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }))}
                        value={ selectedCustomerData ? { value: selectedCustomerData.id, label: `${selectedCustomerData.name_en} (${selectedCustomerData.name_ta})` } : null }
                        onChange={(option) => setSelectedCustomerId(option ? option.value : '')}
                        styles={reactSelectStyles}
                        filterOption={(option, input) => option.label.toLowerCase().includes(input.toLowerCase()) || option.value.toLowerCase().includes(input.toLowerCase()) }
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="from-date">From Date</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="from-date"
                                    variant={'outline'}
                                    className={cn('w-full justify-start text-left font-normal', !fromDate && 'text-muted-foreground')}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {fromDate ? format(fromDate, 'PPP') : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
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
                                    className={cn('w-full justify-start text-left font-normal', !toDate && 'text-muted-foreground')}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {toDate ? format(toDate, 'PPP') : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleGenerateReport} disabled={!selectedCustomerId || !fromDate || !toDate}>
                    <Printer className="mr-2 h-4 w-4" />
                    Generate & Print Report
                </Button>
            </CardFooter>
        </Card>
    );
}
