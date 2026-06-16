# Source Adapter Guide

## Purpose

Source adapters turn external adult sites into normalized MediaPi Adult data. They are the only place where site-specific URL construction, request headers, parsing, throttling, and health checks belong.

There are two adapter families:

- BT resource source adapters return downloadable public-BT resources, usually magnets.
- Metadata source adapters return JAV/adult work metadata, such as title, poster, maker, actresses, release date, duration, and category.

The same website may eventually support both families, but it must still use separate adapter modules or clearly separated classes. BT resource discovery must not use Prowlarr or PT indexers; those belong to the separate PT/viewing workflow.

## Source Taxonomy

### BT Resource Source

A BT resource source is allowed to:

- Search a public adult BT site.
- Return magnet URLs or enough public resource data to resolve a magnet.
- Return swarm metadata such as size, seeders, leechers, upload date, category, and page URL.
- Fail independently without breaking metadata lookup or other BT sites.

A BT resource source is not allowed to:

- Add torrents to the downloader.
- Read or write task registry, completed history, import targets, or Pi session entries.
- Decide dedupe, adult confirmation, import routing, cleanup, or downloader behavior.
- Depend on Prowlarr, Jackett, private/PT indexers, or `mediapi-viewing`.

### Metadata Source

A metadata source is allowed to:

- Resolve a normalized code or search query to canonical metadata.
- Return category confidence used later for routing to `censored`, `uncensored`, or `no_code`.
- Return external artwork or page URLs when useful for search cards.
- Fail independently without blocking BT results.

A metadata source is not allowed to:

- Return magnets as primary search results.
- Add torrents, mutate downloader state, or perform import/cleanup.
- Decide final dedupe or user confirmation outcomes.
- Store local paths or credentials.

## Step-by-Step: Add a New BT Resource Site

