/**
 * app.js — FindTheLine 应用逻辑
 *
 * 负责：文件上传UI、进度条、D3.js 可视化、筛选交互
 */

const App = (() => {

  // ─── 状态 ──────────────────────────────────────────────
  let analysisResult = null;
  let currentView = 'graph';
  let simulation = null;
  let activeFilters = { themes: new Set(), emotions: new Set(), types: new Set(), search: '' };

  const CLUSTER_COLORS = [
    '#e05252', '#e8913a', '#d4b62e', '#5bbf5b', '#36a889',
    '#3aafcf', '#4078e0', '#7c5ce0', '#b04cc8', '#e04d8c',
    '#e07638', '#2da86d', '#c4563a', '#6e8fd8', '#a855a0',
    '#48b078', '#d49030', '#7070d0'
  ];

  // ─── 初始化 ────────────────────────────────────────────
  function init() {
    bindUpload();
    bindSettings();
    loadSavedApiKey();
  }

  // ─── 上传处理 ──────────────────────────────────────────
  function bindUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  }

  async function handleFile(file) {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('请上传 Flomo 导出的 HTML 文件');
      return;
    }

    showProcessing();

    try {
      const htmlString = await file.text();
      const apiKey = localStorage.getItem('gemini_api_key') || '';

      analysisResult = await Analyzer.analyze(htmlString, {
        apiKey: apiKey || null,
        onProgress: (msg, pct) => updateProgress(msg, pct),
      });

      showVisualization();
    } catch (e) {
      console.error(e);
      alert('分析失败：' + e.message);
      showUpload();
    }
  }

  // ─── 设置面板 ──────────────────────────────────────────
  function bindSettings() {
    const btn = document.getElementById('settingsBtn');
    const panel = document.getElementById('settingsPanel');
    const closeBtn = document.getElementById('closeSettings');
    const saveBtn = document.getElementById('saveApiKey');
    const clearBtn = document.getElementById('clearApiKey');

    btn.addEventListener('click', () => panel.classList.add('open'));
    closeBtn.addEventListener('click', () => panel.classList.remove('open'));
    panel.addEventListener('click', e => { if (e.target === panel) panel.classList.remove('open'); });

    saveBtn.addEventListener('click', () => {
      const key = document.getElementById('apiKeyInput').value.trim();
      if (key) {
        localStorage.setItem('gemini_api_key', key);
        updateApiStatus(true);
        panel.classList.remove('open');
      }
    });

    clearBtn.addEventListener('click', () => {
      localStorage.removeItem('gemini_api_key');
      document.getElementById('apiKeyInput').value = '';
      updateApiStatus(false);
    });
  }

  function loadSavedApiKey() {
    const key = localStorage.getItem('gemini_api_key');
    if (key) {
      document.getElementById('apiKeyInput').value = key;
      updateApiStatus(true);
    }
  }

  function updateApiStatus(hasKey) {
    const badge = document.getElementById('modeBadge');
    const indicator = document.getElementById('apiIndicator');
    if (hasKey) {
      badge.textContent = 'AI 增强模式';
      badge.className = 'mode-badge ai';
      indicator.textContent = '✅ API Key 已配置';
      indicator.className = 'api-indicator active';
    } else {
      badge.textContent = '基础模式';
      badge.className = 'mode-badge basic';
      indicator.textContent = '未配置 API Key';
      indicator.className = 'api-indicator';
    }
  }

  // ─── 屏幕切换 ──────────────────────────────────────────
  function showUpload() {
    document.getElementById('uploadScreen').style.display = 'flex';
    document.getElementById('processingScreen').style.display = 'none';
    document.getElementById('vizScreen').style.display = 'none';
  }

  function showProcessing() {
    document.getElementById('uploadScreen').style.display = 'none';
    document.getElementById('processingScreen').style.display = 'flex';
    document.getElementById('vizScreen').style.display = 'none';
  }

  function showVisualization() {
    document.getElementById('uploadScreen').style.display = 'none';
    document.getElementById('processingScreen').style.display = 'none';
    document.getElementById('vizScreen').style.display = 'flex';
    renderAll();
  }

  function updateProgress(msg, pct) {
    const bar = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    if (bar && pct !== undefined) bar.style.width = pct + '%';
    if (text) text.textContent = msg;
  }

  // ─── 可视化 ────────────────────────────────────────────

  function renderAll() {
    const { notes, clusters, meta } = analysisResult;
    document.getElementById('headerStats').textContent =
      `${meta.total} 条笔记 · ${meta.clusterCount} 个簇` +
      (meta.useAI ? ' · AI增强' : '');

    buildFilters();
    renderGraph(0.35);
    buildTimeline();
    buildBridges();
    bindVizEvents();
  }

  function buildFilters() {
    const { notes, clusters } = analysisResult;
    const themes = {}, emotions = {}, types = {};
    notes.forEach(n => {
      (n.themes || []).forEach(t => themes[t] = (themes[t] || 0) + 1);
      emotions[n.emotion] = (emotions[n.emotion] || 0) + 1;
      types[n.note_type] = (types[n.note_type] || 0) + 1;
    });

    document.getElementById('themeChips').innerHTML = Object.entries(themes)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `<button class="chip" data-filter="theme" data-value="${t}">${t} ${c}</button>`)
      .join('');
    document.getElementById('emotionChips').innerHTML = Object.entries(emotions)
      .sort((a, b) => b[1] - a[1])
      .map(([e, c]) => `<button class="chip" data-filter="emotion" data-value="${e}">${e} ${c}</button>`)
      .join('');
    document.getElementById('typeChips').innerHTML = Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `<button class="chip" data-filter="type" data-value="${t}">${t} ${c}</button>`)
      .join('');

    const legendHtml = Object.entries(clusters)
      .map(([id, info]) =>
        `<div class="legend-item"><div class="legend-dot" style="background:${CLUSTER_COLORS[id % CLUSTER_COLORS.length]}"></div>
         <span>${info.keywords.slice(0, 3).join(' · ')} (${info.size})</span></div>`)
      .join('');
    document.getElementById('legend').innerHTML = `<div class="legend-title">簇分布</div>${legendHtml}`;
  }

  function renderGraph(threshold) {
    const { notes, edges } = analysisResult;
    const svg = d3.select('#graphSvg');
    svg.selectAll('*').remove();
    if (simulation) { simulation.stop(); simulation = null; }

    const container = document.getElementById('graphView');
    const width = container.clientWidth;
    const height = container.clientHeight;
    svg.attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.1, 8]).on('zoom', e => g.attr('transform', e.transform)));

    const filteredEdges = edges.filter(e => e.weight > threshold).slice(0, 2500);

    // Make a copy of edges with proper references
    const edgeCopies = filteredEdges.map(e => ({ source: e.source, target: e.target, weight: e.weight }));

    const degree = {};
    edgeCopies.forEach(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      degree[s] = (degree[s] || 0) + 1;
      degree[t] = (degree[t] || 0) + 1;
    });

    const link = g.append('g').selectAll('line').data(edgeCopies).join('line')
      .attr('stroke', '#3a3a4a')
      .attr('stroke-width', d => Math.max(0.3, d.weight * 1.5))
      .attr('stroke-opacity', d => Math.min(0.4, d.weight * 0.7));

    const nodeGroup = g.append('g').selectAll('g').data(notes).join('g').attr('class', 'node-group');

    nodeGroup.append('circle')
      .attr('r', d => Math.max(3.5, Math.min(12, Math.sqrt(degree[d.id] || 1) * 1.5)))
      .attr('fill', d => CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length])
      .attr('fill-opacity', 0.92)
      .attr('stroke', 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 1.2)
      .style('cursor', 'pointer');

    simulation = d3.forceSimulation(notes)
      .force('link', d3.forceLink(edgeCopies).id(d => d.id).distance(80).strength(d => d.weight * 0.3))
      .force('charge', d3.forceManyBody().strength(-30).distanceMax(300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(8))
      .on('tick', () => {
        link
          .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    // Tooltip
    const tooltip = document.getElementById('tooltip');
    nodeGroup.on('mouseover', function (event, d) {
      d3.select(this).select('circle')
        .attr('fill-opacity', 1).attr('stroke-width', 2.5)
        .attr('stroke', CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length]);
      tooltip.innerHTML = `
        <div class="tt-time">${d.timestamp}</div>
        <div class="tt-text">${d.full_text || d.text}</div>
        <div class="tt-subtext">${d.subtext || ''}</div>
        <div class="tt-tags">${(d.themes || []).map(t => `<span class="tt-tag">${t}</span>`).join('')}<span class="tt-tag">${d.emotion}</span></div>`;
      tooltip.classList.add('visible');
      let x = event.clientX + 14, y = event.clientY - 14;
      tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
      const r = tooltip.getBoundingClientRect();
      if (r.right > window.innerWidth) tooltip.style.left = (event.clientX - r.width - 14) + 'px';
      if (r.bottom > window.innerHeight) tooltip.style.top = (event.clientY - r.height - 14) + 'px';
    })
      .on('mouseout', function () {
        d3.select(this).select('circle')
          .attr('fill-opacity', 0.92).attr('stroke-width', 1.2)
          .attr('stroke', 'rgba(255,255,255,0.25)');
        tooltip.classList.remove('visible');
      })
      .on('click', (event, d) => showDetail(d));

    // Drag
    nodeGroup.call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

    window._nodeGroup = nodeGroup;
  }

  function showDetail(node) {
    const { notes, clusters } = analysisResult;
    const panel = document.getElementById('detailPanel');
    const neighbors = node.neighbors || [];
    const cl = clusters[node.cluster] || { keywords: [] };

    document.getElementById('detailContent').innerHTML = `
      <h3>${node.timestamp}</h3>
      <div class="note-text">${node.full_text || node.text}</div>
      <div class="meta-item"><span class="meta-label">潜台词</span><span class="meta-value accent-text">${node.subtext || ''}</span></div>
      <div class="meta-item"><span class="meta-label">主题</span><span class="meta-value">${(node.themes || []).join(' · ')}</span></div>
      <div class="meta-item"><span class="meta-label">情绪</span><span class="meta-value">${node.emotion}</span></div>
      <div class="meta-item"><span class="meta-label">类型</span><span class="meta-value">${node.note_type}</span></div>
      <div class="meta-item"><span class="meta-label">簇</span><span class="meta-value" style="color:${CLUSTER_COLORS[node.cluster % CLUSTER_COLORS.length]}">${cl.keywords.slice(0, 3).join(' · ')}</span></div>
      ${node.tags.length ? `<div class="meta-item"><span class="meta-label">标签</span><span class="meta-value">${node.tags.map(t => '#' + t).join(' ')}</span></div>` : ''}
      <h3 style="margin-top:18px">语义近邻</h3>
      <ul class="neighbor-list">${neighbors.map(nb => {
      const nbN = notes.find(n => n.id === nb.id);
      return nbN ? `<li data-id="${nb.id}"><span class="sim-badge">${(nb.similarity * 100).toFixed(0)}%</span>${nbN.text.substring(0, 55)}…</li>` : '';
    }).join('')}</ul>`;
    panel.classList.add('open');

    // Bind neighbor clicks
    panel.querySelectorAll('.neighbor-list li').forEach(li => {
      li.addEventListener('click', () => {
        const id = parseInt(li.dataset.id);
        const target = notes.find(n => n.id === id);
        if (target) showDetail(target);
      });
    });
  }

  function buildTimeline() {
    const { notes } = analysisResult;
    const c = document.getElementById('timelineView');
    const sorted = [...notes].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const months = {};
    sorted.forEach(n => { const m = n.timestamp.substring(0, 7); if (!months[m]) months[m] = []; months[m].push(n); });

    c.innerHTML = Object.entries(months).map(([m, mnotes]) => `
      <div class="timeline-month"><h2>${m} · ${mnotes.length}条</h2>
      <div class="timeline-notes">${mnotes.map(n => `
        <div class="timeline-card" data-id="${n.id}" style="border-left-color:${CLUSTER_COLORS[n.cluster % CLUSTER_COLORS.length]}">
          <div class="tc-time">${n.timestamp} · ${n.note_type}</div>
          <div class="tc-text">${n.full_text || n.text}</div>
          <div class="tc-subtext">${n.subtext || ''}</div>
          <div class="tc-tags">${(n.themes || []).map(t => `<span class="tc-tag">${t}</span>`).join('')}<span class="tc-tag">${n.emotion}</span></div>
        </div>`).join('')}</div></div>`).join('');

    c.querySelectorAll('.timeline-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id);
        const note = notes.find(n => n.id === id);
        if (note) showDetail(note);
      });
    });
  }

  function buildBridges() {
    const { notes, bridges, clusters } = analysisResult;
    const c = document.getElementById('bridgesView');
    c.innerHTML = '<h2 style="margin-bottom:16px;font-size:15px;font-weight:500;color:rgba(255,255,255,0.5)">桥接笔记 — 跨簇的隐性连接</h2>' +
      (bridges || []).slice(0, 30).map(b => {
        const node = notes.find(n => n.id === b.note_id);
        if (!node) return '';
        const cl = clusters[b.cluster] || { keywords: [] };
        return `<div class="bridge-card">
          <h3>${node.timestamp} · 连接 ${b.bridges_to_clusters.length} 个簇</h3>
          <div class="bridge-text">${node.full_text || node.text}</div>
          <div class="bridge-subtext">${node.subtext || ''}</div>
          <div class="bridge-connections">
            <span class="bridge-conn" style="border-left:3px solid ${CLUSTER_COLORS[b.cluster % CLUSTER_COLORS.length]}">所在: ${cl.keywords.slice(0, 3).join('·')}</span>
            ${b.bridges_to_clusters.map(cid => {
          const ci = clusters[cid] || { keywords: [] };
          return `<span class="bridge-conn" style="border-left:3px solid ${CLUSTER_COLORS[cid % CLUSTER_COLORS.length]}">→ ${ci.keywords.slice(0, 3).join('·')}</span>`;
        }).join('')}
          </div></div>`;
      }).join('');
  }

  function bindVizEvents() {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentView = tab.dataset.view;
        document.getElementById('graphView').style.display = currentView === 'graph' ? 'block' : 'none';
        document.getElementById('timelineView').classList.toggle('active', currentView === 'timeline');
        document.getElementById('bridgesView').classList.toggle('active', currentView === 'bridges');
        document.getElementById('sidebar').style.display = currentView === 'graph' ? 'block' : 'none';
      });
    });

    // Close detail
    document.getElementById('closeDetail').addEventListener('click', () =>
      document.getElementById('detailPanel').classList.remove('open'));

    // Slider
    let sliderTimer = null;
    document.getElementById('simSlider').addEventListener('input', e => {
      const val = (e.target.value / 100).toFixed(2);
      document.getElementById('simValue').textContent = val;
      clearTimeout(sliderTimer);
      sliderTimer = setTimeout(() => renderGraph(parseFloat(val)), 300);
    });

    // Chips
    document.querySelectorAll('#themeChips .chip, #emotionChips .chip, #typeChips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        const ft = chip.dataset.filter, v = chip.dataset.value;
        const set = ft === 'theme' ? activeFilters.themes : ft === 'emotion' ? activeFilters.emotions : activeFilters.types;
        set.has(v) ? set.delete(v) : set.add(v);
        applyFilters();
      });
    });

    // Search
    document.getElementById('searchBox').addEventListener('input', e => {
      activeFilters.search = e.target.value.toLowerCase();
      applyFilters();
    });

    // Re-upload
    document.getElementById('reuploadBtn')?.addEventListener('click', () => {
      if (simulation) simulation.stop();
      analysisResult = null;
      activeFilters = { themes: new Set(), emotions: new Set(), types: new Set(), search: '' };
      showUpload();
    });
  }

  function applyFilters() {
    if (!window._nodeGroup) return;
    window._nodeGroup.each(function (d) {
      let vis = true;
      if (activeFilters.themes.size) vis = vis && (d.themes || []).some(t => activeFilters.themes.has(t));
      if (activeFilters.emotions.size) vis = vis && activeFilters.emotions.has(d.emotion);
      if (activeFilters.types.size) vis = vis && activeFilters.types.has(d.note_type);
      if (activeFilters.search) vis = vis && ((d.full_text || d.text).toLowerCase().includes(activeFilters.search) || (d.subtext || '').toLowerCase().includes(activeFilters.search));
      d3.select(this).style('opacity', vis ? 1 : 0.06);
    });
  }

  // ─── 启动 ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  return { showDetail };
})();
