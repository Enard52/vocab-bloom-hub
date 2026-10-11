import fs from 'node:fs';
import path from 'node:path';

import { listEndpoints, OpenApiSpecT, PUBLIC_SPEC_FILE } from '../../openapi';
import { highlightLanguages } from '../../highlight';
import { buildSnippetRequest, SNIPPET_LANGUAGES, snippetsOf } from '../index';
import { jsLiteral, phpLiteral, pythonLiteral, rustRawString } from '../literals';
import { planRequest, playgroundEndpoint } from '../../playground';

// The code snippets of the API reference: every language over
// every endpoint of the committed public document

const spec = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../../..', PUBLIC_SPEC_FILE), 'utf8'),
) as OpenApiSpecT;
const BASE = 'https://x.example/api';

const endpoints = listEndpoints(spec);
const requests = endpoints.map((endpoint) => buildSnippetRequest(endpoint, BASE, spec));
const bySlug = (slug: string) => {
  const request = requests.find((item) => item.slug === slug);
  if (!request) throw new Error(`no endpoint ${slug}`);
  return request;
};
const render = (id: string, slug: string) => {
  const language = SNIPPET_LANGUAGES.find((item) => item.id === id);
  if (!language) throw new Error(`no language ${id}`);
  return language.render(bySlug(slug));
};

describe('the snippet request', () => {
  it('fills the sample path params in and carries the body of a write', () => {
    expect(bySlug('get-words-word-meanings')).toMatchObject({
      method: 'GET',
      url: 'https://x.example/api/v1/words/run/meanings',
      path: '/api/v1/words/run/meanings',
      origin: 'https://x.example',
      body: null,
    });
    expect(bySlug('post-suggestions').body).toEqual(expect.objectContaining({ headword: expect.any(String) }));
  });
});

describe('every language', () => {
  it('has a unique id and a highlight.js language this site registers', () => {
    const ids = SNIPPET_LANGUAGES.map((language) => language.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const language of SNIPPET_LANGUAGES) expect(highlightLanguages()).toContain(language.highlight);
  });

  it.each(SNIPPET_LANGUAGES.map((language) => [language.id, language]))(
    '%s renders every endpoint it claims with the URL in the code',
    (_id, language) => {
      let rendered = 0;
      for (const request of requests) {
        const code = language.render(request);
        if (code === null) continue;
        rendered += 1;
        expect(code).toContain(request.url.includes('x.example') ? 'x.example' : request.url);
        expect(code.trim()).toBe(code);
      }
      expect(rendered).toBeGreaterThan(0);
    },
  );

  it('the generated ones cover every endpoint; the SDK tabs only where a snippet is written', () => {
    for (const id of ['curl', 'javascript', 'python', 'go', 'php', 'rust', 'java']) {
      for (const request of requests) expect(render(id, request.slug)).not.toBeNull();
    }
    expect(render('sdk-node', 'get-meta')).not.toBeNull();
    expect(render('sdk-python', 'get-meta')).not.toBeNull();
    expect(snippetsOf(bySlug('get-meta')).map((snippet) => snippet.id)).toEqual([
      'curl',
      'javascript',
      'python',
      'go',
      'php',
      'rust',
      'java',
      'sdk-node',
      'sdk-python',
    ]);
    // the reads of every dataset have one in both SDKs (issue #528)
    for (const slug of ['get-words-word-datasets', 'get-words-word-datasets-dataset-history']) {
      expect(snippetsOf(bySlug(slug)).map((snippet) => snippet.id)).toEqual(
        expect.arrayContaining(['sdk-node', 'sdk-python']),
      );
    }
    expect(render('sdk-node', 'get-random')).toBeNull();
    // the first tab is curl everywhere: a reader without a choice yet sees it
    for (const request of requests) expect(snippetsOf(request)[0].id).toBe('curl');
  });
});

