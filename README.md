# Schülerzeitung · Redaktions-PC (Beispiel: Sitzung 1)

Lernapp zum Projekt Schülerzeitung: Die SuS arbeiten an einem **virtuellen PC** (Desktop, Startmenü, Taskleiste, Fenster) mit **Datei-Explorer** und **Word**. Jede Sitzung hat ein Thema, einen Ordner und einen Artikel. Dazu kommen Windows-Aufgaben am eigenen, wachsenden Bestand.

Diese Version enthält **Sitzung 1 „Eine Meldung aus meiner Stadt“** und **Sitzung 2 „Top 5: Musik, die mich begleitet“**.

**Sitzung 2** (16 Aufgaben + Bonus): Im neuen Ordner *Redaktion › Posteingang* liegt ein Auftrag der Chefredaktion. Die SuS legen *Top 5 Musik* mit dem Unterordner *Recherche* an, verschieben, benennen um und löschen Dateien. Der Artikel enthält eine Einleitung, eine **nummerierte Liste** (Titel kursiv, Interpret fett), fünf Begründungsabsätze und mindestens 30 Zeilen. Neu in Word: Nummerierung und Aufzählungszeichen (Menüband, Strg+Umschalt+L, AutoFormat „1.“ + Leertaste). Die Hilfen sind knapper als in Sitzung 1 (z. B. „mit der Tastenkombination speichern“ ohne Strg+S zu nennen). Sie hat 16 Aufgaben in 3 Teilen und eine Bonusaufgabe und dauert ca. 80–90 Minuten. Der Artikel muss mindestens 30 Zeilen lang sein. Die Sitzungen 2–9 sind im Redaktionsplan sichtbar und werden nach demselben Muster ergänzt (Datei `sitzungen.js`).

## Für die SuS
1. Profil anlegen (Name, Klasse, **PIN**). Mehrere Personen können denselben Laptop nutzen.
2. Sitzung öffnen: Links stehen Redaktionsauftrag und Aufgaben. Erledigte Aufgaben werden automatisch abgehakt.
3. **Sitzung beenden** → Auswertung ansehen → Anleitung zur Abgabe befolgen:
   - am echten Computer den Ordner *Dokumente › Schülerzeitung_Berichte* anlegen,
   - den **Sitzungsbericht (PDF)** herunterladen und dorthin verschieben,
   - per **E-Mail** an den Dozenten schicken.
4. An einem anderen Laptop: Startseite → **Stand aus Bericht laden (PDF)** → PIN → weiterarbeiten. Im PDF steckt eine signierte Sicherung des ganzen Stands.

## Was die App kontrolliert
- **Länge des Artikels:** Word zeigt in der Statusleiste Wörter und Zeilen. Gezählt werden Zeilen mit Text, so wie sie auf der Word-Seite umbrechen; leere Zeilen zählen nicht. Wer Word vorher schließen oder die Sitzung beenden will, bekommt die Meldung „Dein Text ist noch nicht lang genug“ (mit „Weiterschreiben“ oder „Trotzdem schließen“).
- **Hinweise bei offenen Aufgaben:** Liegt ein Ordner oder eine Datei an der falschen Stelle oder ist sie anders geschrieben, steht unter der Aufgabe, wo sie gefunden wurde und was zu tun ist. Groß-/Kleinschreibung zählt wie bei Windows nicht.
- **Rechtschreibung und Grammatik wie in Word:**
  - Rot gewellt markiert sind Rechtschreibfehler.
  - Blau doppelt unterstrichen sind Grammatik und Zeichensetzung.
  - Ein Rechtsklick auf die Markierung zeigt Vorschläge, „Alle ignorieren“ und „Zum Wörterbuch hinzufügen“.
  - F7 bzw. *Überprüfen › Rechtschreibung und Grammatik* springt zum nächsten Fehler.
  - Die Prüfung läuft komplett offline: Hunspell mit deutschem Wörterbuch für die Rechtschreibung (zusammengesetzte Wörter wie „Hüpfburg“ und Zahlwörter werden erkannt), eigene Regeln für die Grammatik. Die Regeln decken typische Fehler ab: Leerzeichen, doppelte Wörter, kleiner Satzanfang, Komma vor *dass/weil/obwohl…*, *das/dass*, *seid/seit* und fehlender Satzpunkt.
- **Arbeitsweise in Word:** Markieren per Doppelklick, Dreifachklick, Tastatur oder Ziehen; benutzte Tastenkombinationen (auch Strg+S); Befehle über das Menüband.
- **Nachmachen:** Bei eindeutig umständlicher Arbeitsweise wird die Aktion zurückgenommen und muss effektiv wiederholt werden. Das gilt in diesen Fällen:
  - 7× Rücktaste/Entf am Stück → Wort per Doppelklick markieren und einmal löschen
  - ein einzelnes Wort mit der Maus gezogen → Doppelklick
  - 3× Kopieren/Einfügen über das Menüband → Strg+C / Strg+V
  - Mit dem **Lehrkraft-Code** (config.js) lässt sich ein Nachmachen freigeben.
