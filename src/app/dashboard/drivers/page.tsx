'use client';
import { useState } from 'react';
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
import { Edit, PlusCircle, Trash2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { Driver } from '@/lib/data';
import { AddDriverDialog } from '@/components/dashboard/add-driver-dialog';
import { Badge } from '@/components/ui/badge';

export default function DriversPage() {
  const { drivers, deleteDriver } = useData();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [driverToEdit, setDriverToEdit] = useState<Driver | null>(null);
  const showAlertDialog = useAlertDialog();

  const handleEdit = (driver: Driver) => {
    setDriverToEdit(driver);
    setIsEditDialogOpen(true);
  };
  
  const handleCloseDialogs = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setDriverToEdit(null);
  };

  const handleDelete = (driverId: string, driverName: string) => {
    showAlertDialog({
      title: 'Are you sure?',
      description: `This will permanently delete the driver "${driverName}". This action cannot be undone.`,
      onConfirm: () => deleteDriver(driverId),
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline">Manage Drivers</CardTitle>
            <CardDescription>
              Add, edit, and manage your company's drivers.
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Driver
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>License Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.licenseNumber}</TableCell>
                    <TableCell>
                      <Badge variant={driver.active ? 'outline' : 'secondary'}>
                        {driver.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(driver)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit driver</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(driver.id, driver.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete driver</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AddDriverDialog
        isOpen={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={handleCloseDialogs}
        driverToEdit={driverToEdit}
      />
    </>
  );
}
