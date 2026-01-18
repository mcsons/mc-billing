import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const errorMessage = "Direct thermal printing via a local service has been disabled. Please use the browser's standard print functionality.";
    console.warn('Deprecated API Route /api/print/thermal was called:', errorMessage);
    return NextResponse.json(
        { 
            message: 'Feature Disabled', 
            error: errorMessage
        }, 
        { status: 410 } // 410 Gone
    );
}
