'use client';

import { redirect } from 'next/navigation';
import { BillingPage } from '@/ee';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

export default function BillingRoute() {
  if (!isEE) redirect('/dashboard');
  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Billing</h1>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <BillingPage />
        </div>
      </div>
    </div>
  );
}
