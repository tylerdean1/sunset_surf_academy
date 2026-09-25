import { NextResponse } from 'next/server';

// Retired: notifications are sent by the booking creation route after persistence.
export async function POST() {
    return NextResponse.json({ error: 'Use /api/booking-requests' }, { status: 410 });
}
