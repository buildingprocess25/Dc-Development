import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const dbUser = await prisma.dc_users.findUnique({
            where: { id: session.id }
        });

        const userData = dbUser ? {
            ...session,
            cabang: dbUser.cabang,
            role: dbUser.role,
            coverage_cabang: dbUser.coverage_cabang,
            akses_menu: dbUser.akses_menu
        } : session;

        return NextResponse.json({ authenticated: true, user: userData });
    } catch (error) {
        return NextResponse.json({ authenticated: false }, { status: 500 });
    }
}
