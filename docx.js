/* =====================================================================
   DOCX-EXPORT — macht aus einem Dokument des Redaktions-PCs eine echte
   Word-Datei (.docx), damit die SuS ihre Dateien auf den eigenen Computer
   übertragen können. Übernommen werden Absätze, Ausrichtung, Fett,
   Kursiv, Unterstrichen und Schriftgröße. Ohne externe Bibliotheken:
   ZIP (ungepackt) + WordprocessingML.
   ===================================================================== */
window.KL = window.KL || {};
(() => {
  "use strict";

  // ---------- ZIP (Methode „stored“) ----------
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(dateien) {
    const enc = new TextEncoder();
    const teile = [], zentral = [];
    let pos = 0;
    const d = new Date();
    const zeit = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const datum = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    dateien.forEach(([name, text]) => {
      const n = enc.encode(name), daten = enc.encode(text), crc = crc32(daten);
      const kopf = new DataView(new ArrayBuffer(30));
      kopf.setUint32(0, 0x04034b50, true); kopf.setUint16(4, 20, true); kopf.setUint16(6, 0x0800, true); kopf.setUint16(8, 0, true);
      kopf.setUint16(10, zeit, true); kopf.setUint16(12, datum, true); kopf.setUint32(14, crc, true);
      kopf.setUint32(18, daten.length, true); kopf.setUint32(22, daten.length, true); kopf.setUint16(26, n.length, true); kopf.setUint16(28, 0, true);
      teile.push(new Uint8Array(kopf.buffer), n, daten);
      const z = new DataView(new ArrayBuffer(46));
      z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true); z.setUint16(10, 0, true);
      z.setUint16(12, zeit, true); z.setUint16(14, datum, true); z.setUint32(16, crc, true); z.setUint32(20, daten.length, true); z.setUint32(24, daten.length, true);
      z.setUint16(28, n.length, true); z.setUint32(42, pos, true);
      zentral.push(new Uint8Array(z.buffer), n);
      pos += 30 + n.length + daten.length;
    });
    const zLaenge = zentral.reduce((s, x) => s + x.length, 0);
    const ende = new DataView(new ArrayBuffer(22));
    ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true);
    ende.setUint32(12, zLaenge, true); ende.setUint32(16, pos, true);
    return new Blob([...teile, ...zentral, new Uint8Array(ende.buffer)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  // ---------- HTML → WordprocessingML ----------
  const x = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const FONT_SIZE = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 };
  function format(knoten, block) {
    const f = { b: false, i: false, u: false, pt: 11 };
    let fb = null, fi = null, fu = null, fpt = null;
    for (let el = knoten.parentElement; el && el !== block.parentElement; el = el.parentElement) {
      const st = el.style || {};
      if (fb === null) { if (st.fontWeight) fb = st.fontWeight === "bold" || +st.fontWeight >= 600; else if (/^(B|STRONG)$/.test(el.tagName)) fb = true; }
      if (fi === null) { if (st.fontStyle) fi = st.fontStyle === "italic"; else if (/^(I|EM)$/.test(el.tagName)) fi = true; }
      if (fu === null) { if (/underline/.test(st.textDecoration || st.textDecorationLine || "")) fu = true; else if (el.tagName === "U") fu = true; }
      if (fpt === null) {
        const m = /([\d.]+)(pt|px)/.exec(st.fontSize || "");
        if (m) fpt = m[2] === "pt" ? +m[1] : +m[1] * 0.75;
        else if (el.tagName === "FONT" && el.getAttribute("size")) fpt = FONT_SIZE[el.getAttribute("size")] || 11;
      }
      if (el === block) break;
    }
    f.b = !!fb; f.i = !!fi; f.u = !!fu; f.pt = fpt || 11;
    return f;
  }
  function ausrichtung(b) {
    for (let el = b; el && el.nodeType === 1; el = el.parentElement) {
      const a = (el.style && el.style.textAlign) || el.getAttribute("align");
      if (a) return a.toLowerCase();
    }
    return "left";
  }
  function absatzXml(b) {
    const runs = [];
    const lauf = (n) => {
      if (n.nodeType === 3) {
        if (!n.data) return;
        const f = format(n, b);
        const rpr = `${f.b ? "<w:b/>" : ""}${f.i ? "<w:i/>" : ""}${f.u ? '<w:u w:val="single"/>' : ""}${f.pt !== 11 ? `<w:sz w:val="${Math.round(f.pt * 2)}"/><w:szCs w:val="${Math.round(f.pt * 2)}"/>` : ""}`;
        runs.push(`<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${x(n.data)}</w:t></w:r>`);
      } else if (n.nodeType === 1) {
        if (n.tagName === "BR") { if (n.nextSibling || n.parentNode !== b) runs.push("<w:r><w:br/></w:r>"); return; }
        n.childNodes.forEach(lauf);
      }
    };
    b.childNodes.forEach(lauf);
    const a = { center: "center", right: "right", justify: "both" }[ausrichtung(b)];
    // Listenpunkt: Nummer bzw. Punkt voranstellen und einrücken
    let ind = "";
    if (b.tagName === "LI") {
      const ol = b.parentElement && b.parentElement.tagName === "OL";
      const nr = [...b.parentElement.children].filter((x) => x.tagName === "LI").indexOf(b) + 1;
      runs.unshift(`<w:r><w:t xml:space="preserve">${ol ? nr + "." : "•"}</w:t></w:r><w:r><w:tab/></w:r>`);
      ind = '<w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs><w:spacing w:after="60"/><w:ind w:left="720" w:hanging="360"/>';
    }
    const ppr = `${ind}${a ? `<w:jc w:val="${a}"/>` : ""}`;
    return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${runs.join("")}</w:p>`;
  }
  function bloecke(box) {
    const out = [];
    let lose = null;
    [...box.childNodes].forEach((n) => {
      if (n.nodeType === 1 && /^(P|DIV|H\d|LI|CENTER)$/.test(n.tagName)) {
        lose = null;
        if (n.querySelector(":scope > p, :scope > div, :scope > h1, :scope > h2, :scope > h3")) out.push(...bloecke(n));
        else out.push(n);
      } else if (n.nodeType === 1 && /^(UL|OL|TABLE|TBODY|TR|TD)$/.test(n.tagName)) {
        lose = null; out.push(...bloecke(n));
      } else {
        if (n.nodeType === 3 && !n.data.trim() && /^(UL|OL|TABLE|TBODY|TR)$/.test(box.tagName)) return;
        if (!lose) { lose = document.createElement("p"); box.insertBefore(lose, n); out.push(lose); }
        lose.appendChild(n);
      }
    });
    return out;
  }

  // Prüfsumme für „schon auf den eigenen Computer übertragen?“
  KL.exportSumme = (n) => KL.util.sha256(`${n.name}|${n.inhalt || ""}`).slice(0, 16);

  KL.docx = function (html, titel) {
    const box = document.createElement("div");
    box.innerHTML = html || "";
    const absaetze = bloecke(box).map(absatzXml).join("") || "<w:p/>";
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const jetzt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    return zip([
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
      ["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(titel || "")}</dc:title><dc:creator>Schülerzeitung Redaktions-PC</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${jetzt}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${jetzt}</dcterms:modified></cp:coreProperties>`],
      ["word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Standard"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`],
      ["word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W} ${R}><w:body>${absaetze}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`],
    ]);
  };
})();
