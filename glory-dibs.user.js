// ==UserScript==
// @name         Dibs Caller ✋
// @namespace    jay-glory-dibs
// @version      0.3.4
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
  if (window.__gdbLoaded) return; window.__gdbLoaded = true;
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
        ui(); return;
      }
      S.err = ""; S.st = j;
      if (j.nowMs && (S.rtt == null || q1 - q0 <= S.rtt * 1.5)) { S.skew = j.nowMs - (q0 + q1) / 2; S.rtt = S.rtt == null ? q1 - q0 : Math.min(q1 - q0, S.rtt * 1.2); }
      ui();
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
    // flights: flag, time, then the plane last (if space runs out, the plane is what gets cut); hospital: \ud83c\udfe5 first
    var tm = left == null || get("timers") === "0" ? "" : fly ? (fg ? fg + " " : "") + (left <= 0 ? "landing" : dur(left)) + " \u2708" : "\ud83c\udfe5 " + dur(left);
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
    if (el.className.indexOf("gdb-full") >= 0) return cell(id); // Position/Days kept: timer and Call in the Status column
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
  // Slide the name (honor bar) left so it sits just after the online dot, then return the width the
  // member cell needs to show the dot and the WHOLE name (the name itself is never shrunk or cut).
  function pullLeft(mem) {
    var link = mem.querySelector('a[href*="profiles.php?XID="]');
    if (!link) return 0;
    var cell = box(mem), lb = box(link), dot = null, dotRight = cell.left;
    // the online dot / small icons left of the name (they can sit in the same wrapper as the name)
    var all = mem.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e === link || e.contains(link) || link.contains(e)) continue;
      var b = box(e);
      if (!(b.width > 0) || b.width > 40 || b.right > lb.left + 1) continue;
      if (b.right > dotRight) { dotRight = b.right; dot = e; }
    }
    // move only the name: the highest wrapper of the name that doesn't also hold the dot
    var slide = link;
    while (slide.parentElement && slide.parentElement !== mem && !(dot && slide.parentElement.contains(dot))) slide = slide.parentElement;
    var gap = Math.round(lb.left - dotRight - 4);
    if (!(gap > 2)) gap = 0;
    else if (!slide.getAttribute("data-gdb-slid")) { slide.setAttribute("data-gdb-slid", "1"); slide.style.transform = "translateX(-" + gap + "px)"; }
    return Math.ceil(lb.right - gap - cell.left + 6); // right edge of the name after sliding, plus a little room
  }
  function setW(el, w) { el.style.cssText += ";width:" + w + "px;max-width:" + w + "px;flex:0 0 " + w + "px"; }
  function wideRow(row, H) {
    var pc = row.getAttribute("data-gdb-pc") === "1" ? row.querySelector('[data-gdb="1"]') : under(row, H.px);
    if (!pc) return null;
    if (pc.getAttribute("data-gdb") !== "1") {
      var dc = under(row, H.dx);
      if (!dc || dc === pc) return null;
      // the badge's room goes to the Timer/Dibs columns: names pulled left, member column narrowed to fit them
      var mem = memberCell(row), mw = mem ? box(mem).width : 0;
      if (mem && H.mx == null) H.mx = box(mem).left;
      var keepBadge = get("badge") === "1";
      if (!keepBadge) hideBadge(row);
      var need = mem && !keepBadge ? pullLeft(mem) : 0;
      // the column is trimmed to fit the dot and the whole name (measured on the first row)
      if (mem && H.give == null) H.give = !keepBadge && need > 60 && need < mw - 8 ? Math.round(mw - need) : 0;
      // honor-bar names are all the same size, so every row (and the header) gets the same trim
      var give = mem && H.give && mw - H.give > 60 ? H.give : 0;
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
    if (H.give && H.mx != null && hr) {
      var hm = under(hr, H.mx), hw = hm ? box(hm).width : 0;
      if (hm && hw - H.give > 60) { setW(hm, hw - H.give); give = H.give; }
    }
    var w = H.w + give;
    H.d.style.display = "none";
    setW(H.p, w);
    H.p.innerHTML = '<span class="gdb-tcol gdb-h gdb-sort" data-gdb-sort="1"></span><span class="gdb-dcol gdb-h">Dibs</span>';
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
        if (a.closest('[class*="chat"], #gdb-panel, #gdb-called, #gdb-bar, #gdb-prof, .gdb-psec, [id^="tws-"], [class*="tws-"], [id^="kwr-"], [class*="kwr-"]')) continue;
        var holder, row = a.closest("li") || a.closest("tr");
        if (get("cols") !== "1") H = H || memberHeader(a);
        var cellEl = H && row ? wideRow(row, H) : null;
        if (cellEl) {
          // enemy faction page: Position + Days make room for the timer and Call button
          wideHeader(H);
          Array.prototype.forEach.call(row.parentElement.children, function (r) { wideRow(r, H); });
          var olds = row.querySelectorAll(".gdb-cell.gdb-in-status, .gdb-cell:not(.gdb-wide)");
          for (var o = 0; o < olds.length; o++) if (!cellEl.contains(olds[o])) olds[o].remove();
          if (cellEl.querySelector(".gdb-cell")) continue;
          holder = document.createElement("span"); holder.className = "gdb-cell gdb-wide"; holder.setAttribute("data-gdb-id", id);
          cellEl.appendChild(holder);
          continue;
        }
        // other faction lists (the war page): in the row's Status cell
        if (H) continue; // this page has the Timer/Dibs columns: no second button
        row = row || a.parentElement;
        if (!row || row.querySelector('.gdb-cell[data-gdb-id="' + id + '"]')) continue;
        holder = document.createElement("span"); holder.className = "gdb-cell"; holder.setAttribute("data-gdb-id", id);
        var cells = row.querySelectorAll('[class*="status"]'), stc = null;
        for (var c = cells.length - 1; c >= 0; c--) {
          if (/okay|hospital|travel|abroad|jail|fallen|fedded|federal|\d+:\d+/i.test(cells[c].textContent) && !cells[c].querySelector('[class*="status"]')) { stc = cells[c]; break; }
        }
        if (stc) { holder.className += " gdb-in-status" + (get("cols") === "1" && /step=profile/i.test(location.href) ? " gdb-full" : ""); stc.insertBefore(holder, stc.firstChild); }
        else a.insertAdjacentElement("afterend", holder);
      }
    }
  }

  // ---- your own call: in the Dibs Caller bar, or pinned at the bottom of the screen where there's no bar ----
  function called() {
    var el = document.getElementById("gdb-called"), bar = document.querySelector(".gdb-host");
    // War Room shows your call at the top of its own list, so no second one when it's on the page
    var wr = document.querySelector('[id^="tws-"], [class*="tws-row"]');
    var d = active() && !wr ? (S.st.dibs || []).filter(function (x) { return x.by === ME.pid; })[0] : null;
    if (!d) { if (el) el.remove(); return; }
    var home = bar ? bar.querySelector(".gdb-bc") : document.body;
    if (el && el.parentNode !== home) { el.remove(); el = null; }
    if (!el) { el = document.createElement("div"); el.id = "gdb-called"; home.appendChild(el); el.__h = ""; }
    el.className = bar ? "gdb-inbar" : "";
    var t = (S.st.targets && S.st.targets[String(d.t)]) || ["#" + d.t], now = nowS(), left = timer(t, now);
    var line = left != null ? (t[1] === "Traveling" ? "lands in ~" : "out in ") + dur(left) : d.outAt ? "hit within " + dur((S.st.holdSec || 180) - (now - d.outAt)) : "out now";
    var h = '<span class="gdb-ct">\u270b Called: <b>' + esc(t[0]) + "</b><br><small>" + line + " \u00b7 called " + tms(d.ms) + leftTxt(d.leftMs) + "</small></span>"
      + '<a class="gdb-btn gdb-atk" href="https://www.torn.com/loader.php?sid=attack&user2ID=' + d.t + '">ATK</a><button class="gdb-btn gdb-un" data-gdb-rel="' + d.t + '">\u21a9 Uncall</button>';
    // slow flash while the target's showing Online (kept in step when it's redrawn)
    var onl = t[3] === "on";
    if (onl) h = h.replace("</b><br>", '</b> <span class="gdb-onltag">\ud83d\udfe2 Online</span><br>');
    var dl = onl ? (-(Date.now() % 2400)) + "ms" : "";
    el.classList.toggle("gdb-onl", onl); el.style.animationDelay = dl;
    if (el.__h !== h) { el.__h = h; el.innerHTML = h; }
    var tag = el.querySelector(".gdb-onltag"); if (tag) tag.style.animationDelay = dl; // in step with the box
  }

  function tick() {
    poll();
    attach();
    var cells = document.querySelectorAll(".gdb-cell[data-gdb-id]");
    for (var i = 0; i < cells.length; i++) {
      var h = active() && ME ? cellFor(cells[i]) : "";
      if (cells[i].__h !== h) { cells[i].__h = h; cells[i].innerHTML = h; }
    }
    ui();
    sortRows();
    if (ME) called(); else { var c = document.getElementById("gdb-called"); if (c) c.remove(); }
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

  // ---- Dibs Caller bar: fixed under Faction Description (faction pages) or the Dibs section above Actions
  // (profiles). Both can be minimised; settings and sign-in live inside. Elsewhere: a small round button. ----
  function statusTxt() {
    if (!ME) return "Not signed in";
    var st = S.st;
    if (st) return st.on ? "ON vs " + esc(st.enemyName || ("#" + st.enemyF)) : "Switched off";
    return S.err ? "Not available" : "Checking\u2026";
  }
  function bodyHtml() {
    var st = S.st;
    return (ME
      ? '<div>Signed in as <b>' + esc(ME.name) + '</b> [' + ME.pid + ']</div><div class="gdb-s">'
        + (st ? (st.on ? "Dibs is ON against <b>" + esc(st.enemyName || ("#" + st.enemyF)) + "</b>." : "Dibs is switched off.") : (S.err ? "Not available: " + esc(S.err) : "Checking\u2026"))
        + '</div>'
      : '<div class="gdb-s">Sign in with your Torn API key (Public is enough). It is checked once by the Glory Command server and not stored.</div>'
        + '<input class="gdb-key" maxlength="16" placeholder="API key" autocomplete="off"><button class="gdb-btn" data-gdb-in="1">Sign in</button><div class="gdb-msg"></div>')
      + '<div class="gdb-set"><b>Settings</b><label class="gdb-opt"><input type="checkbox" data-gdb-opt="timers"' + (get("timers") === "0" ? "" : " checked") + '> Show timers <i>(turn off if another script already shows them)</i></label>'
        + '<label class="gdb-opt"><input type="checkbox" data-gdb-opt="badge"' + (get("badge") === "1" ? " checked" : "") + '> Show faction badges on member lists <i>(reloads the page)</i></label>'
        + '<label class="gdb-opt"><input type="checkbox" data-gdb-opt="cols"' + (get("cols") === "1" ? " checked" : "") + '> Keep Position and Days columns <i>(timer and Call go in the Status column; no timer sort; reloads the page)</i></label></div>'
      + '<div class="gdb-s" style="margin-top:6px">Calls: hospital and flight timers only, from 5:59 down to 0:16. The first call to reach the server wins. Tap <b>Timer</b> on the member list to sort by it.</div>'
      + (ME ? '<button class="gdb-btn gdb-un" data-gdb-out="1">Sign out</button>' : "");
  }
  // a heading by its text, searched through the page's text (cheap); returns its outermost box with only that text
  function heading(text, skip) {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n, hit = null;
    while ((n = w.nextNode())) if (n.nodeValue.indexOf(text) >= 0 && n.nodeValue.replace(/\s+/g, " ").trim() === text && !(skip && n.parentElement && n.parentElement.closest(skip))) { hit = n.parentElement; break; }
    if (!hit) return null;
    while (hit.parentElement && hit.parentElement !== document.body && (hit.parentElement.textContent || "").replace(/\s+/g, " ").trim() === text) hit = hit.parentElement;
    return hit;
  }
  var anchorAt = 0;
  function descAnchor() {
    if (!/factions\.php/.test(location.href)) return null;
    var a = heading("Faction Description", "#gdb-bar");
    if (!a) return null;
    // the header and its description usually share a small wrapper: put the bar after the whole thing
    var p = a.parentElement;
    if (p && p !== document.body && p.children.length <= 3 && !p.querySelector('.table-body, .members-list, [class*="members"], [class*="ffscouter" i]')) a = p;
    return a;
  }
  function bar() {
    var b = document.getElementById("gdb-bar");
    if (!b || !b.isConnected) {
      if (!/factions\.php/.test(location.href) || Date.now() - anchorAt < 1500) return null; anchorAt = Date.now();
      var an = descAnchor();
      if (!an) return null;
      if (!b) {
        b = document.createElement("div"); b.id = "gdb-bar"; b.className = "gdb-host";
        b.innerHTML = '<div class="gdb-bh" data-gdb-tog="1"><span class="gdb-bt">\u270b Dibs Caller</span><span class="gdb-bst"></span><span class="gdb-chev"></span></div><div class="gdb-body"><div class="gdb-bc"></div><div class="gdb-bb"></div></div>';
      }
      an.parentNode.insertBefore(b, an.nextSibling);
    }
    return b;
  }
  // profiles: a "Dibs Caller" section just above Actions, in Torn's own style, with the Call button in its title bar
  var profAt = 0;
  function profBar() {
    var pm = location.href.match(/profiles\.php\?XID=(\d+)/i);
    if (!pm) return null;
    var sec = document.querySelector(".gdb-psec");
    if (sec && sec.isConnected) return sec;
    if (Date.now() - profAt < 1500) return null; profAt = Date.now();
    var act = heading("Actions", ".gdb-psec"), wrap = act;
    while (wrap && wrap.parentElement && !wrap.querySelector('a[href*="sid=attack"], button, [class*="button"]')) wrap = wrap.parentElement;
    if (!act || !wrap || !wrap.parentElement || wrap === document.body) return null;
    var title = act; while (title.parentElement !== wrap) title = title.parentElement;
    sec = wrap.cloneNode(false); sec.className += " gdb-psec gdb-host"; sec.removeAttribute("id");
    var t2 = title.cloneNode(false); t2.removeAttribute("id"); t2.className += " gdb-pbar"; t2.setAttribute("data-gdb-tog", "1");
    t2.innerHTML = '<span class="gdb-pt">\u270b Dibs Caller</span><span class="gdb-bst"></span><span class="gdb-cell gdb-pcell" data-gdb-id="' + pm[1] + '"></span><span class="gdb-chev"></span>';
    var src = null; for (var i = 0; i < wrap.children.length; i++) if (wrap.children[i] !== title) { src = wrap.children[i]; break; }
    var body = src ? src.cloneNode(false) : document.createElement("div"); body.removeAttribute("id");
    body.className += " gdb-body gdb-pbody"; body.innerHTML = '<div class="gdb-bc"></div><div class="gdb-bb"></div>';
    sec.appendChild(t2); sec.appendChild(body);
    wrap.parentElement.insertBefore(sec, wrap);
    return sec;
  }
  function ui() {
    var b = bar() || profBar(), f = document.getElementById("gdb-fab");
    if (b) {
      if (f) f.remove();
      var pn = document.getElementById("gdb-panel"); if (pn) pn.remove();
      var min = get("min") === "1";
      b.classList.toggle("gdb-min", min);
      ["gdb-on", "gdb-idle", "gdb-out"].forEach(function (c) { b.classList.remove(c); });
      b.classList.add(!ME ? "gdb-out" : active() ? "gdb-on" : "gdb-idle");
      var st = b.querySelector(".gdb-bst"), h = statusTxt(), prof = b.classList.contains("gdb-psec");
      // profiles: just the coloured dot (the Call button needs the room)
      if (st.__h !== h) { st.__h = h; st.innerHTML = prof ? "" : h; st.title = h.replace(/<[^>]+>/g, ""); }
      b.querySelector(".gdb-chev").textContent = min ? "\u25b8" : "\u25be";
      var body = b.querySelector(".gdb-bb"), bh = bodyHtml();
      if (body.__h !== bh) { body.__h = bh; body.innerHTML = bh; }
      // minimised with no call to show: no empty box under the title
      var bx = b.querySelector(".gdb-body"), show = !min || !!b.querySelector(".gdb-bc").firstChild;
      if (bx.style.display !== (show ? "" : "none")) bx.style.display = show ? "" : "none";
      return;
    }
    // no bar on this page: the small round button
    if (!f) { f = document.createElement("div"); f.id = "gdb-fab"; f.title = "Dibs Caller"; f.onclick = panel; document.body.appendChild(f); }
    f.textContent = "\u270b"; var fc = !ME ? "out" : active() ? "on" : "idle"; if (f.className !== fc) f.className = fc;
  }
  function panel() {
    var p = document.getElementById("gdb-panel");
    if (p) { p.remove(); return; }
    p = document.createElement("div"); p.id = "gdb-panel";
    p.innerHTML = '<b>\u270b Dibs Caller</b> <span class="gdb-x" data-gdb-close="1">\u2715</span>' + bodyHtml();
    document.body.appendChild(p);
  }
  function refresh() { var p = document.getElementById("gdb-panel"); if (p) p.remove(); var b = document.querySelector(".gdb-host .gdb-bb"); if (b) b.__h = ""; ui(); tick(); }

  // ---- sort the member list by timer (tap the Timer header: soonest first, latest first, off) ----
  var sortAt = 0;
  function sortKey(row) {
    var a = row.querySelector('a[href*="profiles.php?XID="]'), t = a && S.st && S.st.targets && S.st.targets[idOf(a)];
    var left = t ? timer(t, nowS()) : null;
    return left == null ? null : left;
  }
  // The order is set by our own style sheet with !important (each row gets a rank), so it holds even when
  // another script (FFScouter) or Torn moves the rows or sets its own order on them.
  var rankCss = null;
  function rankSheet(n) {
    if (rankCss && rankCss.__n >= n) return;
    if (!rankCss) { rankCss = document.createElement("style"); document.head.appendChild(rankCss); }
    var r = [".gdb-sorted{display:flex!important;flex-direction:column!important}"];
    for (var i = 0; i < n; i++) r.push('.gdb-sorted>[data-gdb-rank="' + i + '"]{order:' + i + "!important}");
    rankCss.textContent = r.join("\n"); rankCss.__n = n;
  }
  function sortRows() {
    var mode = get("sort") || "";
    if (HDR && HDR.p.isConnected) {
      var lb = HDR.p.querySelector(".gdb-sort");
      var txt = (get("timers") === "0" ? "Sort" : "Timer") + " " + (mode === "asc" ? "\u25b2" : mode === "desc" ? "\u25bc" : "\u21c5");
      if (lb && lb.textContent !== txt) lb.textContent = txt;
    }
    if (!active() || Date.now() - sortAt < 500) return;
    sortAt = Date.now();
    var one = document.querySelector('[data-gdb-pc="1"]'), list = one && one.parentElement;
    if (!list) return;
    var rows = Array.prototype.slice.call(list.children);
    if (!mode) {
      if (list.classList.contains("gdb-sorted")) { list.classList.remove("gdb-sorted"); rows.forEach(function (r) { r.removeAttribute("data-gdb-rank"); }); }
      return;
    }
    // ties and rows without a timer keep the page's current order (whatever another script left)
    var k = rows.map(function (r, i) { return { r: r, i: i, v: sortKey(r) }; });
    k.sort(function (x, y) {
      if (x.v == null && y.v == null) return x.i - y.i;
      if (x.v == null) return 1; if (y.v == null) return -1; // no timer: at the bottom
      return (mode === "asc" ? x.v - y.v : y.v - x.v) || x.i - y.i;
    });
    rankSheet(Math.max(100, k.length + 20));
    k.forEach(function (x, n) { if (x.r.getAttribute("data-gdb-rank") !== String(n)) x.r.setAttribute("data-gdb-rank", String(n)); });
    if (!list.classList.contains("gdb-sorted")) list.classList.add("gdb-sorted");
  }

  // Whichever sort was picked last wins: picking a sort in FFScouter's controls or on another column
  // header turns ours off (the rows go back to that order); tapping Timer again puts ours back on.
  var SORTY = /sort|order|asc|desc|\u2191|\u2193|\u25b2|\u25bc|\u21c5|\u2b06|\u2b07/i;
  function ffsBox(t) {
    var b = t.closest('[class*="ffs" i], [id*="ffs" i], [class*="scouter" i], [id*="scouter" i]');
    if (b) return b;
    // a box whose text starts with FFScouter's title, and that isn't the member list itself
    for (var e = t, i = 0; e && e !== document.body && i < 8; e = e.parentElement, i++) {
      if (e.querySelectorAll('a[href*="profiles.php?XID="]').length > 2) return null;
      if (/^\W{0,3}FFScouter/i.test((e.textContent || "").trim().slice(0, 40))) return e;
    }
    return null;
  }
  function otherSort(t) {
    if (!get("sort") || !t.closest || t.closest("[data-gdb-sort], .gdb-host, #gdb-panel")) return;
    // another column header of the member list
    if (HDR && HDR.p.isConnected && HDR.p.parentElement && HDR.p.parentElement.contains(t) && !HDR.p.contains(t) && !t.closest('[class*="search" i], input')) { off(); return; }
    var box = ffsBox(t);
    if (!box) return;
    var c = t.closest("button, a, select, option, input, label, [role=button], li, span") || t;
    var txt = [c.textContent, c.getAttribute && c.getAttribute("title"), c.getAttribute && c.getAttribute("aria-label"), c.name, c.id, c.className, c.value].join(" ");
    if (SORTY.test(txt)) off();
    function off() { set("sort", ""); sortAt = 0; sortRows(); }
  }
  document.addEventListener("change", function (e) { if (e.target.tagName === "SELECT" || e.target.type === "radio") otherSort(e.target); }, true);
  document.addEventListener("click", function (e) { otherSort(e.target); }, true);
  // Timer header: sort. Kept from Torn, so Torn's own column sorting doesn't run.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest || !t.closest("[data-gdb-sort]")) return;
    e.preventDefault(); e.stopPropagation();
    var m = get("sort") || ""; set("sort", m === "" ? "asc" : m === "asc" ? "desc" : ""); sortAt = 0; sortRows();
  }, true);
  document.addEventListener("change", function (e) {
    var o = e.target.closest && e.target.closest("[data-gdb-opt]");
    if (!o) return;
    var k = o.getAttribute("data-gdb-opt");
    set(k, o.checked ? "1" : "0");
    if (k === "badge" || k === "cols") { location.reload(); return; } // the member list has to be laid out again
    tick();
  });
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("[data-gdb-tog]") && !t.closest("button, a, input, label, .gdb-cell")) { set("min", get("min") === "1" ? "0" : "1"); ui(); return; }
    if (t.closest("[data-gdb-close]")) { var p = document.getElementById("gdb-panel"); if (p) p.remove(); return; }
    if (t.closest("[data-gdb-out]")) { ME = null; set("me", null); S.st = null; refresh(); return; }
    var bt = t.closest("[data-gdb-in]");
    if (!bt) return;
    var box = bt.parentNode, k = box.querySelector(".gdb-key").value.trim(), m = box.querySelector(".gdb-msg");
    if (!/^[A-Za-z0-9]{16}$/.test(k)) { m.textContent = "That doesn't look like a Torn API key."; return; }
    bt.textContent = "Checking\u2026";
    post({ op: "keyLogin", key: k }).then(function (j) {
      bt.textContent = "Sign in";
      if (!j || !j.pass) { m.textContent = (j && j.error) || "Sign-in failed"; return; }
      ME = { pid: j.pid, name: j.name, f: j.f, pass: j.pass, exp: j.exp }; set("me", JSON.stringify(ME));
      S.denied = 0; S.last = 0; refresh();
    }).catch(function () { bt.textContent = "Sign in"; m.textContent = "Could not reach the server."; });
  });

  var css = document.createElement("style");
  css.textContent = [
    ".gdb-cell{display:inline-flex;align-items:center;gap:4px;margin-left:6px;vertical-align:middle;font:bold 11px Arial,sans-serif}",
    ".gdb-cell:empty{display:none}",
    ".gdb-cell.gdb-in-status{margin:0 4px 0 0}",
    ".gdb-cell.gdb-wide{margin:0;gap:0;font-size:12px;width:100%;display:flex;align-items:center}",
    ".gdb-tcol{display:block;flex:none;width:calc(100% - 96px);text-align:left;padding-left:6px;box-sizing:border-box;white-space:nowrap}",
    ".gdb-tcol .gdb-tm{display:inline}",
    ".gdb-dcol{display:flex;flex:none;width:96px;align-items:center;justify-content:flex-end;padding-right:6px;box-sizing:border-box;white-space:nowrap}",
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
    "#gdb-called{position:fixed;left:8px;right:8px;bottom:8px;z-index:99998;display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid #22c55e;border-radius:8px;background:#0f2a1c;color:#d1fae5;font:12px Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.5)}",
    "#gdb-called .gdb-ct{flex:1}#gdb-called small{color:#9ad9b5}#gdb-called .gdb-btn{font-size:13px;padding:7px 12px}",
    "#gdb-called.gdb-inbar{position:static;left:auto;right:auto;bottom:auto;z-index:auto;margin:0;border-radius:0;border-width:1px 0 0;box-shadow:none}",
    "#gdb-called.gdb-onl{animation:gdbOnl 2.4s ease-in-out infinite}",
    "@keyframes gdbOnl{0%,100%{border-color:#22c55e;background:#0f2a1c}50%{border-color:#ef4444;background:#3d1414}}",
    ".gdb-onltag{font-size:11px;font-weight:bold;color:#fff;animation:gdbOnlTag 2.4s ease-in-out infinite}",
    "@keyframes gdbOnlTag{0%,100%{opacity:.45;text-shadow:none}50%{opacity:1;text-shadow:0 0 6px #fff,0 0 2px #fff}}",
    "#gdb-bar{margin:10px 0;border-radius:5px;overflow:hidden;background:#2e2e2e;color:#ddd;font:12px Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.4)}",
    "#gdb-bar .gdb-bh{display:flex;align-items:center;gap:8px;padding:0 12px;height:34px;cursor:pointer;background:linear-gradient(#555,#333);color:#fff;font:bold 13px Arial,sans-serif;-webkit-user-select:none;user-select:none}",
    ".gdb-host .gdb-bt,.gdb-host .gdb-pt{flex:none}.gdb-host .gdb-bst{flex:1;text-align:right;font-weight:normal;font-size:12px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".gdb-host .gdb-bst::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:#888;vertical-align:0}",
    ".gdb-host.gdb-on .gdb-bst::before{background:#2dd4bf}.gdb-host.gdb-idle .gdb-bst::before{background:#f59e0b}.gdb-host.gdb-out .gdb-bst::before{background:#ef4444}",
    ".gdb-host .gdb-chev{flex:none;width:12px;text-align:center;color:#ccc}",
    ".gdb-host [data-gdb-tog]{cursor:pointer;-webkit-user-select:none;user-select:none}",
    ".gdb-host .gdb-bb{padding:8px 12px 10px;font:12px Arial,sans-serif;color:#ddd}.gdb-host.gdb-min .gdb-bb{display:none}",
    ".gdb-host .gdb-s{color:#aaa;font-size:12px;margin:6px 0}",
    ".gdb-host input.gdb-key,#gdb-panel input.gdb-key{width:100%;max-width:260px;box-sizing:border-box;margin:4px 8px 4px 0;padding:6px;background:#1b1b1b;color:#eee;border:1px solid #444;border-radius:5px;display:block}",
    ".gdb-host .gdb-bb .gdb-btn{font-size:13px;padding:6px 12px}.gdb-host .gdb-msg,#gdb-panel .gdb-msg{color:#ff8a8a;font-size:12px;margin-top:4px}",
    ".gdb-set{margin:8px 0;padding:6px 0;border-top:1px solid #444;border-bottom:1px solid #444}.gdb-opt{display:flex;align-items:center;gap:6px;margin-top:4px;cursor:pointer}.gdb-opt i{color:#999;font-style:normal}",
    ".gdb-pbody{padding:0!important;min-height:0!important;height:auto!important}",
    ".gdb-sort{cursor:pointer;-webkit-user-select:none;user-select:none}",
    "#gdb-fab{position:fixed;right:10px;bottom:70px;z-index:99999;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;background:#161b26;border:2px solid #555;box-shadow:0 2px 8px rgba(0,0,0,.5)}",
    "#gdb-fab.on{border-color:#2dd4bf}#gdb-fab.idle{border-color:#f59e0b}#gdb-fab.out{border-color:#ef4444}",
    "#gdb-panel{position:fixed;right:10px;bottom:115px;z-index:99999;width:270px;background:#161b26;color:#eee;border:1px solid #333;border-radius:10px;padding:10px;font:13px Arial,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.6)}",
    "#gdb-panel .gdb-x{float:right;cursor:pointer;color:#aaa}#gdb-panel .gdb-s{color:#aaa;font-size:12px;margin:6px 0}",
    "#gdb-panel input{width:100%;box-sizing:border-box;margin:4px 0;padding:6px;background:#0b0f17;color:#eee;border:1px solid #333;border-radius:6px}",
    "#gdb-panel .gdb-btn{font-size:13px;padding:6px 12px}#gdb-panel input.gdb-key{display:block}",
    "#gdb-toast{display:none;position:fixed;left:8px;right:8px;top:8px;z-index:100000;padding:10px 12px;border-radius:8px;background:#222;color:#fff;font:13px Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.6)}",
    "#gdb-toast.ok{background:#0f3d2a}#gdb-toast.bad{background:#4a1515}#gdb-toast.warn{background:#4a3410}"
  ].join("\n");
  document.head.appendChild(css);
  ui();
  setInterval(tick, 250);
  tick();
})();