describe('the exact text', () => {
  it.each([
    ['get-meta', 'https://x.example/api/v1/meta', ['            .GET()']],
    [
      'post-words-batch',
      'https://x.example/api/v1/words/batch',
      [
        '            .header("Content-Type", "application/json")',
        String.raw`            .POST(HttpRequest.BodyPublishers.ofString("{\"words\":[\"run\",\"walk\",\"nonexistentword\"]}"))`,
      ],
    ],
  ])('Java: a complete program for %s', (slug, url, methodLines) => {
    expect(render('java', slug as string)).toBe(
      [
        'import java.net.URI;',
        'import java.net.http.HttpClient;',
        'import java.net.http.HttpRequest;',
        'import java.net.http.HttpResponse;',
        '',
        'public class Main {',
        '    public static void main(String[] args) throws Exception {',
        '        HttpClient client = HttpClient.newHttpClient();',
        '        HttpRequest request = HttpRequest.newBuilder()',
        `            .uri(URI.create("${url}"))`,
        ...methodLines,
        '            .build();',
        '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
        '        System.out.println(response.body());',
        '    }',
        '}',
      ].join('\n'),
    );
  });

  it('Java preserves JSON quotes, backslashes, control characters and Unicode', () => {
    const body = { message: 'say "hi" \\ café\n', nested: [true, null, { value: 1 }] };
    const code = SNIPPET_LANGUAGES.find(({ id }) => id === 'java')!.render({
      ...bySlug('post-suggestions'),
      body,
    });
    expect(code).toContain(
      `.POST(HttpRequest.BodyPublishers.ofString(${JSON.stringify(JSON.stringify(body))}))`,
    );
  });

  it('offers batch SDK tabs with the shared words and prints found words and misses', () => {
    const request = bySlug('post-words-batch');
    expect(request.body).toEqual({ words: ['run', 'walk', 'nonexistentword'] });
    expect(snippetsOf(request).map(({ id }) => id)).toEqual(expect.arrayContaining(['sdk-node', 'sdk-python']));
    expect(render('sdk-node', request.slug)).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        "const { data, meta } = await client.wordsBatch(['run', 'walk', 'nonexistentword']);",
        'console.log(data.map((item) => item.word), meta.not_found);',
      ].join('\n'),
    );
    expect(render('sdk-python', request.slug)).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.words_batch(["run", "walk", "nonexistentword"])',
        'print([item.word for item in answer.data], answer.meta.not_found)',
      ].join('\n'),
    );
    const endpoint = playgroundEndpoint(
      endpoints.find(({ slug }) => slug === request.slug)!,
      spec,
    );
    expect(planRequest(endpoint, { words: 'run, walk, nonexistentword' })).toMatchObject({
      method: 'POST',
      path: '/v1/words/batch',
      body: request.body,
    });
  });

  it('batch SDK examples use the supplied origin and escape the shared word list', () => {
    const words = ['say "hi"', "it's", 'back\\slash'];
    const request = { ...bySlug('post-words-batch'), origin: 'https://dictionary.example', body: { words } };
    for (const [id, method, literal] of [
      ['sdk-node', 'wordsBatch', jsLiteral],
      ['sdk-python', 'words_batch', pythonLiteral],
    ] as const) {
      const code = SNIPPET_LANGUAGES.find((language) => language.id === id)!.render(request)!;
      expect(code).toContain(request.origin);
      expect(code).toContain(`client.${method}(${literal(words)})`);
      expect(code).not.toContain('x.example');
    }
  });

  it('offers both word-by-ID SDK tabs with the same numeric ID as the playground', () => {
    expect(snippetsOf(bySlug('get-words-id-id')).map(({ id }) => id)).toEqual(
      expect.arrayContaining(['sdk-node', 'sdk-python']),
    );
    expect(render('sdk-node', 'get-words-id-id')).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        'const { data } = await client.wordById(1);',
        'console.log(data.word, data.part_of_speech);',
      ].join('\n'),
    );
    expect(render('sdk-python', 'get-words-id-id')).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.word_by_id(1)',
        'print(answer.data.word, answer.data.part_of_speech.value)',
      ].join('\n'),
    );
    const endpoint = playgroundEndpoint(
      endpoints.find(({ slug }) => slug === 'get-words-id-id')!,
      spec,
    );
    expect(planRequest(endpoint, { id: '1' })).toMatchObject({
      method: 'GET',
      path: '/v1/words/id/1',
      query: '',
    });
  });

  it('word-by-ID SDK examples use the supplied origin and numeric path argument', () => {
    const request = {
      ...bySlug('get-words-id-id'),
      origin: 'https://dictionary.example',
      path: '/api/v1/words/id/42',
    };
    for (const [id, method] of [
      ['sdk-node', 'wordById'],
      ['sdk-python', 'word_by_id'],
    ]) {
      const code = SNIPPET_LANGUAGES.find((language) => language.id === id)!.render(request)!;
      expect(code).toContain(request.origin);
      expect(code).toContain(`client.${method}(42)`);
      expect(code).not.toContain('x.example');
    }
  });

  it('Rust: a complete blocking GET with status checking and a JSON answer', () => {
    expect(render('rust', 'get-meta')).toBe(
      [
        '// cargo add reqwest --features blocking,json',
        '// cargo add serde_json',
        'use reqwest::blocking::Client;',
        'use serde_json::Value;',
        '',
        'fn main() -> Result<(), Box<dyn std::error::Error>> {',
        '    let client = Client::new();',
        '    let answer: Value = client',
        '        .get(r#"https://x.example/api/v1/meta"#)',
        '        .send()?',
        '        .error_for_status()?',
        '        .json()?;',
        '    println!("{answer}");',
        '    Ok(())',
        '}',
      ].join('\n'),
    );
  });

  it('Rust: a complete POST sends the shared JSON body', () => {
    expect(render('rust', 'post-words-batch')).toBe(
      [
        '// cargo add reqwest --features blocking,json',
        '// cargo add serde_json',
        'use reqwest::blocking::Client;',
        'use serde_json::Value;',
        '',
        'fn main() -> Result<(), Box<dyn std::error::Error>> {',
        '    let client = Client::new();',
        '    let body: Value = serde_json::from_str(r#"{"words":["run","walk","nonexistentword"]}"#)?;',
        '    let answer: Value = client',
        '        .post(r#"https://x.example/api/v1/words/batch"#)',
        '        .json(&body)',
        '        .send()?',
        '        .error_for_status()?',
        '        .json()?;',
        '    println!("{answer}");',
        '    Ok(())',
        '}',
      ].join('\n'),
    );
  });

  it('Rust preserves quotes, hashes, backslashes, Unicode and nested JSON values', () => {
    const body = { message: 'say "##hi" \\ café\n', nested: [true, null, { value: 1 }] };
    const code = SNIPPET_LANGUAGES.find(({ id }) => id === 'rust')!.render({
      ...bySlug('post-suggestions'),
      body,
    });
    expect(code).toContain(`serde_json::from_str(${rustRawString(JSON.stringify(body))})?`);
    expect(rustRawString('close "# or "## here')).toBe('r###"close "# or "## here"###');
  });

  it('offers headword SDK tabs and prints the first entry’s first definition safely', () => {
    expect(snippetsOf(bySlug('get-words-word')).map(({ id }) => id)).toEqual(
      expect.arrayContaining(['sdk-node', 'sdk-python']),
    );
    expect(render('sdk-node', 'get-words-word')).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        "const { data } = await client.word('run');",
        'console.log(data[0]?.meanings?.[0]?.definition);',
      ].join('\n'),
    );
    expect(render('sdk-python', 'get-words-word')).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.word("run")',
        'first = answer.data[0] if answer.data else None',
        'print(first.meanings[0].definition if first and first.meanings else None)',
      ].join('\n'),
    );
    const endpoint = playgroundEndpoint(
      endpoints.find(({ slug }) => slug === 'get-words-word')!,
      spec,
    );
    expect(planRequest(endpoint, { word: 'run' })).toMatchObject({
      method: 'GET',
      path: '/v1/words/run',
      query: '',
    });
  });

  it('headword SDK examples use the supplied origin and escaped path argument', () => {
    const request = {
      ...bySlug('get-words-word'),
      path: '/api/v1/words/say%20%22hi%22%20it%27s%20%5C',
      origin: 'https://dictionary.example',
    };
    for (const [id, literal] of [
      ['sdk-node', jsLiteral],
      ['sdk-python', pythonLiteral],
    ] as const) {
      const code = SNIPPET_LANGUAGES.find((language) => language.id === id)!.render(request)!;
      expect(code).toContain(`client.word(${literal('say "hi" it\'s \\')})`);
      expect(code).toContain(request.origin);
      expect(code).not.toContain('x.example');
    }
  });

  it('offers words SDK tabs with an A1 page, five headwords and an optional iterator', () => {
    expect(snippetsOf(bySlug('get-words')).map(({ id }) => id)).toEqual(
      expect.arrayContaining(['sdk-node', 'sdk-python']),
    );
    expect(render('sdk-node', 'get-words')).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        "const { data } = await client.words({ word_level: ['A1'] });",
        'console.log(data.slice(0, 5).map((entry) => entry.word));',
        '',
        '// To read every matching entry across all pages:',
        "// for await (const entry of client.iterateWords({ word_level: ['A1'] })) {",
        '//   console.log(entry.word);',
        '// }',
      ].join('\n'),
    );
    expect(render('sdk-python', 'get-words')).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.words(word_level=["A1"])',
        'print([entry.word for entry in answer.data[:5]])',
        '',
        '# To read every matching entry across all pages:',
        '# for entry in client.iter_words(word_level=["A1"]):',
        '#     print(entry.word)',
      ].join('\n'),
    );
    const endpoint = playgroundEndpoint(
      endpoints.find(({ slug }) => slug === 'get-words')!,
      spec,
    );
    expect(planRequest(endpoint, { word_level: ['A1'] })).toMatchObject({
      method: 'GET',
      path: '/v1/words',
      query: '?word_level=A1',
    });
  });

  it('uses the supplied instance origin for both words SDK examples', () => {
    const request = { ...bySlug('get-words'), origin: 'https://dictionary.example' };
    for (const id of ['sdk-node', 'sdk-python']) {
      const code = SNIPPET_LANGUAGES.find((language) => language.id === id)!.render(request)!;
      expect(code).toContain(request.origin);
      expect(code).not.toContain('x.example');
    }
  });

  it('offers both suggestion SDK tabs with the shared request body and created result', () => {
    expect(snippetsOf(bySlug('post-suggestions')).map(({ id }) => id)).toEqual(
      expect.arrayContaining(['sdk-node', 'sdk-python']),
    );
    expect(render('sdk-node', 'post-suggestions')).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        'const { data } = await client.suggest({',
        "  headword: 'run',",
        "  message: 'Please check the definition of this word.'",
        '});',
        'console.log(data.id, data.status);',
      ].join('\n'),
    );
    expect(render('sdk-python', 'post-suggestions')).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.suggest(**{',
        '  "headword": "run",',
        '  "message": "Please check the definition of this word."',
        '})',
        'print(answer.data.id, answer.data.status)',
      ].join('\n'),
    );
    const request = bySlug('post-suggestions');
    expect(render('javascript', request.slug)).toContain(jsLiteral(request.body, 1));
    expect(render('python', request.slug)).toContain(pythonLiteral(request.body));
    const endpoint = playgroundEndpoint(
      endpoints.find(({ slug }) => slug === request.slug)!,
      spec,
    );
    expect(planRequest(endpoint, request.body!).body).toEqual(request.body);
  });

  it('suggestion SDK examples use the supplied body and escape its strings', () => {
    const body = { headword: 'bank', message: `Please check "bank": it's a \\ character.` };
    const request = { ...bySlug('post-suggestions'), body, origin: 'https://another.example' };
    for (const [id, literal] of [
      ['sdk-node', jsLiteral],
      ['sdk-python', pythonLiteral],
    ] as const) {
      const code = SNIPPET_LANGUAGES.find((language) => language.id === id)!.render(request)!;
      expect(code).toContain(literal(body));
      expect(code).toContain(request.origin);
      expect(code).not.toContain('Please check the definition');
    }
  });

  it('offers both meanings SDK tabs and prints the first definition', () => {
    expect(snippetsOf(bySlug('get-words-word-meanings')).map((snippet) => snippet.id)).toEqual(
      expect.arrayContaining(['sdk-node', 'sdk-python']),
    );
    expect(render('sdk-node', 'get-words-word-meanings')).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        "const { data } = await client.meanings('run');",
        'console.log(data[0]?.definition);',
      ].join('\n'),
    );
    expect(render('sdk-python', 'get-words-word-meanings')).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.meanings("run")',
        'print(answer.data[0].definition if answer.data else None)',
      ].join('\n'),
    );
  });

  it('uses the actual meanings path argument and escapes it for each SDK', () => {
    const request = { ...bySlug('get-words-word-meanings'), path: '/api/v1/words/say%20%22hi%22/meanings' };
    const node = SNIPPET_LANGUAGES.find((item) => item.id === 'sdk-node')!;
    const python = SNIPPET_LANGUAGES.find((item) => item.id === 'sdk-python')!;
    expect(node.render(request)).toContain(`client.meanings(${jsLiteral('say "hi"')})`);
    expect(python.render(request)).toContain(`client.meanings(${pythonLiteral('say "hi"')})`);
  });

  it('offers detailed search SDK tabs with meanings enabled and safe first-result access', () => {
    expect(snippetsOf(bySlug('get-search-detailed')).map((snippet) => snippet.id)).toEqual(
      expect.arrayContaining(['sdk-node', 'sdk-python']),
    );
    expect(render('sdk-node', 'get-search-detailed')).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        "const { data } = await client.searchDetailed({ search: 'run', with_meanings: true });",
        'const first = data[0];',
        'console.log(first?.part_of_speech, first?.meanings?.[0]?.title);',
      ].join('\n'),
    );
    expect(render('sdk-python', 'get-search-detailed')).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.search_detailed("run", with_meanings=True)',
        'first = answer.data[0] if answer.data else None',
        'print(',
        '    first.part_of_speech.value if first else None,',
        '    first.meanings[0].title if first and first.meanings else None,',
        ')',
      ].join('\n'),
    );
  });

  it('offers both search SDK tabs with the sample term, fuzzy flag and first word', () => {
    expect(snippetsOf(bySlug('get-search')).map((snippet) => snippet.id)).toEqual(
      expect.arrayContaining(['sdk-node', 'sdk-python']),
    );
    expect(render('sdk-node', 'get-search')).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        "const { data, meta } = await client.search({ search: 'run' });",
        'console.log(meta.fuzzy, data[0]?.word);',
      ].join('\n'),
    );
    expect(render('sdk-python', 'get-search')).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.search("run")',
        'print(answer.meta.fuzzy, answer.data[0].word if answer.data else None)',
      ].join('\n'),
    );
  });

  it('curl: a bare GET, a POST with the JSON body', () => {
    expect(render('curl', 'get-words-word-meanings')).toBe(
      "curl 'https://x.example/api/v1/words/run/meanings'",
    );
    expect(render('curl', 'post-words-batch')).toBe(
      'curl -X POST \'https://x.example/api/v1/words/batch\' \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"words":["run","walk","nonexistentword"]}\'',
    );
  });

  it('JavaScript: fetch with a JSON body on a write', () => {
    expect(render('javascript', 'get-meta')).toBe(
      [
        "const res = await fetch('https://x.example/api/v1/meta');",
        'if (!res.ok) throw new Error(`HTTP ${res.status}`);',
        'const answer = await res.json();',
      ].join('\n'),
    );
    expect(render('javascript', 'post-words-batch')).toContain(
      "  body: JSON.stringify({\n    words: ['run', 'walk', 'nonexistentword']\n  }),",
    );
  });

  it('Python: requests with json= on a write', () => {
    expect(render('python', 'get-meta')).toBe(
      [
        'import requests',
        '',
        'res = requests.get("https://x.example/api/v1/meta")',
        'res.raise_for_status()',
        'answer = res.json()',
      ].join('\n'),
    );
    expect(render('python', 'post-words-batch')).toContain(
      'requests.post("https://x.example/api/v1/words/batch", json={\n  "words": ["run", "walk", "nonexistentword"]\n})',
    );
  });

  it('Go and PHP: the standard clients', () => {
    expect(render('go', 'get-meta')).toContain('resp, err := http.Get("https://x.example/api/v1/meta")');
    expect(render('go', 'post-words-batch')).toContain(
      'http.Post("https://x.example/api/v1/words/batch", "application/json", strings.NewReader(`{"words":["run","walk","nonexistentword"]}`))',
    );
    expect(render('php', 'get-meta')).toContain("$ch = curl_init('https://x.example/api/v1/meta');");
    expect(render('php', 'post-words-batch')).toContain(
      "CURLOPT_POSTFIELDS => json_encode([\n      'words' => ['run', 'walk', 'nonexistentword']\n    ]),",
    );
  });

  it('the SDK tabs of the first endpoint use the origin as base URL', () => {
    expect(render('sdk-node', 'get-meta')).toContain("new VocabBloomClient({ baseUrl: 'https://x.example' })");
    expect(render('sdk-python', 'get-meta')).toContain('VocabBloomClient("https://x.example")');
  });
});

