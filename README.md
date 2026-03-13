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

| | 基础（通用）模式 | AI 增强模式 |
|---|---------|------------|
| 标注方式 | 普适性关键词网络提取 | 零预设大模型动态推演 (Gemini 2.5 Flash Lite) |
| 维度分类 | 预设 11大主题、5大情绪等 | 完全根据内容即兴生成 |
| 亮点特性 | **[核心词]** TF-IDF 动态计算 | **[潜台词]** 深度语义与心理防线拆解 |
| 向量化 | 浏览器本地 JS TF-IDF 特征 | Gemini 高维 Embedding (Text Embedding 004) |
| 需要 | 无（开箱即用） | 免费获取的 Google Gemini API Key |
| 速度 | 极快（数秒内完成） | 取决于笔记量（含智能防熔断限流） |

### 💡 模式详解

**1. 基础（通用）模式：零配置、极速、普适**
无需任何配置，由于系统内置了一套**高度普适的领域字典**（涵盖工作、生活、思考、人际、数码等全维度），无论你是谁，你的笔记都会被快速归类到标准的漏斗中。同时利用浏览器本地运算的 TF-IDF 算法，为你准确计算出每一条笔记的专属**“核心词”**，并完成精准的 K-Means 聚类。

**2. AI 增强模式：深度探寻你的潜意识**
当你填入 Gemini API Key 后，原本通用的“特征词典”全部抛弃。大模型会作为专属于你的心理医生：
- 完全抛弃预设下拉框，根据当前这条笔记的独特语境，**当场发明/动态生成**最贴切的主题与情绪标签。
- 从字面上挖掘没有说出口的**“潜台词”**，直视内心的真实动机。
- 完全采用 AI Embedding 进行意境聚合聚类，不再单纯比较词袋重叠度。

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
