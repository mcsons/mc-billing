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
  
  const users = [
    { id: 'U01', username: 'creator', role: 'CREATOR', status: 'Active' },
    { id: 'U02', username: 'admin', role: 'ADMIN', status: 'Active' },
    { id: 'U03', username: 'manager1', role: 'MANAGER', status: 'Active' },
    { id: 'U04', username: 'manager2', role: 'MANAGER', status: 'Inactive' },
  ];
  
  export default function UsersPage() {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="font-headline">Manage Users</CardTitle>
                <CardDescription>
                Add, edit, or remove users. (Creator access only)
                </CardDescription>
            </div>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4"/>
                New User
            </Button>
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
    );
  }
  