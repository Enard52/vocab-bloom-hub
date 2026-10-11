import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { COMPARISON_WORDS } from '../src/components/MigrationComparison/data.ts';

// Same mapping as transformV2toV1 in the upstream modules/dictionary.js:
const transformSource = 'https://github.com/meetDeveloper/freeDictionaryAPI/blob/master/modules/dictionary.js';
const base = new URL('../public/comparison-responses/dictionaryapi/', import.meta.url);
for (const word of COMPARISON_WORDS) {
  const target = new URL(`v1/plain/${word}.json`, base);
  let previous;
  try {
    previous = JSON.parse(await readFile(target, 'utf8'));
  } catch {
    // A missing v1 snapshot can also be reconstructed.
  }
  if (previous && !previous.unavailable && !previous.reconstructed) continue;
  const v2 = JSON.parse(await readFile(new URL(`v2/plain/${word}.json`, base), 'utf8'));
  if (v2.unavailable || v2.status !== 200 || !Array.isArray(v2.body))
    throw new Error(`No usable v2 response for ${word}`);
  const body = v2.body.map(({ meanings, ...entry }) => ({
    ...entry,
    meaning: Object.fromEntries(meanings.map(({ partOfSpeech, definitions }) => [partOfSpeech, definitions])),
  }));
  const snapshot = {
    status: 200,
    body,
    source: v2.source.replace('/v2/', '/v1/'),
    fetchedAt: null,
    attemptedAt: previous?.attemptedAt ?? v2.attemptedAt,
    stale: false,
    unavailable: false,
    reconstructed: true,
    reconstructedAt: new Date().toISOString(),
    derivedFrom: { source: v2.source, fetchedAt: v2.fetchedAt, captureMethod: v2.captureMethod },
    transformSource,
  };
  await mkdir(new URL('v1/plain/', base), { recursive: true });
  await writeFile(target, JSON.stringify(snapshot, null, 2) + '\n');
  process.stdout.write(`Reconstructed v1 from saved v2: ${word}\n`);
}
