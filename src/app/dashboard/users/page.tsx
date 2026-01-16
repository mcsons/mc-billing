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
  import { PlusCircle } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { AddUserDialog } from '@/components/dashboard/add-user-dialog';
  
  
  export default function UsersPage() {
    const { users, currentUser } = useData();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const canManageUsers = currentUser?.role === 'CREATOR';

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
