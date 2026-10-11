# Code snippets of the API reference

Every endpoint on the reference page of the website (`/en/api`) shows its request in several
languages — the tabs under **Example**. The snippets are not written per endpoint: a language is a
small function that turns a request into code, and the site runs it over every endpoint of
`apps/server/openapi/public-v1.json`. Adding a language takes one file and no knowledge of the
site.

## Adding a language

1. Copy `languages/python.ts` to `languages/<name>.ts` and fill in:
   - `id` — a stable key, lowercase (`ruby`);
   - `label` — the tab's title, as the language calls itself (`Ruby`);
   - `highlight` — the [highlight.js language](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md)
     for colouring; register it in `src/content/highlight.ts` if it is not there yet;
   - `render(request)` — the code, as one string. `request` has the method, the whole URL with
     sample values filled in (`https://your-instance.example/api/v1/words/run`), the origin, and
     the JSON body of a write as an object (null for a read); `types.ts` lists every field.
     Return `null` for a request the language cannot show — that endpoint simply has no tab.
2. Add it to `SNIPPET_LANGUAGES` in `index.ts`, at the position its tab should take.
3. Run `yarn jest --selectProjects site src/content/snippets`: the test renders every language
   over every endpoint and checks the URL is in the code. Add a case with the exact text of one
   read and one write, as the other languages have.

The body helpers in `literals.ts` write a sample body as a literal of the language (`{ search:
'run' }` in JavaScript, `{"search": "run"}` in Python, `['search' => 'run']` in PHP) — add one for
a language that reads better with its own syntax than with a JSON string.

## Ruby

The Ruby tab uses only `net/http` and `json`: save the example as `example.rb` and run
`ruby example.rb`. HTTPS uses TLS, unsuccessful HTTP responses raise before JSON parsing,
and the decoded answer is printed as formatted JSON. POST bodies use Ruby hashes with
string keys and `JSON.generate`; quoted source data cannot trigger Ruby interpolation.

## Java

The Java tab is a complete `Main.java` program for Java 11 or newer, using the standard
`java.net.http.HttpClient` without dependencies. Save the example and run `java Main.java`.
GET reads and POST requests with the shared JSON body print the response as a string.
JSON is escaped again as a Java string literal, preserving quotes and backslashes.

## Rust

The Rust tab is a complete `src/main.rs` program using the blocking
[reqwest client](https://docs.rs/reqwest/latest/reqwest/blocking/) and `serde_json::Value`.
In a Cargo project, run `cargo add reqwest --features blocking,json` and
`cargo add serde_json`, paste the example into `src/main.rs`, then run `cargo run`.
It checks HTTP errors before decoding JSON and accepts both object and array responses.
POST bodies come from the same sample as the other tabs; the JSON is parsed from a raw
string whose delimiter grows when the data contains a closing quote/hash sequence.

## Snippets written by hand

The two SDK tabs (`languages/sdk-node.ts`, `languages/sdk-python.ts`) cannot be generated: the
method names are not in the OpenAPI document. They hold a map from the endpoint's slug — its
anchor on the reference page and its `?endpoint=` in the playground, `get-words-word`,
`post-words-batch` — to the snippet. An endpoint without an entry shows no SDK tab; adding one is
adding an entry. The sample values of the path come from `pathArguments(request, template)` of
`request.ts`, so the snippet passes what the generated ones put into the URL. The method names are in `packages/npm-sdk/README.md` and
`packages/python-sdk/README.md`.

The `get-words-word-forms` examples take the headword from the shared sample path (`run`)
and print every form's `word` and `form_of_word`. An empty forms list prints no rows.
Enter `run` as the playground headword to send the same request.

The `get-openapi-json` examples call `client.openapi()` and print `info.version`.
The method returns the document directly, without a `data` envelope. The Node.js example
narrows the SDK’s `unknown` info field before reading its version, so it also works in TypeScript.

The `get-random` examples call `client.random()` without filters and print the returned word.
Leave the playground filters empty to send the same request.

The `get-search` examples call `client.search({ search: 'run' })` in Node.js and
`client.search("run")` in Python, then print the fuzzy-match flag and the first result's word
(or an empty-result value when the instance has no match).
The `get-search-detailed` examples enable `with_meanings` and print the first entry’s part of
speech and first meaning title, handling missing entries or meanings.
The `get-words-id-id` examples call `wordById` / `word_by_id` with the numeric ID from
the sample path (`1`, also used in the playground), then print the word and its part of speech.
The `get-words-word` examples call `client.word` with the headword from the sample path
and print the first entry's first definition, handling empty entries or meanings.
The `get-words-word-meanings` examples take the headword from the sample path and print the
first definition, handling an empty meanings list.

The `post-words-batch` examples use the shared body with `run`, `walk` and `nonexistentword`,
call `wordsBatch` / `words_batch`, then print the found words and `meta.not_found`.
In the playground, enter `run, walk, nonexistentword` in `words` for the same request.

The `post-suggestions` examples send the shared sample body through `client.suggest` and
print the created suggestion's ID and status. The sample includes `headword: 'run'` and a
short `message`: reports require a message even though it is optional in the DTO shared
with edit proposals. All language tabs use that same body.

The `get-words` examples request one page filtered by `word_level: ['A1']` and print
up to five headwords (an empty list if no entries match). Commented alternatives use
`iterateWords` / `iter_words` with the same filter to read every page. In the playground,
select `A1` for `word_level` to send the same filtered request.

## Where the rest lives

- `request.ts` — the request digest from the OpenAPI document (sample values, the body of the
  required fields); `../openapi.ts` has the sample rules.
- `../highlight.ts` — the languages highlight.js knows on this site.
- `src/app/[locale]/api/_components/Snippets.tsx` — the tabs; the choice is remembered in the
  browser and applied to every endpoint on the page.
