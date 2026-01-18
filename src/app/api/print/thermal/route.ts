import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const billData = await request.json();
    
    // Forward the request to the local print service
    const printServiceResponse = await fetch('http://localhost:3001/print', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(billData),
    });

    if (printServiceResponse.ok) {
      const result = await printServiceResponse.json();
      return NextResponse.json({ message: 'Printing initiated successfully.', result });
    } else {
      // If the local service returned an error, forward that error
      const errorText = await printServiceResponse.text();
      console.error('Local Print Service Error:', errorText);
      return NextResponse.json({ message: 'Failed to print.', error: errorText || 'Local print service returned an error.' }, { status: printServiceResponse.status });
    }
  } catch (error: any) {
    // Catches errors from the fetch call itself (e.g., service not running)
    console.error('API Route Error fetching local print service:', error);
    return NextResponse.json({ message: 'An error occurred on the server.', error: 'Could not connect to the local print service. Is it running?' }, { status: 500 });
  }
}
