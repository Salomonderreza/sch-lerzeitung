/* =====================================================================
   WORD IM REDAKTIONS-PC
   Echter Formatierungseditor (fett, kursiv, unterstrichen, Schriftgröße,
   Ausrichtung) mit Speichern/Speichern unter/Öffnen im virtuellen
   Dateisystem. Dazu:
   • Arbeitsweise: Wie wird markiert (Doppelklick, Dreifachklick,
     Tastatur, Ziehen)? Welche Tastenkombinationen, welche Menüband-Befehle?
   • „Nachmachen“: Bei eindeutig umständlicher Arbeitsweise wird die
     Aktion zurückgenommen und muss auf dem effektiven Weg wiederholt werden.
   • Einfügen nur, was vorher in der App kopiert wurde (Prüfung in app.js),
     große Texteingaben in einem Schritt (Erweiterungen, Diktat) gesperrt.
   ===================================================================== */
window.KL = window.KL || {};

KL.word = (() => {
  "use strict";
  const esc = (s) => KL.util.esc(s);
  const GR = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  const TYPEN = ["Word-Dokument (*.docx)", "Word 97-2003-Dokument (*.doc)", "PDF (*.pdf)", "Nur Text (*.txt)"];
  const ENDUNG = { "Word-Dokument (*.docx)": "docx", "Word 97-2003-Dokument (*.doc)": "doc", "PDF (*.pdf)": "pdf", "Nur Text (*.txt)": "txt" };
  let nummer = 1;

  // ---------- Text-Offsets (für Caret und Wortgrenzen) ----------
  function textKnoten(el) {
    const out = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) out.push(n);
    return out;
  }
  function offsetVon(el, node, off) {
    const r = document.createRange();
    r.selectNodeContents(el);
    try { r.setEnd(node, off); } catch (e) { return 0; }
    return r.toString().length;
  }
  function setzeCaret(el, off) {
    const sel = window.getSelection();
    const r = document.createRange();
    let rest = Math.max(0, off), ok = false;
    for (const n of textKnoten(el)) {
      if (rest <= n.length) { r.setStart(n, rest); ok = true; break; }
      rest -= n.length;
    }
    if (!ok) {
      // kein Text: in den ersten Absatz setzen, nicht dahinter (sonst legt
      // Firefox beim Tippen einen neuen Absatz an und der erste bleibt leer)
      const b = el.querySelector("p, div, h1, h2, h3, li");
      if (b) r.setStart(b, 0); else { r.selectNodeContents(el); r.collapse(false); }
      r.collapse(true);
    } else r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
  }

  /* o = { datei: node|null, fs, pc: { aktualisieren, titel(t), oeffneDatei(id), schliessen(), neuesFenster? }, T: tracker } */
  function mount(host, o) {
    const T = o.T;
    const doc = { id: o.datei ? o.datei.id : null, name: o.datei ? o.datei.name : `Dokument${nummer++}`, geaendert: false, ordnerId: o.datei ? o.datei.eltern : null };
    const btn = (cmd, inhalt, tip, kl) => `<button type="button" class="wd-tool${kl ? " " + kl : ""}" data-cmd="${cmd}" data-tip="${esc(tip)}" title="${esc(tip)}">${inhalt}</button>`;
    const gruppe = (titel, inhalt) => `<div class="wd-group"><div class="wd-gbody">${inhalt}</div><div class="wd-glabel">${titel}</div></div>`;
    const fake = (...n) => n.map((x) => `<span class="wd-tool off">${x}</span>`).join("");
    const listenIcon = (num) => `<svg viewBox="0 0 18 16" width="18" height="16"><g fill="#234">${[3, 8, 13].map((y, i) => (num ? `<text x="0.5" y="${y + 2.4}" font-size="5.2" font-family="Arial" font-weight="bold">${i + 1}</text>` : `<circle cx="2.2" cy="${y}" r="1.3"/>`) + `<rect x="6" y="${y - 0.7}" width="11" height="1.4"/>`).join("")}</g></svg>`;
    const absatzIcon = (ah) => `<svg viewBox="0 0 16 16" width="16" height="16"><g fill="#234">${[12, 8, 12, 6].map((w, i) => `<rect x="${ah === "l" ? 2 : ah === "m" ? 8 - w / 2 : 14 - w}" y="${3 + i * 3}" width="${w}" height="1.4"/>`).join("")}</g></svg>`;

    host.innerHTML = `
      <div class="wd wd-tab wr">
        <div class="wd-ribbon">
          <div class="wd-tabs">
            <button type="button" class="wd-tabbtn wr-datei" data-tab="datei">Datei</button>
            <button type="button" class="wd-tabbtn on" data-tab="start">Start</button>
            <button type="button" class="wd-tabbtn" data-tab="einfuegen">Einfügen</button>
            <button type="button" class="wd-tabbtn" data-tab="layout">Layout</button>
            <button type="button" class="wd-tabbtn" data-tab="pruefen">Überprüfen</button>
            <button type="button" class="wd-tabbtn" data-tab="ansicht">Ansicht</button>
            <span class="wr-qat">${btn("undo", "↶", "Rückgängig (Strg+Z)", "qat")}${btn("redo", "↷", "Wiederholen (Strg+Y)", "qat")}${btn("speichern", "💾", "Speichern (Strg+S)", "qat")}</span>
          </div>
          <div class="wd-panel" data-panel="start">
            ${gruppe("Zwischenablage", `${btn("einfuegen", "📋<span>Einfügen</span>", "Einfügen (Strg+V)", "big")}<div class="wd-col">${btn("ausschneiden", "✂️ Ausschneiden", "Ausschneiden (Strg+X)")}${btn("kopieren", "⧉ Kopieren", "Kopieren (Strg+C)")}</div>`)}
            ${gruppe("Schriftart", `<div class="wd-col"><div class="wd-row"><span class="wr-font">Calibri (Textkörper)</span><select class="wr-groesse" title="Schriftgrad">${GR.map((g) => `<option value="${g}"${g === 11 ? " selected" : ""}>${g}</option>`).join("")}</select>${btn("groesser", "A<sup>▲</sup>", "Schriftgrad vergrößern (Strg+Umschalt+>)")}${btn("kleiner", "A<sup>▼</sup>", "Schriftgrad verkleinern (Strg+<)")}</div>
              <div class="wd-row">${btn("fett", "<b>F</b>", "Fett (Strg+Umschalt+F)", "fmt")}${btn("kursiv", "<i>K</i>", "Kursiv (Strg+Umschalt+K)", "fmt")}${btn("unterstrichen", "<u>U</u>", "Unterstrichen (Strg+Umschalt+U)", "fmt")}</div></div>`)}
            ${gruppe("Absatz", `<div class="wd-col"><div class="wd-row">${btn("aufzaehlung", listenIcon(false), "Aufzählungszeichen (Strg+Umschalt+L)", "ico")}${btn("nummerierung", listenIcon(true), "Nummerierung", "ico")}</div><div class="wd-row">${btn("links", absatzIcon("l"), "Linksbündig (Strg+L)", "ico")}${btn("zentriert", absatzIcon("m"), "Zentriert (Strg+E)", "ico")}${btn("rechts", absatzIcon("r"), "Rechtsbündig (Strg+R)", "ico")}</div></div>`)}
            ${gruppe("Formatvorlagen", `<div class="wd-row">${fake("Standard", "Kein Leerraum", "Überschrift 1")}</div>`)}
          </div>
          <div class="wd-panel" data-panel="pruefen" hidden>${gruppe("Dokumentprüfung", btn("rsgr", "<span class=\"wr-abc\">abc✓</span><span>Rechtschreibung<br>und Grammatik</span>", "Rechtschreibung und Grammatik prüfen (F7)", "big"))}${gruppe("Kommentare", fake("Neuer Kommentar"))}</div>
          ${["einfuegen", "layout", "ansicht"].map((p) => `<div class="wd-panel" data-panel="${p}" hidden>${gruppe("In dieser Sitzung nicht benötigt", fake({ einfuegen: "Tabelle", layout: "Seitenränder", pruefen: "Rechtschreibung", ansicht: "Lesemodus" }[p], { einfuegen: "Bilder", layout: "Ausrichtung", pruefen: "Kommentar", ansicht: "Zoom" }[p]))}</div>`).join("")}
        </div>
        <div class="wd-pagewrap"><div class="wd-page"><div class="wr-editor" contenteditable="true" spellcheck="false"></div></div></div>
        <div class="wd-status"><span class="wr-status">Seite 1 von 1</span><span class="wr-pstatus" title="Rechtschreibung und Grammatik"></span><span>Deutsch (Deutschland)</span></div>
        <div class="wr-ctx" hidden></div>
        <div class="wr-backstage" hidden>
          <nav><button type="button" data-bs="zurueck">←</button><button type="button" data-bs="oeffnen">Öffnen</button><button type="button" data-bs="speichern">Speichern</button><button type="button" data-bs="speichernunter">Speichern unter</button><button type="button" data-bs="schliessen">Schließen</button></nav>
          <div class="wr-bs-main"><h2>Datei</h2><p class="wr-bs-info"></p></div>
        </div>
        <div class="wr-nm" hidden></div>
        <div class="wd-tip" hidden></div>
      </div>`;
    const wr = host.querySelector(".wr");
    const ed = wr.querySelector(".wr-editor");
    const nmBox = wr.querySelector(".wr-nm");
    const groesseSel = wr.querySelector(".wr-groesse");
    const statusEl = wr.querySelector(".wr-status");
    const backstage = wr.querySelector(".wr-backstage");

    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* egal */ }
    ed.innerHTML = o.datei && o.datei.inhalt ? o.datei.inhalt : "<p><br></p>";

    function titel() { o.pc.titel(`${doc.name} – Word`); }
    let zeilen = 0;
    function status() {
      const w = KL.util.norm(ed.textContent).split(/\s+/).filter((x) => /[\p{L}\d]/u.test(x)).length;
      statusEl.textContent = `Seite 1 von 1 · ${w} ${w === 1 ? "Wort" : "Wörter"} · ${zeilen} ${zeilen === 1 ? "Zeile" : "Zeilen"}${doc.geaendert ? "" : doc.id ? " · gespeichert" : ""}`;
    }
    function toast(text) {
      let t = wr.querySelector(".xp-toast");
      if (!t) { t = document.createElement("div"); t.className = "xp-toast"; wr.appendChild(t); }
      t.textContent = text; t.hidden = false;
      clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 3500);
    }

    // ---------- Formatierung ----------
    let wunschPt = null;
    // Dreifachklick markiert im Browser bis zum Anfang des nächsten Absatzes.
    // Wie in Word soll ein Befehl dann nur den markierten Absatz betreffen.
    function auswahlKuerzen() {
      const s = getSelection();
      if (!s.rangeCount || s.isCollapsed) return;
      const r = s.getRangeAt(0);
      const block = (n) => { let x = n && n.nodeType === 1 ? n : n && n.parentNode; while (x && x.parentNode !== ed) x = x.parentNode; return x; };
      const sb = r.startContainer === ed ? ed.childNodes[r.startOffset] : block(r.startContainer);
      const eb = r.endContainer === ed ? ed.childNodes[r.endOffset] : block(r.endContainer);
      if (!eb || !sb || eb === sb || eb.parentNode !== ed) return;
      const vor = document.createRange();
      vor.selectNodeContents(eb);
      if (r.endContainer !== ed) vor.setEnd(r.endContainer, r.endOffset); else vor.collapse(true);
      if (vor.toString() !== "") return;
      const prev = eb.previousSibling;
      if (!prev) return;
      r.setEnd(prev, prev.childNodes.length);
      s.removeAllRanges(); s.addRange(r);
    }
    function autoListe() {
      const s = window.getSelection();
      if (!s.rangeCount || !s.isCollapsed || !ed.contains(s.anchorNode)) return false;
      let blk = s.anchorNode;
      while (blk && blk.parentNode !== ed) blk = blk.parentNode;
      if (!blk || blk.nodeType !== 1 || blk.tagName !== "P") return false;
      const vor = document.createRange(); vor.selectNodeContents(blk); vor.setEnd(s.anchorNode, s.anchorOffset);
      const t = vor.toString();
      const cmd = /^1[.)]$/.test(t) ? "insertOrderedList" : /^[-*•]$/.test(t) ? "insertUnorderedList" : null;
      if (!cmd) return false;
      s.removeAllRanges(); s.addRange(vor);
      document.execCommand("delete");
      exec(cmd);
      T.zaehle("autoListe");
      return true;
    }
    function exec(cmd, wert) {
      ed.focus();
      auswahlKuerzen();
      try { document.execCommand("styleWithCSS", false, false); } catch (e) { /* egal */ }
      document.execCommand(cmd, false, wert);
      normalisieren();
      geaendert();
    }
    // Chrome und Firefox speichern Formatierungen unterschiedlich (Firefox:
    // <p align="center">, teils <div>-Hüllen). Hier wird alles auf eine Form
    // gebracht: Ausrichtung als CSS am Absatz, keine Hüllen um Absätze.
    function normalisieren() {
      ed.querySelectorAll("[align]").forEach((el) => {
        const a = el.getAttribute("align").toLowerCase();
        el.removeAttribute("align");
        if (/^(left|center|right|justify)$/.test(a)) el.style.textAlign = a;
      });
      // Hüllen auflösen: <div>/<p>, die selbst Absätze oder Listen enthalten
      // (Chrome legt z. B. beim Nummerieren <p><ol>…</ol></p> an)
      const BLOCK = /^(P|DIV|OL|UL|H1|H2|H3)$/;
      const huellen = [...ed.querySelectorAll("div, p")].filter((d) => [...d.children].some((k) => BLOCK.test(k.tagName)));
      if (huellen.length) {
        const s = window.getSelection();
        const merk = s.rangeCount && ed.contains(s.anchorNode) ? [s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset] : null;
        huellen.reverse().forEach((d) => {
          if (!d.parentNode) return;
          const ausr = d.style.textAlign;
          let lose = null;
          [...d.childNodes].forEach((k) => {
            if (k.nodeType === 1 && BLOCK.test(k.tagName)) {
              lose = null;
              if (ausr && !k.style.textAlign && /^(P|DIV|H\d)$/.test(k.tagName)) k.style.textAlign = ausr;
              d.parentNode.insertBefore(k, d);
            } else {
              if (k.nodeType === 3 && !k.data.trim() && !lose) { k.remove(); return; }
              if (!lose) { lose = document.createElement("p"); if (ausr) lose.style.textAlign = ausr; d.parentNode.insertBefore(lose, d); }
              lose.appendChild(k);
            }
          });
          d.remove();
        });
        if (merk && ed.contains(merk[0]) && ed.contains(merk[2])) { try { s.setBaseAndExtent(merk[0], merk[1], merk[2], merk[3]); } catch (e) { /* egal */ } }
      }
      ed.querySelectorAll("[style]").forEach((el) => { if (!el.getAttribute("style").trim()) el.removeAttribute("style"); });
    }
    function aktuelleGroesse() {
      const sel = window.getSelection();
      if (!sel.rangeCount || !ed.contains(sel.anchorNode)) return 11;
      let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
      const px = parseFloat(getComputedStyle(el).fontSize) || 14.67;
      return Math.round(px * 0.75);
    }
    function schriftKorrigieren() {
      const neu = [];
      ed.querySelectorAll("font[size]").forEach((f) => {
        const sp = document.createElement("span");
        sp.style.fontSize = (wunschPt || 11) + "pt";
        while (f.firstChild) sp.appendChild(f.firstChild);
        sp.querySelectorAll("span").forEach((s) => { s.style.fontSize = ""; if (!s.getAttribute("style")) s.replaceWith(...s.childNodes); });
        f.replaceWith(sp);
        neu.push(sp);
      });
      // Auswahl wiederherstellen: Sie lag in den ersetzten <font>-Elementen
      if (neu.length) {
        const r = document.createRange();
        r.setStart(neu[0], 0);
        r.setEnd(neu[neu.length - 1], neu[neu.length - 1].childNodes.length);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      }
      return neu;
    }
    function setzeGroesse(pt) {
      wunschPt = pt;
      exec("fontSize", "7");
      schriftKorrigieren();
      groesseSel.value = String(pt);
    }
    function stufe(richtung) {
      const g = aktuelleGroesse();
      const i = GR.findIndex((x) => x >= g);
      const neu = richtung > 0 ? GR[Math.min(GR.length - 1, (GR[i] === g ? i : i - 1) + 1)] : GR[Math.max(0, (i < 0 ? GR.length : i) - 1)];
      setzeGroesse(neu);
    }

    // ---------- Speichern / Öffnen ----------
    function knoten() { return doc.id ? o.fs.nodes[doc.id] : null; }
    function jetzt() {
      const d = new Date(), p = (x) => String(x).padStart(2, "0");
      return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    function schreibeInDatei(n) {
      n.inhalt = ed.innerHTML;
      n.datum = jetzt();
      n.groesse = Math.max(12, Math.round(12 + ed.innerHTML.length / 300));
      doc.geaendert = false;
      status();
      T.ereignis(`gespeichert:${KL.fs.pfadVon(o.fs, n.id)}`);
      o.pc.aktualisieren();
    }
    function speichern(weg) {
      const n = knoten();
      if (n && o.fs.nodes[n.id] && !KL.fs.pfadVon(o.fs, n.id).startsWith("Papierkorb")) {
        schreibeInDatei(n); toast("Gespeichert.");
        if (weg) { T.ereignis("speichern:" + weg); T.zaehle(weg === "taste" ? "strgS" : "speichernMaus"); }
        return;
      }
      speichernUnter();
    }
    function speichernUnter(danach) {
      const start = doc.ordnerId && o.fs.nodes[doc.ordnerId] ? doc.ordnerId : "dokumente";
      let vorschlag = doc.id ? doc.name.replace(/\.[^.]+$/, "") : (KL.util.norm(ed.textContent).split(/[.!?\n]/)[0] || doc.name).slice(0, 40).replace(/[\\/:*?"<>|]/g, "").trim() || doc.name;
      KL.dateiDialog.open(wr, {
        modus: "speichern", fsState: o.fs, start, name: vorschlag, typen: TYPEN, typ: TYPEN[0],
        onFertig: ({ name, ordner, typ }) => {
          const endung = ENDUNG[typ] || "docx";
          let datei = /\.[a-z0-9]{2,4}$/i.test(name) ? name : `${name}.${endung}`;
          const ziel = KL.fs.findPath(o.fs, ordner);
          if (!ziel || !ziel.kinder) return;
          const vorhanden = ziel.kinder.map((k) => o.fs.nodes[k]).find((k) => k && k.name.toLowerCase() === datei.toLowerCase());
          const fertig = (n) => {
            doc.id = n.id; doc.name = n.name; doc.ordnerId = ziel.id;
            schreibeInDatei(n);
            titel();
            T.ereignis("speichernunter");
            if (danach) danach(); else setTimeout(fokusZurueck, 0);
          };
          if (vorhanden) {
            if (vorhanden.kinder) { toast("Dort gibt es bereits einen Ordner mit diesem Namen."); return; }
            frage(`„${datei}“ ist bereits vorhanden. Möchten Sie die Datei ersetzen?`, [["Ja", () => fertig(vorhanden)], ["Nein", null]]);
            return;
          }
          const id = "n" + o.fs.seq++;
          o.fs.nodes[id] = { id, name: datei, typ: "datei", eltern: ziel.id, groesse: 12, datum: jetzt() };
          ziel.kinder.push(id);
          fertig(o.fs.nodes[id]);
        },
        onAbbruch: () => { T.ereignis("speichernunter-abbruch"); setTimeout(fokusZurueck, 0); },
      });
      T.ereignis("dialog:speichernunter");
    }
    function oeffnen() {
      KL.dateiDialog.open(wr, {
        modus: "oeffnen", fsState: o.fs, start: doc.ordnerId && o.fs.nodes[doc.ordnerId] ? doc.ordnerId : "dokumente",
        filter: (n) => /\.(docx?|txt)$/i.test(n.name),
        onFertig: ({ pfad }) => { const n = KL.fs.findPath(o.fs, pfad); if (n) o.pc.oeffneDatei(n.id, { ersetzen: istLeer() ? o.fensterId : null }); },
      });
    }
    function istLeer() { return !doc.id && !doc.geaendert && !KL.util.norm(ed.textContent); }

    function frage(text, knoepfe, alsHtml) {
      const ov = document.createElement("div");
      ov.className = "xp-overlay wd-dlg-ov";
      ov.innerHTML = `<div class="xp-dlg"><div class="xp-dlg-head">Microsoft Word</div><p>${alsHtml ? text : esc(text)}</p><div class="xp-dlg-btns">${knoepfe.map(([t], i) => `<button type="button" class="xp-btn${i === 0 ? " primary" : ""}" data-i="${i}">${esc(t)}</button>`).join("")}</div></div>`;
      wr.appendChild(ov);
      ov.addEventListener("click", (e) => {
        const b = e.target.closest("[data-i]");
        if (!b) return;
        ov.remove();
        const f = knoepfe[+b.dataset.i][1];
        if (f) f(); else fokusZurueck();
      });
      ov.querySelector("[data-i]").focus();
    }
    // vom Fenster aufgerufen, bevor es geschlossen wird
    function vorSchliessen(schliessen, laengeGeprueft) {
      const kurz = !laengeGeprueft && o.pc.zuKurz ? o.pc.zuKurz({ pfad: knoten() ? KL.fs.pfadVon(o.fs, doc.id) : null, html: ed.innerHTML }) : null;
      if (kurz) {
        T.ereignis("zu-kurz-gewarnt");
        frage(`<b>Dein Text ist noch nicht lang genug.</b><br>Er hat erst <b>${kurz.zeilen} von mindestens ${kurz.soll} Zeilen</b>. Schreib weiter: Ergänze Einzelheiten zu deinen Meldungen (Wer? Was? Wann? Wo? Warum? Wie?).`, [
          ["Weiterschreiben", null],
          ["Trotzdem schließen", () => vorSchliessen(schliessen, true)],
        ], true);
        return;
      }
      if (!doc.geaendert) { schliessen(); return; }
      frage(`Möchten Sie die Änderungen an „${doc.name}“ speichern?`, [
        ["Speichern", () => { if (knoten()) { speichern(); schliessen(); } else speichernUnter(schliessen); }],
        ["Nicht speichern", () => { T.ereignis("nicht-gespeichert-geschlossen"); schliessen(); }],
        ["Abbrechen", null],
      ]);
    }

    // ---------- Nachmachen ----------
    let nm = null;
    const NM = {
      rueck: { titel: "Das geht schneller!", text: "Du hast Buchstabe für Buchstabe gelöscht. Mach es noch einmal richtig: <b>Doppelklick auf das Wort</b> (oder <b>Strg+Umschalt+←</b>) und dann <b>einmal Rücktaste</b> – oder gleich das neue Wort tippen." },
      zieh: { titel: "Das geht schneller!", text: "Ein einzelnes Wort markierst du mit einem <b>Doppelklick</b> statt mit Ziehen. Mach es nach: <b>Doppelklick auf ein Wort</b>." },
      band: { titel: "Das geht schneller!", text: "Kopieren und Einfügen geht mit der Tastatur viel schneller. Mach es nach: Text markieren und <b>Strg+C</b>, dann <b>Strg+V</b> (bzw. <b>Strg+X</b> zum Ausschneiden)." },
    };
    function nachmachen(regel) {
      nm = { regel };
      T.nachmachen(regel);
      nmBox.hidden = false;
      nmBox.innerHTML = `<div class="wr-nm-box"><b>✋ ${NM[regel].titel}</b><p>${NM[regel].text}</p>
        <details><summary>Lehrkraft-Freigabe</summary><input type="password" class="wr-nm-code" placeholder="Code"><button type="button" class="xp-btn" data-frei>Freigeben</button></details></div>`;
      nmBox.querySelector("[data-frei]").onclick = () => {
        const v = nmBox.querySelector(".wr-nm-code").value;
        if (v === KL.CONFIG.LEHRER_CODE) { T.freigabe(regel); nmEnde(false); } else toast("Code falsch.");
      };
      nmBox.querySelector(".wr-nm-code").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") nmBox.querySelector("[data-frei]").click(); });
      bandSerie = 0;
    }
    function nmEnde(erfolg, imTastendruck) {
      if (!nm) return;
      if (erfolg) { T.ereignis("nachgemacht:" + nm.regel); toast("✔ Super – genau so!"); }
      nm = null;
      nmBox.hidden = true;
      nmBox.innerHTML = "";
      if (!imTastendruck) ed.focus();
    }

    // ---------- Arbeitsweise erfassen ----------
    let serie = 0, serieTaste = null, serieSnap = null;
    let bandSerie = 0;
    let maus = null;
    let shiftMarkiert = false;
    const NAV = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

    function serieReset() { serie = 0; serieTaste = null; serieSnap = null; }
    function markierung() {
      const s = window.getSelection();
      return s && s.rangeCount && ed.contains(s.anchorNode) && !s.isCollapsed ? s : null;
    }
    function einzelnesWort(s) {
      const t = s.toString();
      if (!t || /\s/.test(t.trim()) || t.trim().length < 2 || !/\p{L}/u.test(t)) return false;
      const r = s.getRangeAt(0);
      const a = offsetVon(ed, r.startContainer, r.startOffset), b = offsetVon(ed, r.endContainer, r.endOffset);
      const ganz = ed.textContent;
      const vor = ganz[a - 1], nach = ganz[b];
      return (!vor || !/[\p{L}\d]/u.test(vor)) && (!nach || !/[\p{L}\d]/u.test(nach));
    }
    function combo(e) {
      const teile = [];
      if (e.ctrlKey || e.metaKey) teile.push("Strg");
      if (e.altKey) teile.push("Alt");
      if (e.shiftKey && (e.ctrlKey || e.metaKey || e.key.length > 1)) teile.push("Umschalt");
      let k = e.key;
      if (k === " ") k = "Leertaste";
      else if (k.length === 1) k = k.toUpperCase();
      teile.push({ ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Home: "Pos1", End: "Ende" }[k] || k);
      return teile.join("+");
    }

    ed.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      const lk = k.length === 1 ? k.toLowerCase() : k;
      const sel = window.getSelection();
      const leer = !sel.rangeCount || sel.isCollapsed;

      // ----- während „Nachmachen“ nur passende Tasten erlauben -----
      if (nm) {
        const navOderMark = NAV.has(k) || ["Shift", "Control", "Alt", "Meta"].includes(k);
        let erlaubt = navOderMark;
        if (nm.regel === "rueck") {
          if ((k === "Backspace" || k === "Delete" || (k.length === 1 && !mod)) && !leer && sel.toString().trim().length >= 2) { erlaubt = true; nmEnde(true, true); }
        } else if (nm.regel === "band") {
          if (mod && ["c", "x", "v", "a", "z"].includes(lk)) erlaubt = true;
          if (mod && ["c", "x", "v"].includes(lk)) nmEnde(true, true);
        }
        if (!erlaubt) {
          e.preventDefault();
          nmBox.classList.remove("wackel"); void nmBox.offsetWidth; nmBox.classList.add("wackel");
          return;
        }
      }

      // ----- Tastenkombinationen -----
      if (mod || k === "F12") {
        const c = combo(e);
        if (!["Control", "Shift", "Alt", "Meta"].includes(k)) T.taste(c);
        if (lk === "s") { e.preventDefault(); speichern("taste"); return; }
        if (k === "F12") { e.preventDefault(); speichernUnter(); return; }
        if (lk === "y") { e.preventDefault(); document.execCommand("redo"); geaendert(); return; }
        if ((lk === "f" && e.shiftKey) || lk === "b") { e.preventDefault(); exec("bold"); return; }
        if ((lk === "k" && e.shiftKey) || lk === "i") { e.preventDefault(); exec("italic"); return; }
        if ((lk === "u" && e.shiftKey) || (lk === "u" && !e.shiftKey)) { e.preventDefault(); exec("underline"); return; }
        if (lk === "l" && e.shiftKey) { e.preventDefault(); exec("insertUnorderedList"); return; }
        if (k === ">" || k === "]" || (e.shiftKey && (k === "<" || e.code === "IntlBackslash"))) { e.preventDefault(); stufe(1); return; }
        if (k === "<" || k === "[") { e.preventDefault(); stufe(-1); return; }
        if (lk === "e") { e.preventDefault(); exec("justifyCenter"); return; }
        if (lk === "l") { e.preventDefault(); exec("justifyLeft"); return; }
        if (lk === "r") { e.preventDefault(); exec("justifyRight"); return; }
        if (["f", "h", "p", "o", "n", "d", "k", "g", "j", "w"].includes(lk) && !e.shiftKey) { e.preventDefault(); return; } // Browserfunktionen nicht auslösen
        if (["c", "x", "v"].includes(lk)) bandSerie = 0;
        if (NAV.has(k) && e.shiftKey) shiftMarkiert = true;
        if (k === "Backspace" || k === "Delete") serieReset();
        return;
      }

      // ----- Löschen: Serien erkennen -----
      if (k === "Backspace" || k === "Delete") {
        if (!leer) { T.zaehle("geloeschtMarkiert"); T.loeschen(sel.toString().length); serieReset(); return; }
        if (serieTaste !== k) { serieReset(); serieTaste = k; serieSnap = { html: ed.innerHTML, off: offsetVon(ed, sel.anchorNode, sel.anchorOffset) }; }
        serie++;
        T.loeschen(1);
        if (serie >= KL.CONFIG.RUECKTASTE_SERIE) {
          e.preventDefault();
          ed.innerHTML = serieSnap.html;
          setzeCaret(ed, serieSnap.off);
          T.zaehle("rueckSerien");
          serieReset();
          nachmachen("rueck");
        }
        return;
      }
      serieReset();

      if (NAV.has(k) && e.shiftKey) { shiftMarkiert = true; return; }
      if (k === "Tab") { e.preventDefault(); document.execCommand("insertText", false, "\t"); return; }
      // AutoFormat wie in Word: „1.“ bzw. „-“ am Absatzanfang + Leertaste → Liste
      if (k === " " && !mod && autoListe()) { e.preventDefault(); T.tippen(1); return; }
      if (k.length === 1) { T.tippen(1); if (!leer) T.zaehle("ueberschrieben"); }
      if (k === "Enter") T.tippen(0);
    });
    ed.addEventListener("keyup", (e) => {
      if (e.key === "Shift" || (!e.shiftKey && shiftMarkiert)) {
        if (shiftMarkiert && markierung()) T.markiert("tastatur");
        shiftMarkiert = false;
      }
      merkeSelektion();
    });

    ed.addEventListener("mousedown", (e) => {
      maus = { x: e.clientX, y: e.clientY, detail: e.detail };
      serieReset();
    });
    ed.addEventListener("mouseup", (e) => {
      const start = maus; maus = null;
      setTimeout(() => {
        merkeSelektion();
        const s = markierung();
        if (!s) return;
        if (e.detail === 2) {
          T.markiert("doppelklick");
          if (nm && nm.regel === "zieh") nmEnde(true);
          else if (nm && nm.regel === "rueck") { /* Wort ist markiert – jetzt löschen */ }
          return;
        }
        if (e.detail >= 3) { T.markiert("dreifach"); return; }
        const weit = start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4;
        if (weit) {
          T.markiert("ziehen");
          if (!nm && einzelnesWort(s)) {
            T.zaehle("ziehWort");
            s.collapseToEnd();
            nachmachen("zieh");
          }
        }
      }, 0);
    });

    // ----- Eingaben -----
    let erlaubtGross = false;
    ed.addEventListener("beforeinput", (e) => {
      if (/^insertFrom(Drop|Yank)$/.test(e.inputType) || e.inputType === "insertReplacementText" || e.inputType === "deleteByDrag") { e.preventDefault(); return; }
      if (e.inputType === "insertText" && e.data && e.data.length > 2 && !erlaubtGross) {
        e.preventDefault();
        T.blockiert(e.data.length, "eingabe");
        o.pc.meldung("Große Textblöcke auf einmal sind gesperrt. Bitte selbst tippen.");
      }
    });
    function geaendert() {
      doc.geaendert = true;
      status();
      o.pc.speichereZustand();
    }
    ed.addEventListener("input", () => { if (ed.querySelector("font[size]")) schriftKorrigieren(); if (ed.querySelector("[align], div > p, p > p, p > ol, p > ul, p > div")) normalisieren(); geaendert(); pruefenBald(); });
    ed.addEventListener("drop", (e) => e.preventDefault());
    ed.addEventListener("dragstart", (e) => e.preventDefault());
    // Einfügen: app.js hat externe Inhalte bereits blockiert; hier nur
    // interner Text, ohne fremde Formatierung
    // Internes Kopieren behält die Formatierung (fett, Größe, Ausrichtung) –
    // wie in Word. Gemerkt wird das HTML der Auswahl samt Formatierung.
    const nzText = (t) => KL.util.norm(String(t || "")).replace(/\s+/g, " ").trim();
    function auswahlHtml() {
      const s = window.getSelection();
      if (!s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode)) return null;
      const r = s.getRangeAt(0);
      let frag = r.cloneContents();
      let n = r.commonAncestorContainer;
      if (n.nodeType === 3) n = n.parentNode;
      while (n && n !== ed && /^(B|STRONG|I|EM|U|SPAN|FONT)$/.test(n.tagName)) {
        const h = n.cloneNode(false); h.appendChild(frag);
        frag = document.createDocumentFragment(); frag.appendChild(h);
        n = n.parentNode;
      }
      const box = document.createElement("div"); box.appendChild(frag);
      return { text: nzText(s.toString()), html: saeubern(box.innerHTML) };
    }
    function saeubern(html) {
      const box = document.createElement("div"); box.innerHTML = html;
      const ERLAUBT = /^(P|B|STRONG|I|EM|U|SPAN|BR)$/;
      [...box.querySelectorAll("*")].reverse().forEach((el) => {
        if (!ERLAUBT.test(el.tagName)) { if (/^(DIV|H\d|LI)$/.test(el.tagName)) { const p = document.createElement("p"); p.style.textAlign = el.style.textAlign || ""; while (el.firstChild) p.appendChild(el.firstChild); el.replaceWith(p); } else el.replaceWith(...el.childNodes); return; }
        const st = el.style, behalten = {};
        ["fontSize", "fontWeight", "fontStyle", "textDecoration", "textAlign"].forEach((k) => { if (st[k]) behalten[k] = st[k]; });
        [...el.attributes].forEach((a) => el.removeAttribute(a.name));
        Object.entries(behalten).forEach(([k, v]) => { el.style[k] = v; });
        if (el.tagName === "SPAN" && !el.getAttribute("style")) el.replaceWith(...el.childNodes);
      });
      return box.innerHTML;
    }
    const merkeKopie = () => { const h = auswahlHtml(); if (h && h.text) KL.zwischenablageHtml = h; };
    ed.addEventListener("copy", merkeKopie);
    ed.addEventListener("cut", merkeKopie);
    function einfuegen(t) {
      const h = KL.zwischenablageHtml;
      if (h && h.html && nzText(t) === h.text) {
        erlaubtGross = true;
        if (/<p[\s>]/i.test(h.html)) bloeckeEinfuegen(h.html);
        else document.execCommand("insertHTML", false, h.html);
        erlaubtGross = false;
        if (ed.querySelector("font[size]")) schriftKorrigieren();
        normalisieren();
        T.zaehle("eingefuegtIntern");
        geaendert();
      } else einfuegenText(t);
    }
    // Mehrere Absätze einfügen (insertHTML macht das in Chrome und Firefox
    // unterschiedlich und teils fehlerhaft): selbst in den DOM einsetzen.
    // Wie in Word: der erste Absatz geht im aktuellen Absatz weiter, der Rest
    // des aktuellen Absatzes hängt hinter dem letzten eingefügten Absatz.
    function bloeckeEinfuegen(html) {
      const sel = window.getSelection();
      if (!sel.isCollapsed) document.execCommand("delete");
      const r = sel.getRangeAt(0);
      let blk = r.startContainer;
      while (blk && blk.parentNode !== ed) blk = blk.parentNode;
      if (!blk || blk === ed) { blk = document.createElement("p"); ed.appendChild(blk); r.setStart(blk, 0); r.collapse(true); }
      const box = document.createElement("div"); box.innerHTML = html;
      // lose Inline-Knoten in Absätze packen
      const neue = [];
      let lose = null;
      [...box.childNodes].forEach((n) => {
        if (n.nodeType === 1 && n.tagName === "P") { lose = null; neue.push(n); }
        else { if (!lose) { lose = document.createElement("p"); neue.push(lose); } lose.appendChild(n); }
      });
      const rest = document.createRange(); rest.setStart(r.startContainer, r.startOffset); rest.setEnd(blk, blk.childNodes.length);
      const schwanz = rest.extractContents();
      const leer = !blk.textContent.trim();
      let letzter;
      if (leer) {
        neue.forEach((n) => ed.insertBefore(n, blk));
        blk.remove();
        letzter = neue[neue.length - 1];
      } else {
        const erster = neue.shift();
        while (erster.firstChild) blk.appendChild(erster.firstChild);
        let nach = blk;
        neue.forEach((n) => { nach.after(n); nach = n; });
        letzter = nach;
      }
      const caret = document.createRange();
      caret.selectNodeContents(letzter); caret.collapse(false);
      if (schwanz.textContent.trim()) letzter.appendChild(schwanz);
      letzter.querySelectorAll("br").forEach((b) => { if (letzter.textContent.trim()) b.remove(); });
      if (!letzter.firstChild) letzter.appendChild(document.createElement("br"));
      sel.removeAllRanges(); sel.addRange(caret);
    }
    ed.addEventListener("paste", (e) => {
      e.preventDefault();
      let t = "";
      try { t = e.clipboardData.getData("text/plain"); } catch (err) { t = ""; }
      if (!t && KL.zwischenablage) t = KL.zwischenablage;
      einfuegen(t);
    });
    function einfuegenText(t) {
      if (!t) return;
      erlaubtGross = true;
      const zeilen = t.replace(/\r/g, "").split("\n");
      zeilen.forEach((z, i) => {
        if (i) document.execCommand("insertParagraph");
        if (z) document.execCommand("insertText", false, z);
      });
      erlaubtGross = false;
      T.zaehle("eingefuegtIntern");
      geaendert();
    }

    // Auswahl merken (für Schriftgrad-Auswahl im Menüband)
    let gemerkt = null;
    function merkeSelektion() {
      const s = window.getSelection();
      if (s.rangeCount && ed.contains(s.anchorNode)) {
        gemerkt = s.getRangeAt(0).cloneRange();
        groesseSel.value = String(aktuelleGroesse());
        wr.querySelectorAll(".fmt").forEach((b) => {
          const st = { fett: "bold", kursiv: "italic", unterstrichen: "underline" }[b.dataset.cmd];
          let an = false; try { an = document.queryCommandState(st); } catch (err) { an = false; }
          b.classList.toggle("an", an);
        });
      }
    }
    const onSel = () => { if (document.activeElement === ed) { merkeSelektion(); pruefenBald(); } };
    document.addEventListener("selectionchange", onSel);
    function fokusZurueck() { if (gemerkt) auswahlZurueck(); else ed.focus(); }
    function auswahlZurueck() {
      if (!gemerkt) return;
      ed.focus();
      const s = window.getSelection();
      s.removeAllRanges(); s.addRange(gemerkt);
    }

    // ---------- Automatische Überprüfung (rot/blau) ----------
    const pKey = "ed" + (o.fensterId || Math.random().toString(36).slice(2));
    const pStatus = wr.querySelector(".wr-pstatus");
    const ctxBox = wr.querySelector(".wr-ctx");
    let befundListe = [], pTimer = null;
    function pruefen() {
      const z = KL.zeilenZaehlen ? KL.zeilenZaehlen(ed.innerHTML) : 0;
      if (z !== zeilen) { zeilen = z; status(); }
      befundListe = KL.pruefung.markiere(pKey, ed);
      const rs = befundListe.filter((b) => b.typ === "rs").length, gr = befundListe.length - rs;
      pStatus.textContent = !KL.pruefung.istBereit() ? "" : rs + gr ? `📖 ${rs ? `${rs} Rechtschreibung` : ""}${rs && gr ? " · " : ""}${gr ? `${gr} Grammatik` : ""}` : "📖 ✓";
      pStatus.classList.toggle("fehler", rs + gr > 0);
    }
    function pruefenBald() { clearTimeout(pTimer); pTimer = setTimeout(pruefen, 350); }
    KL.pruefung.bereit.then(pruefen);
    function punktUnterMaus(e) {
      if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(e.clientX, e.clientY); return r ? { node: r.startContainer, off: r.startOffset } : null; }
      if (document.caretPositionFromPoint) { const q = document.caretPositionFromPoint(e.clientX, e.clientY); return q ? { node: q.offsetNode, off: q.offset } : null; }
      return null;
    }
    function zeigeKorrektur(b, x, y) {
      const vs = b.typ === "rs" ? KL.pruefung.vorschlaege(b.wort) : b.vorschlaege;
      const label = (v) => (v === "" ? `„${b.wort.trim()}“ löschen` : v === " " ? "ein Leerzeichen" : v);
      ctxBox.innerHTML = `<div class="wr-ctx-kopf ${b.typ}">${b.typ === "rs" ? "Rechtschreibung" : "Grammatik"}${b.typ === "gr" ? `: ${esc(b.meldung)}` : ""}</div>`
        + (vs.length ? vs.map((v, i) => `<button type="button" data-v="${i}"><b>${esc(label(v))}</b></button>`).join("") : `<div class="wr-ctx-leer">(keine Vorschläge)</div>`)
        + `<div class="wr-ctx-sep"></div>`
        + (b.typ === "rs" ? `<button type="button" data-a="ignorieren">Alle ignorieren</button><button type="button" data-a="hinzu">Zum Wörterbuch hinzufügen</button>` : `<button type="button" data-a="grign">Einmal ignorieren</button>`);
      ctxBox.hidden = false;
      const w = wr.getBoundingClientRect();
      ctxBox.style.left = Math.max(4, Math.min(x - w.left, w.width - ctxBox.offsetWidth - 6)) + "px";
      ctxBox.style.top = Math.max(4, Math.min(y - w.top, w.height - ctxBox.offsetHeight - 6)) + "px";
      ctxBox.onclick = (ev) => {
        const k = ev.target.closest("button");
        if (!k) return;
        ctxBox.hidden = true;
        if (k.dataset.v != null) {
          ed.focus();
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(b.range);
          const v = vs[+k.dataset.v];
          erlaubtGross = true;
          if (v === "") document.execCommand("delete"); else document.execCommand("insertText", false, v);
          erlaubtGross = false;
          T.zaehle(b.typ === "rs" ? "korrigiertRS" : "korrigiertGR");
          geaendert();
        } else if (k.dataset.a === "ignorieren") { KL.pruefung.ignorieren(b.wort); T.zaehle("ignoriert"); }
        else if (k.dataset.a === "hinzu") { KL.pruefung.hinzufuegen(b.wort); T.zaehle("hinzugefuegt"); }
        else if (k.dataset.a === "grign") { KL.pruefung.grIgnorieren(b); T.zaehle("grIgnoriert"); }
        o.pc.speichereZustand();
        pruefen();
        ed.focus();
      };
    }
    ed.addEventListener("contextmenu", (e) => {
      pruefen();
      const pos = punktUnterMaus(e);
      if (!pos) return;
      const b = befundListe.find((x) => { try { return x.range.comparePoint(pos.node, pos.off) === 0; } catch (err) { return false; } });
      e.preventDefault();
      if (!b) { zeigeBearbeiten(e.clientX, e.clientY); return; }
      T.ereignis("korrekturmenue");
      zeigeKorrektur(b, e.clientX, e.clientY);
    });
    // Rechtsklick ohne Fehler: Ausschneiden / Kopieren / Einfügen wie in Word.
    // Zählt wie das Menüband (mit der Maus statt Tastenkombination).
    function zeigeBearbeiten(x, y) {
      const hatAuswahl = !!markierung();
      ctxBox.innerHTML = `<button type="button" data-k="ausschneiden" ${hatAuswahl ? "" : "disabled"}>✂️ Ausschneiden <span class="wr-ctx-kurz">Strg+X</span></button>`
        + `<button type="button" data-k="kopieren" ${hatAuswahl ? "" : "disabled"}>⧉ Kopieren <span class="wr-ctx-kurz">Strg+C</span></button>`
        + `<button type="button" data-k="einfuegen" ${KL.zwischenablage ? "" : "disabled"}>📋 Einfügen <span class="wr-ctx-kurz">Strg+V</span></button>`;
      ctxBox.hidden = false;
      const w = wr.getBoundingClientRect();
      ctxBox.style.left = Math.max(4, Math.min(x - w.left, w.width - ctxBox.offsetWidth - 6)) + "px";
      ctxBox.style.top = Math.max(4, Math.min(y - w.top, w.height - ctxBox.offsetHeight - 6)) + "px";
      ctxBox.onclick = (ev) => {
        const k = ev.target.closest("button");
        if (!k || k.disabled) return;
        ctxBox.hidden = true;
        const c = k.dataset.k;
        if (nm) { nmBox.classList.remove("wackel"); void nmBox.offsetWidth; nmBox.classList.add("wackel"); return; }
        T.band("ktx-" + c);
        if (c === "einfuegen") { ed.focus(); einfuegen(KL.zwischenablage || ""); }
        else {
          const sm = markierung();
          if (sm) {
            const t = sm.toString();
            KL.zwischenablage = t; KL.intern.merke(t);
            merkeKopie();
            if (c === "ausschneiden") { ed.focus(); document.execCommand("delete"); geaendert(); }
          }
        }
        bandSerie++;
        if (bandSerie >= KL.CONFIG.BAND_ZWISCHENABLAGE && !nm) nachmachen("band");
        merkeSelektion();
        ed.focus();
      };
    }
    function naechsterFehler() {
      pruefen();
      if (!befundListe.length) { toast("Die Rechtschreib- und Grammatikprüfung ist abgeschlossen. Keine Fehler gefunden."); return; }
      const b = befundListe[0];
      const r = b.range.getBoundingClientRect();
      b.range.startContainer.parentElement.scrollIntoView({ block: "nearest" });
      zeigeKorrektur(b, r.left, r.bottom + 4);
    }
    wr.addEventListener("mousedown", (e) => { if (!ctxBox.hidden && !ctxBox.contains(e.target)) ctxBox.hidden = true; });
    wr.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !ctxBox.hidden) { ctxBox.hidden = true; ed.focus(); }
      if (e.key === "F7") { e.preventDefault(); T.taste("F7"); naechsterFehler(); }
    });

    // ---------- Menüband ----------
    const ribbon = wr.querySelector(".wd-ribbon");
    ribbon.addEventListener("mousedown", (e) => { if (!e.target.closest("select")) e.preventDefault(); });
    ribbon.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-tab]");
      if (tab) {
        if (tab.dataset.tab === "datei") { zeigeBackstage(); return; }
        wr.querySelectorAll(".wd-tabbtn[data-tab]").forEach((b) => b.classList.toggle("on", b === tab));
        wr.querySelectorAll(".wd-panel").forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
        return;
      }
      const b = e.target.closest("[data-cmd]");
      if (!b) return;
      const c = b.dataset.cmd;
      if (nm && ["kopieren", "einfuegen", "ausschneiden"].includes(c)) { nmBox.classList.remove("wackel"); void nmBox.offsetWidth; nmBox.classList.add("wackel"); return; }
      T.band(c);
      switch (c) {
        case "fett": exec("bold"); break;
        case "kursiv": exec("italic"); break;
        case "unterstrichen": exec("underline"); break;
        case "groesser": stufe(1); break;
        case "kleiner": stufe(-1); break;
        case "links": exec("justifyLeft"); break;
        case "zentriert": exec("justifyCenter"); break;
        case "nummerierung": exec("insertOrderedList"); break;
        case "aufzaehlung": exec("insertUnorderedList"); break;
        case "rechts": exec("justifyRight"); break;
        case "undo": ed.focus(); document.execCommand("undo"); geaendert(); break;
        case "redo": ed.focus(); document.execCommand("redo"); geaendert(); break;
        case "speichern": speichern("band"); break;
        case "rsgr": naechsterFehler(); break;
        case "kopieren": case "ausschneiden": {
          const s = markierung();
          if (s) {
            const t = s.toString();
            KL.zwischenablage = t; KL.intern.merke(t);
            merkeKopie();
            if (c === "ausschneiden") { ed.focus(); document.execCommand("delete"); geaendert(); }
          }
          bandSerie++;
          break;
        }
        case "einfuegen":
          ed.focus();
          einfuegen(KL.zwischenablage || "");
          bandSerie++;
          break;
      }
      if (bandSerie >= KL.CONFIG.BAND_ZWISCHENABLAGE && !nm) nachmachen("band");
      merkeSelektion();
    });
    groesseSel.addEventListener("change", () => {
      auswahlZurueck();
      T.band("schriftgrad");
      setzeGroesse(+groesseSel.value);
    });
    // Tooltip
    const tip = wr.querySelector(".wd-tip");
    ribbon.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-tip]");
      if (!el) { tip.hidden = true; return; }
      const r = el.getBoundingClientRect(), w = wr.getBoundingClientRect();
      tip.textContent = el.dataset.tip; tip.hidden = false;
      tip.style.left = Math.max(4, Math.min(r.left - w.left, w.width - tip.offsetWidth - 4)) + "px";
      tip.style.top = (r.bottom - w.top + 4) + "px";
    });
    ribbon.addEventListener("mouseleave", () => { tip.hidden = true; });

    // ---------- Backstage (Datei) ----------
    function zeigeBackstage() {
      backstage.hidden = false;
      const n = knoten();
      backstage.querySelector(".wr-bs-info").textContent = n ? `Gespeichert unter: ${KL.fs.pfadVon(o.fs, n.id).replace(/\//g, " › ")}` : "Dieses Dokument wurde noch nicht gespeichert.";
    }
    backstage.addEventListener("click", (e) => {
      const b = e.target.closest("[data-bs]");
      if (!b) return;
      backstage.hidden = true;
      T.band("datei-" + b.dataset.bs);
      if (b.dataset.bs === "oeffnen") oeffnen();
      else if (b.dataset.bs === "speichern") speichern("band");
      else if (b.dataset.bs === "speichernunter") speichernUnter();
      else if (b.dataset.bs === "schliessen") o.pc.schliessen();
      else ed.focus();
    });

    titel();
    status();
    // sofort fokussieren (wer gleich lostippt, soll im Dokument landen)
    ed.focus(); setzeCaret(ed, 0);
    setTimeout(() => { if (!wr.querySelector(".fd-overlay, .xp-overlay")) { ed.focus(); } }, 0);

    return {
      vorSchliessen,
      dokument: () => ({ pfad: knoten() ? KL.fs.pfadVon(o.fs, doc.id) : null, html: ed.innerHTML, geaendert: doc.geaendert }),
      fokus: () => ed.focus(),
      destroy: () => { document.removeEventListener("selectionchange", onSel); clearTimeout(pTimer); KL.pruefung.entferne(pKey); },
    };
  }

  return { mount };
})();
