import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();
        
        const user = await prisma.dc_users.findUnique({
            where: { email }
        });

        if (!user) {
            return NextResponse.json({ status: 'error', message: 'Email tidak ditemukan.' }, { status: 404 });
        }

        if (password !== user.cabang) {
            return NextResponse.json({ status: 'error', message: 'Password salah.' }, { status: 401 });
        }

        // Update last_login
        await prisma.dc_users.update({
            where: { id: user.id },
            data: { last_login: new Date() }
        });

        await createSession({
            id: user.id,
            email: user.email,
            cabang: user.cabang,
            role: user.role,
            nama_pt: user.nama_pt || ''
        });

        return NextResponse.json({ status: 'success', data: user });
    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
