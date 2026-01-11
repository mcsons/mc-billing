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
  import { customers } from '@/lib/data';
  import { Button } from '@/components/ui/button';
  import { PlusCircle } from 'lucide-react';
  
  export default function CustomersPage() {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="font-headline">Customers</CardTitle>
                <CardDescription>
                Manage your customers and view their details.
                </CardDescription>
            </div>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4"/>
                New Customer
            </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name (English)</TableHead>
                <TableHead>Name (Tamil)</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.id}</TableCell>
                  <TableCell>{customer.name_en}</TableCell>
                  <TableCell>{customer.name_ta}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }
  