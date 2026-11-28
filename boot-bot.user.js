// ==UserScript==
// @name         Boot Bot
// @namespace    kraken.bootbot
// @version      1.1.7
// @description  Daily faction member viability scan for Torn: activity, Donator status, Xanax use and ranked war respect. Notifications plus a history log for analysis.
// @author       -TheKraken- [3616083]
// @match        https://www.torn.com/*
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      api.torn.com
// @connect      discord.com
// @connect      discordapp.com
// @downloadURL  https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/boot-bot.user.js
// @updateURL    https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/boot-bot.user.js
// @run-at       document-end
// ==/UserScript==

/*
 * Boot Bot — Copyright (c) 2026 -TheKraken- [3616083]. All rights reserved.
 * This script is the intellectual property of -TheKraken-. It may not be copied,
 * modified, redistributed or sold without written permission.
 *
 * Data use: Boot Bot only talks to api.torn.com (and your own Discord webhook if you
 * turn that on). Your API key and the scan log are stored on this device only.
 */

(function () {
  'use strict';

  const VERSION = '1.1.7';
  const PREFIX = 'bootbot_';
  const TAB_ID = Math.random().toString(36).slice(2);
  const API_GAP_MS = 1100;          // ~55 calls/min, leaves headroom for War Room on the same key
  const LOCK_MS = 40 * 1000;        // another tab holding the scan lock within this window = skip
  const RESUME_MS = 6 * 3600 * 1000;// an unfinished scan younger than this resumes on next page

  // ───────────────────────── storage ─────────────────────────
  const S = {
    get(k, d) {
      try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; }
      catch (e) { console.warn('[Boot Bot] storage write failed', k, e); return false; }
    },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { /* ignore */ } },
  };

  const DEFAULTS = {
    apiKey: '',
    autoScan: true,
    scanHourTCT: 0,          // daily scan runs on the first page load after this TCT hour
    checkActive: true,
    inactiveHours: 24,
    checkDonator: true,
    checkXanax: true,
    minXanaxPerDay: 2,
    xanaxWindowDays: 1,      // 1 = last day; higher = average over N days
    checkWars: true,
    warHistory: 10,          // most recent completed ranked wars used for cumulative war respect
    minCriteria: 3,          // flag anyone meeting fewer than this many of the 4 criteria
    minLevel: 15,            // members below this level are listed separately, not judged
    activitySampling: true,  // hourly activity check while Torn is open (catches more 24h+ absences)
    exemptIds: '',
    notifyToast: true,
    notifyBrowser: true,
    notifyDiscord: false,
    discordWebhook: '',
    discordOnlyNew: false,
    logDays: 120,
  };
  const cfg = () => Object.assign({}, DEFAULTS, S.get('settings', {}));
  const saveCfg = (patch) => S.set('settings', Object.assign(cfg(), patch));

  // ───────────────────────── helpers ─────────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nowS = () => Math.floor(Date.now() / 1000);
  const tctDay = (ts) => new Date((ts || nowS()) * 1000).toISOString().slice(0, 10);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtN = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const fmtDT = (ts) => { const d = new Date(ts * 1000); return d.toISOString().slice(0, 16).replace('T', ' ') + ' TCT'; };
  const fmtHrs = (h) => (h == null ? '–' : h < 1 ? '<1h' : h < 48 ? Math.round(h) + 'h' : Math.round(h / 24) + 'd');
  const maskKey = (k) => (k ? '••••••••••••' + k.slice(-4) : 'none');
  const exemptSet = () => new Set(String(cfg().exemptIds || '').split(/[^0-9]+/).filter(Boolean).map(Number));

  function findDeep(obj, pred, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 6) return undefined;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const hit = pred(k, v, obj);
      if (hit !== undefined) return hit;
      if (v && typeof v === 'object') { const r = findDeep(v, pred, depth + 1); if (r !== undefined) return r; }
    }
    return undefined;
  }

  // ───────────────────────── Torn API ─────────────────────────
  class ApiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
  let lastCall = 0;
  let onApiWait = null;

  async function api(path, key) {
    key = key || cfg().apiKey;
    if (!key) throw new ApiError(2, 'No API key set');
    for (let attempt = 0; attempt < 7; attempt++) {
      const wait = lastCall + API_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      heartbeat();
      const url = 'https://api.torn.com/' + path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key) + '&comment=BootBot';
      let j;
      try {
        const r = await fetch(url);
        j = await r.json();
      } catch (e) {
        if (attempt < 3) { await sleep(3000 * (attempt + 1)); continue; }
        throw new ApiError(-1, 'Network error: ' + e.message);
      }
      if (j && j.error) {
        const code = j.error.code;
        if (code === 5 || code === 8 || code === 9 || code === 17) { // rate limit / temp block / API down / backend
          const back = Math.min(60000, 8000 * Math.pow(1.6, attempt));
          if (onApiWait) onApiWait(back);
          await sleep(back);
          continue;
        }
        throw new ApiError(code, j.error.error || 'API error ' + code);
      }
      return j;
    }
    throw new ApiError(5, 'Too many requests — gave up after retries');
  }

  // ───────────────────────── key handling ─────────────────────────
  function candidateKeys() {
    const out = [];
    const add = (k) => { if (k && /^[A-Za-z0-9]{16}$/.test(k) && /[A-Za-z]/.test(k) && /[0-9]/.test(k) && !out.includes(k)) out.push(k); };
    // Torn PDA replaces this placeholder with the PDA user's key
    add('###PDA-APIKEY###');
    // Keys stored by other Torn scripts (War Room etc.) in this site's localStorage
    try {
      const re = /(?:^|[^A-Za-z0-9])([A-Za-z0-9]{16})(?=[^A-Za-z0-9]|$)/g;
      for (let i = 0; i < localStorage.length; i++) {
        const name = localStorage.key(i);
        if (!name || name.startsWith(PREFIX)) continue;
        if (!/key|api|war|kraken|room|torn/i.test(name)) continue;
        const v = localStorage.getItem(name) || '';
        if (v.length > 50000) continue;
        let m; re.lastIndex = 0;
        while ((m = re.exec(v))) add(m[1]);
      }
    } catch (e) { /* ignore */ }
    return out.slice(0, 8);
  }

  // Returns {ok, factionId, factionName, reason}
  async function verifyKey(key) {
    try {
      const b = await api('v2/faction/basic', key);
      const basic = b.basic || b;
      const factionId = basic.id || basic.ID;
      if (!factionId) return { ok: false, reason: 'Key owner is not in a faction' };
      try {
        await api('v2/faction/attacks?limit=1', key);
      } catch (e) {
        return { ok: false, reason: 'No faction API access (needs AA permission + Limited/Full key)' };
      }
      return { ok: true, factionId, factionName: basic.name || 'Faction ' + factionId };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  async function autoDetectKey(statusCb) {
    const keys = candidateKeys();
    const cur = cfg().apiKey;
    if (cur && !keys.includes(cur)) keys.unshift(cur);
    if (!keys.length) return { ok: false, reason: 'No stored War Room key found on this device — paste it below once.' };
    for (const k of keys) {
      statusCb && statusCb('Checking key ' + maskKey(k) + '…');
      const v = await verifyKey(k);
      if (v.ok) {
        saveCfg({ apiKey: k });
        S.set('faction', { id: v.factionId, name: v.factionName });
        return Object.assign({ key: k }, v);
      }
    }
    return { ok: false, reason: 'Found ' + keys.length + ' stored key(s) but none has faction API access. Paste the War Room faction key below.' };
  }

  // ───────────────────────── data fetchers ─────────────────────────
  async function fetchMembers() {
    const j = await api('v2/faction/members?striptags=true');
    let list = j.members || [];
    if (!Array.isArray(list)) list = Object.keys(list).map((id) => Object.assign({ id: Number(id) }, list[id]));
    return list.map((m) => ({
      id: Number(m.id || m.player_id),
      name: m.name,
      level: m.level,
      position: m.position,
      daysInFaction: m.days_in_faction,
      lastAction: (m.last_action && (m.last_action.timestamp || m.last_action.time)) || null,
      lastStatus: m.last_action && m.last_action.status,
    })).filter((m) => m.id);
  }

  function parseXan(j) {
    if (!j) return null;
    const direct = findDeep(j, (k, v) => (k === 'xantaken' && typeof v === 'number' ? v : undefined));
    if (direct !== undefined) return direct;
    const arr = findDeep(j, (k, v, parent) => (parent && parent.name === 'xantaken' && k === 'value' && typeof v === 'number' ? v : undefined));
    if (arr !== undefined) return arr;
    const drugs = findDeep(j, (k, v) => (k === 'drugs' && v && typeof v.xanax === 'number' ? v.xanax : undefined));
    return drugs !== undefined ? drugs : null;
  }

  // overdose count (all drugs) — v1 personalstats.overdosed, v2 list item or drugs.overdoses
  function parseOD(j) {
    if (!j) return null;
    const direct = findDeep(j, (k, v) => (k === 'overdosed' && typeof v === 'number' ? v : undefined));
    if (direct !== undefined) return direct;
    const arr = findDeep(j, (k, v, parent) => (parent && parent.name === 'overdosed' && k === 'value' && typeof v === 'number' ? v : undefined));
    if (arr !== undefined) return arr;
    const drugs = findDeep(j, (k, v) => (k === 'drugs' && v && typeof v.overdoses === 'number' ? v.overdoses : undefined));
    return drugs !== undefined ? drugs : null;
  }

  function parseDonator(j) {
    if (!j) return null;
    const st = findDeep(j, (k, v) => (k === 'donator_status' ? (v || '') : undefined));
    if (st !== undefined) return { is: !!st, type: st || '' };
    const d = findDeep(j, (k, v) => (k === 'donator' && (typeof v === 'number' || typeof v === 'boolean') ? v : undefined));
    if (d !== undefined) return { is: !!d, type: d ? 'Donator' : '' };
    return null;
  }

  async function fetchMemberDetail(id) {
    let xan = null, don = null, od = null;
    try {
      const j = await api('user/' + id + '?selections=profile,personalstats');
      xan = parseXan(j.personalstats || j);
      od = parseOD(j.personalstats || j);
      don = parseDonator(j);
    } catch (e) { if (e.code === 2) throw e; }
    if (don == null) {
      try { don = parseDonator(await api('v2/user/' + id + '/profile')); } catch (e) { /* leave null */ }
    }
    if (xan == null) {
      try { const j = await api('v2/user/' + id + '/personalstats?stat=xantaken,overdosed'); xan = parseXan(j); if (od == null) od = parseOD(j); } catch (e) { /* leave null */ }
    }
    return { xan, don, od };
  }

  let histUnsupported = false;
  async function fetchHistoricXan(id, ts) {
    if (histUnsupported) return null;
    try {
      const j = await api('v2/user/' + id + '/personalstats?stat=xantaken,overdosed&timestamp=' + ts);
      const x = parseXan(j);
      return x == null ? null : { x, od: parseOD(j) };
    } catch (e) {
      if (e.code === 2) throw e;
      if ([6, 7, 16, 23].includes(e.code)) histUnsupported = true;
      return null;
    }
  }

  function normaliseWars(j) {
    let raw = j.rankedwars || j.wars || [];
    if (raw && !Array.isArray(raw) && raw.ranked) raw = [raw.ranked];
    if (!Array.isArray(raw)) raw = Object.keys(raw).map((id) => Object.assign({ id: Number(id) }, raw[id]));
    return raw.map((w) => {
      const inner = w.war || w;
      let factions = w.factions || [];
      if (!Array.isArray(factions)) factions = Object.keys(factions).map((id) => Object.assign({ id: Number(id) }, factions[id]));
      return {
        id: Number(w.id || w.war_id),
        start: Number(inner.start),
        end: inner.end ? Number(inner.end) : null,
        factions: factions.map((f) => ({ id: Number(f.id), name: f.name })),
      };
    }).filter((w) => w.id && w.start);
  }

  async function fetchWarList(factionId) {
    let wars = [];
    try { wars = normaliseWars(await api('v2/faction/rankedwars?limit=100&sort=DESC')); } catch (e) { if (e.code === 2) throw e; }
    if (!wars.length) {
      try { wars = normaliseWars(await api('faction/?selections=rankedwars')); } catch (e) { if (e.code === 2) throw e; }
    }
    const t = nowS();
    return wars
      .filter((w) => w.end && w.end < t)
      .sort((a, b) => b.end - a.end)
      .map((w) => {
        const enemy = w.factions.find((f) => f.id !== factionId) || {};
        return { id: w.id, start: w.start, end: w.end, enemyId: enemy.id, enemyName: enemy.name || ('Faction ' + enemy.id) };
      });
  }

  async function fetchAttacks(from, to, progress) {
    const seen = new Set();
    const out = [];
    let cursor = from, stuck = 0;
    for (let page = 0; page < 400; page++) {
      const j = await api('v2/faction/attacks?from=' + cursor + '&to=' + to + '&limit=100&sort=ASC');
      let arr = j.attacks || [];
      if (!Array.isArray(arr)) arr = Object.values(arr);
      let fresh = 0, maxT = cursor;
      for (const a of arr) {
        const key = [a.id || a.code, a.attacker && a.attacker.id, a.defender && a.defender.id, a.started].join('|');
        if (seen.has(key)) continue;
        seen.add(key); out.push(a); fresh++;
        const t = Number(a.started || a.timestamp_started || 0);
        if (t > maxT) maxT = t;
      }
      progress && progress(out.length);
      if (arr.length < 100 || fresh === 0) break;
      if (maxT === cursor) { if (++stuck > 1) { cursor += 1; stuck = 0; } } else { stuck = 0; cursor = maxT; }
    }
    return out;
  }

  const facOf = (side) => (side ? Number((side.faction && (side.faction.id || side.faction.faction_id)) || side.faction_id || 0) : 0);

  function aggregateWar(attacks, ourId, enemyId) {
    const per = {};
    const row = (id) => (per[id] = per[id] || { g: 0, l: 0, h: 0, d: 0 });
    for (const a of attacks) {
      const af = facOf(a.attacker), df = facOf(a.defender);
      if (af === ourId && df === enemyId) {
        const g = Number(a.respect_gain || 0);
        if (g > 0) { const r = row(a.attacker.id); r.g += g; r.h += 1; }
      } else if (df === ourId && af === enemyId && a.defender && a.defender.id) {
        const g = Number(a.respect_gain || 0);
        const l = Number(a.respect_loss || 0) || g;
        if (l > 0) { const r = row(a.defender.id); r.l += l; r.d += 1; }
      }
    }
    Object.values(per).forEach((r) => { r.g = Math.round(r.g * 100) / 100; r.l = Math.round(r.l * 100) / 100; });
    return per;
  }

  // ───────────────────────── persistent store ─────────────────────────
  // Everything bigger than a setting lives in IndexedDB: Torn's localStorage is shared with
  // Torn and other scripts and is often full.
  const IDB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(true);
      return new Promise((res) => {
        try {
          if (!window.indexedDB) return res(false);
          const r = indexedDB.open('bootbot', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => { this.db = r.result; res(true); };
          r.onerror = () => res(false);
          r.onblocked = () => res(false);
        } catch (e) { res(false); }
      });
    },
    get(k) {
      return new Promise((res) => {
        if (!this.db) return res(undefined);
        try { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }
        catch (e) { res(undefined); }
      });
    },
    put(k, v) {
      return new Promise((res) => {
        if (!this.db) return res(false);
        try {
          const tx = this.db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(v, k);
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
          tx.onabort = () => res(false);
        } catch (e) { res(false); }
      });
    },
  };

  const KV = {
    mem: {},
    async load(keys) {
      const ok = await IDB.open();
      for (const k of keys) {
        let v = ok ? await IDB.get(k) : undefined;
        if (v === undefined) v = S.get('kv_' + k, null);
        this.mem[k] = v === undefined ? null : v;
      }
    },
    get(k, d) { const v = this.mem[k]; return v == null ? d : v; },
    async set(k, v) {
      this.mem[k] = v;
      if (await IDB.put(k, v)) return true;
      return S.set('kv_' + k, v);
    },
  };

  async function loadStore() {
    await KV.load(['log', 'warCache', 'warList', 'scanState', 'inactive']);
    // migrate data saved by v1.0.x in localStorage
    const old = S.get('log', null);
    if (Array.isArray(old) && old.length) {
      const l = KV.get('log', []).slice();
      const have = new Set(l.map((x) => x.ts));
      old.forEach((x) => { if (!have.has(x.ts)) l.push(x); });
      l.sort((a, b) => a.ts - b.ts);
      if (await KV.set('log', l)) S.del('log');
    }
    S.del('warCache'); S.del('scanState');
  }

  const getLog = () => KV.get('log', []);
  async function saveLog(log) {
    const keepAfter = nowS() - cfg().logDays * 86400;
    log = log.filter((x) => x.ts >= keepAfter).slice(-400);
    return KV.set('log', log);
  }

  async function getWarHistory(factionId, n, status) {
    const list = await fetchWarList(factionId);
    await KV.set('warList', { fid: factionId, list: list.map((w) => ({ id: w.id, start: w.start, end: w.end, enemy: w.enemyName })) });
    const use = list.slice(0, n);
    const cache = Object.assign({}, KV.get('warCache', {}));
    for (let i = 0; i < use.length; i++) {
      const w = use[i];
      const ck = factionId + ':' + w.id;
      if (cache[ck]) continue;
      const label = 'War ' + (i + 1) + '/' + use.length + ' vs ' + w.enemyName;
      status && status(label + ': fetching attacks…');
      const attacks = await fetchAttacks(w.start, w.end, (c) => status && status(label + ': ' + c + ' attacks…'));
      cache[ck] = { war: w, per: aggregateWar(attacks, factionId, w.enemyId), count: attacks.length };
      const keys = Object.keys(cache);
      if (keys.length > 60) keys.sort((a, b) => cache[a].war.end - cache[b].war.end).slice(0, keys.length - 60).forEach((k) => delete cache[k]);
      await KV.set('warCache', cache);
    }
    return use.map((w) => w.id);
  }

  function xanaxRate(id, xanNow, ts, log, windowDays) {
    const target = ts - windowDays * 86400;
    let best = null;
    for (const snap of log) {
      if (snap.ts > ts - 12 * 3600) continue;          // need at least 12h of history
      const m = snap.m && snap.m[id];
      if (!m || m.x == null) continue;
      if (!best || Math.abs(snap.ts - target) < Math.abs(best.ts - target)) best = { ts: snap.ts, x: m.x, od: m.od };
    }
    if (!best) return null;
    return { days: (ts - best.ts) / 86400, x0: best.x, od0: best.od, src: 'log' };
  }

  // ───────────────────────── activity tally ─────────────────────────
  // Each time a member is seen inactive past the limit counts once (one absence = one tally,
  // however long it lasts). Hourly sampling while Torn is open catches absences between scans.
  let lastSampleMem = 0;
  async function recordActivity(members) {
    const c = cfg(); const ts = nowS(); const lim = Number(c.inactiveHours) * 3600;
    const inact = Object.assign({}, KV.get('inactive', {}));
    let changed = false;
    for (const m of members) {
      if (!m.lastAction || ts - m.lastAction <= lim) continue;
      const e = inact[m.id] ? Object.assign({}, inact[m.id]) : { n: m.name, eps: [] };
      e.n = m.name;
      e.eps = e.eps.slice();
      // same absence = same last-action time (allow a few seconds of drift)
      if (!e.eps.some((t) => Math.abs(t - m.lastAction) < 60)) { e.eps.push(m.lastAction); if (e.eps.length > 300) e.eps.shift(); changed = true; }
      inact[m.id] = e;
    }
    lastSampleMem = Date.now(); S.set('lastSample', lastSampleMem);
    if (changed) await KV.set('inactive', inact);
  }
  async function maybeSampleActivity() {
    const c = cfg();
    if (!c.activitySampling || !c.apiKey || scanning || lockedByOther()) return;
    const last = Math.max(lastSampleMem, S.get('lastSample', 0));
    if (Date.now() - last < 60 * 60 * 1000) return;
    lastSampleMem = Date.now();
    try { await recordActivity(await fetchMembers()); } catch (e) { console.warn('[Boot Bot] activity sample failed', e); }
  }
  const tallyOf = (id) => { const e = KV.get('inactive', {})[id]; return e ? e.eps.length : 0; };

  // ───────────────────────── scan ─────────────────────────
  let scanning = false;
  let lastLiveRender = 0;
  function heartbeat() { if (scanning) S.set('lock', { tab: TAB_ID, ts: Date.now() }); }
  function lockedByOther() { const l = S.get('lock', null); return l && l.tab !== TAB_ID && Date.now() - l.ts < LOCK_MS; }

  function shouldAutoScan() {
    const c = cfg();
    if (!c.autoScan || !c.apiKey) return false;
    const today = tctDay();
    if (S.get('lastAutoDay', '') === today) return false;
    return new Date().getUTCHours() >= Number(c.scanHourTCT || 0);
  }

  async function runScan(manual) {
    if (scanning) return;
    if (lockedByOther()) { setStatus('Another Torn tab is scanning…'); return; }
    const c = cfg();
    if (!c.apiKey) { setStatus('Set the faction API key in Settings first.'); return; }
    scanning = true; heartbeat(); histUnsupported = false;
    onApiWait = (ms) => setStatus('Torn API busy — waiting ' + Math.round(ms / 1000) + 's…');
    refreshIcon();
    try {
      await KV.load(['scanState', 'log', 'warCache', 'inactive']); // another tab may have moved things on
      let st = KV.get('scanState', null);
      if (!st || st.v !== 2 || Date.now() - st.started > RESUME_MS) {
        setStatus('Loading faction…');
        const b = await api('v2/faction/basic');
        const basic = b.basic || b;
        S.set('faction', { id: basic.id, name: basic.name });
        setStatus('Loading members…');
        const members = await fetchMembers();
        await recordActivity(members);
        st = { v: 2, started: Date.now(), manual: !!manual, factionId: Number(basic.id), factionName: basic.name, members, details: {}, warIds: [], warsDone: false };
        await KV.set('scanState', st);
      } else {
        setStatus('Resuming scan…');
      }

      if (!st.warsDone) {
        if (c.checkWars) st.warIds = await getWarHistory(st.factionId, Math.min(50, Math.max(1, Number(c.warHistory) || 10)), setStatus);
        st.warsDone = true;
        await KV.set('scanState', st);
      }

      const log = getLog().slice();
      const ts = nowS();
      const todo = st.members.filter((m) => !st.details[m.id]);
      let done = st.members.length - todo.length;
      for (const m of todo) {
        setStatus('Checking ' + m.name + ' (' + (done + 1) + '/' + st.members.length + ')');
        const d = await fetchMemberDetail(m.id);
        let rate = null;
        if (d.xan != null) {
          const win = Number(c.xanaxWindowDays) || 1;
          let base = xanaxRate(m.id, d.xan, ts, log, win);
          // the log only helps once it covers the whole window; until then ask Torn for the history
          if (c.checkXanax && (!base || base.days < win * 0.8)) {
            const old = await fetchHistoricXan(m.id, ts - win * 86400);
            if (old != null) base = { days: win, x0: old.x, od0: old.od, src: 'hist' };
          }
          if (base) {
            // each overdose in the window takes a day out of the time measured
            const ods = d.od != null && base.od0 != null ? Math.max(0, d.od - base.od0) : 0;
            const eff = base.days - ods;
            rate = eff >= 0.5
              ? { rate: (d.xan - base.x0) / eff, days: base.days, eff, ods, src: base.src }
              : { rate: null, days: base.days, eff: 0, ods, src: base.src, odBlock: 1 };
          }
        }
        st.details[m.id] = { xan: d.xan, don: d.don, od: d.od, rate };
        await KV.set('scanState', st);
        done++;
        refreshIcon(Math.round((done / st.members.length) * 100));
        if (panelOpen() && tab === 'report' && Date.now() - lastLiveRender > 2500) { lastLiveRender = Date.now(); render(); }
      }

      const snap = buildSnapshot(st, ts);
      const prev = log.length ? log[log.length - 1] : null;
      log.push(snap);
      await KV.set('scanState', null);
      const saved = await saveLog(log);
      S.set('lastAutoDay', tctDay(ts)); // a manual scan also counts as today's scan
      setStatus('Scan complete — ' + snap.flagged + ' flagged of ' + snap.judged + '.' + (saved ? '' : ' ⚠ Could not save to the log on this device — results shown for this session only.'));
      await notify(snap, prev);
      S.del('viewTs');
      if (panelOpen()) render();
    } catch (e) {
      console.error('[Boot Bot]', e);
      S.set('scanBackoff', Date.now() + ([1, 2, 10, 13, 16, 18].includes(e.code) ? 3600 : 60) * 1000);
      setStatus('Scan stopped: ' + e.message + (e.code === 2 ? ' — check the key in Settings.' : ' — it will resume on the next page.'));
    } finally {
      scanning = false; onApiWait = null;
      S.del('lock');
      refreshIcon();
    }
  }

  const CRIT = ['A', 'D', 'X', 'W'];
  function buildSnapshot(st, ts) {
    const c = cfg();
    const exempt = exemptSet();
    const cache = KV.get('warCache', {});
    const wars = (st.warIds || []).map((id) => cache[st.factionId + ':' + id]).filter(Boolean);
    const allWars = (KV.get('warList', { list: [] }).list) || [];
    const minLv = Number(c.minLevel) || 0;
    const need = Math.min(4, Math.max(1, Number(c.minCriteria) || 3));
    const m = {};
    let flagged = 0, judged = 0;
    for (const mem of st.members) {
      const d = st.details[mem.id] || {};
      const joined = mem.daysInFaction != null ? ts - mem.daysInFaction * 86400 : 0;
      const inactiveH = mem.lastAction ? (ts - mem.lastAction) / 3600 : null;
      let wg = 0, wl = 0, wh = 0, wd = 0, wi = 0, wp = 0, wpos = 0, wneg = 0, wnull = 0, pctSum = 0, pctN = 0;
      for (const w of wars) {
        if (joined > w.war.end) continue;
        wi++;
        const r = w.per[mem.id];
        if (r) { wg += r.g; wl += r.l; wh += r.h; wd += r.d; if (r.h > 0) wp++; }
        const wn = r ? Math.round((r.g - r.l) * 100) / 100 : 0;
        if (wn > 0) wpos++; else if (wn < 0) wneg++; else wnull++;
        if (r && r.g + r.l > 0) { pctSum += r.g / (r.g + r.l); pctN++; }
      }
      const wj = allWars.filter((w) => w.end >= joined).length;
      const f = [];
      const pend = [];
      if (c.checkActive && inactiveH != null && inactiveH > Number(c.inactiveHours)) f.push('A');
      if (c.checkDonator) { if (d.don == null) pend.push('D'); else if (!d.don.is) f.push('D'); }
      if (c.checkXanax) {
        if (!d.rate || d.rate.rate == null) pend.push('X');
        else if (d.rate.rate + 1e-9 < Number(c.minXanaxPerDay)) f.push('X');
      }
      if (c.checkWars && wi > 0 && !(wg > wl)) f.push('W');
      const ul = mem.level != null && mem.level < minLv ? 1 : 0;
      const ex = exempt.has(mem.id) ? 1 : 0;
      const met = CRIT.length - f.length; // disabled or not-yet-known criteria count as met
      const fl = !ul && !ex && met < need ? 1 : 0;
      if (!ul) judged++;
      if (fl) flagged++;
      m[mem.id] = {
        n: mem.name, lv: mem.level, p: mem.position, dif: mem.daysInFaction,
        la: mem.lastAction, ih: inactiveH == null ? null : Math.round(inactiveH * 10) / 10,
        dn: d.don ? (d.don.is ? 1 : 0) : null, dt: d.don ? d.don.type : '',
        x: d.xan, od: d.od == null ? null : d.od, xo: d.rate ? d.rate.ods || 0 : 0,
        xr: d.rate && d.rate.rate != null ? Math.round(d.rate.rate * 100) / 100 : null, xd: d.rate ? Math.round(d.rate.days * 10) / 10 : null, xs: d.rate ? d.rate.src : '',
        wg: Math.round(wg * 100) / 100, wl: Math.round(wl * 100) / 100, wh, wd, wi, wp, wj, wpos, wneg, wnull, wav: pctN ? Math.round((pctSum / pctN) * 10000) / 10000 : null, wavn: pctN,
        it: tallyOf(mem.id),
        f, pd: pend, met, fl, ul, ex,
      };
    }
    return {
      v: 2, ts, day: tctDay(ts), manual: !!st.manual, fid: st.factionId, fname: st.factionName,
      count: st.members.length, judged, flagged,
      wars: wars.map((w) => ({ id: w.war.id, end: w.war.end, enemy: w.war.enemyName })),
      rules: { ih: c.inactiveHours, mx: c.minXanaxPerDay, xw: c.xanaxWindowDays, need, minLv, cA: c.checkActive, cD: c.checkDonator, cX: c.checkXanax, cW: c.checkWars },
      m,
    };
  }

  // v1.0.x snapshots don't have the newer fields; fill them so old scans still display
  function normSnap(s) {
    if (!s || s.v === 2) return s;
    for (const id of Object.keys(s.m)) {
      const r = s.m[id];
      if (r.met == null) r.met = CRIT.length - r.f.length;
      if (r.fl == null) r.fl = r.f.length >= 2 ? 1 : 0;
      if (r.ul == null) r.ul = r.lv != null && r.lv < (Number(cfg().minLevel) || 0) ? 1 : 0;
    }
    if (s.judged == null) s.judged = Object.values(s.m).filter((r) => !r.ul).length;
    s.flagged = Object.values(s.m).filter((r) => r.fl).length;
    s.v = 2;
    return s;
  }

  // ───────────────────────── notifications ─────────────────────────
  const REASON = { A: 'Inactive', D: 'No Donator', X: 'Low Xanax', W: 'War respect' };
  function reasonText(r, code) {
    if (code === 'A') return 'Inactive ' + fmtHrs(r.ih);
    if (code === 'D') return 'No Donator/Sub';
    if (code === 'X') return 'Xanax ' + fmtN(r.xr, 1) + '/day';
    if (code === 'W') return 'War ' + fmtN(r.wg, 1) + ' gained / ' + fmtN(r.wl, 1) + ' lost';
    return code;
  }

  async function notify(snap, prev) {
    const c = cfg();
    const flaggedIds = Object.keys(snap.m).filter((id) => snap.m[id].fl);
    const newIds = flaggedIds.filter((id) => !(prev && prev.m && prev.m[id] && (prev.m[id].fl != null ? prev.m[id].fl : prev.m[id].f.length >= 2)));
    const msg = flaggedIds.length + ' of ' + snap.judged + ' members flagged' + (prev ? ' (' + newIds.length + ' new)' : '');
    if (c.notifyToast) toast('👢 Boot Bot: ' + msg, 8000);
    if (c.notifyBrowser && flaggedIds.length) {
      try {
        if (typeof GM_notification === 'function') GM_notification({ title: 'Boot Bot', text: msg, timeout: 15000 });
        else if (window.Notification && Notification.permission === 'granted') new Notification('Boot Bot', { body: msg });
      } catch (e) { /* ignore */ }
    }
    if (c.notifyDiscord && c.discordWebhook) {
      const ids = c.discordOnlyNew ? newIds : flaggedIds;
      if (ids.length || !c.discordOnlyNew) {
        const lines = ids
          .map((id) => Object.assign({ id }, snap.m[id]))
          .sort((a, b) => a.met - b.met)
          .map((r) => '• **' + r.n + '** [' + r.id + '] — meets ' + r.met + '/4 — ' + r.f.map((code) => reasonText(r, code)).join(', '));
        const head = '👢 **Boot Bot — ' + (snap.fname || 'Faction') + ' daily scan ' + snap.day + '**\n' + msg + '\n';
        await postDiscord(c.discordWebhook, head, lines);
      }
    }
  }

  function httpPost(url, body) {
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((res) => {
        try {
          GM_xmlhttpRequest({ method: 'POST', url, headers: { 'Content-Type': 'application/json' }, data: body,
            onload: (r) => res(r.status >= 200 && r.status < 300), onerror: () => res(false), ontimeout: () => res(false) });
        } catch (e) { res(false); }
      });
    }
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then((r) => r.ok).catch(() => false);
  }

  async function postDiscord(url, head, lines) {
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) return false;
    const chunks = [];
    let cur = head;
    for (const l of lines) {
      if ((cur + l + '\n').length > 1900) { chunks.push(cur); cur = ''; }
      cur += l + '\n';
    }
    chunks.push(cur);
    let ok = true;
    for (const ch of chunks.slice(0, 8)) {
      ok = (await httpPost(url, JSON.stringify({ username: 'Boot Bot', content: ch }))) && ok;
      await sleep(600);
    }
    return ok;
  }

  // ───────────────────────── export ─────────────────────────
  function csvCell(v) { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function snapCSV(snaps) {
    const head = ['Scan date (TCT)', 'Member', 'ID', 'Position', 'Level', 'Under level', 'Days in faction', 'Last action (TCT)', 'Inactive hrs', 'Times inactive 24h+',
      'Donator', 'Donator type', 'Xanax total', 'Xanax/day', 'Xanax window days', 'Overdoses in window (days excluded)',
      'War respect gained', 'War respect lost', 'War net', 'Wars positive', 'Wars negative', 'Wars null', 'Avg war % vs break-even', 'Wars in avg', 'War hits', 'Wars measured', 'Wars fought in', 'Wars since joining',
      'Criteria met', 'Failed', 'Flagged', 'Exempt'];
    const rows = [head];
    for (const s0 of snaps) {
      const s = normSnap(s0);
      for (const id of Object.keys(s.m)) {
        const r = s.m[id];
        rows.push([fmtDT(s.ts), r.n, id, r.p, r.lv, r.ul ? 'Yes' : '', r.dif, r.la ? fmtDT(r.la) : '', r.ih, r.it == null ? '' : r.it,
          r.dn == null ? '?' : r.dn ? 'Yes' : 'No', r.dt, r.x, r.xr, r.xd, r.xo || 0,
          r.wg, r.wl, Math.round((r.wg - r.wl) * 100) / 100, r.wpos == null ? '' : r.wpos, r.wneg == null ? '' : r.wneg, r.wnull == null ? '' : r.wnull, r.wav == null ? '' : Math.round((r.wav - 0.5) * 2000) / 10, r.wavn == null ? '' : r.wavn, r.wh, r.wi, r.wp == null ? '' : r.wp, r.wj == null ? '' : r.wj,
          r.met, r.f.map((c) => REASON[c]).join('; '), r.fl ? 'Yes' : '', r.ex ? 'Yes' : '']);
      }
    }
    return rows.map((r) => r.map(csvCell).join(',')).join('\n');
  }

  function gmDownload(url, name) {
    return new Promise((res) => {
      if (typeof GM_download !== 'function') return res(false);
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; res(v); } };
      try { GM_download({ url, name, onload: () => done(true), onerror: () => done(false), ontimeout: () => done(false) }); }
      catch (e) { done(false); }
      setTimeout(() => done(false), 6000);
    });
  }

  async function exportCSV(name, csv) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    try {
      if (await gmDownload(url, name)) { toast('Saved ' + name); return; }
      try {
        const file = new File([blob], name, { type: 'text/csv' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      try {
        const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        toast('Download started: ' + name); return;
      } catch (e) { /* fall through */ }
      try { await navigator.clipboard.writeText(csv); toast('Copied CSV to clipboard'); } catch (e) { toast('Export failed on this device'); }
    } finally { setTimeout(() => URL.revokeObjectURL(url), 30000); }
  }

  // ───────────────────────── UI ─────────────────────────
  const CSS = `
  #bb-icon{position:fixed;z-index:999998;width:46px;height:46px;border-radius:50%;background:#14181f;border:2px solid #c0392b;
    display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.6);user-select:none;touch-action:none}
  #bb-icon .bb-badge{position:absolute;top:-6px;right:-6px;background:#c0392b;color:#fff;font:bold 11px/18px Arial;min-width:18px;height:18px;border-radius:9px;text-align:center;padding:0 4px}
  #bb-icon .bb-prog{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);font:bold 10px Arial;color:#e8e8e8;background:#14181f;padding:0 3px;border-radius:3px}
  #bb-panel{position:fixed;z-index:999999;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,96vw);height:min(86vh,760px);
    background:#14181f;color:#e6e6e6;border:1px solid #2c3340;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.7);display:flex;flex-direction:column;font:13px Arial,sans-serif}
  #bb-panel *{box-sizing:border-box}
  #bb-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#0d1015;border-bottom:1px solid #2c3340;border-radius:10px 10px 0 0;cursor:move}
  #bb-head b{font-size:15px;flex:1}#bb-head small{color:#8a93a3}
  .bb-x{background:none;border:none;color:#e6e6e6;font-size:20px;cursor:pointer;padding:0 4px}
  #bb-tabs{display:flex;border-bottom:1px solid #2c3340}
  #bb-tabs button{flex:1;background:none;border:none;color:#8a93a3;padding:9px 0;font-weight:bold;cursor:pointer;border-bottom:2px solid transparent}
  #bb-tabs button.on{color:#fff;border-bottom-color:#c0392b}
  #bb-status{padding:6px 12px;color:#9fb3c8;font-size:12px;border-bottom:1px solid #222833;min-height:26px}
  #bb-body{flex:1;overflow:auto;padding:10px 12px}
  .bb-btn{background:#232a36;color:#e6e6e6;border:1px solid #39424f;border-radius:6px;padding:7px 11px;cursor:pointer;font-weight:bold}
  .bb-btn.red{background:#7d1f17;border-color:#c0392b}.bb-btn:disabled{opacity:.5}
  .bb-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
  .bb-chip{padding:4px 9px;border-radius:12px;background:#232a36;border:1px solid #39424f;cursor:pointer;font-size:12px}
  .bb-chip.on{background:#c0392b;border-color:#c0392b;color:#fff}
  .bb-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
  .bb-box{background:#1b212b;border:1px solid #1b212b;border-radius:6px;padding:7px 4px;text-align:center;cursor:pointer;font-size:11px;color:#9aa4b4}
  .bb-box b{display:block;font-size:17px;color:#fff}
  .bb-box.on{border-color:#c0392b;background:#2a1a1a;color:#fff}
  .bb-box.red b{color:#ff8a7a}
  .bb-sec{font-weight:bold;color:#fff;margin:4px 0 8px;font-size:14px}
  .bb-card{background:#1b212b;border-left:4px solid #27ae60;border-radius:6px;padding:8px 10px;margin-bottom:6px}
  .bb-card.fl{border-left-color:#c0392b;background:#221a1d}.bb-card.warn{border-left-color:#e67e22}.bb-card.ul{border-left-color:#5d6d7e}
  .bb-card .top{display:flex;gap:6px;align-items:baseline}
  .bb-card .rk{color:#8a93a3;font-weight:bold;min-width:26px}
  .bb-card .nm{font-weight:bold;color:#fff;cursor:pointer;text-decoration:underline dotted}
  .bb-card .net{margin-left:auto;font-weight:bold;white-space:nowrap}
  .pos{color:#58d68d}.neg{color:#ff8a7a}
  .bb-card .meta{color:#8a93a3;font-size:12px;margin-top:3px;line-height:1.5}
  .bb-tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:4px;margin:3px 4px 0 0;background:#5a1d17;color:#ffb3a8}
  .bb-tag.p{background:#2f3a4a;color:#b9c7d8}.bb-tag.ok{background:#1d4a2e;color:#a9e8bf}.bb-tag.fl{background:#c0392b;color:#fff;font-weight:bold}
  .bb-tbl{width:100%;border-collapse:collapse;font-size:12px}#bb-panel .bb-tbl td{color:#d2c2ff}
  #bb-panel .bb-tbl td.pos,#bb-panel .bb-tbl .pos{color:#58d68d}#bb-panel .bb-tbl td.neg,#bb-panel .bb-tbl .neg{color:#ff8a7a}#bb-panel .bb-tbl td.bb-muted{color:#9a8fbf}.bb-tbl th,.bb-tbl td{padding:5px 4px;border-bottom:1px solid #262d38;text-align:left}
  .bb-tbl th{color:#8a93a3;cursor:pointer;position:sticky;top:-10px;background:#14181f}.bb-tbl td.n{text-align:right}
  .bb-tbl tr.click{cursor:pointer}.bb-tbl tr.click:hover{background:#1b212b}
  .bb-set{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #222833;gap:10px}
  .bb-set label{flex:1}.bb-set small{display:block;color:#8a93a3}
  .bb-set input[type=text],.bb-set input[type=number],.bb-set input[type=password]{background:#0d1015;color:#e6e6e6;border:1px solid #39424f;border-radius:5px;padding:6px;width:140px}
  .bb-set input.wide{width:100%}
  .bb-sw{position:relative;width:44px;height:24px;flex:0 0 44px;cursor:pointer}
  .bb-sw input{display:none}.bb-sw span{position:absolute;inset:0;background:#7d1f17;border-radius:12px;transition:.2s}
  .bb-sw span:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
  .bb-sw input:checked+span{background:#1e8449}.bb-sw input:checked+span:before{transform:translateX(20px)}
  .bb-h{font-weight:bold;color:#c0392b;margin:12px 0 4px;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
  #bb-modal{position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;border-radius:10px}
  #bb-modal>div{background:#14181f;border:1px solid #39424f;border-radius:8px;width:96%;max-height:92%;overflow:auto;padding:12px}
  .bb-kv{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0 10px}
  .bb-kv div{background:#1b212b;border-radius:6px;padding:6px;text-align:center;font-size:11px;color:#9aa4b4}.bb-kv b{display:block;font-size:15px;color:#fff}
  .bb-toast{position:fixed;z-index:1000000;left:50%;bottom:70px;transform:translateX(-50%);background:#0d1015;color:#fff;border:1px solid #c0392b;
    padding:10px 14px;border-radius:8px;font:13px Arial;box-shadow:0 4px 14px rgba(0,0,0,.6);max-width:90vw}
  .bb-muted{color:#8a93a3;font-size:12px}
  `;

  let rankBy = S.get('rankBy', 'win');
  let tab = 'report', filter = 'all', statusText = '', sortKey = 'flag', sortDir = -1, period = 30;

  function toast(msg, ms) {
    const t = document.createElement('div'); t.className = 'bb-toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 3500);
  }
  function setStatus(s) { statusText = s; S.set('status', { t: s, ts: Date.now() }); const el = document.getElementById('bb-status'); if (el) el.textContent = s; }
  const panelOpen = () => !!document.getElementById('bb-panel');

  function makeDraggable(el, handle, storeKey, onTap) {
    let sx, sy, ox, oy, moved = false, down = false;
    const start = (x, y) => { down = true; moved = false; sx = x; sy = y; const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; };
    const move = (x, y, e) => {
      if (!down) return;
      if (Math.abs(x - sx) + Math.abs(y - sy) > 6) moved = true;
      if (!moved) return;
      e && e.preventDefault();
      el.style.transform = 'none';
      el.style.left = Math.max(0, Math.min(window.innerWidth - 40, ox + x - sx)) + 'px';
      el.style.top = Math.max(0, Math.min(window.innerHeight - 40, oy + y - sy)) + 'px';
    };
    const end = () => {
      if (!down) return; down = false;
      if (moved) { if (storeKey) S.set(storeKey, { l: el.style.left, t: el.style.top }); }
      else if (onTap) onTap();
    };
    handle.addEventListener('mousedown', (e) => { if (e.target.closest('button,input')) return; start(e.clientX, e.clientY); });
    window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY, e));
    window.addEventListener('mouseup', end);
    handle.addEventListener('touchstart', (e) => { if (e.target.closest('button,input')) return; const t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
    handle.addEventListener('touchmove', (e) => { const t = e.touches[0]; move(t.clientX, t.clientY, e); }, { passive: false });
    handle.addEventListener('touchend', end);
  }

  function buildIcon() {
    if (document.getElementById('bb-icon')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const ic = document.createElement('div'); ic.id = 'bb-icon'; ic.title = 'Boot Bot';
    ic.innerHTML = '👢<span class="bb-badge" style="display:none"></span><span class="bb-prog" style="display:none"></span>';
    const pos = S.get('iconPos', null);
    if (pos) { ic.style.left = pos.l; ic.style.top = pos.t; } else { ic.style.right = '12px'; ic.style.bottom = '150px'; }
    document.body.appendChild(ic);
    makeDraggable(ic, ic, 'iconPos', () => (panelOpen() ? closePanel() : openPanel()));
    refreshIcon();
  }

  function refreshIcon(pct) {
    const ic = document.getElementById('bb-icon'); if (!ic) return;
    const log = getLog(); const last = normSnap(log[log.length - 1]);
    const b = ic.querySelector('.bb-badge'), p = ic.querySelector('.bb-prog');
    if (last && last.flagged) { b.style.display = ''; b.textContent = last.flagged; } else b.style.display = 'none';
    if (scanning) { p.style.display = ''; p.textContent = pct != null ? pct + '%' : '…'; } else p.style.display = 'none';
  }

  function openPanel() {
    if (panelOpen()) return;
    const p = document.createElement('div'); p.id = 'bb-panel';
    p.innerHTML = `<div id="bb-head"><b>👢 Boot Bot</b><small>v${VERSION}</small><button class="bb-x" data-a="close" title="Minimise">–</button></div>
      <div id="bb-tabs"><button data-t="report">Report</button><button data-t="log">Log</button><button data-t="settings">Settings</button></div>
      <div id="bb-status"></div><div id="bb-body"></div>`;
    document.body.appendChild(p);
    const pos = S.get('panelPos', null);
    if (pos && window.innerWidth > 700) { p.style.transform = 'none'; p.style.left = pos.l; p.style.top = pos.t; }
    makeDraggable(p, p.querySelector('#bb-head'), 'panelPos');
    p.addEventListener('click', onClick);
    p.addEventListener('change', onChange);
    render();
    loadStore().then(() => { if (panelOpen()) render(); refreshIcon(); });
  }
  function closePanel() { const p = document.getElementById('bb-panel'); if (p) p.remove(); }

  function render() {
    const p = document.getElementById('bb-panel'); if (!p) return;
    p.querySelectorAll('#bb-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    const log = getLog();
    const saved = S.get('status', null);
    const lastSnap = log[log.length - 1];
    if (!statusText && saved && Date.now() - saved.ts < 12 * 3600 * 1000 && (!lastSnap || saved.ts > lastSnap.ts * 1000 - 60000)) statusText = saved.t;
    if (!statusText) {
      statusText = cfg().apiKey ? (lastSnap ? 'Last scan ' + fmtDT(lastSnap.ts) + (cfg().autoScan ? ' • auto-scan daily after ' + String(cfg().scanHourTCT).padStart(2, '0') + ':00 TCT' : '') : 'No scans yet — tap Scan now.') : 'Set up the faction API key in Settings.';
    }
    setStatus(statusText);
    const body = p.querySelector('#bb-body');
    const keepScroll = body.scrollTop;
    if (tab === 'report') body.innerHTML = renderReport(log);
    else if (tab === 'log') body.innerHTML = renderLog(log);
    else body.innerHTML = renderSettings();
    body.scrollTop = keepScroll;
  }

  // scans made before v1.1.4 have no Avg war % — work it out from the stored war data
  function fillWarAvg(snap) {
    if (!snap || !snap.wars || !snap.wars.length) return snap;
    const cache = KV.get('warCache', {});
    const wars = snap.wars.map((w) => cache[snap.fid + ':' + w.id]).filter(Boolean);
    if (wars.length !== snap.wars.length) return snap;
    for (const id of Object.keys(snap.m)) {
      const r = snap.m[id];
      if (r.wav !== undefined) continue;
      const joined = r.dif != null ? snap.ts - r.dif * 86400 : 0;
      let ps = 0, pn = 0;
      for (const w of wars) {
        if (joined > w.war.end) continue;
        const x = w.per[id];
        if (x && x.g + x.l > 0) { ps += x.g / (x.g + x.l); pn++; }
      }
      r.wav = pn ? Math.round((ps / pn) * 10000) / 10000 : null; r.wavn = pn;
    }
    return snap;
  }

  function currentSnap(log) {
    const v = S.get('viewTs', null);
    return fillWarAvg(normSnap((v && log.find((s) => s.ts === v)) || log[log.length - 1] || null));
  }

  const netOf = (r) => (r.wg || 0) - (r.wl || 0);
  const warsCounted = (r) => (r.wpos || 0) + (r.wneg || 0);
  const winPct = (r) => (warsCounted(r) ? r.wpos / warsCounted(r) : -1);
  // average of each war's gained ÷ (gained + lost); wars with no respect either way are left out
  const avgPct = (r) => (r.wav == null ? -1 : r.wav);
  // shown on a −100%…+100% scale around break-even: 65% gained → +30%, 40% → −20%
  // (same as (gained − lost) ÷ (gained + lost) for a single war)
  const midPct = (p) => { const v = Math.round((p - 0.5) * 2000) / 10; return (v > 0 ? '+' : v < 0 ? '−' : '±') + fmtN(Math.abs(v), 1) + '%'; };
  const avgWars = (r) => (r.wavn || 0);
  const RANKS = {
    win: { label: 'Wars won %', key: winPct, blurb: '% of wars with more respect gained than lost (null wars don\'t count)' },
    resp: { label: 'Avg war %', key: avgPct, blurb: 'average war performance — each war\'s gained ÷ (gained + lost), averaged and shown from −100% to +100% around break-even (null wars don\'t count)' },
    net: { label: 'Net respect', key: netOf, blurb: 'total respect gained minus lost' },
  };
  function rankBadge(r) {
    if (!r.wi) return 'no wars';
    if (rankBy === 'net') { const n = netOf(r); return `<span class="${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '+' : ''}${fmtN(n, 1)} net</span>`; }
    if (rankBy === 'resp') { if (r.wav === undefined) return 'rescan'; const p = avgPct(r); return p < 0 ? 'no wars' : `<span class="${p > 0.5 ? 'pos' : p < 0.5 ? 'neg' : ''}">${midPct(p)}</span> <span class="bb-muted">avg of ${avgWars(r)}</span>`; }
    if (r.wpos == null) return '';
    return warsCounted(r) ? `<span class="pos">${r.wpos}▲</span> <span class="neg">${r.wneg}▼</span> <span class="${winPct(r) >= 0.5 ? 'pos' : 'neg'}">${Math.round(winPct(r) * 100)}%</span>` : 'no wars';
  }
  const FILTERS = {
    all: { label: 'Overview', test: () => true },
    fl: { label: 'Flagged', test: (r) => r.fl },
    A: { label: 'Inactive', test: (r) => r.f.includes('A') },
    D: { label: 'No Donator', test: (r) => r.f.includes('D') },
    X: { label: 'Low Xanax', test: (r) => r.f.includes('X') },
    W: { label: 'War −', test: (r) => r.f.includes('W') },
    pd: { label: 'Pending', test: (r) => r.pd.length > 0 },
  };

  function card(r, rank) {
    const cls = r.ul ? 'ul' : r.fl ? 'fl' : r.f.length ? 'warn' : '';
    const tags = (r.fl ? `<span class="bb-tag fl">FLAGGED — meets ${r.met}/4</span>` : '') +
      r.f.map((c) => `<span class="bb-tag">${esc(reasonText(r, c))}</span>`).join('') +
      r.pd.map((c) => `<span class="bb-tag p">${c === 'X' ? (r.xo ? 'Xanax: overdosed — whole window excluded' : 'Xanax: baseline (needs tomorrow)') : 'Donator: unknown'}</span>`).join('') +
      (r.ex ? '<span class="bb-tag ok">Exempt</span>' : '') + (!r.f.length && !r.pd.length && !r.ex && !r.ul ? '<span class="bb-tag ok">Meets all 4</span>' : '');
    return `<div class="bb-card ${cls}"><div class="top">${rank ? `<span class="rk">#${rank}</span>` : ''}<span class="nm" data-m="${r.id}">${esc(r.n)}</span>
      <a href="https://www.torn.com/profiles.php?XID=${r.id}" style="color:#8a93a3;font-size:11px">[${r.id}]</a>
      <span class="net">${rankBadge(r)}</span></div>
      <div class="bb-muted">Lv ${r.lv == null ? '?' : r.lv} • ${esc(r.p || '')}</div>${tags}
      <div class="meta">Active ${r.la ? fmtHrs(r.ih) + ' ago' : '–'}${r.it ? ' • inactive 24h+ <b>' + r.it + '×</b>' : ''} • ${r.dn == null ? 'Donator ?' : r.dn ? '✔ ' + esc(r.dt || 'Donator') : '✘ No Donator'} •
      Xanax ${r.xr == null ? 'pending' : fmtN(r.xr, 1) + '/day' + (r.xd && r.xd > 1.5 ? ' (' + fmtN(r.xd, 1) + 'd avg' + (r.xo ? ', ' + r.xo + ' OD day' + (r.xo > 1 ? 's' : '') + ' excluded' : '') + ')' : (r.xo ? ' (' + r.xo + ' OD excluded)' : ''))} •
      Wars ${r.wpos == null ? (r.wi ? r.wi + ' measured' : 'none since joining') : (r.wpos + r.wneg) ? r.wpos + ' positive, ' + r.wneg + ' negative' + (r.wnull ? ', ' + r.wnull + ' null' : '') : (r.wi ? r.wi + ' null' : 'none since joining')}</div></div>`;
  }

  function renderReport(log) {
    const snap = currentSnap(log);
    let h = `<div class="bb-row"><button class="bb-btn red" data-a="scan" ${scanning ? 'disabled' : ''}>${scanning ? 'Scanning…' : 'Scan now'}</button>
      ${snap ? '<button class="bb-btn" data-a="exportSnap">Export CSV</button>' : ''}</div>`;
    const prog = KV.get('scanState', null);
    if (prog && prog.members) {
      const n = prog.members.length, d = Object.keys(prog.details || {}).length, pc = n ? Math.round((d / n) * 100) : 0;
      h += `<div style="background:#1b212b;border-radius:6px;padding:8px 10px;margin-bottom:10px"><b>${scanning ? 'Scan in progress' : 'Scan paused — resumes automatically'}</b>
        <div class="bb-muted">${prog.warsDone ? d + ' of ' + n + ' members checked (' + pc + '%)' : 'Loading war history…'}. You can keep playing — it carries on across pages.</div>
        <div style="height:6px;background:#0d1015;border-radius:3px;margin-top:6px"><div style="height:6px;width:${pc}%;background:#c0392b;border-radius:3px"></div></div></div>`;
    }
    if (!snap) return h + '<p class="bb-muted">No scan yet. Boot Bot scans once a day automatically, or tap Scan now.</p>';

    const all = Object.keys(snap.m).map((id) => Object.assign({ id }, snap.m[id]));
    const main = all.filter((r) => !r.ul);
    const under = all.filter((r) => r.ul).sort((a, b) => (b.lv || 0) - (a.lv || 0));
    const isLatest = snap.ts === (log[log.length - 1] || {}).ts;
    const minLv = (snap.rules && snap.rules.minLv) || cfg().minLevel;
    h += `<div class="bb-muted" style="margin-bottom:6px">${esc(snap.fname)} • ${fmtDT(snap.ts)}${snap.manual ? ' (manual)' : ''}${isLatest ? '' : ' • <a href="#" data-a="latest" style="color:#e67e22">viewing old scan — show latest</a>'}</div>`;
    const box = (key, n, red) => `<div class="bb-box ${filter === key ? 'on' : ''} ${red && n ? 'red' : ''}" data-f="${key}"><b>${n}</b>${key === 'ul' ? 'Under ' + minLv : FILTERS[key].label}</div>`;
    const cnt = (k) => main.filter(FILTERS[k].test).length;
    h += `<div class="bb-sum">${box('all', main.length)}${box('fl', cnt('fl'), 1)}${box('A', cnt('A'), 1)}${box('D', cnt('D'), 1)}
      ${box('X', cnt('X'), 1)}${box('W', cnt('W'), 1)}${box('pd', cnt('pd'))}${box('ul', under.length)}</div>`;
    h += `<div class="bb-muted" style="margin-bottom:8px">Flagged = meets fewer than ${(snap.rules && snap.rules.need) || 3} of 4 criteria.
      ${snap.wars && snap.wars.length ? 'Ranked by ' + RANKS[rankBy].blurb + ', over the last ' + snap.wars.length + ' ranked war' + (snap.wars.length > 1 ? 's' : '') + '. Ties go to whoever fought more wars.' : (snap.rules && snap.rules.cW ? 'No completed ranked war found yet.' : '')} Tap a name for details.</div>`;

    // win % of counted (non-null) wars; ties go to whoever fought more wars, then net respect
    const rk = (RANKS[rankBy] || RANKS.win).key;
    const wc = rankBy === 'resp' ? avgWars : warsCounted;
    const sorted = (list) => list.slice().sort((a, b) => rk(b) - rk(a) || wc(b) - wc(a) || netOf(b) - netOf(a) || a.met - b.met);
    if (filter !== 'ul' && filter !== 'A') h += `<div class="bb-row"><span class="bb-muted">Rank by:</span>${Object.keys(RANKS).map((k) => `<span class="bb-chip ${rankBy === k ? 'on' : ''}" data-r="${k}">${RANKS[k].label}</span>`).join('')}</div>`;
    if (filter === 'ul') {
      h += `<div class="bb-sec">Under level ${minLv} (${under.length}) — not judged</div>`;
      h += under.length ? under.map((r) => card(r)).join('') : '<p class="bb-muted">Nobody under level ' + minLv + '.</p>';
      return h;
    }
    const f = FILTERS[filter] || FILTERS.all;
    let list = sorted(main.filter(f.test));
    if (filter === 'A') list = main.filter(f.test).sort((a, b) => (b.ih || 0) - (a.ih || 0));
    h += `<div class="bb-sec">${f.label === 'Overview' ? 'Most effective first' : f.label} (${list.length})</div>`;
    h += list.length ? list.map((r, i) => card(r, filter === 'all' ? i + 1 : (filter === 'A' ? 0 : i + 1))).join('') : '<p class="bb-muted">Nobody in this list.</p>';
    if (filter === 'all' && under.length) {
      h += `<div class="bb-sec" style="margin-top:16px">Under level ${minLv} (${under.length}) — not included above</div>`;
      h += under.map((r) => card(r)).join('');
    }
    return h;
  }

  function memberStats(log, days) {
    const from = days ? nowS() - days * 86400 : 0;
    const snaps = log.filter((s) => s.ts >= from).map(normSnap);
    const latest = normSnap(log[log.length - 1]);
    const stats = {};
    for (const s of snaps) {
      for (const id of Object.keys(s.m)) {
        const r = s.m[id];
        const o = (stats[id] = stats[id] || { id, n: r.n, scans: 0, flagged: 0, A: 0, D: 0, X: 0, W: 0, x0: null, t0: null, x1: null, t1: null });
        o.n = r.n; o.scans++; if (r.fl) o.flagged++;
        r.f.forEach((c) => o[c]++);
        if (r.x != null) { if (o.x0 == null) { o.x0 = r.x; o.t0 = s.ts; } o.x1 = r.x; o.t1 = s.ts; }
        o.net = netOf(r); o.ul = r.ul;
      }
    }
    return Object.values(stats).map((o) => {
      o.pct = o.scans ? Math.round((o.flagged / o.scans) * 100) : 0;
      o.xpd = o.x0 != null && o.t1 - o.t0 > 12 * 3600 ? (o.x1 - o.x0) / ((o.t1 - o.t0) / 86400) : null;
      o.current = !!(latest && latest.m[o.id]);
      o.it = tallyOf(o.id);
      return o;
    });
  }

  function renderLog(log) {
    if (!log.length) return '<p class="bb-muted">The log fills up with each daily scan. Come back after a few scans for trends.</p>';
    let h = `<div class="bb-row"><span class="bb-muted">Period:</span>${[7, 30, 90, 0].map((d) => `<span class="bb-chip ${period === d ? 'on' : ''}" data-p="${d}">${d ? d + 'd' : 'All'}</span>`).join('')}
      <button class="bb-btn" data-a="exportLog" style="margin-left:auto">Export full log</button></div>`;
    const st = memberStats(log, period).filter((o) => o.current && !o.ul);
    const keyFn = { flag: (o) => o.pct * 1000 + o.flagged, name: (o) => o.n.toLowerCase(), it: (o) => o.it, D: (o) => o.D, X: (o) => o.X, net: (o) => o.net || 0, xpd: (o) => (o.xpd == null ? -1 : o.xpd) };
    const kf = keyFn[sortKey] || keyFn.flag;
    st.sort((a, b) => { const x = kf(a), y = kf(b); return (x > y ? 1 : x < y ? -1 : 0) * sortDir; });
    const th = (k, label) => `<th data-s="${k}">${label}${sortKey === k ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    h += '<div class="bb-h">Current members — tap a column to sort</div><table class="bb-tbl"><tr>' + th('name', 'Member') + th('flag', 'Flagged') + th('it', 'Inact 24h+') + th('D', 'NoDon') + th('X', 'LowX') + th('net', 'War net') + th('xpd', 'Xan/day') + '</tr>';
    for (const o of st) {
      h += `<tr class="click" data-m="${o.id}"><td>${esc(o.n)}</td><td class="n">${o.pct}% <span class="bb-muted">(${o.flagged}/${o.scans})</span></td><td class="n">${o.it}×</td><td class="n">${o.D}</td><td class="n">${o.X}</td>
        <td class="n ${o.net > 0 ? 'pos' : o.net < 0 ? 'neg' : ''}">${fmtN(o.net, 1)}</td><td class="n">${o.xpd == null ? '–' : fmtN(o.xpd, 1)}</td></tr>`;
    }
    h += '</table><div class="bb-muted" style="margin-top:4px">Flagged = % of scans flagged. Inact 24h+ = separate times seen inactive over 24h (all time). NoDon/LowX = scans failing that check.</div>';
    h += '<div class="bb-h">Scan history</div><table class="bb-tbl"><tr><th>Date</th><th>Judged</th><th>Flagged</th><th></th></tr>';
    for (const s0 of log.slice().reverse()) {
      const s = normSnap(s0);
      h += `<tr class="click" data-v="${s.ts}"><td>${fmtDT(s.ts)}${s.manual ? ' <span class="bb-muted">manual</span>' : ''}</td><td class="n">${s.judged}</td><td class="n">${s.flagged}</td><td class="n" style="color:#e67e22">View</td></tr>`;
    }
    const left = memberStats(log, period).filter((o) => !o.current);
    if (left.length) h += `<p class="bb-muted" style="margin-top:8px">${left.length} member(s) in this period have since left: ${left.map((o) => esc(o.n)).join(', ')}</p>`;
    return h + '</table>';
  }

  function showMember(id) {
    const log = getLog();
    const rows = log.filter((s) => s.m[id]).map((s) => Object.assign({ ts: s.ts }, normSnap(s).m[id])).reverse();
    if (!rows.length) return;
    const r = rows[0];
    const snap = currentSnap(log);
    const now = (snap && snap.m[id]) || r;
    const p = document.getElementById('bb-panel');
    const md = document.createElement('div'); md.id = 'bb-modal';

    // war-by-war from cache
    const cache = KV.get('warCache', {});
    const fid = (snap && snap.fid) || (S.get('faction', {}) || {}).id;
    const joined = now.dif != null ? (snap ? snap.ts : nowS()) - now.dif * 86400 : 0;
    const wars = Object.keys(cache).filter((k) => k.startsWith(fid + ':')).map((k) => cache[k])
      .filter((w) => w.war.end >= joined).sort((a, b) => b.war.end - a.war.end);
    let tg = 0, tl = 0, th = 0, np = 0, nn = 0, nz = 0, ps = 0, pn = 0;
    const warRows = wars.map((w) => {
      const x = w.per[id] || { g: 0, l: 0, h: 0, d: 0 };
      tg += x.g; tl += x.l; th += x.h;
      const n = Math.round((x.g - x.l) * 100) / 100;
      if (n > 0) np++; else if (n < 0) nn++; else nz++;
      const wp = x.g + x.l > 0 ? x.g / (x.g + x.l) : null;
      if (wp != null) { ps += wp; pn++; }
      return `<tr><td>${tctDay(w.war.end)}</td><td>${esc(w.war.enemyName)}</td><td class="n">${x.h}</td><td class="n">${fmtN(x.g, 1)}</td><td class="n">${fmtN(x.l, 1)}</td>
        <td class="n ${wp == null ? 'bb-muted' : wp > 0.5 ? 'pos' : wp < 0.5 ? 'neg' : ''}">${wp == null ? 'Null' : midPct(wp)}</td>
        <td class="n ${n > 0 ? 'pos' : n < 0 ? 'neg' : 'bb-muted'}">${n === 0 ? 'Null' : (n > 0 ? '+' : '') + fmtN(n, 1)}</td></tr>`;
    }).join('');
    const tnet = tg - tl;
    const eps = ((KV.get('inactive', {})[id] || {}).eps || []).slice().sort((a, b) => b - a);

    let h = `<div><div class="bb-row"><b style="flex:1;font-size:15px">${esc(r.n)} [${id}]</b><button class="bb-btn" data-a="closeModal">Close</button></div>
      <div class="bb-muted">Level ${now.lv == null ? '?' : now.lv} • ${esc(now.p || '')} • ${now.dif == null ? '?' : now.dif} days in faction${now.ul ? ' • under level limit (not judged)' : ''}</div>
      <div style="margin:6px 0">${now.fl ? `<span class="bb-tag fl">FLAGGED — meets ${now.met}/4</span>` : now.ul ? '' : `<span class="bb-tag ok">Meets ${now.met}/4</span>`}${now.f.map((c) => `<span class="bb-tag">${esc(reasonText(now, c))}</span>`).join('')}</div>

      <div class="bb-h">Ranked war performance</div>
      <div class="bb-kv"><div><b class="${pn && ps / pn > 0.5 ? 'pos' : pn && ps / pn < 0.5 ? 'neg' : ''}">${pn ? midPct(ps / pn) : '–'}</b>Avg war % (${pn} wars)</div><div><b>${now.wj == null ? wars.length : now.wj}</b>Wars since joining</div><div><b><span class="pos">${np}▲</span> <span class="neg">${nn}▼</span></b>${nz} null</div><div><b>${th}</b>War hits</div>
        <div><b class="pos">+${fmtN(tg, 1)}</b>Respect gained</div><div><b class="neg">−${fmtN(tl, 1)}</b>Respect lost</div><div><b class="${tnet > 0 ? 'pos' : tnet < 0 ? 'neg' : ''}">${tnet > 0 ? '+' : ''}${fmtN(tnet, 1)}</b>Net</div></div>`;
    h += wars.length
      ? `<table class="bb-tbl"><tr><th>Ended</th><th>Enemy</th><th>Hits</th><th>Gained</th><th>Lost</th><th>War %</th><th>Net</th></tr>${warRows}</table>
         <div class="bb-muted" style="margin-top:4px">War % = (gained − lost) ÷ (gained + lost) for that war: +100% = gained and never lost, 0% = gained the same as lost, −100% = only lost. Avg war % is the average of those. ▲ = gained more than lost in that war, ▼ = lost more. Null = no respect gained or lost (not counted). Lost = respect the enemy took hitting this member.</div>`
      : '<p class="bb-muted">No measured ranked wars since joining.</p>';

    h += `<div class="bb-h">Inactive over ${cfg().inactiveHours}h — ${eps.length} time${eps.length === 1 ? '' : 's'}</div>`;
    h += eps.length ? '<div class="bb-muted">Went quiet from: ' + eps.slice(0, 12).map((t) => fmtDT(t).replace(' TCT', '')).join(' • ') + (eps.length > 12 ? ' …' : '') + ' (TCT)</div>' : '<div class="bb-muted">Never seen inactive that long.</div>';

    h += `<div class="bb-h">Daily scans</div><table class="bb-tbl"><tr><th>Date</th><th>Active</th><th>Don</th><th>Xan/day</th><th>Met</th><th>Failed</th></tr>`;
    for (const x of rows) {
      h += `<tr><td>${tctDay(x.ts)}</td><td>${fmtHrs(x.ih)}</td><td>${x.dn == null ? '?' : x.dn ? '✔' : '✘'}</td><td>${x.xr == null ? '–' : fmtN(x.xr, 1)}</td>
        <td>${x.ul ? '–' : x.met + '/4'}</td><td>${x.f.length ? x.f.map((c) => REASON[c]).join(', ') : '<span style="color:#27ae60">None</span>'}</td></tr>`;
    }
    md.innerHTML = h + '</table></div>';
    p.appendChild(md);
  }

  const sw = (k, on) => `<label class="bb-sw"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><span></span></label>`;
  const num = (k, v, min, max, step) => `<input type="number" data-k="${k}" value="${v}" min="${min}" max="${max}" step="${step || 1}" style="width:80px">`;

  function renderSettings() {
    const c = cfg(); const fac = S.get('faction', null);
    return `<div class="bb-h">Faction API key</div>
      <div class="bb-muted" style="margin-bottom:6px">Using: <b>${maskKey(c.apiKey)}</b>${fac && c.apiKey ? ' • ' + esc(fac.name) + ' [' + fac.id + ']' : ''}</div>
      <div class="bb-row"><button class="bb-btn red" data-a="detect">Use War Room key (auto-detect)</button></div>
      <div class="bb-row"><input type="password" id="bb-key" placeholder="…or paste faction key" style="flex:1;background:#0d1015;color:#e6e6e6;border:1px solid #39424f;border-radius:5px;padding:7px">
      <button class="bb-btn" data-a="saveKey">Verify & save</button></div>
      <div class="bb-muted">Needs a Limited or Full key from someone with faction API access (the key you gave War Room). Stored on this device only.</div>

      <div class="bb-h">Daily scan</div>
      <div class="bb-set"><label>Auto-scan once a day<small>Runs on your first Torn page after the chosen hour</small></label>${sw('autoScan', c.autoScan)}</div>
      <div class="bb-set"><label>Scan after (TCT hour, 0–23)</label>${num('scanHourTCT', c.scanHourTCT, 0, 23)}</div>
      <div class="bb-set"><label>Hourly activity check<small>While Torn is open — catches more 24h+ absences for the tally (1 API call/hour)</small></label>${sw('activitySampling', c.activitySampling)}</div>

      <div class="bb-h">Judging</div>
      <div class="bb-set"><label>Flag if meeting fewer than (of 4)</label>${num('minCriteria', c.minCriteria, 1, 4)}</div>
      <div class="bb-set"><label>Minimum level<small>Members below this are listed separately and not judged</small></label>${num('minLevel', c.minLevel, 1, 100)}</div>

      <div class="bb-h">Criteria</div>
      <div class="bb-set"><label>Activity<small>Fails if not active for more than X hours</small></label>${num('inactiveHours', c.inactiveHours, 1, 720)}${sw('checkActive', c.checkActive)}</div>
      <div class="bb-set"><label>Donator status<small>Donator pack or subscription</small></label>${sw('checkDonator', c.checkDonator)}</div>
      <div class="bb-set"><label>Xanax per day (minimum)</label>${num('minXanaxPerDay', c.minXanaxPerDay, 0, 10, 0.5)}${sw('checkXanax', c.checkXanax)}</div>
      <div class="bb-set"><label>Xanax measured over (days)<small>Average per day over this many days, from Torn's own history (up to 90). Each overdose in that time removes a day from the count.</small></label>${num('xanaxWindowDays', c.xanaxWindowDays, 1, 90)}</div>
      <div class="bb-set"><label>Ranked wars: gained &gt; lost<small>Cumulative over the last N ranked wars (max 50)</small></label>${num('warHistory', c.warHistory, 1, 50)}${sw('checkWars', c.checkWars)}</div>
      <div class="bb-set" style="display:block"><label>Exempt member IDs<small>Comma separated — shown but never flagged</small></label>
        <input type="text" class="wide" data-k="exemptIds" value="${esc(c.exemptIds)}" placeholder="e.g. 3616083, 1234567"></div>

      <div class="bb-h">Notifications</div>
      <div class="bb-set"><label>On-screen alert after each scan</label>${sw('notifyToast', c.notifyToast)}</div>
      <div class="bb-set"><label>Browser / device notification</label>${sw('notifyBrowser', c.notifyBrowser)}</div>
      <div class="bb-set"><label>Discord webhook<small>Post the flagged list to a war council channel</small></label>${sw('notifyDiscord', c.notifyDiscord)}</div>
      <div class="bb-set" style="display:block"><input type="text" class="wide" data-k="discordWebhook" value="${esc(c.discordWebhook)}" placeholder="https://discord.com/api/webhooks/…"></div>
      <div class="bb-set"><label>Discord: only newly flagged members</label>${sw('discordOnlyNew', c.discordOnlyNew)}</div>
      <div class="bb-row" style="margin-top:8px"><button class="bb-btn" data-a="testNotify">Send test notification</button></div>

      <div class="bb-h">Log</div>
      <div class="bb-set"><label>Keep history for (days)</label>${num('logDays', c.logDays, 7, 365)}</div>
      <div class="bb-row"><span class="bb-muted" style="flex:1">${getLog().length} scans stored</span><button class="bb-btn" data-a="clearLog">Clear log</button></div>
      <p class="bb-muted" style="margin-top:14px">Boot Bot v${VERSION} © -TheKraken- [3616083]. Not to be copied or redistributed without permission. Only contacts api.torn.com (and your Discord webhook if enabled).</p>`;
  }

  async function onClick(e) {
    const t = e.target;
    if (t.dataset.t) { tab = t.dataset.t; statusText = ''; return render(); }
    const fb = t.closest('[data-f]');
    if (fb) { filter = fb.dataset.f; const b = document.getElementById('bb-body'); render(); if (b) { const sec = b.querySelector('.bb-sec'); if (sec) b.scrollTop = Math.max(0, sec.offsetTop - 60); } return; }
    if (t.dataset.r) { rankBy = t.dataset.r; S.set('rankBy', rankBy); return render(); }
    if (t.dataset.p != null && t.classList.contains('bb-chip')) { period = Number(t.dataset.p); return render(); }
    if (t.dataset.s) { if (sortKey === t.dataset.s) sortDir *= -1; else { sortKey = t.dataset.s; sortDir = t.dataset.s === 'name' ? 1 : -1; } return render(); }
    const tm = t.closest('[data-m]');
    if (tm && tm.dataset.m) return showMember(tm.dataset.m);
    const tv = t.closest('tr[data-v]');
    if (tv) { S.set('viewTs', Number(tv.dataset.v)); tab = 'report'; filter = 'all'; return render(); }
    const a = t.dataset.a || (t.closest('[data-a]') && t.closest('[data-a]').dataset.a);
    if (!a) return;
    e.preventDefault();
    if (a === 'close') return closePanel();
    if (a === 'closeModal') { const m = document.getElementById('bb-modal'); return m && m.remove(); }
    if (a === 'latest') { S.del('viewTs'); return render(); }
    if (a === 'scan') { S.del('viewTs'); S.del('scanBackoff'); render(); await runScan(true); return render(); }
    if (a === 'exportSnap') { const s = currentSnap(getLog()); return exportCSV('bootbot-' + s.day + '.csv', snapCSV([s])); }
    if (a === 'exportLog') return exportCSV('bootbot-log-' + tctDay() + '.csv', snapCSV(getLog()));
    if (a === 'clearLog') { if (window.confirm('Delete all Boot Bot scan history on this device?')) { await KV.set('log', []); S.del('log'); S.del('viewTs'); toast('Log cleared'); render(); refreshIcon(); } return; }
    if (a === 'detect') {
      setStatus('Looking for the War Room key…');
      const r = await autoDetectKey(setStatus);
      setStatus(r.ok ? 'Key found ✔ ' + maskKey(r.key) + ' — ' + r.factionName : r.reason);
      statusText = ''; return render();
    }
    if (a === 'saveKey') {
      const k = (document.getElementById('bb-key').value || '').trim();
      if (!/^[A-Za-z0-9]{16}$/.test(k)) return setStatus('That doesn\'t look like a 16-character Torn API key.');
      setStatus('Verifying key…');
      const v = await verifyKey(k);
      if (!v.ok) return setStatus('Key rejected: ' + v.reason);
      saveCfg({ apiKey: k }); S.set('faction', { id: v.factionId, name: v.factionName });
      statusText = 'Key saved ✔ ' + v.factionName; return render();
    }
    if (a === 'testNotify') {
      const c = cfg();
      toast('👢 Boot Bot test notification');
      if (c.notifyBrowser) {
        try {
          if (typeof GM_notification === 'function') GM_notification({ title: 'Boot Bot', text: 'Test notification', timeout: 8000 });
          else if (window.Notification) { if (Notification.permission !== 'granted') await Notification.requestPermission(); if (Notification.permission === 'granted') new Notification('Boot Bot', { body: 'Test notification' }); }
        } catch (err) { /* ignore */ }
      }
      if (c.notifyDiscord && c.discordWebhook) {
        const ok = await postDiscord(c.discordWebhook, '👢 Boot Bot test — notifications are working.\n', []);
        setStatus(ok ? 'Discord test sent ✔' : 'Discord test failed — check the webhook URL.');
      }
    }
  }

  function onChange(e) {
    const k = e.target.dataset.k; if (!k) return;
    let v;
    if (e.target.type === 'checkbox') v = e.target.checked;
    else if (e.target.type === 'number') { v = Number(e.target.value); if (isNaN(v)) return; }
    else v = e.target.value.trim();
    saveCfg({ [k]: v });
    if (k === 'notifyBrowser' && v && !(typeof GM_notification === 'function') && window.Notification && Notification.permission === 'default') Notification.requestPermission();
    setStatus(k === 'warHistory' ? 'Saved — applies from the next scan.' : 'Saved — applies from the next scan.');
  }

  // ───────────────────────── boot ─────────────────────────
  async function tryStart() {
    if (scanning || lockedByOther()) return;
    if (Date.now() < S.get('scanBackoff', 0)) return;
    await KV.load(['scanState']);
    const st = KV.get('scanState', null);
    if (st && st.v === 2 && Date.now() - st.started < RESUME_MS) return runScan(st.manual);
    if (shouldAutoScan()) return runScan(false);
    await maybeSampleActivity();
  }

  async function init() {
    if (!document.body) return setTimeout(init, 300);
    buildIcon();
    // release the scan lock when leaving a page so the next page can carry on straight away
    const release = () => { if (scanning) { const l = S.get('lock', null); if (l && l.tab === TAB_ID) S.del('lock'); } };
    window.addEventListener('pagehide', release);
    window.addEventListener('beforeunload', release);
    await loadStore();
    refreshIcon();
    setTimeout(tryStart, 3000);
    setInterval(tryStart, 15000); // picks up an unfinished scan if another page let go of it
  }

  // Exposed for testing only
  if (typeof window !== 'undefined' && window.__BOOTBOT_TEST__) {
    window.__BOOTBOT__ = { runScan, aggregateWar, xanaxRate, parseXan, parseDonator, normaliseWars, buildSnapshot, getLog, saveLog, cfg, saveCfg, candidateKeys, verifyKey, snapCSV, memberStats, KV, loadStore, recordActivity, showMember };
  }
  init();
})();
