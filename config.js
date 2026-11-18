/* =====================================================================
   EINSTELLUNGEN — hier kann die Lehrkraft anpassen
   ===================================================================== */
window.KL = window.KL || {};

KL.CONFIG = {
  TITEL: "Schülerzeitung",
  UNTERTITEL: "Redaktions-PC · Lernapp",

  // Mit diesem Code kann die Lehrkraft ein „Nachmachen“ freigeben, falls
  // jemand feststeckt. Bitte ändern und nicht an die SuS weitergeben.
  LEHRER_CODE: "Redaktion2026",

  // Geheimnis für die Signatur der Sicherungsdateien. Einmal ändern und
  // danach gleich lassen – sonst lassen sich alte Sicherungen nicht mehr
  // laden.
  GEHEIMNIS: "Schuelerzeitung-Monheim-bitte-aendern",

  // Unter diesem Namen speichert der Browser die Profile
  SPEICHER_SCHLUESSEL: "schuelerzeitung-app-v1",

  // Hinweis am Ende jeder Sitzung
  ABGABE_HINWEIS: "Lade den Sitzungsbericht (PDF) herunter und schicke ihn per Mail an deinen Dozenten bzw. deine Dozentin. Bewahre die Mail auf – mit dem Bericht kannst du deinen Stand an jedem Laptop wieder laden.",

  // E-Mail-Adresse für die Abgabe (erscheint in der Anleitung und im
  // Mail-Button). Leer lassen, wenn die SuS die Adresse selbst eintragen.
  DOZENT_MAIL: "",

  // Notenschlüssel für den Sitzungsbericht: Anteil der erledigten Aufgaben
  // in Prozent (ab … % → Note). Die Bonusaufgabe gibt BONUS_PROZENT dazu.
  NOTEN: [
    [92, "1", "sehr gut"],
    [81, "2", "gut"],
    [67, "3", "befriedigend"],
    [50, "4", "ausreichend"],
    [30, "5", "mangelhaft"],
    [0, "6", "ungenügend"],
  ],
  BONUS_PROZENT: 5,

  // Wo die SuS ihren Redaktions-PC auf dem echten Computer nachbauen
  EXPORT_ORT: "Dokumente",

  // Nachmachen: ab so vielen Rücktaste-/Entf-Anschlägen am Stück
  RUECKTASTE_SERIE: 7,
  // … und nach so vielen Kopier-/Einfügevorgängen über das Menüband in Folge
  BAND_ZWISCHENABLAGE: 3,
};
