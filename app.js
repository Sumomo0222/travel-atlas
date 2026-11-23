/* ============================================================
   山河手帖 · 交互引擎
   地图 / 筛选 / 时间轴 / 记忆明信片 / 回忆路线 / 自动放映
   ============================================================ */
(function () {
  'use strict';

  if (!window.L) {
    document.body.insertAdjacentHTML('beforeend',
      '<p class="noscript-note">地图库加载失败：本页面需要联网加载 Leaflet 与地图瓦片。</p>');
    return;
  }

  /* ---------- 数据与本地存储 ---------- */
  const ATLAS = window.ATLAS;
  const MOODS = ATLAS.moods;
  const THEME_ORDER = ATLAS.themeOrder;
  const ICONS = ATLAS.icons;
  const STORE_KEY = 'atlas.data.v1';

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { added: [], overrides: {}, deleted: [] };
      const d = JSON.parse(raw);
      return {
        added: Array.isArray(d.added) ? d.added : [],
        overrides: d.overrides && typeof d.overrides === 'object' ? d.overrides : {},
        deleted: Array.isArray(d.deleted) ? d.deleted : [],
      };
    } catch (err) {
      return { added: [], overrides: {}, deleted: [] };
    }
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (err) { /* 隐私模式下仅会话内生效 */ }
  }
  let store = loadStore();

  let E = [], N = 0;
  let byId = new Map(), idxOf = new Map();

  function computeData() {
    const del = new Set(store.deleted);
    const base = ATLAS.entries.filter(e => !del.has(e.id))
      .map(e => store.overrides[e.id] ? Object.assign({}, e, store.overrides[e.id]) : e);
    E = base.concat(store.added).slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    N = E.length;
    byId = new Map(E.map(e => [e.id, e]));
    idxOf = new Map(E.map((e, i) => [e.id, i]));
    E.forEach(e => { e.year = +e.date.slice(0, 4); });
  }
  computeData();

  /* ---------- 状态 ---------- */
  const state = {
    f: { year: new Set(), mood: new Set(), theme: new Set() },
    selectedId: null,
    routeActive: false,
    routeList: [],
    touring: false,
    clearedOnce: false,
  };

  /* ---------- 工具 ---------- */
  const $ = s => document.querySelector(s);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const pad2 = n => String(n).padStart(2, '0');
  const fmtDate = d => d.replace(/-/g, '.');
  const seasonWord = d => { const m = +d.slice(5, 7); return m <= 2 || m === 12 ? '冬' : m <= 5 ? '春' : m <= 8 ? '夏' : '秋'; };
  const rad = d => d * Math.PI / 180;
  function distKm(a, b) {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(s));
  }
  function totalKm(list) {
    let sum = 0;
    for (let i = 1; i < list.length; i++) {
      sum += distKm(
        { lat: list[i - 1].coord[0], lng: list[i - 1].coord[1] },
        { lat: list[i].coord[0], lng: list[i].coord[1] });
    }
    return sum;
  }
  const fmtKm = km => Math.round(km).toLocaleString('en-US');

  function arcPoints(a, b, bend) {
    const A = { lat: a[0], lng: a[1] }, B = { lat: b[0], lng: b[1] };
    const mid = { lat: (A.lat + B.lat) / 2, lng: (A.lng + B.lng) / 2 };
    const dx = B.lng - A.lng, dy = B.lat - A.lat;
    const dist = Math.hypot(dx, dy) || 1;
    const ctrl = {
      lat: mid.lat - dy * bend,
      lng: mid.lng + dx * bend,
    };
    const pts = [];
    const STEPS = 44;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS, u = 1 - t;
      pts.push([
        u * u * A.lat + 2 * u * t * ctrl.lat + t * t * B.lat,
        u * u * A.lng + 2 * u * t * ctrl.lng + t * t * B.lng,
      ]);
    }
    return pts;
  }

  function phFallbackSVG(cap) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540"><rect width="720" height="540" fill="#e6dcc0"/><g fill="none" stroke="#8d8470" stroke-width="3"><circle cx="360" cy="250" r="70"/><path d="M120 430l140-120 90 80 100-95 150 135"/></g><text x="360" y="380" text-anchor="middle" font-size="26" fill="#5c5545" font-family="serif">${cap || '照片待冲印'}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  window.__phfall = phFallbackSVG;

  /* ---------- 筛选 ---------- */
  const match = e =>
    (!state.f.year.size || state.f.year.has(e.year ?? +e.date.slice(0, 4))) &&
    (!state.f.mood.size || state.f.mood.has(e.mood)) &&
    (!state.f.theme.size || state.f.theme.has(e.theme));

  // 给数据补 year 字段
  const filtered = () => E.filter(match);

  /* ---------- 地图 ---------- */
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    minZoom: 2,
    maxZoom: 12,
    zoomSnap: 0.5,
    worldCopyJump: true,
  });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 12,
    maxNativeZoom: 16,
  }).addTo(map);

  const bounds = () => L.latLngBounds(E.map(e => e.coord));
  function fitAll() {
    const mobile = window.innerWidth <= 900;
    map.fitBounds(bounds(), {
      paddingTopLeft: [mobile ? 20 : 380, 40],
      paddingBottomRight: [mobile ? 20 : 60, 170],
    });
  }
  fitAll();

  /* 视野偏移飞行：让目标点落在可见区域中心 */
  function flyToOffset(latlng, zoom, off) {
    const p = map.project(latlng, zoom);
    const t = off ? p.add(L.point(off[0], off[1])) : p;
    map.flyTo(map.unproject(t, zoom), zoom, { duration: 1.5 });
  }
  function viewOffsets(cardOpen) {
    const mobile = window.innerWidth <= 900;
    if (mobile) return cardOpen ? [0, Math.round(window.innerHeight * 0.3)] : [0, 0];
    return cardOpen ? [218, 55] : [-170, 50];
  }

  /* 坐标读数 */
  const coordsEl = $('#coords');
  function updateCoords() {
    const c = map.getCenter();
    const z = map.getZoom();
    const la = `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? 'N' : 'S'}`;
    const ln = `${Math.abs(c.lng).toFixed(2)}° ${c.lng >= 0 ? 'E' : 'W'}`;
    coordsEl.innerHTML = `${la} · ${ln}<i>ZOOM ${z.toFixed(1)} · © ESRI · MAXAR</i>`;
  }
  map.on('move zoom', updateCoords);
  updateCoords();

  /* ---------- 标记 ---------- */
  const markers = new Map();
  const markerLayer = L.layerGroup().addTo(map);
  function buildMarkers() {
    markerLayer.clearLayers();
    markers.clear();
    E.forEach((e, i) => {
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<div class="pin" style="--i:${i}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle class="pin-dot" cx="12" cy="12" r="10"/>
            <circle class="pin-hole" cx="12" cy="12" r="3.4"/>
          </svg>
          <span class="pin-label${e.labelSide ? ' pin-label--' + e.labelSide : ''}">${e.city}</span>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const m = L.marker(e.coord, { icon, riseOnHover: true, zIndexOffset: 100 })
        .addTo(markerLayer)
        .bindTooltip(
          `<b>${e.city}</b> · ${e.mood} · ${fmtDate(e.date)}`,
          { direction: 'top', offset: [0, -36], className: 'tour-tip' });
      m.on('click', () => select(e.id, true));
      markers.set(e.id, m);
    });
  }
  buildMarkers();

  function setActiveMarker(id) {
    markers.forEach((m, key) => {
      const el = m.getElement();
      if (!el) return;
      el.classList.toggle('active', key === id);
    });
    if (id) markers.get(id)?.setZIndexOffset(600);
    markers.forEach((m, key) => { if (key !== id) m.setZIndexOffset(100); });
  }

  /* ---------- 左栏：统计 / 筛选 chips ---------- */
  const chipHosts = { year: $('#chips-year'), mood: $('#chips-mood'), theme: $('#chips-theme') };

  function buildChips(key, values, withIcon) {
    chipHosts[key].innerHTML = '';
    values.forEach(v => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.v = v;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = (withIcon ? `<span class="chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[v] || ''}</svg></span>` : '') + v;
      b.addEventListener('click', () => {
        const set = state.f[key];
        set.has(v) ? set.delete(v) : set.add(v);
        b.setAttribute('aria-pressed', set.has(v) ? 'true' : 'false');
        refresh();
      });
      chipHosts[key].appendChild(b);
    });
  }
  function syncChipPressed() {
    document.querySelectorAll('.chip').forEach(c => {
      const v = c.dataset.v;
      const on = state.f.year.has(+v) || state.f.year.has(v) ||
        state.f.mood.has(v) || state.f.theme.has(v);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function updateStats() {
    $('#eyebrow').textContent = `Personal Travel Atlas · ${E[0].year}—${E[N - 1].year}`;
    const fragTotal = E.reduce((a, e) => a + e.fragments.length, 0);
    $('#stats').innerHTML =
      `城市 <b>${N}</b> · 记忆 <b>${N}</b> · 碎片 <b>${fragTotal}</b> · 里程 <b>${fmtKm(totalKm(E))}</b> KM`;
  }
  function buildChipsAll() {
    const years = [...new Set(E.map(e => e.year))].sort((a, b) => a - b);
    const moods = [...new Set([...MOODS, ...E.map(e => e.mood)])];
    const themes = [...new Set([...THEME_ORDER, ...E.map(e => e.theme)])];
    buildChips('year', years, false);
    buildChips('mood', moods, false);
    buildChips('theme', themes, true);
    syncChipPressed();
  }
  buildChipsAll();
  updateStats();

  const btnReset = $('#btn-reset');
  btnReset.addEventListener('click', () => {
    state.f.year.clear(); state.f.mood.clear(); state.f.theme.clear();
    syncChipPressed();
    refresh();
  });

  /* ---------- 时间轴 ---------- */
  const tlHost = $('#tl');
  const tickById = new Map();
  function buildTimeline() {
    tlHost.innerHTML = '';
    tickById.clear();
    const years = [...new Set(E.map(e => e.year))].sort((a, b) => a - b);
    years.forEach(y => {
      const group = document.createElement('div');
      group.className = 'tl-year';
      const yr = document.createElement('span');
      yr.className = 'tl-yr';
      yr.textContent = y;
      const ticks = document.createElement('div');
      ticks.className = 'tl-ticks';
      E.filter(e => e.year === y).forEach(e => {
        const t = document.createElement('button');
        t.className = 'tick';
        t.title = `${e.city} · ${fmtDate(e.date)}`;
        t.innerHTML = `<i></i><b>${e.city}</b>`;
        t.addEventListener('click', () => select(e.id, true));
        ticks.appendChild(t);
        tickById.set(e.id, t);
      });
      group.append(yr, ticks);
      tlHost.appendChild(group);
    });
  }
  buildTimeline();

  /* ---------- 记忆明信片 ---------- */
  const card = $('#card');
  const themeSvg = t =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[t] || ''}</svg>`;

  function postmarkSVG(e) {
    const [y, m, d] = e.date.split('-');
    return `<div class="date-tab"><b>${y}.${m}.${d}</b><span>${e.latin}</span></div>`;
  }

  function fillCard(e) {
    const i = idxOf.get(e.id);
    $('#c-no').textContent = `NO.${pad2(i + 1)} / ${pad2(N)} — ${e.year}`;
    $('#c-city').textContent = e.city;
    $('#c-latin').textContent = `${e.latin} · ${e.country}`;
    $('#c-stamps').innerHTML =
      postmarkSVG(e) +
      `<div class="mood-stamp">${e.mood}<small>MOOD</small></div>` +
      `<span class="theme-chip">${themeSvg(e.theme)}${e.theme}</span>`;
    const note = $('#c-note');
    note.hidden = !e.note;
    note.textContent = e.note || '';
    $('#c-title').textContent = e.title;
    $('#c-photos').innerHTML = (e.photos || []).map((p, k) => {
      const src = p.url || `https://picsum.photos/seed/${p.seed}/${p.w || 720}/${p.h || 540}`;
      return `
      <figure class="ph">
        <img src="${src}" alt="${p.cap}" loading="lazy"
             data-cap="${p.cap}" onerror="this.onerror=null;this.src=window.__phfall(this.dataset.cap)">
        <figcaption>${p.cap}<i>PICTURE-${pad2(k + 1)}</i></figcaption>
      </figure>`;
    }).join('');
    $('#c-frag').innerHTML = e.fragments.map(f =>
      `<li><time>${f.time}</time><p>${f.text}</p></li>`).join('');
    const [lat, lng] = e.coord;
    $('#c-coord').textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
    const rIdx = state.routeActive ? state.routeList.findIndex(x => x.id === e.id) : -1;
    $('#c-route-pos').textContent = rIdx >= 0 ? `回忆路线 · 第 ${pad2(rIdx + 1)} 站` : `${seasonWord(e.date)}天 · ${e.mood}`;
  }

  function syncOverlay() {
    // 记忆卡打开时，路线面板退到卡片之后，避免互相遮挡
    panel.classList.toggle('under', card.classList.contains('open'));
  }

  function select(id, fly) {
    if (state.touring) stopTour();
    const e = byId.get(id);
    if (!e) return;
    state.selectedId = id;
    setActiveMarker(id);
    fillCard(e);
    card.classList.add('open');
    card.setAttribute('aria-hidden', 'false');
    syncOverlay();
    tickById.forEach((t, k) => t.classList.toggle('active', k === id));
    if (fly) flyToOffset(e.coord, e.zoom || 5, viewOffsets(true));
  }

  function closeCard() {
    state.selectedId = null;
    card.classList.remove('open');
    card.setAttribute('aria-hidden', 'true');
    setActiveMarker(null);
    tickById.forEach(t => t.classList.remove('active'));
    syncOverlay();
  }

  $('#card-close').addEventListener('click', closeCard);
  $('#c-prev').addEventListener('click', () => stepCard(-1));
  $('#c-next').addEventListener('click', () => stepCard(1));

  function stepCard(dir) {
    const list = filtered();
    if (!list.length) return;
    const cur = list.findIndex(e => e.id === state.selectedId);
    const next = cur === -1 ? 0 : (cur + dir + list.length) % list.length;
    select(list[next].id, true);
  }

  /* ---------- 回忆路线 ---------- */
  const panel = $('#route-panel');
  const btnRoute = $('#btn-route');
  let routeLine = null;
  let wayMarkers = [];
  let drawRAF = null;

  function hidePanel() {
    panel.classList.remove('show');
    setTimeout(() => { if (!state.routeActive) panel.hidden = true; }, 500);
  }

  function clearRoute() {
    if (drawRAF) cancelAnimationFrame(drawRAF);
    drawRAF = null;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    wayMarkers.forEach(m => map.removeLayer(m));
    wayMarkers = [];
    state.routeActive = false;
    state.routeList = [];
    stopTour();
    hidePanel();
    btnRoute.textContent = '✦ 生成回忆路线';
  }

  function updateRouteBtn() {
    btnRoute.textContent = state.routeActive ? '↻ 重新生成路线' : '✦ 生成回忆路线';
    const n = filtered().length;
    btnRoute.disabled = n < 2;
    btnRoute.title = n < 2 ? '至少需要点亮两段记忆才能连成路线' : '';
  }

  function drawRoute(list) {
    clearRoute();
    if (!list || list.length < 2) return;
    state.routeActive = true;
    state.routeList = list;
    updateRouteBtn();

    const legs = [];
    for (let i = 1; i < list.length; i++) {
      legs.push({
        pts: arcPoints(list[i - 1].coord, list[i].coord, i % 2 ? 0.16 : -0.16),
        toId: list[i].id,
      });
    }
    const perLeg = legs.map(l => l.pts.length);
    const totalPts = perLeg.reduce((a, b) => a + b, 0);

    routeLine = L.polyline([], {
      color: '#e63a2e',
      weight: 1.7,
      opacity: .9,
      dashArray: '3 6',
      lineCap: 'round',
      className: 'route-line',
    }).addTo(map);

    // 终点 / 起点小圆点
    wayMarkers = list.map((e, i) => {
      const icon = L.divIcon({
        className: 'wp-wrap',
        html: `<span class="wp" data-wp="${e.id}">${pad2(i + 1)}</span>`,
        iconSize: [30, 18],
        iconAnchor: [15, 9],
      });
      return L.marker(e.coord, { icon, interactive: false, zIndexOffset: 400 });
    });

    // 每站的揭示时机：抵达该站的航段画完时出现
    const cum = [];
    let acc = 0;
    for (const leg of legs) { acc += leg.pts.length; cum.push(acc); }

    const dur = Math.min(4600, 1100 + legs.length * 300);
    const t0 = performance.now();
    wayMarkers[0].addTo(map);

    function frame(t) {
      const p = Math.min(1, (t - t0) / dur);
      const n = Math.max(2, Math.floor(p * totalPts));
      let arr = []; let rem = n;
      for (const leg of legs) {
        if (rem <= 0) break;
        const take = Math.min(rem, leg.pts.length);
        arr = arr.concat(leg.pts.slice(0, take));
        rem -= take;
      }
      routeLine.setLatLngs(arr);
      for (let i = 1; i < wayMarkers.length; i++) {
        if (n >= cum[i - 1] && !map.hasLayer(wayMarkers[i])) wayMarkers[i].addTo(map);
      }
      if (p < 1) {
        drawRAF = requestAnimationFrame(frame);
      } else {
        routeLine.setLatLngs(legs.flatMap(l => l.pts));
        wayMarkers.forEach(m => { if (!map.hasLayer(m)) m.addTo(map); });
        drawRAF = null;
        fillPanel(list);
        fitRoute(list);
      }
    }
    drawRAF = requestAnimationFrame(frame);
  }

  function fitRoute(list) {
    const b = L.latLngBounds(list.map(e => e.coord));
    const mobile = window.innerWidth <= 900;
    const panelW = (!panel.hidden && panel.classList.contains('show') && !card.classList.contains('open'))
      ? 395 : 60;
    map.flyToBounds(b, {
      paddingTopLeft: [mobile ? 30 : (card.classList.contains('open') ? 30 : 380), 60],
      paddingBottomRight: [mobile ? 30 : panelW, 180],
      duration: 1.4,
    });
  }

  function fillPanel(list) {
    const first = list[0], last = list[list.length - 1];
    const km = totalKm(list);
    const span = last.year - first.year + 1;
    const frag = list.reduce((a, e) => a + e.fragments.length, 0);

    // 最多的情绪
    const tally = {};
    list.forEach(e => { tally[e.mood] = (tally[e.mood] || 0) + 1; });
    const topMood = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];

    // 最长一程
    let maxKm = 0, legA = null, legB = null;
    for (let i = 1; i < list.length; i++) {
      const k = distKm(
        { lat: list[i - 1].coord[0], lng: list[i - 1].coord[1] },
        { lat: list[i].coord[0], lng: list[i].coord[1] });
      if (k > maxKm) { maxKm = k; legA = list[i - 1]; legB = list[i]; }
    }

    $('#rp-poem').innerHTML =
      `从<em>「${first.city}」</em>的${seasonWord(first.date)}天出发，途经 ${list.length - 1} 站，抵达<em>「${last.city}」</em>。` +
      `这一路最多的情绪是<em>「${topMood}」</em>；最长的一程从 ${legA.city} 到 ${legB.city}，${fmtKm(maxKm)} 公里。`;

    $('#rp-stats').innerHTML = `
      <div><dt>城市</dt><dd>${list.length}</dd></div>
      <div><dt>总里程</dt><dd>${fmtKm(km)}<small> km</small></dd></div>
      <div><dt>跨越</dt><dd>${span}<small> 年</small></dd></div>
      <div><dt>碎片</dt><dd>${frag}<small> 则</small></dd></div>`;

    $('#rp-stops').innerHTML = list.map((e, i) => `
      <li><button data-id="${e.id}">
        <i>${pad2(i + 1)}</i><b>${e.city}</b>
        <span>${e.mood} · ${fmtDate(e.date)}</span>
      </button></li>`).join('');
    $('#rp-stops').querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => select(b.dataset.id, true)));

    panel.hidden = false;
    panel.classList.add('show');

    // 若正选中某段记忆，同步它在路线中的站次文案
    if (state.selectedId) {
      const rIdx = list.findIndex(x => x.id === state.selectedId);
      if (rIdx >= 0) $('#c-route-pos').textContent = `回忆路线 · 第 ${pad2(rIdx + 1)} 站`;
    }
  }

  btnRoute.addEventListener('click', () => {
    drawRoute(filtered());
    if (window.innerWidth <= 900) rail.classList.remove('open');
  });

  $('#rp-close').addEventListener('click', hidePanel);
  $('#btn-clear').addEventListener('click', () => { state.clearedOnce = true; clearRoute(); });

  /* ---------- 自动放映回忆 ---------- */
  const tourChip = $('#tour-chip');
  const tourText = $('#tour-text');
  let tourTimer = null;
  let tourIdx = 0;

  function startTour() {
    if (state.touring) { stopTour(); return; }
    const list = state.routeActive ? state.routeList : filtered();
    if (list.length < 2) return;
    if (!state.routeActive) drawRoute(list);
    closeCard();
    state.touring = true;
    tourIdx = 0;
    $('#btn-tour').textContent = '◼ 停止放映';
    tourChip.hidden = false;
    const step = () => {
      if (!state.touring) return;
      const e = list[tourIdx];
      setActiveMarker(e.id);
      flyToOffset(e.coord, e.zoom || 5, viewOffsets(false));
      markers.forEach(m => m.closeTooltip());
      markers.get(e.id)?.openTooltip();
      // 航点编号高亮
      wayMarkers.forEach(m => m?.getElement()?.classList.remove('current'));
      const wpEl = wayMarkers[tourIdx]?.getElement();
      wpEl?.classList.add('current');
      tourText.textContent = `放映回忆 · 第 ${tourIdx + 1} / ${list.length} 站 · ${e.city}`;
      tourIdx++;
      if (tourIdx >= list.length) {
        tourTimer = setTimeout(() => { tourText.textContent = '放映完毕 · 这就是你的旅程'; tourTimer = setTimeout(endTour, 2200); }, 3000);
      } else {
        tourTimer = setTimeout(step, 3200);
      }
    };
    step();
  }

  function endTour() {
    clearTimeout(tourTimer);
    tourTimer = null;
    state.touring = false;
    $('#btn-tour').textContent = '▸ 放映回忆';
    tourChip.hidden = true;
    markers.forEach(m => m.closeTooltip());
    wayMarkers.forEach(m => m?.getElement()?.classList.remove('current'));
    if (state.routeActive && state.routeList.length) fitRoute(state.routeList);
  }
  function stopTour() { if (state.touring) endTour(); }

  $('#btn-tour').addEventListener('click', startTour);
  $('#tour-stop').addEventListener('click', endTour);

  /* ---------- 整体重建（数据变更后） ---------- */
  function rebuildAll() {
    computeData();
    buildMarkers();
    buildTimeline();
    buildChipsAll();
    updateStats();
    refresh();
    if (state.selectedId && !byId.has(state.selectedId)) closeCard();
  }

  /* ---------- 轻提示 ---------- */
  const toastEl = $('#toast');
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove('show'); toastEl.hidden = true; }, 2200);
  }

  /* ---------- 编辑器 ---------- */
  const editor = $('#editor');
  let editingId = null;
  let pickMode = false;
  let pickMarker = null;
  const edSel = { mood: null, theme: null };

  function edChipGroup(host, values, selKey) {
    host.innerHTML = '';
    values.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = v;
      b.setAttribute('aria-pressed', edSel[selKey] === v ? 'true' : 'false');
      b.addEventListener('click', () => {
        edSel[selKey] = edSel[selKey] === v ? null : v;
        host.querySelectorAll('.chip').forEach(c =>
          c.setAttribute('aria-pressed', c.textContent === edSel[selKey] ? 'true' : 'false'));
      });
      host.appendChild(b);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function addFragRow(time, text) {
    const row = document.createElement('div');
    row.className = 'ed-row';
    row.innerHTML = `
      <input type="time" class="f-time" value="${esc(time || '')}">
      <input type="text" class="f-text" placeholder="这一刻……" value="${esc(text || '')}">
      <button type="button" class="ed-rm" title="删除这条">✕</button>`;
    row.querySelector('.ed-rm').addEventListener('click', () => row.remove());
    $('#ed-frags').appendChild(row);
  }

  function addPhotoRow(p) {
    const row = document.createElement('div');
    row.className = 'ed-row';
    const src = p ? (p.url || p.seed || '') : '';
    row.innerHTML = `
      <input type="text" class="f-src" placeholder="picsum seed 或 https://…" value="${esc(src)}">
      <input type="text" class="f-cap" placeholder="照片说明" value="${esc(p?.cap || '')}">
      <button type="button" class="ed-rm" title="删除这张">✕</button>`;
    row.querySelector('.ed-rm').addEventListener('click', () => row.remove());
    $('#ed-photos').appendChild(row);
  }

  function openEditor(id) {
    editingId = id || null;
    const e = id ? byId.get(id) : null;
    $('#ed-head-title').textContent = e ? '✎ 编辑记忆' : '＋ 新的记忆';
    $('#ed-head-sub').textContent = e ? 'EDIT MEMORY' : 'NEW MEMORY';
    $('#ed-city').value = e?.city || '';
    $('#ed-country').value = e?.country || '';
    $('#ed-latin').value = e?.latin || '';
    $('#ed-date').value = e?.date || new Date().toISOString().slice(0, 10);
    const c = e?.coord;
    $('#ed-lat').value = c ? c[0] : (+map.getCenter().lat.toFixed(2));
    $('#ed-lng').value = c ? c[1] : (+map.getCenter().lng.toFixed(2));
    edSel.mood = e?.mood || null;
    edSel.theme = e?.theme || null;
    edChipGroup($('#ed-moods'), [...new Set([...MOODS, ...E.map(x => x.mood)])], 'mood');
    edChipGroup($('#ed-themes'), [...new Set([...THEME_ORDER, ...E.map(x => x.theme)])], 'theme');
    $('#ed-title').value = e?.title || '';
    $('#ed-note').value = e?.note || '';
    $('#ed-frags').innerHTML = '';
    (e?.fragments?.length ? e.fragments : [{ time: '', text: '' }]).forEach(f => addFragRow(f.time, f.text));
    $('#ed-photos').innerHTML = '';
    (e?.photos || []).forEach(p => addPhotoRow(p));
    $('#ed-del').hidden = !e;
    setPick(false);
    editor.hidden = false;
    requestAnimationFrame(() => editor.classList.add('open'));
    editor.setAttribute('aria-hidden', 'false');
    $('#ed-city').focus();
  }

  function closeEditor() {
    setPick(false);
    if (pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
    editor.classList.remove('open');
    editor.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!editor.classList.contains('open')) editor.hidden = true; }, 550);
  }

  function edWarn(msg) { toast('✎ ' + msg); }

  function saveEditor() {
    const city = $('#ed-city').value.trim();
    const date = $('#ed-date').value;
    const lat = parseFloat($('#ed-lat').value);
    const lng = parseFloat($('#ed-lng').value);
    if (!city) return edWarn('先给这个地点一个名字');
    if (!date) return edWarn('补上出发日期');
    if (Number.isNaN(lat) || Number.isNaN(lng) || Math.abs(lat) > 85) {
      return edWarn('坐标不完整 —— 可以点「在地图上拾取」');
    }
    const prev = editingId ? byId.get(editingId) : null;
    const photos = [...$('#ed-photos').querySelectorAll('.ed-row')].map(r => {
      const src = r.querySelector('.f-src').value.trim();
      if (!src) return null;
      const cap = r.querySelector('.f-cap').value.trim() || '照片';
      return /^https?:\/\//i.test(src) ? { url: src, cap } : { seed: src, w: 720, h: 540, cap };
    }).filter(Boolean);
    const fragments = [...$('#ed-frags').querySelectorAll('.ed-row')].map(r => ({
      time: r.querySelector('.f-time').value || '——',
      text: r.querySelector('.f-text').value.trim(),
    })).filter(f => f.text);

    const entry = {
      id: editingId || ('u-' + Date.now().toString(36)),
      city,
      latin: $('#ed-latin').value.trim() || city.toUpperCase(),
      country: $('#ed-country').value.trim() || '——',
      coord: [lat, lng],
      date,
      mood: edSel.mood || MOODS[0],
      theme: edSel.theme || THEME_ORDER[0],
      title: $('#ed-title').value.trim() || `${city}的日子`,
      note: $('#ed-note').value.trim(),
      zoom: prev?.zoom || 5,
      photos,
      fragments,
      labelSide: prev?.labelSide,
    };

    if (prev && store.added.some(a => a.id === editingId)) {
      store.added = store.added.map(a => (a.id === editingId ? entry : a));
    } else if (prev) {
      store.overrides[editingId] = entry;
    } else {
      store.added.push(entry);
    }
    saveStore();
    rebuildAll();
    closeEditor();
    select(entry.id, true);
    toast('已钉到地图 ✓');
  }

  function deleteEntry(id) {
    const e = byId.get(id);
    if (!e) return;
    if (!confirm(`把「${e.city}」这一页从手帖里撕掉？`)) return;
    if (store.added.some(a => a.id === id)) {
      store.added = store.added.filter(a => a.id !== id);
    } else {
      delete store.overrides[id];
      store.deleted.push(id);
    }
    saveStore();
    rebuildAll();
    closeCard();
    toast('已撕掉这一页');
  }

  /* 地图拾取坐标 */
  function setPick(on) {
    pickMode = on;
    document.getElementById('map').classList.toggle('picking', on);
    $('#pick-hint').hidden = !on;
    const btn = $('#ed-pick');
    btn.classList.toggle('active', on);
    btn.textContent = on ? '⌖ 拾取中 · 点击地图放置' : '⌖ 在地图上拾取坐标';
  }
  map.on('click', ev => {
    if (!pickMode) return;
    $('#ed-lat').value = ev.latlng.lat.toFixed(4);
    $('#ed-lng').value = ev.latlng.lng.toFixed(4);
    if (pickMarker) pickMarker.setLatLng(ev.latlng);
    else pickMarker = L.circleMarker(ev.latlng, {
      radius: 7, color: '#e63a2e', weight: 2, fillColor: '#e63a2e', fillOpacity: .35,
    }).addTo(map);
    setPick(false);
    toast('坐标已放进表单 ✓');
  });

  /* 备份 / 导入 / 恢复示例 */
  function exportData() {
    const payload = { app: '山河手帖', v: 1, exportedAt: new Date().toISOString(),
      added: store.added, overrides: store.overrides, deleted: store.deleted };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '山河手帖-备份.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('备份已下载 ✓');
  }
  function importData(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (!d || (!Array.isArray(d.added) && !d.overrides)) throw new Error('bad');
        store = {
          added: Array.isArray(d.added) ? d.added : [],
          overrides: d.overrides && typeof d.overrides === 'object' ? d.overrides : {},
          deleted: Array.isArray(d.deleted) ? d.deleted : [],
        };
        saveStore();
        rebuildAll();
        fitAll();
        toast('手帖已导入 ✓');
      } catch (err) { toast('这个文件读不出来 —— 需要本站导出的备份'); }
    };
    fr.readAsText(file);
  }

  $('#btn-new').addEventListener('click', () => {
    openEditor(null);
    if (window.innerWidth <= 900) rail.classList.remove('open');
  });
  $('#btn-export').addEventListener('click', exportData);
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', ev => {
    if (ev.target.files[0]) importData(ev.target.files[0]);
    ev.target.value = '';
  });
  $('#btn-reset-sample').addEventListener('click', () => {
    if (!confirm('清空你添加和修改的内容，恢复 16 段示例记忆？')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (err) { /* 忽略 */ }
    store = { added: [], overrides: {}, deleted: [] };
    rebuildAll();
    fitAll();
    toast('已恢复示例手帖');
  });

  $('#ed-close').addEventListener('click', closeEditor);
  $('#ed-cancel').addEventListener('click', closeEditor);
  $('#ed-save').addEventListener('click', saveEditor);
  $('#ed-del').addEventListener('click', () => editingId && deleteEntry(editingId));
  $('#ed-pick').addEventListener('click', () => setPick(!pickMode));
  $('#ed-add-frag').addEventListener('click', () => addFragRow('', ''));
  $('#ed-add-photo').addEventListener('click', () => addPhotoRow(null));
  $('#c-edit').addEventListener('click', () => state.selectedId && openEditor(state.selectedId));
  $('#c-del').addEventListener('click', () => state.selectedId && deleteEntry(state.selectedId));

  /* ---------- 刷新（筛选联动） ---------- */
  function refresh() {
    const list = filtered();
    const matched = new Set(list.map(e => e.id));

    markers.forEach((m, id) => m.getElement()?.classList.toggle('dim', !matched.has(id)));
    tickById.forEach((t, id) => t.classList.toggle('dim', !matched.has(id)));

    const nActive = state.f.year.size + state.f.mood.size + state.f.theme.size;
    btnReset.hidden = nActive === 0;
    $('#f-result').textContent = list.length
      ? `${list.length} / ${N} 段记忆正被点亮`
      : '没有符合筛选的记忆 —— 试着放开一些条件';

    if (state.selectedId && !matched.has(state.selectedId)) closeCard();
    if (state.touring) stopTour();
    updateRouteBtn();
    if (state.routeActive) debounceRedraw(list);
  }
  const debounceRedraw = debounce(list => {
    if (state.routeActive) drawRoute(list);
  }, 350);

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (pickMode) setPick(false);
      else if (state.touring) endTour();
      else if (!editor.hidden) closeEditor();
      else if (card.classList.contains('open')) closeCard();
      else hidePanel();
    } else if (!editor.hidden) {
      // 编辑器内不响应翻页快捷键
    } else if (card.classList.contains('open')) {
      if (ev.key === 'ArrowLeft') stepCard(-1);
      if (ev.key === 'ArrowRight') stepCard(1);
    }
  });

  /* ---------- 移动端侧栏 ---------- */
  const rail = $('#rail');
  $('#rail-toggle').addEventListener('click', () => rail.classList.add('open'));
  $('#rail-close').addEventListener('click', () => rail.classList.remove('open'));

  /* ---------- 缩放按钮 ---------- */
  const zoomers = document.createElement('div');
  zoomers.className = 'zoomers';
  zoomers.innerHTML = '<button id="z-in" aria-label="放大">+</button><button id="z-out" aria-label="缩小">−</button>';
  document.body.appendChild(zoomers);
  $('#z-in').addEventListener('click', () => map.zoomIn(1));
  $('#z-out').addEventListener('click', () => map.zoomOut(1));

  /* ---------- 开场：深链接参数 → 初始状态 → 自动生成一次路线 ---------- */
  (function applyParams() {
    const q = new URLSearchParams(location.search);
    if (q.get('year')) state.f.year.add(+q.get('year'));
    ['mood', 'theme'].forEach(k => { if (q.get(k)) state.f[k].add(q.get(k)); });
    document.querySelectorAll('.chip').forEach(c => {
      const v = c.dataset.v;
      const pressed = state.f.year.has(+v) || state.f.year.has(v) ||
        state.f.mood.has(v) || state.f.theme.has(v);
      c.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
    refresh();
    const openId = q.get('open');
    if (openId && byId.has(openId)) {
      setTimeout(() => select(openId, true), 900);
    }
    const qEdit = q.get('edit');
    if (qEdit) setTimeout(() => openEditor(qEdit === 'new' ? null : qEdit), 900);
  })();

  window.addEventListener('resize', debounce(() => map.invalidateSize(), 250));
  // 调试 / 自动化测试钩子（只读外观 + map 实例）
  window.__atlas = { map, get E() { return E; }, get store() { return store; } };
  const qOpen = new URLSearchParams(location.search).get('open');
  setTimeout(() => {
    if (qOpen) return; // 深链接聚焦单段记忆时不自动连路线
    if (!state.routeActive && !state.clearedOnce && !new URLSearchParams(location.search).has('noroute')
        && filtered().length >= 2) {
      drawRoute(E);
      if (new URLSearchParams(location.search).has('tour')) setTimeout(startTour, 3200);
    }
  }, 1900);
})();
