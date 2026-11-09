// ==UserScript==
// @name         Glory Dibs ✋
// @namespace    jay-glory-dibs
// @version      0.2.1
// @description  Call buttons for Glory Command Dibs on the war page, enemy faction pages and enemy profiles. By -TheKraken- [3616083].
// @author       -TheKraken- [3616083]
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/profiles.php*
// @connect      dashing-fish-54.eu-west-1.convex.site
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/glory-dibs.user.js
// @updateURL    https://raw.githubusercontent.com/JaySquire22/krakens-war-room-scripts/main/glory-dibs.user.js
// ==/UserScript==
// Copyright (c) 2026 -TheKraken- [3616083]. All rights reserved. Not to be copied or redistributed without permission.
//
// What leaves your device: your Torn API key is sent once to the Glory Command server to check who you are
// (it is not stored there or here). After that a signed pass is used. While you're on a faction or profile page,
// the script asks the server for the Dibs list every 3 seconds, and sends a call when you tap Call.
(function () {
  "use strict";
  if (window.top !== window.self) return;
  if (document.getElementById("gdb-fab")) return;
  var API = "https://dashing-fish-54.eu-west-1.convex.site/chain/api";
  var CALL_FROM = 359, LATE = 15;

  // ---- storage (Tampermonkey / Violentmonkey / Torn PDA) ----
  function get(k) { try { if (typeof GM_getValue === "function") { var v = GM_getValue(k, null); return v == null ? null : String(v); } } catch (e) {} try { return localStorage.getItem("gdb_" + k); } catch (e) { return null; } }
  function set(k, v) { try { if (typeof GM_setValue === "function") { GM_setValue(k, v == null ? null : String(v)); return; } } catch (e) {} try { if (v == null) localStorage.removeItem("gdb_" + k); else localStorage.setItem("gdb_" + k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  // Torn's pages block the browser's own fetch to other sites, so go through the userscript app:
  // Torn PDA's PDA_httpPost, or the GM_xmlhttpRequest of Tampermonkey / Violentmonkey.
  function post(body) {
    var data = JSON.stringify(body), headers = { "Content-Type": "application/json" };
    var parse = function (t) { return typeof t === "string" ? JSON.parse(t) : t; };
    if (typeof PDA_httpPost === "function") {
      return Promise.resolve().then(function () { return PDA_httpPost(API, headers, data); })
        .then(function (r) { return parse((r && (r.responseText || r.response || r.body)) || ""); });
    }
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise(function (res, rej) {
        GM_xmlhttpRequest({ method: "POST", url: API, headers: headers, data: data, timeout: 15000,
          onload: function (r) { try { res(JSON.parse(r.responseText)); } catch (e) { rej(e); } },
          onerror: function () { rej(new Error("network")); }, ontimeout: function () { rej(new Error("timeout")); } });
      });
    }
    return fetch(API, { method: "POST", headers: { "Content-Type": "text/plain" }, body: data }).then(function (r) { return r.json(); });
  }
  var ME = null; try { ME = JSON.parse(get("me") || "null"); } catch (e) {}
  if (ME && !(ME.pass && ME.exp > Date.now())) ME = null;
  function api(b) { b.f = ME.f; b.pid = ME.pid; b.pass = ME.pass; b.name = ME.name; b.pin = ""; return post(b); }

  // ---- state ----
  var S = { st: null, skew: 0, rtt: null, last: 0, inFlight: false, denied: 0, busy: false, err: "" };
  function nowS() { return (Date.now() + S.skew) / 1000; }
  function active() { return !!(S.st && S.st.on); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dur(s) { s = Math.max(0, Math.ceil(s - 0.001)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? h + ":" + pad(m) + ":" + pad(x) : m + ":" + pad(x); }
  function tms(ms) { return new Date(ms).toISOString().slice(11, 23); }
  function leftTxt(ms) { if (!ms) return ""; var t = ms / 1000, m = Math.floor(t / 60); return " (" + (m ? m + "m " : "") + (t - m * 60).toFixed(1) + "s left)"; }
  function timer(t, now) { if (t[1] === "Hospital" && t[2] > now) return t[2] - now; if (t[1] === "Traveling" && t[6]) return t[6] - now; return null; }

  function poll() {
    if (!ME || document.hidden || S.inFlight || Date.now() < S.denied || Date.now() - S.last < 3000) return;
    S.last = Date.now(); S.inFlight = true;
    var q0 = Date.now();
    api({ op: "dibsState" }).then(function (j) {
      var q1 = Date.now(); S.inFlight = false;
      if (!j || j.error) {
        S.st = null; S.err = (j && j.error) || "No answer";
        if (j && j.needAuth) { ME = null; set("me", null); }
        else S.denied = Date.now() + 10 * 60 * 1000; // not in the trial: ask again in 10 minutes
        fab(); return;
      }
      S.err = ""; S.st = j;
      if (j.nowMs && (S.rtt == null || q1 - q0 <= S.rtt * 1.5)) { S.skew = j.nowMs - (q0 + q1) / 2; S.rtt = S.rtt == null ? q1 - q0 : Math.min(q1 - q0, S.rtt * 1.2); }
      fab();
    }).catch(function () { S.inFlight = false; });
  }

  // ---- the button for one enemy ----
  // destination flag from Torn's status text; flying home gets War Room's black "T" badge
  var FLAGS = [[/mexic/i, "\ud83c\uddf2\ud83c\uddfd"], [/cayman/i, "\ud83c\uddf0\ud83c\uddfe"], [/canad/i, "\ud83c\udde8\ud83c\udde6"], [/hawai/i, "\ud83c\uddfa\ud83c\uddf8"], [/united kingdom|british|\bUK\b|england|english/i, "\ud83c\uddec\ud83c\udde7"],
    [/argentin/i, "\ud83c\udde6\ud83c\uddf7"], [/switzerland|swiss/i, "\ud83c\udde8\ud83c\udded"], [/japan/i, "\ud83c\uddef\ud83c\uddf5"], [/china|chinese/i, "\ud83c\udde8\ud83c\uddf3"], [/\bUAE\b|emirat|dubai/i, "\ud83c\udde6\ud83c\uddea"], [/south africa/i, "\ud83c\uddff\ud83c\udde6"]];
  function flagOf(desc) {
    desc = String(desc || "");
    if (/to Torn\b/i.test(desc)) return '<span class="gdb-tflag">T</span>';
    for (var i = 0; i < FLAGS.length; i++) if (FLAGS[i][0].test(desc)) return FLAGS[i][1];
    return "";
  }
  function parts(id) {
    var st = S.st, t = st.targets && st.targets[String(id)];
    if (!t) return null;
    var d = (st.dibs || []).filter(function (x) { return x.t === Number(id); })[0];
    var left = timer(t, nowS()), fly = t[1] === "Traveling", from = st.callFrom || CALL_FROM;
    var fg = fly ? flagOf(t[5]) : "";
    var tm = left == null ? "" : fly && left <= 0 ? "\u2708 " + (fg ? fg + " " : "") + "landing" : (fly ? "\u2708 " + (fg ? fg + " " : "") : "") + dur(left);
    var cls = "gdb-tm" + (fly ? " gdb-fly" : "") + (left != null && left <= from && left > LATE ? " gdb-open" : "");
    var act;
    if (d && d.by === ME.pid) act = '<span class="gdb-yours">\u2705 Yours</span>';
    else if (d) act = '<span class="gdb-taken">\u270b ' + esc(d.byName) + (d.myMs ? ' <i>+' + ((d.myMs - d.ms) / 1000).toFixed(2) + "s</i>" : "") + "</span>";
    else if (left == null) act = "";
    else if (left <= LATE) act = '<button class="gdb-btn gdb-off" disabled>Late</button>';
    else if (left > from) act = '<button class="gdb-btn gdb-off" disabled>Call</button>';
    else act = '<button class="gdb-btn" data-gdb-call="' + id + '">Call</button>';
    return { tm: tm, cls: cls, act: act };
  }
  function cell(id) { var p = parts(id); return !p ? "" : (p.tm ? '<span class="' + p.cls + '">' + p.tm + "</span>" : "") + p.act; }
  function cellFor(el) {
    var id = el.getAttribute("data-gdb-id"), p;
    if (el.className.indexOf("gdb-wide") >= 0) { // the faction page: separate Timer and Dibs columns
      p = parts(id);
      return p ? '<span class="gdb-tcol">' + (p.tm ? '<span class="' + p.cls + '">' + p.tm + "</span>" : "") + '</span><span class="gdb-dcol">' + p.act + "</span>" : "";
    }
    if (el.className.indexOf("gdb-in-status") >= 0) { p = parts(id); return p ? p.act : ""; } // Torn's own timer is right there
    return cell(id);
  }

  // ---- put a holder next to each enemy name on the page ----
  function idOf(a) { var m = String(a.getAttribute("href") || "").match(/XID=(\d+)/i); return m ? m[1] : ""; }
  // ---- find Torn's own pieces by their visible text (class names change too often) ----
  // the deepest element whose whole text is exactly `text` (headers often hold an extra sort icon)
  function leaf(text, root) {
    var els = (root || document).querySelectorAll("div, span, li, h4, h5, p, a, button");
    var best = null;
    for (var i = 0; i < els.length; i++) {
      if (els[i].textContent.trim() !== text) continue;
      if (!best || best.contains(els[i])) best = els[i];
    }
    return best;
  }
  function box(el) { return el.getBoundingClientRect(); }
  // the member list's Position and Days column headers (enemy faction page)
  var HDR = null, hdrMiss = 0;
  function memberHeader(link) {
    if (HDR && HDR.p.isConnected && HDR.d.isConnected) return HDR;
    HDR = null;
    if (Date.now() - hdrMiss < 3000) return null;
    // search only the list around an enemy's link, not the whole page
    var root = link; while (root && root !== document.body && !/Days/.test(root.textContent)) root = root.parentElement;
    var d = root && leaf("Days", root), p = root && (leaf("Position", root) || leaf("Dibs", root));
    if (!d || !p) { hdrMiss = Date.now(); return null; }
    var cell = function (el) { while (el.parentElement && el.parentElement.childElementCount === 1) el = el.parentElement; return el; };
    var pc = cell(p), dc = cell(d);
    // remember where the columns sit before anything is hidden
    HDR = { p: pc, d: dc, label: p, px: box(pc).left, dx: box(dc).left, w: box(pc).width + box(dc).width, bw: 0, mw: 0 };

    if (!(HDR.w > 0) || HDR.dx <= HDR.px) { HDR = null; hdrMiss = Date.now(); return null; }
    return HDR;
  }
  // the child of `row` sitting under a header cell (same left edge)
  function under(row, x) {
    var kids = row.children;
    for (var i = 0; i < kids.length; i++) if (Math.abs(box(kids[i]).left - x) < 6 && box(kids[i]).width > 0) return kids[i];
    return null;
  }
  // the faction badge in a member row: a small picture (Torn's faction tag), never the name or the whole cell
  function hideBadge(row) {
    if (row.getAttribute("data-gdb-badge")) return 0;
    row.setAttribute("data-gdb-badge", "1");
    var link = row.querySelector('a[href*="profiles.php?XID="]'), freed = 0;
    var imgs = row.querySelectorAll('img[src*="factiontag"], img[src*="faction_tag"], img[src*="/tags/"], a[href*="factions.php?step=profile"] img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.closest('a[href*="profiles.php"]')) continue; // the honor bar / name
      var el = im;
      // climb to the badge's own wrapper (one child each), never to anything holding the name
      while (el.parentElement && el.parentElement !== row && el.parentElement.childElementCount === 1 && !(link && el.parentElement.contains(link))) el = el.parentElement;
      var b = box(el);
      if (b.width > 90 || (link && el.contains(link))) continue; // too big to be the badge: leave it
      var cs = getComputedStyle(el);
      freed += b.width + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0);
      el.style.display = "none";
    }
    return Math.round(freed);
  }
  function memberCell(row) {
    var link = row.querySelector('a[href*="profiles.php?XID="]');
    for (var i = 0; i < row.children.length; i++) if (link && row.children[i].contains(link)) return row.children[i];
    return null;
  }
  function setW(el, w) { el.style.cssText += ";width:" + w + "px;max-width:" + w + "px;flex:0 0 " + w + "px"; }
  function wideRow(row, H) {
    var pc = row.getAttribute("data-gdb-pc") === "1" ? row.querySelector('[data-gdb="1"]') : under(row, H.px);
    if (!pc) return null;
    if (pc.getAttribute("data-gdb") !== "1") {
      var dc = under(row, H.dx);
      if (!dc || dc === pc) return null;
      // the badge's room goes to the Timer/Dibs columns: names shift left, member column narrows by the same
      var mem = memberCell(row), mw = mem ? box(mem).width : 0;
      if (mem && H.mx == null) H.mx = box(mem).left;
      var freed = hideBadge(row);
      if (freed > 0 && !H.bw) H.bw = freed;
      var give = freed > 0 && mw - H.bw > 100 ? H.bw : 0;
      if (give) setW(mem, mw - give);
      var w = H.w + give;
      dc.style.display = "none";
      pc.setAttribute("data-gdb", "1"); row.setAttribute("data-gdb-pc", "1"); pc.innerHTML = "";
      pc.style.cssText += ";width:" + w + "px;max-width:" + w + "px;flex:0 0 " + w + "px;display:flex;align-items:center;overflow:visible";
    }
    return pc;
  }
  function wideHeader(H) {
    if (H.done) return;
    var hr = H.p.parentElement, give = 0;
    if (H.bw && H.mx != null && hr) {
      var hm = under(hr, H.mx), hw = hm ? box(hm).width : 0;
      if (hm && hw - H.bw > 100) { setW(hm, hw - H.bw); give = H.bw; }
    }
    var w = H.w + give;
    H.d.style.display = "none";
    setW(H.p, w);
    H.p.innerHTML = '<span class="gdb-tcol gdb-h">Timer</span><span class="gdb-dcol gdb-h">Dibs</span>';
    H.p.style.cssText += ";display:flex;align-items:center";
    H.done = true;
  }
  var lastAttach = 0;
  function attach() {
    if (!active() || Date.now() - lastAttach < 700) return;
    lastAttach = Date.now();
    var T = S.st.targets || {};
    if (/factions\.php/i.test(location.href)) {
      var links = document.querySelectorAll('a[href*="profiles.php?XID="]'), H = null;
      for (var i = 0; i < links.length; i++) {
        var a = links[i], id = idOf(a);
        if (!id || !T[id]) continue;
        // not in chat, our own boxes, or War Room's panel (War Room shows its own Dibs buttons)
        if (a.closest('[class*="chat"], #gdb-panel, #gdb-called, #gdb-prof, .gdb-psec, [id^="tws-"], [class*="tws-"], [id^="kwr-"], [class*="kwr-"]')) continue;
        var holder, row = a.closest("li") || a.closest("tr");
        H = H || memberHeader(a);
        var cellEl = H && row ? wideRow(row, H) : null;
        if (cellEl) {
          // enemy faction page: Position + Days make room for the timer and Call button
          wideHeader(H);
          Array.prototype.forEach.call(row.parentElement.children, function (r) { wideRow(r, H); });
          if (cellEl.querySelector(".gdb-cell")) continue;
          holder = document.createElement("span"); holder.className = "gdb-cell gdb-wide"; holder.setAttribute("data-gdb-id", id);
          cellEl.appendChild(holder);
          continue;
        }
        // other faction lists (the war page): in the row's Status cell
        row = row || a.parentElement;
        if (!row || row.querySelector('.gdb-cell[data-gdb-id="' + id + '"]')) continue;
        holder = document.createElement("span"); holder.className = "gdb-cell"; holder.setAttribute("data-gdb-id", id);
        var cells = row.querySelectorAll('[class*="status"]'), stc = null;
        for (var c = cells.length - 1; c >= 0; c--) {
          if (/okay|hospital|travel|abroad|jail|fallen|fedded|federal|\d+:\d+/i.test(cells[c].textContent) && !cells[c].querySelector('[class*="status"]')) { stc = cells[c]; break; }
        }
        if (stc) { holder.className += " gdb-in-status"; stc.insertBefore(holder, stc.firstChild); }
        else a.insertAdjacentElement("afterend", holder);
      }
    }
    // an enemy's profile: a "Dibs" section just above Actions, in Torn's own style
    var pm = location.href.match(/profiles\.php\?XID=(\d+)/i);
    var sec = document.querySelector(".gdb-psec"), box = document.getElementById("gdb-prof");
    if (pm && T[pm[1]]) {
      if (sec || box) return;
      var act = leaf("Actions"), wrap = act;
      while (wrap && wrap.parentElement && !wrap.querySelector('a[href*="sid=attack"], button, [class*="button"]')) wrap = wrap.parentElement;
      if (act && wrap && wrap.parentElement && wrap !== document.body) {
        var title = act; while (title.parentElement !== wrap) title = title.parentElement;
        sec = wrap.cloneNode(false); sec.className += " gdb-psec"; sec.removeAttribute("id");
        var t2 = title.cloneNode(false); t2.removeAttribute("id"); t2.className += " gdb-pbar";
        t2.innerHTML = '<span>\u270b Dibs</span><span class="gdb-cell gdb-pcell" data-gdb-id="' + pm[1] + '"></span>';
        sec.appendChild(t2);
        wrap.parentElement.insertBefore(sec, wrap);
      } else {
        box = document.createElement("div"); box.id = "gdb-prof";
        box.innerHTML = '<span class="gdb-pt">\u270b Dibs: <b>' + esc(T[pm[1]][0]) + '</b></span><span class="gdb-cell" data-gdb-id="' + pm[1] + '"></span>';
        document.body.appendChild(box);
      }
    } else { if (sec) sec.remove(); if (box) box.remove(); }
  }

  // ---- your own call, pinned at the bottom of the screen ----
  function called() {
    var el = document.getElementById("gdb-called");
    // War Room shows your call at the top of its own list, so no second bar when it's on the page
    var wr = document.querySelector('[id^="tws-"], [class*="tws-row"]');
    var d = active() && !wr ? (S.st.dibs || []).filter(function (x) { return x.by === ME.pid; })[0] : null;
    if (!d) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "gdb-called"; document.body.appendChild(el); }
    var t = (S.st.targets && S.st.targets[String(d.t)]) || ["#" + d.t], now = nowS(), left = timer(t, now);
    var line = left != null ? (t[1] === "Traveling" ? "lands in ~" : "out in ") + dur(left) : d.outAt ? "hit within " + dur((S.st.holdSec || 180) - (now - d.outAt)) : "out now";
    var h = '<span class="gdb-ct">\u270b Called: <b>' + esc(t[0]) + "</b><br><small>" + line + " \u00b7 called " + tms(d.ms) + leftTxt(d.leftMs) + "</small></span>"
      + '<a class="gdb-btn gdb-atk" href="https://www.torn.com/loader.php?sid=attack&user2ID=' + d.t + '">ATK</a><button class="gdb-btn gdb-un" data-gdb-rel="' + d.t + '">\u21a9 Uncall</button>';
    if (el.__h !== h) { el.__h = h; el.innerHTML = h; }
  }

  function tick() {
    poll();
    attach();
    var cells = document.querySelectorAll(".gdb-cell[data-gdb-id]");
    for (var i = 0; i < cells.length; i++) {
      var h = active() && ME ? cellFor(cells[i]) : "";
      if (cells[i].__h !== h) { cells[i].__h = h; cells[i].innerHTML = h; }
    }
    if (ME) called();
  }

  // ---- calling ----
  function toast(text, kind) {
    var t = document.getElementById("gdb-toast");
    if (!t) { t = document.createElement("div"); t.id = "gdb-toast"; document.body.appendChild(t); }
    t.className = kind || ""; t.textContent = text; t.style.display = "block";
    clearTimeout(t.__t); t.__t = setTimeout(function () { t.style.display = "none"; }, kind === "bad" ? 8000 : 5000);
  }
  function call(id) {
    if (S.busy) return; S.busy = true;
    api({ op: "dibCall", target: Number(id) }).then(function (j) {
      S.busy = false; S.last = 0;
      if (j && j.ok) toast("\u2705 It's yours! Called " + tms(j.ms) + " TCT" + leftTxt(j.leftMs) + (j.online ? ". They are ONLINE: if still online when out, anyone can hit them." : "."), "ok");
      else if (j && j.why === "taken") toast("\u2716 Taken by " + j.byName + ", called " + tms(j.winMs) + leftTxt(j.winLeftMs) + ". Yours registered " + tms(j.ms) + (j.ms > j.winMs ? " (" + ((j.ms - j.winMs) / 1000).toFixed(3) + "s too late)" : "") + ".", "bad");
      else toast("\u2716 " + ((j && (j.msg || j.error)) || "Call failed") + (j && j.ms ? " (registered " + tms(j.ms) + ")" : ""), "warn");
      tick();
    }).catch(function () { S.busy = false; toast("\u2716 Could not reach the Dibs server", "bad"); });
  }
  // Call fires as the finger touches it: quicker, and a page update can't swallow the tap
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest && e.target.closest("[data-gdb-call]");
    if (!b || b.disabled) return;
    e.preventDefault(); e.stopPropagation();
    call(b.getAttribute("data-gdb-call"));
  }, true);
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest("[data-gdb-call]");
    if (c) { e.preventDefault(); e.stopPropagation(); return; }
    var r = e.target.closest && e.target.closest("[data-gdb-rel]");
    if (!r) return;
    e.preventDefault(); e.stopPropagation();
    var id = r.getAttribute("data-gdb-rel"), t = S.st && S.st.targets && S.st.targets[id];
    if (!confirm("Release " + (t ? t[0] : "this target") + "? Anyone will be able to call them.")) return;
    api({ op: "dibRelease", target: Number(id) }).then(function (j) { S.last = 0; toast(j && j.ok === false ? "\u2716 " + j.msg : "\u21a9 Uncalled.", j && j.ok === false ? "warn" : "ok"); }).catch(function () {});
  }, true);

  // ---- sign in / status button ----
  function fab() {
    var f = document.getElementById("gdb-fab");
    if (!f) { f = document.createElement("div"); f.id = "gdb-fab"; f.title = "Glory Dibs"; f.onclick = panel; document.body.appendChild(f); }
    f.textContent = "\u270b"; f.className = !ME ? "out" : active() ? "on" : "idle";
  }
  function panel() {
    var p = document.getElementById("gdb-panel");
    if (p) { p.remove(); return; }
    p = document.createElement("div"); p.id = "gdb-panel";
    var st = S.st;
    p.innerHTML = '<b>\u270b Glory Dibs</b> <span class="gdb-x" id="gdb-close">\u2715</span>'
      + (ME
        ? '<div>Signed in as <b>' + esc(ME.name) + '</b> [' + ME.pid + ']</div><div class="gdb-s">'
          + (st ? (st.on ? "Dibs is ON against <b>" + esc(st.enemyName || ("#" + st.enemyF)) + "</b>." : "Dibs is switched off.") : (S.err ? "Not available: " + esc(S.err) : "Checking\u2026"))
          + '</div><button class="gdb-btn gdb-un" id="gdb-out">Sign out</button>'
        : '<div class="gdb-s">Sign in with your Torn API key (Public is enough). It is checked once by the Glory Command server and not stored.</div>'
          + '<input id="gdb-key" maxlength="16" placeholder="API key" autocomplete="off"><button class="gdb-btn" id="gdb-in">Sign in</button><div id="gdb-msg"></div>')
      + '<div class="gdb-s" style="margin-top:6px">Calls: hospital and flight timers only, from 5:59 down to 0:16. The first call to reach the server wins.</div>';
    document.body.appendChild(p);
    document.getElementById("gdb-close").onclick = function () { p.remove(); };
    var o = document.getElementById("gdb-out"); if (o) o.onclick = function () { ME = null; set("me", null); S.st = null; p.remove(); fab(); tick(); };
    var b = document.getElementById("gdb-in");
    if (b) b.onclick = function () {
      var k = document.getElementById("gdb-key").value.trim(), m = document.getElementById("gdb-msg");
      if (!/^[A-Za-z0-9]{16}$/.test(k)) { m.textContent = "That doesn't look like a Torn API key."; return; }
      b.textContent = "Checking\u2026";
      post({ op: "keyLogin", key: k }).then(function (j) {
        b.textContent = "Sign in";
        if (!j || !j.pass) { m.textContent = (j && j.error) || "Sign-in failed"; return; }
        ME = { pid: j.pid, name: j.name, f: j.f, pass: j.pass, exp: j.exp }; set("me", JSON.stringify(ME));
        S.denied = 0; S.last = 0; p.remove(); fab(); tick();
      }).catch(function () { b.textContent = "Sign in"; m.textContent = "Could not reach the server."; });
    };
  }

  var css = document.createElement("style");
  css.textContent = [
    ".gdb-cell{display:inline-flex;align-items:center;gap:4px;margin-left:6px;vertical-align:middle;font:bold 11px Arial,sans-serif}",
    ".gdb-cell:empty{display:none}",
    ".gdb-cell.gdb-in-status{margin:0 4px 0 0}",
    ".gdb-cell.gdb-wide{margin:0;gap:0;font-size:12px;width:100%;display:flex}",
    ".gdb-tcol{flex:0 0 55%;display:flex;align-items:center;justify-content:flex-start;padding-left:6px;box-sizing:border-box;white-space:nowrap}",
    ".gdb-dcol{flex:0 0 45%;display:flex;align-items:center;justify-content:center}",
    ".gdb-h{font-weight:bold}",
    ".gdb-psec{min-height:0!important;height:auto!important;margin-bottom:8px}",
    ".gdb-pbar{display:flex!important;align-items:center;justify-content:space-between;gap:8px}",
    ".gdb-pcell{margin:0;gap:10px;font-size:13px}",
    ".gdb-pcell .gdb-btn{font:bold 13px Arial,sans-serif;padding:5px 18px;border-radius:5px;background:linear-gradient(#6b6b6b,#3b3b3b);color:#fff;border:1px solid #1d1d1d;box-shadow:inset 0 1px 0 rgba(255,255,255,.15)}",
    ".gdb-pcell .gdb-btn:not(.gdb-off){background:linear-gradient(#5fa84a,#2f6a22);border-color:#1f4a16}",
    ".gdb-pcell .gdb-btn.gdb-off{color:#aaa}",
    ".gdb-btn{border:0;border-radius:4px;padding:3px 8px;font:bold 11px Arial,sans-serif;background:#2dd4bf;color:#04201c;cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none;text-decoration:none;display:inline-block}",
    ".gdb-btn.gdb-off{background:#3a3a3a;color:#888;cursor:default}",
    ".gdb-btn.gdb-un{background:#444;color:#eee}",
    ".gdb-btn.gdb-atk{background:#2e7d32;color:#fff}",
    ".gdb-tm{color:#ff7c7c;font-variant-numeric:tabular-nums;white-space:nowrap}",
    ".gdb-tm.gdb-fly{color:#7cc8ff}",
    ".gdb-tflag{display:inline-block;background:#000;color:#888;font-weight:bold;font-size:9px;padding:0 3px;border-radius:2px;line-height:1.4;vertical-align:1px}",
    ".gdb-tm.gdb-open{font-weight:bold}",
    ".gdb-taken{color:#ff8a8a;white-space:nowrap}.gdb-taken i{color:#aaa;font-style:normal}",
    ".gdb-yours{color:#7cfc7c}",
    "#gdb-prof{position:fixed;left:50%;transform:translateX(-50%);top:70px;z-index:99998;background:#161b26;border:1px solid #2dd4bf;border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px;color:#eee;font:13px Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.5)}",
    "#gdb-prof .gdb-cell{font-size:13px}#gdb-prof .gdb-btn{font-size:14px;padding:7px 14px}",
    "#gdb-called{position:fixed;left:8px;right:8px;bottom:8px;z-index:99998;display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid #22c55e;border-radius:8px;background:#0f2a1c;color:#d1fae5;font:12px Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.5)}",
    "#gdb-called .gdb-ct{flex:1}#gdb-called small{color:#9ad9b5}#gdb-called .gdb-btn{font-size:13px;padding:7px 12px}",
    "#gdb-fab{position:fixed;right:10px;bottom:70px;z-index:99999;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;background:#161b26;border:2px solid #555;box-shadow:0 2px 8px rgba(0,0,0,.5)}",
    "#gdb-fab.on{border-color:#2dd4bf}#gdb-fab.idle{border-color:#f59e0b}#gdb-fab.out{border-color:#ef4444}",
    "#gdb-panel{position:fixed;right:10px;bottom:115px;z-index:99999;width:270px;background:#161b26;color:#eee;border:1px solid #333;border-radius:10px;padding:10px;font:13px Arial,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.6)}",
    "#gdb-panel .gdb-x{float:right;cursor:pointer;color:#aaa}#gdb-panel .gdb-s{color:#aaa;font-size:12px;margin:6px 0}",
    "#gdb-panel input{width:100%;box-sizing:border-box;margin:4px 0;padding:6px;background:#0b0f17;color:#eee;border:1px solid #333;border-radius:6px}",
    "#gdb-panel .gdb-btn{font-size:13px;padding:6px 12px}#gdb-msg{color:#ff8a8a;font-size:12px;margin-top:4px}",
    "#gdb-toast{display:none;position:fixed;left:8px;right:8px;top:8px;z-index:100000;padding:10px 12px;border-radius:8px;background:#222;color:#fff;font:13px Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.6)}",
    "#gdb-toast.ok{background:#0f3d2a}#gdb-toast.bad{background:#4a1515}#gdb-toast.warn{background:#4a3410}"
  ].join("\n");
  document.head.appendChild(css);
  fab();
  setInterval(tick, 250);
  tick();
})();
