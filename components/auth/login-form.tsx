"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/');
            } else {
                setError(data.message || 'Gagal login. Silakan periksa kembali email dan password Anda.');
            }
        } catch (err) {
            setError('Terjadi kesalahan jaringan.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleLogin} className="flex flex-col gap-6 w-full max-w-md mx-auto">
            {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    {error}
                </div>
            )}

            <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Email Akses</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Mail className="h-5 w-5" />
                    </div>
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@.com"
                        className="pl-10 pr-3 py-5 bg-gray-50/50 text-gray-900 border-gray-300 focus-visible:ring-[#E65F2B] focus-visible:border-transparent rounded-lg"
                        required
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Password (Nama Cabang)</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Lock className="h-5 w-5" />
                    </div>
                    <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Nama Cabang"
                        className="pl-10 pr-10 py-5 bg-gray-50/50 text-gray-900 border-gray-300 focus-visible:ring-[#E65F2B] focus-visible:border-transparent rounded-lg"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                        ) : (
                            <Eye className="h-5 w-5" />
                        )}
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Masukkan nama cabang sebagai password</p>
            </div>

            <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#E65F2B] text-white py-5 rounded-lg font-semibold hover:bg-[#C95325] mt-2 shadow-sm disabled:opacity-70"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        Memproses...
                    </>
                ) : 'Masuk ke Sistem'}
            </Button>
        </form>
    );
}
