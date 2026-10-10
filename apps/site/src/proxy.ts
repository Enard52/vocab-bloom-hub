import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

// Locale prefix on every page (`/` → `/en`); `/api/*` is the forwarding
// route to the server, never a page. /comparison-response fetches the original
// service for the migration comparison; it also has no locale prefix.
// `/apple-icon` (issue #480) is the metadata file without an extension in its path.
export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|comparison-response(?:/|$)|_next|_vercel|apple-icon|.*\\..*).*)'],
};
