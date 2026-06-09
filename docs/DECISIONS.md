# Architecture Decision Records - MediaPi Adult Extension

本文档记录 MediaPi Adult Extension 的架构决策。

---

## Active Decisions

### D030: TypeScript Extensions over Python Backend

**Status**: ACTIVE

**Decision**: Use TypeScript Pi extensions instead of Python FastAPI backend.

**Reason**:
- Pi native extension system is TypeScript-first
- Eliminates Docker, HTTP server, port management
- Simpler deployment: copy .ts files to `~/.pi/agent/extensions/`
- In-process execution (faster, lower overhead)
- Native Pi session state (no independent database needed)

**Applies to**: Adult Extension

---

### D032: Pluggable BT Site Adapters

**Status**: ACTIVE

**Decision**: Adult extension uses pluggable adapter architecture for BT sites.

**Design**:
- `BTSiteAdapter` interface (search, healthCheck)
- `AdapterRegistry` for multi-site management
- One TypeScript file per site (`sukebei.ts`, `javbus.ts`, etc.)
- Progressive expansion: Sukebei → JavBus → community contributions

**Reason**:
- Add sites incrementally (one at a time validation)
- Single-site failure doesn't affect others
- Community can contribute new adapters via PR
- Enable/disable sites via configuration

**Applies to**: Adult Extension

---

### D033: Pi Session State over SQLite

**Status**: ACTIVE

**Decision**: Use Pi session entries (`pi.appendEntry`) instead of SQLite for persistence.

**Reason**:
- Pi sessions already persist to `.pi/sessions/*.jsonl`
- No database, no migrations, no schema versioning
- Session compaction handles old entry cleanup
- Simpler recovery: read from `ctx.sessionManager.getEntries()`

**Replaces**:
- `download_monitor` table → `adult_download` session entries
- `import_artifact` table → `adult_import` entries
- `resource_handle` table → `adult_resource_handle` entries
- `idempotency_log` table → implicit (check customType + idempotency_key)

**Applies to**: Adult Extension

---

### D036: Rich Metadata Cards

**Status**: ACTIVE

**Decision**: Adult search returns rich metadata cards with poster, translated titles, and magnet list.

**Card Format**:
```
🎬 [SSIS-843] 比AI更瑟情的肉体...
SSIS-843 AIよりシコい女体...
[Poster Image]

━━━━━━━━━━━━━━━━━━
👤 演员： 宇野みれい (宇野美玲)
🏢 片商： S1 NO.1 STYLE
📅 日期： 2023-08-18  |  ⏳ 时长： 175分钟
📦 分类： 有码 (Censored)

━━━━━━━━━━━━━━━━━━
💾 资源列表：

【资源 1】 sukebei | 8.9 GB | 做种: 7
🧲 magnet:?xt=urn:btih:...
```

**Implementation**:
- Concurrent search: BT sites (magnets) + JAV metadata sites (info)
- Aggregate metadata from JavBus + JavLibrary
- Translate Japanese titles to Chinese
- Display magnets inline (no opaque handles for adult content)

**Reason**:
- Users need rich context for adult content
- Visual appeal improves UX
- Translation breaks language barrier
- Inline magnets simplify workflow (no extra step)

**Applies to**: Adult Extension

---

### D037: Separate Downloader Clients

**Status**: ACTIVE

**Decision**: Adult extension uses independent, configurable downloader client (qBittorrent or Transmission).

**Configuration**:
```bash
# Adult Extension (BT torrents)
ADULT_DOWNLOADER_TYPE=transmission   # or qbittorrent
ADULT_TR_URL=http://localhost:9092
ADULT_TR_USERNAME=transmission
ADULT_TR_PASSWORD=***
```

**Architecture**:
```typescript
// Shared interface
interface DownloaderClient {
  addTorrent(magnet: string): Promise<string>;
  getTorrentInfo(id: string): Promise<TorrentInfo>;
  // ...
}

// Factory
function createAdultDownloader(): DownloaderClient {
  // Based on ADULT_DOWNLOADER_TYPE
}
```

**Reason**:
- BT trackers may have different client preferences
- Flexibility: users can choose qBittorrent or Transmission
- Future-proof: easy to add support for other clients

**Applies to**: Adult Extension

---

### D038: Separate GitHub Repositories

**Status**: ACTIVE

**Decision**: Split into two independent repositories:
- **mediapi-viewing**: PT viewing extension (movies/series)
- **mediapi-adult**: BT adult extension (JAV content)

**Reason**:
- **Clear separation**: Different target audiences, different workflows
- **Independent evolution**: Adult can evolve without affecting Viewing
- **Privacy**: Adult extension users don't need to clone/see viewing code
- **Community**: Easier to accept contributions per extension
- **Deployment**: Users install only what they need
- **Search**: GitHub search won't mix adult content with viewing features

**Applies to**: Project structure

---

## Summary: Active Decisions

| ID | Decision | Applies To |
|----|----------|-----------|
| **D030** | **TypeScript extensions** | **Architecture** |
| **D032** | **Pluggable BT adapters** | **Adult extension** |
| **D033** | **Pi session state** | **Adult extension** |
| **D036** | **Rich metadata cards** | **Adult extension** |
| **D037** | **Separate downloader clients** | **Adult extension** |
| **D038** | **Separate GitHub repos** | **Project structure** |
