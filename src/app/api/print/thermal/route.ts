import { NextResponse } from 'next/server';
import { printThermalBill } from '@/lib/thermal-printer';

export async function POST(request: Request) {
  try {
    const billData = await request.json();
    
    // The print function is async and we await its result
    const result = await printThermalBill(billData);

    if (result.success) {
      return NextResponse.json({ message: 'Printing initiated successfully.' });
    } else {
      // If the printer function threw a specific error, return it
      return NextResponse.json({ message: 'Failed to print.', error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    // Catches errors from JSON parsing or other unexpected issues in the API route itself
    console.error('API Print Route Error:', error);
    return NextResponse.json({ message: 'An error occurred on the server while processing the print request.', error: error.message }, { status: 500 });
  }
}
