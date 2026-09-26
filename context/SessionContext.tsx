"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface UserSession {
  id: number;
  email: string;
  cabang: string;
  role: string;
  namaLengkap: string;
  namaPt: string;
  alamatCabang: string;
  roles: string[];
  isHO: boolean;
  isSuperHuman: boolean;
  isRegionalManager: boolean;
  isStoreControlling: boolean;
  akses_menu?: string | null;
}

interface SessionContextValue {
  user: UserSession | null;
  isLoading: boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const PUBLIC_PATHS = ['/login', '/api/auth'];

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      // call logout API if needed later, or clear cookies
      // for now, we just redirect to login which we can handle clearing cookie in middleware or login page
      document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setUser(null);
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
  }, [router]);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);

    const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

    if (isPublic) {
      setIsLoading(false);
      return () => { ignore = true; };
    }

    const hydrateSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            const fetchedUser = data.user;
            // Map the token data to the UserSession interface expected by the UI
            const sessionUser: UserSession = {
              id: fetchedUser.id,
              email: fetchedUser.email,
              cabang: fetchedUser.cabang,
              role: fetchedUser.role,
              namaLengkap: fetchedUser.email.split('@')[0],
              namaPt: fetchedUser.nama_pt || '',
              alamatCabang: '',
              roles: [fetchedUser.role],
              isHO: fetchedUser.cabang?.toUpperCase() === 'HO',
              isSuperHuman: false,
              isRegionalManager: false,
              isStoreControlling: false,
              akses_menu: fetchedUser.akses_menu || null,
            };
            if (!ignore) {
              setUser(sessionUser);
              setIsLoading(false);
            }
          } else {
            throw new Error('Not authenticated');
          }
        } else {
          throw new Error('Not authenticated');
        }
      } catch (error) {
        if (!ignore) {
          setUser(null);
          setIsLoading(false);
          router.push('/login');
        }
      }
    };

    hydrateSession();

    return () => {
      ignore = true;
    };
  }, [pathname, router]);

  return (
    <SessionContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession() must be called inside <SessionProvider>');
  }
  return ctx;
}
