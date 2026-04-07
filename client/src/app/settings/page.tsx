'use client';

import { SsoSettings } from '@/ee';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="rounded-lg bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-2">General</h2>
          <p className="text-sm text-gray-500">General settings coming soon.</p>
        </div>
        {isEE && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">SSO Configuration</h2>
            <SsoSettings />
          </div>
        )}
      </div>
    </div>
  );
}
