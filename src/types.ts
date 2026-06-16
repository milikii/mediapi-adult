export const REDACTED_PATH = "[REDACTED]" as const;

export type DownloaderType = "qbittorrent" | "transmission";

export type TargetAlias = "censored" | "uncensored" | "no_code";

export type SourceFamily = "bt_resource" | "metadata";

export type BTResourceCapability = "search" | "magnet" | "resource_page";

export type MetadataCapability = "code_lookup" | "query_search";

export type SearchSortBy = "seeders" | "published_at" | "size";

export type CodeStatus = "coded" | "no_code_confirmed" | "needs_code";

export type AdultTaskStatus =
  | "registered"
  | "downloading"
  | "completed"
  | "importing"
  | "imported"
  | "cleaned"
  | "duplicate_blocked"
  | "needs_code"
  | "import_failed"
  | "import_conflict"
  | "cleanup_failed";

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

export interface JAVMetadata {
  code: string;
  title: string | null;
  originalTitle: string | null;
  actresses: string[];
  maker: string | null;
  releaseDate: string | null;
  durationMinutes: number | null;
  category: TargetAlias | null;
  posterUrl: string | null;
}

export interface SearchOptions {
  limit?: number;
  sortBy?: SearchSortBy;
  signal?: AbortSignal;
}

export interface MetadataLookupOptions {
  signal?: AbortSignal;
}

export type SourceProfile = BTResourceSourceProfile | MetadataSourceProfile;

interface BaseSourceProfile {
  name: string;
  displayName: string;
  baseUrlEnv: string | null;
  defaultBaseUrl: string;
  adultBoundary: string;
  rateLimitPolicy: string;
  failureMode: string;
  testFixtures: string[];
}

export interface BTResourceSourceProfile extends BaseSourceProfile {
  family: "bt_resource";
  capabilities: BTResourceCapability[];
}

export interface MetadataSourceProfile extends BaseSourceProfile {
  family: "metadata";
  capabilities: MetadataCapability[];
}

export interface AdultTask {
  task_id: string;
  status: AdultTaskStatus;
  downloader: DownloaderType;
  downloader_id: string;
  infohash: string | null;
  code: string | null;
  code_status: CodeStatus;
  display_title: string;
  target_alias: TargetAlias;
  dedupe_override: boolean;
  created_at: number;
  updated_at: number;
  error_summary?: string;
}

export interface CompletedHistoryItem {
  key_type: "code" | "infohash";
  key: string;
  code: string | null;
  code_status: Exclude<CodeStatus, "needs_code">;
  infohash: string | null;
  display_title: string;
  target_alias: TargetAlias;
  import_id: string;
  completed_at: number;
}

export interface ImportArtifact {
  import_id: string;
  task_id: string;
  target_alias: TargetAlias;
  source_path: typeof REDACTED_PATH;
  target_path: typeof REDACTED_PATH;
  strategy: "hardlink" | "copy";
  files_imported: number;
  imported_at: number;
}

export interface CleanupRecord {
  task_id: string;
  downloader_id: string;
  deleted_files: boolean;
  cleaned_at: number;
  error_summary?: string;
}
