# MediaPi Adult Extension - 实施计划

**创建日期**: 2026-06-09  
**当前状态**: 项目初始化  
**架构**: 单 TypeScript Pi 扩展（adult）

---

## 执行总结

MediaPi Adult 是一个基于 **Pi TypeScript 扩展** 的 BT 成人链自动化系统，通过聊天接口（Telegram/微信/飞书）提供快速工作流。

**核心架构**:
- **Adult Extension**: 5个工具，可插拔 BT 适配器，3天快速保种
- **丰富元数据卡片**: 海报 + 日文/中文标题 + 演员信息
- **强制隐私脱敏**: 所有路径信息强制隐藏
- **隔离导入**: 保留原始文件名，独立目录

**时间线**: 约 3 周到 MVP 完成

---

## 项目里程碑

| 阶段 | 时间 | 重点 | 交付物 | 状态 |
|------|------|------|--------|------|
| **Phase 1** | Week 1 | MVP（5工具+Sukebei） | 基础工作流 | ⏸️ 待开始 |
| **Phase 2** | Week 2 | 多站点扩展 | JavBus + Tokyo Toshokan | ⏸️ 待开始 |
| **Phase 3** | Week 3+ | 社区贡献框架 | 适配器模板 + 指南 | ⏸️ 待开始 |

---

## Phase 1: MVP（Week 1）⏸️

**目标**: 基础工作流 - 搜索 → 下载 → 导入 → 清理

### 1.1 基础设施

**BT 适配器接口** (`src/clients/bt-sites/base.ts`):
```typescript
export abstract class BTSiteAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;
  
  abstract search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  abstract healthCheck(): Promise<boolean>;
}
```

**元数据适配器接口** (`src/clients/metadata/base.ts`):
```typescript
export abstract class MetadataAdapter {
  abstract readonly name: string;
  abstract getMetadata(code: string): Promise<JAVMetadata | null>;
  abstract healthCheck(): Promise<boolean>;
}
```

**适配器注册表** (`src/adapters/magnet-registry.ts`, `metadata-registry.ts`):
- 管理多个 BT 站点
- 并发搜索
- 单站点失败容错

---

### 1.2 核心工具

#### Tool 1: adult_search

**功能**: 搜索番号 + 展示丰富元数据卡片

**输入**:
```typescript
{
  query: string;              // 番号，如 "SSIS-843"
  sites?: string[];           // 指定站点，留空则搜索所有
}
```

**输出**:
```typescript
{
  code: string;
  title_ja: string;
  title_zh: string;
  actress: string[];
  actress_zh: string[];
  maker: string;
  release_date: string;
  duration: number;
  category: string;
  poster_url: string;
  magnets: [
    { source: "sukebei", size: 8.9GB, seeders: 7, magnet: "..." },
    // ...
  ]
}
```

**实现要点**:
- 并发搜索：Sukebei（磁力链）+ JavBus（元数据）
- 翻译：日文标题 → 中文
- 卡片格式化

---

#### Tool 2: adult_get_resources

**功能**: 从搜索结果获取资源详情

**输入**:
```typescript
{
  result_id: string;          // 来自 adult_search 结果
  source: string;             // 站点名称
}
```

**输出**:
```typescript
{
  resource: ResourceInfo;
  handle?: string;            // 可选：资源句柄（如需要）
}
```

---

#### Tool 3: adult_add_download

**功能**: 添加下载（3天保种）

**输入**:
```typescript
{
  magnet: string;             // 磁力链（直接传递，不加密）
  idempotency_key: string;
  retention_days?: number;    // 默认 3 天
}
```

**输出**:
```typescript
{
  download_id: string;
  retention_until: number;
  is_duplicate: boolean;
}
```

**实现要点**:
- 幂等性检查（session entry）
- qBittorrent/Transmission 添加
- 记录到 Pi session

---

#### Tool 4: adult_import

**功能**: 导入到隔离目录（保留原名 + 强制脱敏）

**输入**:
```typescript
{
  download_id: string;
  target_directory: string;   // 隔离目录
}
```

**输出**:
```typescript
{
  import_id: string;          // [REDACTED]
  target_path: string;        // [REDACTED]
  strategy_used: "hardlink" | "copy";
}
```

