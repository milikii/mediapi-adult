# BT Adapter Guide

## Purpose

BT site adapters turn a search query into normalized magnet results from public BT sites. Each adapter owns site-specific request, parsing, and health-check logic. Registries and tools consume only the shared adapter interface.

This extension must not use Prowlarr or PT indexers for adult resource discovery. Those belong to the separate PT/viewing workflow.

## Interface

Adapters implement `BTSiteAdapter`:

```typescript
export abstract class BTSiteAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;

  abstract search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>;

  abstract healthCheck(): Promise<boolean>;
}
```

Shared result fields should come from `src/types.ts`:

```typescript
export interface SearchResult {
  id: string;
  source: string;
  title: string;
  magnetUrl: string;
  sizeBytes: number;
  seeders: number;
  leechers: number;
  publishedAt: Date;
  category?: string;
}
```

If the current local interface has not yet been unified, update the base adapter to import the canonical type before adding new adapters.

## MVP Adapter: Sukebei

The first adapter should be `src/clients/bt-sites/sukebei.ts`.

Requirements:

- Read `SUKEBEI_BASE_URL`, defaulting to `https://sukebei.nyaa.si`.
- Search by URL-encoded query.
- Include a clear User-Agent.
- Use a request timeout.
- Parse title, magnet URL, size, seeders, leechers, upload date, and category when available.
- Return results sorted by the requested option or by seeders by default.
- Limit results to `options.limit` when provided.

## Error Policy

- Adapter `search` may throw for site-level request or parse failures.
- Registry code catches adapter failures and returns partial results from other adapters.
- Error messages must not include credentials or local paths.
- Empty search results are not an error.

## Health Check

`healthCheck` should perform the cheapest reliable request:

- Prefer `HEAD` when the site handles it correctly.
- Fall back to a small `GET` request if needed.
- Use a short timeout.
- Return `false` on network, timeout, or non-2xx/3xx responses.

## Parsing Guidelines

- Prefer a real HTML parser if a dependency is already accepted for the repository.
- If using regex for MVP, keep parsing functions small and covered by fixtures.
- Normalize size strings into bytes.
- Normalize dates into `Date` objects.
- Preserve original titles; do not translate inside BT adapters.

## Tests

Every adapter should have:

- Parser fixture test for a representative result page.
- Empty result test.
- Malformed HTML test.
- Health-check success and failure tests with mocked fetch.
- Search option tests for `limit` and sorting if implemented by the adapter.

Integration tests against real sites must be opt-in so normal CI does not depend on external availability.

## Contribution Checklist

- Adapter has a stable `name` suitable for `ADULT_ENABLED_SITES`.
- Adapter searches a public BT source, not Prowlarr or a PT indexer.
- Adapter returns canonical `SearchResult` fields.
- No credentials or local paths are logged.
- Tests cover parser behavior.
- README or environment docs mention any new config variables.
