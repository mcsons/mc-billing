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
  import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { AddUserDialog } from '@/components/dashboard/add-user-dialog';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User } from '@/lib/data';
  
  
  export default function UsersPage() {
    const { users, currentUser, deleteUser, promoteUser, isCurrentUserAdmin } = useData();
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

    const handlePromote = (userId: string, username: string, role: 'ADMIN' | 'CREATOR') => {
      showAlertDialog({
        title: `Promote ${username} to ${role}?`,
        description: `This will grant them ${role}-level privileges. This action is significant and should be done with caution.`,
        confirmText: 'Promote',
        onConfirm: () => promoteUser(userId, username, role),
      });
    };

    return (
        <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="font-headline">Manage Users</CardTitle>
                <CardDescription>
                  Add new users as Managers. For security, only Admins or the Creator can manage other users and promote them.
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
                       {user.id !== currentUser?.id ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {user.role === 'MANAGER' && (
                              <>
                                <DropdownMenuItem onClick={() => handlePromote(user.id, user.username, 'ADMIN')}>
                                  Promote to Admin
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePromote(user.id, user.username, 'CREATOR')}>
                                  Promote to Creator
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              onClick={() => handleDeleteUser(user.id, user.username)}
                            >
                              Delete user
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
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
