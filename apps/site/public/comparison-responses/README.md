# Saved original API responses

These files are manually downloaded comparison examples, not Vocab Bloom Hub dictionary data
or test fixtures. Each JSON records the original request URL, HTTP status, response body,
retrieval date and latest update attempt. The body preserves the service's source links and
license information; those terms apply to the dictionary content.

Sources:

- [dictionaryapi.dev](https://dictionaryapi.dev/): the per-entry `license` and `sourceUrls` identify
  the terms and attribution of each response.
- [FreeDictionaryAPI.com](https://freedictionaryapi.com/): Wiktionary-derived data under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); each response's `source`
  identifies its Wiktionary page and license.

Refresh only when requested:

```sh
yarn workspace site comparisons:generate
# Retry unavailable snapshots only:
yarn workspace site comparisons:generate --missing-only
```

Commit the updated files after reviewing them. Build, dev and start never download these
responses. A snapshot marked `unavailable` contains a retrieval error, not a dictionary result.
A `stale` snapshot keeps its original retrieval date after a failed update.

Snapshots with `reconstructed: true` are derived from saved v2 data using the service's
published v1 transformation, not downloaded from v1. Their `fetchedAt` is null;
`derivedFrom` and `transformSource` identify the input and conversion. The comparison UI
labels these examples. See `apps/site/scripts/README.md` for the reconstruction command.
