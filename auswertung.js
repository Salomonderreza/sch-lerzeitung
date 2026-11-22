/* =====================================================================
   AUSWERTUNG EINER SITZUNG — Daten (für Bildschirm und PDF-Bericht)
   ===================================================================== */
window.KL = window.KL || {};
(() => {
  "use strict";
  const { esc } = KL.util;
  const BAND = { fett: "Fett", kursiv: "Kursiv", unterstrichen: "Unterstrichen", groesser: "Schrift größer", kleiner: "Schrift kleiner", schriftgrad: "Schriftgrad", kopieren: "Kopieren", einfuegen: "Einfügen", ausschneiden: "Ausschneiden", undo: "Rückgängig", redo: "Wiederholen", speichern: "Speichern", links: "Linksbündig", zentriert: "Zentriert", rechts: "Rechtsbündig", rsgr: "Rechtschreibung und Grammatik", nummerierung: "Nummerierung", aufzaehlung: "Aufzählungszeichen" };
  const NMN = { rueck: "Buchstabenweise gelöscht", zieh: "Einzelnes Wort mit der Maus markiert", band: "Kopieren/Einfügen über das Menüband" };
  KL.ohneHtml = (h) => String(h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  // ---------- Arbeitsweise bewerten (0–100 Punkte) mit Feedback ----------
  // Bewertet wird nur, was eindeutig umständlich ist. Ein Teil ohne Daten
  // (z. B. nie etwas markiert) zählt nicht mit; die Gewichte werden verteilt.
  const KURZ = { fett: "Strg+Umschalt+F", kursiv: "Strg+Umschalt+K", unterstrichen: "Strg+U", groesser: "Strg+Umschalt+>", kleiner: "Strg+<", kopieren: "Strg+C", einfuegen: "Strg+V", ausschneiden: "Strg+X", undo: "Strg+Z", redo: "Strg+Y", links: "Strg+L", zentriert: "Strg+E", rechts: "Strg+R", rsgr: "F7", aufzaehlung: "Strg+Umschalt+L" };
  KL.arbeitsweise = function (aw) {
    const mk = aw.markiert || {};
    const teile = [];
    // 1. Markieren
    const eff = (mk.doppelklick || 0) + (mk.dreifach || 0) + (mk.tastatur || 0);
    const zw = aw.ziehWort || 0;
    if (eff + zw) {
      const p = Math.round((eff / (eff + zw)) * 100);
      teile.push({ name: "Markieren", gewicht: 40, punkte: p, gut: zw === 0,
        text: zw ? `${zw}× hast du ein einzelnes Wort mit der Maus gezogen. Schneller: Doppelklick markiert ein Wort, Dreifachklick einen ganzen Absatz.`
          : `Sehr gut: Du hast effektiv markiert (Doppelklick ${mk.doppelklick || 0}×, Dreifachklick ${mk.dreifach || 0}×, Tastatur ${mk.tastatur || 0}×).` });
    }
    // 2. Tastenkombinationen statt Menüband
    const tastenSumme = Object.entries(aw.tasten || {}).filter(([k]) => k !== "Strg+S" && k !== "F12").reduce((x, [, v]) => x + v, 0);
    const bandKurz = Object.entries(aw.band || {}).filter(([k]) => KURZ[k]);
    const bandSumme = bandKurz.reduce((x, [, v]) => x + v, 0);
    if (tastenSumme + bandSumme) {
      const p = Math.round((tastenSumme / (tastenSumme + bandSumme)) * 100);
      const tipps = bandKurz.sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${BAND[k] || k} ${v}× über das Menüband – schneller mit ${KURZ[k]}`);
      teile.push({ name: "Tastenkombinationen", gewicht: 30, punkte: p, gut: bandSumme === 0,
        text: bandSumme ? `${tipps.join(" · ")}.` : `Sehr gut: ${tastenSumme} Befehle mit Tastenkombinationen, keiner über das Menüband.` });
    }
    // 3. Speichern
    const sS = aw.strgS || 0, sM = aw.speichernMaus || 0;
    if (sS + sM) {
      const p = Math.round((sS / (sS + sM)) * 100);
      teile.push({ name: "Speichern", gewicht: 15, punkte: p, gut: sM === 0,
        text: sM ? `${sM}× hast du über das Menü gespeichert, ${sS}× mit Strg+S. Gewöhne dir Strg+S an.` : `Sehr gut: ${sS}× mit Strg+S gespeichert.` });
    }
    // 4. Nachmachen (nur, wenn überhaupt gearbeitet wurde)
    const nmz = Object.values(aw.nachmachen || {}).reduce((x, v) => x + v, 0);
    if (teile.length) {
      teile.push({ name: "Nachmachen", gewicht: 15, punkte: Math.max(0, 100 - nmz * 25), gut: nmz === 0,
        text: nmz ? `${nmz}× musstest du einen Schritt effektiv nachmachen. Jedes Nachmachen kostet 25 Punkte in diesem Bereich.` : "Kein einziges Nachmachen nötig." });
    }
    const g = teile.reduce((x, t) => x + t.gewicht, 0);
    const punkte = g ? Math.round(teile.reduce((x, t) => x + t.punkte * t.gewicht, 0) / g) : 0;
    return { punkte, teile, leer: !teile.length };
  };

  // ---------- Wortvergleich Original ↔ KI-Fassung ----------
  const woerter = (t) => String(t || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  KL.vergleich = function (original, ki) {
    const a = woerter(original), b = woerter(ki);
    const n = a.length, m = b.length;
    if (!n || !m) return { anteil: n || m ? 100 : 0, a: a.map((w) => [w, -1]), b: b.map((w) => [w, 1]), woerterA: n, woerterB: m };
    const norm = (w) => w.toLowerCase().replace(/[„“"'.,;:!?()«»–-]/g, "");
    const A = a.map(norm), B = b.map(norm);
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ra = [], rb = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ra.push([a[i], 0]); rb.push([b[j], 0]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { ra.push([a[i], -1]); i++; }
      else { rb.push([b[j], 1]); j++; }
    }
    while (i < n) ra.push([a[i++], -1]);
    while (j < m) rb.push([b[j++], 1]);
    const gleich = L[0][0];
    const anteil = Math.round((1 - (2 * gleich) / (n + m)) * 100);
    return { anteil, a: ra, b: rb, woerterA: n, woerterB: m };
  };
  KL.vergleichStufe = (anteil) => anteil <= 15 ? "leicht überarbeitet (Rechtschreibung, einzelne Wörter)" : anteil <= 40 ? "deutlich überarbeitet" : "stark umgeschrieben – bitte genau prüfen";

  KL.sitzungsDaten = function (def, R, fsState) {
    const P2 = { fs: fsState, ev: new Set(R.ev), docs: [], aw: R.aw, offen: R.endeOffen || 0 };
    const ok = (f) => { try { return !!f(P2); } catch (e) { return false; } };
    const tipp = (a) => { try { return a.hinweis ? a.hinweis(P2) : null; } catch (e) { return null; } };
    let fertig = 0, gesamt = 0;
    const aufgaben = def.aufgaben.map((a) => {
      if (a.teil) return { teil: a.teil };
      gesamt++;
      const teile = a.teile ? a.teile.map(([, t, f]) => ({ text: t, ok: ok(f) })) : null;
      const erledigt = teile ? teile.every((x) => x.ok) : ok(a.pruef);
      if (erledigt) fertig++;
      return { text: a.text, ok: erledigt, teile, hinweis: erledigt ? null : tipp(a) };
    });
    const bonus = def.bonus ? { text: def.bonus.text, ok: ok(def.bonus.pruef) } : null;
    const ziel = KL.pfadFinden(fsState, `Desktop/Schülerzeitung/${def.ordner}/${def.datei}`);
    const artikel = ziel && ziel.inhalt ? KL.textAnalyse(ziel.inhalt) : null;
    const fehler = ziel && ziel.inhalt && KL.pruefung.istBereit() ? KL.pruefung.fehler(ziel.inhalt) : null;
    const aw = R.aw, mk = aw.markiert;
    const eff = (mk.doppelklick || 0) + (mk.dreifach || 0) + (mk.tastatur || 0);
    const alleMark = eff + (mk.ziehen || 0);
    const pd = KL.pruefung.daten || {};
    const C = KL.CONFIG;
    const basis = gesamt ? Math.round((fertig / gesamt) * 100) : 0;
    // Note: 70 % Aufgaben + 30 % Arbeitsweise (+ Bonus)
    const arbeitsweise = KL.arbeitsweise(aw);
    const anteilAW = (def.nr >= (C.ARBEITSWEISE_AB || 1) ? (C.ARBEITSWEISE_ANTEIL ?? 30) : 0) / 100;
    const roh = basis * (1 - anteilAW) + arbeitsweise.punkte * anteilAW;
    const prozent = Math.min(100, Math.round(roh + (bonus && bonus.ok ? (C.BONUS_PROZENT || 0) : 0)));
    const stufe = (C.NOTEN || []).find(([ab]) => prozent >= ab) || [0, "–", ""];
    const note = { prozent, basis, aw: arbeitsweise.punkte, anteilAW: Math.round(anteilAW * 100), bonus: !!(bonus && bonus.ok), note: stufe[1], wort: stufe[2] };
    const ki = R.ki && R.ki.text ? { ...R.ki, vergleich: artikel ? KL.vergleich(artikel.bloecke.map((b) => b.text).join("\n"), R.ki.text) : null } : null;
    return {
      note, arbeitsweise, ki,
      fertig, gesamt, aufgaben, bonus, artikel, fehler, html: ziel ? ziel.inhalt : null,
      quote: alleMark ? Math.round((eff / alleMark) * 100) : null,
      markiert: mk,
      tasten: aw.tasten,
      band: Object.fromEntries(Object.entries(aw.band).map(([k, v]) => [BAND[k] || k.replace("datei-", "Datei › "), v])),
      nachmachen: Object.fromEntries(Object.entries(aw.nachmachen).map(([k, v]) => [NMN[k] || k, v])),
      nmz: Object.values(aw.nachmachen).reduce((s, x) => s + x, 0),
      freigaben: aw.freigaben || 0,
      strgS: aw.strgS || 0,
      korrigiert: (aw.korrigiertRS || 0) + (aw.korrigiertGR || 0),
      ignoriert: (pd.ignoriert || []).slice(),
      woerterbuch: (pd.woerter || []).slice(),
      sp: R.sp, aktivMin: Math.round(R.aktiv / 60),
    };
  };

  KL.noteFormel = (d) => `${d.fertig} von ${d.gesamt} Aufgaben = ${d.note.basis} %${d.note.anteilAW ? ` (zählt ${100 - d.note.anteilAW} %) · Arbeitsweise ${d.note.aw} Punkte (zählt ${d.note.anteilAW} %)` : ""}${d.note.bonus ? ` · Bonus +${KL.CONFIG.BONUS_PROZENT} %` : ""} = ${d.note.prozent} % gesamt`;
  // Vergleich als HTML: links das Original (gestrichen = von der KI entfernt),
  // rechts die KI-Fassung (grün = von der KI neu)
  KL.vergleichHTML = function (v) {
    const spur = (arr, cls) => arr.map(([w, t]) => (t ? `<span class="${cls}">${esc(w)}</span>` : esc(w))).join(" ");
    return `<div class="sz-vgl"><div><h4>Dein Original (${v.woerterA} Wörter)</h4><p>${spur(v.a, "sz-del")}</p></div><div><h4>KI-Fassung (${v.woerterB} Wörter)</h4><p>${spur(v.b, "sz-ins")}</p></div></div>`;
  };

  KL.auswertungHTML = function (def, R, fsState) {
    const d = KL.sitzungsDaten(def, R, fsState);
    const chips = (obj) => Object.entries(obj).sort((x, y) => y[1] - x[1]).map(([k, v]) => `<span class="sz-chip">${esc(k)} <b>${v}×</b></span>`).join(" ") || "–";
    let offen = false;
    const liste = d.aufgaben.map((a) => {
      if (a.teil) { const h = `${offen ? "</ol>" : ""}<div class="sz-teil">${esc(a.teil)}</div><ol class="sz-liste ausw">`; offen = true; return h; }
      return `<li class="${a.ok ? "ok" : "nok"}">${a.text}${a.hinweis ? `<div class="sz-hinweis">💡 ${esc(a.hinweis)}</div>` : ""}${a.teile ? `<ul>${a.teile.map((x) => `<li class="${x.ok ? "ok" : "nok"}">${x.text}</li>`).join("")}</ul>` : ""}</li>`;
    }).join("") + (offen ? "</ol>" : "");
    const a = d.artikel, f = d.fehler;
    return { ...d, html: `
      <div class="sz-ausw">
        <section class="sz-note"><div class="sz-note-zahl">${esc(d.note.note)}</div><div><b>Note: ${esc(d.note.note)} (${esc(d.note.wort)})</b><br><span>${KL.noteFormel(d)}</span></div></section>
        <section><h3>Aufgaben: ${d.fertig} von ${d.gesamt} erledigt</h3>${liste}
          ${d.bonus ? `<div class="sz-bonus ${d.bonus.ok ? "ok" : ""}">${d.bonus.ok ? "✔ " : "⭐ "}${d.bonus.text}</div>` : ""}</section>
        <section><h3>Dein Artikel</h3>${a ? `<div class="sz-werte">
          <div><b>${a.woerter}</b><span>Wörter</span></div>
          <div><b>${a.meldungen.length}</b><span>Meldungen mit Zwischenüberschrift</span></div>
          <div><b>${a.saetze}</b><span>Sätze (ohne Hauptüberschrift)</span></div>
          <div class="${def.laenge && a.zeilen < def.laenge.zeilen ? "warn" : ""}"><b>${a.zeilen}</b><span>Zeilen${def.laenge ? ` (mindestens ${def.laenge.zeilen})` : ""}</span></div>
          <div class="${f && f.rs.length ? "warn" : ""}"><b>${f ? f.rs.length : "–"}</b><span>Rechtschreibfehler (rot)</span></div>
          <div class="${f && f.gr.length ? "warn" : ""}"><b>${f ? f.gr.length : "–"}</b><span>Grammatik-Hinweise (blau)</span></div>
          <div><b>${d.korrigiert}</b><span>über Vorschläge korrigiert</span></div></div>
          ${f && f.rs.length ? `<p class="kl-small">Noch falsch: ${f.rs.map(esc).join(", ")}</p>` : ""}
          ${d.woerterbuch.length || d.ignoriert.length ? `<p class="kl-small">Ins Wörterbuch aufgenommen: ${esc(d.woerterbuch.join(", ") || "–")} · Ignoriert: ${esc(d.ignoriert.join(", ") || "–")}</p>` : ""}
          <p class="kl-small">Gespeichert unter: Schülerzeitung › ${esc(def.ordner)} › ${esc(def.datei)}</p>`
          : `<p class="sz-fehlt">Die Datei <b>${esc(def.datei)}</b> wurde nicht im Ordner <b>${esc(def.ordner)}</b> gefunden.</p>`}
        </section>
        <section><h3>Deine Arbeitsweise: ${d.arbeitsweise.leer ? "–" : `${d.arbeitsweise.punkte} von 100 Punkten`}</h3>
          ${d.arbeitsweise.leer ? `<p>Noch keine Arbeit in Word erkennbar.</p>` : `<ul class="sz-feedback">${d.arbeitsweise.teile.map((t) => `<li class="${t.gut ? "ok" : "nok"}"><b>${esc(t.name)}: ${t.punkte} Punkte</b> – ${esc(t.text)}</li>`).join("")}</ul>`}
          <div class="sz-werte">
            <div><b>${d.quote == null ? "–" : d.quote + " %"}</b><span>effektiv markiert</span></div>
            <div><b>${d.markiert.doppelklick || 0}</b><span>Doppelklick (Wort)</span></div>
            <div><b>${d.markiert.dreifach || 0}</b><span>Dreifachklick (Absatz)</span></div>
            <div><b>${d.markiert.tastatur || 0}</b><span>mit Tastatur markiert</span></div>
            <div><b>${d.markiert.ziehen || 0}</b><span>mit der Maus gezogen</span></div>
            <div><b>${d.strgS}</b><span>mit Strg+S gespeichert</span></div>
          </div>
          <p><b>Tastenkombinationen:</b> ${chips(d.tasten)}</p>
          <p><b>Menüband benutzt:</b> ${chips(d.band)}</p>
          <p><b>Nachmachen:</b> ${d.nmz ? Object.entries(d.nachmachen).map(([k, v]) => `${esc(k)}: ${v}×`).join(" · ") : "kein einziges Mal – sehr gut!"}${d.freigaben ? ` · Freigaben durch die Lehrkraft: ${d.freigaben}` : ""}</p>
        </section>
        <section><h3>Schreibprotokoll</h3>
          <div class="sz-werte">
            <div><b>${d.sp.getippt}</b><span>Zeichen getippt</span></div>
            <div><b>${d.sp.geloescht}</b><span>Zeichen gelöscht</span></div>
            <div><b>${a ? a.zeichen : "–"}</b><span>Zeichen im Artikel</span></div>
            <div class="${d.sp.blockiert ? "warn" : ""}"><b>${d.sp.blockiert}</b><span>blockierte Einfügeversuche${d.sp.blockiertZeichen ? ` (${d.sp.blockiertZeichen} Zeichen)` : ""}</span></div>
            <div><b>${d.sp.fensterwechsel}</b><span>Wechsel aus der App${d.sp.aussenSek ? ` (${Math.round(d.sp.aussenSek / 60)} min)` : ""}</span></div>
            <div><b>${d.aktivMin} min</b><span>Arbeitszeit</span></div>
          </div>
        </section>
      </div>` };
  };
})();
