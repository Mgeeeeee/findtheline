# 草蛇灰线 · Find The Line

> 发现 Flomo 笔记之间隐藏的连接

将你的 [Flomo](https://flomoapp.com) 笔记导出为 HTML，拖入本工具，自动生成交互式笔记图谱。

🔗 **在线使用**：[https://mgeeeeee.github.io/findtheline](https://mgeeeeee.github.io/findtheline)

## ✨ 功能

- **拖拽即用** — 上传 Flomo HTML 导出文件，浏览器内完成全部分析
- **多维标注** — 自动识别每条笔记的主题、情绪、潜台词
- **语义聚类** — TF-IDF 向量化 + K-Means 聚类，发现隐含的笔记族群
- **交互图谱** — D3.js 力导向网络图、时间线、桥接笔记三种视图
- **隐私安全** — 所有数据仅在你的浏览器中处理，不上传任何服务器

## 🚀 两种模式

| | 基础模式 | AI 增强模式 |
|---|---------|------------|
| 标注 | 关键词匹配 | Gemini 2.0 Flash 语义理解 |
| 向量化 | TF-IDF（浏览器分词） | Gemini Embedding 768维 |
| 需要 | 无 | Google Gemini API Key |
| 费用 | 免费 | < ¥0.5 / 1000条笔记 |

## 📖 使用方法

### 在线使用（推荐）
1. 打开 [在线版](https://mgeeeeee.github.io/findtheline)
2. 在 Flomo 中导出笔记为 HTML
3. 将导出的 HTML 文件拖入页面
4. 等待分析完成，探索你的笔记图谱

### 本地使用
```bash
git clone https://github.com/Mgeeeeee/findtheline.git
cd findtheline
# 用任意方式打开 index.html，例如：
open index.html
```

### AI 增强模式（可选）
1. 获取 [Google AI Studio API Key](https://aistudio.google.com/apikey)
2. 点击页面右上角的 ⚙️ 设置图标
3. 填入你的 API Key（仅存储在浏览器本地，不会上传）
4. 重新上传笔记即可享受 AI 增强分析

## 🛡️ 隐私声明

- 你的笔记**完全在浏览器本地处理**
- 基础模式：零网络请求，完全离线可用
- AI 模式：笔记仅发送至 Google Gemini API（你自己的 Key），本工具不经手任何数据
- API Key 仅存储在浏览器 `localStorage`，不经过任何第三方

## 📄 License

MIT
