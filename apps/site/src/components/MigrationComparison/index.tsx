'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { browserApiBase } from '@/core/apiBase';
import { localeDirection } from '@/i18n/direction';
import {
  comparisonUrls,
  COMPARISON_WORDS,
  originalComparisonPath,
  ComparisonServiceT,
  datasetResponses,
  DictionaryApiVersionT,
  fetchResponse,
  fetchOriginalSnapshot,
  ComparisonSnapshotT,
  originalService,
  ResponseT,
  responseJson,
} from './data';

import { ChoiceTabs, tabId, TermsPopover } from './controls';
import styles from './styles.module.scss';

type LoadT =
  | { pending: true }
  | { pending: false; response: ResponseT & Partial<ComparisonSnapshotT> }
  | { pending: false; error: true };

export const MigrationComparison = ({ service }: { service: ComparisonServiceT }) => {
  const t = useTranslations('comparison');
  const locale = useLocale();
  const [selectedDataset, setSelectedDataset] = useState('default');
  const [provenance, setProvenance] = useState(false);
  const [query, setQuery] = useState({
    word: 'hello',
    translations: false,
    version: 'v2' as DictionaryApiVersionT,
  });
  const [urls, setUrls] = useState<ReturnType<typeof comparisonUrls> | null>(null);
  const [original, setOriginal] = useState<LoadT>({ pending: true });
  const [datasets, setDatasets] = useState<LoadT>({ pending: true });

  useEffect(() => {
    let disposed = false;
    const nextUrls = comparisonUrls(service, query.word, query.translations, browserApiBase(), query.version);
    setUrls(nextUrls);
    setOriginal({ pending: true });
    setDatasets({ pending: true });
    const cleanups: (() => void)[] = [];
    const load = async (url: string, set: (value: LoadT) => void, snapshot = false) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      cleanups.push(() => {
        clearTimeout(timeout);
        controller.abort();
      });
      try {
        const response = await (snapshot ? fetchOriginalSnapshot : fetchResponse)(url, controller.signal);
        if (!disposed) set({ pending: false, response });
      } catch {
        if (!disposed) set({ pending: false, error: true });
      } finally {
        clearTimeout(timeout);
      }
    };
    void load(
      originalComparisonPath(service, query.word, query.translations, query.version),
      setOriginal,
      true,
    );
    void load(nextUrls.datasets, setDatasets);
    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [service, query]);

  const groups = !datasets.pending && 'response' in datasets ? datasetResponses(datasets.response) : null;
  const group = groups?.find((item) => item.dataset === selectedDataset) ?? groups?.[0];
  const originalInfo = originalService[service];
  const json = (body: unknown) => (
    <pre dir="ltr" tabIndex={0}>
      <code>{responseJson(body, provenance)}</code>
    </pre>
  );
  const requestLink = (url: string) => (
    <a className={styles.url} href={url} target="_blank" rel="noreferrer noopener" dir="ltr">
      GET {url}
    </a>
  );

  return (
    <section
      id="live-comparison"
      className={styles.comparison}
      lang={locale}
      dir={localeDirection(locale)}
      aria-labelledby="comparison-title"
    >
      <h2 id="comparison-title">{t('title')}</h2>
      <p>{t('description', { service: originalInfo.name })}</p>
      <ChoiceTabs
        id="comparison-words"
        label={t('word')}
        value={query.word}
        options={COMPARISON_WORDS.map((value) => ({ value, label: value }))}
        onChange={(word) => setQuery((previous) => ({ ...previous, word }))}
        dir="ltr"
        panel="comparison-responses"
      />
      <div className={styles.controls}>
        {service === 'dictionaryapi' && (
          <label className={styles.versionControl}>
            {t('version')}
            <select
              className={styles.versionSelect}
              value={query.version}
              onChange={(event) => {
                const version = event.target.value === 'v1' ? 'v1' : 'v2';
                setQuery((previous) => ({ ...previous, version }));
              }}
            >
              <option value="v2">v2</option>
              <option value="v1">v1</option>
            </select>
          </label>
        )}
        {service === 'freedictionaryapi' && (
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={query.translations}
              onChange={(event) =>
                setQuery((previous) => ({ ...previous, translations: event.target.checked }))
              }
            />
            {t('translations')}
          </label>
        )}
      </div>
      <label className={styles.checkbox}>
        <input type="checkbox" checked={provenance} onChange={(event) => setProvenance(event.target.checked)} />
        {t('provenance')}
      </label>
      <p className={styles.note}>{t('schema_note')}</p>
      <p role="status">
        {t('results', { word: query.word })}
        {groups && ` · ${t('dataset_count', { count: groups.length })}`}
      </p>
      {urls && <div className={styles.requests}>{requestLink(urls.datasets)}</div>}
      <div
        id="comparison-responses"
        role="tabpanel"
        aria-labelledby={tabId('comparison-words', query.word)}
        className={styles.grid}
      >
        <section className={styles.card} aria-label={t('original')}>
          <h3>
            {t('original')} ·{' '}
            <a href={originalInfo.home} target="_blank" rel="noreferrer noopener">
              {originalInfo.name}
            </a>
          </h3>
          {urls && requestLink(urls.original)}
          {original.pending ? (
            <p role="status">{t('loading')}</p>
          ) : 'error' in original ? (
            <p role="alert">{t('snapshot_missing')}</p>
          ) : (
            <>
              {original.response.reconstructed ? (
                <p className={styles.note}>{t('snapshot_reconstructed')}</p>
              ) : (
                <p className={styles.status}>HTTP {original.response.status}</p>
              )}
              {original.response.fetchedAt && (
                <p className={styles.note}>
                  {t('snapshot_date', {
                    date: original.response.fetchedAt.replace('T', ' ').slice(0, 19) + ' UTC',
                  })}
                </p>
              )}
              {original.response.stale && <p role="status">{t('snapshot_stale')}</p>}
              {original.response.unavailable && <p role="status">{t('snapshot_unavailable')}</p>}
              {json(original.response.body)}
            </>
          )}
        </section>
        <section className={styles.card} aria-label={t('datasets')}>
          <h3>{t('datasets')}</h3>
          {datasets.pending ? (
            <p role="status">{t('loading')}</p>
          ) : groups ? (
            <>
              {group && (
                <>
                  <select
                    id="comparison-datasets"
                    className={styles.datasetSelect}
                    aria-label={t('datasets')}
                    aria-controls="comparison-dataset-response"
                    value={group.dataset}
                    onChange={(event) => setSelectedDataset(event.target.value)}
                  >
                    {groups.map((item) => (
                      <option key={item.dataset} value={item.dataset}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <div
                    key={`${query.word}-${group.dataset}`}
                    id="comparison-dataset-response"
                    role="region"
                    aria-label={group.title}
                  >
                    <p>
                      <code>{group.dataset}</code> · {t('group_status', { status: group.status })}
                      {group.active && (
                        <>
                          {' '}
                          · <small>{t('active')}</small>
                        </>
                      )}
                    </p>
                    <TermsPopover label={t('terms')} closeLabel={t('close')} terms={group.terms} />
                    {json(group.body)}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p role="alert">{t('dataset_error')}</p>
              {'response' in datasets && (
                <>
                  <p>HTTP {datasets.response.status}</p>
                  {json(datasets.response.body)}
                </>
              )}
            </>
          )}
        </section>
      </div>
      {groups?.length === 0 && <p>{t('empty')}</p>}
    </section>
  );
};