1. **Confirm it is a BT resource source** — it returns magnets or public resource details, not metadata-only, not Prowlarr/Jackett/PT. (See [Source Taxonomy](#source-taxonomy).)

2. **Pick a stable lowercase `name`** used in `ADULT_ENABLED_SITES` (e.g. `sukebei`).

3. **If the base URL is configurable**, add an env var (e.g. `SUKEBEI_BASE_URL`) with a public default; document it in `docs/ENVIRONMENT.md` and `.env.example`.

4. **Write the source profile** using the `BTResourceSourceProfile` shape from `src/types.ts` (`name`, `displayName`, family `"bt_resource"`, `baseUrlEnv`, `defaultBaseUrl`, capabilities incl. `search` + `magnet` and optional `resource_page`, `adultBoundary`, `rateLimitPolicy`, `failureMode`, `testFixtures`). (See [Acceptance Gate](#acceptance-gate-for-a-new-source).)

5. **Create the adapter** at the planned path `src/clients/bt-sites/<name>.ts` implementing the BT resource interface (see [BT Resource Interface](#bt-resource-interface)); return canonical `SearchResult[]` from `src/types.ts`. Search/parse ONLY — no downloader, task-state, dedupe, import, or cleanup side effects.

6. **Register it** in the BT resource registry so `ADULT_ENABLED_SITES` can select it; unknown names must raise an actionable config error. (See [Registry Rules](#registry-rules).)

7. **Add fixtures + tests**: normal, empty, malformed HTML, health-check success/failure, and error-redaction. (See [Tests](#tests).)

8. **Enable it**: add the `name` to `ADULT_ENABLED_SITES`, and update README/ENVIRONMENT for any new config var.

9. **Run gates locally**: `npm run build`, `npm test`, `npx tsc --noEmit`.

Adding a metadata source follows the same shape but uses the `metadata` family, the `MetadataSourceProfile` type, the planned `src/clients/metadata/<name>.ts` path, the Metadata Interface, and a separate (planned) `ADULT_ENABLED_METADATA_SOURCES` config — never `ADULT_ENABLED_SITES`.

## Acceptance Gate for a New Source

A new source can be added only when it has a small written source profile in the adapter file or adjacent docs:

| Field | Requirement |
| --- | --- |
| `name` | Stable lowercase identifier used in config, e.g. `sukebei`. |
| `family` | `bt_resource` or `metadata`. |
| `displayName` | Human-readable site name for user-facing cards. |
| `baseUrlEnv` | Environment variable for the base URL, if configurable. |
| `defaultBaseUrl` | Default public URL when no env override is set. |
| `capabilities` | For BT: `search`, `magnet`, optional `resource_page`. For metadata: `code_lookup`, optional `query_search`. |
| `adultBoundary` | Why this source belongs in the adult workflow. |
| `rateLimitPolicy` | Minimum delay/concurrency assumption, even if MVP only documents it. |
| `failureMode` | How partial failure is reported to the registry/tool. |
| `testFixtures` | Fixture names that cover normal, empty, and malformed responses. |

These fields map directly to the `SourceProfile` types (`BTResourceSourceProfile` / `MetadataSourceProfile`) in `src/types.ts`.

Sources without magnets are metadata sources, not BT resource sources. Sources that require private credentials, PT passkeys, or Prowlarr-like aggregation are out of scope for this extension.

## BT Resource Interface

The adapter interface is planned, not currently implemented. New adapters should implement this shape when `src/clients/bt-sites/base.ts` is added:

```typescript
export abstract class BTSiteAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;
  abstract readonly family: "bt_resource";

  abstract search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>;

  abstract healthCheck(): Promise<boolean>;
}
```

Search options should use a shared type:

> **Note:** `SearchOptions` already exists in `src/types.ts` — always import it, never redefine it.

```typescript
export interface SearchOptions {
  limit?: number;
  sortBy?: "seeders" | "published_at" | "size";
  signal?: AbortSignal;
}
```

Shared result fields must come from `src/types.ts`:

```typescript
export interface SearchResult {
  id: string;
  source: string;
  sourceDisplayName: string;
  title: string;
  magnetUrl: string;
  sizeBytes: number | null;
  seeders: number | null;
  leechers: number | null;
  publishedAt: string | null;
  category: string | null;
  pageUrl: string | null;
}
```

Result normalization rules:

- `source` must equal the adapter `name`.
- `id` must be stable for the same source result. Prefer infohash when present; otherwise use a deterministic hash of `source`, page URL, title, and magnet.
- `magnetUrl` must be a magnet URI with an `xt=urn:btih:` value when the site provides one.
- `publishedAt` must be ISO 8601 when known, otherwise `null`.
- `sizeBytes`, `seeders`, and `leechers` must be numbers when parsed confidently, otherwise `null`.
- `title` must preserve the source title. Do not translate inside BT adapters.
- `pageUrl` must be public external URL only. It must never be a local path.

## Metadata Interface

The metadata adapter interface is planned, not currently implemented. New adapters should implement this shape when `src/clients/metadata/base.ts` is added:

```typescript
export abstract class MetadataAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;
  abstract readonly family: "metadata";

  abstract lookupByCode(
    code: string,
    options?: MetadataLookupOptions
  ): Promise<JAVMetadata | null>;

  abstract search?(
    query: string,
    options?: MetadataLookupOptions
  ): Promise<JAVMetadata[]>;

  abstract healthCheck(): Promise<boolean>;
}
```

Metadata options should use a shared type:

> **Note:** `MetadataLookupOptions` already exists in `src/types.ts` — always import it, never redefine it.

```typescript
export interface MetadataLookupOptions {
  signal?: AbortSignal;
}
```

Metadata normalization rules:

- `code` must be normalized before returning metadata.
- `category` must be `censored`, `uncensored`, or `null`; use `null` when the source is not reliable enough.
- `posterUrl` must be an external URL or `null`.
- Missing fields must be `null` or empty arrays, not guessed strings.
- Translation is optional and must not block metadata lookup.

## Registry Rules

Registries are responsible for source selection and partial failure handling.

- `ADULT_ENABLED_SITES` selects BT resource sources only.
- Metadata sources should use a separate config key when implemented, such as `ADULT_ENABLED_METADATA_SOURCES`.
- Unknown source names must produce an actionable configuration error at registry creation time.
- Search-time explicit `sites` filters may only narrow the configured BT source set.
- Registries should search enabled sources concurrently with per-source timeout boundaries.
- One source failure must not fail the whole search when at least one other source succeeds.
- The combined search response should include source-level warnings for failed sources, but warnings must not contain credentials, local paths, or raw secret-bearing environment values.
- Deduplication across sources should prefer infohash. If no infohash exists, dedupe only exact same source result IDs; title-only dedupe may warn but must not silently drop results.

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

## Planned Metadata Adapter: JavBus

The first metadata adapter should be `src/clients/metadata/javbus.ts`.

Requirements:

- Read `JAVBUS_BASE_URL`, defaulting to `https://www.javbus.com`.
- Look up normalized JAV codes.
- Include a clear User-Agent.
- Use a request timeout.
- Parse title, original title when available, actresses, maker, release date, duration, category confidence, and poster URL.
- Return `null` when a code is not found.
- Keep category confidence conservative; route uncertain results to `null`, allowing later logic to choose `no_code` or ask the user.

## Error Policy

- Adapter `search` may throw for site-level request or parse failures.
- Registry code catches adapter failures and returns partial results from other adapters.
- Error messages must not include credentials or local paths.
- Empty search results are not an error.
- Parser confidence problems should produce missing/null fields, not fabricated values.

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
- Normalize dates into ISO 8601 strings.
- Preserve original titles in adapters; translation belongs in a later formatting or metadata enrichment layer.
- Parse magnets with a shared helper once it exists, rather than duplicating infohash extraction per adapter.
- Keep page-layout selectors in one small parser module per source so fixture changes are easy to review.
- Do not log raw response bodies by default.

## Tests

Every source adapter should have:

- Parser fixture test for a representative result page.
- Empty result test.
- Malformed HTML test.
- Health-check success and failure tests with mocked fetch.
- Search option tests for `limit` and sorting if implemented by the adapter.
- Redaction test for errors that include source URL or response details.

Integration tests against real sites must be opt-in so normal CI does not depend on external availability.

## Contribution Checklist

- Adapter has a stable `name` suitable for `ADULT_ENABLED_SITES`.
- Adapter declares the correct source family.
- BT adapters search a public BT source, not Prowlarr or a PT indexer.
- Metadata adapters do not return magnets as primary search results.
- Adapter returns canonical fields from `src/types.ts`.
- Source profile is documented.
- No credentials or local paths are logged.
- Tests cover parser behavior.
- README or environment docs mention any new config variables.
