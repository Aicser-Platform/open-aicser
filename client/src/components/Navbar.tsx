'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useUserStore } from '@/store/user.store';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

const CE_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
];

const EE_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/audit-log', label: 'Audit Log' },
  { href: '/rbac', label: 'Roles & Permissions' },
  { href: '/billing', label: 'Billing' },
  { href: '/settings', label: 'Settings' },
];

const NAV_LINKS = isEE ? EE_LINKS : CE_LINKS;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { clearMe } = useUserStore();

  async function handleLogout() {
    clearMe();
    await logout();
    router.push('/login');
  }

  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-gray-900">
          Open Aicser{' '}
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isEE ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
            {isEE ? 'EE' : 'CE'}
          </span>
        </span>
        <div className="flex gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname === link.href
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-800"
      >
        Logout
      </button>
    </nav>
  );
}
