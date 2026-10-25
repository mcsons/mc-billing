'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useData } from '@/context/DataContext';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { updatePassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';

export default function ProfilePage() {
  const { currentUser, updateUserProfile } = useData();
  const { user: firebaseUser } = useUser();
  const auth = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username);
    }
  }, [currentUser]);

  const handleUpdateProfile = async () => {
    if (!currentUser || !username) {
        toast({ variant: 'destructive', title: 'Username is required.' });
        return;
    }
    if (username === currentUser.username) {
        return; // Don't show toast for no changes
    }

    setIsSavingProfile(true);
    try {
      await updateUserProfile(currentUser.id, { username });
      toast({
        title: 'Profile Updated',
        description: 'Your username has been successfully updated.',
      });
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update your profile.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };
  
  const handleChangePassword = async () => {
    if (!auth?.currentUser) {
        toast({ variant: 'destructive', title: 'Not authenticated', description: 'Cannot change password.' });
        return;
    }
    if (!newPassword || !confirmPassword) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please enter and confirm your new password.' });
        return;
    }
    if (newPassword !== confirmPassword) {
        toast({ variant: 'destructive', title: 'Passwords do not match' });
        return;
    }
    if (newPassword.length < 6) {
        toast({ variant: 'destructive', title: 'Password too weak', description: 'Password should be at least 6 characters.' });
        return;
    }

    setIsSavingPassword(true);
    try {
        await updatePassword(auth.currentUser, newPassword);
        toast({ title: 'Password Updated', description: 'Your password has been changed successfully.'});
        setNewPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        console.error('Password update error:', error);
        let description = 'An unknown error occurred.';
        if (error.code === 'auth/requires-recent-login') {
            description = 'This is a sensitive operation. Please log out and log back in to change your password.';
        } else if (error.code === 'auth/weak-password') {
            description = 'Your new password is too weak. Please choose a stronger one.';
        }
        toast({ variant: 'destructive', title: 'Password update failed', description });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const isSaving = isSavingProfile || isSavingPassword;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">My Profile</CardTitle>
        <CardDescription>
          View and update your personal information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Account Information</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email (Login ID)</Label>
              <Input 
                id="email" 
                type="email" 
                value={firebaseUser?.email || ''} 
                disabled 
                readOnly
              />
            </div>
          </div>
           <div className="pt-2">
             <Button onClick={handleUpdateProfile} disabled={isSaving}>
                {isSavingProfile ? 'Saving...' : 'Update Username'}
             </Button>
           </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Change Password</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input 
                id="new-password" 
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSaving}
                placeholder="New password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input 
                id="confirm-password" 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSaving}
                placeholder="Confirm password"
              />
            </div>
          </div>
           <div className="pt-2">
             <Button onClick={handleChangePassword} disabled={isSaving}>
                {isSavingPassword ? 'Saving...' : 'Change Password'}
             </Button>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
