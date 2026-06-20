'use client';

import AppShell from './AppShell';

interface ComingSoonProps {
  title: string;
  subtitle?: string;
  sprint: string;
  icon?: string;
}

/** Platzhalterseite für noch nicht umgesetzte Navigationsziele. */
export default function ComingSoon({ title, subtitle, sprint, icon = '🚧' }: ComingSoonProps) {
  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="panel">
        <div className="empty">
          <span className="ic">{icon}</span>
          <p>
            Diese Funktion wird in <strong>{sprint}</strong> umgesetzt.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
