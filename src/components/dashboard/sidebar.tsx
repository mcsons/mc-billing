
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Package,
  FileBarChart2,
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
import { useLoading } from '@/context/LoadingContext';
import { useBillingGuard } from '@/context/BillingGuardContext';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';

/** Maps a nav item label to a contextual loading message */
function getNavLoadingMessage(label: string): string {
  const openingItems = [
    'Dashboard', 'Billing', 'Vehicle Bill', 'Party Bill', 'Payments', 'Profile',
    'Box Billing', 'Box Balance', 'Reports',
  ];
  if (openingItems.includes(label)) return `Opening ${label.toLowerCase()}...`;
  return `Loading ${label.toLowerCase()}...`;
}

const coreOperationsTop = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/billing', label: 'Billing', icon: ClipboardList, exact: true },
];

const coreOperationsBottom = [
  { href: '/dashboard/vehicle-bill', label: 'Vehicle Bill', icon: ClipboardPaste },
  { href: '/dashboard/sales-report', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/payments', label: 'Payments', icon: IndianRupee },
  { href: '/dashboard/cust-statement', label: 'Cust Statement', icon: History },
];

const boxBillSubItems: NavItem[] = [
  { href: '/dashboard/box-billing', label: 'Box Billing', icon: Package },
  { href: '/dashboard/party-box-billing', label: 'Party Box Billing', icon: Package },
  { href: '/dashboard/empty-box-entry', label: 'Empty Box Entry', icon: Package },
  { href: '/dashboard/box-reports', label: 'Reports', icon: FileBarChart2 },
  { href: '/dashboard/party-box-reports', label: 'Party Reports', icon: FileBarChart2 },
  { href: '/dashboard/box-balance', label: 'Box Balance', icon: Wallet },
  { href: '/dashboard/party-box-balance', label: 'Party Box Balance', icon: Wallet },
];

const partyBillSubItems: NavItem[] = [
  { href: '/dashboard/party-bill', label: 'Party Billing', icon: BookUser },
  { href: '/dashboard/party-reports', label: 'Party Reports', icon: FileBarChart2 },
  { href: '/dashboard/balances/party', label: 'Party Balance', icon: Briefcase },
  { href: '/dashboard/party-payments', label: 'Party Payments', icon: IndianRupee },
];

const custBalanceItem: NavItem = { href: '/dashboard/balances/customer', label: 'Cust Balance', icon: Users };

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

const settingsSubItems: NavItem[] = [
    { href: '/dashboard/settings/printer', label: 'Printer', icon: Printer },
    { href: '/dashboard/settings/uom', label: 'UOM', icon: Cuboid },
];

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  roles?: string[];
};

const MenuItemGroup = ({ items }: { items: NavItem[] }) => {
    const pathname = usePathname();
    const { currentUser, rolePermissions } = useData();
    const { setLoading } = useLoading();
    const currentUserRole = currentUser?.role;
    const { guardedNavigate } = useGuardedNav();

    const isNavAllowed = (itemLabel: string) => {
      if (!currentUserRole) return false;
      if (currentUserRole === 'CREATOR') return true;
      if (!rolePermissions || !rolePermissions[currentUserRole]) return false;
      
      let permLabel = itemLabel;
      if (itemLabel === 'Cust Statement') permLabel = 'Bill History';
      if (itemLabel === 'Printer') permLabel = 'Printer Settings';
      if (itemLabel === 'UOM') permLabel = 'UOM Settings';
      if (itemLabel === 'Reports') permLabel = 'Sales Report';
      if (itemLabel === 'Party Reports') permLabel = 'Party Bill';
      if (itemLabel === 'Party Billing') permLabel = 'Party Bill';
      if (itemLabel === 'Party Box Reports') permLabel = 'Party Bill';
      if (itemLabel === 'Cust Balance') permLabel = 'Customer Balance';
      if (itemLabel === 'Party Payments') permLabel = 'Party Bill';

      return rolePermissions[currentUserRole].includes(permLabel as any);
  };

    const isMenuItemActive = (href: string, exact = false) => {
        if (exact) {
            return pathname === href;
        }
        return pathname.startsWith(href);
    };

    // Clear the loader as soon as navigation completes (pathname changes)
    React.useEffect(() => {
        setLoading(false);
    }, [pathname, setLoading]);

    return items.map((item) => 
        (isNavAllowed(item.label)) && (
            <SidebarMenuItem key={item.label}>
                <SidebarMenuButton asChild isActive={isMenuItemActive(item.href, !!item.exact)}>
                    <Link
                      href={item.href}
                      onClick={(e) => {
                        e.preventDefault();
                        guardedNavigate(item.href, item.label);
                      }}
                    >
                        <item.icon />
                        <span>{item.label}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        )
    );
};

