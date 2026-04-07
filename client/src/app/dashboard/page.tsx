'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe } from '@/lib/api';
import { clearToken, isAuthenticated } from '@/lib/auth';
import { SsoSettings } from '@/ee';
import { AuditLogPage } from '@/ee';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

type User = { id: number; email: string; full_name: string; is_admin: boolean };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken();
        router.push('/login');
      });
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  if (error) return <p className="p-8 text-red-600">{error}</p>;
  if (!user) return <p className="p-8 text-gray-500">Loading…</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-gray-500">
              Edition: <span className="font-medium">{process.env.NEXT_PUBLIC_EDITION ?? 'CE'}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Logout
          </button>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-2">Profile</h2>
          <p><span className="text-gray-500">Name:</span> {user.full_name || '—'}</p>
          <p><span className="text-gray-500">Email:</span> {user.email}</p>
          <p><span className="text-gray-500">Admin:</span> {user.is_admin ? 'Yes' : 'No'}</p>
        </div>

        {isEE && (
          <>
            <div className="rounded-lg bg-white p-6 shadow-sm mb-6">
              <SsoSettings />
            </div>
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <AuditLogPage />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
