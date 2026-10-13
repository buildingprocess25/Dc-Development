import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-dc-dev');

export async function createSession(user: { id: number; email: string; cabang: string; role: string; nama_pt?: string; akses_menu?: string | null; coverage_cabang?: string | null }) {
    const token = await new SignJWT({ user })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(SECRET_KEY);

    const cookieStore = await cookies();
    cookieStore.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
}

export async function getSession(): Promise<{ id: number; email: string; cabang: string; role: string; nama_pt?: string; akses_menu?: string | null; coverage_cabang?: string | null } | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
    
    if (!token) return null;

    try {
        const verified = await jwtVerify(token.value, SECRET_KEY);
        const user = verified.payload.user as any;
        if (!user || !user.id) return null;

        // Ambil data profil terbaru dari database agar coverage_cabang dan role selalu up-to-date
        try {
            const dbUser = await prisma.dc_users.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    email: true,
                    cabang: true,
                    role: true,
                    nama_pt: true,
                    akses_menu: true,
                    coverage_cabang: true
                }
            });

            if (dbUser) {
                return {
                    ...user,
                    cabang: dbUser.cabang,
                    role: dbUser.role,
                    nama_pt: dbUser.nama_pt || '',
                    akses_menu: dbUser.akses_menu,
                    coverage_cabang: dbUser.coverage_cabang
                };
            }
        } catch (dbErr) {
            console.warn('Gagal membaca data dbUser di getSession, fallback ke token payload:', dbErr);
        }

        return user;
    } catch (e) {
        return null;
    }
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete('token');
}
