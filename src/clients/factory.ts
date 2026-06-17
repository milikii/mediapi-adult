import type { AdultConfig } from "../config";
import type { Downloader } from "./downloader";
import { QbittorrentClient } from "./qbittorrent";
import { TransmissionClient } from "./transmission";

export function createDownloader(config: AdultConfig): Downloader {
  if (config.downloaderType === "transmission") {
    return new TransmissionClient(config.transmission);
  }
  return new QbittorrentClient(config.qbittorrent);
}
