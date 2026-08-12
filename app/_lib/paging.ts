/**
 * Server-side list paging.
 *
 * Every list screen used to pull its whole table into the browser and filter it
 * there, which got slower with every row added. These helpers move search, tab
 * filtering, sorting and paging to the server: a list action loads its rows
 * once (usually behind `cached()`), hands them here, and returns ONE page.
 *
 * The row set itself is still assembled in the action, because most lists merge
 * several sources (v2 + legacy ERP + mobile app) that no single SQL statement
 * can page across. What changed is the payload: 25 rows instead of 500.
 */

export type PageQuery = {
  q?: string;
  tab?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type Paged<T> = {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  /** Row count per tab BEFORE the tab filter (so the chips can show numbers). */
  counts: Record<string, number>;
};

export type PagingSpec<T> = {
  /** Text match for the search box. */
  search: (row: T, keyword: string) => boolean;
  /** tab value → predicate. "all" is implicit and always matches. */
  tabs: Record<string, (row: T) => boolean>;
  /** sort key → comparator (ascending); `dir` flips it. */
  sorters: Record<string, (a: T, b: T) => number>;
  defaultSort?: string;
  defaultDir?: "asc" | "desc";
  defaultPerPage?: number;
};

const clampPerPage = (v: unknown, fallback: number) =>
  Math.min(Math.max(Number(v) || fallback, 5), 200);

/** Filter → count → sort → slice, in that order. */
export function paginate<T>(all: T[], params: PageQuery, spec: PagingSpec<T>): Paged<T> {
  const kw = String(params.q || "").trim().toLowerCase();
  const searched = kw ? all.filter((row) => spec.search(row, kw)) : all;

  // Counts are taken after the search but before the tab filter: that is what
  // the tab chips mean — "how many of the current result set are in this tab".
  const counts: Record<string, number> = { all: searched.length };
  for (const [key, match] of Object.entries(spec.tabs)) counts[key] = searched.filter(match).length;

  const tab = String(params.tab || "all");
  const match = spec.tabs[tab];
  const filtered = tab === "all" || !match ? searched : searched.filter(match);

  const sortKey = String(params.sort || spec.defaultSort || "");
  const comparator = spec.sorters[sortKey];
  const dir = (params.dir || spec.defaultDir || "desc") === "asc" ? 1 : -1;
  const sorted = comparator ? [...filtered].sort((a, b) => comparator(a, b) * dir) : filtered;

  const perPage = clampPerPage(params.perPage, spec.defaultPerPage ?? 25);
  const total = sorted.length;
  const pageCount = Math.max(Math.ceil(total / perPage), 1);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pageCount);

  return { rows: sorted.slice((page - 1) * perPage, page * perPage), total, page, perPage, counts };
}

/** Timestamp comparator that tolerates Date objects AND date strings. */
export const byTime = (get: (row: any) => unknown) => (a: any, b: any) => {
  const at = new Date(get(a) as any).getTime();
  const bt = new Date(get(b) as any).getTime();
  return (Number.isFinite(at) ? at : 0) - (Number.isFinite(bt) ? bt : 0);
};

/** Locale-aware text comparator. */
export const byText = (get: (row: any) => unknown) => (a: any, b: any) =>
  String(get(a) ?? "").localeCompare(String(get(b) ?? ""));

/** Numeric comparator. */
export const byNumber = (get: (row: any) => unknown) => (a: any, b: any) =>
  (Number(get(a)) || 0) - (Number(get(b)) || 0);
