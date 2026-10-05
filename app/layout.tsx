import './globals.css';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get('x-next-intl-locale') === 'es' ? 'es' : 'en';
  return (
    <html lang={locale}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
