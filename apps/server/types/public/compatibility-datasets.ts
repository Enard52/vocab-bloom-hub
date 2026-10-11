import type { PublicDatasetTermsV1T, PublicWordDatasetsV1MetaT } from './v1';
import type { DictionaryApiErrorT, DictionaryApiV1ResT, DictionaryApiV2ResT } from './dictionaryapi';
import type { FreeDictionaryEntriesResT } from './freedictionaryapi';

/** Each response is scoped to the dataset whose terms surround it; entries are never merged. */
type DictionaryApiDatasetT<T> = PublicDatasetTermsV1T &
  ({ status: 200; response: T } | { status: 404; response: DictionaryApiErrorT });

type CompatibilityDatasetsResT<T> = {
  data: T[];
  /** found counts datasets with entries, including for adapters whose misses are HTTP 200. */
  meta: PublicWordDatasetsV1MetaT & { language: string };
};

export type DictionaryApiV1DatasetsResT = CompatibilityDatasetsResT<DictionaryApiDatasetT<DictionaryApiV1ResT>>;
export type DictionaryApiV2DatasetsResT = CompatibilityDatasetsResT<DictionaryApiDatasetT<DictionaryApiV2ResT>>;
export type FreeDictionaryDatasetsResT = CompatibilityDatasetsResT<
  PublicDatasetTermsV1T & { status: 200; response: FreeDictionaryEntriesResT }
>;
