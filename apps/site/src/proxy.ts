import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

// Locale prefix on every page (`/` → `/en`); `/api/*` is the forwarding
// route to the server, never a page. Comparison snapshots are static .json files.
// `/apple-icon` (issue #480) is the metadata file without an extension in its path.
export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|_vercel|apple-icon|.*\\..*).*)'],
};
