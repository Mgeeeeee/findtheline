/**
 * analyzer.js — Flomo 笔记分析引擎
 * 
 * 核心功能：
 * 1. HTML 解析（DOMParser）
 * 2. 多维标注（关键词 / Gemini API）
 * 3. TF-IDF 向量化（Intl.Segmenter 中文分词）
 * 4. K-Means 聚类（自动选 K）
 * 5. 桥接笔记检测
 */

const Analyzer = (() => {

  // ─── 1. HTML 解析 ───────────────────────────────────────

  function parseFlomoHTML(htmlString, onProgress) {
    onProgress?.('正在解析 HTML…');
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const memos = doc.querySelectorAll('.memo');
    const notes = [];

    memos.forEach((memo, i) => {
      const timeEl = memo.querySelector('.time');
      const contentEl = memo.querySelector('.content');
      if (!contentEl) return;

      const timestamp = timeEl ? timeEl.textContent.trim() : '';
      const clone = contentEl.cloneNode(true);

      // Extract tags
      const tags = [];
      clone.querySelectorAll('.tag').forEach(tag => {
        const t = tag.textContent.trim().replace(/^#/, '');
        if (t) tags.push(t);
        tag.remove();
      });

      const fullText = clone.textContent.trim();
      if (!fullText && tags.length === 0) return;

      const images = contentEl.querySelectorAll('img');
      const audio = contentEl.querySelectorAll('audio, .audio');

      notes.push({
        id: i,
        timestamp,
        text: fullText.substring(0, 80),
        full_text: fullText,
        tags,
        has_images: images.length > 0,
        image_count: images.length,
        has_audio: audio.length > 0,
      });
    });

    onProgress?.(`解析完成：${notes.length} 条笔记`);
    return notes;
  }

  // ─── 2. 关键词标注（无 API 模式）──────────────────────────

  const THEME_KEYWORDS = {
    '工作与事业': ['工作', '职场', '事业', '项目', '汇报', '会议', '同事', '老板', '业务', '面试'],
    '学习与阅读': ['学习', '阅读', '读书', '笔记', '知识', '课程', '考试', '看书', '输入'],
    '生活与日常': ['生活', '日常', '家', '吃饭', '睡觉', '周末', '琐事', '今天', '买', '整理'],
    '情感与人际': ['情感', '恋爱', '朋友', '家人', '社交', '关系', '沟通', '别人', '父母', '交流'],
    '思考与感悟': ['思考', '感悟', '觉得', '认为', '本质', '意义', '价值', '反思', '认识', '自我'],
    '艺术与创作': ['艺术', '创作', '设计', '画', '写', '音乐', '灵感', '审美', '输出', '作品'],
    '科技与数码': ['科技', '数码', 'ai', '人工智能', '软件', '硬件', '工具', '互联网', '代码', '程序', '电脑', '手机'],
    '财富与理财': ['财富', '理财', '搞钱', '投资', '基金', '股票', '经济', '钱', '买卖', '消费', '商业'],
    '效率与方法': ['效率', '方法', '技巧', '系统', '习惯', '规划', '时间管理', '流程', '工具', '目标'],
    '健康与运动': ['健康', '运动', '健身', '跑步', '身体', '疲惫', '睡眠', '看病', '精力', '锻炼'],
    '娱乐与爱好': ['娱乐', '游戏', '电影', '剧', '爱好', '玩', '旅游', '旅行', '放松', '动漫'],
  };

  const EMOTION_KEYWORDS = {
    '积极愉悦': ['开心', '快乐', '激动', '期待', '满足', '喜欢', '感恩', '美好', '幸运', '舒服'],
    '平静从容': ['平静', '正常', '顺其自然', '释然', '淡定', '安静', '平和', '无所谓'],
    '沉思专注': ['思考', '专注', '沉浸', '研究', '琢磨', '想', '发现', '意识到'],
    '焦虑内耗': ['焦虑', '烦躁', '压力', '累', '迷茫', '纠结', '慌', '急', '紧张', '担心', '内耗'],
    '低落负面': ['难过', '抑郁', '失望', '孤独', '生气', '愤怒', '痛苦', '寂寞', '无聊', '糟'],
  };

  const NOTE_TYPE_PATTERNS = {
    '日志/复盘': [/总结/, /复盘/, /日记/, /周报/, /记录/, /今天/],
    '摘录/引用': [/「.*」/, /『.*』/, /".*"/, /——/, /摘录/, /书中说/],
    '待办/计划': [/todo/i, /计划/, /目标/, /打算/, /准备做/, /需要/],
    '知识/教程': [/教程/, /方法/, /如何/, /知识点/, /科普/, /指南/],
    '想法/闪念': [/灵感/, /突然想到/, /idea/i, /觉得/, /也许/, /可能/],
  };

  function annotateKeyword(note) {
    const text = (note.full_text || note.text || '').toLowerCase();
    const tagStr = note.tags.join(' ').toLowerCase();
    const combined = text + ' ' + tagStr;

    // Themes
    const themes = [];
    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
      if (keywords.some(kw => combined.includes(kw.toLowerCase()))) {
        themes.push(theme);
      }
    }
    if (themes.length === 0) themes.push('日常随想');

    // Emotion
    let emotion = '沉思专注';
    let maxHits = 0;
    for (const [emo, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      const hits = keywords.filter(kw => combined.includes(kw.toLowerCase())).length;
      if (hits > maxHits) { maxHits = hits; emotion = emo; }
    }

    // Note type
    let noteType = '想法/闪念';
    const originalText = note.full_text || note.text || '';
    for (const [type, patterns] of Object.entries(NOTE_TYPE_PATTERNS)) {
      if (patterns.some(p => p.test(originalText))) { noteType = type; break; }
    }


    // Subtext (removed hardcoded generation)
    const subtext = '';

    return { themes: themes.slice(0, 3), emotion, note_type: noteType, subtext };
  }



  // ─── 3. Gemini API 标注（有 API 模式）─────────────────────

  async function annotateWithGemini(notes, apiKey, onProgress) {
    const batchSize = 40;
    const results = new Array(notes.length);
    let completed = 0;

    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      const batchTexts = batch.map((n, idx) => `[${idx}] ${n.full_text || n.text}`).join('\n---\n');

      const prompt = `你是一个专业的笔记与心智分析引擎。请对以下${batch.length}条笔记进行多维深度语义分析。
每条笔记需要提取并返回四个维度的信息，请完全根据笔记内容进行**动态生成**，不要受限于任何预设列表：
- themes: 根据内容提取最合适的主题标签（1-3个），每个标签不超过6个字。
- emotion: 这段文字散发的核心情绪基调（1个），不超过4个字。
- note_type: 笔记的体裁或属性（1个），不超过6个字。
- subtext: 这条笔记没有明说的潜台词、心理动机或深层含义是什么（一句话，15-25字）。

笔记内容：
${batchTexts}

务必返回包含 ${batch.length} 个元素的 JSON 数组，每个元素对应一条笔记，格式：
[{"themes":["..."],"emotion":"...","note_type":"...","subtext":"..."}]
只返回严格的 JSON，不要 Markdown 格式。`;

      let success = false;
      let retries = 3;

      while (!success && retries > 0) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.3,
                },
              }),
            }
          );

          if (!response.ok) {
            if (response.status === 429) {
              console.warn('Gemini Rate limit (429). Waiting 5s...');
              await new Promise(r => setTimeout(r, 5000));
              retries--;
              continue; // Retry
            }
            const err = await response.text();
            throw new Error(`API error ${response.status}: ${err}`);
          }

          const data = await response.json();
          let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
          
          text = text.replace(/^```json/i, '').replace(/```$/i, '').trim();
          const parsed = JSON.parse(text);

          batch.forEach((note, idx) => {
            const ann = parsed[idx] || {};
            results[i + idx] = {
              themes: Array.isArray(ann.themes) ? ann.themes.slice(0, 3) : ['日常随想'],
              emotion: ann.emotion || '沉思',
              note_type: ann.note_type || '生活感悟',
              subtext: ann.subtext || '',
            };
          });
          
          success = true;
        } catch (e) {
          console.warn(`Gemini batch ${i} try failed:`, e);
          retries--;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      if (!success) {
        console.warn(`Gemini batch ${i} completely failed, falling back to keyword.`);
        batch.forEach((note, idx) => {
          results[i + idx] = annotateKeyword(note);
        });
      }

      completed += batch.length;
      onProgress?.(`AI 标注中… ${Math.min(completed, notes.length)}/${notes.length} (由于 API 频率限制，处理会稍慢请耐心)`);

      if (i + batchSize < notes.length) {
        await new Promise(r => setTimeout(r, 4000));
      }
    }

    return results;
  }

  // ─── 4. Gemini Embedding（有 API 模式）────────────────────

  async function embedWithGemini(notes, apiKey, onProgress) {
    const batchSize = 50;
    const dim = 768;
    const embeddings = new Array(notes.length);
    let completed = 0;

    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      const requests = batch.map(n => ({
        model: 'models/text-embedding-004',
        content: { parts: [{ text: (n.full_text || n.text).substring(0, 2000) }] },
        taskType: 'CLUSTERING',
      }));

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
          }
        );

        if (!response.ok) throw new Error(`Embedding API error ${response.status}`);

        const data = await response.json();
        const embeds = data.embeddings || [];
        batch.forEach((_, idx) => {
          embeddings[i + idx] = embeds[idx]?.values || new Array(dim).fill(0);
        });
      } catch (e) {
        console.warn(`Embedding batch ${i} failed:`, e);
        // Fill with zeros — will fall back to TF-IDF if all fail
        batch.forEach((_, idx) => {
          embeddings[i + idx] = new Array(dim).fill(0);
        });
      }

      completed += batch.length;
      onProgress?.(`生成语义向量… ${Math.min(completed, notes.length)}/${notes.length}`);

      if (i + batchSize < notes.length) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // Check if any embeddings actually worked
    const hasValid = embeddings.some(e => e && e.some(v => v !== 0));
    return hasValid ? embeddings : null;
  }

  // ─── 5. TF-IDF 向量化（无 API 模式）───────────────────────

  function segmentText(text) {
    // Use Intl.Segmenter for Chinese word segmentation (modern browsers)
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined') {
      try {
        const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
        return [...segmenter.segment(text)]
          .filter(s => s.isWordLike && s.segment.length >= 2)
          .map(s => s.segment);
      } catch (e) { /* fall through to bigrams */ }
    }
    // Fallback: character bigrams for Chinese
    const clean = text.replace(/[a-zA-Z0-9\s\p{P}]/gu, '');
    const bigrams = [];
    for (let i = 0; i < clean.length - 1; i++) {
      bigrams.push(clean[i] + clean[i + 1]);
    }
    return bigrams;
  }

  // Stopwords
  const STOPWORDS = new Set('的了是在我有人不这个他她它们你和与就都也要会可以上到说对很还没被能让把被从而且但因为所以如果那么只其'.split(''));

  function tfidfVectorize(notes, maxFeatures = 500) {
    // Tokenize all documents
    const docs = notes.map(n => {
      const text = (n.full_text || n.text || '') + ' ' + (n.tags || []).join(' ');
      return segmentText(text).filter(w => !STOPWORDS.has(w) && w.length >= 2);
    });

    // Document frequency
    const df = {};
    docs.forEach(tokens => {
      const unique = new Set(tokens);
      unique.forEach(t => { df[t] = (df[t] || 0) + 1; });
    });

    // Select top features by document frequency (filter rare & too common)
    const N = docs.length;
    const candidates = Object.entries(df)
      .filter(([_, f]) => f >= 2 && f <= N * 0.8)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxFeatures);

    const vocab = {};
    candidates.forEach(([word], idx) => { vocab[word] = idx; });
    const vocabSize = candidates.length;

    // Compute TF-IDF vectors
    const vectors = docs.map((tokens, i) => {
      const vec = new Float64Array(vocabSize);
      const tf = {};
      tokens.forEach(t => { if (vocab[t] !== undefined) tf[t] = (tf[t] || 0) + 1; });
      
      const wordScores = [];
      for (const [word, count] of Object.entries(tf)) {
        const idx = vocab[word];
        const idf = Math.log(N / (df[word] || 1));
        const val = (count / tokens.length) * idf;
        vec[idx] = val;
        wordScores.push({ word, val });
      }
      
      // Store top 3 TF-IDF keywords on the note
      wordScores.sort((a, b) => b.val - a.val);
      notes[i].tfidf_keywords = wordScores.slice(0, 3).map(x => x.word);
      
      // L2 normalize
      let norm = 0;
      for (let j = 0; j < vocabSize; j++) norm += vec[j] * vec[j];
      norm = Math.sqrt(norm) || 1;
      for (let j = 0; j < vocabSize; j++) vec[j] /= norm;
      return vec;
    });

    return vectors;
  }

  // ─── 6. 相似度矩阵 ─────────────────────────────────────

  function cosineSimilarityMatrix(vectors) {
    const n = vectors.length;
    const dim = vectors[0].length;
    const matrix = new Array(n);
    for (let i = 0; i < n; i++) {
      matrix[i] = new Float32Array(n);
      matrix[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        let dot = 0;
        for (let d = 0; d < dim; d++) dot += vectors[i][d] * vectors[j][d];
        matrix[i][j] = dot;
        if (!matrix[j]) matrix[j] = new Float32Array(n);
        matrix[j][i] = dot;
      }
    }
    return matrix;
  }

  // ─── 7. K-Means 聚类 ──────────────────────────────────

  function kmeans(vectors, k, maxIter = 50) {
    const n = vectors.length;
    const dim = vectors[0].length;

    // K-Means++ initialization
    const centroids = [];
    const usedIdx = new Set();
    let firstIdx = Math.floor(Math.random() * n);
    centroids.push([...vectors[firstIdx]]);
    usedIdx.add(firstIdx);

    for (let c = 1; c < k; c++) {
      const dists = new Float64Array(n);
      let total = 0;
      for (let i = 0; i < n; i++) {
        if (usedIdx.has(i)) { dists[i] = 0; continue; }
        let minDist = Infinity;
        for (const cent of centroids) {
          let dot = 0;
          let normC = 0;
          for (let j = 0; j < dim; j++) {
            dot += vectors[i][j] * cent[j];
            normC += cent[j] * cent[j];
          }
          normC = Math.sqrt(normC) || 1;
          let d = 1 - (dot / normC);
          minDist = Math.min(minDist, Math.max(0, d));
        }
        dists[i] = minDist;
        total += minDist;
      }
      // Weighted random selection
      let r = Math.random() * total;
      for (let i = 0; i < n; i++) {
        r -= dists[i];
        if (r <= 0) { centroids.push([...vectors[i]]); usedIdx.add(i); break; }
      }
    }

    // Iterate
    let labels = new Int32Array(n);
    for (let iter = 0; iter < maxIter; iter++) {
      // Assign
      let changed = false;
      for (let i = 0; i < n; i++) {
        let bestC = 0, bestDist = Infinity;
        for (let c = 0; c < k; c++) {
          let dot = 0;
          let normC = 0;
          for (let j = 0; j < dim; j++) {
            dot += vectors[i][j] * centroids[c][j];
            normC += centroids[c][j] * centroids[c][j];
          }
          normC = Math.sqrt(normC) || 1;
          let d = 1 - (dot / normC);
          if (d < bestDist) { bestDist = d; bestC = c; }
        }
        if (labels[i] !== bestC) { labels[i] = bestC; changed = true; }
      }
      if (!changed) break;

      // Update centroids
      for (let c = 0; c < k; c++) {
        const newCent = new Float64Array(dim);
        let count = 0;
        for (let i = 0; i < n; i++) {
          if (labels[i] === c) {
            for (let j = 0; j < dim; j++) newCent[j] += vectors[i][j];
            count++;
          }
        }
        if (count > 0) {
          for (let j = 0; j < dim; j++) centroids[c][j] = newCent[j] / count;
        }
      }
    }

    return labels;
  }

  function silhouetteScore(vectors, labels) {
    const n = vectors.length;
    const dim = vectors[0].length;
    if (n < 3) return -1;

    let totalScore = 0;
    const clusters = {};
    for (let i = 0; i < n; i++) {
      if (!clusters[labels[i]]) clusters[labels[i]] = [];
      clusters[labels[i]].push(i);
    }

    // Sample for speed: max 200 points
    const sampleIdx = n <= 200 ? [...Array(n).keys()] :
      [...Array(n).keys()].sort(() => Math.random() - 0.5).slice(0, 200);

    for (const i of sampleIdx) {
      const myCluster = labels[i];
      const myMembers = clusters[myCluster];

      // Average intra-cluster distance
      let a = 0;
      if (myMembers.length > 1) {
        for (const j of myMembers) {
          if (j === i) continue;
          let dot = 0;
          for (let k = 0; k < dim; k++) dot += vectors[i][k] * vectors[j][k];
          a += Math.max(0, 1 - dot);
        }
        a /= (myMembers.length - 1);
      }

      // Min average inter-cluster distance
      let b = Infinity;
      for (const [cl, members] of Object.entries(clusters)) {
        if (parseInt(cl) === myCluster) continue;
        let avgDist = 0;
        for (const j of members) {
          let dot = 0;
          for (let k = 0; k < dim; k++) dot += vectors[i][k] * vectors[j][k];
          avgDist += Math.max(0, 1 - dot);
        }
        avgDist /= members.length;
        b = Math.min(b, avgDist);
      }

      totalScore += (b - a) / Math.max(a, b);
    }

    return totalScore / sampleIdx.length;
  }

  function autoCluster(vectors, onProgress) {
    const minK = 6, maxK = Math.min(18, Math.floor(vectors.length / 10));
    let bestK = 10, bestScore = -1;

    onProgress?.('正在寻找最佳聚类数…');

    for (let k = minK; k <= maxK; k++) {
      const labels = kmeans(vectors, k);
      const score = silhouetteScore(vectors, labels);
      if (score > bestScore) { bestScore = score; bestK = k; }
    }

    onProgress?.(`最佳聚类数：${bestK}（轮廓系数 ${bestScore.toFixed(3)}）`);
    return kmeans(vectors, bestK);
  }

  // ─── 8. 桥接笔记检测 ───────────────────────────────────

  function detectBridges(simMatrix, labels, threshold = 0.2) {
    const n = labels.length;
    const bridges = [];

    for (let i = 0; i < n; i++) {
      const myCluster = labels[i];
      const connectedClusters = new Set();
      for (let j = 0; j < n; j++) {
        if (j === i && labels[j] !== myCluster && simMatrix[i][j] > threshold) {
          connectedClusters.add(labels[j]);
        }
      }
      // Fix: check similarity with nodes from other clusters
      for (let j = 0; j < n; j++) {
        if (i !== j && labels[j] !== myCluster && simMatrix[i][j] > threshold) {
          connectedClusters.add(labels[j]);
        }
      }
      if (connectedClusters.size >= 2) {
        bridges.push({
          note_id: i,
          cluster: myCluster,
          bridges_to_clusters: [...connectedClusters],
          bridge_strength: connectedClusters.size,
        });
      }
    }

    return bridges.sort((a, b) => b.bridge_strength - a.bridge_strength).slice(0, 50);
  }

  // ─── 9. 获取簇关键词 ──────────────────────────────────

  function getClusterKeywords(notes, labels, vectors) {
    const clusters = {};
    const k = Math.max(...labels) + 1;

    for (let c = 0; c < k; c++) {
      const members = [];
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] === c) members.push(i);
      }

      // Extract frequent words from cluster members
      const wordFreq = {};
      members.forEach(idx => {
        const text = notes[idx].full_text || notes[idx].text || '';
        const words = segmentText(text).filter(w => !STOPWORDS.has(w) && w.length >= 2);
        words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
      });

      const keywords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w]) => w);

      clusters[c] = { size: members.length, keywords };
    }

    return clusters;
  }

  // ─── 10. 语义近邻 ──────────────────────────────────────

  function findNeighbors(simMatrix, topN = 5) {
    const n = simMatrix.length;
    const neighbors = new Array(n);
    for (let i = 0; i < n; i++) {
      const scored = [];
      for (let j = 0; j < n; j++) {
        if (i !== j) scored.push({ id: j, similarity: simMatrix[i][j] });
      }
      scored.sort((a, b) => b.similarity - a.similarity);
      neighbors[i] = scored.slice(0, topN);
    }
    return neighbors;
  }

  // ─── 主流程 ────────────────────────────────────────────

  async function analyze(htmlString, options = {}) {
    const { apiKey, onProgress } = options;
    const useAI = !!apiKey;

    // Step 1: Parse
    onProgress?.('📄 解析笔记…', 0);
    const notes = parseFlomoHTML(htmlString, onProgress);
    if (notes.length === 0) throw new Error('未找到任何笔记，请确认文件格式正确');

    // Step 2: Annotate
    onProgress?.('🏷️ 标注笔记…', 15);
    let annotations;
    if (useAI) {
      onProgress?.('🤖 使用 Gemini AI 进行语义标注…', 15);
      annotations = await annotateWithGemini(notes, apiKey, onProgress);
    } else {
      annotations = notes.map(n => annotateKeyword(n));
    }
    notes.forEach((n, i) => Object.assign(n, annotations[i]));

    // Step 3: Vectorize
    onProgress?.('📐 向量化…', 50);
    let vectors;
    let embeddingSource = 'tfidf';

    if (useAI) {
      onProgress?.('🧠 生成 Gemini 语义向量…', 50);
      const geminiVecs = await embedWithGemini(notes, apiKey, onProgress);
      if (geminiVecs) {
        vectors = geminiVecs;
        embeddingSource = 'gemini';
      }
    }

    if (!vectors || embeddingSource === 'tfidf') {
      onProgress?.('📊 TF-IDF 向量化中…', 55);
      vectors = tfidfVectorize(notes);
    }

    // Step 4: Similarity matrix
    onProgress?.('🔗 计算相似度…', 70);
    const simMatrix = cosineSimilarityMatrix(vectors);

    // Step 5: Cluster
    onProgress?.('🎯 聚类分析…', 80);
    const labels = autoCluster(vectors, onProgress);
    notes.forEach((n, i) => { n.cluster = labels[i]; });

    // Step 6: Cluster info
    const clusters = getClusterKeywords(notes, labels, vectors);

    // Step 7: Bridges
    onProgress?.('🌉 发现桥接笔记…', 90);
    const bridges = detectBridges(simMatrix, labels);

    // Step 8: Neighbors
    const neighbors = findNeighbors(simMatrix);
    notes.forEach((n, i) => { n.neighbors = neighbors[i]; });

    // Step 9: Graph edges
    onProgress?.('✨ 生成图谱数据…', 95);
    const edges = [];
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        if (simMatrix[i][j] > 0.15) {
          edges.push({ source: i, target: j, weight: simMatrix[i][j] });
        }
      }
    }
    edges.sort((a, b) => b.weight - a.weight);
    // Keep top edges to avoid performance issues
    const maxEdges = Math.min(edges.length, 5000);

    onProgress?.('✅ 分析完成！', 100);

    return {
      notes,
      clusters,
      bridges,
      edges: edges.slice(0, maxEdges),
      meta: {
        total: notes.length,
        clusterCount: Object.keys(clusters).length,
        embeddingSource,
        useAI,
      },
    };
  }

  // Public API
  return { analyze, parseFlomoHTML };
})();
