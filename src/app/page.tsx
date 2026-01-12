'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if user is already logged in
  React.useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
        toast({
            variant: 'destructive',
            title: 'Authentication service not available',
            description: 'Please try again later.',
        });
        return;
    }
    
    const email = `${username.toLowerCase()}@mcandsons.com`;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        toast({
            title: 'Login Successful',
            description: `Welcome back, ${username}!`,
        });
    } catch (error: any) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            // If user does not exist, try to create them.
            // This is a one-time operation for the first user.
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                toast({
                    title: 'Account Created & Logged In',
                    description: `Welcome, ${username}! Your account has been created.`,
                });
            } catch (createError: any) {
                console.error("Creation Error:", createError.code, createError.message);
                 toast({
                    variant: 'destructive',
                    title: 'Registration Failed',
                    description: 'Could not create a new account. Please try again.',
                });
            }
        } else {
             console.error("Login Error:", error.code, error.message);
             toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: 'Invalid username or password. Please try again.',
            });
        }
    }
  };

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
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Log in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
