import type { Metadata } from 'next';
import './globals.css';
import ToastProvider from '../components/ToastProvider';

export const metadata: Metadata = {
  title: 'KompetenzHub',
  description: 'Kompetenzorientierte Lern- und Bewertungsplattform',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="de">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