// ── Guarded Navigation Context (scoped to sidebar) ────────────────────
type GuardedNavCtx = {
  guardedNavigate: (href: string, label: string) => void;
};
const GuardedNavContext = React.createContext<GuardedNavCtx>({
  guardedNavigate: () => {},
});
const useGuardedNav = () => React.useContext(GuardedNavContext);

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, rolePermissions } = useData();
  const currentUserRole = currentUser?.role;
  const { setOpenMobile, setOpen } = useSidebar();
  const { setLoading } = useLoading();
  const billingGuard = useBillingGuard();
  
  // Track the last pathname to only trigger auto-close on actual navigation
  const lastPathnameRef = React.useRef(pathname);

  const [isBalancesOpen, setIsBalancesOpen] = React.useState(false);
  const [isManageOpen, setIsManageOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isBoxBillOpen, setIsBoxBillOpen] = React.useState(false);
  const [isPartyBillOpen, setIsPartyBillOpen] = React.useState(false);

  // ── Unsaved changes dialog state ──────────────────────────────────────
  const [guardDialog, setGuardDialog] = React.useState<{
    open: boolean;
    targetHref: string;
    targetLabel: string;
  }>({ open: false, targetHref: '', targetLabel: '' });

  const navigateTo = React.useCallback((href: string, label: string) => {
    setLoading(true, getNavLoadingMessage(label));
    router.push(href);
  }, [router, setLoading]);

  const guardedNavigate = React.useCallback((href: string, label: string) => {
    // If we're on the billing page and there are unsaved changes
    const isOnBilling = pathname === '/dashboard/billing';
    const isOnBoxBilling = pathname === '/dashboard/box-billing';
    
    if ((isOnBilling || isOnBoxBilling) && billingGuard.hasUnsavedChanges && href !== pathname) {
      setGuardDialog({ open: true, targetHref: href, targetLabel: label });
      return;
    }
    navigateTo(href, label);
  }, [pathname, billingGuard.hasUnsavedChanges, navigateTo]);

  const handleGuardSaveAndContinue = React.useCallback(async () => {
    setGuardDialog(prev => ({ ...prev, open: false }));
    const saveFn = billingGuard.saveBillRef.current;
    if (saveFn) {
      const success = await saveFn();
      if (success) {
        navigateTo(guardDialog.targetHref, guardDialog.targetLabel);
      }
      // If save fails, stay on billing (dialog already closed, user sees the toast)
    }
  }, [billingGuard.saveBillRef, guardDialog.targetHref, guardDialog.targetLabel, navigateTo]);

  const handleGuardContinueWithout = React.useCallback(() => {
    setGuardDialog(prev => ({ ...prev, open: false }));
    billingGuard.setHasUnsavedChanges(false);
    navigateTo(guardDialog.targetHref, guardDialog.targetLabel);
  }, [billingGuard, guardDialog.targetHref, guardDialog.targetLabel, navigateTo]);

  const handleGuardCancel = React.useCallback(() => {
    setGuardDialog(prev => ({ ...prev, open: false }));
  }, []);

  const guardedNavValue = React.useMemo(() => ({ guardedNavigate }), [guardedNavigate]);
  // ─────────────────────────────────────────────────────────────────────

  const isMenuItemActive = React.useCallback((href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    if (href === '/dashboard/manage') {
        return manageSubItems.some(item => pathname.startsWith(item.href));
    }
    if (href === '/dashboard/settings') {
        return settingsSubItems.some(item => pathname.startsWith(item.href));
    }
    if (href === '/dashboard/box-bill') {
        return boxBillSubItems.some(item => pathname.startsWith(item.href));
    }
    if (href === '/dashboard/party-bill-menu') {
      return partyBillSubItems.some(item => pathname.startsWith(item.href));
    }
    return pathname.startsWith(href);
  }, [pathname]);
  
  React.useEffect(() => {
    // Only apply automatic show/hide rules if the navigation path has changed
    // This allows manual toggle clicks to stay in their chosen state while on one page
    if (lastPathnameRef.current !== pathname) {
        if (pathname === '/dashboard') {
            setOpen(true);
        } else {
            setOpen(false);
            setOpenMobile(false);
        }
        lastPathnameRef.current = pathname;
    }

    // Always keep sub-menus synced with active section
    setIsManageOpen(isMenuItemActive('/dashboard/manage'));
    setIsSettingsOpen(isMenuItemActive('/dashboard/settings'));
    setIsBoxBillOpen(isMenuItemActive('/dashboard/box-bill'));
    setIsPartyBillOpen(isMenuItemActive('/dashboard/party-bill-menu'));
  }, [pathname, isMenuItemActive, setOpen, setOpenMobile]);

  const isNavAllowed = React.useCallback((itemLabel: string) => {
    if (!currentUserRole) return false;
    if (currentUserRole === 'CREATOR') return true;
    if (!rolePermissions || !rolePermissions[currentUserRole]) return false;
    
    let permLabel = itemLabel;
    if (itemLabel === 'Cust Statement') permLabel = 'Bill History';
    if (itemLabel === 'Printer') permLabel = 'Printer Settings';
    if (itemLabel === 'UOM') permLabel = 'UOM Settings';
    if (itemLabel === 'Reports') permLabel = 'Sales Report';
    if (itemLabel === 'Party Reports') permLabel = 'Party Bill';
    if (itemLabel === 'Party Box Reports') permLabel = 'Party Bill';
    if (itemLabel === 'Party Billing') permLabel = 'Party Bill';
    if (itemLabel === 'Party Payments') permLabel = 'Party Bill';
    if (itemLabel === 'Cust Balance') permLabel = 'Customer Balance';

    return rolePermissions[currentUserRole].includes(permLabel as any);
}, [currentUserRole, rolePermissions]);

