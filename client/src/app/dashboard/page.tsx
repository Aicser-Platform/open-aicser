'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useUserStore } from '@/store/user.store';

export default function DashboardPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { me, loading, error, fetchMe, clearMe } = useUserStore();

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    fetchMe().catch(() => {
      clearMe();
      router.push('/login');
    });
  }, [token, router, fetchMe, clearMe]);

  if (loading || !me) return <p className="p-8 text-gray-500">Loading…</p>;
  if (error) return <p className="p-8 text-red-600">{error}</p>;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500 w-16">Name</dt>
              <dd>{me.full_name || '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-16">Email</dt>
              <dd>{me.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-16">Admin</dt>
              <dd>{me.is_admin ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
