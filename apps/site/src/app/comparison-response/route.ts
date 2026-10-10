import { COMPARISON_WORDS, comparisonUrls } from '@/components/MigrationComparison/data';

export const runtime = 'nodejs';

/** Fixed services and the ten comparison words only; never forward browser headers or arbitrary URLs. */
export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const service = query.get('service');
  const word = query.get('word');
  const version = query.get('version');
  const translations = query.get('translations');
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (
    (service !== 'dictionaryapi' && service !== 'freedictionaryapi') ||
    !word ||
    !COMPARISON_WORDS.includes(word) ||
    (version !== 'v1' && version !== 'v2') ||
    (service === 'freedictionaryapi' && version !== 'v1') ||
    (translations !== 'true' && translations !== 'false') ||
    (service === 'dictionaryapi' && translations !== 'false') ||
    [...query.keys()].some(
      (key) => !['service', 'word', 'version', 'translations'].includes(key) || query.getAll(key).length !== 1,
    )
  )
    return Response.json({ message: 'Invalid comparison request' }, { status: 400, headers });

  const { original } = comparisonUrls(service, word, translations === 'true', '/api', version);
  const signal = AbortSignal.timeout(15000);
  try {
    const response = await fetch(original, {
      signal,
      redirect: 'error',
      // Successful responses are shared for one minute to reduce upstream rate-limit usage.
      next: { revalidate: 60 },
    });
    const body = await response.text();
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status,
      headers: {
        ...headers,
        'Content-Type': response.headers.get('content-type')?.includes('application/json')
          ? 'application/json; charset=utf-8'
          : 'text/plain; charset=utf-8',
        ...(response.headers.has('retry-after') ? { 'Retry-After': response.headers.get('retry-after')! } : {}),
      },
    });
  } catch {
    return Response.json(
      {
        message: signal.aborted
          ? 'The original service did not respond within 15 seconds.'
          : 'The original service could not be reached.',
        source: original,
      },
      { status: signal.aborted ? 504 : 502, headers },
    );
  }
}
