# MediaPi Adult - BT 成人链扩展

**Pi 扩展 for BT 成人内容自动化工作流**

通过 Telegram/微信/飞书聊天完成：搜索番号 → 查看元数据卡片 → 下载 → 导入 → 清理

---

## 项目定位

**MediaPi Adult 是一个独立的 Pi TypeScript 扩展**，专注于 BT 成人链工作流。

- **不是**：独立应用、Web UI、通用机器人
- **是**：Pi 扩展，通过聊天接口操作成人内容自动化

**观影链扩展** → 独立仓库：[mediapi-viewing](https://github.com/milikii/mediapi-viewing)

---

## 功能概览

### 5 个核心工具

```
搜索阶段：
1. adult_search           → BT 站点搜索 + 丰富元数据卡片
2. adult_get_resources    → 获取资源详情

下载阶段：
3. adult_add_download     → 添加下载（3天保种）

导入阶段：
4. adult_import           → 隔离目录导入（保留原名）

清理阶段：
5. adult_cleanup          → 快速清理
```

### 可插拔 BT 适配器

```
Phase 1 (MVP):    Sukebei
Phase 2:          JavBus + Tokyo Toshokan
Phase 3+:         社区贡献
```

---

## 使用示例

### 通过微信搜索番号

```
用户: 搜索 SSIS-843

Pi: 🎬 [SSIS-843] 比AI更瑟情的肉体 懦弱顺从的女学生被中年大叔们驯养的萝莉巨乳麻子酱 宇野美玲
    
    SSIS-843 AIよりシコい女体 気が弱い言いなり女学生は中年オヤジ達に飼われたロリ巨乳マン子ちゃん 宇野みれい
    
    [海报图片]
    
    ━━━━━━━━━━━━━━━━━━
    👤 演员： 宇野みれい (宇野美玲)
    🏢 片商： S1 NO.1 STYLE
    📅 日期： 2023-08-18  |  ⏳ 时长： 175分钟
    📦 分类： 有码 (Censored)
    
    ━━━━━━━━━━━━━━━━━━
    💾 资源列表：
    
    【资源 1】 sukebei | 8.9 GB | 做种: 7
    🧲 magnet:?xt=urn:btih:e7fdc4d...
    
    【资源 2】 sukebei | 7.6 GB | 做种: 1
    🧲 magnet:?xt=urn:btih:02f353f...
    
    ━━━━━━━━━━━━━━━━━━

用户: 下载资源 1

Pi: ✅ 下载已添加
    SSIS-843
    保种至: 2026-06-12 (3天)
    状态: 正在连接...

用户: 查询进度

Pi: 📥 正在下载：
    SSIS-843
    ━━━━━━━━━━━━━━━━━ 89%
    已下载: 7.9 GB / 8.9 GB

(下载完成后)

用户: 导入

Pi: ✅ 导入成功
    策略: 硬链接
    路径: [已隐藏]  ← 强制脱敏

(3天后)

用户: 清理

Pi: ✅ 清理完成
    释放空间: 8.9 GB
```

---

## 架构设计

### 系统架构

```
用户 (Telegram/微信/飞书)
    ↓
Pi Chat (多渠道桥接) ← Pi 提供
    ↓
Pi Agent Runtime (对话、授权、调度)
    ↓
MediaPi Adult Extension (5 工具)
    ↓
外部服务:
  - BT 站点 (Sukebei, JavBus 等)
  - JAV 元数据站 (JavBus, JavLibrary)
  - 翻译服务 (日文→中文)
  - qBittorrent/Transmission (下载器)
```

### 关键特性

**1. 丰富元数据卡片（D036）**
- 海报展示
- 日文标题 + 中文翻译
- 演员信息（日文 + 中文）
- 片商、日期、时长
- 磁力链列表（内联显示）

**2. 可插拔 BT 适配器（D032）**
```typescript
// 统一接口
interface BTSiteAdapter {
  readonly name: string;
  readonly displayName: string;
  search(query: string): Promise<SearchResult[]>;
  healthCheck(): Promise<boolean>;
}

// 渐进式扩展
Phase 1: Sukebei (MVP)
Phase 2: JavBus, Tokyo Toshokan
Phase 3+: 社区贡献
```

**3. 元数据聚合**
- 并发搜索：BT 站（磁力链）+ JAV 站（元数据）
- 聚合结果：标题、演员、片商、海报
- 自动翻译：日文→中文

**4. 强制隐私脱敏**
```typescript
// 所有路径信息强制脱敏
pi.appendEntry("adult_import", {
  source_path: "[REDACTED]",
  target_path: "[REDACTED]",
  // ...
});

// 用户看到的
return {
  content: [{ type: "text", text: "✅ 导入成功\n路径: [已隐藏]" }],
};
```

**5. 快速清理**
- 3 天保种期（固定）
- 简化安全检查
- 路径脱敏

---

## 安装

### 前置要求

- **Pi CLI** (最新版)
- **Node.js** 20+
- **外部服务**:
  - qBittorrent 或 Transmission

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/milikii/mediapi-adult.git
   cd mediapi-adult
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 填入配置
   ```

4. **编译**
   ```bash
   npm run build
   ```

5. **部署到 Pi**
   ```bash
   # 方式 1: 复制到 Pi 扩展目录
   cp -r dist ~/.pi/agent/extensions/adult
   
   # 方式 2: 直接从源码加载（开发模式）
   pi -e ./src/index.ts
   ```

6. **验证**
   ```bash
   # 在 Pi 中测试
   pi
   > adult_search SSIS-843
   ```

---

## 配置

### 环境变量

```bash
# 下载器配置（二选一）
ADULT_DOWNLOADER_TYPE=qbittorrent  # 或 transmission

# qBittorrent
ADULT_QB_URL=http://localhost:8081
ADULT_QB_USERNAME=admin
ADULT_QB_PASSWORD=your_password

# Transmission
ADULT_TR_URL=http://localhost:9092
ADULT_TR_USERNAME=transmission
ADULT_TR_PASSWORD=your_password

# 隔离目录
ADULT_IMPORT_ROOT=/private/adult

# 保种策略
ADULT_RETENTION_DAYS=3  # 固定 3 天

# 翻译服务（可选）
TRANSLATE_API_KEY=your_api_key  # Google Translate 或其他
```

### BT 适配器配置

```bash
# 启用的站点（逗号分隔）
ADULT_ENABLED_SITES=sukebei,javbus

# 站点特定配置
SUKEBEI_BASE_URL=https://sukebei.nyaa.si
JAVBUS_BASE_URL=https://www.javbus.com
```

---

## 开发

### 项目结构

```
src/
├── index.ts              # 扩展入口
├── tools/                # 5 个工具实现
│   ├── search.ts         # 搜索 + 元数据卡片
│   ├── get-resources.ts
│   ├── add-download.ts
│   ├── import.ts
│   └── cleanup.ts
├── clients/
│   ├── bt-sites/         # BT 磁力站适配器
│   │   ├── base.ts       # BTSiteAdapter 接口
│   │   ├── sukebei.ts
│   │   ├── javbus-magnet.ts
│   │   └── tokyotosho.ts
│   ├── metadata/         # JAV 元数据站适配器
│   │   ├── base.ts
│   │   ├── javbus-metadata.ts
│   │   └── javlibrary-metadata.ts
│   ├── qbittorrent.ts
│   ├── transmission.ts
│   └── downloader-factory.ts
├── adapters/
│   ├── magnet-registry.ts    # 磁力站注册表
│   └── metadata-registry.ts  # 元数据站注册表
├── services/
│   └── translator.ts     # 翻译服务（日文→中文）
└── types.ts
```

### 开发命令

```bash
# 开发模式（watch）
npm run dev

# 编译
npm run build

# 测试
npm test

# Lint
npm run lint
```

### 添加新的 BT 站点适配器

参考 [BT-ADAPTER-GUIDE.md](docs/BT-ADAPTER-GUIDE.md)

```bash
# 1. 复制模板
cp src/clients/bt-sites/TEMPLATE.ts src/clients/bt-sites/mysite.ts

# 2. 实现接口
# 编辑 mysite.ts 实现 search() 和 healthCheck()

# 3. 注册适配器
# 编辑 src/index.ts 添加 registry.register(new MySiteAdapter())

# 4. 测试
npm test -- mysite.test.ts

# 5. 提交 PR
git add src/clients/bt-sites/mysite.ts
git commit -m "feat: add MySite adapter"
```

---

## 实施计划

### Phase 1: MVP（Week 1） ⏸️

**5 个核心工具 + Sukebei 适配器**：
- [ ] adult_search（元数据卡片）
- [ ] adult_get_resources
- [ ] adult_add_download
- [ ] adult_import（隔离导入 + 脱敏）
- [ ] adult_cleanup
- [ ] Sukebei 适配器
- [ ] JavBus 元数据适配器
- [ ] 翻译服务

### Phase 2: 多站点扩展（Week 2） ⏸️

**新增适配器**：
- [ ] JavBus 磁力链适配器
- [ ] Tokyo Toshokan 适配器
- [ ] JavLibrary 元数据适配器
- [ ] 适配器配置工具

### Phase 3+: 社区贡献 ⏸️

**社区框架**：
- [ ] 适配器模板
- [ ] 测试模板
- [ ] BT-ADAPTER-GUIDE.md
- [ ] Contributing 指南

---

## 文档

- [架构设计](docs/ARCHITECTURE.md) - 即将添加
- [产品需求](docs/PRD.md) - 即将添加
- [架构决策](docs/DECISIONS.md) - 即将添加
- [BT 适配器开发指南](docs/BT-ADAPTER-GUIDE.md) - 即将添加
- [Pi API 参考](docs/PI_API_REFERENCE.md) - 即将添加

---

## 相关项目

- **[mediapi-viewing](https://github.com/milikii/mediapi-viewing)** - PT 观影链扩展（独立仓库）
- **[Pi](https://pi.dev)** - Pi Agent 平台

---

## 架构决策

关键决策：

- **D030**: TypeScript 扩展优于 Python 后端
- **D032**: 可插拔 BT 站点适配器
- **D033**: Pi session 状态优于 SQLite
- **D036**: 丰富元数据卡片（海报 + 翻译 + 磁力链）
- **D037**: 独立下载器配置（qBittorrent 或 Transmission）
- **D038**: 分离 GitHub 仓库

---

## 贡献

欢迎贡献新的 BT 站点适配器！

**贡献流程**：
1. Fork 仓库
2. 创建功能分支（`git checkout -b add-mysite-adapter`）
3. 实现适配器（参考 [BT-ADAPTER-GUIDE.md](docs/BT-ADAPTER-GUIDE.md)）
4. 编写测试
5. 提交 PR

**社区需求**（欢迎贡献）：
- [ ] JavLibrary 适配器
- [ ] Nyaa.si 适配器
- [ ] 141JAV 适配器
- [ ] DMM 适配器

---

## 许可证

MIT License

---

## 联系

- **Issues**: [GitHub Issues](https://github.com/milikii/mediapi-adult/issues)
- **讨论**: [GitHub Discussions](https://github.com/milikii/mediapi-adult/discussions)

---

## 隐私声明

**MediaPi Adult 扩展尊重用户隐私**：

- ✅ 所有路径信息强制脱敏（不记录真实路径）
- ✅ 本地运行（无数据上传到第三方）
- ✅ Session 状态加密存储
- ✅ 磁力链加密传输
- ✅ 用户完全控制数据

**不收集**：
- ❌ 搜索历史
- ❌ 下载记录
- ❌ 文件路径
- ❌ 个人信息

---

**注意**：此扩展需要 Pi 运行环境。如果需要 PT 观影链支持，请访问 [mediapi-viewing](https://github.com/milikii/mediapi-viewing) 独立仓库。
