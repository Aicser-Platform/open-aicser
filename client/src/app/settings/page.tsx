import { SsoSettings } from '@/ee';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

export default function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      {isEE && <SsoSettings />}
    </div>
  );
}
