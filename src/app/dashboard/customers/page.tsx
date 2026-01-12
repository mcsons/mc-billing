'use client';
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
import { PlusCircle, Trash2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { AddCustomerDialog } from '@/components/dashboard/add-customer-dialog';
import { useState } from 'react';
import { useAlertDialog } from '@/context/AlertDialogProvider';

export default function CustomersPage() {
  const { customers, deleteCustomer } = useData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const showAlertDialog = useAlertDialog();

  const handleDelete = (customerId: string, customerName: string) => {
    showAlertDialog({
      title: 'Are you sure?',
      description: `This will permanently delete the customer "${customerName}". This action cannot be undone.`,
      onConfirm: () => deleteCustomer(customerId),
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-headline">Customers</CardTitle>
            <CardDescription>
              Manage your customers and view their details.
            </CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.id}</TableCell>
                  <TableCell>{customer.name_en}</TableCell>
                  <TableCell>{customer.name_ta}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleDelete(customer.id, customer.name_en)
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Delete customer</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddCustomerDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
