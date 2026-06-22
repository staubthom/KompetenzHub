import type { Metadata } from 'next';
import './globals.css';
import ToastProvider from '../components/ToastProvider';
import { LocaleProvider } from '../lib/i18n';

export const metadata: Metadata = {
  title: 'KompetenzHub',
  description: 'Kompetenzorientierte Lern- und Bewertungsplattform',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="de">
      <body>
        <LocaleProvider>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
