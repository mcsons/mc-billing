import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Search } from 'lucide-react';
  
  export default function HistoryPage() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Bill History</CardTitle>
          <CardDescription>
            Search and view past bills. Admins can edit past entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="grid gap-2 flex-1">
              <Label htmlFor="customer-search">Customer</Label>
              <Input id="customer-search" placeholder="Search by ID or Name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date-search">Date</Label>
              <Input id="date-search" type="date" />
            </div>
            <div className="self-end">
              <Button>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
  
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Stall</TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">B1234</TableCell>
                <TableCell>2024-01-12</TableCell>
                <TableCell>Retail Shop A (சில்லறை கடை அ)</TableCell>
                <TableCell className="text-right">₹8,200.00</TableCell>
                <TableCell>1</TableCell>
                <TableCell>Admin</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">B1235</TableCell>
                <TableCell>2024-01-12</TableCell>
                <TableCell>Hotel B (ஹோட்டல் ஆ)</TableCell>
                <TableCell className="text-right">₹15,500.00</TableCell>
                <TableCell>2</TableCell>
                <TableCell>Manager</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }
  