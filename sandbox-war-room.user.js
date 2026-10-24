// ==UserScript==
// @name         Sandbox War Room 🧪
// @namespace    jay-torn-war-script-sandbox
// @version      1.99.39
// @downloadURL  https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/sandbox-war-room.user.js
// @updateURL    https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/sandbox-war-room.user.js
// @description  [SANDBOX - test build, not for general use] Enemy hospital timers, quick attack links, and a chain timeout alert overlay for Torn faction war pages. Works in Tampermonkey (Firefox) and Torn PDA.
// @author       -TheKraken- [3616083]
// @copyright    2026, -TheKraken- [3616083] - All rights reserved
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @connect      ffscouter.com
// @connect      www.lol-manager.com
// @connect      lilywaterbug.art
// @connect      lilywaterbug.alwaysdata.net
// @connect      what-the-f.de
// @connect      www.tornstats.com
// @connect      www.torn.com
// @connect      igiyqcgpwonbbjdnvxwd.supabase.co
// @connect      dashing-fish-54.eu-west-1.convex.site
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

// ---------------------------------------------------------------------------
// Sandbox War Room (c) 2026 -TheKraken- [3616083]. All rights reserved.
// This script is the intellectual property of its author. It may not be
// copied, modified, redistributed or resold, in whole or in part, without
// the author's written permission. Use requires a free trial or a paid pass;
// removing or bypassing the access check is not permitted.
// ---------------------------------------------------------------------------

// PDA_APIKEY_PLACEHOLDER: Torn PDA replaces this literal string with the user's
// own API key at runtime. On Tampermonkey/Firefox this string is left as-is,
// which is how we detect "this isn't really a key" and fall back to the
// manually-entered one stored via GM_setValue instead.
const PDA_INJECTED_KEY = "###PDA-APIKEY###";

// What the page's own globals are, captured once so War Room can also start
// a copy of itself inside a pop-out page (Torn PDA doesn't run scripts in
// frames). Normal runs use exactly these same objects.
const __twsOuter = (() => {
  const o = { win: window, doc: document, loc: location, hist: history };
  try { o.uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : undefined; } catch (e) { o.uw = undefined; }
  try { o.addStyle = typeof GM_addStyle !== 'undefined' ? GM_addStyle : undefined; } catch (e) { o.addStyle = undefined; }
  try { o.ss = sessionStorage; } catch (e) { o.ss = undefined; }
  o.gcs = getComputedStyle; o.si = setInterval; o.st = setTimeout; o.ci = clearInterval; o.ct = clearTimeout;
  o.El = Element; o.ME = MouseEvent;
  try { o.PO = PerformanceObserver; } catch (e) { o.PO = undefined; }
  return o;
})();

(function __twsMain(__twsCtx) {
  'use strict';

  // __twsCtx = { win, doc, frame }: this copy runs for a pop-out page.
  const __twsAlive = __twsCtx
    ? () => { try { return __twsCtx.frame.isConnected && __twsCtx.frame.contentDocument === __twsCtx.doc; } catch (e) { return false; } }
    : null;
  const window = __twsCtx ? __twsCtx.win : __twsOuter.win;
  const document = __twsCtx ? __twsCtx.doc : __twsOuter.doc;
  const location = __twsCtx ? __twsCtx.win.location : __twsOuter.loc;
  const history = __twsCtx ? __twsCtx.win.history : __twsOuter.hist;
  const unsafeWindow = __twsCtx ? __twsCtx.win : __twsOuter.uw;
  const sessionStorage = __twsCtx ? (() => { try { return __twsCtx.win.sessionStorage; } catch (e) { return undefined; } })() : __twsOuter.ss;
  const getComputedStyle = __twsCtx ? (el, p) => __twsCtx.win.getComputedStyle(el, p) : __twsOuter.gcs;
  const Element = __twsCtx ? __twsCtx.win.Element : __twsOuter.El;
  const MouseEvent = __twsCtx ? __twsCtx.win.MouseEvent : __twsOuter.ME;
  const PerformanceObserver = __twsCtx ? __twsCtx.win.PerformanceObserver : __twsOuter.PO;
  const GM_addStyle = __twsCtx
    ? (css) => {
      const put = () => {
        const st = document.createElement('style');
        st.textContent = css;
        (document.head || document.documentElement).appendChild(st);
        return st;
      };
      if (document.documentElement) return put();
      document.addEventListener('DOMContentLoaded', put);
      return null;
    }
    : __twsOuter.addStyle;

  // Pop-out windows load Torn pages inside an iframe on the same origin.
  // This script matches every Torn page, so without this guard it would
  // start a second copy of itself inside each pop-out (its own panel + API
  // polling).
  // PC War Room: inside a War Room pop-out, run Kraken Intel only.
  let IN_POPOUT_FRAME = false;
  try {
    IN_POPOUT_FRAME = window.top !== window.self && !!(window.frameElement && window.frameElement.closest && window.frameElement.closest('#tws-popout'));
  } catch (e) { IN_POPOUT_FRAME = false; }
  if (window.top !== window.self && !IN_POPOUT_FRAME) return;
  if (IN_POPOUT_FRAME) {
    let fw = window;
    try { fw = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window; } catch (e) { /* ignore */ }
    try { if (fw.__twsFrameKI) return; fw.__twsFrameKI = true; } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------
  // PERFORMANCE MONITOR (PC Mode diagnostics)
  // Times every timer, animation frame and page observer this script runs,
  // plus the main drawing functions, and measures how long the browser
  // freezes and how slow clicks are, so we can see what (if anything) of
  // ours is making the page slow. Badge bottom-left; tap it for a report.
  // ---------------------------------------------------------------------
  const __nativeSetInterval = __twsAlive
    ? (fn, ms) => { const id = __twsOuter.si(function () { if (!__twsAlive()) { __twsOuter.ci(id); return undefined; } return fn.apply(this, arguments); }, ms); return id; }
    : window.setInterval.bind(window);
  const __nativeSetTimeout = __twsAlive
    ? (fn, ms) => __twsOuter.st(function () { if (!__twsAlive()) return undefined; return fn.apply(this, arguments); }, ms)
    : window.setTimeout.bind(window);
  const __nativeRaf = __twsAlive
    ? (fn) => __twsOuter.st(() => { if (__twsAlive()) fn(performance.now()); }, 16)
    : (window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null);
  const __perf = {
    start: performance.now(), s: {}, lagMax: 0, lagN: 0, lagMs: 0,
    longN: 0, longMs: 0, longMax: 0, longOk: false,
    clickN: 0, clickMax: 0, clickOk: false, win: [], freezes: [], lastLabel: '',
  };
  const __perfNames = new WeakMap();
  // Deep scan: War Room's own timers/observers can be paused for a phase.
  let __wrPause = false;
  const __wrPauseQ = [];
  let __wrPauseMO = false;
  function __perfLabel(fn) {
    if (typeof fn !== 'function') return String(fn).slice(0, 50);
    let l = __perfNames.get(fn);
    if (!l) {
      l = fn.name || String(fn).replace(/\s+/g, ' ').slice(0, 70);
      __perfNames.set(fn, l);
    }
    return l;
  }
  function perfWrap(label, fn, self, args) {
    const t = performance.now();
    if (__perf.s[label] && __perf.s[label].top) __perf.lastLabel = label.slice(0, 60);
    try {
      return fn.apply(self, args);
    } finally {
      const d = performance.now() - t;
      const e = __perf.s[label] || (__perf.s[label] = { n: 0, ms: 0, max: 0, top: /^(interval|timeout|frame)|observer$/.test(label) });
      e.n++; e.ms += d; if (d > e.max) e.max = d;
    }
  }
  function perfCount(label, k) {
    const e = __perf.s[label] || (__perf.s[label] = { n: 0, ms: 0, max: 0, top: false });
    e.n += (k || 1);
  }
  function setInterval(fn, ms) {
    const extra = Array.prototype.slice.call(arguments, 2);
    if (typeof fn !== 'function') return __nativeSetInterval(fn, ms);
    const lab = `interval ${ms}ms: ${__perfLabel(fn)}`;
    return __nativeSetInterval(function () { if (__wrPause) return undefined; return perfWrap(lab, fn, this, extra); }, ms);
  }
  function setTimeout(fn, ms) {
    const extra = Array.prototype.slice.call(arguments, 2);
    if (typeof fn !== 'function') return __nativeSetTimeout(fn, ms);
    const lab = `timeout: ${__perfLabel(fn)}`;
    return __nativeSetTimeout(function () { if (__wrPause) { __wrPauseQ.push(() => perfWrap(lab, fn, null, extra)); return undefined; } return perfWrap(lab, fn, this, extra); }, ms);
  }
  function requestAnimationFrame(fn) {
    const lab = `frame: ${__perfLabel(fn)}`;
    const run = (ts) => { if (__wrPause) { __wrPauseQ.push(() => perfWrap(lab, fn, null, [performance.now()])); return undefined; } return perfWrap(lab, fn, null, [ts]); };
    if (!__nativeRaf) return __nativeSetTimeout(() => run(performance.now()), 16);
    return __nativeRaf(run);
  }
  function PerfMO(label, cb) {
    return new window.MutationObserver(function (recs, obs) {
      if (__wrPause) { __wrPauseMO = true; return undefined; }
      perfCount(`${label} (records)`, recs.length);
      return perfWrap(label, cb, this, [recs, obs]);
    });
  }
  function render() { return perfWrap('render', render__raw, this, arguments); }
  function renderInner() { return perfWrap('renderInner', renderInner__raw, this, arguments); }
  function updateInPlace() { return perfWrap('updateInPlace', updateInPlace__raw, this, arguments); }
  function safeRender() { return perfWrap('safeRender', safeRender__raw, this, arguments); }
  function tickCountdowns() { return perfWrap('tickCountdowns', tickCountdowns__raw, this, arguments); }
  function refreshRosters() { return perfWrap('refreshRosters', refreshRosters__raw, this, arguments); }
  function refreshChain() { return perfWrap('refreshChain', refreshChain__raw, this, arguments); }
  function runBloodHighlight() { return perfWrap('runBloodHighlight', runBloodHighlight__raw, this, arguments); }
  function applyHeaderFlash() { return perfWrap('applyHeaderFlash', applyHeaderFlash__raw, this, arguments); }
  function applyHeaderVisibility() { return perfWrap('applyHeaderVisibility', applyHeaderVisibility__raw, this, arguments); }
  function renderAccessStrip() { return perfWrap('renderAccessStrip', renderAccessStrip__raw, this, arguments); }
  function renderAtkLog() { return perfWrap('renderAtkLog', renderAtkLog__raw, this, arguments); }
  function renderWide() { return perfWrap('renderWide', renderWide__raw, this, arguments); }
  function applyWideLayout() { return perfWrap('applyWideLayout', applyWideLayout__raw, this, arguments); }
  function kiRenderAttackEquipment() { return perfWrap('kiRenderAttackEquipment', kiRenderAttackEquipment__raw, this, arguments); }
  function kiPlaceProfilePanel() { return perfWrap('kiPlaceProfilePanel', kiPlaceProfilePanel__raw, this, arguments); }
  function parseMembers() { return perfWrap('parseMembers', parseMembers__raw, this, arguments); }
  function getCfg() { return perfWrap('getCfg', getCfg__raw, this, arguments); }
  function setCfg() { return perfWrap('setCfg', setCfg__raw, this, arguments); }
  function httpGetJson() { return perfWrap('httpGetJson', httpGetJson__raw, this, arguments); }
  function ensureSosButton() { return perfWrap('ensureSosButton', ensureSosButton__raw, this, arguments); }
  function tickRetalTimers() { return perfWrap('tickRetalTimers', tickRetalTimers__raw, this, arguments); }
  function atkLogHtml() { return perfWrap('atkLogHtml', atkLogHtml__raw, this, arguments); }

  // Browser freezes: a 250ms heartbeat that notices when it runs late.
  let __lagLast = performance.now();
  __nativeSetInterval(() => {
    const n = performance.now();
    const lag = n - __lagLast - 250;
    __lagLast = n;
    if (document.visibilityState !== 'visible') return; // hidden tabs are throttled anyway
    if (lag > __perf.lagMax) __perf.lagMax = lag;
    if (lag > 200) { __perf.lagN++; __perf.lagMs += lag; }
    if (lag > 1000) {
      const frames = Array.from(document.querySelectorAll('iframe')).map((f) => {
        let src = f.getAttribute('src') || '';
        try { src = (f.contentWindow && f.contentWindow.location.href) || src; } catch (e) { /* other site */ }
        const shown = f.getClientRects().length ? 'shown' : 'hidden';
        return `${f.id || '(no id)'} ${shown} ${String(src).replace('https://www.torn.com', '').slice(0, 70)}`;
      });
      __perf.freezes.push(`${new Date().toISOString().slice(11, 19)} UTC ${Math.round(lag)}ms | focus ${document.hasFocus() ? 'yes' : 'no'} | last War Room work: ${__perf.lastLabel || '-'} | frames: ${frames.join(' ; ') || 'none'}`);
      if (__perf.freezes.length > 12) __perf.freezes.shift();
    }
  }, 250);
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      __perf.longN++; __perf.longMs += e.duration; if (e.duration > __perf.longMax) __perf.longMax = e.duration;
    })).observe({ type: 'longtask', buffered: true });
    __perf.longOk = true;
  } catch (e) { /* Firefox: not supported */ }
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      if (!/click|pointerdown|pointerup|mousedown|mouseup|keydown/.test(e.name)) return;
      __perf.clickN++; if (e.duration > __perf.clickMax) __perf.clickMax = e.duration;
    })).observe({ type: 'event', durationThreshold: 200, buffered: true });
    __perf.clickOk = true;
  } catch (e) { /* not supported */ }

  function __perfTopMs() {
    let t = 0;
    Object.keys(__perf.s).forEach((k) => { if (__perf.s[k].top) t += __perf.s[k].ms; });
    return t;
  }
  // ---- page-jump + blank-settings diagnostics (Sandbox) ----
  const __diag = { jumps: [], blanks: [], lastRender: 0, lastDock: 0, lastY: 0, lastDocH: 0 };
  try {
    window.addEventListener('scroll', () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const docH = document.documentElement.scrollHeight;
      if (__diag.lastY > 300 && y < 80 && __diag.jumps.length < 15) {
        const now = performance.now();
        const p = document.getElementById('tws-panel');
        const pr = p ? p.getBoundingClientRect() : null;
        __diag.jumps.push(`${new Date().toISOString().slice(11, 19)} UTC ${Math.round(__diag.lastY)} -> ${Math.round(y)} | last WR work: ${__perf.lastLabel || '-'} | WR redraw ${__diag.lastRender ? Math.round(now - __diag.lastRender) + 'ms' : 'never'} ago | icon moved ${__diag.lastDock ? Math.round(now - __diag.lastDock) + 'ms' : 'never'} ago | page height ${__diag.lastDocH} -> ${docH} | panel ${pr ? `${Math.round(pr.top)},${Math.round(pr.height)}h ${getComputedStyle(p).position}` : 'none'} | focus in ${(document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || '-'}`);
      }
      __diag.lastY = y;
      __diag.lastDocH = docH;
    }, { passive: true, capture: true });
  } catch (e) { /* ignore */ }

  function perfReport() {
    const up = (performance.now() - __perf.start) / 1000;
    const gi = (typeof GM_info !== 'undefined' && GM_info) ? GM_info : {};
    const mem = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB` : 'n/a';
    const rows = Object.keys(__perf.s).map((k) => [k, __perf.s[k]]).sort((a, b) => b[1].ms - a[1].ms || b[1].n - a[1].n).slice(0, 25)
      .map(([k, e]) => `${Math.round(e.ms)}ms total | ${e.n} runs | max ${Math.round(e.max)}ms | ${k}`);
    let pm = '?';
    try { pm = perfMode(); } catch (e) { /* ignore */ }
    let wide = '?';
    try { wide = wideActive() ? 'on' : 'off'; } catch (e) { /* ignore */ }
    return [
      `War Room perf report (${(() => { try { return pcMode() ? 'PC Mode' : 'Mobile Mode'; } catch (e) { return '?'; } })()}) v${SCRIPT_VERSION}`,
      `uptime ${Math.round(up)}s | ${gi.scriptHandler || '?'} ${gi.version || ''} | ${navigator.userAgent}`,
      `perf mode ${pm}${(typeof turboMode !== 'undefined' && turboMode) ? ' + Turbo' : ''} | wide ${wide} | page ${location.pathname}${location.search} | window ${window.innerWidth}x${window.innerHeight}`,
      `DOM nodes: page ${document.getElementsByTagName('*').length}, panel ${(document.querySelector('#tws-panel') || { getElementsByTagName: () => [] }).getElementsByTagName('*').length} | iframes ${document.querySelectorAll('iframe').length} | JS heap ${mem}`,
      `our script time: ${Math.round(__perfTopMs())}ms total (${(__perfTopMs() / up / 10).toFixed(2)}% of the time)`,
      `freezes (>200ms): ${__perf.lagN}, total ${Math.round(__perf.lagMs)}ms, worst ${Math.round(__perf.lagMax)}ms`,
      `long tasks (whole page): ${__perf.longOk ? `${__perf.longN}, total ${Math.round(__perf.longMs)}ms, worst ${Math.round(__perf.longMax)}ms` : 'n/a in this browser'}`,
      `slow clicks/keys (>200ms): ${__perf.clickOk ? `${__perf.clickN}, worst ${Math.round(__perf.clickMax)}ms` : 'n/a in this browser'}`,
      `page frames now: ${document.querySelectorAll('iframe').length ? '' : 'none'}`,
      ...Array.from(document.querySelectorAll('iframe')).map((f) => `  ${__frameInfo(f)}`),
      'freezes over 1s (newest last):',
    ].concat(__perf.freezes.length ? __perf.freezes.map((x) => '  ' + x) : ['  none'],
      ['page jumps to the top (newest last):'], __diag.jumps.length ? __diag.jumps.map((x) => '  ' + x) : ['  none'],
      ['blank Settings seen:'], __diag.blanks.length ? __diag.blanks.map((x) => '  ' + x) : ['  none'],
      ['top script work:'], rows).join('\n');
  }
  // ---- Deep scan (temporary): 3 phases x 30s ----
  let __perfLastScan = '';
  let __scanBusy = false;
  const __scanHidden = [];
  function __scanShort(u) {
    try { const x = new URL(u, location.href); return `${x.host.replace('www.', '')}${x.pathname}`.slice(0, 60); } catch (e) { return String(u).slice(0, 60); }
  }
  function __scanKey(el) {
    if (!el || !el.tagName) return '?';
    const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    let k = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}`;
    const p = el.parentElement;
    if (p && p !== document.body) {
      const pc = (typeof p.className === 'string' ? p.className : '').split(/\s+/).filter(Boolean)[0];
      k = `${p.id ? '#' + p.id : (pc ? '.' + pc : p.tagName.toLowerCase())} > ${k}`;
    }
    return k.slice(0, 80);
  }
  function __isOurs(el) {
    return !!(el && el.closest && el.closest('[id^="tws-"], [class*="tws-"]'));
  }
  function __scanPause(pause, hide) {
    if (hide) {
      Array.from(document.body.children).forEach((el) => {
        if (/^tws-/.test(el.id || '') && !/^tws-perf/.test(el.id)) { __scanHidden.push([el, el.style.display]); el.style.display = 'none'; }
      });
    } else {
      __scanHidden.splice(0).forEach(([el, d]) => { el.style.display = d; });
    }
    __wrPause = pause;
    if (!pause) {
      __wrPauseQ.splice(0).forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
      if (__wrPauseMO) { __wrPauseMO = false; try { render(); } catch (e) { /* ignore */ } }
    }
  }
  function __frameInfo(f) {
    let src = f.getAttribute('src') || '';
    try { src = (f.contentWindow && f.contentWindow.location.href) || src; } catch (e) { src = src || '(other site)'; }
    const r = f.getBoundingClientRect();
    const cs = getComputedStyle(f);
    const cls = (typeof f.className === 'string' ? f.className : '').slice(0, 40);
    const attrs = ['name', 'title', 'sandbox', 'allow', 'data-src'].map((a) => (f.getAttribute(a) ? `${a}="${f.getAttribute(a).slice(0, 40)}"` : '')).filter(Boolean).join(' ');
    let par = [];
    for (let p = f.parentElement, i = 0; p && p !== document.body && i < 3; p = p.parentElement, i++) par.push(__scanKey(p).split(' > ').pop());
    return `${f.id || '(no id)'}${cls ? '.' + cls : ''} ${String(src).replace('https://www.torn.com', '').slice(0, 60) || '(no src)'} | ${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)} | ${cs.display}/${cs.visibility}/opacity ${cs.opacity}${attrs ? ' | ' + attrs : ''} | inside ${par.join(' < ') || 'body'}`;
  }
  function __scanStatic() {
    const out = [];
    const all = document.getElementsByTagName('*');
    let ours = 0;
    for (let i = 0; i < all.length; i++) if (__isOurs(all[i])) ours++;
    out.push(`DOM: ${all.length} elements (War Room ${ours}) | iframes ${document.querySelectorAll('iframe').length} | style sheets ${document.styleSheets.length}`);
    document.querySelectorAll('iframe, frame, embed, object').forEach((f) => out.push(`  frame: ${__frameInfo(f)}`));
    try {
      const anims = document.getAnimations ? document.getAnimations() : [];
      const g = {};
      let inf = 0;
      anims.forEach((a) => {
        const t = a.effect && a.effect.target;
        const name = a.animationName || a.transitionProperty || (a.constructor && a.constructor.name) || 'anim';
        const endless = a.effect && a.effect.getTiming && a.effect.getTiming().iterations === Infinity;
        if (endless) inf++;
        const k = `${__isOurs(t) ? 'WR' : 'Torn'} ${name}${endless ? ' (endless)' : ''} on ${__scanKey(t)}`;
        g[k] = (g[k] || 0) + 1;
      });
      out.push(`running animations: ${anims.length} (${inf} endless)`);
      Object.keys(g).sort((a, b) => g[b] - g[a]).slice(0, 8).forEach((k) => out.push(`  ${g[k]}x ${k}`));
    } catch (e) { out.push('animations: n/a'); }
    try {
      let fx = 0; let fixed = 0; let n = 0;
      const els = document.querySelectorAll('[id^="tws-"], [id^="tws-"] *');
      for (let i = 0; i < els.length && n < 4000; i++, n++) {
        const cs = getComputedStyle(els[i]);
        if ((cs.filter && cs.filter !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.boxShadow && cs.boxShadow !== 'none')) fx++;
        if (cs.position === 'fixed') fixed++;
      }
      out.push(`War Room styling: ${fx} elements with shadow/filter, ${fixed} fixed-position (of ${n} checked)`);
    } catch (e) { /* ignore */ }
    return out;
  }
  async function __deepScan(onStatus) {
    const LEN = 30;
    const wait = (ms) => new Promise((r) => __nativeSetTimeout(r, ms));
    const gi = (typeof GM_info !== 'undefined' && GM_info) ? GM_info : {};
    let pm = '?';
    try { pm = `${perfMode()}${turboMode ? ' + Turbo' : ''} | ${pcMode() ? 'PC Mode' : 'Mobile Mode'}`; } catch (e) { /* ignore */ }
    const out = [
      `War Room DEEP SCAN v${SCRIPT_VERSION} | ${new Date().toISOString().slice(0, 19)}Z`,
      `${gi.scriptHandler || '?'} ${gi.version || ''} | ${navigator.userAgent}`,
      `perf ${pm} | page ${location.pathname}${location.search} | window ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x | cores ${navigator.hardwareConcurrency || '?'}`,
    ].concat(__scanStatic());
    let offKeys = [];
    try { offKeys = FEATURES.filter((f) => !featureOn(f.key)).map((f) => f.key); } catch (e) { /* ignore */ }
    out.push(`features off: ${offKeys.join(', ') || 'none'}`);
    const phases = [['A', 'normal', false, false], ['B', 'War Room paused (panel still shown)', true, false], ['C', 'War Room paused + hidden', true, true]];
    const summary = [];
    for (const [id, name, pause, hide] of phases) {
      const st = { lagN: 0, lagMs: 0, lagMax: 0, frames: 0, gapMax: 0, gaps: 0, mutW: 0, mutT: 0, tg: {}, res: {}, resN: 0, fz: [], loaf: [], loafOk: false, longN: 0, longMs: 0, longOk: false, vis: 0, foc: 0, smp: 0 };
      __scanPause(pause, hide);
      await wait(300);
      const wr0 = __perfTopMs();
      const t0 = performance.now();
      let last = t0;
      const mutT = [];
      const resT = [];
      const hb = __nativeSetInterval(() => {
        const n = performance.now();
        const lag = n - last - 100;
        last = n;
        st.smp++;
        if (document.visibilityState === 'visible') st.vis++;
        if (document.hasFocus()) st.foc++;
        if (lag > st.lagMax) st.lagMax = lag;
        if (lag > 50) { st.lagN++; st.lagMs += lag; }
        if (lag > 400 && st.fz.length < 12) {
          const since = n - lag - 1500;
          const m = mutT.filter((x) => x[0] > since).reduce((a, x) => a + x[1], 0);
          const r = resT.filter((x) => x[0] > since).map((x) => x[1]).slice(-4);
          st.fz.push(`+${((n - t0) / 1000).toFixed(1)}s froze ${Math.round(lag)}ms | Torn page changes just before: ${m} | requests just before: ${r.join(', ') || '-'}`);
        }
      }, 100);
      let fl = t0;
      let rafOn = !!__nativeRaf;
      const fr = () => {
        if (!rafOn) return;
        const n = performance.now();
        const g = n - fl;
        fl = n;
        st.frames++;
        if (g > st.gapMax) st.gapMax = g;
        if (g > 50) st.gaps++;
        __nativeRaf(fr);
      };
      if (rafOn) __nativeRaf(fr);
      const mo = new window.MutationObserver((recs) => {
        let t = 0;
        recs.forEach((r) => {
          const el = r.target && r.target.nodeType === 1 ? r.target : (r.target && r.target.parentElement);
          if (__isOurs(el)) { st.mutW++; return; }
          st.mutT++; t++;
          const k = `${r.type === 'attributes' ? `attr ${r.attributeName}` : r.type} ${__scanKey(el)}`;
          st.tg[k] = (st.tg[k] || 0) + 1;
        });
        if (t) { mutT.push([performance.now(), t]); if (mutT.length > 3000) mutT.splice(0, 1500); }
      });
      mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      const obs = [];
      try {
        const o = new PerformanceObserver((l) => l.getEntries().forEach((e) => {
          st.resN++;
          const k = `${e.initiatorType} ${__scanShort(e.name)}`;
          st.res[k] = (st.res[k] || 0) + 1;
          resT.push([performance.now(), __scanShort(e.name)]);
        }));
        o.observe({ type: 'resource' }); obs.push(o);
      } catch (e) { /* ignore */ }
      try {
        const o = new PerformanceObserver((l) => l.getEntries().forEach((e) => {
          if (e.duration < 150 || st.loaf.length >= 10) return;
          const sc = (e.scripts || []).slice(0, 3).map((x) => `${x.invoker || x.name || '?'} @ ${__scanShort(x.sourceURL || '') || 'inline'} ${Math.round(x.duration)}ms`).join(' ; ');
          st.loaf.push(`${Math.round(e.duration)}ms (${Math.round(e.blockingDuration || 0)}ms blocking) ${sc || 'no script: style/layout/paint or browser'}`);
        }));
        o.observe({ type: 'long-animation-frame' }); obs.push(o); st.loafOk = true;
      } catch (e) { /* not in this browser */ }
      try {
        const o = new PerformanceObserver((l) => l.getEntries().forEach((e) => { st.longN++; st.longMs += e.duration; }));
        o.observe({ type: 'longtask' }); obs.push(o); st.longOk = true;
      } catch (e) { /* not in this browser */ }
      for (let sec = LEN; sec > 0; sec--) {
        onStatus(`Scanning ${id} (${id === 'A' ? 'normal' : id === 'B' ? 'paused' : 'paused+hidden'}) ${sec}s \u2013 leave this tab in front`);
        await wait(1000);
      }
      window.clearInterval(hb);
      rafOn = false;
      mo.disconnect();
      obs.forEach((o) => { try { o.disconnect(); } catch (e) { /* ignore */ } });
      const dur = (performance.now() - t0) / 1000;
      const wrMs = Math.round(__perfTopMs() - wr0);
      __scanPause(false, false);
      const pct = (a) => (st.smp ? Math.round((a / st.smp) * 100) : 0);
      const top = (o, n) => Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, n).map((k) => `    ${o[k]}x ${k}`);
      out.push('', `== ${id}: ${name} (${Math.round(dur)}s, tab visible ${pct(st.vis)}%, focused ${pct(st.foc)}%)`,
        `  frozen (>50ms late): ${st.lagN} times, total ${Math.round(st.lagMs)}ms, worst ${Math.round(st.lagMax)}ms`,
        `  frames: ${st.frames} (${(st.frames / dur).toFixed(1)} fps), worst gap ${Math.round(st.gapMax)}ms, gaps >50ms: ${st.gaps}`,
        `  War Room script time: ${wrMs}ms`,
        `  page changes: Torn ${st.mutT}, War Room ${st.mutW}`);
      out.push('  busiest Torn changes:', ...(top(st.tg, 8).length ? top(st.tg, 8) : ['    none']));
      out.push(`  network requests: ${st.resN}`, ...top(st.res, 8));
      out.push(`  long tasks: ${st.longOk ? `${st.longN}, total ${Math.round(st.longMs)}ms` : 'n/a in this browser'}`);
      out.push(`  long frames: ${st.loafOk ? (st.loaf.length ? '' : 'none') : 'n/a in this browser'}`, ...st.loaf.map((x) => `    ${x}`));
      out.push('  freezes over 400ms:', ...(st.fz.length ? st.fz.map((x) => `    ${x}`) : ['    none']));
      summary.push(`${id}: frozen ${Math.round(st.lagMs)}ms, worst ${Math.round(st.lagMax)}ms, ${(st.frames / dur).toFixed(0)} fps, WR ${wrMs}ms, Torn changes ${st.mutT}`);
      await wait(1200);
    }
    out.splice(3, 0, 'SUMMARY  ' + summary.join('  ||  '));
    return out.join('\n');
  }
  function __copyText(ta, t) {
    let ok = false;
    try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(t, 'text'); ok = true; } } catch (e) { /* next */ }
    try { if (!ok) { ta.focus(); ta.select(); ok = document.execCommand('copy'); } } catch (e) { /* next */ }
    try { if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { /* ok */ }, () => { /* ignore */ }); } catch (e) { /* ignore */ }
    return ok;
  }

  let __perfBadge = null;
  let __perfBox = null;
  const __perfHist = [];
  __nativeSetInterval(() => {
    let on = true;
    try { on = ('Sandbox War Room'.indexOf('Sandbox') === 0 || pcMode()) && featureOn('perfMonitor'); } catch (e) { on = false; }
    if (!document.body || window.top !== window.self) return;
    if (!on) {
      if (__perfBadge) { __perfBadge.remove(); __perfBadge = null; }
      if (__perfBox) { __perfBox.remove(); __perfBox = null; }
      return;
    }
    if (!__perfBadge) {
      __perfBadge = document.createElement('div');
      __perfBadge.id = 'tws-perf-badge';
      __perfBadge.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483600;background:#111;color:#ddd;border:1px solid #555;border-radius:6px;padding:3px 7px;font:11px Arial,sans-serif;cursor:pointer;opacity:0.9;';
      __perfBadge.title = 'War Room performance monitor - tap for the full report';
      __perfBadge.addEventListener('click', () => {
        if (__perfBox) { __perfBox.remove(); __perfBox = null; return; }
        __perfBox = document.createElement('div');
        __perfBox.id = 'tws-perf-box';
        __perfBox.style.cssText = 'position:fixed;left:6px;bottom:34px;z-index:2147483600;width:min(760px,90vw);max-height:60vh;overflow:auto;background:#111;color:#ddd;border:1px solid #555;border-radius:6px;padding:8px;font:11px monospace;white-space:pre-wrap;';
        const txt = perfReport() + (__perfLastScan ? '\n\n' + __perfLastScan : '');
        if (!document.getElementById('tws-perf-box-css')) {
          const st = document.createElement('style');
          st.id = 'tws-perf-box-css';
          st.textContent = '#tws-perf-box, #tws-perf-box * { color: #f2f2f2 !important; -webkit-text-fill-color: #f2f2f2 !important; opacity: 1 !important; text-shadow: none !important; }'
            + ' #tws-perf-box .tws-pb-help { font: 12px Arial, sans-serif !important; color: #cfcfcf !important; -webkit-text-fill-color: #cfcfcf !important; margin: 0 0 6px; white-space: normal; }'
            + ' #tws-perf-box .tws-pb-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }'
            + ' #tws-perf-box button { flex: 1 1 auto; min-width: 90px; padding: 9px 12px !important; border-radius: 6px !important; font: bold 13px Arial, sans-serif !important; color: #fff !important; -webkit-text-fill-color: #fff !important; cursor: pointer; border: 1px solid rgba(255,255,255,.25) !important; }'
            + ' #tws-perf-box #tws-perf-copy { background: #1e5fa8 !important; }'
            + ' #tws-perf-box #tws-perf-scan { background: #2e7d32 !important; }'
            + ' #tws-perf-box #tws-perf-scan:disabled { background: #555 !important; }'
            + ' #tws-perf-box #tws-perf-close { background: #444 !important; flex: 0 0 auto; min-width: 0; }'
            + ' #tws-perf-box textarea { background: #0b0b0b !important; color: #f2f2f2 !important; -webkit-text-fill-color: #f2f2f2 !important; border: 1px solid #555 !important; font: 11px monospace !important; }';
          document.head.appendChild(st);
        }
        __perfBox.innerHTML = '<div class="tws-pb-help">Run 90s scan: leave Torn open and untouched for 1\u00bd minutes, then the result is copied \u2013 paste it to Claude.</div>'
          + '<div class="tws-pb-row"><button id="tws-perf-copy">Copy all</button>'
          + '<button id="tws-perf-scan">\ud83d\udd2c Run 90s scan</button>'
          + '<button id="tws-perf-close">\u2715</button></div>'
          + '<textarea readonly spellcheck="false" style="display:block;width:100%;box-sizing:border-box;height:45vh;white-space:pre;"></textarea>';
        __perfBox.querySelector('#tws-perf-close').addEventListener('click', (ev) => { ev.stopPropagation(); __perfBox.remove(); __perfBox = null; });
        const ta = __perfBox.querySelector('textarea');
        ta.value = txt;
        const scanBtn = __perfBox.querySelector('#tws-perf-scan');
        if (__scanBusy) { scanBtn.disabled = true; scanBtn.textContent = 'Scan running\u2026'; }
        scanBtn.addEventListener('click', () => {
          if (__scanBusy) return;
          __scanBusy = true;
          scanBtn.disabled = true;
          const box = __perfBox;
          __deepScan((m) => { if (box.isConnected) scanBtn.textContent = m; else if (__perfBadge) __perfBadge.title = m; })
            .then((res) => {
              __perfLastScan = res;
              const full = perfReport() + '\n\n' + res;
              ta.value = full;
              const ok = __copyText(ta, full);
              scanBtn.textContent = ok ? 'Scan done \u2013 copied \u2713' : 'Scan done \u2013 press Copy all';
            })
            .catch((e) => { scanBtn.textContent = `Scan failed: ${e && e.message}`; try { __scanPause(false, false); } catch (e2) { /* ignore */ } })
            .finally(() => { __scanBusy = false; scanBtn.disabled = false; });
        });
        __perfBox.querySelector('#tws-perf-copy').addEventListener('click', () => {
          const t2 = perfReport() + (__perfLastScan ? '\n\n' + __perfLastScan : '');
          ta.value = t2;
          // Every way we know, so it works in Tampermonkey, Violentmonkey and PDA.
          let ok = false;
          try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e) { /* next */ }
          try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(t2, 'text'); ok = true; } } catch (e) { /* next */ }
          try { if (navigator.clipboard) navigator.clipboard.writeText(t2).then(() => { /* ok */ }, () => { /* ignore */ }); } catch (e) { /* ignore */ }
          __perfBox.querySelector('#tws-perf-copy').textContent = ok ? 'Copied \u2713' : 'Selected - press Ctrl+C';
        });
        document.body.appendChild(__perfBox);
      });
      document.body.appendChild(__perfBadge);
    }
    const now = performance.now();
    __perfHist.push([now, __perfTopMs(), __perf.lagMs]);
    while (__perfHist.length && now - __perfHist[0][0] > 10000) __perfHist.shift();
    const first = __perfHist[0];
    const scriptMs = Math.round(__perfTopMs() - first[1]);
    const lagMs = Math.round(__perf.lagMs - first[2]);
    const bad = lagMs > 1000 || scriptMs > 500;
    const warn = lagMs > 200 || scriptMs > 150;
    __perfBadge.style.borderColor = bad ? '#d94c4c' : warn ? '#e0a030' : '#2e7d32';
    let modeTxt = '';
    try { const pm = perfMode(); modeTxt = `${pm.charAt(0).toUpperCase()}${pm.slice(1)}${(typeof turboMode !== 'undefined' && turboMode) ? '+Turbo' : ''} \u00b7 `; } catch (e) { /* ignore */ }
    __perfBadge.textContent = `\ud83d\udcc8 WR ${modeTxt}${scriptMs}ms/10s \u00b7 frozen ${lagMs}ms/10s${__perf.clickOk ? ` \u00b7 worst click ${Math.round(__perf.clickMax)}ms` : ''}`;
  }, 2000);


  const SCRIPT_VERSION = '1.99.39';

  // ---------------------------------------------------------------------
  // PLATFORM DETECTION
  // ---------------------------------------------------------------------
  // Torn PDA exposes PDA_httpGet/PDA_httpPost; Tampermonkey/Firefox does not.
  const IS_PDA = typeof PDA_httpGet !== 'undefined';

  // ---------------------------------------------------------------------
  // CONFIG / STORAGE
  // ---------------------------------------------------------------------
  const STORE_KEYS = {
    apiKey: 'tws_api_key',
    ownFactionId: 'tws_own_faction_id', // now just a cache of the auto-detected ID
    manualEnemyId: 'tws_manual_enemy_id', // retired (no longer used; cleared at start-up)
    lastEnemy: 'tws_last_enemy',
    lastWar: 'tws_last_war',
    warScores: 'tws_war_scores',
    reviveUrl: 'tws_revive_url',
    revives: 'tws_revives',
    reviveProvider: 'tws_revive_provider',
    colourTheme: 'tws_colour_theme',
    welcomeSeen: 'tws_welcome_seen',
    ownBattleStats: 'tws_own_bs',
    revivesFrom: 'tws_revives_from',
    ffCache: 'tws_ff_cache',
    bountyTiers: 'tws_bounty_tiers',
    collapsed: 'tws_collapsed',
    miniDock: 'tws_mini_dock',
    posTop: 'tws_pos_top',
    panelWidth: 'tws_panel_width',
    panelHeight: 'tws_panel_height',
    posLeft: 'tws_pos_left',
    ffscouterKey: 'tws_ffscouter_key',
    statsSource: 'tws_stats_source',
    bspKey: 'tws_bsp_key',
    tsKey: 'tws_ts_key',
    tsCache: 'tws_ts_cache',
    bspCache: 'tws_bsp_cache',
    turboMode: 'tws_turbo_mode',
    targetIds: 'tws_target_ids',
    bloodType: 'tws_blood_type',
    medItem: 'tws_med_item',
    popouts: 'tws_popouts',
    perfMode: 'tws_perf_mode',
    minPeople: 'tws_min_people',
  };

  // Contact / credit details shown in Settings.
  const CREDIT_NAME = '-TheKraken-';
  const CREDIT_ID = '3616083';

  // Fallback in-memory store in case GM_setValue/GM_getValue misbehave under
  // PDA's compatibility shim (its docs warn it won't behave identically to
  // Tampermonkey). Values still won't persist across reloads in that case,
  // but the script won't hard-crash.
  const memStore = {};

  const CFG_PREFIX = 'sbx_';
  // Settings are read about 1,000 times a second, and on desktop every storage
  // read is slow. Where the script manager tells us about changes made in other
  // tabs, keep settings in memory and only re-read a value another tab changed.
  const CFG_CACHE_ON = typeof GM_addValueChangeListener === 'function';
  const cfgCache = new Map();
  function getCfg__raw(k, def = '') {
    if (CFG_CACHE_ON && cfgCache.has(k)) {
      const v = cfgCache.get(k);
      return v === undefined ? def : v;
    }
    let v;
    try {
      v = GM_getValue(CFG_PREFIX + k, undefined);
    } catch (e) {
      return k in memStore ? memStore[k] : def;
    }
    if (CFG_CACHE_ON) {
      cfgCache.set(k, v);
      try {
        GM_addValueChangeListener(CFG_PREFIX + k, (name, oldV, newV, remote) => {
          if (remote) cfgCache.delete(k); // changed in another tab: re-read next time
        });
      } catch (e) { /* ignore */ }
    }
    return v === undefined ? def : v;
  }

  function setCfg__raw(k, v) {
    if (CFG_CACHE_ON) cfgCache.set(k, v);
    try {
      GM_setValue(CFG_PREFIX + k, v);
    } catch (e) {
      memStore[k] = v;
    }
  }

  // The manual enemy-faction override was removed from Settings; make sure a
  // value saved by an older version can't linger and be silently ignored.
  if (getCfg(STORE_KEYS.manualEnemyId)) setCfg(STORE_KEYS.manualEnemyId, '');

  function getApiKey() {
    // On PDA, the placeholder gets swapped for the real key before this code
    // ever runs, so if it no longer matches the placeholder, use it directly.
    if (IS_PDA && PDA_INJECTED_KEY !== '###PDA-APIKEY###') {
      return PDA_INJECTED_KEY;
    }
    return getCfg(STORE_KEYS.apiKey);
  }

  // ---------------------------------------------------------------------
  // FEATURE REGISTRY  (drives ⚙ Settings -> Advanced)
  // ---------------------------------------------------------------------
  // EVERY optional feature of this script is listed here exactly once. The
  // Advanced settings tab builds its on/off toggles from this list, and each
  // feature's code checks featureOn('<key>').
  //
  // >>> RULE: any NEW feature must be added to this list (with a toggle) and
  // >>> gated with featureOn() where it runs. <<<
  //
  //   key      unique id (stored as tws_feat_<key> unless `store` is given)
  //   group    heading the toggle appears under
  //   label    text next to the checkbox
  //   hint     optional small grey line under the label
  //   requires optional parent feature key (child is off whenever parent is)
  //   store    optional legacy storage key (keeps settings saved by older
  //            versions -- popouts and minPeople used to be plain checkboxes)
  // Everything defaults to ON.
  //
  // (Turbo refresh is not listed here: it is itself an on/off setting, with
  // its own checkbox in ⚙ Settings -> General. The bounty AMOUNTS and REASON
  // wording are edited in Advanced -> 💰 Bounty amounts.)
  const FEATURES = [
    // --- Panel & pages ---
    { key: 'creditAlerts', group: 'Panel & pages', label: '\ud83c\udf9f\ufe0f War credit reminders', hint: 'A note in the panel when you\u2019re out of war credits, and a heads-up when your faction draws a war and you have none.' },
    { key: 'referrals', group: 'Panel & pages', label: '\ud83c\udf81 Referrals box in Settings (and the reminder during your trial)', hint: 'Enter who referred you, and see your own referral ID and the free weeks you\u2019ve earned.' },
    { key: 'everyPage', group: 'Panel & pages', label: 'Run on every Torn page (off = faction pages only)', hint: 'Keeps the timers, chain alerts, 🩸 and chat working wherever you are in Torn. Takes effect the next time a page loads.' },
    { key: 'fixedTop', group: 'Panel & pages', label: 'Keep chain timers and tabs fixed at the top of the panel', hint: 'Off = they scroll away with the member list, like older versions.' },
    { key: 'perfMonitor', group: '\ud83d\udda5\ufe0f PC Mode', label: '\ud83d\udcc8 Performance monitor badge', hint: 'PC Mode only. Small badge bottom-left showing how much time War Room uses and how long the browser freezes; tap it for a report you can copy.' },
    { key: 'wideAtkLog', group: '\ud83d\udda5\ufe0f PC Mode', label: '\ud83d\udcdc Attacks log column', hint: 'PC Mode only. Your faction\u2019s attacks, newest first, with a Retal link on hits against you. Same data as Retal, so no extra API calls during a war.' },
    { key: 'hospBanner', group: 'Panel & pages', label: '\u271a Hospital banner: your health and hospital timer in the title while you\u2019re in hospital', hint: 'Stays up until you\u2019re out. One extra API call per roster refresh, only while you\u2019re in hospital.' },
    { key: 'startMinimized', group: 'Panel & pages', label: 'Start minimised in the top-left corner when a new Torn tab opens', hint: 'Once per tab / app start. After that the panel stays however you leave it while you move around Torn.' },
    { key: 'miniLogo', group: 'Panel & pages', label: 'Minimised panel shows the Kraken logo icon', hint: 'Off = the minimised panel is the plain title bar.' },

    // --- Header buttons ---
    { key: 'fitHeader', group: 'Header buttons', label: '\ud83d\udcf1 Keep the header buttons clear on narrow screens', hint: 'When there isn\u2019t room: the title shrinks to \ud83d\udc19 first, then the enemy faction name is hidden (it\u2019s only shown when it fits in full).' },
    { key: 'btnBlood', group: 'Header buttons', label: '🩸 Blood bag / medical armoury button' },
    { key: 'btnItems', group: 'Header buttons', label: 'Grenade button: quick link to Items → Temporary' },
    { key: 'tempPreload', group: 'Header buttons', label: 'Keep Items \u2192 Temporary pre-loaded for the grenade button (opens instantly) (PC Mode)', hint: 'Loads once in the background and stays loaded, with no timed reloads. Use \u21bb in the pop-out to refresh it. Needs the Items pop-out on.', requires: 'btnItems' },
    { key: 'btnTravel', group: 'Header buttons', label: '\u2708\ufe0f Quick escape: plane button opens the Travel Agent', hint: 'Tapping the plane opens the Travel Agent in a pop-out, ready to pick a destination and fly. It stays loaded after that until you close the tab (Use \u21bb to refresh it).' },
    { key: 'btnClock', group: 'Header buttons', label: '\ud83d\udd52 Torn City Time clock next to the title (PC Mode)', hint: 'Day and time in TCT (Torn City Time), updated every second. No API calls.' },
    { key: 'btnDrug', group: 'Header buttons', label: '\ud83c\udf3f Drug cooldown bar in the top banner (PC Mode)', hint: 'Time left on your drug cooldown, counting down every second. Reads it from the API when Torn opens and at most every 10 minutes (or straight away when Torn shows a new drug cooldown), and counts down itself in between.' },
    { key: 'btnEnergy', group: 'Header buttons', label: '\u26a1 Energy bar in the top banner (PC Mode)', hint: 'Read every second from Torn\u2019s own energy bar on the page, so it costs no API calls. On the few pages without one it reads your energy once and counts the energy ticks itself.' },
    { key: 'btnRevive', group: 'Header buttons', label: 'Rev button: request a self revive from your chosen revive service' },

    // --- Roster display ---
    { key: 'nameColors', group: 'Roster display', label: 'Colour names by online status' },
    { key: 'onlineFlash', group: 'Roster display', label: 'Flash names that are online and attackable' },
    { key: 'travelFlags', group: 'Roster display', label: 'Country flags: travelling, abroad, or in an overseas hospital', hint: 'Shown next to the status / hospital timer.' },
    { key: 'travelTimers', group: 'Roster display', label: '✈ Estimated landing timers for travellers', hint: 'Assumes Airstrip unless the player\u2019s usual method has been learned from a past flight. Tap a travel timer to see every method, and tap a method to make it that member\u2019s default.' },
    { key: 'travelShared', group: 'Roster display', label: '✈ Shared travel tracking (Kraken server)', hint: 'During a war the server watches the enemy roster once a minute, so take-offs are caught even when nobody has the panel open. Only the enemy faction ID and your player ID are sent.', requires: 'travelTimers' },
    { key: 'activityHistory', group: 'Roster display', label: '\ud83d\udcca Activity history (Kraken server)', hint: 'Above the enemy list: how many of them are usually online at this hour, and the quietest hours to hit them. Learned by the Kraken server over time; only the enemy faction ID and your player ID are sent.' },
    { key: 'ffStats', group: 'Roster display', label: 'Estimated battle stats (FFScouter or BSP)', hint: 'Off also stops the FFScouter / BSP requests. Pick which one in the main Settings tab. Stats are cached so they stay on screen.' },
    { key: 'tsSpies', group: 'Roster display', label: '\ud83d\udd75 TornStats spies: real battle stats instead of estimates', hint: 'Needs your TornStats key in General. Uses the spies your faction has shared on TornStats (spies up to 60 days old replace the estimate; older ones are still shown with their age). Kept on this device only \u2013 never sent to the Kraken server.' },
    { key: 'sortBar', group: 'Roster display', label: 'Sort bar (Timer / Stats / Respect / direction)' },
    { key: 'respectSort', group: 'Roster display', label: 'Respect option in the sort bar', hint: 'Shows name, level, stats and this war\u2019s respect. Only appears during a war.', requires: 'sortBar' },
    { key: 'filterBar', group: 'Roster display', label: 'Filter chips (Online / Idle / Offline ...)' },

    // --- Roster actions ---
    { key: 'targets', group: 'Roster actions', label: '☆ Target stars + Target tab' },
    { key: 'starHold', group: 'Roster actions', label: '\u2605 Targets list: hold the star for half a second to remove a target', hint: 'Stops targets being removed by an accidental tap. Off = a single tap removes them.', requires: 'targets' },
    { key: 'targetCards', group: 'Roster actions', label: '\ud83d\udcc8 Stat cards on starred targets', hint: 'In the Target tab, tap \ud83d\udcc8 on a starred target for their last 5 ranked wars (war hits, hours played) and what they\u2019ve taken since the upcoming war was drawn. Uses your own API key, only when you open a card.', requires: 'targets' },
    { key: 'copyIcons', group: 'Roster actions', label: '⧉ Copy / send-to-faction-chat icon (Enemy tabs)' },
    { key: 'attackSos', group: 'Roster actions', label: '🆘 SOS button on the attack page', hint: 'Small red button in the Faction chat header (attack page, chat open) that puts "HELP NEEDED!" plus the target\u2019s name, level, estimated stats and attack link into faction chat (or copies it if chat isn\u2019t open).' },
    { key: 'onlineHitNow', group: 'Roster actions', label: 'Copy adds "ONLINE HIT NOW!" for targets who are online and out of hospital', requires: 'copyIcons' },
    { key: 'atkEtaCopy', group: 'Roster actions', label: 'Tap a hospitalised target\u2019s ATK to send its timer to chat', hint: 'e.g. \u201cKRAKEN IN 7:48\u201d \u2013 the time left on their hospital timer.' },
    { key: 'bountyIcons', group: 'Roster actions', label: '💰 Bounty icon on the Home tab', hint: 'Opens that faction mate\u2019s "place a bounty" page.' },
    { key: 'bountyAutofill', group: 'Roster actions', label: '💰 Auto-fill the bounty amount from their estimated stats', hint: 'Amounts are set in the 💰 Bounty amounts menu at the top of this tab.', requires: 'bountyIcons' },
    { key: 'bountyReason', group: 'Roster actions', label: '💰 Also fill in the bounty reason (default "War")', hint: 'The wording is set in the 💰 Bounty amounts menu.', requires: 'bountyIcons' },

    // --- Chat ---

    // --- Pop-out windows ---
    { key: 'popouts', group: 'Pop-out windows', label: 'Pop-out windows (master switch)', hint: 'Off = every link navigates normally.', store: STORE_KEYS.popouts },
    { key: 'popoutProfiles', group: 'Pop-out windows', label: 'Player names open their profile in a pop-out', requires: 'popouts' },
    { key: 'popoutAttacks', group: 'Pop-out windows', label: 'ATK opens the attack page in a pop-out', requires: 'popouts' },
    { key: 'popoutArmoury', group: 'Pop-out windows', label: '🩸 opens the medical armoury in a pop-out', hint: 'Used when One-tap use (below) is off.', requires: 'popouts' },
    { key: 'popoutItems', group: 'Pop-out windows', label: 'Grenade button opens Items → Temporary in a pop-out', requires: 'popouts' },
    { key: 'popoutFit', group: 'Pop-out windows', label: '\ud83d\udcd0 Fit pop-outs to the screen width', hint: 'Keeps the pop-out on screen and shrinks a page that is wider than the pop-out (e.g. the attack page on narrow phones) so nothing is cut off.', requires: 'popouts' },
    { key: 'popoutIntel', group: 'Pop-out windows', label: '\ud83d\udc19 Full Kraken Intel inside pop-outs (loadouts, armour, temp & job warnings, profile panel)', hint: 'Runs a small copy of the Intel part of War Room inside the pop-out page, on Torn PDA too. Off = pop-outs only get the loadout shown in Torn\u2019s own display.', requires: 'popouts' },
    { key: 'popoutStats', group: 'Pop-out windows', label: '\ud83d\udcca Estimated stats (FFScouter / BSP) in the pop-out bar', hint: 'Other stat scripts can\u2019t run inside a pop-out, so War Room shows FF and the estimate for the player on a profile or attack page. Needs Estimated battle stats on.', requires: 'popouts' },
    { key: 'popoutBounty', group: 'Pop-out windows', label: '💰 Bounty icon opens the bounty page in a pop-out', hint: 'Needed for the form to be filled in for you; otherwise the amount is copied instead.', requires: 'popouts' },

    // --- Blood bags ---
    { key: 'bloodQuickUse', group: 'Blood bags', label: '🩸 One-tap use: the header 🩸 uses your bag instantly, no confirmation', hint: 'Needs your blood type set in General. Off = 🩸 opens the armoury pop-out instead.' },
    { key: 'bloodPreload', group: 'Blood bags', label: 'Keep the armoury pre-loaded in the background (fastest)', hint: 'Off = the first tap has to load the armoury first (a few seconds). Reloads after each use and every 8 minutes.', requires: 'bloodQuickUse' },
    { key: 'bloodHighlight', group: 'Blood bags', label: 'Mark safe / unsafe bags in the armoury', hint: 'Needs your blood type set in General.' },
    { key: 'medOwnItems', group: 'Blood bags', label: '🩸 If the faction armoury has none, use one from your own Items', hint: 'Applies to blood bags and med kits. Off = armoury only.' },
    { key: 'bloodLifeToast', group: 'Blood bags', label: '🩸 Flash your health % in the panel title after each blood bag / med item use', hint: 'e.g. "Health 82%" for about 8 seconds (a pop-up message instead while the panel is minimised). One extra API call per use.' },
    { key: 'bloodPicker', group: 'Blood bags', label: '🩸✓ Safe-bag picker button (pop-out bar, asks to confirm)', hint: 'Needs your blood type set in General.' },

    // --- Chain & war ---
    { key: 'chainAudio', group: 'Chain & war', label: 'Audible chain alerts (1:00 and 0:30 beeps)', def: false },
    { key: 'upcomingWar', group: 'Chain & war', label: 'Upcoming-war countdown notice' },
    { key: 'warResult', group: 'Chain & war', label: '🏁 Ranked-war result message under the chain boxes', hint: 'Says who won when a war ends. Shown until the next ranked war is matched.' },
    { key: 'keepEnemyAfterWar', group: 'Chain & war', label: 'Keep the last enemy\u2019s roster showing after a war ends', hint: 'The Enemy tab stays until the next ranked war is matched.' },
    { key: 'retalDetect', group: 'Chain & war', label: 'Retal button: shows "Retal" instead of "ATK" during a 5-minute retaliation window', hint: 'Needs a successful enemy hit on your faction within the last 5 minutes. One extra API call every 20s during a war.' },
    { key: 'retalShared', group: 'Chain & war', label: '\u26a1 Shared Retal (Kraken server)', hint: 'Lets Retal work for members without faction API access, using a key a faction member has shared. No extra API calls from you; falls back to your own key if your faction has no shared key.', requires: 'retalDetect' },
    { key: 'atkLog', group: 'Chain & war', label: '\ud83d\udcdc Attacks tab: your faction\u2019s attacks as a live log', hint: 'Outgoing and incoming hits, newest first, with Retal and Outside Hit badges. Uses the same data as Retal: free with a shared Retal key, otherwise one call every 20s from your key while the tab is open (needs faction API access).' },

    // --- Kraken Intel (integrated) ---
    { key: 'kiShowIntel', group: 'Kraken Intel', label: '🐙 Show shared loadout intel on profile & attack pages', hint: 'Loadouts other contributors have observed. Uses your Torn API key for armour enrichment.' },
    { key: 'profileAttack', group: 'Kraken Intel', label: '\u2694 Profile pages: Attack button always opens the attack page', hint: 'Torn greys out the Attack button while a player is in hospital. This makes it work anyway (and adds a \u2694 Attack button if Torn\u2019s own can\u2019t be found), so you can be on the attack page ready for when they come out.' },
    { key: 'kiTempWarn', group: 'Kraken Intel', label: '\u26a0 Warn when their armour blocks or weakens temporaries', hint: 'From their Intel loadout, e.g. a Delta Gas Mask makes Pepper Spray, Tear Gas and Nerve Gas useless, and Delta armour makes other temps less effective. Big warning on their profile and the attack page, a pop-up when the fight page opens, and your own Temporary slot is marked if it won\u2019t work.' },
    { key: 'kiJobWarn', group: 'Kraken Intel', label: '\ud83d\udcbc Show the enemy\u2019s job perks that affect a fight', hint: 'Reads their job and company stars from the Torn API (cached a day). E.g. Ladies Strip Club 10\u2605 takes 30% less melee damage.' },
    { key: 'kiContribute', group: 'Kraken Intel', label: '🐙 Share loadouts you observe with the Kraken Intel network', hint: 'On by default. Loadouts Torn reveals on attack pages you personally view get uploaded -- never your API key. You can switch it off here.' },
  ];

  const FEATURE_MAP = {};
  FEATURES.forEach((f) => { FEATURE_MAP[f.key] = f; });

  function featureStoreKey(f) {
    return f.store || `tws_feat_${f.key}`;
  }

  // The toggle's own saved value (ignores its parent).
  function featureStored(key) {
    const f = FEATURE_MAP[key];
    if (!f) return true;
    const v = getCfg(featureStoreKey(f), f.def === false ? false : true);
    return v !== false && v !== 'false';
  }

  // Is the feature actually active? (its own toggle AND its parent's)
  // Torn rules: these did work in the background (hidden pages / automated
  // requests), so they are permanently off and hidden from Features.
  const COMPLIANCE_OFF = new Set(['bloodQuickUse', 'bloodPreload', 'tempPreload']);
  // Analytics only ever exists in the Sandbox build.
  const IS_SBX_BUILD = 'Sandbox War Room'.indexOf('Sandbox') === 0; // false in the Krakens War Room build
  const SANDBOX_ONLY = 'Sandbox War Room'.indexOf('Sandbox') === 0 ? new Set() : new Set(['perfMonitor', 'activityHistory']); // activityHistory: Sandbox-only until tested
  function featureOn(key) {
    if (COMPLIANCE_OFF.has(key) || SANDBOX_ONLY.has(key)) return false;
    const f = FEATURE_MAP[key];
    if (!f) return true;
    if (f.requires && !featureOn(f.requires)) return false;
    return featureStored(key);
  }

  function setFeature(key, on) {
    const f = FEATURE_MAP[key];
    if (f) setCfg(featureStoreKey(f), !!on);
  }

  function popoutsEnabled() {
    return featureOn('popouts');
  }

  // ---------------------------------------------------------------------
  // CRASH REPORTER (v1.84.1)
  // If any part of the script fails, the rest keeps running and a small red
  // box shows the error (once per kind) so it can be screenshotted.
  // ---------------------------------------------------------------------
  const crashSeen = {};
  function reportCrash(where, e) {
    try {
      const msg = (e && (e.message || String(e))) || 'unknown error';
      const key = `${where}:${msg}`;
      if (crashSeen[key]) return;
      crashSeen[key] = true;
      const stack = (e && e.stack ? String(e.stack) : '').split('\n').slice(0, 3).join(' | ');
      try { console.error('[Sandbox War Room]', where, e); } catch (e2) { /* ignore */ }
      if (!document.body) return;
      let box = document.getElementById('tws-crash');
      if (!box) {
        box = document.createElement('div');
        box.id = 'tws-crash';
        box.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:2147483646;background:#4a1e1e;color:#ffd0d0;border:1px solid #d94c4c;border-radius:8px;padding:8px 10px;font:12px/1.35 Arial,sans-serif;max-height:40vh;overflow:auto;';
        box.addEventListener('click', () => box.remove());
        document.body.appendChild(box);
      }
      const line = document.createElement('div');
      line.style.marginBottom = '4px';
      line.textContent = `Sandbox War Room v${SCRIPT_VERSION} error in ${where}: ${msg}${stack ? ` [${stack.slice(0, 300)}]` : ''}`;
      box.appendChild(line);
      if (!box.dataset.hint) {
        box.dataset.hint = '1';
        const hint = document.createElement('div');
        hint.style.opacity = '0.7';
        hint.textContent = 'Screenshot this for -TheKraken-. Tap to close.';
        box.appendChild(hint);
      }
    } catch (e3) { /* never let the reporter itself break anything */ }
  }

  // ---------------------------------------------------------------------
  // PERFORMANCE MODE (v1.83.0)  -- ⚙ Settings -> General
  //   full     : roster every 10s, armoury always pre-loaded, panel redrawn
  //              every second, every tab keeps working.
  //   balanced : roster every 15s, armoury only loaded when 🩸 is used and
  //              closed after 5 min idle, timers updated in place, hidden
  //              tabs pause (and refresh instantly when you come back).
  //   lite     : as balanced, roster every 20s, no flashing animations.
  // Every feature works in every mode. Turbo still overrides the roster rate.
  // ---------------------------------------------------------------------
  const PERF_ROSTER_MS = { full: 10000, balanced: 15000, lite: 20000 };
  const PERF_IDLE_CLOSE_MS = 5 * 60 * 1000;
  function perfMode() {
    const v = getCfg(STORE_KEYS.perfMode, 'balanced');
    return (v === 'balanced' || v === 'lite') ? v : 'full';
  }
  // Balanced/Lite: a tab you're not looking at does nothing.
  function perfPaused() {
    return perfMode() !== 'full' && document.visibilityState === 'hidden';
  }

  // ---------------------------------------------------------------------
  // OWN FACTION ID (always auto-detected)
  // Torn's API returns the key owner's own faction when no ID is passed
  // (faction/?selections=basic). The detected ID is cached so a new page load
  // has it instantly, and re-checked in the background on every load, so
  // changing faction is picked up. (There is no manual override any more.)
  // ---------------------------------------------------------------------
  let autoOwnFactionId = null;

  function getOwnFactionId() {
    return autoOwnFactionId || getCfg(STORE_KEYS.ownFactionId) || '';
  }

  async function detectOwnFaction() {
    try {
      const data = await apiFetch('faction', 'basic');
      const id = data.ID || data.id;
      const fname = data.name || (data.basic && data.basic.name) || '';
      if (fname && getCfg('tws_own_faction_name', '') !== fname) setCfg('tws_own_faction_name', String(fname));
      if (id) {
        autoOwnFactionId = String(id);
        if (getCfg(STORE_KEYS.ownFactionId) !== autoOwnFactionId) {
          setCfg(STORE_KEYS.ownFactionId, autoOwnFactionId);
        }
      }
    } catch (e) {
      // leave unresolved -- the caller's own error handling will surface
      // this via lastError if nothing else fills it in
    }
  }

  async function ensureOwnFactionId() {
    // The name is needed to recognise the faction chat box (Torn titles it with it).
    if (getOwnFactionId() && getCfg('tws_own_faction_name', '')) return;
    await detectOwnFaction();
  }

  const NORMAL_HOSPITAL_POLL_MS = 20000; // re-fetch enemy roster every 20s
  const NORMAL_CHAIN_POLL_MS = 10000;    // re-fetch chain every 10s
  // Turbo intervals are picked to stay well under Torn's ~100 req/min-per-key
  // limit and FFScouter's 20 req/min limit even with both rosters + both
  // chains + FF stats all polling. One caveat worth knowing: this budget is
  // shared with any OTHER tool using the same Torn API key (PDA itself,
  // other scripts) -- if you hit rate-limit errors with turbo on, that's
  // almost certainly why.
  const TURBO_HOSPITAL_POLL_MS = 5000;   // re-fetch enemy roster every 5s
  const TURBO_CHAIN_POLL_MS = 3000;      // re-fetch chain every 3s
  const TICK_MS = 1000;           // local countdown tick
  const RESPECT_REFRESH_MS = 90 * 1000; // re-fetch respect while that view is open

  // ---------------------------------------------------------------------
  // API HELPER
  // Tampermonkey/Firefox: GM_xmlhttpRequest (dodges CORS entirely).
  // Torn PDA: PDA_httpGet, which returns a Promise. NOTE: the exact shape of
  // the resolved object isn't documented publicly beyond "resembles the GM
  // API response" -- this code checks a few likely fields (.responseText,
  // .body, .data) and falls back to treating the resolved value itself as
  // the body. If this errors on-device, tell me what the resolved object
  // actually looks like (e.g. console.log it) and I'll fix the parsing.
  // ---------------------------------------------------------------------
  function httpGetJson__raw(url) {
    if (IS_PDA) {
      // PDA resolves with nothing when a request is dropped mid-flight --
      // which happens on almost every page change, as the new page fires
      // several calls at once. Retry a few times instead of failing.
      const attempt = (n) => Promise.resolve()
        .then(() => PDA_httpGet(url, {}))
        .then((res) => {
          const empty = res === undefined || res === null || res === '' ||
            (typeof res === 'object' && !res.responseText && !res.response && !res.body && !res.data);
          if (empty && n < 3) {
            return new Promise((r) => setTimeout(r, 500 * (n + 1))).then(() => attempt(n + 1));
          }
          if (empty) throw new Error('Torn PDA returned an empty response — retrying next update.');
          // PDA's docs say this "resembles" Tampermonkey's GM_xmlhttpRequest
          // response object, which uses .response (not just .responseText) --
          // trying that too in case that's the actual field name here.
          const bodyText =
            (res && res.responseText) ||
            (res && res.response) ||
            (res && res.body) ||
            (res && res.data) ||
            (typeof res === 'string' ? res : null);
          if (bodyText == null) {
            // Self-diagnosing: dump what PDA actually returned so the next
            // failure (if any) shows the real shape instead of a guess.
            let dump;
            try {
              dump = JSON.stringify(res);
            } catch (e2) {
              dump = String(res);
            }
            throw new Error(`Unrecognized PDA_httpGet response shape: ${(dump || '').slice(0, 200)}`);
          }
          return typeof bodyText === 'string' ? JSON.parse(bodyText) : bodyText;
        });
      return attempt(0);
    }

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 10000,
        onload: (res) => {
          try {
            resolve(JSON.parse(res.responseText));
          } catch (e) {
            if (res.status && res.status >= 400) {
              reject(new Error(`HTTP ${res.status}: ${(res.responseText || '').slice(0, 120)}`));
            } else {
              reject(e);
            }
          }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }

  function apiFetch(endpoint, selections) {
    const key = getApiKey();
    if (!key) return Promise.reject(new Error('No API key set'));
    const url = `https://api.torn.com/${endpoint}?selections=${selections}&key=${encodeURIComponent(key)}&comment=sandboxwar`;
    return httpGetJson(url).then((data) => {
      if (data.error) {
        throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
      }
      return data;
    });
  }

  function fetchFactionBasic(factionId) {
    return apiFetch(`faction/${factionId}`, 'basic');
  }

  // Combined call for OUR OWN faction only -- Torn's API merges multiple
  // selections' fields into one response at no extra request cost, so this
  // bundles the roster data we already need with war-matchup detection,
  // rather than being a separate call.
  function fetchOwnFactionBasicAndWars(factionId) {
    return apiFetch(`faction/${factionId}`, 'basic,rankedwars');
  }

  // "factions" hasn't been confirmed firsthand as dict-keyed-by-ID vs an
  // array of faction records -- handling both shapes here rather than
  // guessing wrong. Crucially, whichever shape it turns out to be, the only
  // IDs accepted are ones that look like actual Torn faction IDs (digits
  // only) -- a non-numeric key (e.g. a descriptive "home"/"opponent" label,
  // if that's what this field actually uses) must never be treated as a
  // real ID, since passing a bogus ID to the enemy-roster fetch risks Torn
  // silently falling back to the API key owner's own faction -- which is
  // exactly what was showing our own roster in the Enemy tab.
  function extractFactionIds(factions) {
    if (!factions) return [];
    const raw = Array.isArray(factions)
      ? factions.map((f) => (f && (f.id !== undefined ? f.id : f.ID)))
      : Object.keys(factions);
    return raw
      .filter((id) => id !== undefined && id !== null)
      .map(String)
      .filter((id) => /^\d+$/.test(id));
  }

  // A faction's name out of a war record's "factions" (same two shapes).
  function factionNameIn(factions, id) {
    if (!factions) return null;
    if (Array.isArray(factions)) {
      const f = factions.find((x) => x && String(x.id !== undefined ? x.id : x.ID) === String(id));
      return (f && f.name) || null;
    }
    return (factions[id] && factions[id].name) || null;
  }

  // Only counts a war as "the current one" if its start time falls within
  // the last ~9 days -- Torn only ever matches one ranked war at a time
  // with at least a week's gap between them, so anything older than that
  // is stale/historical data. Among any remaining candidates, the most
  // recently started one wins, not the oldest.
  const WAR_RECENCY_WINDOW_SEC = 9 * 86400;

  // The current (or upcoming) ranked war from your own faction's rankedwars
  // data, i.e. the one that hasn't ended: { enemyId, startTime, started }.
  // This is what lets the script know the enemy on ANY Torn page, not just
  // the war page. Torn's war record field names aren't 100% certain (older
  // API docs say start/end, newer say start_time/end_time), so BOTH spellings
  // are accepted -- guessing only one is what previously made every
  // historical war look "unfinished".
  function findActiveWar(rankedWarsObj, ownId) {
    const nowSec = Math.floor(Date.now() / 1000);
    let best = null;
    Object.values(rankedWarsObj || {}).forEach((entry) => {
      const w = (entry && entry.war) || {};
      const end = w.end_time || w.end || 0;
      if (end) return; // this one's already over, by Torn's own record
      const startTime = w.start_time || w.start || 0;
      if (!startTime) return; // no usable start time -- skip rather than guess
      if (startTime < nowSec - WAR_RECENCY_WINDOW_SEC) return; // too old to be current
      const ids = extractFactionIds(entry && entry.factions);
      const enemyId = ids.find((id) => id !== String(ownId));
      if (!enemyId) return;
      if (!best || startTime > best.startTime) {
        best = { enemyId, startTime, started: startTime <= nowSec };
      }
    });
    return best;
  }

  // ---------------------------------------------------------------------
  // LAST FINISHED WAR
  // The most recent ranked war Torn reports as over: who it was against,
  // when it ended and who won. Used for the "X defeated Y in a ranked war"
  // message under the chain boxes, and to keep that war's enemy roster on
  // screen until a new war is matched. Kept (and saved) for 30 days.
  //   { ownId, ownName, enemyId, enemyName, endTime, winnerId }
  // ---------------------------------------------------------------------
  const LAST_WAR_KEEP_SEC = 365 * 86400; // kept until the next war is matched
  let lastWar = null;
  try {
    const raw = JSON.parse(getCfg(STORE_KEYS.lastWar, 'null'));
    if (raw && raw.enemyId && isFinite(raw.endTime)) lastWar = raw;
  } catch (e) {
    lastWar = null;
  }

  function findLastEndedWar(rankedWarsObj, ownId, ownName) {
    let best = null;
    Object.entries(rankedWarsObj || {}).forEach(([warKey, entry]) => {
      const w = (entry && entry.war) || {};
      const end = w.end_time || w.end || 0;
      if (!end) return; // still running / upcoming
      const facs = entry && entry.factions;
      const ids = extractFactionIds(facs);
      const enemyId = ids.find((id) => id !== String(ownId));
      if (!enemyId) return;
      if (best && end <= best.endTime) return;
      const enemyName = factionNameIn(facs, enemyId);
      const myName = factionNameIn(facs, ownId) || ownName || null;
      // "winner" is normally the winning faction's ID; tolerate a name too.
      const rawWinner = w.winner;
      let winnerId = null;
      if (rawWinner !== undefined && rawWinner !== null && rawWinner !== '' && rawWinner !== 0) {
        const rw = String(rawWinner);
        if (/^\d+$/.test(rw)) winnerId = rw;
        else if (myName && rw === myName) winnerId = String(ownId);
        else if (enemyName && rw === enemyName) winnerId = String(enemyId);
      }
      best = { ownId: String(ownId), ownName: myName, enemyId: String(enemyId), enemyName, endTime: end, startTime: w.start_time || w.start || 0, winnerId, warId: /^\d+$/.test(String(warKey)) ? String(warKey) : null };
    });
    return best;
  }

  function saveLastWar(lw) {
    lastWar = lw;
    setCfg(STORE_KEYS.lastWar, JSON.stringify(lw));
  }

  function saveLastWarIfNewer(ended) {
    // A war from a different faction (you moved) is always replaced, even if newer.
    const otherFaction = lastWar && lastWar.ownId && ended.ownId && String(lastWar.ownId) !== String(ended.ownId);
    if (!lastWar || otherFaction || ended.endTime > lastWar.endTime) {
      saveLastWar(ended);
      return;
    }
    if (ended.endTime === lastWar.endTime) {
      const merged = {
        ...ended,
        winnerId: ended.winnerId || lastWar.winnerId || null,
        enemyName: ended.enemyName || lastWar.enemyName || null,
        ownName: ended.ownName || lastWar.ownName || null,
        warId: ended.warId || lastWar.warId || null,
        startTime: ended.startTime || lastWar.startTime || 0,
      };
      if (JSON.stringify(merged) !== JSON.stringify(lastWar)) saveLastWar(merged);
    }
  }

  // The saved last war, if it's recent enough to still matter.
  function validLastWar() {
    if (!lastWar) return null;
    if (Date.now() / 1000 - lastWar.endTime > LAST_WAR_KEEP_SEC) return null;
    // Changed faction since that war: it isn't your war any more.
    try {
      const own = getOwnFactionId();
      if (own && lastWar.ownId && String(own) !== String(lastWar.ownId)) return null;
    } catch (e) { /* ignore */ }
    return lastWar;
  }

  // Torn's own clock (TCT = UTC) in the same layout as its news feed:
  // "06:41:14 20/09/26".
  function fmtTct(sec) {
    const d = new Date(sec * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).slice(2)}`;
  }

  // The last enemy seen on the war page itself, kept for a few hours as a
  // fallback in case the API can't say who the enemy is. Dropped as soon as
  // Torn reports a finished war against that faction.
  const REMEMBER_ENEMY_MS = 6 * 3600 * 1000;

  function rememberEnemy(id) {
    if (!id) return;
    let r = null;
    try { r = JSON.parse(getCfg(STORE_KEYS.lastEnemy, 'null')); } catch (e) { r = null; }
    if (r && String(r.id) === String(id) && Date.now() - r.at < 10 * 60 * 1000) return;
    setCfg(STORE_KEYS.lastEnemy, JSON.stringify({ id: String(id), at: Date.now() }));
  }

  function getRememberedEnemy(rankedWarsObj) {
    let r = null;
    try { r = JSON.parse(getCfg(STORE_KEYS.lastEnemy, 'null')); } catch (e) { r = null; }
    if (!r || !r.id || Date.now() - r.at > REMEMBER_ENEMY_MS) return null;
    const ended = Object.values(rankedWarsObj || {}).some((entry) => {
      const w = (entry && entry.war) || {};
      const end = w.end_time || w.end || 0;
      const ids = extractFactionIds(entry && entry.factions);
      return !!end && ids.includes(String(r.id)) && end * 1000 > r.at - 60000;
    });
    return ended ? null : String(r.id);
  }

  function fetchChain(factionId) {
    return apiFetch(`faction/${factionId}`, 'chain');
  }

  // Torn's own chain clock, as drawn on the page (sidebar chain bar or the
  // faction chain box). Torn's API can hand back an answer that is several
  // seconds old (it caches), which made our home timer run 10-20s behind
  // Torn's. When Torn's clock is on the page, the home timer follows it.
  // Returns seconds left, or null when no clock is found.
  function readPageChainSecs() {
    const sels = [
      '#barChain [class*="bar-timeleft"]',
      '[class*="chain-box"] [class*="timeleft"]',
      '[class*="chain"] [class*="timeleft"]',
      '[class*="chain"] [class*="time-left"]',
      '[class*="chain"] [class*="timer"]',
    ];
    for (const s of sels) {
      let els;
      try { els = document.querySelectorAll(s); } catch (e) { continue; }
      for (const el of els) {
        if ((panel && panel.contains(el)) || el.closest('[class*="tws-"]')) continue;
        const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(el.textContent || '');
        if (!m) continue;
        const secs = Number(m[1]) * 60 + Number(m[2]);
        if (secs > 0 && secs <= 300) return secs;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // WAR RESPECT (fetched when the Respect sort option is selected, and
  // refreshed every 90s while that view stays open)
  // A single call to your own faction's attack log captures BOTH directions
  // at once: your members' outgoing hits on the enemy, and the enemy's
  // incoming hits on you (since your own faction's log includes attacks
  // where your members were the defender too). That means one fetch gives
  // per-member respect totals for both Home and Enemy sides without ever
  // needing access to the enemy faction's own key/log. Only counts hits
  // flagged as part of the actual ranked war.
  //
  // Caveat: Torn's attack log returns a batch of the most recent attacks,
  // not guaranteed to cover a long war's entire history -- this reflects
  // recent activity, not necessarily a complete war-to-date total.
  // ---------------------------------------------------------------------
  function fetchWarRespect(ownId, enemyId) {
    return apiFetch(`faction/${ownId}`, 'attacksfull').then((data) => {
      const attacks = data.attacksfull || data.attacks || {};
      const map = {};
      Object.values(attacks).forEach((a) => {
        if (!a) return;
        // v1's attacksfull doesn't reliably expose a ranked_war flag (that
        // appears to be v2-only) -- requiring it strictly excluded every
        // single record, which is why nothing showed up. Only exclude when
        // the field is explicitly false; otherwise fall back to just the
        // attacker/defender faction pairing as the war-hit signal.
        if (a.ranked_war === false) return;
        const af = String(a.attacker_faction);
        const df = String(a.defender_faction);
        const isOutgoing = af === String(ownId) && df === String(enemyId);
        const isIncoming = af === String(enemyId) && df === String(ownId);
        if (!isOutgoing && !isIncoming) return;
        const id = String(a.attacker_id);
        map[id] = (map[id] || 0) + (a.respect || 0);
      });
      return map;
    });
  }

  // ---------------------------------------------------------------------
  // FINISHED-WAR REPORT
  // Torn's official report for a finished ranked war: every member's exact
  // war "Score" (the figures on the war page). The recent-attacks log used
  // for live wars only covers the latest batch of attacks, so it comes out
  // lower than the real totals; the report is exact.
  // ---------------------------------------------------------------------
  function fetchWarReport(warId) {
    return apiFetch(`torn/${warId}`, 'rankedwarreport').then((data) => {
      const rep = data.rankedwarreport;
      if (!rep || !rep.factions) throw new Error('report not available yet');
      const scores = {};
      const names = {};
      Object.entries(rep.factions).forEach(([fid, f]) => {
        names[String(fid)] = (f && f.name) || null;
        const members = (f && f.members) || {};
        const list = Array.isArray(members)
          ? members.map((m) => [m && (m.id !== undefined ? m.id : m.ID), m])
          : Object.entries(members);
        list.forEach(([uid, m]) => {
          if (uid !== undefined && m && m.score !== undefined) scores[String(uid)] = Number(m.score) || 0;
        });
      });
      const w = rep.winner;
      return { scores, names, winnerId: (w !== undefined && w !== null && /^\d+$/.test(String(w)) && Number(w) > 0) ? String(w) : null };
    });
  }

  // ---------------------------------------------------------------------
  // EXACT LIVE WAR SCORES (only when the Respect view is open)
  // Pages through the WHOLE war's attack history (Torn's v2 attack log, 100
  // per call, oldest first, from the war's start) and adds up each attacker's
  // respect on attacks between the two war factions. What has been counted is
  // remembered (and saved), so later refreshes only fetch the attacks made
  // since, and a page reload doesn't start again.
  // ---------------------------------------------------------------------
  function fetchAttacksV2(fromTs, toTs) {
    const key = getApiKey();
    if (!key) return Promise.reject(new Error('No API key set'));
    let url = `https://api.torn.com/v2/faction/attacks?limit=100&sort=asc&from=${fromTs}&key=${encodeURIComponent(key)}&comment=sandboxwar`;
    if (toTs) url += `&to=${toTs}`;
    return httpGetJson(url).then((data) => {
      if (data.error) throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
      const list = data.attacks;
      return Array.isArray(list) ? list : Object.values(list || {});
    });
  }

  function atkStarted(a) {
    return Number(a.started || a.timestamp_started || 0);
  }

  function atkId(a) {
    return String(a.id !== undefined ? a.id : a.code);
  }

  let warScan = { seen: 0, paired: 0 }; // diagnostic for an empty Respect view
  // Chain milestone hits: Torn pays a bonus on these chain positions.
  const CHAIN_BONUS_POS = new Set([10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]);
  function addWarAttack(scores, a, ownId, enemyId, detail) {
    warScan.seen++;
    if (a.is_ranked_war === false) return;
    // v2 attacksfull: attacker.faction_id; v2 attacks: attacker.faction.id; v1: attacker_faction
    const facOf = (p, flat) => {
      if (p && p.faction_id !== undefined && p.faction_id !== null) return p.faction_id;
      if (p && p.faction && p.faction.id !== undefined) return p.faction.id;
      return flat;
    };
    const atkF = facOf(a.attacker, a.attacker_faction);
    const defF = facOf(a.defender, a.defender_faction);
    const af = String(atkF);
    const df = String(defF);
    const pair = (af === String(ownId) && df === String(enemyId)) || (af === String(enemyId) && df === String(ownId));
    if (!pair) return;
    warScan.paired++;
    const aid = a.attacker ? a.attacker.id : a.attacker_id;
    if (!aid) return;
    const gain = Number(a.respect_gain !== undefined ? a.respect_gain : a.respect) || 0;
    scores[String(aid)] = (scores[String(aid)] || 0) + gain;
    // Per-player breakdown: normal hits (count + respect) and chain bonus hits.
    if (detail && gain > 0) {
      const d = detail[String(aid)] || (detail[String(aid)] = { n: 0, sum: 0, b: [] });
      const pos = Number(a.chain || 0);
      if (CHAIN_BONUS_POS.has(pos)) d.b.push([pos, Math.round(gain * 100) / 100, atkStarted(a)]);
      else { d.n++; d.sum += gain; }
    }
  }

  async function buildWarScores(ownId, enemyId, startTs, endTs) {
    const cacheKey = `r3-${ownId}-${enemyId}-${startTs}-${endTs || 0}`;
    const c = (warScoreCache && warScoreCache.key === cacheKey)
      ? warScoreCache
      : { key: cacheKey, lastTs: startTs, ids: [], scores: {}, detail: {} };
    if (!c.detail) c.detail = {};
    for (let page = 0; page < 40; page++) {
      const attacks = await fetchAttacksV2(c.lastTs, endTs);
      const prevTs = c.lastTs;
      const atPrev = new Set(c.ids);
      let maxTs = prevTs;
      let fresh = 0;
      attacks.forEach((a) => {
        const st = atkStarted(a);
        if (st === prevTs && atPrev.has(atkId(a))) return; // already counted
        fresh++;
        addWarAttack(c.scores, a, ownId, enemyId, c.detail);
        if (st > maxTs) maxTs = st;
      });
      if (fresh === 0) break;
      c.lastTs = maxTs;
      c.ids = attacks.filter((a) => atkStarted(a) === maxTs).map(atkId)
        .concat(maxTs === prevTs ? Array.from(atPrev) : []);
      warScoreCache = c;
      try { setCfg(STORE_KEYS.warScores, JSON.stringify(c)); } catch (e) { /* ignore */ }
      if (attacks.length < 100) break;
      await sleep(250);
    }
    warScoreCache = c;
    return c.scores;
  }

  // One-off self-check, run in the background the first time the Respect view
  // is opened after a war: the calculated totals for that war against the
  // official report, so we can see whether the live method matches Torn.
  async function checkLiveMethod(lw, rep) {
    try {
      const calc = await buildWarScores(lw.ownId, lw.enemyId, lw.startTime, lw.endTime);
      let sumRep = 0;
      let sumCalc = 0;
      Object.keys(rep.scores).forEach((id) => {
        sumRep += rep.scores[id];
        sumCalc += calc[id] || 0;
      });
      warCheck = { sumRep, sumCalc, pct: sumRep ? ((sumCalc - sumRep) / sumRep) * 100 : 0 };
    } catch (e) {
      warCheck = { error: e.message };
    }
    safeRender();
  }

  function warCheckText(c) {
    if (c.error) return `Live-method check couldn't run: ${escHtml(c.error)}`;
    const ok = Math.abs(c.pct) < 1;
    return `Live-method check: calculated total ${Math.round(c.sumCalc).toLocaleString()} vs report ${Math.round(c.sumRep).toLocaleString()} (${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(1)}%) ${ok ? '✓ matches' : '⚠ differs, tell -TheKraken-'}`;
  }

  // ---------------------------------------------------------------------
  // RETALIATION DETECTION (Retal button)
  // A retal is attacking someone who successfully hit one of your faction
  // mates within the last 5 minutes, measured from when their attack
  // resolved (not when it started) -- any faction member can claim it, it
  // isn't tied to whoever was actually hit. Reuses the same paginated
  // attacks fetch as the exact live-respect feature, just windowed to the
  // last few minutes instead of the whole war, so it's cheap to poll.
  // ---------------------------------------------------------------------
  const RETAL_WINDOW_SEC = 5 * 60;
  const RETAL_POLL_MS = 30000; // the server checks Torn every 30s too
  let retalMap = {}; // enemy member id (string) -> unix seconds their last successful hit on us resolved

  // Result values that mean the ATTACKER didn't actually win the fight --
  // anything else counts as a successful hit. The exact wording Torn uses
  // isn't confirmed, so this list may need adjusting against real data.
  const FAILED_ATTACK_RESULTS = new Set(['Lost', 'Stalemate', 'Timeout', 'Interrupted', 'Escape', 'Assist']);

  function attackSucceeded(a) {
    const r = a.result || (a.attacker && a.attacker.result) || '';
    if (!r) return true; // unknown -- don't wrongly exclude a real hit
    return !FAILED_ATTACK_RESULTS.has(String(r));
  }

  function atkEnded(a) {
    return Number(a.ended || a.timestamp_ended || atkStarted(a)) || 0;
  }

  const RETAL_URL = 'https://dashing-fish-54.eu-west-1.convex.site/retal';
  const RETAL_SHARED_KEY = 'tws_retal_shared'; // this device's last known share state
  let retalSource = ''; // 'server' | 'own' | 'none' (shown in the owner's Advanced section)

  function buildRetalMap(attacks, ownId, enemyId) {
    const map = {};
    attacks.forEach((a) => {
      const atkF = (a.attacker && a.attacker.faction) ? a.attacker.faction.id : a.attacker_faction;
      const defF = (a.defender && a.defender.faction) ? a.defender.faction.id : a.defender_faction;
      if (String(atkF) !== String(enemyId) || String(defF) !== String(ownId)) return;
      if (!attackSucceeded(a)) return;
      const aid = a.attacker ? a.attacker.id : a.attacker_id;
      if (!aid) return;
      const ended = atkEnded(a);
      if (!ended) return;
      const key = String(aid);
      if (!map[key] || ended > map[key]) map[key] = ended;
    });
    // A faction mate putting them in hospital after their hit uses up the retal.
    attacks.forEach((a) => {
      const atkF = (a.attacker && a.attacker.faction) ? a.attacker.faction.id : a.attacker_faction;
      const defF = (a.defender && a.defender.faction) ? a.defender.faction.id : a.defender_faction;
      if (String(atkF) !== String(ownId) || String(defF) !== String(enemyId)) return;
      if (!isHospHit(a)) return;
      const did = String(a.defender ? a.defender.id : a.defender_id);
      const ended = atkEnded(a);
      if (map[did] && ended >= map[did]) delete map[did];
    });
    return map;
  }
  // Only a hospitalisation counts as taking the retal.
  function isHospHit(a) {
    const r = String(a.result || (a.attacker && a.attacker.result) || '');
    return /^hospitali[sz]ed$/i.test(r);
  }

  // The server's compact attack records, in the shape buildRetalMap reads.
  function fromServerAttack(x) {
    return {
      id: x.id,
      started: x.started,
      ended: x.ended,
      result: x.result,
      attacker: { id: x.aId, faction: { id: x.aF } },
      defender: { id: x.dId, faction: { id: x.dF } },
    };
  }

  async function refreshRetalWindow(ownId, enemyId) {
    if (!ownId) return;
    const wantRetal = featureOn('retalDetect') && !!enemyId;
    const keepLog = featureOn('atkLog'); // store anything fetched, even with the tab closed
    const wantLog = atkLogViewing();
    if (!wantRetal && !wantLog) return;
    const logDone = (src, err) => {
      atkLogSource = src;
      atkLogError = err || '';
      atkLogFetchedAt = Date.now();
      atkLogChanged();
    };
    // 1) Shared Retal: the faction's attacks, read by the Kraken server with a
    //    key a faction member shared. Costs this player no API calls.
    if (featureOn('retalShared') || wantLog) {
      try {
        const me = await accessMyId();
        if (me) {
          const d = await serverGet(`${RETAL_URL}?faction=${encodeURIComponent(ownId)}&me=${encodeURIComponent(me)}`);
          if (d && d.shared && !d.error && Array.isArray(d.attacks) && d.fetchedAt) {
            if (wantRetal) retalMap = buildRetalMap(d.attacks.map(fromServerAttack), ownId, enemyId);
            if (keepLog) ingestAtkLog(d.attacks);
            retalSource = 'server';
            logDone('server');
            return;
          }
        }
      } catch (e) { /* fall back to this player's own key */ }
    }
    // 2) This player's own key (only works with faction API access).
    try {
      const fromTs = Math.floor(Date.now() / 1000) - RETAL_WINDOW_SEC - 90; // small buffer
      const attacks = await fetchAttacksV2(fromTs, 0);
      if (wantRetal) retalMap = buildRetalMap(attacks, ownId, enemyId);
      if (keepLog) ingestAtkLog(attacks);
      retalSource = 'own';
      logDone('own');
    } catch (e) {
      retalSource = 'none';
      logDone('none', e && e.message);
      // silent -- keep the previous map rather than clearing it on a blip
    }
  }

  // ---- Attacks log (the "Attacks" tab) ----
  // Torn's names for results -> what the log shows ("Attacked" = left them).
  const ATKLOG_RESULT_NAMES = { Attacked: 'Left', Hospitalized: 'Hospitalised', Mugged: 'Mugged', Lost: 'Lost' };
  const ATKLOG_STORE = 'tws_atklog';
  const ATKLOG_MAX = 200;
  const ATKLOG_KEEP_SEC = 24 * 3600;
  let atkLog = null;
  let atkLogSource = '';
  let atkLogError = '';
  let atkLogFetchedAt = 0;
  let atkLogFilter = 'all'; // 'all' | 'out' | 'in'
  let atkLogSig = '';
  let atkLogSaveT = null;
  let atkLogKicked = false;

  function atkLogViewing() {
    if (wideLogOn()) return true; // PC Mode: the log has its own column
    return featureOn('atkLog') && viewSide === 'log' && !!panel
      && !showSettings && !getCfg(STORE_KEYS.collapsed, false);
  }
  // New data: redraw only if the tab is open and something visible changed.
  function atkLogChanged() {
    if (!atkLogViewing()) return;
    if (wideLogOn()) { renderAtkLog(); return; }
    if (atkLogSignature() !== atkLogSig) render();
  }
  function loadAtkLog() {
    if (atkLog) return atkLog;
    try { atkLog = JSON.parse(getCfg(ATKLOG_STORE, '[]')) || []; } catch (e) { atkLog = []; }
    if (!Array.isArray(atkLog)) atkLog = [];
    return atkLog;
  }
  function saveAtkLogSoon() {
    clearTimeout(atkLogSaveT);
    atkLogSaveT = setTimeout(() => {
      try { setCfg(ATKLOG_STORE, JSON.stringify(atkLog || [])); } catch (e) { /* ignore */ }
    }, 1500);
  }
  function numOr0(v) { return Number(v) || 0; }
  function firstDef() {
    for (let i = 0; i < arguments.length; i++) if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i];
    return undefined;
  }
  // Server records (aId/aName/...) or Torn v2 attack objects -> one shape.
  function normAtk(a) {
    if (!a) return null;
    if (a.aId !== undefined) {
      return {
        id: String(a.id), s: numOr0(a.started), e: numOr0(a.ended) || numOr0(a.started),
        aId: numOr0(a.aId), aN: String(a.aName || ''), aF: numOr0(a.aF),
        dId: numOr0(a.dId), dN: String(a.dName || ''), dF: numOr0(a.dF),
        r: String(a.result || ''), rs: numOr0(a.respect),
      };
    }
    const at = a.attacker || {};
    const df = a.defender || {};
    return {
      id: atkId(a), s: atkStarted(a), e: atkEnded(a),
      aId: numOr0(firstDef(at.id, a.attacker_id)), aN: String(firstDef(at.name, a.attacker_name, '')),
      aF: numOr0(firstDef(at.faction && at.faction.id, at.faction_id, a.attacker_faction)),
      dId: numOr0(firstDef(df.id, a.defender_id)), dN: String(firstDef(df.name, a.defender_name, '')),
      dF: numOr0(firstDef(df.faction && df.faction.id, df.faction_id, a.defender_faction)),
      r: String(a.result || ''), rs: numOr0(firstDef(a.respect_gain, a.respect)),
    };
  }
  function ingestAtkLog(list) {
    const log = loadAtkLog();
    const seen = new Set(log.map((x) => x.id));
    let added = 0;
    (list || []).forEach((raw) => {
      const x = normAtk(raw);
      if (!x || !x.id || seen.has(x.id)) return;
      seen.add(x.id);
      log.push(x);
      added++;
    });
    if (!added) return 0;
    const cutoff = Date.now() / 1000 - ATKLOG_KEEP_SEC;
    atkLog = log.filter((x) => x.e >= cutoff).sort((p, q) => q.e - p.e || q.s - p.s).slice(0, ATKLOG_MAX);
    saveAtkLogSoon();
    return added;
  }
  function tctTime(ts) {
    return ts ? new Date(ts * 1000).toISOString().slice(11, 19) : '--:--:--';
  }
  function atkLogList() {
    const ownId = String(getOwnFactionId() || '');
    // Only hits involving the faction you are in now (a faction change leaves the old log behind).
    return loadAtkLog().filter((x) => (!ownId || String(x.aF) === ownId || String(x.dF) === ownId)
      && (atkLogFilter === 'all'
      || (atkLogFilter === 'out' ? String(x.aF) === ownId : String(x.dF) === ownId)));
  }
  // Retal countdown shown inside the Retal button (time left in the window).
  function fmtRetalLeft(sec) {
    sec = Math.max(0, Math.floor(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  function retalTimerHtml(hitTs) {
    const until = Math.floor(hitTs + RETAL_WINDOW_SEC);
    return ` <span class="tws-retal-cd" data-retal-until="${until}">${fmtRetalLeft(until - Date.now() / 1000)}</span>`;
  }
  let retalExpiredRender = false;
  // ---------------------------------------------------------------------
  // 🆘 SOS button (attack page): calls the faction in on your current target.
  //   HELP NEEDED!
  //   Name (Lvl 28) - Est. stats: 105k - <attack link>
  // Name/level/stats come from the War Room rosters when the target is on
  // them; otherwise one Torn API call gets the name + level and the stats
  // come from the estimator (cached, same as the roster).
  // ---------------------------------------------------------------------
  let sosBusy = false;
  const sosInfoCache = {}; // id -> { name, level }
  async function sosTargetInfo(id) {
    const sid = String(id);
    const pools = [];
    try { pools.push(enemyMembers, homeMembers); } catch (e) { /* not loaded yet */ }
    let m = null;
    pools.forEach((list) => {
      if (!m && Array.isArray(list)) m = list.find((x) => String(x.id) === sid) || null;
    });
    let name = m ? m.name : '';
    let level = m ? m.level : '';
    let ff = m ? m.ff : null;
    if (!name && sosInfoCache[sid]) ({ name, level } = sosInfoCache[sid]);
    if (!name) {
      const key = getApiKey();
      if (key) {
        try {
          const d = await httpGetJson(`https://api.torn.com/user/${encodeURIComponent(sid)}?selections=basic&key=${encodeURIComponent(key)}&comment=sandboxwar`);
          if (d && !d.error && d.name) {
            name = d.name;
            level = d.level;
            sosInfoCache[sid] = { name, level };
          }
        } catch (e) { /* fall through */ }
      }
    }
    if (!ff && featureOn('ffStats')) {
      try {
        const r = await fetchFFStats([sid]);
        ff = (r && r.map && (r.map[sid] || r.map[Number(sid)])) || null;
      } catch (e) { ff = null; }
    }
    return { id: sid, name, level, ff };
  }
  function sosMessage(t) {
    const who = t.name ? `${t.name}${t.level ? ` (Lvl ${t.level})` : ''}` : `[${t.id}]`;
    const stats = (featureOn('ffStats') && t.ff && (t.ff.bs_estimate_human || t.ff.both)) ? ` - Est. stats: ${estText(t.ff)}` : '';
    return `HELP NEEDED!\n${who}${stats} - ${attackUrl(t.id)}`;
  }
  // Fills the given Faction chat textarea (the one whose header the SOS sits
  // in -- the page's own chat or the pop-out's), ready to send.
  function fillChatTextarea(ta, text) {
    if (!ta || !ta.isConnected) return false;
    const win = (ta.ownerDocument && ta.ownerDocument.defaultView) || window;
    ta.focus();
    ta.setRangeText(text, 0, ta.value.length, 'end');
    ta.dispatchEvent(new win.Event('input', { bubbles: true }));
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    return true;
  }
  async function onSosClick(btn, box) {
    if (sosBusy) return;
    const id = sosTargetId();
    if (!id) { showToast('SOS: no target on this page'); return; }
    sosBusy = true;
    btn.classList.add('tws-sos-busy');
    try {
      const t = await sosTargetInfo(id);
      const text = sosMessage(t);
      const ta = box && (box.querySelector('[class*="textarea___"]') || box.querySelector('textarea'));
      if (fillChatTextarea(ta, text)) {
        showToast('SOS ready in faction chat - tap send');
      } else {
        const ok = await copyToClipboard(text);
        showToast(ok ? 'SOS copied - paste it in faction chat' : 'SOS: could not copy');
      }
      if (navigator.vibrate) { try { navigator.vibrate([40, 40, 40]); } catch (e) { /* ignore */ } }
    } finally {
      sosBusy = false;
      btn.classList.remove('tws-sos-busy');
    }
  }

  // Attack target the SOS is for: an open pop-out showing an attack page
  // (it sits on top of everything), otherwise this page's own attack target.
  function sosTargetId() {
    try {
      if (popout && popout.root.style.display !== 'none' && !popout.root.classList.contains('tws-po-min')) {
        let href = popout.currentUrl || '';
        try {
          const loc = popout.frame.contentWindow && popout.frame.contentWindow.location.href;
          if (loc && loc !== 'about:blank') href = loc; // follows navigation inside the pop-out
        } catch (e) { /* not readable yet */ }
        if (href) {
          const u = new URL(href, location.origin);
          if (u.pathname === '/page.php' && u.searchParams.get('sid') === 'attack') {
            return kiPositiveInteger(u.searchParams.get('user2ID'));
          }
        }
      }
    } catch (e) { /* fall back to the page */ }
    const pg = kiPageDetails();
    return pg.type === 'attack' ? pg.targetId : null;
  }

  // The SOS button lives in the Faction chat's header bar (next to its
  // minimise button), only on an attack page -- or while a pop-out attack
  // window is open -- and only while Faction chat is open. The pop-out loads
  // Torn inside a same-origin frame with its own chat, so that chat gets the
  // button too. Torn's chat re-renders often, so this is re-checked every
  // second and re-added if it was dropped.
  // Finds open Faction chat boxes without relying on Torn's class names:
  // start from each visible chat textarea, climb to the smallest ancestor
  // that also holds a "Faction" title, and take the header bar as the
  // biggest block around that title that does NOT contain the textarea.
  // Torn's chat titles the faction chat box either "Faction" (older chat) or,
  // since late Sep 2026, with the faction's own name ("Glory to Saints"...).
  // Your faction's name comes from the API (cached), so this works for any faction.
  function normChatTitle(t) {
    let x = String(t || '');
    if (/&[#a-z0-9]+;/i.test(x)) {
      try { const d = document.createElement('textarea'); d.innerHTML = x; x = d.value; } catch (e) { /* keep */ }
    }
    return x.replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();
  }
  function factionChatTitles() {
    const out = ['faction'];
    const own = normChatTitle(getCfg('tws_own_faction_name', ''));
    if (own) out.push(own);
    return out;
  }
  function sosIsFactionTitle(el, titles) {
    if (!el || el.children.length > 3) return false;
    const t = normChatTitle(el.textContent);
    return !!t && (titles || factionChatTitles()).includes(t);
  }
  function sosFactionChatBoxes(doc) {
    const out = [];
    if (!doc || !doc.body) return out;
    const root = doc.querySelector('#chatRoot') || doc.body;
    root.querySelectorAll('textarea').forEach((ta) => {
      if (!ta.getClientRects().length) return; // minimised / hidden
      let box = null;
      let title = null;
      const titles = factionChatTitles();
      const isTitle = (x) => sosIsFactionTitle(x, titles);
      let el = ta.parentElement;
      for (let i = 0; el && i < 14; i++, el = el.parentElement) {
        if (el === root || el.querySelectorAll('textarea').length > 1) break; // climbed past this chat box
        if (el.id && /^faction[-_]/i.test(el.id)) box = el;
        // Innermost element reading the faction chat's title (not a wrapper around it).
        const cands = Array.from(el.querySelectorAll('*')).filter((x) => !x.contains(ta) && isTitle(x))
          .filter((x) => !Array.from(x.children).some((k) => isTitle(k) || Array.from(k.querySelectorAll('*')).some(isTitle)));
        // Someone typing the faction's name in chat must not count: the real
        // title is in the header, outside the scrolling message list.
        const inMessages = (x) => {
          const win = (x.ownerDocument && x.ownerDocument.defaultView) || window;
          for (let a = x.parentElement; a && a !== el; a = a.parentElement) {
            try {
              const oy = win.getComputedStyle(a).overflowY;
              if (oy === 'auto' || oy === 'scroll') return true;
            } catch (e) { /* ignore */ }
          }
          return false;
        };
        const pool = cands.filter((x) => !inMessages(x));
        const cand = (pool.length ? pool : cands)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (cand) { box = box || el; title = cand; break; }
        if (box) break;
      }
      if (!box || !title) return;
      // Header = highest ancestor of the title (inside the box) not holding the textarea.
      let header = title;
      while (header.parentElement && header.parentElement !== box && !header.parentElement.contains(ta)) {
        header = header.parentElement;
      }
      if (header === title && title.parentElement && title.parentElement !== box) header = title.parentElement;
      if (!out.some((o) => o.header === header)) out.push({ box, header, ta, title });
    });
    return out;
  }
  // Sandbox helper: if the button can't be placed, copy a short description
  // of Torn's chat layout (tags / ids / class names only) once per page, so
  // it can be sent over and the placement fixed.
  let sosScanDone = false;
  // The live build is made by renaming 'Sandbox War Room', so this is false there.
  const SOS_SANDBOX_BUILD = 'Sandbox War Room'.indexOf('Sandbox') === 0;
  function sosDescribe(el) {
    if (!el) return '-';
    const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}`;
  }
  function sosScanChat(doc) {
    const lines = [`SOS scan ${SCRIPT_VERSION} ${location.pathname}${location.search.slice(0, 40)}`];
    const root = doc.querySelector('#chatRoot');
    lines.push(`chatRoot: ${root ? 'yes' : 'no'}`);
    const tas = Array.from((root || doc.body).querySelectorAll('textarea'));
    lines.push(`textareas: ${tas.length}`);
    tas.slice(0, 4).forEach((ta, n) => {
      lines.push(`#${n} visible=${ta.getClientRects().length > 0} ph="${(ta.placeholder || '').slice(0, 30)}"`);
      let el = ta;
      for (let i = 0; el && i < 10; i++, el = el.parentElement) {
        const titles = Array.from(el.querySelectorAll('*')).filter((x) => !x.contains(ta) && /faction/i.test(x.textContent || '') && x.children.length <= 3 && (x.textContent || '').trim().length < 20);
        lines.push(`  ${i}: ${sosDescribe(el)} kids=${el.children.length}${titles.length ? ' title=' + sosDescribe(titles[0]) + '"' + titles[0].textContent.trim() + '"' : ''}`);
      }
    });
    return lines.join('\n');
  }
  function sosMaybeScan(doc) {
    if (sosScanDone || !SOS_SANDBOX_BUILD) return;
    sosScanDone = true;
    try {
      const txt = sosScanChat(doc);
      GM_setClipboard(txt);
      showToast('SOS: couldn\u2019t find the Faction chat header. A scan was copied - paste it to Claude.');
    } catch (e) { /* ignore */ }
  }
  function sosDocs() {
    const docs = [document];
    try {
      if (popout && popout.root.style.display !== 'none' && !popout.root.classList.contains('tws-po-min')) {
        const d = popout.frame.contentDocument;
        if (d) docs.push(d);
      }
    } catch (e) { /* frame not readable */ }
    return docs;
  }
  function sosMakeButton(doc, box) {
    const btn = doc.createElement('button');
    btn.className = 'tws-sos-btn';
    btn.type = 'button';
    btn.textContent = 'SOS';
    btn.title = 'Ask the faction for help on this target';
    btn.setAttribute('style', [
      'background:#c62828', 'color:#fff', 'border:1px solid #ff6b6b', 'border-radius:5px',
      'padding:2px 6px', 'font:bold 12px/1.2 Arial,sans-serif', 'letter-spacing:0.4px',
      'box-shadow:0 1px 3px rgba(0,0,0,0.5)', 'cursor:pointer', 'margin:0',
      'position:absolute', 'top:50%', 'right:56px', 'transform:translateY(-50%)', 'z-index:5',
    ].join(';'));
    // Keep taps on the button from also reaching the header (which would minimise the chat).
    ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend'].forEach((ev) => {
      btn.addEventListener(ev, (e) => e.stopPropagation());
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.style.transform = 'translateY(-50%) scale(0.94)';
      setTimeout(() => { btn.style.transform = 'translateY(-50%)'; }, 150);
      onSosClick(btn, box);
    });
    return btn;
  }
  // The visible header bar: the innermost block around the "Faction" title
  // that spans (nearly) the whole header width.
  function sosHeaderBar(header, title) {
    const hw = header.getBoundingClientRect().width;
    let el = title.parentElement;
    while (el && el !== header) {
      if (el.getBoundingClientRect().width >= hw * 0.9) return el;
      el = el.parentElement;
    }
    return header;
  }
  // Sits just left of the minimise control (the right-most control in the
  // bar), which is to the right of the "Faction" title.
  function sosPositionBtn(btn, bar, title) {
    const br = bar.getBoundingClientRect();
    if (!br.width) return;
    const tr = title.getBoundingClientRect();
    let minLeft = null;
    bar.querySelectorAll('button, [role="button"], svg').forEach((el) => {
      if (el === btn || btn.contains(el) || el.contains(title) || title.contains(el)) return;
      const r = el.getBoundingClientRect();
      if (!r.width || r.left <= tr.right + 30) return; // the title's own dropdown arrow
      if (minLeft === null || r.left < minLeft) minLeft = r.left;
    });
    const right = minLeft !== null ? Math.max(8, Math.round(br.right - minLeft + 12)) : 56;
    const want = `${right}px`;
    if (btn.style.right !== want) btn.style.right = want;
  }
  function ensureSosButton__raw() {
    if (!pageFocused()) return; // only look for the chat while you're looking at the page
    const want = featureOn('attackSos') && !!sosTargetId();
    const docs = sosDocs();
    const keep = new Set();
    if (want) {
      docs.forEach((doc) => {
        sosFactionChatBoxes(doc).forEach(({ box, header, title }) => {
          const bar = sosHeaderBar(header, title);
          let btn = bar.querySelector('.tws-sos-btn');
          if (!btn) {
            // Laid over the bar (not added to its row), so Torn's own layout
            // and background are left exactly as they are.
            const win = doc.defaultView || window;
            if (win.getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
            btn = sosMakeButton(doc, box);
            bar.appendChild(btn);
          }
          sosPositionBtn(btn, bar, title);
          keep.add(btn);
        });
      });
    }
    docs.forEach((doc) => {
      doc.querySelectorAll('.tws-sos-btn').forEach((b) => { if (!keep.has(b)) b.remove(); });
    });
    if (want && !keep.size) {
      const withChat = docs.find((d) => Array.from(d.querySelectorAll('textarea')).some((t) => t.getClientRects().length));
      if (withChat) sosMaybeScan(withChat);
    }
    const old = document.getElementById('tws-sos-btn'); // floating button from 1.87.3/4
    if (old) old.remove();
    // Put back any chat header a 1.87.5/6 button had pushed aside.
    docs.forEach((doc) => doc.querySelectorAll('.tws-sos-btn').forEach((b) => {
      if (b.style.position !== 'absolute') b.remove();
    }));
  }

  function tickRetalTimers__raw() {
    if (!panel) return;
    const nowS = Date.now() / 1000;
    let expired = false;
    panel.querySelectorAll('.tws-retal-cd[data-retal-until]').forEach((el) => {
      const left = Number(el.dataset.retalUntil) - nowS;
      if (left <= 0) expired = true;
      const t = fmtRetalLeft(left);
      if (el.textContent !== t) el.textContent = t;
    });
    // Window closed: redraw once so the button goes back to ATK / disappears.
    if (expired && !retalExpiredRender) {
      retalExpiredRender = true;
      setTimeout(() => { retalExpiredRender = false; safeRender(); }, 0);
    }
  }
  function atkLogIsRetal(x, ownId, nowS) {
    return !!ownId && String(x.dF) === ownId && String(x.aF) !== ownId && x.aId > 0
      && attackSucceeded({ result: x.r }) && (nowS - x.e) <= RETAL_WINDOW_SEC
      // not once a faction mate has hospitalised that attacker since
      && !loadAtkLog().some((y) => String(y.aF) === ownId && String(y.dId) === String(x.aId)
        && y.e >= x.e && isHospHit({ result: y.r }));
  }
  function atkLogSignature() {
    const ownId = String(getOwnFactionId() || '');
    const nowS = Date.now() / 1000;
    const list = atkLogList();
    const retalIds = list.filter((x) => atkLogIsRetal(x, ownId, nowS)).map((x) => x.id).join(',');
    return [atkLogFilter, list.length, list[0] ? list[0].id : '', atkLogSource, atkLogError, retalIds, ownId, enemyFactionId || ''].join('|');
  }

  // The Attacks tab's content (goes where the roster rows normally are).
  function atkLogHtml__raw() {
    // First fetch as soon as the tab opens, not at the next 20s poll.
    if (!atkLogFetchedAt && !atkLogKicked && getOwnFactionId()) {
      atkLogKicked = true;
      setTimeout(() => refreshRetalWindow(getOwnFactionId(), (pageMode !== 'home' && enemyFactionId) ? enemyFactionId : null), 0);
    }
    atkLogSig = atkLogSignature();
    const ownId = String(getOwnFactionId() || '');
    const enemyId = (pageMode !== 'home' && enemyFactionId) ? String(enemyFactionId) : '';
    const nowS = Date.now() / 1000;
    const names = {};
    enemyMembers.forEach((m) => { names[m.id] = m.name; });
    homeMembers.forEach((m) => { names[m.id] = m.name; });
    const list = atkLogList();
    const who = (id, n, fac) => {
      const cls = String(fac) === ownId ? 'tws-log-own' : (enemyId && String(fac) === enemyId) ? 'tws-log-enemy' : 'tws-log-other';
      if (!id) return `<span class="tws-log-other">Someone</span>`;
      const label = escHtml(n || names[id] || `[${id}]`);
      return `<a class="${cls}" target="_blank" href="https://www.torn.com/profiles.php?XID=${id}">${label}</a>`;
    };
    const rows = list.map((x) => {
      const dir = String(x.aF) === ownId ? 'out' : String(x.dF) === ownId ? 'in' : 'other';
      const ok = attackSucceeded({ result: x.r });
      const resp = x.rs > 0 ? ` \u00b7 <b class="tws-log-resp">+${x.rs.toFixed(2)}</b>` : '';
      const retal = atkLogIsRetal(x, ownId, nowS)
        ? `<a class="tws-atk tws-log-retal" target="_blank" data-retal-id="${x.aId}" data-retal-name="${escHtml(x.aN || names[x.aId] || '')}" href="${attackUrl(x.aId)}">Retal${retalTimerHtml(x.e)}</a>` : '';
      // Outside hit: during a war, a hit between us and anyone who isn't the
      // war enemy (stealthed attackers are unknown, so never flagged).
      const outside = !!enemyId && (
        (dir === 'out' && String(x.dF) !== enemyId)
        || (dir === 'in' && x.aId > 0 && String(x.aF) !== enemyId));
      const outsideHtml = outside ? '<span class="tws-atk tws-log-outside">Outside Hit</span>' : '';
      const badges = (retal || outsideHtml) ? `<span class="tws-log-badges">${retal}${outsideHtml}</span>` : '';
      const arrow = dir === 'out' ? '<span class="tws-log-dir tws-log-dir-out">\u2197 OUT</span>'
        : dir === 'in' ? '<span class="tws-log-dir tws-log-dir-in">\u2199 IN</span>'
        : '<span class="tws-log-dir">\u00b7</span>';
      return `
        <div class="tws-log-row tws-log-${dir}${ok ? '' : ' tws-log-fail'}">
          <span class="tws-log-when">
            <span class="tws-log-time" title="${escHtml(new Date(x.e * 1000).toUTCString())}">${tctTime(x.e)}</span>
            ${arrow}
          </span>
          <span class="tws-log-main">
            <span>${who(x.aId, x.aN, x.aF)} <span class="tws-log-arrow">\u2192</span> ${who(x.dId, x.dN, x.dF)}</span>
            <span class="tws-log-sub"><span class="tws-log-res-${escHtml((x.r || 'unknown').toLowerCase())}">${escHtml(ATKLOG_RESULT_NAMES[x.r] || x.r || '?')}</span>${resp}</span>
          </span>
          ${badges}
        </div>`;
    }).join('');
    const srcText = atkLogSource === 'server' ? 'Kraken server (shared key)'
      : atkLogSource === 'own' ? 'your own key'
      : atkLogSource === 'none' ? 'unavailable' : 'waiting for first update\u2026';
    const empty = atkLogSource === 'none'
      ? `No attack data. Your faction needs a shared Retal key (\u2699 Advanced \u2192 Shared Retal), or your key needs faction API access.${atkLogError ? `<br><small>${escHtml(atkLogError)}</small>` : ''}`
      : 'No attacks yet. New attacks appear here as they happen (the log starts with the last few minutes).';
    return `
      <div id="tws-atklog">
        <div class="tws-filters" style="margin-bottom:6px;">
          ${[['all', 'All'], ['out', 'Outgoing'], ['in', 'Incoming']].map(([k, l]) =>
            `<div class="tws-log-chip ${atkLogFilter === k ? 'tws-filter-active' : ''}" data-log-filter="${k}">${l}</div>`).join('')}
        </div>
        <div class="tws-log-list">${rows || `<div style="opacity:0.6;padding:6px 0;">${empty}</div>`}</div>
        <div class="tws-log-foot">Source: ${srcText}${atkLogFetchedAt ? ` \u00b7 checked ${tctTime(Math.floor(atkLogFetchedAt / 1000))} TCT` : ''}</div>
      </div>`;
  }
  function wireAtkLog(body) {
    body.querySelectorAll('.tws-log-chip').forEach((el) => {
      el.addEventListener('click', () => {
        atkLogFilter = el.dataset.logFilter;
        render();
      });
    });
    // Retal opens in the pop-out, the same way the roster ATK buttons do.
    body.querySelectorAll('.tws-log-retal[data-retal-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (!featureOn('popouts') || !featureOn('popoutAttacks')) return;
        e.preventDefault();
        openPopout(attackUrl(el.dataset.retalId), `\u2694 ${el.dataset.retalName || el.dataset.retalId}`);
      });
    });
  }


  function httpPostJson(url, bodyObj) {
    const payload = JSON.stringify(bodyObj);
    const headers = { 'Content-Type': 'application/json' };
    if (IS_PDA) {
      return Promise.resolve()
        .then(() => PDA_httpPost(url, headers, payload))
        .then((res) => {
          const t = (res && (res.responseText || res.response || res.body)) || '';
          return typeof t === 'string' ? JSON.parse(t) : t;
        });
    }
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST', url, headers, data: payload, timeout: 20000,
        onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(new Error(`HTTP ${r.status}`)); } },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }

  function isOwnerCached() {
    try {
      const saved = JSON.parse(getCfg(ACCESS_ID_KEY, 'null'));
      return !!saved && String(saved.id) === CREDIT_ID;
    } catch (e) { return false; }
  }


  // ---------------------------------------------------------------------
  // KRAKEN INTEL (integrated) -- Phase 1: plumbing
  // Kraken Intel is Jay's separate standalone userscript (same author,
  // -TheKraken-) that captures equipment Torn reveals on attack pages you
  // view, and shares it through his own Supabase project. This wires it to
  // use War Room's own Torn API key instead of asking for a second one,
  // and sets up its settings. No capture/display code yet -- that's
  // phases 2 and 3.
  //
  // STORAGE CAVEAT: the standalone script's saved data (captures, consent,
  // Supabase session, item cache) lives under GM_getValue with these same
  // key names, but Tampermonkey/Firefox normally sandbox GM storage PER
  // SCRIPT INSTALL -- a different script generally can't see another
  // script's stored values even with matching key names. The reads below
  // are harmless either way (they just find nothing and start fresh if
  // isolated), but a clean carry-over of old captures/consent on
  // Tampermonkey is NOT guaranteed. Unconfirmed whether Torn PDA's GM shim
  // behaves the same way or shares storage more broadly.
  // ---------------------------------------------------------------------
  const KI_STORE = {
    captures: 'kraken_intel_local_captures_v1',
    consent: 'kraken_intel_sharing_consent_v1',
    session: 'kraken_intel_supabase_session_v1',
    oldApiKey: 'kraken_intel_torn_api_key_v1',
    itemCache: 'kraken_intel_item_details_cache_v1',
  };
  const KI_SUPABASE_URL = 'https://igiyqcgpwonbbjdnvxwd.supabase.co';
  const KI_SUPABASE_KEY = 'sb_publishable_GE2jnNatcy9lopAx1WGujA_06d_yPHd';
  const KI_W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // Kraken Intel's API-key provider -- always War Room's own saved key, so
  // it's never asked for twice and always tracks whatever is saved in
  // General settings.
  function getKrakenIntelTornApiKey() {
    return getApiKey();
  }

  // True if the standalone script is already running on this page (it
  // sets window.__krakenIntelInstalled = true on its real, unsandboxed
  // window). The integrated module checks this before installing anything
  // that would double up with it. One-directional for now -- the
  // standalone script doesn't yet know to look for War Room's own marker
  // below, since updating it is out of scope for this pass.
  function krakenIntelStandaloneRunning() {
    return !!KI_W.__krakenIntelInstalled;
  }
  KI_W.__krakenIntel = { source: 'war-room', version: SCRIPT_VERSION };

  // The old standalone script's consent value, if this script instance can
  // actually see it (see the storage caveat above) -- used ONLY to carry
  // an existing informed choice forward into the new toggle below, once,
  // the first time this runs. Never used to silently flip anyone's choice.
  function krakenIntelOldConsent() {
    return getCfg(KI_STORE.consent, false) === true;
  }

  // Kraken Intel (showing AND sharing) is on by default. Devices where the
  // old opt-in default had left it off are switched on once; after that a
  // player's own choice to turn either toggle off is kept.
  function seedKrakenIntelConsent() {
    if (getCfg('tws_ki_default_on_v1', false) !== true) {
      setCfg('tws_feat_kiContribute', true);
      setCfg('tws_feat_kiShowIntel', true);
      setCfg('tws_ki_default_on_v1', true);
    }
  }

  // ---------------------------------------------------------------------
  // KRAKEN INTEL -- Phase 2: capture + Supabase sync (still no display)
  // Ports the standalone script's data layer: captures the loadout Torn
  // reveals on an attack page you're viewing, saves it locally, optionally
  // shares it through the existing Supabase project, and pulls in other
  // contributors' shared observations. The attack response itself is only
  // OBSERVED here and never modified -- Torn's page looks and behaves
  // exactly as normal. Modifying it to reveal saved loadouts is Phase 3.
  // ---------------------------------------------------------------------
  const KI_COMBAT_SLOTS = new Map([
    [1, 'Primary'], [2, 'Secondary'], [3, 'Melee'], [4, 'Body'], [5, 'Temporary'],
    [6, 'Helmet'], [7, 'Legs'], [8, 'Feet'], [9, 'Hands'],
  ]);
  const KI_MAX_LOCAL_CAPTURES = 200;
  const KI_SYNC_INTERVAL_MS = 5 * 60 * 1000; // shared loadouts barely change; your own captures show instantly
  const kiState = { latest: null, syncing: false, syncTimer: null, enriching: false };

  function kiLog(...args) { console.info('[Sandbox War Room \u00b7 Kraken Intel]', ...args); }
  const kiDiag = { page: '', state: 'starting', hook: '', seen: 0, loadouts: 0, noLoadout: 0, last: '', upload: '', sync: '', panel: '', warn: '' };
  function kiDiagRender() {
    const old = document.getElementById('tws-ki-diag');
    if (old) old.remove();
    if (true) return; // PC: status chip removed
    try {
      let el = document.getElementById('tws-ki-diag');
      if (!featureOn('kiDebug') || !kiDiag.page || !document.body) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.id = 'tws-ki-diag';
        el.style.cssText = 'position:fixed;left:4px;top:64px;z-index:2147483000;max-width:min(78vw,420px);background:rgba(20,20,20,0.92);color:#ddd;border:1px solid #6b3fa0;border-radius:6px;padding:4px 7px;font:11px/1.35 Arial,sans-serif;pointer-events:none;white-space:pre-wrap;';
        document.body.appendChild(el);
      }
      const d = kiDiag;
      const lines = [`\ud83d\udc19 Intel (${d.page}): ${d.state}`];
      if (d.page === 'attack') lines.push(`hook: ${d.hook || 'none'} \u00b7 responses ${d.seen} \u00b7 loadouts ${d.loadouts}${d.noLoadout ? ` \u00b7 no-loadout ${d.noLoadout}` : ''}`);
      if (d.page === 'profile') {
        let where = '';
        const pn = kiView.panel;
        if (pn && pn.isConnected) {
          const r = pn.getBoundingClientRect();
          where = pn.hidden ? ' \u00b7 HIDDEN (Show intel off)' : ` \u00b7 ${Math.round(r.width)}\u00d7${Math.round(r.height)} at ${Math.round(r.top + window.scrollY)}px down`;
          if (!pn.hidden && r.height && r.top >= 0 && r.top < window.innerHeight) {
            const top = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + Math.min(10, r.height / 2));
            if (top && !pn.contains(top)) where += ` \u00b7 covered by ${top.tagName.toLowerCase()}${top.className && typeof top.className === 'string' ? '.' + top.className.split(' ')[0] : ''}`;
          }
        }
        lines.push(`panel: ${d.panel || 'not mounted'}${where}`);
      }
      if (d.frameHooked) lines.push(`pop-out fights: ${d.frameHooked} \u00b7 responses ${d.frameSeen || 0}${d.frameNoLoadout ? ` (${d.frameNoLoadout} without a loadout)` : ''}`);
      if (d.last) lines.push(`last capture: ${d.last}`);
      lines.push(`share: ${featureOn('kiContribute') ? (d.upload || 'on, nothing sent yet') : 'OFF'} \u00b7 show: ${featureOn('kiShowIntel') ? 'on' : 'OFF'}`);
      if (d.sync) lines.push(`shared sync: ${d.sync}`);
      if (d.warn) lines.push(`\u26a0 ${d.warn}`);
      el.textContent = lines.join('\n');
    } catch (e) { /* ignore */ }
  }
  function kiWarn(...args) { kiDiag.warn = args.map(String).join(' ').slice(0, 160); kiDiagRender(); console.warn('[Sandbox War Room \u00b7 Kraken Intel]', ...args); }

  function kiPositiveInteger(v) {
    const n = Number(v);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  function kiObjectRecord(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function kiPageDetails() {
    const url = new URL(location.href);
    if (url.pathname === '/page.php' && url.searchParams.get('sid') === 'attack') {
      return { type: 'attack', targetId: kiPositiveInteger(url.searchParams.get('user2ID')) };
    }
    if (url.pathname === '/profiles.php') {
      return { type: 'profile', targetId: kiPositiveInteger(url.searchParams.get('XID')) };
    }
    return { type: 'unsupported', targetId: null };
  }
  function kiCurrentTargetId() {
    return kiPageDetails().targetId;
  }

  // ---- Supabase (anonymous auth + REST/RPC) ----
  function kiSupabaseRequest(method, path, opts) {
    opts = opts || {};
    const body = opts.body != null ? opts.body : null;
    const accessToken = opts.accessToken || null;
    const url = `${KI_SUPABASE_URL}${path}`;
    const headers = { apikey: KI_SUPABASE_KEY, Accept: 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (body !== null) headers['Content-Type'] = 'application/json';
    const payload = body === null ? null : JSON.stringify(body);
    const wrap = (status, text) => {
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { ok: status >= 200 && status < 300, status, data };
    };
    if (IS_PDA) {
      const call = (method === 'POST' && typeof PDA_httpPost === 'function')
        ? PDA_httpPost(url, headers, payload || '')
        : (typeof PDA_httpGet === 'function' ? PDA_httpGet(url, headers) : Promise.reject(new Error('No PDA HTTP method available')));
      return Promise.resolve(call)
        .then((res) => wrap(Number((res && res.status) || 0), String((res && res.responseText) || '')))
        .catch(() => wrap(0, ''));
    }
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        ...(payload === null ? {} : { data: payload }),
        timeout: 12000,
        onload: (res) => resolve(wrap(res.status, res.responseText)),
        onerror: () => resolve(wrap(0, '')),
        ontimeout: () => resolve(wrap(0, '')),
      });
    });
  }

  function kiNormalizedSession(raw) {
    if (kiObjectRecord(raw && raw.session)) raw = raw.session;
    if (!kiObjectRecord(raw) || typeof raw.access_token !== 'string' || typeof raw.refresh_token !== 'string') return null;
    const reported = Number(raw.expires_at);
    const expiresAt = reported ? (reported < 1e12 ? reported * 1000 : reported) : Date.now() + Number(raw.expires_in || 3600) * 1000;
    return { access_token: raw.access_token, refresh_token: raw.refresh_token, expires_at: expiresAt };
  }

  async function kiAuthenticatedSession() {
    let session = kiNormalizedSession(getCfg(KI_STORE.session, null));
    if (session && session.expires_at > Date.now() + 60000) return session;
    if (session && session.refresh_token) {
      const refreshed = await kiSupabaseRequest('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } });
      const next = refreshed.ok ? kiNormalizedSession(refreshed.data) : null;
      if (next) { setCfg(KI_STORE.session, next); return next; }
    }
    const created = await kiSupabaseRequest('POST', '/auth/v1/signup', { body: { data: {} } });
    const next = created.ok ? kiNormalizedSession(created.data) : null;
    if (!next) throw new Error((created.data && (created.data.msg || created.data.message)) || 'Anonymous connection failed');
    setCfg(KI_STORE.session, next);
    return next;
  }

  async function kiSha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ---- capture parsing (Torn's attackData response -> a stored record) ----
  function kiFirstItem(container) {
    return Array.isArray(container && container.item) && kiObjectRecord(container.item[0]) ? container.item[0] : null;
  }

  function kiNestedValues(root, wantedKeys, maxDepth) {
    const wanted = new Set(wantedKeys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '')));
    const found = [];
    const seen = new Set();
    const visit = (value, depth) => {
      if ((!kiObjectRecord(value) && !Array.isArray(value)) || seen.has(value) || depth > maxDepth) return;
      seen.add(value);
      Object.entries(value).forEach(([key, child]) => {
        const nk = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (wanted.has(nk)) found.push(child);
        if (kiObjectRecord(child) || Array.isArray(child)) visit(child, depth + 1);
      });
    };
    visit(root, 0);
    return found;
  }

  function kiFiniteNumber(...values) {
    for (const v of values) {
      if (v === null || v === undefined || v === '') continue;
      const m = typeof v === 'string' ? v.trim().match(/^-?\d+(?:\.\d+)?/) : null;
      const n = m ? Number(m[0]) : Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function kiNestedNumber(sources, keys) {
    return kiFiniteNumber(...sources.flatMap((s) => kiNestedValues(s, keys, 4)));
  }

  function kiNormalizeBonuses(...sources) {
    const containers = sources.flatMap((s) => kiNestedValues(s, ['currentBonuses', 'bonuses', 'bonus'], 4));
    return containers.flatMap((c) => {
      const values = Array.isArray(c) ? c : kiObjectRecord(c) ? Object.values(c) : [];
      return values.flatMap((raw) => {
        if (!kiObjectRecord(raw)) return [];
        const name = String(raw.title || raw.name || 'Bonus').slice(0, 60);
        const num = kiFiniteNumber(raw.value, raw.percentage, raw.percent, raw.proc);
        return [{ name, value: Number.isFinite(num) ? num : null }];
      });
    }).filter((b, i, all) => all.findIndex((c) => c.name === b.name && c.value === b.value) === i).slice(0, 2);
  }

  function kiEquipmentSnapshot(value, depth, seen) {
    depth = depth || 0; seen = seen || new WeakSet();
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (typeof value !== 'object' || depth > 6 || seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 24).map((e) => kiEquipmentSnapshot(e, depth + 1, seen));
    const out = {};
    Object.entries(value).slice(0, 100).forEach(([key, child]) => {
      if (/token|cookie|authorization|api.?key|attackeruser/i.test(key)) return;
      const safe = kiEquipmentSnapshot(child, depth + 1, seen);
      if (safe !== null) out[key] = safe;
    });
    return out;
  }

  function kiSafeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const u = new URL(value, location.origin);
      return (u.protocol === 'https:' && (u.hostname === 'www.torn.com' || u.hostname.endsWith('.torn.com'))) ? u.href : null;
    } catch (e) { return null; }
  }

  function kiItemImageUrl(item) {
    for (const c of [item.image, item.image_url, item.imageUrl, item.img]) {
      const v = kiSafeImageUrl(c);
      if (v) return v;
    }
    const id = kiPositiveInteger(item.ID);
    return id ? `https://www.torn.com/images/items/${id}/large.png` : null;
  }

  function kiNormalizeItem(item, container) {
    const equipSlot = Number(item.equipSlot);
    if (!KI_COMBAT_SLOTS.has(equipSlot) && Number(item.ID) !== 999) return null;
    const sources = [item, container].filter(Boolean);
    return {
      item_id: kiPositiveInteger(item.ID),
      armoury_id: kiPositiveInteger(item.armouryID != null ? item.armouryID : item.armoryID),
      equip_slot: equipSlot,
      slot_name: Number(item.ID) === 999 ? 'Unarmed' : KI_COMBAT_SLOTS.get(equipSlot),
      name: String(item.name || `Item #${item.ID}`).slice(0, 100),
      image_url: kiItemImageUrl(item),
      damage: kiFiniteNumber(item.dmg, item.damage),
      accuracy: kiFiniteNumber(item.acc, item.accuracy),
      armour: kiNestedNumber(sources, ['armor', 'armour', 'arm', 'def', 'defence', 'defense', 'armorRating', 'armourRating', 'rating']),
      quality: kiNestedNumber(sources, ['quality', 'qualityPercentage', 'qualityPercent', 'itemQuality']),
      rarity: typeof item.rarity === 'string' && item.rarity.trim() ? item.rarity.trim().slice(0, 24) : null,
      bonuses: kiNormalizeBonuses(item, container),
      raw_source: container ? kiEquipmentSnapshot(container) : null,
    };
  }

  function kiExtractItems(defenderItems) {
    if (!kiObjectRecord(defenderItems)) return [];
    return Object.values(defenderItems).flatMap((container) => {
      const item = kiFirstItem(container);
      const n = item ? kiNormalizeItem(item, container) : null;
      return n ? [n] : [];
    });
  }

  // Torn's rule: only read the page while the player is looking at it.
  function popoutFrameShowing() {
    try {
      const fe = window.frameElement;
      const r = fe && fe.closest && fe.closest('#tws-popout');
      return !!r && r.style.display === 'flex' && !r.classList.contains('tws-po-min') && fe.style.display !== 'none';
    } catch (e) { return false; }
  }
  function pageFocused() {
    if (document.visibilityState !== 'visible') return false;
    if (document.hasFocus()) return true;
    // Inside a War Room pop-out: the pop-out is part of the page you're on.
    if (IN_POPOUT_FRAME) {
      try { return window.top.document.visibilityState === 'visible' && window.top.document.hasFocus() && popoutFrameShowing(); } catch (e) { return false; }
    }
    return false;
  }

  function kiVisibleAndFocused() {
    return pageFocused();
  }

  function kiBuildCapture(data, expectedTarget) {
    if (!kiVisibleAndFocused()) return null;
    const db = kiObjectRecord(data && data.DB) ? data.DB : data;
    if (!kiObjectRecord(db)) return null;
    const expected = expectedTarget || kiCurrentTargetId();
    const targetId = kiPositiveInteger(db.defenderUser && db.defenderUser.userID);
    if (!expected || targetId !== expected) return null;
    const items = kiExtractItems(db.defenderItems);
    const meaningful = items.filter((i) => i.item_id !== 999);
    if (!meaningful.length) return null;
    return {
      schema_version: 3,
      target_id: targetId,
      target_name: typeof (db.defenderUser && db.defenderUser.playername) === 'string' ? db.defenderUser.playername.slice(0, 64) : null,
      observed_at: new Date().toISOString(),
      fight_id: kiPositiveInteger(db.fightID != null ? db.fightID : db.fightId),
      attack_status: typeof db.attackStatus === 'string' ? db.attackStatus.slice(0, 32) : null,
      items,
    };
  }

  // ---- local storage ----
  function kiCaptureSignature(capture) {
    return JSON.stringify([capture.target_id, capture.items]);
  }

  function kiSaveCaptureLocal(capture) {
    const stored = getCfg(KI_STORE.captures, []);
    const captures = Array.isArray(stored) ? stored.filter(kiObjectRecord) : [];
    const dup = captures.find((e) => e.target_id === capture.target_id && kiCaptureSignature(e) === kiCaptureSignature(capture));
    if (dup) {
      dup.observed_at = capture.observed_at;
      dup.fight_id = capture.fight_id;
      dup.attack_status = capture.attack_status;
    } else {
      captures.unshift(capture);
    }
    captures.sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at));
    setCfg(KI_STORE.captures, captures.slice(0, KI_MAX_LOCAL_CAPTURES));
  }

  function kiLatestStoredCapture(targetId) {
    if (!targetId) return null;
    const stored = getCfg(KI_STORE.captures, []);
    if (!Array.isArray(stored)) return null;
    return stored.filter((c) => kiObjectRecord(c) && c.target_id === targetId)
      .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))[0] || null;
  }

  // ---- item-detail enrichment (Torn API v2 itemdetails, via War Room's key) ----
  function kiCachedItemDetails() {
    const stored = getCfg(KI_STORE.itemCache, {});
    return kiObjectRecord(stored) ? stored : {};
  }

  function kiItemDetailRecords(value, records, depth) {
    records = records || []; depth = depth || 0;
    if (depth > 5 || value === null || typeof value !== 'object') return records;
    if (Array.isArray(value)) { value.forEach((e) => kiItemDetailRecords(e, records, depth + 1)); return records; }
    const uid = kiPositiveInteger(value.uid != null ? value.uid : (value.UID != null ? value.UID : (value.armouryID != null ? value.armouryID : value.armoryID)));
    if (uid && (kiObjectRecord(value.stats) || Array.isArray(value.bonuses) || value.quality !== undefined)) {
      records.push(value);
      return records;
    }
    Object.values(value).forEach((child) => kiItemDetailRecords(child, records, depth + 1));
    return records;
  }

  function kiNormalizedApiItemDetails(raw) {
    if (!kiObjectRecord(raw)) return null;
    const stats = kiObjectRecord(raw.stats) ? raw.stats : raw;
    const armour = kiFiniteNumber(stats.armor, stats.armour, raw.armor, raw.armour);
    const quality = kiFiniteNumber(stats.quality, raw.quality);
    const bonuses = kiNormalizeBonuses(raw);
    const rarity = typeof raw.rarity === 'string' && raw.rarity.trim() ? raw.rarity.trim().slice(0, 24) : null;
    if (armour === null && quality === null && !bonuses.length && !rarity) return null;
    return { armour, quality, bonuses, rarity, fetched_at: new Date().toISOString() };
  }

  function kiFetchItemDetailsRaw(uids) {
    const key = getKrakenIntelTornApiKey();
    if (!key) return Promise.reject(new Error('No API key set'));
    const url = `https://api.torn.com/v2/torn/${uids.join(',')}/itemdetails?key=${encodeURIComponent(key)}&comment=sandboxwar`;
    return httpGetJson(url).then((data) => {
      if (data.error) throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
      return data;
    });
  }

  async function kiFetchUniqueItemDetails(uids) {
    const unique = Array.from(new Set(uids.map(kiPositiveInteger).filter(Boolean)));
    if (!unique.length || !getKrakenIntelTornApiKey()) return new Map();
    const cache = kiCachedItemDetails();
    const found = new Map();
    const missing = [];
    unique.forEach((uid) => {
      const cached = kiObjectRecord(cache[uid]) ? cache[uid] : null;
      if (cached) found.set(uid, cached); else missing.push(uid);
    });
    for (let i = 0; i < missing.length; i += 25) {
      const batch = missing.slice(i, i + 25);
      let data;
      try {
        data = await kiFetchItemDetailsRaw(batch);
      } catch (e) {
        kiWarn('Item-detail lookup failed for a batch', e.message);
        continue; // one failed batch shouldn't drop the rest of the loadout
      }
      kiItemDetailRecords(data).forEach((record) => {
        const uid = kiPositiveInteger(record.uid != null ? record.uid : (record.UID != null ? record.UID : (record.armouryID != null ? record.armouryID : record.armoryID)));
        const normalized = kiNormalizedApiItemDetails(record);
        if (!uid || !normalized || !unique.includes(uid)) return;
        cache[uid] = normalized;
        found.set(uid, normalized);
      });
    }
    const trimmed = Object.fromEntries(Object.entries(cache).slice(-500));
    setCfg(KI_STORE.itemCache, trimmed);
    return found;
  }

  function kiIsArmourSlot(item) {
    return [4, 6, 7, 8, 9].includes(Number(item && item.equip_slot));
  }

  async function kiEnrichCaptureWithTornApi(capture) {
    if (!capture || !capture.items || !getKrakenIntelTornApiKey()) return capture;
    // Armour and weapons: rarity (yellow / orange / red), quality, bonuses.
    const lookItems = capture.items.filter((i) => i && i.item_id !== 999 && KI_COMBAT_SLOTS.has(Number(i.equip_slot)) && kiPositiveInteger(i.armoury_id));
    if (!lookItems.length) return capture;
    const details = await kiFetchUniqueItemDetails(lookItems.map((i) => i.armoury_id));
    if (!details.size) return capture;
    return {
      ...capture,
      items: capture.items.map((item) => {
        const d = details.get(kiPositiveInteger(item.armoury_id));
        if (!d) return item;
        return {
          ...item,
          armour: (kiIsArmourSlot(item) && d.armour != null) ? d.armour : item.armour,
          quality: d.quality != null ? d.quality : item.quality,
          rarity: d.rarity || item.rarity,
          bonuses: (d.bonuses && d.bonuses.length) ? d.bonuses : item.bonuses,
          detail_source: 'torn-api-itemdetails',
        };
      }),
    };
  }

  async function kiRefreshLatestArmourDetails() {
    if (!kiState.latest || !getKrakenIntelTornApiKey() || kiState.enriching) return kiState.latest;
    const current = kiState.latest;
    kiState.enriching = true;
    try {
      const enriched = await kiEnrichCaptureWithTornApi(current);
      if (kiState.latest === current) {
        kiState.latest = enriched;
        kiSaveCaptureLocal(enriched);
      }
      return enriched;
    } catch (e) {
      kiWarn('Armour enrichment failed', e.message);
      return current;
    } finally {
      kiState.enriching = false;
    }
  }

  // ---- shared intel (Kraken server -> Supabase) ----
  const KI_SERVER_URL = 'https://dashing-fish-54.eu-west-1.convex.site/ki';
  function kiSharedRowToCapture(row) {
    if (!kiObjectRecord(row) || !kiPositiveInteger(row.target_id) || !Array.isArray(row.items)) return null;
    return {
      schema_version: kiPositiveInteger(row.schema_version) || 1,
      target_id: Number(row.target_id),
      target_name: typeof row.target_name === 'string' ? row.target_name : null,
      observed_at: row.observed_at,
      fight_id: kiPositiveInteger(row.fight_id),
      attack_status: typeof row.attack_status === 'string' ? row.attack_status : null,
      items: row.items,
      source: 'shared',
    };
  }

  async function kiFetchSharedCapture(targetId) {
    if (!featureOn('kiShowIntel') || !targetId) return null;
    // Through the Kraken server: needs your pass and paid/trial access, and
    // never returns intel on a protected faction's members.
    const me = await accessMyId();
    if (!me) return null;
    const d = await serverGet(`${KI_SERVER_URL}/loadout?target=${encodeURIComponent(targetId)}&me=${encodeURIComponent(me)}`);
    if (!d || d.error) throw new Error((d && d.error) || 'Shared lookup failed');
    return kiSharedRowToCapture(d.row);
  }

  async function kiUploadSharedCapture(capture) {
    if (!featureOn('kiContribute')) return false;
    const me = await accessMyId();
    if (!me) return false;
    const fingerprint = await kiSha256(JSON.stringify(capture.items));
    const body = (p) => ({
      me: Number(me),
      p,
      capture: {
        target_id: capture.target_id,
        target_name: capture.target_name,
        observed_at: capture.observed_at,
        fingerprint,
        fight_id: capture.fight_id,
        attack_status: capture.attack_status,
        items: capture.items,
        schema_version: capture.schema_version,
      },
    });
    let d = await httpPostJson(`${KI_SERVER_URL}/submit`, body(await getPass(false)));
    if (d && d.needAuth) d = await httpPostJson(`${KI_SERVER_URL}/submit`, body(await getPass(true)));
    if (!d || d.error) throw new Error((d && d.error) || 'Shared upload failed');
    return !!d.saved || !!d.protected;
  }

  async function kiSyncSharedIntel() {
    if (!featureOn('kiShowIntel') || kiState.syncing || !kiCurrentTargetId() || document.visibilityState !== 'visible') return;
    kiState.syncing = true;
    try {
      const shared = await kiFetchSharedCapture(kiCurrentTargetId());
      if (shared && (!kiState.latest || Date.parse(shared.observed_at) > Date.parse(kiState.latest.observed_at))) {
        kiState.latest = shared;
        kiSaveCaptureLocal(shared);
        kiLog('Shared intel updated for', shared.target_id);
        kiDiag.sync = 'newer shared intel loaded \u2713';
        kiScheduleAttackEquipmentRender();
        kiRenderProfilePanel();
      }
      if (!kiDiag.sync) kiDiag.sync = 'ok \u2713';
      kiDiagRender();
    } catch (e) {
      kiDiag.sync = `failed: ${e.message}`;
      kiWarn('Shared sync failed', e.message);
    } finally {
      kiState.syncing = false;
    }
  }

  function kiStartSharedSync() {
    if (kiState.syncTimer !== null) clearInterval(kiState.syncTimer);
    if (!featureOn('kiShowIntel')) return;
    // Once when the page (or pop-out) opens -- shared loadouts barely change,
    // and loadouts you capture yourself show instantly anyway.
    kiSyncSharedIntel();
  }

  // ---- attack-page capture (OBSERVE ONLY -- response is never modified in
  // this phase; revealing saved loadouts on screen is Phase 3) ----
  function kiIsAttackDataRequest(input) {
    const raw = typeof input === 'string' ? input : (input && (input.url || input.href));
    if (typeof raw !== 'string') return false;
    try {
      const u = new URL(raw, location.href);
      return u.origin === location.origin && u.searchParams.get('sid') === 'attackData';
    } catch (e) { return false; }
  }

  async function kiReceiveAttackData(data, expectedTarget) {
    const capture = kiBuildCapture(data, expectedTarget);
    if (!capture) return;
    kiDiag.loadouts++;
    kiDiag.last = `${capture.target_name || capture.target_id} at ${new Date().toTimeString().slice(0, 8)}`;
    kiDiagRender();
    kiSaveCaptureLocal(capture);
    kiLog('Captured loadout for', capture.target_id);
    let enriched = null;
    if (capture.target_id === kiTab.targetId) kiSetTabIntel(capture.target_id, capture, true, '');
    if (capture.target_id === kiCurrentTargetId()) {
      // The player this page is about (attack page, or their profile with the
      // fight in a pop-out): show it straight away.
      kiState.latest = capture;
      kiScheduleAttackEquipmentRender();
      kiRenderProfilePanel();
      enriched = await kiRefreshLatestArmourDetails();
      if (enriched) { kiScheduleAttackEquipmentRender(); kiRenderProfilePanel(); } // re-render with enriched armour stats
    }
    if (false && expectedTarget) {
      try { showToast(`\ud83d\udc19 Loadout recorded for ${capture.target_name || capture.target_id}`); } catch (e) { /* ignore */ }
    }
    if (!featureOn('kiContribute')) { kiDiagRender(); return; }
    try {
      await kiUploadSharedCapture(enriched || capture);
      kiDiag.upload = `uploaded \u2713 ${new Date().toTimeString().slice(0, 8)}`;
      kiDiagRender();
    } catch (e) {
      kiDiag.upload = `upload failed: ${e.message}`;
      kiWarn('Shared upload failed', e.message);
    }
  }

  // Merges saved/shared intel into Torn's own attackData JSON -- but ONLY
  // when Torn's own response hasn't already revealed the loadout live
  // (checked first), so a genuine live reveal is always what's shown.
  function kiPatchAttackData(data, intel) {
    const db = kiObjectRecord(data && data.DB) ? data.DB : data;
    if (!kiObjectRecord(db) || kiPositiveInteger(db.defenderUser && db.defenderUser.userID) !== intel.target_id) return data;
    const nativeItems = kiObjectRecord(db.defenderItems) ? db.defenderItems : {};
    if (kiExtractItems(nativeItems).some((i) => i.item_id !== 999)) return data; // Torn already revealed it natively
    const defenderItems = {};
    Object.entries(nativeItems).forEach(([key, container]) => {
      const nativeItem = kiFirstItem(container);
      if (nativeItem && [999, 1000].includes(Number(nativeItem.ID))) defenderItems[key] = container;
    });
    (intel.items || []).forEach((item) => {
      if (!kiPositiveInteger(item.item_id) || !KI_COMBAT_SLOTS.has(Number(item.equip_slot))) return;
      const currentBonuses = {};
      (Array.isArray(item.bonuses) ? item.bonuses : []).forEach((b, i) => { currentBonuses[i] = { title: b.name, value: b.value }; });
      defenderItems[String(item.equip_slot)] = { item: [{
        ID: item.item_id, armouryID: item.armoury_id, equipSlot: item.equip_slot, name: item.name,
        dmg: item.damage, acc: item.accuracy, armor: item.armour, def: item.armour,
        quality: item.quality, rarity: item.rarity, currentBonuses,
      }] };
    });
    if (!Object.keys(defenderItems).length) return data;
    const patchedDb = { ...db, defenderItems, showEnemyItems: true };
    return data.DB ? { ...data, DB: patchedDb } : patchedDb;
  }

  async function kiPrepareAttackResponse(response) {
    let data;
    try { data = await response.clone().json(); } catch (e) { return response; }
    if (!kiObjectRecord(data)) return response;

    const capture = kiBuildCapture(data);
    if (!capture) { kiDiag.noLoadout++; kiDiagRender(); }
    if (capture) {
      kiReceiveAttackData(data).catch((e) => kiWarn('Could not process attack response', e.message));
      return response; // Torn already shows it natively -- nothing to patch
    }

    if (!kiState.latest && featureOn('kiShowIntel')) {
      try {
        const shared = await kiFetchSharedCapture(kiCurrentTargetId());
        if (shared) {
          kiState.latest = shared;
          kiSaveCaptureLocal(shared);
          kiScheduleAttackEquipmentRender();
        }
      } catch (e) {
        kiWarn('Could not load attack intel', e.message);
      }
    }

    if (!kiState.latest) return response; // nothing to add -- stay quiet

    const patched = kiPatchAttackData(data, kiState.latest);
    if (patched === data) return response;
    try {
      return new KI_W.Response(JSON.stringify(patched), { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (e) {
      kiWarn("Could not reveal saved equipment in Torn's attack display", e.message);
      return response;
    }
  }

  function kiInstallFetchObserver() {
    const originalFetch = KI_W.fetch;
    if (typeof originalFetch !== 'function') { kiDiag.hook = 'no fetch available'; return; }
    if (originalFetch.__krakenIntelWrapped) { kiDiag.hook = 'fetch already hooked by another script'; return; }
    function krakenIntelFetch(...args) {
      const result = Reflect.apply(originalFetch, this, args);
      if (!kiIsAttackDataRequest(args[0])) return result;
      kiDiag.seen++; kiDiag.hook = 'fetch \u2713'; kiDiagRender();
      return result.then((response) => {
        if (!response || !response.ok) return response;
        return kiPrepareAttackResponse(response);
      });
    }
    krakenIntelFetch.__krakenIntelWrapped = true;
    KI_W.fetch = krakenIntelFetch;
    if (!kiDiag.hook) kiDiag.hook = 'waiting';
    kiInstallXhrObserver();
  }

  // Torn may load attack data with XMLHttpRequest instead of fetch: watch
  // those too (observe only -- the response is never changed).
  function kiInstallXhrObserver() {
    try {
      const X = KI_W.XMLHttpRequest;
      if (!X || !X.prototype || X.prototype.__krakenIntelXhr) return;
      const open = X.prototype.open;
      const send = X.prototype.send;
      X.prototype.open = function (method, url) {
        try { this.__kiAtk = kiIsAttackDataRequest(String(url)); } catch (e) { this.__kiAtk = false; }
        return open.apply(this, arguments);
      };
      X.prototype.send = function () {
        if (this.__kiAtk) {
          this.addEventListener('load', () => {
            try {
              kiDiag.seen++; kiDiag.hook = 'xhr \u2713';
              const data = JSON.parse(this.responseText);
              if (kiObjectRecord(data) && kiBuildCapture(data)) kiReceiveAttackData(data).catch((e) => kiWarn('Could not process attack response', e.message));
              else kiDiag.noLoadout++;
              kiDiagRender();
            } catch (e) { /* not JSON */ }
          });
        }
        return send.apply(this, arguments);
      };
      X.prototype.__krakenIntelXhr = true;
    } catch (e) { kiWarn('XHR hook failed', e && e.message); }
  }

  // ---------------------------------------------------------------------
  // KRAKEN INTEL -- Phase 3: display
  // The profile panel sits inline beneath Torn's own Actions section,
  // styled to match Torn's grey panels, and starts open. On attack pages
  // there is no panel at all -- just small labels positioned near the
  // defender's weapons/armour (calibrated to the same spots the standalone
  // script used) and a brief, auto-dismissing notice if Torn sent attack
  // data with no usable loadout. Torn's own attacker controls, Start
  // Fight button, and hospital/travel messages are never touched.
  // ---------------------------------------------------------------------
  const KI_WEAPON_POS = { 1: { x: 20, y: 12.5 }, 2: { x: 80, y: 12.5 }, 3: { x: 20, y: 90 }, 5: { x: 80, y: 90 } };
  const KI_ARMOUR_POS = {
    4: [{ top: '30%', left: '60%' }],
    6: [{ top: '14%', left: '60%' }],
    7: [{ top: '42%', left: '60%' }],
    8: [{ top: '77%', left: '67%' }, { top: '77%', left: '54%' }],
    9: [{ top: '42%', left: '42%' }, { top: '42%', left: '77%' }],
  };
  const KI_ATTACKER_WEAPON_MARKERS = { 1: ['attacker_Primary', 'weapon_main'], 2: ['attacker_Secondary', 'weapon_second'], 3: ['attacker_Melee', 'weapon_melee'], 5: ['attacker_Temporary', 'weapon_temp'] };
  const kiView = { panel: null, body: null, status: '', noDataShown: false, hideTimer: null, placementObserver: null, attackObserver: null, attackFrame: null };

  function kiObservationConfidence(observedAt) {
    const ageHours = (Date.now() - Date.parse(observedAt)) / 3600000;
    if (!Number.isFinite(ageHours) || ageHours < 0) return { key: 'unknown', label: 'Unknown age' };
    if (ageHours < 24) return { key: 'high', label: 'High confidence' };
    if (ageHours < 24 * 7) return { key: 'medium', label: 'Medium confidence' };
    if (ageHours < 24 * 30) return { key: 'low', label: 'Low confidence' };
    return { key: 'stale', label: 'Stale intel' };
  }

  function kiFmt2(n) {
    return (n === null || n === undefined || !Number.isFinite(Number(n))) ? null : Number(n).toFixed(2);
  }

  function kiItemSummary(item) {
    const details = [];
    if (kiIsArmourSlot(item)) {
      const arm = kiFmt2(item.armour);
      if (arm !== null) details.push(`ARM ${arm}`);
    } else {
      const dmg = kiFmt2(item.damage);
      const acc = kiFmt2(item.accuracy);
      if (dmg !== null) details.push(`DMG ${dmg}`);
      if (acc !== null) details.push(`ACC ${acc}`);
    }
    if (item.rarity) details.push(String(item.rarity));
    (Array.isArray(item.bonuses) ? item.bonuses : []).forEach((b) => {
      details.push(b.value == null ? b.name : `${b.name} ${b.value}%`);
    });
    return details.join(' \u00b7 ');
  }

  function kiShowAttackNotice(text) {
    if (kiPageDetails().type !== 'attack') return;
    let el = document.getElementById('tws-ki-attack-notice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tws-ki-attack-notice';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
    if (kiView.hideTimer) clearTimeout(kiView.hideTimer);
    kiView.hideTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
  }

  // ---- profile panel ----
  function kiProfileActionsPanel() {
    const headings = document.querySelectorAll(".profile-wrapper .title-black, #profileroot [class*='title'], .user-profile [class*='title']");
    for (const h of headings) {
      if ((h.textContent || '').trim().toLowerCase() !== 'actions') continue;
      return h.closest('.profile-wrapper') || h.parentElement;
    }
    return null;
  }

  // The box headed "Medals" on a profile (the Intel panel goes right above it).
  function kiProfileMedalsBox() {
    const headings = document.querySelectorAll(".profile-wrapper .title-black, #profileroot [class*='title'], .user-profile [class*='title']");
    for (const h of headings) {
      if ((h.textContent || '').trim().toLowerCase() !== 'medals') continue;
      return h.closest('[class*="medal"]') || h.parentElement;
    }
    return null;
  }

  function kiPlaceProfilePanel__raw(panel) {
    const medals = pcMode() ? kiProfileMedalsBox() : null;
    if (pcMode() && medals && medals.parentElement && !medals.contains(panel)) {
      if (medals.previousElementSibling !== panel) medals.before(panel);
      try { kiProfileTopWarn(); } catch (e) { /* ignore */ }
      if (panel.hidden && featureOn('kiShowIntel')) panel.hidden = false;
      if (kiDiag.panel !== 'above Medals \u2713') { kiDiag.panel = 'above Medals \u2713'; kiDiagRender(); }
      return true;
    }
    const actions = kiProfileActionsPanel();
    if (!actions || !actions.parentElement) {
      // Torn's "Actions" box not found (layout differs, e.g. in PDA): after a
      // short grace period, sit under the first profile box instead.
      if (Date.now() - (kiView.mountedAt || 0) < 2500) return false;
      const fb = document.querySelector('.profile-wrapper') || document.querySelector('#profileroot');
      if (!fb) { if (kiDiag.panel !== 'no place found on the page') { kiDiag.panel = 'no place found on the page'; kiDiagRender(); } return false; }
      if (fb.id === 'profileroot') { if (fb.firstElementChild !== panel) fb.prepend(panel); }
      else if (fb.nextElementSibling !== panel) fb.after(panel);
      if (kiDiag.panel !== 'fallback spot (Actions box not found)') { kiDiag.panel = 'fallback spot (Actions box not found)'; kiDiagRender(); }
      return true;
    }
    if (actions.nextElementSibling !== panel) actions.after(panel);
    try { kiProfileTopWarn(); } catch (e) { /* ignore */ }
    if (kiDiag.panel !== 'under Actions \u2713') { kiDiag.panel = 'under Actions \u2713'; kiDiagRender(); }
    return true;
  }

  function kiMaintainProfilePanelPlacement(panel) {
    kiPlaceProfilePanel(panel);
    if (kiView.placementObserver) kiView.placementObserver.disconnect();
    // Watches the whole page, so it must ignore the War Room's own DOM
    // updates (roster renders, 1s countdowns) -- otherwise it re-placed the
    // panel ~7x a second on PC. Torn's own changes are batched to one
    // placement check per frame.
    let kiPlaceQueued = false;
    kiView.placementObserver = PerfMO('kiMaintainProfilePanelPlacement observer', (records) => {
      if (!panel.isConnected) {
        kiView.placementObserver.disconnect();
        kiView.placementObserver = null;
        return;
      }
      const fromTorn = records.some((r) => {
        const el = r.target && (r.target.nodeType === 1 ? r.target : r.target.parentElement);
        return !(el && el.closest && el.closest('[id^="tws-"]'));
      });
      if (!fromTorn || kiPlaceQueued) return;
      kiPlaceQueued = true;
      requestAnimationFrame(() => {
        kiPlaceQueued = false;
        if (panel.isConnected) kiPlaceProfilePanel(panel);
      });
    });
    kiView.placementObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Armour that completely blocks temporaries (Torn wiki: Armor -> Temporary
  // Item Blocking). Nothing blocks Smoke Grenades.
  const KI_TEMP_BLOCKS = [
    ['delta gas mask', ['Pepper Spray', 'Tear Gas', 'Nerve Gas']],
    ['vanguard respirator', ['Pepper Spray', 'Tear Gas', 'Nerve Gas']],
    ['hazmat suit', ['Pepper Spray', 'Tear Gas', 'Nerve Gas']],
    ['welding helmet', ['Pepper Spray', 'Flash Grenade']],
    ['eod helmet', ['Pepper Spray', 'Concussion Grenade']],
    ['riot helmet', ['Pepper Spray']],
    ['motorcycle helmet', ['Pepper Spray']],
    ['marauder face mask', ['Pepper Spray']],
  ];
  // Delta armour's Invulnerable bonus reduces negative status effects, so
  // these temps may be ineffective (reduced, not blocked).
  const KI_STATUS_TEMPS = ['Pepper Spray', 'Tear Gas', 'Flash Grenade', 'Smoke Grenade', 'Concussion Grenade', 'Nerve Gas'];
  function kiTempWarnings(items) {
    const blocks = [];
    const blocked = {};
    let delta = 0;
    (items || []).forEach((it) => {
      const nm = String((it && it.name) || '').toLowerCase();
      const hit = KI_TEMP_BLOCKS.find(([k]) => nm.includes(k));
      if (hit) { blocks.push({ item: it.name, temps: hit[1] }); hit[1].forEach((t) => { blocked[t] = blocked[t] || it.name; }); }
      if (/\bdelta\b/.test(nm)) delta++;
    });
    const reduced = delta ? KI_STATUS_TEMPS.filter((t) => !blocked[t]) : [];
    return { blocks, blocked, delta, reduced, any: blocks.length > 0 || reduced.length > 0 };
  }
  function kiListTemps(t) { return t.length > 1 ? `${t.slice(0, -1).join(', ')} & ${t[t.length - 1]}` : t[0]; }
  function kiTempWarnLines(w) {
    const lines = w.blocks.map((b) => ({ cls: 'block', text: `\u26d4 ${b.item}: ${kiListTemps(b.temps)} WON\u2019T WORK` }));
    if (w.reduced.length) lines.push({ cls: 'reduce', text: `\u26a0 Delta armour (${w.delta} piece${w.delta > 1 ? 's' : ''}): ${kiListTemps(w.reduced)} may be ineffective` });
    return lines;
  }
  function kiTempWarnEl(w, extraClass) {
    const el = document.createElement('div');
    el.className = `tws-ki-tempwarn ${extraClass || ''}`.trim();
    const head = document.createElement('div');
    head.className = 'tws-ki-tempwarn-head';
    head.textContent = '\u26a0 TEMPORARY WARNING';
    el.appendChild(head);
    kiTempWarnLines(w).forEach((l) => {
      const row = document.createElement('div');
      row.className = `tws-ki-tempwarn-${l.cls}`;
      row.textContent = l.text;
      el.appendChild(row);
    });
    el.title = 'From their Kraken Intel loadout (Torn wiki: Armor \u2192 Temporary Item Blocking; Delta: Invulnerable).';
    return el;
  }
  // Profile: the banner goes at the very top of the profile, not just in
  // the Intel panel further down.
  function kiProfileTopWarn() {
    const old = document.getElementById('tws-ki-tempwarn-top');
    const w = (featureOn('kiTempWarn') && featureOn('kiShowIntel') && kiState.latest) ? kiTempWarnings(kiState.latest.items) : null;
    if (!w || !w.any) { if (old) old.remove(); return; }
    const first = document.querySelector('#profileroot .profile-wrapper, .profile-wrapper');
    if (!first || !first.parentElement) return;
    const el = kiTempWarnEl(w, 'tws-ki-tempwarn-big');
    el.id = 'tws-ki-tempwarn-top';
    if (old && old.textContent === el.textContent && old.nextElementSibling === first) return;
    if (old) old.remove();
    first.before(el);
  }
  // Attack page: your own equipped Temporary, if Torn's slot names it.
  function kiAttackerTempName() {
    const wrap = kiAttackerWeaponWrapper(5);
    if (!wrap) return { wrap: null, name: '' };
    const bits = [wrap.textContent || '', wrap.getAttribute('aria-label') || '', wrap.getAttribute('title') || ''];
    wrap.querySelectorAll('img, [aria-label], [title]').forEach((e) => bits.push(`${e.getAttribute('alt') || ''} ${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''}`));
    const hay = bits.join(' ').toLowerCase();
    return { wrap, name: KI_STATUS_TEMPS.find((t) => hay.includes(t.toLowerCase())) || '' };
  }
  let kiTempToastFor = null;

  // ---- Enemy job perks (company specials that matter in a fight) ----
  // [stars needed, special, what it means for you, 'key' = changes how you fight them]
  const KI_JOB_PERKS = {
    36: ['Ladies Strip Club', [[3, 'Hench', '+25% passive defence', 'key'], [5, 'Hormonal', '+50% Serotonin effect', 'info'], [10, 'Hardbody', '30% less melee damage taken', 'key']]],
    26: ['Gents Strip Club', [[3, 'Dancer\u2019s Flair', '+25% passive dexterity', 'key'], [5, 'Supple', '+50% Tyrosine effect', 'info'], [10, 'No Touching', '25% chance to dodge melee', 'key']]],
    5: ['Clothing Store', [[5, 'Activewear', '+25% passive dexterity', 'key'], [10, 'Tailoring', '+20% armour mitigation', 'key']]],
    37: ['Private Security Firm', [[3, 'Tactical Breach', '+50% flash grenade intensity', 'info'], [7, 'Regulation', '+25% full armour set bonus', 'key']]],
    10: ['Adult Novelties', [[7, 'Bondage', 'your speed is cut by 25%', 'key']]],
    21: ['Furniture Store', [[7, 'Beefcake', '+25% passive strength', 'key'], [10, 'Brute Force', 'double fist & kick damage', 'info']]],
    22: ['Gas Station', [[3, 'Fueled', '+25% passive speed', 'key'], [5, 'Cauterize', 'occasionally heals during the fight', 'key'], [7, 'Fireproof', 'half fire damage taken', 'info'], [10, 'Blaze of Glory', '+50% fire damage dealt', 'info']]],
    23: ['Music Store', [[5, 'High-fidelity', 'reduces your stealth', 'info'], [10, 'The Score', '+15% to all battle stats', 'key']]],
    38: ['Mining Corporation', [[7, 'Essential Salts', '+10% maximum life', 'key'], [10, 'Preserved Meat', 'can boost life to 150%', 'key']]],
    32: ['Lingerie Store', [[5, 'Born Free', '+50% speed & dexterity when wearing no armour', 'info']]],
    6: ['Gun Shop', [[5, 'Skilled Analysis', 'always sees your loadout', 'info'], [7, 'Bandoleer', 'an extra clip for guns', 'info'], [10, 'Firearms Expert', '+10% gun damage', 'info']]],
    4: ['Car Dealership', [[10, 'Getaway Car', 'can always escape', 'info']]],
    18: ['Zoo', [[10, 'Seasoned Poacher', '+3 accuracy', 'info']]],
    1: ['Hair Salon', [[5, 'Rumors', 'reduces your stealth', 'info'], [10, 'Sweeney\u2019s Revenge', '+20% slashing weapon damage', 'info']]],
    25: ['Pub', [[3, 'Drunken Master', '+10% melee damage', 'info']]],
    27: ['Restaurant', [[3, 'Butcher', '+10% melee damage', 'info']]],
    19: ['Firework Stand', [[5, 'Pyromania', 'stronger flamethrower', 'info']]],
    31: ['Amusement Park', [[7, 'Adrenaline Rush', '+25% Epinephrine effect', 'info']]],
  };
  const KI_JOB_TTL = 24 * 3600 * 1000;
  const kiJobBusy = new Set();
  function kiJobCache() { const c = getCfg('tws_ki_jobs', {}); return (c && typeof c === 'object') ? c : {}; }
  // Cached job info for a player, or null while it's being fetched (once).
  function kiJobFor(id, onReady) {
    id = Number(id);
    if (!id || !featureOn('kiJobWarn')) return null;
    const c = kiJobCache()[id];
    if (c && Date.now() - c.t < KI_JOB_TTL) return c;
    if (!kiJobBusy.has(id) && getApiKey()) {
      kiJobBusy.add(id);
      kiFetchJob(id).then((info) => {
        const all = kiJobCache();
        all[id] = info;
        const keep = Object.entries(all).sort((x, y) => y[1].t - x[1].t).slice(0, 300);
        setCfg('tws_ki_jobs', Object.fromEntries(keep));
        if (onReady) onReady(info);
      }).catch(() => {}).finally(() => kiJobBusy.delete(id));
    }
    return c || null; // stale data is still shown while refreshing
  }
  async function kiFetchJob(id) {
    const p = await apiFetch(`user/${id}`, 'profile');
    const j = (p && p.job) || {};
    const info = { t: Date.now(), type: Number(j.company_type) || 0, company: j.company_name ? String(j.company_name).replace(/&amp;/g, '&') : '', companyId: Number(j.company_id) || 0, position: j.position || '', jobName: j.job || '', stars: null };
    if (info.companyId) {
      try {
        const cp = await apiFetch(`company/${info.companyId}`, 'profile');
        const r = cp && cp.company && Number(cp.company.rating);
        if (r >= 0) info.stars = r;
      } catch (e) { /* key can't read company stars -- shown as "needs N★" */ }
    }
    return info;
  }
  // { title, lines: [{ text, key, active }] } for a cached job, or null.
  function kiJobSummary(info) {
    if (!info) return null;
    const def = KI_JOB_PERKS[info.type];
    if (!info.type) {
      const jn = String(info.jobName || '');
      const p = String(info.position || '');
      if (!jn && !p || /^none$/i.test(jn || p)) return { title: 'No job', lines: [] };
      return { title: `Job: ${jn || p}${jn && p && p !== jn ? ` (${p})` : ''}`, lines: [] };
    }
    const name = (def && def[0]) || 'Company';
    const title = `Job: ${name}${info.stars != null ? ` ${info.stars}★` : ''}`;
    if (!def) return { title, lines: [] };
    const lines = def[1].filter((x) => info.stars == null || info.stars >= x[0])
      .map(([st, , text, lvl]) => ({ text: info.stars == null ? `${text} (if ${st}★+)` : text, key: lvl === 'key' }));
    return { title, lines, starsUnknown: info.stars == null };
  }
  // Key perks only, for the attack-page warning tab.
  function kiJobWarnLines(id) {
    const sm = kiJobSummary(kiJobFor(id, () => { try { kiScheduleAttackEquipmentRender(); } catch (e) { /* ignore */ } }));
    if (!sm) return [];
    return sm.lines.filter((l) => l.key).map((l) => ({ cls: 'job', text: `💼 ${sm.title.replace(/^Job: /, '')}: ${l.text}` }));
  }
  function kiJobHtml(id, rerender) {
    const sm = kiJobSummary(kiJobFor(id, rerender));
    if (!sm) return '';
    const lines = sm.lines.map((l) => `<div class="tws-job-line${l.key ? ' is-key' : ''}">${l.key ? '⚠ ' : ''}${kiEsc(l.text)}</div>`).join('');
    return `<div class="tws-job"><div class="tws-job-title">💼 ${kiEsc(sm.title)}</div>${lines}${sm.starsUnknown && sm.lines.length ? '<div class="tws-job-note">Company stars not available with your key – add Company: profile to see which are active.</div>' : ''}</div>`;
  }

  // Item rarity colour (yellow / orange / red) from the intel, if Torn gave it.
  function kiRarityOf(item) {
    const r = String((item && item.rarity) || '').toLowerCase().match(/yellow|orange|red/);
    if (r) return r[0];
    try {
      const raw = JSON.stringify((item && item.raw_source) || {}).toLowerCase();
      const m = raw.match(/glow[-_ ]?(yellow|orange|red)|"(?:rarity|glow|glowclass|colou?r)"\s*:\s*"[^"]*?(yellow|orange|red)/);
      if (m) return m[1] || m[2];
    } catch (e) { /* ignore */ }
    return null;
  }
  function kiBonusChips(item) {
    const rar = kiRarityOf(item);
    return (Array.isArray(item.bonuses) ? item.bonuses : []).map((b) => {
      const chip = document.createElement('span');
      chip.className = `tws-ki-chip${rar ? ` is-${rar}` : ''}`;
      chip.textContent = b.value == null ? b.name : `${b.value}% ${b.name}`;
      return chip;
    });
  }

  // ---- Attack page: temporary warning (flash, then a small tab) ----
  let kiTempFlashFor = null;
  const kiRarityAsked = new Set();
  function kiTempPopEl(w, extra, jobs) {
    const el = document.createElement('div');
    el.className = `tws-ki-temp-pop ${extra || ''}`.trim();
    const head = document.createElement('div');
    head.className = 'tws-ki-temp-pop-head';
    head.textContent = w.any ? '\u26a0 Temporary warning' : '\u26a0 Watch out';
    el.appendChild(head);
    kiTempWarnLines(w).concat(jobs || []).forEach((l) => {
      const row = document.createElement('div');
      row.className = `tws-ki-temp-pop-${l.cls}`;
      row.textContent = l.text;
      el.appendChild(row);
    });
    return el;
  }
  function kiShowTempWarnUI(w, avatar, jobs) {
    jobs = jobs || [];
    const mine = kiAttackerTempName();
    const tempWrap = mine.wrap || kiAttackerWeaponWrapper(5);
    const hard = !!(mine.name && w.blocked[mine.name]);
    const soft = !hard && !!(mine.name && w.reduced.includes(mine.name));
    if (tempWrap && (hard || soft)) tempWrap.classList.add(hard ? 'tws-ki-temp-bad' : 'tws-ki-temp-warn');
    const sev = (hard || (!soft && w.blocks.length) || (!w.any && jobs.length)) ? 'is-block' : 'is-reduce';
    const tab = document.createElement('div');
    tab.className = `tws-ki-temp-tab ${sev}`;
    tab.textContent = '⚠';
    tab.setAttribute('role', 'button');
    tab.setAttribute('aria-label', 'Temporary warning');
    const sx = window.scrollX || 0;
    const sy = window.scrollY || 0;
    const r = (tempWrap || avatar).getBoundingClientRect();
    if (tempWrap) {
      tab.style.left = `${Math.round(r.right + sx + 2)}px`;
      tab.style.top = `${Math.round(r.top + sy + r.height / 2 - 13)}px`;
    } else {
      tab.style.left = `${Math.round(r.left + sx + 4)}px`;
      tab.style.top = `${Math.round(r.top + sy + 4)}px`;
    }
    document.body.appendChild(tab);
    tab.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); kiToggleTempPop(w, tab, jobs); });
    const key = `${kiState.latest && kiState.latest.target_id}|${kiTempWarnLines(w).concat(jobs).map((l) => l.text).join('|')}`;
    if (kiTempFlashFor !== key) { kiTempFlashFor = key; kiFlashTempWarn(w, avatar, tab, jobs); }
  }
  function kiFlashTempWarn(w, avatar, tab, jobs) {
    document.querySelectorAll('.tws-ki-temp-flash').forEach((n) => n.remove());
    const el = kiTempPopEl(w, 'tws-ki-temp-flash', jobs);
    document.body.appendChild(el);
    const sx = window.scrollX || 0;
    const sy = window.scrollY || 0;
    const ar = avatar.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    el.style.left = `${Math.round(Math.max(sx + 6, ar.left + sx + ar.width / 2 - er.width / 2))}px`;
    el.style.top = `${Math.round(Math.max(sy + 6, ar.top + sy + ar.height * 0.45 - er.height / 2))}px`;
    setTimeout(() => {
      if (!el.isConnected) return;
      const live = document.querySelector('.tws-ki-temp-tab') || tab;
      const tr = live.getBoundingClientRect();
      const e2 = el.getBoundingClientRect();
      if (tr.width) el.style.transform = `translate(${Math.round(tr.left + tr.width / 2 - (e2.left + e2.width / 2))}px, ${Math.round(tr.top + tr.height / 2 - (e2.top + e2.height / 2))}px) scale(0.12)`;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 420);
    }, 1600);
  }
  function kiToggleTempPop(w, tab, jobs) {
    const old = document.querySelector('.tws-ki-temp-open');
    if (old) { old.remove(); return; }
    const el = kiTempPopEl(w, 'tws-ki-temp-open', jobs);
    document.body.appendChild(el);
    const sx = window.scrollX || 0;
    const sy = window.scrollY || 0;
    const tr = tab.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    let left = tr.right + sx + 4;
    if (left + er.width > sx + window.innerWidth - 6) left = Math.max(sx + 6, tr.left + sx - er.width - 4);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(Math.max(sy + 4, tr.top + sy + tr.height / 2 - er.height / 2))}px`;
    el.addEventListener('click', () => el.remove());
    setTimeout(() => { if (el.isConnected) el.remove(); }, 5000);
  }

  function kiRenderProfilePanel() {
    try { kiProfileTopWarn(); } catch (e) { /* ignore */ }
    if (!kiView.body) return;
    kiView.body.replaceChildren();

    if (!featureOn('kiShowIntel')) {
      kiView.panel.hidden = true;
      return;
    }
    kiView.panel.hidden = false;

    if (kiView.status) {
      const status = document.createElement('div');
      status.className = 'tws-ki-status';
      status.textContent = kiView.status;
      kiView.body.appendChild(status);
    }

    {
      const sh = tsSpyHtml(kiCurrentTargetId(), () => { try { kiRenderProfilePanel(); } catch (e) { /* ignore */ } });
      if (sh) { const sw = document.createElement('div'); sw.innerHTML = sh; kiView.body.appendChild(sw.firstElementChild); }
    }
    if (!kiState.latest) {
      if (!kiView.status) {
        const empty = document.createElement('div');
        empty.className = 'tws-ki-status';
        empty.textContent = 'No shared loadout has been observed for this player yet.';
        kiView.body.appendChild(empty);
      }
      return;
    }

    if (featureOn('kiTempWarn')) {
      const w = kiTempWarnings(kiState.latest.items);
      if (w.any) kiView.body.appendChild(kiTempWarnEl(w));
    }
    const meta = document.createElement('div');
    meta.className = 'tws-ki-meta';
    const confidence = kiObservationConfidence(kiState.latest.observed_at);
    const target = kiState.latest.target_name ? `${kiState.latest.target_name} [${kiState.latest.target_id}]` : `Player ${kiState.latest.target_id}`;
    const identity = document.createElement('span');
    identity.textContent = `${target} \u00b7 ${new Date(kiState.latest.observed_at).toLocaleString()}`;
    const badge = document.createElement('span');
    badge.className = `tws-ki-confidence is-${confidence.key}`;
    badge.textContent = confidence.label;
    meta.append(identity, badge);
    kiView.body.appendChild(meta);
    {
      const jh = kiJobHtml(kiState.latest.target_id, () => { try { kiRenderProfilePanel(); } catch (e) { /* ignore */ } });
      if (jh) { const jw = document.createElement('div'); jw.innerHTML = jh; kiView.body.appendChild(jw.firstElementChild); }
    }

    const items = kiState.latest.items.filter((i) => i && i.item_id !== 999);
    const bySlot = (n) => items.find((i) => Number(i.equip_slot) === n) || null;
    // Missing rarity (older / shared intel): one Torn API lookup per player.
    const tid = kiState.latest.target_id;
    if (!kiRarityAsked.has(tid) && items.some((i) => !kiRarityOf(i) && kiPositiveInteger(i.armoury_id))) {
      kiRarityAsked.add(tid);
      kiRefreshLatestArmourDetails().then(() => { try { kiRenderProfilePanel(); } catch (e) { /* ignore */ } }).catch(() => {});
    }
    const makeRow = (slotNo, item) => {
      const row = document.createElement('div');
      const rar = item ? kiRarityOf(item) : null;
      row.className = `tws-ki-row${rar ? ` is-${rar}` : ''}${item ? '' : ' is-empty'}`;
      const imageWrap = document.createElement('span');
      imageWrap.className = 'tws-ki-image-wrap';
      const imageUrl = item && (item.image_url || (item.item_id ? `https://www.torn.com/images/items/${item.item_id}/large.png` : null));
      if (imageUrl) {
        const image = document.createElement('img');
        image.className = 'tws-ki-image';
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('error', () => imageWrap.classList.add('is-missing'), { once: true });
        imageWrap.appendChild(image);
      } else {
        imageWrap.classList.add('is-missing');
      }
      const content = document.createElement('span');
      content.className = 'tws-ki-item';
      const top = document.createElement('span');
      top.className = 'tws-ki-top';
      const name = document.createElement('strong');
      name.textContent = item ? item.name : 'Unknown';
      top.appendChild(name);
      if (item) kiBonusChips(item).forEach((c) => top.appendChild(c));
      const details = document.createElement('small');
      const slotName = KI_COMBAT_SLOTS.get(slotNo) || 'Item';
      const bits = [slotName];
      if (item) {
        if (kiIsArmourSlot(item)) {
          const arm = kiFmt2(item.armour);
          if (arm !== null) bits.push(`ARM ${arm}`);
          const nm = String(item.name || '').toLowerCase();
          const blk = KI_TEMP_BLOCKS.find(([k]) => nm.includes(k));
          if (blk) bits.push(`Blocks: ${kiListTemps(blk[1])}`);
        } else {
          const dmg = kiFmt2(item.damage);
          const acc = kiFmt2(item.accuracy);
          if (dmg !== null) bits.push(`DMG ${dmg}`);
          if (acc !== null) bits.push(`ACC ${acc}`);
        }
      }
      details.textContent = bits.join(' · ');
      content.append(top, details);
      row.append(imageWrap, content);
      return row;
    };
    const cols = document.createElement('div');
    cols.className = 'tws-ki-cols';
    [['Weapons', [1, 2, 3, 5]], ['Armour', [6, 4, 7, 8, 9]]].forEach(([title, slots]) => {
      const col = document.createElement('div');
      col.className = 'tws-ki-col';
      const h = document.createElement('div');
      h.className = 'tws-ki-col-head';
      h.textContent = title;
      col.appendChild(h);
      slots.forEach((n) => col.appendChild(makeRow(n, bySlot(n))));
      cols.appendChild(col);
    });
    kiView.body.appendChild(cols);

    const note = document.createElement('div');
    note.className = 'tws-ki-note';
    note.textContent = featureOn('kiContribute')
      ? 'Shared automatically with the Kraken Intel contributor network. Newer observations take priority.'
      : "Saved locally on this device. Turn on \u201cShare loadouts\u201d in \u2699 Advanced to contribute.";
    kiView.body.appendChild(note);
  }

  function kiMountProfilePanel() {
    if (kiPageDetails().type !== 'profile' || !kiCurrentTargetId() || !document.body) return;
    if (kiView.panel && kiView.panel.isConnected) return;
    const panel = document.createElement('section');
    panel.id = 'tws-ki-panel';
    const head = document.createElement('div');
    head.className = 'tws-ki-head';
    const title = document.createElement('span');
    title.textContent = '\ud83d\udc19 Kraken Intel';
    head.appendChild(title);
    const body = document.createElement('div');
    body.className = 'tws-ki-body';
    panel.append(head, body);
    document.body.appendChild(panel);
    kiView.panel = panel;
    kiView.body = body;
    kiView.mountedAt = Date.now();
    kiMaintainProfilePanelPlacement(panel);
    setTimeout(() => kiPlaceProfilePanel(panel), 2700); // fallback check even if the page goes quiet
    kiRenderProfilePanel();
  }

  // ---- attack-page overlay ----
  function kiAttackAvatarArea() {
    const defenderModal = document.querySelector("[class*='modal'][class*='defender']");
    if (defenderModal) return defenderModal.closest("[class*='playerArea']") || defenderModal.parentElement;
    const areas = Array.from(document.querySelectorAll("#attack-root [class*='playerArea'], [class*='playerArea']"));
    if (areas.length) return areas.find((a) => a.querySelector("[class*='defender'], [id*='defender']")) || areas[areas.length - 1];
    return document.querySelector("#attack-root [class*='fight'], #attack-root") || null;
  }

  function kiAttackerWeaponWrapper(slot) {
    for (const id of KI_ATTACKER_WEAPON_MARKERS[slot] || []) {
      const marker = document.getElementById(id);
      if (!marker) continue;
      return marker.matches("[class*='weaponWrapper']") ? marker : (marker.closest("[class*='weaponWrapper']") || marker);
    }
    const slotIndex = { 1: 0, 2: 1, 3: 2, 5: 3 }[Number(slot)];
    if (slotIndex === undefined) return null;
    const candidates = Array.from(document.querySelectorAll("#attack-root [class*='weaponWrapper'], [class*='weaponWrapper']"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width >= 70 && r.height >= 60 && r.left < window.innerWidth * 0.32 && r.bottom > 0 && r.top < window.innerHeight;
      })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return candidates[slotIndex] || null;
  }

  function kiWeaponPosition(slot) {
    return KI_WEAPON_POS[slot] || { x: 50, y: 50 };
  }

  function kiAttackEquipmentBounds(avatar) {
    const avatarRect = avatar.getBoundingClientRect();
    const weaponRects = [1, 2, 3, 5].map(kiAttackerWeaponWrapper).filter(Boolean).map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    return {
      left: weaponRects.length ? Math.max(...weaponRects.map((r) => r.right)) + 8 : avatarRect.left + 8,
      right: avatarRect.right - 8,
      top: weaponRects.length ? Math.min(...weaponRects.map((r) => r.top)) + 8 : avatarRect.top + 8,
      bottom: weaponRects.length ? Math.max(...weaponRects.map((r) => r.bottom)) - 8 : avatarRect.bottom - 8,
    };
  }

  function kiPositionWeaponLabel(label, position, bounds) {
    label.style.left = `${Math.round(bounds.left + (bounds.right - bounds.left) * position.x / 100)}px`;
    label.style.top = `${Math.round(bounds.top + (bounds.bottom - bounds.top) * position.y / 100)}px`;
  }

  function kiCreateEnemyWeaponLabel(item, bounds) {
    const label = document.createElement('div');
    label.className = 'tws-ki-enemy-weapon-label';
    label.title = `${item.slot_name || 'Weapon'} \u2014 ${item.name}`;
    const image = document.createElement('img');
    image.src = item.image_url || `https://www.torn.com/images/items/${item.item_id}/large.png`;
    image.alt = '';
    const copy = document.createElement('span');
    copy.className = 'tws-ki-enemy-weapon-copy';
    const name = document.createElement('strong');
    name.textContent = item.name;
    const damage = document.createElement('span');
    damage.textContent = `Dmg ${kiFmt2(item.damage) !== null ? kiFmt2(item.damage) : '\u2014'}`;
    const accuracy = document.createElement('span');
    accuracy.textContent = `Acc ${kiFmt2(item.accuracy) !== null ? kiFmt2(item.accuracy) : '\u2014'}`;
    copy.append(name, damage, accuracy);
    label.append(copy, image);
    kiPositionWeaponLabel(label, kiWeaponPosition(item.equip_slot), bounds);
    return label;
  }

  // ---- armour: tap Torn's own body-part hotspots (native <area> image map)
  // instead of guessed positions -- these line up exactly with the real
  // body shape. Each area's title is already the equipped item's name
  // (Torn renders it that way), so it's matched directly against our
  // captured items with no slot-number guessing needed.
  const kiArmourBox = { el: null, nameEl: null, statsEl: null };
  let kiArmourBoxFor = null; // which marker (equip_slot-index) the box is currently showing, or null

  function kiEnsureArmourBox() {
    if (kiArmourBox.el && kiArmourBox.el.isConnected) return kiArmourBox;
    const el = document.createElement('div');
    el.id = 'tws-ki-armour-box';
    const name = document.createElement('strong');
    const stats = document.createElement('span');
    el.append(name, stats);
    document.body.appendChild(el);
    kiArmourBox.el = el;
    kiArmourBox.nameEl = name;
    kiArmourBox.statsEl = stats;
    return kiArmourBox;
  }

  function kiHideArmourBox() {
    if (kiArmourBox.el) kiArmourBox.el.style.display = 'none';
    kiArmourBoxFor = null;
  }

  // Positions the box centred on the MARKER's own on-screen position
  // (not the tap point), clamped so it never runs off the edge of the
  // screen.
  function kiShowArmourBoxAt(item, markerEl) {
    const box = kiEnsureArmourBox();
    box.nameEl.textContent = item.name;
    box.statsEl.textContent = kiItemSummary(item) || 'Rating, quality and bonuses not exposed by Torn';
    box.el.style.display = 'block';
    const markerRect = markerEl.getBoundingClientRect();
    const centerX = markerRect.left + markerRect.width / 2;
    const centerY = markerRect.top + markerRect.height / 2;
    const rect = box.el.getBoundingClientRect();
    const pad = 8;
    let left = centerX - rect.width / 2;
    let top = centerY - rect.height / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - rect.height - pad));
    box.el.style.left = `${left}px`;
    box.el.style.top = `${top}px`;
  }

  function kiFindBodyAreas(scope) {
    const img = scope.querySelector('img[usemap]') || scope.querySelector("[class*='bodyImage']");
    const useMap = img && img.getAttribute('usemap');
    if (!useMap) return { img: null, areas: [] };
    // getElementsByName needs no selector-string escaping at all (unlike
    // querySelector), and is supported everywhere -- CSS.escape isn't
    // guaranteed to exist on every embedded WebView, and if it throws it
    // silently kills this whole function before anything else can run.
    const map = document.getElementsByName(useMap.replace(/^#/, ''))[0] || null;
    return { img, areas: map ? Array.from(map.querySelectorAll('area')) : [] };
  }

  // A native <area>'s coords, as a bounding box (mobile browsers don't
  // reliably fire click events on the <area> elements themselves, so
  // rather than depend on that, this reads the same coordinates Torn
  // defines and we draw our own real, clickable element over them).
  function kiParseAreaBounds(area) {
    const nums = (area.getAttribute('coords') || '').split(',').map(Number).filter((n) => Number.isFinite(n));
    if (nums.length < 4) return null;
    const xs = [], ys = [];
    for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
    if (!xs.length) return null;
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }

  // Listens for clicks on Torn's REAL <area> elements directly (event
  // delegation on the document), instead of drawing anything of our own on
  // top of them. Nothing new sits over the avatar, so there's nothing that
  // can block Torn's own handling of the tap. Every outcome reports via a
  // toast, since that's what's actually visible on mobile (unlike the
  // console, which likely isn't reachable here at all).
  // Our own tap-to-reveal markers, positioned over each slot and keyed by
  // our OWN captured equip_slot data -- entirely independent of Torn's own
  // <area> title attribute, which proved unreliable in ways neither the
  // scan tool nor direct testing could pin down.
  function kiRenderArmourMarkers(avatar) {
    kiState.latest.items.forEach((item) => {
      const positions = KI_ARMOUR_POS[Number(item.equip_slot)];
      if (!positions || !positions.length) return;
      positions.forEach((position, posIdx) => {
        const markerKey = `${item.equip_slot}-${posIdx}`;
        const dot = document.createElement('div');
        dot.className = 'tws-ki-armour-dot';
        dot.__twsKiItem = item;
        dot.style.top = position.top;
        dot.style.left = position.left;
        // Any tap -- this marker or a different one -- turns off whatever
        // the box is currently showing. If it wasn't already showing THIS
        // marker, it then opens for this one, centred on it.
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasShowing = kiArmourBoxFor === markerKey;
          kiHideArmourBox();
          if (!wasShowing) {
            kiShowArmourBoxAt(item, dot);
            kiArmourBoxFor = markerKey;
          }
        });
        avatar.appendChild(dot);
      });
    });
  }

  // The defender's weapon slots (Primary, Secondary, Melee, Temporary): the
  // weapon boxes in the defender's area, right of its middle, top to bottom.
  function kiTagDefenderSlots(avatar) {
    document.querySelectorAll('.tws-ki-slot-hover').forEach((el) => { el.classList.remove('tws-ki-slot-hover'); el.__twsKiItem = null; });
    if (!avatar || !kiState.latest || !kiState.latest.items) return;
    const ar = avatar.getBoundingClientRect();
    const mid = ar.left + ar.width / 2;
    const wraps = Array.from(document.querySelectorAll("[class*='weaponWrapper']"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width >= 50 && r.height >= 40 && r.left + r.width / 2 > mid && r.left >= ar.left - 4 && r.right <= ar.right + 4;
      })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    [1, 2, 3, 5].forEach((slot, i) => {
      const el = wraps[i];
      const item = kiState.latest.items.find((it) => Number(it.equip_slot) === slot);
      if (!el || !item) return;
      el.classList.add('tws-ki-slot-hover');
      el.__twsKiItem = item;
    });
  }

  // Hover a weapon slot, an armour marker or a body part: stats appear
  // beside it; move away and they go.
  function kiShowHoverBox(item, el, ev) {
    const box = kiEnsureArmourBox();
    box.nameEl.textContent = item.name;
    box.statsEl.textContent = kiItemSummary(item) || 'Rating, quality and bonuses not exposed by Torn';
    box.el.style.pointerEvents = 'none';
    box.el.style.display = 'block';
    const r = el.getBoundingClientRect();
    const src = (r.width || r.height) ? r : { left: ev.clientX, right: ev.clientX, top: ev.clientY, bottom: ev.clientY, width: 0, height: 0 };
    const b = box.el.getBoundingClientRect();
    const pad = 8;
    let left = src.left - b.width - pad;
    if (left < pad) left = src.right + pad;
    left = Math.max(pad, Math.min(left, window.innerWidth - b.width - pad));
    let top = src.top + (src.height - b.height) / 2;
    top = Math.max(pad, Math.min(top, window.innerHeight - b.height - pad));
    box.el.style.left = `${left}px`;
    box.el.style.top = `${top}px`;
  }
  function kiHoverItemFor(host) {
    if (host.__twsKiItem) return host.__twsKiItem;
    if (host.tagName === 'AREA' && kiState.latest && kiState.latest.items) {
      const nm = (host.getAttribute('title') || host.getAttribute('alt') || '').trim().toLowerCase();
      if (nm) return kiState.latest.items.find((i) => (i.name || '').toLowerCase() === nm) || null;
    }
    return null;
  }
  let kiHoverInstalled = false;
  function kiInstallHoverStats() {
    if (kiHoverInstalled) return;
    kiHoverInstalled = true;
    const SEL = '.tws-ki-slot-hover, .tws-ki-armour-dot, area';
    document.addEventListener('mouseover', (e) => {
      const host = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (!host || !featureOn('kiShowIntel')) return;
      const item = kiHoverItemFor(host);
      if (item) kiShowHoverBox(item, host, e);
    }, true);
    document.addEventListener('mouseout', (e) => {
      const host = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (!host) return;
      if (e.relatedTarget && host.contains(e.relatedTarget)) return;
      kiHideArmourBox();
    }, true);
  }

  function kiRenderAttackEquipment__raw() {
    kiView.attackFrame = null;
    document.querySelectorAll('.tws-ki-enemy-weapons-layer,.tws-ki-armour-dot,.tws-ki-tempwarn-attack,.tws-ki-temp-mark,.tws-ki-temp-tab').forEach((n) => n.remove());
    document.querySelectorAll('.tws-ki-temp-bad,.tws-ki-temp-warn').forEach((n) => n.classList.remove('tws-ki-temp-bad', 'tws-ki-temp-warn'));
    document.querySelectorAll('.tws-ki-attack-avatar-host').forEach((n) => n.classList.remove('tws-ki-attack-avatar-host'));
    document.documentElement.classList.toggle('tws-ki-loadout-revealed', kiPageDetails().type === 'attack' && !!(featureOn('kiShowIntel') && kiState.latest));
    if (kiPageDetails().type !== 'attack' || !featureOn('kiShowIntel') || !kiState.latest || !kiState.latest.items) {
      kiHideArmourBox();
      return;
    }

    const avatar = kiAttackAvatarArea();
    if (!avatar) return;
    avatar.classList.add('tws-ki-attack-avatar-host');
    try {
      const bounds = kiAttackEquipmentBounds(avatar);
      const weaponItems = kiState.latest.items.filter((i) => KI_WEAPON_POS[Number(i.equip_slot)]);
      // PC layout: Torn shows the defender's weapons in its own slots on the
      // right, so no floating labels -- the slots get hover stats instead.
      if (pcMode()) { kiTagDefenderSlots(avatar); kiInstallHoverStats(); }
      {
        const w = featureOn('kiTempWarn') ? kiTempWarnings(kiState.latest.items) : { blocks: [], blocked: {}, delta: 0, reduced: [], any: false };
        const jobs = kiJobWarnLines(kiState.latest.target_id);
        if (w.any || jobs.length) kiShowTempWarnUI(w, avatar, jobs);
      }
      // Mobile Mode: weapons are shown in the ENEMY fold-out tab instead of
      // floating labels around the model.
      if (false && !pcMode() && weaponItems.length && bounds.right > bounds.left && bounds.bottom > bounds.top) {
        const layer = document.createElement('div');
        layer.className = 'tws-ki-enemy-weapons-layer';
        weaponItems.forEach((item) => layer.appendChild(kiCreateEnemyWeaponLabel(item, bounds)));
        document.body.appendChild(layer);
        kiHideLabelsUnderChat();
        kiWatchLabelsUnderChat();
      }
      kiRenderArmourMarkers(avatar);
    } catch (e) {
      kiWarn('Weapon/armour overlay failed', e && e.message, e && e.stack);
    }
  }

  // Labels float above the page, so they'd show through Torn's chat windows.
  // Look at what's really on screen under each label (the layer ignores the
  // pointer, so it isn't in the way) and hide the label if it's a chat window.
  function kiIsChatEl(el) {
    return !!(el && el.closest && el.closest('#chatRoot, [id^="chat"], [class*="chat-box"], [class*="chatBox"], [class*="chat_"], [class*="chat-"], [class*="Chat"]'));
  }
  function kiHideLabelsUnderChat() {
    if (!pageFocused()) return;
    if (typeof document.elementFromPoint !== 'function') return;
    const labels = document.querySelectorAll('.tws-ki-enemy-weapons-layer .tws-ki-enemy-weapon-label');
    labels.forEach((lab) => {
      lab.style.visibility = '';
      const r = lab.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]];
      const covered = pts.some(([fx, fy]) => {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
        return kiIsChatEl(document.elementFromPoint(x, y));
      });
      if (covered) lab.style.visibility = 'hidden';
    });
  }
  let kiChatWatchT = null;
  function kiWatchLabelsUnderChat() {
    if (kiChatWatchT) return;
    kiChatWatchT = setInterval(() => {
      if (!document.querySelector('.tws-ki-enemy-weapons-layer')) { clearInterval(kiChatWatchT); kiChatWatchT = null; return; }
      kiHideLabelsUnderChat();
    }, 500);
  }

  function kiScheduleAttackEquipmentRender() {
    if (!pageFocused()) return;
    if (kiView.attackFrame !== null || kiPageDetails().type !== 'attack') return;
    kiView.attackFrame = requestAnimationFrame(kiRenderAttackEquipment);
  }

  function kiObserveAttackLayout() {
    if (kiView.attackObserver || !document.body) return;
    kiView.attackObserver = PerfMO('kiObserveAttackLayout observer', (records) => {
      const changed = records.some((r) => Array.from(r.addedNodes).concat(Array.from(r.removedNodes)).some((n) =>
        !(n instanceof Element) || !n.matches || !n.matches('.tws-ki-enemy-weapons-layer, .tws-ki-armour-dot, .tws-ki-tempwarn-attack, .tws-ki-temp-mark, .tws-ki-temp-tab, .tws-ki-temp-pop')
      ));
      if (changed) kiScheduleAttackEquipmentRender();
    });
    kiView.attackObserver.observe(document.body, { childList: true, subtree: true });
    kiScheduleAttackEquipmentRender();
  }

  // ---- lifecycle ----

  // ---- fights inside War Room pop-outs ----
  // The pop-out is an iframe on the same site, and this script doesn't run
  // inside frames, so hook the pop-out page's own fetch / XHR from here
  // whenever it shows an attack page (observe only, nothing is changed).
  function kiHookFrameWindow(win, targetId) {
    try {
      if (!win || win.__kiFrameHooked || kalLoadoutRunning(win)) return;
      win.__kiFrameHooked = true;
      const onData = (data) => {
        kiDiag.frameSeen = (kiDiag.frameSeen || 0) + 1;
        if (kiObjectRecord(data) && kiBuildCapture(data, targetId)) {
          kiReceiveAttackData(data, targetId).catch((e) => kiWarn('Could not process pop-out attack', e.message));
        } else {
          kiDiag.frameNoLoadout = (kiDiag.frameNoLoadout || 0) + 1;
        }
        kiDiagRender();
      };
      const of = win.fetch;
      if (typeof of === 'function' && !of.__krakenIntelWrapped) {
        const wrapped = function (...args) {
          const res = Reflect.apply(of, this, args);
          if (!kiIsAttackDataRequest(args[0])) return res;
          return res.then((r) => {
            try { if (r && r.ok) r.clone().json().then(onData).catch(() => {}); } catch (e) { /* ignore */ }
            return r;
          });
        };
        wrapped.__krakenIntelWrapped = true;
        win.fetch = wrapped;
      }
      const X = win.XMLHttpRequest;
      if (X && X.prototype && !X.prototype.__krakenIntelXhr) {
        const open = X.prototype.open;
        const send = X.prototype.send;
        X.prototype.open = function (method, url) {
          try { this.__kiAtk = kiIsAttackDataRequest(String(url)); } catch (e) { this.__kiAtk = false; }
          return open.apply(this, arguments);
        };
        X.prototype.send = function () {
          if (this.__kiAtk) {
            this.addEventListener('load', () => {
              try { onData(JSON.parse(this.responseText)); } catch (e) { /* not JSON */ }
            });
          }
          return send.apply(this, arguments);
        };
        X.prototype.__krakenIntelXhr = true;
      }
      kiDiag.frameHooked = (kiDiag.frameHooked || 0) + 1;
      kiDiagRender();
    } catch (e) {
      kiWarn('Pop-out hook failed', e && e.message);
    }
  }
  function kiWatchPopoutFights() {
    if (IN_POPOUT_FRAME) return;
    setInterval(() => {
      if (!featureOn('kiContribute') && !featureOn('kiShowIntel')) return;
      document.querySelectorAll('#tws-popout iframe').forEach((f) => {
        let win;
        let href;
        try {
          win = f.contentWindow;
          href = win && win.location ? String(win.location.href) : '';
        } catch (e) { return; }
        if (!/[?&]sid=attack(&|#|$)/i.test(href)) return;
        if (win.__twsFrameKI) return; // the pop-out runs its own Intel
        try { if (win.document.readyState !== 'complete') return; } catch (e) { return; }
        if (!win.__twsFallbackAt) { win.__twsFallbackAt = Date.now(); return; }
        if (Date.now() - win.__twsFallbackAt < 2000) return;
        const m = href.match(/user2ID=(\d+)/i);
        if (m) kiHookFrameWindow(win, kiPositiveInteger(m[1]));
      });
    }, 200);
  }

  // KAL - Loadout Revealer (another author's script) hooks the same attack
  // data and draws on the same page. Both running at once can freeze the
  // page, so War Room's loadout feature stands aside whenever KAL is there.
  // ---------------------------------------------------------------------
  // Pop-out fights: add the enemy's loadout to Torn's attack data from the
  // main page, armed the moment the attack page starts loading in the frame
  // (needed on Torn PDA, where scripts don't run inside the pop-out).
  // ---------------------------------------------------------------------
  const kiTab = { targetId: 0, intel: null, live: false, status: '', loading: false, open: false, sig: '' };
  async function kiIntelFor(targetId) {
    if (!targetId) return null;
    if (kiState.latest && kiState.latest.target_id === targetId) return kiState.latest;
    const local = kiLatestStoredCapture(targetId);
    let shared = null;
    try { shared = await kiFetchSharedCapture(targetId); } catch (e) { /* offline / not signed in */ }
    return [local, shared].filter(Boolean)
      .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))[0] || null;
  }
  function kiSetTabIntel(targetId, intel, live, status) {
    if (targetId !== kiTab.targetId) return;
    if (intel) { kiTab.intel = intel; kiTab.live = !!live; }
    if (status) kiTab.status = status;
    kiTab.sig = '';
    try { kiRenderEnemyTab(); } catch (e) { /* ignore */ }
    try { kiTickPopoutAvatar(); } catch (e) { /* ignore */ }
  }
  function kiArmPopoutFrame(frame, url) {
    const m = String(url || '').match(/[?&]sid=attack\b.*?[?&]user2ID=(\d+)/i) || String(url || '').match(/sid=attack.*user2ID=(\d+)/i);
    if (!frame || !m) return;
    if (!featureOn('kiShowIntel') && !featureOn('kiContribute')) return;
    const targetId = kiPositiveInteger(m[1]);
    if (kiTab.targetId !== targetId) { kiTab.targetId = targetId; kiTab.intel = null; kiTab.live = false; kiTab.status = 'Looking for intel\u2026'; }
    const intelP = featureOn('kiShowIntel') ? kiIntelFor(targetId).catch(() => null) : Promise.resolve(null);
    intelP.then((intel) => { if (!kiTab.live) kiSetTabIntel(targetId, intel, false, intel ? '' : 'No intel saved for this player yet.'); });
    let oldDoc = null;
    try { oldDoc = frame.contentDocument; } catch (e) { /* ignore */ }
    const start = Date.now();
    const t = __nativeSetInterval(() => {
      if (Date.now() - start > 20000) { window.clearInterval(t); return; }
      let win;
      try {
        win = frame.contentWindow;
        if (!win || win.document === oldDoc) return;
        if (!new RegExp(`user2ID=${targetId}(\\D|$)`, 'i').test(String(win.location.href))) return;
      } catch (e) { return; }
      window.clearInterval(t);
      if (win.__kiEarlyHooked) return;
      win.__kiEarlyHooked = true;
      if (kalLoadoutRunning(win)) { kiSetTabIntel(targetId, null, false, 'KAL Loadout Revealer is handling the fight.'); return; }
      const of = win.fetch;
      if (typeof of !== 'function' || of.__krakenIntelWrapped) return;
      const wrapped = function (...args) {
        const res = Reflect.apply(of, this, args);
        if (!kiIsAttackDataRequest(args[0])) return res;
        return res.then(async (r) => {
          if (!r || !r.ok) return r;
          let data;
          try { data = await r.clone().json(); } catch (e) { return r; }
          if (!kiObjectRecord(data)) return r;
          try { win.__twsAtkData = data; if (typeof win.__twsFrameData === 'function') win.__twsFrameData(data); } catch (e) { /* ignore */ }
          const live = kiBuildCapture(data, targetId);
          if (live) {
            kiSetTabIntel(targetId, live, true, '');
            kiReceiveAttackData(data, targetId).catch(() => { /* ignore */ });
            return r; // Torn already shows it
          }
          const intel = await intelP;
          if (!intel) return r;
          try { win.__twsAtkIntel = intel; if (typeof win.__twsFrameIntel === 'function') win.__twsFrameIntel(intel); } catch (e) { /* ignore */ }
          const patched = kiPatchAttackData(data, intel);
          if (patched === data) return r;
          kiSetTabIntel(targetId, intel, false, '');
          try {
            return new win.Response(JSON.stringify(patched), { status: r.status, statusText: r.statusText, headers: r.headers });
          } catch (e) { return r; }
        });
      };
      wrapped.__krakenIntelWrapped = true;
      win.fetch = wrapped;
      win.__kiFrameHooked = true;
    }, 15);
  }

  // ---- Enemy fold-out tab ----
  function kiTabTargetId() {
    try {
      if (/[?&]sid=attack/i.test(location.href)) {
        const m = location.href.match(/user2ID=(\d+)/i);
        if (m) return kiPositiveInteger(m[1]);
      }
      if (popout && popout.root.style.display === 'flex' && !popout.root.classList.contains('tws-po-min')) {
        const href = String(popout.frame.contentWindow.location.href);
        if (/[?&]sid=attack/i.test(href)) { const m = href.match(/user2ID=(\d+)/i); if (m) return kiPositiveInteger(m[1]); }
      }
    } catch (e) { /* frame not readable */ }
    return 0;
  }
  function kiEsc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function kiEnemyWeaponBox(slotName, item) {
    if (!item && /^(Helmet|Body|Legs|Feet|Hands)$/.test(slotName)) return `<div class="tws-ew-box tws-ew-empty"><div class="tws-ew-slot">${slotName}</div><div class="tws-ew-none">None seen</div></div>`;
    if (!item) return `<div class="tws-ew-box tws-ew-empty"><div class="tws-ew-slot">${slotName}</div><div class="tws-ew-none">Unknown</div></div>`;
    const dmg = kiFmt2(item.damage);
    const acc = kiFmt2(item.accuracy);
    const rarC = kiRarityOf(item);
    const bon = (Array.isArray(item.bonuses) ? item.bonuses : []).map((b) => `<span class="tws-ew-bonus${rarC ? ` is-${rarC}` : ''}">${kiEsc(b.name)}${b.value == null ? '' : ` ${kiEsc(b.value)}%`}</span>`).join('');
    const rar = kiRarityOf(item) ? ` tws-ew-${kiRarityOf(item)}` : '';
    return `<div class="tws-ew-box${rar}">
      <div class="tws-ew-slot">${slotName}</div>
      ${item.image_url ? `<img class="tws-ew-img" src="${kiEsc(item.image_url)}" alt="">` : ''}
      <div class="tws-ew-name">${kiEsc(item.name)}</div>
      <div class="tws-ew-stats">${kiIsArmourSlot(item) ? (kiFmt2(item.armour) !== null ? `Armour <b>${kiFmt2(item.armour)}</b>` : '') : `${dmg !== null ? `Dmg <b>${dmg}</b>` : ''}${acc !== null ? ` &nbsp;Acc <b>${acc}</b>` : ''}`}</div>
      ${bon ? `<div class="tws-ew-bonuses">${bon}</div>` : ''}
      ${(() => { const nm = String(item.name || '').toLowerCase(); const bl = kiIsArmourSlot(item) && KI_TEMP_BLOCKS.find(([k]) => nm.includes(k)); return bl ? `<div class="tws-ew-blocks">Blocks: ${kiEsc(kiListTemps(bl[1]))}</div>` : ''; })()}
    </div>`;
  }
  function kiEnemyDrawerHtml() {
    const intel = kiTab.intel;
    let head = `<div class="tws-ew-head"><b>Enemy loadout</b><span class="tws-ew-x" data-ew-close="1">\u00d7</span></div>`;
    if (!intel) return `${head}${tsSpyHtml(kiTab.targetId, () => { kiTab.sig = ''; try { kiRenderEnemyTab(); } catch (e) { /* ignore */ } })}<div class="tws-ew-msg">${kiEsc(kiTab.status || 'Looking for intel\u2026')}</div>`;
    const items = Array.isArray(intel.items) ? intel.items : [];
    const bySlot = (n) => items.find((i) => Number(i.equip_slot) === n && i.item_id !== 999) || null;
    const age = kiTab.live ? 'Live \u2013 seen in this fight' : `${kiObservationConfidence(intel.observed_at).label} \u00b7 seen ${kiAgo(intel.observed_at)}`;
    head = `<div class="tws-ew-head"><b>${kiEsc(intel.target_name || 'Enemy')}</b><span class="tws-ew-x" data-ew-close="1">\u00d7</span></div><div class="tws-ew-age">${kiEsc(age)}</div>`;
    const weapons = [[1, 'Primary'], [2, 'Secondary'], [3, 'Melee'], [5, 'Temporary']].map(([n, l]) => kiEnemyWeaponBox(l, bySlot(n))).join('');
    const armour = [[6, 'Helmet'], [4, 'Body'], [7, 'Legs'], [8, 'Feet'], [9, 'Hands']].map(([n, l]) => kiEnemyWeaponBox(l, bySlot(n))).join('');
    // Missing rarity: one Torn API lookup per player, then redraw.
    if (!kiTab.rarityAsked && items.some((i) => !kiRarityOf(i) && kiPositiveInteger(i.armoury_id))) {
      kiTab.rarityAsked = true;
      const tid = kiTab.targetId;
      kiEnrichCaptureWithTornApi(intel).then((en) => { if (en && kiTab.targetId === tid && en !== intel) kiSetTabIntel(tid, en, kiTab.live, ''); }).catch(() => {});
    }
    const job = kiJobHtml(kiTab.targetId, () => { kiTab.sig = ''; try { kiRenderEnemyTab(); } catch (e) { /* ignore */ } });
    const anyArmour = items.some((i) => kiIsArmourSlot(i));
    const spyLine = tsSpyHtml(kiTab.targetId, () => { kiTab.sig = ''; try { kiRenderEnemyTab(); } catch (e) { /* ignore */ } });
    return `${head}${spyLine}${job}<div class="tws-ew-weapons">${weapons}</div>${anyArmour ? `<div class="tws-ew-sub">Armour</div><div class="tws-ew-weapons">${armour}</div>` : ''}`;
  }
  function kiAgo(iso) {
    const s2 = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (!Number.isFinite(s2)) return 'at an unknown time';
    if (s2 < 3600) return `${Math.max(1, Math.round(s2 / 60))}m ago`;
    if (s2 < 86400) return `${Math.round(s2 / 3600)}h ago`;
    return `${Math.round(s2 / 86400)}d ago`;
  }
  const KI_CLEAR_CSS = "html.tws-ki-loadout-revealed [class*='modal'][class*='defender'] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; background: transparent !important; }"
    + " html.tws-ki-loadout-revealed .tws-ki-attack-avatar-host img, html.tws-ki-loadout-revealed .tws-ki-attack-avatar-host [class*='avatar'], html.tws-ki-loadout-revealed .tws-ki-attack-avatar-host [class*='defender'] { filter: none !important; opacity: 1 !important; }";
  function kiClearAvatarIn(doc, on) {
    if (!doc || !doc.documentElement) return;
    if (!doc.getElementById('tws-ki-clear-css')) {
      const st = doc.createElement('style');
      st.id = 'tws-ki-clear-css';
      st.textContent = KI_CLEAR_CSS;
      (doc.head || doc.documentElement).appendChild(st);
    }
    doc.documentElement.classList.toggle('tws-ki-loadout-revealed', !!on);
    if (!on) return;
    const dm = doc.querySelector("[class*='modal'][class*='defender']");
    const area = dm ? (dm.closest("[class*='playerArea']") || dm.parentElement)
      : Array.from(doc.querySelectorAll("[class*='playerArea']")).find((a) => a.querySelector("[class*='defender'], [id*='defender']"));
    if (area && !area.classList.contains('tws-ki-attack-avatar-host')) area.classList.add('tws-ki-attack-avatar-host');
  }
  // Pop-out fights not running their own War Room (Torn PDA): same clear
  // model as the full attack page.
  function kiTickPopoutAvatar() {
    if (!pageFocused()) return;
    if (IN_POPOUT_FRAME || !popout || popout.root.style.display !== 'flex') return;
    let w2;
    try {
      w2 = popout.frame.contentWindow;
      if (!w2 || w2.__twsFrameKI || !/[?&]sid=attack/i.test(String(w2.location.href))) return;
    } catch (e) { return; }
    const m = String(w2.location.href).match(/user2ID=(\d+)/i);
    const tid = m ? kiPositiveInteger(m[1]) : 0;
    const on = featureOn('kiShowIntel') && !!tid && kiTab.targetId === tid && !!kiTab.intel;
    try { kiClearAvatarIn(w2.document, on); } catch (e) { /* ignore */ }
  }

  function kiRenderEnemyTab() {
    if (IN_POPOUT_FRAME || window.top !== window.self || !document.body) return;
    let tab = document.getElementById('tws-ew-tab');
    let drawer = document.getElementById('tws-ew-drawer');
    const tid = (featureOn('kiShowIntel') && !pcMode()) ? kiTabTargetId() : 0;
    if (!tid) {
      if (tab) tab.style.display = 'none';
      if (drawer) drawer.classList.remove('tws-ew-open');
      return;
    }
    if (tid !== kiTab.targetId) {
      kiTab.targetId = tid; kiTab.intel = null; kiTab.live = false; kiTab.status = 'Looking for intel\u2026'; kiTab.sig = ''; kiTab.rarityAsked = false;
    }
    if (!kiTab.intel && !kiTab.loading) {
      if (kiState.latest && kiState.latest.target_id === tid) kiTab.intel = kiState.latest;
      else {
        kiTab.loading = true;
        kiIntelFor(tid).then((intel) => { kiTab.loading = false; kiSetTabIntel(tid, intel, false, intel ? '' : 'No intel saved for this player yet.'); })
          .catch(() => { kiTab.loading = false; kiSetTabIntel(tid, null, false, 'Couldn\u2019t load intel.'); });
      }
    }
    if (!tab) {
      tab = document.createElement('div');
      tab.id = 'tws-ew-tab';
      tab.innerHTML = '<span>ENEMY</span>';
      tab.addEventListener('click', () => { kiTab.open = !kiTab.open; kiTab.sig = ''; kiRenderEnemyTab(); });
      document.body.appendChild(tab);
    }
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'tws-ew-drawer';
      drawer.addEventListener('click', (e) => { if (e.target && e.target.dataset && e.target.dataset.ewClose) { kiTab.open = false; kiTab.sig = ''; kiRenderEnemyTab(); } });
      document.body.appendChild(drawer);
    }
    tab.style.display = 'flex';
    tab.classList.toggle('tws-ew-tab-open', kiTab.open);
    drawer.classList.toggle('tws-ew-open', kiTab.open);
    const sig = `${tid}|${kiTab.live}|${kiTab.status}|${kiTab.intel ? kiTab.intel.observed_at : ''}`;
    if (sig !== kiTab.sig) { kiTab.sig = sig; drawer.innerHTML = kiEnemyDrawerHtml(); }
  }

  function kalLoadoutRunning(win) {
    try {
      const w = win || KI_W;
      return !!(w && (w.__kalLoadoutRevealer || (w.fetch && w.fetch.__kalLoadoutWrapped)));
    } catch (e) {
      return false;
    }
  }
  function kalStandAsideNotice() {
    if (getCfg('tws_kal_notice_shown', false)) return;
    setCfg('tws_kal_notice_shown', true);
    try { showToast('KAL Loadout Revealer is on, so War Room\u2019s loadout intel stays off on attack & profile pages (they clash).'); } catch (e) { /* ignore */ }
  }
  // Inside a pop-out the main page hooks the fight first (so it can add the
  // saved loadout to Torn's display), then hands the data over here. Shown
  // only -- the main page already saves and shares it.
  function kiFrameTakeData(targetId) {
    const showIntel = (intel) => {
      if (!intel || Number(intel.target_id) !== Number(targetId)) return;
      if (kiState.latest && kiState.latest.target_id === intel.target_id && Date.parse(kiState.latest.observed_at) > Date.parse(intel.observed_at)) return;
      kiState.latest = intel;
      kiScheduleAttackEquipmentRender();
      kiRefreshLatestArmourDetails().then((en) => { if (en) kiScheduleAttackEquipmentRender(); }).catch(() => {});
    };
    const takeData = (data) => {
      if (!kiObjectRecord(data)) return;
      const cap = kiBuildCapture(data, targetId);
      if (cap) { showIntel(cap); return; }
      const saved = kiLatestStoredCapture(targetId);
      if (saved) showIntel(saved);
      else if (featureOn('kiShowIntel')) kiFetchSharedCapture(targetId).then(showIntel).catch(() => {});
    };
    try {
      KI_W.__twsFrameData = (d) => { try { takeData(d); } catch (e) { /* ignore */ } };
      KI_W.__twsFrameIntel = (i) => { try { showIntel(i); } catch (e) { /* ignore */ } };
      if (KI_W.__twsAtkData) takeData(KI_W.__twsAtkData);
      if (KI_W.__twsAtkIntel) showIntel(KI_W.__twsAtkIntel);
    } catch (e) { /* ignore */ }
  }

  function initKrakenIntel() {
    const page = kiPageDetails();
    if (page.type === 'unsupported' || !page.targetId) return;
    kiDiag.page = page.type;
    setInterval(kiDiagRender, 3000); // follows the toggles and the panel's position
    // The fetch-wrapper guard above (__krakenIntelWrapped) and this marker
    // check both work reliably cross-script, since unsafeWindow.fetch and
    // window.__krakenIntelInstalled are the SAME real objects every
    // userscript on the page sees -- unlike GM storage, which is isolated
    // per script and is why the data-migration caveat earlier doesn't
    // apply here.
    if (kalLoadoutRunning()) {
      kiLog('KAL - Loadout Revealer is running on this page -- Kraken Intel standing aside.');
      kalStandAsideNotice();
      return;
    }
    if (krakenIntelStandaloneRunning()) {
      kiDiag.state = 'PASSIVE: the separate Kraken Intel script is running on this page';
      kiWarn('Standalone Kraken Intel is already running on this page -- staying passive. Disable one of the two while testing.');
      return;
    }
    // Claim the same flag the standalone script checks, so if IT loads
    // after us, it correctly detects us and backs off too -- previously
    // only worked in one direction.
    KI_W.__krakenIntelInstalled = true;
    const saved = kiLatestStoredCapture(page.targetId);
    if (saved) kiState.latest = saved;
    const kiIdle = perfMode() === 'lite' && !featureOn('kiShowIntel');
    kiDiag.state = kiIdle ? 'capturing only (Lite, Show intel off)' : 'active \u2713';
    kiDiagRender();
    if (page.type === 'attack' && kiIdle) kiInstallFetchObserver(); // still captures, no overlay watchers
    if (page.type === 'attack' && !kiIdle) {
      kiInstallFetchObserver();
      window.addEventListener('resize', kiScheduleAttackEquipmentRender, { passive: true });
      window.addEventListener('scroll', kiScheduleAttackEquipmentRender, { passive: true });
      if (window.visualViewport) window.visualViewport.addEventListener('resize', kiScheduleAttackEquipmentRender, { passive: true });
      kiObserveAttackLayout();
    }
    if (page.type === 'profile' && !kiIdle) kiMountProfilePanel();
    if (IN_POPOUT_FRAME && page.type === 'attack') kiFrameTakeData(page.targetId);
    kiStartSharedSync();
    kiRefreshLatestArmourDetails().then(() => {
      kiScheduleAttackEquipmentRender();
      kiRenderProfilePanel();
    });
    kiLog(`Loaded v${SCRIPT_VERSION}`);
  }

  // ---------------------------------------------------------------------
  // FFSCOUTER BATTLE STAT ESTIMATES (optional -- ffscouter.com)
  // Uses a separate FFScouter API key (16-char, registered on ffscouter.com),
  // not the Torn API key. One call fetches every target at once via a
  // comma-separated list. Skips silently only when no key is set at all (an
  // intentionally-unused optional feature); any actual request failure is
  // surfaced via ffError so it's never a silent no-op. Also skipped entirely
  // when the "Estimated battle stats" feature toggle (Advanced settings) is
  // off.
  //
  // CACHED (v1.36.1): a player's estimate barely changes minute to minute, so
  // each one is kept for 20 minutes (in memory AND saved, so a new page load
  // has them straight away) and only stale / never-seen players are
  // requested. That keeps the numbers permanently on screen and stops the
  // script tripping FFScouter's 20-requests-a-minute limit. If a request
  // fails, the cached numbers stay, and it backs off for a minute before
  // trying again.
  // ---------------------------------------------------------------------
  const FF_STALE_MS = 20 * 60 * 1000;   // re-request a player after this
  const FF_DROP_MS = 12 * 3600 * 1000;  // forget a saved player after this
  const FF_BACKOFF_MS = 60 * 1000;      // pause requests after a failure
  let ffCache = {}; // id (string) -> { e: FFScouter entry, t: fetched-at ms }
  let ffBackoffUntil = 0;
  let ffCacheSavedAt = 0;
  try {
    const raw = JSON.parse(getCfg(STORE_KEYS.ffCache, '{}')) || {};
    const nowMs = Date.now();
    Object.keys(raw).forEach((id) => {
      if (raw[id] && raw[id].e && nowMs - raw[id].t < FF_DROP_MS) ffCache[id] = raw[id];
    });
  } catch (e) {
    ffCache = {};
  }

  function saveFfCache() {
    const nowMs = Date.now();
    if (nowMs - ffCacheSavedAt < 5000) return;
    ffCacheSavedAt = nowMs;
    try {
      setCfg(STORE_KEYS.ffCache, JSON.stringify(ffCache));
    } catch (e) { /* storage full or unavailable -- the in-memory cache still works */ }
  }

  // Which estimator the roster uses: 'ff' (FFScouter, default), 'bsp', or 'both'.
  function statsSource() {
    const v = getCfg(STORE_KEYS.statsSource, 'ff');
    return (v === 'bsp' || v === 'both') ? v : 'ff';
  }
  function statsSourceName() {
    const v = statsSource();
    return v === 'bsp' ? 'BSP' : v === 'both' ? 'Stats' : 'FFScouter';
  }
  // Both: each player gets FFScouter's and BSP's number side by side. Sorting
  // and bounty tiers use FFScouter's, or BSP's when FFScouter has none.
  async function fetchBothStats(targetIds) {
    const [ffR, bspR] = await Promise.all([fetchFFScouterStats(targetIds), fetchBspStats(targetIds)]);
    const map = {};
    targetIds.forEach((id) => {
      const f = ffR.map[id];
      const b = bspR.map[id];
      if (!f && !b) return;
      const base = f || b;
      map[id] = Object.assign({}, base, {
        both: true,
        ffHuman: f ? (f.bs_estimate_human || '') : '',
        bspHuman: b ? (b.bs_estimate_human || '') : '',
      });
    });
    const errs = [];
    if (ffR.error) errs.push(`FFScouter: ${ffR.error}`);
    if (bspR.error) errs.push(`BSP: ${bspR.error}`);
    if (!ffR.error && ffR.skipped && featureOn('ffStats')) errs.push('FFScouter: add your FFScouter key in Settings to see both.');
    return { map, error: errs.length ? errs.join(' \u00b7 ') : null };
  }
  function fetchFFStatsEst(targetIds) {
    const v = statsSource();
    if (v === 'both') return fetchBothStats(targetIds);
    return v === 'bsp' ? fetchBspStats(targetIds) : fetchFFScouterStats(targetIds);
  }
  // Estimates, with TornStats spies on top where your faction has one.
  async function fetchFFStats(targetIds) {
    const r = await fetchFFStatsEst(targetIds);
    try { tsApplySpies(r.map, targetIds); } catch (e) { /* ignore */ }
    return r;
  }

  // ---------------------------------------------------------------------
  // TORNSTATS SPIES (optional)
  // Real battle stats from the spies your faction shares on TornStats. One
  // call loads every spy on a faction (kept 2 hours); a single player is
  // asked for only when needed (kept 6 hours). Spies are kept on this device
  // only and never sent to the Kraken server.
  // ---------------------------------------------------------------------
  const TS_FAC_MS = 2 * 3600 * 1000;
  const TS_USER_MS = 6 * 3600 * 1000;
  const TS_FAIL_MS = 10 * 60 * 1000;
  const TS_FRESH_DAYS = 60;            // newer than this replaces the estimate
  const TS_DROP_MS = 7 * 86400 * 1000; // forget cached lookups after a week
  let tsCache = { f: {}, u: {} };
  let tsSavedAt = 0;
  const tsBusy = {};
  let tsLastError = '';
  try {
    const raw = JSON.parse(getCfg(STORE_KEYS.tsCache, '{}')) || {};
    const nowMs = Date.now();
    tsCache.f = raw.f || {};
    tsCache.u = {};
    Object.keys(raw.u || {}).forEach((id) => { if (raw.u[id] && nowMs - raw.u[id].t < TS_DROP_MS) tsCache.u[id] = raw.u[id]; });
  } catch (e) { tsCache = { f: {}, u: {} }; }
  function tsSave(force) {
    const nowMs = Date.now();
    if (!force && nowMs - tsSavedAt < 5000) return;
    tsSavedAt = nowMs;
    try { setCfg(STORE_KEYS.tsCache, JSON.stringify(tsCache)); } catch (e) { /* in-memory still works */ }
  }
  function tsKey() { return String(getCfg(STORE_KEYS.tsKey) || '').trim(); }
  function tsOn() { return featureOn('tsSpies') && !!tsKey(); }
  function tsResetFails() { tsCache.f = {}; Object.keys(tsCache.u).forEach((id) => { if (!tsCache.u[id].s) delete tsCache.u[id]; }); tsLastError = ''; tsSave(true); }
  function tsParseSpy(o) {
    if (!o || typeof o !== 'object' || o.status === false) return null;
    const n = (k) => Number(String(o[k] == null ? '' : o[k]).replace(/[^0-9.]/g, '')) || 0;
    const str = n('strength'); const def = n('defense'); const spd = n('speed'); const dex = n('dexterity');
    const total = n('total') || (str + def + spd + dex);
    if (total <= 0) return null;
    let ts = Number(o.timestamp || o.update || o.updated || 0) || 0;
    if (ts > 1e12) ts = Math.round(ts / 1000);
    return { str, def, spd, dex, total, ts };
  }
  function tsMsg(d) { return String((d && (d.message || (d.error && (d.error.error || d.error)))) || 'TornStats request failed').slice(0, 120); }
  async function tsLoadFaction(fid) {
    fid = String(fid || '');
    if (!tsOn() || !fid || tsBusy['f' + fid]) return;
    const c = tsCache.f[fid];
    if (c && Date.now() - c.t < (c.err ? TS_FAIL_MS : TS_FAC_MS)) return;
    if (document.visibilityState !== 'visible') return;
    tsBusy['f' + fid] = true;
    try {
      const d = await httpGetJson(`https://www.tornstats.com/api/v2/${encodeURIComponent(tsKey())}/spy/faction/${encodeURIComponent(fid)}`);
      if (!d || d.status === false || !d.faction) throw new Error(tsMsg(d));
      const nowMs = Date.now();
      let n = 0;
      Object.entries(d.faction.members || {}).forEach(([id, m]) => {
        const sp = m ? (tsParseSpy(m.spy) || tsParseSpy(m.stats) || tsParseSpy(m.battlestats) || tsParseSpy(m.spy_data) || tsParseSpy(m)) : null;
        if (sp) n++;
        tsCache.u[String((m && m.id) || id)] = { t: nowMs, s: sp };
      });
      tsCache.f[fid] = { t: nowMs, n };
      tsLastError = '';
    } catch (e) {
      tsCache.f[fid] = { t: Date.now(), err: (e && e.message) || 'failed' };
      tsLastError = (e && e.message) || 'TornStats request failed';
    } finally {
      tsBusy['f' + fid] = false;
      tsSave(true);
    }
  }
  async function tsLoadUser(id) {
    id = String(id || '');
    if (!tsOn() || !id || tsBusy['u' + id]) return null;
    const c = tsCache.u[id];
    if (c && Date.now() - c.t < (c.s ? TS_USER_MS : TS_FAIL_MS * 3)) return c.s || null;
    tsBusy['u' + id] = true;
    try {
      const d = await httpGetJson(`https://www.tornstats.com/api/v2/${encodeURIComponent(tsKey())}/spy/user/${encodeURIComponent(id)}`);
      if (!d || d.status === false) throw new Error(tsMsg(d));
      const raw = (d.compare && d.compare.spy) || d.spy || null;
      const sp = tsParseSpy(raw);
      if (sp && !sp.ts && d.compare && d.compare.timestamp) { const t2 = Date.parse(d.compare.timestamp) || Number(d.compare.timestamp) * 1000; if (t2) sp.ts = Math.round(t2 / 1000); }
      tsCache.u[id] = { t: Date.now(), s: sp };
      tsLastError = '';
      return sp;
    } catch (e) {
      tsCache.u[id] = { t: Date.now(), s: null };
      tsLastError = (e && e.message) || 'TornStats request failed';
      return null;
    } finally {
      tsBusy['u' + id] = false;
      tsSave();
    }
  }
  function tsSpyFor(id) { const c = tsCache.u[String(id)]; return (c && c.s) || null; }
  function tsAgeDays(sp) { return sp && sp.ts ? Math.max(0, Math.floor((Date.now() / 1000 - sp.ts) / 86400)) : null; }
  function tsAgeText(sp) { const d = tsAgeDays(sp); return d === null ? 'age unknown' : d === 0 ? 'today' : `${d}d ago`; }
  function tsFresh(sp) { const d = tsAgeDays(sp); return !!sp && (d === null || d <= TS_FRESH_DAYS); }
  function tsSplitText(sp) { return `Str ${fmtBsHuman(sp.str)} · Def ${fmtBsHuman(sp.def)} · Spd ${fmtBsHuman(sp.spd)} · Dex ${fmtBsHuman(sp.dex)}`; }
  function tsApplySpies(map, ids) {
    if (!tsOn() || !map) return;
    (ids || []).forEach((id) => {
      const sp = tsSpyFor(id);
      if (!tsFresh(sp)) return;
      const base = map[id] || { player_id: Number(id) };
      const e = Object.assign({}, base, { spy: sp, bs_estimate: sp.total, bs_estimate_human: fmtBsHuman(sp.total), source: 'ts-spy', both: false });
      if (typeof base.fair_fight === 'number') e.ffFallback = base.fair_fight;
      delete e.fair_fight; // worked out from the spy and your own stats
      map[id] = e;
    });
  }
  // One line for the Intel panel / ENEMY tab.
  function tsSpyHtml(id, rerender) {
    if (!tsOn() || !id) return '';
    const sp = tsSpyFor(id);
    const c = tsCache.u[String(id)];
    if (!c && rerender) tsLoadUser(id).then((x) => { if (x) { try { rerender(); } catch (e) { /* ignore */ } } }).catch(() => {});
    if (!sp) return '';
    const old = !tsFresh(sp);
    return `<div class="tws-ts-spy${old ? ' tws-ts-old' : ''}">🕵 Spy <b>${fmtBsHuman(sp.total)}</b> · ${tsSplitText(sp)} <span class="tws-ts-age">(${tsAgeText(sp)}${old ? ', old' : ''})</span></div>`;
  }
  // Text of a player's estimate(s) for the roster ("F 107k · B 112k" in Both mode).
  function estText(e) {
    if (!e) return '';
    if (e.spy) return `${e.bs_estimate_human} (spied ${tsAgeText(e.spy)})`;
    if (e.both) return `F ${e.ffHuman || '\u2013'} \u00b7 B ${e.bspHuman || '\u2013'}`;
    return e.bs_estimate_human || '?';
  }
  // ---- Colour themes ----
  const COLOUR_THEMES = [
    { id: 'kraken', name: 'Kraken', desc: 'The original look: online green, idle orange, offline red. Estimated stats are coloured by Fair Fight (blue easy, green good, red hard).' },
    { id: 'torn', name: 'Torn', desc: 'Matches Torn\u2019s colours: online green, idle orange, offline grey. Estimated stats are coloured by Fair Fight (blue easy, green good, red hard).' },
    { id: 'ff', name: 'FairFight', desc: 'Names and stats coloured by Fair Fight, on FFScouter\u2019s scale: blue = easy (FF 1), green = good (FF 3), red = hard (FF 5+). A dot shows online / idle / offline, and the FF number follows the stats.' },
  ];
  // FFScouter's "classic" palette (11 steps, FF 1 -> 5).
  const FF_PALETTE = ['#1734e8', '#1788e8', '#17dbe8', '#17e8a1', '#17e84e', '#34e817', '#88e817', '#dbe817', '#e8a117', '#e84e17', '#e81734'];
  function colourTheme() {
    const id = getCfg(STORE_KEYS.colourTheme, 'kraken');
    return COLOUR_THEMES.some((t) => t.id === id) ? id : 'kraken';
  }
  function ffColour(ff) {
    if (typeof ff !== 'number' || !isFinite(ff)) return null;
    const v = Math.min(5, Math.max(1, ff));
    return FF_PALETTE[Math.floor(((v - 1) / 4) * 10)] || null;
  }
  // Your own total battle stats, only needed to work out FF from a BSP
  // estimate when FFScouter has no Fair Fight value. Asked at most every 6h.
  let ownBs = null;
  let ownBsAskedAt = 0;
  try { const c = JSON.parse(getCfg(STORE_KEYS.ownBattleStats, 'null')); if (c && c.total > 0) { ownBs = c.total; ownBsAskedAt = c.t || 0; } } catch (e) { /* ignore */ }
  function wantOwnBattleStats() {
    if (Date.now() - ownBsAskedAt < 6 * 3600 * 1000) return;
    ownBsAskedAt = Date.now();
    apiFetch('user', 'battlestats').then((d) => {
      const total = ['strength', 'defense', 'speed', 'dexterity'].reduce((a, k) => a + (Number(d && d[k]) || 0), 0);
      if (total > 0) { ownBs = total; setCfg(STORE_KEYS.ownBattleStats, JSON.stringify({ total, t: Date.now() })); render(); }
    }).catch(() => { /* key can't see battle stats -- FF stays FFScouter-only */ });
  }
  function fairFightOf(e) {
    if (!e) return null;
    // A TornStats spy: FF from the real stats and yours (FFScouter's FF until yours are known).
    if (e.spy && e.spy.total > 0) {
      if (ownBs) return 1 + (8 / 3) * (e.spy.total / ownBs);
      wantOwnBattleStats();
      return typeof e.ffFallback === 'number' && e.ffFallback > 0 ? e.ffFallback : null;
    }
    if (typeof e.fair_fight === 'number' && e.fair_fight > 0) return e.fair_fight;
    if (typeof e.bs_estimate === 'number' && e.bs_estimate > 0) {
      if (!ownBs) { wantOwnBattleStats(); return null; }
      return 1 + (8 / 3) * (e.bs_estimate / ownBs);
    }
    return null;
  }
  // First run: welcome box (once, only while no API key is saved yet).
  function maybeShowWelcome() {
    if (IN_POPOUT_FRAME || window.top !== window.self) return;
    if (getCfg(STORE_KEYS.welcomeSeen, false) || getApiKey()) return;
    if (document.getElementById('tws-welcome')) return;
    const box = document.createElement('div');
    box.id = 'tws-welcome';
    box.innerHTML = `
      <div class="tws-wel-card">
        <div class="tws-wel-title">\ud83d\udc19 Welcome to Kraken\u2019s War Room</div>
        <p>To get started, open <b>\u2699 Settings</b> and add your Torn API key:</p>
        <ul>
          <li><b>Custom key</b> with this access:
            <div class="tws-wel-access">User: basic, profile, bars, cooldowns, battlestats, personalstats<br>Faction: basic, attacks, rankedwars<br>Torn: items<br>Company: profile</div>
          </li>
          <li>or a <b>Limited Access</b> key, which covers all of the above.</li>
        </ul>
        <p>For estimated battle stats, add your <b>FFScouter</b> and/or <b>BSP</b> key in Settings too.</p>
        <p>The panel\u2019s size can be changed to suit your screen in <b>\u2699 Settings \u2192 Panel</b>.</p>
        <div class="tws-wel-btns"><button id="tws-wel-settings">Open Settings</button><button id="tws-wel-ok">Got it</button></div>
      </div>`;
    document.body.appendChild(box);
    const close = () => { setCfg(STORE_KEYS.welcomeSeen, true); box.remove(); };
    box.querySelector('#tws-wel-ok').addEventListener('click', close);
    box.querySelector('#tws-wel-settings').addEventListener('click', () => {
      close();
      try {
        if (getCfg(STORE_KEYS.collapsed, false)) setCfg(STORE_KEYS.collapsed, false);
        showSettings = true;
        settingsTab = 'general';
        render();
      } catch (e) { /* ignore */ }
    });
  }

  function applyColourTheme() {
    if (!panel) return;
    const t = colourTheme();
    COLOUR_THEMES.forEach((x) => panel.classList.toggle(`tws-theme-${x.id}`, x.id === t));
  }

  function estHtml(e) {
    if (!e) return '';
    if (e.spy) return `<span class="tws-est-spy" title="TornStats spy, ${tsAgeText(e.spy)}: ${tsSplitText(e.spy)}">\ud83d\udd75${e.bs_estimate_human}</span>`;
    if (e.both) {
      const tag = (t) => `<span style="color:#8a8a8a;font-size:0.85em;">${t}</span>`;
      return `${tag('F')} ${e.ffHuman || '\u2013'} ${tag('B')} <span class="tws-est-bsp">${e.bspHuman || '\u2013'}</span>`;
    }
    return e.bs_estimate_human || '?';
  }

  // ---------------------------------------------------------------------
  // BSP (Battle Stats Predictor by TDup) -- optional second estimator.
  // Needs the player's own BSP subscription. Works two ways, cheapest first:
  //  1) BSP's own saved predictions/spies: if BSP is installed in the same
  //     browser / PDA it keeps them in torn.com local storage, so they're
  //     read for free (no requests at all).
  //  2) Anyone still missing is asked from the BSP server with the key
  //     registered on BSP (the same call BSP makes), a few at a time, only
  //     while the page is visible, and cached for a day.
  // Results are shaped like FFScouter's (bs_estimate / bs_estimate_human) so
  // the roster, stat sorting and bounty tiers work unchanged.
  // ---------------------------------------------------------------------
  const BSP_SERVER = 'https://www.lol-manager.com/api';
  const BSP_LS = 'tdup.battleStatsPredictor.';
  const BSP_STALE_MS = 24 * 3600 * 1000;     // re-ask the server after a day
  const BSP_DROP_MS = 5 * 24 * 3600 * 1000;  // forget after 5 days (BSP's own validity)
  const BSP_FAIL_RETRY_MS = 60 * 60 * 1000;  // "no prediction" answers: retry in an hour
  const BSP_BACKOFF_MS = 2 * 60 * 1000;      // pause after a request error
  const BSP_PER_CYCLE = 8;                   // at most this many server asks per refresh
  const BSP_OK = { 1: 1, 2: 1, 3: 1, 5: 1, 6: 1 }; // SUCCESS, TOO_WEAK, TOO_STRONG, HOF, FFATTACKS
  let bspCache = {}; // id -> { e: entry|null, t: ms }
  let bspBackoffUntil = 0;
  let bspSavedAt = 0;
  try {
    const raw = JSON.parse(getCfg(STORE_KEYS.bspCache, '{}')) || {};
    const nowMs = Date.now();
    Object.keys(raw).forEach((id) => {
      if (raw[id] && nowMs - raw[id].t < BSP_DROP_MS) bspCache[id] = raw[id];
    });
  } catch (e) {
    bspCache = {};
  }
  function saveBspCache() {
    const nowMs = Date.now();
    if (nowMs - bspSavedAt < 5000) return;
    bspSavedAt = nowMs;
    try { setCfg(STORE_KEYS.bspCache, JSON.stringify(bspCache)); } catch (e) { /* in-memory still works */ }
  }
  function pageLS() {
    try { return KI_W.localStorage || window.localStorage; } catch (e) { return null; }
  }
  function bspLsGet(k) {
    try { const ls = pageLS(); return ls ? ls.getItem(BSP_LS + k) : null; } catch (e) { return null; }
  }
  // The key BSP itself has saved on this device (if BSP is installed here).
  function bspInstalledKey() {
    const k = (bspLsGet('PrimaryAPIKey') || '').trim();
    return /^[A-Za-z0-9]{16}$/.test(k) ? k : '';
  }
  function bspKey() {
    const own = (getCfg(STORE_KEYS.bspKey) || '').trim();
    return own || bspInstalledKey();
  }
  function fmtBsHuman(n) {
    n = Number(n) || 0;
    const u = [[1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']];
    for (const [v, l] of u) {
      if (n >= v) {
        const x = n / v;
        return `${x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : x.toFixed(2).replace(/\.?0+$/, '')}${l}`;
      }
    }
    return String(Math.round(n));
  }
  function bspEntry(id, tbs, spy) {
    tbs = Number(tbs) || 0;
    if (tbs <= 0) return null;
    return { player_id: Number(id), bs_estimate: tbs, bs_estimate_human: fmtBsHuman(tbs), source: spy ? 'bsp-spy' : 'bsp' };
  }
  // Shape a BSP prediction (+ any saved spy, which wins when it's higher, as in BSP).
  function bspFromPrediction(id, pred) {
    let tbs = 0;
    if (pred && BSP_OK[Number(pred.Result)]) {
      tbs = parseInt(String(pred.TBS !== undefined ? pred.TBS : '').replace(/[^0-9]/g, ''), 10) || 0;
    }
    let spyTotal = 0;
    ['cache.spy_v2.tornstats_', 'cache.spy_v2.yata_'].forEach((pre) => {
      try {
        const sp = JSON.parse(bspLsGet(pre + id) || 'null');
        if (sp && Number(sp.total) > spyTotal) spyTotal = Number(sp.total);
      } catch (e) { /* ignore */ }
    });
    if (spyTotal > tbs) return bspEntry(id, spyTotal, true);
    return bspEntry(id, tbs, false);
  }
  // 1) What BSP already has saved on this device.
  function bspFromLocal(id) {
    let pred = null;
    try { pred = JSON.parse(bspLsGet('cache.prediction.' + id) || 'null'); } catch (e) { pred = null; }
    const e = bspFromPrediction(id, pred);
    if (e) return e;
    return null;
  }
  function bspAsk(id, key) {
    const url = `${BSP_SERVER}/battlestats/${encodeURIComponent(key)}/${encodeURIComponent(id)}/${encodeURIComponent(SCRIPT_VERSION)}`;
    return httpGetJson(url);
  }
  async function fetchBspStats(targetIds) {
    if (!featureOn('ffStats')) return { map: {}, error: null, skipped: true };
    const key = bspKey();
    const nowMs = Date.now();
    const map = {};
    const need = [];
    targetIds.forEach((id) => {
      const sid = String(id);
      const local = bspFromLocal(sid);
      if (local) {
        map[id] = local;
        bspCache[sid] = { e: local, t: nowMs };
        return;
      }
      const c = bspCache[sid];
      if (c && c.e) map[id] = c.e;
      const age = c ? nowMs - c.t : Infinity;
      if (!c || (c.e ? age > BSP_STALE_MS : age > BSP_FAIL_RETRY_MS)) need.push(sid);
    });
    if (!key) {
      saveBspCache();
      if (Object.keys(map).length) return { map, error: null };
      return { map, error: 'No BSP key. Add the Torn API key you registered with BSP in Settings (or install BSP on this device).' };
    }
    const visible = document.visibilityState === 'visible';
    if (!need.length || nowMs < bspBackoffUntil || !visible) {
      saveBspCache();
      return { map, error: null };
    }
    let error = null;
    let fails = 0;
    let asked = 0;
    for (const sid of need.slice(0, BSP_PER_CYCLE)) {
      try {
        const pred = await bspAsk(sid, key);
        asked++;
        if (!pred || typeof pred !== 'object') throw new Error('Unexpected BSP response');
        if (pred.Message && pred.Result === undefined) throw new Error(String(pred.Message));
        // Key / subscription problems come back as Result 0 with a Reason (which echoes the key -- never show it).
        if (Number(pred.Result) === 0 && /api key|subscri|account/i.test(String(pred.Reason || ''))) {
          throw new Error(String(pred.Reason).split(key).join('\u2022\u2022\u2022\u2022').replace(/\s*Api key\s*=\s*\S*/i, '').slice(0, 160));
        }
        const e = bspFromPrediction(sid, pred);
        bspCache[sid] = { e, t: Date.now() };
        if (e) map[sid] = e;
        else fails++;
      } catch (err) {
        error = (err && err.message) ? err.message : 'BSP request failed';
        bspBackoffUntil = Date.now() + BSP_BACKOFF_MS;
        break;
      }
    }
    if (!error && asked >= 3 && fails === asked && !Object.keys(map).length) {
      error = 'BSP returned no predictions. Check your BSP subscription is active and the key is the one registered with BSP.';
    }
    saveBspCache();
    return { map, error };
  }

  function fetchFFScouterStats(targetIds) {
    if (!featureOn('ffStats')) return Promise.resolve({ map: {}, error: null, skipped: true });
    const key = getCfg(STORE_KEYS.ffscouterKey);
    if (!key) return Promise.resolve({ map: {}, error: null, skipped: true });
    if (!targetIds.length) return Promise.resolve({ map: {}, error: null });

    const nowMs = Date.now();
    const cachedMap = () => {
      const map = {};
      targetIds.forEach((id) => {
        const c = ffCache[String(id)];
        if (c) map[id] = c.e;
      });
      return map;
    };
    // Only players we've never seen, or whose estimate is stale, are requested.
    const need = targetIds.filter((id) => {
      const c = ffCache[String(id)];
      return !c || nowMs - c.t > FF_STALE_MS;
    });
    if (!need.length || nowMs < ffBackoffUntil) {
      return Promise.resolve({ map: cachedMap(), error: null });
    }

    const url = `https://ffscouter.com/api/v1/get-stats?key=${encodeURIComponent(key)}&targets=${need.join(',')}`;
    return httpGetJson(url)
      .then((data) => {
        if (!Array.isArray(data)) {
          const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : 'Unexpected FFScouter response';
          ffBackoffUntil = Date.now() + FF_BACKOFF_MS;
          return { map: cachedMap(), error: msg };
        }
        const stamp = Date.now();
        data.forEach((entry) => {
          if (entry && entry.player_id !== undefined && entry.player_id !== null) {
            ffCache[String(entry.player_id)] = { e: entry, t: stamp };
          }
        });
        saveFfCache();
        return { map: cachedMap(), error: null };
      })
      .catch((e) => {
        ffBackoffUntil = Date.now() + FF_BACKOFF_MS;
        return { map: cachedMap(), error: e.message };
      });
  }

  // ---------------------------------------------------------------------
  // PAGE CLASSIFICATION
  // Determines which of three contexts we're in, which drives both enemy-ID
  // detection AND what the panel displays:
  //   'home'       -- no war roster visible on this page -> the war
  //                   detection in refreshRosters() (from the API) may still
  //                   upgrade this to 'war', so it works on any Torn page
  //   'war'        -- war roster embedded on the page -> show BOTH sides
  //   'enemy-page' -- viewing the enemy's own faction page directly (their
  //                   URL has step=profile&ID=<their id>) -> show ENEMY only
  //
  // War detection scans a FACTION page for links to a different faction's
  // profile, requiring a meaningful VOLUME of them (WAR_LINK_THRESHOLD)
  // before treating it as a live war roster. A genuine war roster links to
  // the enemy once per member row (dozens of times); a one-off
  // territory-assault announcement banner links to the opposing faction only
  // once or twice. On non-faction pages this scan is skipped.
  // ---------------------------------------------------------------------
  const WAR_LINK_THRESHOLD = 5;

  function onFactionPage() {
    return /^\/factions\.php/.test(location.pathname);
  }

  // Reads the faction page only while you're looking at it; otherwise the
  // last result for this page is kept (or the API decides, as on any page).
  let lastClassified = null;
  try {
    window.addEventListener('focus', () => {
      setTimeout(() => {
        try { kiScheduleAttackEquipmentRender(); } catch (e) { /* ignore */ }
        try { runBloodHighlight(); } catch (e) { /* ignore */ }
        try { ensureSosButton(); } catch (e) { /* ignore */ }
        try { safeRender(); } catch (e) { /* ignore */ }
      }, 60);
    });
  } catch (e) { /* ignore */ }
  function classifyPage() {
    if (!pageFocused()) {
      return (lastClassified && lastClassified.href === location.href) ? lastClassified.res : { mode: 'home', enemyId: null };
    }
    const res = classifyPageNow();
    lastClassified = { href: location.href, res };
    return res;
  }
  function classifyPageNow() {
    const ownId = getOwnFactionId();

    // Directly viewing a specific faction's profile page is the strongest
    // signal of all -- the ID is right there in the URL.
    if (/factions\.php\?step=profile\b/.test(location.href)) {
      const m = location.href.match(/[?&]ID=(\d+)/);
      if (m) {
        if (ownId && m[1] === ownId) {
          return { mode: 'home', enemyId: null };
        }
        return { mode: 'enemy-page', enemyId: m[1] };
      }
    }

    // Other Torn pages have no war roster to scan.
    if (!onFactionPage()) {
      return { mode: 'home', enemyId: null };
    }

    // Otherwise: scan the current page's own content for a war roster,
    // requiring enough repeated links to the same other faction to be
    // confident it's an actual member list, not a one-off banner mention.
    const links = Array.from(document.querySelectorAll('a[href*="factions.php?step=profile"]'));
    const idCounts = {};
    links.forEach((a) => {
      const m = a.href.match(/[?&]ID=(\d+)/);
      if (m) {
        const id = m[1];
        if (id !== ownId) idCounts[id] = (idCounts[id] || 0) + 1;
      }
    });
    const ids = Object.keys(idCounts).filter((id) => idCounts[id] >= WAR_LINK_THRESHOLD);
    if (ids.length === 0) {
      return { mode: 'home', enemyId: null };
    }
    ids.sort((a, b) => idCounts[b] - idCounts[a]);
    return { mode: 'war', enemyId: ids[0] };
  }

  // If the cached own-faction ID turns out to be wrong ("Incorrect ID"),
  // drop it and let auto-detection find the right one on the next cycle.
  function clearBadOwnIdIfNeeded(errorMessage, idUsed) {
    const cached = getCfg(STORE_KEYS.ownFactionId);
    if (cached && cached === idUsed && /error 6/i.test(errorMessage)) {
      setCfg(STORE_KEYS.ownFactionId, '');
      autoOwnFactionId = null;
    }
  }

  // ---------------------------------------------------------------------
  // TIME HELPERS
  // ---------------------------------------------------------------------
  function fmtDuration(seconds) {
    if (seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // For a war-start countdown that could be days out -- coarser than
  // fmtDuration, since second-level precision isn't useful days in advance.
  function fmtCountdown(seconds) {
    if (seconds <= 0) return 'starting now';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // Chat-friendly ETA for calling a target: the exact time left on their
  // hospital timer, e.g. 7:48 (or 1:02:03 past an hour).
  function chunkedAttackEta(seconds) {
    const t = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  }

  function attackUrl(userId) {
    // Torn deprecated loader.php for this action ("This endpoint is no
    // longer available. Please use the new endpoints instead (page.php).")
    // -- page.php takes the identical query params.
    return `https://www.torn.com/page.php?sid=attack&user2ID=${userId}`;
  }

  // Torn's "place a bounty" page for a given player.
  function bountyUrl(userId) {
    return `https://www.torn.com/bounties.php?p=add&XID=${userId}`;
  }

  // ---------------------------------------------------------------------
  // BOUNTY AMOUNTS (by estimated stats) + REASON
  // Editable in ⚙ Settings -> Advanced -> 💰 Bounty amounts. Stored as
  //   { t: [[maxStats, bounty], ...sorted], o: bountyForAnythingAbove,
  //     u: bountyIfNoEstimate, r: reasonText }
  // A player's FFScouter estimate is compared against each tier's upper limit
  // in order; the first tier it fits under wins, otherwise the "over" amount
  // applies. `u` is used when there's no stats estimate at all (0 = leave the
  // amount empty). `r` is typed into the bounty form's reason box ("" = leave
  // it empty).
  // ---------------------------------------------------------------------
  const DEFAULT_BOUNTY = {
    t: [
      [500e3, 100e3],
      [2e6, 150e3],
      [10e6, 200e3],
      [50e6, 250e3],
      [100e6, 300e3],
      [500e6, 400e3],
      [1e9, 450e3],
    ],
    o: 500e3,
    u: 0,
    r: 'War',
  };

  function cloneBounty(b) {
    return { t: b.t.map((r) => r.slice()), o: b.o, u: b.u, r: b.r };
  }

  function getBountyConfig() {
    try {
      const raw = JSON.parse(getCfg(STORE_KEYS.bountyTiers, 'null'));
      if (
        raw && Array.isArray(raw.t) && isFinite(raw.o) &&
        raw.t.every((r) => Array.isArray(r) && r.length === 2 && isFinite(r[0]) && isFinite(r[1]))
      ) {
        return {
          t: raw.t.map((r) => [Number(r[0]), Number(r[1])]).sort((a, b) => a[0] - b[0]),
          o: Number(raw.o),
          u: Number(raw.u) || 0,
          // Older saved settings have no reason yet -> the default ("War").
          r: typeof raw.r === 'string' ? raw.r : DEFAULT_BOUNTY.r,
        };
      }
    } catch (e) { /* fall through to the defaults */ }
    return cloneBounty(DEFAULT_BOUNTY);
  }

  function saveBountyConfig(cfg) {
    cfg.t.sort((a, b) => a[0] - b[0]);
    setCfg(STORE_KEYS.bountyTiers, JSON.stringify(cfg));
  }

  // "500k", "2m", "1.5b", "250,000", "$100000" -> a number (null if invalid).
  function parseAmount(str) {
    const m = String(str || '').trim().replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)([kmb]?)$/i);
    if (!m) return null;
    const mult = { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()];
    return Math.round(parseFloat(m[1]) * mult);
  }

  // 500000 -> "500k", 2000000 -> "2m", 1500000 -> "1.5m", 123456 -> "123456".
  function fmtAmount(n) {
    const units = [[1e9, 'b'], [1e6, 'm'], [1e3, 'k']];
    for (const [div, suffix] of units) {
      if (n >= div) {
        const v = +(n / div).toFixed(2);
        if (Math.abs(v * div - n) < 1) return `${v}${suffix}`;
      }
    }
    return String(n);
  }

  // The bounty for a member, from their estimated stats (0 = none to suggest).
  function bountyAmountFor(m) {
    if (!featureOn('bountyAutofill')) return 0;
    const cfg = getBountyConfig();
    const stats = (m && m.ff && typeof m.ff.bs_estimate === 'number') ? m.ff.bs_estimate : null;
    if (stats === null) return cfg.u || 0;
    for (const [max, amount] of cfg.t) {
      if (stats <= max) return amount;
    }
    return cfg.o;
  }

  // The reason text to type into the bounty form ("" = none).
  function bountyReasonText() {
    if (!featureOn('bountyReason')) return '';
    return (getBountyConfig().r || '').trim();
  }

  // A web link typed into Settings, tidied up: "" if empty or not http(s).
  function cleanWebUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try {
      const parsed = new URL(u);
      return (parsed.protocol === 'https:' || parsed.protocol === 'http:') ? parsed.href : '';
    } catch (e) {
      return '';
    }
  }

  // The revive service link chosen in Settings -> General ("" if none).
  function reviveUrl() {
    return cleanWebUrl(getCfg(STORE_KEYS.reviveUrl, ''));
  }

  // Revives switch (Settings -> General): 'off' | 'friends' | 'on'.
  function getRevives() {
    const v = getCfg(STORE_KEYS.revives, 'off');
    return (v === 'off' || v === 'friends') ? v : 'on';
  }

  // Steps like a 3-position switch: from either end, one tap reaches Friends;
  // a second tap carries on to the opposite end (On -> Friends -> Off, and
  // Off -> Friends -> On).
  function stepRevives() {
    const cur = getRevives();
    let next;
    if (cur === 'friends') {
      next = getCfg(STORE_KEYS.revivesFrom, 'on') === 'on' ? 'off' : 'on';
    } else {
      setCfg(STORE_KEYS.revivesFrom, cur);
      next = 'friends';
    }
    setCfg(STORE_KEYS.revives, next);
    return next;
  }

  // HTML-escapes text going into innerHTML attributes / content.
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------------------------------------------------------------
  // NOMAD'S QUICK REVIVE -- self revive request (header Rev button)
  // Integrated with permission from LilyWaterbug [2608747], author of the
  // original "Nomad's Quick Revive" userscript. Mirrors that script's own
  // requestOwnRevive() flow: looks up your current hospital status via
  // Nomad's own lookup service (no Torn key needed for that step -- it's
  // their server doing the check), then posts the revive request to their
  // webhook exactly as their script does.
  // ---------------------------------------------------------------------
  const NOMAD_API_URL = 'https://lilywaterbug.alwaysdata.net/torn-api';
  const NOMAD_WEBHOOK_URL = 'http://lilywaterbug.art:25184/webhook';
  const NOMAD_MIN_HOSPITAL_MINUTES = 2;
  const NOMAD_TIMEOUT_MS = 20000;
  let revBusy = false;

  // POST-JSON counterpart to httpGetJson -- Tampermonkey via GM_xmlhttpRequest,
  // PDA via PDA_httpPost (if the PDA build exposes it; if not, this fails
  // clearly rather than silently doing nothing).
  function httpPostJson(url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const payload = JSON.stringify(body);
    if (IS_PDA) {
      if (typeof PDA_httpPost !== 'function') {
        return Promise.reject(new Error("This needs Torn PDA's POST support, which isn't available here."));
      }
      return Promise.resolve()
        .then(() => PDA_httpPost(url, headers, payload))
        .then((res) => {
          const bodyText = (res && res.responseText) || (res && res.response) || (res && res.body) || (typeof res === 'string' ? res : null);
          if (bodyText == null) throw new Error('Unrecognized PDA_httpPost response.');
          return bodyText ? (typeof bodyText === 'string' ? JSON.parse(bodyText) : bodyText) : {};
        });
    }
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        headers,
        data: payload,
        timeout: NOMAD_TIMEOUT_MS,
        onload: (res) => {
          try {
            resolve(res.responseText ? JSON.parse(res.responseText) : {});
          } catch (e) {
            if (res.status >= 200 && res.status < 300) resolve({});
            else reject(new Error(`HTTP ${res.status}: ${(res.responseText || '').slice(0, 120)}`));
          }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }

  function nomadFactionUrl(faction) {
    return (faction && faction.faction_id) ? `https://www.torn.com/factions.php?step=profile&ID=${faction.faction_id}#/` : 'No Faction URL';
  }

  async function requestNomadRevive() {
    if (revBusy) return;
    revBusy = true;
    showToast('📨 Sending revive request…');
    try {
      let own;
      try {
        own = await apiFetch('user', 'basic');
      } catch (e) {
        showToast(`Couldn't confirm your player ID: ${e.message}`);
        return;
      }
      const userId = own.player_id;
      const userName = own.name;
      if (!userId || !userName) {
        showToast("Couldn't confirm your player ID.");
        return;
      }
      let data;
      try {
        data = await httpPostJson(NOMAD_API_URL, { endpoint: `user/${userId}`, params: {} });
      } catch (e) {
        showToast(`Nomad's lookup failed: ${e.message}`);
        return;
      }
      if (!data || !data.status) {
        showToast("Nomad's lookup didn't return a status. Try again shortly.");
        return;
      }
      if (data.status.state !== 'Hospital') {
        showToast('You are not hospitalized right now.');
        return;
      }
      const hospitalTs = data.states && data.states.hospital_timestamp;
      if (!hospitalTs) {
        showToast('Could not determine your hospital time.');
        return;
      }
      const minutesLeft = Math.floor((hospitalTs - Date.now() / 1000) / 60);
      if (minutesLeft < NOMAD_MIN_HOSPITAL_MINUTES) {
        showToast(`You need more than ${NOMAD_MIN_HOSPITAL_MINUTES} minutes left in hospital to request a revive.`);
        return;
      }
      if (!data.revivable) {
        showToast('Turn on your revives in Torn Settings first.');
        return;
      }
      try {
        await httpPostJson(NOMAD_WEBHOOK_URL, {
          function: 'revive',
          usuario: `${userName} [${userId}]`,
          status: (data.status && data.status.description) || 'N/A',
          faction: (data.faction && data.faction.faction_name) || 'No Faction',
          faction_url: nomadFactionUrl(data.faction),
          details: (data.status && data.status.details) || 'No Details',
        });
      } catch (e) {
        showToast(`Revive request failed to send: ${e.message}`);
        return;
      }
      showToast("Revive request sent to Nomad's! Remember to pay 1 Xanax to whoever revives you.");
    } finally {
      revBusy = false;
    }
  }

  // ---------------------------------------------------------------------
  // WTF HEALERS -- self revive request. Integrated with permission; mirrors
  // HowsThat [1643014]'s "WTF Revives" script: only while you're in
  // hospital, posts your ID, name and faction to WTF's revive service.
  // ---------------------------------------------------------------------
  const WTF_REVIVE_URL = 'https://what-the-f.de/wtfapi/revive';
  function wtfPost(body) {
    const payload = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json' };
    if (IS_PDA) {
      if (typeof PDA_httpPost !== 'function') return Promise.reject(new Error("This needs Torn PDA's POST support, which isn't available here."));
      return Promise.resolve().then(() => PDA_httpPost(WTF_REVIVE_URL, headers, payload)).then((res) => ({
        status: Number((res && (res.status || res.statusCode)) || 200),
        text: String((res && (res.responseText || res.response || res.body)) || (typeof res === 'string' ? res : '')),
      }));
    }
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST', url: WTF_REVIVE_URL, headers, data: payload, timeout: NOMAD_TIMEOUT_MS,
        onload: (res) => resolve({ status: res.status, text: res.responseText || '' }),
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }
  async function requestWtfRevive() {
    if (revBusy) return;
    revBusy = true;
    showToast('\ud83d\udce8 Sending revive request to WTF Healers\u2026');
    try {
      let me;
      try {
        me = await apiFetch('user', 'profile');
      } catch (e) {
        showToast(`Couldn't confirm your player details: ${e.message}`);
        return;
      }
      const userID = me && me.player_id;
      const userName = me && me.name;
      if (!userID || !userName) { showToast("Couldn't confirm your player details."); return; }
      if (!me.status || me.status.state !== 'Hospital') {
        showToast('You are not in hospital right now.');
        return;
      }
      const factionName = (me.faction && me.faction.faction_name) || getCfg('tws_own_faction_name', '') || '';
      let res;
      try {
        res = await wtfPost({ userID, userName, factionName, requestChannel: 'WTF Revive Button Script' });
      } catch (e) {
        showToast(`Revive request failed to send: ${e.message}`);
        return;
      }
      if (Number(res.status) === 200) {
        showToast('Revive request sent to WTF Healers! Revives cost $1,800,000 or 2 Xanax.');
      } else {
        let reason = '';
        try { reason = JSON.parse(res.text).reason || ''; } catch (e) { /* not JSON */ }
        showToast(`WTF Healers: ${reason || `request refused (HTTP ${res.status})`}`, { duration: 7000 });
      }
    } finally {
      revBusy = false;
    }
  }

  // The revive services the Rev button can use. To add one: a new entry
  // here with its own request function (and its @connect domain).
  const REVIVE_PROVIDERS = [
    {
      id: 'nomad', name: "Nomad's", cost: '1 Xanax per revive',
      desc: "Nomad's Quick Revive, run by LilyWaterbug [2608747]. You need more than 2 minutes left in hospital and your revives switched on.",
      request: () => requestNomadRevive(),
    },
    {
      id: 'wtf', name: 'WTF Healers', cost: '$1.8m or 2 Xanax per revive',
      desc: 'The WTF faction\u2019s revive team (what-the-f.de), from HowsThat [1643014]\u2019s WTF Revives script. Send it while you\u2019re in hospital.',
      request: () => requestWtfRevive(),
    },
  ];
  function reviveProvider() {
    const id = getCfg(STORE_KEYS.reviveProvider, 'nomad');
    return REVIVE_PROVIDERS.find((p) => p.id === id) || REVIVE_PROVIDERS[0];
  }
  function reviveProviderHtml(p) {
    return `<b>${p.name}</b> \u2013 ${p.desc} <span style="color:#e0b64c;">Cost: ${p.cost}.</span>`;
  }
  // ---------------------------------------------------------------------
  // REVIVES <-> TORN SYNC
  // Reads and writes Torn's own "Who can revive you" setting
  // (preferences.php, radio group name="reviving": allow-everyone=0,
  // friends-faction=1, no-one=2) via a hidden background copy of that page.
  // WRITE: clicks the real <label for="..."> for the wanted option -- the
  // same thing a real tap does -- so it triggers whatever Torn's own JS
  // does to save it, rather than guessing at an API call.
  // READ: checked-radio's value, used once at startup so the switch starts
  // in step with your real Torn setting.
  // ---------------------------------------------------------------------
  const PREFS_URL = 'https://www.torn.com/preferences.php';
  const REVIVE_RADIO_IDS = { on: 'allow-everyone', friends: 'friends-faction', off: 'no-one' };
  const REVIVE_RADIO_VALUES = { '0': 'on', '1': 'friends', '2': 'off' };
  let prefsFrame = null;
  let prefsSyncBusy = false;
  let pushBusy = false;
  let revivesWatchGen = 0;

  function prefsFrameDoc() {
    try {
      return (prefsFrame && prefsFrame.el && prefsFrame.el.contentDocument) || null;
    } catch (e) {
      return null;
    }
  }

  function removePrefsFrame() {
    if (prefsFrame && prefsFrame.el) prefsFrame.el.remove();
    prefsFrame = null;
  }

  // Kept alive in the background (like the blood/armoury frame) instead of
  // loading fresh on every use. Always cache-busted so it's never served a
  // stale copy from the browser's HTTP cache.
  function ensurePrefsFrame(force) {
    return null; // Torn rules: no hidden Preferences page
    if (prefsFrame && !force) return prefsFrame;
    removePrefsFrame();
    const el = document.createElement('iframe');
    el.id = 'tws-prefs-frame';
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    el.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:900px;opacity:0;pointer-events:none;z-index:-1;border:0;';
    const frame = { el };
    prefsFrame = frame;
    el.src = `${PREFS_URL}?_ts=${Date.now()}`;
    document.body.appendChild(el);
    return frame;
  }


  function readTornRevives(doc) {
    const checked = doc && doc.querySelector('input[name="reviving"]:checked');
    return checked ? (REVIVE_RADIO_VALUES[checked.value] || null) : null;
  }

  // Revives, the Torn-rules way: Torn's Preferences page opens in the
  // pop-out (one tap = one page load) with the option you picked outlined.
  // You choose it and press Torn's own button. While you're viewing that
  // page, War Room reads what it shows, so the Rev button follows Torn.
  let reviveWant = null;
  function openRevivesPopout(value) {
    reviveWant = value;
    if (!popoutsEnabled()) {
      window.open(PREFS_URL, '_blank');
      showToast(`Pick \u201c${revivesLabel(value)}\u201d on Torn\u2019s Preferences page and press Update.`);
      return;
    }
    openPopout(PREFS_URL, '\u2764\ufe0f Who can revive you');
    showToast(`Pick \u201c${revivesLabel(value)}\u201d and press Torn\u2019s Update button.`);
  }
  function watchRevivesPopout() {
    if (!pageFocused()) return;
    if (!popout || popout.root.style.display !== 'flex') return;
    let doc = null;
    try {
      const d = popout.frame.contentDocument;
      if (d && d.location && /preferences\.php/i.test(d.location.href)) doc = d;
    } catch (e) { return; }
    if (!doc || !doc.body) return;
    const id = reviveWant && REVIVE_RADIO_IDS[reviveWant];
    const label = id && doc.querySelector(`label[for="${id}"]`);
    if (label && !label.dataset.twsMark) {
      label.dataset.twsMark = '1';
      label.style.outline = '2px solid #ffb300';
      label.style.outlineOffset = '2px';
      try { label.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
    }
    // Read only when the page has just (re)loaded: that is Torn's saved value.
    if (doc.__twsRevRead) return;
    doc.__twsRevRead = true;
    const tornVal = readTornRevives(doc);
    if (tornVal && tornVal !== getRevives()) {
      setCfg(STORE_KEYS.revives, tornVal);
      applyHeaderVisibility();
      if (showSettings && settingsTab === 'general') render();
    }
  }


  const revivesLabel = (v) => (v === 'on' ? 'Everyone' : v === 'friends' ? 'Friends & faction' : 'No one');

  // Plain GET with cache-busting + no-cache headers -- returns raw HTML
  // text, not JSON. Used only to read the real, current, uncached state of
  // preferences.php (an iframe reload can otherwise be served a cached
  // copy, which is what made the previous "Synced" toast a false positive).

  function parseTornRevivesFromHtml(html) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return readTornRevives(doc);
    } catch (e) {
      return null;
    }
  }


  // Push a change to Torn (called when the switch is tapped). Clicks the
  // real radio label (same as a tap), then presses Torn's own "UPDATE
  // SETTINGS" button. Uses the persistent background copy of the page for
  // that, then verifies with an independent, cache-busted plain fetch
  // (fetchTornRevivesFresh) rather than the iframe itself -- an iframe
  // reload can be served a cached copy, which is what made an earlier
  // version of this report "Synced" when it hadn't actually saved.

  // Pull Torn's current value once at startup, so the switch starts in
  // step with reality (silent -- not critical if it can't run).

  const BLOOD_URL = 'https://www.torn.com/factions.php?step=your#/tab=armoury&sub=medical';
  // Items page, Temporary category (grenades, flash/smoke etc.).
  const ITEMS_URL = 'https://www.torn.com/item.php#temporary-items';
  const TRAVEL_AGENT_URL = 'https://www.torn.com/page.php?sid=travel';
  const PLANE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="#ddd" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>';
  // Torn's drug cooldown icon: a green leaf with a small red down arrow.
  const DRUG_SVG = '<svg class="tws-energy-bolt" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><g fill="#4f9a1f"><ellipse cx="11" cy="7" rx="1.9" ry="6"/><ellipse cx="11" cy="7.5" rx="1.7" ry="5.5" transform="rotate(-38 11 13)"/><ellipse cx="11" cy="7.5" rx="1.7" ry="5.5" transform="rotate(38 11 13)"/><ellipse cx="11" cy="9" rx="1.4" ry="4" transform="rotate(-75 11 13)"/><ellipse cx="11" cy="9" rx="1.4" ry="4" transform="rotate(75 11 13)"/><rect x="10.5" y="12.5" width="1" height="7"/></g><path fill="#d9362b" d="M16.5 15.5h7l-3.5 6z"/></svg>';

  // Small inline-SVG grenade for the header (there's no grenade emoji).
  const GRENADE_SVG = `
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="6.2" cy="4.2" r="2.1" fill="none" stroke="#ddd" stroke-width="1.2"/>
      <path d="M8.3 4.2h1.6" stroke="#ddd" stroke-width="1.2"/>
      <rect x="9.6" y="2.4" width="5" height="3.4" rx="1" fill="#9aa39a"/>
      <path d="M14.4 3.4l5-1.2.5 1.7-5.4 1.7z" fill="#c9c9c9"/>
      <rect x="8.4" y="5.6" width="7.2" height="2.6" rx="0.9" fill="#5f7340"/>
      <ellipse cx="12" cy="15" rx="6.6" ry="7.6" fill="#6f8f3f"/>
      <path d="M6 12h12M5.5 15.5h13M6.3 19h11.4M12 8.2v14.3" stroke="#3f5424" stroke-width="0.9" fill="none"/>
    </svg>`;

  // The Kraken logo, cropped to a circle and shrunk to 64x64 (WebP, ~2 KB),
  // shown when the panel is minimised (and on the credit card in Settings).
  const LOGO_DATA_URI = 'data:image/webp;base64,UklGRtQHAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSMABAAABkBtre6tF76erDrAV+BIYOnG7IUMKLazfSx0QkkG0NvS+Au+9kfS9M/f3etk8Ihi4baSoHVo4ppl7AsagRXRc2mhPXn74S/798PKk3VhCx2ioQGuAZv3qvV8cwV/3rq739mjyoAHm9x+TZMnFvQf3kgtJPt6fB5rJEAyzF96RnopzBL0kJ99dmIWFCRCB3VdkKhyTJZGvdoE4wbTVG2RyTkBP5I3VcWdZwPnvA9GEwffzCDaOGloyswIz2cJsDI2HQ3ordB7GkWIhHvMfq/Efj+OIQWtw1NOacjTiFo5oe1pXWsShW93uaW3ZHrLRgMWf2WvD889FhIFJ4S4zqzPzbuif02CHiQIm7vR1mU29L0WBUt5PWeciLvS8xl1A7Pz0Z3cN3D9Pm0Xs9bzK7SFafOFFheIvomGNncqEa8A1Jh0SryE80JoHYeEPXQfnn4WNnle6jQNmJTIPTtXm9CVdCefLj2p8/Esx//K/p76hn6Jfkf6+1T83+udW/97Qv7f07039e1v+3TgD3y39d1P+3dbnDfK8RZ83yfM2ed4oz1v1ebM8b5fXDfK6RV43qes2ed0or1vVdfOZq9vl/w0AVlA4IO4FAACwFwCdASpAAEAAPoUylUglIyIhN+oAoBCJYwDIfUi8Nn4OeK0yXeRa6n+0+Bfij+MSGaWd8Ha73VkAH1l4idKV8z8830AfKFnweqv2V+AP+af1r/f/b984vsx9GP9S2+Gmuwo6wryPUEIeuNAdkSsRKdqaMSlnqkIdRL+VOjXE8XekPGipHyc8bv5RgYwSlVEDho3kFTBHsta9ZkhO981vmERTTg/MaU9/wWhpvTXXch67vylVUufXeHRMAtdVScVrG9RE3MAA/v98afOoCTueSJS9skMTAWnt4V2nWfXZEeNBe8b9cxZmC98GS6QZpXhd4LYATWQMA/I+bxjk4mjfz84z0NgZhq2IXO8W8yu6dnRXA3k//GJxGBpwAyX2f5G+UPw7Fu1whVImEKkplW7YdGnXnqsnUjC35rv4AJkZkk6IC7bbPyO9cocoChwDtzjy6LL/hq+FNdPyWwt3D1vr2RlcUyKeB8VEJD5ET/F2yDytAAZ6+L5sClHF+IAQwPWGHoEEVq/tVXf9G3vPPXtdnsSIK3P3tW1N+syaM6iFzeals7GIJlxS2eqlI+GaHs/FdUr88WplQGcHghzGUW2ORwafSN9lO4+8/wlTjz7/8yPWJqJuSwiqrPhmiSTXWvkPMeSL3qdHSvSen3f0TpItf59XCjpHdeg68ZQuoc/MR1DYNp+AsvR5Q4BDHi4sZTTZGh2QaX/HWcT6emvAD2nNBlXb4Qwf0uVO8k4qr0+ipO2Uib0bL88Lw5Ss+1+spULQTGTrv/iBipMbTJy+UDpYTvuQAj3VDFTV8ngUT7Vfyrv3KPL2Vqj/+W1UtDg39e/nq9pPIejpIKe8tft1ueZB7BaIh/dLel+yXZuvbMBLXR+4jtJ52MpMT6p3VPRHkh5CP7y3VDdBHN/yNmqQOKqJl46nhI/llYCMO+m67p9cKByddHsy9lM5ZeFmAWCYbviyQCVA65Mx6lQBgb9Zo9PLmyA+XL3f1/2E19xvVWNvsViudO7D9tqzogy/QU0sVo+gyN0jjoJlVOw6gaBNTYJGrc+baZyJkrMfNVBuhM70/30fICd36AK5RIuH0eXGq0gcfmoNcSgGH+Uu++uf0QI7QXNeMGW+82bxhdCWzDzvOriW79KC/9rICVRGhrGNswp/KvVoA3p/HmuZ4MVzvuBYAwq56X7l9t83533C0QaXLL9iafo6ffiL9dZFhKJ17Pyu/j/kIcyeWChUIwzMGD3r3VwCyjho3PrstZhYubkfNeMCQKKkua3uOLRQl4DGV8C04CNQGa4qXWtC73o1Y5L5UH+kUtP1Gxd8AlBR8Plgl3hd1QsL+qYWxa79C6brzp+K6QY2khYiaBhYwCPoZp4+2qe1f6k51G3tMGALkF8TXKCWxPAHm3cg42qJE1C1WRLuXf2K5QE+2RrO3xjhzx0xcAmgmXqK1fRB7iCErmtn2IihXtpCTuDMFB5xMVIAjKTNLVqk61H7QLTGqu9IxsDOjKngfW9p87WNyvjmZ/rOLzOaeipnamP1iwTlgk3/J2K4Ac3hf5TPzoBPk7C7DXCIygmLoz1chTXyDDI9sMus2RWKgiQo0GMQanhucuOg5d13p5I7YDnV79tziirxyF5Wf5VGLrWPoU7HZ8oOgwWqugCrnvg8piWtWR4RbstQLaXX7tGeYgKOKTntg5SipfyhgQL2hF8m4byRMj2scQChmW/bXSRzRXhUBuUR+RwHl1OtN6Z1XDcXVGEg5cAA3Tpb+5JqRLTHtJ+tNSVvUhKpHd8una/jHFntj6wUWekt+cAME7L/NH/fg+zpBqMpdRaxLanGRGBrspJeKXybqvEvld8B5jgSEeOMgd7aZtKYhCoUCogulE32ZCBobC3NEy4EujnqToIKdN/Urri+WBn0ysxbFP0VsVfkf+JYiZMDW7phuKtz/WgltSvrzdyoIXCa0lWnkHw4KD7BwAN4u7dvGTD3/U3IYOmzPvIDfUD0r7f+YZfef9F63PhB/EAKSWyitmvsbXE6jKIQYV+AAAA=';

  // Tries the standard clipboard API first, then Tampermonkey's own
  // GM_setClipboard (more reliable there since it doesn't depend on the
  // page having clipboard permission), then a legacy execCommand fallback.
  // Long-press-triggered copies can be flaky across browsers/webviews since
  // the write happens after a setTimeout rather than directly in the
  // original touch handler, so having three attempts matters here.
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      // fall through to next method
    }
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text);
        return true;
      }
    } catch (e) {
      // fall through to next method
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // SMALL UI HELPERS (toast + async helpers)
  // ---------------------------------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeoutMs, stepMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const v = fn();
      if (v) return v;
      await sleep(stepMs || 150);
    }
    return null;
  }

  let toastTimer = null;
  function showToast(msg, opts) {
    opts = opts || {};
    let t = document.getElementById('tws-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'tws-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    t.classList.toggle('tws-toast-warn', !!opts.warn);
    t.classList.toggle('tws-toast-error', !!opts.error);
    t.classList.toggle('tws-toast-ok', !!opts.ok);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.style.display = 'none';
    }, opts.duration || 5000);
  }

  // Full pointer/mouse sequence then a click, for React-driven UIs that
  // sometimes listen for more than just "click". SVG elements have no
  // .click() method, so those get a dispatched click event instead.
  function fireClick(el) {
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((type) => {
      try {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      } catch (e) {
        // ignore -- the final click below is the one that matters most
      }
    });
    if (typeof el.click === 'function') {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  }

  // A plain click that also works on SVG elements and on elements that live
  // inside another document (an iframe).
  function clickAny(el) {
    if (typeof el.click === 'function') {
      el.click();
      return;
    }
    const win = el.ownerDocument && el.ownerDocument.defaultView;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: win || window }));
  }

  // ---------------------------------------------------------------------
  // FACTION CHAT AUTO-FILL (falls back to clipboard copy if not found/open)
  // Torn's chat is a React app with hashed CSS-module class names (e.g.
  // "textarea___a1b2c"), but the prefix before the hash stays stable across
  // deploys, so we match on that. Faction chat is identified either by its
  // element id starting with "faction-" (current chat version) or, as a
  // fallback for an older version, by its header text reading "Faction".
  // setRangeText() + a dispatched "input" event is required (not a plain
  // .value assignment) for React's controlled textarea to actually notice
  // the change.
  // ---------------------------------------------------------------------
  function findFactionChatTextarea() {
    try {
      const found = sosFactionChatBoxes(document);
      if (found.length) return found[0].ta;
    } catch (e) { /* fall back below */ }
    const chatRoot = document.querySelector('#chatRoot') || document;
    const boxes = chatRoot.querySelectorAll('[class*="chat-box___"], [class*="root___"]');
    for (const chatBox of boxes) {
      const isFaction = (chatBox.id && chatBox.id.startsWith('faction-')) || (() => {
        const t = chatBox.querySelector('[class*="chat-box-header__name___"]');
        return t && factionChatTitles().includes(normChatTitle(t.textContent));
      })();
      if (!isFaction) continue;
      const ta = chatBox.querySelector('[class*="textarea___"]') || chatBox.querySelector('textarea');
      if (ta) return ta;
    }
    return null;
  }

  function insertIntoFactionChat(text) {
    const ta = findFactionChatTextarea();
    if (!ta) return false;
    ta.focus();
    ta.setRangeText(text, 0, ta.value.length, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    return true;
  }

  // Tries the Faction chat box first (fills it directly, ready to send);
  // falls back to the clipboard if that chat isn't currently open/found on
  // the page, so this never just silently does nothing.
  function sendToChatOrClipboard(text) {
    if (insertIntoFactionChat(text)) {
      return Promise.resolve(true);
    }
    return copyToClipboard(text);
  }


  // ---------------------------------------------------------------------
  // BLOOD BAG COMPATIBILITY, HIGHLIGHT, ONE-TAP USE AND "SAFE BAG" PICKER
  // Torn's rule (per the wiki + forum guides): an incompatible bag sends
  // you to hospital for 90 minutes; a compatible one heals. Standard
  // donor/recipient chart -- recipient type -> donor types that are SAFE.
  //
  // The armoury renders in (at least) two layouts:
  //   - wider layout: each item is a ul.item-list whose <li> children
  //     include li.options-act holding
  //       a.use[aria-label="Blood Bag : A+. Action: Use"]
  //     (collapsed until the row's .show-option-icon arrow is tapped)
  //   - narrow/mobile layout (what the visible pop-out shows): rows read
  //     "Blood Bag : A+ x419" with a gear icon at the right edge.
  // Rows are therefore found three ways, in order: ul.item-list, innermost
  // <li>, and finally by the bag's name TEXT (works for any structure).
  //
  // The highlight is visual only. The pop-out picker (🩸✓) chooses a safe bag
  // and asks for ONE confirming tap. ONE-TAP USE (header 🩸) skips the
  // asking: it picks the best safe bag and presses Use itself, using a hidden
  // background copy of the armoury (wide layout, the structure that has been
  // scanned) so it's as fast as possible. It can only ever pick a bag that
  // the compatibility chart says is safe for your saved blood type.
  // ---------------------------------------------------------------------
  const BLOOD_COMPAT = {
    'O-': ['O-'],
    'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'],
    'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'],
    'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  };
  // How many recipient types can safely take each donor type (O- = 8 ...
  // AB+ = 1). When several bags are safe, the picker prefers your own
  // exact type, then the LEAST universal one -- keeping O- for people who
  // can only take O-.
  const BLOOD_UNIVERSALITY = {};
  Object.keys(BLOOD_COMPAT).forEach((donor) => {
    BLOOD_UNIVERSALITY[donor] = Object.keys(BLOOD_COMPAT).filter((r) => BLOOD_COMPAT[r].includes(donor)).length;
  });
  // Item names look like "Blood Bag : A-" (minus may be a unicode dash).
  const BLOOD_FULL_RE = /blood\s*bag\s*:\s*(AB|A|B|O)\s*([+\-\u2212\u2013])/i;
  const BLOOD_GLOBAL_RE = /blood\s*bag\s*:\s*(?:AB|A|B|O)\s*[+\-\u2212\u2013]/gi;

  function parseBloodType(text) {
    const m = (text || '').match(BLOOD_FULL_RE);
    if (!m) return null;
    return m[1].toUpperCase() + (m[2] === '+' ? '+' : '-');
  }

  function ensureBloodStyle(doc) {
    if (doc.getElementById('tws-blood-style')) return;
    const st = doc.createElement('style');
    st.id = 'tws-blood-style';
    st.textContent = `
      [data-tws-blood="ok"] { outline: 2px solid #2e7d32 !important; background: rgba(46,125,50,0.25) !important; }
      [data-tws-blood="bad"] { outline: 2px solid #7d2e2e !important; opacity: 0.55 !important; }
      [data-tws-blood-name="ok"]::after { content: "  \\2713 SAFE"; color: #7cfc7c; font-weight: bold; }
      [data-tws-blood-name="bad"]::after { content: "  \\2717 HOSPITAL"; color: #ff7c7c; font-weight: bold; }
    `;
    (doc.head || doc.documentElement).appendChild(st);
  }

  // Structure-independent row finder: locate each "Blood Bag : X" name by
  // its text, then take the largest ancestor that still holds only ONE
  // blood bag (and isn't taller than a single list row).
  function bloodRowsByText(doc) {
    const out = [];
    const seen = new Set();
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const v = node.nodeValue;
      if (!v || v.length > 80 || !/blood/i.test(v)) continue;
      // The type can sit in a sibling node, so widen to a short parent
      // element until the full "Blood Bag : X+" text is found.
      let el = node.parentElement;
      let type = null;
      for (let i = 0; i < 3 && el; i++) {
        const txt = el.textContent || '';
        if (txt.length <= 60) {
          type = parseBloodType(txt);
          if (type) break;
        }
        el = el.parentElement;
      }
      if (!type || !el || seen.has(el)) continue;
      seen.add(el);
      let row = el;
      for (let i = 0; i < 6; i++) {
        const p = row.parentElement;
        if (!p || p === doc.body) break;
        if (((p.textContent || '').match(BLOOD_GLOBAL_RE) || []).length > 1) break;
        if (p.getBoundingClientRect().height > 150) break; // taller than one list row
        row = p;
      }
      out.push({ row, type });
    }
    return out;
  }

  // Every blood-bag item row in a document, with its type.
  function bloodRowsIn(doc) {
    if (!doc || !doc.body) return [];
    const scope = doc.querySelector('#faction-armoury') || doc.body;
    const collect = (rows) => {
      const out = [];
      rows.forEach((row) => {
        let txt = row.textContent || '';
        if (txt.length > 800) return; // a container of many items, not one item
        row.querySelectorAll('[aria-label], img').forEach((el) => {
          txt += ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('alt') || '') + ' ' + (el.getAttribute('title') || '');
        });
        const type = parseBloodType(txt);
        if (type) out.push({ row, type });
      });
      return out;
    };
    let found = collect(Array.from(scope.querySelectorAll('ul.item-list')));
    if (!found.length) {
      found = collect(Array.from(scope.querySelectorAll('li')).filter((li) => !li.querySelector('li')));
    }
    if (!found.length) {
      found = bloodRowsByText(doc);
    }
    return found;
  }

  function highlightBloodBags(doc) {
    const mine = getCfg(STORE_KEYS.bloodType);
    if (!mine || !doc || !doc.body) return;
    const safeDonors = BLOOD_COMPAT[mine] || [];
    ensureBloodStyle(doc);
    bloodRowsIn(doc).forEach(({ row, type }) => {
      const state = safeDonors.includes(type) ? 'ok' : 'bad';
      row.setAttribute('data-tws-blood', state);
      // Badge on the Use button when it exists (that's where the decision
      // is made); otherwise on the element carrying the item's name.
      const use = row.querySelector('a.use');
      if (use) {
        use.setAttribute('data-tws-blood-name', state);
      } else {
        let nameEl = null;
        row.querySelectorAll('*').forEach((el) => {
          if (!nameEl && el.childElementCount === 0 && parseBloodType(el.textContent || '')) nameEl = el;
        });
        if (nameEl) nameEl.setAttribute('data-tws-blood-name', state);
      }
    });
  }

  // Removes the safe/unsafe marks again (used when the highlight feature is
  // switched off in Advanced settings).
  function clearBloodMarks(doc) {
    if (!doc || !doc.querySelectorAll) return;
    doc.querySelectorAll('[data-tws-blood], [data-tws-blood-name]').forEach((el) => {
      el.removeAttribute('data-tws-blood');
      el.removeAttribute('data-tws-blood-name');
    });
  }

  // The armoury document to act on: the pop-out if it's showing the
  // armoury, else the page itself if you're on it.
  function getArmouryDoc() {
    try {
      if (popout && popout.root.style.display !== 'none') {
        const d = popout.frame.contentDocument;
        if (d && d.location && /armoury/i.test(d.location.href)) return d;
      }
    } catch (e) { /* ignore */ }
    if (/armoury/i.test(location.href)) return document;
    return null;
  }

  // Runs every tick, but only does work on an armoury page -- either the
  // page itself or inside the pop-out. Also keeps the pop-out bar's optional
  // 🩸✓ picker button in step with its feature toggle.
  function runBloodHighlight__raw() {
    if (popout) {
      let on = false;
      try {
        const d = popout.frame.contentDocument;
        on = !!(d && d.location && /armoury/i.test(d.location.href));
      } catch (e) { /* not readable yet */ }
      popout.bagEl.style.display = (on && featureOn('bloodPicker')) ? 'inline-block' : 'none';
    }
    if (!pageFocused()) return; // only read the armoury while you're looking at it
    if (!getCfg(STORE_KEYS.bloodType)) return;
    const hl = featureOn('bloodHighlight');
    try {
      if (/armoury/i.test(location.href)) {
        if (hl) highlightBloodBags(document); else clearBloodMarks(document);
      }
    } catch (e) { /* never let highlighting break the tick loop */ }
    try {
      if (popout && popout.root.style.display !== 'none' && !popout.root.classList.contains('tws-po-min')) {
        const d = popout.frame.contentDocument;
        if (d && d.location && /armoury/i.test(d.location.href)) {
          if (hl) highlightBloodBags(d); else clearBloodMarks(d);
        }
      }
    } catch (e) { /* cross-origin / not loaded yet */ }
  }

  function removeBagConfirm() {
    const b = document.getElementById('tws-bag-confirm');
    if (b) b.remove();
  }

  // Finds the Use link for THIS bag: inside its row, or anywhere in the
  // document with an aria-label naming exactly this bag type.
  // The full armoury row for one bag: climbs from the matched box (often just
  // the name) to the smallest ancestor that also holds the row's gear, without
  // ever taking in a second bag.
  function bagItemRow(el) {
    const bags = (n) => new Set(((n.textContent || '').match(BLOOD_GLOBAL_RE) || [])
      .map((t) => parseBloodType(t)).filter(Boolean)).size;
    let r = el;
    for (let i = 0; i < 6 && r && !r.querySelector('.show-option-icon'); i++) {
      const p = r.parentElement;
      if (!p || p === r.ownerDocument.body || bags(p) > 1) break;
      r = p;
    }
    return (r && r.querySelector('.show-option-icon')) ? r : el;
  }
  function isUseControl(el) {
    if (!el || !el.matches) return false;
    if (!el.matches('a, button, [role="button"], input[type="button"], input[type="submit"], span, div')) return false;
    const txt = ((el.value || el.textContent || '') + '').replace(/\s+/g, ' ').trim();
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
    if (el.matches('span, div') && (el.children.length > 1 || el.querySelector('a, button, input'))) return false; // a wrapper, not the button
    return /^use$/i.test(txt) || /^use\b/i.test(label) || (el.matches('a, button') && /(^|[\s_-])use($|[\s_-])/i.test(el.className || ''));
  }
  function findBagUseLink(row, type, requireVisible) {
    const doc = row.ownerDocument;
    const candidates = [];
    const inRow = row.querySelector('a.use');
    if (inRow) candidates.push(inRow);
    doc.querySelectorAll('a.use[aria-label]').forEach((a) => {
      if (parseBloodType(a.getAttribute('aria-label')) === type) candidates.push(a);
    });
    // Phone layout: the options open in the row itself or just under it.
    const scopes = [row];
    let sib = row.nextElementSibling;
    for (let i = 0; sib && i < 2; i++, sib = sib.nextElementSibling) scopes.push(sib);
    scopes.forEach((sc) => {
      sc.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"], span, div').forEach((el) => {
        if (isUseControl(el) && !candidates.includes(el)) candidates.push(el);
      });
    });
    return candidates.find((a) => !requireVisible || a.getClientRects().length > 0) || null;
  }
  // Sandbox helper: copies a short description of the chosen bag's row (and
  // what opened under it) so the Use button can be found on the real page.
  function bagRowScan(row) {
    const d = (el) => {
      const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      const t = (el.children.length ? '' : (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24));
      const lab = el.getAttribute('aria-label') || '';
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${lab ? ` [${lab.slice(0, 30)}]` : ''}${t ? ` "${t}"` : ''}${el.getClientRects().length ? '' : ' (hidden)'}`;
    };
    const lines = [`Bag scan ${SCRIPT_VERSION} ${row.ownerDocument.location.pathname}`];
    let up = row.parentElement;
    for (let i = 0; up && i < 4 && up !== row.ownerDocument.body; i++, up = up.parentElement) {
      const n = ((up.textContent || '').match(BLOOD_GLOBAL_RE) || []).map((t) => parseBloodType(t));
      lines.push(`^ ${d(up).replace(/ ".*"$/, '')} kids=${up.children.length} bags=${n.join(',') || '-'} gear=${up.querySelectorAll('.show-option-icon').length}`);
    }
    const dump = (el, depth, max) => {
      if (!el || lines.length > max) return;
      lines.push(`${'  '.repeat(depth)}${d(el)}`);
      Array.from(el.children).forEach((k) => dump(k, depth + 1, max));
    };
    dump(row, 0, 60);
    let sib = row.nextElementSibling;
    for (let i = 0; sib && i < 2; i++, sib = sib.nextElementSibling) { lines.push('-- next:'); dump(sib, 0, 90); }
    return lines.join('\n');
  }

  // The control that opens a row's options: the arrow in the wide layout
  // (.show-option-icon), or whatever small control sits at the right-hand end
  // of the row in the narrow layout (the gear).
  function findRowGear(row) {
    const wide = row.querySelector('.show-option-icon');
    if (wide) return wide;
    const r = row.getBoundingClientRect();
    let best = null;
    let bestRight = -Infinity;
    let bestArea = Infinity;
    row.querySelectorAll('*').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width < 12 || b.height < 12 || b.width > 100 || b.height > 100) return;
      if (b.right < r.right - 110) return; // must sit at the row's right-hand end
      const area = b.width * b.height;
      if (b.right > bestRight + 1 || (Math.abs(b.right - bestRight) <= 1 && area < bestArea)) {
        best = el;
        bestRight = b.right;
        bestArea = area;
      }
    });
    if (best) return best;
    const el = row.ownerDocument.elementFromPoint(Math.max(r.left + 5, r.right - 45), r.top + r.height / 2);
    return (el && row.contains(el)) ? el : null;
  }

  // Opens the row's options, then waits for its Use link.
  async function getBagUseLink(row, type) {
    let a = findBagUseLink(row, type, true);
    if (a) return a;
    try { row.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
    const toggle = findRowGear(row);
    if (toggle) {
      clickAny(toggle);
      a = await waitFor(() => findBagUseLink(row, type, true), 1800, 100);
    }
    return a || null;
  }

  // 🩸✓: pick the best SAFE bag, then ask for one confirming tap.
  // After a blood bag is used: read your life from the API (cache-busted, so
  // it's the post-bag figure) and flash it up as a percentage. Tries twice,
  // in case Torn hasn't applied the heal on the first read yet.
  // Temporary message in the panel header (replaces the title and the
  // "vs <enemy>" name until it expires). Re-applied on every render.
  let headerFlash = null; // { text, cls, until }
  // Red circle with a white cross, used in the health / hospital banner.
  const MED_ICON = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><rect x="0" y="0" width="20" height="20" rx="5" ry="5" fill="#fff"/><circle cx="10" cy="10" r="7.5" fill="#e02424"/><rect x="8.7" y="5.5" width="2.6" height="9" fill="#fff"/><rect x="5.5" y="8.7" width="9" height="2.6" fill="#fff"/></svg>';

  // ---------------------------------------------------------------------
  // OWN HOSPITAL BANNER (v1.84.0)
  // While YOU are in hospital, the header shows your health and a live
  // hospital countdown until you're out. Detected from your own faction
  // roster (no extra cost); only while you're in hospital (or not in a
  // faction) is your own status + life read from the API as well.
  // ---------------------------------------------------------------------
  const ownHosp = { until: 0, life: null };

  function myIdCached() {
    try {
      const r = JSON.parse(getCfg('tws_access_me', 'null'));
      return r && r.id ? String(r.id) : '';
    } catch (e) {
      return '';
    }
  }

  function hospActive() {
    return featureOn('hospBanner') && ownHosp.until * 1000 > Date.now();
  }

  let hospWasShown = false;

  async function readOwnLife() {
    const key = getApiKey();
    if (!key) return null;
    const d = await httpGetJson(`https://api.torn.com/user/?selections=bars&key=${encodeURIComponent(key)}&timestamp=${Date.now()}&comment=sandboxwar`);
    const life = d && !d.error && d.life;
    return (life && life.maximum) ? { cur: Number(life.current) || 0, max: Number(life.maximum) } : null;
  }

  // force = check with the API now (e.g. straight after a blood bag / med kit).
  async function updateOwnHospital(force) {
    if (!featureOn('hospBanner')) {
      ownHosp.until = 0;
      return;
    }
    const me = myIdCached();
    const m = me ? homeMembers.find((x) => String(x.id) === me) : null;
    if (!force && m && m.state !== 'Hospital' && !hospActive()) {
      ownHosp.until = 0;
      return;
    }
    // In hospital, just left, forced, or the roster can't tell (no faction):
    // read your own status and life directly.
    try {
      const key = getApiKey();
      if (!key) return;
      const d = await httpGetJson(`https://api.torn.com/user/?selections=basic,bars&key=${encodeURIComponent(key)}&timestamp=${Date.now()}&comment=sandboxwar`);
      if (!d || d.error) throw new Error('status unavailable');
      const st = d.status || {};
      ownHosp.until = (st.state === 'Hospital' && Number(st.until)) ? Number(st.until) : 0;
      if (d.life && d.life.maximum) ownHosp.life = { cur: Number(d.life.current) || 0, max: Number(d.life.maximum) };
    } catch (e) {
      if (m && m.state !== 'Hospital') ownHosp.until = 0; // the roster says you're out
    }
  }

  // Green "out of hospital" message with your health, shown the moment the
  // banner clears (revive, blood bag / med kit, or the timer running out).
  function announceOutOfHospital() {
    const textFor = (l) => `Out of hospital! ${l && l.max ? lifeText(l) : ''}`.trim();
    const panelShown = panel && panel.style.display !== 'none' && !getCfg(STORE_KEYS.collapsed, false);
    if (!panelShown) {
      showToast(`\u271a ${textFor(ownHosp.life)}`, { duration: 7000, ok: true });
    } else {
      headerFlash = { text: textFor(ownHosp.life), cls: 'tws-hflash-out', until: Date.now() + 8000 };
      setTimeout(applyHeaderFlash, 8100);
    }
    // Swap in the exact current health as soon as it's read.
    readOwnLife().then((l) => {
      if (!l) return;
      ownHosp.life = l;
      if (headerFlash && headerFlash.cls === 'tws-hflash-out') {
        headerFlash.text = textFor(l);
        applyHeaderFlash();
      } else if (!panelShown) {
        showToast(`\u271a ${textFor(l)}`, { duration: 7000, ok: true });
      }
    }).catch(() => { /* the first message already showed */ });
  }

  function lifeText(l) {
    return `Health at ${Math.round((l.cur / l.max) * 100)}% (${l.cur}/${l.max})`;
  }

  function applyHeaderFlash__raw() {
    try {
      applyHeaderFlashInner();
    } catch (e) {
      reportCrash('hospital/health banner', e);
    }
  }

  function applyHeaderFlashInner() {
    if (!panel) return;
    const hospNow = hospActive();
    if (hospNow) hospWasShown = true;
    else if (hospWasShown) {
      hospWasShown = false;
      if (featureOn('hospBanner')) announceOutOfHospital();
    }
    const t = panel.querySelector('#tws-title');
    const en = panel.querySelector('#tws-enemy-name');
    let pill = panel.querySelector('#tws-hflash');
    if (!pill && t) {
      pill = document.createElement('span');
      pill.id = 'tws-hflash';
      t.after(pill);
    }
    const flashOn = !!headerFlash && Date.now() < headerFlash.until;
    if (!flashOn) headerFlash = null;
    let html = null;
    let cls = '';
    if (hospActive()) {
      const left = Math.max(0, Math.round(ownHosp.until - Date.now() / 1000));
      const l = ownHosp.life;
      html = `${MED_ICON}${l && l.max ? `Health ${Math.round((l.cur / l.max) * 100)}% (${l.cur}/${l.max}) ` : ''}In Hospital ${fmtDuration(left)}${MED_ICON}`;
      cls = 'tws-hflash-hosp';
    } else if (flashOn) {
      html = MED_ICON + escHtml(headerFlash.text);
      cls = headerFlash.cls;
    }
    const on = html !== null;
    if (pill) {
      pill.style.display = on ? 'inline-block' : 'none';
      if (on) {
        if (pill.innerHTML !== html) pill.innerHTML = html;
        if (pill.className !== cls) pill.className = cls;
      }
    }
    if (t) t.style.display = on ? 'none' : '';
    if (en) en.style.display = on ? 'none' : '';
  }

  function flashHeaderHealth(pct, cur, max) {
    ownHosp.life = { cur, max }; // the hospital banner picks this up straight away
    const text = lifeText({ cur, max });
    const panelShown = panel && panel.style.display !== 'none' && !getCfg(STORE_KEYS.collapsed, false);
    if (!panelShown) {
      showToast(`\u271a ${text}`, { duration: 6000, warn: pct < 50 });
      return;
    }
    const tt = document.getElementById('tws-toast');
    if (tt) tt.style.display = 'none'; // no need to say it twice
    headerFlash = { text, cls: pct < 50 ? 'tws-hflash-low' : '', until: Date.now() + 8000 };
    applyHeaderFlash();
    setTimeout(applyHeaderFlash, 8100);
  }

  async function showLifeAfterBag(before, token) {
    if (!featureOn('bloodLifeToast') && !token) return false;
    const readLife = async () => {
      const key = getApiKey();
      if (!key) return null;
      const d = await httpGetJson(`https://api.torn.com/user/?selections=bars&key=${encodeURIComponent(key)}&timestamp=${Date.now()}&comment=sandboxwar`);
      const life = d && !d.error && d.life;
      return (life && life.maximum) ? { cur: Number(life.current) || 0, max: Number(life.maximum) } : null;
    };
    try {
      let life = null;
      let healed = false;
      if (!before) {
        await sleep(900);
        life = await readLife();
        healed = !!life;
      } else {
        await sleep(250);
        const start = Date.now();
        while (Date.now() - start < 5000) {
          if (token && token.cancelled) return false;
          life = (await readLife()) || life;
          if (life && life.cur > before.cur) { healed = true; break; }
          await sleep(350);
        }
      }
      if (typeof medLog === 'function') medLog(`life after: ${life ? `${life.cur}/${life.max}` : 'unknown'}`);
      if (!life || !healed || (token && token.cancelled)) return false;
      if (featureOn('bloodLifeToast')) {
        const pct = Math.round((life.cur / life.max) * 100);
        flashHeaderHealth(pct, life.cur, life.max);
      }
      if (hospActive()) updateOwnHospital(true).then(applyHeaderFlash).catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  // Life before a bag is used (for the retry check above). Never blocks the use.
  async function lifeBeforeBag() {
    if (!featureOn('bloodLifeToast')) return null;
    try {
      const key = getApiKey();
      if (!key) return null;
      const d = await Promise.race([
        httpGetJson(`https://api.torn.com/user/?selections=bars&key=${encodeURIComponent(key)}&timestamp=${Date.now()}&comment=sandboxwar`),
        sleep(800).then(() => null),
      ]);
      const life = d && !d.error && d.life;
      return life ? { cur: Number(life.current) || 0, max: Number(life.maximum) || 0 } : null;
    } catch (e) { return null; }
  }

  // Health bar under the pop-out's title bar while the medical armoury is
  // open (API "bars": every 15s, and straight after each bag until it shows).
  let poLifeLast = null;
  let poLifeAt = 0;
  let poLifeBusy = false;
  function paintPoLife(life) {
    if (!popout || !life || !life.max) return;
    const el = popout.root.querySelector('#tws-po-life');
    if (!el) return;
    const pct = Math.max(0, Math.min(100, Math.round((life.cur / life.max) * 100)));
    el.querySelector('.tws-po-life-txt').textContent = `\u2764 ${life.cur.toLocaleString()} / ${life.max.toLocaleString()} (${pct}%)`;
    el.querySelector('.tws-po-life-fill').style.width = `${pct}%`;
    el.classList.toggle('tws-life-low', pct < 40);
    el.classList.toggle('tws-life-mid', pct >= 40 && pct < 75);
  }
  async function readPoLife() {
    const key = getApiKey();
    if (!key) return null;
    try {
      const d = await httpGetJson(`https://api.torn.com/user/?selections=bars&key=${encodeURIComponent(key)}&timestamp=${Date.now()}&comment=sandboxwar`);
      const life = d && !d.error && d.life;
      return (life && life.maximum) ? { cur: Number(life.current) || 0, max: Number(life.maximum) } : null;
    } catch (e) { return null; }
  }
  async function refreshPoLife(force) {
    if (poLifeBusy || (!force && Date.now() - poLifeAt < 15000)) return;
    poLifeBusy = true;
    try {
      const life = await readPoLife();
      poLifeAt = Date.now();
      if (life) { poLifeLast = life; paintPoLife(life); }
    } finally { poLifeBusy = false; }
  }
  // Items -> Temporary pop-out: quick buttons for the four stat needles.
  const TEMP_NEEDLES = [
    { stat: 'Strength', item: 'Epinephrine', icon: '\ud83d\udcaa' },
    { stat: 'Speed', item: 'Melatonin', icon: '\u26a1' },
    { stat: 'Defence', item: 'Serotonin', icon: '\ud83d\udee1\ufe0f' },
    { stat: 'Dexterity', item: 'Tyrosine', icon: '\ud83c\udfaf' },
  ];
  function getTempItemsDoc() {
    if (!popout || popout.root.style.display === 'none') return null;
    const frames = [popout.frame].concat(Object.values(popout.preFrames || {}));
    for (const fr of frames) {
      try {
        if (!fr || fr.style.display === 'none') continue;
        const d = fr.contentDocument;
        if (d && d.location && /\/item\.php/i.test(d.location.pathname)) return d;
      } catch (e) { /* not readable yet */ }
    }
    return null;
  }
  // The smallest box that holds this needle's name (and nothing else's).
  function findNeedleRow(doc, name) {
    // Text is checked piece by piece (each bit of text on its own), so a count
    // or a button label next to the name can't hide it.
    const nameRe = (n) => new RegExp(`(^|[^a-z])${n}([^a-z]|$)`, 'i');
    const has = (el, n) => {
      const re = nameRe(n);
      const tw = doc.createTreeWalker(el, 4);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) if (re.test(t.nodeValue || '')) return true;
      return false;
    };
    const others = TEMP_NEEDLES.map((n) => n.item).filter((n) => n !== name);
    const pick = (sel) => Array.from(doc.querySelectorAll(sel))
      .filter((li) => has(li, name) && !others.some((o) => has(li, o)))
      .filter((li) => li.getClientRects().length > 0);
    let cands = pick('li[data-item]');
    if (!cands.length) cands = pick('li[data-category], ul.items-cont > li, li');
    if (!cands.length) return null;
    return cands.reduce((a, b) => ((b.textContent || '').length < (a.textContent || '').length ? b : a));
  }
  function needleQty(row) {
    if (!row) return 0;
    const q = row.querySelector('.qty, [class*="qty"], [class*="amount"]');
    const t = (q && q.textContent) || row.textContent || '';
    const m = t.match(/x\s*([\d,]+)/i) || (q && t.match(/([\d,]+)/));
    return m ? Number(m[1].replace(/,/g, '')) || 1 : 1;
  }
  function findNeedleAction(row, verbRe) {
    const els = Array.from(row.querySelectorAll('a, button, [role="button"], li, span, i, div, input[type="button"]'));
    return els.find((el) => {
      if (el.getClientRects().length === 0) return false;
      const lab = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('data-action') || ''}`;
      const cls = typeof el.className === 'string' ? el.className : '';
      const txt = el.children.length ? '' : (el.textContent || '').trim();
      return verbRe.test(lab) || new RegExp(`(^|[\\s_-])option-${verbRe.source}`, 'i').test(cls) || (txt && new RegExp(`^${verbRe.source}$`, 'i').test(txt));
    }) || null;
  }
  // Torn's own Equip button for this needle (it sits in the row's folded
  // options, so it's found even while hidden).
  function needleEquipButton(row, item) {
    const all = Array.from(row.querySelectorAll('button.option-equip, [class*="option-equip"]'));
    return all.find((b) => new RegExp(`equip\\s+${item}`, 'i').test(b.getAttribute('aria-label') || '')) || all[0] || null;
  }
  async function tempQuickTap(n) {
    const doc = getTempItemsDoc();
    if (!doc) return;
    const row = findNeedleRow(doc, n.item);
    if (!row) { showToast(`No ${n.item} on this page \u2013 open the Temporary category, or you have none.`); return; }
    let btn = needleEquipButton(row, n.item);
    if (btn && btn.getClientRects().length === 0) {
      // Open the row's options first (Torn's own fold-out), then press Equip.
      const head = row.querySelector('.title-wrap, .ui-accordion-header');
      if (head) clickAny(head);
      for (let i = 0; i < 15 && btn.getClientRects().length === 0; i++) await sleep(100);
    }
    if (!btn) btn = findNeedleAction(row, /equip/i) || findNeedleAction(row, /use/i);
    try { row.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
    row.style.outline = '2px solid #4caf50';
    row.style.outlineOffset = '-2px';
    setTimeout(() => { row.style.outline = ''; }, 4000);
    if (!btn) {
      if ('Sandbox War Room'.indexOf('Sandbox') === 0) {
        try { GM_setClipboard(bagRowScan(row), 'text'); } catch (e) { /* ignore */ }
        showToast(`Couldn\u2019t find ${n.item}\u2019s Equip button. A layout scan was copied \u2013 paste it to Claude. ${n.item} is highlighted.`, { duration: 8000 });
      } else {
        showToast(`${n.item} is highlighted \u2013 tap its Equip button.`);
      }
      return;
    }
    clickAny(btn);
    showToast(`Pressed Equip on ${n.item} (${n.stat}). Confirm in Torn if it asks.`);
  }
  let tqLastSig = '';
  function tickTempQuick() {
    if (!popout || !pageFocused()) return;
    const bar = popout.root.querySelector('#tws-temp-quick');
    if (!bar) return;
    const doc = (popout.root.style.display === 'flex' && !popout.root.classList.contains('tws-po-min')) ? getTempItemsDoc() : null;
    if (!doc) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const counts = TEMP_NEEDLES.map((n) => { const r = findNeedleRow(doc, n.item); return r ? needleQty(r) : 0; });
    const sig = counts.join(',');
    if (sig === tqLastSig && bar.children.length) return;
    tqLastSig = sig;
    bar.innerHTML = TEMP_NEEDLES.map((n, i) => `<button class="tws-tq-btn ${counts[i] ? '' : 'tws-tq-none'}" data-tq="${i}" title="${n.item} \u2013 temporary ${n.stat.toLowerCase()} boost">${n.stat}<small>${n.item}${counts[i] ? ` \u00d7${counts[i]}` : ' \u2013 none'}</small></button>`).join('');
    bar.querySelectorAll('.tws-tq-btn').forEach((b) => b.addEventListener('click', () => tempQuickTap(TEMP_NEEDLES[Number(b.dataset.tq)])));
  }

  function tickPoLife() {
    if (!popout) return;
    const el = popout.root.querySelector('#tws-po-life');
    if (!el) return;
    const on = popout.root.style.display === 'flex' && !popout.root.classList.contains('tws-po-min') && !!getArmouryDoc();
    el.style.display = on ? 'flex' : 'none';
    if (on) refreshPoLife(false);
  }
  async function watchPoLifeAfterUse(before) {
    const start = Date.now();
    await sleep(400);
    while (Date.now() - start < 8000) {
      const life = await readPoLife();
      if (life) {
        poLifeLast = life; poLifeAt = Date.now(); paintPoLife(life);
        if (!before || life.cur !== before.cur) return life;
      }
      await sleep(700);
    }
    return null;
  }

  function runBestBag() {
    const mine = getCfg(STORE_KEYS.bloodType);
    if (!mine) {
      showToast('Set your blood type in ⚙ Settings first.');
      return;
    }
    const doc = getArmouryDoc();
    if (!doc) {
      showToast('Open the medical armoury first (🩸).');
      return;
    }
    const safe = BLOOD_COMPAT[mine] || [];
    const all = bloodRowsIn(doc);
    if (!all.length) {
      showToast("Couldn't read any blood bags on this page.");
      return;
    }
    const cands = all.filter((c) => safe.includes(c.type));
    if (!cands.length) {
      showToast(`No blood bag safe for ${mine} in stock right now.`);
      return;
    }
    cands.sort((x, y) =>
      ((x.type === mine ? 0 : 1) - (y.type === mine ? 0 : 1)) ||
      (BLOOD_UNIVERSALITY[x.type] - BLOOD_UNIVERSALITY[y.type]));
    const best = cands[0];
    try { best.row.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }

    removeBagConfirm();
    if (bagBusy) return;
    // Second tap: Torn's question is showing for this bag -> press its Yes.
    if (bagPending && bagPending.until > Date.now() && bagPending.yes.isConnected && bagPending.yes.getClientRects().length) {
      const p = bagPending;
      clearBagPending();
      bagBusy = true;
      (async () => {
        clickAny(p.yes);
        showToast(`\ud83e\ude78 Using Blood Bag : ${p.type}\u2026`);
        const after = await watchPoLifeAfterUse(p.beforeLife);
        if (after && p.beforeLife && after.cur !== p.beforeLife.cur) {
          showToast(`\ud83e\ude78 Blood Bag : ${p.type} used. Health ${p.beforeLife.cur.toLocaleString()} \u2192 ${after.cur.toLocaleString()} / ${after.max.toLocaleString()}`, { ok: true, duration: 7000 });
          try { showLifeAfterBag(p.beforeLife); } catch (e) { /* ignore */ }
        } else {
          const msg = bagTornMessage(p.row);
          showToast(msg ? `Torn: ${msg}` : `Pressed Yes on Blood Bag : ${p.type}, but your health hasn\u2019t changed yet.`, { warn: true, duration: 7000 });
        }
      })().finally(() => { bagBusy = false; });
      return;
    }
    clearBagPending();
    bagBusy = true;
    (async () => {
      if (!best.row.isConnected) {
        showToast('The list refreshed. Tap 🩸✓ again.');
        return;
      }
      if (!safe.includes(best.type)) return;
      best.row = bagItemRow(best.row);
      const link = await getBagUseLink(best.row, best.type);
      if (!link) {
        // Couldn't reach the Use button on its own -- leave the row's options
        // open and the row highlighted so it's one tap for you.
        if ('Sandbox War Room'.indexOf('Sandbox') === 0) {
          try { GM_setClipboard(bagRowScan(best.row), 'text'); } catch (e) { /* ignore */ }
          showToast(`Couldn\u2019t find the Use button for ${best.type}. A layout scan was copied \u2013 paste it to Claude.`, { duration: 8000 });
        } else {
          showToast(`Opened Blood Bag : ${best.type}. Tap its Use button (highlighted green).`);
        }
        return;
      }
      // Last safety check on the actual button being pressed: it must belong
      // to the chosen row, or be labelled with exactly this bag type.
      const label = link.getAttribute('aria-label') || '';
      let near = best.row.contains(link);
      for (let sib = best.row.nextElementSibling, i = 0; !near && sib && i < 2; i++, sib = sib.nextElementSibling) near = sib.contains(link);
      if ((label && parseBloodType(label)) ? parseBloodType(label) !== best.type : !near) {
        showToast('That Use button did not match the bag. Cancelled for safety.');
        return;
      }
      const beforeLife = (await readPoLife()) || poLifeLast || await lifeBeforeBag();
      clickAny(link);
      // Torn asks "Are you sure you want to use one of the faction's Blood
      // Bag : X items?" -- answer Yes for this exact bag.
      const yes = await findBagYes(best.row, best.type);
      if (!yes) {
        showToast(`Pressed Use on Blood Bag : ${best.type}. Tap Yes in Torn to finish.`);
        watchPoLifeAfterUse(beforeLife);
        return;
      }
      // Torn's rule: the confirm needs its own tap -- the button becomes it.
      setBagPending({ row: best.row, type: best.type, yes, beforeLife, until: Date.now() + 15000 });
      showToast(`Tap \u201cConfirm ${best.type}\u201d to use Blood Bag : ${best.type}.`);
    })().finally(() => { bagBusy = false; });
  }
  let bagPending = null;
  let bagPendingT = null;
  function setBagPending(p) {
    bagPending = p;
    if (popout && popout.bagEl) {
      popout.bagEl.textContent = `\u2714 Confirm ${p.type}`;
      popout.bagEl.classList.add('tws-po-bag-confirm');
      popout.bagEl.title = `Use Blood Bag : ${p.type}`;
    }
    clearTimeout(bagPendingT);
    bagPendingT = setTimeout(() => {
      if (bagPending === p) { clearBagPending(); showToast('Blood bag not used (not confirmed).'); }
    }, 15000);
  }
  function clearBagPending() {
    bagPending = null;
    clearTimeout(bagPendingT);
    if (popout && popout.bagEl) {
      popout.bagEl.textContent = '\ud83e\ude78\u2713';
      popout.bagEl.classList.remove('tws-po-bag-confirm');
      popout.bagEl.title = 'Pick a safe blood bag for me';
    }
  }
  let bagBusy = false;
  // Torn's own "Yes" for using this bag: in the bag's row or just under it,
  // next to a question naming this bag type.
  async function findBagYes(row, type) {
    for (let i = 0; i < 25; i++) {
      const scopes = [row];
      for (let sib = row.nextElementSibling, k = 0; sib && k < 3; k++, sib = sib.nextElementSibling) scopes.push(sib);
      for (const sc of scopes) {
        const yes = Array.from(sc.querySelectorAll('a, button, span, [role="button"]')).find((el) => {
          if (el.children.length || !/^\s*yes\s*$/i.test(el.textContent || '') || el.getClientRects().length === 0) return false;
          let box = el.parentElement;
          for (let up = 0; box && up < 4; up++, box = box.parentElement) {
            const t = box.textContent || '';
            if (/are you sure/i.test(t)) return !parseBloodType(t) || parseBloodType(t) === type;
          }
          return false;
        });
        if (yes) return yes;
      }
      await sleep(100);
    }
    return null;
  }
  // Any short message Torn put in or under the bag's row after Yes.
  function bagTornMessage(row) {
    const scopes = [row];
    for (let sib = row.nextElementSibling, k = 0; sib && k < 3; k++, sib = sib.nextElementSibling) scopes.push(sib);
    for (const sc of scopes) {
      const el = Array.from(sc.querySelectorAll('*')).find((x) => !x.children.length && x.getClientRects().length
        && /(cooldown|cannot|can't|must wait|not able|too many|already|full)/i.test(x.textContent || ''));
      if (el) return el.textContent.replace(/\s+/g, ' ').trim().slice(0, 140);
    }
    return '';
  }

  // ---------------------------------------------------------------------
  // ONE-TAP BLOOD BAG USE (header 🩸)
  // ---------------------------------------------------------------------
  // Tap 🩸 -> the best SAFE bag for your saved blood type is used, with no
  // confirmation from this script. It works on a hidden background copy of
  // the armoury page (kept loaded so there's nothing to wait for), falling
  // back to the visible armoury if you're already on it. If Torn itself shows
  // a "Yes" confirmation inside that bag's row, it is pressed too.
  let quickUseBusy = false;
  let bloodFrame = null; // { el, loadedAt }
  let bloodNeedsReload = false; // PC Mode: set when a use fails; the next idle moment reloads once

  function bloodPreloadWanted() {
    // PC Mode: pre-loaded once and kept (never reloaded on a timer).
    return (pcMode() || perfMode() === 'full') && featureOn('btnBlood') && featureOn('bloodQuickUse') && featureOn('bloodPreload') && !!getOwnFactionId() &&
      (getMedItem() !== 'blood' || !!getCfg(STORE_KEYS.bloodType));
  }

  function bloodFrameDoc() {
    try {
      return (bloodFrame && bloodFrame.el && bloodFrame.el.contentDocument) || null;
    } catch (e) {
      return null;
    }
  }

  function removeBloodFrame() {
    if (bloodFrame && bloodFrame.el) bloodFrame.el.remove();
    bloodFrame = null;
  }

  // Creates (or, with force, reloads) the hidden armoury. It's laid out wide
  // (1024px) on purpose: that gives Torn's wide armoury layout, whose
  // structure (ul.item-list, .show-option-icon, a.use[aria-label]) has been
  // scanned and is known. Invisible and non-interactive.
  function ensureBloodFrame(force) {
    return null; // Torn rules: no hidden armoury page
    if (bloodFrame && !force) return bloodFrame;
    removeBloodFrame();
    const el = document.createElement('iframe');
    el.id = 'tws-blood-frame';
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    el.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:900px;opacity:0;pointer-events:none;z-index:-1;border:0;';
    const frame = { el, loadedAt: 0 };
    bloodFrame = frame;
    el.addEventListener('load', () => {
      frame.loadedAt = Date.now();
      try {
        const d = el.contentDocument;
        if (d && d.body) {
          // Nothing in the hidden copy should draw, sound or chat.
          const st = d.createElement('style');
          st.textContent = '#chatRoot { display: none !important; }';
          (d.head || d.documentElement).appendChild(st);
        }
      } catch (e) { /* ignore */ }
    });
    el.src = BLOOD_URL;
    document.body.appendChild(el);
    return frame;
  }

  // Keep the hidden armoury in step with the toggles / blood type.
  function syncBloodFrame() {
    if (quickUseBusy) return;
    if (bloodPreloadWanted()) {
      if (!bloodFrame) ensureBloodFrame(false);
    } else if (bloodFrame && !(pcMode() && featureOn('bloodPreload'))) {
      removeBloodFrame();
    }
  }

  // Bag quantity from a row's text ("... x419"), if it shows one.
  function readBloodQty(row) {
    const m = (row.textContent || '').match(/x\s*([\d,]+)/i);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
  }

  // If Torn asks "are you sure?", press its Yes inside this bag's row (or a
  // confirm box). Returns true if something was pressed.

  // Best safe bag: your own exact type first, then the least universal.
  function chooseBestBag(rows, mine) {
    const safe = BLOOD_COMPAT[mine] || [];
    const cands = rows.filter((c) => safe.includes(c.type));
    if (!cands.length) return null;
    cands.sort((x, y) =>
      ((x.type === mine ? 0 : 1) - (y.type === mine ? 0 : 1)) ||
      (BLOOD_UNIVERSALITY[x.type] - BLOOD_UNIVERSALITY[y.type]));
    return cands[0];
  }

  // ---------------------------------------------------------------------
  // MEDICAL ITEM CHOICE (v1.82.4)
  // Header 🩸: a Blood Bag safe for your type, or "Med kit" = the smallest of
  // Small First Aid Kit (5%) / First Aid Kit (10%) / Morphine (15%) that gets
  // you to full health (Torn's base heal amounts). Faction armoury first,
  // then your own Items.
  // SAFETY RULES:
  //  - Empty Blood Bags and Ipecac Syrup are never touched.
  //  - A row is only used if it holds exactly ONE item.
  //  - On the Items page the item is opened first, and only a Use button
  //    INSIDE that item's own row is pressed -- never whatever is open.
  //  - A Torn confirmation is only accepted if it doesn't name a different
  //    item (or talk about withdrawing blood); otherwise it's cancelled.
  //  - If anything can't be matched safely, nothing is pressed: the Items
  //    page opens in the pop-out for you to tap yourself.
  // ---------------------------------------------------------------------
  const MED_HEAL = { 'Small First Aid Kit': 5, 'First Aid Kit': 10, Morphine: 15 };
  const MED_ITEMS = Object.keys(MED_HEAL);
  const MED_NAMES_LONGEST = MED_ITEMS.slice().sort((a, b) => b.length - a.length);
  const NEVER_USE_RE = /empty\s*blood\s*bag|ipecac/i;
  const WRONG_CONFIRM_RE = /empty\s*blood\s*bag|ipecac|withdraw/i;
  const ITEM_ANY_RE = /small\s*first\s*aid\s*kit|first\s*aid\s*kit|morphine|empty\s*blood\s*bag|blood\s*bag\s*:\s*(?:ab|a|b|o)\s*[+\-\u2212\u2013]|ipecac\s*syrup|ipecac/gi;
  const OWN_ITEMS_URL = 'https://www.torn.com/item.php#medical-items';

  function getMedItem() {
    return getCfg(STORE_KEYS.medItem, 'blood') === 'blood' ? 'blood' : 'medkit';
  }

  function medNameIn(text) {
    const t = String(text || '').toLowerCase();
    for (const n of MED_NAMES_LONGEST) if (t.includes(n.toLowerCase())) return n;
    return null;
  }

  function itemKey(str) {
    return String(str).toLowerCase().replace(/\s+/g, '').replace(/[\u2212\u2013]/g, '-');
  }

  // The distinct medical items a piece of text mentions.
  function itemKeysIn(text) {
    const set = new Set();
    (String(text || '').match(ITEM_ANY_RE) || []).forEach((m) => set.add(itemKey(m)));
    return set;
  }

  // Only rows that hold exactly one item, and never a banned one.
  function safeRows(rows) {
    return rows.filter(({ row }) => {
      let txt = row.textContent || '';
      row.querySelectorAll('[aria-label]').forEach((el) => { txt += ' ' + el.getAttribute('aria-label'); });
      return !NEVER_USE_RE.test(txt) && itemKeysIn(txt).size === 1;
    });
  }

  function itemRowsIn(doc, ident, scopeSel, selectors) {
    if (!doc || !doc.body) return [];
    const scope = (scopeSel && doc.querySelector(scopeSel)) || doc.body;
    const collect = (rows) => {
      const out = [];
      rows.forEach((row) => {
        let txt = row.textContent || '';
        if (txt.length > 800) return;
        row.querySelectorAll('[aria-label], img').forEach((el) => {
          txt += ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('alt') || '') + ' ' + (el.getAttribute('title') || '');
        });
        const v = ident(txt);
        if (v) out.push({ row, type: v });
      });
      return safeRows(out);
    };
    for (const sel of selectors) {
      const found = collect(Array.from(scope.querySelectorAll(sel)));
      if (found.length) return found;
    }
    return collect(Array.from(scope.querySelectorAll('li')).filter((li) => !li.querySelector('li')));
  }

  function classStr(el) {
    const c = el.className;
    return typeof c === 'string' ? c : (c && c.baseVal) || '';
  }

  // A visible Use control INSIDE this row (never one elsewhere on the page).
  function inRowUse(row) {
    return Array.from(row.querySelectorAll('a, button, span, li, div, i')).find((el) => {
      if (el.getClientRects().length === 0) return false;
      const lab = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`;
      const leafText = el.childElementCount === 0 ? (el.textContent || '') : '';
      return /^\s*use\s*$/i.test(leafText) || /(^|[\s.:])use(\s|$|\.)/i.test(lab) || /option-use|use-act|(^|\s)use(\s|$)/.test(classStr(el));
    }) || null;
  }

  // Armoury (med kits): the row's own Use link, opening its options if needed.
  async function armouryMedUse(row) {
    let a = inRowUse(row);
    if (a) return a;
    const gear = findRowGear(row);
    if (gear) {
      clickAny(gear);
      a = await waitFor(() => inRowUse(row), 1800, 100);
    }
    return a;
  }

  // Items page: open THIS item (tap its name), then take its own Use button.
  async function itemsPageUse(row, ident, want) {
    let btn = inRowUse(row);
    if (btn) return btn;
    const nameEl = Array.from(row.querySelectorAll('*')).find((el) =>
      el.childElementCount === 0 && ident(el.textContent || '') === want && el.getClientRects().length > 0) || row;
    clickAny(nameEl);
    btn = await waitFor(() => inRowUse(row), 2000, 100);
    return btn;
  }

  // Accept Torn's "are you sure?" only if it's about the item we chose.
  // Returns 'confirmed' | 'rejected' | 'none' (Torn didn't ask).
  async function safeConfirm(row, wantKey, useLink) {
    const doc = row.ownerDocument;
    const scope = row.closest('ul.item-list') || row;
    const isYes = (el) => el !== useLink && el.childElementCount === 0 &&
      /^\s*(yes|okay)\s*$/i.test(el.textContent || '') && el.getClientRects().length > 0;
    const find = () => Array.from(scope.querySelectorAll('a, button, span, div')).find(isYes) ||
      Array.from(doc.querySelectorAll('[class*="confirm"] a, [class*="confirm"] button, [class*="confirm"] span')).find(isYes) || null;
    const yes = await waitFor(find, 1500, 100);
    if (!yes) return 'none';
    let box = yes.parentElement;
    for (let n = 0; n < 4 && box && (box.textContent || '').trim().length < 30; n++) box = box.parentElement;
    const q = box ? (box.textContent || '') : '';
    medLog(`confirm button: ${medSnip(yes)}`);
    medLog(`confirm question: ${q.replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    const named = itemKeysIn(q);
    const wrong = WRONG_CONFIRM_RE.test(q) || (named.size > 0 && !(named.size === 1 && named.has(wantKey)));
    if (wrong) {
      const no = box && Array.from(box.querySelectorAll('a, button, span, div')).find((el) =>
        el.childElementCount === 0 && /^\s*(no|cancel)\s*$/i.test(el.textContent || ''));
      if (no) clickAny(no);
      return 'rejected';
    }
    clickAny(yes);
    return 'confirmed';
  }

  // Visible sentences in an area -- compared before/after a use to spot the
  // message Torn shows (e.g. a cooldown refusal).
  function visibleTexts(scope) {
    const out = new Set();
    if (!scope) return out;
    scope.querySelectorAll('*').forEach((el) => {
      if (el.getClientRects().length === 0) return;
      let own = '';
      el.childNodes.forEach((n) => { if (n.nodeType === 3) own += n.nodeValue; });
      own = own.replace(/\s+/g, ' ').trim();
      if (own.length >= 12) out.add(own);
    });
    return out;
  }

  // Step-by-step record of the last blood bag / med kit use (internal only).
  let medReport = [];
  function medLog(msg) {
    medReport.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
    if (medReport.length > 60) medReport.shift();
  }
  function medSnip(el) {
    return el ? String(el.outerHTML || '').replace(/\s+/g, ' ').slice(0, 300) : 'none';
  }

  // Hidden background copy of your own Items page (loaded only when needed).
  let itemsFrame = null;
  function itemsFrameDoc() {
    try { return (itemsFrame && itemsFrame.contentDocument) || null; } catch (e) { return null; }
  }
  function removeItemsFrame() {
    if (itemsFrame) itemsFrame.remove();
    itemsFrame = null;
  }

  function armouryLoaded(d) {
    return !!(d && d.body && d.location && /armoury/i.test(d.location.href) &&
      d.querySelector('#faction-armoury ul.item-list, #faction-armoury li'));
  }

  // PC Mode: the armoury opened by a blood tap stays for 10 minutes after the
  // last use (each use restarts the 10 minutes), then closes.
  const BLOOD_KEEP_MS = 10 * 60 * 1000;
  let bloodCloseTimer = null;
  function scheduleBloodClose(ms) {
    clearTimeout(bloodCloseTimer);
    bloodCloseTimer = setTimeout(() => {
      if (quickUseBusy) { scheduleBloodClose(30000); return; }
      removeBloodFrame();
    }, ms);
  }

  // Balanced/Lite: a background page closes after 5 minutes without use.
  const idleCloseTimers = {};
  function scheduleIdleClose(which) {
    clearTimeout(idleCloseTimers[which]);
    idleCloseTimers[which] = setTimeout(() => {
      if (perfMode() === 'full') return;
      if (which === 'armoury') { if (!quickUseBusy) removeBloodFrame(); } else if (!pushBusy) removePrefsFrame();
    }, PERF_IDLE_CLOSE_MS);
  }


  // ---------------------------------------------------------------------
  // BOUNTY FORM AUTO-FILL (inside the pop-out)
  // The bounty page's form isn't something this script controls, so its
  // boxes are FOUND by looking at every visible input / text area and
  // scoring it on what it says about itself (its name, id, placeholder,
  // label and nearby text). The AMOUNT box scores on amount / reward / money
  // wording, the REASON box on reason / message / note wording; each is
  // penalised for looking like one of the other boxes (target, quantity...).
  // Values are set the way a real edit would (native setter + input / keyup /
  // change events) so Torn's own form handling picks them up. If the amount
  // box can't be found in ten seconds, the amount is copied to the clipboard
  // instead.
  // ---------------------------------------------------------------------
  const BOUNTY_SKIP_TYPES = ['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'image', 'reset', 'range', 'color'];

  // What a form box says about itself. With `withWrap` it also includes the
  // start of the text around it (its row / group), which is a weaker hint.
  function describeInputForBounty(i, withWrap) {
    const parts = [i.name, i.id, i.className, i.placeholder, i.getAttribute('aria-label'), i.getAttribute('data-name')];
    try {
      if (i.labels && i.labels.length) parts.push(Array.from(i.labels).map((l) => l.textContent).join(' '));
    } catch (e) { /* ignore */ }
    const prev = i.previousElementSibling;
    if (prev) parts.push((prev.textContent || '').slice(0, 40));
    if (withWrap) {
      const wrap = i.closest('li, tr, .field, .form-group, div');
      if (wrap) parts.push((wrap.textContent || '').slice(0, 60));
    }
    return parts.filter(Boolean).join(' ');
  }

  function findBountyAmountInput(doc) {
    const inputs = Array.from(doc.querySelectorAll('input')).filter((i) =>
      !BOUNTY_SKIP_TYPES.includes(i.type) && !i.disabled && !i.readOnly && i.getClientRects().length > 0);
    let best = null;
    let bestScore = 0;
    inputs.forEach((i) => {
      const d = describeInputForBounty(i, true);
      let score = 0;
      if (/amount|reward|bounty|money|price|cash|\$/i.test(d)) score += 3;
      if (/input-money/i.test(i.className || '')) score += 3;
      if (i.type === 'number' || i.inputMode === 'numeric') score += 1;
      if (/reason|message|note|comment|target|user|player|name|search|quantity|qty|how many|times|\bid\b/i.test(d)) score -= 4;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    return best;
  }

  // The reason box: a text input or text area that talks about a reason /
  // message / note. `exclude` (the amount box, once found) is never chosen.
  function findBountyReasonInput(doc, exclude) {
    const els = Array.from(doc.querySelectorAll('input, textarea')).filter((i) =>
      !BOUNTY_SKIP_TYPES.includes(i.type) && !i.disabled && !i.readOnly && i.getClientRects().length > 0 && i !== exclude);
    let best = null;
    let bestScore = 0;
    els.forEach((i) => {
      const own = describeInputForBounty(i, false);
      const wide = describeInputForBounty(i, true);
      let score = 0;
      if (/reason|message|note|comment|why|description/i.test(own)) score += 4;
      else if (/reason|message|note|comment|why|description/i.test(wide)) score += 2;
      if (i.tagName === 'TEXTAREA') score += 1;
      if (/amount|money|reward|price|cash|quantity|qty|target|user|player|search|\bid\b|input-money/i.test(own)) score -= 4;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    return best;
  }

  function setFieldValue(el, value) {
    const win = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    try { el.focus(); } catch (e) { /* ignore */ }
    setter.call(el, value);
    ['input', 'keyup', 'change'].forEach((t) => {
      try { el.dispatchEvent(new win.Event(t, { bubbles: true })); } catch (e) { /* ignore */ }
    });
  }

  // Fills whichever of the amount / reason boxes were asked for as soon as
  // each one appears (so a box that can't be found never delays the other).
  async function fillBountyForm(p, token) {
    const wantAmount = Number(p.amount) > 0;
    const wantReason = !!p.reason;
    const nice = wantAmount ? Number(p.amount).toLocaleString() : '';
    let amountEl = null;
    let reasonEl = null;
    let amountDone = false;
    let reasonDone = false;

    const start = Date.now();
    while (Date.now() - start < 10000) {
      if (!popout || popout.fillToken !== token || popout.root.style.display === 'none') return; // superseded / closed
      try {
        const d = popout.frame.contentDocument;
        if (d && d.body) {
          if (wantAmount && !amountDone) {
            amountEl = findBountyAmountInput(d);
            if (amountEl) {
              setFieldValue(amountEl, String(p.amount));
              amountDone = true;
            }
          }
          if (wantReason && !reasonDone) {
            reasonEl = findBountyReasonInput(d, amountEl);
            if (reasonEl) {
              setFieldValue(reasonEl, p.reason);
              reasonDone = true;
            }
          }
        }
      } catch (e) { /* not readable yet */ }
      if ((!wantAmount || amountDone) && (!wantReason || reasonDone)) break;
      await sleep(250);
    }

    // Some pages reformat / reset a box a moment later -- check once more.
    await sleep(400);
    if (popout && popout.fillToken === token) {
      if (amountDone && amountEl.isConnected && amountEl.value.replace(/[^\d]/g, '') !== String(p.amount)) {
        setFieldValue(amountEl, String(p.amount));
      }
      if (reasonDone && reasonEl.isConnected && reasonEl.value !== p.reason) {
        setFieldValue(reasonEl, p.reason);
      }
    }

    const done = [];
    if (amountDone) done.push(`amount $${nice}`);
    if (reasonDone) done.push(`reason "${p.reason}"`);
    let msg = done.length ? `💰 Bounty form filled: ${done.join(', ')}` : '';
    if (wantAmount && !amountDone) {
      copyToClipboard(String(p.amount));
      msg += `${msg ? ' · ' : ''}couldn't find the amount box ($${nice} copied, paste it in)`;
    }
    if (wantReason && !reasonDone) {
      msg += `${msg ? ' · ' : ''}couldn't find the reason box`;
    }
    if (msg) showToast(msg);
  }

  // ---------------------------------------------------------------------
  // POP-OUT WINDOW
  // Profiles, attacks, bounties, the medical armoury and the temporary-items
  // page open in a floating window on top of the current page (an iframe --
  // same origin, so allowed) instead of navigating away. ✕ closes it and
  // you're right back where you were.
  // ---------------------------------------------------------------------
  let popout = null; // { root, frame, titleEl, msgEl, extEl, minEl, bagEl, currentUrl, pendingFill, fillToken }
  let fillCounter = 0;

  function buildPopout() {
    const root = document.createElement('div');
    root.id = 'tws-popout';
    root.innerHTML = `
      <div id="tws-po-bar">
        <span id="tws-po-title">Torn</span>
        <span>
          <span class="tws-po-btn" id="tws-po-bag" title="Pick a safe blood bag for me" style="display:none;">🩸✓</span>
          <span class="tws-po-btn" id="tws-po-reload" title="Reload">↻</span>
          <a class="tws-po-btn" id="tws-po-ext" target="_blank" title="Open as a full page">↗</a>
          <span class="tws-po-btn" id="tws-po-min" title="Minimise / restore">—</span>
          <span class="tws-po-btn" id="tws-po-close" title="Close">✕</span>
        </span>
      </div>
      <div id="tws-po-life" style="display:none;"><span class="tws-po-life-txt">\u2764 \u2013</span><span class="tws-po-life-bar"><span class="tws-po-life-fill"></span></span></div>
      <div id="tws-po-stats" style="display:none;"></div>
      <div id="tws-temp-quick" style="display:none;"></div>
      <div id="tws-po-msg" style="display:none;"></div>
      <iframe id="tws-po-frame"></iframe>
      <iframe id="tws-po-temp" class="tws-po-pre" style="display:none;"></iframe>
      <iframe id="tws-po-travel" class="tws-po-pre" style="display:none;"></iframe>
    `;
    document.body.appendChild(root);
    popout = {
      root,
      frame: root.querySelector('#tws-po-frame'),
      mainFrame: root.querySelector('#tws-po-frame'),
      preFrames: { [ITEMS_URL]: root.querySelector('#tws-po-temp'), [TRAVEL_AGENT_URL]: root.querySelector('#tws-po-travel') },
      titleEl: root.querySelector('#tws-po-title'),
      msgEl: root.querySelector('#tws-po-msg'),
      extEl: root.querySelector('#tws-po-ext'),
      minEl: root.querySelector('#tws-po-min'),
      bagEl: root.querySelector('#tws-po-bag'),
      currentUrl: '',
      pendingFill: null,
      fillToken: 0,
    };

    const stop = (e) => e.stopPropagation();
    root.addEventListener('click', stop);

    root.querySelector('#tws-po-close').addEventListener('click', () => {
      removeBagConfirm();
      closePopout();
    });
    root.querySelector('#tws-po-reload').addEventListener('click', () => {
      try {
        popout.frame.contentWindow.location.reload();
      } catch (e) {
        if (popout.currentUrl) popout.frame.src = popout.currentUrl;
      }
    });
    popout.bagEl.addEventListener('click', () => runBestBag());
    const toggleMin = () => {
      const min = popout.root.classList.toggle('tws-po-min');
      popout.minEl.textContent = min ? '▢' : '—';
    };
    popout.minEl.addEventListener('click', toggleMin);
    popout.titleEl.addEventListener('click', () => {
      if (popout.root.classList.contains('tws-po-min')) toggleMin();
    });

    popout.frame.addEventListener('load', () => {
      if (!popout.currentUrl) return; // the blank frame from build/close
      if (popout.mainFrame && popout.frame !== popout.mainFrame) return; // a pre-loaded page is showing
      let ok = false;
      try {
        const d = popout.frame.contentDocument;
        ok = !!(d && d.body && d.location && d.location.href !== 'about:blank');
        if (ok) {
          // Hide the page's own copy of the Torn chat widget inside the
          // pop-out -- the real one is still on the main page.
          const st = d.createElement('style');
          st.textContent = '#chatRoot { display: none !important; }';
          (d.head || d.documentElement).appendChild(st);
          popout.extEl.href = d.location.href;
        }
      } catch (e) {
        ok = false;
      }
      if (ok) {
        popout.msgEl.style.display = 'none';
        popout.frame.style.display = 'block';
        // A bounty amount / reason waiting to be filled in (see fillBountyForm).
        if (popout.pendingFill) {
          const p = popout.pendingFill;
          popout.pendingFill = null;
          const token = ++fillCounter;
          popout.fillToken = token;
          fillBountyForm(p, token);
        }
      } else {
        popout.frame.style.display = 'none';
        popout.msgEl.style.display = 'block';
        popout.msgEl.innerHTML = `This page can't be shown in a pop-out here. <a href="${popout.currentUrl}" target="_blank" style="color:#6ab0de;">Open it as a full page ↗</a> — or turn pop-outs off in ⚙ Settings → Advanced.`;
      }
    });
  }

  // opts.fillBounty = { amount, reason }: values to type into the bounty
  // page's form once it has loaded.
  // Pages kept loaded (hidden) inside the pop-out so their buttons open them
  // instantly. Loaded once; never reloaded on a timer.
  let preloadReady = false;
  function preFrameOn(url) {
    if (!pcMode()) return false; // pre-loaded pages are a PC Mode feature
    if (url === ITEMS_URL) return featureOn('btnItems') && featureOn('popoutItems') && featureOn('tempPreload');
    if (url === TRAVEL_AGENT_URL) return featureOn('btnTravel') && popoutsEnabled();
    return false;
  }
  function preFrameFor(url) {
    return (popout && popout.preFrames && preFrameOn(url)) ? (popout.preFrames[url] || null) : null;
  }
  function preloadFrames() {
    [ITEMS_URL, TRAVEL_AGENT_URL].forEach((u) => {
      const on = preFrameOn(u);
      if (!on && !popout) return;
      if (!popout) buildPopout();
      const f = popout.preFrames[u];
      if (!f) return;
      if (!on) {
        // Switched off: unload it (unless it's on screen right now).
        if (f.dataset.loaded === '1' && popout.frame !== f) { f.dataset.loaded = ''; f.setAttribute('src', 'about:blank'); }
        return;
      }
      if (f.dataset.loaded === '1') return;
      f.dataset.loaded = '1';
      if (!f.dataset.quiet) {
        f.dataset.quiet = '1';
        f.addEventListener('load', () => {
          try {
            const d = f.contentDocument;
            if (d && d.body && !d.getElementById('tws-pre-quiet')) {
              const st = d.createElement('style');
              st.id = 'tws-pre-quiet';
              st.textContent = '#chatRoot { display: none !important; }';
              (d.head || d.documentElement).appendChild(st);
            }
          } catch (e) { /* ignore */ }
        });
      }
      f.setAttribute('src', u);
    });
  }

  function openPopout(url, title, opts) {
    if (!popout) buildPopout();
    const pre = preFrameFor(url);
    const showing = pre || popout.mainFrame;
    [popout.mainFrame].concat(Object.keys(popout.preFrames).map((k) => popout.preFrames[k])).forEach((f) => {
      if (f && f !== showing) f.style.display = 'none';
    });
    if (pre && popout.mainFrame.src && popout.mainFrame.src !== 'about:blank') popout.mainFrame.src = 'about:blank';
    popout.frame = showing;
    popout.root.classList.remove('tws-po-min');
    popout.minEl.textContent = '—';
    popout.titleEl.textContent = title || 'Torn';
    popout.msgEl.style.display = 'none';
    popout.frame.style.display = 'block';
    popout.currentUrl = url;
    popout.extEl.href = url;
    popout.fillToken = 0; // cancels any earlier fill still waiting
    popout.pendingFill = (opts && opts.fillBounty) ? opts.fillBounty : null;
    if (popout.root.style.display !== 'flex') popout.userSized = false;
    popout.root.style.display = 'flex';
    if (pcMode()) ensurePopoutHandles();
    matchPopoutToPanel(); // same size as the panel, below its header
    if (!pre || pre.dataset.loaded !== '1') {
      if (pre) pre.dataset.loaded = '1';
      try { kiArmPopoutFrame(popout.frame, url); } catch (e) { /* ignore */ }
      popout.frame.setAttribute('src', url);
    }
  }

  function closePopout() {
    if (!popout) return;
    popout.currentUrl = '';
    popout.fillToken = 0;
    popout.pendingFill = null;
    if (popout.frame === popout.mainFrame) popout.frame.src = 'about:blank';
    popout.root.style.display = 'none';
    popout.frame = popout.mainFrame; // pre-loaded pages stay loaded
  }

  // Country flags for the status / hospital-timer column. Torn's status
  // descriptions name the country in free text -- as a country ("In Mexico",
  // "Traveling to Canada") for travellers, or as a demonym for overseas
  // hospitals ("In a Mexican hospital for 1 hour") -- there's no separate
  // structured country field, so both spellings are matched here.
  const COUNTRY_KEYWORDS = [
    [/mexic/i, '🇲🇽'],
    [/cayman/i, '🇰🇾'],
    [/canad/i, '🇨🇦'],
    [/hawai/i, '🇺🇸'],
    [/united kingdom|british|\bUK\b|england|english/i, '🇬🇧'],
    [/argentin/i, '🇦🇷'],
    [/switzerland|swiss/i, '🇨🇭'],
    [/japan/i, '🇯🇵'],
    [/china|chinese/i, '🇨🇳'],
    [/\bUAE\b|emirat|dubai/i, '🇦🇪'],
    [/south africa/i, '🇿🇦'],
  ];

  function parseCountryFlag(description) {
    if (!description) return '';
    // Torn's own description text distinguishes an inbound return trip
    // ("...to Torn from Mexico") from an outbound one ("Traveling to
    // Mexico") -- heading home gets its own badge rather than the origin
    // country's flag, since "coming home" is the notable part.
    if (/to Torn\b/i.test(description)) {
      return '<span class="tws-torn-flag">T</span>';
    }
    for (const [re, flag] of COUNTRY_KEYWORDS) {
      if (re.test(description)) return flag;
    }
    return '';
  }

  // ---------------------------------------------------------------------
  // ESTIMATED TRAVEL TIMERS (v1.81.0)
  // Torn doesn't reveal another player's travel method or landing time, so:
  //  1. Take-offs are caught when someone's status flips to Traveling --
  //     by this script's own roster polling (about 20s precision) and, for
  //     the enemy during wars, by the Kraken server (about 1 min precision,
  //     works even when nobody has the panel open).
  //  2. Landing = take-off + the destination's flight time. Airstrip is
  //     assumed, unless the player's method has been learned: when someone
  //     lands, the real flight time shows which method they used, and that's
  //     remembered per player.
  //  Tapping a travel timer shows the estimate for every method.
  // ---------------------------------------------------------------------
  const TRAVEL_URL = 'https://dashing-fish-54.eu-west-1.convex.site/travel';
  // One-way flight minutes: standard, airstrip, private (WLT), business.
  const TRAVEL_MIN = {
    mexico: [24, 17, 12, 7],
    cayman: [33, 23, 17, 10],
    canada: [39, 27, 19, 12],
    hawaii: [127, 89, 63, 38],
    uk: [151, 106, 75, 45],
    argentina: [158, 111, 79, 47],
    switzerland: [166, 116, 83, 50],
    japan: [213, 149, 107, 64],
    china: [229, 160, 114, 69],
    uae: [257, 180, 128, 77],
    southafrica: [282, 197, 141, 85],
  };
  const TRAVEL_METHODS = [['standard', 'Standard'], ['airstrip', 'Airstrip'], ['wlt', 'Private (WLT)'], ['business', 'Business class']];
  const TRAVEL_DEST = [
    [/mexic/i, 'mexico', 'Mexico'],
    [/cayman/i, 'cayman', 'Cayman Islands'],
    [/canad/i, 'canada', 'Canada'],
    [/hawai/i, 'hawaii', 'Hawaii'],
    [/united kingdom|british|\bUK\b|england|english/i, 'uk', 'UK'],
    [/argentin/i, 'argentina', 'Argentina'],
    [/switzerland|swiss/i, 'switzerland', 'Switzerland'],
    [/japan/i, 'japan', 'Japan'],
    [/china|chinese/i, 'china', 'China'],
    [/\bUAE\b|emirat|dubai/i, 'uae', 'UAE'],
    [/south africa/i, 'southafrica', 'South Africa'],
  ];
  const TRAVEL_LOCAL_KEY = 'tws_travel_local';
  const TRAVEL_GAP_MS = 5 * 60 * 1000;     // a take-off/landing window wider than this is useless
  const TRAVEL_SERVER_MS = 60 * 1000;      // ask the server at most once a minute
  let travelLocal = {};   // id -> { state, desc, seenAt, dest?, depLo?, depHi?, method? }
  let travelLocalSavedAt = 0;
  let travelServer = {};  // id -> { dest, depLo, depHi, method } (enemy faction, from the server)
  let travelServerFaction = null;
  let travelServerAt = 0;
  let travelServerBusy = false;
  let travelPopId = null;
  try {
    const raw = JSON.parse(getCfg(TRAVEL_LOCAL_KEY, '{}')) || {};
    const nowMs = Date.now();
    Object.keys(raw).forEach((id) => {
      const r = raw[id];
      if (!r || !r.seenAt) return;
      const age = nowMs - r.seenAt;
      if (age < 3 * 86400000) travelLocal[id] = r;
      else if (r.method && age < 30 * 86400000) travelLocal[id] = { method: r.method, seenAt: r.seenAt };
    });
  } catch (e) {
    travelLocal = {};
  }

  function saveTravelLocal() {
    const nowMs = Date.now();
    if (nowMs - travelLocalSavedAt < 15000) return;
    travelLocalSavedAt = nowMs;
    try { setCfg(TRAVEL_LOCAL_KEY, JSON.stringify(travelLocal)); } catch (e) { /* in-memory still works */ }
  }

  function travelDestOf(desc) {
    for (const [re, key, name] of TRAVEL_DEST) {
      if (re.test(desc || '')) return { key, name };
    }
    return null;
  }

  // Flight length in ms for a method ("airstrip", or "airstrip+book" for the
  // Mailing Yourself Abroad book, which takes another 25% off).
  function travelMethodMs(dest, method) {
    const t = TRAVEL_MIN[dest];
    if (!t || !method) return null;
    const [base, book] = String(method).split('+');
    const i = TRAVEL_METHODS.findIndex((x) => x[0] === base);
    if (i < 0) return null;
    return t[i] * 60000 * (book ? 0.75 : 1);
  }

  function travelMethodLabel(method) {
    const [base, book] = String(method).split('+');
    const f = TRAVEL_METHODS.find((x) => x[0] === base);
    return (f ? f[1] : base) + (book ? ' + book' : '');
  }

  function travelMatchMethod(dest, loMs, hiMs) {
    const t = TRAVEL_MIN[dest];
    if (!t) return null;
    const hits = [];
    TRAVEL_METHODS.forEach(([m], i) => {
      [1, 0.75].forEach((f) => {
        const ms = t[i] * f * 60000;
        if (ms >= loMs - 60000 && ms <= hiMs + 60000) hits.push(f === 1 ? m : `${m}+book`);
      });
    });
    return hits.length === 1 ? hits[0] : null;
  }

  // Called with every freshly-fetched roster (enemy and home).
  function trackTravel(members) {
    if (!featureOn('travelTimers')) return;
    const nowMs = Date.now();
    members.forEach((m) => {
      const id = String(m.id);
      const r = travelLocal[id];
      if (!r || !r.state) {
        travelLocal[id] = { state: m.state, desc: m.description, seenAt: nowMs, method: r ? r.method : undefined };
        return;
      }
      const gap = nowMs - r.seenAt;
      const nowT = m.state === 'Traveling';
      const wasT = r.state === 'Traveling';
      if (nowT && (!wasT || r.desc !== m.description)) {
        const d = travelDestOf(m.description);
        if (d && gap <= TRAVEL_GAP_MS) {
          r.dest = d.key;
          r.depLo = r.seenAt;
          r.depHi = nowMs;
        } else {
          delete r.dest; delete r.depLo; delete r.depHi;
        }
      } else if (!nowT && wasT) {
        if (r.dest && r.depLo && r.depHi && gap <= TRAVEL_GAP_MS) {
          const meth = travelMatchMethod(r.dest, r.seenAt - r.depHi, nowMs - r.depLo);
          if (meth) r.method = meth;
        }
        delete r.dest; delete r.depLo; delete r.depHi;
      }
      r.state = m.state;
      r.desc = m.description;
      r.seenAt = nowMs;
    });
    saveTravelLocal();
  }

  // Asks the Kraken server to watch the enemy faction, and picks up what it
  // has seen (take-offs and learned methods). At most once a minute.
  async function refreshTravelServer(factionId) {
    if (!featureOn('travelTimers') || !featureOn('travelShared') || !factionId) return;
    if (travelServerBusy) return;
    if (String(factionId) === travelServerFaction && Date.now() - travelServerAt < TRAVEL_SERVER_MS) return;
    travelServerBusy = true;
    try {
      const me = await accessMyId();
      if (!me) return;
      const d = await serverGet(`${TRAVEL_URL}?faction=${encodeURIComponent(factionId)}&me=${encodeURIComponent(me)}`);
      if (String(factionId) !== travelServerFaction) travelServer = {};
      if (d && d.players) travelServer = d.players;
    } catch (e) {
      // keep what we had -- the local tracking still works
    } finally {
      travelServerFaction = String(factionId);
      travelServerAt = Date.now();
      travelServerBusy = false;
    }
  }

  // Activity history from the Kraken server: per TCT hour, how likely each
  // enemy member is to be online. Paid server feature; refreshed every 5 min.
  const ACTIVITY_URL = 'https://dashing-fish-54.eu-west-1.convex.site/activity';
  const ACTIVITY_MS = 5 * 60 * 1000;
  let activity = {};
  let activityFaction = '';
  let activityAt = 0;
  let activityBusy = false;
  async function refreshActivity(factionId) {
    if (!featureOn('activityHistory') || !factionId || activityBusy) return;
    if (String(factionId) === activityFaction && Date.now() - activityAt < ACTIVITY_MS) return;
    activityBusy = true;
    try {
      const me = await accessMyId();
      if (!me) return;
      const d = await serverGet(`${ACTIVITY_URL}?faction=${encodeURIComponent(factionId)}&me=${encodeURIComponent(me)}`);
      if (String(factionId) !== activityFaction) activity = {};
      if (d && d.players) activity = d.players;
    } catch (e) {
      // keep what we had
    } finally {
      activityFaction = String(factionId);
      activityAt = Date.now();
      activityBusy = false;
    }
  }
  // Expected number of enemies online for each TCT hour, and the quietest
  // 3-hour window. Needs a few days of history before it says anything.
  function activityStripHtml(members) {
    if (!featureOn('activityHistory') || !members || !members.length) return '';
    const exp = new Array(24).fill(0);
    let covered = 0;
    members.forEach((m) => {
      const a = activity[String(m.id)];
      const p = a && a.p;
      if (!Array.isArray(p)) return;
      if (p.filter((x) => x >= 0).length < 18) return; // not enough hours known yet
      covered++;
      p.forEach((x, h) => { exp[h] += Math.max(0, x); });
    });
    if (covered < Math.max(3, Math.ceil(members.length * 0.5))) {
      return '<div style="color:#888;font-size:11px;margin:4px 0 6px;text-align:center;">\ud83d\udcca Activity history is still learning this faction\u2019s hours (readings since the match was drawn)\u2026</div>';
    }
    const scale = members.length / covered;
    let best = 0;
    let bestSum = Infinity;
    for (let h = 0; h < 24; h++) {
      const sum = exp[h] + exp[(h + 1) % 24] + exp[(h + 2) % 24];
      if (sum < bestSum) { bestSum = sum; best = h; }
    }
    const nowH = new Date().getUTCHours();
    const pad = (h) => String(h % 24).padStart(2, '0');
    return `<div style="color:#bbb;font-size:11px;margin:4px 0 6px;text-align:center;">\ud83d\udcca Usually online now: <b>~${Math.round(exp[nowH] * scale)}</b> of ${members.length} \u00b7 Quietest: <b>${pad(best)}:00\u2013${pad(best + 3)}:00 TCT</b> (~${Math.round((bestSum / 3) * scale)} on)<div style="color:#888;font-size:10px;margin-top:1px;">From readings taken since the match was drawn</div></div>`;
  }

  // ---------------------------------------------------------------------
  // 📈 STAT CARDS (starred targets, Target tab only)
  // Tap 📈 on a starred target in the Target tab: the player's last 5 ranked wars (war hits and
  // hours played in each) and what they've taken since the upcoming war was
  // drawn. All lookups use YOUR OWN key, only when a card is opened, and the
  // result is kept on this device for 6 hours.
  // Torn saves these stats once a day, so figures are per day, not per hour.
  // ---------------------------------------------------------------------
  const SC_CACHE_KEY = 'tws_statcards_v2';
  const SC_DRAW_KEY = 'tws_war_draws_v1';
  const SC_TTL_MS = 6 * 3600 * 1000;
  const SC_STATS = 'rankedwarhits,timeplayed,xantaken,refills,victaken,overdosed,energydrinkused,defendswon,defendslost';
  const DAY = 86400;
  let scChain = Promise.resolve();
  const scPending = {};

  // Remember when War Room first saw each matched war (= roughly the draw).
  function scNoteDraw(enemyId, startTime) {
    if (!enemyId || !startTime) return;
    try {
      const m = JSON.parse(getCfg(SC_DRAW_KEY, '{}')) || {};
      const k = String(startTime);
      if (!m[k]) {
        m[k] = Math.floor(Date.now() / 1000);
        // keep it small: drop entries for wars that started over 60 days ago
        Object.keys(m).forEach((s) => { if (Number(s) < Date.now() / 1000 - 60 * DAY) delete m[s]; });
        setCfg(SC_DRAW_KEY, JSON.stringify(m));
      }
    } catch (e) { /* ignore */ }
  }
  // Shared draw date from the Kraken server: the first time ANY War Room user saw
  // this war, so every copy agrees. Our own note is sent along (earliest wins).
  const DRAW_URL = 'https://dashing-fish-54.eu-west-1.convex.site/draw';
  const scDrawSent = {};
  async function scServerDraw(a, b, startTime) {
    if (!a || !startTime) return 0;
    try {
      const me = await accessMyId();
      if (!me) return 0;
      let local = 0;
      try { local = (JSON.parse(getCfg(SC_DRAW_KEY, '{}')) || {})[String(startTime)] || 0; } catch (e) { /* ignore */ }
      const d = await serverGet(`${DRAW_URL}?me=${encodeURIComponent(me)}&a=${a}${b ? `&b=${b}` : ''}&start=${startTime}${local ? `&seen=${local}` : ''}`);
      const fs = d && Number(d.firstSeen);
      if (fs > 0) {
        const m = JSON.parse(getCfg(SC_DRAW_KEY, '{}')) || {};
        if (!m[String(startTime)] || fs < m[String(startTime)]) { m[String(startTime)] = fs; setCfg(SC_DRAW_KEY, JSON.stringify(m)); }
        return fs;
      }
    } catch (e) { /* keep the local note */ }
    return 0;
  }
  function scDrawFor(startTime) {
    try {
      const m = JSON.parse(getCfg(SC_DRAW_KEY, '{}')) || {};
      if (m[String(startTime)]) return { at: Math.min(m[String(startTime)], startTime), exact: true };
    } catch (e) { /* ignore */ }
    return { at: startTime - 7 * DAY, exact: false };
  }

  const scPause = (ms) => new Promise((r) => setTimeout(r, ms));

  // Players whose last card build hit Torn\u2019s rate limit (error 5). Next time
  // their card is opened, we pace every call slowly from the start so it doesn\u2019t
  // trip again. A clean build clears the flag.
  const SC_SLOW_KEY = 'tws_statcard_slow_v1';
  function scSlowSet() { try { return new Set(JSON.parse(getCfg(SC_SLOW_KEY, '[]')) || []); } catch (e) { return new Set(); } }
  function scIsSlow(id) { return scSlowSet().has(String(id)); }
  function scMarkSlow(id, on) {
    const set = scSlowSet();
    if (on) set.add(String(id)); else set.delete(String(id));
    try { setCfg(SC_SLOW_KEY, JSON.stringify(Array.from(set))); } catch (e) { /* in-memory is fine */ }
  }
  // Pace between calls for the current build: normal, or slow after a past rate-limit.
  let scGap = 250;
  const SC_SLOW_GAP = 1200;
  // Did THIS build get rate-limited at any point?
  let scHitLimit = false;

  // One API call, with automatic retry when Torn says "too many requests" (code 5).
  function scApiOnce(path) {
    const key = getApiKey();
    if (!key) return Promise.reject(new Error('No API key set'));
    if (scGen !== scRunGen) return Promise.reject(new Error('Card build cancelled'));
    const sep = path.includes('?') ? '&' : '?';
    scCalls++;
    scProgress();
    // Torn PDA can leave a request hanging forever; give up on it after 15s.
    return Promise.race([
      httpGetJson(`https://api.torn.com/v2/${path}${sep}key=${encodeURIComponent(key)}&comment=sandboxwar-card`),
      scPause(15000).then(() => ({ __timeout: true })),
    ]);
  }
  // Live progress on the loading screen, so you can see it moving.
  let scCalls = 0;
  let scGen = 0;
  let scRunGen = 0;
  let scBuildingId = null;
  function scProgress() {
    const el = document.querySelector('#tws-statcard .tws-sc-prog');
    const box = document.getElementById('tws-statcard');
    if (el && box && box.dataset.id === String(scBuildingId)) el.textContent = `Lookup ${scCalls} of about 20\u2026`;
  }
  async function scApi(path) {
    let waited = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      const d = await scApiOnce(path);
      if (d && d.__timeout) { // no answer in 15s: try that call again
        await scPause(1000);
        continue;
      }
      if (d && d.error) {
        const code = Number(d.error.code);
        if (code === 16) throw new Error('Your API key doesn\u2019t allow this. Use a Limited key, or add User → personalstats and Faction → rankedwars to your Custom key.');
        if (code === 5) { // too many requests: back off and retry this same call
          scHitLimit = true;
          const back = 3000 + attempt * 2000; // 3s, 5s, 7s, 9s
          waited += back;
          await scPause(back);
          continue;
        }
        throw new Error(`Torn API error ${d.error.code}: ${d.error.error}`);
      }
      return d;
    }
    throw new Error('Torn isn\u2019t answering right now (busy or rate-limited). Wait a minute and tap Refresh.');
  }
  async function scStatsAt(id, ts) {
    const d = await scApi(`user/${id}/personalstats?stat=${SC_STATS}${ts ? `&timestamp=${ts}` : ''}`);
    const o = {};
    (d.personalstats || []).forEach((s) => { o[s.name] = Number(s.value) || 0; o[`${s.name}At`] = Number(s.timestamp) || 0; });
    await scPause(scGap); // gentle on the user\u2019s API limit; wider if this player was slow before
    return o;
  }
  const scDiff = (a, b, k) => Math.max(0, (b[k] || 0) - (a[k] || 0));
  const dayStart = (ts) => ts - (ts % DAY);

  async function scBuild(id) {
    const prof = await scApi(`user/${id}/profile`);
    const p = prof.profile || {};
    const fid = Number((p.faction_id) || (p.faction && p.faction.id) || 0) || 0;
    const card = {
      id: String(id), name: p.name || '', level: p.level || 0,
      factionId: fid, factionName: (p.faction && p.faction.name) || '',
      builtAt: Date.now(), upcoming: null, wars: [], lastWarHitAt: 0,
    };
    if (!fid) return card;
    const wr = await scApi(`faction/${fid}/rankedwars?limit=7`);
    const list = (wr.rankedwars || []).filter((w) => w && w.start);
    if (!card.factionName) {
      const me = list.map((w) => (w.factions || []).find((x) => Number(x.id) === fid)).find(Boolean);
      if (me && me.name) card.factionName = me.name;
    }
    const now = Math.floor(Date.now() / 1000);
    const current = list.find((w) => !w.end);
    const past = list.filter((w) => w.end && w.end <= now).sort((a, b) => b.start - a.start).slice(0, 5);
    const nowStats = await scStatsAt(id, 0);
    card.lastWarHitAt = (nowStats.rankedwarhitsAt || 0) * 1000;
    // Torn only records the DAY these last changed (and updates once a day).
    card.odCount = nowStats.overdosed || 0;
    card.lastOdAt = nowStats.overdosed ? (nowStats.overdosedAt || 0) * 1000 : 0;
    card.vicCount = nowStats.victaken || 0;
    card.lastVicAt = nowStats.victaken ? (nowStats.victakenAt || 0) * 1000 : 0;
    const vs = (w) => ((w.factions || []).find((f) => Number(f.id) !== fid) || {}).name || 'Unknown';

    if (current) {
      const ids = (current.factions || []).map((x) => Number(x.id)).filter(Boolean);
      if (ids.length === 2) await scServerDraw(ids[0], ids[1], current.start);
      const draw = scDrawFor(current.start);
      // A daily record stamped day D holds the totals at the END of D (checked
      // against a real Xanax log), so the starting point is the record of the day BEFORE the draw.
      const before = await scStatsAt(id, dayStart(draw.at) - 1);
      // Their normal Xanax rate: the 28 days before the draw.
      const base = await scStatsAt(id, dayStart(draw.at) - 28 * DAY - 1);
      // Torn's newest daily record for this player (other players' stats are only published once a day).
      const latest = Math.max(0, ...Object.keys(nowStats).filter((k) => k.endsWith('At')).map((k) => nowStats[k] || 0));
      const sinceDays = Math.max(1, ((latest ? latest + DAY : now) - dayStart(draw.at)) / DAY);
      const normalPerDay = scDiff(base, before, 'xantaken') / 28;
      card.upcoming = {
        vs: vs(current), start: current.start * 1000, started: current.start <= now,
        drawAt: draw.at * 1000, drawExact: draw.exact,
        xan: scDiff(before, nowStats, 'xantaken'),
        refills: scDiff(before, nowStats, 'refills'),
        vic: scDiff(before, nowStats, 'victaken'),
        energy: scDiff(before, nowStats, 'energydrinkused'),
        hits: current.start <= now ? scDiff(before, nowStats, 'rankedwarhits') : 0,
        hours: scDiff(before, nowStats, 'timeplayed') / 3600,
        days: sinceDays,
        asOf: latest * 1000,
        normalXan: normalPerDay * sinceDays, // what they'd usually take in the same time
      };
    }
    for (const w of past) {
      const a = await scStatsAt(id, dayStart(w.start) - 1);
      const b = await scStatsAt(id, dayStart(w.end) + DAY - 1);
      const warId = w.id || w.war_id || 0;
      const rep = warId ? await scWarReport(warId, fid, id) : null;
      card.wars.push({
        vs: vs(w), start: w.start * 1000, end: w.end * 1000,
        hits: rep && rep.hits != null ? rep.hits : scDiff(a, b, 'rankedwarhits'),
        respect: rep ? rep.respect : null,
        factionScore: rep ? rep.factionScore : null,
        won: warWonBy(w, fid),
        hours: scDiff(a, b, 'timeplayed') / 3600,
        xan: scDiff(a, b, 'xantaken'), refills: scDiff(a, b, 'refills'), vic: scDiff(a, b, 'victaken'),
        energy: scDiff(a, b, 'energydrinkused'),
        defWon: scDiff(a, b, 'defendswon'), defLost: scDiff(a, b, 'defendslost'),
      });
    }
    return card;
  }

  // Torn's official per-war report: this member's exact hits + war respect, and
  // their faction's total score for that war. One report covers the whole
  // faction, so it's cached per war for the session.
  const scReportCache = {};
  async function scWarReport(warId, fid, memberId) {
    try {
      if (!scReportCache[warId]) {
        const d = await scApi(`torn/${warId}?selections=rankedwarreport`);
        scReportCache[warId] = (d && d.rankedwarreport) || null;
        await scPause(scGap);
      }
      const rep = scReportCache[warId];
      if (!rep || !rep.factions) return null;
      const fac = rep.factions[String(fid)];
      if (!fac) return null;
      const mem = fac.members && fac.members[String(memberId)];
      return {
        hits: mem ? Number(mem.attacks) || 0 : null,
        respect: mem ? Math.round(Number(mem.score) || 0) : null,
        factionScore: Math.round(Number(fac.score) || 0),
      };
    } catch (e) { return null; }
  }
  // true = their faction won this war, false = lost, null = unknown.
  function warWonBy(w, fid) {
    if (w.winner == null) return null;
    return Number(w.winner) === Number(fid);
  }

  function scLoadCache() {
    try { return JSON.parse(getCfg(SC_CACHE_KEY, '{}')) || {}; } catch (e) { return {}; }
  }
  async function scGet(id, force) {
    const cache = scLoadCache();
    const c = cache[String(id)];
    if (!force && c && Date.now() - c.builtAt < SC_TTL_MS) return c;
    // Slow mode: if this player's last build hit Torn's rate limit, space every
    // call out (about 1.2s apart) so it doesn't trip again.
    scHitLimit = false;
    scGap = scIsSlow(id) ? SC_SLOW_GAP : 250;
    scCalls = 0;
    scBuildingId = String(id);
    scRunGen = ++scGen;
    let card;
    try {
      // Whole card gives up after 2 minutes rather than spinning forever.
      card = await Promise.race([
        scBuild(id),
        scPause(120000).then(() => { scGen++; throw new Error('This card took too long to load. Tap Refresh to try again.'); }),
      ]);
    } catch (e) {
      if (scHitLimit) scMarkSlow(id, true);
      throw e;
    }
    // Hit the limit (even if retries got through) -> slow next time; clean -> normal again.
    scMarkSlow(id, scHitLimit);
    const fresh = scLoadCache();
    fresh[String(id)] = card;
    // keep the 40 most recent cards
    Object.values(fresh).sort((x, y) => y.builtAt - x.builtAt).slice(40).forEach((x) => { delete fresh[x.id]; });
    setCfg(SC_CACHE_KEY, JSON.stringify(fresh));
    return card;
  }

  const scFmtH = (h) => (h >= 10 ? `${Math.round(h)}h` : h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`);
  const scDate = (ms) => { const d = new Date(ms); const opt = (d.getUTCFullYear() === new Date().getUTCFullYear()) ? { day: 'numeric', month: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }; return d.toLocaleDateString('en-GB', opt); };
  let scTab = 0;

  function scCardHtml(c) {
    const head = `<div class="tws-sc-head"><div><b>${escHtml(c.name)}</b> <span class="tws-sc-dim">(Lvl ${c.level})</span>
      <div class="tws-sc-dim">${escHtml(c.factionName || 'No faction')}${c.lastWarHitAt ? ` · last war hit ${scDate(c.lastWarHitAt)}` : ''}</div></div>
      <span class="tws-sc-x" data-sc="close">×</span></div>`;
    const stat = (v, label) => `<div class="tws-sc-stat"><b>${v}</b><span>${label}</span></div>`;
    // Days ago in Torn City Time (UTC), from Torn's once-a-day records.
    const daysAgo = (ms) => Math.floor((Date.now() - (Date.now() % 86400000) - ms) / 86400000);
    const ago = (d) => (d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);
    let health = '';
    if (c.odCount !== undefined) {
      const od = c.lastOdAt ? daysAgo(c.lastOdAt) : null;
      const vic = c.lastVicAt ? daysAgo(c.lastVicAt) : null;
      const odLine = od === null ? '<div class="tws-sc-dim">Never overdosed</div>'
        : od <= 3 ? `<div class="tws-sc-flag" style="color:#ff6b6b;margin-top:0;">\u26a0 Overdosed ${ago(od)}</div>`
        : `<div class="tws-sc-dim">Last overdose: ${scDate(c.lastOdAt)} (${c.odCount} in total)</div>`;
      const vicLine = vic === null ? '<div class="tws-sc-dim">Never taken Vicodin</div>'
        : vic <= 1 ? `<div class="tws-sc-flag" style="margin-top:0;">\ud83d\udc8a Took Vicodin ${ago(vic)}</div>`
        : `<div class="tws-sc-dim">Last Vicodin: ${scDate(c.lastVicAt)}</div>`;
      health = `<div class="tws-sc-sec">${odLine}${vicLine}<div class="tws-sc-dim" style="font-size:10px;margin-top:2px;">To the day, as of Torn\u2019s last daily update</div></div>`;
    }
    let up = '';
    if (c.upcoming) {
      const u = c.upcoming;
      const usual = Math.round(u.normalXan || 0);
      const stacking = (!u.started && u.xan >= 3 && u.xan >= 1.5 * Math.max(1, u.normalXan || 0))
        ? `<div class="tws-sc-flag">\u26a0 More Xanax than usual (normally ~${usual} in this time): likely stacking</div>`
        : (u.normalXan !== undefined ? `<div class="tws-sc-dim" style="margin-top:4px;">Normally ~${usual} Xanax in the same time.</div>` : '');
      up = `<div class="tws-sc-sec">⚔️ ${u.started ? 'Current' : 'Upcoming'} war vs <b>${escHtml(u.vs)}</b>
        <div class="tws-sc-dim">Since the draw (${u.drawExact ? '' : 'approx. '}${scDate(u.drawAt)})</div>${u.asOf ? `<div class="tws-sc-dim" style="font-size:10px;">Counted up to the end of ${scDate(u.asOf)} (Torn time). Torn adds each day overnight, so today isn\u2019t included yet.</div>` : ''}

        <div class="tws-sc-grid" style="grid-template-columns:repeat(3,1fr);">${stat(u.xan, 'Xanax')}${stat(u.refills, 'Refills')}${stat(u.energy, 'Energy drinks')}</div>
        <div class="tws-sc-grid" style="grid-template-columns:repeat(2,1fr);">${stat(u.vic, 'Vicodin')}${u.started ? stat(u.hits, 'War hits') : stat(scFmtH(u.hours), 'Played')}</div>${stacking}</div>`;
    } else if (c.factionId) {
      up = '<div class="tws-sc-sec tws-sc-dim">No upcoming war for their faction.</div>';
    }
    let wars = '';
    if (c.wars.length) {
      const i = Math.min(scTab, c.wars.length - 1);
      const w = c.wars[i];
      const wonCls = (x) => x.won === true ? ' won' : x.won === false ? ' lost' : '';
      const tabs = c.wars.map((x, n) => `<span class="tws-sc-tab${n === i ? ' on' : ''}${wonCls(x)}" data-sc-tab="${n}">${escHtml(x.vs)}<small>${scDate(x.start)}</small></span>`).join('');
      const outcome = w.won === true ? '<span class="tws-sc-win">Won</span>' : w.won === false ? '<span class="tws-sc-loss">Lost</span>' : '';
      const respLine = (w.respect != null && w.factionScore != null)
        ? `<div class="tws-sc-dim">War respect: <b style="color:#fff;">${w.respect}</b> of ${w.factionScore}</div>` : '';
      const defLine = (w.defWon || w.defLost)
        ? `<div class="tws-sc-dim">Defends: ${w.defWon} won · ${w.defLost} lost</div>` : '';
      wars = `<div class="tws-sc-sec">📜 Last ${c.wars.length} war${c.wars.length === 1 ? '' : 's'}
        <div class="tws-sc-tabs">${tabs}</div>
        <div class="tws-sc-dim">${outcome} vs ${escHtml(w.vs)} · ${scDate(w.start)} – ${scDate(w.end)}</div>
        ${respLine}
        <div class="tws-sc-grid">${stat(w.hits, 'War hits')}${stat(scFmtH(w.hours), 'Played')}${stat(w.xan, 'Xanax')}${stat(w.refills, 'Refills')}</div>
        <div class="tws-sc-grid" style="grid-template-columns:1fr;">${stat(w.energy, 'Energy drinks')}</div>
        ${defLine}
        ${w.hits === 0 ? '<div class="tws-sc-dim">0 hits: they may not have been in this faction yet.</div>' : ''}</div>`;
    } else if (c.factionId) {
      wars = '<div class="tws-sc-sec tws-sc-dim">No finished ranked wars found for their faction.</div>';
    }
    const foot = `<div class="tws-sc-foot"><span class="tws-sc-dim">Updated ${Math.max(0, Math.round((Date.now() - c.builtAt) / 60000))}m ago · daily figures from Torn</span>
      <span class="tws-sc-btn" data-sc="refresh">↻ Refresh</span></div>`;
    return head + health + up + wars + foot;
  }

  function scEnsureCss() {
    if (document.getElementById('tws-sc-css')) return;
    const st = document.createElement('style');
    st.id = 'tws-sc-css';
    st.textContent = `
      #tws-statcard{position:fixed;inset:0;z-index:1000002;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;}
      #tws-statcard .tws-sc-card{width:min(360px,100%);max-height:88vh;overflow:auto;background:#1b1426;color:#ddd;border:1px solid #6b3fa0;border-radius:10px;padding:10px 12px;font:13px/1.4 Arial,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.6);}
      #tws-statcard .tws-sc-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;color:#fff;}
      #tws-statcard .tws-sc-x{cursor:pointer;font-size:20px;line-height:1;color:#aaa;padding:0 4px;}
      #tws-statcard .tws-sc-dim{color:#999;font-size:11px;}
      #tws-statcard .tws-sc-sec{border-top:1px solid #33264a;padding-top:8px;margin-top:8px;}
      #tws-statcard .tws-sc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px;}
      #tws-statcard .tws-sc-stat{background:#241a35;border:1px solid #3a2a55;border-radius:6px;text-align:center;padding:6px 2px;}
      #tws-statcard .tws-sc-stat b{display:block;font-size:16px;color:#fff;}
      #tws-statcard .tws-sc-stat span{font-size:10px;color:#aaa;}
      #tws-statcard .tws-sc-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin:6px 0 4px;}
      #tws-statcard .tws-sc-tab{cursor:pointer;background:#241a35;border:1px solid #3a2a55;border-radius:6px;padding:3px 2px;font-size:10px;color:#bbb;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      #tws-statcard .tws-sc-tab small{display:block;font-size:9px;color:#888;}
      #tws-statcard .tws-sc-tab.on{background:#6b3fa0;border-color:#8a5cc4;color:#fff;}
      #tws-statcard .tws-sc-tab.won{border-color:#3fae6b;box-shadow:inset 0 -2px 0 #3fae6b;}
      #tws-statcard .tws-sc-tab.lost{border-color:#c0564e;box-shadow:inset 0 -2px 0 #c0564e;}
      #tws-statcard .tws-sc-tab.on.won{background:#2f7d4f;border-color:#4fd98a;}
      #tws-statcard .tws-sc-tab.on.lost{background:#8f3b35;border-color:#e0786e;}
      #tws-statcard .tws-sc-win{color:#5fd98a;font-weight:bold;}
      #tws-statcard .tws-sc-loss{color:#ff8a7e;font-weight:bold;}
      #tws-statcard .tws-sc-tab.on small{color:#e6d8ff;}
      #tws-statcard .tws-sc-flag{margin-top:6px;color:#ffb35c;font-size:12px;}
      #tws-statcard .tws-sc-foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #33264a;margin-top:8px;padding-top:6px;}
      #tws-statcard .tws-sc-btn{cursor:pointer;color:#c9a4ff;font-size:12px;}
      .tws-card-btn{cursor:pointer;font-size:12px;margin-left:2px;}`;
    document.head.appendChild(st);
  }

  // Tap a player's respect figure: their war hits, average respect per hit
  // (chain bonus hits left out) and each chain bonus hit. A bonus hit's
  // "bonus" is its respect minus the player's average normal hit.
  function openRespCard(id) {
    scEnsureCss();
    if (!document.getElementById('tws-resp-css')) {
      const st = document.createElement('style');
      st.id = 'tws-resp-css';
      st.textContent = '#tws-respcard{position:fixed;inset:0;z-index:1000002;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;}'
        + '#tws-respcard .tws-rc{width:min(340px,100%);max-height:88vh;overflow:auto;background:#1b1426;color:#ddd;border:1px solid #6b3fa0;border-radius:10px;padding:10px 12px;font:13px/1.4 Arial,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.6);}'
        + '#tws-respcard .tws-rc-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;color:#fff;}'
        + '#tws-respcard .tws-rc-x{cursor:pointer;font-size:20px;line-height:1;color:#aaa;padding:0 4px;}'
        + '#tws-respcard .tws-rc-dim{color:#999;font-size:11px;}'
        + '#tws-respcard .tws-rc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px;}'
        + '#tws-respcard .tws-rc-stat{background:#241a35;border:1px solid #3a2a55;border-radius:6px;text-align:center;padding:6px 2px;}'
        + '#tws-respcard .tws-rc-stat b{display:block;font-size:16px;color:#fff;}'
        + '#tws-respcard .tws-rc-stat span{font-size:10px;color:#aaa;}'
        + '#tws-respcard .tws-rc-sec{border-top:1px solid #33264a;padding-top:8px;margin-top:8px;}'
        + '#tws-respcard table{width:100%;border-collapse:collapse;margin-top:4px;font-size:12px;}'
        + '#tws-respcard td,#tws-respcard th{padding:3px 4px;text-align:right;border-bottom:1px solid #2c2140;}'
        + '#tws-respcard td:first-child,#tws-respcard th:first-child{text-align:left;}'
        + '#tws-respcard th{color:#aaa;font-weight:normal;font-size:11px;}'
        + '#tws-respcard td{color:#7ec8ff;font-weight:bold;}';
      document.head.appendChild(st);
    }
    let box = document.getElementById('tws-respcard');
    if (!box) {
      box = document.createElement('div');
      box.id = 'tws-respcard';
      document.body.appendChild(box);
      box.addEventListener('click', (e) => {
        if (e.target === box || e.target.closest('[data-rc="close"]')) box.remove();
      });
    }
    const key = String(id);
    const m = enemyMembers.concat(homeMembers).find((x) => String(x.id) === key);
    const name = m ? m.name : `Player ${key}`;
    const total = typeof respectMap[key] === 'number' ? respectMap[key] : 0;
    const det = (warScoreCache && warScoreCache.detail) ? warScoreCache.detail[key] : null;
    const r2 = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let body;
    if (!det) {
      body = (warScoreCache && warScoreCache.detail)
        ? '<div class="tws-rc-dim">No war hits counted for them yet.</div>'
        : '<div class="tws-rc-dim">The breakdown is worked out from the war\u2019s attack history. Open the Respect view during the war and it will fill in.</div>';
    } else {
      const avg = det.n ? det.sum / det.n : 0;
      const hits = det.n + det.b.length;
      const bonusTotal = det.b.reduce((t, x) => t + Math.max(0, x[1] - avg), 0);
      const rows = det.b.slice().sort((x, y) => x[2] - y[2]).map((x) => `<tr><td>${x[0].toLocaleString()}th</td><td>${r2(x[1])}</td><td>${r2(Math.max(0, x[1] - avg))}</td><td>${fmtTct(x[2]).slice(0, 5)}</td></tr>`).join('');
      body = `<div class="tws-rc-grid">
          <div class="tws-rc-stat"><b>${hits}</b><span>War hits</span></div>
          <div class="tws-rc-stat"><b>${r2(avg)}</b><span>Avg per hit</span></div>
          <div class="tws-rc-stat"><b>${det.b.length}</b><span>Bonus hits</span></div>
        </div>
        <div class="tws-rc-dim" style="margin-top:4px;">Average leaves out chain bonus hits.</div>
        ${det.b.length ? `<div class="tws-rc-sec"><b>\ud83d\udd17 Chain bonus hits</b>
          <table><tr><th>Hit</th><th>Respect</th><th>Bonus</th><th>TCT</th></tr>${rows}</table>
          <div class="tws-rc-dim" style="margin-top:4px;">Bonus = that hit\u2019s respect minus their average hit. Bonus total: <b style="color:#fff;">${r2(bonusTotal)}</b></div>
          <div class="tws-rc-dim">Respect without bonuses (bonus hits counted as average hits): <b style="color:#fff;">${r2(det.sum + avg * det.b.length)}</b></div></div>` : ''}`;
    }
    box.innerHTML = `<div class="tws-rc"><div class="tws-rc-head"><b>${escHtml(name)} \u00b7 ${r2(total)}R</b><span class="tws-rc-x" data-rc="close">\u00d7</span></div>${body}</div>`;
  }

  async function openStatCard(id, force) {
    if (!featureOn('targetCards')) return;
    scEnsureCss();
    let box = document.getElementById('tws-statcard');
    if (!box) {
      box = document.createElement('div');
      box.id = 'tws-statcard';
      document.body.appendChild(box);
      box.addEventListener('click', (e) => {
        if (e.target === box) { box.remove(); return; }
        const t = e.target.closest('[data-sc],[data-sc-tab]');
        if (!t) return;
        if (t.dataset.sc === 'close') box.remove();
        else if (t.dataset.sc === 'refresh') openStatCard(box.dataset.id, true);
        else if (t.dataset.scTab !== undefined) {
          scTab = Number(t.dataset.scTab) || 0;
          const c = scLoadCache()[box.dataset.id];
          if (c) box.querySelector('.tws-sc-card').innerHTML = scCardHtml(c);
        }
      });
    }
    box.dataset.id = String(id);
    scTab = 0;
    const cached = scLoadCache()[String(id)];
    const fresh = cached && !force && Date.now() - cached.builtAt < SC_TTL_MS;
    const waiting = scBuildingId && scBuildingId !== String(id) && Object.keys(scPending).length;
    box.innerHTML = `<div class="tws-sc-card">${fresh ? scCardHtml(cached) : `<div class="tws-sc-head"><b>Stat card</b><span class="tws-sc-x" data-sc="close">\u00d7</span></div><div class="tws-sc-dim">Loading stat card\u2026 (about 20 lookups on your key)<br><span class="tws-sc-prog">${waiting ? 'Waiting for the card you opened before to finish\u2026' : 'Starting\u2026'}</span>${scIsSlow(id) ? '<br>Slow mode: Torn rate-limited this card last time, so lookups are spaced out (about 30 seconds).' : ''}</div>`}</div>`;
    if (fresh) return;
    const key = String(id);
    if (!scPending[key]) {
      // One card at a time (keeps your key under Torn's limit); others queue.
      scPending[key] = scChain.then(() => scGet(id, true));
      scChain = scPending[key].catch(() => {});
      scPending[key].finally(() => { delete scPending[key]; if (scBuildingId === key) scBuildingId = null; }).catch(() => {});
    }
    try {
      const card = await scPending[key];
      if (box.isConnected && box.dataset.id === key) box.querySelector('.tws-sc-card').innerHTML = scCardHtml(card);
    } catch (e) {
      if (box.isConnected && box.dataset.id === key) box.querySelector('.tws-sc-card').innerHTML = `<div class="tws-sc-head"><b>Stat card</b><span class="tws-sc-x" data-sc="close">\u00d7</span></div><div class="tws-sc-flag">${escHtml(e.message || 'Lookup failed')}</div><div class="tws-sc-foot"><span></span><span class="tws-sc-btn" data-sc="refresh">\u21bb Refresh</span></div>`;
    }
  }

  // Travel method YOU picked for a member (tap a method in the travel popup).
  // Beats a learned method and the Airstrip assumption. Saved on this device.
  const TRAVEL_PICK_KEY = 'tws_travel_picks';
  let travelPicks = {};
  try { travelPicks = JSON.parse(getCfg(TRAVEL_PICK_KEY, '{}')) || {}; } catch (e) { travelPicks = {}; }
  function setTravelPick(id, method) {
    if (method) travelPicks[String(id)] = method; else delete travelPicks[String(id)];
    try { setCfg(TRAVEL_PICK_KEY, JSON.stringify(travelPicks)); } catch (e) { /* in-memory still works */ }
  }

  // Best estimate for a travelling member, or null if not travelling.
  function travelEstimate(m) {
    if (!m || m.state !== 'Traveling') return null;
    const d = travelDestOf(m.description);
    if (!d) return null;
    const id = String(m.id);
    const nowMs = Date.now();
    const maxMs = TRAVEL_MIN[d.key][0] * 60000 * 1.15;
    const cands = [];
    const loc = travelLocal[id];
    const srv = travelServer[id];
    if (loc && loc.dest === d.key && loc.depLo && nowMs - loc.depLo < maxMs) cands.push({ lo: loc.depLo, hi: loc.depHi, src: 'you' });
    if (srv && srv.dest === d.key && srv.depLo && nowMs - srv.depLo < maxMs) cands.push({ lo: srv.depLo, hi: srv.depHi, src: 'server' });
    cands.sort((a, b) => (a.hi - a.lo) - (b.hi - b.lo));
    const trip = cands[0] || null;
    const learnedRaw = (loc && loc.method) || (srv && srv.method) || null;
    const learned = learnedRaw && travelMethodMs(d.key, learnedRaw) ? learnedRaw : null;
    const pickRaw = travelPicks[id] || null;
    const picked = pickRaw && travelMethodMs(d.key, pickRaw) ? pickRaw : null;
    const method = picked || learned || 'airstrip';
    const dep = trip ? (trip.lo + trip.hi) / 2 : null;
    return {
      dest: d,
      returning: /to Torn\b/i.test(m.description || ''),
      trip,
      dep,
      method,
      learned: !!learned,
      learnedMethod: learned,
      picked: !!picked,
      landAt: dep !== null ? dep + travelMethodMs(d.key, method) : null,
    };
  }

  // Short label for the roster's time column.
  function travelLabel(m) {
    const est = travelEstimate(m);
    if (!est || est.landAt === null) return null;
    const left = Math.round((est.landAt - Date.now()) / 1000);
    if (left <= 0) return 'Landing…';
    return `✈ ${(est.picked || est.learned) ? '' : '~'}${fmtDuration(left)}`;
  }

  function travelMemberById(id) {
    return enemyMembers.find((x) => String(x.id) === id) || homeMembers.find((x) => String(x.id) === id) || null;
  }

  function fmtFlightMins(ms) {
    const mins = Math.round(ms / 60000);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }

  function closeTravelPopup() {
    travelPopId = null;
    const el = document.getElementById('tws-travel-pop');
    if (el) el.style.display = 'none';
  }

  function openTravelPopup(id, anchorEl) {
    travelPopId = String(id);
    const r = anchorEl.getBoundingClientRect();
    let el = document.getElementById('tws-travel-pop');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tws-travel-pop';
      el.addEventListener('click', (e) => {
        const row = e.target && e.target.closest ? e.target.closest('[data-pick]') : null;
        if (!row || !travelPopId) return;
        const m = travelMemberById(travelPopId);
        const est = travelEstimate(m);
        if (!est) return;
        const k = row.dataset.pick;
        if (est.picked && est.method === k) {
          setTravelPick(travelPopId, null);
          showToast(`${m.name}: back to ${est.learnedMethod ? travelMethodLabel(est.learnedMethod) : 'Airstrip'}.`);
        } else {
          setTravelPick(travelPopId, k);
          showToast(`${m.name}: ${travelMethodLabel(k)} set as their default.`);
        }
        renderTravelPopup();
        safeRender();
      });
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    renderTravelPopup();
    if (!travelPopId) return;
    // Just under the tapped timer (or above it if there's no room), kept on screen.
    const box = el.getBoundingClientRect();
    const pad = 6;
    let left = r.right - box.width;
    let top = r.bottom + 4;
    if (top + box.height > window.innerHeight - pad) top = r.top - box.height - 4;
    left = Math.max(pad, Math.min(left, window.innerWidth - box.width - pad));
    top = Math.max(pad, top);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  // Redrawn every second while open, so its countdowns stay live.
  function renderTravelPopup() {
    if (!travelPopId) return;
    const el = document.getElementById('tws-travel-pop');
    if (!el) return;
    const m = travelMemberById(travelPopId);
    const est = travelEstimate(m);
    if (!est || !featureOn('travelTimers')) {
      closeTravelPopup();
      return;
    }
    const nowMs = Date.now();
    const methods = TRAVEL_METHODS.map(([k]) => k);
    if (!methods.includes(est.method)) methods.push(est.method); // e.g. a learned "+ book" method
    const rows = methods.map((k) => {
      const ms = travelMethodMs(est.dest.key, k);
      let land = '';
      if (est.dep !== null) {
        const left = Math.round((est.dep + ms - nowMs) / 1000);
        land = left > 0 ? fmtDuration(left) : 'landed?';
      }
      return `<div class="tws-tp-row tws-tp-pick ${k === est.method ? 'tws-tp-on' : ''}" data-pick="${escHtml(k)}"><span>${k === est.method ? '✓ ' : ''}${escHtml(travelMethodLabel(k))}</span><span>${fmtFlightMins(ms)}</span><span>${land}</span></div>`;
    }).join('');
    let sub;
    if (est.trip) {
      const win = Math.round((est.trip.hi - est.trip.lo) / 2000);
      const winTxt = win >= 60 ? `±${Math.round(win / 60)}m` : `±${win}s`;
      sub = `Took off ${fmtTct(Math.round(est.dep / 1000)).slice(0, 8)} TCT (${winTxt}${est.trip.src === 'server' ? ', server' : ''})`;
    } else {
      sub = "Take-off wasn't seen, so these are flight lengths only.";
    }
    let foot;
    if (est.picked) {
      foot = `Your default for them. Tap ${escHtml(travelMethodLabel(est.method))} again to go back to ${est.learnedMethod ? `their learned method (${escHtml(travelMethodLabel(est.learnedMethod))})` : 'Airstrip'}.`;
    } else if (est.learned) {
      foot = `Usually flies ${escHtml(travelMethodLabel(est.method))} (seen landing before). Tap another method to make it their default.`;
    } else {
      foot = 'Assumed Airstrip. Tap a method to make it their default.';
    }
    el.innerHTML = `
      <div class="tws-tp-title">✈ ${escHtml(m.name)} ${est.returning ? 'returning from' : 'to'} ${escHtml(est.dest.name)}</div>
      <div class="tws-tp-sub">${sub}</div>
      <div class="tws-tp-row tws-tp-head"><span>Method</span><span>Flight</span><span>Lands in</span></div>
      ${rows}
      <div class="tws-tp-foot">${foot}</div>`;
  }

  // Any tap or click anywhere else closes the travel popup.
  document.addEventListener('click', (e) => {
    if (!travelPopId) return;
    const pop = document.getElementById('tws-travel-pop');
    if (pop && pop.contains(e.target)) return;
    const lab = e.target && e.target.closest ? e.target.closest('.tws-travel-eta') : null;
    if (lab && lab.dataset.travelId === travelPopId) return; // its own timer toggles it instead
    closeTravelPopup();
  }, true);

  // ---------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------
  let pageMode = 'home'; // 'home' | 'war' | 'enemy-page'
  let pageModeSet = false;
  // Early war-matchup detection (before the war has started) -- see
  // findActiveWar.
  let upcomingWar = null; // { enemyId, enemyName, startTime }
  let upcomingWarRevivesNotified = null; // enemyId already notified about, or null
  // Set while there's no running or matched war but we know how the last one
  // ended (see findLastEndedWar) -- drives the result message and keeps that
  // war's enemy roster on screen until a new war is matched.
  let postWarInfo = null;
  let turboMode = !!getCfg(STORE_KEYS.turboMode, false);
  let enemyFactionId = null;
  let enemyFactionName = null;
  let enemyMembers = []; // { id, name, level, state, lastAction, until, remaining }
  let homeMembers = [];
  let viewSide = 'enemy'; // 'enemy' | 'home' | 'target' -- which roster is currently shown
  let lastRosterRefreshAt = 0;

  // Personal watchlist of enemy IDs to show in the Target tab. Persisted so
  // it survives reloads -- stale IDs from a past war simply won't match
  // anyone in the current roster and are harmless to leave in storage.
  let targetIds = new Set();
  try {
    targetIds = new Set(JSON.parse(getCfg(STORE_KEYS.targetIds, '[]')));
  } catch (e) {
    targetIds = new Set();
  }
  function saveTargetIds() {
    setCfg(STORE_KEYS.targetIds, JSON.stringify([...targetIds]));
  }
  // Filters are remembered per-tab (Enemy/Home/Target) rather than shared,
  // so switching tabs doesn't carry one tab's filter selection into another.
  let filtersByTab = { enemy: new Set(), home: new Set(), target: new Set() };
  function currentFilters(side) {
    side = side || viewSide;
    if (!filtersByTab[side]) filtersByTab[side] = new Set();
    return filtersByTab[side];
  }
  // Sort mode + direction are remembered per-tab too, same as filters --
  // switching tabs shouldn't carry one tab's sort choice into another.
  // Modes: 'timer' | 'stats' | 'respect'.
  let sortByTab = {
    enemy: { mode: 'timer', dir: 'asc' },
    home: { mode: 'timer', dir: 'asc' },
    target: { mode: 'timer', dir: 'asc' },
  };
  function currentSort(side) {
    side = side || viewSide;
    if (!sortByTab[side]) sortByTab[side] = { mode: 'timer', dir: 'asc' };
    return sortByTab[side];
  }
  // Each sort mode has its own sensible default direction, applied fresh
  // whenever you switch INTO that mode (not remembered across switches).
  const SORT_MODE_DEFAULT_DIR = { timer: 'asc', stats: 'desc', respect: 'desc', online: 'desc' };
  // Chain state. `remaining` counts down from `timeout`, and `cooldown`
  // counts down from `cooldownBase` (both as of the last fetch, `lastFetch`).
  let ownChain = { current: 0, timeout: 0, remaining: 0, cooldown: 0, cooldownBase: 0, lastFetch: 0, error: null, fetched: false };
  let enemyChain = { current: 0, timeout: 0, remaining: 0, cooldown: 0, cooldownBase: 0, lastFetch: 0, error: null, fetched: false };
  let lastError = null;
  let ffError = null;
  let homeFfError = null;
  // War respect -- see fetchWarRespect above.
  let respectMap = {}; // id (string) -> total respect earned this war
  let respectError = null;
  let respectLoading = false;
  let respectFetchedAt = 0;
  let respectSource = 'live'; // 'report' (Torn's official war report) or 'live' (recent attacks only)
  let respectNotice = null;
  const warReportCache = {}; // warId -> { scores, names, winnerId }
  let liveWar = null;        // the running war, if any: { enemyId, startTime, started }
  let warScoreCache = null;  // counted-so-far attack history (see buildWarScores)
  let warCheck = null;       // result of the live-method self-check
  const warCheckStarted = {};
  try {
    const rawScores = JSON.parse(getCfg(STORE_KEYS.warScores, 'null'));
    if (rawScores && rawScores.key && rawScores.scores) warScoreCache = rawScores;
  } catch (e) { warScoreCache = null; }
  // Turbo refresh is a plain on/off setting (⚙ Settings -> General).
  function isTurbo() {
    return turboMode;
  }
  // Simple backoff after a Torn rate-limit response: skip subsequent polls
  // until this passes, rather than immediately retrying at the same fast
  // cadence and likely tripping the same short-window limit again.
  let rateLimitCooldownUntil = 0;
  function isRateLimitError(message) {
    return !!message && (/error 5/i.test(message) || /too many requests/i.test(message));
  }

  // Background polling/tick loops must NEVER re-render while the settings
  // form is open -- render() rebuilds #tws-body's innerHTML from scratch,
  // which destroys and recreates any focused <input>, instantly killing
  // focus and dismissing the mobile keyboard mid-type. Direct user actions
  // (gear tap, save button, collapse toggle) still call render() straight
  // away since those are intentional, one-off UI changes.
  // Redraw without moving: remembers how far each list (and the page) was
  // scrolled and puts it back straight away, then again once heights settle.
  function renderKeepScroll() {
    const saved = [];
    document.querySelectorAll('#tws-panel #tws-roster').forEach((r) => {
      const col = r.closest('#tws-body-home, #tws-body-target, #tws-body');
      saved.push(['R', col ? col.id : '', r.scrollTop]);
    });
    ['#tws-panel', '#tws-body', '#tws-body-home', '#tws-col3', '#tws-body-target'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el && el.scrollTop) saved.push(['E', sel, el.scrollTop]);
    });
    const wy = window.scrollY || 0;
    const put = () => {
      saved.forEach(([k, a, v]) => {
        if (k === 'R') {
          const col = a ? document.getElementById(a) : null;
          const r = col ? col.querySelector('#tws-roster') : null;
          if (r && Math.abs(r.scrollTop - v) > 1) r.scrollTop = v;
        } else {
          const el = document.querySelector(a);
          if (el && Math.abs(el.scrollTop - v) > 1) el.scrollTop = v;
        }
      });
      if (Math.abs((window.scrollY || 0) - wy) > 1) window.scrollTo(window.scrollX || 0, wy);
    };
    if (showSettings) render(); else safeRender();
    put();
    requestAnimationFrame(() => { put(); requestAnimationFrame(put); });
  }

  function safeRender__raw() {
    if (showSettings) return;
    
    // Save scroll position before render destroys the HTML
    const rosterEl = document.querySelector('#tws-roster');
    const settingsEl = document.querySelector('#tws-settings');
    const savedRosterScroll = rosterEl ? rosterEl.scrollTop : 0;
    const savedSettingsScroll = settingsEl ? settingsEl.scrollTop : 0;
    const savedColScroll = {};
    ['#tws-body-home', '#tws-body-target'].forEach((c) => { const r = document.querySelector(`${c} #tws-roster`); savedColScroll[c] = r ? r.scrollTop : 0; });
    
    // Render (destroys and recreates HTML)
    render();
    
    // Restore scroll position and recalculate heights after render
    requestAnimationFrame(() => {
      const body = document.querySelector('#tws-body');
      const newRosterEl = document.querySelector('#tws-roster');
      const newSettingsEl = document.querySelector('#tws-settings');
      const staticEl = body?.querySelector('#tws-static');
      ['#tws-body-home', '#tws-body-target'].forEach((c) => {
        const col = document.querySelector(c);
        if (!col || col.style.display === 'none') return;
        fitWideColumn(col);
        const r = col.querySelector('#tws-roster');
        if (r && savedColScroll[c] > 0) r.scrollTop = savedColScroll[c];
      });
      
      // Dynamic height calculation for both roster and settings
      if (body && staticEl) {
        const bodyRect = body.getBoundingClientRect();
        const staticHeight = (staticEl.parentElement === body ? staticEl.offsetHeight : 0);
        const maxScrollHeight = bodyRect.height - staticHeight;
        
        if (newRosterEl) {
          newRosterEl.style.maxHeight = maxScrollHeight + 'px';
          if (savedRosterScroll > 0) {
            newRosterEl.scrollTop = savedRosterScroll;
          }
        }
        if (newSettingsEl) {
          newSettingsEl.style.maxHeight = maxScrollHeight + 'px';
          if (savedSettingsScroll > 0) {
            newSettingsEl.scrollTop = savedSettingsScroll;
          }
        }
      }
    });
  }


  // Hospital (in Torn) or jail timer is down to its last second -> show them as
  // out (by the time the attack page loads, they are). Overseas hospital is
  // left alone: they come out abroad, not attackable from Torn.
  const TIMER_EARLY_SEC = 1;
  function timerOver(state, description, until, nowS) {
    if (!until || nowS < until - TIMER_EARLY_SEC) return false;
    if (state === 'Jail') return true;
    if (state !== 'Hospital') return false;
    try { if (COUNTRY_KEYWORDS.some(([re]) => re.test(description || ''))) return false; } catch (e) { return false; }
    return true;
  }
  function parseMembers__raw(data) {
    const now = Date.now() / 1000;
    return Object.entries(data.members || {}).map(([id, m]) => {
      const status = m.status || {};
      const lastAction = m.last_action || {};
      const until = status.until || 0;
      let state = status.state || 'Okay';
      let description = status.description || '';
      // Torn's API can lag a few seconds behind the real release time: once the
      // timer has run out, treat them as out straight away.
      if (timerOver(state, description, until, now)) { state = 'Okay'; description = 'Okay'; }
      return {
        id,
        name: m.name,
        level: m.level,
        state,
        description,
        lastActionStatus: lastAction.status || 'Offline', // Online | Idle | Offline
        until,
        remaining: until ? Math.max(0, Math.round(until - now)) : 0,
      };
    });
  }

  // ---------------------------------------------------------------------
  // FETCH LOOPS
  // ---------------------------------------------------------------------
  async function refreshRosters__raw() {
    if (perfPaused()) return;
    if (Date.now() < rateLimitCooldownUntil) return;
    lastRosterRefreshAt = Date.now();
    await ensureOwnFactionId();
    const ownId = getOwnFactionId();

    // 1. Own faction (roster + ranked wars). Fetched on every page, every
    //    cycle, so the Home tab, the chain and -- crucially -- the war /
    //    enemy detection below all work wherever you are in Torn.
    let ownData = null;
    if (ownId) {
      try {
        ownData = await fetchOwnFactionBasicAndWars(ownId);
        homeMembers = parseMembers(ownData);
        trackTravel(homeMembers);
        const homeFfResult = await fetchFFStats(homeMembers.map((m) => m.id));
        homeFfError = homeFfResult.error;
        if (Object.keys(homeFfResult.map).length) {
          homeMembers = homeMembers.map((m) => ({ ...m, ff: homeFfResult.map[m.id] || null }));
        }
      } catch (e) {
        clearBadOwnIdIfNeeded(e.message, ownId);
        if (!lastError) lastError = e.message;
        if (isRateLimitError(e.message)) rateLimitCooldownUntil = Date.now() + 15000;
      }
    } else if (!lastError) {
      lastError = 'Could not detect your faction — check that your API key has faction access.';
    }

    // 2. Is there a war, and who's the enemy?
    //    - The page itself wins: a war roster on screen, or the enemy's own
    //      faction page (see classifyPage).
    //    - Otherwise (any other page or tab) the API decides: a war that has
    //      started -> war mode against that enemy, so the Enemy tab, chain
    //      and timers stay live wherever you navigate.
    //    - A war that has just ENDED (and no new one matched yet) keeps its
    //      enemy on screen -- "post-war" -- with the result message.
    //    - If the API can't say, the enemy last seen on the war page is used
    //      for a few hours.
    //    - If this cycle's own-faction request FAILED, the previous answer is
    //      kept rather than flipping to "no war" and dropping the Enemy tab.
    const classified = classifyPage();
    const rankedWars = ownData ? ownData.rankedwars : null;
    const apiWar = ownData ? findActiveWar(rankedWars, ownId) : null;

    // Remember how the most recent war ended.
    if (ownData) {
      const ended = findLastEndedWar(rankedWars, ownId, ownData.name || null);
      if (ended) saveLastWarIfNewer(ended);
    }
    const lw = validLastWar();
    // Post-war = Torn shows no running OR upcoming war, but we know the last
    // one's result. A new match (apiWar, even not yet started) ends it.
    const postWar = (ownData && !apiWar && lw) ? lw : null;
    if (ownData) postWarInfo = postWar; // (a failed request keeps the previous state)
    if (ownData) liveWar = (apiWar && apiWar.started) ? apiWar : null;
    if (apiWar) { try { creditWarCheck(apiWar); creditDrawnNotice(apiWar); } catch (e) { /* never break the refresh */ } }

    let mode = classified.mode;
    let enemyId = classified.enemyId;
    if (mode === 'home') {
      if (ownId && !ownData && pageMode !== 'home' && enemyFactionId) {
        mode = pageMode;
        enemyId = enemyFactionId;
      } else if (apiWar) { // matched OR running: Enemy tab shows from the moment a war is drawn
        mode = 'war';
        enemyId = apiWar.enemyId;
      } else if (!apiWar) {
        if (postWar && featureOn('keepEnemyAfterWar')) {
          mode = 'war';
          enemyId = postWar.enemyId;
        } else {
          const remembered = getRememberedEnemy(rankedWars);
          if (remembered) {
            mode = 'war';
            enemyId = remembered;
          }
        }
      }
    } else if (mode === 'war') {
      if (!isProtectedFaction(enemyId)) rememberEnemy(enemyId);
    }
    if (enemyId && isProtectedFaction(enemyId)) {
      // At war with a protected faction: ask the server now (it pauses access
      // for the war) rather than waiting for the daily access check.
      if (protWarChecked !== String(enemyId)) {
        protWarChecked = String(enemyId);
        refreshAccess(true).then((st) => { if (st && !accessAllowed(st)) lockNow(); }).catch(() => {});
      }
      // Protected faction: no Enemy tab, roster, chain or targets against them.
      mode = 'home';
      enemyId = null;
    }
    // Out of a war: start on Home (Enemy/Target stay visible with a "no war" note).
    if (mode === 'home' && (pageMode !== mode || !pageModeSet) && (viewSide === 'enemy' || viewSide === 'target')) viewSide = 'home';
    pageModeSet = true;
    pageMode = mode;
    enemyFactionId = enemyId || null;

    // Pre-war heads-up only -- never touches pageMode/enemyFactionId.
    if (apiWar && !apiWar.started) {
      if (!upcomingWar || upcomingWar.enemyId !== apiWar.enemyId) {
        upcomingWar = { enemyId: apiWar.enemyId, startTime: apiWar.startTime, enemyName: null };
        scNoteDraw(apiWar.enemyId, apiWar.startTime);
        if (!scDrawSent[apiWar.startTime]) { scDrawSent[apiWar.startTime] = 1; scServerDraw(apiWar.enemyId, 0, apiWar.startTime); }
        if (featureOn('upcomingWar') && upcomingWarRevivesNotified !== apiWar.enemyId) {
          upcomingWarRevivesNotified = apiWar.enemyId;
          if (getRevives() !== 'off') {
            showToast('⚠️ War found! Turn Revives off in ⚙ Settings before it starts.', { duration: 10000, warn: true });
          }
        }
        fetchFactionBasic(apiWar.enemyId)
          .then((d) => {
            if (upcomingWar && upcomingWar.enemyId === apiWar.enemyId) {
              upcomingWar = { ...upcomingWar, enemyName: d.name || null };
              safeRender();
            }
          })
          .catch(() => { /* name is a nice-to-have; ID alone still shows */ });
      } else {
        upcomingWar.startTime = apiWar.startTime;
      }
    } else {
      upcomingWar = null;
    }

    // Force the visible side to match what's actually available in this
    // page context, so the user never lands on a tab with nothing to show --
    // but only when the current tab genuinely isn't valid here, so this
    // doesn't fight the user out of the Target tab on every poll.
    const validSides = ['enemy', 'home'].concat(featureOn('targets') ? ['target'] : [])
      .concat(featureOn('atkLog') ? ['log'] : []);
    if (!validSides.includes(viewSide)) {
      viewSide = pageMode === 'home' ? 'home' : 'enemy';
    }

    // 3. The enemy roster.
    if (pageMode !== 'home' && enemyFactionId) {
      try {
        const data = await fetchFactionBasic(enemyFactionId);
        enemyMembers = parseMembers(data);
        trackTravel(enemyMembers);
        refreshTravelServer(enemyFactionId);
        refreshActivity(enemyFactionId);
        enemyFactionName = data.name || null;
        lastError = null;
        // The finished war's enemy name, if the war record didn't carry it.
        if (lastWar && lastWar.enemyId === String(enemyFactionId) && !lastWar.enemyName && data.name) {
          saveLastWar({ ...lastWar, enemyName: data.name });
        }
        // FFScouter estimated battle stats -- optional, and cached (see
        // fetchFFStats), so they're merged in from the cache every cycle
        // even when no request was needed or a request failed.
        if (tsOn()) await tsLoadFaction(enemyFactionId).catch(() => {});
        const ffResult = await fetchFFStats(enemyMembers.map((m) => m.id));
        ffError = ffResult.error;
        if (Object.keys(ffResult.map).length) {
          enemyMembers = enemyMembers.map((m) => ({ ...m, ff: ffResult.map[m.id] || null }));
        }
      } catch (e) {
        lastError = e.message;
        if (isRateLimitError(e.message)) rateLimitCooldownUntil = Date.now() + 15000;
      }
    } else if (pageMode !== 'home') {
      lastError = 'Could not detect the enemy faction yet.';
    } else {
      enemyFactionName = null; // no active enemy
    }

    updateOwnHospital()
      .then(() => { if (!showSettings) applyHeaderFlash(); })
      .catch((e) => reportCrash('hospital check', e));
    safeRender();
  }

  async function refreshChain__raw() {
    if (perfPaused()) return;
    if (Date.now() < rateLimitCooldownUntil) return;
    await ensureOwnFactionId();
    const ownId = getOwnFactionId();
    const now = Date.now();

    // Own and enemy chains are fetched independently so a failure on one
    // side (e.g. Torn restricting live enemy chain data to their own
    // members) doesn't wipe out the side that's working.
    //
    // A response that's missing the chain object entirely (a hiccup, not a
    // Torn-flagged error) is NOT the same thing as a chain that's genuinely
    // at zero -- treating them the same overwrites good numbers with zeros
    // on a transient blip. Only apply an update when the API actually
    // returned a chain object with a numeric current value; otherwise keep
    // whatever was last known good and just skip this cycle.
    //
    // `cooldown` is stored twice: `cooldownBase` is what Torn reported at
    // this fetch, and `cooldown` is what's left of it now (counted down each
    // tick from the base -- see tickCountdowns).
    if (ownId) {
      try {
        const data = await fetchChain(ownId);
        if (data.chain && typeof data.chain.current === 'number') {
          const c = data.chain;
          let ps = null;
          try { ps = c.current > 0 ? readPageChainSecs() : null; } catch (e) { ps = null; }
          const tmo = ps !== null ? ps : (c.timeout || 0);
          ownChain = { current: c.current, timeout: tmo, remaining: tmo, cooldown: c.cooldown || 0, cooldownBase: c.cooldown || 0, lastFetch: ps !== null ? Date.now() : now, error: null, fetched: true, pageSync: ps !== null };
        }
      } catch (e) {
        clearBadOwnIdIfNeeded(e.message, ownId);
        ownChain = { ...ownChain, error: e.message };
        if (isRateLimitError(e.message)) rateLimitCooldownUntil = Date.now() + 15000;
      }
    }

    if (pageMode !== 'home' && enemyFactionId) {
      try {
        const data = await fetchChain(enemyFactionId);
        if (data.chain && typeof data.chain.current === 'number') {
          const c = data.chain;
          enemyChain = { current: c.current, timeout: c.timeout || 0, remaining: c.timeout || 0, cooldown: c.cooldown || 0, cooldownBase: c.cooldown || 0, lastFetch: now, error: null, fetched: true };
        }
      } catch (e) {
        enemyChain = { ...enemyChain, error: e.message };
        if (isRateLimitError(e.message)) rateLimitCooldownUntil = Date.now() + 15000;
      }
    }

    safeRender();
  }

  // Which figures to show: the finished war's official report when there is
  // one (exact, same as the war page), otherwise the recent-attacks log.
  async function loadRespectFigures(ownId) {
    respectNotice = null;
    warScan = { seen: 0, paired: 0 };
    const lw = postWarInfo ? validLastWar() : null;
    if (lw && lw.warId) {
      try {
        let rep = warReportCache[lw.warId];
        if (!rep) {
          rep = await fetchWarReport(lw.warId);
          warReportCache[lw.warId] = rep;
        }
        respectMap = rep.scores;
        respectSource = 'report';
        if (lw.startTime && !warCheckStarted[lw.warId]) {
          warCheckStarted[lw.warId] = true;
          checkLiveMethod(lw, rep); // background self-check of the live method
        }
        // Fill in anything the war record didn't say (who won, faction names).
        const cur = (lastWar && lastWar.warId === lw.warId) ? lastWar : null;
        if (cur) {
          const upd = { ...cur };
          if (!upd.winnerId && rep.winnerId) upd.winnerId = rep.winnerId;
          if (!upd.enemyName && rep.names[upd.enemyId]) upd.enemyName = rep.names[upd.enemyId];
          if (!upd.ownName && rep.names[upd.ownId]) upd.ownName = rep.names[upd.ownId];
          if (JSON.stringify(upd) !== JSON.stringify(cur)) {
            saveLastWar(upd);
            postWarInfo = validLastWar();
          }
        }
        return;
      } catch (e) {
        respectNotice = `War report not available (${e.message}); showing recent attacks only.`;
      }
    }
    if (liveWar && liveWar.startTime) {
      try {
        respectMap = await buildWarScores(ownId, enemyFactionId, liveWar.startTime, 0);
        respectSource = 'calc';
        return;
      } catch (e) {
        respectNotice = `Full attack history not available (${e.message}); showing recent attacks only.`;
      }
    }
    respectMap = await fetchWarRespect(ownId, enemyFactionId);
    respectSource = 'live';
  }

  // Fetched when the Respect sort option is selected (or tapped again), and
  // refreshed every 90s while that view stays open -- never otherwise.
  async function refreshRespect() {
    if (respectLoading) return;
    const ownId = getOwnFactionId();
    if (!ownId || !enemyFactionId) {
      respectError = 'Need both your faction and the enemy faction detected first.';
      safeRender();
      return;
    }
    respectLoading = true;
    safeRender();
    try {
      await loadRespectFigures(ownId);
      respectFetchedAt = Date.now();
      // Diagnostic for the empty-result case (rather than a silent no-op):
      // tells us whether the log had zero relevant hits, versus some
      // filtering mismatch swallowing everything.
      respectError = Object.keys(respectMap).length === 0
        ? `No respect figures found for this war yet${warScan.seen ? ` (checked ${warScan.seen} attacks, ${warScan.paired} between the two factions)` : ''}.`
        : (respectNotice || null);
    } catch (e) {
      respectError = e.message;
    }
    respectLoading = false;
    safeRender();
  }

  // Is the Respect view the one currently on screen?
  function respectViewOpen() {
    if (showSettings || getCfg(STORE_KEYS.collapsed, false)) return false;
    if (!featureOn('sortBar') || !featureOn('respectSort')) return false;
    if (pageMode === 'home' || !enemyFactionId) return false;
    return currentSort().mode === 'respect' || (wideActive() && !!sortByTab.home && sortByTab.home.mode === 'respect');
  }

  // ---------------------------------------------------------------------
  // AUDIBLE CHAIN ALERTS (HOME chain only) -- generated tones via Web Audio,
  // no external file needed. One alert at 1:00 remaining, a higher-pitched
  // one at 0:30. Each is armed once per countdown cycle (tracked via the
  // two flags below) and re-armed once the chain climbs back above 60s
  // again (a fresh hit resetting the timer), so it doesn't repeat every
  // tick while sitting under the threshold.
  //
  // Caveat: browsers generally block audio playback until the page has
  // had at least one user interaction (a click/tap anywhere) -- this is a
  // browser policy, not something this script can override. The first
  // alert after loading the page may be silent if there's been no
  // interaction yet; any tap on the panel itself satisfies it.
  // ---------------------------------------------------------------------
  let homeChainAlertedMin = false;
  let homeChainAlertedHalfMin = false;

  function playBeep(highPitch) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = highPitch ? 1200 : 800;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => ctx.close();
    } catch (e) {
      // Audio unsupported/blocked -- nothing more we can do about it.
    }
  }

  function checkHomeChainAlerts() {
    if (!featureOn('chainAudio')) return;
    if (!ownChain.fetched || ownChain.current <= 0) return;
    if (ownChain.remaining > 60) {
      homeChainAlertedMin = false;
      homeChainAlertedHalfMin = false;
      return;
    }
    if (ownChain.remaining <= 60 && ownChain.remaining > 30 && !homeChainAlertedMin) {
      playBeep(false);
      homeChainAlertedMin = true;
    }
    if (ownChain.remaining <= 30 && ownChain.remaining > 0 && !homeChainAlertedHalfMin) {
      playBeep(true);
      homeChainAlertedHalfMin = true;
    }
  }

  let perfTickCount = 0;

  // ---------------------------------------------------------------------
  // ENERGY BAR (header)
  // Torn keeps its own sidebar energy bar live on almost every page, so read
  // it from there every second: no API calls at all. Pages without one fall
  // back to a single API read, with energy ticks counted locally.
  // ---------------------------------------------------------------------
  const energyState = { fromApi: null, apiAt: 0, lastTxt: '', missingSince: 0 };
  function readPageEnergy() {
    const els = document.querySelectorAll('a[class*="energy"], div[class*="energy"], li[class*="energy"], [id*="energy"]');
    for (const el of els) {
      if (el.closest('#tws-panel, #tws-popout')) continue;
      const txt = el.textContent || '';
      if (!/energy/i.test(`${el.className} ${txt}`)) continue;
      // Torn puts the value and the timer in separate elements ("10/150",
      // "09:38"), so read the smallest pieces rather than the joined text.
      let m = null;
      let timer = '';
      for (const c of el.querySelectorAll('*')) {
        if (c.children.length) continue;
        const ct = (c.textContent || '').trim();
        const mm = ct.match(/^(\d[\d,]*)\s*\/\s*(\d[\d,]*)$/);
        if (mm && !m) m = mm;
        else if (!timer && /^(\d{1,2}:\d{2}(:\d{2})?|FULL)$/i.test(ct)) timer = ct;
      }
      if (!m) m = txt.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
      if (!m) continue;
      const cur = parseInt(m[1].replace(/,/g, ''), 10);
      const max = parseInt(m[2].replace(/,/g, ''), 10);
      if (!max) continue;
      return { cur, max, timer };
    }
    return null;
  }
  function apiEnergyNow() {
    const e = energyState.fromApi;
    if (!e) return null;
    const elapsed = (Date.now() - energyState.apiAt) / 1000;
    let cur = e.cur;
    if (cur < e.max && e.interval > 0 && e.increment > 0 && elapsed >= e.ticktime) {
      const ticks = 1 + Math.floor((elapsed - e.ticktime) / e.interval);
      cur = Math.min(e.max, cur + ticks * e.increment);
    }
    return { cur, max: e.max, timer: '' };
  }
  async function fetchApiEnergy() {
    energyState.apiAt = Date.now(); // also throttles retries
    try {
      const d = await apiFetch('user', 'bars');
      const en = d && d.energy;
      if (en && en.maximum) {
        energyState.fromApi = {
          cur: Number(en.current) || 0, max: Number(en.maximum),
          increment: Number(en.increment) || 0, interval: Number(en.interval) || 0, ticktime: Number(en.ticktime) || 0,
        };
        energyState.apiAt = Date.now();
      }
    } catch (e) { /* keep what we had */ }
  }
  function updateEnergyBar() {
    if (!panel || !pcMode() || !featureOn('btnEnergy') || document.visibilityState === 'hidden') return;
    const box = panel.querySelector('#tws-energy');
    if (!box) return;
    let e = readPageEnergy();
    if (e) {
      energyState.missingSince = 0;
    } else {
      if (!energyState.missingSince) energyState.missingSince = Date.now();
      // No energy bar on this page for 5s: read it from the API (at most
      // every 10 minutes), counting ticks locally in between.
      if (Date.now() - energyState.missingSince > 5000 && Date.now() - energyState.apiAt > 10 * 60 * 1000) fetchApiEnergy();
      e = apiEnergyNow();
    }
    const txt = e ? `${e.cur} / ${e.max}` : '\u2013';
    if (txt === energyState.lastTxt && !e) return;
    energyState.lastTxt = txt;
    const t = box.querySelector('.tws-energy-txt');
    if (t.textContent !== txt) t.textContent = txt;
    const pct = e ? Math.max(0, Math.min(100, (e.cur / e.max) * 100)) : 0;
    const fill = box.querySelector('.tws-energy-fill');
    const w = `${pct.toFixed(1)}%`;
    if (fill.style.width !== w) fill.style.width = w;
    box.title = e ? `Energy ${e.cur}/${e.max}${e.timer ? ` \u00b7 ${e.timer}` : ''}${e.cur > e.max ? ' (over max)' : ''}` : 'Energy';
  }
  // ---- drug cooldown bar ----
  // API read (cooldowns) when Torn opens, at most every 10 minutes after
  // that, and straight away when Torn's own drug-cooldown icon appears;
  // counted down locally every second in between.
  const drugState = { rem: null, at: 0, fetchedAt: 0, iconSeen: null, max: 0 };
  function drugIconOnPage() {
    const els = document.querySelectorAll('#sidebarroot [aria-label], #sidebarroot [title], [class*="status-icons"] [aria-label], [class*="status-icons"] [title]');
    for (const el of els) {
      if (/drug cooldown/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`)) return true;
    }
    return false;
  }
  async function fetchDrugCooldown() {
    drugState.fetchedAt = Date.now();
    try {
      const d = await apiFetch('user', 'cooldowns');
      if (d && d.cooldowns && d.cooldowns.drug != null) {
        drugState.rem = Math.max(0, Number(d.cooldowns.drug) || 0);
        drugState.at = Date.now();
        if (drugState.rem > drugState.max) drugState.max = drugState.rem;
        try { setCfg('tws_drug_max', drugState.max); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* keep what we had */ }
  }
  function updateDrugBar() {
    if (!panel || !pcMode() || !featureOn('btnDrug') || document.visibilityState === 'hidden') return;
    const box = panel.querySelector('#tws-drug');
    if (!box) return;
    if (!drugState.max) drugState.max = Number(getCfg('tws_drug_max', 0)) || 0;
    const icon = drugIconOnPage();
    const iconChanged = drugState.iconSeen !== null && icon !== drugState.iconSeen;
    drugState.iconSeen = icon;
    if (drugState.fetchedAt === 0 || (iconChanged && icon) || Date.now() - drugState.fetchedAt > 10 * 60 * 1000) fetchDrugCooldown();
    const rem = drugState.rem == null ? null : Math.max(0, drugState.rem - Math.floor((Date.now() - drugState.at) / 1000));
    if (rem === 0 && drugState.max) { drugState.max = 0; try { setCfg('tws_drug_max', 0); } catch (e) { /* ignore */ } }
    const p2 = (x) => String(x).padStart(2, '0');
    const txt = rem == null ? '\u2013' : rem > 0 ? `${Math.floor(rem / 3600)}:${p2(Math.floor(rem / 60) % 60)}:${p2(rem % 60)}` : 'Ready';
    const t = box.querySelector('.tws-energy-txt');
    if (t.textContent !== txt) t.textContent = txt;
    box.classList.toggle('tws-drug-ready', rem === 0);
    const pct = rem === 0 ? 100 : (rem && drugState.max ? Math.max(0, Math.min(100, (1 - rem / drugState.max) * 100)) : 0);
    const fill = box.querySelector('.tws-energy-fill');
    const w = `${pct.toFixed(1)}%`;
    if (fill.style.width !== w) fill.style.width = w;
    box.title = rem == null ? 'Drug cooldown' : rem > 0 ? `Drug cooldown: ${txt} left` : 'No drug cooldown';
  }

  function tickCountdowns__raw() {
    try { updateEnergyBar(); } catch (e) { /* ignore */ }
    try { updateDrugBar(); } catch (e) { /* ignore */ }
    try {
      const ck = panel && pcMode() && featureOn('btnClock') ? panel.querySelector('#tws-clock') : null;
      if (ck) {
        const n = new Date();
        const p2 = (x) => String(x).padStart(2, '0');
        const t = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][n.getUTCDay()]} ${p2(n.getUTCHours())}:${p2(n.getUTCMinutes())}:${p2(n.getUTCSeconds())}`;
        if (ck.textContent !== t) ck.textContent = t;
      }
    } catch (e) { /* ignore */ }
    const mode = perfMode();
    if (mode !== 'full' && document.visibilityState === 'hidden') return;
    const nowS = Date.now() / 1000;
    let freedNow = false;
    const tick = (arr) => arr.map((m) => {
      // Timer hit zero: show them as out (green ATK) now, not at the next API poll.
      if (timerOver(m.state, m.description, m.until, nowS)) {
        freedNow = true;
        return { ...m, state: 'Okay', description: 'Okay', until: 0, remaining: 0 };
      }
      return {
        ...m,
        remaining: (mode !== 'full' && m.until)
          ? Math.max(0, Math.round(m.until - nowS))
          : (m.remaining > 0 ? Math.max(0, m.remaining - 1) : 0),
      };
    });
    enemyMembers = tick(enemyMembers);
    homeMembers = tick(homeMembers);
    // Both chain timers are recomputed from what Torn reported at the last
    // fetch (timeout / cooldownBase) minus the time since then -- NOT by
    // subtracting from the previous tick's value, which double-counts.
    [ownChain, enemyChain].forEach((c) => {
      if (c.lastFetch) {
        const elapsed = Math.round((Date.now() - c.lastFetch) / 1000);
        c.remaining = Math.max(0, c.timeout - elapsed);
        c.cooldown = Math.max(0, (c.cooldownBase || 0) - elapsed);
      }
    });
    // Home chain: follow Torn's own clock on the page when there is one.
    try {
      if (ownChain.fetched && ownChain.current > 0) {
        const ps = readPageChainSecs();
        if (ps !== null && Math.abs(ps - ownChain.remaining) >= 2) {
          ownChain.timeout = ps;
          ownChain.remaining = ps;
          ownChain.lastFetch = Date.now();
        }
        ownChain.pageSync = ps !== null;
      }
    } catch (e) { /* ignore */ }
    checkHomeChainAlerts();
    tickRetalTimers();
    ensureSosButton();
    try { watchRevivesPopout(); } catch (e) { /* ignore */ }
    try { tickPoLife(); } catch (e) { /* ignore */ }
    try { tickTempQuick(); } catch (e) { /* ignore */ }
    try { kiRenderEnemyTab(); } catch (e) { /* ignore */ }
    try { kiTickPopoutAvatar(); } catch (e) { /* ignore */ }
    perfTickCount++;
    if (mode === 'full' || perfTickCount % 3 === 0) runBloodHighlight();
    renderTravelPopup();
    // While the Respect view is open, keep its numbers reasonably fresh.
    if (respectViewOpen() && !respectLoading && Date.now() - respectFetchedAt > RESPECT_REFRESH_MS) {
      refreshRespect();
    }
    // Wide mode: timers tick in place every second; full redraw every 5s.
    if (freedNow || (mode === 'full' && (!wideActive() || perfTickCount % 5 === 0))) safeRender(); else updateInPlace();
    if (wideActive() && perfTickCount % 5 === 0) renderAtkLog();
  }

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------
  GM_addStyle(`
    #tws-panel {
      position: fixed;
      top: 80px;
      right: 10px;
      width: 300px;
      height: 95vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #1a1a1a;
      color: #eee;
      border: 1px solid #444;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    #tws-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      background: #2a2a2a;
      border-bottom: 1px solid #444;
      cursor: move;
      border-radius: 8px 8px 0 0;
      touch-action: none;
      flex-shrink: 0; height: auto; min-height: 32px;
      z-index: 100;
    }
    #tws-access { flex-shrink: 0; min-height: 20px; }
    #tws-header b { color: #ff6b6b; white-space: nowrap; }
    #tws-panel.tws-pc #tws-title, #tws-panel.tws-pc #tws-logo { cursor: pointer; }
    #tws-panel.tws-pc #tws-title:hover { text-decoration: underline; }
    #tws-hflash {
      display: none; padding: 3px 10px; border-radius: 8px; border: 1px solid #666;
      background: #222; color: #fff; font-size: 12px; font-family: Arial, sans-serif;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;
    }
    #tws-hflash svg { vertical-align: -2px; margin-right: 5px; }
    #tws-hflash.tws-hflash-hosp { background: #4a1e1e; border-color: #d94c4c; color: #ffd0d0; font-weight: bold; white-space: nowrap; font-size: 11px; padding: 3px 7px; max-width: 82%; }
    #tws-hflash.tws-hflash-hosp svg { margin: 0 5px 0 0; }
    #tws-hflash.tws-hflash-hosp svg:last-child { margin: 0 0 0 5px; }
    #tws-hflash.tws-hflash-out { background: #1e4620; border-color: #2e7d32; color: #a8fca8; font-weight: bold; font-size: 11px; max-width: 82%; }
    #tws-hflash.tws-hflash-low { background: #4a3d1e; border-color: #e0a030; color: #ffd27c; font-weight: bold; animation: tws-flash 1s infinite; }

    /* ---- Minimised panel = the Kraken logo ---- */
    #tws-logo {
      display: none;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(110,190,220,0.55);
      -webkit-user-drag: none;
      user-select: none;
    }
    /* Collapsed/minimised: shrink to the header only, so no invisible
       full-height box is left covering Torn's own buttons. */
    #tws-panel.tws-collapsed { height: auto !important; }
    #tws-panel.tws-perf-lite .tws-name-flash, #tws-panel.tws-perf-lite .tws-chain-danger,
    #tws-panel.tws-perf-lite #tws-hflash { animation: none !important; }
    #tws-panel.tws-mini {
      width: 46px !important;
      max-height: none;
      overflow: visible;
      background: transparent;
      border: none;
      box-shadow: none;
    }
    #tws-panel.tws-mini #tws-header {
      padding: 2px;
      background: transparent;
      border: none;
      border-radius: 50%;
      justify-content: center;
    }
    #tws-panel.tws-mini #tws-header > *:not(#tws-logo) { display: none !important; }
    #tws-panel.tws-mini #tws-logo { display: block; }
    #tws-panel.tws-mini #tws-access { display: none !important; }
    #tws-panel.tws-mini.tws-mini-dock { width: auto !important; }
    #tws-panel.tws-mini.tws-mini-dock #tws-header { padding: 0; }
    #tws-panel.tws-mini.tws-mini-dock #tws-logo { width: var(--tws-dock-size, 34px); height: var(--tws-dock-size, 34px); box-shadow: 0 0 5px rgba(110,190,220,0.5); }

    /* Header fit: the buttons never shrink; the title becomes the octopus and
       the enemy name hides (never cut short) when there isn't room. */
    #tws-header #tws-hbtns { flex-shrink: 0; white-space: nowrap; }
    #tws-title .tws-title-short { display: none; }
    #tws-header.tws-hfit #tws-title, #tws-header.tws-hfit .tws-enemy-name { flex-shrink: 0; }
    #tws-header.tws-hfit .tws-enemy-name { max-width: none; text-overflow: clip; }
    #tws-header.tws-hfit #tws-hflash { flex-shrink: 1; min-width: 0; }
    #tws-header.tws-h-short #tws-title .tws-title-txt { display: none; }
    #tws-header.tws-h-short #tws-title .tws-title-short { display: inline; font-size: 18px; vertical-align: middle; }
    #tws-header.tws-h-noenemy .tws-enemy-name { display: none !important; }
    #tws-header.tws-h-noclock #tws-clock { display: none !important; }
    .tws-enemy-name {
      color: #999;
      font-size: 10px;
      display: block;
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #tws-body { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    #tws-static { flex-shrink: 0; overflow: hidden; padding: 8px 10px 4px 10px; }
    #tws-roster > #tws-static { padding: 8px 0 4px 0; overflow: visible; }
    #tws-roster { overflow-y: auto; overscroll-behavior: contain; padding: 0 8px 8px 10px; }
    /* PC Mode wide layout. Outside PC Mode the wrapper is layout-neutral. */
    #tws-wide { display: contents; }
    #tws-panel.tws-wide-on #tws-wide { display: flex; flex: 1; min-height: 0; overflow: hidden; }
    .tws-set-split { display: grid; grid-template-columns: minmax(300px, 1fr) minmax(0, 2fr); gap: 16px; align-items: start; }
    .tws-set-split > .tws-set-col { min-width: 0; }
    .tws-set-split > .tws-set-col > #tws-settings { max-height: calc(100vh - 150px); overflow-y: auto; padding-right: 4px; }
    .tws-set-split > .tws-set-r { border-left: 1px solid #333; padding-left: 14px; }
    .tws-set-split > .tws-set-r > #tws-settings { column-count: 2; column-gap: 20px; }
    .tws-set-split > .tws-set-r > #tws-settings > * { break-inside: avoid; }
    .tws-set-split > .tws-set-r .tws-adv-group { break-after: avoid; }
    #tws-panel.tws-wide-on #tws-wide > #tws-body { flex: 1 1 0; min-width: 0; }
    #tws-panel:not(.tws-wide-on) .tws-wide-col { display: none !important; }
    .tws-wide-col { flex: 1 1 0; min-width: 0; min-height: 0; overflow: hidden; border-left: 1px solid #444; }
    #tws-col3 { display: flex; flex-direction: column; }
    #tws-body-target, #tws-wide-log { flex: 1 1 0; min-height: 0; overflow: hidden; }
    #tws-wide-log { display: flex; flex-direction: column; }
    #tws-wide-log #tws-atklog { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0 8px 0 10px; }
    #tws-wide-log .tws-log-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
    #tws-col3.tws-split #tws-wide-log { border-top: 2px solid #555; }
    .tws-col-title { text-align: center; font-weight: bold; color: #ff6b6b; padding: 4px 0 6px; border-bottom: 1px solid #333; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tws-log-head { flex-shrink: 0; padding: 8px 10px 0 10px; }
    .tws-chain-box {
      text-align: center;
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 16px;
      font-weight: bold;
      position: relative;
    }
    .tws-chain-tag {
      display: block;
      font-size: 10px;
      font-weight: normal;
      letter-spacing: 0.5px;
      opacity: 0.75;
      margin-bottom: 2px;
    }
    .tws-chain-safe { background: #1e4620; color: #7cfc7c; }
    .tws-chain-warn { background: #4a3d1e; color: #ffd27c; }
    .tws-chain-danger { background: #4a1e1e; color: #ff7c7c; animation: tws-flash 1s infinite; }
    .tws-chain-red { background: #4a1e1e; color: #ff7c7c; }
    .tws-chain-cooldown { background: #2a2a3a; color: #9aa5d1; font-size: 14px; }
    .tws-chain-dead { background: #2a2a2a; color: #888; }
    .tws-chain-loading { background: #232323; color: #777; font-size: 13px; }
    @keyframes tws-flash { 50% { opacity: 0.4; } }

    /* ---- Ranked-war result message ---- */
    .tws-warend {
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 8px;
      text-align: center;
      font-size: 12px;
      font-weight: bold;
      line-height: 1.35;
    }
    .tws-warend small { display: block; margin-top: 3px; font-size: 10px; font-weight: normal; opacity: 0.8; }
    .tws-warend-win { background: #1e4620; color: #a8fca8; border: 1px solid #2e7d32; }
    .tws-warend-lose { background: #4a1e1e; color: #ffabab; border: 1px solid #7d2e2e; }
    .tws-warend-neutral { background: #2a2a3a; color: #cbd3f5; border: 1px solid #4c4c7a; }

    .tws-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      border-bottom: 1px solid #2f2f2f;
    }
    .tws-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    .tws-name.tws-copied-flash { background: #1e4620; border-radius: 4px; }
    .tws-name.tws-copy-failed-flash { background: #4a1e1e; border-radius: 4px; }
    .tws-name-link { color: inherit; text-decoration: none; }
    .tws-name-link:active { text-decoration: underline; }
    .tws-name-online { color: #7cfc7c; }
    .tws-name-idle { color: #ffd27c; }
    .tws-name-offline { color: #9a9a9a; }
    .tws-est { color: #4da6ff; font-weight: normal; }
    .tws-est .tws-est-bsp { color: #9fd3ff; }
    #tws-panel.tws-theme-kraken .tws-name-offline { color: #ff7c7c; }
    #tws-panel.tws-theme-kraken .tws-est { color: inherit; opacity: 0.7; }
    #tws-panel.tws-theme-kraken .tws-est .tws-est-bsp { color: #7fc4ff; }
    #tws-panel.tws-theme-ff .tws-est { opacity: 0.9; }
    #tws-panel .tws-est.tws-est-ff .tws-est-bsp { color: inherit !important; }
    .tws-ffdot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: middle; background: #777; }
    .tws-ffdot.tws-ffdot-on { background: #7cfc7c; }
    .tws-ffdot.tws-ffdot-idle { background: #ffd27c; }
    .tws-ffdot.tws-ffdot-off { background: #777; }
    .tws-ffval { font-weight: bold; }
    .tws-name-flash { animation: tws-flash 1s infinite; }
    .tws-star { cursor: pointer; color: #555; font-size: 13px; }
    .tws-star.tws-star-active { color: #ffd700; }
    .tws-star { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
    .tws-star[data-hold="1"] { transition: transform .5s linear, text-shadow .5s linear; display: inline-block; }
    .tws-star.tws-star-holding { transform: scale(1.45); text-shadow: 0 0 8px #ffd700; }
    .tws-copy-icon { cursor: pointer; color: #6ab0de; font-size: 13px; }
    .tws-bounty-icon { cursor: pointer; font-size: 12px; border-radius: 4px; padding: 0 2px; text-decoration: none; filter: grayscale(1) brightness(0.7); }
    .tws-time { min-width: 60px; text-align: right; margin-right: 6px; white-space: nowrap; }
    .tws-status-hospital { color: #ff7c7c; }
    .tws-status-okay { color: #7cfc7c; }
    .tws-respect { color: #7ec8e3; opacity: 0.9; }
    .tws-torn-flag {
      display: inline-block;
      background: #000;
      color: #888;
      font-weight: bold;
      font-size: 9px;
      padding: 0 3px;
      border-radius: 2px;
      line-height: 1.4;
    }
    .tws-atk {
      background: #2e7d32;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 3px 8px;
      text-decoration: none;
      font-size: 11px;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    .tws-sos-btn.tws-sos-busy { opacity: 0.6; }
    .tws-retal-cd {
      display: inline-block;
      margin-left: 3px;
      padding: 0 4px;
      border-radius: 3px;
      background: #1b1b1b;
      color: #ff4d4d;
      font-weight: bold;
      font-family: monospace;
      font-size: 11px;
      line-height: 14px;
    }
    .tws-atk.tws-atk-travel { background: #000; color: #fff; border: 1px solid #555; }
    .tws-atk.tws-atk-disabled {
      background: #444;
      color: #888;
    }
    .tws-atk.tws-copied-flash { background: #1e4620 !important; color: #7cfc7c !important; }
    .tws-atk.tws-copy-failed-flash { background: #4a1e1e !important; color: #ff7c7c !important; }
    #tws-settings {
      overflow-y: auto;
      min-height: 0;
    }
    #tws-settings input, #tws-settings select {
      width: 100%;
      margin-bottom: 6px;
      box-sizing: border-box;
      background: #111;
      color: #eee;
      border: 1px solid #444;
      padding: 4px;
    }
    #tws-settings button {
      width: 100%;
      padding: 6px;
      background: #444;
      color: #eee;
      border: none;
      border-radius: 4px;
    }

    /* ---- Credit / contact card (Settings) ---- */
    .tws-credit {
      border: 2px solid #4fb3d9;
      background: linear-gradient(135deg, #12303d 0%, #1a1a1a 100%);
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 10px;
      text-align: center;
      box-shadow: 0 0 10px rgba(79,179,217,0.35);
    }
    .tws-credit img {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(110,190,220,0.6);
    }
    .tws-credit-title { margin-top: 6px; font-size: 13px; font-weight: bold; color: #fff; line-height: 1.3; }
    .tws-credit-contact { margin-top: 6px; font-size: 15px; font-weight: bold; color: #7fd6ff; }
    .tws-credit-contact a { color: #ffd27c; text-decoration: underline; }
    .tws-credit-mini {
      margin-top: 10px;
      padding: 6px;
      border: 1px solid #4fb3d9;
      border-radius: 6px;
      text-align: center;
      font-size: 11px;
      color: #cfefff;
    }
    .tws-credit-mini a { color: #ffd27c; font-weight: bold; }

    /* ---- Advanced settings (feature toggles) ---- */
    .tws-adv-group {
      margin: 10px 0 4px;
      padding-bottom: 2px;
      border-bottom: 1px solid #333;
      color: #ff6b6b;
      font-size: 11px;
      font-weight: bold;
    }
    #tws-settings .tws-adv-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 5px 0;
      font-size: 12px;
    }
    #tws-settings .tws-adv-row input {
      width: auto;
      flex: none;
      margin: 2px 0 0 0;
      transform: scale(1.25);
    }
    .tws-adv-row small { display: block; color: #888; font-size: 10px; }
    .tws-adv-sub { margin-left: 18px; }
    .tws-adv-dim { opacity: 0.45; }

    /* ---- On/off switches (every checkbox in Settings) ----
       A light-grey knob that slides across a dark track; the uncovered half
       glows red "OFF" or green "ON". Pure CSS on the real checkbox, so every
       existing handler keeps working unchanged. */
    #tws-settings input[type="checkbox"] {
      -webkit-appearance: none;
      appearance: none;
      position: relative;
      flex: none;
      width: 46px !important;
      height: 22px;
      margin: 0 !important;
      padding: 0 !important;
      border-radius: 11px;
      border: 1px solid #5a2323;
      cursor: pointer;
      transform: none !important;
      background: radial-gradient(circle at 72% 50%, #8a2222 0%, #4a1111 55%, #1f0707 100%);
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.75), 0 0 5px rgba(255,80,80,0.18);
      transition: background 0.2s, box-shadow 0.2s, border-color 0.2s;
      vertical-align: middle;
    }
    #tws-settings input[type="checkbox"]::before {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 16px;
      border-radius: 8px;
      background: linear-gradient(180deg, #f2f2f2 0%, #c9c9c9 100%);
      box-shadow: 0 1px 2px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(0,0,0,0.15);
      transition: left 0.2s;
    }
    #tws-settings input[type="checkbox"]::after {
      content: 'OFF';
      position: absolute;
      top: 50%;
      right: 4px;
      transform: translateY(-50%);
      font: bold 8px/1 Arial, sans-serif;
      letter-spacing: 0.3px;
      color: #ff7a7a;
      text-shadow: 0 0 4px rgba(255,70,70,0.95);
    }
    #tws-settings input[type="checkbox"]:checked {
      border-color: #2d6b3e;
      background: radial-gradient(circle at 28% 50%, #1f8a40 0%, #0f4a22 55%, #071f0e 100%);
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.75), 0 0 6px rgba(80,230,120,0.3);
    }
    #tws-settings input[type="checkbox"]:checked::before { left: 24px; }
    #tws-settings input[type="checkbox"]:checked::after {
      content: 'ON';
      right: auto;
      left: 6px;
      color: #6dff97;
      text-shadow: 0 0 4px rgba(80,255,130,0.95);
    }
    #tws-settings input[type="checkbox"]:focus-visible { outline: 2px solid #4fb3d9; outline-offset: 2px; }
    #tws-settings .tws-adv-row { align-items: center; }
    #tws-settings input[type="checkbox"]:disabled { opacity: 0.5; cursor: wait; }

    /* ---- Bounty amounts editor ---- */
    .tws-bty-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 5px;
      font-size: 11px;
    }
    #tws-settings .tws-bty-row input {
      width: 68px;
      margin: 0;
      padding: 3px;
    }
    .tws-bty-row span { white-space: nowrap; }
    .tws-bty-del { cursor: pointer; color: #ff7c7c; padding: 0 5px; font-size: 13px; }

    .tws-error { color: #ff7c7c; font-size: 11px; margin-top: 6px; }
    .tws-gear { cursor: pointer; }
    .tws-blood-btn { cursor: pointer; opacity: 0.7; margin-right: 6px; text-decoration: none; display: inline-block; }
    .tws-items-btn { cursor: pointer; opacity: 0.9; margin-right: 6px; text-decoration: none; display: inline-block; vertical-align: middle; line-height: 0; }
    .tws-items-btn svg { display: block; }
    .tws-energy { display: inline-flex; flex-direction: column; justify-content: center; vertical-align: middle; width: 78px; margin-right: 8px; line-height: 1; }
    .tws-energy-top { display: flex; align-items: center; gap: 4px; }
    .tws-energy-bolt { flex-shrink: 0; }
    .tws-energy-txt { font: 11px Arial, sans-serif; color: #c9c9c9; white-space: nowrap; letter-spacing: 0.2px; }
    .tws-energy-track { position: relative; display: block; height: 4px; margin-top: 3px; background: #c8c8c8; border-radius: 1px; overflow: hidden; }
    .tws-energy-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(#8cc63f, #5b9a1f); transition: width 0.4s; }
    #tws-title .tws-clock { cursor: default; }
    .tws-clock { display: inline-block; vertical-align: middle; margin-left: 6px; font: bold 12px Arial, sans-serif; color: #b5b5b5; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tws-drug .tws-energy-fill { background: linear-gradient(#b5e6ff, #5cb6ec); }
    .tws-drug.tws-drug-ready .tws-energy-txt { color: #8cc63f; }
    .tws-rev-btn {
      display: inline-block;
      vertical-align: middle;
      margin-right: 7px;
      padding: 1px 7px;
      background: #c9413c;
      color: #fff;
      border: 2px solid #f1d6d3;
      border-radius: 8px;
      font-size: 11px;
      font-weight: bold;
      line-height: 1.35;
      text-decoration: none;
      cursor: pointer;
    }
    .tws-rev-btn:active { filter: brightness(0.85); }
    .tws-rev-btn.tws-rev-off { background: #555; border-color: #8a8a8a; color: #aaa; cursor: default; opacity: 0.75; }
    .tws-tri {
      display: flex;
      border: 1px solid #444;
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      margin: 2px 0 4px;
      -webkit-user-select: none;
      user-select: none;
    }
    .tws-tri span {
      flex: 1;
      text-align: center;
      padding: 8px 0;
      font-size: 12px;
      font-weight: bold;
      color: #888;
      background: #262626;
    }
    .tws-tri span + span { border-left: 1px solid #444; }
    .tws-tri span.tws-tri-off { background: #c9413c; color: #fff; }
    .tws-tri span.tws-tri-friends { background: #e08a1e; color: #fff; }
    .tws-tri span.tws-tri-on { background: #2e9e4a; color: #fff; }
    .tws-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 6px;
    }
    .tws-tab {
      flex: 1;
      text-align: center;
      padding: 4px 0;
      border-radius: 4px;
      background: #2a2a2a;
      color: #999;
      cursor: pointer;
      font-size: 11px;
    }
    .tws-tab.tws-tab-active {
      background: #444;
      color: #fff;
      font-weight: bold;
    }
    .tws-sortbar {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 6px;
    }
    .tws-sort-btn {
      padding: 2px 8px;
      border-radius: 4px;
      background: #262626;
      color: #999;
      cursor: pointer;
      font-size: 10px;
      border: 1px solid #3a3a3a;
    }
    .tws-sort-btn.tws-sort-active {
      background: #375a8c;
      color: #fff;
      border-color: #4c7ab8;
    }
    .tws-sort-dir {
      margin-left: auto;
      padding: 2px 8px;
      border-radius: 4px;
      background: #262626;
      color: #ccc;
      cursor: pointer;
      font-size: 10px;
      border: 1px solid #3a3a3a;
    }
    .tws-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }
    .tws-filter-chip {
      padding: 2px 7px;
      border-radius: 10px;
      background: #262626;
      color: #999;
      cursor: pointer;
      font-size: 10px;
      border: 1px solid #3a3a3a;
    }
    .tws-cl-banner { background: #12232d; border: 1px solid #4fb3d9; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; font-size: 12px; }
    .tws-cl-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; cursor: pointer; color: #cfefff; }
    .tws-cl-head span { color: #7fd6ff; font-size: 11px; white-space: nowrap; }
    .tws-cl-list { margin-top: 6px; max-height: 40vh; overflow-y: auto; }
    .tws-cl-ver { color: #ffd27c; font-weight: bold; font-size: 12px; margin-top: 4px; }
    .tws-cl-ver span { color: #888; font-weight: normal; font-size: 10px; }
    .tws-cl-list ul { margin: 2px 0 4px 16px; padding: 0; }
    .tws-cl-list li { margin: 2px 0; color: #ddd; font-size: 11px; }
    .tws-cl-btns { display: flex; gap: 6px; margin-top: 6px; }
    .tws-cl-btn { flex: 1; text-align: center; background: #2c3a44; color: #eee; border-radius: 5px; padding: 5px 0; font-size: 12px; cursor: pointer; text-decoration: none; }
    .tws-cl-btn.tws-cl-go { background: #375a8c; font-weight: bold; }
    .tws-cl-note { color: #888; font-size: 10px; margin-top: 4px; }
    .tws-log-chip {
      padding: 2px 7px;
      border-radius: 10px;
      background: #262626;
      color: #999;
      cursor: pointer;
      font-size: 10px;
      border: 1px solid #3a3a3a;
    }
    .tws-log-chip.tws-filter-active { background: #375a8c; color: #fff; border-color: #4c7ab8; }
    .tws-log-row { display: flex; align-items: center; gap: 6px; padding: 4px 4px 4px 6px; margin-bottom: 3px; border-left: 3px solid #555; background: #202020; border-radius: 3px; }
    .tws-log-row.tws-log-out { border-left-color: #2e7d32; }
    .tws-log-row.tws-log-in { border-left-color: #d94c4c; background: #261c1c; }
    .tws-log-row.tws-log-fail { opacity: 0.55; }
    .tws-log-time { color: #888; font-size: 10px; font-family: monospace; flex-shrink: 0; }
    .tws-log-main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
    .tws-log-main > span:first-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tws-log-sub { color: #aaa; font-size: 10px; }
    .tws-log-resp { color: #ffd27c; }
    .tws-log-res-lost { color: #ff5a5a; font-weight: bold; }
    .tws-log-arrow { color: #777; }
    #tws-atklog a.tws-log-own { color: #7fd1ff; text-decoration: none; }
    #tws-atklog a.tws-log-enemy { color: #ff8a8a; text-decoration: none; }
    #tws-atklog a.tws-log-other, #tws-atklog span.tws-log-other { color: #ccc; text-decoration: none; }
    .tws-log-badges { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
    #tws-atklog .tws-atk.tws-log-outside { background: #7b3fc4; white-space: nowrap; cursor: default; }
    .tws-log-when { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; line-height: 1.25; }
    .tws-log-dir { font-size: 9px; font-weight: bold; color: #888; }
    .tws-log-dir-out { color: #66d17a; }
    .tws-log-dir-in { color: #ff7070; }
    .tws-log-foot { color: #777; font-size: 10px; padding: 6px 0 2px; margin-top: 4px; border-top: 1px solid #333; }
    .tws-filter-chip.tws-filter-active {
      background: #375a8c;
      color: #fff;
      border-color: #4c7ab8;
    }

    /* ---- Pop-out window ---- */
    #tws-popout {
      position: fixed;
      top: 4vh;
      left: 2vw;
      width: 96vw;
      height: 90vh;
      background: #111;
      border: 1px solid #555;
      border-radius: 8px;
      z-index: 100001;
      display: none;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 6px 24px rgba(0,0,0,0.7);
      font-family: Arial, sans-serif;
    }
    #tws-popout.tws-po-min { height: auto !important; }
    .tws-po-rs { position: absolute; z-index: 5; }
    .tws-po-rs-n { top: 0; left: 12px; right: 12px; height: 6px; cursor: ns-resize; }
    .tws-po-rs-s { bottom: 0; left: 12px; right: 12px; height: 6px; cursor: ns-resize; }
    .tws-po-rs-e { right: 0; top: 12px; bottom: 12px; width: 6px; cursor: ew-resize; }
    .tws-po-rs-w { left: 0; top: 12px; bottom: 12px; width: 6px; cursor: ew-resize; }
    .tws-po-rs-ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
    .tws-po-rs-sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
    .tws-po-rs-nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
    .tws-po-rs-se { bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize; }
    #tws-popout.tws-po-min .tws-po-rs { display: none; }
    #tws-popout.tws-po-min #tws-po-frame,
    #tws-popout.tws-po-min #tws-po-msg { display: none !important; }
    #tws-po-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 6px 2px 10px;
      background: #2a2a2a;
      border-radius: 8px 8px 0 0;
      color: #eee;
      font-size: 13px;
    }
    #tws-welcome { position: fixed; inset: 0; z-index: 2147483640; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 14px; box-sizing: border-box; animation: tws-wel-in .35s ease-out; }
    @keyframes tws-wel-in { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: scale(1); } }
    #tws-welcome .tws-wel-card { width: min(440px, 100%); max-height: 90vh; overflow-y: auto; background: #1d2228; border: 2px solid #3f8fb0; border-radius: 10px; box-shadow: 0 0 22px rgba(63,143,176,.55); color: #e8e8e8; font: 14px/1.45 Arial, sans-serif; padding: 16px 18px; box-sizing: border-box; }
    #tws-welcome .tws-wel-title { font-size: 18px; font-weight: bold; color: #7fd0ef; margin-bottom: 8px; }
    #tws-welcome p { margin: 8px 0; color: #e8e8e8; }
    #tws-welcome ul { margin: 6px 0 6px 18px; padding: 0; }
    #tws-welcome li { margin: 4px 0; color: #e8e8e8; }
    #tws-welcome .tws-wel-access { margin: 4px 0 2px; padding: 6px 8px; background: #11161b; border-radius: 6px; font: 12px/1.5 monospace; color: #b9e6f7; }
    #tws-welcome .tws-wel-btns { display: flex; gap: 8px; margin-top: 12px; }
    #tws-welcome button { flex: 1; padding: 10px; border-radius: 6px; border: none; font: bold 14px Arial, sans-serif; color: #fff; cursor: pointer; }
    #tws-welcome #tws-wel-settings { background: #2e7d32; }
    #tws-welcome #tws-wel-ok { background: #3a4550; }
    #tws-ew-tab { position: fixed; right: 0; top: 42%; z-index: 2147483100; display: none; align-items: center; justify-content: center; width: 22px; padding: 12px 0; background: #2a2a2a; border: 1px solid #555; border-right: none; border-radius: 8px 0 0 8px; color: #ddd; cursor: pointer; box-shadow: -2px 2px 6px rgba(0,0,0,.5); transition: right .25s; }
    #tws-ew-tab span { writing-mode: vertical-rl; transform: rotate(180deg); font: bold 11px Arial, sans-serif; letter-spacing: 2px; }
    #tws-ew-tab.tws-ew-tab-open { right: min(300px, 82vw); }
    #tws-ew-drawer { position: fixed; top: 6vh; right: 0; z-index: 2147483100; width: min(300px, 82vw); max-height: 88vh; overflow-y: auto; background: #1e1e1e; border: 1px solid #555; border-right: none; border-radius: 8px 0 0 8px; box-shadow: -4px 0 12px rgba(0,0,0,.6); color: #ddd; font: 12px Arial, sans-serif; padding: 8px; box-sizing: border-box; transform: translateX(105%); transition: transform .25s; }
    #tws-ew-drawer.tws-ew-open { transform: translateX(0); }
    #tws-ew-drawer .tws-ew-head { display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-bottom: 2px; }
    #tws-ew-drawer .tws-ew-x { cursor: pointer; font-size: 20px; line-height: 1; padding: 0 4px; color: #aaa; }
    #tws-ew-drawer .tws-ew-age { color: #999; font-size: 11px; margin-bottom: 8px; }
    #tws-ew-drawer .tws-ew-msg { color: #aaa; padding: 10px 2px; }
    #tws-ew-drawer .tws-ew-weapons { display: flex; flex-direction: column; gap: 6px; }
    #tws-ew-drawer .tws-ew-box { background: linear-gradient(#3b3b3b, #2e2e2e); border: 1px solid #4a4a4a; border-radius: 3px; padding: 6px 8px 8px; text-align: center; }
    #tws-ew-drawer .tws-ew-box.tws-ew-yellow { border-color: #b8b33a; background: linear-gradient(#4a4a2a, #34331f); }
    #tws-ew-drawer .tws-ew-box.tws-ew-orange { border-color: #c27a2c; background: linear-gradient(#4a3a26, #34291c); }
    #tws-ew-drawer .tws-ew-box.tws-ew-red { border-color: #b23a3a; background: linear-gradient(#4a2a2a, #341e1e); }
    #tws-ew-drawer .tws-ew-slot { display: flex; justify-content: space-between; color: #9a9a9a; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    #tws-ew-drawer .tws-ew-img { display: block; max-width: 85%; max-height: 60px; margin: 4px auto; }
    #tws-ew-drawer .tws-ew-name { font-weight: bold; color: #fff; }
    #tws-ew-drawer .tws-ew-stats { color: #e8a0a0; margin-top: 2px; }
    #tws-ew-drawer .tws-ew-stats b { color: #ffb4b4; }
    #tws-ew-drawer .tws-ew-bonuses { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; }
    #tws-ew-drawer .tws-ew-bonus { background: #5a3a1e; color: #ffd9a8; border-radius: 9px; padding: 1px 6px; font-size: 10px; }
    #tws-ew-drawer .tws-ew-bonus.is-yellow { background: rgba(232, 212, 77, .2); color: #f2e27a; border: 1px solid rgba(232, 212, 77, .6); }
    #tws-ew-drawer .tws-ew-bonus.is-orange { background: rgba(240, 147, 43, .2); color: #ffb35c; border: 1px solid rgba(240, 147, 43, .65); }
    #tws-ew-drawer .tws-ew-bonus.is-red { background: rgba(232, 65, 60, .2); color: #ff7a74; border: 1px solid rgba(232, 65, 60, .65); }
    #tws-ew-drawer .tws-ew-empty .tws-ew-none { color: #777; padding: 10px 0; }
    #tws-ew-drawer .tws-ew-sub { margin: 10px 0 4px; color: #9a9a9a; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    #tws-ew-drawer .tws-ew-arm { padding: 4px 0; border-top: 1px solid #333; }
    #tws-ew-drawer .tws-ew-arm-slot { color: #9a9a9a; }
    #tws-ew-drawer .tws-ew-arm-bon { color: #ffd9a8; font-size: 11px; }
    .tws-po-btn.tws-po-bag-confirm { background: #2e7d32 !important; color: #fff !important; border-radius: 6px; padding: 2px 8px !important; font-weight: bold; animation: tws-flash 1s infinite; }
    #tws-temp-quick { display: flex; gap: 6px; padding: 6px 8px; background: #1a1a1a; border-bottom: 1px solid #333; }
    #tws-temp-quick .tws-tq-btn { flex: 1; min-width: 0; border: 1px solid #3c6e3e; background: #24402a; color: #e8ffe8; border-radius: 6px; padding: 5px 2px; font: bold 12px Arial, sans-serif; cursor: pointer; line-height: 1.25; text-align: center; }
    #tws-temp-quick .tws-tq-btn small { display: block; font-weight: normal; font-size: 10px; color: #b5d8b5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #tws-temp-quick .tws-tq-btn.tws-tq-none { background: #2a2a2a; border-color: #444; color: #888; }
    #tws-temp-quick .tws-tq-btn.tws-tq-none small { color: #777; }
    #tws-po-stats { padding: 3px 10px 4px; background: #1a1a1a; border-bottom: 1px solid #333; font: 12px Arial, sans-serif; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #tws-po-stats b { color: #fff; }
    .tws-ts-spy { margin: 4px 0 6px; padding: 4px 8px; border-radius: 6px; background: #1d2a1f; border: 1px solid #2f5a35; color: #cfe8cf; font: 12px Arial, sans-serif; }
    .tws-ts-spy b { color: #fff; }
    .tws-ts-spy .tws-ts-age { color: #9ab79a; }
    .tws-ts-spy.tws-ts-old { background: #2a2620; border-color: #5a4a2f; color: #e0cfa8; }
    #tws-po-stats .tws-po-bspwhy { color: #e0a030; }
    #tws-po-life { display: flex; align-items: center; gap: 8px; padding: 3px 10px 5px; background: #1a1a1a; border-bottom: 1px solid #333; font: bold 12px Arial, sans-serif; color: #ddd; }
    #tws-po-life .tws-po-life-txt { white-space: nowrap; }
    #tws-po-life .tws-po-life-bar { flex: 1; height: 7px; background: #333; border-radius: 4px; overflow: hidden; }
    #tws-po-life .tws-po-life-fill { display: block; height: 100%; width: 0; background: #4caf50; transition: width .4s; }
    #tws-po-life.tws-life-mid .tws-po-life-fill { background: #ffb300; }
    #tws-po-life.tws-life-low .tws-po-life-fill { background: #e53935; }
    #tws-po-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: bold;
    }
    .tws-po-btn {
      display: inline-block;
      min-width: 34px;
      text-align: center;
      padding: 8px 4px;
      cursor: pointer;
      color: #eee;
      text-decoration: none;
      font-size: 16px;
    }
    #tws-po-close { color: #ff7c7c; }
    #tws-po-bag { color: #7cfc7c; }
    #tws-po-frame, .tws-po-pre {
      flex: 1;
      min-height: 0;
      width: 100%;
      border: 0;
      background: #111;
      border-radius: 0 0 8px 8px;
    }
    #tws-po-msg { padding: 16px; color: #ffd27c; font-size: 13px; }

    /* ---- Safe-bag confirmation ---- */
    #tws-bag-confirm {
      position: fixed;
      top: 12vh;
      left: 50%;
      transform: translateX(-50%);
      width: 88vw;
      max-width: 360px;
      background: #1a1a1a;
      border: 2px solid #2e7d32;
      border-radius: 10px;
      padding: 12px;
      z-index: 100007;
      color: #eee;
      font-family: Arial, sans-serif;
      font-size: 14px;
      text-align: center;
      box-shadow: 0 6px 24px rgba(0,0,0,0.8);
    }
    .tws-bag-sub { font-size: 11px; color: #aaa; margin: 6px 0 10px; }
    .tws-bag-btns { display: flex; gap: 8px; }
    .tws-bag-btns button {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      color: #fff;
    }
    #tws-bag-yes { background: #2e7d32; }
    #tws-bag-no { background: #555; }

    /* ---- Toast ---- */
    #tws-toast {
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: #222;
      color: #fff;
      border: 1px solid #666;
      padding: 8px 12px;
      border-radius: 8px;
      z-index: 100006;
      font-size: 12px;
      display: none;
      max-width: 90vw;
      text-align: center;
      font-family: Arial, sans-serif;
    }
    #tws-toast.tws-toast-warn {
      background: #4a3d1e;
      border-color: #e0a030;
      color: #ffd27c;
      font-weight: bold;
      animation: tws-flash 1s infinite;
    }
    #tws-toast.tws-toast-ok { background: #1e4620; border-color: #2e7d32; color: #a8fca8; font-weight: bold; }
    #tws-toast.tws-toast-error {
      background: #4a1e1e;
      border-color: #d94c4c;
      color: #ffb3b3;
      font-weight: bold;
    }

    /* ---- Kraken Intel (integrated) ---- */
    #tws-ki-panel {
      display: block;
      clear: both;
      margin-bottom: 10px !important;
      float: none;
      flex: 0 0 100%;
      box-sizing: border-box;
      position: relative;
      width: 100%;
      max-width: none;
      margin: 10px 0 0;
      border: 1px solid var(--panel-divider-outer-side-color,#555);
      border-radius: 5px;
      background: var(--default-bg-panel-color,#2f2f2f);
      color: var(--default-color,#ddd);
      font-family: Arial, sans-serif;
      font-size: 12px;
      overflow: hidden;
    }
    #tws-ki-panel[hidden] { display: none !important; }
    #tws-ki-panel .tws-ki-head {
      background: linear-gradient(180deg,#666,#3b3b3b);
      color: var(--default-color,#eee);
      padding: 8px 12px;
      font-weight: bold;
    }
    #tws-ki-panel .tws-ki-status,
    #tws-ki-panel .tws-ki-meta,
    #tws-ki-panel .tws-ki-note {
      padding: 8px 10px;
      border-top: 1px solid var(--panel-divider-outer-side-color,#555);
      color: var(--default-color-light,#aaa);
      font-size: 10px;
    }
    #tws-ki-panel .tws-ki-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; }
    #tws-ki-panel .tws-ki-confidence { border-radius: 10px; padding: 2px 7px; font-size: 9px; font-weight: bold; color: #10171b; }
    #tws-ki-panel .tws-ki-confidence.is-high { background: #63d786; }
    #tws-ki-panel .tws-ki-confidence.is-medium { background: #f0c45a; }
    #tws-ki-panel .tws-ki-confidence.is-low { background: #ec726e; }
    #tws-ki-panel .tws-ki-confidence.is-stale, #tws-ki-panel .tws-ki-confidence.is-unknown { background: #879397; }
    #tws-ki-panel .tws-ki-row {
      display: grid;
      grid-template-columns: 44px minmax(0,1fr);
      align-items: center;
      gap: 7px;
      padding: 4px 8px;
      border-top: 1px solid var(--panel-divider-outer-side-color,#555);
    }
    #tws-ki-panel .tws-ki-image-wrap { display: flex; width: 50px; height: 34px; align-items: center; justify-content: center; border-radius: 5px; background: #ffffff0b; overflow: hidden; }
    #tws-ki-panel .tws-ki-image-wrap.is-missing:after { content: "?"; color: #60757a; font-weight: bold; }
    #tws-ki-panel .tws-ki-image-wrap.is-missing .tws-ki-image { display: none; }
    #tws-ki-panel .tws-ki-image { display: block; max-width: 50px; max-height: 34px; object-fit: contain; }
    #tws-ki-panel .tws-ki-slot { color: var(--default-blue-color,#71b6d7); font-weight: bold; }
    #tws-ki-panel .tws-ki-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); }
    #tws-ki-panel .tws-ki-col { min-width: 0; }
    #tws-ki-panel .tws-ki-col + .tws-ki-col { border-left: 1px solid var(--panel-divider-outer-side-color,#555); }
    #tws-ki-panel .tws-ki-col-head { padding: 3px 8px; font-size: 10px; font-weight: bold; letter-spacing: .5px; text-transform: uppercase; color: #9a9a9a; border-top: 1px solid var(--panel-divider-outer-side-color,#555); }
    #tws-ki-panel .tws-ki-image-wrap { width: 44px !important; height: 28px !important; }
    #tws-ki-panel .tws-ki-image { max-width: 44px !important; max-height: 28px !important; }
    #tws-ki-panel .tws-ki-row.is-yellow .tws-ki-image-wrap { background: rgba(232, 212, 77, .22); box-shadow: inset 0 0 0 1px rgba(232, 212, 77, .6); }
    #tws-ki-panel .tws-ki-row.is-orange .tws-ki-image-wrap { background: rgba(240, 147, 43, .24); box-shadow: inset 0 0 0 1px rgba(240, 147, 43, .65); }
    #tws-ki-panel .tws-ki-row.is-red .tws-ki-image-wrap { background: rgba(232, 65, 60, .24); box-shadow: inset 0 0 0 1px rgba(232, 65, 60, .65); }
    #tws-ki-panel .tws-ki-row.is-empty { opacity: .45; }
    #tws-ki-panel .tws-ki-top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; }
    #tws-ki-panel .tws-ki-top strong { margin-right: 2px; }
    .tws-ki-chip { display: inline-block; padding: 0 6px; border-radius: 8px; font-size: 10px; font-weight: bold; line-height: 16px; white-space: nowrap; background: #444; color: #ddd; }
    .tws-ki-chip.is-yellow { background: rgba(232, 212, 77, .2); color: #f2e27a; border: 1px solid rgba(232, 212, 77, .6); }
    .tws-ki-chip.is-orange { background: rgba(240, 147, 43, .2); color: #ffb35c; border: 1px solid rgba(240, 147, 43, .65); }
    .tws-ki-chip.is-red { background: rgba(232, 65, 60, .2); color: #ff7a74; border: 1px solid rgba(232, 65, 60, .65); }
    #tws-ki-panel .tws-ki-item { display: flex; min-width: 0; flex-direction: column;
      overflow: hidden; }
    #tws-ki-panel .tws-ki-item strong { white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    #tws-ki-panel .tws-ki-item small { color: var(--default-color-light,#aaa); }

    .tws-ki-attack-avatar-host { position: relative !important; }
    .tws-ki-enemy-weapons-layer { position: fixed; z-index: 2147483000; inset: 0; pointer-events: none; }
    .tws-ki-enemy-weapon-label {
      position: absolute;
      box-sizing: border-box;
      max-width: min(115px, 30vw);
      transform: translate(-50%, -50%);
      color: #f4f4f4;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      align-items: center;
      gap: 2px;
      padding: 3px;
      text-align: center;
      font: 10px/1.2 Arial, sans-serif;
      text-shadow: 0 1px 2px #000, 0 0 4px #000, 0 0 7px #000;
    }
    .tws-ki-enemy-weapon-label img { display: block; width: 72px; height: 51px; object-fit: contain; filter: drop-shadow(0 1px 2px #000); }
    .tws-ki-enemy-weapon-copy { display: block; min-width: 0; width: 100%; }
    .tws-ki-enemy-weapon-label strong,
    .tws-ki-enemy-weapon-label .tws-ki-enemy-weapon-copy > span { display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .tws-ki-enemy-weapon-label strong { font-size: 11px; }
    .tws-ki-enemy-weapon-label .tws-ki-enemy-weapon-copy > span { color: #d6dde0; }
    .tws-ki-slot-hover { cursor: help; }
    .tws-ki-tempwarn { margin: 0 0 8px; padding: 7px 10px; border-radius: 5px; background: #4a1010; border: 2px solid #ff4d4d; color: #fff; font: bold 11px/1.45 Arial, sans-serif; box-shadow: 0 0 0 1px rgba(0,0,0,.4); }
    .tws-ki-tempwarn-head { font-size: 12px; letter-spacing: 0.5px; color: #ffcf4d; margin-bottom: 2px; }
    .tws-ki-tempwarn-block { color: #ffd0d0; }
    .tws-ki-tempwarn-reduce { color: #ffd98a; }
    .tws-ki-tempwarn-big { font-size: 13px; padding: 9px 14px; animation: tws-ki-warn-pulse 1.2s ease-in-out 5; }
    .tws-ki-tempwarn-big .tws-ki-tempwarn-head { font-size: 14px; }
    #tws-ki-tempwarn-top { clear: both; margin: 0 0 10px; }
    .tws-ki-tempwarn-attack { position: absolute; left: 50%; top: 6px; transform: translateX(-50%); z-index: 30; width: max-content; max-width: 92%; margin: 0; text-align: center; box-shadow: 0 3px 10px rgba(0,0,0,.6); }
    @keyframes tws-ki-warn-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,77,.0); } 50% { box-shadow: 0 0 0 6px rgba(255,77,77,.55); } }
    .tws-ki-temp-host { position: relative !important; }
    .tws-ki-temp-bad { outline: 2px solid #ff4d4d !important; outline-offset: -2px; }
    .tws-ki-temp-warn { outline: 2px solid #ffb84d !important; outline-offset: -2px; }
    .tws-ki-temp-tab { position: absolute; z-index: 2147482990; width: 22px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 0 6px 6px 0; font: bold 13px Arial, sans-serif; color: #fff; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.6); user-select: none; }
    .tws-ki-temp-tab.is-block { background: #b3261e; border: 1px solid #ff6b6b; }
    .tws-ki-temp-tab.is-reduce { background: #9a6200; border: 1px solid #ffb84d; }
    .tws-ki-temp-pop { position: absolute; z-index: 2147482995; max-width: min(300px, 78vw); padding: 5px 9px; border-radius: 6px; background: rgba(60, 12, 12, .94); border: 1px solid #ff4d4d; color: #ffd0d0; font: bold 11px/1.4 Arial, sans-serif; box-shadow: 0 3px 10px rgba(0,0,0,.6); }
    .tws-ki-temp-pop-head { color: #ffcf4d; font-size: 11px; letter-spacing: .3px; }
    .tws-ki-temp-pop-reduce { color: #ffd98a; }
    .tws-ki-temp-pop-job { color: #ffe0b0; }
    .tws-job { margin: 0 0 8px; padding: 6px 9px; border-radius: 6px; background: #2b2620; border: 1px solid #6b5530; font: 12px/1.45 Arial, sans-serif; color: #ddd; }
    .tws-job-title { font-weight: bold; color: #f0c45a; margin-bottom: 1px; }
    .tws-job-line { color: #bbb; font-size: 11px; }
    .tws-job-line.is-key { color: #ffb4a8; font-weight: bold; }
    .tws-job-note { color: #888; font-size: 10px; margin-top: 2px; }
    #tws-ki-panel .tws-job { margin: 0; border-radius: 0; border-width: 1px 0 0; }
    #tws-ew-drawer .tws-ew-blocks { margin-top: 3px; color: #ff9b94; font-size: 11px; font-weight: bold; }
    .tws-ki-temp-flash { pointer-events: none; transition: transform .38s ease-in, opacity .38s ease-in; transform-origin: center; }
    .tws-ki-temp-open { cursor: pointer; }
    .tws-ki-temp-mark { position: absolute; left: 0; right: 0; top: 0; bottom: 0; z-index: 20; display: flex; align-items: center; justify-content: center; text-align: center; padding: 4px; font: bold 12px/1.3 Arial, sans-serif; color: #fff; pointer-events: none; }
    .tws-ki-temp-mark.is-block { background: rgba(160, 20, 20, 0.72); border: 2px solid #ff4d4d; }
    .tws-ki-temp-mark.is-reduce { background: rgba(140, 90, 0, 0.6); border: 2px solid #ffb84d; }
    #tws-ki-armour-box {
      position: fixed;
      z-index: 100005;
      display: none;
      max-width: 220px;
      border: 1px solid #177d8688;
      border-radius: 6px;
      background: #10171bf0;
      color: #e9f3f4;
      padding: 6px 8px;
      font: 11px/1.3 Arial, sans-serif;
      box-shadow: 0 3px 10px #0009;
      pointer-events: none;
    }
    #tws-ki-armour-box strong { display: block; font-size: 12px; margin-bottom: 2px; }
    #tws-ki-armour-box span { display: block; color: #9eb0b5; font-size: 10px; }
    .tws-ki-armour-dot {
      position: absolute;
      z-index: 12;
      width: 16px;
      height: 16px;
      transform: translate(-50%, -50%);
      background: transparent;
      border: none;
      pointer-events: auto;
      cursor: pointer;
    }
    html.tws-ki-loadout-revealed [class*='modal'][class*='defender'] {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      background: transparent !important;
    }
    html.tws-ki-loadout-revealed .tws-ki-attack-avatar-host img,
    html.tws-ki-loadout-revealed .tws-ki-attack-avatar-host [class*='avatar'],
    html.tws-ki-loadout-revealed .tws-ki-attack-avatar-host [class*='defender'] {
      filter: none !important;
      opacity: 1 !important;
    }
    .tws-travel-eta { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 2px; }
    #tws-travel-pop {
      position: fixed;
      z-index: 100008;
      display: none;
      width: 250px;
      max-width: 92vw;
      box-sizing: border-box;
      background: #1a1a1a;
      color: #eee;
      border: 1px solid #4fb3d9;
      border-radius: 8px;
      padding: 8px 10px;
      font: 12px/1.35 Arial, sans-serif;
      box-shadow: 0 4px 14px rgba(0,0,0,0.7);
    }
    #tws-travel-pop .tws-tp-title { font-weight: bold; margin-bottom: 2px; }
    #tws-travel-pop .tws-tp-sub { color: #999; font-size: 10px; margin-bottom: 6px; }
    #tws-travel-pop .tws-tp-row { display: flex; gap: 6px; padding: 3px 4px; border-radius: 4px; }
    #tws-travel-pop .tws-tp-row span:first-child { flex: 1; }
    #tws-travel-pop .tws-tp-row span:nth-child(2) { min-width: 46px; text-align: right; color: #999; }
    #tws-travel-pop .tws-tp-row span:nth-child(3) { min-width: 58px; text-align: right; color: #7ec8e3; }
    #tws-travel-pop .tws-tp-head, #tws-travel-pop .tws-tp-head span { color: #777 !important; font-size: 10px; }
    #tws-travel-pop .tws-tp-on { background: #1e3a4a; font-weight: bold; }
    #tws-travel-pop .tws-tp-pick { cursor: pointer; }
    #tws-travel-pop .tws-tp-pick:active { background: #2a4d61; }
    #tws-travel-pop .tws-tp-foot { color: #888; font-size: 10px; margin-top: 6px; }
    #tws-ki-attack-notice {
      position: fixed;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      background: #222;
      color: #fff;
      border: 1px solid #666;
      padding: 6px 10px;
      border-radius: 8px;
      z-index: 100006;
      font-size: 11px;
      display: none;
      max-width: 90vw;
      text-align: center;
      font-family: Arial, sans-serif;
    }
    @media (width<=700px) {
      .tws-ki-enemy-weapon-label { max-width: 30vw; font-size: 9px; }
      .tws-ki-enemy-weapon-label img { width: 66px; height: 48px; }
      .tws-ki-enemy-weapon-label strong { font-size: 10px; }
      .tws-ki-armour-stat-label { max-width: 120px; }
    }
  `);

  let panel = null;
  let showSettings = false;
  let settingsTab = 'general'; // 'general' | 'advanced' | 'bounty' (a sub-page of Advanced)

  // Tooltip for the header 🩸 button, depending on what a tap will do.
  function bloodBtnTitle() {
    const want = getMedItem();
    const t = getCfg(STORE_KEYS.bloodType);
    if (want === 'blood' && !t) return 'Set your blood type in ⚙ Settings first';
    const what = want === 'blood' ? `a blood bag (your type: ${t})` : 'the right med kit';
    return featureOn('bloodQuickUse') ? `Use ${what} now` : 'Open faction medical armoury';
  }


  // Shows/hides the optional header buttons according to their feature
  // toggles. Called on every render and whenever a toggle changes.
  function applyHeaderVisibility__raw() {
    if (!panel) return;
    const set = (sel, on) => {
      const el = panel.querySelector(sel);
      if (el) el.style.display = on ? '' : 'none';
    };
    set('#tws-blood-btn', featureOn('btnBlood'));
    set('#tws-items-btn', featureOn('btnItems'));
    set('#tws-travel-btn', featureOn('btnTravel'));
    if (preloadReady) preloadFrames();
    // Settings -> Panel tab is too narrow for these.
    const onPanelTab = (typeof showSettings !== 'undefined') && showSettings && settingsTab === 'panel';
    set('#tws-energy', pcMode() && featureOn('btnEnergy') && !onPanelTab);
    set('#tws-drug', pcMode() && featureOn('btnDrug') && !onPanelTab);
    set('#tws-clock', pcMode() && featureOn('btnClock') && !onPanelTab);
    set('#tws-rev-btn', featureOn('btnRevive'));
    const revBtn = panel.querySelector('#tws-rev-btn');
    if (revBtn) {
      const revOff = getRevives() === 'off';
      revBtn.classList.toggle('tws-rev-off', revOff);
      revBtn.title = revOff
        ? 'Revives are switched off (⚙ Settings → Revives)'
        : `Request a revive (${reviveProvider().name} \u2013 ${reviveProvider().cost})`;
    }
    const bloodBtn = panel.querySelector('#tws-blood-btn');
    if (bloodBtn) bloodBtn.title = bloodBtnTitle();
  }

  // Called after any feature toggle changes (Advanced settings).
  function onFeatureChanged() {
    applyHeaderVisibility();
    syncBloodFrame();     // hidden armoury follows the blood toggles
    kiStartSharedSync();
    kiRenderProfilePanel();
    kiScheduleAttackEquipmentRender();
  }

  // Saves the General tab's fields (used by Save and by switching tabs, so
  // nothing typed is lost).
  function saveGeneralFields(body) {
    const val = (sel) => {
      const el = body.querySelector(sel);
      return el ? el.value.trim() : null;
    };
    const key = val('#tws-in-key');
    if (key !== null) setCfg(STORE_KEYS.apiKey, key);
    const ff = val('#tws-in-ff');
    if (ff !== null) setCfg(STORE_KEYS.ffscouterKey, ff);
    const bsp = val('#tws-in-bsp');
    if (bsp !== null) setCfg(STORE_KEYS.bspKey, bsp);
    const ts = val('#tws-in-ts');
    if (ts !== null) setCfg(STORE_KEYS.tsKey, ts);
    const srcSel = body.querySelector('#tws-in-statsrc');
    if (srcSel) setCfg(STORE_KEYS.statsSource, (srcSel.value === 'bsp' || srcSel.value === 'both') ? srcSel.value : 'ff');
    const bloodSel = body.querySelector('#tws-in-blood');
    if (bloodSel) setCfg(STORE_KEYS.bloodType, bloodSel.value);
    const medSel = body.querySelector('#tws-in-med');
    if (medSel) setCfg(STORE_KEYS.medItem, medSel.value);
    applyHeaderVisibility();
    syncBloodFrame(); // blood type may have just been set / cleared
  }

  function attachSettingsTabs(body) {
    body.querySelectorAll('[data-stab]').forEach((el) => {
      el.addEventListener('click', () => {
        if (settingsTab === 'general' || body.querySelector('#tws-save-btn')) saveGeneralFields(body.querySelector('#tws-set-l') || body);
        settingsTab = el.dataset.stab;
        render();
      });
    });
  }

  function settingsTabsBar() {
    if (settingsSplitRight) return ''; // the right-hand column of the wide layout
    const split = settingsWideOn();
    // The bounty editor is a sub-page of Advanced, so Advanced stays lit.
    const advActive = split || settingsTab === 'advanced' || settingsTab === 'bounty';
    return `
      <div class="tws-tabs" style="margin-bottom:8px;">
        <div class="tws-tab ${(split || settingsTab === 'general') ? 'tws-tab-active' : ''}" data-stab="general">General</div>
        <div class="tws-tab ${advActive ? 'tws-tab-active' : ''}" data-stab="advanced">Advanced</div>
        <div class="tws-tab ${settingsTab === 'panel' ? 'tws-tab-active' : ''}" data-stab="panel">Panel</div>
      </div>
      <div style="color:#666;font-size:10px;margin-bottom:8px;text-align:center;">Sandbox War Room v${SCRIPT_VERSION}</div>
      ${accessSettingsHtml()}
    `;
  }

  // The panel's own width/height sliders -- kept on their own tab so they
  // can't be nudged by accident while adjusting anything else.
  function renderPanelSettings(body) {
    const curW = Math.round(panel.getBoundingClientRect().width);
    const curH = panel.style.maxHeight ? parseInt(panel.style.maxHeight, 10) : Math.round(window.innerHeight * 0.8);
    const maxH = Math.round(window.innerHeight);
    const row = (id, min, max, val) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <input id="tws-in-${id}" type="range" min="${min}" max="${max}" step="10" value="${val}" style="flex:1;margin:0;">
          <input id="tws-num-${id}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" value="${val}"
            style="width:72px;flex:none;margin:0;text-align:center;">
          <span style="color:#888;font-size:11px;">px</span>
        </div>`;
    body.innerHTML = `
      <div id="tws-settings">
        ${settingsTabsBar()}
        <div class="tws-adv-group" style="margin-top:0;">Panel size</div>
        <div style="color:#888;font-size:11px;margin:2px 0 8px;">Drag the slider (steps of 10) or type an exact size in the box.</div>
        <label>Panel Width
          <span id="tws-width-reset" style="opacity:0.6;cursor:pointer;text-decoration:underline;margin-left:8px;">Reset</span>
        </label>
        ${row('width', 220, 600, curW)}
        <label>Panel Height
          <span id="tws-height-reset" style="opacity:0.6;cursor:pointer;text-decoration:underline;margin-left:8px;">Reset</span>
        </label>
        ${row('height', 200, maxH, curH)}
        <div class="tws-adv-group">Minimised icon</div>
        <select id="tws-in-minidock">
          <option value="dock" ${getCfg(STORE_KEYS.miniDock, true) !== false ? 'selected' : ''}>Docked in Torn\u2019s top bar</option>
          <option value="float" ${getCfg(STORE_KEYS.miniDock, true) === false ? 'selected' : ''}>Floating (drag anywhere)</option>
        </select>
        <div style="color:#aaa;font-size:10px;margin:-2px 0 8px;line-height:1.4;">Where the Kraken icon sits when the panel is minimised.</div>
        <div class="tws-adv-group">Colours</div>
        <label>Colour theme</label>
        <select id="tws-in-theme">
          ${COLOUR_THEMES.map((t) => `<option value="${t.id}" ${colourTheme() === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
        <div id="tws-theme-desc" style="color:#aaa;font-size:10px;margin:-2px 0 8px;line-height:1.4;">${COLOUR_THEMES.find((t) => t.id === colourTheme()).desc}</div>
      </div>
    `;
    attachSettingsTabs(body);
    const dockSel = body.querySelector('#tws-in-minidock');
    if (dockSel) dockSel.addEventListener('change', () => {
      setCfg(STORE_KEYS.miniDock, dockSel.value === 'dock');
      showToast(dockSel.value === 'dock' ? 'Minimised icon: docked in Torn\u2019s top bar.' : 'Minimised icon: floating.');
    });
    const themeSel = body.querySelector('#tws-in-theme');
    if (themeSel) themeSel.addEventListener('change', () => {
      setCfg(STORE_KEYS.colourTheme, themeSel.value);
      const t = COLOUR_THEMES.find((x) => x.id === colourTheme());
      const dsc = body.querySelector('#tws-theme-desc');
      if (dsc) dsc.textContent = t.desc;
      applyColourTheme();
      if (t.id === 'ff' && !featureOn('ffStats')) showToast('FairFight colours need estimated battle stats switched on (Advanced).', { warn: true });
      else showToast(`Colour theme: ${t.name}`);
    });

    // One size control = slider + number box, kept in step with each other.
    const wire = (id, min, max, apply, reset, defaultVal) => {
      const slider = body.querySelector(`#tws-in-${id}`);
      const box = body.querySelector(`#tws-num-${id}`);
      slider.addEventListener('input', () => {
        box.value = slider.value;
        apply(Number(slider.value));
      });
      // Typed sizes apply when you finish (Enter / Done / tap away), not on
      // every key -- otherwise typing "3" on the way to "315" would shrink
      // the panel to its minimum mid-typing.
      const commit = () => {
        let v = Math.round(Number(box.value));
        if (!Number.isFinite(v) || box.value === '') { box.value = slider.value; return; }
        v = Math.max(min, Math.min(max, v));
        box.value = v;
        slider.value = v;
        apply(v);
      };
      box.addEventListener('change', commit);
      box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); box.blur(); } });
      body.querySelector(`#tws-${id}-reset`).addEventListener('click', () => {
        reset();
        slider.value = defaultVal();
        box.value = defaultVal();
      });
    };
    wire('width', 220, 600,
      (v) => { panel.style.width = `${v}px`; setCfg(STORE_KEYS.panelWidth, String(v)); },
      () => { panel.style.width = ''; setCfg(STORE_KEYS.panelWidth, ''); },
      () => 300);
    wire('height', 200, maxH,
      (v) => { panel.style.maxHeight = `${v}px`; setCfg(STORE_KEYS.panelHeight, String(v)); },
      () => { panel.style.maxHeight = ''; setCfg(STORE_KEYS.panelHeight, ''); },
      () => Math.round(window.innerHeight * 0.8));
  }

  // The contact / credit details. The player ID is a link to their Torn
  // profile (opens in the pop-out).
  function creditLinkHtml() {
    return `<a id="tws-credit-link" href="https://www.torn.com/profiles.php?XID=${CREDIT_ID}" target="_blank">${CREDIT_NAME} [${CREDIT_ID}]</a>`;
  }

  function creditCardHtml() {
    return `
      <div class="tws-credit">
        <img src="${LOGO_DATA_URI}" alt="🐙">
        <div class="tws-credit-title">Report any glitches or give credit for this script</div>
        <div class="tws-credit-contact">Contact: ${creditLinkHtml()}</div>
      </div>`;
  }

  function creditMiniHtml() {
    return `<div class="tws-credit-mini">🐙 Glitches or credit? Contact ${creditLinkHtml()}</div>`;
  }

  // Makes the contact link open the profile in the pop-out (or normally,
  // with that pop-out feature off).
  function attachCreditLink(body) {
    const a = body.querySelector('#tws-credit-link');
    if (!a) return;
    a.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!featureOn('popoutProfiles')) return;
      e.preventDefault();
      openPopout(`https://www.torn.com/profiles.php?XID=${CREDIT_ID}`, `${CREDIT_NAME} [${CREDIT_ID}]`);
    });
  }

  // The Advanced tab: one toggle per entry in FEATURES, grouped. Toggles
  // apply immediately. The 💰 Bounty amounts editor is a menu at the top.
  function renderAdvancedSettings(body) {
    const groups = [];
    const SHOWN = FEATURES.filter((f) => !COMPLIANCE_OFF.has(f.key) && !SANDBOX_ONLY.has(f.key));
    SHOWN.forEach((f) => {
      if (!groups.includes(f.group)) groups.push(f.group);
    });
    const rows = groups.map((g) => `
      <div class="tws-adv-group">${g}</div>
      ${SHOWN.filter((f) => f.group === g).map((f) => {
        const parentOff = !!f.requires && !featureOn(f.requires);
        return `
          <label class="tws-adv-row ${f.requires ? 'tws-adv-sub' : ''} ${parentOff ? 'tws-adv-dim' : ''}">
            <input type="checkbox" data-feat="${f.key}" ${featureStored(f.key) ? 'checked' : ''}>
            <span>${f.label}${f.hint ? `<small>${f.hint}</small>` : ''}</span>
          </label>`;
      }).join('')}
    `).join('');

    body.innerHTML = `
      <div id="tws-settings">
        ${settingsTabsBar()}
        <button id="tws-adv-pcmode" style="margin-bottom:4px;" ${IS_PDA ? 'disabled' : ''}>${pcMode() ? '\ud83d\udcf1 Switch to Mobile Mode' : '\ud83d\udda5\ufe0f Switch to PC Mode'}</button>
        <div style="color:#888;font-size:11px;margin:0 0 8px;">${IS_PDA ? 'PC Mode is for desktop browsers (not Torn PDA).' : pcMode() ? 'PC Mode is on: Enemy | Home | Targets + Attacks log side by side when the window is at least 1100px wide.' : 'Wide desktop layout: Enemy | Home | Targets + Attacks log side by side (windows 1100px+). Saved on this device.'}</div>
        <button id="tws-adv-bounty" style="margin-bottom:8px;">💰 Bounty amounts ›</button>
        <div class="tws-adv-group" style="margin-top:0;">🐙 Kraken Intel</div>
        <div style="color:#888;font-size:11px;margin:2px 0 8px;">Loadouts Torn reveals on attack pages you view are shared with other contributors when \u201cShare loadouts\u201d below is on. Your Torn API key stays on this device and is never uploaded with shared intel.</div>
        <button id="tws-ki-clear-captures" style="margin-bottom:6px;">🐙 Clear cached observations</button>
        <button id="tws-ki-clear-items" style="margin-bottom:10px;">🐙 Clear cached item details</button>
        ${true ? `
        <div class="tws-adv-group" style="margin-top:0;">\u26a1 Share my key for Retal</div>
        <div style="color:#888;font-size:11px;margin:2px 0 8px;">Needs a key with faction API access (one sharer covers the whole faction, including new recruits). Stores your API key <b>encrypted</b> on the Kraken server. It is used only to read your faction\u2019s recent attacks (every 15s, only while a member has a war open) so every member\u2019s Retal button works. It is never shown to anyone and is deleted as soon as you switch this off. Retal source right now: <b>${retalSource || 'not checked yet'}</b></div>
        <label class="tws-adv-row" style="margin-bottom:8px;">
          <input type="checkbox" id="tws-retal-share-toggle" ${getCfg(RETAL_SHARED_KEY, false) === true ? 'checked' : ''}>
          <span>\u26a1 Share my key for Retal<small id="tws-retal-share-note">Off = your key is deleted from the server straight away.</small></span>
        </label>` : ''}
        <div style="color:#888;font-size:11px;margin-bottom:4px;">Switch any feature on or off. Changes apply straight away.</div>
        ${rows}
        <button id="tws-adv-reset" style="margin-top:10px;">Reset all to defaults (everything on)</button>
        <button id="tws-adv-done" style="margin-top:6px;">Done</button>
        ${creditMiniHtml()}
      </div>
    `;
    attachSettingsTabs(body);
    attachCreditLink(body);
    body.querySelector('#tws-ki-clear-captures').addEventListener('click', () => {
      setCfg(KI_STORE.captures, []);
      showToast('Cleared cached Kraken Intel observations.');
    });
    const retalToggle = body.querySelector('#tws-retal-share-toggle');
    if (retalToggle) {
      const note = body.querySelector('#tws-retal-share-note');
      const setNote = (t) => { if (note) note.textContent = t; };
      const setShared = (on) => { setCfg(RETAL_SHARED_KEY, !!on); retalToggle.checked = !!on; };
      // Show what the server actually has (in case it was changed elsewhere).
      (async () => {
        try {
          const me = await accessMyId();
          const fac = getOwnFactionId();
          if (!me || !fac) return;
          const d = await serverGet(`${RETAL_URL}?faction=${encodeURIComponent(fac)}&me=${encodeURIComponent(me)}`);
          if (d && typeof d.shared === 'boolean' && retalToggle.isConnected && !retalToggle.disabled) setShared(typeof d.mine === 'boolean' ? d.mine : d.shared);
        } catch (e) { /* keep the saved state */ }
      })();
      retalToggle.addEventListener('change', () => {
        const want = retalToggle.checked;
        const key = getApiKey();
        if (!key) { retalToggle.checked = !want; showToast('Set your API key first.'); return; }
        retalToggle.disabled = true;
        setNote(want ? 'Checking your key\u2026' : 'Deleting your key from the server\u2026');
        httpPostJson(want ? `${RETAL_URL}/key` : `${RETAL_URL}/key/remove`, { key })
          .then((d) => {
            if (d && d.ok) {
              setShared(want);
              showToast(want ? '\u26a1 Shared Retal is on for your faction.' : 'Key deleted from the server.');
            } else {
              retalToggle.checked = !want;
              showToast(`${want ? 'Not shared' : 'Not deleted'}: ${(d && d.error) || 'unknown error'}`);
            }
          })
          .catch((e) => {
            retalToggle.checked = !want;
            showToast(`${want ? 'Not shared' : 'Not deleted'}: ${e.message}`);
          })
          .finally(() => {
            retalToggle.disabled = false;
            setNote('Off = your key is deleted from the server straight away.');
          });
      });
    }
    body.querySelector('#tws-ki-clear-items').addEventListener('click', () => {
      setCfg(KI_STORE.itemCache, {});
      showToast('Cleared cached item details.');
    });
    const pcBtn = body.querySelector('#tws-adv-pcmode');
    if (pcBtn) pcBtn.addEventListener('click', () => {
      if (IS_PDA) return;
      const on = !pcMode();
      setCfg(PC_MODE_KEY, on);
      showSettings = false;
      try { applyHeaderVisibility(); } catch (e) { /* ignore */ }
      try { syncBloodFrame(); } catch (e) { /* ignore */ }
      showToast(on ? (window.innerWidth >= WIDE_MIN_WIDTH ? 'PC Mode on' : 'PC Mode on \u2013 widen the window to 1100px+ for the side-by-side layout') : 'Mobile Mode on');
      if (!on && popout) { popout.userSized = false; popout.root.style.top = popout.root.style.left = popout.root.style.width = popout.root.style.height = ''; }
      render();
    });
    body.querySelector('#tws-adv-bounty').addEventListener('click', () => {
      const oldScroll = body.querySelector('#tws-settings')?.scrollTop || 0;
      settingsTab = 'bounty';
      render();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const settings = document.querySelector('#tws-settings');
          if (settings) settings.scrollTop = oldScroll;
        });
      });
    });
    body.querySelectorAll('input[data-feat]').forEach((cb) => {
      cb.addEventListener('change', () => {
        // Just save the feature, don't re-render the entire settings
        setFeature(cb.dataset.feat, cb.checked);
        onFeatureChanged();
        // Update dependent toggles' dimming without full re-render
        FEATURES.forEach((f) => {
          if (f.requires) {
            const el = body.querySelector(`input[data-feat="${f.key}"]`);
            const label = el?.closest('.tws-adv-row');
            const parentOff = !featureOn(f.requires);
            if (label) label.classList.toggle('tws-adv-dim', parentOff);
          }
        });
      });
    });
    body.querySelector('#tws-adv-reset').addEventListener('click', () => {
      const oldScroll = body.querySelector('#tws-settings')?.scrollTop || 0;
      FEATURES.forEach((f) => setFeature(f.key, true));
      onFeatureChanged();
      render();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const settings = document.querySelector('#tws-settings');
          if (settings) settings.scrollTop = oldScroll;
        });
      });
      showToast('All features switched back on.');
    });
    body.querySelector('#tws-adv-done').addEventListener('click', () => {
      const left = document.querySelector('#tws-set-l');
      if (left && left.querySelector('#tws-save-btn')) saveGeneralFields(left);
      showSettings = false;
      render();
    });

    // Dynamically set settings height to remaining space (same as roster)
    const staticEl = body.querySelector("#tws-static");
    const settingsEl = body.querySelector("#tws-settings");
    if (settingsEl) {
      const bodyRect = body.getBoundingClientRect();
      const staticHeight = staticEl ? (staticEl.parentElement === body ? staticEl.offsetHeight : 0) : 0;
      const maxSettingsHeight = bodyRect.height - staticHeight;
      settingsEl.style.maxHeight = maxSettingsHeight + "px";
    }

  }

  // Advanced -> 💰 Bounty amounts: the stats tiers and what to bounty for
  // each, plus the reason text. Every change saves immediately. Numbers
  // accept 500k / 2m / 1.5b.
  function renderBountySettings(body) {
    const cfg = getBountyConfig();
    const lastMax = cfg.t.length ? cfg.t[cfg.t.length - 1][0] : 0;
    const rows = cfg.t.map((r, i) => `
      <div class="tws-bty-row">
        <span>Up to</span>
        <input data-bty="max" data-i="${i}" value="${fmtAmount(r[0])}" autocomplete="off">
        <span>stats → $</span>
        <input data-bty="amt" data-i="${i}" value="${fmtAmount(r[1])}" autocomplete="off">
        <span class="tws-bty-del" data-del="${i}" title="Remove this tier">✕</span>
      </div>`).join('');

    body.innerHTML = `
      <div id="tws-settings">
        ${settingsTabsBar()}
        <button id="tws-bty-back" style="margin-bottom:8px;">‹ Back to Advanced</button>
        <div class="tws-adv-group" style="margin-top:0;">💰 Bounty amounts</div>
        <div style="color:#888;font-size:11px;margin:4px 0 8px;">
          The bounty box is filled in from a player's estimated stats (FFScouter). Type numbers like 500k, 2m or 1.5b. Changes save straight away.
        </div>
        ${rows}
        <div class="tws-bty-row">
          <span>Over ${fmtAmount(lastMax)}</span>
          <span>stats → $</span>
          <input data-bty="over" value="${fmtAmount(cfg.o)}" autocomplete="off">
        </div>
        <button id="tws-bty-add" style="margin:4px 0 8px;">+ Add a tier</button>
        <div class="tws-bty-row">
          <span>No stats estimate → $</span>
          <input data-bty="unk" value="${cfg.u ? fmtAmount(cfg.u) : ''}" placeholder="none" autocomplete="off">
        </div>
        <div style="color:#888;font-size:10px;margin-bottom:8px;">Leave blank to open the page without filling in an amount when a player has no estimate.</div>
        <div class="tws-adv-group">Reason</div>
        <div class="tws-bty-row">
          <span>Reason →</span>
          <input data-bty="reason" value="${escHtml(cfg.r)}" placeholder="none" maxlength="100" autocomplete="off" style="width:130px;">
        </div>
        <div style="color:#888;font-size:10px;margin-bottom:8px;">Typed into the bounty form's reason box. Leave blank to skip it.</div>
        <button id="tws-bty-reset">Reset to the default amounts</button>
        <button id="tws-bty-done" style="margin-top:6px;">Done</button>
      </div>
    `;
    attachSettingsTabs(body);

    const commit = (fn) => {
      const c = getBountyConfig();
      fn(c);
      saveBountyConfig(c);
      render();
    };

    body.querySelector('#tws-bty-back').addEventListener('click', () => {
      settingsTab = 'advanced';
      render();
    });
    body.querySelector('#tws-bty-done').addEventListener('click', () => {
      showSettings = false;
      render();
    });
    body.querySelector('#tws-bty-add').addEventListener('click', () => {
      commit((c) => {
        const next = c.t.length ? c.t[c.t.length - 1][0] * 2 : 1e6;
        c.t.push([next, c.o]);
      });
    });
    body.querySelector('#tws-bty-reset').addEventListener('click', () => {
      saveBountyConfig(cloneBounty(DEFAULT_BOUNTY));
      render();
      showToast('Bounty amounts reset to the defaults.');
    });
    body.querySelectorAll('.tws-bty-del').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.dataset.del);
        commit((c) => { c.t.splice(i, 1); });
      });
    });
    body.querySelectorAll('input[data-bty]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const kind = inp.dataset.bty;
        // The reason is free text (blank = don't fill it in).
        if (kind === 'reason') {
          commit((c) => { c.r = inp.value.trim().slice(0, 100); });
          return;
        }
        // The "no estimate" box may be left empty (= don't fill anything in).
        if (kind === 'unk' && inp.value.trim() === '') {
          commit((c) => { c.u = 0; });
          return;
        }
        const v = parseAmount(inp.value);
        if (v === null || v <= 0) {
          showToast('Use a number like 500k, 2m or 1.5b.');
          render();
          return;
        }
        const i = Number(inp.dataset.i);
        commit((c) => {
          if (kind === 'max') c.t[i][0] = v;
          else if (kind === 'amt') c.t[i][1] = v;
          else if (kind === 'over') c.o = v;
          else if (kind === 'unk') c.u = v;
        });
      });
    });
  }

  function buildPanelSkeleton() {
    panel = document.createElement('div');
    panel.id = 'tws-panel';
    panel.innerHTML = `
      <div id="tws-header">
        <img id="tws-logo" src="${LOGO_DATA_URI}" alt="🐙" draggable="false">
        <b id="tws-title"><span class="tws-title-txt">Sandbox War Room 🧪</span><span class="tws-title-short">\ud83d\udc19</span><span id="tws-clock" class="tws-clock" title="Torn City Time (TCT)"></span></b><span id="tws-enemy-name" class="tws-enemy-name"></span>
        <span id="tws-hbtns">
          <span class="tws-energy" id="tws-energy" title="Energy"><span class="tws-energy-top"><svg class="tws-energy-bolt" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#6aa22a" d="M13.5 1 4 13.5h6.2L8.8 23 20 9.6h-6.4z"/></svg><span class="tws-energy-txt">–</span></span><span class="tws-energy-track"><span class="tws-energy-fill"></span></span></span>
          <span class="tws-energy tws-drug" id="tws-drug" title="Drug cooldown"><span class="tws-energy-top">${DRUG_SVG}<span class="tws-energy-txt">–</span></span><span class="tws-energy-track"><span class="tws-energy-fill"></span></span></span>
          <a class="tws-rev-btn" id="tws-rev-btn" target="_blank" href="#" title="Quick revive">Rev</a>
          <a class="tws-blood-btn" id="tws-blood-btn" target="_blank"
             href="${BLOOD_URL}"
             title="${bloodBtnTitle()}">🩸</a>
          <a class="tws-items-btn" id="tws-items-btn" target="_blank"
             href="${ITEMS_URL}"
             title="Items: Temporary">${GRENADE_SVG}</a>
          <a class="tws-items-btn" id="tws-travel-btn" target="_blank"
             href="${TRAVEL_AGENT_URL}"
             title="Quick escape: Travel Agent">${PLANE_SVG}</a>
          <span class="tws-gear" id="tws-gear-btn">⚙</span>
          <span id="tws-collapse-btn"> ▾</span>
        </span>
      </div>
      <div id="tws-access" style="display:none;padding:4px 8px;font-size:11px;line-height:1.4;background:#241a33;color:#ddd;border-bottom:1px solid #3a2a55;"></div>
      <div id="tws-wide">
        <div id="tws-body"></div>
        <div id="tws-body-home" class="tws-wide-col" style="display:none;"></div>
        <div id="tws-col3" class="tws-wide-col" style="display:none;">
          <div id="tws-body-target" style="display:none;"></div>
          <div id="tws-wide-log" style="display:none;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    applyHeaderVisibility();

    // New tab / app start: begin minimised in the top-left corner (once per
    // tab session -- page changes within the tab keep whatever you set).
    if (featureOn('startMinimized')) {
      let fresh = false;
      try {
        if (!sessionStorage.getItem('tws_session_started')) {
          sessionStorage.setItem('tws_session_started', '1');
          fresh = true;
        }
      } catch (e) { fresh = false; }
      if (fresh) {
        setCfg(STORE_KEYS.collapsed, true);
        setCfg(STORE_KEYS.posTop, '10px');
        setCfg(STORE_KEYS.posLeft, '10px');
      }
    }

    // Restore a previously-dragged position, if one was saved.
    const savedTop = getCfg(STORE_KEYS.posTop, '');
    const savedLeft = getCfg(STORE_KEYS.posLeft, '');
    if (savedTop && savedLeft) {
      panel.style.top = savedTop;
      panel.style.left = savedLeft;
      panel.style.right = 'auto';
    }
    // A new page opening with the panel already expanded: make sure it fits.
    requestAnimationFrame(keepPanelInView);
    setTimeout(keepPanelInView, 600);

    // Restore a previously-set custom width/height, if either was saved.
    const savedWidth = getCfg(STORE_KEYS.panelWidth, '');
    if (savedWidth) {
      panel.style.width = `${savedWidth}px`;
    }
    const savedHeight = getCfg(STORE_KEYS.panelHeight, '');
    if (savedHeight) {
      panel.style.maxHeight = `${savedHeight}px`;
    }

    // 🩸 header button. With One-tap use on (default) a single tap uses the
    // best safe bag for your saved blood type. With it off, the button opens
    // the medical armoury in the pop-out instead (or, with pop-outs off, its
    // link navigates normally). Always stops the click reaching the header
    // (which would collapse the panel).
    panel.querySelector('#tws-blood-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!featureOn('popoutArmoury')) return;
      e.preventDefault();
      openPopout(BLOOD_URL, '🩸 Medical armoury');
    });

    // Grenade button: quick link to Items -> Temporary. Opens in the pop-out
    // (or, with that pop-out feature off, its link navigates normally).
    panel.querySelector('#tws-items-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!featureOn('popoutItems')) return;
      e.preventDefault();
      openPopout(ITEMS_URL, 'Items: Temporary');
    });

    // Plane button (Quick escape): the pre-loaded Travel Agent in the pop-out.
    panel.querySelector('#tws-travel-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!popoutsEnabled()) return;
      e.preventDefault();
      openPopout(TRAVEL_AGENT_URL, '\u2708\ufe0f Quick escape: Travel Agent');
    });

    // Rev button: sends a self revive request via Nomad's Quick Revive.
    panel.querySelector('#tws-rev-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (getRevives() === 'off') {
        showToast('Revives are switched off. Change it in ⚙ Settings → Revives.');
        return;
      }
      reviveProvider().request();
    });

    panel.querySelector('#tws-gear-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showSettings = !showSettings;
      if (showSettings) settingsTab = 'general';
      render();
    });

    // Drag-to-move via the header. Pointer events cover mouse, touch, and
    // (as far as I can tell) Torn PDA's Chromium-based webview alike, so
    // this doesn't need a separate touch-event branch.
    let dragState = null;
    let suppressNextClick = false;
    const header = panel.querySelector('#tws-header');

    let headerPressOnTitle = false;
    header.addEventListener('pointerdown', (e) => {
      headerPressOnTitle = !!(e.target && e.target.closest && e.target.closest('#tws-title, #tws-logo') && !e.target.closest('#tws-clock'));
      // Don't start drag/capture when the press begins on one of the
      // header's own icon buttons -- setPointerCapture() on the header
      // was intercepting the click before it reached these nested buttons
      // (harmless on touch, since a tap has no meaningful drag distance
      // anyway, but on desktop mouse input it was swallowing the click
      // entirely, leaving only the header's own collapse-toggle to fire).
      if (e.target.closest('.tws-blood-btn, .tws-items-btn, .tws-rev-btn, .tws-gear, #tws-collapse-btn')) {
        headerPressOnTitle = false;
        return;
      }
      if (panel.classList.contains('tws-mini-dock')) return; // docked: tap only, no drag
      const rect = panel.getBoundingClientRect();
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        startTop: rect.top,
        startLeft: rect.left,
        moved: false,
      };
      header.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', (e) => {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragState.moved = true;
      if (!dragState.moved) return;

      const panelRect = panel.getBoundingClientRect();
      const maxTop = window.innerHeight - panelRect.height;
      const maxLeft = window.innerWidth - panelRect.width;
      const newTop = Math.max(0, Math.min(dragState.startTop + dy, maxTop));
      const newLeft = Math.max(0, Math.min(dragState.startLeft + dx, maxLeft));

      panel.style.top = `${newTop}px`;
      panel.style.left = `${newLeft}px`;
      panel.style.right = 'auto';
    });

    header.addEventListener('pointerup', () => {
      if (dragState && dragState.moved) {
        setCfg(STORE_KEYS.posTop, panel.style.top);
        setCfg(STORE_KEYS.posLeft, panel.style.left);
        suppressNextClick = true; // don't let this drag's release also toggle collapse
      }
      dragState = null;
    });

    header.addEventListener('click', (e) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      // Only the "PC War Room" title (or the logo when minimised) minimises/expands.
      const onTitle = headerPressOnTitle || !!(e.target && e.target.closest && e.target.closest('#tws-title, #tws-logo') && !e.target.closest('#tws-clock'));
      headerPressOnTitle = false;
      if (!onTitle && pcMode()) return; // PC Mode: only the title minimises
      const collapsed = !getCfg(STORE_KEYS.collapsed, false);
      setCfg(STORE_KEYS.collapsed, collapsed);
      render();
      keepPanelInView();
      requestAnimationFrame(keepPanelInView); // again once the panel has its full size
    });
    // Screen rotated / window resized: keep the open panel on screen.
    let inViewT = null;
    window.addEventListener('resize', () => {
      clearTimeout(inViewT);
      inViewT = setTimeout(keepPanelInView, 250);
    });
  }

  // Which stage a chain is in:
  //   'active'   -- running (it has a count and time left on the clock)
  //   'cooldown' -- the timer ran out and the chain broke: Torn's cooldown is
  //                 still counting down (or Torn hasn't cleared the old count
  //                 yet, so it's shown as cooldown rather than a chain at 0:00)
  //   'dead'     -- no chain and no cooldown left
  function chainPhase(c) {
    if (c.current > 0 && c.remaining > 0) return 'active';
    if (c.cooldown > 0) return 'cooldown';
    if (c.cooldownBase > 0) return 'dead'; // a cooldown was counting and has now finished
    if (c.current > 0) return 'cooldown';  // timer hit zero, cooldown not reported (yet)
    return 'dead';
  }

  // Green: 5:00 down to 3:30. Amber: 3:29 down to 2:00. Solid red: 1:59
  // down to 1:00. Flashing red: under 1:00.
  function chainClass(remaining) {
    if (remaining >= 210) return 'tws-chain-safe';
    if (remaining >= 120) return 'tws-chain-warn';
    if (remaining >= 60) return 'tws-chain-red';
    return 'tws-chain-danger';
  }

  // The "🏁 X defeated Y in a ranked war" message for a finished war
  // (green if you won, red if you lost, neutral if the winner isn't known).
  function warResultHtml(lw) {
    const own = lw.ownName || 'Your faction';
    const enemyName = lw.enemyName
      || ((String(enemyFactionId) === String(lw.enemyId) && enemyFactionName) ? enemyFactionName : null)
      || `Faction ${lw.enemyId}`;
    let text;
    let cls = 'tws-warend-neutral';
    if (lw.winnerId && lw.winnerId === String(lw.ownId)) {
      text = `${own} defeated ${enemyName} in a ranked war`;
      cls = 'tws-warend-win';
    } else if (lw.winnerId && lw.winnerId === String(lw.enemyId)) {
      text = `${enemyName} defeated ${own} in a ranked war`;
      cls = 'tws-warend-lose';
    } else {
      text = `The ranked war between ${own} and ${enemyName} has ended`;
    }
    return `<div class="tws-warend ${cls}">🏁 ${escHtml(text)}<small>${fmtTct(lw.endTime)} TCT</small></div>`;
  }

  // A roster row's time column text (hospital timer, travel ETA or status).
  function memberTimeLabel(m) {
    const flag = (featureOn('travelFlags') && (m.state === 'Abroad' || m.state === 'Traveling' || m.state === 'Hospital'))
      ? parseCountryFlag(m.description)
      : '';
    const travelOn = featureOn('travelTimers') && m.state === 'Traveling' && !!travelDestOf(m.description);
    const baseLabel = m.state === 'Hospital' ? `Hospital ${fmtDuration(m.remaining)}` : ((travelOn && travelLabel(m)) || m.state);
    return flag ? `${flag} ${baseLabel}` : baseLabel;
  }

  function chainBoxClassFor(c) {
    if (!c.fetched) return 'tws-chain-loading';
    const phase = chainPhase(c);
    if (phase === 'cooldown') return 'tws-chain-cooldown';
    if (phase === 'dead') return 'tws-chain-dead';
    return chainClass(c.remaining);
  }

  function chainBodyFor(c) {
    if (!c.fetched) return '⚙ Loading...';
    const phase = chainPhase(c);
    if (phase === 'cooldown') {
      return c.cooldown > 0
        ? `Chain in cooldown &nbsp;|&nbsp; ${fmtDuration(c.cooldown)}`
        : 'Chain in cooldown…';
    }
    if (phase === 'dead') return 'Dead chain';
    const synced = (IS_SBX_BUILD && c === ownChain && c.pageSync) ? ' <span title="Synced to the chain clock Torn shows on this page" style="font-size:11px;opacity:.7">\u23f1</span>' : '';
    return `Chain: ${c.current} &nbsp;|&nbsp; ${fmtDuration(c.remaining)}${synced}`;
  }

  // Balanced/Lite: every second only the timers and chain boxes change;
  // the rest of the panel is rebuilt only when new data arrives.
  function updateInPlace__raw() {
    if (!panel || showSettings || getCfg(STORE_KEYS.collapsed, false)) return;
    const byId = {};
    enemyMembers.forEach((m) => { byId[m.id] = m; });
    homeMembers.forEach((m) => { byId[m.id] = m; });
    panel.querySelectorAll('.tws-time[data-time-id]').forEach((el) => {
      const m = byId[el.dataset.timeId];
      if (!m) return;
      const t = memberTimeLabel(m);
      if (el.innerHTML !== t) el.innerHTML = t;
    });
    [['own', ownChain], ['enemy', enemyChain]].forEach(([k, c]) => {
      const box = panel.querySelector(`.tws-chain-box[data-chain="${k}"]`);
      const body = box && box.querySelector('.tws-chain-body');
      if (!body) return;
      const cls = `tws-chain-box ${chainBoxClassFor(c)}`;
      if (box.className !== cls) box.className = cls;
      const h = chainBodyFor(c);
      if (body.innerHTML !== h) body.innerHTML = h;
    });
    applyHeaderFlash();
  }


  // ---------------------------------------------------------------------
  // PC WIDE MODE (trial): Enemy | Home | Attacks log side by side.
  // The rosters come from the same polls as the normal panel (no extra
  // API calls); the log reuses the Retal attacks feed.
  // ---------------------------------------------------------------------
  const WIDE_MIN_WIDTH = 1100;
  let wideWasOn = false;
  const PC_MODE_KEY = 'tws_pc_mode';
  // PC Mode (Advanced settings): the wide multi-column layout and the other
  // PC War Room behaviours. Off = the normal (mobile) War Room, unchanged.
  function pcMode() { return !IS_PDA && getCfg(PC_MODE_KEY, false) === true; }

  // PC Mode: Settings (General + Advanced) laid out side by side across the
  // full wide panel.
  let settingsSplitRight = false;
  let setWideWas = false;
  function settingsWideOn() {
    if (!panel || IS_PDA || !pcMode()) return false;
    if (window.innerWidth < WIDE_MIN_WIDTH) return false;
    return !!showSettings && settingsTab !== 'panel' && !getCfg(STORE_KEYS.collapsed, false);
  }

  function wideActive() {
    if (!panel || IS_PDA || !pcMode()) return false;
    if (window.innerWidth < WIDE_MIN_WIDTH) return false;
    if (showSettings || getCfg(STORE_KEYS.collapsed, false)) return false;
    return true;
  }
  function wideHomeCol() { return pageMode !== 'home' && !!enemyFactionId; }
  function wideLogOn() { return wideActive() && featureOn('wideAtkLog'); }
  function ownFactionLabel() {
    const n = (typeof ownFactionName !== 'undefined' && ownFactionName) ? ownFactionName : '';
    return n ? ` \u00b7 ${n}` : '';
  }

  function clampWidePanel() {
    if (!panel.style.left || panel.style.left === 'auto') return;
    const r = panel.getBoundingClientRect();
    if (r.right > window.innerWidth - 4) {
      panel.style.left = `${Math.max(0, window.innerWidth - r.width - 10)}px`;
    }
  }

  function wideTargetCol() { return wideHomeCol() && featureOn('targets'); }
  function wideColTitle(col) {
    if (col === 'target') return '\u2605 Targets';
    if (col === 'home' || pageMode === 'home') return `Home${ownFactionLabel()}`;
    return `Enemy${enemyFactionName ? ` \u00b7 ${enemyFactionName}` : ''}`;
  }

  function applyWideLayout__raw() {
    if (!panel) return;
    const on = wideActive();
    const homeCol = panel.querySelector('#tws-body-home');
    const col3 = panel.querySelector('#tws-col3');
    const tgtEl = panel.querySelector('#tws-body-target');
    const logCol = panel.querySelector('#tws-wide-log');
    const tgtOn = on && wideTargetCol();
    const logOn = on && featureOn('wideAtkLog');
    panel.classList.toggle('tws-wide-on', on);
    panel.classList.toggle('tws-pc', pcMode());
    if (homeCol) homeCol.style.display = (on && wideHomeCol()) ? 'block' : 'none';
    if (col3) {
      col3.style.display = (tgtOn || logOn) ? '' : 'none';
      col3.classList.toggle('tws-split', tgtOn && logOn);
    }
    if (tgtEl) tgtEl.style.display = tgtOn ? 'block' : 'none';
    if (logCol) logCol.style.display = logOn ? '' : 'none';
    if (on) {
      const colW = Math.max(260, Number(getCfg(STORE_KEYS.panelWidth, '')) || 320);
      const cols = 1 + (wideHomeCol() ? 1 : 0) + ((tgtOn || logOn) ? 1 : 0);
      const w = Math.min(cols * colW, window.innerWidth - 20);
      if (panel.style.width !== `${w}px`) panel.style.width = `${w}px`;
      clampWidePanel();
      if (!wideWasOn && logOn) {
        atkLogSig = '';
        setTimeout(() => {
          const o = getOwnFactionId();
          if (o) refreshRetalWindow(o, (pageMode !== 'home' && enemyFactionId) ? enemyFactionId : null);
        }, 0);
      }
    } else if (wideWasOn) {
      const saved = getCfg(STORE_KEYS.panelWidth, '');
      panel.style.width = saved ? `${saved}px` : '';
    }
    wideWasOn = on;
    const setWide = !on && settingsWideOn();
    panel.classList.toggle('tws-set-wide', setWide);
    if (setWide) {
      const colW = Math.max(260, Number(getCfg(STORE_KEYS.panelWidth, '')) || 320);
      const w = Math.min(Math.max(3 * colW, 960), window.innerWidth - 20);
      if (panel.style.width !== `${w}px`) panel.style.width = `${w}px`;
      try { clampWidePanel(); } catch (e) { /* ignore */ }
    } else if (setWideWas && !on) {
      const saved = getCfg(STORE_KEYS.panelWidth, '');
      panel.style.width = saved ? `${saved}px` : '';
    }
    setWideWas = setWide;
    if (popout && popout.root.style.display === 'flex') matchPopoutToPanel();
  }

  // Pop-outs open just inside the War Room panel, below its header, so the
  // header buttons (Rev, blood, temporaries...) stay visible and usable.
  // Once you resize one yourself it keeps your size until it's closed.
  function matchPopoutToPanel() {
    if (!popout || !panel || popout.userSized) return;
    const st = popout.root.style;
    const r = panel.getBoundingClientRect();
    const head = panel.querySelector('#tws-header');
    const hb = head ? head.getBoundingClientRect().bottom : r.top + 34;
    if (getCfg(STORE_KEYS.collapsed, false) || r.width < 200 || r.height < 200) {
      st.top = st.left = st.width = st.height = '';
      return;
    }
    // Just below the header bar, across the panel's width, down to the
    // panel's bottom (kept on screen if the panel runs past it).
    const top = Math.max(0, Math.round(hb + 3));
    const bottom = Math.min(r.bottom, window.innerHeight);
    const left = Math.max(0, Math.round(r.left + 4));
    st.top = `${top}px`;
    st.left = `${left}px`;
    st.width = `${Math.round(Math.min(r.right, window.innerWidth) - left - 4)}px`;
    st.height = `${Math.max(160, Math.round(bottom - top - 4))}px`;
  }

  // Resize handles on every edge and corner, like a normal window.
  function ensurePopoutHandles() {
    if (!popout || popout.handles) return;
    popout.handles = true;
    const root = popout.root;
    const MINW = 280;
    const MINH = 160;
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      const h = document.createElement('div');
      h.className = `tws-po-rs tws-po-rs-${dir}`;
      h.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const r = root.getBoundingClientRect();
        const st0 = { x: e.clientX, y: e.clientY, top: r.top, left: r.left, w: r.width, h: r.height };
        // The Torn page inside the pop-out would swallow the mouse otherwise.
        popout.frame.style.pointerEvents = 'none';
        document.documentElement.style.userSelect = 'none';
        try { h.setPointerCapture(e.pointerId); } catch (e2) { /* ignore */ }
        const move = (ev) => {
          const dx = ev.clientX - st0.x;
          const dy = ev.clientY - st0.y;
          let top = st0.top;
          let left = st0.left;
          let w = st0.w;
          let hh = st0.h;
          if (dir.indexOf('e') !== -1) w = Math.max(MINW, Math.min(st0.w + dx, window.innerWidth - st0.left));
          if (dir.indexOf('s') !== -1) hh = Math.max(MINH, Math.min(st0.h + dy, window.innerHeight - st0.top));
          if (dir.indexOf('w') !== -1) {
            left = Math.max(0, Math.min(st0.left + dx, st0.left + st0.w - MINW));
            w = st0.w + (st0.left - left);
          }
          if (dir.indexOf('n') !== -1) {
            top = Math.max(0, Math.min(st0.top + dy, st0.top + st0.h - MINH));
            hh = st0.h + (st0.top - top);
          }
          root.style.top = `${top}px`;
          root.style.left = `${left}px`;
          root.style.width = `${w}px`;
          root.style.height = `${hh}px`;
          popout.userSized = true;
        };
        const up = () => {
          h.removeEventListener('pointermove', move);
          h.removeEventListener('pointerup', up);
          h.removeEventListener('pointercancel', up);
          popout.frame.style.pointerEvents = '';
          document.documentElement.style.userSelect = '';
        };
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
        h.addEventListener('pointercancel', up);
      });
      root.appendChild(h);
    });

    // Drag the title bar to move the pop-out (its buttons still just click).
    const bar = root.querySelector('#tws-po-bar');
    if (bar) {
      bar.style.cursor = 'move';
      bar.style.touchAction = 'none';
      bar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || (e.target.closest && e.target.closest('.tws-po-btn'))) return;
        e.preventDefault();
        const r = root.getBoundingClientRect();
        const st0 = { x: e.clientX, y: e.clientY, top: r.top, left: r.left, w: r.width };
        popout.frame.style.pointerEvents = 'none';
        document.documentElement.style.userSelect = 'none';
        try { bar.setPointerCapture(e.pointerId); } catch (e2) { /* ignore */ }
        const move = (ev) => {
          const left = Math.max(0, Math.min(st0.left + ev.clientX - st0.x, window.innerWidth - st0.w));
          const top = Math.max(0, Math.min(st0.top + ev.clientY - st0.y, window.innerHeight - 30));
          root.style.left = `${left}px`;
          root.style.top = `${top}px`;
          if (!root.style.width) root.style.width = `${st0.w}px`;
          popout.userSized = true;
        };
        const up = () => {
          bar.removeEventListener('pointermove', move);
          bar.removeEventListener('pointerup', up);
          bar.removeEventListener('pointercancel', up);
          popout.frame.style.pointerEvents = '';
          document.documentElement.style.userSelect = '';
        };
        bar.addEventListener('pointermove', move);
        bar.addEventListener('pointerup', up);
        bar.addEventListener('pointercancel', up);
      });
    }
  }

  function fitWideColumn(colEl) {
    const scroller = colEl && colEl.querySelector('#tws-roster');
    if (!scroller) return;
    const staticEl = colEl.querySelector('#tws-static');
    const staticH = (staticEl && staticEl.parentElement === colEl) ? staticEl.offsetHeight : 0;
    scroller.style.maxHeight = `${colEl.getBoundingClientRect().height - staticH}px`;
  }

  function renderWideSide(side, column, el) {
    const leftSide = viewSide;
    viewSide = side;
    try {
      renderInner({ column, body: el });
    } finally {
      viewSide = leftSide;
    }
    fitWideColumn(el);
  }

  function renderWide__raw() {
    // Home and Targets have their own sections, so the first one is Enemy.
    if (viewSide !== 'enemy' && wideHomeCol()) viewSide = 'enemy';
    if (viewSide === 'log') viewSide = wideHomeCol() ? 'enemy' : 'home'; // the log has its own column
    renderInner({ column: 'left' });
    if (wideHomeCol()) renderWideSide('home', 'home', panel.querySelector('#tws-body-home'));
    if (wideTargetCol()) renderWideSide('target', 'target', panel.querySelector('#tws-body-target'));
    if (featureOn('wideAtkLog')) renderAtkLog();
  }

  // ---- Attacks log column: the same log as the Attacks tab ----
  function renderAtkLog__raw() {
    if (!panel || !wideLogOn()) return;
    const col = panel.querySelector('#tws-wide-log');
    if (!col) return;
    if (col.firstChild && atkLogSignature() === atkLogSig) return;
    const oldList = col.querySelector('.tws-log-list');
    const oldScroll = oldList ? oldList.scrollTop : 0;
    col.innerHTML = `<div class="tws-log-head"><div class="tws-col-title">Attacks log</div></div>${atkLogHtml()}`;
    wireAtkLog(col);
    const newList = col.querySelector('.tws-log-list');
    if (newList && oldScroll > 0) newList.scrollTop = oldScroll;
  }

  let welcomeChecked = false;
  function render__raw() {
    try {
      if (!welcomeChecked) { welcomeChecked = true; setTimeout(() => { try { maybeShowWelcome(); } catch (e) { /* ignore */ } }, 600); }
      applyColourTheme();
      applyWideLayout();
      if (wideActive()) renderWide(); else renderInner();
      sizeSettingsScroll();
      applyMiniDock();
      try {
        __diag.lastRender = performance.now();
        if (showSettings && __diag.blanks.length < 10) {
          const bd = panel.querySelector('#tws-body');
          const st = bd && bd.querySelector('#tws-settings');
          const txt = st ? (st.textContent || '').trim().length : 0;
          if (txt < 40) {
            const br = bd ? bd.getBoundingClientRect() : null;
            __diag.blanks.push(`${new Date().toISOString().slice(11, 19)} UTC tab ${settingsTab} | settings box ${st ? `text ${txt}, ${Math.round(st.getBoundingClientRect().height)}h, scrollTop ${Math.round(st.scrollTop)}, maxH ${st.style.maxHeight || '-'}` : 'missing'} | body ${br ? `${Math.round(br.height)}h` : 'none'} children ${bd ? bd.children.length : 0}: ${bd ? Array.from(bd.children).slice(0, 4).map((c) => c.id || c.className || c.tagName).join(', ') : '-'}`);
          }
        }
      } catch (e) { /* ignore */ }
    } catch (e) {
      reportCrash('panel drawing', e);
    }
  }

  // Every Settings tab scrolls inside the panel: give #tws-settings the
  // panel body's height (General never had this, so it couldn't scroll).
  // Opening the minimised logo: the full panel is nudged left/up just enough
  // to be completely on screen. The logo's own spot is untouched, so
  // minimising again puts it back exactly where it was dragged to.
  // ---- Minimised icon docked in Torn's top bar ----
  function miniDockOn() { return getCfg(STORE_KEYS.miniDock, true) !== false && featureOn('miniLogo'); }
  // The empty stretch of Torn's top bar right of the logo + menu button.
  let miniDockBlocked = false;
  let miniDockBlockedToast = false;
  function tornHeaderDockSpot() {
    miniDockBlocked = false;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const logos = Array.from(document.querySelectorAll('[class*="logo" i], [id*="logo" i], a[href="/index.php"], a[href="https://www.torn.com/index.php"]'))
      .filter((el) => !el.closest('[id^="tws-"], [class*="tws-"]'));
    for (const logo of logos) {
      const r = logo.getBoundingClientRect();
      if (r.width < 40 || r.height < 15 || r.height > 120 || r.left > vw * 0.4) continue;
      if (r.top + window.scrollY > 400) continue;
      let bar = logo.parentElement;
      while (bar && bar !== document.body) {
        const br0 = bar.getBoundingClientRect();
        if (br0.width >= vw * 0.9 && br0.height >= r.height * 0.8 && br0.height <= Math.max(r.height * 2.2, 90)) break;
        bar = bar.parentElement;
      }
      if (!bar || bar === document.body) continue;
      const br = bar.getBoundingClientRect();
      let leftEdge = r.right;
      let rightEdge = br.right;
      bar.querySelectorAll('*').forEach((el) => {
        const er = el.getBoundingClientRect();
        if (!er.width || !er.height || er.width > br.width * 0.5 || er.bottom <= br.top || er.top >= br.bottom) return;
        if (er.left + er.width / 2 < br.left + br.width * 0.45) leftEdge = Math.max(leftEdge, er.right);
        else rightEdge = Math.min(rightEdge, er.left);
      });
      const size = Math.round(Math.max(26, Math.min(36, br.height - 4)));
      if (rightEdge - leftEdge < size + 16) continue;
      const top = br.top + (br.height - size) / 2;
      let left = leftEdge + 14;
      // Other add-ons (e.g. Torn Tools) put their own icon in this gap, not
      // always inside Torn's bar -- look at what's really on screen there.
      if (typeof document.elementsFromPoint === 'function') {
        for (let tries = 0; tries < 5; tries++) {
          let blockRight = 0;
          [[0.1, 0.5], [0.5, 0.5], [0.9, 0.5], [0.5, 0.15], [0.5, 0.85]].forEach(([fx, fy]) => {
            const x = left + size * fx;
            const y = top + size * fy;
            if (x < 0 || y < 0 || x >= vw || y >= window.innerHeight) return;
            document.elementsFromPoint(x, y).forEach((el) => {
              if (el === bar || el.contains(bar) || el.closest('[id^="tws-"], [class*="tws-"]')) return;
              const er = el.getBoundingClientRect();
              if (er.width < 6 || er.width > 160 || er.height > 100) return; // backgrounds, not icons
              blockRight = Math.max(blockRight, er.right);
            });
          });
          if (!blockRight) break;
          left = blockRight + 10;
        }
      }
      if (left + size > rightEdge - 6) { miniDockBlocked = true; continue; } // another add-on is using the gap
      return { left, top, size };
    }
    return null;
  }
  let miniDockWas = false;
  let miniDockInit = false;
  function applyMiniDock() {
    if (!panel || IN_POPOUT_FRAME) return;
    if (!miniDockInit) {
      miniDockInit = true;
      let raf = 0;
      window.addEventListener('scroll', () => {
        if (raf || !panel.classList.contains('tws-mini')) return;
        raf = requestAnimationFrame(() => { raf = 0; applyMiniDock(); });
      }, { passive: true });
      setInterval(() => { if (panel.classList.contains('tws-mini') || miniDockWas) applyMiniDock(); }, 700);
    }
    const spot = (panel.classList.contains('tws-mini') && miniDockOn()) ? tornHeaderDockSpot() : null;
    panel.classList.toggle('tws-mini-dock', !!spot);
    if (!spot && miniDockBlocked && !miniDockBlockedToast) {
      miniDockBlockedToast = true;
      try { showToast('Another add-on is using that spot in Torn\u2019s top bar, so the Kraken icon is floating instead.'); } catch (e) { /* ignore */ }
    }
    if (spot) {
      try { __diag.lastDock = performance.now(); } catch (e) { /* ignore */ }
      panel.style.setProperty('--tws-dock-size', `${spot.size}px`);
      panel.style.left = `${Math.round(spot.left)}px`;
      panel.style.top = `${Math.round(spot.top)}px`;
      panel.style.right = 'auto';
      miniDockWas = true;
    } else if (miniDockWas) {
      miniDockWas = false;
      const t = getCfg(STORE_KEYS.posTop, '');
      const l = getCfg(STORE_KEYS.posLeft, '');
      panel.style.top = t || '';
      panel.style.left = l || '';
      panel.style.right = (t && l) ? 'auto' : '';
      keepPanelInView();
    } else if (panel.classList.contains('tws-mini')) {
      keepPanelInView();
    }
  }

  function keepPanelInView() {
    if (!panel) return;
    if (panel.classList.contains('tws-mini-dock')) return; // docked in Torn's bar
    const savedTop = getCfg(STORE_KEYS.posTop, '');
    const savedLeft = getCfg(STORE_KEYS.posLeft, '');
    if (!savedTop || !savedLeft) return; // never dragged: default layout
    panel.style.top = savedTop;
    panel.style.left = savedLeft;
    panel.style.right = 'auto';
    // (the minimised icon is clamped too: a saved spot off the edge of a
    // phone screen used to leave it invisible when it couldn't dock)
    const r = panel.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(0, Math.min(r.left, vw - r.width));
    const top = Math.max(0, Math.min(r.top, vh - r.height));
    if (left !== r.left) panel.style.left = `${left}px`;
    if (top !== r.top) panel.style.top = `${top}px`;
  }

  function sizeSettingsScroll() {
    if (!panel || !showSettings) return;
    const body = panel.querySelector('#tws-body');
    const els = body ? body.querySelectorAll('#tws-settings') : [];
    if (!els.length) return;
    const h = body.getBoundingClientRect().height;
    if (h > 50) els.forEach((el) => { el.style.maxHeight = h + 'px'; });
  }

  function renderInner__raw(opts) {
    if (!panel) return;
    // Wide mode: 'left' (Enemy/Target) or 'home' column; null = normal panel.
    const wideCol = (opts && opts.column) || null;
    applyHeaderVisibility();
    // The Target tab only exists while its feature is on.
    if (!featureOn('targets') && viewSide === 'target') viewSide = 'enemy';
    if (!featureOn('atkLog') && viewSide === 'log') viewSide = pageMode === 'home' ? 'home' : 'enemy';
    const body = (opts && opts.body) || panel.querySelector('#tws-body');
    const colSide = viewSide; // this column's side, for the click handlers below
    const collapsed = getCfg(STORE_KEYS.collapsed, false);
    // Minimised: the whole panel becomes the small Kraken logo (tap to expand).
    panel.classList.toggle('tws-mini', !!collapsed && featureOn('miniLogo'));
    panel.classList.toggle('tws-collapsed', !!collapsed);
    panel.classList.toggle('tws-perf-lite', perfMode() === 'lite');
    panel.querySelector('#tws-collapse-btn').textContent = collapsed ? ' ▸' : (showSettings ? ' ▴' : ' ▾');

    // Header enemy-name label -- updated here (not deep in the body-render
    // logic below) so it stays current even while collapsed or in Settings.
    applyHeaderFlash();
    const enemyNameEl = panel.querySelector('#tws-enemy-name');
    if (enemyNameEl) {
      enemyNameEl.textContent = (pageMode !== 'home' && enemyFactionId)
        ? `vs ${enemyFactionName || 'detecting...'}`
        : '';
    }
    try { fitHeader(); } catch (e) { /* ignore */ }

    if (collapsed || showSettings) closeTravelPopup();
    if (collapsed) {
      body.style.display = 'none';
      return;
    }
    body.style.display = 'block';

    if (showSettings) {
      const splitSettings = settingsWideOn();
      if (settingsTab === 'bounty' && !splitSettings) {
        renderBountySettings(body);
        return;
      }
      if (settingsTab === 'advanced' && !splitSettings) {
        renderAdvancedSettings(body);
        return;
      }
      if (settingsTab === 'panel') {
        renderPanelSettings(body);
        return;
      }
      const renderGeneralInto = (body) => {
      const pdaKeySupplied = IS_PDA && PDA_INJECTED_KEY !== '###PDA-APIKEY###';
      const keyFieldHtml = pdaKeySupplied
        ? `<div style="opacity:0.6;margin-bottom:6px;">API key supplied automatically by Torn PDA.</div>`
        : `<label>Torn API Key</label>
           <input id="tws-in-key" type="text" value="${getCfg(STORE_KEYS.apiKey)}" placeholder="Limited/Full access key">`;
      body.innerHTML = `
        <div id="tws-settings">
          ${settingsTabsBar()}
          ${creditCardHtml()}
          ${keyFieldHtml}
          ${referralHtml()}
          <label>Estimated battle stats from</label>
          <select id="tws-in-statsrc">
            <option value="ff" ${statsSource() === 'ff' ? 'selected' : ''}>FFScouter (free)</option>
            <option value="bsp" ${statsSource() === 'bsp' ? 'selected' : ''}>BSP \u2013 Battle Stats Predictor (needs a BSP subscription)</option>
            <option value="both" ${statsSource() === 'both' ? 'selected' : ''}>Both (F = FFScouter, B = BSP)</option>
          </select>
          <label>FFScouter API Key (optional — shows estimated battle stats)</label>
          <input id="tws-in-ff" type="text" value="${getCfg(STORE_KEYS.ffscouterKey)}" placeholder="16-char key from ffscouter.com">
          <label>BSP key (the Torn API key you registered with BSP)</label>
          <input id="tws-in-bsp" type="text" value="${getCfg(STORE_KEYS.bspKey)}" placeholder="${bspInstalledKey() ? 'Using the key from BSP on this device' : '16-char Torn key registered with BSP'}">
          <label>TornStats key (optional \u2013 your faction\u2019s spies)</label>
          <input id="tws-in-ts" type="text" value="${getCfg(STORE_KEYS.tsKey)}" placeholder="Your TornStats API key (tornstats.com \u2192 Settings)">
          <div style="color:#888;font-size:11px;margin:2px 0 8px;">Real stats from spies your faction shares on TornStats replace the estimates (\ud83d\udd75). Sent only to TornStats; the spies stay on this device.</div>
          <div style="color:#888;font-size:11px;margin:2px 0 8px;">Only used when BSP is picked above. If BSP is installed on this device, its saved predictions are used first (no requests), and its key is picked up automatically. The key is sent only to the BSP server, as BSP itself does.</div>
          <label>Medical item for the header 🩸 button</label>
          <select id="tws-in-med">
            ${[['blood', 'Blood Bag (safe for your blood type)'], ['medkit', 'Med kit (smallest that gets you to full health)']].map(([v, l]) =>
              `<option value="${v}" ${getMedItem() === v ? 'selected' : ''}>${l}</option>`
            ).join('')}
          </select>
          <div style="color:#888;font-size:10px;margin:-2px 0 8px;">Taken from the faction armoury first, then your own Items if the armoury has none.</div>
          <label>Your Blood Type (the header 🩸 uses a compatible bag for this type)</label>
          <select id="tws-in-blood">
            <option value="">Not set</option>
            ${['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bt) =>
              `<option value="${bt}" ${getCfg(STORE_KEYS.bloodType) === bt ? 'selected' : ''}>${bt}</option>`
            ).join('')}
          </select>
          <label>Revives</label>
          <div class="tws-tri" id="tws-tri-revives">
            <span data-v="off" class="${getRevives() === 'off' ? 'tws-tri-off' : ''}">Off</span>
            <span data-v="friends" class="${getRevives() === 'friends' ? 'tws-tri-friends' : ''}">Friends</span>
            <span data-v="on" class="${getRevives() === 'on' ? 'tws-tri-on' : ''}">On</span>
          </div>
          <div style="color:#888;font-size:10px;margin:0 0 8px;">Tap Off, Friends or On: Torn\u2019s Preferences opens in the pop-out with that option outlined – pick it and press Torn\u2019s Update button (Torn\u2019s rules don\u2019t allow scripts to change it for you). Greys out the Rev button when Off.</div>
          ${'Sandbox War Room'.indexOf('Sandbox') === 0 ? `<label style="display:flex;align-items:center;gap:6px;margin-bottom:8px;cursor:pointer;"><input type="checkbox" id="tws-in-analytics" style="width:auto;margin:0;" ${featureOn('perfMonitor') ? 'checked' : ''}> \ud83d\udcc8 Analytics bar (performance monitor, bottom-left)</label>` : ''}
          <label>Revive service (Rev button)</label>
          <select id="tws-in-revprov">
            ${REVIVE_PROVIDERS.map((p) => `<option value="${p.id}" ${reviveProvider().id === p.id ? 'selected' : ''}>${p.name} \u2013 ${p.cost}</option>`).join('')}
          </select>
          <div id="tws-revprov-desc" style="color:#aaa;font-size:10px;margin:-2px 0 8px;line-height:1.4;">${reviveProviderHtml(reviveProvider())}</div>
          <label>Performance mode</label>
          <select id="tws-in-perf">
            ${[['full', 'Full (roster every 10s)'], ['balanced', 'Balanced (roster every 15s)'], ['lite', 'Lite (roster every 20s)']].map(([v, l]) =>
              `<option value="${v}" ${perfMode() === v ? 'selected' : ''}>${l}</option>`
            ).join('')}
          </select>
          <div style="color:#888;font-size:10px;margin:-2px 0 8px;">Every feature works in every mode. Balanced and Lite go easier on slower PCs: tabs you're not looking at pause (and refresh the moment you return), the background armoury only loads when you use 🩸 and closes after 5 minutes idle, and the panel redraws less. Lite also turns off flashing. Applies immediately.</div>
          <label style="display:flex;align-items:center;gap:8px;margin:4px 0 2px;">
            <input id="tws-in-turbo" type="checkbox" style="width:auto;margin:0;" ${turboMode ? 'checked' : ''}>
            ⚡ Turbo refresh (faster updates)
          </label>
          <div style="color:#888;font-size:11px;margin:0 0 8px;">Roster every 5s and chain every 3s, whatever the performance mode. Applies immediately. Uses more of your API allowance, shared with anything else using the same key.</div>
          <div style="color:#888;font-size:11px;margin:0 0 8px;">Switch individual features on/off in the Advanced tab. Panel width/height are on the Panel tab.</div>
          <button id="tws-save-btn">Save</button>
        </div>
      `;
      attachSettingsTabs(body);
      attachCreditLink(body);
      // Revives: three direct buttons (Off / Friends / On) -- tap the one
      // you want, applies straight away.
      const anaBox = body.querySelector('#tws-in-analytics');
      if (anaBox) anaBox.addEventListener('change', () => {
        setFeature('perfMonitor', anaBox.checked);
        showToast(anaBox.checked ? 'Analytics bar on.' : 'Analytics bar off.');
      });
      const revProv = body.querySelector('#tws-in-revprov');
      if (revProv) revProv.addEventListener('change', () => {
        setCfg(STORE_KEYS.reviveProvider, revProv.value);
        const p = reviveProvider();
        const dsc = body.querySelector('#tws-revprov-desc');
        if (dsc) dsc.innerHTML = reviveProviderHtml(p);
        try { applyHeaderVisibility(); } catch (e) { /* ignore */ }
        showToast(`Rev button now uses ${p.name} (${p.cost}).`);
      });
      const tri = body.querySelector('#tws-tri-revives');
      if (tri) {
        tri.querySelectorAll('span[data-v]').forEach((sp) => {
          sp.addEventListener('click', () => {
            const next = sp.dataset.v;
            if (getRevives() === next) return; // already selected
            setCfg(STORE_KEYS.revives, next);
            tri.querySelectorAll('span').forEach((s2) => {
              s2.className = s2.dataset.v === next ? `tws-tri-${next}` : '';
            });
            applyHeaderVisibility();
            openRevivesPopout(next);
          });
        });
      }
      // Turbo applies the moment it's ticked (no need to press Save).
      body.querySelector('#tws-in-perf').addEventListener('change', (e) => {
        setCfg(STORE_KEYS.perfMode, e.target.value);
        applyPollIntervals();
        syncBloodFrame();
        if (perfMode() !== 'full' && prefsFrame && !pushBusy) removePrefsFrame();
        showToast(`Performance mode: ${e.target.options[e.target.selectedIndex].text}`);
      });
      body.querySelector('#tws-in-turbo').addEventListener('change', (e) => {
        turboMode = e.target.checked;
        setCfg(STORE_KEYS.turboMode, turboMode);
        applyPollIntervals();
      });
      // Stats source + estimator keys save as soon as they change (no Save needed).
      const srcSel = body.querySelector('#tws-in-statsrc');
      if (srcSel) srcSel.addEventListener('change', () => {
        setCfg(STORE_KEYS.statsSource, (srcSel.value === 'bsp' || srcSel.value === 'both') ? srcSel.value : 'ff');
        showToast(`Estimated battle stats: ${statsSource() === 'both' ? 'FFScouter + BSP' : statsSourceName()}`);
        refreshRosters();
      });
      [['#tws-in-ff', STORE_KEYS.ffscouterKey], ['#tws-in-bsp', STORE_KEYS.bspKey], ['#tws-in-ts', STORE_KEYS.tsKey]].forEach(([sel, k]) => {
        const el = body.querySelector(sel);
        if (el) el.addEventListener('change', () => { setCfg(k, el.value.trim()); if (k === STORE_KEYS.tsKey) tsResetFails(); refreshRosters(); });
      });
      try { wireReferral(body); } catch (e) { /* ignore */ }
      body.querySelector('#tws-save-btn').addEventListener('click', () => {
        saveGeneralFields(body);
        showSettings = false;
        refreshRosters();
        refreshChain();
        render();
      });
      };
      if (splitSettings) {
        body.innerHTML = '<div class="tws-set-split"><div class="tws-set-col" id="tws-set-l"></div><div class="tws-set-col tws-set-r" id="tws-set-r"></div></div>';
        renderGeneralInto(body.querySelector('#tws-set-l'));
        settingsSplitRight = true;
        try {
          if (settingsTab === 'bounty') renderBountySettings(body.querySelector('#tws-set-r'));
          else renderAdvancedSettings(body.querySelector('#tws-set-r'));
        } finally { settingsSplitRight = false; }
        return;
      }
      renderGeneralInto(body);
      return;
    }

    const showHomeChain = true; // always shown now, even on the enemy's own faction page
    const showEnemyChain = pageMode !== 'home';

    // A running chain shows its count and time left. When its timer hits zero
    // it's "Chain in cooldown" with Torn's cooldown counting down, and only
    // once that has finished does it become "Dead chain" (see chainPhase).
    // Critically: nothing is "dead" until we've actually heard back from the
    // API at least once -- the initial pre-fetch state is also
    // current:0/cooldown:0, and that's "still loading," not "dead".
    const chainBoxClass = chainBoxClassFor;
    const chainBodyHtml = chainBodyFor;

    const homeChainHtml = showHomeChain
      ? `<div class="tws-chain-box ${chainBoxClass(ownChain)}" data-chain="own">
           <span class="tws-chain-tag">HOME</span>
           ${!getOwnFactionId()
             ? `<span style="font-size:11px;">Detecting your faction...</span>`
             : ownChain.error
               ? `<span style="font-size:11px;">${ownChain.error}</span>`
               : `<span class="tws-chain-body">${chainBodyHtml(ownChain)}</span>`}
         </div>`
      : '';

    const enemyChainHtml = showEnemyChain
      ? `<div class="tws-chain-box ${chainBoxClass(enemyChain)}" data-chain="enemy">
           <span class="tws-chain-tag">ENEMY</span>
           ${!enemyFactionId
             ? `<span style="font-size:11px;">Detecting enemy faction...</span>`
             : enemyChain.error
               ? `<span style="font-size:11px;">${enemyChain.error}</span>`
               : `<span class="tws-chain-body">${chainBodyHtml(enemyChain)}</span>`}
         </div>`
      : '';

    const chainHtml = wideCol === 'target' ? ''
      : wideCol === 'home' ? homeChainHtml
      : (wideCol === 'left' && pageMode !== 'home') ? enemyChainHtml
      : homeChainHtml + enemyChainHtml;

    // The war-result message sits right under the chain boxes, from the
    // moment a war ends until a new one is matched.
    const warResultBoxHtml = (wideCol !== 'home' && wideCol !== 'target' && featureOn('warResult') && postWarInfo) 
      ? (() => {
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - postWarInfo.endTime;
        return (elapsed < 86400) ? warResultHtml(postWarInfo) : '';
      })()
      : '';

    // Heads-up for a confirmed-but-not-yet-started war, so you can plan
    // ahead before the roster/chain UI above even has anything to show.
    const upcomingWarHtml = (featureOn('upcomingWar') && upcomingWar)
      ? `<div style="background:#3a2d1e;border:1px solid #6b4d1e;border-radius:6px;padding:8px;margin-bottom:8px;text-align:center;">
           ⚔️ War vs ${upcomingWar.enemyName || `Faction ${upcomingWar.enemyId}`} in ${fmtCountdown(upcomingWar.startTime - Math.floor(Date.now() / 1000))}
         </div>`
      : '';

    const isEnemySide = viewSide === 'enemy' || viewSide === 'target';
    const activeMembers = viewSide === 'home'
      ? homeMembers
      : pageMode === 'home' ? [] // no war: never show an old enemy roster
      : viewSide === 'target'
        ? enemyMembers.filter((m) => targetIds.has(m.id))
        : enemyMembers;

    // With the filter bar switched off, nothing is filtered.
    const tabFilters = featureOn('filterBar') ? currentFilters() : new Set();
    const matchesFilter = (m) => {
      if (tabFilters.size === 0) return true;
      if (tabFilters.has('online') && m.lastActionStatus === 'Online') return true;
      if (tabFilters.has('idle') && m.lastActionStatus === 'Idle') return true;
      if (tabFilters.has('offline') && m.lastActionStatus === 'Offline') return true;
      if (tabFilters.has('traveling') && m.state === 'Traveling') return true;
      if (tabFilters.has('abroad') && m.state === 'Abroad') return true;
      return false;
    };

    // Timer mode (default): attackable-now first, then hospitalized sorted
    // by release time, then everyone else alphabetically. "Descending" here
    // means longest-still-in-hospital first rather than soonest-out --
    // reversing the whole grouping wouldn't be useful since "attackable
    // now" should always stay on top regardless of direction.
    // Stats mode: sorted purely by FFScouter's raw battle stat estimate.
    // Respect mode: sorted by this war's respect total, and each row shows
    // name, level, stats and respect.
    // Both: anyone without a value sorts to the bottom either direction.
    // With the sort bar switched off (or no source available), it always
    // uses the default timer order.
    const filtered = activeMembers.filter(matchesFilter);
    const statsAvail = featureOn('ffStats');
    // Respect only exists during a war (it needs both factions).
    const respectAvail = featureOn('respectSort') && pageMode !== 'home' && !!enemyFactionId;
    let tabSort = featureOn('sortBar') ? currentSort() : { mode: 'timer', dir: 'asc' };
    if (tabSort.mode === 'stats' && !statsAvail) tabSort = { mode: 'timer', dir: 'asc' };
    if (tabSort.mode === 'respect' && !respectAvail) tabSort = { mode: 'timer', dir: 'asc' };
    const isRespectView = tabSort.mode === 'respect';
    const byNumericField = (getVal) => (a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      const haveA = typeof va === 'number';
      const haveB = typeof vb === 'number';
      if (!haveA && !haveB) return a.name.localeCompare(b.name);
      if (!haveA) return 1;
      if (!haveB) return -1;
      return tabSort.dir === 'asc' ? va - vb : vb - va;
    };
    let sorted;
    if (tabSort.mode === 'stats') {
      sorted = filtered.sort(byNumericField((m) =>
        (featureOn('ffStats') && m.ff && typeof m.ff.bs_estimate === 'number') ? m.ff.bs_estimate : null));
    } else if (tabSort.mode === 'online') {
      // Online first, then Idle, then Offline (Asc reverses). Ties: in Torn
      // (Okay) first, then estimated stats (highest first), then name.
      const act = (m) => ({ Online: 0, Idle: 1, Offline: 2 }[m.lastActionStatus] ?? 3);
      const statsOf = (m) => ((featureOn('ffStats') && m.ff && typeof m.ff.bs_estimate === 'number') ? m.ff.bs_estimate : -1);
      sorted = filtered.sort((a, b) => {
        const d = act(a) - act(b);
        if (d) return tabSort.dir === 'asc' ? -d : d;
        const ok = (a.state === 'Okay' ? 0 : 1) - (b.state === 'Okay' ? 0 : 1);
        if (ok) return ok;
        const st = statsOf(b) - statsOf(a);
        if (st) return st;
        return a.name.localeCompare(b.name);
      });
    } else if (isRespectView) {
      // Members with no recorded hits count as 0 respect.
      sorted = filtered.sort(byNumericField((m) => (typeof respectMap[m.id] === 'number' ? respectMap[m.id] : 0)));
    } else {
      // Timer sort (v1.80.2):
      //   TOP section: members in Torn -- Okay, plus hospital/jail in Torn.
      //     Desc: Okay first, then hospital/jail by time left (lowest first).
      //     Asc:  the reverse (longest hospital timer first, Okay last).
      //   BOTTOM section (always below, either direction): travelling,
      //     abroad, and anyone in an overseas hospital.
      //   Ties everywhere are broken by estimated stats (Desc = highest
      //   first, Asc = lowest first; no estimate = last), then name.
      const dirMul = tabSort.dir === 'desc' ? 1 : -1;
      const statsOf = (m) => ((featureOn('ffStats') && m.ff && typeof m.ff.bs_estimate === 'number') ? m.ff.bs_estimate : null);
      const overseasHosp = (m) => m.state === 'Hospital' && COUNTRY_KEYWORDS.some(([re]) => re.test(m.description || ''));
      const onTimer = (m) => (m.state === 'Hospital' && !overseasHosp(m)) || m.state === 'Jail';
      const section = (m) => ((m.state === 'Okay' || onTimer(m)) ? 0 : 1);
      const byStats = (a, b) => {
        const va = statsOf(a);
        const vb = statsOf(b);
        if (va !== null || vb !== null) {
          if (va === null) return 1;
          if (vb === null) return -1;
          if (va !== vb) return (vb - va) * dirMul;
        }
        return a.name.localeCompare(b.name);
      };
      sorted = filtered.sort((a, b) => {
        const sa = section(a);
        const sb = section(b);
        if (sa !== sb) return sa - sb;
        if (sa === 0) {
          const ga = onTimer(a) ? 1 : 0;
          const gb = onTimer(b) ? 1 : 0;
          if (ga !== gb) return (ga - gb) * dirMul;
          if (ga === 1 && a.remaining !== b.remaining) return (a.remaining - b.remaining) * dirMul;
        }
        return byStats(a, b);
      });
    }

    const showAttack = isEnemySide; // never show attack links for your own faction
    const currentFfError = viewSide === 'home' ? homeFfError : ffError;

    const rowsHtml = sorted.map((m) => {
      const attackable = showAttack && m.state === 'Okay';
      // Country flag: travellers, people abroad, and people in an overseas
      // hospital (their timer gets the flag of the country too).
      const flag = (featureOn('travelFlags') && (m.state === 'Abroad' || m.state === 'Traveling' || m.state === 'Hospital'))
        ? parseCountryFlag(m.description)
        : '';
      const travelOn = featureOn('travelTimers') && m.state === 'Traveling' && !!travelDestOf(m.description);
      const timeLabel = memberTimeLabel(m);
      const statusClass = m.state === 'Hospital' ? 'tws-status-hospital' : m.state === 'Okay' ? 'tws-status-okay' : '';
      // Name color-coding by online status applies everywhere; the flash
      // (online AND attackable) only makes sense on the enemy side.
      const lastActionClass = !featureOn('nameColors') ? ''
        : m.lastActionStatus === 'Online' ? 'tws-name-online'
        : m.lastActionStatus === 'Idle' ? 'tws-name-idle'
        : 'tws-name-offline';
      const flashClass = (featureOn('onlineFlash') && showAttack && m.lastActionStatus === 'Online' && m.state === 'Okay') ? 'tws-name-flash' : '';
      // FFScouter stats after the level; in the Respect view the war respect
      // total follows the stats.
      const themeId = colourTheme();
      // Stats are coloured by Fair Fight in every theme; the FairFight theme
      // also colours the name and level.
      const ffVal = (featureOn('ffStats') && m.ff) ? fairFightOf(m.ff) : null;
      const ffCol = ffColour(ffVal);
      const ffStyle = themeId === 'ff' ? (ffCol ? ` style="color:${ffCol};"` : ' style="color:#bbb;"') : '';
      const estStyle = ffCol ? ` style="color:${ffCol};opacity:1;"` : (themeId === 'ff' ? ' style="color:#bbb;"' : '');
      const ffDot = themeId === 'ff'
        ? `<span class="tws-ffdot ${m.lastActionStatus === 'Online' ? 'tws-ffdot-on' : m.lastActionStatus === 'Idle' ? 'tws-ffdot-idle' : 'tws-ffdot-off'}" title="${m.lastActionStatus || ''}"></span>`
        : '';
      const ffNum = (themeId === 'ff' && ffVal !== null) ? ` <span class="tws-ffval">FF ${ffVal.toFixed(2)}</span>` : '';
      const statsHtml = (featureOn('ffStats') && m.ff) ? ` <small class="tws-est${ffCol ? ' tws-est-ff' : ''}"${estStyle}>${estHtml(m.ff)}${ffNum}</small>` : '';
      const respectVal = typeof respectMap[m.id] === 'number' ? respectMap[m.id] : 0;
      const respectHtml = isRespectView
        ? ` <small class="tws-respect" data-resp-id="${m.id}" style="cursor:pointer;">${respectSource !== 'live' ? respectVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(respectVal).toLocaleString()}R</small>`
        : '';
      const figureHtml = statsHtml + respectHtml;
      // Star toggle to add/remove from the personal Target watchlist --
      // available from either the Enemy or Target tab.
      const isTargeted = targetIds.has(m.id);
      const homeCardHtml = (IS_SBX_BUILD && viewSide === 'home' && featureOn('targetCards'))
        ? ` <span class="tws-card-btn" data-card-id="${m.id}" title="Stat card (Sandbox test)">\ud83d\udcc8</span>` : '';
      const starHtml = (isEnemySide && featureOn('targets'))
        ? ` <span class="tws-star ${isTargeted ? 'tws-star-active' : ''}" data-target-id="${m.id}"${isTargeted && viewSide === 'target' && featureOn('starHold') ? ' data-hold="1" title="Hold to remove"' : ''}>${isTargeted ? '★' : '☆'}</span>${isTargeted && featureOn('targetCards') && viewSide === 'target' ? ` <span class="tws-card-btn" data-card-id="${m.id}" title="Stat card">\ud83d\udcc8</span>` : ''}`
        : '';
      // Copy icon -- taps to copy name/level/stats/link, for pasting into
      // faction chat. Enemy/target side only, and not in the Respect view.
      const copyIconHtml = (showAttack && !isRespectView && featureOn('copyIcons'))
        ? ` <span class="tws-copy-icon" data-copy-id="${m.id}" title="Send to faction chat (or copy)">⧉</span>`
        : '';
      // Bounty icon -- Home tab only, next to the chat icon. Opens that
      // faction mate's "place a bounty" page (with the amount from their
      // estimated stats and the reason filled in, if those are switched on).
      const bountyAmt = (!isEnemySide && !isRespectView && featureOn('bountyIcons')) ? bountyAmountFor(m) : 0;
      const bountyIconHtml = (!isEnemySide && !isRespectView && featureOn('bountyIcons'))
        ? ` <a class="tws-bounty-icon" data-bounty-id="${m.id}" target="_blank" href="${bountyUrl(m.id)}" title="Place a bounty on ${m.name}${bountyAmt ? ` ($${bountyAmt.toLocaleString()})` : ''}">💰</a>`
        : '';
      const retalTs = featureOn('retalDetect') ? retalMap[m.id] : null;
      const isRetal = !!(attackable && retalTs && (Date.now() / 1000 - retalTs) <= RETAL_WINDOW_SEC);
      const atkLabel = isRetal ? `Retal${retalTimerHtml(retalTs)}` : 'ATK';
      const actionHtml = showAttack
        ? `<a class="tws-atk ${attackable ? '' : (m.state === 'Traveling' ? 'tws-atk-travel' : 'tws-atk-disabled')}" data-atk-id="${m.id}" target="_blank"
             href="${attackable ? attackUrl(m.id) : '#'}">${atkLabel}</a>`
        : '';
      const profileUrl = `https://www.torn.com/profiles.php?XID=${m.id}`;
      return `
        <div class="tws-row">
          <span class="tws-name" data-row-id="${m.id}">${ffDot}<a class="tws-name-link ${themeId === 'ff' ? '' : lastActionClass} ${flashClass}"${ffStyle} target="_blank" href="${profileUrl}">${m.name}</a> <small class="${themeId === 'ff' ? '' : lastActionClass}"${ffStyle}>(Lvl ${m.level})</small>${figureHtml}${bountyIconHtml}${copyIconHtml}${starHtml}${homeCardHtml}</span>
          <span class="tws-time ${statusClass}${flashClass ? ' tws-name-flash' : ''}${travelOn ? ' tws-travel-eta' : ''}" data-time-id="${m.id}"${travelOn ? ` data-travel-id="${m.id}" title="Tap for every travel method"` : ''}>${timeLabel}</span>
          ${actionHtml}
        </div>
      `;
    }).join('');

    // Which tabs make sense depends on what data actually exists for this
    // page: Target is available anywhere Enemy is (when its feature is on),
    // since it's just a filtered subset of the same roster. Home is now
    // available on the enemy's own page too, since we fetch it there
    // regardless of pageMode.
    const availableTabs = wideCol ? [] : [['enemy', 'Enemy'], ['home', 'Home']].concat(featureOn('targets') ? [['target', 'Target']] : [])
      .concat(featureOn('atkLog') ? [['log', 'Attacks']] : []);
    const colTitleHtml = wideCol ? `<div class="tws-col-title">${wideColTitle(wideCol)}</div>` : '';
    const tabsHtml = availableTabs.length > 1
      ? `<div class="tws-tabs">
           ${availableTabs.map(([key, label]) => `
             <div class="tws-tab ${viewSide === key ? 'tws-tab-active' : ''}" data-side="${key}">${label}</div>
           `).join('')}
         </div>`
      : colTitleHtml;

    const sortBarHtml = featureOn('sortBar') ? `
      <div class="tws-sortbar">
        <span class="tws-sort-btn ${tabSort.mode === 'timer' ? 'tws-sort-active' : ''}" data-sort="timer">Timer</span>
        <span class="tws-sort-btn ${tabSort.mode === 'online' ? 'tws-sort-active' : ''}" data-sort="online">Online</span>
        ${statsAvail ? `<span class="tws-sort-btn ${tabSort.mode === 'stats' ? 'tws-sort-active' : ''}" data-sort="stats">Stats</span>` : ''}
        ${respectAvail ? `<span class="tws-sort-btn ${isRespectView ? 'tws-sort-active' : ''}" data-sort="respect">${respectLoading ? 'Respect…' : 'Respect'}</span>` : ''}
        <span class="tws-sort-dir" title="Toggle direction">${tabSort.dir === 'asc' ? '↑ Asc' : '↓ Desc'}</span>
      </div>
    ` : '';

    const filterDefs = [
      ['all', 'All'],
      ['online', 'Online'],
      ['idle', 'Idle'],
      ['offline', 'Offline'],
      ['traveling', 'Traveling'],
      ['abroad', 'Abroad'],
    ];
    const filtersHtml = featureOn('filterBar') ? `
      <div class="tws-filters">
        ${filterDefs.map(([key, label]) => `
          <div class="tws-filter-chip ${(key === 'all' ? tabFilters.size === 0 : tabFilters.has(key)) ? 'tws-filter-active' : ''}" data-filter="${key}">${label}</div>
        `).join('')}
      </div>
    ` : '';

    const noWarMsg = '<b>No war right now.</b><br>Your faction isn\u2019t in a ranked war, so there are no enemies to show. This tab fills in by itself once a war is drawn.'
      + (viewSide === 'target' ? '<br><br>Then tap \u2606 next to a name in the Enemy tab to add them here.' : '')
      ;
    const emptyMessage = (pageMode === 'home' && viewSide !== 'home') ? noWarMsg : viewSide === 'target'
      ? 'No targets selected. Tap ☆ next to a name in the Enemy tab to add them here.'
      : 'No members match this view.';

    const fixedTop = featureOn('fixedTop');
    const staticBlock = `
      <div id="tws-static">
        ${updateBannerHtml()}
        ${upcomingWarHtml}
        ${chainHtml}
        ${warResultBoxHtml}
        ${tabsHtml}
        ${viewSide === 'enemy' ? activityStripHtml(enemyMembers) : ''}
        ${viewSide === 'log' ? '' : sortBarHtml}
        </div>
    `;
    body.innerHTML = `
      ${fixedTop ? staticBlock : ''}
      <div id="tws-roster">
        ${fixedTop ? '' : staticBlock}
        ${viewSide === 'log' ? atkLogHtml() : (rowsHtml || `<div style="opacity:0.6;">${emptyMessage}</div>`)}
        ${lastError ? `<div class="tws-error">${lastError}</div>` : ''}
        ${currentFfError ? `<div class="tws-error">${statsSource() === 'both' ? '' : `${statsSourceName()}: `}${currentFfError}</div>` : ''}
        ${(isRespectView && respectError) ? `<div class="tws-error">Respect: ${respectError}</div>` : ''}
        ${(isRespectView && respectSource === 'calc') ? `<div style="color:#888;font-size:10px;margin-top:6px;">Calculated from the war's full attack history. Updates while Respect stays open.</div>` : ''}
        ${(isRespectView && respectSource === 'report' && warCheck) ? `<div style="color:#888;font-size:10px;margin-top:6px;">${warCheckText(warCheck)}</div>` : ''}
        ${(isRespectView && respectSource === 'live') ? `<div style="color:#888;font-size:10px;margin-top:6px;">Live figures only cover Torn's most recent attacks, so they can be lower than the war page. The exact scores appear once the war has ended.</div>` : ''}
        </div>
    `;

    // Dynamically set roster height to remaining space
    const staticEl = body.querySelector("#tws-static");
    const rosterEl = body.querySelector("#tws-roster");
    if (staticEl && rosterEl) {
      const bodyRect = body.getBoundingClientRect();
      const staticHeight = (staticEl.parentElement === body ? staticEl.offsetHeight : 0);
      const maxRosterHeight = bodyRect.height - staticHeight;
      rosterEl.style.maxHeight = maxRosterHeight + "px";
    }

    body.querySelectorAll('.tws-tab').forEach((el) => {
      el.addEventListener('click', () => {
        viewSide = el.dataset.side;
        render();
      });
    });
    if (viewSide === 'log') wireAtkLog(body);
    wireUpdateBanner(body);
    body.querySelectorAll('.tws-sort-btn').forEach((el) => {
      el.addEventListener('click', () => {
        const mode = el.dataset.sort;
        const s = currentSort(colSide);
        const wasRespect = s.mode === 'respect';
        s.mode = mode;
        s.dir = SORT_MODE_DEFAULT_DIR[mode] || 'asc';
        // Selecting Respect (or tapping it again) fetches fresh numbers.
        if (mode === 'respect' && (!wasRespect || !respectLoading)) refreshRespect();
        render();
      });
    });
    const sortDirEl = body.querySelector('.tws-sort-dir');
    if (sortDirEl) {
      sortDirEl.addEventListener('click', () => {
        const s = currentSort(colSide);
        s.dir = s.dir === 'asc' ? 'desc' : 'asc';
        render();
      });
    }
    body.querySelectorAll('.tws-filter-chip').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.dataset.filter;
        const filters = currentFilters(colSide);
        if (key === 'all') {
          filters.clear();
        } else if (filters.has(key)) {
          filters.delete(key);
        } else {
          filters.add(key);
        }
        render();
      });
    });
    body.querySelectorAll('.tws-travel-eta[data-travel-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.travelId;
        if (travelPopId === id) {
          closeTravelPopup();
          return;
        }
        openTravelPopup(id, el);
      });
    });
    body.querySelectorAll('.tws-card-btn').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openStatCard(el.dataset.cardId);
      });
    });
    body.querySelectorAll('.tws-respect[data-resp-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openRespCard(el.dataset.respId);
      });
    });
    body.querySelectorAll('.tws-star').forEach((el) => {
      const id = el.dataset.targetId;
      const toggle = () => {
        if (targetIds.has(id)) targetIds.delete(id);
        else targetIds.add(id);
        saveTargetIds();
        renderKeepScroll(); // stay where you are in the list
      };
      if (el.dataset.hold === '1') {
        // Targets list: hold the star for half a second to remove the target.
        let t = null; let sx = 0; let sy = 0;
        const stop = () => { if (t) { clearTimeout(t); t = null; } el.classList.remove('tws-star-holding'); };
        el.addEventListener('pointerdown', (e) => {
          if (e.button !== undefined && e.button !== 0) return;
          e.stopPropagation();
          sx = e.clientX; sy = e.clientY;
          el.classList.add('tws-star-holding');
          t = setTimeout(() => {
            t = null;
            el.classList.remove('tws-star-holding');
            el.__twsHeld = Date.now();
            try { if (navigator.vibrate) navigator.vibrate(30); } catch (e2) { /* ignore */ }
            toggle();
          }, 500);
        });
        el.addEventListener('pointermove', (e) => { if (t && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) stop(); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, stop));
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (el.__twsHeld && Date.now() - el.__twsHeld < 1500) return; // the hold already removed it
          showToast('Hold \u2605 for half a second to remove this target');
        });
        return;
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });
    });

    // Name/ATK actions: plain taps only now (no gesture detection at all,
    // after long-press proved unreliable on iOS and its touch-action:none
    // was also breaking scroll on the list). Copying is now its own small
    // icon rather than an alternate action on the same tap target.
    const rowMembersById = {};
    sorted.forEach((m) => {
      rowMembersById[m.id] = m;
    });

    // Re-queries the live element by selector at flash-time rather than
    // using a captured reference -- a background poll can rebuild the
    // whole roster (and thus replace this exact DOM node) between the tap
    // and the clipboard promise resolving, which would otherwise make the
    // flash invisible (applied to an already-detached element).
    function flashLive(selector, ok) {
      const liveEl = panel.querySelector(selector);
      if (!liveEl) return;
      liveEl.classList.add(ok ? 'tws-copied-flash' : 'tws-copy-failed-flash');
      setTimeout(() => {
        liveEl.classList.remove('tws-copied-flash', 'tws-copy-failed-flash');
      }, 600);
    }

    function vibrateShort() {
      if (navigator.vibrate) {
        try { navigator.vibrate(30); } catch (e2) { /* ignore */ }
      }
    }

    // Copy icon (⧉) next to the name/stats -- copies name + level + FF
    // estimate + attack link, for pasting into faction chat. Enemy/target
    // side only, same as before.
    body.querySelectorAll('.tws-copy-icon[data-copy-id]').forEach((el) => {
      const id = el.dataset.copyId;
      const m = rowMembersById[id];
      if (!m) return;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const statsPart = (featureOn('ffStats') && m.ff && (m.ff.bs_estimate_human || m.ff.both)) ? ` - Est. stats: ${estText(m.ff)}` : '';
        const hitNow = (featureOn('onlineHitNow') && m.lastActionStatus === 'Online' && m.state === 'Okay') ? 'ONLINE HIT NOW! ' : '';
        const text = `${hitNow}${m.name} (Lvl ${m.level})${statsPart} - ${attackUrl(m.id)}`;
        sendToChatOrClipboard(text).then((ok) => flashLive(`.tws-copy-icon[data-copy-id="${id}"]`, ok));
        vibrateShort();
      });
    });

    // Home tab 💰 icon: opens that faction mate's "place a bounty" page in a
    // pop-out and, with auto-fill on, types the amount for their estimated
    // stats (and the reason) into it (see fillBountyForm). With pop-outs off
    // the link opens normally and the amount is copied to the clipboard
    // instead.
    body.querySelectorAll('.tws-bounty-icon[data-bounty-id]').forEach((el) => {
      const id = el.dataset.bountyId;
      const m = rowMembersById[id];
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const amount = m ? bountyAmountFor(m) : 0;
        const reason = bountyReasonText();
        if (!featureOn('popoutBounty')) {
          if (amount) {
            copyToClipboard(String(amount));
            showToast(`Bounty $${amount.toLocaleString()} copied. Paste it into the amount box.`);
          }
          return; // plain link navigation
        }
        e.preventDefault();
        openPopout(bountyUrl(id), `💰 Bounty: ${m ? m.name : id}`, (amount || reason) ? { fillBounty: { amount, reason } } : null);
      });
    });

    // All tabs: tapping a name opens their profile in the pop-out instead
    // of navigating away from the war page (with that pop-out feature off,
    // the link's normal navigation applies).
    if (featureOn('popoutProfiles')) {
      body.querySelectorAll('.tws-name[data-row-id] .tws-name-link').forEach((link) => {
        link.addEventListener('click', (e) => {
          const id = link.closest('.tws-name').dataset.rowId;
          const m = rowMembersById[id];
          e.preventDefault();
          openPopout(`https://www.torn.com/profiles.php?XID=${id}`, m ? m.name : 'Profile');
        });
      });
    }

    if (showAttack) {
      // ATK button. Attackable ones open the attack page in the pop-out
      // (or, with that pop-out feature off, use their native href/
      // target="_blank" navigation -- no window.open(), which many mobile
      // webviews including PDA's block). Disabled ones send the ETA to chat
      // (or clipboard) on a plain tap instead, since a disabled button had
      // nothing else to do -- unless that feature is switched off.
      body.querySelectorAll('.tws-atk[data-atk-id]').forEach((el) => {
        const id = el.dataset.atkId;
        const m = rowMembersById[id];
        if (!m) return;

        if (m.state === 'Traveling') {
          el.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('This player is travelling so cannot be attacked');
          });
          return;
        }

        if (m.state === 'Okay') {
          if (featureOn('popoutAttacks')) {
            el.addEventListener('click', (e) => {
              e.preventDefault();
              openPopout(attackUrl(id), `⚔ ${m.name}`);
            });
          }
          return;
        }

        el.addEventListener('click', (e) => {
          e.preventDefault();
          if (!featureOn('atkEtaCopy')) return;
          const eta = chunkedAttackEta(m.remaining);
          const text = `${m.name.toUpperCase()} IN ${eta}`;
          sendToChatOrClipboard(text).then((ok) => flashLive(`.tws-atk[data-atk-id="${id}"]`, ok));
          vibrateShort();
        });
      });
    }

  }

  // ---------------------------------------------------------------------
  // SPA WATCHER (Torn's faction/war page doesn't hard-reload on tab switch)
  // ---------------------------------------------------------------------
  // A URL change is the strongest signal, but Torn's war/roster content can
  // also appear or change WITHOUT the URL changing at all (async content
  // load, tab switch within the same view) -- relying on the URL alone
  // meant detection could lag up to a full poll interval (20s normal) behind
  // what's actually on the page, showing stale/empty state in the meantime.
  // On FACTION pages any meaningful DOM change also triggers a re-check,
  // debounced so it doesn't fire on every minor mutation. On every other
  // Torn page this is skipped entirely (those pages change constantly, and
  // the regular API polling is all that's needed there), and refreshes are
  // never closer together than a few seconds, to stay well inside Torn's
  // API rate limit.
  let lastUrl = location.href;
  let mutationDebounceId = null;
  const MIN_REFRESH_GAP_MS = 4000;
  function watchForNavigation() {
    const observer = PerfMO('watchForNavigation observer', (mutations) => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (Date.now() - lastRosterRefreshAt > MIN_REFRESH_GAP_MS) refreshRosters();
        return;
      }
      if (!onFactionPage()) return;
      // Ignore mutations that are just our own UI (the panel re-renders its
      // body every second for the live countdowns; the pop-out, bag
      // confirmation, hidden armoury and toast also add/remove nodes) --
      // without this, that alone would keep resetting the debounce below
      // forever and trigger needless API refreshes.
      const OWN_UI = '#tws-popout, #tws-toast, #tws-bag-confirm, #tws-blood-frame, #tws-travel-pop, #tws-items-frame, #tws-prefs-frame';
      const externalChange = mutations.some((m) => {
        if (panel && panel.contains(m.target)) return false;
        if (m.target && m.target.closest && m.target.closest(OWN_UI)) return false;
        // Our own overlays being added/removed directly under <body>
        const nodes = Array.from(m.addedNodes || []).concat(Array.from(m.removedNodes || []));
        if (nodes.length && nodes.every((n) => n.id && /^tws-/.test(n.id))) return false;
        return true;
      });
      if (!externalChange) return;
      // Debounced re-check for same-URL content changes (e.g. the war
      // roster finishing its async load after navigating within the app).
      if (mutationDebounceId) clearTimeout(mutationDebounceId);
      mutationDebounceId = setTimeout(() => {
        mutationDebounceId = null;
        if (Date.now() - lastRosterRefreshAt > MIN_REFRESH_GAP_MS) refreshRosters();
      }, 1500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------------
  // INIT
  // ---------------------------------------------------------------------
  let rosterIntervalId = null;
  let chainIntervalId = null;
  let chainStaggerTimeoutId = null;

  function applyPollIntervals() {
    if (rosterIntervalId) clearInterval(rosterIntervalId);
    if (chainIntervalId) clearInterval(chainIntervalId);
    if (chainStaggerTimeoutId) clearTimeout(chainStaggerTimeoutId);
    const rosterMs = isTurbo() ? TURBO_HOSPITAL_POLL_MS : PERF_ROSTER_MS[perfMode()];
    const chainMs = isTurbo() ? TURBO_CHAIN_POLL_MS : NORMAL_CHAIN_POLL_MS;
    rosterIntervalId = setInterval(refreshRosters, rosterMs);
    // Staggering the chain timer's start prevents it from periodically
    // landing on the exact same instant as the roster timer (e.g. every
    // 20s in normal mode, since 20 is a multiple of 10) -- when that
    // happens, up to 4 Torn API calls fire in the same instant, which can
    // trip Torn's short-window rate limit even though the averaged
    // per-minute rate is well under any published limit.
    chainStaggerTimeoutId = setTimeout(() => {
      chainIntervalId = setInterval(refreshChain, chainMs);
    }, Math.floor(chainMs / 2));
  }

  // ---------------------------------------------------------------------
  // ACCESS  (© -TheKraken- [3616083] -- all rights reserved)
  // 6-hour free trial, then 1 Xanax sent to -TheKraken- = 7 days (stacks).
  // War credits (after go-live): 1 Xanax = 1 war -- see "War credits" below.
  // The owner and the exempt factions always have free access. The access
  // server decides; this copy asks it on load (answer cached 5 minutes) and
  // re-checks whenever a trial or paid week runs out.
  // ---------------------------------------------------------------------
  const ACCESS_URL = 'https://dashing-fish-54.eu-west-1.convex.site/access';
  // Build fingerprint: identifies an official -TheKraken- build.
  const BUILD_FP = 'kwr-65219bf17e59';
  // What the script manager says is installed (name / namespace / version),
  // so the server can spot copies that were renamed or re-versioned.
  function buildReportQS() {
    try {
      const gi = (typeof GM_info !== 'undefined' && GM_info && GM_info.script) ? GM_info.script : null;
      if (!gi || !gi.namespace) return '';
      return `&bn=${encodeURIComponent(gi.name || '')}&bns=${encodeURIComponent(gi.namespace || '')}&bv=${encodeURIComponent(gi.version || '')}&bf=${encodeURIComponent(BUILD_FP)}`;
    } catch (e) { return ''; }
  }
  const ACCESS_CACHE_KEY = 'tws_access_v1';
  const ACCESS_ID_KEY = 'tws_access_me';
  // Access is re-checked when it's due to run out (and straight away if it
  // has), when your faction meets a protected faction in a war, and once a day.
  const ACCESS_RECHECK_MS = 24 * 3600 * 1000;
  let protWarChecked = '';
  const COPYRIGHT_TEXT = `\u00a9 ${CREDIT_NAME} [${CREDIT_ID}]. All rights\u200c\u200c\u200b\u200c\u200c\u200c\u200b\u200b\u200c\u200b\u200c\u200c\u200b\u200c\u200b\u200c\u200b\u200c\u200b\u200b\u200c\u200c reserved. Do not copy, modify or redistribute without permission.`;
  const SEND_ITEMS_URL = 'https://www.torn.com/item.php';
  let accessState = null;
  let accessWatchId = null;

  function loadAccessCache() {
    try {
      const r = JSON.parse(getCfg(ACCESS_CACHE_KEY, 'null'));
      return r && r.status ? r : null;
    } catch (e) {
      return null;
    }
  }

  // Your own Torn ID (from your API key), remembered per key.
  async function accessMyId() {
    const key = getApiKey();
    if (!key) return '';
    const tag = key.slice(-4);
    try {
      const saved = JSON.parse(getCfg(ACCESS_ID_KEY, 'null'));
      if (saved && saved.k === tag && saved.id) return String(saved.id);
    } catch (e) { /* look it up again */ }
    const d = await apiFetch('user', 'basic');
    const id = d && (d.player_id || d.id);
    if (!id) return '';
    setCfg(ACCESS_ID_KEY, JSON.stringify({ k: tag, id: String(id) }));
    return String(id);
  }

  // Proof of identity for the Kraken server. Your API key is sent ONCE to
  // /auth; the server asks Torn whose key it is, doesn't keep the key, and
  // returns a signed pass (valid 30 days) that every server feature checks.
  const AUTH_URL = 'https://dashing-fish-54.eu-west-1.convex.site/auth';
  const PASS_KEY = 'tws_pass_v1';
  let passInFlight = null;
  async function getPass(force) {
    const key = getApiKey();
    if (!key) return '';
    const tag = key.slice(-4);
    if (!force) {
      try {
        const c = JSON.parse(getCfg(PASS_KEY, 'null'));
        if (c && c.k === tag && c.pass && c.exp - Date.now() > 24 * 3600 * 1000) return c.pass;
      } catch (e) { /* get a new one */ }
    }
    if (passInFlight) return passInFlight;
    passInFlight = (async () => {
      try {
        const d = await httpPostJson(AUTH_URL, { key });
        if (d && d.pass) {
          setCfg(PASS_KEY, JSON.stringify({ k: tag, pass: d.pass, exp: d.exp, id: String(d.tornId) }));
          return d.pass;
        }
      } catch (e) { /* server unreachable */ }
      return '';
    })();
    try { return await passInFlight; } finally { passInFlight = null; }
  }
  // GET to the Kraken server with the pass attached; one retry with a fresh
  // pass if the server says it's missing or expired.
  async function serverGet(url) {
    const withPass = (p) => `${url}${url.includes('?') ? '&' : '?'}wb=1&p=${encodeURIComponent(p || '')}`;
    let d = await httpGetJson(withPass(await getPass(false)));
    if (d && d.needAuth) d = await httpGetJson(withPass(await getPass(true)));
    return d;
  }

  // Once a day: does this player's own key have faction API access? Sent with
  // the access check as yes/no (never the key), so the owner's admin page can
  // show who could power Shared Retal. One tiny API call per day.
  const FAPI_KEY = 'tws_fapi';
  const FAPI_TTL_MS = 24 * 3600 * 1000;
  async function factionApiFlag() {
    const key = getApiKey();
    if (!key) return '';
    const tag = key.slice(-4);
    let c = null;
    try { c = JSON.parse(getCfg(FAPI_KEY, 'null')); } catch (e) { c = null; }
    const cached = (c && c.k === tag) ? c.v : '';
    if (c && c.k === tag && Date.now() - c.at < FAPI_TTL_MS) return cached;
    try {
      const d = await httpGetJson(`https://api.torn.com/v2/faction/attacks?limit=1&key=${encodeURIComponent(key)}&comment=sandboxwar`);
      let v = '';
      if (d && !d.error) v = '1';
      else if (d && d.error && [7, 16].includes(Number(d.error.code))) v = '0'; // no faction access
      if (v) setCfg(FAPI_KEY, JSON.stringify({ k: tag, v, at: Date.now() }));
      return v || cached;
    } catch (e) {
      return cached;
    }
  }

  async function refreshAccess(force) {
    const cached = loadAccessCache();
    let id = '';
    try { id = await accessMyId(); } catch (e) { id = ''; }
    if (!id) return (accessState = cached);
    if (!force && cached && cached.id === id && accessAllowed(cached) && Date.now() - cached.checkedAt < ACCESS_RECHECK_MS &&
        !(cached.until && cached.until <= Date.now())) {
      return (accessState = cached);
    }
    try {
      let fa = '';
      try { fa = await factionApiFlag(); } catch (e) { fa = ''; }
      const ct = (String(id) === String(CREDIT_ID) && getCfg(CT_KEY, false) === true) ? '&ct=1' : '';
      const d = await serverGet(`${ACCESS_URL}?id=${encodeURIComponent(id)}${fa ? `&fa=${fa}` : ''}${ct}${buildReportQS()}`);
      if (d && d.status) {
        const s = {
          id, status: d.status, until: d.until || null, paidBefore: !!d.paidBefore, checkedAt: Date.now(),
          prot: Array.isArray(d.protected) ? d.protected.map(String) : (cached && cached.prot) || [],
          warLock: d.warLock || null,
          via: d.via || '',
          ref: d.ref || null,
          cm: !!d.cm, credits: Number(d.credits) || 0, testCust: !!d.testCust, gift: !!d.gift,
          cmReason: d.reason || '', inWar: !!d.inWar, warCovered: !!d.warCovered, warEnd: Number(d.warEnd) || 0,
          peaceFree: !!d.peaceUntilNextWar,
        };
        if (s.cm && d.charged) setTimeout(() => showToast(`\ud83c\udf9f\ufe0f 1 war credit used \u2013 War Room is covered for this whole war. ${s.credits} credit${s.credits === 1 ? '' : 's'} left.`), 1500);
        setCfg(ACCESS_CACHE_KEY, JSON.stringify(s));
        try { announceReferralReward(s.ref); } catch (e) { /* ignore */ }
        return (accessState = s);
      }
    } catch (e) { /* server unreachable -- keep the last answer */ }
    return (accessState = (cached && cached.id === id) ? cached : null);
  }

  // ---- Referrals ----
  // A new player can say who referred them (their Torn ID) before their first
  // payment; when they first pay, the referrer gets 7 free days (until War
  // Room has 1,000 paying customers). Handled on the Kraken server.
  const REFERRAL_URL = 'https://dashing-fish-54.eu-west-1.convex.site/referral';
  const REF_SEEN_KEY = 'tws_ref_seen';
  function announceReferralReward(ref) {
    if (!ref || !ref.noticeAt || !ref.notice) return;
    const seen = Number(getCfg(REF_SEEN_KEY, 0)) || 0;
    if (ref.noticeAt <= seen) return;
    setCfg(REF_SEEN_KEY, ref.noticeAt);
    if (!seen && Date.now() - ref.noticeAt > 7 * 86400000) return; // old news on a fresh install
    showToast(`\ud83c\udf81 ${ref.notice}`);
  }
  function referralHtml() {
    if (!featureOn('referrals')) return '';
    const s = accessState;
    const r = s && s.ref;
    if (!r) return '';
    const myId = escHtml((s && s.id) || '');
    let top = '';
    if (r.by) {
      top = `<div>Referred by <b>${escHtml(r.byName || 'Player')} [${escHtml(String(r.by))}]</b></div>`;
    } else if (r.canSet) {
      top = `<div style="margin-bottom:4px;">Did someone send you to War Room? Enter their Torn ID (the number in [ ]) before your first payment:</div>
        <div style="display:flex;gap:6px;"><input id="tws-in-ref" type="text" inputmode="numeric" placeholder="Their Torn ID" style="flex:1;min-width:0;"><button id="tws-ref-save" type="button" style="background:#2c2140;color:#fff;border:1px solid #6b3fa0;border-radius:6px;padding:4px 10px;">Save</button></div>`;
    }
    const own = r.open
      ? `<div style="margin-top:6px;">Your referral ID: <b>${myId}</b> <span id="tws-ref-copy" style="cursor:pointer;color:#c9a4ff;">(copy)</span><br><span style="color:#aaa;">When someone you refer makes their first payment, you get <b>${s && s.cm ? '1 free war credit' : '7 free days'}</b>.</span></div>`
      : `<div style="margin-top:6px;color:#aaa;">Referral rewards have ended.</div>`;
    const earned = r.earned ? `<div style="margin-top:4px;color:#7cfc7c;">Earned so far: <b>${r.earned}</b> free week${r.earned === 1 ? '' : 's'}</div>` : '';
    return `<div class="tws-ref-box" style="border:1px solid #4a3a66;background:#1f1830;border-radius:8px;padding:8px 10px;margin:8px 0;font-size:12px;line-height:1.4;">
      <div style="font-weight:bold;margin-bottom:4px;">\ud83c\udf81 Referrals</div>${top}${own}${earned}</div>`;
  }
  function wireReferral(body) {
    const btn = body.querySelector('#tws-ref-save');
    if (btn) btn.addEventListener('click', async () => {
      const inp = body.querySelector('#tws-in-ref');
      const ref = String((inp && inp.value) || '').replace(/[^0-9]/g, '');
      if (!ref) { showToast('Enter the referrer\u2019s Torn ID (numbers only).'); return; }
      const me = (accessState && accessState.id) || await accessMyId().catch(() => '');
      if (!me) { showToast('Add your API key first.'); return; }
      btn.disabled = true;
      try {
        const d = await serverGet(`${REFERRAL_URL}?me=${encodeURIComponent(me)}&ref=${encodeURIComponent(ref)}`);
        if (d && d.ok) {
          showToast(`\ud83c\udf81 Saved \u2013 referred by ${d.refName || `player ${ref}`}. Thanks!`);
          await refreshAccess(true);
          render();
        } else {
          showToast((d && d.error) || 'Couldn\u2019t save that \u2013 try again in a moment.');
          btn.disabled = false;
        }
      } catch (e) {
        showToast('Couldn\u2019t reach the War Room server \u2013 try again in a moment.');
        btn.disabled = false;
      }
    });
    const cp = body.querySelector('#tws-ref-copy');
    if (cp) cp.addEventListener('click', async () => {
      const ok = await copyToClipboard(String((accessState && accessState.id) || ''));
      showToast(ok ? 'Referral ID copied' : 'Couldn\u2019t copy \u2013 it\u2019s your Torn ID');
    });
  }

  // Protected factions (set by the owner): War Room is never used against them.
  function isProtectedFaction(id) {
    if (!id) return false;
    const s = accessState || loadAccessCache();
    return !!(s && Array.isArray(s.prot) && s.prot.includes(String(id)));
  }

  // ---- War credits (1 Xanax = 1 war) ----
  // The server decides; these only describe the answer. The owner can switch
  // on "test as a customer" to see the credit rules before they go live.
  const CT_KEY = 'tws_test_customer';
  const CM_WAR_KEY = 'tws_cm_war';
  const CM_DRAWN_KEY = 'tws_cm_drawn';
  function creditCountText(n) { return `${n} war credit${n === 1 ? '' : 's'}`; }
  function creditStatusText(s) {
    if (!s || !s.cm) return '';
    if (s.status === 'trial') return `Free trial \u2013 you have ${creditCountText(s.credits)}.`;
    if (s.gift) return `Free time from ${CREDIT_NAME} \u2013 you have ${creditCountText(s.credits)}.`;
    if (s.via === 'faction') return `Faction pass \u2013 you have ${creditCountText(s.credits)}.`;
    if (s.cmReason === 'war-covered' || s.cmReason === 'war-charged') return `\u2694\ufe0f Covered for this war. ${creditCountText(s.credits)} left.`;
    if (s.cmReason === 'peace-credit') return `${creditCountText(s.credits)}. Free between wars; 1 is used the first time you open War Room in a ranked war.`;
    if (s.cmReason === 'peace-free') return `0 war credits. Free until your faction\u2019s next ranked war starts.`;
    if (s.cmReason === 'war-no-credit') return 'Out of war credits for this war.';
    return 'Out of war credits.';
  }
  // Once per war: when your faction's ranked war starts, ask the server so the
  // war is covered (1 credit) or locked if you have none.
  function creditWarCheck(war) {
    const s = accessState;
    if (!s || !s.cm || !war || !war.started) return;
    if (['owner', 'faction', 'blocked', 'warlock'].includes(s.status)) return;
    const key = `${war.enemyId}:${war.startTime}`;
    if (getCfg(CM_WAR_KEY, '') === key) return;
    setCfg(CM_WAR_KEY, key);
    refreshAccess(true).then((st) => { renderAccessStrip(); if (st && !accessAllowed(st)) lockNow(); }).catch(() => {});
  }
  // Once per drawn war: a heads-up if you have no credits for it.
  function creditDrawnNotice(war) {
    const s = accessState;
    if (!s || !s.cm || !war || war.started || !featureOn('creditAlerts')) return;
    if (s.status !== 'paid' && s.status !== 'trial' && s.status !== 'expired') return;
    if (s.credits > 0 || s.via === 'faction' || s.gift) return;
    const key = `${war.enemyId}:${war.startTime}`;
    if (getCfg(CM_DRAWN_KEY, '') === key) return;
    setCfg(CM_DRAWN_KEY, key);
    showToast('\ud83c\udf9f\ufe0f Your faction has a ranked war coming up and you have 0 war credits. Send 1 Xanax to -TheKraken- to use War Room during it.');
  }

  // No answer yet (no API key saved, or server never reached) = allowed.
  function accessAllowed(s) {
    if (!s) return true;
    if (s.status === 'owner' || s.status === 'faction') return true;
    if (s.status === 'paid' || s.status === 'trial') return !!s.until && s.until > Date.now();
    return false;
  }

  function fmtAccessLeft(ms) {
    const m = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    const mm = m % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${mm}m`;
    return `${mm}m`;
  }

  function accessProfileLink() {
    return `<a href="https://www.torn.com/profiles.php?XID=${CREDIT_ID}" target="_blank" style="color:#c9a4ff;">${CREDIT_NAME} [${CREDIT_ID}]</a>`;
  }

  // Slim strip under the panel header: only during a trial, or the last
  // 24 hours of paid access.
  function renderAccessStrip__raw() {
    const el = document.getElementById('tws-access');
    if (!el) return;
    const s = accessState;
    let html = '';
    if (s && s.cm) {
      if (s.status === 'trial' && s.until) {
        html = `\u23f3 Free trial: <b>${fmtAccessLeft(s.until - Date.now())}</b> left. 1 Xanax to ${accessProfileLink()} = 1 war credit.`;
        if (featureOn('referrals') && s.ref && s.ref.canSet) html += ' <span style="color:#aaa;">\ud83c\udf81 Referred by someone? Add their ID in \u2699 Settings.</span>';
      } else if (s.status === 'paid' && !s.gift && s.via !== 'faction' && s.credits === 0 && s.cmReason === 'peace-free' && featureOn('creditAlerts')) {
        html = `\ud83c\udf9f\ufe0f <b>Out of war credits.</b> Free until your faction\u2019s next ranked war. 1 Xanax to ${accessProfileLink()} = 1 war.`;
      }
      if (s.testCust) html = `<span style="color:#ffcc66;">\ud83e\uddea Testing as a customer</span> \u00b7 ${creditStatusText(s)}${html ? '<br>' + html : ''}`;
    } else if (s && s.status === 'trial' && s.until) {
      html = `\u23f3 Free trial: <b>${fmtAccessLeft(s.until - Date.now())}</b> left. 1 Xanax to ${accessProfileLink()} = 7 days.`;
      if (featureOn('referrals') && s.ref && s.ref.canSet) html += ' <span style="color:#aaa;">\ud83c\udf81 Referred by someone? Add their ID in \u2699 Settings.</span>';
    } else if (s && s.status === 'paid' && s.until && s.until - Date.now() < 24 * 3600 * 1000) {
      html = `\u23f3 Access ends in <b>${fmtAccessLeft(s.until - Date.now())}</b>. Send Xanax to ${accessProfileLink()} to extend.`;
    }
    el.innerHTML = html;
    el.style.display = html ? 'block' : 'none';
  }

  // Access status + copyright line shown under the Settings tabs.
  function accessSettingsHtml() {
    const s = accessState;
    let line;
    if (!s) line = 'Access: not checked yet';
    else if (s.status === 'owner') line = 'Access: owner';
    else if (s.status === 'faction') line = 'Access: free (faction)';
    else if (s.status === 'paid') line = `Access: ${s.via === 'faction' ? 'faction pass' : 'paid'} until ${new Date(s.until).toLocaleString()}`;
    else if (s.status === 'trial') line = `Access: free trial, ${fmtAccessLeft(s.until - Date.now())} left`;
    else if (s.status === 'blocked') line = 'Access: removed by the owner';
    else if (s.status === 'warlock') line = 'Access: paused during your war with a protected faction';
    else line = 'Access: expired';
    let extra = (s && (s.status === 'paid' || s.status === 'trial'))
      ? `<br>1 Xanax to ${accessProfileLink()} = 7 more days` : '';
    if (s && s.cm) {
      if (s.status === 'paid') line = 'Access: active';
      else if (s.status === 'expired') line = 'Access: locked';
      extra = `<div style="margin:6px auto 2px;max-width:300px;border:1px solid #4a3a66;background:#1f1830;border-radius:8px;padding:6px 8px;font-size:12px;color:#ddd;line-height:1.4;">
        \ud83c\udf9f\ufe0f War credits: <b style="color:#fff;font-size:14px;">${s.credits}</b><br><span style="color:#bbb;">${creditStatusText(s)}</span><br>
        <span style="color:#999;font-size:11px;">1 Xanax to ${accessProfileLink()} = 1 war. A credit is only used if you open War Room during a ranked war, and covers that whole war.</span></div>`;
    }
    const ownerNow = !!(s && String(s.id) === String(CREDIT_ID));
    const ctBtn = ownerNow
      ? `<br><span id="tws-ct-toggle" style="cursor:pointer;color:#c9a4ff;">${getCfg(CT_KEY, false) === true ? '\ud83e\uddea Testing as a customer \u2013 tap to stop' : '\ud83e\uddea Test war credits as a customer'}</span>`
      : '';
    return `<div style="color:#888;font-size:10px;margin:-4px 0 8px;text-align:center;">${line}${extra}${ctBtn}<br><span style="color:#666;">${COPYRIGHT_TEXT}</span></div>`;
  }

  function showLockScreen() {
    if (document.getElementById('tws-lock') || !document.body) return;
    const s = accessState;
    const blocked = !!(s && s.status === 'blocked');
    const warLock = !!(s && s.status === 'warlock');
    const vsName = escHtml((s && s.warLock && s.warLock.vs) || 'a protected faction');
    const heading = warLock
      ? `\u2694\ufe0f Your faction is at war with <b>${vsName}</b>. Sandbox War Room cannot be used against its creator\u2019s faction, so it\u2019s paused until this war ends. You will not be charged a credit for this.`
      : blocked
      ? 'Your access to Sandbox War Room has been removed by the owner.'
      : (s && s.cm && s.cmReason === 'war-no-credit')
        ? '\u2694\ufe0f Your faction is in a ranked war and you have <b>0 war credits</b>. Send 1 Xanax to use Sandbox War Room for the whole war.'
      : (s && s.cm && s.paidBefore)
        ? 'You\u2019re out of war credits. Your faction has had a ranked war since your last one, so a credit is needed.'
      : s && s.paidBefore
        ? 'Your Sandbox War Room access has run out.'
        : 'Your 6-hour free trial of Sandbox War Room has ended.';
    const cmLock = !!(s && s.cm);
    const el = document.createElement('div');
    el.id = 'tws-lock';
    el.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:999999;width:min(340px,calc(100vw - 24px));box-sizing:border-box;background:#1b1426;color:#ddd;border:1px solid #6b3fa0;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.6);font:13px/1.45 Arial,sans-serif;padding:10px 12px;';
    el.innerHTML = `
      <div id="tws-lock-head" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <img src="${LOGO_DATA_URI}" alt="" style="width:26px;height:26px;border-radius:6px;">
        <b style="flex:1;color:#fff;">\ud83d\udd12 Sandbox War Room</b>
        <span id="tws-lock-min" style="padding:0 4px;color:#aaa;">\u25be</span>
      </div>
      <div id="tws-lock-body" style="margin-top:6px;">
        <div style="margin-bottom:6px;">${heading}</div>
        ${warLock ? `
        <div style="display:flex;gap:6px;">
          <button id="tws-lock-check" type="button" style="flex:1;background:#2c2140;color:#fff;border:1px solid #6b3fa0;border-radius:6px;padding:7px 0;font-size:13px;">Check again</button>
        </div>` : ''}
        ${(blocked || warLock) ? '' : `
        ${cmLock
          ? `<div style="margin-bottom:6px;">Send <b>1 Xanax</b> to ${accessProfileLink()} for <b>1 war credit</b>. A credit covers a whole ranked war, and you only use one if you open War Room during the war. Between wars it\u2019s free. Send more to stock up.</div>`
          : `<div style="margin-bottom:6px;">Send <b>1 Xanax</b> to ${accessProfileLink()} for <b>7 days</b> of access. Send more to stack weeks (2 = 14 days, and so on).</div>`}
        <div style="color:#aaa;font-size:11px;margin-bottom:8px;">Items \u2192 Drugs \u2192 Xanax \u2192 Send, to player ID <b>${CREDIT_ID}</b>. Access unlocks automatically within a couple of minutes.</div>
        <div style="margin-bottom:8px;font-size:12px;">\ud83d\udc65 <b>Whole faction:</b> one player sends <b>$500,000 per faction member</b> to ${accessProfileLink()} with <b>FACTIONPAY</b> in the message. Everyone in the faction gets ${cmLock ? '1 war credit' : '7 days'}. Part-payments are held until topped up.</div>
        <div style="display:flex;gap:6px;">
          <a href="${SEND_ITEMS_URL}" style="flex:1;text-align:center;background:#6b3fa0;color:#fff;border-radius:6px;padding:7px 0;text-decoration:none;">Open Items</a>
          <button id="tws-lock-check" type="button" style="flex:1;background:#2c2140;color:#fff;border:1px solid #6b3fa0;border-radius:6px;padding:7px 0;font-size:13px;">Check again</button>
        </div>
        `}
        <div id="tws-lock-msg" style="color:#c9a4ff;font-size:11px;margin-top:6px;min-height:1em;"></div>
        ${(s && s.testCust) ? '<div id="tws-ct-toggle" style="cursor:pointer;color:#ffcc66;font-size:12px;margin-top:4px;">\ud83e\uddea Testing as a customer \u2013 tap to stop</div>' : ''}
        <div style="color:#666;font-size:10px;margin-top:4px;">${COPYRIGHT_TEXT}</div>
      </div>`;
    document.body.appendChild(el);
    const body = el.querySelector('#tws-lock-body');
    const minBtn = el.querySelector('#tws-lock-min');
    const setMin = (m) => {
      body.style.display = m ? 'none' : 'block';
      minBtn.textContent = m ? '\u25b4' : '\u25be';
      setCfg('tws_lock_min', !!m);
    };
    setMin(getCfg('tws_lock_min', false) === true);
    el.querySelector('#tws-lock-head').addEventListener('click', () => setMin(body.style.display !== 'none'));
    const lockCheck = el.querySelector('#tws-lock-check');
    if (lockCheck) lockCheck.addEventListener('click', async () => {
      const msg = el.querySelector('#tws-lock-msg');
      msg.textContent = 'Checking\u2026';
      const st = await refreshAccess(true);
      if (st && accessAllowed(st)) {
        msg.textContent = 'Unlocked! Loading\u2026';
        setTimeout(() => location.reload(), 600);
      } else {
        msg.textContent = (st && st.status === 'warlock')
          ? 'Still paused \u2014 the war hasn\u2019t ended yet.'
          : 'No Xanax received yet. It can take a minute or two after sending.';
      }
    });
  }

  document.addEventListener('click', async (e) => {
    const t = e.target && e.target.closest ? e.target.closest('#tws-ct-toggle') : null;
    if (!t) return;
    const on = getCfg(CT_KEY, false) !== true;
    setCfg(CT_KEY, on);
    setCfg(CM_WAR_KEY, '');
    t.textContent = 'Checking\u2026';
    const st = await refreshAccess(true);
    showToast(on ? '\ud83e\uddea Testing as a customer: war credit rules apply to you now.' : 'Back to owner access.');
    renderAccessStrip();
    try { render(); } catch (err) { /* panel not open */ }
    if (st && !accessAllowed(st)) lockNow();
    else if (st && accessAllowed(st) && document.getElementById('tws-lock')) location.reload();
  });

  function lockNow() {
    const p = document.getElementById('tws-panel');
    if (p) p.style.display = 'none';
    if (featureOn('everyPage') || onFactionPage()) showLockScreen();
  }

  // Keeps the trial countdown ticking and locks the moment access runs out.
  function watchAccess() {
    if (accessWatchId) return;
    accessWatchId = setInterval(async () => {
      renderAccessStrip();
      const s = accessState;
      if (s && s.until && s.until <= Date.now()) {
        const st = await refreshAccess(true);
        renderAccessStrip();
        if (!accessAllowed(st)) lockNow();
      }
    }, 60 * 1000);
  }

  async function init() {
    accessState = loadAccessCache();
    if (accessState && accessAllowed(accessState)) {
      // Known-good answer: start straight away, re-check in the background.
      startScript();
      renderAccessStrip();
      watchAccess();
      const s = await refreshAccess(false);
      renderAccessStrip();
      if (!accessAllowed(s)) lockNow();
      return;
    }
    const s = await refreshAccess(false);
    if (!accessAllowed(s)) {
      lockNow();
      return;
    }
    startScript();
    renderAccessStrip();
    watchAccess();
  }

  function startScript() {
    try {
      startScriptInner();
    } catch (e) {
      reportCrash('start-up', e);
    }
  }

  // ---- Update notices ----
  // Release notes come from the Kraken server (same host the script already
  // talks to, so no extra permission). Before updating: an "Update available"
  // banner in the panel with the changes. After updating: a one-time
  // "What's new" card (covers silent background updates too).
  const CHANGELOG_URL = 'https://dashing-fish-54.eu-west-1.convex.site/changelog?track=sandbox';
  const CL_CACHE = 'tws_cl_cache';
  const CL_SEEN = 'tws_cl_seen';
  const CL_LATER = 'tws_cl_later';
  const CL_CHECK_MS = 3 * 3600 * 1000;
  let clData = null;
  let clOpen = false;

  function cmpVer(a, b) {
    const x = String(a || '0').split('.').map(Number);
    const y = String(b || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }
  function loadClCache() {
    try {
      const c = JSON.parse(getCfg(CL_CACHE, 'null'));
      return c && c.data ? c : null;
    } catch (e) { return null; }
  }
  async function fetchChangelog(force) {
    const c = loadClCache();
    if (!force && c && Date.now() - c.at < CL_CHECK_MS) { clData = c.data; return clData; }
    try {
      const d = await httpGetJson(CHANGELOG_URL);
      if (d && Array.isArray(d.entries)) {
        clData = d;
        setCfg(CL_CACHE, JSON.stringify({ at: Date.now(), data: d }));
      } else if (c) clData = c.data;
    } catch (e) {
      if (c) clData = c.data;
    }
    return clData;
  }
  // Entries newer than `after` (exclusive) up to `upTo` (inclusive).
  function clEntries(after, upTo) {
    return ((clData && clData.entries) || []).filter((e) =>
      cmpVer(e.version, after) > 0 && (!upTo || cmpVer(e.version, upTo) <= 0));
  }
  function clBulletsHtml(items) {
    return items.map((e) => `
      <div class="tws-cl-ver">v${escHtml(e.version)} <span>${escHtml(e.date || '')}</span></div>
      <ul>${(e.changes || []).map((c) => `<li>${escHtml(c)}</li>`).join('')}</ul>`).join('');
  }
  function updateAvailable() {
    return !!(clData && clData.latest && cmpVer(clData.latest, SCRIPT_VERSION) > 0);
  }
  function updateBannerHtml() {
    if (!updateAvailable()) return '';
    try {
      const l = JSON.parse(getCfg(CL_LATER, 'null'));
      if (l && l.v === clData.latest && Date.now() < l.until) return '';
    } catch (e) { /* show it */ }
    const items = clEntries(SCRIPT_VERSION, clData.latest);
    return `
      <div class="tws-cl-banner">
        <div class="tws-cl-head" data-cl="toggle">
          <b>\u2b06 Update available: v${escHtml(clData.latest)}</b>
          <span>${clOpen ? '\u25b4 hide' : '\u25be what\u2019s new'}</span>
        </div>
        ${clOpen ? `<div class="tws-cl-list">${clBulletsHtml(items)}</div>` : ''}
        <div class="tws-cl-btns">
          <a class="tws-cl-btn tws-cl-go" href="${escHtml(clData.installUrl || '')}" target="_blank" data-cl="update">Update</a>
          <span class="tws-cl-btn" data-cl="copy">Copy link</span>
          <span class="tws-cl-btn" data-cl="later">Later</span>
        </div>
        ${IS_PDA ? '<div class="tws-cl-note">Torn PDA: copy the link, then update the script in PDA\u2019s userscripts with the new version.</div>' : ''}
      </div>`;
  }
  function wireUpdateBanner(body) {
    body.querySelectorAll('.tws-cl-banner [data-cl]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = el.dataset.cl;
        if (act === 'toggle') {
          clOpen = !clOpen;
          render();
        } else if (act === 'copy') {
          copyToClipboard(clData.installUrl).then((ok) => showToast(ok ? 'Install link copied.' : 'Could not copy the link.'));
        } else if (act === 'later') {
          setCfg(CL_LATER, JSON.stringify({ v: clData.latest, until: Date.now() + 24 * 3600 * 1000 }));
          render();
        }
        // 'update' simply follows its link (opens the install page)
      });
    });
  }
  function showWhatsNew(items) {
    if (!items.length || document.getElementById('tws-whatsnew')) return;
    const el = document.createElement('div');
    el.id = 'tws-whatsnew';
    el.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:999999;width:min(340px,calc(100vw - 24px));box-sizing:border-box;background:#12232d;color:#ddd;border:1px solid #4fb3d9;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.6);font:13px/1.45 Arial,sans-serif;padding:10px 12px;';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="${LOGO_DATA_URI}" alt="" style="width:26px;height:26px;border-radius:6px;">
        <b style="flex:1;color:#fff;">What\u2019s new in ${escHtml((clData && clData.name) || 'War Room')} v${escHtml(SCRIPT_VERSION)}</b>
      </div>
      <div class="tws-cl-list" style="max-height:45vh;overflow-y:auto;margin-top:6px;">${clBulletsHtml(items)}</div>
      <button id="tws-whatsnew-ok" type="button" style="width:100%;margin-top:8px;background:#375a8c;color:#fff;border:0;border-radius:6px;padding:7px 0;font-size:13px;font-weight:bold;">Got it</button>`;
    document.body.appendChild(el);
    el.querySelector('#tws-whatsnew-ok').addEventListener('click', () => {
      setCfg(CL_SEEN, SCRIPT_VERSION);
      el.remove();
    });
  }
  async function initUpdateNotices() {
    try {
      const seen = getCfg(CL_SEEN, '');
      const justUpdated = !seen || cmpVer(SCRIPT_VERSION, seen) > 0;
      await fetchChangelog(justUpdated);
      if (justUpdated) {
        // First time on a version with notices: just this version's notes.
        // No record yet = coming from 1.86.4 or older (before notices existed).
        const items = clEntries(seen || '1.86.4', SCRIPT_VERSION);
        if (items.length) showWhatsNew(items);
        else setCfg(CL_SEEN, SCRIPT_VERSION);
      } else if (cmpVer(seen, SCRIPT_VERSION) > 0) {
        setCfg(CL_SEEN, SCRIPT_VERSION); // went back to an older version
      }
      if (updateAvailable()) safeRender();
      setInterval(async () => {
        const had = updateAvailable();
        await fetchChangelog(false);
        if (updateAvailable() !== had) safeRender();
      }, 30 * 60 * 1000);
    } catch (e) { /* notices are optional */ }
  }

  // ---------------------------------------------------------------------
  // PROFILE PAGES: Attack button always works
  // Torn greys out (and blocks) its Attack button while the player is in
  // hospital. Un-block it and send it to the attack page; if Torn's own
  // button can't be found, add a small ⚔ Attack button instead.
  // ---------------------------------------------------------------------
  const PROFILE_ATK_SEL = '[class*="profile-button-attack"], a[href*="sid=attack"], [aria-label*="ttack"], [title*="ttack"]';
  function profileTargetIdIn(win) {
    try {
      if (!/\/profiles\.php/i.test(win.location.pathname)) return null;
      const m = String(win.location.href).match(/XID=(\d+)/i);
      if (!m) return null;
      // Your own profile: you can't attack yourself, so no Attack button.
      const me = myIdCached();
      if (me && String(me) === m[1]) return null;
      return m[1];
    } catch (e) { return null; }
  }
  function profileTargetId() { return profileTargetIdIn(window); }
  function profileAttackButtons(doc) {
    doc = doc || document;
    const out = new Set();
    doc.querySelectorAll('.profile-buttons, [class*="profile-buttons"], [class*="buttons-list"], .profile-wrapper, #profileroot').forEach((root) => {
      root.querySelectorAll(PROFILE_ATK_SEL).forEach((el) => {
        if (el.closest('#tws-panel, #tws-popout, #tws-ki-panel, #tws-profile-atk')) return;
        if (!/attack/i.test(`${el.className || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('href') || ''}`)) return;
        out.add(el.closest('a, button, [role="button"]') || el);
      });
    });
    return [...out];
  }
  // Every profile page War Room can reach: this page, and a profile open
  // in the pop-out (unless the pop-out is running its own copy of War Room).
  function profileAtkTargets() {
    const out = [];
    if (profileTargetId()) out.push(window);
    if (!IN_POPOUT_FRAME && typeof popout !== 'undefined' && popout && popout.root.style.display === 'flex') {
      [popout.frame].concat(Object.values(popout.preFrames || {})).forEach((fr) => {
        try {
          const w2 = fr && fr.style.display !== 'none' && fr.contentWindow;
          if (w2 && !w2.__twsFrameKI && profileTargetIdIn(w2) && w2.document && w2.document.body) out.push(w2);
        } catch (e) { /* not readable */ }
      });
    }
    return out;
  }
  const PROFILE_ATK_CSS = 'html.tws-profile-atk-on .tws-atk-unlocked, html.tws-profile-atk-on .tws-atk-unlocked * { pointer-events: auto !important; cursor: pointer !important; opacity: 1 !important; filter: none !important; }'
    + ' #tws-profile-atk { position: fixed; right: 10px; bottom: 90px; z-index: 2147483000; background: #b3261e; color: #fff; font: bold 14px Arial, sans-serif; padding: 10px 14px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,.5); }';
  function profileAtkTick(win) {
    const doc = win.document;
    const id = profileTargetIdIn(win);
    if (!id) return;
    const go = (e) => {
      if (!featureOn('profileAttack')) return;
      if (e) { e.preventDefault(); e.stopImmediatePropagation(); }
      // In the pop-out: get the enemy loadout ready for the fight first.
      try { if (win !== window && win.frameElement) kiArmPopoutFrame(win.frameElement, attackUrl(id)); } catch (e2) { /* ignore */ }
      // A pop-out's own copy: ask the main page to get the loadout ready.
      try {
        if (win === window && IN_POPOUT_FRAME && window.frameElement) {
          const tw = KI_W.top;
          if (tw && typeof tw.__twsArmPopout === 'function') tw.__twsArmPopout(window.frameElement, attackUrl(id));
        }
      } catch (e2) { /* ignore */ }
      win.location.href = attackUrl(id); // same window: the pop-out stays the pop-out
    };
    if (!doc.getElementById('tws-profile-atk-css')) {
      const st = doc.createElement('style');
      st.id = 'tws-profile-atk-css';
      st.textContent = PROFILE_ATK_CSS;
      (doc.head || doc.documentElement).appendChild(st);
    }
    const on = featureOn('profileAttack');
    doc.documentElement.classList.toggle('tws-profile-atk-on', on);
    const btns = on ? profileAttackButtons(doc) : [];
    btns.forEach((b) => {
      b.classList.add('tws-atk-unlocked');
      if (b.hasAttribute('disabled')) b.removeAttribute('disabled');
      if (b.getAttribute('aria-disabled') === 'true') b.setAttribute('aria-disabled', 'false');
      b.classList.remove('disabled');
      if (b.__twsAtkId !== id) {
        if (b.__twsAtkGo) b.removeEventListener('click', b.__twsAtkGo, true);
        b.__twsAtkId = id;
        b.__twsAtkGo = go;
        b.addEventListener('click', go, true);
      }
    });
    // Fallback button when Torn's own can't be found (after a moment).
    if (!win.__twsAtkSeen || win.__twsAtkSeenId !== id) { win.__twsAtkSeen = Date.now(); win.__twsAtkSeenId = id; }
    let fb = doc.getElementById('tws-profile-atk');
    const wantFb = on && !btns.length && Date.now() - win.__twsAtkSeen > 3000;
    if (wantFb && !fb) {
      fb = doc.createElement('a');
      fb.id = 'tws-profile-atk';
      fb.href = attackUrl(id);
      fb.textContent = '\u2694 Attack';
      fb.addEventListener('click', go);
      doc.body.appendChild(fb);
    } else if (!wantFb && fb) {
      fb.remove();
    }
  }
  function installProfileAttack() {
    if (IN_POPOUT_FRAME && !profileTargetId()) return;
    setInterval(() => {
      if (!pageFocused()) return;
      profileAtkTargets().forEach((w2) => { try { profileAtkTick(w2); } catch (e) { /* ignore */ } });
    }, 700);
  }

  // ---- Header fit ----
  const hdrFit = { sig: '' };
  function fitHeader(force) {
    if (!panel) return;
    const h = panel.querySelector('#tws-header');
    if (!h) return;
    const on = featureOn('fitHeader');
    h.classList.toggle('tws-hfit', on);
    if (!on) { h.classList.remove('tws-h-short', 'tws-h-noenemy', 'tws-h-noclock'); hdrFit.sig = ''; return; }
    if (panel.classList.contains('tws-mini') || !h.clientWidth) return;
    const en = h.querySelector('#tws-enemy-name');
    const pill = h.querySelector('#tws-hflash');
    const sig = [h.clientWidth, en ? en.textContent : '', pill ? `${pill.style.display}|${pill.textContent.length}` : '', panel.className].join('~');
    if (!force && sig === hdrFit.sig) return;
    hdrFit.sig = sig;
    h.classList.remove('tws-h-short', 'tws-h-noenemy', 'tws-h-noclock');
    const over = () => h.scrollWidth > h.clientWidth + 1;
    if (!over()) return;
    h.classList.add('tws-h-short');
    if (!over()) return;
    h.classList.add('tws-h-noenemy');
    if (!over()) return;
    h.classList.add('tws-h-noclock');
  }
  function watchHeaderFit() {
    if (IN_POPOUT_FRAME || window.top !== window.self) return;
    try {
      const RO = window.ResizeObserver;
      const h = panel && panel.querySelector('#tws-header');
      if (RO && h) new RO(() => { try { fitHeader(); } catch (e) { /* ignore */ } }).observe(h);
    } catch (e) { /* ignore */ }
    __nativeSetInterval(() => { try { fitHeader(); } catch (e) { /* ignore */ } }, 1000);
  }

  // ---- Pop-out fit to screen ----
  // Keeps the pop-out inside the screen, and when the page inside is wider
  // than the pop-out (Torn's attack page on narrow phones) lays it out at the
  // width it needs and scales it down to fit, so nothing is cut off.
  function clearFrameFit(f) {
    if (!f || !f.__fitS) return;
    f.__fitS = 0;
    ['flex', 'width', 'height', 'transform', 'transformOrigin', 'maxWidth'].forEach((k) => { f.style[k] = ''; });
  }
  function fitPopoutToScreen() {
    if (!popout || popout.root.style.display !== 'flex') return;
    const root = popout.root;
    const frames = [popout.mainFrame].concat(Object.values(popout.preFrames || {}));
    if (!featureOn('popoutFit')) { frames.forEach(clearFrameFit); return; }
    // 1) the window itself stays on screen
    const vv = window.visualViewport;
    const vw = Math.floor(vv ? vv.width : window.innerWidth);
    const r = root.getBoundingClientRect();
    if (vw > 0 && (r.left < 0 || r.right > vw + 1)) {
      const left = Math.max(0, Math.min(r.left, vw - 120));
      root.style.left = `${Math.round(left)}px`;
      root.style.width = `${Math.max(120, Math.floor(vw - left - 2))}px`;
    }
    frames.forEach((f) => { if (f && f !== popout.frame) clearFrameFit(f); });
    const f = popout.frame;
    if (!f || root.classList.contains('tws-po-min') || f.style.display === 'none') return;
    if (!pageFocused()) return;
    let d;
    try { d = f.contentDocument; } catch (e) { return; }
    if (!d || !d.documentElement || !d.body) return;
    if (f.__fitDoc !== d) { f.__fitDoc = d; f.__fitNeed = 0; clearFrameFit(f); return; }
    // 2) the page inside fits the pop-out's width
    const W = root.clientWidth;
    if (W < 100) return;
    let other = 0;
    Array.from(root.children).forEach((c) => {
      if (c.tagName === 'IFRAME' || c.classList.contains('tws-po-rs')) return;
      other += c.offsetHeight || 0;
    });
    const H = Math.max(100, root.clientHeight - other);
    const V = f.__fitS ? (parseFloat(f.style.width) || W) : W;
    const M = Math.max(d.documentElement.scrollWidth || 0, d.body.scrollWidth || 0);
    if (M > V + 2) f.__fitNeed = Math.max(f.__fitNeed || 0, Math.min(M, Math.round(W / 0.55)));
    const need = Math.max(W, f.__fitNeed || 0);
    const sc = W / need;
    if (sc > 0.995) { clearFrameFit(f); return; }
    const key = `${need}x${Math.round(H / sc)}`;
    if (f.__fitS && f.__fitKey === key) return;
    f.__fitS = sc;
    f.__fitKey = key;
    Object.assign(f.style, { flex: 'none', maxWidth: 'none', width: `${need}px`, height: `${Math.round(H / sc)}px`, transform: `scale(${sc.toFixed(4)})`, transformOrigin: '0 0' });
  }
  function watchPopoutFit() {
    if (IN_POPOUT_FRAME || window.top !== window.self) return;
    __nativeSetInterval(() => { try { fitPopoutToScreen(); } catch (e) { /* ignore */ } }, 400);
  }

  // ---- Kraken Intel inside pop-out pages ----
  // Tampermonkey runs its own copy in the pop-out page. Torn PDA doesn't run
  // scripts in frames, so War Room starts the copy from here: the same code,
  // pointed at the pop-out's page, stopping when that page goes away.
  function bootPopoutIntel() {
    if (IN_POPOUT_FRAME || window.top !== window.self) return;
    try { KI_W.__twsArmPopout = (frame, url) => { try { kiArmPopoutFrame(frame, url); } catch (e) { /* ignore */ } }; } catch (e) { /* ignore */ }
    __nativeSetInterval(() => {
      if (!popout || popout.root.style.display !== 'flex') return;
      if (!featureOn('popoutIntel')) return;
      popout.root.querySelectorAll('iframe').forEach((f) => {
        let w; let d; let href = '';
        try { w = f.contentWindow; d = f.contentDocument; href = String(w.location.href); } catch (e) { return; }
        if (!w || !d || f.__twsBootDoc === d) return;
        if (!/^https:\/\/www\.torn\.com\//.test(href)) return;
        if (d.readyState === 'loading') return;
        if (!/[?&]sid=attack\b/i.test(href) && !/\/profiles\.php/i.test(href)) { f.__twsBootDoc = d; return; }
        if (w.__twsFrameKI) { f.__twsBootDoc = d; return; }
        if (!IS_PDA) {
          // Give Tampermonkey's own copy a moment first.
          if (f.__twsWaitDoc !== d) { f.__twsWaitDoc = d; f.__twsWaitAt = Date.now(); return; }
          if (d.readyState !== 'complete' || Date.now() - f.__twsWaitAt < 1500) return;
        }
        f.__twsBootDoc = d;
        try { __twsMain({ win: w, doc: d, frame: f }); } catch (e) { console.warn('[War Room] pop-out Intel failed', e); }
      });
    }, 120);
  }

  // ---- Estimated stats in the pop-out bar ----
  function popoutTargetId() {
    try {
      const href = String(popout.frame.contentWindow.location.href);
      let m = href.match(/[?&]sid=attack\b.*?[?&]user2ID=(\d+)/i) || href.match(/sid=attack.*user2ID=(\d+)/i);
      if (m) return Number(m[1]);
      m = /\/profiles\.php/i.test(href) && href.match(/[?&]XID=(\d+)/i);
      if (m) return Number(m[1]);
    } catch (e) { /* not readable */ }
    return 0;
  }
  const poStats = { id: 0, html: '', busy: false, at: 0 };
  function poStatsHtml(ffE, bspE, bspWhy, spy) {
    const parts = [];
    const useSpy = spy && tsFresh(spy);
    const ff = fairFightOf(useSpy ? { spy, ffFallback: ffE && ffE.fair_fight } : (ffE || bspE));
    if (typeof ff === 'number' && isFinite(ff)) {
      const c = ffColour(ff);
      parts.push(`<b style="${c ? `color:${c};` : ''}">FF ${ff.toFixed(2)}</b>`);
    }
    if (spy) parts.push(`<span title="${kiEsc(tsSplitText(spy))}">\ud83d\udd75 Spy <b>${fmtBsHuman(spy.total)}</b> (${tsAgeText(spy)})</span>`);
    if (ffE && ffE.bs_estimate_human) parts.push(`FFScouter <b>${kiEsc(ffE.bs_estimate_human)}</b>`);
    if (bspE && bspE.bs_estimate_human) parts.push(`BSP <b>${kiEsc(bspE.bs_estimate_human)}</b>${bspE.source === 'bsp-spy' ? ' (spy)' : ''}`);
    else if (bspWhy) parts.push(`<span class="tws-po-bspwhy" title="${kiEsc(bspWhy)}">BSP: ${kiEsc(bspWhy)}</span>`);
    return parts.length ? `📊 ${parts.join(' · ')}` : '';
  }
  function updatePopoutStats() {
    if (!popout) return;
    const el = popout.root.querySelector('#tws-po-stats');
    if (!el) return;
    const on = featureOn('popoutStats') && featureOn('ffStats') && popout.root.style.display === 'flex';
    const id = on ? popoutTargetId() : 0;
    if (!id) { el.style.display = 'none'; poStats.id = 0; return; }
    if (id !== poStats.id) { poStats.id = id; poStats.html = ''; poStats.at = 0; el.innerHTML = '📊 Estimating…'; }
    el.style.display = 'block';
    if (poStats.busy || (poStats.at && Date.now() - poStats.at < 60000)) return;
    poStats.busy = true;
    poStats.at = Date.now();
    Promise.all([fetchFFScouterStats([id]).catch(() => ({ map: {} })), fetchBspStats([id]).catch(() => ({ map: {} })), tsOn() ? tsLoadUser(id).catch(() => null) : Promise.resolve(null)])
      .then(([ffR, bspR, spy]) => {
        if (poStats.id !== id) return;
        // Say why BSP is missing (this browser has no BSP key / BSP had no
        // prediction / an error), rather than leaving it out silently.
        let bspWhy = '';
        if (!bspR.map[id]) {
          if (!bspKey()) bspWhy = 'no key on this browser \u2013 add it in \u2699 Settings';
          else if (bspR.error) bspWhy = String(bspR.error).slice(0, 80);
          else bspWhy = 'no prediction for this player';
        }
        poStats.html = poStatsHtml(ffR.map[id], bspR.map[id], bspWhy, spy || tsSpyFor(id));
        el.innerHTML = poStats.html || '📊 No estimate for this player (add an FFScouter or BSP key in Settings).';
      })
      .finally(() => { poStats.busy = false; });
  }
  function watchPopoutStats() {
    if (IN_POPOUT_FRAME || window.top !== window.self) return;
    __nativeSetInterval(() => { try { updatePopoutStats(); } catch (e) { /* ignore */ } }, 700);
  }

  function startScriptInner() {
    seedKrakenIntelConsent();
    initKrakenIntel(); // independent of the main panel's page gating below
    kiWatchPopoutFights(); // PC Mode: fights opened in a War Room pop-out, from any page
    installProfileAttack(); // profile Attack button always works (page + pop-out)
    bootPopoutIntel(); // Intel inside pop-out pages (Torn PDA: scripts don't run there)
    watchPopoutFit(); // pop-outs fit the screen width
    watchPopoutStats(); // FFScouter / BSP estimate in the pop-out bar

    // "Run on every Torn page" off -> behave as before: only on faction pages.
    if (!featureOn('everyPage') && !onFactionPage()) return;

    buildPanelSkeleton();
    watchHeaderFit();

    if (!getApiKey()) {
      showSettings = true;
    }

    render();
    refreshRosters();
    refreshChain();
    watchForNavigation();
    initUpdateNotices();
    // Re-check which faction you're in (picks up a faction change), without
    // holding anything up: the cached ID is used meanwhile.
    if (getApiKey()) detectOwnFaction();

    let wideResizeT = null;
    window.addEventListener('resize', () => {
      clearTimeout(wideResizeT);
      wideResizeT = setTimeout(() => { if (wideActive() !== wideWasOn) render(); else applyWideLayout(); }, 250);
    });
    applyPollIntervals();
    setInterval(() => {
      try {
        tickCountdowns();
      } catch (e) {
        reportCrash('1s update', e);
      }
    }, TICK_MS);
    // Retals: only while you can see the page (a hidden tab can't retal),
    // and straight away when you come back to it.
    const retalTick = () => {
      if (document.visibilityState !== 'visible') return;
      const warEnemy = (pageMode !== 'home' && enemyFactionId) ? enemyFactionId : null;
      if ((featureOn('retalDetect') && warEnemy) || atkLogViewing()) {
        refreshRetalWindow(getOwnFactionId(), warEnemy);
      }
    };
    setInterval(retalTick, RETAL_POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(retalTick, 300); });

    // One-tap blood: pre-load the hidden armoury a few seconds after the page
    // settles (if wanted), and refresh it every 8 minutes so stock is current.
    setTimeout(syncBloodFrame, 4000);
    // PC Mode: the hidden Preferences page is never pre-loaded or refreshed;
    // it only opens when you change Revives, and closes a minute later.
    // Balanced/Lite: coming back to a paused tab refreshes it straight away.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && perfMode() !== 'full') {
        refreshRosters();
        refreshChain();
        safeRender();
      }
    });
    setInterval(() => {
      // PC Mode never reloads: it only puts back an armoury that is missing.
      if (bloodPreloadWanted() && !quickUseBusy && (!pcMode() || !bloodFrame)) ensureBloodFrame(!pcMode());
    }, 8 * 60 * 1000);
  }

  const safeInit = IN_POPOUT_FRAME
    ? () => {
      if (!featureOn('popoutIntel')) return;
      try { seedKrakenIntelConsent(); initKrakenIntel(); installProfileAttack(); } catch (e) { console.warn('[War Room pop-out] Intel failed', e); }
    }
    : () => { Promise.resolve().then(init).catch((e) => reportCrash('init', e)); };
  if (IN_POPOUT_FRAME) {
    // As early as possible, so the attack page's first data is caught.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit);
    else safeInit();
  } else if (document.readyState === 'complete') {
    safeInit();
  } else {
    window.addEventListener('load', safeInit);
  }
})();
