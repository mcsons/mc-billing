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
import { Vehicle } from '@/lib/data';
import { AddVehicleDialog } from '@/components/dashboard/add-vehicle-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function VehiclesPage() {
  const { vehicles, deleteVehicle } = useData();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);
  const showAlertDialog = useAlertDialog();

  const handleEdit = (vehicle: Vehicle) => {
    setVehicleToEdit(vehicle);
    setIsEditDialogOpen(true);
  };
  
  const handleCloseDialogs = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setVehicleToEdit(null);
  };

  const handleDelete = (vehicleId: string, vehicleName: string) => {
    showAlertDialog({
      title: 'Are you sure?',
      description: `This will permanently delete the vehicle "${vehicleName} (${vehicleId})". This action cannot be undone.`,
      onConfirm: async () => {
        await deleteVehicle(vehicleId);
        toast({ title: 'Vehicle Deleted', description: `Vehicle "${vehicleName}" removed.` });
      },
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline">Manage Vehicles</CardTitle>
            <CardDescription>
              Add, edit, and manage your company's vehicles.
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Vehicle
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg. Number</TableHead>
                  <TableHead>Vehicle Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.id}</TableCell>
                    <TableCell>{vehicle.name}</TableCell>
                    <TableCell>
                      <Badge variant={vehicle.active ? 'outline' : 'secondary'}>
                        {vehicle.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(vehicle)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit vehicle</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(vehicle.id, vehicle.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete vehicle</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AddVehicleDialog
        isOpen={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={handleCloseDialogs}
        vehicleToEdit={vehicleToEdit}
      />
    </>
  );
}
