/* =====================================================================
   AUTOMATISCHE ÜBERPRÜFUNG wie in Word
   • Rot (Wellenlinie): Rechtschreibung – echtes Hunspell mit deutschem
     Wörterbuch (igerman98), versteht zusammengesetzte Wörter.
   • Blau (Doppellinie): Grammatik/Zeichensetzung – Regeln für typische
     Fehler (Satzanfang, doppelte Wörter, Leerzeichen, Komma vor dass/weil
     …, das/dass, seit/seid, fehlendes Satzzeichen).
   Alles läuft offline im Browser. Markiert wird über die CSS Highlight
   API, der Text selbst wird nicht verändert.
   ===================================================================== */
window.KL = window.KL || {};

KL.pruefung = (() => {
  "use strict";
  let hs = null;
  const cacheOk = new Map(), cacheVor = new Map();
  let benutzer = new Set(), ignoriert = new Set(), grIgnoriert = new Set();

  const bereit = (async () => {
    try {
      const f = await HunspellAsm.loadModule();
      const enc = new TextEncoder();
      const aff = f.mountBuffer(enc.encode(KL.WOERTERBUCH_DE.aff), "de.aff");
      const dic = f.mountBuffer(enc.encode(KL.WOERTERBUCH_DE.dic), "de.dic");
      hs = f.create(aff, dic);
      return true;
    } catch (e) { console.warn("Rechtschreibprüfung nicht verfügbar", e); return false; }
  })();

  function richtig(w) {
    if (!hs) return true;
    if (benutzer.has(w) || ignoriert.has(w)) return true;
    if (w.length < 2 || /\d/.test(w)) return true;
    if (/^\p{Lu}{2,5}s?$/u.test(w)) return true; // Abkürzungen wie KI, OGS
    if (cacheOk.has(w)) return cacheOk.get(w);
    let ok = hs.spell(w);
    if (!ok && w.includes("-")) ok = w.split("-").filter(Boolean).every((t) => t.length < 2 || hs.spell(t) || benutzer.has(t));
    if (!ok && !w.includes("-")) ok = /^\p{Lu}/u.test(w) ? zusammengesetzt(w, 0) : ZAHLWORT.test(w);
    cacheOk.set(w, ok);
    return ok;
  }
  // Zusammengesetzte Wörter, die nicht im Wörterbuch stehen (Hüpfburg,
  // Kinderschminken, zweihunderttausend): Word erkennt sie meist als richtig.
  // Erlaubt: Wort/Verbstamm + (Fugen-s/-n/-en/-es) + Wort, auch dreiteilig.
  // kleingeschriebene Zusammensetzungen nur bei Zahlwörtern (dreiundzwanzig …)
  const ZAHLWORT = /^(ein|eins|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend|und|zehnt|ste|ten|stel|tel)+$/i;
  const gross = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  function ersterTeil(a) {
    const k = a.toLowerCase();
    const formen = [k, k.replace(/(es|en|s|n|e)$/, "")].filter((x) => x.length >= 4);
    return formen.some((x) => hs.spell(gross(x)) || hs.spell(x) || hs.spell(x + "en") || hs.spell(x + "n") || hs.spell(gross(x) + "e"));
  }
  function zusammengesetzt(w, tiefe) {
    if (w.length < 8 || tiefe > 1) return false;
    const istGross = /^\p{Lu}/u.test(w);
    for (let i = w.length - 4; i >= 4; i--) {
      const a = w.slice(0, i), b = w.slice(i);
      const bOk = istGross ? hs.spell(gross(b)) : (hs.spell(b) || hs.spell(gross(b)));
      if (!bOk) continue;
      if (ersterTeil(a) || zusammengesetzt(gross(a), tiefe + 1)) return true;
    }
    return false;
  }
  function vorschlaege(w) {
    if (!hs) return [];
    if (!cacheVor.has(w)) cacheVor.set(w, hs.suggest(w).slice(0, 5));
    return cacheVor.get(w);
  }

  // ---------- Grammatik-Regeln ----------
  const KONJ = "dass|weil|obwohl|sodass|nachdem|bevor|wenn|ob|sondern|damit es|wodurch|weshalb";
  const KEIN_KOMMA_NACH = new Set(["und", "oder", "als", "so", "ohne", "statt", "anstatt", "außer", "auch", "nur", "selbst", "sogar", "gerade", "erst", "bis", "wie", "aber", "denn", "doch"]);
  const ABK = /(?:^|[\s(])(?:z|B|ca|bzw|usw|etc|Nr|Str|u|a|d|h|vgl|ggf|evtl|inkl|zzgl|Dr|Hr|Fr|Mio|Mrd|St|Jh|o)\.\s+$/;
  function grammatik(text) {
    const out = [];
    const add = (start, end, meldung, vorschlaege, regel) => out.push({ start, end, meldung, vorschlaege: vorschlaege || [], regel });
    let m;
    // doppelte Leerzeichen
    for (m of text.matchAll(/ {2,}/g)) add(m.index, m.index + m[0].length, "Doppeltes Leerzeichen.", [" "], "leer2");
    // Leerzeichen vor Satzzeichen
    for (m of text.matchAll(/ +([,.!?;:])/g)) add(m.index, m.index + m[0].length, "Vor einem Satzzeichen steht kein Leerzeichen.", [m[1]], "leervor");
    // fehlendes Leerzeichen nach Satzzeichen
    for (m of text.matchAll(/[,;!?](?=\p{L})/gu)) add(m.index, m.index + 1, "Nach einem Satzzeichen folgt ein Leerzeichen.", [m[0] + " "], "leernach");
    for (m of text.matchAll(/(?<=\p{L}{2})\.(?=\p{Lu}\p{Ll})/gu)) add(m.index, m.index + 1, "Nach dem Punkt folgt ein Leerzeichen.", [". "], "leernach");
    // doppelte Wörter
    for (m of text.matchAll(/(?<!\p{L})(\p{L}+)(\s+)(\1)(?!\p{L})/giu)) {
      if (/,\s*$/.test(text.slice(0, m.index)) && /^d(ie|er|as)$/i.test(m[1])) continue; // „…, die die …“
      add(m.index + m[1].length, m.index + m[0].length, `Das Wort „${m[1]}“ steht doppelt.`, [""], "doppelt");
    }
    // kleiner Satzanfang
    const anfaenge = [];
    const lead = /^[\s„"»(]*/.exec(text)[0].length;
    anfaenge.push(lead);
    for (m of text.matchAll(/[.!?]["“”»)]?\s+[„"»(]*/g)) {
      const vor = text.slice(0, m.index + 1);
      if (/\.$/.test(vor) && (ABK.test(vor + " ") || /(?:^|\s)\d+\.$/.test(vor))) continue;
      anfaenge.push(m.index + m[0].length);
    }
    anfaenge.forEach((i) => {
      const w = /^\p{Ll}[\p{L}]*/u.exec(text.slice(i));
      if (w) add(i, i + w[0].length, "Am Satzanfang wird großgeschrieben.", [w[0][0].toUpperCase() + w[0].slice(1)], "gross");
    });
    // Komma vor Konjunktion
    for (m of text.matchAll(new RegExp(`(?<=[\\p{L}\\d)"“”])(\\s+)(${KONJ})(?!\\p{L})`, "gu"))) {
      const vorher = /(\p{L}+)\s*$/u.exec(text.slice(0, m.index));
      if (vorher && KEIN_KOMMA_NACH.has(vorher[1].toLowerCase())) continue;
      const wort = m[2].split(" ")[0];
      add(m.index, m.index + m[1].length + wort.length, `Vor „${wort}“ steht meistens ein Komma.`, [`, ${wort}`], "komma");
    }
    // das → dass (nach Verben des Sagens/Denkens mit Komma)
    for (m of text.matchAll(/(?<!\p{L})(glaube|glaubt|glauben|denke|denkt|denken|hoffe|hofft|hoffen|weiß|weißt|wissen|finde|findet|finden|sagt|sagen|sagte|sagten|meine|meint|meinen|zeigt|zeigen|zeigte|erklärt|erklärte|berichtet|berichtete|freue mich|freut sich|freuen uns|wünsche mir|bin sicher|ist sicher|ist klar|ist wichtig|bedeutet|heißt),\s+(das)(?!\p{L})/gu)) {
      const i = m.index + m[0].length - 3;
      add(i, i + 3, "Hier ist vermutlich die Konjunktion „dass“ gemeint.", ["dass"], "dass");
    }
    // seit / seid
    for (m of text.matchAll(/(?<!\p{L})seid(?=\s+(\d|Jahren|Jahre|Monaten|Wochen|Tagen|Stunden|gestern|heute|kurzem|langem|damals|Beginn|Anfang|einem|einer|letzter|letztem|vielen|wann))/gu)) add(m.index, m.index + 4, "Bei einer Zeitangabe schreibt man „seit“.", ["seit"], "seit");
    for (m of text.matchAll(/(?<!\p{L})(ihr\s+)seit(?!\p{L})|(?<!\p{L})seit(?=\s+ihr(?!\p{L}))/gu)) {
      const i = m[1] ? m.index + m[1].length : m.index;
      add(i, i + 4, "Als Verb (ihr seid) schreibt man „seid“.", ["seid"], "seid");
    }
    // fehlendes Satzzeichen am Absatzende
    const t = text.replace(/\s+$/, "");
    const woerter = t.split(/\s+/).filter((x) => /\p{L}/u.test(x)).length;
    if (woerter >= 8 && !/[.!?:…"“”»)]$/.test(t)) {
      const w = /(\S+)$/.exec(t);
      if (w) add(w.index, t.length, "Am Satzende fehlt ein Satzzeichen.", [w[1] + "."], "ende");
    }
    return out.filter((b) => !grIgnoriert.has(b.regel + "|" + text.slice(b.start, b.end) + "|" + text.slice(Math.max(0, b.start - 12), b.start)));
  }

  // ---------- Text eines Absatzes mit Zuordnung zu Textknoten ----------
  function bloeckeVon(root) {
    const kinder = [...root.children].flatMap((el) => (/^(OL|UL)$/.test(el.tagName) ? [...el.children] : [el])).filter((el) => /^(P|DIV|H\d|LI)$/.test(el.tagName));
    return kinder.length ? kinder : [root];
  }
  function abbild(block) {
    const nodes = [];
    const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let n, pos = 0;
    while ((n = w.nextNode())) { nodes.push([n, pos]); pos += n.data.length; }
    return { text: nodes.map(([x]) => x.data).join(""), nodes };
  }
  function bereichAus(ab, s, e) {
    const finde = (off, ende) => {
      for (let i = 0; i < ab.nodes.length; i++) {
        const [n, p] = ab.nodes[i];
        if (off < p + n.data.length || (ende && off === p + n.data.length) || i === ab.nodes.length - 1) return [n, Math.max(0, Math.min(n.data.length, off - p))];
      }
      return null;
    };
    const a = finde(s, false), b = finde(e, true);
    if (!a || !b) return null;
    const r = document.createRange();
    try { r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); } catch (err) { return null; }
    return r;
  }

  // Alle Befunde in einem Element (Editor oder gespeichertes Dokument)
  function befunde(root, caret) {
    const out = [];
    bloeckeVon(root).forEach((block) => {
      const ab = abbild(block);
      if (!ab.text.trim()) return;
      let caretOff = -1;
      if (caret && caret.rangeCount && block.contains(caret.anchorNode) && caret.isCollapsed) {
        const r = document.createRange(); r.selectNodeContents(block);
        try { r.setEnd(caret.anchorNode, caret.anchorOffset); caretOff = r.toString().length; } catch (e) { caretOff = -1; }
      }
      for (const m of ab.text.matchAll(/\p{L}[\p{L}\p{M}'’-]*/gu)) {
        const wort = m[0].replace(/[-'’]+$/, "");
        const ende = m.index + wort.length;
        if (ende === caretOff) continue; // Wort wird gerade getippt
        if (!richtig(wort)) out.push({ typ: "rs", wort, start: m.index, ende, block, ab, meldung: "Rechtschreibung" });
      }
      grammatik(ab.text).forEach((g) => {
        if (g.end === caretOff && g.regel === "ende") return;
        out.push({ typ: "gr", wort: ab.text.slice(g.start, g.end), start: g.start, ende: g.end, block, ab, meldung: g.meldung, vorschlaege: g.vorschlaege, regel: g.regel, kontext: ab.text.slice(Math.max(0, g.start - 12), g.start) });
      });
    });
    out.forEach((b) => { b.range = bereichAus(b.ab, b.start, b.ende); });
    return out.filter((b) => b.range);
  }

  // ---------- Markierungen (CSS Highlight API) ----------
  const reg = new Map();
  const kannMarkieren = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
  function anwenden() {
    if (!kannMarkieren) return;
    const rs = [], gr = [];
    reg.forEach((liste) => liste.forEach((b) => (b.typ === "rs" ? rs : gr).push(b.range)));
    CSS.highlights.set("sz-rs", new Highlight(...rs));
    CSS.highlights.set("sz-gr", new Highlight(...gr));
  }
  function markiere(schluessel, root) {
    if (!hs) { reg.delete(schluessel); return []; }
    const liste = befunde(root, window.getSelection());
    reg.set(schluessel, liste);
    anwenden();
    return liste;
  }
  function entferne(schluessel) { reg.delete(schluessel); anwenden(); }

  // Zählung für ein gespeichertes Dokument (HTML)
  function fehler(html) {
    if (!hs) return null;
    const box = document.createElement("div");
    box.innerHTML = html || "";
    const l = befunde(box, null);
    return { rs: l.filter((b) => b.typ === "rs").map((b) => b.wort), gr: l.filter((b) => b.typ === "gr").map((b) => b.meldung) };
  }

  return {
    bereit, richtig, vorschlaege, grammatik, markiere, entferne, fehler, kannMarkieren,
    istBereit: () => !!hs,
    // Benutzerwörterbuch und Ignorieren (werden im Profil gespeichert)
    setze(daten) {
      daten.woerter = daten.woerter || []; daten.ignoriert = daten.ignoriert || []; daten.grIgnoriert = daten.grIgnoriert || [];
      benutzer = new Set(daten.woerter); ignoriert = new Set(daten.ignoriert); grIgnoriert = new Set(daten.grIgnoriert);
      cacheOk.clear();
      this.daten = daten;
    },
    hinzufuegen(w) { if (this.daten && !benutzer.has(w)) { benutzer.add(w); this.daten.woerter.push(w); cacheOk.delete(w); } },
    ignorieren(w) { if (this.daten && !ignoriert.has(w)) { ignoriert.add(w); this.daten.ignoriert.push(w); cacheOk.delete(w); } },
    grIgnorieren(b) { const k = b.regel + "|" + b.wort + "|" + b.kontext; if (this.daten && !grIgnoriert.has(k)) { grIgnoriert.add(k); this.daten.grIgnoriert.push(k); } },
  };
})();
