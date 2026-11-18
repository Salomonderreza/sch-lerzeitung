/* =====================================================================
   SITZUNGEN — Startzustand des Redaktions-PCs, Themenliste, Textanalyse
   und die Aufgaben je Sitzung (zunächst Sitzung 1 als Beispiel).
   ===================================================================== */
window.KL = window.KL || {};

(() => {
  "use strict";
  const esc = (s) => KL.util.esc(s);

  // ---------- Themenliste (liegt als Word-Datei im Ordner Redaktion) ----------
  const THEMEN = [
    [1, "Eine Meldung aus meiner Stadt", "Kurzmeldung", "Meine Stadt", "Meldung_Stadt.docx"],
    [2, "Top 5: Musik, die mich begleitet", "Rangliste", "Musik", "Top5_Musik.docx"],
    [3, "Mein Traumberuf", "Porträt", "Traumberuf", "Traumberuf.docx"],
    [4, "Eine Nachricht aus Social Media", "Bericht", "Social Media", "Nachricht_Social_Media.docx"],
    [5, "Reportage: KI in meinem Alltag", "Reportage mit Bild", "05_KI", "Reportage_KI.docx"],
    [6, "Rezension: Ein Film oder eine Serie", "Rezension", "06_Film_Serie", "Rezension_Film.docx"],
    [7, "App-Test: Zwei Apps im Vergleich", "Vergleich", "07_App_Test", "App_Test.docx"],
    [8, "Ein Interview mit einer Dozentin oder einem Dozenten", "Interview", "08_Interview", "Interview_Dozent.docx"],
    [9, "Umfrage in unserer Klasse", "Umfrage", "09_Umfrage", "Umfrage_Klasse.docx"],
  ];
  KL.THEMEN = THEMEN;

  const THEMENLISTE_HTML =
    `<p><b><span style="font-size: 20pt;">Themenliste der Schülerzeitung</span></b></p>` +
    `<p>In jeder Sitzung schreibst du einen Artikel zu einem Thema. Lege für jedes Thema einen eigenen Ordner an.</p>` +
    THEMEN.map(([nr, t, art, ordner, datei]) => `<p><b>Sitzung ${nr}: ${esc(t)}</b><br>Textsorte: ${esc(art)} · Ordner: ${esc(ordner)} · Datei: ${esc(datei)}</p>`).join("") +
    `<p><b>Bonus-Thema:</b> Klimatipps für den Alltag</p><p><b>Sitzung 10:</b> Die Zeitung geht online!</p>`;

  const LESERBRIEFE = {
    "Leserbrief_Bauer.docx": "Liebe Redaktion, ich freue mich sehr auf die erste Ausgabe. Schreibt bitte auch über Sport in unserer Stadt!",
    "Leserbrief_Demir.docx": "Hallo zusammen, könnt ihr einen Artikel über günstige Freizeitangebote schreiben?",
    "Leserbrief_Fischer.docx": "Guten Tag, ich wünsche mir mehr Berichte über Menschen aus unserer Schule.",
    "Leserbrief_Kowalski.docx": "Liebe Redaktion, bitte denkt an eine Rubrik mit Rezepten aus verschiedenen Ländern.",
    "Leserbrief_Nguyen.docx": "Hallo, ich finde die Idee super. Wann erscheint die Zeitung online?",
    "Leserbrief_Schmidt.docx": "Sehr geehrte Redaktion, ich hätte gerne Tipps zum Lernen für die Abschlussprüfung.",
  };

  // Startzustand des virtuellen PCs (Ordner „Schülerzeitung“ auf dem Desktop)
  KL.startPC = function () {
    const D = KL.fs.datei;
    const fsState = KL.fs.build({
      desktop: {
        "Schülerzeitung": {
          Redaktion: {
            "Themenliste.docx": D(18, "02.11.2026 09:12"),
            Leserbriefe: Object.fromEntries(Object.keys(LESERBRIEFE).map((n, i) => [n, D(13 + i, `0${3 + i}.11.2026 1${i}:2${i}`)])),
          },
        },
      },
      dokumente: { "Bewerbung_Entwurf.docx": D(24, "12.10.2026 18:40"), "Einkaufsliste.txt": D(1, "28.10.2026 07:55") },
      downloads: { "Stundenplan.pdf": D(212, "01.09.2026 08:30") },
      bilder: { "Urlaub_2025.jpg": null },
      musik: {},
      start: "Desktop",
    });
    const setze = (pfad, html) => { const n = KL.fs.findPath(fsState, pfad); if (n) n.inhalt = html; };
    setze("Desktop/Schülerzeitung/Redaktion/Themenliste.docx", THEMENLISTE_HTML);
    Object.entries(LESERBRIEFE).forEach(([n, t]) => setze(`Desktop/Schülerzeitung/Redaktion/Leserbriefe/${n}`, `<p>${esc(t)}</p>`));
    setze("Dokumente/Bewerbung_Entwurf.docx", "<p>Sehr geehrte Damen und Herren,</p><p>hiermit bewerbe ich mich …</p>");
    setze("Dokumente/Einkaufsliste.txt", "<p>Milch, Brot, Äpfel</p>");
    return fsState;
  };

  // ---------- Textanalyse eines Word-Dokuments (HTML) ----------
  const FONT_SIZE = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 };
  function stil(textNode, block) {
    let fett = null, pt = null, kursiv = null;
    for (let el = textNode.parentElement; el && el !== block.parentElement; el = el.parentElement) {
      const tag = el.tagName;
      if (fett === null) {
        const w = el.style && el.style.fontWeight;
        if (w) fett = w === "bold" || w === "bolder" || +w >= 600;
        else if (tag === "B" || tag === "STRONG") fett = true;
      }
      if (kursiv === null) {
        const s = el.style && el.style.fontStyle;
        if (s) kursiv = s === "italic";
        else if (tag === "I" || tag === "EM") kursiv = true;
      }
      if (pt === null) {
        const fs = el.style && el.style.fontSize;
        if (fs) {
          const m = /([\d.]+)(pt|px)/.exec(fs);
          if (m) pt = m[2] === "pt" ? +m[1] : +m[1] * 0.75;
        } else if (tag === "FONT" && el.getAttribute("size")) pt = FONT_SIZE[el.getAttribute("size")] || 11;
      }
      if (el === block) break;
    }
    return { fett: !!fett, kursiv: !!kursiv, pt: pt || 11 };
  }
  function bloecke(box) {
    const out = [];
    let lose = null;
    box.childNodes.forEach((n) => {
      if (n.nodeType === 3 || (n.nodeType === 1 && !/^(P|DIV|H\d|UL|OL|LI|TABLE|CENTER)$/.test(n.tagName))) {
        if (!lose) {
          lose = document.createElement("p");
          const ausr = ausrichtungVon(box);
          if (ausr !== "left") lose.style.textAlign = ausr;
          out.push({ el: lose, virtuell: true, nodes: [] });
        }
        out[out.length - 1].nodes.push(n);
      } else if (n.nodeType === 1) {
        lose = null;
        // Hülle um Absätze (z. B. <div align="center"><p>…</p></div>): hineinschauen
        if (/^(DIV|SECTION|BLOCKQUOTE|CENTER)$/.test(n.tagName) && n.querySelector(":scope > p, :scope > div, :scope > h1, :scope > h2, :scope > h3")) {
          bloecke(n).forEach((el) => out.push({ el }));
        } else out.push({ el: n });
      }
    });
    // lose Knoten in einen echten Block legen (nur für die Analyse)
    out.forEach((b) => { if (b.virtuell) b.nodes.forEach((n) => b.el.appendChild(n.cloneNode(true))); });
    return out.flatMap((b) => zeilenTeilen(b.el));
  }
  // Ein Absatz mit Zeilenumbrüchen (<br>, z. B. durch Einfügen oder
  // Umschalt+Enter) wird in einzelne Zeilen geteilt – sonst würde eine
  // Zwischenüberschrift mit dem Text darunter zu einem Block verschmelzen.
  function zeilenTeilen(el) {
    const brs = [...el.querySelectorAll("br")].filter((br) => {
      const vor = document.createRange(); vor.setStart(el, 0); vor.setEndBefore(br);
      const nach = document.createRange(); nach.setStartAfter(br); nach.setEnd(el, el.childNodes.length);
      return vor.toString().trim() && nach.toString().trim();
    });
    if (!brs.length) return [el];
    const ausr = ausrichtungVon(el);
    const grenzen = [[el, 0], ...brs.map((br) => br), [el, el.childNodes.length]];
    const teile = [];
    for (let i = 0; i < grenzen.length - 1; i++) {
      const r = document.createRange();
      const a = grenzen[i], b = grenzen[i + 1];
      if (Array.isArray(a)) r.setStart(a[0], a[1]); else r.setStartAfter(a);
      if (Array.isArray(b)) r.setEnd(b[0], b[1]); else r.setEndBefore(b);
      const p = document.createElement("p");
      if (ausr !== "left") p.style.textAlign = ausr;
      p.appendChild(r.cloneContents());
      p.querySelectorAll("br").forEach((x) => x.remove());
      teile.push(p);
    }
    return teile;
  }
  const SATZ = (t) => KL.util.norm(t).split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter((x) => x.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length >= 3);
  // Ausrichtung: CSS (Chrome) oder align-Attribut (Firefox), auch von Hüllen
  function ausrichtungVon(b) {
    for (let el = b; el && el.nodeType === 1; el = el.parentElement) {
      const a = (el.style && el.style.textAlign) || (el.getAttribute && el.getAttribute("align")) || (el.tagName === "CENTER" ? "center" : "");
      if (a) return a.toLowerCase() === "middle" ? "center" : a.toLowerCase();
    }
    return "left";
  }
  function blockInfo(b) {
    const tn = [];
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) if (n.data.trim()) tn.push(n);
    const st = tn.map((t) => stil(t, b));
    const text = KL.util.norm(b.textContent);
    return {
      text,
      fett: st.length > 0 && st.every((x) => x.fett),
      pt: st.length ? Math.min(...st.map((x) => x.pt)) : 11,
      ausrichtung: ausrichtungVon(b),
      woerter: text.split(/\s+/).filter((x) => /[\p{L}\d]/u.test(x)).length,
      saetze: SATZ(text).length,
    };
  }
  KL.textAnalyse = function (html) {
    const box = document.createElement("div");
    box.innerHTML = html || "";
    const bl = bloecke(box).filter((b) => KL.util.norm(b.textContent)).map(blockInfo);
    const res = { ueberschrift: null, bloecke: bl, meldungen: [], saetze: 0, woerter: 0, zeichen: 0, zeilen: 0, saetzeGross: 0, doppelLeer: 0, absaetze: bl.length };
    if (!bl.length) return res;
    res.ueberschrift = bl[0];
    // Meldungen: jede beginnt mit einer Zwischenüberschrift (ganz fett, kurz)
    let akt = null;
    bl.slice(1).forEach((b) => {
      if (b.fett && b.woerter <= 12 && b.saetze <= 1) { akt = { kopf: b, saetze: 0, woerter: 0 }; res.meldungen.push(akt); }
      else if (akt) { akt.saetze += b.saetze; akt.woerter += b.woerter; }
    });
    const rumpf = bl.slice(1).map((b) => b.text).join(" ");
    const saetze = SATZ(rumpf);
    res.saetze = saetze.length;
    res.saetzeGross = saetze.filter((x) => /^[„"»(]?\p{Lu}/u.test(x)).length;
    const alle = bl.map((b) => b.text).join(" ");
    res.woerter = bl.reduce((a, b) => a + b.woerter, 0);
    res.zeichen = alle.length;
    res.zeilen = KL.zeilenZaehlen(html);
    return res;
  };

  // ---------- Zeilen zählen (wie auf der Word-Seite) ----------
  // Der Text wird unsichtbar in eine Seite mit derselben Breite und Schrift
  // gesetzt wie im Word-Fenster; gezählt werden Zeilen, in denen Text steht.
  let messHost = null;
  const zeilenCache = new Map();
  function zeilenIn(root) {
    let n = 0;
    const bl = root.children.length ? [...root.children] : [root];
    bl.forEach((b) => {
      const rects = [];
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let t;
      while ((t = w.nextNode())) {
        if (!t.data.trim()) continue;
        const r = document.createRange(); r.selectNodeContents(t);
        [...r.getClientRects()].forEach((x) => { if (x.width > 0.5 && x.height > 0) rects.push(x); });
      }
      rects.sort((a, c) => a.top - c.top);
      let unten = -Infinity;
      rects.forEach((x) => { if (x.top >= unten - 2) { n++; unten = x.bottom; } else unten = Math.max(unten, x.bottom); });
    });
    return n;
  }
  KL.zeilenZaehlen = function (html) {
    html = html || "";
    if (zeilenCache.has(html)) return zeilenCache.get(html);
    if (!messHost) {
      messHost = document.createElement("div");
      messHost.className = "wr sz-mess";
      messHost.setAttribute("aria-hidden", "true");
      messHost.innerHTML = `<div class="wd-page"><div class="wr-editor"></div></div>`;
      document.body.appendChild(messHost);
    }
    const ed = messHost.querySelector(".wr-editor");
    ed.innerHTML = html;
    const n = zeilenIn(ed);
    ed.innerHTML = "";
    if (zeilenCache.size > 60) zeilenCache.delete(zeilenCache.keys().next().value);
    zeilenCache.set(html, n);
    return n;
  };

  // ---------- Dateien finden (tolerant wie Windows) ----------
  // Windows unterscheidet nicht zwischen Groß- und Kleinschreibung und
  // ignoriert Leerzeichen am Ende. Für Hinweise suchen wir außerdem nach
  // „fast richtigen“ Namen (Meine_Stadt, meinestadt …) im ganzen PC.
  const nn = (x) => KL.util.norm(String(x || "")).trim().replace(/[\s.]+$/, "").replace(/\s+/g, " ").toLowerCase();
  const aehnlich = (x) => nn(x).replace(/\.(docx?|txt)$/, "").replace(/[\s_\-.]+/g, "");
  KL.pfadFinden = function (fsState, pfad) {
    let node = fsState.nodes.pc;
    for (const teil of pfad.split("/").filter(Boolean)) {
      if (!node || !node.kinder) return null;
      node = node.kinder.map((id) => fsState.nodes[id]).find((k) => k && nn(k.name) === nn(teil)) || null;
      if (!node) return null;
    }
    return node;
  };
  KL.gleicherPfad = (a, b) => !!a && !!b && nn(a) === nn(b);
  KL.aehnlicherName = (a, b) => !!a && !!b && aehnlich(a.split("/").pop()) === aehnlich(b.split("/").pop());
  function aehnlicheKnoten(fsState, name, typ) {
    const ziel = aehnlich(name);
    return Object.values(fsState.nodes).filter((n) => n && n.name && aehnlich(n.name) === ziel && (typ === "ordner" ? !!n.kinder : !n.kinder));
  }
  // Hinweis, warum ein Ordner/eine Datei nicht gefunden wird
  function wo(P, pfad, typ) {
    if (KL.pfadFinden(P.fs, pfad)) return null;
    const teile = pfad.split("/");
    // fehlt schon ein übergeordneter Ordner? → Hinweis für den Ordner
    for (let i = teile.length - 1; i > 2; i--) {
      const oben = teile.slice(0, i).join("/");
      if (!KL.pfadFinden(P.fs, oben)) return wo(P, oben, "ordner");
    }
    const name = teile[teile.length - 1], eltern = teile[teile.length - 2];
    const was = typ === "ordner" ? "Der Ordner" : "Die Datei";
    const treffer = aehnlicheKnoten(P.fs, name, typ).map((n) => ({ n, pfad: KL.fs.pfadVon(P.fs, n.id) }));
    if (!treffer.length) return null;
    const t = treffer.find((x) => !x.pfad.startsWith("Papierkorb")) || treffer[0];
    const ort = t.pfad.split("/").slice(0, -1).join(" › ");
    if (t.pfad.startsWith("Papierkorb")) return `${was} „${t.n.name}“ liegt im Papierkorb. Stelle sie wieder her.`;
    if (KL.gleicherPfad(t.pfad.split("/").slice(0, -1).join("/"), teile.slice(0, -1).join("/"))) return `Achte auf die genaue Schreibweise: Er/sie heißt bei dir „${t.n.name}“, verlangt ist „${name}“. Benenne ihn/sie um (F2).`.replace("Er/sie heißt", typ === "ordner" ? "Der Ordner heißt" : "Die Datei heißt").replace("ihn/sie", typ === "ordner" ? "ihn" : "sie");
    return `${was} „${t.n.name}“ liegt bei dir in ${ort}. Sie gehört in den Ordner „${eltern}“: Verschiebe ${typ === "ordner" ? "den Ordner" : "die Datei"} dorthin.`.replace("Sie gehört", typ === "ordner" ? "Er gehört" : "Sie gehört");
  }
  KL.woHinweis = wo;

  // ---------- Sitzungen ----------
  // Aufgabe: { id, text, pruef(P) } · mit teile: [[id, text, pruef]] · { teil: "Überschrift" } trennt Abschnitte
  // P = { fs, ev:Set, docs:[{pfad, html}], aw (Arbeitsweise), offen (Anzahl Fenster) }
  const pfadOk = (fs, pfad, typ) => { const n = KL.pfadFinden(fs, pfad); return !!n && (!typ || (typ === "ordner" ? !!n.kinder : !n.kinder)); };
  const BASIS = "Desktop/Schülerzeitung";
  const ZIEL1 = `${BASIS}/Meine Stadt/Meldung_Stadt.docx`;
  const MIN_ZEILEN1 = 30;

  // Analysen für die Schreibaufgaben: alle offenen Dokumente, die Zieldatei
  // und gleichnamige Dateien an falscher Stelle (das Schreiben zählt trotzdem;
  // den Speicherort prüfen eigene Aufgaben).
  function texte(P, ziel) {
    const k = P.docs.map((d) => d.html);
    const z = KL.pfadFinden(P.fs, ziel);
    if (z && z.inhalt) k.push(z.inhalt);
    aehnlicheKnoten(P.fs, ziel.split("/").pop(), "datei").forEach((n) => { if (n !== z && n.inhalt) k.push(n.inhalt); });
    return k.map(KL.textAnalyse);
  }
  const gespeichert = (P, ziel) => { const z = KL.pfadFinden(P.fs, ziel); return z && z.inhalt ? KL.textAnalyse(z.inhalt) : null; };
  // Prüfregeln für den Artikel von Sitzung 1
  const S1 = {
    kopf: (a) => !!a.ueberschrift && a.ueberschrift.fett && a.ueberschrift.pt >= 16 && a.ueberschrift.ausrichtung === "center",
    zwischen: (a) => a.meldungen.length >= 3 && a.meldungen.every((m) => m.kopf.pt >= 12),
    saetze: (a) => a.meldungen.filter((m) => m.saetze >= 4).length >= 3,
    laenge: (a) => a.zeilen >= MIN_ZEILEN1,
  };
  // Erklärt, welche kurzen Zeilen wie Zwischenüberschriften aussehen, aber
  // nicht als solche zählen (nicht fett oder zu klein)
  function zwischenDiagnose(a) {
    if (!a || !a.bloecke.length) return null;
    const gut = a.meldungen.filter((m) => m.kopf.pt >= 12).length;
    const probleme = [];
    a.bloecke.slice(1).forEach((b) => {
      const kurz = b.woerter >= 1 && b.woerter <= 8 && b.saetze <= 1 && !/[.!?:,;]$/.test(b.text);
      if (!kurz) return;
      const fehlt = [!b.fett && "nicht ganz fett", b.pt < 12 && `nur ${b.pt} pt`].filter(Boolean);
      if (fehlt.length) probleme.push(`„${b.text}“ (${fehlt.join(", ")})`);
    });
    if (gut >= 3 && !probleme.length) return null;
    return `Erkannt: ${gut} von 3 Zwischenüberschriften.${probleme.length ? ` Noch nicht richtig formatiert: ${probleme.slice(0, 4).join(" · ")}.` : ""}`;
  }
  const leserbriefeGelesen = (P) => [...P.ev].filter((e) => e.startsWith(`word:geoeffnet:${BASIS}/Redaktion/Leserbriefe/`)).length;

  KL.SITZUNGEN = [
    {
      nr: 1, thema: THEMEN[0][1], textsorte: "Kurzmeldungen", ordner: "Meine Stadt", datei: "Meldung_Stadt.docx", minuten: 90,
      laenge: { ziel: ZIEL1, zeilen: MIN_ZEILEN1 },
      einleitung: "Willkommen in der Redaktion! Für die erste Ausgabe schreibst du drei Meldungen aus deiner Stadt: Was ist neu, was ist los, was ist kurios? Jede Meldung beantwortet die W-Fragen: Wer? Was? Wann? Wo? – und erzählt ein paar Einzelheiten dazu. Dein Artikel wird mindestens 30 Zeilen lang. Recherchieren (Google, KI) ist erlaubt, schreiben musst du selbst.",
      aufgaben: [
        { teil: "A · Die Redaktion kennenlernen" },
        { id: "redaktion", text: "Öffne auf dem Desktop den Ordner <b>Schülerzeitung</b> und darin den Ordner <b>Redaktion</b>.",
          pruef: (P) => P.ev.has(`navigiere:${BASIS}/Redaktion`) },
        { id: "themenliste", text: "Öffne die <b>Themenliste</b> mit einem Doppelklick, lies das Thema für Sitzung 1 und schließe sie wieder.",
          pruef: (P) => P.ev.has(`oeffne:${BASIS}/Redaktion/Themenliste.docx`) },
        { id: "leserbriefe", text: "Öffne den Ordner <b>Leserbriefe</b> und lies <b>mindestens drei</b> Leserbriefe. Sie verraten dir, was die Leserinnen und Leser interessiert.",
          pruef: (P) => leserbriefeGelesen(P) >= 3 },
        { id: "auswahl", text: "Übe im Ordner <b>Leserbriefe</b> die Dateiauswahl:",
          teile: [
            ["klick", "eine Datei mit einem Klick auswählen", (P) => P.ev.has("auswahl:klick:Leserbriefe")],
            ["strg", "mit <b>Strg</b> zwei Dateien auswählen, die nicht nebeneinander liegen", (P) => P.ev.has("auswahl:strg2:Leserbriefe")],
            ["umschalt", "mit <b>Umschalt</b> eine zusammenhängende Reihe auswählen", (P) => P.ev.has("auswahl:umschalt3:Leserbriefe")],
            ["alle", "mit <b>Strg+A</b> alle Dateien auswählen", (P) => P.ev.has("auswahl:alle:Leserbriefe")],
            ["leer", "mit einem Klick auf eine freie Fläche die Auswahl aufheben", (P) => P.ev.has("auswahl:leer:Leserbriefe")],
          ] },
        { id: "ordner", text: "Gehe zurück in den Ordner <b>Schülerzeitung</b> (Adressleiste oder Pfeil nach oben) und erstelle <b>dort</b> einen neuen Ordner mit dem Namen <b>Meine Stadt</b>.",
          pruef: (P) => pfadOk(P.fs, `${BASIS}/Meine Stadt`, "ordner"),
          hinweis: (P) => wo(P, `${BASIS}/Meine Stadt`, "ordner") },
        { id: "kopie", text: "Kopiere den Leserbrief, der dich am meisten anspricht, in deinen Ordner <b>Meine Stadt</b> und benenne die Kopie in <b>Leserwunsch.docx</b> um.",
          pruef: (P) => {
            const n = KL.pfadFinden(P.fs, `${BASIS}/Meine Stadt/Leserwunsch.docx`);
            return !!n && !!n.inhalt && Object.keys(LESERBRIEFE).some((k) => KL.ohneHtml(n.inhalt).includes(KL.ohneHtml(LESERBRIEFE[k]).replace(/<[^>]+>/g, "").slice(0, 25)));
          },
          hinweis: (P) => wo(P, `${BASIS}/Meine Stadt/Leserwunsch.docx`, "datei") },
        { teil: "B · Die Meldungen schreiben" },
        { id: "word", text: "Starte <b>Word über das Startmenü</b>.",
          pruef: (P) => P.ev.has("start:word") },
        { id: "kopf", text: "Schreibe in die erste Zeile eine Hauptüberschrift, z. B. <b>„Neues aus …“</b> mit dem Namen deiner Stadt. Formatiere sie <b>fett</b>, <b>mindestens 16 pt</b> und <b>zentriert</b>.",
          pruef: (P) => texte(P, ZIEL1).some(S1.kopf) },
        { id: "zwischen", text: "Schreibe <b>drei Meldungen</b>. Jede beginnt mit einer eigenen Zwischenüberschrift (eine Zeile, <b>fett</b>, <b>mindestens 12 pt</b>).",
          pruef: (P) => texte(P, ZIEL1).some(S1.zwischen),
          hinweis: (P) => { const t = texte(P, ZIEL1); if (!t.length) return null; const a = t.reduce((x, y) => (y.meldungen.length > x.meldungen.length ? y : x)); return zwischenDiagnose(a); } },
        { id: "saetze", text: "Jede Meldung hat <b>mindestens 4 Sätze</b> und beantwortet: <b>Wer? Was? Wann? Wo?</b>",
          pruef: (P) => texte(P, ZIEL1).some(S1.saetze) },
        { id: "laenge", text: `Dein Artikel ist insgesamt <b>mindestens ${MIN_ZEILEN1} Zeilen</b> lang. Die Zeilenzahl siehst du unten in der Statusleiste von Word.`,
          pruef: (P) => texte(P, ZIEL1).some(S1.laenge),
          hinweis: (P) => { const z = Math.max(0, ...texte(P, ZIEL1).map((a) => a.zeilen)); return z ? `Bisher ${z} von ${MIN_ZEILEN1} Zeilen.` : null; } },
        { id: "speichern", text: "Speichere frühzeitig über <b>Speichern unter</b> als <b>Meldung_Stadt.docx</b> im Ordner <b>Meine Stadt</b>.",
          pruef: (P) => pfadOk(P.fs, ZIEL1, "datei"),
          hinweis: (P) => wo(P, ZIEL1, "datei") },
        { id: "strgs", text: "Speichere danach zwischendurch immer wieder mit <b>Strg+S</b> – mindestens dreimal.",
          pruef: (P) => (P.aw.strgS || 0) >= 3 },
        { teil: "C · Korrigieren und abschließen" },
        { id: "korrektur", text: "Korrigiere alle <b style=\"text-decoration:underline wavy #e81123\">rot</b> (Rechtschreibung) und <b style=\"text-decoration:underline double #2f6fd6\">blau</b> (Grammatik) unterstrichenen Stellen. Rechtsklick auf die Stelle zeigt Vorschläge. Speichere danach.",
          pruef: (P) => {
            const z = KL.pfadFinden(P.fs, ZIEL1);
            if (!z || !z.inhalt || !KL.pruefung.istBereit()) return false;
            const f = KL.pruefung.fehler(z.inhalt);
            const a = KL.textAnalyse(z.inhalt);
            return !!f && f.rs.length === 0 && f.gr.length === 0 && a.woerter >= 40;
          },
          hinweis: (P) => {
            const z = KL.pfadFinden(P.fs, ZIEL1);
            if (!z) return wo(P, ZIEL1, "datei");
            if (!z.inhalt || !KL.pruefung.istBereit()) return null;
            const f = KL.pruefung.fehler(z.inhalt);
            const n = f.rs.length + f.gr.length;
            return n ? `In der gespeicherten Datei sind noch ${n} markierte ${n === 1 ? "Stelle" : "Stellen"}${f.rs.length ? `: ${f.rs.slice(0, 5).join(", ")}` : ""}.` : null;
          } },
        { id: "fertig", text: `Die <b>gespeicherte</b> Datei enthält alles: Hauptüberschrift, drei Zwischenüberschriften, drei Meldungen mit je mindestens 4 Sätzen und insgesamt mindestens ${MIN_ZEILEN1} Zeilen.`,
          pruef: (P) => { const a = gespeichert(P, ZIEL1); return !!a && S1.kopf(a) && S1.zwischen(a) && S1.saetze(a) && S1.laenge(a); },
          hinweis: (P) => {
            const a = gespeichert(P, ZIEL1);
            if (!a) return wo(P, ZIEL1, "datei") || "Die Datei ist noch nicht gespeichert.";
            const fehlt = [!S1.kopf(a) && "Hauptüberschrift (fett, 16 pt, zentriert)", !S1.zwischen(a) && `drei Zwischenüberschriften (fett, 12 pt) – ${zwischenDiagnose(a) || ""}`, !S1.saetze(a) && "je 4 Sätze pro Meldung", !S1.laenge(a) && `${MIN_ZEILEN1} Zeilen (gespeichert sind ${a.zeilen})`].filter(Boolean);
            return fehlt.length ? `In der gespeicherten Datei fehlt noch: ${fehlt.join(" · ")}. Hast du nach den letzten Änderungen gespeichert?` : null;
          } },
        { id: "zu", text: "Schließe zum Schluss <b>alle Fenster</b> (Word und Explorer).",
          pruef: (P) => P.offen === 0 && pfadOk(P.fs, ZIEL1, "datei"),
          hinweis: (P) => wo(P, ZIEL1, "datei") },
      ],
      bonus: { id: "bonus", text: "<b>Bonus für Schnelle:</b> Beantworte deinen Leserwunsch: Schreibe eine kurze Antwort (mindestens 5 Sätze) und speichere sie als <b>Antwort_Leserbrief.docx</b> im Ordner <b>Meine Stadt</b>.",
        pruef: (P) => { const a = gespeichert(P, `${BASIS}/Meine Stadt/Antwort_Leserbrief.docx`); return !!a && a.saetze + (a.ueberschrift ? a.ueberschrift.saetze : 0) >= 5; } },
    },
  ];
  KL.aufgabenListe = (def) => def.aufgaben.filter((a) => a.id);

  // Ereignisse aus dem Explorer in prüfbare Kennungen übersetzen
  KL.ereignisKennungen = function (op, x) {
    const out = [];
    if (op === "navigiere" && x.pfad) out.push(`navigiere:${x.pfad}`);
    if (op === "oeffne" && x.pfad) out.push(`oeffne:${x.pfad}`);
    if (op === "auswahl") {
      const ordner = (x.ordner || "").split("/").pop();
      if (x.art === "klick") out.push(`auswahl:klick:${ordner}`);
      if (x.art === "strg" && x.anzahl >= 2) out.push(`auswahl:strg2:${ordner}`);
      if (x.art === "umschalt" && x.anzahl >= 3) out.push(`auswahl:umschalt3:${ordner}`);
      if (x.art === "alle") out.push(`auswahl:alle:${ordner}`);
      if (x.art === "leer") out.push(`auswahl:leer:${x.ordnerAktuell || ordner}`);
    }
    return out;
  };
})();
