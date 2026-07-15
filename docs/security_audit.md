# 🔐 Bili_summary 安全审计报告

**审计人**：安无漏（安全工程师）  
**审计日期**：2026-07-15  
**项目**：Bili_summary — B站UP主视频核心观点自动提炼工具  
**审计范围**：全部源代码、配置文件、Git 历史、依赖清单  

---

## 📊 概要

| 指标 | 数值 |
|------|------|
| 扫描文件数 | 7 核心文件 + Git 历史（8 commits） |
| 发现问题总数 | **13** |
| 🔴 严重 | 2 |
| 🟠 高危 | 3 |
| 🟡 中危 | 4 |
| 🟢 低危/建议 | 4 |

---

## 🔴 严重发现

### [严重-1] Gemini API Key 硬编码在 .env.local 文件中

- **文件**：`biliinsight-pro/.env.local`
- **状态**：文件存在于本地磁盘，**不在 Git 历史中**（已被 `.gitignore` 排除）
- **问题描述**：该文件包含一个真实的 Google Gemini API Key：

  ```
  GEMINI_API_KEY=AIzaSyBzGL-yZffP_0y9wE8_FhFmDJKcFhFrIRk
  ```

- **风险说明**：
  - 虽然 `.env.local` 被 `.gitignore` 正确排除，但密钥仍以明文形式存在于磁盘上
  - 如果开发者意外执行 `git add -f .env.local`、截图分享、备份同步等操作，密钥可能泄露
  - Google API Key 一旦泄露，攻击者可使用该密钥调用 Gemini API 并产生费用
- **修复建议**：
  1. 立即在 Google Cloud Console 中**轮换（revoke + recreate）此密钥**
  2. 考虑使用环境变量注入或 Secret Manager，不要将密钥写入 `.env.local`
  3. 如果使用 AI Studio 部署，确认 AI Studio 的 Secrets 面板是否已正确配置，本地开发用单独的测试密钥

---

### [严重-2] Gemini API Key 暴露在前端客户端代码中

- **文件**：`biliinsight-pro/src/App.tsx:206`
- **代码行**：

  ```typescript
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  ```

- **问题描述**：`process.env.GEMINI_API_KEY` 通过 Vite 的 `import.meta.env` 机制被打包进客户端 JavaScript bundle 中。任何访问该网页的用户都可以通过浏览器 DevTools 查看打包后的 JS 文件，直接提取出 API Key。
- **风险说明**：
  - **这是最严重的安全漏洞之一**：API Key 暴露在浏览器端意味着任何人都可以窃取并滥用
  - 攻击者可无限量调用 Gemini API，产生巨额费用
  - 前端代码中的 Key 无法通过任何方式隐藏——所有客户端代码对用户完全可见
- **修复建议**：
  1. **立即**将 Gemini API 调用移到后端（Flask API），前端通过后端代理调用
  2. 后端使用服务端环境变量注入密钥，前端永远不应持有任何 API Key
  3. 如果必须在前端调用，使用服务端生成的临时 Token 进行鉴权，而非直接暴露 API Key

---

## 🟠 高危发现

### [高危-1] CORS 配置过于宽松

- **文件**：`web/app.py:28`
- **代码行**：

  ```python
  CORS(app)  # 允许跨域请求
  ```

- **问题描述**：`flask-cors` 的默认配置允许**所有来源**（`Access-Control-Allow-Origin: *`）进行跨域请求，且允许所有 HTTP 方法和请求头。
- **风险说明**：
  - 任意网站都可以向该 API 发起请求（CSRF 风险）
  - 恶意网站可通过用户的浏览器向 API 发送请求，消耗 API 配额
  - 结合"无认证"问题，攻击者可滥用 API 端点
- **修复建议**：
  ```python
  CORS(app, origins=["http://localhost:3000", "http://localhost:5000"])
  ```
  或使用环境变量 `ALLOWED_ORIGINS` 控制。

---

### [高危-2] 所有 API 端点无任何认证/授权机制

- **文件**：`web/app.py` — 全部 4 个路由
- **受影响的端点**：
  - `POST /api/extract` — 提取视频核心观点（调用 LLM API，产生费用）
  - `POST /api/ask` — 智能问答（调用 LLM API，产生费用）
  - `POST /api/chat` — 聊天接口（调用 LLM API，产生费用）
  - `GET /api/test` — 测试接口
- **问题描述**：以上所有端点均为公开访问，无需任何 API Key、Token 或用户认证。
- **风险说明**：
  - 任何人发现该服务（如部署到公网）都可以免费调用 LLM API，导致 API 费用失控
  - 无用户隔离，无法追踪谁在调用
  - 可能被用于恶意目的（生成不当内容）
- **修复建议**：
  1. 添加 API Key 认证（如请求头 `X-API-Key`）
  2. 或使用 Flask-Login / JWT 进行用户认证
  3. 至少添加 Rate Limiting

---

### [高危-3] 用户 API Key 通过前端传入后端并覆盖全局配置

