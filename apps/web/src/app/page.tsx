import Link from 'next/link';

async function getHealth(): Promise<{
  status: string;
  db: string;
  version?: string;
} | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${base}/api/v1/health`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as { status: string; db: string; version?: string };
  } catch {
    return null;
  }
}

export default async function HomePage(): Promise<JSX.Element> {
  const health = await getHealth();
  const apiUp = health?.status === 'ok';
  const dbUp = health?.db === 'up';
  const systemOk = apiUp && dbUp;

  return (
    <main>
      <h1 className="logo">
        Kompetenz<span>Hub</span>
      </h1>
      <p className="tagline">Sprint 2 · Matrix-Editor</p>

      <section className="card">
        <div className="status-row">
          <span>System</span>
          <span className={`badge ${systemOk ? 'up' : 'down'}`}>
            {systemOk ? 'System OK' : 'System nicht verfügbar'}
          </span>
        </div>
        <div className="status-row">
          <span>API</span>
          <span className={`badge ${apiUp ? 'up' : 'down'}`}>
            {apiUp ? 'erreichbar' : 'offline'}
          </span>
        </div>
        <div className="status-row">
          <span>Datenbank</span>
          <span className={`badge ${dbUp ? 'up' : 'down'}`}>{dbUp ? 'verbunden' : 'getrennt'}</span>
        </div>
        {health?.version ? (
          <div className="status-row">
            <span>Version</span>
            <span>{health.version}</span>
          </div>
        ) : null}
      </section>

      {systemOk && (
        <Link href="/modules" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          → Module & Matrizen öffnen
        </Link>
      )}
    </main>
  );
}
