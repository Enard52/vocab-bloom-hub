# Migration comparison snapshots

Original-service responses are **updated manually**, never by build, dev or start:

```bash
yarn workspace site comparisons:generate
# Retry only missing, unavailable or stale snapshots:
yarn workspace site comparisons:generate --missing-only
```

The nine words share the list and URL construction with the comparison UI:
18 dictionaryapi.dev requests (v1/v2) and 18 FreeDictionaryAPI.com requests
(with/without translations). Requests run sequentially with a one-second pause
and a 25-second timeout. Run the command again to retry failed requests.

JSON lives in `public/comparison-responses/` and is versioned with the site.
Commit changed snapshots after a manual refresh. Docker copies these files
with the other public assets; no network access to the original services is
needed to build or serve the comparison. Downloaded responses retain their source data; explicitly marked v1 reconstructions are described below.
Each snapshot retains the HTTP status, complete JSON body (including sources
and licenses), source URL, retrieval date and refresh-attempt date.

A failed refresh preserves an existing successful snapshot and its original date,
with a stale notice. Without an older response, it saves the error and marks the
snapshot unavailable; it never invents definitions. The console reports failures and the command exits with code 1 if any refresh fails.
The instance's own dataset responses are still read live through `/datasets`.

## Reconstruct unavailable dictionaryapi v1 examples

```sh
node --experimental-strip-types apps/site/scripts/reconstruct-comparisons.mjs
```

This local-only command fills missing/failed v1 examples from saved successful v2 bodies,
following `transformV2toV1` in the upstream
[modules/dictionary.js](https://github.com/meetDeveloper/freeDictionaryAPI/blob/master/modules/dictionary.js).
It replaces `meanings` with `meaning`, keyed by part of speech and containing each group's
`definitions`; other entry fields are retained. It never overwrites a downloaded v1 response.

Reconstructed snapshots carry `reconstructed: true`, `fetchedAt: null`, reconstruction time,
the v2 source/date and the transformation source. The site labels them as reconstructed
and does not present their status as an observed HTTP response. They are examples of the
published transformation, not verified live v1 responses. `comparisons:generate --missing-only`
still attempts to replace them with real v1 responses; a failed refresh preserves the reconstruction.
