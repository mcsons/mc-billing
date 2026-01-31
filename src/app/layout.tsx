import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { DataProvider } from '@/context/DataContext';
import { ThemeProvider } from './theme-provider';
import { FirebaseClientProvider } from '@/firebase';
import myIcon from "./img.png"; 

export const metadata: Metadata = {
  title: 'MC Billing',
  description: 'Billing System for M.C & SONS FISH COMPANY',
  icons: {
    icon: "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3cstyle%3e.db%7bfill:%23293A4F;%7d.t%7bfill:%232A9D8F;%7d%3c/style%3e%3cpath class='t' d='M36.63 81.33c11.95-3.15 23.9-3.15 35.85 0' stroke='%232A9D8F' stroke-width='5' stroke-linecap='round'/%3e%3cpath class='t' d='M29.63 88.33c11.95-3.15 23.9-3.15 35.85 0' stroke='%232A9D8F' stroke-width='5' stroke-linecap='round'/%3e%3cpath class='db' d='M88.9,38.82C88.9,19.32,72.4,3.82,51.9,3.82c-20.5,0-37,15.5-37,35s16.5,35,37,35c13,0,22.5-7,27-16h-13c-4.5,5-9.5,8-14,8c-12,0-22-11-22-25s10-25,22-25c12,0,22,11,22,25c0,3.3-0.6,6.5-1.8,9.5l11.2,4.5C87.9,48.82,88.9,44.12,88.9,38.82z'/%3e%3cpath class='t' d='M68.4,7.82c-5.5-2-11.5-2.5-17.5-2.5c-10,0-19.5,3.5-27,9.5l5.5,10.5c5.5-4,12-6.5,19-6.5c4.5,0,9,1,13,2.5L68.4,7.82z'/%3e%3cpath class='db' d='M90,38.82l10-2l-10-2V38.82z'/%3e%3ccircle cx='87' cy='36.82' r='2' fill='white'/%3e%3cpath class='t' d='M47.9,59.82c-3,2-4,5-2,7s5,2,7-1s3-5,1-7S50.9,57.82,47.9,59.82z'/%3e%3ctext x='50' y='55' font-family='Space Grotesk, sans-serif' font-size='32' font-weight='bold' fill='white' text-anchor='middle'%3eMC%3c/text%3e%3c/svg%3e",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('font-body antialiased')}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          <FirebaseClientProvider>
            {children}
            <Toaster />
          </FirebaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