- **文件**：`web/app.py:36-62` 和 `web/script.js:203-206`
- **代码逻辑**：
  ```python
  # app.py - 接收前端传来的 API Keys 并覆盖全局变量
  global MODEL_TYPE, DEEPSEEK_API_KEY, SILICONFLOW_API_KEY
  api_keys = data.get('api_keys', {})
  if api_keys.get('deepseek'):
      DEEPSEEK_API_KEY = api_keys.get('deepseek')
  if api_keys.get('siliconflow'):
      SILICONFLOW_API_KEY = api_keys.get('siliconflow')
  ```
  ```javascript
  // script.js - 从 localStorage 读取 API Key 发送到后端
  api_keys: {
      deepseek: config.deepseekApiKey,
      siliconflow: config.siliconflowApiKey
  }
  ```

- **问题描述**：
  - 用户的 DeepSeek/SiliconFlow API Key 以明文传输（HTTP）
  - 用户的 Key 存储在浏览器 `localStorage` 中（明文，任何 XSS 可读取）
  - 使用全局变量存储 Key，Flask 多线程环境下可能出现 **Key 泄漏**——请求 A 修改了全局 Key，请求 B 可能意外使用 A 的 Key
- **风险说明**：
  - 全局变量在多线程 Web 服务器中是**共享状态**，线程不安全
  - 用户的 API Key 可能被其他用户无意中使用
  - localStorage 中的 Key 可被浏览器扩展、XSS 攻击窃取
- **修复建议**：
  1. 使用请求级别（非全局）的变量传递 API Key
  2. 不要将用户的 API Key 存储在 `localStorage` 中
  3. API 通信启用 HTTPS
  4. 考虑使用服务端统一管理的 API Key，而非让用户自行提供

---

## 🟡 中危发现

### [中危-1] 前端使用 innerHTML 渲染 LLM 输出 — XSS 风险

- **文件**：`web/script.js`
- **受影响代码**：
  ```javascript
  // 行267: 整体总结直接插入 HTML
  summaryContent.innerHTML = formattedSummary;

  // 行300-332: 视频卡片使用 innerHTML 渲染 LLM 返回内容
  card.innerHTML = `...${result.视频标题}...${coreViewsText}...${formattedViews}...`;

  // 行489: 消息提示使用 innerHTML
  message.innerHTML = `...${text}...`;
  ```

- **问题描述**：后端从 Bilibili API 获取视频标题，从 LLM API 获取核心观点——这些外部数据源的内容未经任何 HTML 转义直接通过 `innerHTML` 渲染。如果 LLM 返回了包含 `<script>` 标签或 `onerror` 等事件处理器的内容，将导致 XSS 攻击。
- **风险说明**：
  - 视频标题可能包含 HTML 特殊字符（虽然 B 站通常会过滤，但不能依赖）
  - LLM 可能生成包含恶意 HTML 的内容（尤其在对抗性提示下）
  - 用户输入的问题（`question` 参数）虽使用 `textContent`（行69，正确✅），但其他路径未防护
- **修复建议**：
  1. 使用 `textContent` 替代 `innerHTML`，或在插入前对内容做 HTML 转义
  2. 如果必须保留 HTML 格式，使用 DOMPurify 等库进行清理
  3. React 前端（`App.tsx`）使用 `ReactMarkdown` 相对安全，但 vanilla JS 前端需要额外防护

---

### [中危-2] 缺少关键配置常量 — 运行时崩溃风险

- **文件**：`main.py` vs `config.py`
- **问题描述**：`main.py` 中引用了以下配置常量，但在当前 `config.py` 中**均未定义**：
  - `UP_MID`（行550：`BilibiliUpCrawler(UP_MID, MAX_VIDEOS)`）
  - `SAVE_PATH`（行488/494/501：`os.path.join(SAVE_PATH, ...)`）
  - `RESULTS_FILENAME`（行483：`f"{RESULTS_FILENAME}_{timestamp}"`）
  - `SAVE_FORMAT`（行485/492/499）
- **风险说明**：直接运行 `main.py` 将抛出 `NameError`。虽然当前通过 `web/app.py` 调用时参数由前端传入，但代码中存在未处理的执行路径。
- **修复建议**：在 `config.py` 中补充这些常量，或为它们提供合理的默认值。

---

### [中危-3] 用户输入（uid）缺乏验证

- **文件**：`web/app.py:40-41`
- **代码**：
  ```python
  uid = data.get('uid')
  max_videos = data.get('max_videos', MAX_VIDEOS)
  ```
- **问题描述**：`uid` 参数仅检查了是否为空，未验证格式（应为纯数字）。`max_videos` 也未验证范围（可能传入负数或超大值）。这些值直接传递给 `BilibiliUpCrawler` 构造函数和 bilibili-api 调用。
- **风险说明**：
  - 传入非数字 `uid` 可能导致 bilibili-api 抛出未处理的异常，泄露错误堆栈
  - 传入极大的 `max_videos`（如 999999）可能导致无限循环和资源耗尽