describe('the SDK snippets of the reads of every dataset (issue #528)', () => {
  it('Node.js: the methods of the client with the sample values of the path', () => {
    expect(render('sdk-node', 'get-words-word-datasets')).toBe(
      [
        "import { VocabBloomClient } from '@vocab-bloom-hub/client';",
        '',
        "const client = new VocabBloomClient({ baseUrl: 'https://x.example' });",
        "const { data, meta } = await client.wordDatasets('run');",
        'console.log(`${meta.found} of ${meta.datasets} datasets hold the word`);',
        'for (const group of data) {',
        '  // the entries of a group are used under the terms of that group',
        '  console.log(group.dataset, group.license, group.attribution, group.entries.length);',
        '}',
      ].join('\n'),
    );
    expect(render('sdk-node', 'get-words-word-datasets-dataset-history')).toContain(
      "await client.datasetHistory('run', 'default');",
    );
  });

  it('Python: the same reads', () => {
    expect(render('sdk-python', 'get-words-word-datasets')).toBe(
      [
        'from vocab_bloom_hub import VocabBloomClient',
        '',
        'client = VocabBloomClient("https://x.example")',
        'answer = client.word_datasets("run")',
        'print(f"{answer.meta.found} of {answer.meta.datasets} datasets hold the word")',
        'for group in answer.data:',
        '    # the entries of a group are used under the terms of that group',
        '    print(group.dataset, group.license, group.attribution, len(group.entries))',
      ].join('\n'),
    );
    expect(render('sdk-python', 'get-words-word-datasets-dataset-history')).toContain(
      'client.dataset_history("run", "default")',
    );
  });

  it('name only methods the clients have', () => {
    const node = fs.readFileSync(
      path.join(__dirname, '../../../../../..', 'packages/npm-sdk/src/client.ts'),
      'utf8',
    );
    const python = fs.readFileSync(
      path.join(__dirname, '../../../../../..', 'packages/python-sdk/src/vocab_bloom_hub/client.py'),
      'utf8',
    );
    for (const method of ['wordDatasets', 'datasetHistory']) expect(node).toContain(`  ${method}(`);
    for (const method of ['word_datasets', 'dataset_history']) expect(python).toContain(`def ${method}(`);
  });
});

describe('the literals', () => {
  it('escape the backslash and the quote of a string, in that order', () => {
    const tricky = "it's a \\ path";
    expect(jsLiteral(tricky)).toBe("'it\\'s a \\\\ path'");
    expect(phpLiteral(tricky)).toBe("'it\\'s a \\\\ path'");
    expect(pythonLiteral('say "hi" \\ there')).toBe('"say \\"hi\\" \\\\ there"');
  });

  it('write a body the way each language does', () => {
    const body = { search: 'run', with_meanings: true, limit: 5, level: ['A1'], note: null };
    expect(jsLiteral(body)).toBe(
      "{\n  search: 'run',\n  with_meanings: true,\n  limit: 5,\n  level: ['A1'],\n  note: null\n}",
    );
    expect(pythonLiteral(body)).toBe(
      '{\n  "search": "run",\n  "with_meanings": True,\n  "limit": 5,\n  "level": ["A1"],\n  "note": None\n}',
    );
    expect(phpLiteral(body)).toBe(
      "[\n  'search' => 'run',\n  'with_meanings' => true,\n  'limit' => 5,\n  'level' => ['A1'],\n  'note' => null\n]",
    );
  });
});