const canShowBoxBill = boxBillSubItems.some(item => isNavAllowed(item.label));
const canShowPartyBill = partyBillSubItems.some(item => isNavAllowed(item.label));
const canShowCustBalance = isNavAllowed(custBalanceItem.label);
const canShowManage = manageSubItems.some(item => isNavAllowed(item.label));
const canShowSettings = settingsSubItems.some(item => isNavAllowed(item.label));


  return (
    <GuardedNavContext.Provider value={guardedNavValue}>
      <Sidebar>
        <SidebarHeader className="flex items-center justify-between p-2">
            <Button asChild variant="ghost" className="h-8 w-full justify-start gap-2 px-2">
                <Link href="/dashboard">
                    <Fish className="size-5 text-primary" />
                    <span className="font-headline text-lg font-bold text-primary">MC Billing</span>
                </Link>
            </Button>
            <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <MenuItemGroup items={coreOperationsTop} />
            {canShowBoxBill && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setIsBoxBillOpen(!isBoxBillOpen)} isActive={isBoxBillOpen} data-state={isBoxBillOpen ? 'open' : 'closed'}>
                  <Package />
                  <span>Box Bill</span>
                  <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 transition-transform duration-200", isBoxBillOpen && "rotate-180")} />
              </SidebarMenuButton>
              <SidebarMenuSub open={isBoxBillOpen}>
                  {boxBillSubItems.map(subItem => (
                      isNavAllowed(subItem.label) && (
                      <SidebarMenuSubItem key={subItem.label}>
                          <Link
                            href={subItem.href}
                            onClick={(e) => {
                              e.preventDefault();
                              guardedNavigate(subItem.href, subItem.label);
                            }}
                          >
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
            {canShowPartyBill && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setIsPartyBillOpen(!isPartyBillOpen)} isActive={isPartyBillOpen} data-state={isPartyBillOpen ? 'open' : 'closed'}>
                  <BookUser />
                  <span>Party Bill</span>
                  <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 transition-transform duration-200", isPartyBillOpen && "rotate-180")} />
              </SidebarMenuButton>
              <SidebarMenuSub open={isPartyBillOpen}>
                  {partyBillSubItems.map(subItem => (
                      isNavAllowed(subItem.label) && (
                      <SidebarMenuSubItem key={subItem.label}>
                          <Link
                            href={subItem.href}
                            onClick={(e) => {
                              e.preventDefault();
                              guardedNavigate(subItem.href, subItem.label);
                            }}
                          >
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
            <MenuItemGroup items={coreOperationsBottom} />
            {canShowCustBalance && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isMenuItemActive(custBalanceItem.href)}>
                  <Link href={custBalanceItem.href} onClick={(e) => { e.preventDefault(); guardedNavigate(custBalanceItem.href, custBalanceItem.label); }}>
                    <custBalanceItem.icon />
                    <span>{custBalanceItem.label}</span>
                  </Link>
                </SidebarMenuButton>
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
                          isNavAllowed(subItem.label) && (
                            <SidebarMenuSubItem key={subItem.label}>
                                <Link
                                  href={subItem.href}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    guardedNavigate(subItem.href, subItem.label);
                                  }}
                                >
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
                         isNavAllowed(subItem.label) && (
                            <SidebarMenuSubItem key={subItem.label}>
                                <Link
                                  href={subItem.href}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    guardedNavigate(subItem.href, subItem.label);
                                  }}
                                >
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

      {/* Unsaved Billing Changes — 3-option Dialog */}
      <AlertDialog open={guardDialog.open} onOpenChange={(open) => { if (!open) handleGuardCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Bill</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved bill in progress. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleGuardSaveAndContinue} className="w-full">
              Save Bill &amp; Continue
            </Button>
            <Button variant="secondary" onClick={handleGuardContinueWithout} className="w-full">
              Continue Without Saving
            </Button>
            <Button variant="outline" onClick={handleGuardCancel} className="w-full">
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GuardedNavContext.Provider>
  );
}
