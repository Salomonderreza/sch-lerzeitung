/* =====================================================================
   AUSWERTUNG EINER SITZUNG — Daten (für Bildschirm und PDF-Bericht)
   ===================================================================== */
window.KL = window.KL || {};
(() => {
  "use strict";
  const { esc } = KL.util;
  const BAND = { fett: "Fett", kursiv: "Kursiv", unterstrichen: "Unterstrichen", groesser: "Schrift größer", kleiner: "Schrift kleiner", schriftgrad: "Schriftgrad", kopieren: "Kopieren", einfuegen: "Einfügen", ausschneiden: "Ausschneiden", undo: "Rückgängig", redo: "Wiederholen", speichern: "Speichern", links: "Linksbündig", zentriert: "Zentriert", rechts: "Rechtsbündig", rsgr: "Rechtschreibung und Grammatik" };
  const NMN = { rueck: "Buchstabenweise gelöscht", zieh: "Einzelnes Wort mit der Maus markiert", band: "Kopieren/Einfügen über das Menüband" };
  KL.ohneHtml = (h) => String(h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

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
    const prozent = Math.min(100, basis + (bonus && bonus.ok ? (C.BONUS_PROZENT || 0) : 0));
    const stufe = (C.NOTEN || []).find(([ab]) => prozent >= ab) || [0, "–", ""];
    const note = { prozent, basis, bonus: !!(bonus && bonus.ok), note: stufe[1], wort: stufe[2] };
    return {
      note,
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
        <section class="sz-note"><div class="sz-note-zahl">${esc(d.note.note)}</div><div><b>Note: ${esc(d.note.note)} (${esc(d.note.wort)})</b><br><span>${d.fertig} von ${d.gesamt} Aufgaben erledigt = ${d.note.basis} %${d.note.bonus && d.note.basis < 100 ? ` + ${KL.CONFIG.BONUS_PROZENT} % Bonus` : ""}</span></div></section>
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
        <section><h3>Deine Arbeitsweise</h3>
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
