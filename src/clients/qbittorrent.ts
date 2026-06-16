import { DownloaderEndpointConfig } from "../config";
import { Downloader, DownloaderTaskInfo, FetchLike } from "./downloader";
import { parseMagnet } from "../utils/magnet";

interface QbTorrent {
  hash: string;
  name: string;
  progress: number;
  content_path?: string;
  save_path?: string;
}

export class QbittorrentClient implements Downloader {
  private sid: string | null = null;

  constructor(
    private readonly endpoint: DownloaderEndpointConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  private async ensureAuth(): Promise<void> {
    if (this.sid !== null) return;

    if (!this.endpoint.username) {
      this.sid = "";
      return;
    }

    const body = new URLSearchParams({
      username: this.endpoint.username,
      password: this.endpoint.password ?? "",
    });

    const res = await this.fetchImpl(
      `${this.endpoint.url}/api/v2/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: this.endpoint.url,
        },
        body: body.toString(),
      }
    );

    const text = await res.text();
    if (text !== "Ok.") {
      throw new Error("qBittorrent login failed");
    }

    const match = /SID=([^;]+)/.exec(res.headers.get("set-cookie") ?? "");
    if (match) {
      this.sid = match[1];
    } else {
      this.sid = "";
    }
  }

  private async request(
    path: string,
    method: "GET" | "POST",
    body?: Record<string, string>
  ): Promise<Response> {
    await this.ensureAuth();

    const headers: Record<string, string> = {
      Referer: this.endpoint.url,
    };

    if (this.sid) {
      headers["Cookie"] = `SID=${this.sid}`;
    }

    let fetchBody: string | undefined;
    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      fetchBody = new URLSearchParams(body ?? {}).toString();
    }

    const res = await this.fetchImpl(`${this.endpoint.url}${path}`, {
      method,
      headers,
      body: fetchBody,
    });

    if (res.status === 403) {
      this.sid = null;
      await this.ensureAuth();

      const retryHeaders: Record<string, string> = {
        Referer: this.endpoint.url,
      };

      if (this.sid) {
        retryHeaders["Cookie"] = `SID=${this.sid}`;
      }

      let retryBody: string | undefined;
      if (method === "POST") {
        retryHeaders["Content-Type"] = "application/x-www-form-urlencoded";
        retryBody = new URLSearchParams(body ?? {}).toString();
      }

      return this.fetchImpl(`${this.endpoint.url}${path}`, {
        method,
        headers: retryHeaders,
        body: retryBody,
      });
    }

    return res;
  }

  private toTaskInfo(t: QbTorrent): DownloaderTaskInfo {
    return {
      downloaderId: t.hash,
      infohash: t.hash,
      name: t.name,
      progress: t.progress,
      isComplete: t.progress >= 1,
      contentPath: t.content_path ?? t.save_path ?? null,
    };
  }

  async addMagnet(magnet: string): Promise<DownloaderTaskInfo> {
    const parsed = parseMagnet(magnet);
    await this.request("/api/v2/torrents/add", "POST", { urls: magnet });
    return {
      downloaderId: parsed.infohash ?? "",
      infohash: parsed.infohash,
      name: parsed.displayName ?? "",
      progress: 0,
      isComplete: false,
      contentPath: null,
    };
  }

  async getTask(downloaderId: string): Promise<DownloaderTaskInfo | null> {
    const res = await this.request(
      `/api/v2/torrents/info?hashes=${downloaderId.toLowerCase()}`,
      "GET"
    );
    const arr = (await res.json()) as QbTorrent[];
    if (arr.length === 0) return null;
    return this.toTaskInfo(arr[0]);
  }

  async listTasks(): Promise<DownloaderTaskInfo[]> {
    const res = await this.request("/api/v2/torrents/info", "GET");
    const arr = (await res.json()) as QbTorrent[];
    return arr.map((t) => this.toTaskInfo(t));
  }

  async removeTask(downloaderId: string, deleteFiles: boolean): Promise<void> {
    await this.request("/api/v2/torrents/delete", "POST", {
      hashes: downloaderId.toLowerCase(),
      deleteFiles: deleteFiles ? "true" : "false",
    });
  }
}
