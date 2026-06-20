'use client';

import AppShell from '../../components/AppShell';

export default function LernendeMatrixPage() {
  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Meine Matrix</div>
      <div className="page-head">
        <div>
          <h1>Meine Matrix</h1>
          <p>Dein Kompetenzraster mit Status &amp; Fortschritt</p>
        </div>
        <div className="seg" role="group" aria-label="Ansicht">
          <button aria-pressed="true">Matrix</button>
          <button aria-pressed="false">Lernpfad</button>
        </div>
      </div>

      <div className="cards">
        <div className="card">
          <div className="k">Gesamtfortschritt</div>
          <div className="v">–</div>
          <div className="d">noch keine Daten</div>
        </div>
        <div className="card">
          <div className="k">Punkte total</div>
          <div className="v">–</div>
          <div className="d">folgt in Sprint 5</div>
        </div>
        <div className="card">
          <div className="k">In Bewertung</div>
          <div className="v">–</div>
          <div className="d">folgt in Sprint 5</div>
        </div>
        <div className="card">
          <div className="k">Zu erledigen</div>
          <div className="v">–</div>
          <div className="d">folgt in Sprint 4</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Kompetenzbänder</h2>
        </div>
        <div className="empty">
          <span className="ic">▦</span>
          <p>
            Sobald du einer Klasse beigetreten bist, erscheint hier deine
            <br />
            persönliche Kompetenzmatrix mit Punkten und Status.
          </p>
          <p style={{ marginTop: '1rem' }}>
            Der Klassenbeitritt per Code folgt in Sprint 3 (FA-23).
          </p>
        </div>
      </div>
    </AppShell>
  );
}
