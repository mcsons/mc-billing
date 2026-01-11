import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Fish } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function CompanyHeader() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-bold font-headline text-primary">
        M.C & SONS FISH COMPANY
      </h2>
      <p className="text-xs text-muted-foreground">
        No. 1, Fish Market, Palladam Road, Tiruppur-641604
      </p>
      <p className="text-xs text-muted-foreground">📞 9894089889</p>
    </div>
  );
}

const demoUsers = [
  { role: 'Creator', user: 'creator', pass: 'password' },
  { role: 'Admin', user: 'admin', pass: 'password' },
  { role: 'Manager', user: 'manager', pass: 'password' },
]

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
      <div className="flex flex-col items-center gap-2 mb-6 text-primary">
          <Fish className="h-10 w-10" />
          <h1 className="text-3xl font-bold font-headline">MC Billing</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2">
            <CompanyHeader />
            <CardTitle className="text-2xl pt-4 text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access the billing system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                required
                defaultValue="admin"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input id="password" type="password" required defaultValue="password" />
            </div>
            <Button asChild type="submit" className="w-full">
              <Link href="/dashboard">Log in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="w-full max-w-sm mt-6">
        <CardHeader>
            <CardTitle className="text-lg">Demo Credentials</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Password</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {demoUsers.map(user => (
                        <TableRow key={user.role}>
                            <TableCell>{user.role}</TableCell>
                            <TableCell>{user.user}</TableCell>
                            <TableCell>{user.pass}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </main>
  );
}