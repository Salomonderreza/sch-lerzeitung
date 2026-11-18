/* =====================================================================
   PDF-SITZUNGSBERICHT — wird von den SuS heruntergeladen und per Mail an
   den Dozenten geschickt. Enthält Aufgaben, den Artikel, Arbeitsweise,
   Schreibprotokoll und Ordnerstruktur. Zusätzlich steckt eine signierte
   Sicherung des gesamten Stands in der Datei (unsichtbar), damit sich der
   Stand mit dem Bericht auf jedem Laptop wieder laden lässt.
   ===================================================================== */
window.KL = window.KL || {};

KL.sitzungsbericht = async function ({ P, nr, def, R, sicherung }) {
  const U = KL.util;
  const d = KL.sitzungsDaten(def, R, P.daten.fs);
  const doc = new KL.PDF.Doc();
  const L = 50, Rr = KL.PDF.PAGE_W - 50, W = Rr - L;
  const UNTEN = KL.PDF.PAGE_H - 60;
  const PETROL = [0.12, 0.37, 0.4], GRAU = [0.38, 0.42, 0.45], GRUEN = [0.16, 0.46, 0.24], ROT = [0.7, 0.15, 0.12], SCHWARZ = [0.1, 0.12, 0.14];
  let y = 56;
  const platz = (h) => { if (y + h > UNTEN) { doc.addPage(); y = 56; } };
  const zeile = (text, o = {}) => {
    const size = o.size || 10, font = o.font || "R", x = o.x || 0;
    doc.wrap(text, (o.maxW || W) - x, font, size).forEach((ln) => {
      platz(size * 1.45);
      const lx = o.mitte ? L + x + ((o.maxW || W) - x - doc.width(ln, font, size)) / 2 : L + x;
      doc.text(lx, y + size, ln, { font, size, color: o.color || SCHWARZ });
      y += size * 1.45;
    });
  };
  const titel = (t) => {
    platz(90); // Überschrift nie allein am Seitenende
    y += 16;
    doc.text(L, y, t, { font: "B", size: 13, color: PETROL });
    y += 7;
    doc.line(L, y, Rr, y, { width: 0.8, color: PETROL });
    y += 12;
  };
  const kv = (k, v) => { platz(15); doc.text(L, y, k, { size: 10, color: GRAU }); doc.text(L + 150, y, String(v), { size: 10 }); y += 15; };
  const ende = R.beendet || Date.now();

  // ---------- Kopf ----------
  doc.text(L, y, "PROJEKT SCHÜLERZEITUNG · SITZUNGSBERICHT", { font: "B", size: 9, color: PETROL });
  y += 22;
  doc.wrap(`Sitzung ${nr}: ${def.thema}`, W, "B", 16).forEach((ln) => { doc.text(L, y, ln, { font: "B", size: 16 }); y += 20; });
  doc.text(L, y, `${def.textsorte} · Ordner „${def.ordner}“ · Datei „${def.datei}“`, { size: 10.5, color: GRAU });
  y += 12;
  doc.line(L, y, Rr, y, { width: 1.2, color: PETROL });
  y += 20;
  kv("Name", P.name);
  kv("Klasse / Kurs", P.klasse);
  kv("Datum", `${U.fmtDatum(R.start)} (Sitzung beendet ${U.fmtZeit(ende)} Uhr)`);
  kv("Arbeitszeit", `${d.aktivMin} ${d.aktivMin === 1 ? "Minute" : "Minuten"} aktiv in der App`);
  y += 6;
  // Note
  doc.rect(L, y, W, 58, { fill: PETROL });
  doc.text(L + 16, y + 42, d.note.note, { font: "B", size: 34, color: [1, 1, 1] });
  doc.text(L + 62, y + 24, `Note: ${d.note.note} (${d.note.wort})`, { font: "B", size: 15, color: [1, 1, 1] });
  doc.text(L + 62, y + 42, `${d.fertig} von ${d.gesamt} Aufgaben erledigt = ${d.note.basis} %${d.note.bonus && d.note.basis < 100 ? ` + ${KL.CONFIG.BONUS_PROZENT} % Bonus` : ""}`, { size: 10, color: [0.88, 0.94, 0.95] });
  y += 66;
  doc.rect(L, y, W, 44, { fill: [0.9, 0.94, 0.95] });
  doc.text(L + 14, y + 18, "Aufgaben", { font: "B", size: 10, color: PETROL });
  doc.text(L + 14, y + 35, `${d.fertig} von ${d.gesamt} erledigt`, { font: "B", size: 14 });
  const fz = d.fehler ? `Rechtschreibung: ${d.fehler.rs.length} · Grammatik: ${d.fehler.gr.length}` : "Artikel nicht gespeichert";
  doc.text(Rr - 14 - doc.width(fz, "B", 10), y + 18, fz, { font: "B", size: 10, color: d.fehler && !d.fehler.rs.length && !d.fehler.gr.length ? GRUEN : ROT });
  const bz = d.bonus ? (d.bonus.ok ? "Bonusaufgabe erledigt" : "Bonusaufgabe offen") : "";
  if (bz) doc.text(Rr - 14 - doc.width(bz, "R", 10), y + 35, bz, { size: 10, color: GRAU });
  y += 56;

  // ---------- Aufgaben ----------
  titel("Aufgaben");
  d.aufgaben.forEach((a) => {
    if (a.teil) { platz(20); y += 4; doc.text(L, y + 9, a.teil.toUpperCase(), { font: "B", size: 8.5, color: PETROL }); y += 15; return; }
    const lines = doc.wrap(KL.ohneHtml(a.text), W - 24, "R", 9.5);
    platz(lines.length * 13 + 2);
    doc.text(L + 4, y + 9, a.ok ? "+" : "–", { font: "B", size: 11, color: a.ok ? GRUEN : ROT });
    lines.forEach((ln, i) => doc.text(L + 20, y + 9 + i * 13, ln, { size: 9.5, color: a.ok ? SCHWARZ : GRAU }));
    y += lines.length * 13 + 2;
    if (a.hinweis) doc.wrap("Hinweis: " + a.hinweis, W - 24, "R", 8.5).forEach((ln) => { platz(11); doc.text(L + 20, y + 8, ln, { size: 8.5, color: GRAU }); y += 11; });
    (a.teile || []).forEach((t) => {
      platz(12);
      doc.text(L + 28, y + 8, t.ok ? "+" : "–", { font: "B", size: 9, color: t.ok ? GRUEN : ROT });
      doc.text(L + 40, y + 8, KL.ohneHtml(t.text), { size: 8.5, color: t.ok ? SCHWARZ : GRAU });
      y += 12;
    });
  });
  if (d.bonus) { y += 4; zeile(`${d.bonus.ok ? "+" : "–"} ${KL.ohneHtml(d.bonus.text)}`, { size: 9, color: d.bonus.ok ? GRUEN : GRAU }); }

  // ---------- Artikel ----------
  titel("Der Artikel");
  if (!d.artikel) {
    zeile(`Die Datei „${def.datei}“ wurde nicht im Ordner „${def.ordner}“ gespeichert.`, { color: ROT });
  } else {
    const a = d.artikel;
    zeile(`${a.woerter} Wörter · ${a.zeilen} Zeilen${def.laenge ? ` (mindestens ${def.laenge.zeilen})` : ""} · ${a.meldungen.length} Meldungen mit Zwischenüberschrift · ${a.saetze} Sätze · ${d.korrigiert} Korrekturen über Vorschläge`, { size: 9, color: GRAU });
    if (d.fehler && d.fehler.rs.length) zeile(`Noch falsch geschrieben: ${d.fehler.rs.join(", ")}`, { size: 9, color: ROT });
    if (d.fehler && d.fehler.gr.length) zeile(`Grammatik-Hinweise: ${[...new Set(d.fehler.gr)].join(" · ")}`, { size: 9, color: ROT });
    if (d.woerterbuch.length || d.ignoriert.length) zeile(`Ins Wörterbuch aufgenommen: ${d.woerterbuch.join(", ") || "–"} · Ignoriert: ${d.ignoriert.join(", ") || "–"}`, { size: 9, color: GRAU });
    y += 8;
    platz(30);
    const startY = y;
    doc.line(L, y, Rr, y, { width: 0.5 });
    y += 10;
    a.bloecke.forEach((b) => {
      const size = Math.max(9, Math.min(17, b.pt * 0.9));
      const font = b.fett ? "B" : "R";
      y += b.fett ? 4 : 0;
      zeile(b.text, { size, font, x: 10, maxW: W - 10, mitte: b.ausrichtung === "center" });
      y += 3;
    });
    y += 4;
    doc.line(L, y, Rr, y, { width: 0.5 });
    if (startY > 56 && y > startY) { /* Rahmen oben/unten genügt */ }
    y += 6;
  }

  // ---------- Arbeitsweise ----------
  titel("Arbeitsweise in Word");
  const mk = d.markiert;
  kv("Effektiv markiert", d.quote == null ? "–" : `${d.quote} %`);
  kv("Doppelklick / Dreifachklick", `${mk.doppelklick || 0} / ${mk.dreifach || 0}`);
  kv("Mit Tastatur markiert", mk.tastatur || 0);
  kv("Mit der Maus gezogen", mk.ziehen || 0);
  kv("Mit Strg+S gespeichert", d.strgS);
  zeile("Tastenkombinationen: " + (Object.entries(d.tasten).sort((x, z) => z[1] - x[1]).map(([k, v]) => `${k} (${v}×)`).join(", ") || "–"), { size: 9.5 });
  zeile("Menüband: " + (Object.entries(d.band).sort((x, z) => z[1] - x[1]).map(([k, v]) => `${k} (${v}×)`).join(", ") || "–"), { size: 9.5 });
  zeile("Nachmachen: " + (d.nmz ? Object.entries(d.nachmachen).map(([k, v]) => `${k} (${v}×)`).join(", ") : "keinmal") + (d.freigaben ? ` · Freigaben durch die Lehrkraft: ${d.freigaben}` : ""), { size: 9.5, color: d.nmz ? ROT : SCHWARZ });

  // ---------- Schreibprotokoll ----------
  titel("Schreibprotokoll");
  kv("Zeichen getippt / gelöscht", `${d.sp.getippt} / ${d.sp.geloescht}`);
  kv("Zeichen im Artikel", d.artikel ? d.artikel.zeichen : "–");
  kv("Blockierte Einfügeversuche", d.sp.blockiert ? `${d.sp.blockiert} (${d.sp.blockiertZeichen} Zeichen)` : "keine");
  kv("Wechsel aus der App", d.sp.fensterwechsel ? `${d.sp.fensterwechsel}× (${Math.round(d.sp.aussenSek / 60)} min)` : "keine");
  const minuten = Array.from({ length: Math.max(1, Math.min(120, Math.ceil(R.aktiv / 60))) }, (_, i) => R.sp.minuten[i] || 0);
  const maxM = Math.max(1, ...minuten);
  platz(60);
  doc.text(L, y + 8, "Getippte Zeichen pro Minute:", { size: 8.5, color: GRAU });
  y += 14;
  doc.rect(L, y, W, 40, { fill: [0.95, 0.96, 0.97] });
  const bw = Math.min(12, (W - 8) / minuten.length);
  minuten.forEach((v, i) => { const h = (v / maxM) * 36; if (h > 0) doc.rect(L + 4 + i * bw, y + 38 - h, Math.max(1, bw - 1.5), h, { fill: PETROL }); });
  y += 50;
  if (d.artikel && d.artikel.zeichen > d.sp.getippt + 60 && !R.aw.eingefuegtIntern) zeile("Hinweis: Der Artikel enthält deutlich mehr Zeichen, als in dieser Sitzung getippt wurden.", { size: 9, color: ROT });

  // ---------- Ordnerstruktur ----------
  titel("Ordnerstruktur „Schülerzeitung“");
  const fs = P.daten.fs;
  const EX = P.daten.export || {};
  const aktuell = (n) => EX[KL.fs.pfadVon(fs, n.id)] === KL.exportSumme(n);
  const alleDateien = Object.values(fs.nodes).filter((n) => n && !n.kinder && KL.fs.pfadVon(fs, n.id).startsWith("Desktop/Schülerzeitung/"));
  const geladen = alleDateien.filter(aktuell).length;
  zeile(`Auf den eigenen Computer übertragen (aktueller Stand heruntergeladen): ${geladen} von ${alleDateien.length} Dateien`, { size: 9.5, font: "B", color: geladen >= alleDateien.length ? GRUEN : ROT });
  y += 4;
  const baum = (id, tiefe) => {
    const n = fs.nodes[id];
    if (!n) return;
    platz(12);
    doc.text(L + tiefe * 14, y + 8, n.kinder ? `${n.name}/` : `${n.name}${aktuell(n) ? "   (übertragen)" : "   (nicht übertragen)"}`, { font: n.kinder ? "B" : "R", size: 9, color: n.kinder ? SCHWARZ : GRAU });
    y += 12;
    (n.kinder || []).map((k) => fs.nodes[k]).filter(Boolean)
      .sort((a, b) => (a.kinder ? 0 : 1) - (b.kinder ? 0 : 1) || a.name.localeCompare(b.name, "de"))
      .forEach((k) => baum(k.id, tiefe + 1));
  };
  const sz = KL.fs.findPath(fs, "Desktop/Schülerzeitung");
  if (sz) baum(sz.id, 0); else zeile("Der Ordner „Schülerzeitung“ fehlt.", { color: ROT });

  // ---------- Fußzeilen ----------
  const n = doc.pages.length;
  doc.pages.forEach((page, i) => {
    doc.cur = page;
    doc.line(L, KL.PDF.PAGE_H - 40, Rr, KL.PDF.PAGE_H - 40, { width: 0.5 });
    doc.text(L, KL.PDF.PAGE_H - 28, `${P.name} · ${P.klasse} · Sitzung ${nr} · ${U.fmtDatum(ende)}`, { size: 8, color: GRAU });
    const s = `Seite ${i + 1} von ${n}`;
    doc.text(Rr - doc.width(s, "R", 8), KL.PDF.PAGE_H - 28, s, { size: 8, color: GRAU });
  });
  doc.info = { Title: `Sitzungsbericht ${nr} – ${P.name}`, Author: P.name, Subject: `Schülerzeitung – Sitzung ${nr}: ${def.thema}`, CreationDate: "D:" + new Date(ende).toISOString().replace(/[-:T]/g, "").slice(0, 14) };
  doc.anhang = sicherung;
  return doc.output();
};
