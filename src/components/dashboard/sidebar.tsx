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
  ClipboardPaste,
  Truck,
  CircleUser,
  LayoutDashboard,
  Briefcase,
  BookUser,
  BarChart3,
  FolderKanban,
  ChevronDown,
  Users2,
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
  SidebarMenuSubItem,
  useSidebar,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/DataContext';
import { ThemeToggle } from '../ui/theme-toggle';
import { cn } from '@/lib/utils';

const coreOperations = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/billing', label: 'Billing', icon: ClipboardList, exact: true },
  { href: '/dashboard/vehicle-bill', label: 'Vehicle Bill', icon: ClipboardPaste },
  { href: '/dashboard/party-bill', label: 'Party Bill', icon: BookUser },
  { href: '/dashboard/sales-report', label: 'Sales Report', icon: BarChart3 },
  { href: '/dashboard/payments', label: 'Payments', icon: Wallet },
];

const balancesSubItems = [
    { href: '/dashboard/balances/customer', label: 'Customer Balance', icon: Users },
    { href: '/dashboard/balances/party', label: 'Party Balance', icon: Briefcase },
];

const mastersSetup = [
  { href: '/dashboard/customers', label: 'Customers', icon: Users, roles: ['CREATOR', 'ADMIN'] },
  { href: '/dashboard/products', label: 'Products', icon: Fish, roles: ['CREATOR', 'ADMIN'] },
  { href: '/dashboard/prices', label: 'Set Prices', icon: IndianRupee, roles: ['CREATOR', 'ADMIN'] },
];

const manageSubItems = [
    { href: '/dashboard/users', label: 'Manage Users', icon: UserCog, roles: ['CREATOR'] },
    { href: '/dashboard/vehicles', label: 'Manage Vehicles', icon: Truck, roles: ['CREATOR', 'ADMIN'] },
    { href: '/dashboard/drivers', label: 'Manage Drivers', icon: CircleUser, roles: ['CREATOR', 'ADMIN'] },
    { href: '/dashboard/parties', label: 'Manage Parties', icon: Briefcase, roles: ['CREATOR', 'ADMIN'] },
];

const systemItems = [
  { href: '/dashboard/permissions', label: 'Permissions', icon: ShieldCheck, roles: ['CREATOR'] },
  { href: '/dashboard/profile', label: 'Profile', icon: User, exact: true },
];

const settingsSubItems = [
    { href: '/dashboard/settings/printer', label: 'Printer', icon: Printer },
    { href: '/dashboard/settings/uom', label: 'UOM', icon: Cuboid },
];

