import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

const handleLocale = createMiddleware({
  locales: ['en', 'es'],
  defaultLocale: 'en'
});

export default function proxy(request: NextRequest) {
  return handleLocale(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
