import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lingkup = searchParams.get('lingkup') || 'SIPIL';
    const prefix = lingkup === 'SIPIL' ? 'SIP-' : 'ME-';

    const lastItem = await prisma.mh_master_item.findFirst({
      where: { lingkup },
      orderBy: { kode: 'desc' }
    });

    let nextKode = `${prefix}001`;
    if (lastItem && lastItem.kode && lastItem.kode.startsWith(prefix)) {
      const lastNum = parseInt(lastItem.kode.replace(prefix, ''), 10);
      if (!isNaN(lastNum)) {
        nextKode = `${prefix}${(lastNum + 1).toString().padStart(3, '0')}`;
      }
    }

    return NextResponse.json({ status: 'success', data: nextKode });
  } catch (error: any) {
    console.error('Next Code API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
