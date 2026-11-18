/* =====================================================================
   VIRTUELLER PC — Desktop mit Symbolen, Fenstern (verschieben,
   minimieren, maximieren, schließen), Taskleiste und Startmenü.
   Programme: Datei-Explorer (eine Instanz) und Word (beliebig viele).
   ===================================================================== */
window.KL = window.KL || {};

KL.pc = (() => {
  "use strict";
  const esc = (s) => KL.util.esc(s);

  // ctx = { fs, T (Tracker), speichereZustand() }
  function mount(host, ctx) {
    const fs = ctx.fs, T = ctx.T;
    host.innerHTML = `
      <div class="pc" tabindex="-1">
        <div class="pc-desk">
          <div class="pc-icons"></div>
          <div class="pc-wins"></div>
          <div class="pc-meldung" hidden></div>
        </div>
        <div class="pc-start" hidden>
          <input class="pc-start-suche" placeholder="Zum Suchen hier eingeben" spellcheck="false">
          <div class="pc-start-titel">Angeheftet</div>
          <div class="pc-start-grid"></div>
          <div class="pc-start-fuss"><span>👤 ${esc(ctx.benutzer || "Redaktion")}</span><span>⏻</span></div>
        </div>
        <div class="pc-bar">
          <button type="button" class="pc-startbtn" title="Start">⊞</button>
          <button type="button" class="pc-pin" data-app="explorer" title="Datei-Explorer">📁</button>
          <div class="pc-tasks"></div>
          <div class="pc-tray"><span>🔈</span><span>📶</span><div class="pc-uhr"></div></div>
        </div>
      </div>`;
    const pc = host.querySelector(".pc");
    const desk = pc.querySelector(".pc-desk");
    const winsEl = pc.querySelector(".pc-wins");
    const iconsEl = pc.querySelector(".pc-icons");
    const tasksEl = pc.querySelector(".pc-tasks");
    const startEl = pc.querySelector(".pc-start");
    const meldungEl = pc.querySelector(".pc-meldung");
    const uhrEl = pc.querySelector(".pc-uhr");

    const APPS = [
      { id: "word", name: "Word", icon: "📘", an: true },
      { id: "explorer", name: "Datei-Explorer", icon: "📁", an: true },
      { id: "edge", name: "Microsoft Edge", icon: "🌐" },
      { id: "rechner", name: "Rechner", icon: "🧮" },
      { id: "editor", name: "Editor", icon: "📝" },
      { id: "einstellungen", name: "Einstellungen", icon: "⚙️" },
      { id: "fotos", name: "Fotos", icon: "🖼️" },
      { id: "outlook", name: "Outlook", icon: "📧" },
    ];

    const fenster = []; // { id, typ, el, titel, icon, min, max, comp }
    let zTop = 10, seq = 1, aktiv = null;
    let explorer = null;

    // ---------- Meldungen ----------
    let mTimer = null;
    function meldung(text) {
      meldungEl.textContent = text;
      meldungEl.hidden = false;
      clearTimeout(mTimer);
      mTimer = setTimeout(() => { meldungEl.hidden = true; }, 4000);
    }

    // ---------- Uhr ----------
    function uhr() {
      const d = new Date(), p = (x) => String(x).padStart(2, "0");
      uhrEl.innerHTML = `${p(d.getHours())}:${p(d.getMinutes())}<br>${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
    }
    uhr();
    const uhrTimer = setInterval(uhr, 15000);

    // ---------- Desktop-Symbole ----------
    let iconSel = null;
    function icons() {
      const liste = [{ id: "pc", name: "Dieser PC", icon: "🖥️" }, { id: "papierkorb", name: "Papierkorb", icon: fs.nodes.papierkorb.kinder.length ? "🗑️" : "🗑️" }]
        .concat(fs.nodes.desktop.kinder.map((id) => fs.nodes[id]).filter(Boolean).map((n) => ({ id: n.id, name: n.name, icon: KL.fs.icon(n) })));
      iconsEl.innerHTML = liste.map((x) => `<div class="pc-icon${iconSel === x.id ? " sel" : ""}" data-id="${x.id}" title="${esc(x.name)}"><span>${x.icon}</span>${esc(x.name)}</div>`).join("");
    }
    // Nur Markierung umschalten (kein Neuaufbau – sonst geht der Doppelklick verloren)
    function zeigeIconAuswahl() { iconsEl.querySelectorAll(".pc-icon").forEach((x) => x.classList.toggle("sel", x.dataset.id === iconSel)); }
    iconsEl.addEventListener("click", (e) => {
      const i = e.target.closest(".pc-icon");
      iconSel = i ? i.dataset.id : null;
      zeigeIconAuswahl();
    });
    iconsEl.addEventListener("dblclick", (e) => {
      const i = e.target.closest(".pc-icon");
      if (!i) return;
      const n = fs.nodes[i.dataset.id];
      if (!n) return;
      T.ereignis("desktop:doppelklick");
      if (n.kinder || n.typ === "pc" || n.typ === "papierkorb") oeffneExplorer(n.id);
      else oeffneDatei(n.id);
    });
    desk.addEventListener("mousedown", (e) => {
      if (e.target === desk || e.target === iconsEl) { iconSel = null; zeigeIconAuswahl(); }
      if (!e.target.closest(".pc-start") && !e.target.closest(".pc-startbtn")) startEl.hidden = true;
    });

    // ---------- Fenster ----------
    function fensterNeu(typ, titel, icon, groesse) {
      const id = "w" + seq++;
      const el = document.createElement("div");
      el.className = "dw";
      el.dataset.id = id;
      const n = fenster.length;
      const W = groesse.w, H = groesse.h;
      const maxW = desk.clientWidth, maxH = desk.clientHeight;
      el.style.width = Math.min(W, maxW - 20) + "px";
      el.style.height = Math.min(H, maxH - 20) + "px";
      el.style.left = Math.max(0, Math.min(40 + n * 28 + (groesse.x || 0), maxW - Math.min(W, maxW - 20))) + "px";
      el.style.top = Math.max(0, Math.min(14 + n * 24, maxH - Math.min(H, maxH - 20))) + "px";
      el.innerHTML = `<div class="dw-titel"><span class="dw-icon">${icon}</span><span class="dw-text">${esc(titel)}</span>
        <div class="dw-btns"><button type="button" data-w="min" title="Minimieren">—</button><button type="button" data-w="max" title="Maximieren">☐</button><button type="button" data-w="zu" class="zu" title="Schließen">✕</button></div></div>
        <div class="dw-body"></div>`;
      winsEl.appendChild(el);
      const f = { id, typ, el, titel, icon, min: false, max: false, comp: null };
      fenster.push(f);
      aktivieren(f);
      return f;
    }
    function aktivieren(f) {
      if (!f) { aktiv = null; taskbar(); return; }
      f.min = false;
      f.el.hidden = false;
      f.el.style.zIndex = ++zTop;
      aktiv = f;
      fenster.forEach((x) => x.el.classList.toggle("aktiv", x === f));
      taskbar();
    }
    function minimieren(f) {
      f.min = true;
      f.el.hidden = true;
      T.ereignis("fenster:min");
      const rest = fenster.filter((x) => !x.min).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex);
      aktivieren(rest[0] || null);
    }
    function maximieren(f) {
      f.max = !f.max;
      f.el.classList.toggle("max", f.max);
      f.el.querySelector('[data-w="max"]').textContent = f.max ? "❐" : "☐";
      T.ereignis(f.max ? "fenster:max" : "fenster:wiederherstellen");
    }
    function schliessen(f, sofort) {
      const zu = () => {
        if (f.comp && f.comp.destroy) f.comp.destroy();
        if (f === explorer) explorer = null;
        f.el.remove();
        fenster.splice(fenster.indexOf(f), 1);
        T.ereignis(`fenster:zu:${f.typ}`);
        const rest = fenster.filter((x) => !x.min).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex);
        aktivieren(rest[0] || null);
        ctx.speichereZustand();
      };
      if (!sofort && f.comp && f.comp.vorSchliessen) f.comp.vorSchliessen(zu); else zu();
    }
    function setzeTitel(f, t) {
      f.titel = t;
      f.el.querySelector(".dw-text").textContent = t;
      taskbar();
    }
    winsEl.addEventListener("mousedown", (e) => {
      const el = e.target.closest(".dw");
      if (!el) return;
      const f = fenster.find((x) => x.el === el);
      if (f && f !== aktiv) aktivieren(f);
      const titel = e.target.closest(".dw-titel");
      if (titel && !e.target.closest("button") && !f.max) {
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY, l = el.offsetLeft, t = el.offsetTop;
        const bewegen = (ev) => {
          el.style.left = Math.max(-el.offsetWidth + 80, Math.min(desk.clientWidth - 80, l + ev.clientX - sx)) + "px";
          el.style.top = Math.max(0, Math.min(desk.clientHeight - 30, t + ev.clientY - sy)) + "px";
        };
        const los = () => { document.removeEventListener("mousemove", bewegen); document.removeEventListener("mouseup", los); T.ereignis("fenster:verschoben"); };
        document.addEventListener("mousemove", bewegen);
        document.addEventListener("mouseup", los);
      }
    });
    winsEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-w]");
      if (!b) return;
      const f = fenster.find((x) => x.el === b.closest(".dw"));
      if (!f) return;
      if (b.dataset.w === "min") minimieren(f);
      else if (b.dataset.w === "max") maximieren(f);
      else schliessen(f);
    });
    winsEl.addEventListener("dblclick", (e) => {
      const t = e.target.closest(".dw-titel");
      if (!t || e.target.closest("button")) return;
      const f = fenster.find((x) => x.el === t.closest(".dw"));
      if (f) maximieren(f);
    });

    // ---------- Taskleiste ----------
    function taskbar() {
      tasksEl.innerHTML = fenster.map((f) => `<button type="button" class="pc-task${f === aktiv && !f.min ? " aktiv" : ""}" data-id="${f.id}" title="${esc(f.titel)}"><span>${f.icon}</span><em>${esc(f.titel.replace(/ – .*$/, ""))}</em></button>`).join("");
    }
    tasksEl.addEventListener("click", (e) => {
      const b = e.target.closest(".pc-task");
      if (!b) return;
      const f = fenster.find((x) => x.id === b.dataset.id);
      if (!f) return;
      T.ereignis("taskleiste:klick");
      if (f === aktiv && !f.min) minimieren(f);
      else { aktivieren(f); if (f.comp && f.comp.fokus) f.comp.fokus(); }
    });
    pc.querySelector(".pc-pin").addEventListener("click", () => { T.ereignis("start:explorer-taskleiste"); oeffneExplorer(null); });

    // ---------- Startmenü ----------
    function startmenue(filter) {
      const q = (filter || "").toLowerCase();
      pc.querySelector(".pc-start-grid").innerHTML = APPS.filter((a) => !q || a.name.toLowerCase().includes(q))
        .map((a) => `<button type="button" class="pc-app${a.an ? "" : " aus"}" data-app="${a.id}"><span>${a.icon}</span>${esc(a.name)}</button>`).join("") || "<p>Keine Ergebnisse</p>";
    }
    pc.querySelector(".pc-startbtn").addEventListener("click", () => {
      startEl.hidden = !startEl.hidden;
      if (!startEl.hidden) { startmenue(""); const s = startEl.querySelector(".pc-start-suche"); s.value = ""; s.focus(); T.ereignis("start:geoeffnet"); }
    });
    startEl.querySelector(".pc-start-suche").addEventListener("input", (e) => startmenue(e.target.value));
    startEl.querySelector(".pc-start-suche").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const b = startEl.querySelector(".pc-app:not(.aus)"); if (b) b.click(); }
      if (e.key === "Escape") startEl.hidden = true;
    });
    startEl.addEventListener("click", (e) => {
      const b = e.target.closest(".pc-app");
      if (!b) return;
      if (b.classList.contains("aus")) { meldung("Dieses Programm wird in der Redaktion heute nicht gebraucht."); return; }
      startEl.hidden = true;
      startEl.querySelector(".pc-start-suche").blur();
      T.ereignis("start:" + b.dataset.app);
      if (b.dataset.app === "word") oeffneWord(null);
      else oeffneExplorer(null);
    });

    // ---------- Programme ----------
    function oeffneExplorer(id) {
      if (explorer) {
        aktivieren(explorer);
        if (id) explorer.comp.navigate(id);
        explorer.comp.fokus();
        return;
      }
      if (id) fs.cwd = id;
      else if (!fs.nodes[fs.cwd]) fs.cwd = "pc";
      const f = fensterNeu("explorer", "Datei-Explorer", "📁", { w: 760, h: 440, x: 0 });
      const body = f.el.querySelector(".dw-body");
      const api = KL.sims.explorer.mount(body, fs, {
        save: () => { icons(); fensterTitelExplorer(); ctx.speichereZustand(); },
        oeffne: (n) => { oeffneDatei(n.id); return true; },
        melde: (op, x) => {
          if (op === "auswahl" && x.art === "leer") x.ordnerAktuell = (x.ordner || "").split("/").pop();
          T.explorer(op, x);
          if (["neu", "umbenennen", "loeschen", "einfuegen", "wiederherstellen", "papierkorb-leeren", "rueckgaengig"].includes(op)) { icons(); ctx.speichereZustand(); }
        },
      });
      f.comp = { destroy: api, navigate: api.navigate, render: api.render, fokus: api.fokus };
      explorer = f;
      fensterTitelExplorer();
      T.explorer("navigiere", { pfad: KL.fs.pfadVon(fs, fs.cwd) });
      api.fokus();
    }
    function fensterTitelExplorer() {
      if (!explorer) return;
      const n = fs.nodes[fs.cwd];
      setzeTitel(explorer, n ? n.name : "Datei-Explorer");
    }
    function oeffneWord(dateiId, opts) {
      opts = opts || {};
      // Datei schon offen? → Fenster nach vorne
      if (dateiId) {
        const offen = fenster.find((f) => f.typ === "word" && f.comp && f.comp.dokument().pfad === KL.fs.pfadVon(fs, dateiId));
        if (offen) { aktivieren(offen); offen.comp.fokus(); return; }
      }
      if (opts.ersetzen) { const alt = fenster.find((f) => f.id === opts.ersetzen); if (alt) schliessen(alt, true); }
      const f = fensterNeu("word", "Word", "📘", { w: 900, h: 560, x: 60 });
      const body = f.el.querySelector(".dw-body");
      f.comp = KL.word.mount(body, {
        datei: dateiId ? fs.nodes[dateiId] : null, fs, T,
        fensterId: f.id,
        pc: {
          titel: (t) => setzeTitel(f, t),
          aktualisieren,
          oeffneDatei: (id, o) => oeffneDatei(id, o),
          schliessen: () => schliessen(f),
          meldung,
          speichereZustand: ctx.speichereZustand,
          zuKurz: ctx.zuKurz,
        },
      });
      if (dateiId) T.ereignis(`word:geoeffnet:${KL.fs.pfadVon(fs, dateiId)}`);
    }
    function oeffneDatei(id, opts) {
      const n = fs.nodes[id];
      if (!n) return;
      if (/\.(docx?|txt)$/i.test(n.name)) oeffneWord(id, opts);
      else meldung(`„${n.name}“ kann in der Redaktion nicht geöffnet werden (${KL.fs.programm(n.name)}).`);
    }
    function aktualisieren() {
      icons();
      if (explorer) explorer.comp.render();
      fensterTitelExplorer();
    }

    icons();
    taskbar();

    return {
      offeneDokumente: () => fenster.filter((f) => f.typ === "word" && f.comp).map((f) => f.comp.dokument()),
      anzahlFenster: () => fenster.length,
      ungespeichert: () => fenster.filter((f) => f.typ === "word" && f.comp && f.comp.dokument().geaendert).length,
      aktualisieren,
      meldung,
      destroy: () => {
        clearInterval(uhrTimer);
        fenster.slice().forEach((f) => { if (f.comp && f.comp.destroy) f.comp.destroy(); });
        host.innerHTML = "";
      },
    };
  }

  return { mount };
})();
