import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    // This is a proxy route. It takes the bill data from the Next.js client,
    // and forwards it to the local Node.js print service.
    // This is necessary to avoid CORS errors that happen when a secure (https)
    // client tries to talk to an insecure (http) local server.
    try {
        const billData = await request.json();

        // Forward the request to the local print service.
        const printServiceResponse = await fetch('http://localhost:3001/print', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(billData),
        });

        if (!printServiceResponse.ok) {
            // If the local service returns an error, forward that error back to the client.
            const errorBody = await printServiceResponse.text();
            console.error('Local print service error:', errorBody);
            return NextResponse.json(
                { message: 'Local print service failed', error: errorBody },
                { status: printServiceResponse.status }
            );
        }

        // If successful, return a success response to the Next.js client.
        return NextResponse.json({ message: 'Print job sent successfully' });

    } catch (error) {
        console.error('Error in thermal print proxy route:', error);
        // Handle network errors (e.g., if the local service is not running).
        if (error instanceof TypeError && error.message.includes('fetch failed')) {
             return NextResponse.json(
                { message: 'Cannot connect to local print service. Is it running?' },
                { status: 503 } // Service Unavailable
            );
        }
        // Handle other unexpected errors.
        return NextResponse.json(
            { message: 'An unexpected error occurred.', error: error.message },
            { status: 500 }
        );
    }
}
