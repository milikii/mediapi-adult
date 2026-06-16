import { DownloaderEndpointConfig } from "../config";
import { Downloader, DownloaderTaskInfo, FetchLike } from "./downloader";
import { parseMagnet } from "../utils/magnet";

interface TrTorrent {
  hashString: string;
  name: string;
  percentDone: number;
  downloadDir?: string;
}

export class TransmissionClient implements Downloader {
  private sessionId: string | null = null;

  constructor(
    private readonly endpoint: DownloaderEndpointConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  private async rpc(
    method: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const url = `${this.endpoint.url}/transmission/rpc`;
    const body = JSON.stringify({ method, arguments: args });

    const buildHeaders = (): Record<string, string> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.endpoint.username) {
        headers["Authorization"] =
          "Basic " +
          Buffer.from(
            `${this.endpoint.username}:${this.endpoint.password ?? ""}`
          ).toString("base64");
      }
      if (this.sessionId) {
        headers["X-Transmission-Session-Id"] = this.sessionId;
      }
      return headers;
    };

    let res = await this.fetchImpl(url, {
      method: "POST",
      headers: buildHeaders(),
      body,
    });

    if (res.status === 409) {
      this.sessionId = res.headers.get("x-transmission-session-id") ?? "";
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: buildHeaders(),
        body,
      });
    }

    const json = (await res.json()) as Record<string, unknown>;
    if (json["result"] !== "success") {
      throw new Error("Transmission RPC error");
    }
    return json["arguments"] as Record<string, unknown>;
  }

  private toTaskInfo(t: TrTorrent): DownloaderTaskInfo {
    return {
      downloaderId: t.hashString.toLowerCase(),
      infohash: t.hashString.toLowerCase(),
      name: t.name,
      progress: t.percentDone,
      isComplete: t.percentDone >= 1,
      contentPath:
        t.downloadDir && t.name
          ? `${t.downloadDir}/${t.name}`
          : (t.downloadDir ?? null),
    };
  }

  async addMagnet(magnet: string): Promise<DownloaderTaskInfo> {
    const parsed = parseMagnet(magnet);
    const args = await this.rpc("torrent-add", { filename: magnet });
    const added = (args["torrent-added"] ?? args["torrent-duplicate"]) as
      | TrTorrent
      | undefined;
    const hash = added?.hashString ?? parsed.infohash ?? "";
    return {
      downloaderId: hash.toLowerCase(),
      infohash: parsed.infohash,
      name: added?.name ?? parsed.displayName ?? "",
      progress: 0,
      isComplete: false,
      contentPath: null,
    };
  }

  async getTask(downloaderId: string): Promise<DownloaderTaskInfo | null> {
    const args = await this.rpc("torrent-get", {
      ids: [downloaderId.toLowerCase()],
      fields: ["hashString", "name", "percentDone", "downloadDir"],
    });
    const torrents = args["torrents"] as TrTorrent[];
    if (torrents.length === 0) return null;
    return this.toTaskInfo(torrents[0]);
  }

  async listTasks(): Promise<DownloaderTaskInfo[]> {
    const args = await this.rpc("torrent-get", {
      fields: ["hashString", "name", "percentDone", "downloadDir"],
    });
    const torrents = args["torrents"] as TrTorrent[];
    return torrents.map((t) => this.toTaskInfo(t));
  }

  async removeTask(
    downloaderId: string,
    deleteFiles: boolean
  ): Promise<void> {
    await this.rpc("torrent-remove", {
      ids: [downloaderId.toLowerCase()],
      "delete-local-data": deleteFiles,
    });
  }
}
