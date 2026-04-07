import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Open Aicser</h1>
      <p className="text-gray-600 mb-8">
        Edition: {process.env.NEXT_PUBLIC_EDITION ?? 'CE'}
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Login
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
