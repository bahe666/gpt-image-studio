# GPT Image Studio

一个基于 AI 的图像生成工具，支持多种输出格式（PNG / JPEG / WebP / SVG / PPTX），通过 RouterHub API 调用 GPT-Image-2 和其他大模型。

## 功能

- **光栅图片生成**：调用 GPT-Image-2 生成 PNG / JPEG / WebP 格式图片，支持自定义分辨率（最大 4K）和质量等级
- **SVG 矢量图生成**：通过 GPT-5.5 / Claude Opus 4.6 / Gemini 等模型生成可编辑的 SVG 代码
- **PPTX 幻灯片生成**：AI 生成结构化布局，直接输出原生 PowerPoint 文件（文字可编辑，不会错乱）
- **文件上传**：支持上传图片（自动压缩）、PDF、TXT、CSV、JSON 等文件，AI 基于文件内容生成图像
- **图片转 SVG**：上传一张图片，AI 看懂内容后生成对应的 SVG 矢量图
- **智能文件命名**：下载时 AI 自动总结 prompt 生成合适的文件名
- **多模型对比**：SVG / PPTX 模式支持切换不同 AI 模型，方便对比效果
- **访问密码保护**：可选配置，防止他人消耗你的 API 额度

## 部署指南

### 前提条件

- Node.js 18+
- 一个 [RouterHub](https://routerhub.ai) 的 API Key

### 1. 克隆仓库

```bash
git clone https://github.com/bahe666/gpt-image-studio.git
cd gpt-image-studio
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制示例文件并填入你自己的 API Key：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# 必填：你的 RouterHub API Key（在 https://routerhub.ai 注册获取）
ROUTERHUB_API_KEY=sk-rh-v1-你的key

# 可选：设置访问密码（留空则不启用密码保护）
ACCESS_PASSWORD=
```

> **重要**：不要使用他人的 API Key，请在 RouterHub 官网注册获取你自己的 Key。

### 4. 本地运行

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm run start
```

默认运行在 `http://localhost:9827`。

### 5. 使用 pm2 持久化运行（可选）

如果你想让应用在后台持续运行，并开机自启：

```bash
# 安装 pm2
npm install -g pm2

# 构建项目
npm run build

# 启动
pm2 start ecosystem.config.js

# 保存进程列表（重启后自动恢复）
pm2 save

# 设置开机自启（按提示执行 sudo 命令）
pm2 startup
```

### 6. 部署到 Vercel（可选）

```bash
# 安装 Vercel CLI
npm install -g vercel

# 部署
vercel --prod

# 在 Vercel Dashboard 中添加环境变量：
# ROUTERHUB_API_KEY=你的key
# ACCESS_PASSWORD=你的密码（可选）
```

> 注意：Vercel Hobby 计划的 Serverless Function 超时限制为 10 秒，图片生成通常需要 15-60 秒，建议升级到 Pro 计划或使用本地部署。

## 技术栈

- **框架**：Next.js 16 (App Router)
- **语言**：TypeScript
- **样式**：Tailwind CSS 4
- **图片生成**：RouterHub API -> GPT-Image-2
- **SVG 生成**：RouterHub API -> GPT-5.5 / Claude / Gemini (Chat Completions)
- **PPTX 生成**：pptxgenjs
- **PDF 解析**：pdf-parse

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 前端主页面
│   ├── api/
│   │   ├── generate/route.ts # 图片/SVG/PPTX 生成 API
│   │   └── filename/route.ts # AI 智能文件命名 API
├── lib/
│   ├── routerhub.ts          # RouterHub API 封装
│   └── pptx.ts              # PPTX 文件生成逻辑
```

## 许可

MIT
