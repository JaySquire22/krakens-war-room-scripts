// ==UserScript==
// @name         Kraken Gym Trainer
// @namespace    https://github.com/JaySquire22
// @version      1.3.1
// @description  Steadfast, specialist-gym training limits and effective-stat estimates
// @match        *
// @downloadURL  https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/kraken-gym-trainer.user.js
// @updateURL    https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/kraken-gym-trainer.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.torn.com
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';
  // ---- Gym detection and panel bootstrap -------------------------------------
  // v1.2.5: the fixed top-right launcher is fully removed. The inline
  // tabbed trainer panel mounts AUTOMATICALLY when the gym page loads.
  // Gym detection uses independent signals (any ONE is enough, no pair of
  // exact phrases required):
  //   1. A torn.com gym URL when available (gym.php or a gym loader path).
  //   2. Visible actual gym training controls: the four stat labels
  //      (Strength/Defense/Speed/Dexterity) together with train/energy
  //      controls. This catches PDA loader URLs without "gym" in the path
  //      and pages without the Frontline Fitness heading.
  //   3. The gym content heading "Frontline Fitness".
  // Our own panel text is excluded from DOM checks (prevents self
  // detection), unrelated Torn pages never get a panel, and polling plus
  // SPA hooks handle late gym rendering and navigation. A stale v1.2.4
  // badge left in the DOM is removed at startup.
  function isTornPage() {
    try { return /torn\.com/i.test(String(window.location.href)); } catch (e) { return false; }
  }
  function gymUrl() {
    // URL-only signal must be unambiguous: only the real gym route
    // (gym.php). Generic loader URLs (loader.php?sid=...) never count on
    // their own, so an empty loader DOM cannot falsely trigger a mount.
    try { return isTornPage() && /torn\.com\/gym\.php/i.test(String(window.location.href)); } catch (e) { return false; }
  }
  // Page text with our own UI excluded, so panel wording can never fake or
  // block evidence.
  function pageText() {
    if (!document.body) return '';
    const clone = document.body.cloneNode(true);
    for (const sel of ['#kgt', '#kgt-badge', '#kgt-style']) {
      const own = clone.querySelector(sel);
      if (own) own.remove();
    }
    return clone.textContent || '';
  }
  function gymControlsEvidence() {
    const t = pageText();
    const has = (re) => re.test(t);
    // Independent signal: all four stat labels together with a train or
    // energy training control (one of several phrasings, not two exact
    // phrases). Torn PDA gym pages render these controls.
    const stats = has(/strength/i) && has(/defense/i) && has(/speed/i) && has(/dexterity/i);
    const controls = has(/energy per train/i) || has(/what would you like to train/i) ||
      has(/train (strength|defense|speed|dexterity)/i) || has(/train\b.{0,40}(button|now|here)/i);
    return stats && controls;
  }
  function gymHeadingEvidence() {
    return /frontline fitness/i.test(pageText());
  }
  function isGymPage() {
    return gymUrl() || gymControlsEvidence() || gymHeadingEvidence();
  }
  let booted = false;
  let started = false;
  let remountHook = null;
  // Instance token: lets a freshly evaluated script (PDA re-injection,
  // userscript update) take over a stale panel instead of skipping boot.
  // Each evaluation gets a generation number; older instances back off once
  // a newer panel exists.
  window.__kgtGen = (window.__kgtGen || 0) + 1;
  const GEN = window.__kgtGen;
  const INSTANCE = Math.random().toString(36).slice(2);
  function newerInstancePanel() {
    const p = document.getElementById('kgt');
    return !!(p && Number(p.dataset.kgtGen || 0) > GEN);
  }
  // v1.2.5 cleanup: a previously installed v1.2.4 launcher badge must not
  // survive this version. Remove it wherever it appears.
  function removeStaleBadge() {
    const b = document.getElementById('kgt-badge');
    if (b) b.remove();
  }
  function boot() {
    if (booted) return;
    if (newerInstancePanel()) { booted = true; return; }
    const existing = document.getElementById('kgt');
    if (existing) {
      if (existing.dataset.kgtInstance === INSTANCE) { booted = true; return; }
      existing.remove(); // stale panel from an older script instance
    }
    if (!isGymPage()) return;
    booted = true;
    start();
  }
  // Bounded startup polling (60s) covers late-rendered gym content.
  let bootTries = 0;
  const bootPoll = setInterval(() => {
    removeStaleBadge();
    boot();
    if (newerInstancePanel()) { clearInterval(bootPoll); return; }
    if (booted || ++bootTries >= 60) clearInterval(bootPoll);
  }, 1000);
  removeStaleBadge();
  boot();
  // SPA navigation support: Torn's PDA swaps content without full reloads.
  // The panel is dropped on unrelated pages and remounts when the gym
  // content returns or late-renders (no duplicates).
  function onNavigate() {
    const panel = document.getElementById('kgt');
    if (started && !isGymPage()) {
      if (panel) panel.remove();
      return;
    }
    if (remountHook) remountHook();
    else boot();
  }
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    if (typeof orig === 'function') {
      history[m] = function () { const r = orig.apply(this, arguments); setTimeout(onNavigate, 0); return r; };
    }
  }
  window.addEventListener('popstate', onNavigate);

  // Home: place the current effective total directly beneath Torn's raw total.
  // Use the same v2 modifier calculation as the Effective stats tab.
  const HOME_STATS = ['strength', 'defense', 'speed', 'dexterity'];
  let homeBusy = false, homeFetchedAt = 0, homeRequest = 0;
  function homeRawTotalRow() {
    if (!isTornPage() || isGymPage() || !document.body) return null;
    const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,div,span,strong'))
      .find(el => el.children.length === 0 && /^battle stats$/i.test((el.textContent || '').trim()));
    if (!heading) return null;
    let scope = heading;
    for (let i = 0; i < 6 && scope; i++, scope = scope.parentElement) {
      const text = scope.textContent || '';
      if (!HOME_STATS.every(k => text.toLowerCase().includes(k)) || !text.toLowerCase().includes('total')) continue;
      const labels = Array.from(scope.querySelectorAll('td,th,div,span,li'))
        .filter(el => el.children.length === 0 && /^total$/i.test((el.textContent || '').trim()));
      for (const label of labels) {
        const cell = label.closest('td,th') || label;
        let row = cell.parentElement;
        if (row && row.children.length >= 2 && /[\d,]+/.test(row.textContent || '') &&
            !row.closest('#kgt')) return row;
      }
    }
    return null;
  }
  function homeRow() {
    const raw = homeRawTotalRow();
    if (!raw || !raw.parentElement) return null;
    let row = raw.parentElement.querySelector('[data-kgt-effective-total]');
    if (row && row.previousElementSibling !== raw) { row.remove(); row = null; }
    if (!row) {
      row = raw.cloneNode(false);
      row.removeAttribute('id');
      row.setAttribute('data-kgt-effective-total','');
      for (const [index, child] of Array.from(raw.children).entries()) {
        const cell = child.cloneNode(false);
        cell.removeAttribute('id');
        cell.textContent = index === 0 ? 'Effective total' : index === 1 ? 'Loading…' : '';
        row.appendChild(cell);
      }
      if (row.children.length < 2) return null;
      raw.insertAdjacentElement('afterend', row);
    }
    return row;
  }
  function updateHome() {
    if (window.__kgtGen !== GEN) return;
    const row = homeRow();
    if (!row) {
      document.querySelectorAll('[data-kgt-effective-total]').forEach(el => el.remove());
      homeRequest++;
      homeFetchedAt = 0;
      return;
    }
    const key = String(typeof GM_getValue === 'function' ? GM_getValue('kgt_api_key','') : localStorage.getItem('kgt_api_key') || '').trim();
    if (!key) { row.children[1].textContent = 'Set API key in Gym Trainer'; return; }
    if (homeBusy || (homeFetchedAt && Date.now()-homeFetchedAt < 60000)) return;
    homeBusy = true;
    const current = ++homeRequest;
    GM_xmlhttpRequest({
      method:'GET', url:'https://api.torn.com/v2/user/battlestats?comment=KrakenGymTrainer',
      headers:{Authorization:'ApiKey '+key},timeout:15000,
      onload:r => {
        homeBusy = false;
        homeFetchedAt = Date.now();
        if (current !== homeRequest || window.__kgtGen !== GEN) return;
        const live = homeRow();
        if (!live) return;
        try {
          const d = JSON.parse(r.responseText);
          if (r.status !== 200 || d.error) throw new Error('API error');
          const stats = d.battlestats;
          if (!stats || !HOME_STATS.every(k => stats[k] &&
              Number.isFinite(Number(stats[k].value)) && Number.isFinite(Number(stats[k].modifier))))
            throw new Error('Stats unavailable');
          const total = HOME_STATS.reduce((sum,k) =>
            sum + Number(stats[k].value)*Math.max(0,1+Number(stats[k].modifier)/100),0);
          live.children[1].textContent = Math.round(total).toLocaleString();
          live.children[1].title = 'Current effective stats using Torn modifiers; updated ' + new Date().toLocaleTimeString();
        } catch (_) { live.children[1].textContent = 'Unavailable'; }
      },
      onerror:() => { homeBusy=false; homeFetchedAt=Date.now(); const live=homeRow(); if(live) live.children[1].textContent='Unavailable'; },
      ontimeout:() => { homeBusy=false; homeFetchedAt=Date.now(); const live=homeRow(); if(live) live.children[1].textContent='Unavailable'; }
    });
  }
  updateHome();
  setInterval(updateHome, 1500);
  function start() {
  const NAMES = ['strength', 'defense', 'speed', 'dexterity'];
  const LABEL = {strength:'Strength', defense:'Defense', speed:'Speed', dexterity:'Dexterity'};
  const get = (k, fallback) => typeof GM_getValue === 'function' ? GM_getValue(k, fallback) : localStorage.getItem(k) ?? fallback;
  const set = (k, value) => typeof GM_setValue === 'function' ? GM_setValue(k, value) : localStorage.setItem(k, value);
  const num = x => typeof x === 'number' ? x : Number(String(x ?? '').replace(/,/g, ''));
  const fmt = x => !Number.isFinite(x) ? 'unlimited' : x >= 1e12 ? (x / 1e12).toFixed(2) + 't' : x >= 1e9 ? (x / 1e9).toFixed(2) + 'b' : x >= 1e6 ? (x / 1e6).toFixed(2) + 'm' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : Math.floor(x).toLocaleString();
  const escape = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let last = null, busy = false, refreshTimer = null, activeTab = 'limits';
  const CSS = [
    '#kgt{box-sizing:border-box;background:#242424;color:#ddd;border:1px solid #444;border-radius:8px;padding:10px;margin:12px 0;font:13px/1.45 Arial,sans-serif;text-align:left}',
    '#kgt *{box-sizing:border-box}',
    '#kgt .kgt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}',
    '#kgt .kgt-title{color:#fff;font-size:15px;font-weight:bold}',
    '#kgt .kgt-refresh{background:#303030;color:#eee;border:1px solid #444;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;min-height:36px}',
    '#kgt .kgt-tabs{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}',
    '#kgt .kgt-tab{flex:1 1 auto;background:#303030;color:#bbb;border:1px solid #444;border-radius:6px;padding:9px 10px;font-size:13px;cursor:pointer;min-height:38px;min-width:64px;text-align:center}',
    '#kgt .kgt-tab[aria-selected="true"]{background:#3d3d3d;color:#fff;border-color:#8bbd42;font-weight:bold}',
    '#kgt [role="tabpanel"]{color:#ddd}',
    '#kgt h4{margin:10px 0 6px;font-size:13px;color:#aaa;font-weight:bold;text-transform:uppercase;letter-spacing:.4px}',
    '#kgt table{width:100%;border-collapse:collapse;background:#242424;color:#ddd;margin:0}',
    '#kgt tr{background:#242424;color:#ddd}',
    '#kgt th{background:#303030;color:#ccc;text-align:right;padding:7px 6px;border-bottom:1px solid #444;font-size:12px}',
    '#kgt td{background:#242424;color:#ddd;text-align:right;padding:7px 6px;border-bottom:1px solid #444}',
    '#kgt th:first-child,#kgt td:first-child{text-align:left;color:#fff}',
    '#kgt .kgt-good{color:#8bbd42 !important;background:#242424 !important}',
    '#kgt .kgt-warn{color:#e0a458 !important;background:#242424 !important}',
    '#kgt .kgt-bad{color:#d97066 !important;background:#242424 !important}',
    '#kgt .kgt-high{color:#7fb3e8 !important;background:#242424 !important}',
    '#kgt .kgt-card{background:#303030;border:1px solid #444;border-radius:6px;padding:8px 10px;margin:8px 0}',
    '#kgt .kgt-card .kgt-row{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #3a3a3a}',
    '#kgt .kgt-card .kgt-row:last-child{border-bottom:none}',
    '#kgt .kgt-card .kgt-row span:first-child{color:#aaa}',
    '#kgt .kgt-card .kgt-row span:last-child{color:#fff}',
    '#kgt .kgt-card .kgt-row span.kgt-bad{color:#d97066 !important}',
    '#kgt .kgt-card .kgt-row span.kgt-good{color:#8bbd42 !important}',
    '#kgt .kgt-card .kgt-row span.kgt-high{color:#7fb3e8 !important}',
    '#kgt .kgt-line{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap;padding:5px 0;border-bottom:1px solid #3a3a3a}',
    '#kgt .kgt-line .kgt-label{color:#fff}',
    '#kgt small{color:#999;display:block;margin-top:4px}',
    '#kgt label{display:block;margin:8px 0;color:#ccc}',
    '#kgt input{padding:8px;background:#1b1b1b;color:#fff;border:1px solid #555;border-radius:5px;width:100%;max-width:320px;font-size:14px}',
    '#kgt .kgt-ratios{background:#303030;border:1px solid #444;border-radius:6px;padding:8px 10px;margin:8px 0}',
    '#kgt .kgt-ratios label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0}',
    '#kgt .kgt-ratios input{width:90px;max-width:90px;padding:6px 8px;font-size:13px}',
    '#kgt .kgt-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}',
    '#kgt .kgt-legend span{font-size:11px}',
    '#kgt .kgt-goalerr{color:#d97066 !important;font-size:12px;margin:6px 0}',
    '#kgt button.kgt-btn{background:#303030;color:#fff;border:1px solid #555;border-radius:6px;padding:9px 14px;margin:6px 6px 0 0;cursor:pointer;font-size:13px;min-height:38px}',
    '#kgt .kgt-status{margin-top:8px;color:#999;font-size:12px}',
    '#kgt .kgt-status.kgt-bad{color:#d97066}'
  ].join('\n');
  const style = document.createElement('style');
  style.id = 'kgt-style';
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'kgt';
  panel.setAttribute('aria-label', 'Kraken Gym Trainer');
  panel.innerHTML =
    '<div class="kgt-head">' +
      '<span class="kgt-title">Kraken Gym Trainer</span>' +
      '<button type="button" class="kgt-refresh" data-action="refresh" data-testid="kgt-refresh">Refresh</button>' +
    '</div>' +
    '<div class="kgt-tabs" role="tablist">' +
      '<button type="button" class="kgt-tab" role="tab" id="kgt-tab-limits" aria-controls="kgt-panel-limits" aria-selected="true" data-tab="limits">Limits</button>' +
      '<button type="button" class="kgt-tab" role="tab" id="kgt-tab-stats" aria-controls="kgt-panel-stats" aria-selected="false" data-tab="stats">Stats</button>' +
      '<button type="button" class="kgt-tab" role="tab" id="kgt-tab-drugs" aria-controls="kgt-panel-drugs" aria-selected="false" data-tab="drugs">Effective stats</button>' +
      '<button type="button" class="kgt-tab" role="tab" id="kgt-tab-settings" aria-controls="kgt-panel-settings" aria-selected="false" data-tab="settings">Settings</button>' +
    '</div>' +
    '<div role="tabpanel" id="kgt-panel-limits" aria-labelledby="kgt-tab-limits" data-testid="kgt-panel-limits"></div>' +
    '<div role="tabpanel" id="kgt-panel-stats" aria-labelledby="kgt-tab-stats" data-testid="kgt-panel-stats" hidden></div>' +
    '<div role="tabpanel" id="kgt-panel-drugs" aria-labelledby="kgt-tab-drugs" data-testid="kgt-panel-drugs" hidden></div>' +
    '<div role="tabpanel" id="kgt-panel-settings" aria-labelledby="kgt-tab-settings" data-testid="kgt-panel-settings" hidden></div>' +
    '<div class="kgt-status" id="kgt-status" role="status"></div>';

  // Mount at the end of Torn's gym main content. The anchor is found from
  // the live DOM with layered fallbacks (specific gym heading block, any
  // gym content container, mainContainer, then body-end as last resort);
  // while it is missing we retry with bounded attempts. Never
  // document.body.prepend, never a fixed overlay, no infinite observers.
  // If Torn's SPA replaces the content node, the panel is detached; a
  // bounded re-mount poll reattaches the same panel (no duplicates).
  function findAnchor() {
    const main = document.getElementById('mainContainer');
    const scope = main || document.body;
    if (!scope) return null;
    // 1) End of the gym content block that contains the intro heading.
    const modalRoot = main && main.querySelector('[class*="toggleableContent___"]');
    if (modalRoot) {
      const doneTitle = Array.from(modalRoot.querySelectorAll('h5')).find(h => /energy per train|what would you like to train/i.test(h.textContent || ''));
      if (doneTitle && doneTitle.parentElement) return doneTitle.parentElement;
    }
    // 2) Any container showing gym evidence inside main.
    if (main) {
      const heading = Array.from(main.querySelectorAll('h5,h4,h2,h3')).find(h => /energy per train|what would you like to train/i.test(h.textContent || ''));
      if (heading && heading.parentElement) return heading.parentElement;
    }
    // 3) Fallbacks near gym content: main container or content root.
    const contentRoot = document.getElementById('contentRoot') || main || scope;
    return contentRoot === document.body ? null : contentRoot;
  }
  function mount() {
    if (panel.isConnected && panel.parentElement && panel.parentElement.isConnected) return;
    if (panel.isConnected) panel.remove(); // detached from live DOM (SPA swap) or stale
    // Guard against duplicate injections (script installed twice, stale SPA
    // closures): this panel wins, foreign #kgt nodes are removed.
    document.querySelectorAll('#kgt').forEach(p => { if (p !== panel) p.remove(); });
    const anchor = findAnchor();
    if (anchor) {
      if (anchor.parentElement) anchor.parentElement.insertBefore(panel, anchor.nextSibling);
      else anchor.appendChild(panel);
      return;
    }
    // Last-resort inline fallback at the end of body content (never prepend).
    if (document.body) document.body.appendChild(panel);
  }
  mount();
  panel.dataset.kgtInstance = INSTANCE;
  panel.dataset.kgtGen = String(GEN);
  let mountTries = 0;
  const mountPoll = setInterval(() => {
    if (newerInstancePanel()) { clearInterval(mountPoll); return; }
    // After an SPA navigation to an unrelated page, drop the panel until
    // gym content is back; DOM evidence (independent signals) decides.
    if (started && !isGymPage()) { if (panel.isConnected) panel.remove(); return; }
    if (!panel.isConnected || !panel.parentElement || !panel.parentElement.isConnected) mount();
    if (++mountTries >= 120) clearInterval(mountPoll);
  }, 1000);
  // SPA hook: the navigation handler re-mounts the same panel when the user
  // returns to the gym without a full reload.
  started = true;
  remountHook = () => { mountTries = 0; if (isGymPage()) mount(); };

  const bodyEl = id => panel.querySelector('#kgt-panel-' + id);
  const status = (s, cls = '') => {
    const e = panel.querySelector('#kgt-status');
    if (!e) return;
    e.className = 'kgt-status ' + cls;
    e.textContent = s;
  };

  function showTab(name) {
    activeTab = name;
    for (const tab of panel.querySelectorAll('.kgt-tab')) {
      tab.setAttribute('aria-selected', tab.dataset.tab === name ? 'true' : 'false');
    }
    for (const id of ['limits', 'stats', 'drugs', 'settings']) {
      const p = bodyEl(id);
      if (p) p.hidden = id !== name;
    }
    renderActive();
  }

  function renderActive() {
    if (activeTab === 'limits') renderLimits();
    else if (activeTab === 'stats') renderStats();
    else if (activeTab === 'drugs') renderDrugs();
    else renderSettings();
  }

  function request(url, headers) {return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url,headers,timeout:15000,onload:r=>{try{const d=JSON.parse(r.responseText);if(d.error) reject(new Error(d.error.error || 'API error'));else if(r.status!==200) reject(new Error('HTTP '+r.status));else resolve(d);}catch(e){reject(e)}},onerror:()=>reject(new Error('Network error')),ontimeout:()=>reject(new Error('API timed out'))}));}
  function limits(s) {
    // Headroom is the maximum extra whole raw stat points in ONE stat before
    // either actual 125% gym requirement fails. Frontline combines STR + SPD.
    const frontline = (s.strength+s.speed)/1.25-s.defense-s.dexterity;
    const isoCap = k => s.defense/1.25-s[k];
    const gymOpen = frontline >= 0 &&
      ['strength','speed','dexterity'].every(k=>isoCap(k)>=0);
    const out = {};
    for(const k of NAMES) {
      if(!gymOpen){out[k]={value:0, reason:'Restore gym requirements first'};continue;}
      const caps=[];
      if(k==='defense'||k==='dexterity') caps.push({value:frontline,reason:'Frontline Fitness'});
      if(k!=='defense') caps.push({value:isoCap(k),reason:"Mr. Isoyama's"});
      caps.sort((a,b)=>a.value-b.value);
      out[k]={value:Math.max(0,Math.floor(caps[0].value)),reason:caps[0].reason};
    }
    return {out,gymOpen};
  }
  function steadfast(perks) {
    const result={};
    for(const name of NAMES){
      const entries=(perks.faction_perks||[]).filter(p=>/steadfast/i.test(String(p)) && new RegExp(name,'i').test(String(p)));
      const numbers=entries.map(p=>String(p).match(/(?:\+\s*)?(\d+(?:\.\d+)?)\s*%/)).filter(Boolean).map(m=>Number(m[1]));
      result[name]=numbers.length ? Math.max(...numbers)+'%' : entries.length ? 'Active (rate unknown)' : '-';
    }
    return result;
  }
  // Passive combat-stat education bonuses only. Torn's wiki separates these
  // from gym-gain education; exclude gym gains, Steadfast, damage, accuracy
  // and unrelated perks. Per stat: an aggregated stat-level summary entry
  // ("Education: + 5% Strength") is authoritative and used once; otherwise
  // all distinct individual passive entries for that stat are SUMMED (a
  // multi-stat entry contributes to every named stat, so separate courses
  // combine). Exact duplicate strings are deduplicated; distinct entries
  // with the same percent are legitimate and both count. When
  // education_perks is absent the result is null ("Education unavailable");
  // when present but nothing applies, the result is 0.
  function educationPercents(payload) {
    const per = {};
    for (const k of NAMES) per[k] = null;
    if (!payload || !Array.isArray(payload.education_perks)) return per;
    const seen = new Set();
    const entries = [];
    for (const p of payload.education_perks) {
      const s = String(p);
      if (!seen.has(s)) { seen.add(s); entries.push(s); }
    }
    // Exclusion words: gym-gain education and unrelated combat perks.
    const EXCLUDE = /gym gain|gym gains|training gains|steadfast|damage|accuracy|critical|crime|nerve|medical|hospital|jail|bounty|life|energy|travel/i;
    const applicable = entries.filter(e => !EXCLUDE.test(e) && /educat|passive/i.test(e) && /(\d+(?:\.\d+)?)\s*%/.test(e));
    const pctOf = e => { const m = e.match(/(\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) : null; };
    const AGG = /^education\s*:/i;
    for (const k of NAMES) {
      const statRe = new RegExp('\\b' + LABEL[k] + '\\b', 'i');
      const agg = applicable.filter(e => AGG.test(e) && statRe.test(e)).map(pctOf).filter(v => v != null);
      if (agg.length) { per[k] = Math.max(...agg); continue; }
      let sum = 0, any = false;
      for (const e of applicable) {
        if (AGG.test(e) || !statRe.test(e)) continue;
        const p = pctOf(e);
        if (p != null) { sum += p; any = true; }
      }
      per[k] = any ? sum : 0;
    }
    return per;
  }
  // Read passive combat-stat modifiers from the user's own perks response.
  // Each source is kept separate so a gym-gain or conditional combat perk
  // cannot be mistaken for an unconditional stat increase.
  function passiveStatBonuses(payload) {
    const sources = {
      Education: ['education_perks'], Job: ['job_perks', 'company_perks'],
      Faction: ['faction_perks'], Merits: ['merit_perks'],
      Book: ['book_perks'], Other: ['property_perks', 'stock_perks']
    };
    const result = {}, conditional = [];
    const education = educationPercents(payload);
    const excluded = /gym|train(?:ing)? gains?|steadfast|damage|accuracy|critical|crime|nerve|medical|hospital|jail|bounty|life|energy|travel|working stats?|employee|opponent|enemy|escape attempt|runaway|addiction|side effects|happiness|weapon|armor sets?/i;
    const conditionalRe = /when |while |without |if |during |upon |chance|per hit|against /i;
    for (const [source, fields] of Object.entries(sources)) {
      const entries = [], seen = new Set();
      let known = false;
      for (const field of fields) {
        if (!Array.isArray(payload?.[field])) continue;
        known = true;
        for (const value of payload[field]) {
          const text = String(value).trim();
          const key = text.replace(/^\w+\s*:\s*/, '').toLowerCase().replace(/\s+/g, ' ');
          if (!seen.has(key)) { seen.add(key); entries.push(text); }
        }
      }
      result[source] = {known, values: {}, entries: []};
      for (const stat of NAMES) result[source].values[stat] = source === 'Education' ? education[stat] : known ? 0 : null;
      if (source === 'Education') continue; // Aggregate education summaries already handled above.
      for (const text of entries) {
        if (excluded.test(text)) continue;
        const pctMatch = text.match(/([+-]?\s*\d+(?:\.\d+)?)\s*%/);
        if (!pctMatch) continue;
        const all = /\ball\s+(?:battle\s+|fighting\s+)?stats\b/i.test(text);
        const targets = all ? NAMES : NAMES.filter(stat => new RegExp('\\b' + stat + '\\b', 'i').test(text));
        if (!targets.length) continue;
        // A number near a stat is not necessarily a passive stat bonus.
        if (!/passive|\bbonus\b|\bincreas|\bboost|^\s*(?:merit|book|faction|job|company)\s*:\s*\+/i.test(text)) continue;
        if (conditionalRe.test(text)) { conditional.push(source + ': ' + text); continue; }
        const pct = Number(pctMatch[1].replace(/\s/g, ''));
        if (!Number.isFinite(pct)) continue;
        for (const stat of targets) result[source].values[stat] += pct;
        result[source].entries.push(text);
      }
    }
    return {sources: result, conditional};
  }
  function gymLine(name, value, ratio) {
    return '<div class="kgt-line"><span class="kgt-label">' + escape(name) + '</span>' +
      '<span class="' + (value >= 0 ? 'kgt-good' : 'kgt-bad') + '">' + (value >= 0 ? 'Eligible' : 'Below requirement') +
      ' · ratio ' + (ratio * 100).toFixed(2) + '% (needs 125%)</span></div>';
  }
  function renderLimits() {
    const el = bodyEl('limits');
    if (!last) {
      el.innerHTML = '<h4>Specialist gym limits</h4><small>Load your stats with Refresh (Settings holds your API key) to see eligibility and safe gains.</small>';
      return;
    }
    const {s} = last, buffer=Math.max(0,Math.min(10,num(get('kgt_buffer','1'))||0));
    const {out,gymOpen}=limits(s), fRatio=(s.strength+s.speed)/(s.defense+s.dexterity),
      isoRatio=s.defense/Math.max(s.strength,s.speed,s.dexterity),
      warningRatio=1.25+buffer/100;
    const warnings=[];
    if(gymOpen && buffer>0 && fRatio<warningRatio) warnings.push('Frontline Fitness');
    if(gymOpen && buffer>0 && isoRatio<warningRatio) warnings.push("Mr. Isoyama's");
    el.innerHTML =
      '<h4>Specialist gyms</h4>' +
      gymLine('Frontline Fitness', fRatio - 1.25, fRatio) +
      gymLine("Mr. Isoyama's", isoRatio - 1.25, isoRatio) +
      '<small>Strength + Speed are counted together for Frontline Fitness. Actual eligibility and training limits use 125%; membership and unlocks are not checked.</small>' +
      (warnings.length ? '<small class="kgt-warn">Approaching the limit: ' + warnings.map(escape).join(', ') + ' is inside your ' + buffer + '% warning zone (below ' + (warningRatio*100).toFixed(1) + '%).</small>' : '') +
      (!gymOpen ? '<small>One or both gym requirements are not met by raw stats.</small>' : '') +
      '<h4>More raw stat points before a gym closes</h4>' +
      '<table><tbody>' +
      NAMES.map(k =>
        '<tr><td>' + LABEL[k] + '</td>' +
        '<td class="' + (!gymOpen || out[k].value <= 0 ? 'kgt-bad' : warnings.includes(out[k].reason) ? 'kgt-warn' : 'kgt-good') + '">' + out[k].value.toLocaleString() + '</td>' +
        '<td><small>' + escape(out[k].reason) + '</small></td></tr>'
      ).join('') +
      '</tbody></table>' +
      '<small>Each number is the maximum additional whole raw points in that stat, training one stat at a time, up to the calculated 125% limit. The ' + buffer + '% warning does not reduce these numbers. Gains are not energy or train counts; refresh after every train.</small>';
  }
  // Saved target share per stat, 0..100. Defaults 25/25/25/25.
  const TARGET_KEYS = {strength:'kgt_goal_strength', defense:'kgt_goal_defense', speed:'kgt_goal_speed', dexterity:'kgt_goal_dexterity'};
  const targetPct = k => {
    const raw = get(TARGET_KEYS[k], null);
    if (raw == null || String(raw).trim() === '') return 25;
    const v = num(raw);
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 25;
  };
  function renderStats() {
    const el = bodyEl('stats');
    if (!last) {
      el.innerHTML = '<h4>Raw battle stats</h4><small>Load your stats with Refresh to see raw stats, shares and Steadfast perks.</small>';
      return;
    }
    const {s, perks} = last, total = NAMES.reduce((a,k)=>a+s[k],0), sf = steadfast(perks);
    const targets = {}, deltas = {};
    for (const k of NAMES) {
      targets[k] = targetPct(k);
      deltas[k] = (100 * s[k] / total) - targets[k];
    }
    const cls = d => d < -5 ? 'kgt-bad' : d > 5 ? 'kgt-high' : 'kgt-good';
    const sign = d => (d > 0 ? '+' : '') + d.toFixed(2);
    el.innerHTML =
      '<h4>Raw battle stats</h4>' +
      '<table><thead><tr><th scope="col">Stat</th><th scope="col">Raw</th><th scope="col">Share</th><th scope="col">Steadfast</th></tr></thead><tbody>' +
      NAMES.map(k =>
        '<tr><td>' + LABEL[k] + '</td><td>' + fmt(s[k]) + '</td><td class="' + cls(deltas[k]) + '">' + (100 * s[k] / total).toFixed(2) + '%</td><td>' + escape(sf[k]) + '</td></tr>'
      ).join('') +
      '<tr><th scope="row">Total</th><th>' + fmt(total) + '</th><th>100%</th><th> </th></tr>' +
      '</tbody></table>' +
      '<h4>Ratios</h4>' +
      '<div class="kgt-ratios" data-testid="kgt-ratios">' +
        '<label>Strength <input type="number" min="0" max="100" step="0.01" data-goal="strength" data-testid="kgt-goal-strength" /></label>' +
        '<label>Defense <input type="number" min="0" max="100" step="0.01" data-goal="defense" data-testid="kgt-goal-defense" /></label>' +
        '<label>Speed <input type="number" min="0" max="100" step="0.01" data-goal="speed" data-testid="kgt-goal-speed" /></label>' +
        '<label>Dexterity <input type="number" min="0" max="100" step="0.01" data-goal="dexterity" data-testid="kgt-goal-dexterity" /></label>' +
        '<div class="kgt-legend"><span class="kgt-bad">below target &gt; 5 pts</span><span class="kgt-good">within 5 pts</span><span class="kgt-high">above target &gt; 5 pts</span></div>' +
        '<div id="kgt-goalerr" class="kgt-goalerr" role="alert" hidden></div>' +
        '<button type="button" class="kgt-btn" data-action="savegoals" data-testid="kgt-savegoals">Save goals</button>' +
      '</div>' +
      '<table data-testid="kgt-goals-table"><thead><tr><th scope="col">Stat</th><th scope="col">Share</th><th scope="col">Target</th><th scope="col">Deviation</th></tr></thead><tbody>' +
      NAMES.map(k =>
        '<tr><td>' + LABEL[k] + '</td>' +
        '<td>' + (100 * s[k] / total).toFixed(2) + '%</td>' +
        '<td>' + targets[k].toFixed(2) + '%</td>' +
        '<td class="' + cls(deltas[k]) + '">' + sign(deltas[k]) + ' pts</td></tr>'
      ).join('') +
      '</tbody></table>' +
      '<small>Default target is 25% per stat until you save your own. Deviation compares your current raw share with the target in percentage points.</small>';
    for (const k of NAMES) {
      const input = el.querySelector('[data-goal="' + k + '"]');
      input.value = String(targets[k]);
    }
  }
  function renderOfficialEffective() {
    const el = bodyEl('drugs'), stats = last.effective;
    const round = x => Math.round(x).toLocaleString();
    const line = (label,value) => '<div class="kgt-row"><span>' + escape(label) + '</span><span>' + escape(value) + '</span></div>';
    const totals = {raw:0,current:0,clean:0,xan:0,vic:0};
    const observedDrugs = NAMES.map(n => stats[n].modifiers.filter(m => /drug/i.test(String(m.type))).reduce((sum,m) => sum + Number(m.value), 0));
    const uniformXanax = observedDrugs.every(v => v === observedDrugs[0] && v >= -35 && v <= -20) ? observedDrugs[0] : -35;
    const cards = NAMES.map(k => {
      const d = stats[k], raw = Number(d.value), pct = Number(d.modifier);
      const drug = d.modifiers.filter(m => /drug/i.test(String(m.type))).reduce((sum,m) => sum + Number(m.value), 0);
      const clean = pct - drug;
      const val = p => raw * Math.max(0, 1 + p / 100);
      totals.raw += raw; totals.current += val(pct); totals.clean += val(clean);
      totals.xan += val(clean + uniformXanax); totals.vic += val(clean + 25);
      return '<div class="kgt-card" data-testid="kgt-drug-card">' +
        line(LABEL[k] + ' raw', round(raw)) +
        d.modifiers.map(m => line(String(m.type), (Number(m.value) >= 0 ? '+' : '') + Number(m.value) + '%')).join('') +
        line('Current modifier', (pct >= 0 ? '+' : '') + pct + '%') +
        line('Current effective', round(val(pct))) +
        line('Without current drug', round(val(clean))) +
        line('Xanax scenario', round(val(clean + uniformXanax))) +
        line('Vicodin scenario', round(val(clean + 25))) + '</div>';
    }).join('');
    el.innerHTML = '<h4>Effective stats (Torn modifiers)</h4>' + cards +
      '<div class="kgt-card" data-testid="kgt-drug-card">' +
      line('Total raw', round(totals.raw)) + line('Current effective', round(totals.current)) +
      line('Without current drug', round(totals.clean)) + line('Xanax scenario', round(totals.xan)) +
      line('Vicodin scenario', round(totals.vic)) + '</div>' +
      '<small>Current modifiers and their breakdown come directly from Torn. Scenarios replace only the current Drug modifier and retain other effects, including addiction. Xanax uses an observed uniform negative drug modifier when available (otherwise -35%); Vicodin assumes +25%. Future changes to addiction, faction mitigation and other effects may alter the scenarios.</small>';
  }
  function renderDrugs() {
    if (last?.effective) { renderOfficialEffective(); return; }
    const el = bodyEl('drugs');
    if (!last) {
      el.innerHTML = '<h4>Effective stats</h4><small>Load your stats with Refresh to see passive bonuses and drug estimates.</small>';
      return;
    }
    const {s, perks} = last, total = NAMES.reduce((a,k)=>a+s[k],0);
    const bonuses = passiveStatBonuses(perks);
    const categories = Object.keys(bonuses.sources);
    const row = (label, value, cls) =>
      '<div class="kgt-row"><span>' + label + '</span><span' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</span></div>';
    const sourcePct = (source, stat) => bonuses.sources[source].values[stat];
    const pctFor = stat => categories.reduce((sum, source) => sum + (sourcePct(source, stat) ?? 0), 0);
    const pctText = value => value == null ? 'Unavailable' : (value > 0 ? '+' : '') + value.toFixed(2).replace(/\.00$/, '') + '%';
    const card = (label, stat) => {
      const raw = s[stat], pct = pctFor(stat);
      const base = raw * Math.max(0, 1 + pct / 100);
      const xan = raw * Math.max(0, 1 + (pct - 35) / 100);
      const vic = raw * Math.max(0, 1 + (pct + 25) / 100);
      return '<div class="kgt-card" data-testid="kgt-drug-card">' +
        row(label, fmt(raw)) +
        categories.map(source => row(source, pctText(sourcePct(source, stat)))).join('') +
        row('Passive total', pctText(pct)) +
        row('Baseline', fmt(base)) +
        row('Xanax scenario', fmt(xan), 'kgt-bad') +
        row('Vicodin scenario', fmt(vic), 'kgt-good') +
      '</div>';
    };
    let cards = NAMES.map(k => card(LABEL[k], k)).join('');
    // Each stat has its own modifiers. Sum its resulting value for totals;
    // percentages across different stats cannot be added together.
    let baseTotal = 0, xanTotal = 0, vicTotal = 0;
    for (const k of NAMES) {
      const pct = pctFor(k);
      baseTotal += s[k] * Math.max(0, 1 + pct / 100);
      xanTotal += s[k] * Math.max(0, 1 + (pct - 35) / 100);
      vicTotal += s[k] * Math.max(0, 1 + (pct + 25) / 100);
    }
    cards += '<div class="kgt-card" data-testid="kgt-drug-card">' +
      row('Total', fmt(total)) +
      row('Passive increase', fmt(baseTotal - total)) +
      row('Baseline', fmt(baseTotal)) +
      row('Xanax scenario', fmt(xanTotal), 'kgt-bad') +
      row('Vicodin scenario', fmt(vicTotal), 'kgt-good') +
    '</div>';
    el.innerHTML = '<h4>Effective stats (estimates)</h4>' + cards +
      '<small>Calculated from the passive stat perks returned by Torn: education, job/company, faction, merits, book and other sources. Unavailable means that perk category was missing from the API response; its contribution is unknown. Xanax and Vicodin are separate additive scenarios on raw stats. Conditional effects, equipment, addiction and battle effects can change your actual combat stats.</small>' +
      (bonuses.conditional.length ? '<small>Conditional perk(s) not automatically applied: ' + bonuses.conditional.map(escape).join('; ') + '</small>' : '');
  }
  function renderSettings() {
    const el = bodyEl('settings');
    el.innerHTML =
      '<h4>Settings</h4>' +
      '<label>API key <input id="kgt-key" type="password" autocomplete="off" placeholder="Limited or higher key" data-testid="kgt-key" /></label>' +
      '<label>Early warning margin <input id="kgt-buffer" type="number" min="0" max="10" step="0.1" style="width:90px" data-testid="kgt-buffer" /> %</label>' +
      '<button type="button" class="kgt-btn" data-action="save" data-testid="kgt-save">Save and refresh</button>' +
      '<button type="button" class="kgt-btn" data-action="delete" data-testid="kgt-delete">Forget key</button>' +
      '<p><small>The key stays in this userscript local storage and is sent only to api.torn.com. Never share it with anyone. The warning starts this many percentage points above the actual 125% gym limit. It does not reduce the calculated raw stat headroom or predict the gain from a train.</small></p>';
    el.querySelector('#kgt-key').value = get('kgt_api_key', '');
    el.querySelector('#kgt-buffer').value = get('kgt_buffer', '1');
  }
  function saveGoals() {
    const el = bodyEl('stats');
    const err = el.querySelector('#kgt-goalerr');
    const vals = {};
    for (const k of NAMES) {
      const input = el.querySelector('[data-goal="' + k + '"]');
      const rawVal = String(input.value ?? '').trim();
      if (rawVal === '' || !/^-?\d+(\.\d+)?$/.test(rawVal)) {
        err.hidden = false;
        err.textContent = 'Every target needs a number. Empty or invalid fields are not saved.';
        return false;
      }
      const v = num(rawVal);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        err.hidden = false;
        err.textContent = 'Each target must be a number from 0 to 100.';
        return false;
      }
      vals[k] = v;
    }
    const sum = NAMES.reduce((a, k) => a + vals[k], 0);
    if (Math.abs(sum - 100) > 0.01) {
      err.hidden = false;
      err.textContent = 'Targets must total 100% (currently ' + sum.toFixed(2) + '%). Edits are kept so you can fix them.';
      return false;
    }
    for (const k of NAMES) set(TARGET_KEYS[k], String(vals[k]));
    err.hidden = true;
    err.textContent = '';
    status('Target ratios saved.');
    renderActive(); // re-render goals table with the new saved targets
    return true;
  }
  async function refresh() {
    const key = String(get('kgt_api_key', '')).trim();
    if (!key) { showTab('settings'); status('Enter your Torn API key to start.'); return; }
    if (busy) return;
    busy = true; status('Loading battle stats and perks...');
    try {
      const url = 'https://api.torn.com/user/?selections=battlestats,perks&key=' + encodeURIComponent(key) + '&comment=KrakenGymTrainer';
      const d = await request(url), s = {};
      for (const k of NAMES) {
        s[k] = num(d[k]);
        if (!Number.isFinite(s[k]) || s[k] < 0) throw new Error('API did not return valid ' + k + ' stats. Use a Limited or higher key.');
      }
      let effective = null;
      try {
        const exact = await request('https://api.torn.com/v2/user/battlestats?comment=KrakenGymTrainer', {'Authorization':'ApiKey ' + key});
        const bs = exact.battlestats;
        if (bs && NAMES.every(k => bs[k] && Number.isFinite(Number(bs[k].value)) &&
            Number.isFinite(Number(bs[k].modifier)) && Array.isArray(bs[k].modifiers) &&
            bs[k].modifiers.every(m => Number.isFinite(Number(m.value))))) effective = bs;
      } catch (_) { /* Keep the perk estimate when v2 is unavailable to this key. */ }
      last = {s, perks: d, effective};
      renderActive(); // keep the user's current tab; each tab re-renders live data
      status('Updated ' + new Date().toLocaleTimeString() + (effective ? ' · Torn modifier breakdown loaded.' : ' · Effective stats are estimates; exact modifiers unavailable.'));
    } catch (e) {
      status(e.message, 'kgt-bad');
      if (!last) renderActive();
    } finally {
      busy = false;
    }
  }
  panel.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { showTab(tab.dataset.tab); return; }
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (a === 'refresh') refresh();
    if (a === 'save') {
      const key = panel.querySelector('#kgt-key').value.trim(), buffer = num(panel.querySelector('#kgt-buffer').value);
      if (!key || !Number.isFinite(buffer) || buffer < 0 || buffer > 10) { status('Enter a key and a margin from 0 to 10%.', 'kgt-bad'); return; }
      set('kgt_api_key', key); set('kgt_buffer', String(buffer));
      status('Saved. Loading stats...');
      refresh();
    }
    if (a === 'savegoals') saveGoals();
    if (a === 'delete') { set('kgt_api_key', ''); last = null; showTab('settings'); status('Saved key removed.'); }
  });
  // Gym training is handled by Torn's own page; refresh after a successful interaction.
  document.addEventListener('click', e => {
    if (e.target.closest('#kgt')) return;
    if (!e.target.closest('button,[role="button"],input[type="submit"]')) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { if (get('kgt_api_key', '')) refresh(); }, 3500);
  }, true);
  if (get('kgt_api_key', '')) refresh(); else showTab('settings');
  }
})();
