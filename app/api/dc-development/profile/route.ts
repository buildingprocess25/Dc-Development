import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const profiles = await prisma.dc_project.findMany({
      orderBy: { created_at: 'asc' }
    });

    return NextResponse.json({ status: 'success', data: profiles });
  } catch (error: any) {
    console.error("Error fetching profiles:", error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
