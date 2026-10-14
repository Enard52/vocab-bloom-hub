/* eslint-disable no-console -- This runnable example writes its results to the terminal. */
import { RateLimitError, VocabBloomClient, VocabBloomError } from '@vocab-bloom-hub/client';

async function main() {
  const [baseUrl, ...extra] = process.argv.slice(2);
  if (!baseUrl || extra.length) {
    throw new Error('Usage: node cursor-pagination.mjs <instance-base-url>');
  }

  const client = new VocabBloomClient({ baseUrl });

  // Display the dataset's terms before displaying its content, including notices
  // and license text. Word-specific origins and licenses are preserved below too.
  const { data: dataset } = await client.meta();
  console.log('Dataset metadata and terms:');
  console.log(JSON.stringify(dataset, null, 2));

  // Keep the same filters throughout the walk. A small limit makes pages visible.
  const query = { limit: 2, part_of_speech: ['verb'] };
  let cursor;
  let pageNumber = 0;
  let total = 0;

  do {
    const { data, meta } = await client.words({ ...query, cursor });
    pageNumber += 1;
    console.log(`Page ${pageNumber}: ${data.length} entries`);
    for (const word of data) {
      console.log(`${word.word}${word.modified ? ' (changed on this instance)' : ''}`);
      // Keep origins, contributions and their license associations with the data.
      console.log(JSON.stringify(word, null, 2));
    }
    total += data.length;

    // The cursor is opaque: pass it back unchanged, without decoding or rebuilding
    // it. Stop when absent, even if the final page contains exactly `limit` entries.
    cursor = meta.next_cursor;
  } while (cursor);

  if (total === 0) console.log('No entries match the filter.');
  console.log(`Done: ${total} entries across ${pageNumber} page(s).`);

  // If you only need entries, replace the manual loop with the SDK's iterator:
  // for await (const word of client.iterateWords(query)) {
  //   console.log(JSON.stringify(word, null, 2));
  // }
  // It fetches pages lazily and follows next_cursor for you. Do not run both
  // loops unless you intend to read the same entries twice.
}

main().catch((error) => {
  if (error instanceof VocabBloomError) {
    console.error(`Pagination failed (${error.code}, status ${error.status}): ${error.message}`);
    if (error instanceof RateLimitError && error.retryAfter !== null) {
      console.error(`Retry after ${error.retryAfter} seconds.`);
    }
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
});