**实现要点**:
- 保留原始文件名
- 隔离目录验证
- 所有路径信息强制脱敏
- 硬链接优先 + EXDEV 回退

---

#### Tool 5: adult_cleanup

**功能**: 快速清理（3天后）

**输入**:
```typescript
{
  download_id: string;
  force?: boolean;
}
```

**输出**:
```typescript
{
  success: boolean;
}
```

**实现要点**:
- 简化的保种期检查（3天）
- 通过下载器 API 删除
- 清理记录脱敏

---

### 1.3 适配器实现

#### Sukebei 适配器 (`src/clients/bt-sites/sukebei.ts`)

**功能**: 搜索 Sukebei 获取磁力链

**实现**:
```typescript
export class SukebeiAdapter extends BTSiteAdapter {
  readonly name = "sukebei";
  readonly displayName = "Sukebei";
  readonly baseUrl = "https://sukebei.nyaa.si";
  
  async search(query: string): Promise<SearchResult[]> {
    // 1. 构造搜索 URL
    const url = `${this.baseUrl}/?q=${encodeURIComponent(query)}`;
    
    // 2. 获取 HTML
    const html = await fetch(url).then(r => r.text());
    
    // 3. 解析表格行
    return this.parseHTML(html);
  }
  
  private parseHTML(html: string): SearchResult[] {
    // 正则匹配种子信息
    // 返回：id, title, magnetUrl, size, seeders, leechers
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, { 
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

---

#### JavBus 元数据适配器 (`src/clients/metadata/javbus-metadata.ts`)

**功能**: 获取 JAV 元数据（标题、演员、片商等）

**实现**:
```typescript
export class JavBusMetadataAdapter extends MetadataAdapter {
  readonly name = "javbus";
  readonly displayName = "JavBus";
  readonly baseUrl = "https://www.javbus.com";
  
  async getMetadata(code: string): Promise<JAVMetadata> {
    // 1. 访问详情页
    const url = `${this.baseUrl}/${code}`;
    const html = await fetch(url).then(r => r.text());
    
    // 2. 解析元数据
    return {
      code,
      title_ja: parseTitle(html),
      title_zh: await translate(parseTitle(html)),
      actress: parseActress(html),
      actress_zh: await translateActress(parseActress(html)),
      maker: parseMaker(html),
      release_date: parseDate(html),
      duration: parseDuration(html),
      category: parseCategory(html),
      poster_url: parsePoster(html),
    };
  }
}
```

---

#### 翻译服务 (`src/services/translator.ts`)

**功能**: 日文 → 中文翻译

**实现**:
```typescript
export class TranslatorService {
  async translate(text: string, targetLang: string = "zh"): Promise<string> {
    // 可选实现：
    // 1. Google Translate API
    // 2. 本地翻译库
    // 3. 简单映射表（演员名）
    
    // MVP: 返回原文（翻译可选）
    return text;
  }
}
```

---

### 1.4 下载器支持

**qBittorrent 客户端** (`src/clients/qbittorrent.ts`):
- 复用 viewing 仓库的实现
- 独立配置（ADULT_QB_URL）

**Transmission 客户端** (`src/clients/transmission.ts`):
- 复用 viewing 仓库的实现
- 独立配置（ADULT_TR_URL）

**下载器工厂** (`src/clients/downloader-factory.ts`):
```typescript
export function createAdultDownloader(): DownloaderClient {
  const type = process.env.ADULT_DOWNLOADER_TYPE || 'qbittorrent';
  // ...
}
```

---

### Phase 1 完成标准

- [ ] BT 适配器接口定义
- [ ] 元数据适配器接口定义
- [ ] Sukebei 适配器实现
- [ ] JavBus 元数据适配器实现
- [ ] 5个工具全部实现
- [ ] 端到端测试通过（搜索→下载→导入→清理）
- [ ] 隐私脱敏验证
- [ ] 卡片格式化正确

**预计时间**: 1 周

---

## Phase 2: 多站点扩展（Week 2）⏸️

**目标**: 添加 JavBus 磁力链和 Tokyo Toshokan 适配器

### 2.1 JavBus 磁力链适配器

**挑战**: 需要两步请求（搜索页 → AJAX 获取磁力链）

**实现**:
```typescript
export class JavBusMagnetAdapter extends BTSiteAdapter {
  async search(query: string): Promise<SearchResult[]> {
    // 1. 搜索电影列表
    const movies = await this.searchMovies(query);
    
    // 2. 并发获取每部电影的磁力链
    const results = await Promise.all(
      movies.map(movie => this.getMagnets(movie.id))
    );
    
    return results.flat();
  }
}
```

---

### 2.2 Tokyo Toshokan 适配器

**特点**: RSS feed 支持

**实现**:
```typescript
export class TokyoToshokanAdapter extends BTSiteAdapter {
  async search(query: string): Promise<SearchResult[]> {
    // 1. RSS feed 搜索
    const rssUrl = `${this.baseUrl}/rss.php?terms=${query}`;
    const xml = await fetch(rssUrl).then(r => r.text());
    
    // 2. 解析 RSS
    return this.parseRSS(xml);
  }
}
```

---

### 2.3 JavLibrary 元数据适配器（备份）

**功能**: 元数据备份源

**实现**: 与 JavBus 类似

---

### 2.4 适配器配置工具

**新增工具**: `adult_configure`

**功能**: 启用/禁用适配器

```typescript
adult_configure({
  action: "list" | "enable" | "disable" | "health",
  adapter_name?: string,
})
```

---

### Phase 2 完成标准

- [ ] JavBus 磁力链适配器实现
- [ ] Tokyo Toshokan 适配器实现
- [ ] JavLibrary 元数据适配器实现
- [ ] 适配器配置工具实现
- [ ] 多站点并发搜索验证
- [ ] 健康检查自动跳过失败站点

**预计时间**: 1 周

---

## Phase 3: 社区贡献框架（Week 3+）⏸️

**目标**: 建立社区贡献机制

### 3.1 适配器模板

**创建**: `src/clients/bt-sites/TEMPLATE.ts`

```typescript
export class MySiteAdapter extends BTSiteAdapter {
  readonly name = "mysite";
  readonly displayName = "My Site";
  readonly baseUrl = "https://mysite.com";
  
