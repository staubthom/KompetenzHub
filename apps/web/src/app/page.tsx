'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, homePathForRole } from '../lib/session';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    router.replace(u ? homePathForRole(u) : '/login');
  }, [router]);

  return <div className="loading">Weiterleiten…</div>;
}