- **Einfügen von außen ist gesperrt.** Das gilt für Strg+V, Rechtsklick, Ziehen und Windows+V, auch in Dateinamen-Feldern. Text, der in der App selbst kopiert wurde, darf eingefügt werden.
- **Schreibprotokoll:** Es erfasst getippte und gelöschte Zeichen, Zeichen im Artikel, blockierte Einfügeversuche, Wechsel aus der App, die Arbeitszeit und den Tippverlauf pro Minute.

## Note und Arbeitsweise
Die Note setzt sich zusammen aus **70 % Aufgaben** und **30 % Arbeitsweise**, die Bonusaufgabe gibt 5 Prozentpunkte dazu (`config.js`: `NOTEN`, `ARBEITSWEISE_ANTEIL`, `ARBEITSWEISE_AB`, `BONUS_PROZENT`). Notenschlüssel: ab 92 % → 1, ab 81 % → 2, ab 67 % → 3, ab 50 % → 4, ab 30 % → 5, darunter 6.

Die Arbeitsweise (0–100 Punkte) besteht aus vier Teilen, jeweils mit konkretem Feedback:
- Markieren (40 %): Doppelklick, Dreifachklick, Tastatur statt einzelne Wörter mit der Maus ziehen
- Tastenkombinationen (30 %): Befehle per Tastenkombination statt über das Menüband
- Speichern (15 %): Strg+S statt Menü
- Nachmachen (15 %): jedes Nachmachen kostet 25 Punkte

## KI-Fassung (Schritt 1 nach „Sitzung beenden“)
Die SuS kopieren ihren fertigen Text, lassen ihn von der freigegebenen KI verbessern und fügen die KI-Fassung in ein eigenes Feld ein – nur dort ist Einfügen erlaubt; der Text gelangt nicht in Word oder den Redaktions-PC. Die App vergleicht Wort für Wort, zeigt den Änderungsanteil (bis 15 % leicht, bis 40 % deutlich, darüber stark umgeschrieben) und markiert Entferntes und Neues. Dazu schreiben die SuS eine kurze Reflexion (Einfügen gesperrt). Die KI-Fassung wird als Word-Datei (`…_KI.docx`, mit den Überschriften-Formaten des Originals) heruntergeladen und kommt in den echten Ordner; sie wird veröffentlicht. Vergleich und Reflexion stehen im PDF-Bericht.

## Zwischenstand
In der Sitzung sichert der Knopf **💾 Zwischenstand** ein PDF mit dem bisherigen Ergebnis und einer vorläufigen Note, ohne die Sitzung zu beenden. Damit kann man an jedem Laptop weiterarbeiten (Stand aus Bericht laden). Jede*r arbeitet im eigenen Tempo; alle Sitzungen bleiben frei wählbar.

## Den Redaktions-PC auf den eigenen Computer übertragen
Vor dem Bericht kommt Schritt 1: Alles, was in der App ist, bauen die SuS auf ihrem eigenen Computer nach (unter *Dokumente*, einstellbar mit `EXPORT_ORT`). Sie erstellen alle Ordner selbst und laden jede Datei als echte Word-Datei (.docx) herunter, dann verschieben sie sie aus *Downloads* in den richtigen Ordner. Die App merkt sich über alle Sitzungen, welche Dateien schon übertragen sind; danach sind nur neue oder geänderte Dateien markiert. Vor dem Herunterladen des Berichts erscheint dieser Hinweis noch einmal, und der Bericht zeigt, wie viele Dateien übertragen wurden.

## Der Sitzungsbericht (PDF)
Der Bericht enthält:
- Name, Klasse, Datum und Arbeitszeit
- alle Aufgaben mit + / –
- den Artikel mit Formatierung (fett, Größe, zentriert) und den verbleibenden Fehlern
- die Arbeitsweise
- das Schreibprotokoll mit Diagramm
- die Ordnerstruktur

Ein Lehrkraft-Bereich ist nicht nötig. Die eingebettete Sicherung ist signiert: Wird sie verändert, lässt sich der Stand nicht mehr laden.

## Einstellungen (`config.js`)
- `LEHRER_CODE` und `GEHEIMNIS` bitte ändern und nicht weitergeben. `GEHEIMNIS` danach nicht mehr ändern.
- `DOZENT_MAIL`: Mit einer Adresse ist sie im Mail-Button schon eingetragen.
- Datenschutz: Die App nutzt keine externen Dienste und überträgt nichts. Profile liegen nur im Browser des Laptops.

## Grenzen der Browser-Simulation
- Getestet mit Chrome/Edge und Firefox. Beide Browser speichern Formatierungen unterschiedlich; die App gleicht das aus.
- Windows-Taste, Alt+Tab, Alt+F4 und Strg+W können nicht nachgebildet werden.
- Wer einen Text vom Bildschirm abtippt, kann nicht gehindert werden. Das Schreibprotokoll macht es aber sichtbar.
- Die Grammatikprüfung erkennt nur die oben genannten typischen Fehler, nicht alles, was Word findet.

## Dateien (alle flach im Repository)
`index.html`, `style.css`, `config.js`, `util.js`, `pdf.js`, `hunspell.js`, `woerterbuch-de.js`, `rechtschreibung.js`, `sim-explorer.js`, `sim-dialoge.js`, `sitzungen.js`, `word.js`, `desktop.js`, `auswertung.js`, `bericht.js`, `docx.js`, `app.js`, `LIZENZEN.md`
