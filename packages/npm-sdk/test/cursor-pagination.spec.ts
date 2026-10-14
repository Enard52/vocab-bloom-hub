import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const sdkRoot = resolve(__dirname, '..');
const example = resolve(sdkRoot, 'examples/cursor-pagination.mjs');
const dataset = {
  title: 'Example dictionary',
  license: 'CC-BY-4.0',
  attribution: 'Example authors',
  license_text: 'Keep this notice.',
};
const word = (spelling: string, modified = false) => ({
  word: spelling,
  modified,
  origins: [{ id: 'source-1', name: 'Original source', notices: ['Source notice'] }],
  contributions: [{ id: 'contribution-1', attribution: 'Example contributor' }],
  licenses: [{ origin_id: 'source-1', license: 'CC-BY-4.0' }],
});
const page = (words: string[], next_cursor?: string | null) => ({
  data: words.map((spelling) => word(spelling, spelling === 'run')),
  meta: { limit: 2, has_more: Boolean(next_cursor), next_cursor },
});

describe('runnable cursor pagination example (issue #550)', () => {
  let server: Server;
  let baseUrl: string;
  let requests: URL[];
  let answers: Array<{ body: unknown; status?: number; headers?: Record<string, string> }>;

  beforeAll(async () => {
    // Exercise the public ESM export with a fresh build, even on a clean checkout.
    await promisify(execFile)('yarn', ['workspace', '@vocab-bloom-hub/client', 'build'], { cwd: sdkRoot });
  }, 60_000);

  beforeEach(async () => {
    requests = [];
    answers = [];
    server = createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost');
      requests.push(url);
      const answer =
        url.pathname === '/api/v1/meta'
          ? { body: { data: dataset } }
          : (answers.shift() ?? { status: 500, body: { message: 'unexpected_request' } });
      res.writeHead(answer.status ?? 200, { 'content-type': 'application/json', ...answer.headers });
      res.end(JSON.stringify(answer.body));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  const run = (args: string[]) =>
    new Promise<{ code: number | string; stdout: string; stderr: string }>((resolve) => {
      execFile(
        process.execPath,
        [example, ...args],
        { cwd: sdkRoot, timeout: 10_000 },
        (error, stdout, stderr) => {
          resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
        },
      );
    });

  it('forwards an opaque cursor unchanged, keeps the filter, and stops on a full final page', async () => {
    const cursor = 'opaque+/= cursor?&%';
    answers.push({ body: page(['abandon', 'run'], cursor) }, { body: page(['sprint', 'walk'], null) });

    const result = await run([baseUrl]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(requests.map((url) => url.pathname)).toEqual(['/api/v1/meta', '/api/v1/words', '/api/v1/words']);
    expect(requests.slice(1).map((url) => url.searchParams.get('cursor'))).toEqual([null, cursor]);
    for (const url of requests.slice(1)) {
      expect(url.searchParams.get('limit')).toBe('2');
      expect(url.searchParams.getAll('part_of_speech')).toEqual(['verb']);
    }
    expect(result.stdout).toContain('Done: 4 entries across 2 page(s).');
    expect(result.stdout).toContain(JSON.stringify(dataset, null, 2));
    expect(result.stdout).toContain('run (changed on this instance)');
    expect(result.stdout).toContain(JSON.stringify(word('run', true), null, 2));
  });

  it.each([null, undefined])(
    'handles an empty first page with next_cursor=%s without another request',
    async (cursor) => {
      answers.push({ body: page([], cursor) });

      const result = await run([baseUrl]);

      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('No entries match the filter.');
      expect(result.stdout).toContain('Done: 0 entries across 1 page(s).');
      expect(requests.map((url) => url.pathname)).toEqual(['/api/v1/meta', '/api/v1/words']);
      expect(requests[1].searchParams.has('cursor')).toBe(false);
    },
  );

  it('reports an SDK failure and exits unsuccessfully without retrying or claiming completion', async () => {
    answers.push({ status: 429, body: { message: 'too_many_requests' }, headers: { 'retry-after': '42' } });

    const result = await run([baseUrl]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Pagination failed (too_many_requests, status 429)');
    expect(result.stderr).toContain('Retry after 42 seconds.');
    expect(result.stdout).not.toContain('Done:');
    expect(requests).toHaveLength(2);
  });

  it('requires an explicit instance URL', async () => {
    const result = await run([]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node cursor-pagination.mjs <instance-base-url>');
    expect(requests).toHaveLength(0);
  });
});
