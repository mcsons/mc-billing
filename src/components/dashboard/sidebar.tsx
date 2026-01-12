'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  Fish,
  History,
  IndianRupee,
  Printer,
  Settings,
  User,
  UserCog,
  Users,
  Wallet,
  ShieldCheck,
  Cuboid,
} from 'lucide-react';
import React from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarMenuSubItem
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/DataContext';
import { ThemeToggle } from '../ui/theme-toggle';

const menuItems = [
  { href: '/dashboard', label: 'Billing', icon: ClipboardList },
  { href: '/dashboard/history', label: 'Bill History', icon: History },
  { href: '/dashboard/payments', label: 'Payments', icon: Wallet },
  { href: '/dashboard/customers', label: 'Customers', icon: Users, roles: ['CREATOR', 'ADMIN'] },
  { href: '/dashboard/products', label: 'Products', icon: Fish, roles: ['CREATOR', 'ADMIN'] },
  { href: '/dashboard/prices', label: 'Set Prices', icon: IndianRupee, roles: ['CREATOR', 'ADMIN'] },
  { href: '/dashboard/users', label: 'Manage Users', icon: UserCog, roles: ['CREATOR'] },
  { href: '/dashboard/permissions', label: 'Permissions', icon: ShieldCheck, roles: ['CREATOR'] },
  { href: '/dashboard/profile', label: 'Profile', icon: User, roles: ['CREATOR', 'ADMIN', 'MANAGER']},
];

const settingsSubItems = [
    { href: '/dashboard/settings/printer', label: 'Printer', icon: Printer },
    { href: '/dashboard/settings/uom', label: 'UOM', icon: Cuboid },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { currentUser } = useData();
  const currentUserRole = currentUser?.role;

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const isMenuItemActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };
  
  React.useEffect(() => {
    setIsSettingsOpen(pathname.startsWith('/dashboard/settings'));
  }, [pathname]);

  return (
      <Sidebar>
        <SidebarHeader className="flex items-center justify-between p-2">
            <Button variant="ghost" className="h-8 w-full justify-start gap-2 px-2">
                <Fish className="size-5 text-primary" />
                <span className="font-headline text-lg font-bold text-primary">MC Billing</span>
            </Button>
            <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => 
                (!item.roles || (currentUserRole && item.roles.includes(currentUserRole))) && (
                    <SidebarMenuItem key={item.label}>
                        <Link href={item.href} passHref legacyBehavior>
                            <SidebarMenuButton as="a" isActive={isMenuItemActive(item.href, item.href === '/dashboard' || item.href.includes('profile'))}>
                                <item.icon />
                                <span>{item.label}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                )
            )}
            {currentUserRole && (currentUserRole === 'CREATOR' || currentUserRole === 'ADMIN') && (
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setIsSettingsOpen(!isSettingsOpen)} isActive={isMenuItemActive('/dashboard/settings')} data-state={isSettingsOpen ? 'open' : 'closed'}>
                    <Settings />
                    <span>Settings</span>
                </SidebarMenuButton>
                
                    <SidebarMenuSub open={isSettingsOpen}>
                        {settingsSubItems.map(subItem => (
                            <SidebarMenuSubItem key={subItem.label}>
                                <Link href={subItem.href} passHref legacyBehavior>
                                    <SidebarMenuSubButton isActive={isMenuItemActive(subItem.href)}>
                                        <subItem.icon />
                                        <span>{subItem.label}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                
            </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <ThemeToggle />
        </SidebarFooter>
      </Sidebar>
  );
}
