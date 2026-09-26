import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-dc-dev');

export async function createSession(user: { id: number; email: string; cabang: string; role: string; nama_pt?: string; akses_menu?: string | null }) {
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

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
    
    if (!token) return null;

    try {
        const verified = await jwtVerify(token.value, SECRET_KEY);
        return verified.payload.user;
    } catch (e) {
        return null;
    }
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete('token');
}
