export const COMPARISON_WORDS = [
  'hello',
  'run',
  'bank',
  'light',
  'bright',
  'freedom',
  'serendipity',
  'computer',
  'water',
  'Polish',
];

export type ComparisonServiceT = 'dictionaryapi' | 'freedictionaryapi';
export type DictionaryApiVersionT = 'v1' | 'v2';

export const originalService = {
  dictionaryapi: { name: 'dictionaryapi.dev', home: 'https://dictionaryapi.dev' },
  freedictionaryapi: { name: 'FreeDictionaryAPI.com', home: 'https://freedictionaryapi.com' },
} as const;

export const comparisonUrls = (
  service: ComparisonServiceT,
  word: string,
  translations: boolean,
  apiBase: string,
  version: DictionaryApiVersionT = 'v2',
) => {
  const path = `/entries/en/${encodeURIComponent(word)}`;
  const query = service === 'freedictionaryapi' ? `?translations=${translations}` : '';
  return {
    original:
      service === 'dictionaryapi'
        ? `https://api.dictionaryapi.dev/api/${version}${path}`
        : `https://freedictionaryapi.com/api/v1${path}${query}`,
    datasets: `${apiBase.replace(/\/$/, '')}/compat/${service}/${service === 'dictionaryapi' ? version : 'v1'}${path}/datasets${query}`,
  };
};

export type ResponseT = { status: number; body: unknown };
export type DatasetResponseT = ResponseT & {
  dataset: string;
  title: string;
  active: boolean;
  terms: Record<string, unknown>;
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Reject a failed/older server's response instead of presenting it as an empty dictionary. */
export const datasetResponses = (response: ResponseT): DatasetResponseT[] | null => {
  if (response.status !== 200 || !record(response.body) || !Array.isArray(response.body.data)) return null;
  const groups: DatasetResponseT[] = [];
  for (const row of response.body.data) {
    if (
      !record(row) ||
      typeof row.dataset !== 'string' ||
      typeof row.status !== 'number' ||
      !('response' in row)
    )
      return null;
    const { response: body, status, ...terms } = row;
    groups.push({
      dataset: row.dataset,
      title: typeof row.title === 'string' ? row.title : row.dataset,
      active: row.active === true,
      status,
      body,
      terms,
    });
  }
  return groups;
};

/** Only hide our named extension. Keep the service's fields, missing fields, order and data as received. */
export const responseJson = (body: unknown, provenance: boolean): string =>
  JSON.stringify(body, (key, value: unknown) => (!provenance && key === 'vocabBloom' ? undefined : value), 2) ??
  'null';

export const fetchResponse = async (url: string, signal: AbortSignal): Promise<ResponseT> => {
  const response = await fetch(url, { signal, credentials: 'omit' });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Rate limits and upstream failures can be plain text or HTML; render them as text only.
  }
  return { status: response.status, body };
};

/** A same-origin site route; /api/* belongs to the dictionary server in production. */
export const originalComparisonPath = (
  service: ComparisonServiceT,
  word: string,
  translations: boolean,
  version: DictionaryApiVersionT,
): string =>
  `/comparison-response?${new URLSearchParams({
    service,
    word,
    version: service === 'dictionaryapi' ? version : 'v1',
    translations: String(service === 'freedictionaryapi' && translations),
  })}`;