  async search(query: string): Promise<SearchResult[]> {
    // TODO: 实现搜索逻辑
    throw new Error("Not implemented");
  }
  
  async healthCheck(): Promise<boolean> {
    // 默认实现
  }
}
```

---

### 3.2 开发指南

**创建**: `docs/BT-ADAPTER-GUIDE.md`

**内容**:
- 快速开始
- BTSiteAdapter 接口说明
- 实现示例（简单、复杂）
- 最佳实践
- 测试清单
- 常见问题
- 贡献流程

---

### 3.3 测试模板

**创建**: `src/__tests__/TEMPLATE.test.ts`

```typescript
describe("MySiteAdapter", () => {
  it("should search and return results", async () => {
    // ...
  });
  
  it("should perform health check", async () => {
    // ...
  });
});
```

---

### Phase 3 完成标准

- [ ] 适配器模板创建
- [ ] 测试模板创建
- [ ] BT-ADAPTER-GUIDE.md 完成
- [ ] Contributing 指南更新
- [ ] GitHub Issues 模板（新适配器请求）

**预计时间**: 1 周+

---

## 风险管理

| 风险 | 严重程度 | 缓解措施 |
|------|---------|---------|
| BT 站点反爬虫 | 🟡 中等 | User-Agent + 重试逻辑 |
| 站点结构变化 | 🟡 中等 | 版本化适配器 + 社区维护 |
| 翻译服务成本 | 🟢 低 | 翻译可选（MVP 不翻译）|
| 隐私泄露风险 | 🔴 高 | 强制路径脱敏 + 代码审查 |

**总体风险等级**: 🟡 中等

---

## 成功指标

### Phase 1
- [ ] 搜索→下载→导入→清理流程可用
- [ ] Sukebei 适配器工作
- [ ] 元数据卡片展示正确
- [ ] 隐私脱敏验证通过

### Phase 2
- [ ] 3个站点并发搜索
- [ ] 适配器配置工具可用

### Phase 3
- [ ] 社区贡献框架完整
- [ ] BT-ADAPTER-GUIDE.md 发布

---

## 相关项目

- **[mediapi-viewing](https://github.com/milikii/mediapi-viewing)** - PT 观影链扩展

---

**计划状态**: 📋 完整  
**代码状态**: ❌ 未开始  
**文档状态**: ✅ 初始化完成
