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
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { PlusCircle, Trash2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { AddUserDialog } from '@/components/dashboard/add-user-dialog';
import { useAlertDialog } from '@/context/AlertDialogProvider';
  
  
  export default function UsersPage() {
    const { users, currentUser, deleteUser } = useData();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const showAlertDialog = useAlertDialog();

    const canManageUsers = currentUser?.role === 'CREATOR';

    const handleDeleteUser = (userId: string, username: string) => {
      showAlertDialog({
        title: 'Are you sure?',
        description: `This will permanently delete the user "${username}". This action cannot be undone.`,
        onConfirm: () => deleteUser(userId),
      });
    };

    return (
        <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="font-headline">Manage Users</CardTitle>
                <CardDescription>
                Add new managers. For security, Admin and Creator roles must be managed via the Firebase Console.
                </CardDescription>
            </div>
            {canManageUsers && (
              <Button onClick={() => setIsDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4"/>
                  New User
              </Button>
            )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {canManageUsers && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.id}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'CREATOR' ? 'destructive' : user.role === 'ADMIN' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'Active' ? 'outline' : 'secondary'}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  {canManageUsers && (
                    <TableCell className="text-right">
                      {user.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id, user.username)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete user</span>
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddUserDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} />
      </>
    );
  }
