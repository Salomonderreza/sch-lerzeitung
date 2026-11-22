/* =====================================================================
   SCHÜLERZEITUNG — App-Ablauf
   Profile mit PIN (mehrere Personen pro Laptop), Sitzungen, Aufgaben-
   Checkliste mit automatischer Prüfung, Arbeitsweise und Schreibprotokoll,
   Sitzungsauswertung und PDF-Sitzungsbericht für den Dozenten. Im PDF
   steckt zusätzlich eine signierte Sicherung: Mit dem Bericht lässt sich
   der Stand auf jedem Laptop wieder laden.
   ===================================================================== */
(() => {
  "use strict";
  const C = KL.CONFIG, U = KL.util;
  const { esc } = U;
  const app = document.getElementById("app");

  // ---------- Speicher ----------
  function db() {
    try { const d = JSON.parse(localStorage.getItem(C.SPEICHER_SCHLUESSEL)); if (d && d.profile) return d; } catch (e) { /* leer */ }
    return { profile: {} };
  }
  let DB = db();
  let speicherFehler = false;
  function sichern() {
    try { localStorage.setItem(C.SPEICHER_SCHLUESSEL, JSON.stringify(DB)); speicherFehler = false; } catch (e) { speicherFehler = true; }
  }
  let sichernTimer = null;
  function sichernBald() { clearTimeout(sichernTimer); sichernTimer = setTimeout(sichern, 400); }
  const schluessel = (name) => U.norm(name).toLowerCase();
  const pinHash = (name, pin) => U.sha256(`${C.GEHEIMNIS}|pin|${schluessel(name)}|${pin}`).slice(0, 24);

  let P = null;        // aktuelles Profil
  let ansicht = null;  // { destroy }

  // ---------- Interne Zwischenablage (Einfüge-Sperre) ----------
  const innen = new Set();
  const nz = (t) => U.norm(String(t || "")).replace(/\s+/g, " ");
  KL.intern = {
    merke(t) { t = nz(t); if (t) { innen.add(t); if (innen.size > 300) innen.delete(innen.values().next().value); } },
    kennt(t) { t = nz(t); return !t || innen.has(t); },
  };

  // ---------- Dialog ----------
  function frage(html, ja, nein) {
    return new Promise((res) => {
      const m = document.createElement("div");
      m.className = "kl-modal";
      m.innerHTML = `<div class="kl-modal-box">${html}<div class="kl-modal-btns">${nein ? `<button type="button" class="kl-btn" data-n>${esc(nein)}</button>` : ""}<button type="button" class="kl-btn primary" data-j>${esc(ja)}</button></div></div>`;
      document.body.appendChild(m);
      const inp = m.querySelector("input");
      m.querySelector("[data-j]").onclick = () => { const v = inp ? inp.value : true; m.remove(); res(v); };
      const n = m.querySelector("[data-n]");
      if (n) n.onclick = () => { m.remove(); res(null); };
      if (inp) { inp.focus(); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") m.querySelector("[data-j]").click(); }); }
      else m.querySelector("[data-j]").focus();
    });
  }
  function wechsel(fn) { if (ansicht && ansicht.destroy) ansicht.destroy(); ansicht = null; fn(); }

  // =====================================================================
  // Anmeldung
  // =====================================================================
  function anmeldung() {
    P = null;
    const profile = Object.values(DB.profile).sort((a, b) => a.name.localeCompare(b.name, "de"));
    app.innerHTML = `
      <div class="kl-start"><div class="kl-start-card sz-start">
        <div class="kl-kicker">EDV · Projekt</div>
        <h1>📰 ${esc(C.TITEL)}</h1>
        <p class="kl-sub">${esc(C.UNTERTITEL)} – du arbeitest an einem eigenen Redaktions-PC mit Word und Datei-Explorer.</p>
        ${profile.length ? `<h3>Mein Profil auf diesem Laptop</h3><div class="sz-profile">${profile.map((p) => `<button type="button" class="kl-btn sz-profil" data-k="${esc(schluessel(p.name))}">👤 ${esc(p.name)} <small>${esc(p.klasse)}</small></button>`).join("")}</div>` : ""}
        <div class="sz-start-btns">
          <button type="button" class="kl-btn ${profile.length ? "" : "primary big"}" data-neu>＋ Neues Profil anlegen</button>
          <label class="kl-btn">📂 Stand aus Bericht laden (PDF)<input type="file" accept=".pdf,application/pdf,.szt" hidden></label>
        </div>
        <p class="kl-small">Mehrere Personen können denselben Laptop nutzen – jedes Profil ist mit einer PIN geschützt. Am Ende jeder Sitzung lädst du deinen Sitzungsbericht als PDF herunter und schickst ihn per Mail an deinen Dozenten. Mit diesem PDF kannst du deinen Stand auch an einem anderen Laptop wieder laden.</p>
      </div></div>`;
    app.querySelectorAll(".sz-profil").forEach((b) => b.onclick = async () => {
      const p = DB.profile[b.dataset.k];
      const pin = await frage(`<p><b>${esc(p.name)}</b></p><label class="sz-pinlabel">PIN<input type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="sz-pin"></label>`, "Anmelden", "Abbrechen");
      if (pin === null) return;
      if (pinHash(p.name, pin) !== p.pin) { await frage("<p>Die PIN ist falsch.</p>", "OK"); return; }
      P = p;
      wechsel(uebersicht);
    });
    app.querySelector("[data-neu]").onclick = neuesProfil;
    app.querySelector("input[type=file]").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) ladeSicherung(f); };
  }

  function neuesProfil() {
    app.innerHTML = `
      <div class="kl-start"><div class="kl-start-card sz-start">
        <div class="kl-kicker">Neues Profil</div>
        <h1>Willkommen in der Redaktion</h1>
        <form class="kl-form" autocomplete="off">
          <label>Vor- und Nachname<input name="name" required maxlength="60"></label>
          <label>Klasse / Kurs<input name="klasse" required maxlength="30"></label>
          <label>PIN (4–8 Ziffern)<input name="pin" type="password" inputmode="numeric" required pattern="\\d{4,8}" maxlength="8"></label>
          <label>PIN wiederholen<input name="pin2" type="password" inputmode="numeric" required pattern="\\d{4,8}" maxlength="8"></label>
          <p class="kl-small" style="grid-column:1/-1">Merke dir deine PIN gut – du brauchst sie bei jeder Anmeldung und zum Laden deiner Sicherung.</p>
          <div style="grid-column:1/-1;display:flex;gap:8px"><button type="submit" class="kl-btn primary big">Profil anlegen</button><button type="button" class="kl-btn ghost" data-zurueck>Zurück</button></div>
        </form>
      </div></div>`;
    const f = app.querySelector("form");
    f.name.focus();
    app.querySelector("[data-zurueck]").onclick = anmeldung;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const name = U.norm(f.name.value).replace(/\s+/g, " "), klasse = U.norm(f.klasse.value);
      if (f.pin.value !== f.pin2.value) { await frage("<p>Die beiden PINs stimmen nicht überein.</p>", "OK"); return; }
      if (DB.profile[schluessel(name)]) { await frage("<p>Auf diesem Laptop gibt es schon ein Profil mit diesem Namen. Melde dich dort an oder lade deine Sicherung.</p>", "OK"); return; }
      P = { name, klasse, pin: pinHash(name, f.pin.value), erstellt: Date.now(), daten: { fs: KL.startPC(), sitzungen: {} } };
      DB.profile[schluessel(name)] = P;
      sichern();
      wechsel(uebersicht);
    };
  }

  // ---------- Sicherungsdatei ----------
  function sicherungText(nr) {
    const body = U.b64urlEncode(JSON.stringify({ v: 1, app: "SZ", name: P.name, klasse: P.klasse, pin: P.pin, sitzung: nr, erstellt: Date.now(), daten: P.daten }));
    return `SZ1.${body}.${U.sha256(C.GEHEIMNIS + "|" + body).slice(0, 16)}`;
  }
  KL.leseSicherung = function (text) {
    const m = /SZ1\.([A-Za-z0-9_-]+)\.([0-9a-f]{16})/.exec(String(text).replace(/\s+/g, ""));
    if (!m) return { fehler: "In dieser Datei steckt kein Sitzungsbericht der Schülerzeitung." };
    let daten = null;
    try { daten = JSON.parse(U.b64urlDecode(m[1])); } catch (e) { return { fehler: "Die Datei ist beschädigt." }; }
    const gueltig = U.sha256(C.GEHEIMNIS + "|" + m[1]).slice(0, 16) === m[2];
    return { daten, gueltig };
  };
  async function ladeSicherung(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let roh = "";
    for (let i = 0; i < buf.length; i += 8192) roh += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    const r = KL.leseSicherung(roh);
    if (r.fehler) { await frage(`<p>${esc(r.fehler)}</p>`, "OK"); return; }
    if (!r.gueltig) { await frage("<p><b>Die Datei wurde verändert</b> und kann nicht geladen werden.</p>", "OK"); return; }
    const d = r.daten;
    const pin = await frage(`<p>Sicherung von <b>${esc(d.name)}</b> (${esc(d.klasse)}), Sitzung ${d.sitzung}, ${U.fmtDatum(d.erstellt)} ${U.fmtZeit(d.erstellt)} Uhr</p><label class="sz-pinlabel">PIN<input type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="sz-pin"></label>`, "Laden", "Abbrechen");
    if (pin === null) return;
    if (pinHash(d.name, pin) !== d.pin) { await frage("<p>Die PIN ist falsch.</p>", "OK"); return; }
    const k = schluessel(d.name);
    const lokal = DB.profile[k];
    if (lokal && lokal.zuletzt && lokal.zuletzt > d.erstellt) {
      const ok = await frage(`<p>Auf diesem Laptop gibt es einen <b>neueren</b> Stand von ${esc(d.name)} (${U.fmtDatum(lokal.zuletzt)} ${U.fmtZeit(lokal.zuletzt)} Uhr).</p><p>Trotzdem die Sicherung laden und den neueren Stand ersetzen?</p>`, "Ja, Sicherung laden", "Abbrechen");
      if (!ok) return;
    }
    P = { name: d.name, klasse: d.klasse, pin: d.pin, erstellt: lokal ? lokal.erstellt : d.erstellt, zuletzt: d.erstellt, daten: d.daten };
    DB.profile[k] = P;
    sichern();
    wechsel(uebersicht);
  }

  // =====================================================================
  // Übersicht der Sitzungen
  // =====================================================================
  function uebersicht() {
    const sz = P.daten.sitzungen;
    app.innerHTML = `
      <div class="kl-shell">
        <header class="kl-head"><span class="kl-head-title">📰 ${esc(C.TITEL)}</span><span class="kl-head-who">${esc(P.name)} · ${esc(P.klasse)}</span><button type="button" class="kl-btn" data-ab>Abmelden</button></header>
        <main class="kl-main sz-uebersicht">
          <div class="kl-task-kicker">Redaktionsplan</div><h2>Deine Sitzungen</h2>
          <div class="sz-karten">
            ${KL.THEMEN.map(([nr, thema, art]) => {
              const def = KL.SITZUNGEN.find((s) => s.nr === nr);
              const R = sz[nr];
              const st = R && R.beendet ? "✔ abgeschlossen" : R ? "begonnen" : def ? "bereit" : "folgt";
              return `<button type="button" class="sz-karte${def ? "" : " aus"}${R && R.beendet ? " fertig" : ""}" data-nr="${nr}" ${def ? "" : "disabled"}>
                <span class="sz-nr">${nr}</span><b>${esc(thema)}</b><small>${esc(art)}</small><em>${st}</em></button>`;
            }).join("")}
            <div class="sz-karte aus final"><span class="sz-nr">10</span><b>Die Zeitung geht online</b><small>am echten PC · Prüfungsleistung</small><em>PDF24 und Veröffentlichung</em></div>
          </div>
          <p class="kl-small">In dieser Beispielversion ist Sitzung 1 freigeschaltet.</p>
        </main>
      </div>`;
    app.querySelector("[data-ab]").onclick = () => { sichern(); anmeldung(); };
    app.querySelectorAll(".sz-karte[data-nr]:not(.aus)").forEach((b) => b.onclick = () => wechsel(() => sitzung(+b.dataset.nr)));
  }

  // =====================================================================
  // Tracker: Arbeitsweise und Schreibprotokoll
  // =====================================================================
  function neuerDurchgang() {
    return {
      start: Date.now(), aktiv: 0, ev: [], aufgaben: {}, beendet: null,
      aw: { markiert: {}, tasten: {}, band: {}, nachmachen: {}, freigaben: 0, rueckSerien: 0, ziehWort: 0, geloeschtMarkiert: 0, ueberschrieben: 0, eingefuegtIntern: 0 },
      sp: { getippt: 0, geloescht: 0, minuten: {}, blockiert: 0, blockiertZeichen: 0, fensterwechsel: 0, aussenSek: 0 },
    };
  }
  function tracker(R, geaendert) {
    const ev = new Set(R.ev);
    const add = (k) => { if (!ev.has(k)) { ev.add(k); R.ev.push(k); geaendert(); } };
    const inc = (obj, k, n) => { obj[k] = (obj[k] || 0) + (n == null ? 1 : n); };
    const minute = () => Math.floor((Date.now() - R.start) / 60000);
    return {
      ev,
      ereignis: add,
      explorer: (op, x) => KL.ereignisKennungen(op, x).forEach(add),
      taste: (c) => { inc(R.aw.tasten, c); geaendert(); },
      band: (c) => { inc(R.aw.band, c); geaendert(); },
      markiert: (art) => { inc(R.aw.markiert, art); geaendert(); },
      zaehle: (k) => { inc(R.aw, k); geaendert(); },
      tippen: (n) => { R.sp.getippt += n; inc(R.sp.minuten, minute(), n); },
      loeschen: (n) => { R.sp.geloescht += n; },
      nachmachen: (regel) => { inc(R.aw.nachmachen, regel); geaendert(); },
      freigabe: () => { R.aw.freigaben++; geaendert(); },
      blockiert: (len) => { R.sp.blockiert++; R.sp.blockiertZeichen += len; geaendert(); },
    };
  }

  // =====================================================================
  // Sitzung
  // =====================================================================
  function sitzung(nr) {
    const def = KL.SITZUNGEN.find((s) => s.nr === nr);
    const sz = P.daten.sitzungen;
    if (!sz[nr]) { sz[nr] = neuerDurchgang(); if (def.vorbereiten) def.vorbereiten(P.daten.fs); }
    const R = sz[nr];
    R.beendet = null;
    KL.pruefung.setze(P.daten);
    sichern();

    app.innerHTML = `
      <div class="kl-shell sz-shell">
        <header class="kl-head">
          <span class="kl-head-title">📰 Sitzung ${nr}</span>
          <span class="kl-head-who">${esc(def.thema)} · ${esc(P.name)}</span>
          <span class="kl-timer sz-zeit">0 min</span>
          <button type="button" class="kl-btn sz-zw-btn" data-zwischen title="Stand als PDF sichern, ohne die Sitzung zu beenden">💾 Zwischenstand</button>
          <button type="button" class="kl-btn primary" data-ende>Sitzung beenden ▸</button>
        </header>
        <div class="kl-savewarn" hidden>⚠ Dieser Browser kann nicht speichern (privates Fenster?). Sichere deinen Stand rechtzeitig über „Sitzung beenden“.</div>
        <div class="kl-body">
          <aside class="kl-side sz-side">
            <div class="sz-auftrag"><div class="kl-part-title">Redaktionsauftrag</div><p>${esc(def.einleitung)}</p>
              <p class="sz-ziel">📁 <b>${esc(def.ordner)}</b> · 📄 <b>${esc(def.datei)}</b></p></div>
            <div class="kl-part-title">Aufgaben <span class="sz-fort"></span></div>
            <div class="sz-liste-host"></div>
            <div class="kl-part-title">Deine Arbeitsweise</div>
            <div class="sz-aw"></div>
            <p class="kl-small sz-regel">Gilt immer: effektiv markieren (Doppelklick, Dreifachklick, Umschalt+Pfeil) und Tastenkombinationen nutzen. Einfügen von außen ist gesperrt – recherchieren ja, schreiben selbst.</p>
          </aside>
          <main class="sz-pc-host"></main>
        </div>
      </div>`;

    const liste = app.querySelector(".sz-liste-host");
    const awEl = app.querySelector(".sz-aw");
    let pcApi = null;
    let dirty = false;
    const geaendert = () => { dirty = true; P.zuletzt = Date.now(); sichernBald(); bald(); };
    const T = tracker(R, geaendert);
    // Mindestlänge des Artikels: Warnung beim Schließen von Word
    const zuKurz = (dok) => {
      const L = def.laenge;
      if (!L || !dok || !KL.util.norm(KL.ohneHtml(dok.html)).trim()) return null;
      const ziel = KL.pfadFinden(P.daten.fs, L.ziel);
      const istZiel = dok.pfad && (KL.gleicherPfad(dok.pfad, L.ziel) || KL.aehnlicherName(dok.pfad, L.ziel));
      const istNeu = !dok.pfad && !(ziel && ziel.inhalt && KL.zeilenZaehlen(ziel.inhalt) >= L.zeilen);
      if (!istZiel && !istNeu) return null;
      const z = KL.zeilenZaehlen(dok.html);
      return z < L.zeilen ? { zeilen: z, soll: L.zeilen } : null;
    };
    pcApi = KL.pc.mount(app.querySelector(".sz-pc-host"), { fs: P.daten.fs, T, benutzer: P.name, speichereZustand: geaendert, zuKurz });

    // ----- Aufgaben prüfen -----
    function pruefe() {
      const PP = { fs: P.daten.fs, ev: T.ev, docs: pcApi.offeneDokumente(), aw: R.aw, offen: pcApi.anzahlFenster() };
      const erg = {};
      if (def.bonus) erg.bonus = safe(def.bonus.pruef, PP);
      def.aufgaben.filter((a) => a.id).forEach((a) => {
        if (a.teile) a.teile.forEach(([id, , f]) => { erg[`${a.id}.${id}`] = safe(f, PP); });
        else erg[a.id] = safe(a.pruef, PP);
      });
      return erg;
    }
    const safe = (f, PP) => { try { return !!f(PP); } catch (e) { return false; } };
    const hinweis = (a, PP) => { try { return a.hinweis ? a.hinweis(PP) : null; } catch (e) { return null; } };
    let pruefTimer = null;
    function bald() { clearTimeout(pruefTimer); pruefTimer = setTimeout(zeige, 250); }
    function zeige() {
      const erg = pruefe();
      R.aufgaben = erg;
      const PP = { fs: P.daten.fs, ev: T.ev, docs: pcApi.offeneDokumente(), aw: R.aw, offen: pcApi.anzahlFenster() };
      const tipp = (a, ok) => { if (ok) return ""; const h = hinweis(a, PP); return h ? `<div class="sz-hinweis">💡 ${esc(h)}</div>` : ""; };
      let fertig = 0, gesamt = 0, html = "", offen = false;
      def.aufgaben.forEach((a) => {
        if (a.teil) { html += `${offen ? "</ol>" : ""}<div class="sz-teil">${esc(a.teil)}</div><ol class="sz-liste" start="${gesamt + 1}">`; offen = true; return; }
        if (!offen) { html += `<ol class="sz-liste">`; offen = true; }
        gesamt++;
        if (a.teile) {
          const ok = a.teile.every(([id]) => erg[`${a.id}.${id}`]);
          if (ok) fertig++;
          html += `<li data-id="${a.id}" class="${ok ? "ok" : ""}">${a.text}<ul>${a.teile.map(([id, t]) => `<li data-id="${a.id}.${id}" class="${erg[`${a.id}.${id}`] ? "ok" : ""}">${t}</li>`).join("")}</ul></li>`;
        } else {
          if (erg[a.id]) fertig++;
          html += `<li data-id="${a.id}" class="${erg[a.id] ? "ok" : ""}">${a.text}${tipp(a, erg[a.id])}</li>`;
        }
      });
      if (offen) html += "</ol>";
      if (def.bonus) html += `<div class="sz-bonus ${erg.bonus ? "ok" : ""}">${erg.bonus ? "✔ " : "⭐ "}${def.bonus.text}</div>`;
      if (liste.innerHTML !== html) liste.innerHTML = html;
      app.querySelector(".sz-fort").textContent = `${fertig}/${gesamt}`;
      const aw = R.aw, mk = aw.markiert;
      const nmz = Object.values(aw.nachmachen).reduce((s, x) => s + x, 0);
      awEl.innerHTML = `
        <div><span>Doppel-/Dreifachklick</span><b>${(mk.doppelklick || 0) + (mk.dreifach || 0)}</b></div>
        <div><span>Markieren mit Tastatur</span><b>${mk.tastatur || 0}</b></div>
        <div><span>Tastenkombinationen</span><b>${Object.values(aw.tasten).reduce((s, x) => s + x, 0)}</b></div>
        <div class="${nmz ? "warn" : ""}"><span>Nachmachen</span><b>${nmz}</b></div>
        <div class="${R.sp.blockiert ? "warn" : ""}"><span>Blockiertes Einfügen</span><b>${R.sp.blockiert}</b></div>`;
      const w = app.querySelector(".kl-savewarn");
      if (w) w.hidden = !speicherFehler;
    }
    zeige();
    const pruefInt = setInterval(zeige, 2000);

    // ----- Zeit, Fensterwechsel -----
    const zeitEl = app.querySelector(".sz-zeit");
    let weg = null;
    const tick = setInterval(() => {
      if (!document.hidden && document.hasFocus()) { R.aktiv++; if (R.aktiv % 20 === 0) sichernBald(); }
      zeitEl.textContent = `${Math.floor(R.aktiv / 60)} min`;
    }, 1000);
    const onBlur = () => { weg = Date.now(); };
    const onFocus = () => {
      if (weg) {
        const s = Math.round((Date.now() - weg) / 1000);
        if (s >= 2) { R.sp.fensterwechsel++; R.sp.aussenSek += s; geaendert(); }
      }
      weg = null;
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    // ----- Einfüge-Sperre (für alle Felder im virtuellen PC) -----
    const pcEl = app.querySelector(".pc");
    const onCopy = (e) => {
      if (!(pcEl.contains(e.target) || pcEl.contains(document.activeElement))) return;
      const t = String(window.getSelection() || "") || (e.target.value || "").slice(e.target.selectionStart || 0, e.target.selectionEnd || 0);
      if (t) { KL.intern.merke(t); KL.zwischenablage = t; }
    };
    const onPaste = (e) => {
      if (!pcEl.contains(e.target)) return;
      let t = "";
      try { t = e.clipboardData.getData("text/plain"); } catch (err) { t = ""; }
      if (KL.intern.kennt(t)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      T.blockiert(t.length);
      pcApi.meldung("🚫 Einfügen von außen ist gesperrt. Recherchieren ist erlaubt – schreibe den Text in deinen eigenen Worten.");
    };
    const onDrop = (e) => { if (pcEl.contains(e.target) && e.dataTransfer && e.dataTransfer.types.includes("text/plain") && !e.dataTransfer.types.includes("Files")) { if (!e.target.closest(".xp")) { e.preventDefault(); T.blockiert(0); } } };
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("drop", onDrop, true);
    const onUnload = (e) => { sichern(); if (pcApi.ungespeichert()) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onUnload);

    // ----- Zwischenstand: PDF mit dem aktuellen Stand, Sitzung läuft weiter -----
    app.querySelector("[data-zwischen]").onclick = async () => {
      if (pcApi.ungespeichert()) {
        const ok = await frage(`<p><b>In Word gibt es noch ungespeicherte Änderungen.</b></p><p>Der Zwischenstand enthält nur gespeicherte Dateien. Speichere vorher mit <b>Strg+S</b>.</p>`, "Trotzdem sichern", "Zurück");
        if (!ok) return;
      }
      sichern();
      const jetzt = new Date();
      const zname = `Zwischenstand_${String(nr).padStart(2, "0")}_${P.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}_${String(jetzt.getDate()).padStart(2, "0")}-${String(jetzt.getMonth() + 1).padStart(2, "0")}_${String(jetzt.getHours()).padStart(2, "0")}${String(jetzt.getMinutes()).padStart(2, "0")}.pdf`;
      let url;
      try {
        const blob = await KL.sitzungsbericht({ P, nr, def, R: { ...R, endeOffen: pcApi.anzahlFenster() }, sicherung: sicherungText(nr), zwischen: true });
        url = URL.createObjectURL(blob);
      } catch (err) { console.error(err); pcApi.meldung("Fehler beim Erstellen des Zwischenstands."); return; }
      const m = document.createElement("div");
      m.className = "kl-modal";
      m.innerHTML = `<div class="kl-modal-box">
        <p><b>💾 Zwischenstand sichern</b></p>
        <p>Die Sitzung läuft weiter. Der Zwischenstand ist ein PDF mit deinem bisherigen Ergebnis und einer <b>vorläufigen Note</b>.</p>
        <p>Speichere ihn in <b>Dokumente › Schülerzeitung_Berichte</b>. Damit kannst du an <b>jedem Laptop</b> weitermachen: Startseite → „Stand aus Bericht laden“.</p>
        <div class="kl-modal-btns"><button type="button" class="kl-btn" data-n>Abbrechen</button><a class="kl-btn primary" data-j href="${url}" download="${esc(zname)}">⬇ Zwischenstand herunterladen</a></div></div>`;
      document.body.appendChild(m);
      const zu = () => { m.remove(); URL.revokeObjectURL(url); pcApi.aktualisieren && pcApi.aktualisieren(); };
      m.querySelector("[data-n]").onclick = zu;
      m.querySelector("[data-j]").addEventListener("click", () => { R.zwischenstaende = (R.zwischenstaende || 0) + 1; sichern(); setTimeout(zu, 1500); pcApi.meldung("✔ Zwischenstand heruntergeladen."); });
    };

    app.querySelector("[data-ende]").onclick = async () => {
      const offen = pcApi.ungespeichert();
      if (offen) {
        const ok = await frage(`<p><b>In Word gibt es noch ungespeicherte Änderungen.</b></p><p>Ungespeicherte Texte zählen nicht für die Auswertung. Trotzdem beenden?</p>`, "Trotzdem beenden", "Zurück zur Sitzung");
        if (!ok) return;
      } else if (def.laenge) {
        const z = KL.pfadFinden(P.daten.fs, def.laenge.ziel);
        const n = z && z.inhalt ? KL.zeilenZaehlen(z.inhalt) : 0;
        if (n < def.laenge.zeilen) {
          const ok = await frage(`<p><b>Dein Text ist noch nicht lang genug.</b></p><p>${n ? `Dein gespeicherter Artikel hat ${n} von mindestens ${def.laenge.zeilen} Zeilen.` : esc(KL.woHinweis({ fs: P.daten.fs }, def.laenge.ziel, "datei") || `Dein Artikel ist noch nicht als „${def.datei}“ im Ordner „${def.ordner}“ gespeichert.`)} Möchtest du weiterschreiben?</p>`, "Trotzdem beenden", "Weiterschreiben");
          if (!ok) return;
        }
      }
      zeige();
      R.endeOffen = pcApi.anzahlFenster();
      R.beendet = Date.now();
      sichern();
      wechsel(() => auswertung(nr));
    };

    ansicht = {
      destroy: () => {
        clearInterval(pruefInt); clearInterval(tick); clearTimeout(pruefTimer);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("copy", onCopy, true);
        document.removeEventListener("cut", onCopy, true);
        document.removeEventListener("paste", onPaste, true);
        document.removeEventListener("drop", onDrop, true);
        window.removeEventListener("beforeunload", onUnload);
        pcApi.destroy();
        sichern();
      },
    };
  }

  // =====================================================================
  // Auswertung + Sicherungsdatei (Darstellung: auswertung.js)
  // =====================================================================
  function auswertung(nr) {
    const def = KL.SITZUNGEN.find((s) => s.nr === nr);
    const R = P.daten.sitzungen[nr];
    KL.pruefung.setze(P.daten);
    const erg = KL.auswertungHTML(def, R, P.daten.fs);
    const nr2 = String(nr).padStart(2, "0");
    const dateiname = `Sitzungsbericht_${nr2}_${P.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}.pdf`;
    const betreff = `Schülerzeitung – Sitzung ${nr} – ${P.name}`;
    app.innerHTML = `
      <div class="kl-shell">
        <header class="kl-head"><span class="kl-head-title">📰 Sitzung ${nr} · Auswertung</span><span class="kl-head-who">${esc(P.name)} · ${esc(P.klasse)}</span></header>
        <main class="kl-main">
          <div class="kl-task-kicker">${esc(def.thema)}</div><h2>So lief deine Sitzung</h2>
          ${erg.html}
          <div class="sz-abgabe sz-ki">
            <h3>✨ Schritt 1: Deinen Text mit KI verbessern</h3>
            <div class="sz-wichtig"><b>Hinweis:</b> Deine Lehrkraft vergleicht dein <b>Original</b> mit der <b>KI-Fassung</b>, um sicherzustellen, dass die KI lediglich als <b>Hilfe</b> benutzt wurde und nicht deine eigene Arbeit erledigt hat. In der Schülerzeitung wird die <b>KI-Fassung</b> veröffentlicht.</div>
            <ol class="sz-schritte">
              <li><label><input type="checkbox"> <span>Klicke auf <b>„Meinen Text kopieren“</b> und öffne die <b>KI, die eure Lehrkraft freigegeben hat</b>. Gib <b>keine echten Namen</b> oder persönlichen Daten ein.</span></label></li>
              <li><label><input type="checkbox"> <span>Schreibe der KI einen Auftrag, zum Beispiel: <div class="sz-prompt" data-prompt>Verbessere Rechtschreibung, Grammatik und Ausdruck meines Zeitungsartikels. Behalte meinen Inhalt, meine Überschriften und die Länge bei. Erfinde nichts dazu.</div> und füge danach deinen Text ein.</span></label></li>
              <li><label><input type="checkbox"> <span>Kopiere die Antwort der KI (nur den Artikel) und füge sie unten in das Feld <b>„KI-Fassung“</b> ein. Nur hier ist Einfügen erlaubt.</span></label></li>
              <li><label><input type="checkbox"> <span>Lies den Vergleich und schreibe in eigenen Worten, was die KI geändert hat und ob du zustimmst.</span></label></li>
            </ol>
            <div class="kl-task-foot"><button type="button" class="kl-btn" data-ki-kopie>📋 Meinen Text kopieren</button><button type="button" class="kl-btn" data-prompt-kopie>📋 Auftrag kopieren</button><span class="sz-ki-kopiert kl-small"></span></div>
            <p><b>KI-Fassung</b> (hier einfügen mit Strg+V):</p>
            <textarea data-ki-text placeholder="Hier die verbesserte Fassung der KI einfügen …">${esc((R.ki && R.ki.text) || "")}</textarea>
            <p><b>Was hat die KI geändert? Stimmst du zu?</b> (mindestens 2 Sätze, selbst schreiben)</p>
            <textarea class="sz-reflexion" data-ki-reflexion placeholder="Die KI hat … Ich finde …">${esc((R.ki && R.ki.reflexion) || "")}</textarea>
            <div class="kl-task-foot"><button type="button" class="kl-btn primary" data-ki-vergleich>🔍 Vergleichen und speichern</button><button type="button" class="kl-btn" data-ki-docx ${R.ki && R.ki.text ? "" : "disabled"}>⬇ KI-Fassung als Word-Datei</button><span class="sz-ki-status kl-small"></span></div>
            <div class="sz-ki-ergebnis"></div>
          </div>
          <div class="sz-abgabe">
            <h3>💻 Schritt 2: Deinen Redaktions-PC auf deinem Computer nachbauen</h3>
            <div class="sz-wichtig"><b>Wichtig:</b> Alles, was in der App ist, musst du auf deinem <b>eigenen Computer</b> nachbauen: <b>alle Ordner erstellen</b> und <b>alle Dateien hineinkopieren</b> – genau so wie im Redaktions-PC.</div>
            <ol class="sz-schritte">
              <li><label><input type="checkbox"> <span>Öffne den Datei-Explorer (Windows+E) und gehe zu <b>${esc(C.EXPORT_ORT || "Dokumente")}</b>. Erstelle dort dieselben Ordner wie unten (was schon da ist, musst du nicht neu anlegen).</span></label></li>
              <li><label><input type="checkbox"> <span>Lade jede Datei mit <b>⬇</b> herunter – auch die <b>KI-Fassung</b> (✨), sie gehört in denselben Ordner wie dein Original. Sie landet meist im Ordner <b>Downloads</b>: Schneide sie dort aus (<b>Strg+X</b>) und füge sie im richtigen Ordner ein (<b>Strg+V</b>).</span></label></li>
              <li><label><input type="checkbox"> <span>Vergleiche zum Schluss: Sieht dein Ordner <b>Schülerzeitung</b> genauso aus wie unten?</span></label></li>
            </ol>
            <div class="sz-export"></div>
            <h3>📤 Schritt 3: Bericht an deinen Dozenten schicken</h3>
            <ol class="sz-schritte">
              <li><label><input type="checkbox"> <span><b>Nur beim ersten Mal:</b> Erstelle unter <b>Dokumente</b> den Ordner <b>Schülerzeitung_Berichte</b>.</span></label></li>
              <li><label><input type="checkbox"> <span>Klicke unten auf <b>„Bericht herunterladen“</b>. Fragt der Browser nach dem Speicherort, wähle <b>Dokumente › Schülerzeitung_Berichte</b>. Sonst landet die Datei im Ordner <b>Downloads</b>: Schneide sie dort aus (Strg+X) und füge sie in <b>Schülerzeitung_Berichte</b> ein (Strg+V).</span></label></li>
              <li><label><input type="checkbox"> <span>Schreibe eine E-Mail an deinen Dozenten mit dem Betreff <b>„${esc(betreff)}“</b> und hänge den Bericht als Anhang an (📎 Büroklammer → <b>Schülerzeitung_Berichte</b> → <code>${esc(dateiname)}</code>).</span></label></li>
              <li><label><input type="checkbox"> <span>Bewahre die Mail auf: Mit dem PDF kannst du deinen Stand an jedem Laptop wieder laden (Startseite → „Stand aus Bericht laden“).</span></label></li>
            </ol>
            <div class="kl-task-foot"><button type="button" class="kl-btn primary big" data-dl>⬇ Bericht herunterladen (PDF)</button>
              <a class="kl-btn" data-mail href="mailto:${encodeURIComponent(C.DOZENT_MAIL || "")}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent("Hallo,\n\nanbei mein Sitzungsbericht.\n\nViele Grüße\n" + P.name)}">✉ E-Mail vorbereiten</a>
              <span class="sz-dl-status"></span><span class="kl-spacer"></span>
              <button type="button" class="kl-btn" data-weiter>Zurück zur Sitzung</button><button type="button" class="kl-btn ghost" data-ab>Abmelden</button></div>
            <p class="kl-small">Dateiname: <code>${esc(dateiname)}</code></p>
          </div>
        </main>
      </div>`;
    // ----- Export: Ordner und Dateien für den eigenen Computer -----
    // übertragene Dateien merken (über alle Sitzungen): Pfad → Prüfsumme des
    // Inhalts. Nur neue oder geänderte Dateien müssen erneut heruntergeladen werden.
    P.daten.export = P.daten.export || {};
    const EX = P.daten.export;
    const aktuell = (pfad) => { const n = KL.pfadFinden(fs, pfad); return !!n && EX[pfad] === KL.exportSumme(n); };
    const istAktuell = (p) => (p.startsWith("KI:") ? (() => { const Rn = P.daten.sitzungen[+p.slice(3)]; return !!(Rn && Rn.ki) && EX[p] === KL.util.sha256(Rn.ki.text).slice(0, 16); })() : aktuell(p));
    const kiName = (dn) => dn.datei.replace(/\.docx$/i, "") + "_KI.docx";
    const exportEl = app.querySelector(".sz-export");
    const fs = P.daten.fs;
    const basisNode = KL.pfadFinden(fs, "Desktop/Schülerzeitung");
    const exportDateien = [];
    function exportListe() {
      if (!basisNode) { exportEl.innerHTML = "<p>Der Ordner „Schülerzeitung“ fehlt im Redaktions-PC.</p>"; return; }
      exportDateien.length = 0;
      let html = "";
      const kiAktuell = (snr) => { const Rn = P.daten.sitzungen[snr]; return !!(Rn && Rn.ki) && EX["KI:" + snr] === KL.util.sha256(Rn.ki.text).slice(0, 16); };
      const zeile = (n, tiefe) => {
        const pfad = KL.fs.pfadVon(fs, n.id);
        if (n.kinder) {
          html += `<div class="sz-export-z" style="padding-left:${tiefe * 22}px">📁 <b>${esc(n.name)}</b></div>`;
          n.kinder.map((k) => fs.nodes[k]).filter(Boolean)
            .sort((a, b) => (a.kinder ? 0 : 1) - (b.kinder ? 0 : 1) || a.name.localeCompare(b.name, "de"))
            .forEach((k) => zeile(k, tiefe + 1));
          // KI-Fassungen gehören in den Ordner ihres Artikels
          KL.SITZUNGEN.filter((dn) => P.daten.sitzungen[dn.nr] && P.daten.sitzungen[dn.nr].ki && KL.gleicherPfad(pfad, `Desktop/Schülerzeitung/${dn.ordner}`)).forEach((dn) => {
            exportDateien.push("KI:" + dn.nr);
            const ok = kiAktuell(dn.nr);
            html += `<div class="sz-export-z ${ok ? "ok" : ""}" style="padding-left:${(tiefe + 1) * 22}px">✨ <span class="sz-export-name">${esc(kiName(dn))}</span> <span class="kl-small">(KI-Fassung, wird veröffentlicht)</span>${ok ? "" : `<span class="sz-export-neu">neu</span>`}<button type="button" class="kl-btn" data-exp-ki="${dn.nr}">⬇ herunterladen</button></div>`;
          });
        } else {
          exportDateien.push(pfad);
          const neu = !EX[pfad];
          html += `<div class="sz-export-z ${aktuell(pfad) ? "ok" : ""}" style="padding-left:${tiefe * 22}px">📄 <span class="sz-export-name">${esc(n.name)}</span>${aktuell(pfad) ? "" : `<span class="sz-export-neu">${neu ? "neu" : "geändert"}</span>`}<button type="button" class="kl-btn" data-exp="${esc(pfad)}" title="Als Word-Datei herunterladen">⬇ herunterladen</button></div>`;
        }
      };
      zeile(basisNode, 0);
      const n = exportDateien.filter(istAktuell).length;
      exportEl.innerHTML = `<p class="kl-small">So sieht dein Redaktions-PC aus (${esc(C.EXPORT_ORT || "Dokumente")} › …). Auf deinem Computer aktuell: <b>${n} von ${exportDateien.length}</b> Dateien. Lade alle Dateien mit „neu“ oder „geändert“ herunter – geänderte ersetzen die alte Datei auf deinem Computer.</p>${html}`;
    }
    exportListe();
    exportEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-exp]");
      if (!b) return;
      const n = KL.pfadFinden(fs, b.dataset.exp);
      if (!n) return;
      const name = /\.docx?$/i.test(n.name) ? n.name.replace(/\.doc$/i, ".docx") : n.name + ".docx";
      const blob = KL.docx(n.inhalt || "", n.name.replace(/\.docx?$/i, ""));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      EX[b.dataset.exp] = KL.exportSumme(n);
      sichern();
      exportListe();
    });

    // ----- KI-Fassung -----
    const kiEl = app.querySelector(".sz-ki");
    const kiStatus = kiEl.querySelector(".sz-ki-status");
    const kiText = kiEl.querySelector("[data-ki-text]");
    const kiRefl = kiEl.querySelector("[data-ki-reflexion]");
    const artikelText = () => { const a = erg.artikel; return a ? a.bloecke.map((b) => b.text).join("\n\n") : ""; };
    const kopiere = async (text, wo) => {
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; }
      if (!ok) {
        const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select();
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        t.remove();
      }
      kiEl.querySelector(".sz-ki-kopiert").textContent = ok ? `✔ ${wo} kopiert – jetzt in der KI einfügen (Strg+V).` : "Kopieren nicht möglich – bitte markieren und Strg+C drücken.";
    };
    kiEl.querySelector("[data-ki-kopie]").onclick = () => {
      if (!erg.artikel) { kiStatus.textContent = "Dein Artikel wurde nicht gefunden – erst speichern."; return; }
      kopiere(artikelText(), "Text");
    };
    kiEl.querySelector("[data-prompt-kopie]").onclick = () => kopiere(kiEl.querySelector("[data-prompt]").textContent.trim(), "Auftrag");
    // Reflexion: selbst schreiben, kein Einfügen
    kiRefl.addEventListener("paste", (e) => { e.preventDefault(); kiStatus.textContent = "🚫 Die Reflexion schreibst du selbst – Einfügen ist hier gesperrt."; });
    kiRefl.addEventListener("drop", (e) => e.preventDefault());
    function kiZeigen() {
      const d = KL.sitzungsDaten(def, R, P.daten.fs);
      const box = kiEl.querySelector(".sz-ki-ergebnis");
      if (!d.ki || !d.ki.vergleich) { box.innerHTML = ""; return; }
      const v = d.ki.vergleich;
      box.innerHTML = `<div class="sz-ki-anteil">Die KI hat <b>${v.anteil} %</b> deines Textes verändert: ${esc(KL.vergleichStufe(v.anteil))}.</div>${KL.vergleichHTML(v)}<p class="kl-small"><span class="sz-del">gestrichen</span> = von der KI entfernt oder ersetzt · <span class="sz-ins">grün</span> = von der KI neu geschrieben</p>`;
    }
    kiZeigen();
    kiEl.querySelector("[data-ki-vergleich]").onclick = () => {
      const t = kiText.value.trim(), r = kiRefl.value.trim();
      if (!erg.artikel) { kiStatus.textContent = "Dein Artikel wurde nicht gefunden – erst speichern."; return; }
      if (t.split(/\s+/).length < 20) { kiStatus.textContent = "Füge zuerst die KI-Fassung deines Artikels ein."; return; }
      const saetze = r.split(/[.!?]+\s*/).filter((x) => x.trim().split(/\s+/).length >= 3).length;
      R.ki = { text: t, reflexion: r, zeit: Date.now() };
      sichern();
      kiZeigen();
      kiEl.querySelector("[data-ki-docx]").disabled = false;
      kiStatus.textContent = saetze >= 2 ? "✔ Gespeichert. Lade jetzt die KI-Fassung als Word-Datei herunter." : "✔ Vergleich gespeichert. Schreibe noch mindestens 2 Sätze zu den Änderungen und klicke erneut.";
      exportListe();
    };
    kiEl.querySelector("[data-ki-docx]").onclick = () => kiHerunterladen(nr);
    // KI-Fassung als Word-Datei: Formatierung (Überschriften) vom Original übernehmen
    function kiHtml(text, originalHtml) {
      const a = originalHtml ? KL.textAnalyse(originalHtml) : null;
      const kopf = a && a.ueberschrift, zw = a && a.meldungen[0] && a.meldungen[0].kopf;
      const fmt = (b, t) => {
        let inner = esc(t);
        if (b && b.pt && b.pt !== 11) inner = `<span style="font-size:${b.pt}pt">${inner}</span>`;
        if (b && b.fett) inner = `<b>${inner}</b>`;
        return `<p${b && b.ausrichtung && b.ausrichtung !== "left" ? ` style="text-align:${b.ausrichtung}"` : ""}>${inner}</p>`;
      };
      return text.split(/\n+/).map((x) => x.trim()).filter(Boolean).map((z, i) => {
        const istKopf = z.split(/\s+/).length <= 12 && !/[.!?:,;]$/.test(z);
        if (i === 0 && istKopf) return fmt(kopf, z.replace(/^#+\s*|\*\*/g, ""));
        if (istKopf) return fmt(zw, z.replace(/^#+\s*|\*\*/g, ""));
        return fmt(null, z.replace(/\*\*/g, ""));
      }).join("");
    }
    function kiHerunterladen(snr) {
      const dn = KL.SITZUNGEN.find((x) => x.nr === snr), Rn = P.daten.sitzungen[snr];
      if (!dn || !Rn || !Rn.ki) return;
      const orig = KL.pfadFinden(fs, `Desktop/Schülerzeitung/${dn.ordner}/${dn.datei}`);
      const blob = KL.docx(kiHtml(Rn.ki.text, orig && orig.inhalt), kiName(dn).replace(/\.docx$/, ""));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = kiName(dn);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      EX["KI:" + snr] = KL.util.sha256(Rn.ki.text).slice(0, 16);
      sichern();
      exportListe();
    }
    exportEl.addEventListener("click", (e) => { const b = e.target.closest("[data-exp-ki]"); if (b) kiHerunterladen(+b.dataset.expKi); });

    // Bericht: erst Hinweis, dann Download über einen echten Link im Dialog
    // (ein Klick der Person – so blockiert kein Browser den Download)
    app.querySelector("[data-dl]").onclick = async () => {
      const st = app.querySelector(".sz-dl-status");
      let url;
      try {
        const blob = await KL.sitzungsbericht({ P, nr, def, R, sicherung: sicherungText(nr) });
        url = URL.createObjectURL(blob);
      } catch (err) { console.error(err); st.textContent = "Fehler beim Erstellen des Berichts."; return; }
      const geladen = exportDateien.filter(istAktuell).length;
      const m = document.createElement("div");
      m.className = "kl-modal";
      m.innerHTML = `<div class="kl-modal-box">
        <p><b>Bevor du den Bericht herunterlädst:</b></p>
        <p>Alles, was in der App ist, musst du auf deinem <b>eigenen Computer</b> nachbauen: <b>alle Ordner erstellen</b> und <b>alle Dateien hineinkopieren</b>.</p>
        ${R.ki ? "" : `<p>⚠️ Du hast noch <b>keine KI-Fassung</b> eingefügt (Schritt 1). Das steht im Bericht.</p>`}
        <p>Auf deinem Computer aktuell: <b>${geladen} von ${exportDateien.length}</b> Dateien.${geladen < exportDateien.length ? " Das steht auch im Bericht." : ""}</p>
        <p>Hast du alles auf deinem Computer nachgebaut?</p>
        <div class="kl-modal-btns"><button type="button" class="kl-btn" data-n>Noch nicht</button><a class="kl-btn primary" data-j href="${url}" download="${esc(dateiname)}">Ja, Bericht herunterladen</a></div></div>`;
      document.body.appendChild(m);
      m.querySelector("[data-j]").focus();
      m.querySelector("[data-n]").onclick = () => { m.remove(); URL.revokeObjectURL(url); exportEl.scrollIntoView({ behavior: "smooth", block: "start" }); };
      m.querySelector("[data-j]").addEventListener("click", () => {
        setTimeout(() => { m.remove(); URL.revokeObjectURL(url); }, 1500);
        R.gesichert = Date.now();
        sichern();
        st.textContent = "✔ heruntergeladen – jetzt per Mail schicken.";
      });
    };
    app.querySelector("[data-weiter]").onclick = () => wechsel(() => sitzung(nr));
    app.querySelector("[data-ab]").onclick = async () => {
      if (!R.gesichert) {
        const ok = await frage("<p>Du hast den Bericht noch nicht heruntergeladen. Trotzdem abmelden?</p>", "Abmelden", "Zurück");
        if (!ok) return;
      }
      sichern();
      anmeldung();
    };
  }

  window.addEventListener("pagehide", sichern);
  anmeldung();
})();
