'use client';
import { Fish } from 'lucide-react';
import { UserNav } from './user-nav';
import { SidebarTrigger } from '../ui/sidebar';

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="text-foreground border border-input shadow-sm hover:bg-accent" />
      <div className="flex items-center gap-2">
        <Fish className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold font-headline tracking-tight text-primary">
          M.C & SONS FISH COMPANY
        </h1>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <UserNav />
      </div>
    </header>
  );
}
