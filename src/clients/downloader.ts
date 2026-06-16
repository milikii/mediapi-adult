export interface DownloaderTaskInfo {
  downloaderId: string;
  infohash: string | null;
  name: string;
  progress: number;
  isComplete: boolean;
  contentPath: string | null;
}

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export interface Downloader {
  addMagnet(magnet: string): Promise<DownloaderTaskInfo>;
  getTask(downloaderId: string): Promise<DownloaderTaskInfo | null>;
  listTasks(): Promise<DownloaderTaskInfo[]>;
  removeTask(downloaderId: string, deleteFiles: boolean): Promise<void>;
}
