# Migrate from dictionaryapi.dev

If your app looks up English words through [Free Dictionary API](https://dictionaryapi.dev/),
point the same lookup path at a Vocab Bloom Hub instance. The compatibility adapter returns
the familiar JSON array for both v2 and legacy v1. The definitions come from the **active
dataset of your instance**, so changing the URL does not reproduce the upstream dictionary.

## Change the base URL

|        | Base URL                                           | Lookup path            |
| ------ | -------------------------------------------------- | ---------------------- |
| Before | `https://api.dictionaryapi.dev/api`                | `/v2/entries/en/hello` |
| After  | `https://<your-instance>/api/compat/dictionaryapi` | `/v2/entries/en/hello` |

For example, the public project instance answers at
`https://vocab-bloom-hub.com/api/compat/dictionaryapi/v2/entries/en/hello`. If your client
stores the full URL, replace its prefix and keep the language and encoded word path segments.
The legacy `/v1/entries/en/{word}` path works too. These are anonymous, read-only requests;
no API key is needed. They do not contact dictionaryapi.dev.

```js
const baseUrl = 'https://vocab-bloom-hub.com/api/compat/dictionaryapi';
const word = 'hello';
const entries = await fetch(`${baseUrl}/v2/entries/en/${encodeURIComponent(word)}`).then((r) => r.json());
```

`en` and the historical `en_US` / `en_GB` aliases are accepted. Other languages are not
available through this adapter. It does not accept query parameters, including `dataset`.
Use a PostgreSQL instance with the desired dataset installed, then activate that dataset on
its card in the admin UI. Activation changes what **all** public lookups on the instance
serve. On SQLite only the default dataset is available.

## Read every dataset in this format

Append `/datasets` to the compatibility lookup:

```bash
curl -fsS 'http://localhost:3240/api/compat/dictionaryapi/v2/entries/en/hello/datasets'
# The legacy v1 format is available too:
curl -fsS 'http://localhost:3240/api/compat/dictionaryapi/v1/entries/en/hello/datasets'
```

These Vocab Bloom Hub extensions read every installed dataset without activating one. The
outer response is `{ data, meta }`. Each `data[]` group contains its dataset terms (including
`dataset`, `title`, `active`, `source` and licenses), a `status`, and a `response`:

- `status: 200`: `response` is the same v1 or v2 array the ordinary adapter would return from
  that dataset, with full `vocabBloom` provenance.
- `status: 404`: `response` is the adapter's `{ title, message, resolution }` missing-word
  object for that dataset.

The overall HTTP status is 200 even if every dataset misses. `meta` contains the requested
`word` and `language`, the number of `datasets`, and `found` (datasets with matching entries).
Unsupported languages still fail the request with 404; query parameters remain unsupported.

For example, extract the WordNet group's result without changing the active dataset:

```bash
curl -fsS 'http://localhost:3240/api/compat/dictionaryapi/v2/entries/en/hello/datasets' \
  | jq '.data[] | select(.dataset == "wordnet") | {status, response}'
```

Only installed datasets appear; an uninstalled WordNet has no group. On SQLite the answer
has the single default dataset. The ordinary lookup URL still returns an array from the
active dataset; the `/datasets` wrapper is an extension for tools that need all datasets.
See [the complete all-datasets contract](./api.md#compatibility-responses-from-every-dataset).

## Check your client before switching

- The adapter returns **one array item per entry/part of speech**. The number of items and
  definitions can differ from upstream. The v2 shape uses `meanings[]`; v1 uses `meaning`.
- Its `vocabBloom` fields and `sourceUrls` describe the actual source. Do not relabel the
  project dataset or OpenGloss as Wiktionary. Clients that reject unknown fields must allow
  `vocabBloom`; preserve the applicable licenses and attribution when redistributing data.
- Missing words and unsupported languages return an upstream-shaped 404. Inflected forms can
  resolve to a base word. The instance has its own rate limit and cache policy.
- Pronunciations, examples, synonym grouping and word coverage depend on the installed
  dataset. Compare words important to your app before switching production traffic.

For the complete mapping and HTTP limits, see [dictionaryapi.dev compatibility](./api.md#dictionaryapidev-compatibility).
For dataset installation and activation, see [Datasets](./datasets.md).

## Website comparison snapshots

The website comparison uses saved original-service responses for all nine preset words and
supported version/translation options. They are committed with the website and refreshed
manually with `yarn workspace site comparisons:generate` (`--missing-only` retries missing
or failed snapshots). Building, starting and browsing the site never requests the originals.
The retrieval date is displayed. A failed refresh retains an older successful snapshot
with a warning when available; otherwise the error is shown. Instance datasets are queried live.

Unavailable v1 examples are reconstructed from saved v2 responses using the service’s
published `transformV2toV1` mapping. The comparison labels them as reconstructed, without
a v1 retrieval date or an observed HTTP status. A manual refresh can replace them with
actual v1 responses; a failed refresh retains the reconstructed example.
