'use client';

import Link from 'next/link';
import AppShell from '../../components/AppShell';

export default function LehrerDashboardPage() {
  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Dashboard</div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Willkommen zurück · Übersicht über deine Klassen und Module</p>
        </div>
        <Link href="/modules" className="btn primary">
          + Modul &amp; Matrix
        </Link>
      </div>

      <div className="cards">
        <div className="card">
          <div className="k">Module</div>
          <div className="v">–</div>
          <div className="d">noch keine Daten</div>
        </div>
        <div className="card">
          <div className="k">Klassen</div>
          <div className="v">–</div>
          <div className="d">folgt in Sprint 3</div>
        </div>
        <div className="card">
          <div className="k">Zu bewerten</div>
          <div className="v">–</div>
          <div className="d">folgt in Sprint 5</div>
        </div>
        <div className="card">
          <div className="k">Ø Fortschritt</div>
          <div className="v">–</div>
          <div className="d">folgt in Sprint 6</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Klassen-Dashboard</h2>
        </div>
        <div className="empty">
          <span className="ic">▦</span>
          <p>
            Das Dashboard mit Fortschritts-Heatmap, Kennzahlen und Bewertungs-Queue
            <br />
            wird in einem späteren Sprint umgesetzt (FA-90..92).
          </p>
          <p style={{ marginTop: '1rem' }}>
            Starte jetzt mit{' '}
            <Link href="/modules">Module &amp; Matrizen</Link>, um eine Kompetenzmatrix
            anzulegen.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