- **修复建议**：
  ```python
  uid = data.get('uid', '').strip()
  if not uid or not uid.isdigit():
      return jsonify({'success': False, 'message': 'uid 必须为纯数字'}), 400
  max_videos = min(int(data.get('max_videos', MAX_VIDEOS)), 200)
  ```

---

### [中危-4] Git 历史中包含编译后的 .pyc 文件

- **文件**：Git 历史（commit `b48eb5d` 和之前）
- **问题描述**：项目初期将 `__pycache__/*.pyc` 文件提交到了 Git 仓库。虽然在 commit `8fd8921` 中已删除，但 Git 历史中仍保留这些二进制文件。
- **风险说明**：`.pyc` 文件是 Python 字节码，如果在配置中曾写入过真实密钥，反编译 `.pyc` 可恢复明文。根据查看，最早版本中的 Key 均为占位符，因此**当前风险较低**。但如果未来再次误提交含真实 Key 的 `.pyc`，后果严重。
- **修复建议**：确认 `.gitignore` 已包含 `__pycache__/` 和 `*.pyc`（✅ 已包含），无需额外操作。作为最佳实践，可考虑使用 `git filter-repo` 清理历史中的 `.pyc` 文件。

---

## 🟢 低危/建议

### [低危-1] Flask 监听 0.0.0.0

- **文件**：`web/app.py:166`
  ```python
  app.run(host='0.0.0.0', port=5000, debug=False)
  ```
- **说明**：监听所有网络接口意味着局域网内其他设备可访问该服务。`debug=False` 是正确的 ✅
- **建议**：生产环境应使用反向代理（Nginx/Caddy），Flask 仅监听 `127.0.0.1`

---

### [低危-2] 无速率限制

- **文件**：`web/app.py` 全部路由
- **说明**：无任何速率限制机制，攻击者可通过高频请求耗尽 LLM API 配额
- **建议**：添加 `Flask-Limiter`：
  ```python
  from flask_limiter import Limiter
  limiter = Limiter(app, default_limits=["10 per minute"])
  ```

---

### [低危-3] 缺少安全响应头

- **文件**：`web/app.py`
- **说明**：未设置以下安全相关 HTTP 头：
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security`（HTTPS 部署时）
- **建议**：添加 Flask-Talisman 或手动设置响应头

---

### [低危-4] requirements.txt 中包含不必要的 you-get 依赖

- **文件**：`requirements.txt`
  ```
  you-get>=0.4.1743
  ```
- **说明**：`you-get` 是视频下载工具，当前代码中未实际使用（`DOWNLOAD_AUDIO = False`）。该库会增加攻击面。
- **建议**：如果确认不需要，从 `requirements.txt` 中移除。同时 `whisper>=1.0.0` 也未被使用，可以清理。

---

## 📋 安全评分

| 评分维度 | 得分 | 说明 |
|----------|------|------|
| 敏感信息保护 | 35/100 | 存在真实 API Key 本地泄露 + 前端暴露 |
| 输入验证 | 45/100 | uid 未验证格式；LLM 输出无 XSS 过滤 |
| 认证授权 | 20/100 | 零认证，所有端点公开 |
| 传输安全 | 40/100 | CORS 全开；HTTP 明文传输 API Key |
| 配置安全 | 50/100 | 配置常量缺失；全局变量线程不安全 |
| 依赖管理 | 60/100 | 有过期依赖（you-get, whisper）；需审计 npm 包 |
| **总分** | **42/100** | **评级：D — 不可部署** |

---

## 🚫 阻断发布判定

根据审计标准：
- 🔴 **严重漏洞 ≥ 1** → ⛔ **阻断发布**
- 当前：**2 个严重漏洞**

**结论：项目当前不可发布。必须修复以下阻断项：**

1. **[严重-1]** 轮换 `.env.local` 中的 GEMINI_API_KEY
2. **[严重-2]** 将 Gemini API 调用从客户端移至服务端
3. **[高危-1]** 收紧 CORS 配置
4. **[高危-2]** 添加 API 认证机制

---

## 📝 审计总结

Bili_summary 项目在功能实现上已经完整，但安全性方面存在**致命缺陷**：API Key 在客户端暴露意味着任何用户都可以窃取并滥用 Gemini API。同时，所有后端端点无认证保护，CORS 配置过于宽松，使得服务极易被滥用。

**优先修复路线**：
1. 🔴 **今天**：轮换 Gemini Key + 将 Gemini 调用移至后端
2. 🟠 **本周**：添加 API 认证 + 收紧 CORS + 修复 XSS 问题
3. 🟡 **本迭代**：输入验证 + 速率限制 + 补全配置常量
4. 🟢 **持续**：安全响应头 + 依赖清理

---

*审计标准依据：.codex/team/skills/security-audit.md*  
*审计工具：人工代码审查 + Git 历史分析*
