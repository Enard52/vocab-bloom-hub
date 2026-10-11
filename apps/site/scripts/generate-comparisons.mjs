import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  COMPARISON_WORDS,
  comparisonUrls,
  originalComparisonPath,
} from '../src/components/MigrationComparison/data.ts';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const variants = [
  ['dictionaryapi', 'v1', false],
  ['dictionaryapi', 'v2', false],
  ['freedictionaryapi', 'v1', false],
  ['freedictionaryapi', 'v1', true],
];
const jobs = variants.flatMap(([service, version, translations]) =>
  COMPARISON_WORDS.map((word) => ({ service, version, translations, word })),
);
let updated = 0;
let failed = 0;
let retained = 0;

async function generate({ service, version, translations, word }) {
  const file = path.join(publicDir, originalComparisonPath(service, word, translations, version));
  let previous;
  try {
    previous = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    /* The first manual refresh may have no older snapshot. */
  }
  if (
    process.argv.includes('--missing-only') &&
    previous?.fetchedAt &&
    !previous.unavailable &&
    !previous.stale
  )
    return;
  await delay(1000);
  const url = comparisonUrls(service, word, translations, '/api', version).original;
  const attemptedAt = new Date().toISOString();
  let snapshot;
  try {
    // Native Node fetch has no persistent cache between manual refreshes; do not forward browser headers.
    const response = await fetch(url, {
      signal: AbortSignal.timeout(25000),
      redirect: 'error',
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    snapshot = {
      status: response.status,
      body,
      source: url,
      fetchedAt: new Date().toISOString(),
      attemptedAt,
      stale: false,
      unavailable: false,
    };
    // A genuine not-found JSON response is also a usable comparison snapshot.
    snapshot.unavailable = !(
      (response.status === 200 || response.status === 404) &&
      typeof body === 'object' &&
      body !== null
    );
  } catch (error) {
    snapshot = {
      status: error.name === 'TimeoutError' ? 504 : 502,
      body: { message: 'The original response could not be fetched during the manual snapshot refresh.' },
      source: url,
      fetchedAt: null,
      attemptedAt,
      stale: false,
      unavailable: true,
    };
  }
  if (snapshot.unavailable) {
    failed++;
    if (previous?.source === url && (previous.fetchedAt || previous.reconstructed) && !previous.unavailable) {
      snapshot = { ...previous, stale: true, attemptedAt };
      retained++;
    }
    process.stderr.write(
      `Comparison snapshot unavailable: ${url}${snapshot.stale ? ' (kept previous response)' : ''}\n`,
    );
  } else {
    updated++;
    process.stdout.write(`Saved ${snapshot.status}: ${url}\n`);
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(snapshot, null, 2) + '\n');
  await rename(`${file}.tmp`, file);
}

// One request at a time, one second apart. This command is never part of build/dev/start.
for (const job of jobs) await generate(job);
process.stdout.write(
  `Comparison snapshots: ${updated} refreshed, ${failed} failed, ${retained} previous responses retained.\n`,
);

if (failed) process.exitCode = 1;
