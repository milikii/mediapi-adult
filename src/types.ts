/**
 * Type definitions for MediaPi Adult Extension
 */

export type DownloadStatus = "pending" | "active" | "paused" | "completed" | "error";

export interface SearchResult {
  id: string;
  title: string;
  magnetUrl: string;
  size: number;
  seeders: number;
  leechers: number;
  uploadDate: Date;
  category?: string;
}

export interface JAVMetadata {
  code: string;
  title_ja: string;
  title_zh: string;
  actress: string[];
  actress_zh: string[];
  maker: string;
  release_date: string;
  duration: number;
  category: string;
  poster_url?: string;
}

export interface DownloadMonitor {
  idempotency_key: string;
  download_id: string;
  infohash: string;
  status: DownloadStatus;
  progress: number;
  retention_until: number;
  created_at: number;
}

export interface ImportArtifact {
  import_id: string;
  download_id: string;
  source_path: string;  // Will be redacted
  target_path: string;  // Will be redacted
  strategy: "hardlink" | "copy";
  imported_at: number;
}
