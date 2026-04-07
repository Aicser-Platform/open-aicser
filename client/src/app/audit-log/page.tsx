'use client';

import { redirect } from 'next/navigation';
import { AuditLogPage } from '@/ee';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

export default function AuditLogRoute() {
  if (!isEE) redirect('/dashboard');
  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Audit Log</h1>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <AuditLogPage />
        </div>
      </div>
    </div>
  );
}
