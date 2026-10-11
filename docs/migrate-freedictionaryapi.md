# Migrate from freedictionaryapi.com

If your app uses [freedictionaryapi.com](https://freedictionaryapi.com/), change the base URL
to a Vocab Bloom Hub instance and keep the English lookup path. The compatibility adapter
returns the familiar `{ word, entries, source }` response, with additive `vocabBloom` source
details. Its answers come from the **active dataset of your instance**. The upstream service
uses Wiktionary data by default; the project instance serves its own dataset by default.

## Change the base URL

|        | Base URL                                                  | Lookup path                           |
| ------ | --------------------------------------------------------- | ------------------------------------- |
| Before | `https://freedictionaryapi.com/api/v1`                    | `/entries/en/hello?translations=true` |
| After  | `https://<your-instance>/api/compat/freedictionaryapi/v1` | `/entries/en/hello?translations=true` |

For example:

```bash
curl -fsS 'https://vocab-bloom-hub.com/api/compat/freedictionaryapi/v1/entries/en/hello?translations=true'
curl -fsS 'https://vocab-bloom-hub.com/api/compat/freedictionaryapi/v1/languages?pretty=true'
```

These are anonymous, read-only requests. They do not contact freedictionaryapi.com.
`translations` and `pretty` accept lowercase `true` or `false`; translations are omitted by
default. The adapter treats spelling as case-sensitive and returns `200` with empty `entries`
for a missing word. It accepts `en` and `all` for the English database; other language codes
return empty entries. `/languages` lists English only, regardless of translation languages
inside entries.

The adapter does not accept `?dataset=...`. To serve a different dataset in this response
shape, install it on a PostgreSQL instance and activate it in the admin UI. Activation changes
the dataset of **all** public lookups on that instance. SQLite has only the default dataset.

## Read every dataset in this format

Append `/datasets` to the compatibility lookup. `translations` and `pretty` work here too:

```bash
curl -fsS 'http://localhost:3240/api/compat/freedictionaryapi/v1/entries/en/hello/datasets?translations=true&pretty=true'
```

This Vocab Bloom Hub extension reads every installed dataset without activating one. Its
outer response is `{ data, meta }`. Each `data[]` group contains the dataset terms (including
`dataset`, `title`, `active`, `source` and licenses), `status: 200`, and a `response` containing
that dataset's full `{ word, entries, source, vocabBloom }` adapter object.

Spelling remains case-sensitive in each dataset. A missing word or an unsupported language
has empty `response.entries`, as in the ordinary adapter. The overall HTTP status is 200
even if every group is empty. `meta` contains the requested `word` and `language`, the number
of `datasets`, and `found` (datasets with nonempty entries).

For example, extract the OpenGloss response:

```bash
curl -fsS 'http://localhost:3240/api/compat/freedictionaryapi/v1/entries/en/hello/datasets?translations=true' \
  | jq '.data[] | select(.dataset == "opengloss") | .response'
```

Only installed datasets appear. SQLite returns the default dataset only. Terms always
identify the dataset read; an empty result links back to this all-datasets route rather
than the active-only `/api/v1/meta`. The ordinary lookup URL keeps its original response
shape and reads the active dataset. See [the complete all-datasets contract](./api.md#compatibility-responses-from-every-dataset).

## Check your client before switching

- The adapter preserves `word`, `entries`, `source`, `senses`, forms and supported
  `translations`, but individual senses, forms, tags and counts depend on the installed data.
- Keep `vocabBloom` and its license/origin details when storing or redistributing results.
  A single `source.license` cannot express every source and contribution term.
- Upstream supports more lookup languages. This instance currently stores English headwords;
  its translations are words inside English entries, not separate language dictionaries.
- The instance has its own rate limit and cache policy. Check representative words, casing,
  missing-word handling and `translations=true` before switching production traffic.

For the complete mapping and HTTP limits, see [freedictionaryapi.com compatibility](./api.md#freedictionaryapicom-compatibility).
For dataset installation and activation, see [Datasets](./datasets.md).

## Website comparison snapshots

The website comparison uses saved original-service responses for all nine preset words and
supported version/translation options. They are committed with the website and refreshed
manually with `yarn workspace site comparisons:generate` (`--missing-only` retries missing
or failed snapshots). Building, starting and browsing the site never requests the originals.
The retrieval date is displayed. A failed refresh retains an older successful snapshot
with a warning when available; otherwise the error is shown. Instance datasets are queried live.
