/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MigrationComparison } from './index';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('next-intl', () => ({
  useLocale: () => 'ar',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));
jest.mock('@/core/apiBase', () => ({ browserApiBase: () => 'https://instance.test/api' }));

const result = (body: unknown, status = 200) =>
  ({ status, text: async () => JSON.stringify(body) }) as Response;
const local = result({
  data: [
    {
      dataset: 'default',
      title: 'Project',
      active: true,
      status: 200,
      response: [{ word: 'hello', vocabBloom: { source: 'project' } }],
    },
    { dataset: 'wordnet', title: 'WordNet', status: 404, response: { title: 'Fixture miss' } },
    { dataset: 'custom', title: 'Custom dictionary', status: 200, response: [{ word: 'hello', meanings: [] }] },
  ],
});

describe('live comparison UI', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: jest.Mock;
  const previousFetch = globalThis.fetch;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = previousFetch;
  });

  it('renders the original and one dataset with tabs, optional provenance and RTL controls', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/datasets') ? local : result([{ word: 'hello', origin: 'Original fixture' }]),
      ),
    );
    await act(async () => {
      root.render(<MigrationComparison service="dictionaryapi" />);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Original fixture');
    expect(container.textContent).toContain('Project');
    expect(container.textContent).toContain('WordNet');
    expect(container.textContent).toContain('Custom dictionary');
    expect(container.textContent).not.toContain('Fixture miss');
    expect(container.querySelectorAll('[role="tablist"]')[0].querySelectorAll('[role="tab"]')).toHaveLength(10);
    expect(container.querySelector('input[type="text"]')).toBeNull();
    expect(container.querySelector('section')!.dir).toBe('rtl');
    expect(Array.from(container.querySelectorAll('pre')).every((pre) => pre.dir === 'ltr')).toBe(true);
    expect(container.querySelectorAll('pre')[1].textContent).not.toContain('vocabBloom');
    act(() => {
      (container.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    });
    expect(container.querySelectorAll('pre')[1].textContent).toContain('vocabBloom');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    act(() => {
      const select = container.querySelector('#comparison-datasets') as HTMLSelectElement;
      select.value = 'wordnet';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('Fixture miss');
    expect(container.querySelectorAll('pre')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Original fixture');
  });

  it('shows local data even if the original request fails, and retries both APIs', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('/datasets') ? Promise.resolve(local) : Promise.reject(new TypeError('Network error')),
    );
    await act(async () => {
      root.render(<MigrationComparison service="freedictionaryapi" />);
    });
    expect(container.textContent).toContain('request_error');
    expect(container.textContent).toContain('WordNet');
    await act(async () => {
      (container.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2][0]).toContain('translations=true');
    expect(fetchMock.mock.calls[3][0]).toContain('/datasets?translations=true');
  });

  it('requests both APIs on word selection and keeps the dataset choice', async () => {
    fetchMock.mockResolvedValue(local);
    await act(async () => {
      root.render(<MigrationComparison service="dictionaryapi" />);
    });
    act(() => {
      const select = container.querySelector('#comparison-datasets') as HTMLSelectElement;
      select.value = 'wordnet';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      (container.querySelector('#comparison-words-bank') as HTMLButtonElement).click();
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2][0]).toContain('word=bank');
    expect(fetchMock.mock.calls[3][0]).toContain('/en/bank/datasets');
    expect((container.querySelector('#comparison-datasets') as HTMLSelectElement).value).toBe('wordnet');
    await act(async () => {
      container
        .querySelector('#comparison-words-bank')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(container.querySelector('#comparison-words-light')!.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement?.id).toBe('comparison-words-light');
  });

  it('opens terms in a popover and dismisses it with Escape or an outside click', async () => {
    fetchMock.mockResolvedValue(local);
    await act(async () => {
      root.render(<MigrationComparison service="dictionaryapi" />);
    });
    const trigger = container.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    act(() => trigger.click());
    expect(container.querySelector('[role="dialog"]')!.textContent).toContain('default');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    act(() => trigger.click());
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    act(() => trigger.click());
    act(() => {
      const select = container.querySelector('#comparison-datasets') as HTMLSelectElement;
      select.value = 'wordnet';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('retains the original if the instance returns an HTTP error', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/datasets')
          ? result({ message: 'Unavailable' }, 503)
          : result([{ word: 'Original fixture' }]),
      ),
    );
    await act(async () => {
      root.render(<MigrationComparison service="dictionaryapi" />);
    });
    expect(container.textContent).toContain('dataset_error');
    expect(container.textContent).toContain('HTTP 503');
    expect(container.textContent).toContain('Original fixture');
  });

  it('aborts requests when navigating away', async () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    await act(async () => {
      root.render(<MigrationComparison service="dictionaryapi" />);
    });
    const signals = fetchMock.mock.calls.map((call) => call[1].signal as AbortSignal);
    act(() => {
      root.render(<div />);
    });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
