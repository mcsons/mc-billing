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
import { PlusCircle, Trash2, Edit, Search } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { AddCustomerDialog } from '@/components/dashboard/add-customer-dialog';
import { useState, useMemo } from 'react';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { Input } from '@/components/ui/input';
import { Customer } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

export default function CustomersPage() {
  const { customers, deleteCustomer } = useData();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const showAlertDialog = useAlertDialog();

  const handleEdit = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setCustomerToEdit(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (customerId: string, customerName: string) => {
    showAlertDialog({
      title: 'Are you sure?',
      description: `This will permanently delete the customer "${customerName}". This action cannot be undone.`,
      onConfirm: async () => {
        await deleteCustomer(customerId);
        toast({ title: "Customer Deleted", description: `Customer "${customerName}" has been removed.` });
      },
    });
  };

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const lowercasedQuery = searchQuery.toLowerCase();
    return customers.filter(
      (customer) =>
        customer.id.toLowerCase().includes(lowercasedQuery) ||
        customer.name_en.toLowerCase().includes(lowercasedQuery) ||
        customer.name_ta.toLowerCase().includes(lowercasedQuery)
    );
  }, [customers, searchQuery]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline">Customers</CardTitle>
            <CardDescription>
              Manage your customers and view their details.
            </CardDescription>
          </div>
          <Button onClick={handleAdd}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by ID or name..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
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
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.id}</TableCell>
                    <TableCell>{customer.name_en}</TableCell>
                    <TableCell>{customer.name_ta}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit customer</span>
                      </Button>
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
          </div>
        </CardContent>
      </Card>
      <AddCustomerDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customerToEdit={customerToEdit}
      />
    </>
  );
}
