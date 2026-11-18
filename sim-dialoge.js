/* =====================================================================
   DATEI-DIALOG „Speichern unter“ / „Öffnen“ für Word im virtuellen PC
   ===================================================================== */
window.KL = window.KL || {};
KL.sims = KL.sims || {};

KL.dateiDialog = (() => {
  "use strict";
  const { esc } = KL.util;
  const fs = KL.fs;

  // Öffnet einen modalen Datei-Dialog in "overlayHost".
  // opts: { modus:'speichern'|'oeffnen', fsState, start:'dokumente', name, typen:[...], typ, filter:(node)=>bool, onFertig(result), onAbbruch }
  function jetzt() {
    const d = new Date(), p = (x) => String(x).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function open(overlayHost, opts) {
    const S = opts.fsState;
    let cwd = opts.start || "dokumente";
    const verlauf = [];
    let auswahl = null;
    const ov = document.createElement("div");
    ov.className = "fd-overlay";
    ov.innerHTML = `
      <div class="fd" role="dialog">
        <div class="fd-title">${opts.modus === "speichern" ? "Speichern unter" : "Öffnen"}<button type="button" class="fd-x" data-cancel>✕</button></div>
        <div class="fd-addr">
          <button type="button" class="xp-navbtn" data-act="zurueck">←</button>
          <button type="button" class="xp-navbtn" data-act="hoch">↑</button>
          <div class="xp-crumbs fd-crumbs"></div>
          ${opts.modus === "speichern" ? '<button type="button" class="xp-btn fd-newfolder">Neuer Ordner</button>' : ""}
        </div>
        <div class="fd-body">
          <nav class="xp-nav fd-nav"></nav>
          <div class="fd-list"></div>
        </div>
        <div class="fd-foot">
          <label>Dateiname:</label><input type="text" class="xp-input fd-name" spellcheck="false" value="${esc(opts.name || "")}" />
          ${opts.modus === "speichern"
            ? `<label>Dateityp:</label><select class="xp-input fd-typ">${opts.typen.map((t) => `<option ${t === opts.typ ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`
            : `<label></label><select class="xp-input fd-typ" disabled><option>Alle Dateien (*.*)</option></select>`}
          <div class="fd-btns"><button type="button" class="xp-btn primary" data-ok>${opts.modus === "speichern" ? "Speichern" : "Öffnen"}</button><button type="button" class="xp-btn" data-cancel>Abbrechen</button></div>
        </div>
        <div class="xp-toast fd-toast" hidden></div>
      </div>`;
    overlayHost.appendChild(ov);
    const elCrumbs = ov.querySelector(".fd-crumbs");
    const elNav = ov.querySelector(".fd-nav");
    const elList = ov.querySelector(".fd-list");
    const elName = ov.querySelector(".fd-name");
    const elTyp = ov.querySelector(".fd-typ");
    const elToast = ov.querySelector(".fd-toast");
    const N = (id) => S.nodes[id];

    function toast(msg) { elToast.textContent = msg; elToast.hidden = false; setTimeout(() => (elToast.hidden = true), 3000); }

    function render() {
      const chain = [];
      let n = N(cwd);
      while (n) { chain.unshift(n); n = n.eltern ? N(n.eltern) : null; }
      elCrumbs.innerHTML = chain.map((x) => `<button type="button" class="xp-crumb" data-id="${x.id}">${esc(x.name)}</button>`).join('<span class="xp-crumb-sep">›</span>');
      elNav.innerHTML = ["desktop", "dokumente", "downloads", "bilder", "musik", "pc"].filter((id) => N(id))
        .map((id) => `<button type="button" class="xp-navitem ${cwd === id ? "active" : ""}" data-id="${id}">${fs.icon(N(id))} ${esc(N(id).name)}</button>`).join("");
      const kinder = (N(cwd).kinder || []).map(N).filter((x) => x && !(x.typ === "usb" && S.usbAusgeworfen))
        .sort((a, b) => (a.kinder ? 0 : 1) - (b.kinder ? 0 : 1) || a.name.localeCompare(b.name, "de"));
      elList.innerHTML = kinder.length ? `<table class="xp-table"><thead><tr><th>Name</th><th>Änderungsdatum</th><th>Typ</th></tr></thead><tbody>${kinder.map((x) => {
        const passt = x.kinder || !opts.filter || opts.filter(x);
        return `<tr class="xp-row ${auswahl === x.id ? "sel" : ""} ${passt ? "" : "dim"}" data-id="${x.id}"><td class="xp-name"><span class="xp-ico">${fs.icon(x)}</span>${esc(x.name)}</td><td>${esc(x.datum || "")}</td><td>${esc(fs.typText(x))}</td></tr>`;
      }).join("")}</tbody></table>` : '<p class="xp-empty">Dieser Ordner ist leer.</p>';
    }
    function nav(id) {
      if (!N(id) || !N(id).kinder) return;
      if (id !== cwd) verlauf.push(cwd);
      cwd = id; auswahl = null; render();
    }

    ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-cancel]")) { abbrechen(); return; }
      const crumb = e.target.closest(".xp-crumb, .xp-navitem");
      if (crumb) { nav(crumb.dataset.id); return; }
      const act = e.target.closest("[data-act]");
      if (act) {
        if (act.dataset.act === "zurueck") { const p = verlauf.pop(); if (p) { cwd = p; render(); } }
        else if (N(cwd).eltern) nav(N(cwd).eltern);
        return;
      }
      if (e.target.closest(".fd-newfolder")) {
        if (N(cwd).typ === "pc") { toast("Hier kann kein Ordner erstellt werden."); return; }
        const id = "n" + S.seq++;
        let name = "Neuer Ordner", i = 2;
        const namen = new Set(N(cwd).kinder.map((k) => N(k).name));
        while (namen.has(name)) name = `Neuer Ordner (${i++})`;
        S.nodes[id] = { id, name, typ: "ordner", eltern: cwd, kinder: [], datum: jetzt() };
        if (opts.onNeuerOrdner) opts.onNeuerOrdner(id);
        N(cwd).kinder.push(id);
        auswahl = id;
        render();
        const neu = prompt0(ov, "Name des neuen Ordners:", name, (val) => {
          val = (val || "").trim();
          if (val && !/[\\/:*?"<>|]/.test(val) && !N(cwd).kinder.some((k) => k !== id && N(k).name.toLowerCase() === val.toLowerCase())) S.nodes[id].name = val;
          render();
        });
        return neu;
      }
      const row = e.target.closest(".xp-row");
      if (row) {
        auswahl = row.dataset.id;
        const n = N(auswahl);
        if (!n.kinder) elName.value = opts.modus === "speichern" ? n.name.replace(/\.[^.]+$/, "") : n.name;
        // nur Markierung umschalten (kein Neuaufbau, sonst geht der Doppelklick verloren)
        elList.querySelectorAll(".xp-row").forEach((r) => r.classList.toggle("sel", r.dataset.id === auswahl));
        return;
      }
      if (e.target.closest("[data-ok]")) bestaetigen();
    });
    ov.addEventListener("dblclick", (e) => {
      const row = e.target.closest(".xp-row");
      if (!row) return;
      const n = N(row.dataset.id);
      if (n.kinder) nav(n.id);
      else if (opts.modus === "oeffnen") { elName.value = n.name; bestaetigen(); }
    });
    elName.addEventListener("keydown", (e) => {
      e.stopPropagation();
      // preventDefault: Die Enter-/Esc-Taste darf nach dem Schließen nicht im Dokument landen
      if (e.key === "Enter") { e.preventDefault(); bestaetigen(); }
      if (e.key === "Escape") { e.preventDefault(); abbrechen(); }
    });
    ov.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); abbrechen(); } });
    function abbrechen() { ov.remove(); opts.onAbbruch && opts.onAbbruch(); }

    function bestaetigen() {
      const name = elName.value.trim();
      if (!name) { toast("Bitte einen Dateinamen eingeben."); return; }
      if (N(cwd).typ === "pc") { toast("Bitte einen Ordner auswählen."); return; }
      if (opts.modus === "oeffnen") {
        const n = (N(cwd).kinder || []).map(N).find((x) => x.name.toLowerCase() === name.toLowerCase() && !x.kinder);
        if (!n) { toast(`„${name}“ wurde nicht gefunden. Überprüfen Sie den Dateinamen.`); return; }
        ov.remove();
        opts.onFertig({ name: n.name, pfad: fs.pfadVon(S, n.id) });
        return;
      }
      if (/[\\/:*?"<>|]/.test(name)) { toast('Der Dateiname darf keines der Zeichen \\ / : * ? " < > | enthalten.'); return; }
      ov.remove();
      opts.onFertig({ name, ordner: fs.pfadVon(S, cwd), typ: elTyp.value });
    }

    render();
    elName.focus();
    elName.select();
  }

  // kleines Eingabefeld im Dialog statt window.prompt
  function prompt0(host, label, wert, onOk) {
    const box = document.createElement("div");
    box.className = "fd-prompt";
    box.innerHTML = `<label>${esc(label)}</label><input class="xp-input" value="${esc(wert)}" /><div class="fd-btns"><button type="button" class="xp-btn primary">OK</button></div>`;
    host.querySelector(".fd").appendChild(box);
    const inp = box.querySelector("input");
    inp.focus(); inp.select();
    const done = () => { box.remove(); onOk(inp.value); };
    box.querySelector("button").addEventListener("click", (e) => { e.stopPropagation(); done(); });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") done(); });
    inp.addEventListener("click", (e) => e.stopPropagation());
  }

  return { open };
})();

