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
  import { PlusCircle, ShieldPlus, Trash2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { AddUserDialog } from '@/components/dashboard/add-user-dialog';
import { useAlertDialog } from '@/context/AlertDialogProvider';
  
  
  export default function UsersPage() {
    const { users, currentUser, deleteUser, promoteUserToAdmin, isCurrentUserAdmin } = useData();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const showAlertDialog = useAlertDialog();

    const canManageUsers = isCurrentUserAdmin;

    const handleDeleteUser = (userId: string, username: string) => {
      showAlertDialog({
        title: 'Are you sure?',
        description: `This will permanently delete the user "${username}" from the database. To fully remove their login access, you must also delete them from the Firebase Authentication console.`,
        onConfirm: () => deleteUser(userId),
      });
    };

    const handlePromoteUser = (userId: string, username: string) => {
      showAlertDialog({
        title: `Promote ${username} to Admin?`,
        description: 'Admins have broad access to manage users, products, and other settings. This action can be reversed by demoting them in the future (feature not yet implemented).',
        confirmText: 'Promote',
        onConfirm: () => promoteUserToAdmin(userId, username),
      });
    };

    return (
        <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="font-headline">Manage Users</CardTitle>
                <CardDescription>
                  Add new users as Managers, then promote them to Admins if needed. For security, only Admins can manage other users.
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
                    <TableCell className="text-right flex items-center justify-end gap-2">
                      {user.role === 'MANAGER' && (
                        <Button variant="outline" size="sm" onClick={() => handlePromoteUser(user.id, user.username)}>
                          <ShieldPlus className="mr-2 h-4 w-4" />
                          Promote
                        </Button>
                      )}
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
