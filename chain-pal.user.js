// ==UserScript==
// @name         Chain Pal 🔗
// @namespace    jay-chain-pal
// @version      1.0.3
// @description  Big chain timer, chain alerts and a one-click target finder in Torn's sidebar (PC). By -TheKraken- [3616083].
// @author       -TheKraken- [3616083]
// @match        https://www.torn.com/*
// @connect      dashing-fish-54.eu-west-1.convex.site
// @connect      api.torn.com
// @connect      ffscouter.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/chain-pal.user.js
// @updateURL    https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/chain-pal.user.js
// ==/UserScript==
// Copyright (c) 2026 -TheKraken- [3616083]. All rights reserved. Not to be copied or redistributed without permission.
//
// What leaves your computer: your API keys are kept in your userscript storage only. They are sent to Torn and
// FF Scouter (to find and check targets), never to the Chain Watch server. The Chain Watch server (Glory factions)
// is asked for retals, war targets, the shit list and short target holds, as on the Chain Watch page.
(function(){
  "use strict";
  if (window.top !== window.self) return;
  if (document.getElementById("cpalSide")) return;
  // ---------------------------------------------------------------------
  // Shared helpers (same names as the Chain Watch page, so its finder runs unchanged)
  // ---------------------------------------------------------------------
  var CW_API = "https://dashing-fish-54.eu-west-1.convex.site/chain/api";
  var CP_FACTIONS = [16057, 49431]; // Chain Watch (retals, war, shit list, holds) works for these
  var S = { f: 0, pin: "", isAdmin: false, member: null, skew: 0, status: {}, sound: false, cpLastFind: 0, cpPanel: false };
  function $(id){ return document.getElementById(id) }
  var HAS_GM = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  function store(k, v){ // userscript storage; Torn PDA without it: this browser's storage
    try {
      if (!HAS_GM){ if (v === undefined) return localStorage.getItem("cpal_" + k); if (v === null) localStorage.removeItem("cpal_" + k); else localStorage.setItem("cpal_" + k, String(v)); return }
      if (v === undefined){ var x = GM_getValue(k, null); return x == null ? null : String(x) }
      if (v === null) GM_setValue(k, null); else GM_setValue(k, String(v));
    } catch(e){ return null }
  }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] }) }
  function show(id, on){ var e = $(id); if (e) e.classList.toggle("hide", !on) }
  function msg(id, text, ok){ var e = $(id); if (e) e.innerHTML = text ? '<div class="'+(ok?"ok":"err")+'">'+esc(text)+'</div>' : "" }
  function nowS(){ return Math.floor(Date.now()/1000) + S.skew }
  function pad(n){ return (n < 10 ? "0" : "") + n }
  function mmss(s){ if (s == null) return "—"; s = Math.max(0, Math.round(s)); return Math.floor(s/60)+":"+pad(s%60) }
  function ago(ts){ if (!ts) return "never"; var s = nowS() - ts; return s < 90 ? s+"s ago" : s < 5400 ? Math.round(s/60)+"m ago" : s < 172800 ? Math.round(s/3600)+"h ago" : s < 63072000 ? Math.round(s/86400).toLocaleString()+" days ago" : (s/31557600).toFixed(1)+" years ago" }
  function TZ(){ return "TCT" }
  function toast(text, ok){ var t = document.createElement("div"); t.className = "cpal cp-toast" + (ok ? " ok" : ""); t.textContent = text; document.body.appendChild(t); setTimeout(function(){ t.remove() }, 4000) }
  // the finder's "is the Targets tab open?": the settings panel is open, or you used Find in the last 2 minutes
  function isOpen(t){ return t === "tgt" && (S.cpPanel || Date.now() - S.cpLastFind < 120000) }
  // cross-site requests through the userscript manager
  function gmReq(method, url, body){
    var wrap = function(status, text){ var j = null; try { j = JSON.parse(text) } catch(e){} return { ok: status >= 200 && status < 300, status: status, json: function(){ return Promise.resolve(j) } } };
    if (typeof GM_xmlhttpRequest !== "function"){ // Torn PDA: its own request functions
      if (method === "GET" && typeof PDA_httpGet === "function") return PDA_httpGet(url).then(function(r){ if (!r) throw new Error("Network error"); return wrap(Number(r.status) || 200, r.responseText) });
      if (method === "POST" && typeof PDA_httpPost === "function") return PDA_httpPost(url, { "Content-Type": "application/json" }, JSON.stringify(body)).then(function(r){ if (!r) throw new Error("Network error"); return wrap(Number(r.status) || 200, r.responseText) });
      return window.fetch(url, { method: method, headers: body ? { "Content-Type": "text/plain" } : {}, body: body ? JSON.stringify(body) : undefined }).then(function(r){ return r.text().then(function(t){ return wrap(r.status, t) }) });
    }
    return new Promise(function(res, rej){
      GM_xmlhttpRequest({ method: method, url: url, headers: body ? { "Content-Type": "application/json" } : {}, data: body ? JSON.stringify(body) : undefined, timeout: 20000,
        onload: function(r){ var j = null; try { j = JSON.parse(r.responseText) } catch(e){} res({ ok: r.status >= 200 && r.status < 300, status: r.status, json: function(){ return Promise.resolve(j) } }) },
        onerror: function(){ rej(new Error("Network error")) }, ontimeout: function(){ rej(new Error("Timed out")) } });
    });
  }
  function fetch(url, opt){ return gmReq(opt && opt.method || "GET", url, opt && opt.body ? JSON.parse(opt.body) : undefined) } // used by the finder code below
  function api(body){
    if (!S.f || CP_FACTIONS.indexOf(S.f) < 0) return Promise.reject(new Error("Chain Watch features are for Glory to Heroes and Glory to Saints"));
    body.f = S.f; if (body.pin === undefined) body.pin = "";
    return gmReq("POST", CW_API, body).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j || j.error) throw new Error((j && j.error) || ("HTTP " + r.status)); return j }) });
  }
  var CP_CSS = ".cpal{\n  --bg:#0b1220; --panel:#121b2e; --panel2:#18233a; --line:#25324d;\n  --text:#e6edf7; --muted:#8b9ab5; --accent:#2dd4bf; --accent2:#7c5cff;\n  --good:#22c55e; --warn:#f59e0b; --bad:#ef4444;\n}\n.cpal *{box-sizing:border-box}\n.cpal,.cpal{margin:0;background:var(--bg);color:var(--text);font:15px/1.4 system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif}\n.cpal{padding:0 0 40px}\n.cpal header{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,#0b1220 70%,rgba(11,18,32,.9));padding:12px 16px 0;border-bottom:1px solid var(--line)}\n.cpal .brand{display:flex;align-items:center;gap:10px;justify-content:space-between}\n.cpal .brand h1{font-size:17px;margin:0;letter-spacing:.3px}\n.cpal .brand h1 span{color:var(--accent)}\n.cpal .clock{display:flex;align-items:baseline;gap:8px;margin-top:6px}\n.cpal .clock .ck{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.5px}\n.cpal .clock .lbl{font-size:11px;font-weight:700;letter-spacing:.6px;padding:2px 7px;border-radius:6px;background:rgba(45,212,191,.15);color:var(--accent)}\n.cpal .other{font-size:12px;color:var(--muted);margin-top:2px;font-variant-numeric:tabular-nums}\n.cpal .tzseg{margin-top:8px}\n.cpal .tzseg button{padding:8px 6px;font-size:13px}\n.cpal #tzT.act{background:var(--accent);color:#04201c}\n.cpal #tzL.act{background:var(--warn);color:#2a1a00}\n.cpal .ctbar{display:flex;align-items:center;gap:10px;margin-top:8px;padding:8px 10px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}\n.cpal .ctbar .ctl{display:flex;flex-direction:column;line-height:1.15}\n.cpal .ctbar .ctl .k{font-size:10px;font-weight:700;letter-spacing:.8px;color:var(--muted)}\n.cpal .ctbar .ctl b{font-size:15px;font-variant-numeric:tabular-nums}\n.cpal .ctbar .ctt{flex:1;text-align:center;font-size:34px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:1px;line-height:1}\n.cpal .ctbar .ctt small{display:block;font-size:10px;font-weight:700;letter-spacing:.8px;color:var(--muted)}\n.cpal .ctbar.good .ctt{color:var(--good)}\n.cpal .ctbar.warn .ctt{color:var(--warn)}\n.cpal .ctbar.bad .ctt{color:var(--bad)}\n.cpal .ctbar.bad{border-color:rgba(239,68,68,.6);background:rgba(239,68,68,.10)}\n.cpal .ctbar.crit{animation:ctflash .8s steps(1) infinite}\n@keyframes ctflash{50%{background:rgba(239,68,68,.35)}}.cpal .ctbar .snd{display:flex;flex-direction:column;gap:4px}\n.cpal .ct-al{margin-top:6px;padding:8px 10px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}\n.cpal .ct-al .row3{display:flex;gap:6px;align-items:center;margin-top:6px}\n.cpal .ct-al .row3 span{font-size:12px;color:var(--muted);width:52px}\n.cpal .ct-al select{flex:1;padding:6px;font-size:13px}\n.cpal .ct-al button{border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:8px;width:34px;height:32px;cursor:pointer}\n.cpal .ctbar .snd button{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:6px 8px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}\n.cpal .ctbar .snd button.on{border-color:rgba(34,197,94,.6);color:var(--good)}\n.cpal .ctbar .vol{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);margin:0}\n.cpal .ctbar .vol input{width:74px;padding:0;accent-color:var(--accent);background:none;border:0}\n.cpal .ctbar .vol span{min-width:26px;text-align:right;font-variant-numeric:tabular-nums}\n.cpal .ctbar .snd button.arm{border-color:rgba(245,158,11,.7);color:var(--warn)}\n.cpal .tf-go{display:flex;gap:10px;margin-top:4px}\n.cpal .tf-go button{flex:1;border:0;border-radius:12px;padding:16px 8px;font:inherit;font-size:17px;font-weight:800;cursor:pointer}\n.cpal .tf-go .easy{background:linear-gradient(135deg,#2f7d4f,#1f5a37);color:#d1fae5}\n.cpal .tf-go .good{background:linear-gradient(135deg,#9a6a1f,#6e4a12);color:#fde68a}\n.cpal .tf-go .cog{flex:0 0 56px;background:var(--panel2);color:var(--text);border:1px solid var(--line);font-size:22px;padding:0}\n.cpal .tf-ord{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line);font-size:14px}\n.cpal .tf-ord:first-child{border-top:0}\n.cpal .tf-ord .n{width:18px;color:var(--muted);font-weight:700}\n.cpal .tf-ord .l{flex:1}\n.cpal .tf-ord .l small{color:var(--muted);font-size:12px}\n.cpal .tf-ord button{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:8px;width:36px;height:32px;font:inherit;cursor:pointer}\n.cpal .tf-ord button[disabled]{opacity:.3}\n.cpal .act-h,.cpal .act-l{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.5px;border-radius:5px;padding:1px 5px;margin-left:4px;vertical-align:1px}\n.cpal .act-h{background:rgba(239,68,68,.2);color:#fca5a5;border:1px solid rgba(239,68,68,.55)}\n.cpal .act-l{background:rgba(34,197,94,.18);color:#86efac;border:1px solid rgba(34,197,94,.55)}\n.cpal .warb{display:inline-block;margin-top:6px;background:rgba(168,85,247,.18);border:1px solid rgba(168,85,247,.7);color:#e9d5ff;border-radius:8px;padding:4px 8px;font-size:13px;font-weight:800}\n.cpal .htype{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-2px 0 8px;padding:6px 10px;border-radius:9px;font-size:13px;font-weight:900;letter-spacing:.8px}\n.cpal .htype small{font-size:11px;font-weight:700;letter-spacing:.3px;opacity:.85}\n.cpal .htype.ht-std{background:rgba(148,163,184,.16);color:#e2e8f0;border:1px solid rgba(148,163,184,.5)}\n.cpal .htype.ht-bty{background:rgba(234,179,8,.16);color:#fde047;border:1px solid rgba(234,179,8,.6)}\n.cpal .htype.ht-ret{background:rgba(59,130,246,.16);color:#bfdbfe;border:1px solid rgba(59,130,246,.65)}\n.cpal .htype.ht-shit{background:rgba(239,68,68,.16);color:#fecaca;border:1px solid rgba(239,68,68,.6)}\n.cpal .htype.ht-mine{background:rgba(45,212,191,.14);color:#99f6e4;border:1px solid rgba(45,212,191,.6)}\n.cpal .htype.ht-war{background:rgba(168,85,247,.18);color:#e9d5ff;border:1px solid rgba(168,85,247,.7)}\n.cpal .todo.m{background:rgba(148,163,184,.14);border:2px solid rgba(148,163,184,.55);color:#e2e8f0}\n.cpal .todo{margin-top:10px;border-radius:10px;padding:10px 12px;font-size:17px;font-weight:900;letter-spacing:.5px;text-align:center}\n.cpal .todo.h{background:rgba(239,68,68,.18);border:2px solid rgba(239,68,68,.7);color:#fecaca}\n.cpal .todo.l{background:rgba(34,197,94,.16);border:2px solid rgba(34,197,94,.7);color:#bbf7d0}\n.cpal .rtb{display:inline-block;margin-top:6px;background:rgba(59,130,246,.16);border:1px solid rgba(59,130,246,.65);color:#bfdbfe;border-radius:8px;padding:4px 8px;font-size:13px;font-weight:700}\n.cpal .rt-left{font-variant-numeric:tabular-nums}\n.cpal .rt-left.urg{color:#fca5a5}\n.cpal .rt-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid rgba(59,130,246,.3)}\n.cpal .rt-row:first-of-type{border-top:0}\n.cpal .rt-nm{flex:1;min-width:0}\n.cpal .rt-atk{flex:0 0 auto;background:var(--bad);color:#fff;text-decoration:none;font-weight:800;border-radius:8px;padding:7px 10px;font-size:13px}\n.cpal .tf-retb{background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.65);color:#dbeafe;border-radius:12px;padding:9px 12px;margin-bottom:10px;font-size:14px}\n.cpal .wn-ov{position:fixed;inset:0;background:rgba(3,7,18,.72);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px}\n.cpal .wn-ov.hide{display:none}\n.cpal .wn-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;max-width:460px;width:100%;max-height:85vh;overflow:auto}\n.cpal .wn-card h2{margin:0 0 4px}\n.cpal .wn-card h3{margin:14px 0 6px;font-size:13px;color:var(--accent);text-transform:uppercase;letter-spacing:.04em}\n.cpal .wn-card ul{margin:0;padding-left:20px}\n.cpal .wn-card li{margin:5px 0;font-size:14px;line-height:1.4}\n.cpal .wn-card .btn{width:100%;margin-top:14px}\n.cpal .tf-box{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:12px}\n.cpal .tf-sws{margin-top:6px}\n.cpal .tf-sws .sw{padding:6px 0;font-size:13px}\n.cpal .tf-sws .sw .tr{width:36px;height:20px}\n.cpal .tf-sws .sw .tr:after{width:14px;height:14px}\n.cpal .tf-sws .sw input:checked + .tr:after{left:19px}\n.cpal .tf-sws .tf-cnt{margin:-4px 0 4px 46px}\n.cpal .tf-sws .tf-cnt:empty{display:none}\n.cpal .cogm{flex:0 0 auto;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:8px;width:32px;height:28px;font-size:16px;line-height:1;cursor:pointer;padding:0}\n.cpal #tfInactBox select,.cpal #tfFreshBox select{width:auto;display:inline-block;padding:4px 6px;margin-left:4px}\n.cpal .tf-box .k2{margin-top:8px}\n.cpal .sl-head{width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:0;color:var(--text);font:inherit;font-size:17px;font-weight:700;padding:0;cursor:pointer;text-align:left}\n.cpal .sl-head .sl-n{font-size:13px;font-weight:400;color:var(--muted)}\n.cpal .sl-head .sl-ch{transition:transform .2s;color:var(--muted)}\n.cpal .sl-head[aria-expanded=true] .sl-ch{transform:rotate(90deg)}\n.cpal .tf-go button[disabled]{opacity:.55}\n.cpal .tf-res{margin-top:12px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:12px}\n.cpal .tf-res .nm{font-size:18px;font-weight:700}\n.cpal .tf-res .nm a{color:var(--text);text-decoration:none}\n.cpal .tf-res .meta{font-size:13px;color:var(--muted);margin-top:3px}\n.cpal .tf-res .acts{display:flex;gap:8px;margin-top:10px}\n.cpal .tf-res .acts a,.cpal .tf-res .acts button{flex:1;text-align:center;text-decoration:none;border-radius:10px;padding:12px 6px;font:inherit;font-weight:700;cursor:pointer;border:1px solid var(--line);background:var(--panel);color:var(--text)}\n.cpal .tf-res .acts a.atk{background:var(--bad);border-color:var(--bad);color:#fff;font-size:16px}\n.cpal .tf-set{border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:10px}\n.cpal .tf-set h3{margin:0 0 8px;font-size:14px}\n.cpal .tf-grid{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:8px;align-items:center;font-size:13px;color:var(--muted)}\n.cpal .tf-grid input{padding:9px;text-align:center}\n.cpal .tf-cnt{font-size:12px;margin-top:8px;color:var(--muted)}\n.cpal .tf-cnt b{color:var(--text)}\n.cpal .tf-cnt.low b{color:var(--warn)}\n.cpal .tf-cnt.none b{color:var(--bad)}\n.cpal .k2{margin:0 0 8px 52px;padding:10px;border:1px dashed var(--line);border-radius:10px}\n.cpal .k2 .lvl{font-size:12px;color:#fde68a;background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.4);border-radius:8px;padding:7px 9px;margin-bottom:8px}\n.cpal .k2 .row2{display:flex;gap:8px}\n.cpal .k2 .row2 input{flex:1}\n.cpal .k2 .row2 button{flex:0 0 auto;margin:0}\n.cpal .shitb{display:inline-block;margin-top:6px;background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.6);color:#fecaca;border-radius:8px;padding:4px 8px;font-size:13px;font-weight:700}\n.cpal .shitb small{font-weight:400;opacity:.85}\n.cpal .sl-row{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}\n.cpal .sl-row:first-child{border-top:0}\n.cpal .sl-row .tx{flex:1;min-width:0}\n.cpal .sl-row .tx a{color:var(--text);font-weight:700;text-decoration:none}\n.cpal .sl-row .tx small{display:block;color:var(--muted);font-size:12px}\n.cpal .bty{display:inline-block;margin-top:6px;background:rgba(234,179,8,.16);border:1px solid rgba(234,179,8,.55);color:#fde047;border-radius:8px;padding:4px 8px;font-size:13px;font-weight:700}\n.cpal .bty small{font-weight:400;color:#fef08a;opacity:.85}\n.cpal .sw{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:14px;cursor:pointer}\n.cpal .sw:first-child{border-top:0}\n.cpal .sw input{display:none}\n.cpal .sw .tr{width:42px;height:24px;border-radius:24px;background:#5b1d24;position:relative;flex:0 0 auto;transition:.2s}\n.cpal .sw .tr:after{content:\"\";position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;left:3px;transition:.2s}\n.cpal .sw input:checked + .tr{background:var(--good)}\n.cpal .sw input:checked + .tr:after{left:21px}\n.cpal .sw .tx{flex:1}\n.cpal .sw .tx small{display:block;color:var(--muted);font-size:12px}\n.cpal .hw-sum{display:flex;gap:10px;flex-wrap:wrap}\n.cpal .hw-sum>div{flex:1;min-width:120px;background:var(--panel2);border-radius:12px;padding:10px 12px}\n.cpal .hw-sum .k{font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase}\n.cpal .hw-sum .v{font-size:22px;font-weight:800}\n.cpal .hw-next{margin-top:12px;border-radius:14px;padding:14px;background:linear-gradient(135deg,rgba(249,115,22,.22),rgba(168,85,247,.18));border:1px solid rgba(249,115,22,.55)}\n.cpal .hw-next .lbl{font-size:11px;font-weight:800;letter-spacing:.8px;color:#fdba74}\n.cpal .hw-next .nm{font-size:20px;font-weight:800;margin-top:2px}\n.cpal .hw-next .meta{font-size:13px;color:#e5e7eb;margin-top:4px}\n.cpal .hw-next .alt{font-size:13px;color:var(--muted);margin-top:8px;border-top:1px solid rgba(255,255,255,.12);padding-top:8px}\n.cpal .hw-next button{margin-top:10px;background:var(--good);color:#052e16;border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:800;cursor:pointer}\n.cpal .hw-map{width:100%;height:auto;display:block;margin-top:6px;touch-action:manipulation}\n.cpal .hw-map .nd{cursor:pointer}\n.cpal .hw-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--muted);margin-top:6px}\n.cpal .hw-legend i{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:-1px;margin-right:4px}\n.cpal .hw-det{margin-top:10px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:12px}\n.cpal .hw-det .nm{font-size:17px;font-weight:800}\n.cpal .hw-det .meta{font-size:13px;color:var(--muted);margin-top:3px}\n.cpal .hw-det .eff{font-size:14px;margin-top:6px}\n.cpal .hw-det button{margin-top:10px;border-radius:10px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;border:1px solid var(--line);background:var(--panel);color:var(--text)}\n.cpal .hw-det button.on{background:var(--good);border-color:var(--good);color:#052e16}\n.cpal .hw-row{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);cursor:pointer}\n.cpal .hw-row:first-child{border-top:0}\n.cpal .hw-row .no{flex:0 0 34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;background:var(--panel2);border:2px solid var(--line)}\n.cpal .hw-row .tx{flex:1;min-width:0}\n.cpal .hw-row .tx b{display:block;font-size:15px}\n.cpal .hw-row .tx small{color:var(--muted);font-size:12px}\n.cpal .hw-row .ck{flex:0 0 auto;width:26px;height:26px;border-radius:7px;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-weight:900}\n.cpal .hw-row.own .ck{background:var(--good);border-color:var(--good);color:#052e16}\n.cpal .hw-row.own .tx b{text-decoration:line-through;opacity:.6}\n.cpal .hw-row.nxt{background:rgba(249,115,22,.10);border-radius:10px;padding-left:6px;padding-right:6px}\n.cpal .hw-row.nxt .no{border-color:#f97316;color:#fdba74}\n.cpal .hw-row.never{opacity:.55}\n.cpal .hwg{position:relative;border-radius:14px;overflow:hidden;padding:14px 8px 16px;margin-top:4px;\n  background:radial-gradient(ellipse at 50% 35%,rgba(120,60,20,.28),transparent 60%),radial-gradient(ellipse at 15% 80%,rgba(88,28,135,.30),transparent 55%),radial-gradient(ellipse at 90% 15%,rgba(60,60,60,.35),transparent 50%),linear-gradient(180deg,#1b1a1f,#141317 60%,#1a1612);\n  box-shadow:inset 0 0 60px rgba(0,0,0,.8);border:1px solid #2b2a30}\n.cpal .hwg-sp{font-family:\"Henny Penny\",\"Creepster\",cursive;color:#fbbf24;font-size:18px;text-shadow:0 2px 3px #000}\n.cpal .hwg-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}\n.cpal .hwg-bar{position:relative;height:12px;margin:10px 4px 0;border-radius:99px;background:#0a0a0c;box-shadow:inset 0 1px 3px #000}\n.cpal .hwg-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#3b2a12,#d97706 85%,#fbbf24);width:0}\n.cpal .hwg-witch{position:absolute;top:-16px;font-size:24px;transform:translateX(-50%) scaleX(-1);filter:drop-shadow(0 0 4px #f97316)}\n.cpal .hwg-stage{display:flex;align-items:center;margin-top:8px}\n.cpal .hwg-svg{flex:1;min-width:0;height:auto;display:block;touch-action:pan-y}\n.cpal .hwg-svg .nd{cursor:pointer}\n.cpal .hwg-arr{flex:0 0 22px;background:none;border:0;font-family:\"Henny Penny\",serif;font-size:56px;line-height:1;color:#f97316;cursor:pointer;padding:0;text-shadow:0 0 8px rgba(249,115,22,.5)}\n.cpal .hwg-arr[disabled]{color:#6b7280;text-shadow:none;cursor:default}\n.cpal .hwg-dots{display:flex;justify-content:center;gap:8px;margin-top:4px}\n.cpal .hwg-dots button{width:30px;height:22px;border-radius:6px;border:1px solid #3f3f46;background:#18181b;color:#a1a1aa;font:700 11px system-ui;cursor:pointer}\n.cpal .hwg-dots button.act{color:#111;border-color:transparent}\n.cpal .hwg-desc{margin-top:14px;border-top:1px solid #3f3f46;padding-top:12px;min-height:110px}\n.cpal .hwg-desc h3{margin:0;font-family:\"Henny Penny\",\"Creepster\",cursive;font-weight:400;font-size:24px;color:#fbbf24;text-shadow:0 2px 3px #000}\n.cpal .hwg-desc .d{color:#d4d4d8;font-size:15px;margin-top:6px;line-height:1.4}\n.cpal .hwg-desc .f{color:#a1a1aa;font-style:italic;font-size:14px;margin-top:4px}\n.cpal .hwg-desc .q{color:#fff;font-weight:700;font-size:15px;margin-top:6px}\n.cpal .hwg-desc .acts{display:flex;justify-content:flex-end;gap:22px;margin-top:10px}\n.cpal .hwg-desc .acts button{background:none;border:0;font-family:\"Henny Penny\",\"Creepster\",cursive;font-size:22px;cursor:pointer;padding:2px 0;text-shadow:0 2px 3px #000}\n.cpal .hwg-desc .acts .y{color:#fbbf24}\n.cpal .hwg-desc .acts .p{color:#a78bfa}\n.cpal .tierpill{display:inline-block;font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;margin-left:6px;vertical-align:1px}\n.cpal .tzbanner{margin:8px 0 0;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.6);color:#fcd34d;border-radius:10px;padding:8px 10px;font-size:13px;font-weight:600}\n.cpal .tz{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.4px;padding:1px 5px;border-radius:5px;margin-left:5px;background:var(--panel2);color:var(--muted);vertical-align:1px}\n.cpal.local header{border-bottom:2px solid var(--warn)}\n.cpal.local .clock .ck{color:var(--warn)}\n.cpal.local .clock .lbl{background:rgba(245,158,11,.2);color:var(--warn)}\n.cpal.local .tm,.cpal.local .hit .meta,.cpal.local .slot .small{color:#fbbf24}\n.cpal.local .tz{background:rgba(245,158,11,.22);color:var(--warn)}\n.cpal .pill{font-size:12px;padding:3px 9px;border-radius:99px;background:var(--panel2);color:var(--muted);white-space:nowrap}\n.cpal .pill.on{background:rgba(34,197,94,.15);color:var(--good)}\n.cpal .pill.off{background:rgba(239,68,68,.15);color:var(--bad)}\n.cpal nav{display:flex;gap:4px;margin-top:10px;overflow-x:auto}\n.cpal nav button{flex:1;background:none;border:0;color:var(--muted);padding:10px 6px;font:inherit;font-weight:600;border-bottom:2px solid transparent;cursor:pointer}\n.cpal nav button.act{color:var(--text);border-bottom-color:var(--accent)}\n.cpal nav button.hwflash{animation:hwflash 1s steps(1) infinite;border-radius:8px}\n@keyframes hwflash{0%{background:#f97316;color:#111}50%{background:transparent;color:#fdba74}}.cpal .hw-goal{background:rgba(249,115,22,.16);border:1px solid rgba(249,115,22,.7);color:#fed7aa;border-radius:12px;padding:10px 12px;margin:0 0 12px;font-weight:700}\n.cpal main{padding:14px 16px;max-width:900px;margin:0 auto}\n.cpal .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}\n.cpal .card h2{font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin:0 0 10px}\n.cpal .big{display:flex;gap:12px;flex-wrap:wrap}\n.cpal .big>div{flex:1;min-width:120px;background:var(--panel2);border-radius:12px;padding:12px}\n.cpal .big .k{font-size:12px;color:var(--muted)}\n.cpal .big .v{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}\n.cpal .v.good{color:var(--good)}\n.cpal .v.warn{color:var(--warn)}\n.cpal .v.bad{color:var(--bad)}\n.cpal .muted{color:var(--muted)}\n.cpal .small{font-size:12px}\n.cpal .err{background:rgba(239,68,68,.12);color:#fca5a5;border-radius:10px;padding:10px;margin:8px 0;font-size:13px}\n.cpal .ok{background:rgba(34,197,94,.12);color:#86efac;border-radius:10px;padding:10px;margin:8px 0;font-size:13px}\n.cpal label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}\n.cpal input,.cpal select,.cpal textarea{width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:11px;font:inherit}\n.cpal textarea{min-height:140px;font-family:ui-monospace,Menlo,monospace;font-size:13px}\n.cpal .btn{display:inline-block;background:var(--accent);color:#04201c;border:0;border-radius:10px;padding:11px 16px;font:inherit;font-weight:700;cursor:pointer;margin-top:12px}\n.cpal .btn.alt{background:var(--panel2);color:var(--text);border:1px solid var(--line)}\n.cpal .btn.danger{background:var(--bad);color:#fff}\n.cpal .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}\n.cpal .row>*{flex:1}\n.cpal .chips{display:flex;flex-wrap:wrap;gap:6px}\n.cpal .chip{font-size:12px;padding:3px 8px;border-radius:99px;background:var(--panel2)}\n.cpal .chip.o{border:1px solid rgba(34,197,94,.5)}\n.cpal .chip.i{border:1px solid rgba(245,158,11,.5)}\n.cpal .hit{border-top:1px solid var(--line);padding:10px 2px;cursor:pointer}\n.cpal .hit:first-child{border-top:0}\n.cpal .hit .top{display:flex;gap:8px;align-items:baseline}\n.cpal .hit .no{font-weight:700;color:var(--accent);min-width:64px;font-variant-numeric:tabular-nums}\n.cpal .hit .who{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.cpal .hit .t{font-variant-numeric:tabular-nums;font-weight:700}\n.cpal .hit .meta{font-size:12px;color:var(--muted);margin-top:2px}\n.cpal .hit .more{display:none;margin-top:8px}\n.cpal .hit.open .more{display:block}\n.cpal .t.good{color:var(--good)}\n.cpal .t.warn{color:var(--warn)}\n.cpal .t.bad{color:var(--bad)}\n.cpal .hit.save{background:rgba(34,197,94,.14);border-left:3px solid var(--good);border-radius:8px;padding-left:8px;margin:2px 0}\n.cpal .hit.save .t{color:var(--good)}\n.cpal .hit .sch{font-size:12px;margin-top:3px;color:var(--muted)}\n.cpal .hit .sch b{color:var(--text);font-weight:600}\n.cpal .chip.pres{border:1px solid rgba(34,197,94,.6)}\n.cpal .chip.abs{border:1px solid rgba(239,68,68,.6);color:#fca5a5}\n.cpal .slot{border-top:1px solid var(--line);padding:10px 2px}\n.cpal .slot:first-child{border-top:0}\n.cpal .bar{height:6px;background:var(--panel2);border-radius:99px;overflow:hidden;margin-top:6px}\n.cpal .bar>i{display:block;height:100%;background:var(--good)}\n.cpal .tag{font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px}\n.cpal .att{display:flex;gap:6px;overflow-x:auto;margin:0 0 10px;padding-bottom:2px}\n.cpal .att button{flex:0 0 auto;border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}\n.cpal .att button.act{background:var(--accent);border-color:var(--accent);color:#04201c}\n.cpal .att button small{display:block;font-size:11px;font-weight:400}\n.cpal .rp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}\n.cpal .rp-grid>div{background:var(--panel2);border-radius:10px;padding:8px 10px}\n.cpal .rp-grid b{display:block;font-size:20px;font-variant-numeric:tabular-nums}\n.cpal .rp-grid span{font-size:11px;color:var(--muted)}\n.cpal .rp-sl{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font-size:13px}\n.cpal .rp-sl .st{font-size:11px;font-weight:800;border-radius:6px;padding:2px 6px}\n.cpal .rp-sl .st.valid{background:rgba(34,197,94,.18);color:#86efac}\n.cpal .rp-sl .st.missed{background:rgba(239,68,68,.18);color:#fca5a5}\n.cpal .rp-sl .st.now{background:rgba(45,212,191,.18);color:#5eead4}\n.cpal .rp-sl .st.upcoming,.cpal .rp-sl .st.unrecorded{background:rgba(148,163,184,.16);color:#cbd5e1}\n.cpal .rep-tot{display:flex;gap:8px;margin-bottom:10px}\n.cpal .rep-tot>div{flex:1;background:var(--panel2);border-radius:10px;padding:8px;text-align:center}\n.cpal .rep-tot b{display:block;font-size:20px;font-variant-numeric:tabular-nums}\n.cpal .rep-tot span{font-size:11px;color:var(--muted)}\n.cpal .rep-sort{margin-bottom:6px}\n.cpal .rep-h,.cpal .rep-r{display:grid;grid-template-columns:22px 1fr 54px 54px 50px;gap:6px;align-items:center;padding:8px 0;border-top:1px solid var(--line);font-size:14px}\n.cpal .rep-h{border-top:0;font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.3px;padding-bottom:4px}\n.cpal .rep-r .n{color:var(--muted);font-size:12px}\n.cpal .rep-r .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.cpal .rep-r .nm a{color:var(--text);text-decoration:none;font-weight:600}\n.cpal .rep-r .nm small{display:block;color:var(--muted);font-size:11px}\n.cpal .rep-r .c,.cpal .rep-h .c{text-align:right;font-variant-numeric:tabular-nums}\n.cpal .rep-r .c.good{color:var(--good)}\n.cpal .rep-r .c.warn{color:var(--warn)}\n.cpal .rep-r .c.bad{color:var(--bad)}\n.cpal .tag.good{background:rgba(34,197,94,.18);color:var(--good)}\n.cpal .tag.warn{background:rgba(245,158,11,.18);color:var(--warn)}\n.cpal .tag.bad{background:rgba(239,68,68,.18);color:var(--bad)}\n.cpal .tag.mut{background:var(--panel2);color:var(--muted)}\n.cpal .hide{display:none!important}\n.cpal code{background:var(--panel2);padding:1px 5px;border-radius:5px;font-size:12px}\n.cpal .chk{display:flex;gap:10px;align-items:center;color:var(--text);margin:12px 0 0;font-size:14px}\n.cpal .chk input{width:20px;height:20px;flex:0 0 auto}\n.cpal .q{background:var(--panel2);border:1px solid rgba(245,158,11,.45);border-radius:12px;padding:12px;margin-top:10px}\n.cpal .q.soft{border-color:var(--line)}\n.cpal .q select{margin-top:8px}\n.cpal .day{font-size:12px;font-weight:700;text-transform:uppercase;color:var(--accent);margin:14px 0 2px;letter-spacing:.6px}\n.cpal .day:first-child{margin-top:0}\n.cpal .pv{display:flex;gap:10px;padding:5px 0;border-top:1px solid var(--line);font-size:14px}\n.cpal .pv .tm{color:var(--muted);min-width:118px;font-variant-numeric:tabular-nums}\n.cpal .days{display:flex;gap:6px;overflow-x:auto;margin:0 0 12px;padding-bottom:2px;-webkit-overflow-scrolling:touch}\n.cpal .days button{flex:0 0 auto;background:var(--panel2);border:1px solid var(--line);color:var(--muted);border-radius:99px;padding:8px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}\n.cpal .days button.act{background:var(--accent);border-color:var(--accent);color:#04201c}\n.cpal .days button .n{font-weight:400;opacity:.75;margin-left:5px;font-size:12px}\n.cpal .sum{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}\n.cpal .seg{display:flex;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:3px;margin-top:12px}\n.cpal .seg button{flex:1;background:none;border:0;color:var(--muted);font:inherit;font-weight:600;padding:10px 6px;border-radius:9px;cursor:pointer}\n.cpal .seg button.act{background:var(--accent);color:#04201c}\n.cpal .mlist{margin-top:6px;border:1px solid var(--line);border-radius:10px;overflow:hidden}\n.cpal .mlist:empty{display:none}\n.cpal .mlist button{display:block;width:100%;text-align:left;background:var(--panel2);border:0;border-top:1px solid var(--line);color:var(--text);font:inherit;padding:12px;cursor:pointer}\n.cpal .mlist button:first-child{border-top:0}\n.cpal .mlist button b{color:var(--accent)}\n.cpal .mlist .more{padding:10px 12px;font-size:12px;color:var(--muted);background:var(--panel2);border-top:1px solid var(--line)}\n.cpal .picked{margin-top:10px;background:rgba(45,212,191,.12);border:1px solid rgba(45,212,191,.45);border-radius:10px;padding:12px}\n.cpal .who{display:flex;gap:8px;align-items:center;margin-top:4px;font-size:12px;color:var(--muted)}\n.cpal .who b{color:var(--text)}\n.cpal .who a{color:var(--accent);text-decoration:none}\n.cpal .who .zm{display:flex;align-items:center;gap:4px;margin-left:auto}\n.cpal .who .zm button{border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:8px;width:32px;height:28px;font:inherit;font-size:18px;font-weight:800;line-height:1;cursor:pointer;padding:0}\n.cpal .who .zm button:active{background:var(--line)}\n.cpal .who .zm .zl{font-size:13px;font-weight:700;color:var(--text);padding:0 2px}\n.cpal .gr{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}\n.cpal .gr:first-child{border-top:0}\n.cpal .gr .tm{color:var(--muted);min-width:96px;font-variant-numeric:tabular-nums;font-size:14px}\n.cpal .gr .nm{flex:1;min-width:0}\n.cpal .gr .ac{flex:0 0 auto}\n.cpal .gr.past{opacity:.4;filter:grayscale(1)}\n.cpal .gr.past .tm{text-decoration:line-through;text-decoration-color:rgba(139,154,181,.6)}\n.cpal .chip.self{border:1px dashed var(--accent)}\n.cpal .chip.me{background:rgba(45,212,191,.22);color:var(--text)}\n.cpal .chip.o.youchip{border:3px solid rgba(34,197,94,.95)}\n.cpal .chip.i.youchip{border:3px solid rgba(245,158,11,.95)}\n.cpal .mini{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:7px 10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}\n.cpal .mini.add{border-color:rgba(45,212,191,.6);color:var(--accent)}\n.cpal .mini.rm{border-color:rgba(239,68,68,.5);color:#fca5a5}\n.cpal .mini[disabled]{opacity:.5}\n.cpal .legend{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin:0 0 10px}\n.cpal .toast{position:fixed;left:16px;right:16px;bottom:16px;z-index:9;max-width:520px;margin:0 auto;background:#3b1820;color:#fecaca;border:1px solid rgba(239,68,68,.5);border-radius:12px;padding:12px 14px;font-size:14px}\n.cpal .toast.ok{background:#0f2e24;color:#a7f3d0;border-color:rgba(34,197,94,.5)}\n.cpal .lagban{margin:0 0 8px;padding:8px 10px;border-radius:10px;background:rgba(120,53,15,.6);border:1px solid rgba(245,158,11,.75);color:#fde68a;font-size:13px;line-height:1.4}\n.cpal .dn-ov{background:var(--bg);z-index:100;overflow:auto}\n.cpal.dn-lock{overflow:hidden}\n.cpal .hospban{margin:0 0 8px;padding:9px 12px;border-radius:10px;background:rgba(127,29,29,.55);border:1px solid rgba(239,68,68,.6);color:#fecaca;font-size:14px}\n.cpal .hospban b{color:#fff;font-variant-numeric:tabular-nums}\n.cpal .ctoffmsg{display:none}\n.cpal .ctbar.ctoff > :not(.ctoffmsg){display:none !important}\n.cpal .ctbar.ctoff .ctoffmsg{display:block;grid-column:1/-1;width:100%;text-align:center;font-size:14px;line-height:1.4;padding:6px 4px;color:#fde68a}\n.cpal .ctbar.ctoff{background:rgba(120,53,15,.55);border-color:rgba(245,158,11,.7)}\n.cpal header > *:not(.wn-ov){max-width:868px;margin-left:auto;margin-right:auto}\n.cpal.dual header > *:not(.wn-ov),.cpal.dual main{max-width:1840px}\n.cpal.dual header > *:not(.wn-ov){max-width:1808px}\n.cpal .navs{display:flex;gap:16px}\n.cpal .navs nav{flex:1;min-width:0}\n.cpal.dual main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}\n.cpal nav button.here{opacity:.35}\n.cpal .who .vw{display:flex;gap:2px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:2px}\n.cpal .who .vw button{background:none;border:0;color:var(--muted);font:inherit;font-size:12px;font-weight:700;padding:4px 8px;border-radius:6px;cursor:pointer}\n.cpal .who .vw button.act{background:var(--accent);color:#06281f}\n.cpal .bd-t{width:100%;border-collapse:collapse;font-size:14px}\n.cpal .bd-t th{text-align:left;color:var(--muted);font-size:12px;font-weight:700;padding:6px 8px;border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap}\n.cpal .bd-t th.n,.cpal .bd-t td.n{text-align:right}\n.cpal .bd-t th.on{color:var(--accent)}\n.cpal .bd-t td{padding:7px 8px;border-bottom:1px solid var(--line)}\n.cpal .bd-t td.r{color:var(--muted);width:2.5em}\n.cpal .bd-t td.nm{overflow-wrap:anywhere}\n.cpal .bd-t tr.me td{background:rgba(34,197,94,.12)}\n.cpal .bd-t tr.zero td{color:var(--muted)}\n.cpal .tlb-r{display:grid;grid-template-columns:5.5em 1fr 4.2em;gap:8px;align-items:center;padding:4px 0;font-size:14px}\n.cpal .tlb-r .bar{height:10px;border-radius:6px;background:var(--panel);overflow:hidden}\n.cpal .tlb-r .bar i{display:block;height:100%;background:var(--accent)}\n.cpal .tlb-c{margin:-4px 0 2px calc(5.5em + 8px);font-size:11px;color:var(--muted)}\n.cpal .tlb-r .p{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}\n.cpal .lows{margin:4px 0 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);padding:10px}\n.cpal .lows h3{margin:0 0 6px;font-size:13px;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}\n.cpal .low{padding:8px 0;border-top:1px solid var(--line)}\n.cpal .low:first-of-type{border-top:0}\n.cpal .low .t{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}\n.cpal .low .t b{font-size:20px;color:var(--bad, #f87171);font-variant-numeric:tabular-nums}\n.cpal .low .w{margin-top:4px;font-size:13px;line-height:1.6}\n.cpal .low .w span{display:inline-block;margin-right:8px;white-space:nowrap}\n.cpal .low .w .on{color:var(--good)}\n.cpal .low .w .idle{color:var(--warn)}\n.cpal .low .w .off{color:var(--muted);text-decoration:line-through}\n\n/* ---- Chain Pal's own pieces ---- */\n.cpal.hide, .cpal .hide{display:none !important}\n.cpal{--bg:#0b1220;--panel:#121b2e;--panel2:#18233a;--line:#25324d;--text:#e6edf7;--muted:#93a4bf;--accent:#5eead4;--good:#22c55e;--warn:#f59e0b;--bad:#ef4444;color:var(--text);font:13px/1.4 system-ui,-apple-system,\"Segoe UI\",Roboto,Arial,sans-serif;text-align:left;box-sizing:border-box}\n.cpal *, .cpal *::before, .cpal *::after{box-sizing:border-box}\n.cp-side{margin:6px 0 8px;padding:8px;border-radius:10px;background:var(--bg);border:1px solid var(--line);width:100%}\n.cp-side .cp-ch{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);font-weight:700}\n.cp-side .cp-snd{background:none;border:0;cursor:pointer;font-size:15px;padding:0 2px;line-height:1}\n.cp-side .cp-snd.arm{animation:cpPulse 1s steps(1) infinite}\n.cp-side .cp-time{font:800 54px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center;margin:6px 0 8px;color:var(--text);letter-spacing:1px}\n.cp-side.small-t .cp-time{font-size:28px;margin:2px 0 6px}\n.cp-side.good .cp-time{color:var(--good);text-shadow:0 0 12px rgba(34,197,94,.45)}\n.cp-side.warn .cp-time{color:var(--warn);text-shadow:0 0 12px rgba(245,158,11,.45)}\n.cp-side.bad .cp-time{color:var(--bad);text-shadow:0 0 14px rgba(239,68,68,.55)}\n.cp-side.crit .cp-time{animation:cpPulse .8s steps(1) infinite}\n@keyframes cpPulse{50%{opacity:.35}}\n.cpal .cp-go{display:flex;gap:6px;margin:0}\n.cpal .cp-go button.good{flex:1;padding:9px 4px;font-weight:800;font-size:12.5px;white-space:nowrap;border-radius:8px;background:var(--good);color:#06281f;border:0;cursor:pointer;margin:0}\n.cpal .cp-go button.good:disabled{opacity:.6;cursor:default}\n.cpal .cp-go button.cog{width:38px;flex:0 0 38px;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--line);cursor:pointer;font-size:16px;margin:0;padding:0}\n.cp-side #tfRes .tf-res{margin-top:8px;font-size:12px;padding:8px}\n.cp-side #tfRes .tf-res .nm{font-size:14px}\n.cp-side #tfRes .acts{display:flex;gap:6px;flex-wrap:wrap}\n.cp-side #tfRes .acts > *{flex:1;text-align:center}\n.cp-side .tf-retb{font-size:12px;margin-bottom:6px}\n.cp-float{position:fixed;left:10px;bottom:10px;width:230px;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,.45)}\n.cp-ov{position:fixed;inset:0;background:rgba(3,7,18,.65);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}\n.cp-ov .cp-card{background:var(--bg);border:1px solid var(--line);border-radius:14px;width:100%;max-width:580px;padding:14px 16px;font-size:14px;box-shadow:0 20px 60px rgba(0,0,0,.5)}\n.cp-ov .cp-hd{display:flex;gap:8px;align-items:baseline;margin-bottom:10px;font-size:16px}\n.cp-ov .cp-hd button{margin-left:auto;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:8px;width:32px;height:30px;cursor:pointer}\n.cp-ov .cp-tabs{margin:0 0 12px}\n.cp-ov .cp-sub{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:6px 0 8px}\n.cp-ov .cp-sub > button{flex:1;padding:8px;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--line);cursor:pointer;font-weight:700}\n.cp-ov .cp-sub > button.cog{flex:0 0 38px}\n.cp-ov #ctSnd.on{background:rgba(34,197,94,.18);border-color:var(--good)}\n.cp-ov #ctSnd.arm{background:rgba(245,158,11,.18);border-color:var(--warn)}\n.cp-ov .cp-vol{display:flex;gap:8px;align-items:center;font-size:13px}\n.cp-ov .cp-vol input{flex:1}\n.cp-ov .row3{display:grid;grid-template-columns:4.5em 1fr 1fr 36px;gap:6px;align-items:center;margin:4px 0}\n.cp-ov .row3 select{width:100%}\n.cp-ov .row3 button{height:32px;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--line);cursor:pointer}\n.cp-ov .card{margin-top:10px}\n.cp-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100001;background:#3b1820;color:#fecaca;border:1px solid rgba(239,68,68,.5);padding:10px 14px;border-radius:10px;max-width:420px}\n.cp-toast.ok{background:#0f2e24;color:#a7f3d0;border-color:rgba(34,197,94,.5)}\n\n.cp-side .cp-src{text-align:center;font-size:11px;color:var(--muted);min-height:0;margin-top:-4px}\n.cp-side #cpStale{display:block;color:#fde68a;font-weight:700;margin-top:4px}\n.cp-side #cpStale.hide{display:none}\n.cp-po{position:fixed;top:4vh;left:2vw;width:96vw;height:90vh;z-index:100002;display:none;flex-direction:column;background:#111;border:1px solid #555;border-radius:8px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.7)}\n.cp-po.open{display:flex}\n.cp-po .cp-po-bar{display:flex;align-items:center;justify-content:space-between;padding:4px 6px 4px 12px;background:#2a2a2a;color:#eee;font:bold 14px Arial,sans-serif}\n.cp-po .cp-po-btns{display:flex;gap:6px;align-items:center}\n.cp-po .cp-po-btns button, .cp-po .cp-po-btns a{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:32px;padding:0 8px;border-radius:6px;border:1px solid #555;background:#3a3a3a;color:#eee;font:bold 16px Arial,sans-serif;cursor:pointer;text-decoration:none}\n.cp-po .cp-po-btns .cp-po-close{background:#c62828;border-color:#e53935;color:#fff;min-width:44px;font-size:18px}\n.cp-po iframe{flex:1;width:100%;border:0;background:#191919}\n";
  // ---- alert sounds (from Chain Watch) ----
  S.sound = store("cw_snd") === "1"; S.armed60 = false; S.armed30 = false;
  var AC = null;
  function audio(){
    try {
      if (!AC){ var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C() }
      if (AC.state === "suspended") AC.resume();
    } catch(e){ return null }
    return AC;
  }
  S.vol = (function(){ var v = parseInt(store("cw_vol"), 10); return isNaN(v) ? 60 : Math.max(0, Math.min(100, v)) })();
  function volMul(){ return S.vol / 60 } // 60% = the original loudness
  function env(a, g, t0, dur, vol){ vol = Math.max(0.0002, Math.min(1, vol * volMul())); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03); g.gain.setValueAtTime(vol, t0 + dur - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur) }
  function beepLong(){
    var a = audio(); if (!a) return;
    var t = a.currentTime + 0.02 + SND_OFF, o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(880, t);
    o.connect(g); g.connect(sndDest(a)); env(a, g, t, 1.6, 0.45); o.start(t); o.stop(t + 1.65);
    try { navigator.vibrate && navigator.vibrate(800) } catch(e){}
  }
  function siren(){
    var a = audio(); if (!a) return;
    var t = a.currentTime + 0.02 + SND_OFF, o = a.createOscillator(), g = a.createGain(), cycles = 5, half = 0.45;
    o.type = "sawtooth"; o.frequency.setValueAtTime(650, t);
    for (var i = 0; i < cycles; i++){ o.frequency.linearRampToValueAtTime(1350, t + (2*i+1)*half); o.frequency.linearRampToValueAtTime(650, t + (2*i+2)*half) }
    var lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
    o.connect(lp); lp.connect(g); g.connect(sndDest(a)); env(a, g, t, cycles*2*half, 0.35); o.start(t); o.stop(t + cycles*2*half + 0.05);
    try { navigator.vibrate && navigator.vibrate([300,150,300,150,300,150,300]) } catch(e){}
  }
  // more alert sounds (all made in the browser, no downloads)
  function tone(a, t, f, dur, type, vol){ var o = a.createOscillator(), g = a.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(sndDest(a)); env(a, g, t, dur, vol || 0.4); o.start(t); o.stop(t + dur + 0.02) }
  function sndDouble(){ var a = audio(); if (!a) return; var t = a.currentTime + 0.02 + SND_OFF; tone(a, t, 990, 0.22); tone(a, t + 0.32, 990, 0.22); try { navigator.vibrate && navigator.vibrate([200,100,200]) } catch(e){} }
  function sndRapid(){ var a = audio(); if (!a) return; var t = a.currentTime + 0.02 + SND_OFF; for (var i = 0; i < 8; i++) tone(a, t + i * 0.18, 1250, 0.1, "square", 0.25); try { navigator.vibrate && navigator.vibrate([100,80,100,80,100,80,100]) } catch(e){} }
  function sndChime(){ var a = audio(); if (!a) return; var t = a.currentTime + 0.02 + SND_OFF; tone(a, t, 1046, 0.5); tone(a, t + 0.35, 784, 0.7); try { navigator.vibrate && navigator.vibrate(300) } catch(e){} }
  function sndHorn(){ var a = audio(); if (!a) return; var t = a.currentTime + 0.02 + SND_OFF; tone(a, t, 220, 1.1, "sawtooth", 0.3); tone(a, t, 277, 1.1, "sawtooth", 0.2); try { navigator.vibrate && navigator.vibrate(1000) } catch(e){} }
  function sndBell(){ var a = audio(); if (!a) return; var t = a.currentTime + 0.02 + SND_OFF; for (var i = 0; i < 3; i++){ tone(a, t + i * 0.45, 1568, 0.4, "triangle", 0.45); tone(a, t + i * 0.45, 2349, 0.3, "sine", 0.15) } try { navigator.vibrate && navigator.vibrate([150,300,150,300,150]) } catch(e){} }
  var SOUNDS = { long: ["Long beep", beepLong], siren: ["Siren", siren], double: ["Double beep", sndDouble], rapid: ["Rapid beeps", sndRapid], chime: ["Chime", sndChime], horn: ["Horn", sndHorn], bell: ["Bell", sndBell] };
  var AL_N = 5; // alerts each person can set
  var AL_MAX = 210; // earliest alert: 3:30 (the timer checks every 5s from then on)
  var AL_TIMES = [0]; for (var alT = AL_MAX; alT >= 30; alT -= 15) AL_TIMES.push(alT); // Off, 3:30 down to 0:30 in 15s steps
  function alerts(){
    try {
      var a = JSON.parse(store("cw_alerts") || "null");
      if (Array.isArray(a) && a.length) {
        var out = a.slice(0, AL_N).map(function(x){ // older choices (e.g. 0:10) move to the nearest one on the list
          var at = Number(x.at) || 0; if (at && AL_TIMES.indexOf(at) < 0) at = Math.min(AL_MAX, Math.max(30, Math.round(at / 15) * 15));
          return { at: at, snd: x.snd || "long" };
        });
        while (out.length < AL_N) out.push({ at: 0, snd: "rapid" }); // older saves had 3: the new ones start off
        return out;
      }
    } catch(e){}
    return [{ at: 60, snd: "long" }, { at: 30, snd: "siren" }, { at: 0, snd: "rapid" }, { at: 0, snd: "double" }, { at: 0, snd: "chime" }]; // the original two, the rest off
  }
  var WAKE_KEY = "cw_wake", WAKE_SW = "wakeSw", WAKE_MSG = "wakeMsg";
  // ---- keep the screen on (screen wake lock): the page stays live, so the timer and alerts keep going ----
  var WL = null;
  function wakeWant(){ return store(WAKE_KEY) === "1" }
  function wakeUI(msgTxt){
    var c = $(WAKE_SW); if (c) c.checked = wakeWant();
    var t = $(WAKE_MSG); if (!t) return;
    t.textContent = msgTxt || (!wakeWant() ? "" : !("wakeLock" in navigator) ? "This browser can\u2019t keep the screen on. Set a longer screen timeout in your phone\u2019s settings instead." : WL ? "On: the screen stays on while this page is showing." : "On: it switches on again when you come back to this page.");
  }
  function wakeOn(){
    if (!wakeWant() || document.hidden || WL || !("wakeLock" in navigator)){ wakeUI(); return }
    navigator.wakeLock.request("screen").then(function(l){ WL = l; l.addEventListener("release", function(){ WL = null; wakeUI() }); wakeUI() })
      .catch(function(e){ wakeUI("Couldn\u2019t keep the screen on here (" + (e && e.message || "not allowed") + ").") });
  }
  function wakeOff(){ if (WL){ try { WL.release() } catch(e){} WL = null } wakeUI() }
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) wakeOn() }); // the browser drops it when you switch away
  function playSnd(k){ audio(); (SOUNDS[k] || SOUNDS.long)[1]() }
  function alRender(){
    var A = alerts(), lab = ["First", "Second", "Third", "Fourth", "Fifth"];
    $("ctAlRows").innerHTML = A.map(function(x, i){
      return '<div class="row3"><span>' + lab[i] + '</span><select data-al-at="' + i + '">' + AL_TIMES.map(function(t){ return '<option value="' + t + '"' + (t === x.at ? ' selected' : '') + '>' + (t ? "at " + mmss(t) : "Off") + '</option>' }).join("") + '</select>'
        + '<select data-al-snd="' + i + '"' + (x.at ? '' : ' disabled') + '>' + Object.keys(SOUNDS).map(function(k){ return '<option value="' + k + '"' + (k === x.snd ? ' selected' : '') + '>' + SOUNDS[k][0] + '</option>' }).join("") + '</select>'
        + '<button data-al-play="' + i + '" aria-label="Preview">▶</button></div>';
    }).join("");
  }
  // ---- target finder (from Chain Watch) ----
  var TF_DEF = { easy: { minff: 1.5, maxff: 2.0, minlvl: 1, maxlvl: 100 }, good: { minff: 2.5, maxff: 3.0, minlvl: 1, maxlvl: 100 }, inactive: true, nofac: false, verify: true, fresh: true, bounty: true, shit: true, retal: true, war: true, mine: true, order: ["retal", "war", "mine", "shit", "bounty", "ff"] };
  var TF_SRC = { retal: ["⚔ Retals", "hit one of us in the last 5 min · hospitalise"], war: ["🏴 War targets", "offline enemy faction members · leave"], mine: ["📒 My hit list", "your own targets, in your range"], shit: ["😈 Shit list", "in your range · hospitalise"], bounty: ["💰 Bounties", "in your range, biggest reward first · hospitalise"], ff: ["🎯 Other targets", "FF Scouter, in your range"] };
  function tfOrder(c){
    var o = (Array.isArray(c.order) ? c.order : []).filter(function(k, i, a){ return TF_SRC[k] && a.indexOf(k) === i });
    TF_DEF.order.forEach(function(k, i){
      if (o.indexOf(k) >= 0) return;
      var prev = i > 0 ? o.indexOf(TF_DEF.order[i - 1]) : -1; // a new source goes after its default neighbour
      o.splice(prev + 1, 0, k);
    });
    return o;
  }
  function tfOn(c, k){ return k === "ff" ? true : c[k] !== false }
  function tfRenderOrder(){
    var c = tfCfg(), o = tfOrder(c);
    $("tfOrder").innerHTML = o.map(function(k, i){
      return '<div class="tf-ord"><span class="n">' + (i + 1) + '</span><span class="l">' + TF_SRC[k][0] + ' <small>' + (tfOn(c, k) ? TF_SRC[k][1] : "(switched off)") + '</small></span>'
        + '<button data-ord="' + i + '" data-dir="-1"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up">▲</button>'
        + '<button data-ord="' + i + '" data-dir="1"' + (i === o.length - 1 ? " disabled" : "") + ' aria-label="Move down">▼</button></div>';
    }).join("");
  }
  function cid(){ var c = store("cw_cid"); if (!c || c.length < 8){ c = Math.random().toString(36).slice(2) + Date.now().toString(36); store("cw_cid", c) } return c }
  function rnow(){ return Date.now() / 1000 + (TF.ret ? TF.ret.skew : 0) }
  function mss(n){ n = Math.max(0, Math.floor(n)); return Math.floor(n / 60) + ":" + pad(n % 60) }
  // retals come from the server (faction key), so nobody needs faction API access
  function tfRetals(force){
    if (!force && TF.ret && Date.now() - TF.ret.got < 5000) return Promise.resolve(TF.ret.list);
    return api({ op: "retals", pin: "" }).then(function(j){
      TF.ret = { got: Date.now(), list: j.list || [], skew: (j.now || Date.now() / 1000) - Date.now() / 1000, warming: !!j.warming, error: j.error || "" };
      tfRetUI(); return TF.ret.list;
    });
  }
  function tfRetOpen(){ var now = rnow(); return ((TF.ret && TF.ret.list) || []).filter(function(x){ return x.ended + 300 - now > 0 }) }
  // open retals inside this type's fair fight + level range (unknown FF = skipped)
  function tfRetMatches(type, minLeft){
    var t = tfCfg()[type], n = rnow();
    var L = tfRetOpen().filter(function(x){ return x.ended + 300 - n > (minLeft || 0) && (!x.level || (x.level >= t.minlvl && x.level <= t.maxlvl)) });
    if (!L.length || !tfKey()) return Promise.resolve([]);
    var ids = L.map(function(x){ return x.pid });
    return tfFairFight(ids).then(function(ffs){
      return L.map(function(x, i){ return { player_id: x.pid, name: x.name, level: x.level, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, retal: x } })
        .filter(function(x){ return x.fair_fight != null && x.fair_fight >= t.minff && x.fair_fight <= t.maxff });
    });
  }
  function tfRetUI(){
    var c = tfCfg(), all = tfRetOpen();
    if (c.retal === false){ $("tfRcnt").innerHTML = ""; show("tfRetBox", false); return }
    tfRetMatches("good").catch(function(){ return [] }).then(function(M){ tfRetDraw(M.map(function(x){ return x.retal }), all.length - M.length) });
  }
  function tfRetDraw(L, outside){
    var c = tfCfg(); if (c.retal === false) return;
    var R = TF.ret || {};
    $("tfRcnt").className = "tf-cnt";
    $("tfRcnt").innerHTML = R.error ? "<b>!</b> " + esc(R.error) : R.warming && !L.length ? "Starting the retal feed…" : (L.length ? "<b>" + L.length + "</b> open retal" + (L.length > 1 ? "s" : "") + " in your range" : "No open retals in your range") + (outside > 0 ? " · " + outside + " outside it" : "");
    if (L.length){
      // each open retal with its own countdown and a direct Attack link (soonest to expire first)
      $("tfRetBox").innerHTML = '<div class="small" style="font-weight:700;margin-bottom:4px">⚔ ' + L.length + ' retal' + (L.length > 1 ? 's' : '') + ' open · HOSPITALISE</div>'
        + L.slice().sort(function(a, b){ return a.ended - b.ended }).slice(0, 5).map(function(x){
          return '<div class="rt-row"><span class="rt-nm"><b>' + esc(x.name) + '</b> <span class="small">hit ' + esc(x.dName || "one of us") + ' · <span class="rt-left" data-end="' + (x.ended + 300) + '">' + mss(x.ended + 300 - rnow()) + '</span> left</span></span>'
            + '<a class="rt-atk" data-ret-atk="' + x.pid + '" href="https://www.torn.com/page.php?sid=attack&user2ID=' + x.pid + '" target="_blank" rel="noopener">⚔ Attack</a></div>';
        }).join("");
    }
    show("tfRetBox", L.length > 0);
    // beep once for each new retal while the Targets tab is open
    var seen = TF.retSeen || (TF.retSeen = {}), fresh = false, first0 = !TF.retPrimed;
    L.forEach(function(x){ var k = x.pid + ":" + x.ended; if (!seen[k]){ seen[k] = 1; fresh = true } });
    TF.retPrimed = true;
    if (fresh && !first0 && isOpen("tgt") && S.vol > 0){ try { beepShort() } catch(e){} }
  }
  // tapping a retal's Attack link holds it for a minute so the finder doesn't hand it to someone else too
  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest("[data-ret-atk]"); if (!a) return;
    var pid = Number(a.getAttribute("data-ret-atk"));
    TF.used[pid] = Date.now(); tfUsedSave();
    api({ op: "claim", pid: pid, cid: cid(), pin: "" }).catch(function(){});
  });
  setInterval(function(){
    var els = document.querySelectorAll(".rt-left[data-end]"), now = rnow();
    Array.prototype.forEach.call(els, function(el){
      var left = Number(el.getAttribute("data-end")) - now;
      el.textContent = left > 0 ? mss(left) : "expired"; el.classList.toggle("urg", left < 60);
    });
    if (TF.ret && $("tfRetBox") && !$("tfRetBox").classList.contains("hide")){ var e0 = $("tfRetBox").querySelector(".rt-left[data-end]"); if (e0 && Number(e0.getAttribute("data-end")) <= now) tfRetUI() }
  }, 1000);
  setInterval(function(){
    if (!isOpen("tgt") || document.hidden || false || tfCfg().retal === false) return;
    tfRetals(true).catch(function(){});
  }, 20000);
  function tfCfg(){ try { var c = JSON.parse(store("cw_tf") || "null"); if (c && c.easy && c.good){ c.order = tfOrder(c); return c } } catch(e){} return JSON.parse(JSON.stringify(TF_DEF)) }
  function tfSave(c){ store("cw_tf", JSON.stringify(c)) }
  function tfKey(){ var k = store("cw_tfkey") || ""; return /^[A-Za-z0-9]{16}$/.test(k) ? k : "" }
  var TF = { cache: {}, used: {}, busy: false, bty: null, ffs: {}, fac: {}, facSoon: [], randPrep: {}, easy: null };
  try { TF.easy = JSON.parse(store("cw_tfeasy") || "null") } catch(e){}
  try { var u0 = JSON.parse(store("cw_tfused") || "{}"), n0 = Date.now(); Object.keys(u0).forEach(function(id){ if (n0 - u0[id] < 24*3600000) TF.used[id] = u0[id] }) } catch(e){}
  function tfUsedSave(){ try { store("cw_tfused", JSON.stringify(TF.used)) } catch(e){} }
  function tfKey2(){ var k = store("cw_tfkey2") || ""; return /^[A-Za-z0-9]{16}$/.test(k) ? k : "" }
  function tornKey(){ return tfKey2() || tfKey() }
  function tfBtyPool(){ return !tfKey2() && !!(S.member && S.donor && S.donor.has) }
  function tfShowK2(){ var k = tfKey2(); show("tfK2Set", !k); show("tfK2Have", !!k); show("tfK2Pool", tfBtyPool()); if (k) $("tfK2Show").textContent = "…" + k.slice(-4) }
  function tfShowKey(){
    var k = tfKey();
    show("tfKeyBox", !k); show("tfKeyHave", !!k); show("tfMain", !!k); show("cpSetup", !k); show("cpNoKey", !k); show("tfSettings", !!k);
    show("shitAddBox", !S.member); show("tfInfSw", !!S.isAdmin);
    $("shitWho").textContent = S.member ? "Admins and viewers keep it up to date." : "Shared by Glory to Heroes and Glory to Saints: anyone added or removed here changes both lists. Admins and viewers can add or remove people.";
    shitLoad(true).catch(function(){});
    tfRenderOrder();
    if (tfCfg().retal !== false) tfRetals(true).catch(function(e){ $("tfRcnt").innerHTML = "<b>!</b> " + esc(e.message) });
    if (k){ $("tfKeyShow").textContent = "…" + k.slice(-4); tfFillSettings(); tfShowK2(); tfCounts() }
  }
  function tfFillSettings(){
    var c = tfCfg();
    if ($("tfBtyMin")) $("tfBtyMin").value = tfMoneyTxt(c.btyMin || 0);
    [["G","good"]].forEach(function(p){
      $("tf"+p[0]+"minff").value = c[p[1]].minff; $("tf"+p[0]+"maxff").value = c[p[1]].maxff;
      $("tf"+p[0]+"minlvl").value = c[p[1]].minlvl; $("tf"+p[0]+"maxlvl").value = c[p[1]].maxlvl;
    });
    $("tfInactive").checked = !!c.inactive; $("tfInactDays").value = String(c.inactDays || 14); $("tfInactTxt").textContent = (c.inactDays || 14) >= 365 ? "1 year+ inactive" : (c.inactDays || 14) >= 180 ? "6 months+ inactive" : (c.inactDays || 14) + "+ day" + ((c.inactDays || 14) > 1 ? "s" : "") + " inactive"; $("tfNofac").checked = !!c.nofac; $("tfOffline").checked = !!c.offline; $("tfVerify").checked = !!c.verify; $("tfFresh").checked = !!c.fresh; $("tfFreshMin").value = String(c.repeatMin || 15); $("tfFreshTxt").textContent = "Not the same person twice in " + ((c.repeatMin || 15) >= 60 ? ((c.repeatMin || 15) / 60) + " hour" + ((c.repeatMin || 15) > 60 ? "s" : "") : (c.repeatMin || 15) + " min"); $("tfBounty").checked = c.bounty !== false; $("tfShit").checked = c.shit !== false; $("tfRetal").checked = c.retal !== false; $("tfWar").checked = c.war !== false; $("tfMine").checked = c.mine !== false; $("tfInf").checked = !!c.inf;
  }
  // "500k", "1.5m", "$1,000,000" -> dollars (0 = no minimum)
  function tfMoney(v){ v = String(v || "").trim().toLowerCase().replace(/[$,\s]/g, ""); var m = /^(\d*\.?\d+)([kmb]?)$/.exec(v); return m ? Math.round(parseFloat(m[1]) * { "": 1, k: 1e3, m: 1e6, b: 1e9 }[m[2]]) : 0 }
  function tfMoneyTxt(n){ return !n ? "" : n % 1e9 === 0 ? n / 1e9 + "b" : n % 1e6 === 0 ? n / 1e6 + "m" : n % 1e3 === 0 ? n / 1e3 + "k" : String(n) }
  function tfReadSettings(){
    var c = tfCfg(), n = function(id, d){ var v = parseFloat($(id).value); return isNaN(v) ? d : v };
    [["G","good"]].forEach(function(p){
      var t = c[p[1]];
      t.minff = n("tf"+p[0]+"minff", t.minff); t.maxff = n("tf"+p[0]+"maxff", t.maxff);
      t.minlvl = Math.round(n("tf"+p[0]+"minlvl", t.minlvl)); t.maxlvl = Math.round(n("tf"+p[0]+"maxlvl", t.maxlvl));
      if (t.minff > t.maxff){ var x = t.minff; t.minff = t.maxff; t.maxff = x }
      if (t.minlvl > t.maxlvl){ var y = t.minlvl; t.minlvl = t.maxlvl; t.maxlvl = y }
    });
    c.inactive = $("tfInactive").checked; c.inactDays = Number($("tfInactDays").value) || 14; c.nofac = $("tfNofac").checked; c.offline = $("tfOffline").checked; c.verify = $("tfVerify").checked; c.fresh = $("tfFresh").checked; c.repeatMin = Number($("tfFreshMin").value) || 15; c.bounty = $("tfBounty").checked; c.shit = $("tfShit").checked; c.retal = $("tfRetal").checked; c.war = $("tfWar").checked; c.mine = $("tfMine").checked; c.inf = $("tfInf").checked;
    c.btyMin = tfMoney($("tfBtyMin").value);
    tfSave(c); tfRenderOrder(); tfRetUI(); TF.cache = {}; return c;
  }
  function tfFetch(type){
    var c = tfCfg(), t = c[type], k = tfKey();
    var days = Number(c.inactDays) || 14;
    var sig = [type, t.minff, t.maxff, t.minlvl, t.maxlvl, c.inactive, days, c.nofac].join("|");
    var hit = TF.cache[type];
    if (hit && hit.sig === sig && Date.now() - hit.at < 60000) return Promise.resolve(hit.list);
    var q = "key=" + encodeURIComponent(k) + "&minff=" + t.minff + "&maxff=" + t.maxff + "&minlevel=" + t.minlvl + "&maxlevel=" + t.maxlvl
      + "&inactiveonly=" + (c.inactive && days >= 14 ? 1 : 0) + "&factionless=" + (c.nofac ? 1 : 0) + "&limit=50";
    return fetch("https://ffscouter.com/api/v1/get-targets?" + q).then(function(r){ return r.json() }).then(function(d){
      if (d && d.error){
        var e = String(d.error);
        if (d.code === 6 || /key/i.test(e)) e = "FF Scouter doesn't recognise this key. Sign up at ffscouter.com with it first (one-off), then try again.";
        throw new Error(e);
      }
      var list = (d && d.targets) || [];
      if (c.inactive && days !== 14){ // FF Scouter only knows "14+ days": any other choice is filtered on last action here
        var cut = Date.now() / 1000 - days * 86400;
        list = list.filter(function(x){ var la = Number(x.last_action); return la > 0 ? la <= cut : days < 14 });
      }
      TF.cache[type] = { sig: sig, at: Date.now(), list: list };
      return list;
    });
  }
  function tfStatus(id, withActivity){
    return fetch("https://api.torn.com/v2/user/" + id + "/" + (withActivity ? "profile" : "basic") + "?striptags=true&key=" + encodeURIComponent(tornKey()) + "&comment=chainwatch-tf")
      .then(function(r){ return r.json() }).then(function(d){
        if (d && d.error) return { ok: false, err: d.error.error || "Torn API error" };
        var st = (d && d.profile && d.profile.status) || {};
        var pr = (d && d.profile) || {}, la = pr.last_action || {};
        return { ok: true, state: st.state || "", desc: st.description || "", until: Number(st.until) || 0, online: String(la.status || ""),
          name: pr.name || "", level: Number(pr.level) || 0, fac: Number(pr.faction_id) || 0, laTs: Number(la.timestamp) || 0 };
      }).catch(function(){ return { ok: false, err: "Couldn't reach Torn" } });
  }
  // Status check that falls back to the shared keys: once Torn limits your own key, checks go through the
  // server (members' shared Public keys) for 30s, then your own key is tried again. Up to 3 checks per server call.
  function tfStatusAny(id){
    if (Date.now() < (TF.limUntil || 0)) return tfPool(id);
    return tfStatus(id, true).then(function(st){
      if (!st.ok && /too many/i.test(st.err || "")){ TF.limUntil = Date.now() + 30000; return tfPool(id) }
      return st;
    });
  }
  function tfPool(id){
    if (Date.now() < (TF.poolNoneUntil || 0)) return Promise.resolve({ ok: false, err: "Too many requests" });
    return new Promise(function(res){
      TF.pq = TF.pq || []; TF.pq.push({ id: id, res: res });
      if (!TF.pqT) TF.pqT = setTimeout(tfPoolFlush, 150); // a moment for the rest of the batch to join
    });
  }
  function tfPoolFlush(){
    TF.pqT = null;
    while (TF.pq && TF.pq.length){
      (function(q){
        api({ op: "poolCheck", cid: cid(), pid: S.member ? S.member.pid : 0, ids: q.map(function(x){ return x.id }), pin: "" }).then(function(j){
          if (j.empty || j.busy) TF.poolNoneUntil = Date.now() + 15000; // nobody's key free right now
          var by = {}; (j.list || []).forEach(function(x){ by[x.id] = x });
          q.forEach(function(x){ var r = by[x.id]; x.res(r ? (r.ok ? { ok: true, shared: true, state: r.state, desc: r.desc, until: r.until, online: r.online, name: r.name, level: r.level, fac: r.fac, laTs: r.laTs } : { ok: false, err: r.err }) : { ok: false, err: "Too many requests" }) });
        }).catch(function(){ q.forEach(function(x){ x.res({ ok: false, err: "Couldn't reach Torn" }) }) });
      })(TF.pq.splice(0, 3));
    }
  }
  // Torn bounty list (cached 60s), one entry per target with rewards added up
  function tfBounties(){
    if (TF.bty && Date.now() - TF.bty.at < 120000) return Promise.resolve(TF.bty.list);
    var k = tornKey(), all = [], page = 0;
    function get(url){
      return fetch(url).then(function(r){ return r.json() }).then(function(d){
        if (d && d.error){
          if (d.error.code === 16) throw new Error(tfKey2() ? "Your bounty key can't read Torn's bounty list. Use a Public, Limited or Full key." : "Your FF Scouter key can't read Torn's bounty list (it's a Custom key without Bounties). Add a Public key in \"Torn key for bounties\" below.");
          throw new Error("Torn bounties: " + (d.error.error || "API error"));
        }
        all = all.concat(d.bounties || []); page++;
        var nx = d._metadata && d._metadata.links && d._metadata.links.next;
        if (nx && page < 10 && (d.bounties || []).length === 100) return get(nx + (nx.indexOf("key=") < 0 ? "&key=" + encodeURIComponent(k) : ""));
      });
    }
    // shared a Public key with the finder pool (and no bounty key of your own here)? The server reads the list with it.
    var load = tfBtyPool() ? api({ op: "bounties", pid: S.member.pid, pin: "" }).then(function(j){ all = j.list || [] })
      : get("https://api.torn.com/v2/torn/bounties?limit=100&key=" + encodeURIComponent(k) + "&comment=chainwatch-tf");
    return load.then(function(){
      var by = {}, mates = {};
      Object.keys((S.status && S.status.names) || {}).forEach(function(id){ mates[id] = 1 });
      (S.roster || []).forEach(function(m){ mates[String(m.id)] = 1 });
      all.forEach(function(b){
        var id = Number(b.target_id); if (!id || mates[String(id)]) return; // never offer our own members
        var x = by[id] || (by[id] = { id: id, name: b.target_name, level: Number(b.target_level) || 0, reward: 0, count: 0, reason: "" });
        x.reward = Math.max(x.reward, Number(b.reward) || 0); x.count += Number(b.quantity) || 1; // only one can be claimed per hit
        if (!x.reason && b.reason) x.reason = String(b.reason);
      });
      var list = Object.keys(by).map(function(id){ return by[id] });
      TF.bty = { at: Date.now(), list: list };
      return list;
    });
  }
  // FF Scouter fair fight for specific players (cached 10 min per player)
  function tfFairFight(ids){
    var now = Date.now(), need = ids.filter(function(id){ var c = TF.ffs[id]; return !c || now - c.at > 600000 });
    var chunks = []; for (var i = 0; i < need.length; i += 100) chunks.push(need.slice(i, i + 100));
    return Promise.all(chunks.map(function(ch){
      return fetch("https://ffscouter.com/api/v1/get-stats?key=" + encodeURIComponent(tfKey()) + "&targets=" + ch.join(","))
        .then(function(r){ return r.json() }).then(function(d){
          if (d && d.error && !Array.isArray(d)) throw new Error(String(d.error));
          var rows = Array.isArray(d) ? d : (d && (d.data || d.targets || d.results)) || [];
          ch.forEach(function(id){ TF.ffs[id] = { at: now, ff: null } });
          rows.forEach(function(r){ var id = Number(r.player_id || r.id); if (id) TF.ffs[id] = { at: now, ff: r.fair_fight == null ? null : Number(r.fair_fight), est: r.bs_estimate_human || "" } });
        });
    })).then(function(){ return ids.map(function(id){ return TF.ffs[id] || { ff: null } }) });
  }
  // bounty targets inside this type's level + fair fight range, best reward first
  function tfBountyMatches(type){
    var c = tfCfg(), t = c[type];
    return tfBounties().then(function(list){
      var lv = list.filter(function(b){ return b.level >= t.minlvl && b.level <= t.maxlvl && b.reward >= (c.btyMin || 0) }); // and at least the minimum bounty
      if (!lv.length) return [];
      return tfFairFight(lv.map(function(b){ return b.id })).then(function(ffs){
        return lv.map(function(b, i){ return { player_id: b.id, name: b.name, level: b.level, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, bounty: b } })
          .filter(function(x){ return x.fair_fight != null && x.fair_fight >= t.minff && x.fair_fight <= t.maxff })
          .sort(function(a, b){ return b.bounty.reward - a.bounty.reward });
      });
    });
  }
  function money(n){ return "$" + Math.round(n).toLocaleString() }
  // ---- shit list ----
  function shitLoad(force){
    if (!force && TF.shit && Date.now() - TF.shit.at < 60000) return Promise.resolve(TF.shit.list);
    return api({ op: "shitList" }).then(function(j){ TF.shit = { at: Date.now(), list: j.list || [] }; shitRender(); return TF.shit.list });
  }
  function shitRender(){
    var L = (TF.shit && TF.shit.list) || [];
    $("shitCount").textContent = "(" + L.length + ")";
    $("shitList").innerHTML = L.length ? L.map(function(x){
      return '<div class="sl-row"><div class="tx"><a href="https://www.torn.com/profiles.php?XID=' + x.pid + '" target="_blank" rel="noopener">' + esc(x.name) + '</a> <span class="small muted">[' + x.pid + '] · Lv ' + x.level + '</span>'
        + '<small>' + (x.reason ? esc(x.reason) + ' · ' : '') + 'added ' + asTCT(function(){ return when(x.addedAt) }) + ' TCT</small></div>'
        + (S.member ? '' : '<button class="mini rm" data-shit-rm="' + x.pid + '">Remove</button>') + '</div>';
    }).join("") : '<div class="muted small">Nobody on the list yet.</div>';
  }
  // ---- my hit list (this device only) ----
  function myList(){ try { var l = JSON.parse(store("cw_mylist") || "[]"); return Array.isArray(l) ? l : [] } catch(e){ return [] } }
  function mySave(l){ store("cw_mylist", JSON.stringify(l)); myRender() }
  function myRender(){
    var L = myList();
    $("myCount").textContent = "(" + L.length + ")";
    $("myList").innerHTML = L.length ? L.map(function(x){
      return '<div class="sl-row"><div class="tx"><a href="https://www.torn.com/profiles.php?XID=' + x.pid + '" target="_blank" rel="noopener">' + esc(x.name) + '</a> <span class="small muted">[' + x.pid + ']' + (x.level ? ' · Lv ' + x.level : '') + '</span>'
        + '<small>' + (x.note ? esc(x.note) + ' · ' : '') + 'added ' + when(x.addedAt) + ' ' + TZ() + '</small></div>'
        + '<button class="mini rm" data-my-rm="' + x.pid + '">Remove</button></div>';
    }).join("") : '<div class="muted small">Nobody on your list yet.</div>';
  }
  function tfMineMatches(type){
    var c = tfCfg(), t = c[type];
    if (c.mine === false) return Promise.resolve([]);
    var lv = myList().filter(function(x){ return !x.level || (x.level >= t.minlvl && x.level <= t.maxlvl) });
    if (!lv.length) return Promise.resolve([]);
    return tfFairFight(lv.map(function(x){ return x.pid })).then(function(ffs){
      return lv.map(function(x, i){ return { player_id: x.pid, name: x.name, level: x.level, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, mine: x } })
        .filter(function(x){ return x.fair_fight != null && x.fair_fight >= t.minff && x.fair_fight <= t.maxff });
    });
  }
  function tfShitMatches(type){
    var c = tfCfg(), t = c[type];
    if (c.shit === false) return Promise.resolve([]);
    return shitLoad(false).then(function(L){
      var lv = L.filter(function(x){ return x.level >= t.minlvl && x.level <= t.maxlvl });
      if (!lv.length) return [];
      return tfFairFight(lv.map(function(x){ return x.pid })).then(function(ffs){
        return lv.map(function(x, i){ return { player_id: x.pid, name: x.name, level: x.level, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, shit: x } })
          .filter(function(x){ return x.fair_fight != null && x.fair_fight >= t.minff && x.fair_fight <= t.maxff });
      });
    });
  }
  function tfCountLine(id, p){
    $(id).className = "tf-cnt"; $(id).innerHTML = "Checking…";
    p.then(function(list){
      var n = list.length;
      $(id).className = "tf-cnt" + (n === 0 ? " none" : n < 10 ? " low" : "");
      $(id).innerHTML = "<b>" + n + (n === 50 ? "+" : "") + "</b> " + (n === 0 ? "targets. Widen the range" : n < 10 ? "targets (low)" : "targets available");
    }).catch(function(e){ $(id).className = "tf-cnt none"; $(id).innerHTML = "<b>!</b> " + esc(e.message) });
  }
  var tfDeb = null;
  function tfCounts(){ clearTimeout(tfDeb); tfDeb = setTimeout(function(){
    tfCountLine("tfGcnt", tfFetch("good"));
    var c = tfCfg();
    if (c.shit !== false){
      $("tfScnt").className = "tf-cnt"; $("tfScnt").innerHTML = "Checking the shit list…";
      tfShitMatches("good").then(function(r){ $("tfScnt").innerHTML = "<b>" + r.length + "</b> shit-listers in your range" })
        .catch(function(e){ $("tfScnt").className = "tf-cnt none"; $("tfScnt").innerHTML = "<b>!</b> " + esc(e.message) });
    } else $("tfScnt").innerHTML = "";
    if (c.mine === false || !myList().length) $("tfMcnt").innerHTML = "";
    else { $("tfMcnt").className = "tf-cnt"; tfMineMatches("good").then(function(r){ $("tfMcnt").innerHTML = "<b>" + r.length + "</b> of your " + myList().length + " in your range" }).catch(function(e){ $("tfMcnt").innerHTML = "<b>!</b> " + esc(e.message) }) }
    if (c.war === false) $("tfWcnt").innerHTML = "";
    else {
      $("tfWcnt").className = "tf-cnt"; $("tfWcnt").innerHTML = "Checking the war…";
      tfWar().then(function(W){
        if (!W.ids.length){ $("tfWcnt").innerHTML = "No ranked war right now"; return }
        return tfWarMatches("good").then(function(r){ $("tfWcnt").innerHTML = "<b>" + r.length + "</b> offline war targets in your range" + (W.list.length ? " · " + W.list.length + " offline in total" : "") });
      }).catch(function(e){ $("tfWcnt").className = "tf-cnt none"; $("tfWcnt").innerHTML = "<b>!</b> " + esc(e.message) });
    }
    if (c.bounty === false){ $("tfBcnt").innerHTML = ""; return }
    $("tfBcnt").className = "tf-cnt"; $("tfBcnt").innerHTML = "Checking bounties…";
    tfBountyMatches("good").then(function(r){
      $("tfBcnt").innerHTML = "<b>" + r.length + "</b> bounty targets in your range";
    }).catch(function(e){ $("tfBcnt").className = "tf-cnt none"; $("tfBcnt").innerHTML = "<b>!</b> " + esc(e.message) });
  }, 400) }
  // ---- war targets: offline members of the faction we're in a ranked war with ----
  function tfWar(){
    if (TF.war && Date.now() - TF.war.at < 60000) return Promise.resolve(TF.war);
    return api({ op: "war", pin: "" }).then(function(w){
      var ids = w.ids || [];
      if (!ids.length){ TF.war = { at: Date.now(), ids: [], names: {}, list: [] }; return TF.war }
      return Promise.all(ids.map(function(fid){
        return fetch("https://api.torn.com/v2/faction/" + fid + "/members?striptags=true&key=" + encodeURIComponent(tornKey()) + "&comment=chainwatch-tf")
          .then(function(r){ return r.json() }).then(function(d){
            if (d && d.error) throw new Error("Torn: " + (d.error.error || "error"));
            var mem = Array.isArray(d && d.members) ? d.members : Object.values((d && d.members) || {});
            return mem.filter(function(m){ return String((m.last_action || {}).status || "") === "Offline" })
              .map(function(m){ return { id: Number(m.id), name: m.name, level: Number(m.level) || 0, fid: fid, state: String((m.status || {}).state || "") } });
          });
      })).then(function(lists){
        TF.war = { at: Date.now(), ids: ids, names: w.names || {}, list: [].concat.apply([], lists) };
        return TF.war;
      });
    });
  }
  // the faction(s) we're at war with: their members only ever come through the War toggle (with LEAVE)
  function tfWarIds(){
    if (TF.warIdsAt && Date.now() - TF.warIdsAt < 60000) return Promise.resolve(TF.warIds || {});
    if (TF.war && Date.now() - TF.war.at < 60000){ TF.warIds = {}; TF.war.ids.forEach(function(f){ TF.warIds[f] = 1 }); TF.warIdsAt = TF.war.at; return Promise.resolve(TF.warIds) }
    return api({ op: "war", pin: "" }).then(function(w){ TF.warIds = {}; (w.ids || []).forEach(function(f){ TF.warIds[Number(f)] = 1 }); TF.warIdsAt = Date.now(); return TF.warIds })
      .catch(function(){ return TF.warIds || {} });
  }
  function tfWarMatches(type){
    var t = tfCfg()[type];
    return tfWar().then(function(W){
      var lv = W.list.filter(function(x){ return x.state === "Okay" && x.level >= t.minlvl && x.level <= t.maxlvl });
      if (!lv.length) return [];
      return tfFairFight(lv.map(function(x){ return x.id })).then(function(ffs){
        return lv.map(function(x, i){ return { player_id: x.id, name: x.name, level: x.level, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, war: { fid: x.fid, fname: W.names[String(x.fid)] || "" } } })
          .filter(function(x){ return x.fair_fight != null && x.fair_fight >= t.minff && x.fair_fight <= t.maxff });
      });
    });
  }
  // random player IDs, mixed into standard targets. IDs 2.0M-3.6M in 100k bands: it learns (on this device)
  // which bands give targets in your range and picks from those more often (15% stays evenly spread).
  var RB_MIN = 2000000, RB_SIZE = 100000, RB_N = 16;
  function rbLoad(){
    var w = null; try { w = JSON.parse(store("cw_randw") || "null") } catch(e){}
    if (w && w.length === RB_N) return w;
    w = []; for (var i = 0; i < RB_N; i++){ var lo = RB_MIN + i * RB_SIZE; w.push(lo >= 3000000 && lo < 3400000 ? [3, 4] : [1, 4]) } // [found, tried]: the old 3.0M-3.4M range starts ahead
    return w;
  }
  function rbBump(id, found, tried){
    var b = Math.floor((id - RB_MIN) / RB_SIZE); if (b < 0 || b >= RB_N) return;
    var w = rbLoad(); w[b][0] += found; w[b][1] += tried;
    if (w[b][1] > 400){ w[b][0] /= 2; w[b][1] /= 2 } // recent results count most
    try { store("cw_randw", JSON.stringify(w)) } catch(e){}
  }
  function rbId(w){
    var b;
    if (Math.random() < 0.15) b = Math.floor(Math.random() * RB_N);
    else {
      var tot = 0, i; for (i = 0; i < RB_N; i++) tot += w[i][0] / w[i][1];
      var r = Math.random() * tot; for (b = 0; b < RB_N - 1; b++){ r -= w[b][0] / w[b][1]; if (r <= 0) break }
    }
    return RB_MIN + b * RB_SIZE + Math.floor(Math.random() * RB_SIZE);
  }
  function tfRandomMake(type){
    var t = tfCfg()[type], ids = {}, n = 0, w = rbLoad();
    while (n < 100){ var id = rbId(w); if (!ids[id]){ ids[id] = 1; n++ } }
    var list = Object.keys(ids).map(Number);
    return tfFairFight(list).then(function(ffs){
      var out = list.map(function(id, i){ return { player_id: id, name: "Player " + id, level: 0, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, rand: true } })
        .filter(function(x){ return x.fair_fight != null && x.fair_fight >= t.minff && x.fair_fight <= t.maxff });
      var got = {}; out.forEach(function(x){ got[x.player_id] = 1 });
      var bands = {}; list.forEach(function(id){ var k = Math.floor((id - RB_MIN) / RB_SIZE); bands[k] = bands[k] || [0, 0]; bands[k][1]++; if (got[id]) bands[k][0]++ });
      var w2 = rbLoad(); Object.keys(bands).forEach(function(k){ var b = Number(k); if (b >= 0 && b < RB_N){ w2[b][0] += bands[k][0]; w2[b][1] += bands[k][1]; if (w2[b][1] > 400){ w2[b][0] /= 2; w2[b][1] /= 2 } } });
      try { store("cw_randw", JSON.stringify(w2)) } catch(e){}
      return out;
    });
  }
  function tfRandom(type){
    var p = TF.randPrep[type]; delete TF.randPrep[type];
    if (p && Date.now() - p.at < 60000) return p.list;
    return tfRandomMake(type);
  }
  // ---- players our faction beat recently (from the server, refreshed every 10 min with the finder lookup) ----
  // offered again once the "don't repeat" time has passed (15 min if that's off); status is checked as usual
  function tfEasyMatches(type){
    var c = tfCfg(), tt = c[type], L = (TF.easy && TF.easy.list) || [];
    var gap = (Number(c.repeatMin) || 15) * 60, nowS = Date.now() / 1000;
    var wi = TF.warIds || {};
    var cand = L.filter(function(x){ return x.p && nowS - x.t >= gap && !(c.nofac && x.f) && !wi[x.f] }).slice(-60);
    if (!cand.length) return Promise.resolve([]);
    return tfFairFight(cand.map(function(x){ return x.p })).then(function(ffs){
      return cand.map(function(x, i){ return { player_id: x.p, name: x.n, level: 0, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, chk: true, easy: true } })
        .filter(function(x){ return x.fair_fight != null && x.fair_fight >= tt.minff && x.fair_fight <= tt.maxff });
    });
  }
  // ---- whole factions in one call: Torn's member list has everyone's status (up to 100 people per call) ----
  // the factions with the most players we've beaten lately; each faction at most once every 2 minutes per device
  var OUR_FACS = [16057, 49431];
  function tfFacMatches(type){
    var c = tfCfg(), tt = c[type];
    if (c.nofac) return Promise.resolve([]);
    var L = (TF.easy && TF.easy.list) || [], cnt = {}, now = Date.now();
    var wi = TF.warIds || {};
    L.forEach(function(x){ if (x.f && OUR_FACS.indexOf(x.f) < 0 && !wi[x.f]) cnt[x.f] = (cnt[x.f] || 0) + 1 });
    var facs = Object.keys(cnt).map(Number).filter(function(f){ var x = TF.fac[f]; return !x || now - x.at > 120000 })
      .sort(function(a, b){ return cnt[b] - cnt[a] }).slice(0, 6);
    facs = tfShuffle(facs).slice(0, 2);
    if (!facs.length) return Promise.resolve([]);
    return Promise.all(facs.map(function(fid){
      TF.fac[fid] = { at: now };
      return fetch("https://api.torn.com/v2/faction/" + fid + "/members?striptags=true&key=" + encodeURIComponent(tornKey()) + "&comment=chainwatch-tf")
        .then(function(r){ return r.json() }).then(function(d){
          if (!d || d.error) return [];
          var ms = Array.isArray(d.members) ? d.members : Object.keys(d.members || {}).map(function(k){ var m = d.members[k]; if (m && !m.id) m.id = Number(k); return m });
          return ms.map(function(m){ return { id: Number(m.id) || 0, name: String(m.name || ""), level: Number(m.level) || 0, st: m.status || {}, la: m.last_action || {} } });
        }).catch(function(){ return [] });
    })).then(function(groups){
      var all = [].concat.apply([], groups), at = Date.now(), nowS = at / 1000, idays = Number(c.inactDays) || 14;
      var ok = all.filter(function(m){
        if (!m.id || m.level < tt.minlvl || m.level > tt.maxlvl) return false;
        if (m.st.state !== "Okay"){
          var left = Number(m.st.until || 0) - nowS; // due out of hospital soon: shared like any other check
          if (m.st.state === "Hospital" && left > 0 && left <= 300) TF.facSoon.push({ pid: m.id, name: m.name, level: m.level, outAt: Number(m.st.until), kind: "hosp" });
          return false;
        }
        if (c.offline && m.la.status && m.la.status !== "Offline") return false;
        if (c.inactive && m.la.timestamp && nowS - m.la.timestamp < idays * 86400) return false;
        return true;
      });
      if (!ok.length) return [];
      return tfFairFight(ok.map(function(m){ return m.id })).then(function(ffs){
        return ok.map(function(m, i){ return { player_id: m.id, name: m.name, level: m.level, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, last_action: Number(m.la.timestamp) || undefined, pre: { at: at, online: String(m.la.status || "") } } })
          .filter(function(x){ return x.fair_fight != null && x.fair_fight >= tt.minff && x.fair_fight <= tt.maxff });
      });
    }).catch(function(){ return [] });
  }
  // after a target is shown: get the next search's candidates ready (FF Scouter only -- no Torn calls, no status checks)
  function tfWarm(type){
    setTimeout(function(){
      if (TF.busy || !tfKey()) return;
      tfFetch(type).catch(function(){});
      tfEasyMatches(type).catch(function(){});
      if (!TF.randPrep[type]){ var p = tfRandomMake(type).catch(function(){ return [] }); TF.randPrep[type] = { at: Date.now(), list: p } }
    }, 1500);
  }
  function tfShuffle(a){ for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x } return a }
  function tfFind(type){
    if (TF.busy) return; TF.busy = true;
    var c = tfCfg(), btns = document.querySelectorAll(".tf-go button[data-t]");
    Array.prototype.forEach.call(btns, function(b){ b.disabled = true });
    var say = function(t){ $("tfRes").innerHTML = '<div class="tf-res"><div class="meta">' + t + '</div></div>' };
    say("Finding a target…");
    var done = function(){ TF.busy = false; Array.prototype.forEach.call(btns, function(b){ b.disabled = false }) };
    var now = Date.now();
    var repMs = (Number(c.repeatMin) || 15) * 60000; // "don't repeat" window chosen with the cog
    Object.keys(TF.used).forEach(function(id){ if (now - TF.used[id] > 24*3600000) delete TF.used[id] });
    var fresh = function(t){ var u = TF.used[t.player_id]; return !c.fresh || !u || now - u > repMs };
    var bountyNote = "", ffErr = null;
    // Keeps looking by itself: if nobody in a batch is attackable, it fetches a fresh batch
    // (up to 4 rounds) before giving up. People already checked aren't checked again.
    var MAXR = 4, tried = {}, checkedAll = 0, soonOut = [];
    var endless = function(){ return !!S.isAdmin && $("tfInf").checked }; // admin "search until found" (read live, so switching it off stops)
    var more = function(n){ return n < MAXR || endless() };
    var wasEndless = endless();
    var stopped = function(n){ return (wasEndless && !endless()) || (n > MAXR && !endless()) }; // switched off mid-search: stop now
    var lookMsg = function(n){ return endless() ? "Searching until a target is found… (search " + n + ", " + checkedAll + " checked) · switch off \u201cSearch until found\u201d to stop" : "Still looking for an attackable target… (search " + n + " of " + MAXR + ")" };
    var wait = function(ms){ return new Promise(function(res){ setTimeout(res, ms) }) };
    var round = function(n){
    var rp = c.retal !== false ? tfRetals(true).then(function(){ return tfRetMatches(type, 8)    }).catch(function(){ return [] }) : Promise.resolve([]);
    var sp = c.shit !== false ? tfShitMatches(type).catch(function(){ return [] }) : Promise.resolve([]);
    var bp = c.bounty !== false ? tfBountyMatches(type).catch(function(e){ bountyNote = "Bounties skipped: " + e.message; return [] }) : Promise.resolve([]);
    var fp = tfFetch(type).catch(function(e){ ffErr = e; return [] }).then(function(list){
      return tfRandom(type).then(function(rl){ return list.concat(rl) }).catch(function(){ return list }); // + random IDs in range
    });
    // one lookup: held by someone else, just hospitalised by us, and the coming-out-soon list
    var soonList = [];
    var cp = api({ op: "finderState", cid: cid(), pin: "", easyAt: TF.easy ? TF.easy.at : 0 }).then(function(j){
      soonList = j.soon || [];
      if (j.easy){ TF.easy = j.easy; try { store("cw_tfeasy", JSON.stringify(j.easy)) } catch(e){} }
      return (j.held || []).concat(j.hosp || []);
    }).catch(function(){ return [] });
    var wp = c.war !== false ? tfWarMatches(type).catch(function(){ return [] }) : Promise.resolve([]);
    var mp = tfMineMatches(type).catch(function(){ return [] });
    // players we beat earlier, and whole factions checked in one call each (needs the beaten list first)
    var ep = Promise.all([cp, tfWarIds()]).then(function(){ return Promise.all([tfFacMatches(type), tfEasyMatches(type)]) }).catch(function(){ return [[], []] });
    return Promise.all([rp, sp, bp, fp, cp, wp, mp, ep]).then(function(r){
      soonOut.push.apply(soonOut, TF.facSoon.splice(0));
      var tt = c[type], nowS0 = Date.now() / 1000;
      var sl = soonList.filter(function(x){ return x.level >= tt.minlvl && x.level <= tt.maxlvl && !tried[x.pid] && fresh({ player_id: x.pid }) && x.outAt <= nowS0 + 30 });
      if (!sl.length) return [r, []];
      return tfFairFight(sl.map(function(x){ return x.pid })).catch(function(){ return sl.map(function(){ return { ff: null } }) }).then(function(ffs){
        return [r, sl.map(function(x, i){ return { player_id: x.pid, name: x.name, level: x.level, fair_fight: ffs[i].ff, bs_estimate_human: ffs[i].est, soon: x, chk: true } })
          .filter(function(x){ return x.fair_fight != null && x.fair_fight >= tt.minff && x.fair_fight <= tt.maxff })];
      });
    }).then(function(rs){
      var r = rs[0], soonGroup = rs[1];
      var taken = {}; r[4].forEach(function(p){ taken[p] = 1 });
      var groups = { mine: tfShuffle(r[6].filter(fresh)).slice(0, 8), war: tfShuffle(r[5].filter(fresh)).slice(0, 6), retal: r[0].filter(fresh), shit: tfShuffle(r[1].filter(fresh)).slice(0, 6), bounty: r[2].filter(fresh).slice(0, 6) };
      var seen = {}, order = [];
      tfOrder(c).forEach(function(k){
        if (!tfOn(c, k)) return;
        var g = groups[k];
        if (k === "ff") soonGroup.forEach(function(t){ if (!seen[t.player_id]){ seen[t.player_id] = 1; order.push(t) } }); // just out / just landed go first
        if (k === "ff"){
          // whole-faction finds first (already confirmed Okay, so no extra check), then everything else mixed
          tfShuffle(r[7][0].filter(fresh)).forEach(function(t){ if (!seen[t.player_id]){ seen[t.player_id] = 1; order.push(t) } });
          var rest = r[3].concat(r[7][1]).filter(function(t){ return !seen[t.player_id] }), pool = rest.filter(fresh);
          // with "don't repeat" on, people seen inside the window are never offered (it fetches a new batch instead)
          g = c.fresh ? tfShuffle(pool) : tfShuffle(rest);
        }
        g.forEach(function(t){ if (!seen[t.player_id]){ seen[t.player_id] = 1; order.push(t) } });
      });
      var all = order.length;
      order = order.filter(function(t){ return !taken[t.player_id] && !tried[t.player_id] });
      if (!order.length){
        if (stopped(n)) return { t: null, checked: checkedAll, stopped: true };
        if (more(n)){ say(lookMsg(n + 1)); TF.cache = {}; return wait(endless() ? 3000 : 1500).then(function(){ return round(n + 1) }) }
        if (all || checkedAll) throw new Error("No attackable targets found right now. Try again in a moment, or widen the settings.");
        throw new Error(ffErr ? ffErr.message : "No targets match these settings. Widen the fair fight or level range.");
      }
      var specials = order.filter(function(t){ return t.retal || t.shit || t.bounty || t.war || t.mine }).length;
      var idx = 0, limit = Math.min(order.length, specials + 9), BATCH = 3;
      // one target's status: { ok, res } attackable / { skip } / { limited } (Torn refused: too many requests)
      var check = function(t){
        if (t.pre && Date.now() - t.pre.at < 30000) return Promise.resolve({ ok: true, res: { t: t, okay: true, offline: c.offline ? t.pre.online : "" } }); // seen Okay in its faction list just now
        if (!c.verify && !c.offline && !t.rand && !t.chk) return Promise.resolve({ ok: true, res: { t: t } });
        var std = !(t.retal || t.shit || t.bounty || t.war || t.mine); // standard target: all the settings apply
        return tfStatusAny(t.player_id).then(function(st){ // full profile (same one call): faction and last action included; shared key if yours is limited
          if (!st.ok) return /too many/i.test(st.err) ? { limited: true } : { skip: true };
          if (c.offline && st.online && st.online !== "Offline") return { skip: true }; // online or idle: skip (not marked as seen)
          if (!t.war && st.fac && (TF.warIds || {})[st.fac]) return { skip: true }; // war faction: only via the War toggle
          if (std){ // now we know who they are: apply the level / factionless / inactive settings
            if (st.name) t.name = st.name;
            if (st.level) t.level = st.level;
            var rt = c[type], idays = Number(c.inactDays) || 14;
            if (st.level && (st.level < rt.minlvl || st.level > rt.maxlvl)) return { skip: true };
            if (c.nofac && st.fac) return { skip: true };
            if (c.inactive && (!st.laTs || Date.now() / 1000 - st.laTs < idays * 86400)) return { skip: true };
            if (st.laTs) t.last_action = st.laTs;
          }
          if (st.state === "Okay"){ if (t.rand) rbBump(t.player_id, 2, 0); return { ok: true, res: { t: t, okay: true, offline: c.offline ? st.online : "", shared: !!st.shared } } }
          // due out of hospital / landing back in Torn within 5 min: share it so the next search tries them first
          var left = st.until - Date.now() / 1000;
          if (st.until && left > 0 && left <= 300 && (st.state === "Hospital" || (st.state === "Traveling" && /returning to torn/i.test(st.desc))))
            soonOut.push({ pid: t.player_id, name: t.name, level: t.level, outAt: st.until, kind: st.state === "Hospital" ? "hosp" : "travel" });
          TF.used[t.player_id] = Date.now(); tfUsedSave();
          return { skip: true };
        });
      };
      var limRetried = false;
      var next = function(){
        if (stopped(n)) return { t: null, checked: checkedAll, stopped: true };
        if (idx >= limit){
          if (more(n)){ say(lookMsg(n + 1)); TF.cache = {}; return wait(endless() ? 3000 : 800).then(function(){ return round(n + 1) }) }
          return { t: null, checked: checkedAll };
        }
        // up to 3 at once, in priority order; the first attackable one (in that order) is the one shown
        // (one that needs no check -- already confirmed in a faction list -- ends the batch, so nothing is checked for nothing)
        var free = function(x){ return (x.pre && Date.now() - x.pre.at < 30000) || (!c.verify && !c.offline && !x.rand && !x.chk) };
        var batch = [];
        while (batch.length < BATCH && idx < limit){ var t0 = order[idx++]; tried[t0.player_id] = 1; checkedAll++; batch.push(t0); if (free(t0)) break }
        var t = batch[0];
        say((t.mine ? "📒 Checking your target " : t.war ? "🏴 Checking war target " : t.retal ? "⚔ Checking retal " : t.shit ? "😈 Checking shit-lister " : t.bounty ? "💰 Checking bounty target " : "Checking ") + esc(t.name) + (batch.length > 1 ? " and " + (batch.length - 1) + " more" : "") + " (" + idx + "/" + limit + ")…");
        return Promise.all(batch.map(check)).then(function(rs){
          // hold a target for 1 minute only once it's confirmed attackable, so nobody else is handed the same one
          // (people found in hospital aren't held, so a just-released target stays free for whoever searches next)
          var oks = []; rs.forEach(function(x){ if (x.ok) oks.push(x.res) });
          var tryHold = function(k){
            if (k >= oks.length) return afterBatch();
            var res = oks[k];
            var bkd = new Date().toISOString().slice(0, 10), bk = store("cw_bkrep") !== bkd + (tfKey2() ? "1" : "0") ? { has: !!tfKey2(), pid: S.member ? S.member.pid : 0 } : undefined; // once a day: yes/no only
            return api({ op: "claim", pid: res.t.player_id, cid: cid(), pin: "", soon: soonOut.splice(0), bk: bk }).then(function(cl){ if (bk) store("cw_bkrep", bkd + (bk.has ? "1" : "0")); return cl }).catch(function(){ return { ok: true } })
              .then(function(cl){ return cl.ok ? res : tryHold(k + 1) });
          };
          var afterBatch = function(){
            var lim = batch.filter(function(x, i){ return rs[i].limited });
            if (!lim.length) return next();
            // couldn't confirm: never show an unchecked target. Torn busy? wait and try those again once.
            if (limRetried) return { t: null, checked: checkedAll, limited: true };
            limRetried = true; lim.forEach(function(x){ delete tried[x.player_id] });
            order.splice.apply(order, [idx, 0].concat(lim)); limit += lim.length;
            say("Torn is limiting your API key (too many requests). Waiting a few seconds…");
            return wait(10000).then(next);
          };
          return tryHold(0);
        });
      };
      return next();
    });
    };
    round(1).then(function(r){
      if (soonOut.length) api({ op: "claim", pid: 0, cid: cid(), pin: "", soon: soonOut.splice(0) }).catch(function(){});
      done();
      if (!r.t && r.limited){ say('<span style="color:#fca5a5">Torn is limiting your API key right now (too many requests), so targets can\u2019t be checked. Try again in a minute.</span>'); return }
      if (!r.t && r.stopped){ say('Search stopped after checking ' + r.checked + ' targets.'); return }
      if (!r.t){ say('<span style="color:#fca5a5">Searched ' + MAXR + ' times and checked ' + r.checked + ' targets, but none were attackable right now. Try again in a minute, or widen the settings.</span>'); return }
      var t = r.t; TF.used[t.player_id] = Date.now(); tfUsedSave(); tfWarm(type);
      var url = "https://www.torn.com/page.php?sid=attack&user2ID=" + t.player_id;
      var bits = [];
      if (t.level) bits.push("Level " + t.level);
      bits.push(t.fair_fight != null ? "FF " + Number(t.fair_fight).toFixed(2) : "FF unknown");
      if (t.bs_estimate_human) bits.push("~" + esc(t.bs_estimate_human) + " stats");
      if (t.last_action) bits.push("last action " + esc(typeof t.last_action === "number" ? ago(t.last_action) : t.last_action));
      var rb = t.retal ? '<div class="rtb">⚔ Retal · they hit ' + esc(t.retal.dName || "one of us") + ' · <span class="rt-left" data-end="' + (t.retal.ended + 300) + '">' + mss(t.retal.ended + 300 - rnow()) + '</span> left</div> ' : '';
      var sb = t.shit ? '<div class="shitb">😈 On the shit list' + (t.shit.reason ? ' <small>· ' + esc(t.shit.reason) + '</small>' : '') + '</div> ' : '';
      var bt = t.bounty ? '<div class="bty">💰 ' + money(t.bounty.reward) + ' bounty' + (t.bounty.count > 1 ? ' <small>(+' + (t.bounty.count - 1) + ' more listed)</small>' : '') + (t.bounty.reason ? ' <small>· ' + esc(t.bounty.reason).slice(0, 80) + '</small>' : '') + '</div>' : '';
      var wb = t.war ? '<div class="warb">🏴 WAR TARGET · ' + esc(t.war.fname || "the faction we're at war with") + ' · offline</div> ' : '';
      // what kind of hit this is, and what to do at the end of the fight
      var kind = t.mine && !t.war && !t.retal ? ["mine", "📒 MY HIT LIST", "YOUR CALL"] : t.war ? ["war", "🏴 WAR TARGET", "LEAVE"] : t.retal ? ["ret", "⚔ RETAL", "HOSPITALISE"] : t.shit ? ["shit", "😈 SHIT LIST", "HOSPITALISE"] : t.bounty ? ["bty", "💰 BOUNTY", "HOSPITALISE"] : ["std", "🎯 STANDARD", "LEAVE / MUG"];
      var htype = '<div class="htype ht-' + kind[0] + '"><span>' + kind[1] + '</span><small>' + kind[2] + '</small></div>';
      var todo = t.war ? '<div class="todo l">👉 LEAVE them (don\u2019t hospitalise)</div>'
        : t.mine ? '<div class="todo m">👉 Your target' + (t.mine.note ? ': ' + esc(t.mine.note) : '') + '</div>'
        : (t.retal || t.shit || t.bounty) ? '<div class="todo h">👉 HOSPITALISE them' + (t.bounty ? ' (to claim the bounty)' : '') + '</div>'
        : '<div class="todo m">👉 LEAVE or MUG them</div>';
      if (r.offline) bits.push("offline");
      if (t.soon) bits.push('<span style="color:#5eead4">⏱ just ' + (t.soon.kind === "travel" ? "landed back in Torn" : "out of hospital") + '</span>');
      if (t.easy) bits.push('<span style="color:#93c5fd">↺ beaten by us earlier</span>');
      var note = !t.bounty && !t.shit && !t.retal && !t.war && c.bounty !== false && bountyNote ? '<div class="meta">' + esc(bountyNote) + '</div>' : '';
      $("tfRes").innerHTML = '<div class="tf-res">' + htype
        + '<div class="nm"><a href="https://www.torn.com/profiles.php?XID=' + t.player_id + '" target="_blank" rel="noopener">' + esc(t.name) + '</a> <span class="small muted">[' + t.player_id + ']</span></div>'
        + wb + rb + sb + bt
        + '<div class="meta">' + bits.join(" · ") + '</div>'
        + '<div class="meta">' + (r.okay ? '<span style="color:var(--good)">✓ Okay, attackable now</span>' + (r.shared ? ' <span class="muted">· checked with a 🤝 shared key</span>' : '') : r.warn ? '<span style="color:var(--warn)">' + esc(r.warn) + '</span>' : 'Status not checked') + '</div>'
        + note + todo
        + '<div class="acts"><a class="atk" href="' + url + '" target="_blank" rel="noopener">⚔ Attack</a><button data-t="' + type + '" class="tfNext">Next 🔥</button></div>'
        + '</div>';
    }).catch(function(e){ done(); say('<span style="color:#fca5a5">' + esc(e.message || "Couldn't reach FF Scouter") + '</span>') });
  }

  // ---------------------------------------------------------------------
  // Chain Pal: sidebar widget + settings panel
  // ---------------------------------------------------------------------
  var CP_VERSION = "1.0.3";
  var SIDE_HTML = '<div id="cpalSide" class="cpal cp-side">'
    + '<div class="cp-tm" id="cpTm"><div class="cp-ch"><span id="cpCount">Chain</span><button id="cpSnd" class="cp-snd" title="Alert sound on/off">🔕</button></div>'
    + '<div class="cp-time" id="cpTime">--:--</div><div class="cp-src"><span id="cpSrc"></span><span id="cpStale" class="hide">\u26a0 Torn\u2019s API is behind \u2013 use the in-game timer</span></div></div>'
    + '<div id="cpSetup" class="hide"><div class="tf-go cp-go"><button class="good" id="cpSetupBtn">🔑 Set up Chain Pal</button></div></div>'
    + '<div id="tfMain" class="hide">' + "<div id=\"tfRetBox\" class=\"tf-retb hide\"></div>" + ''
    + '<div class="tf-go cp-go"><button class="good" data-t="good">Find a Target 🎯</button><button class="cog" id="cpCog" title="Chain Pal settings" aria-label="Chain Pal settings">⚙</button></div>'
    + '<div id="tfRes"></div></div>'
    + '</div>';
  var PANEL_HTML = '<div id="cpalOv" class="cpal cp-ov hide"><div class="cp-card" role="dialog" aria-label="Chain Pal settings">'
    + '<div class="cp-hd"><b>🔗 Chain Pal</b><span class="small muted">v' + CP_VERSION + '</span><button id="cpClose" aria-label="Close">✕</button></div>'
    + '<div class="seg cp-tabs"><button data-cptab="tgt" class="act">🎯 Targets</button><button data-cptab="al">⏰ Alerts</button><button data-cptab="key">🔑 Keys</button></div>'
    + '<div id="cpTabTgt">'
    + '<div id="cpNoKey" class="small hide" style="margin:4px 0 10px;color:#fde68a">Add your FF Scouter key in <b>\uD83D\uDD11 Keys</b> first \u2013 then your target settings appear here.</div>'
    + '<div class="cp-sub"><span class="small"><b>Priority order</b> · which kind of target comes first</span><button class="cog" id="tfCog" title="Priority order" aria-label="Priority order">⚙</button></div>'
    + "<div id=\"tfOrderBox\" class=\"tf-box hide\">\n        <div class=\"small\" style=\"font-weight:700;margin-bottom:4px\">Priority order</div>\n        <div id=\"tfOrder\"></div>\n        <div class=\"small muted\" style=\"margin-top:6px\">The finder offers targets from the top source first. Sources switched off below are skipped.</div>\n      </div>" + "<div id=\"tfSettings\" class=\"tf-box\">\n        <div class=\"tf-grid\"><span>Fair fight</span><input type=\"number\" step=\"0.05\" min=\"1\" max=\"3\" id=\"tfGminff\"><span>→</span><input type=\"number\" step=\"0.05\" min=\"1\" max=\"3\" id=\"tfGmaxff\">\n        <span>Level</span><input type=\"number\" min=\"1\" max=\"100\" id=\"tfGminlvl\"><span>→</span><input type=\"number\" min=\"1\" max=\"100\" id=\"tfGmaxlvl\"></div>\n        <div class=\"tf-cnt\" id=\"tfGcnt\"></div>\n        <div class=\"tf-sws\">\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfRetal\"><span class=\"tr\"></span><span class=\"tx\">⚔ Retals first <span class=\"act-h\">HOSPITALISE</span><small>People who hit one of us in the last 5 minutes</small></span></label>\n          <div class=\"tf-cnt\" id=\"tfRcnt\"></div>\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfWar\"><span class=\"tr\"></span><span class=\"tx\">🏴 War targets <span class=\"act-l\">LEAVE</span><small>Offline members of the faction we're at war with</small></span></label>\n          <div class=\"tf-cnt\" id=\"tfWcnt\"></div>\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfMine\"><span class=\"tr\"></span><span class=\"tx\">📒 My hit list first<small>Your own targets (only on this device)</small></span></label>\n          <div class=\"tf-cnt\" id=\"tfMcnt\"></div>\n          <label class=\"sw\" id=\"tfShitSw\"><input type=\"checkbox\" id=\"tfShit\"><span class=\"tr\"></span><span class=\"tx\">😈 Shit list first <span class=\"act-h\">HOSPITALISE</span></span></label>\n          <div class=\"tf-cnt\" id=\"tfScnt\"></div>\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfBounty\"><span class=\"tr\"></span><span class=\"tx\">💰 Bounties first <span class=\"act-h\">HOSPITALISE</span></span></label>\n          <div class=\"tf-cnt\" id=\"tfBcnt\"></div>\n          <div class=\"tf-cnt\" id=\"tfBminBox\">Minimum bounty <input type=\"text\" inputmode=\"decimal\" id=\"tfBtyMin\" placeholder=\"any\" autocomplete=\"off\" style=\"width:8.5em;display:inline-block;margin:0 0 0 6px;padding:4px 8px\"> <span class=\"muted\">e.g. 500k or 1m</span></div>\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfVerify\"><span class=\"tr\"></span><span class=\"tx\">Check they're attackable<small>Skips hospital, jail and travelling</small></span></label>\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfInactive\"><span class=\"tr\"></span><span class=\"tx\">Inactive only<small id=\"tfInactTxt\">14+ days inactive</small></span><button class=\"cogm\" id=\"tfInactCog\" aria-label=\"Inactivity setting\">⚙</button></label>\n          <div id=\"tfInactBox\" class=\"tf-cnt hide\">Inactive for at least <select id=\"tfInactDays\"><option value=\"1\">1 day</option><option value=\"3\">3 days</option><option value=\"7\">7 days</option><option value=\"14\">14 days</option><option value=\"30\">30 days</option><option value=\"90\">90 days</option><option value=\"180\">6 months</option><option value=\"365\">1 year</option></select></div>\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfOffline\"><span class=\"tr\"></span><span class=\"tx\">Offline only<small>Skips anyone online or idle right now (uses the attackable check)</small></span></label>\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfNofac\"><span class=\"tr\"></span><span class=\"tx\">Factionless only</span></label>\n          <label class=\"sw hide\" id=\"tfInfSw\"><input type=\"checkbox\" id=\"tfInf\"><span class=\"tr\"></span><span class=\"tx\">🔁 Search until a target is found <span class=\"act-l\">ADMIN</span><small>Keeps fetching new batches until someone is attackable. Switch off to stop. Each check uses one Torn call on your key.</small></span></label>\n          <label class=\"sw\"><input type=\"checkbox\" id=\"tfFresh\"><span class=\"tr\"></span><span class=\"tx\">Don't repeat targets<small id=\"tfFreshTxt\">Not the same person twice in 15 min</small></span><button class=\"cogm\" id=\"tfFreshCog\" aria-label=\"Repeat time setting\">⚙</button></label>\n          <div id=\"tfFreshBox\" class=\"tf-cnt hide\">Don't show the same person again for <select id=\"tfFreshMin\"><option value=\"5\">5 minutes</option><option value=\"10\">10 minutes</option><option value=\"15\">15 minutes</option><option value=\"30\">30 minutes</option><option value=\"60\">1 hour</option><option value=\"120\">2 hours</option><option value=\"360\">6 hours</option><option value=\"1440\">24 hours</option></select></div>\n        </div>\n        <details class=\"k2 hide\" id=\"dnBox\"><summary class=\"small\" style=\"font-weight:700;cursor:pointer\">🤝 Shared key (helps the target finder)</summary>\n          <div id=\"dnBody\" class=\"small\" style=\"margin-top:8px;line-height:1.5\"></div>\n          <div id=\"dnBoxMsg\"></div>\n        </details>\n        <details class=\"k2\" id=\"tfK2Box\"><summary class=\"small\" style=\"font-weight:700;cursor:pointer\">🔑 Torn key for bounties (optional)</summary>\n          <div class=\"lvl\" style=\"margin-top:8px\">Needs a <b>Public</b> key or higher (Public, Limited or Full all work). A <b>Custom</b> key only works if it was made with <b>Torn → Bounties</b> and <b>User → Basic</b> ticked. Make one in Torn under Settings → API Keys. You don't need to register this one with FF Scouter.</div>\n          <div class=\"small muted\" style=\"margin-bottom:8px\">Used only for Torn's bounty list and the \"attackable\" checks, so your FF Scouter key is only ever used with FF Scouter. Leave it empty to use your FF Scouter key for these too. It's saved on this device only.</div>\n          <div id=\"tfK2Set\" class=\"row2\"><input id=\"tfK2\" type=\"password\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\" placeholder=\"Paste a Public key\"><button class=\"btn\" id=\"tfK2Save\">Save</button></div>\n          <div id=\"tfK2Have\" class=\"small muted hide\">Bounty key saved · <span id=\"tfK2Show\"></span> · <a href=\"#\" id=\"tfK2Del\" style=\"color:#fca5a5\">Remove</a></div>\n          <div id=\"tfK2Pool\" class=\"small hide\" style=\"color:var(--good);margin-top:6px\">✓ Bounties already use the Public key you shared for the target finder, so you don\\u2019t need to add one here.</div>\n          <div id=\"tfK2Msg\"></div>\n        </details>\n      </div>" + "<div class=\"card\" id=\"myCard\">\n    <button class=\"sl-head\" id=\"myToggle\" aria-expanded=\"false\"><span>📒 My hit list <span class=\"sl-n\" id=\"myCount\"></span></span><span class=\"sl-ch\">▸</span></button>\n    <div id=\"myBody\" class=\"hide\">\n      <div class=\"small muted\" style=\"margin:8px 0\">Your own targets. Saved on this device only and never shared. With \"My hit list first\" on, the finder offers them in the order you set with the ⚙, if they're in your fair fight and level range.</div>\n      <input id=\"myIn\" placeholder=\"Profile link or ID, e.g. torn.com/profiles.php?XID=123456\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\">\n      <input id=\"myWhy\" placeholder=\"Note (optional)\" maxlength=\"140\" style=\"margin-top:8px\">\n      <button class=\"btn\" id=\"myAddBtn\">Add to my list</button>\n      <div id=\"myMsg\"></div>\n      <div id=\"myList\" style=\"margin-top:10px\"></div>\n    </div>\n  </div>" + "<div class=\"card\" id=\"tfShitCard\">\n    <button class=\"sl-head\" id=\"shitToggle\" aria-expanded=\"false\"><span>😈 Shit list <span class=\"sl-n\" id=\"shitCount\"></span></span><span class=\"sl-ch\">▸</span></button>\n    <div id=\"shitBody\" class=\"hide\">\n      <div class=\"small muted\" style=\"margin:8px 0\">People who've wronged the faction. With \"Shit list first\" on, the finder offers them before anyone else, as long as they fit your fair fight and level range. <span id=\"shitWho\"></span></div>\n      <div id=\"shitAddBox\" class=\"hide\">\n        <input id=\"shitIn\" placeholder=\"Profile link or ID, e.g. torn.com/profiles.php?XID=123456\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\">\n        <input id=\"shitWhy\" placeholder=\"Reason (optional)\" maxlength=\"140\" style=\"margin-top:8px\">\n        <button class=\"btn\" id=\"shitAddBtn\">Add to the list</button>\n        <div id=\"shitMsg\"></div>\n      </div>\n      <div id=\"shitList\" style=\"margin-top:10px\"></div>\n    </div>\n  </div>"
    + '</div>'
    + '<div id="cpTabAl" class="hide">'
    + '<div class="cp-sub"><button id="ctSnd">🔕 Sound off</button><button id="ctTest">▶ Test all</button></div>'
    + '<label class="vol cp-vol" title="Alarm volume">🔉 Volume <input type="range" id="ctVol" min="0" max="100" step="5" aria-label="Alarm volume"><span id="ctVolV"></span></label>'
    + '<div class="small muted" style="margin:8px 0">Up to 5 alerts. Each plays once as the chain timer drops past its time (3:30 down to 0:30), and re-arms after a hit. The timer comes straight from Torn\u2019s own chain bar, and alerts are booked ahead so they still play on time when Torn is in a background tab.</div>'
    + '<div id="ctAlRows"></div>'
    + '<label class="sw" style="margin-top:10px"><input type="checkbox" id="cpBig"><span class="tr"></span><span class="tx">Big timer in the sidebar<small>Off = a smaller timer line</small></span></label>'
    + '<label class="sw" style="margin-top:10px"><input type="checkbox" id="cpWakeSw"><span class="tr"></span><span class="tx">\uD83D\uDD06 Keep the screen on<small>Stops your phone or PC sleeping while Torn is showing, so the timer and alerts keep going. Uses more battery.</small></span></label><div class="small muted" style="margin:2px 0 4px;line-height:1.4">\u26a0 Only while this page is on screen: switching tab or app, minimising, or locking your phone yourself stops it (it comes back when you return). Works in Chrome, Edge and Samsung Internet, and Safari on iOS 16.4+. Not in Firefox, and may not work in Torn PDA or older browsers.</div><div id="cpWakeMsg" class="small" style="color:#fde68a"></div>'
    + '<label class="sw" style="margin-top:10px"><input type="checkbox" id="cpPopSw"><span class="tr"></span><span class="tx">Open attacks in a pop-out window<small>Floats over the page with a red \u2715 to close it, so you stay where you were. Off = opens normally.</small></span></label>'
    + '</div>'
    + '<div id="cpTabKey" class="hide">'
    + "<div id=\"tfKeyBox\">\n      <p class=\"small muted\" style=\"margin:0 0 8px\">Uses <b>FF Scouter</b> to find targets. You need your own Torn API key, registered once at <a href=\"https://ffscouter.com\" target=\"_blank\" rel=\"noopener\" style=\"color:var(--accent)\">ffscouter.com</a>. Your key is saved only on this device. It's never sent to the Chain Watch server, only to FF Scouter and Torn.</p>\n      <label>Your Torn API key (16 characters)</label>\n      <input id=\"tfKey\" type=\"password\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\" placeholder=\"Paste your API key\">\n      <button class=\"btn\" id=\"tfKeySave\">Save key</button>\n      <div id=\"tfKeyMsg\"></div>\n    </div>"
    + '<div id="tfKeyHave" class="small muted hide" style="margin-top:8px">FF Scouter key saved · <span id="tfKeyShow"></span> · <a href="#" id="tfKeyChange">Change</a> · <a href="#" id="tfKeyDel" style="color:#fca5a5">Remove</a></div>'
    + '<div id="cpMe" class="small muted" style="margin-top:8px"></div>'
    + '<div class="small muted" style="margin-top:10px">Your keys stay in your userscript storage. They\u2019re only sent to Torn and FF Scouter, never to the Chain Watch server. The bounty / status-check key lives in Targets → 🔑 Torn key for bounties.</div>'
    + '</div>'
    + '</div></div>';

  // ---- where it goes: right under Torn's chain bar in the sidebar (or a floating box if there's no sidebar) ----
  // PC: right under the sidebar's chain bar. Mobile / Torn PDA (no sidebar column): under the whole top
  // area (menu, energy / nerve / happy / life / chain and money / points rows), not on top of it.
  function cpAnchor(){
    var bc = document.getElementById("barChain");
    if (bc && bc.offsetWidth > 100 && window.innerWidth >= 1000){ var a = bc; while (a.parentElement && a.parentElement.children.length === 1 && a.parentElement.id !== "sidebar") a = a.parentElement; return { after: a } }
    var sb = document.getElementById("sidebarroot") || document.getElementById("sidebar");
    if (sb) return { after: sb };
    var hd = document.getElementById("topRoot") || document.querySelector("header, [class*='header-wrapper']");
    if (hd) return { after: hd };
    return null;
  }
  function cpPlace(){
    var side = $("cpalSide");
    if (!side){ var w = document.createElement("div"); w.innerHTML = SIDE_HTML; side = w.firstChild }
    var at = cpAnchor();
    if (at && at.after){ if (side.previousElementSibling !== at.after) at.after.insertAdjacentElement("afterend", side); side.classList.remove("cp-float") }
    else if (at && at.into){ if (side.parentElement !== at.into) at.into.insertBefore(side, at.into.firstChild); side.classList.remove("cp-float") }
    else { if (side.parentElement !== document.body) document.body.appendChild(side); side.classList.add("cp-float") }
    return side;
  }

  // ---- Torn's own chain clock and count, read off the page (no API calls; always current) ----
  function readClock(){
    var sels = ['#barChain [class*="bar-timeleft"]', '[class*="chain-bar"] [class*="bar-timeleft"]', '[class*="chain-box"] [class*="timeleft"]'];
    for (var i = 0; i < sels.length; i++){
      var els; try { els = document.querySelectorAll(sels[i]) } catch(e){ continue }
      for (var j = 0; j < els.length; j++){
        if (els[j].closest(".cpal")) continue;
        var m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(els[j].textContent || "");
        if (m) return Number(m[1]) * 60 + Number(m[2]);
      }
    }
    return null;
  }
  function readCount(){
    var sels = ['#barChain [class*="bar-value"]', '[class*="chain-bar"] [class*="bar-value"]'];
    for (var i = 0; i < sels.length; i++){
      var els; try { els = document.querySelectorAll(sels[i]) } catch(e){ continue }
      for (var j = 0; j < els.length; j++){
        if (els[j].closest(".cpal")) continue;
        var t = (els[j].textContent || "").trim(), m = /^([\d,.]+)\s*(?:\/\s*([\d,.]+k?))?/i.exec(t);
        if (m) return { n: Number(m[1].replace(/[,.]/g, "")), max: m[2] || "" };
      }
    }
    return null;
  }

  // ---- alerts, booked ahead on the audio clock (keeps time in background tabs) ----
  var SND_OFF = 0, SND_BUS = null;
  function sndDest(a){ return SND_BUS || a.destination }
  function playAt(k, delay){ // a sound starting `delay` seconds from now, on its own bus so it can be cancelled
    var a = audio(); if (!a) return null;
    var bus = a.createGain(); bus.connect(a.destination);
    SND_BUS = bus; SND_OFF = Math.max(0, delay);
    try { (SOUNDS[k] || SOUNDS.long)[1]() } catch(e){}
    SND_BUS = null; SND_OFF = 0;
    return bus;
  }
  function cancelBus(b){ try { b.disconnect() } catch(e){} }
  var CK = { exp: null, count: null, booked: [], armed: null, seenAt: 0 };
  function bookAlerts(left){
    var AL = alerts(), a = AC && AC.state === "running" ? AC : null;
    if (!CK.armed || CK.armed.length !== AL.length) CK.armed = AL.map(function(){ return false });
    AL.forEach(function(x, i){ if (x.at && left > x.at + 2) CK.armed[i] = true });
    CK.booked.forEach(function(b){ if (b) cancelBus(b.bus) }); CK.booked = [];
    if (!S.sound || !a || left == null || left <= 0) return;
    // one sound per moment: if several alerts share a time, the lowest one plays
    AL.forEach(function(x, i){
      if (!x.at || !CK.armed[i]) return;
      var delay = left - x.at;
      if (delay < -1) return;
      CK.booked.push({ i: i, at: x.at, bus: playAt(x.snd, Math.max(0, delay)), when: Date.now() + Math.max(0, delay) * 1000 });
    });
  }
  // ---- when Torn shows no countdown on the page (mobile / Torn PDA): Chain Watch's timer (Glory factions),
  // else Torn's API with your own key. Checked every 5s near the alert times, up to 30s otherwise.
  S.fb = null; S.fbNext = 0; S.fbBusy = false;
  function fbPoll(){
    if (!S.identDone || S.fbBusy || Date.now() < S.fbNext) return; // wait until we know your faction
    S.fbBusy = true;
    var done = function(){ S.fbBusy = false; var l = S.fb && S.fb.exp ? (S.fb.exp - Date.now()) / 1000 : null; S.fbNext = Date.now() + (l != null && l > 0 && l <= AL_MAX + 20 ? 5000 : l != null && l > 0 ? Math.min(30000, Math.max(5000, (l - AL_MAX - 15) * 1000)) : 30000) };
    var p;
    if (CP_FACTIONS.indexOf(S.f) >= 0) p = api({ op: "chain", pid: S.member ? S.member.pid : 0 }).then(function(j){
      var c = j.chain || {}, sk = (j.now || Date.now() / 1000) - Date.now() / 1000;
      var stale = c.staleSince && c.src !== "page" && j.now - c.staleSince >= 20;
      S.fb = { n: c.current || 0, exp: c.expiry && c.current ? (c.expiry - sk) * 1000 : 0, stale: !!stale, src: c.src === "page" ? "Torn pages" : "Chain Watch" };
      if (S.member && j.me) S.hospUntil = j.me.hosp || 0;
    });
    else if (tornKey()) p = fetch("https://api.torn.com/v2/faction/chain?key=" + encodeURIComponent(tornKey()) + "&comment=chainpal").then(function(r){ return r.json() }).then(function(d){
      var c = (d && d.chain) || {}; if (d && d.error) throw new Error(d.error.error);
      S.fb = { n: Number(c.current) || 0, exp: Number(c.timeout) > 0 ? Date.now() + Number(c.timeout) * 1000 : 0, stale: false, src: "Torn API" };
    });
    else p = Promise.resolve();
    p.catch(function(){}).then(done);
  }
  function clockTick(fromObserver){
    var left = readClock(), cnt = readCount(), now = Date.now();
    var src = "page";
    if (left == null){ // nothing on the page to read: use the fallback
      fbPoll(); src = S.fb ? S.fb.src : "";
      if (S.fb && S.fb.exp && !S.fb.stale) left = Math.max(0, Math.round((S.fb.exp - now) / 1000));
      if (S.fb && S.fb.n && (!cnt || S.fb.n > cnt.n)) cnt = { n: S.fb.n, max: cnt ? cnt.max : "" };
    }
    var sl = $("cpSrc"); if (sl) sl.textContent = left == null ? "" : src === "page" ? "" : "via " + src;
    var st = $("cpStale"); if (st) st.classList.toggle("hide", !(src !== "page" && S.fb && S.fb.stale));
    var side = $("cpalSide"); if (!side) return;
    var t = $("cpTime"), c = $("cpCount");
    if (cnt) c.textContent = "Chain " + cnt.n.toLocaleString() + (cnt.max ? " / " + cnt.max : "");
    if (left == null || left <= 0){
      t.textContent = left === 0 ? "0:00" : "--:--"; side.classList.remove("good", "warn", "bad", "crit");
      if (CK.booked.length){ CK.booked.forEach(function(b){ cancelBus(b.bus) }); CK.booked = [] }
      CK.exp = null; CK.count = cnt ? cnt.n : null; return;
    }
    t.textContent = mmss(left);
    side.classList.toggle("good", left >= 120); side.classList.toggle("warn", left >= 60 && left < 120); side.classList.toggle("bad", left < 60); side.classList.toggle("crit", left <= 30);
    var exp = now + left * 1000;
    // a hit (count up, or the clock jumped back up) or the first reading: re-book; otherwise keep what's booked
    var reset = CK.exp == null || (cnt && CK.count != null && cnt.n > CK.count) || exp - CK.exp > 3000 || CK.exp - exp > 3000;
    CK.count = cnt ? cnt.n : CK.count;
    // fired ones stop being armed
    CK.booked = CK.booked.filter(function(b){ if (now >= b.when + 1500){ if (CK.armed) CK.armed[b.i] = false; return false } return true });
    if (reset){ CK.exp = exp; bookAlerts(left) }
    else if (!CK.booked.length && S.sound) { var AL = alerts(); if (AL.some(function(x, i){ return x.at && left > x.at + 2 && CK.armed && !CK.armed[i] })) bookAlerts(left) }
  }
  function sndButton(){
    var ready = AC && AC.state === "running";
    var b = $("ctSnd"); if (b){ b.className = S.sound ? (ready ? "on" : "arm") : ""; b.textContent = !S.sound ? "🔕 Sound off" : ready ? "🔔 Sound on" : "🔔 Click to arm" }
    var s = $("cpSnd"); if (s){ s.textContent = !S.sound ? "🔕" : ready ? "🔔" : "🔔?"; s.title = !S.sound ? "Alert sound off (click to turn on)" : ready ? "Alert sound on" : "Click once to let the browser play sounds"; s.classList.toggle("arm", S.sound && !ready) }
  }
  function soundToggle(){
    S.sound = !S.sound; store("cw_snd", S.sound ? "1" : null);
    if (S.sound){ audio(); setTimeout(function(){ sndButton(); CK.exp = null; clockTick() }, 150) } else { CK.booked.forEach(function(b){ cancelBus(b.bus) }); CK.booked = [] }
    sndButton();
  }
  function beepShort(){ var a = audio(); if (!a) return; var t = a.currentTime + 0.02, o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); env(a, g, t, 0.25, 0.45); o.start(t); o.stop(t + 0.3) }

  // ---- who am I (player + faction), from your own key; once a day ----
  function cpIdent(force){
    var me = null; try { me = JSON.parse(store("cp_me") || "null") } catch(e){}
    var k = tornKey();
    var apply = function(m){
      S.member = m && m.pid ? { pid: m.pid, name: m.name, f: m.f } : null; S.f = m && m.f || 0;
      S.identDone = true; S.fbNext = 0; // (re)check the timer source now that we know the faction
      // shared a key with the Chain Watch finder pool? Then bounties go through it (no separate bounty key needed)
      if (S.member && CP_FACTIONS.indexOf(S.f) >= 0 && !S.donorAsked){ S.donorAsked = true; api({ op: "donorState", pid: S.member.pid, cid: cid() }).then(function(j){ S.donor = j; TF.bty = null; try { tfShowK2() } catch(e){} }).catch(function(){}) }
      var el = $("cpMe"); if (el) el.innerHTML = m && m.pid ? "Signed in as <b>" + esc(m.name) + "</b> [" + m.pid + "]" + (CP_FACTIONS.indexOf(S.f) >= 0 ? " · Chain Watch features on (retals, war, shit list, shared checks)" : " · Retals, war and the shit list are only for Glory to Heroes and Glory to Saints") : "";
    };
    if (me && me.k === (k || "").slice(-4) && !force && Date.now() - (me.at || 0) < 86400000){ apply(me); return Promise.resolve(me) }
    if (!k){ apply(null); return Promise.resolve(null) }
    return fetch("https://api.torn.com/v2/user/profile?striptags=true&key=" + encodeURIComponent(k) + "&comment=chainpal").then(function(r){ return r.json() }).then(function(d){
      var p = d && d.profile; if (!p || !p.id) return me;
      var m = { pid: Number(p.id), name: String(p.name || ""), f: Number(p.faction_id) || 0, k: k.slice(-4), at: Date.now() };
      store("cp_me", JSON.stringify(m)); apply(m); return m;
    }).catch(function(){ apply(me); return me });
  }

  // ---- panel ----
  function cpOpen(tab){
    $("cpalOv").classList.remove("hide"); S.cpPanel = true;
    cpTab(tab || S.cpTab || "tgt"); tfShowKey(); alRender(); sndButton();
  }
  function cpClose(){ $("cpalOv").classList.add("hide"); S.cpPanel = false }
  function cpTab(t){
    S.cpTab = t;
    [["tgt", "cpTabTgt"], ["al", "cpTabAl"], ["key", "cpTabKey"]].forEach(function(x){ show(x[1], x[0] === t) });
    Array.prototype.forEach.call(document.querySelectorAll("#cpalOv [data-cptab]"), function(b){ b.classList.toggle("act", b.getAttribute("data-cptab") === t) });
  }
  var WAKE_KEY = "cp_wake", WAKE_SW = "cpWakeSw", WAKE_MSG = "cpWakeMsg";
  // ---- keep the screen on (screen wake lock): the page stays live, so the timer and alerts keep going ----
  var WL = null;
  function wakeWant(){ return store(WAKE_KEY) === "1" }
  function wakeUI(msgTxt){
    var c = $(WAKE_SW); if (c) c.checked = wakeWant();
    var t = $(WAKE_MSG); if (!t) return;
    t.textContent = msgTxt || (!wakeWant() ? "" : !("wakeLock" in navigator) ? "This browser can\u2019t keep the screen on. Set a longer screen timeout in your phone\u2019s settings instead." : WL ? "On: the screen stays on while this page is showing." : "On: it switches on again when you come back to this page.");
  }
  function wakeOn(){
    if (!wakeWant() || document.hidden || WL || !("wakeLock" in navigator)){ wakeUI(); return }
    navigator.wakeLock.request("screen").then(function(l){ WL = l; l.addEventListener("release", function(){ WL = null; wakeUI() }); wakeUI() })
      .catch(function(e){ wakeUI("Couldn\u2019t keep the screen on here (" + (e && e.message || "not allowed") + ").") });
  }
  function wakeOff(){ if (WL){ try { WL.release() } catch(e){} WL = null } wakeUI() }
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) wakeOn() }); // the browser drops it when you switch away
  // ---- attacks open in a pop-out window over the page (✕ closes it). Chain Pal itself never loads inside it. ----
  var PO = null;
  function cpPopOn(){ return store("cp_popout") !== "0" }
  function cpPopout(url){
    if (!PO){
      var r = document.createElement("div"); r.id = "cpalPo"; r.className = "cpal cp-po";
      r.innerHTML = '<div class="cp-po-bar"><span class="cp-po-t" id="cpPoT">Attack</span><span class="cp-po-btns"><button id="cpPoR" title="Reload">\u21bb</button><a id="cpPoX" target="_blank" rel="noopener" title="Open as a full page">\u2197</a><button id="cpPoC" class="cp-po-close" title="Close">\u2715</button></span></div><iframe id="cpPoF" title="Attack"></iframe>';
      document.body.appendChild(r);
      PO = { root: r, frame: r.querySelector("#cpPoF") };
      r.querySelector("#cpPoC").onclick = cpPopClose;
      r.querySelector("#cpPoR").onclick = function(){ try { PO.frame.contentWindow.location.reload() } catch(e){ PO.frame.src = PO.url } };
      r.querySelector("#cpPoX").onclick = function(){ cpPopClose() };
    }
    PO.url = url; PO.frame.src = url; PO.root.querySelector("#cpPoX").href = url;
    var m = /user2ID=(\d+)/.exec(url); PO.root.querySelector("#cpPoT").textContent = "\u2694 Attack" + (m ? " [" + m[1] + "]" : "");
    PO.root.classList.add("open");
  }
  function cpPopClose(){ if (!PO) return; PO.root.classList.remove("open"); try { PO.frame.src = "about:blank" } catch(e){} }
  function cpBig(){ var on = store("cp_big") !== "0"; var s = $("cpalSide"); if (s) s.classList.toggle("small-t", !on); var c = $("cpBig"); if (c) c.checked = on }
  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  var cssEl = document.createElement("style"); cssEl.id = "cpalCss"; cssEl.textContent = CP_CSS; (document.head || document.documentElement).appendChild(cssEl);
  var pw = document.createElement("div"); pw.innerHTML = PANEL_HTML; document.body.appendChild(pw.firstChild);
  cpPlace();
  // ---- the Chain Watch target page's own wiring (settings, priority order, hit list, shit list, keys, Find / Next) ----
  $("tfKeySave").onclick = function(){
    var k = $("tfKey").value.trim();
    if (!/^[A-Za-z0-9]{16}$/.test(k)){ msg("tfKeyMsg", "That doesn't look like a Torn API key (16 letters and numbers)."); return }
    msg("tfKeyMsg", ""); $("tfKeySave").textContent = "Checking…";
    fetch("https://ffscouter.com/api/v1/get-targets?key=" + encodeURIComponent(k) + "&minff=1&maxff=3&minlevel=1&maxlevel=100&limit=1")
      .then(function(r){ return r.json() }).then(function(d){
        $("tfKeySave").textContent = "Save key";
        if (d && d.error){ msg("tfKeyMsg", d.code === 6 ? "FF Scouter doesn't recognise this key yet. Go to ffscouter.com, sign up with this key (one-off), then save it here." : String(d.error)); return }
        store("cw_tfkey", k); $("tfKey").value = ""; TF.cache = {}; cpIdent(true).then(tfShowKey); tfShowKey();
      }).catch(function(){ $("tfKeySave").textContent = "Save key"; msg("tfKeyMsg", "Couldn't reach FF Scouter. Check your connection and try again.") });
  };
  $("tfCog").onclick = function(){ var o = $("tfOrderBox").classList.contains("hide"); tfRenderOrder(); show("tfOrderBox", o); this.classList.toggle("act", o) };
  $("tfOrder").addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("button[data-ord]"); if (!b || b.disabled) return;
    var c = tfCfg(), o = tfOrder(c), i = Number(b.getAttribute("data-ord")), j = i + Number(b.getAttribute("data-dir"));
    if (j < 0 || j >= o.length) return;
    var x = o[i]; o[i] = o[j]; o[j] = x; c.order = o; tfSave(c); tfRenderOrder();
  });
  $("myToggle").onclick = function(){ var open = $("myBody").classList.contains("hide"); show("myBody", open); this.setAttribute("aria-expanded", open ? "true" : "false"); myRender() };
  $("myAddBtn").onclick = function(){
    var raw = $("myIn").value.trim(), m = raw.match(/XID=(\d{1,10})/i) || raw.match(/user2ID=(\d{1,10})/i) || raw.match(/^\[?(\d{1,10})\]?$/) || raw.match(/\[(\d{1,10})\]/);
    if (!m){ msg("myMsg", "Paste their profile link (…profiles.php?XID=123456) or their ID number."); return }
    var pid = Number(m[1]), note = $("myWhy").value.trim().slice(0, 140), btn = this;
    if (myList().some(function(x){ return x.pid === pid })){ msg("myMsg", "They're already on your list."); return }
    var add = function(name, level){
      var L = myList(); L.unshift({ pid: pid, name: name || ("Player " + pid), level: level || 0, note: note, addedAt: Math.floor(Date.now() / 1000) }); mySave(L);
      $("myIn").value = ""; $("myWhy").value = ""; btn.textContent = "Add to my list"; msg("myMsg", "Added " + (name || pid) + ".", true); tfCounts();
    };
    var k = tornKey(); if (!k){ add("", 0); return }
    btn.textContent = "Adding…";
    fetch("https://api.torn.com/v2/user/" + pid + "/basic?striptags=true&key=" + encodeURIComponent(k) + "&comment=chainwatch-tf").then(function(r){ return r.json() })
      .then(function(d){ if (d && d.error && (d.error.code === 6 || d.error.code === 7)){ btn.textContent = "Add to my list"; msg("myMsg", "Torn has no player with ID " + pid + "."); return } var pr = (d && d.profile) || {}; add(pr.name, Number(pr.level) || 0) })
      .catch(function(){ add("", 0) });
  };
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-my-rm]"); if (!b) return;
    var pid = Number(b.getAttribute("data-my-rm"));
    mySave(myList().filter(function(x){ return x.pid !== pid })); tfCounts();
  });
  myRender();
  $("shitToggle").onclick = function(){
    var open = $("shitBody").classList.contains("hide");
    show("shitBody", open); this.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) shitLoad(false).catch(function(e){ $("shitList").innerHTML = '<div class="small" style="color:#fca5a5">' + esc(e.message) + '</div>' });
  };
  $("shitAddBtn").onclick = function(){
    var v = $("shitIn").value.trim(); if (!v){ msg("shitMsg", "Paste a profile link or ID first."); return }
    $("shitAddBtn").textContent = "Adding…";
    api({ op: "shitAdd", target: v, reason: $("shitWhy").value }).then(function(j){
      $("shitAddBtn").textContent = "Add to the list"; $("shitIn").value = ""; $("shitWhy").value = "";
      msg("shitMsg", "Added " + (j.name || "them") + " (Lv " + (j.level || "?") + ")" + (j.both ? " to both factions' lists." : " to this list only (they're in the other faction)."), true); shitLoad(true).then(tfCounts);
    }).catch(function(e){ $("shitAddBtn").textContent = "Add to the list"; msg("shitMsg", e.message) });
  };
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-shit-rm]"); if (!b || S.member) return;
    if (!confirm("Take them off the shit list? (Removes them for both factions.)")) return;
    api({ op: "shitRemove", pid: Number(b.getAttribute("data-shit-rm")) }).then(function(){ msg("shitMsg", "Removed from both lists.", true); shitLoad(true).then(tfCounts) });
  });
  $("tfK2Save").onclick = function(){
    var k = $("tfK2").value.trim();
    if (!/^[A-Za-z0-9]{16}$/.test(k)){ msg("tfK2Msg", "That doesn't look like a Torn API key (16 letters and numbers)."); return }
    msg("tfK2Msg", ""); $("tfK2Save").textContent = "Checking…";
    fetch("https://api.torn.com/v2/torn/bounties?limit=1&key=" + encodeURIComponent(k) + "&comment=chainwatch-tf").then(function(r){ return r.json() }).then(function(d){
      $("tfK2Save").textContent = "Save";
      if (d && d.error){
        msg("tfK2Msg", d.error.code === 16 ? "This key can't read the bounty list either. Make a Public key (or Limited/Full) and use that." : d.error.code === 2 ? "Torn says that key is incorrect." : "Torn: " + (d.error.error || "error"));
        return;
      }
      store("cw_tfkey2", k); $("tfK2").value = ""; cpIdent(true); TF.bty = null; msg("tfK2Msg", "Saved. Bounties will use this key.", true); tfShowK2(); tfCounts();
    }).catch(function(){ $("tfK2Save").textContent = "Save"; msg("tfK2Msg", "Couldn't reach Torn. Try again.") });
  };
  $("tfK2Del").onclick = function(e){ e.preventDefault(); store("cw_tfkey2", null); TF.bty = null; msg("tfK2Msg", ""); tfShowK2(); tfCounts() };
  $("tfKeyChange").onclick = function(e){ e.preventDefault(); show("tfKeyBox", true); show("tfMain", false); show("tfSettings", false) };
  $("tfKeyDel").onclick = function(e){ e.preventDefault(); if (confirm("Remove your API key from this device?")){ store("cw_tfkey", null); TF.cache = {}; $("tfRes").innerHTML = ""; tfShowKey() } };
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest(".tf-go button[data-t], .tfNext"); if (!b || false) return;
    tfFind(b.getAttribute("data-t"));
  });
  $("tfFreshCog").addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); show("tfFreshBox", $("tfFreshBox").classList.contains("hide")) });
  $("tfFreshMin").addEventListener("change", function(){ tfReadSettings(); tfFillSettings(); tfCounts() });
  $("tfInactCog").addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); show("tfInactBox", $("tfInactBox").classList.contains("hide")) });
  $("tfInactDays").addEventListener("change", function(){ tfReadSettings(); tfFillSettings(); tfCounts() });
  Array.prototype.forEach.call(document.querySelectorAll("#tfSettings input"), function(el){
    el.addEventListener("change", function(){ tfReadSettings(); tfCounts() });
  });

  // ---- Chain Pal's own wiring ----
  $("cpCog").onclick = function(){ cpOpen("tgt") };
  $("cpSetupBtn").onclick = function(){ cpOpen("key") };
  $("cpClose").onclick = cpClose;
  $("cpalOv").addEventListener("click", function(e){
    if (e.target === this){ cpClose(); return }
    var b = e.target.closest && e.target.closest("[data-cptab]"); if (b) cpTab(b.getAttribute("data-cptab"));
  });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape" && S.cpPanel) cpClose() });
  $("cpSnd").onclick = function(e){ e.preventDefault(); soundToggle() };
  $("ctSnd").onclick = soundToggle;
  $("ctTest").onclick = function(){ // plays your alerts in order
    audio(); var on = alerts().filter(function(x){ return x.at }).sort(function(a, b){ return b.at - a.at }), t = 0;
    on.forEach(function(x){ setTimeout(function(){ playSnd(x.snd) }, t); t += 2600 });
    setTimeout(sndButton, 100);
  };
  $("ctVol").value = S.vol; $("ctVolV").textContent = S.vol + "%";
  $("ctVol").oninput = function(){ S.vol = Number(this.value); $("ctVolV").textContent = S.vol + "%"; store("cw_vol", String(S.vol)) };
  $("ctVol").onchange = function(){ audio(); beepShort(); CK.exp = null; clockTick() }; // re-book alerts at the new volume
  $("ctAlRows").addEventListener("change", function(e){
    var el = e.target, A = alerts(), i;
    if (el.hasAttribute("data-al-at")){ i = Number(el.getAttribute("data-al-at")); A[i].at = Number(el.value) }
    else if (el.hasAttribute("data-al-snd")){ i = Number(el.getAttribute("data-al-snd")); A[i].snd = el.value }
    else return;
    store("cw_alerts", JSON.stringify(A)); alRender(); CK.armed = null; CK.exp = null; clockTick();
  });
  $("ctAlRows").addEventListener("click", function(e){ var b = e.target.closest && e.target.closest("[data-al-play]"); if (b) playSnd(alerts()[Number(b.getAttribute("data-al-play"))].snd) });
  $("cpBig").onchange = function(){ store("cp_big", this.checked ? null : "0"); cpBig() };
  $("cpWakeSw").onchange = function(){ store(WAKE_KEY, this.checked ? "1" : null); if (this.checked) wakeOn(); else wakeOff() };
  wakeOn();
  $("cpPopSw").checked = cpPopOn();
  $("cpPopSw").onchange = function(){ store("cp_popout", this.checked ? null : "0") };
  // Attack links in Chain Pal (found target, retals) open in the pop-out
  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest(".cpal a[href*='sid=attack']");
    if (!a || !cpPopOn() || e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
    e.preventDefault(); e.stopPropagation(); cpPopout(a.href);
  }, true);
  document.addEventListener("keydown", function(e){ if (e.key === "Escape" && PO && PO.root.classList.contains("open") && !S.cpPanel) cpPopClose() });
  document.addEventListener("click", function(e){ if (e.target.closest && e.target.closest(".cpal .tf-go button[data-t], .cpal .tfNext")) S.cpLastFind = Date.now() }, true);
  // browsers only play sound after you've clicked the page once: arm it on the first click
  document.addEventListener("click", function(){ if (S.sound && (!AC || AC.state !== "running")){ audio(); setTimeout(function(){ sndButton(); CK.exp = null; clockTick() }, 200) } }, true);
  // Torn redraws its sidebar now and then: keep the widget in place; the clock ticks every second and on every change
  var cpObs = null, cpObsEl = null;
  function cpWatch(){
    var bc = document.getElementById("barChain");
    if (bc === cpObsEl) return;
    if (cpObs) cpObs.disconnect();
    cpObsEl = bc; if (!bc) return;
    cpObs = new MutationObserver(function(){ clockTick(true) });
    cpObs.observe(bc, { subtree: true, childList: true, characterData: true });
  }
  setInterval(function(){ cpPlace(); cpWatch(); clockTick() }, 1000);
  cpWatch(); cpBig(); alRender(); sndButton(); clockTick();
  cpIdent().then(function(){ tfShowKey() });
})();
