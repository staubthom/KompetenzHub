import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KompetenzHub',
  description: 'Kompetenzorientierte Lern- und Bewertungsplattform',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
