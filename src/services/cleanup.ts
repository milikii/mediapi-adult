import type { Downloader } from "../clients/downloader";
import type { CleanupRecord } from "../types";

export interface CleanupRequest {
  taskId: string;
  downloaderId: string;
  deleteFiles: boolean;
  cleanedAt: number;
}

export class CleanupService {
  constructor(private readonly downloader: Downloader) {}

  async cleanup(req: CleanupRequest): Promise<CleanupRecord> {
    try {
      await this.downloader.removeTask(req.downloaderId, req.deleteFiles);
      return {
        task_id: req.taskId,
        downloader_id: req.downloaderId,
        deleted_files: req.deleteFiles,
        cleaned_at: req.cleanedAt,
      };
    } catch (err) {
      return {
        task_id: req.taskId,
        downloader_id: req.downloaderId,
        deleted_files: false,
        cleaned_at: req.cleanedAt,
        error_summary: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
