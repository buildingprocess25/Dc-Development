import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lingkup = searchParams.get('lingkup') || 'SIPIL';

    const items = await prisma.mh_master_item.findMany({
      where: { lingkup },
      include: {
        item_cabang: true
      },
      orderBy: { id: 'asc' }
    });

    return NextResponse.json({ status: 'success', data: items });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