const MenuItemGroup = ({ items }) => {
    const pathname = usePathname();
    const { currentUser } = useData();
    const currentUserRole = currentUser?.role;
    const { setOpenMobile, setOpen } = useSidebar();

    const handleLinkClick = () => {
        // Automatically close/hide sidebar after menu item selection
        setOpen(false);
        setOpenMobile(false);
    };

    const isMenuItemActive = (href: string, exact = false) => {
        if (exact) {
            return pathname === href;
        }
        return pathname.startsWith(href);
    };

    return items.map((item) => 
        (!item.roles || (currentUserRole && item.roles.includes(currentUserRole))) && (
            <SidebarMenuItem key={item.label}>
                <Link href={item.href} onClick={handleLinkClick}>
                    <SidebarMenuButton as="div" isActive={isMenuItemActive(item.href, !!item.exact)}>
                        <item.icon />
                        <span>{item.label}</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
        )
    );
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const { currentUser } = useData();
  const currentUserRole = currentUser?.role;
  const { setOpenMobile, setOpen } = useSidebar();

  const [isBalancesOpen, setIsBalancesOpen] = React.useState(false);
  const [isManageOpen, setIsManageOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const handleLinkClick = () => {
    setOpen(false);
    setOpenMobile(false);
  };

  const isMenuItemActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    if (href === '/dashboard/balances') {
        return balancesSubItems.some(item => pathname.startsWith(item.href));
    }
    if (href === '/dashboard/manage') {
        return manageSubItems.some(item => pathname.startsWith(item.href));
    }
     if (href === '/dashboard/settings') {
        return settingsSubItems.some(item => pathname.startsWith(item.href));
    }
    return pathname.startsWith(href);
  };
  
  React.useEffect(() => {
    setIsBalancesOpen(isMenuItemActive('/dashboard/balances'));
    setIsManageOpen(isMenuItemActive('/dashboard/manage'));
    setIsSettingsOpen(isMenuItemActive('/dashboard/settings'));
    
    // Automatically collapse sidebar on ANY navigation (handles external triggers like "New Bill" button)
    setOpen(false);
    setOpenMobile(false);
  }, [pathname, setOpen, setOpenMobile]);

  const canShowBalances = balancesSubItems.some(item => !item.roles || (currentUserRole && item.roles.includes(currentUserRole)));
  const canShowManage = manageSubItems.some(item => !item.roles || (currentUserRole && item.roles.includes(currentUserRole)));
  const canShowSettings = settingsSubItems.some(item => !item.roles || (currentUserRole && item.roles.includes(currentUserRole)));


  return (
      <Sidebar>
        <SidebarHeader className="flex items-center justify-between p-2">
            <Button asChild variant="ghost" className="h-8 w-full justify-start gap-2 px-2">
                <Link href="/dashboard" onClick={handleLinkClick}>
                    <Fish className="size-5 text-primary" />
                    <span className="font-headline text-lg font-bold text-primary">MC Billing</span>
                </Link>
            </Button>
            <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <MenuItemGroup items={coreOperations} />
            {canShowBalances && (
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setIsBalancesOpen(!isBalancesOpen)} isActive={isBalancesOpen} data-state={isBalancesOpen ? 'open' : 'closed'}>
                    <Wallet />
                    <span>Balances</span>
                    <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 transition-transform duration-200", isBalancesOpen && "rotate-180")} />
                </SidebarMenuButton>
                <SidebarMenuSub open={isBalancesOpen}>
                    {balancesSubItems.map(subItem => (
                         (!subItem.roles || (currentUserRole && subItem.roles.includes(currentUserRole))) && (
                            <SidebarMenuSubItem key={subItem.label}>
                                <Link href={subItem.href} onClick={handleLinkClick}>
                                    <SidebarMenuSubButton isActive={isMenuItemActive(subItem.href)}>
                                        <subItem.icon />
                                        <span>{subItem.label}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuSubItem>
                         )
                    ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            )}
            <SidebarSeparator className="my-2" />
            <MenuItemGroup items={mastersSetup} />
            <SidebarSeparator className="my-2" />
            
            {canShowManage && (
              <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setIsManageOpen(!isManageOpen)} isActive={isManageOpen} data-state={isManageOpen ? 'open' : 'closed'}>
                      <FolderKanban />
                      <span>Manage</span>
                      <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 transition-transform duration-200", isManageOpen && "rotate-180")} />
                  </SidebarMenuButton>
                  <SidebarMenuSub open={isManageOpen}>
                      {manageSubItems.map(subItem => (
                          (!subItem.roles || (currentUserRole && subItem.roles.includes(currentUserRole))) && (
                            <SidebarMenuSubItem key={subItem.label}>
                                <Link href={subItem.href} onClick={handleLinkClick}>
                                    <SidebarMenuSubButton isActive={isMenuItemActive(subItem.href)}>
                                        <subItem.icon />
                                        <span>{subItem.label}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuSubItem>
                          )
                      ))}
                  </SidebarMenuSub>
              </SidebarMenuItem>
            )}

            <SidebarSeparator className="my-2" />
            <MenuItemGroup items={systemItems} />

            {canShowSettings && (
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setIsSettingsOpen(!isSettingsOpen)} isActive={isSettingsOpen} data-state={isSettingsOpen ? 'open' : 'closed'}>
                    <Settings />
                    <span>Settings</span>
                     <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 transition-transform duration-200", isSettingsOpen && "rotate-180")} />
                </SidebarMenuButton>
                <SidebarMenuSub open={isSettingsOpen}>
                    {settingsSubItems.map(subItem => (
                         (!subItem.roles || (currentUserRole && subItem.roles.includes(currentUserRole))) && (
                            <SidebarMenuSubItem key={subItem.label}>
                                <Link href={subItem.href} onClick={handleLinkClick}>
                                    <SidebarMenuSubButton isActive={isMenuItemActive(subItem.href)}>
                                        <subItem.icon />
                                        <span>{subItem.label}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuSubItem>
                         )
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
