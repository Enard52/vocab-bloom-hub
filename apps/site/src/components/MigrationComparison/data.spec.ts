import { comparisonUrls, datasetResponses, fetchResponse, responseJson } from './data';

describe('migration comparison', () => {
  it('sends the same encoded word and options to the original and its adapter', () => {
    expect(comparisonUrls('dictionaryapi', 'a/b %', true, 'https://instance.test/api/')).toEqual({
      original: 'https://api.dictionaryapi.dev/api/v2/entries/en/a%2Fb%20%25',
      datasets: 'https://instance.test/api/compat/dictionaryapi/v2/entries/en/a%2Fb%20%25/datasets',
    });
    expect(comparisonUrls('freedictionaryapi', 'Polish', true, '/api')).toEqual({
      original: 'https://freedictionaryapi.com/api/v1/entries/en/Polish?translations=true',
      datasets: '/api/compat/freedictionaryapi/v1/entries/en/Polish/datasets?translations=true',
    });
    expect(comparisonUrls('freedictionaryapi', 'hello', false, '/api').original).toContain(
      'translations=false',
    );
  });

  it('keeps every dataset, its misses, terms and exact adapter response', () => {
    const data = [
      {
        dataset: 'own',
        title: 'Own dictionary',
        active: true,
        license: 'CC0-1.0',
        status: 200,
        response: [{ word: 'fixture' }],
      },
      { dataset: 'wordnet', status: 404, response: { title: 'No definitions found' } },
      { dataset: 'opengloss', status: 200, response: { entries: [] } },
    ];
    const groups = datasetResponses({ status: 200, body: { data } })!;
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ title: 'Own dictionary', active: true, terms: { license: 'CC0-1.0' } });
    groups.forEach((group, index) => {
      expect(group.body).toBe(data[index].response);
      expect(group.status).toBe(data[index].status);
      expect(group.terms).not.toHaveProperty('response');
    });
  });

  it('distinguishes an empty dataset list from an unavailable or incompatible API', () => {
    expect(datasetResponses({ status: 200, body: { data: [] } })).toEqual([]);
    for (const response of [
      { status: 503, body: { data: [] } },
      { status: 200, body: [] },
      { status: 200, body: { data: [{}] } },
    ]) {
      expect(datasetResponses(response)).toBeNull();
    }
  });

  it('hides only vocabBloom, preserving service fields and allowing the complete JSON', () => {
    const body = {
      word: 'fixture',
      entries: [{ senses: [{ definition: 'Original fixture.' }], vocabBloom: { source: 'own' } }],
      source: { license: { name: 'CC0' } },
      vocabBloom: { dataset: 'own' },
    };
    expect(JSON.parse(responseJson(body, false))).toEqual({
      word: body.word,
      entries: [{ senses: body.entries[0].senses }],
      source: body.source,
    });
    expect(JSON.parse(responseJson(body, true))).toEqual(body);
    expect(body.entries[0]).toHaveProperty('vocabBloom');
  });

  it('retains upstream HTTP errors and plain text bodies', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('Try later', { status: 429 }));
    try {
      const signal = new AbortController().signal;
      expect(await fetchResponse('https://service.test', signal)).toEqual({ status: 429, body: 'Try later' });
      expect(fetchMock).toHaveBeenCalledWith('https://service.test', { signal, credentials: 'omit' });
    } finally {
      fetchMock.mockRestore();
    }
  });
});
