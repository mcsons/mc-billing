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
import { Party } from '@/lib/data';
import { AddPartyDialog } from '@/components/dashboard/add-party-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function PartiesPage() {
  const { parties, deleteParty } = useData();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [partyToEdit, setPartyToEdit] = useState<Party | null>(null);
  const showAlertDialog = useAlertDialog();

  const handleEdit = (party: Party) => {
    setPartyToEdit(party);
    setIsEditDialogOpen(true);
  };
  
  const handleCloseDialogs = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setPartyToEdit(null);
  };

  const handleDelete = (partyId: string, partyName: string) => {
    showAlertDialog({
      title: 'Are you sure?',
      description: `This will permanently delete the party "${partyName}". This action cannot be undone.`,
      onConfirm: async () => {
        await deleteParty(partyId);
        toast({ title: 'Party Deleted', description: `Party "${partyName}" removed.` });
      },
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline">Manage Parties</CardTitle(CardTitle>
            <CardDescription>
              Add, edit, and manage your business parties and destinations.
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Party
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Party Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(parties || []).map((party) => (
                  <TableRow key={party.id}>
                    <TableCell className="font-medium">{party.id}</TableCell>
                    <TableCell>{party.name}</TableCell>
                    <TableCell>{party.location}</TableCell>
                    <TableCell>
                      <Badge variant={party.active ? 'outline' : 'secondary'}>
                        {party.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(party)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit party</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(party.id, party.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete party</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AddPartyDialog
        isOpen={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={handleCloseDialogs}
        partyToEdit={partyToEdit}
      />
    </>
  );
}
