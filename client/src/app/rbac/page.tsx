'use client';

import { redirect } from 'next/navigation';
import { RbacManager } from '@/ee';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

export default function RbacRoute() {
  if (!isEE) redirect('/dashboard');
  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Roles & Permissions</h1>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <RbacManager />
        </div>
      </div>
    </div>
  );
}
