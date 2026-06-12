import { cookies, headers } from "next/headers";

export type Locale = "es" | "en" | "de";
export const LOCALES: Locale[] = ["es", "en", "de"];

// BCP 47 tags for Intl formatting
export const LOCALE_TAG: Record<Locale, string> = {
  es: "es-CO",
  en: "en-US",
  de: "de-DE",
};

export async function getLocale(): Promise<Locale> {
  const cookie = (await cookies()).get("lang")?.value;
  if (cookie === "es" || cookie === "en" || cookie === "de") return cookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (code === "es" || code === "en" || code === "de") return code as Locale;
  }
  return "es";
}

type Msg = { es: string; en: string; de: string };

// The Spanish voice is the brand (ustedeo colombiano). English and German are
// informal and keep the Colombian key terms — polla, parche, vaca, recocha —
// as proper nouns; the join-page explainer introduces them.
const M: Record<string, Msg> = {
  // ---- shared / shell ----
  "tab.table": { es: "Tabla", en: "Table", de: "Tabelle" },
  "tab.matches": { es: "Partidos", en: "Matches", de: "Spiele" },
  "tab.recocha": { es: "Recocha", en: "Recocha", de: "Recocha" },
  "tab.bonus": { es: "Bonus", en: "Bonus", de: "Bonus" },
  "a11y.logout": { es: "Salir", en: "Sign out", de: "Abmelden" },
  "a11y.settings": { es: "Configuración", en: "Settings", de: "Einstellungen" },
  "badge.open": { es: "abierto", en: "open", de: "offen" },
  "badge.locked": { es: "cerrado", en: "locked", de: "gesperrt" },
  "badge.live": { es: "en juego", en: "live", de: "läuft" },
  "badge.final": { es: "final", en: "final", de: "Endstand" },
  "badge.tbd": { es: "por definir", en: "TBD", de: "offen" },
  "badge.organiza": { es: "{name} organiza", en: "{name} organizes", de: "{name} organisiert" },
  "btn.save": { es: "Guardar", en: "Save", de: "Speichern" },
  "btn.update": { es: "Actualizar", en: "Update", de: "Ändern" },
  "comodin": { es: "Comodín ×2", en: "Wildcard ×2", de: "Joker ×2" },

  // ---- home / landing ----
  "hero.title1": { es: "¡Se armó", en: "Game on —", de: "Auf geht's —" },
  "hero.title2": { es: "la polla!", en: "the polla!", de: "die Polla!" },
  "landing.sub": {
    es: "La polla del Mundial 2026 para el parche. Pronósticos, preguntas del parche y la tabla para pelear.",
    en: "The Colombian-style World Cup 2026 prediction pool for your crew. Score predictions, crazy side questions, and a table worth fighting over.",
    de: "Das kolumbianische WM-2026-Tippspiel für deine Crew. Ergebnisse tippen, verrückte Zusatzfragen und eine Tabelle zum Streiten.",
  },
  "landing.cta": { es: "Entrar con su correo", en: "Sign in with email", de: "Mit E-Mail anmelden" },
  "landing.hint": {
    es: "Sin contraseñas. No se mueve plata por la app.",
    en: "No passwords. No money moves through the app.",
    de: "Keine Passwörter. Über die App fließt kein Geld.",
  },
  "name.title": { es: "¡Quiubo!", en: "You're in!", de: "Du bist drin!" },
  "name.q": { es: "¿Cómo le decimos en las pollas?", en: "What should we call you in the pollas?", de: "Wie sollen wir dich in den Pollas nennen?" },
  "name.label": { es: "Su nombre", en: "Your name", de: "Dein Name" },
  "name.placeholder": { es: "Como le dicen en el parche", en: "What your crew calls you", de: "Wie dich deine Crew nennt" },
  "name.done": { es: "Listo", en: "Done", de: "Fertig" },
  "home.greeting": { es: "Hola, {name}", en: "Hi, {name}", de: "Hallo, {name}" },
  "home.yourPollas": { es: "Sus pollas", en: "Your pollas", de: "Deine Pollas" },
  "home.emptyTitle": { es: "Todavía no está en ninguna", en: "You're not in one yet", de: "Du bist noch in keiner" },
  "home.emptyBody": {
    es: "Arme su propia polla o pídale el enlace a quien organiza la del parche.",
    en: "Start your own polla or ask your crew's organizer for the link.",
    de: "Starte deine eigene Polla oder hol dir den Link vom Organisator deiner Crew.",
  },
  "home.create": { es: "Crear una polla", en: "Create a polla", de: "Polla erstellen" },
  "home.youOrganize": { es: "Usted organiza esta polla", en: "You organize this polla", de: "Du organisierst diese Polla" },
  "home.member": { es: "Es del parche", en: "You're in the crew", de: "Du bist dabei" },

  // ---- login ----
  "login.sub": { es: "Entre al parche y meta sus pronósticos.", en: "Join your crew and get your predictions in.", de: "Komm zu deiner Crew und gib deine Tipps ab." },
  "login.email": { es: "Su correo", en: "Your email", de: "Deine E-Mail" },
  "login.emailPh": { es: "nombre@correo.com", en: "name@email.com", de: "name@mail.de" },
  "login.send": { es: "Mándeme el código", en: "Send me the code", de: "Code schicken" },
  "login.sending": { es: "Enviando…", en: "Sending…", de: "Wird gesendet…" },
  "login.codeInfo": { es: "Le llega un código de 6 dígitos. Sin contraseñas.", en: "A 6-digit code lands in your inbox. No passwords.", de: "Ein 6-stelliger Code kommt per Mail. Keine Passwörter." },
  "login.sentTo": { es: "Código enviado a", en: "Code sent to", de: "Code geschickt an" },
  "login.code": { es: "Código", en: "Code", de: "Code" },
  "login.codeMailed": { es: "Se lo mandamos al correo", en: "We mailed it to you", de: "Wir haben ihn dir gemailt" },
  "login.enter": { es: "Entrar", en: "Sign in", de: "Anmelden" },
  "login.verifying": { es: "Verificando…", en: "Checking…", de: "Wird geprüft…" },
  "err.email": { es: "Ingrese un correo válido.", en: "Enter a valid email.", de: "Gib eine gültige E-Mail ein." },
  "err.rate": { es: "Demasiados códigos pedidos. Espere unos minutos.", en: "Too many codes requested. Wait a few minutes.", de: "Zu viele Codes angefordert. Warte ein paar Minuten." },
  "err.send": { es: "No pudimos mandar el código. Intente de nuevo.", en: "We couldn't send the code. Try again.", de: "Code konnte nicht gesendet werden. Versuch's nochmal." },
  "err.expired": { es: "El código venció. Pida uno nuevo.", en: "That code expired. Request a new one.", de: "Der Code ist abgelaufen. Fordere einen neuen an." },
  "err.wrongCode": { es: "Código incorrecto.", en: "Wrong code.", de: "Falscher Code." },

  // ---- join ----
  "join.badLinkTitle": { es: "Enlace inválido", en: "Invalid link", de: "Ungültiger Link" },
  "join.badLinkBody": {
    es: "Este enlace no existe o fue regenerado. Pídale uno nuevo a quien organiza la polla.",
    en: "This link doesn't exist or was regenerated. Ask the polla's organizer for a fresh one.",
    de: "Diesen Link gibt es nicht oder er wurde erneuert. Frag den Organisator nach einem neuen.",
  },
  "join.eyebrow": { es: "Le guardaron puesto en la polla", en: "There's a spot saved for you", de: "Ein Platz ist für dich reserviert" },
  "join.organizes": { es: "Organiza", en: "Organized by", de: "Organisiert von" },
  "join.vaca": { es: "vaca", en: "pot", de: "Pott" },
  "join.more": { es: "+ {n} más", en: "+ {n} more", de: "+ {n} weitere" },
  "join.players": { es: "{n} jugador(es)", en: "{n} player(s)", de: "{n} Spieler" },
  "join.matches": { es: "104 partidos", en: "104 matches", de: "104 Spiele" },
  "join.cta": { es: "¡Hágale, me uno al parche!", en: "Count me in!", de: "Ich bin dabei!" },
  "join.as": { es: "Va como", en: "Joining as", de: "Du machst mit als" },
  "join.loginFirst": { es: "Primero entre con su correo.", en: "Sign in with your email first.", de: "Melde dich zuerst mit deiner E-Mail an." },
  "join.noMoney": { es: "No se mueve plata por la app.", en: "No money moves through the app.", de: "Über die App fließt kein Geld." },
  "explain.title": { es: "¿Qué es una polla?", en: "What's a “polla”? 🇨🇴", de: "Was ist eine „Polla“? 🇨🇴" },
  "explain.body": {
    es: "La polla es la tradición colombiana de cada Mundial: el parche (la familia, la oficina, los amigos) arma una vaca, cada quien pronostica los marcadores, y quien más puntos haga al final se lleva el premio. Acá además hay comodines, bonus de campeón y goleador, y La Recocha: preguntas locas que propone el mismo parche. La plata —si la hay— se arregla por fuera de la app.",
    en: "A polla is Colombia's beloved World Cup tradition: your crew (the “parche” — family, office, friends) chips into a shared pot (the “vaca”), everyone predicts match scores, and whoever has the most points at the end takes the prize. On top of that there are wildcards, champion & top-scorer bonus picks, and La Recocha — crazy side questions the crew itself invents. Money, if any, is handled offline among friends.",
    de: "Eine Polla ist Kolumbiens geliebte WM-Tradition: deine Crew (das „Parche“ — Familie, Büro, Freunde) zahlt in einen gemeinsamen Pott (die „Vaca“), alle tippen die Ergebnisse, und wer am Ende die meisten Punkte hat, gewinnt. Dazu kommen Joker, Bonus-Tipps für Weltmeister & Torschützenkönig und La Recocha — verrückte Zusatzfragen, die sich die Crew selbst ausdenkt. Geld — falls überhaupt — wird privat geregelt.",
  },

  // ---- group home ----
  "g.title": { es: "Tabla de posiciones", en: "Standings", de: "Tabelle" },
  "g.live": { es: "¡En juego!", en: "Live now!", de: "Läuft gerade!" },
  "g.next": { es: "Próximo partido", en: "Next match", de: "Nächstes Spiel" },
  "g.startsIn": { es: "arranca en {t}", en: "kicks off in {t}", de: "Anpfiff in {t}" },
  "g.yourPick": { es: "su pronóstico", en: "your pick", de: "dein Tipp" },
  "g.noPick": { es: "no marcó", en: "no pick yet", de: "kein Tipp" },
  "g.seeMatches": { es: "Ver partidos", en: "All matches", de: "Alle Spiele" },
  "g.emptyTitle": { es: "La tabla arranca en ceros", en: "The table starts at zero", de: "Die Tabelle startet bei null" },
  "g.emptyBody": {
    es: "Invite al parche y metan sus pronósticos antes del pitazo.",
    en: "Invite your crew and get predictions in before kickoff.",
    de: "Lad deine Crew ein — Tipps abgeben vor dem Anpfiff!",
  },
  "g.who": { es: "Quién", en: "Who", de: "Wer" },
  "g.pts": { es: "Pts", en: "Pts", de: "Pkt" },
  "g.exact": { es: "Exactos", en: "Exact", de: "Exakt" },
  "g.vaca": { es: "Vaca: {note}", en: "Pot: {note}", de: "Pott: {note}" },
  "g.predict": { es: "Pronosticar partidos", en: "Predict matches", de: "Spiele tippen" },
  "g.predictSub": { es: "Los 104 del Mundial, día a día", en: "All 104 World Cup matches, day by day", de: "Alle 104 WM-Spiele, Tag für Tag" },
  "g.unmarked": { es: "{n} sin marcar", en: "{n} open", de: "{n} offen" },
  "g.recochaSub": { es: "Las preguntas locas del parche", en: "Your crew's crazy side questions", de: "Die verrückten Zusatzfragen deiner Crew" },
  "g.bonusTitle": { es: "Bonus: campeón y goleador", en: "Bonus: champion & top scorer", de: "Bonus: Weltmeister & Torschützenkönig" },
  "g.bonusClosed": { es: "Cerrados — mire los del parche", en: "Locked — see everyone's picks", de: "Gesperrt — sieh dir alle Tipps an" },
  "g.bonusSoon": { es: "Cierran pronto, ¡pilas!", en: "Closing soon — don't sleep!", de: "Schließt bald — nicht verpennen!" },
  "g.bonusOpen": { es: "Abiertos", en: "Open", de: "Offen" },
  "g.invite": { es: "Invite con este enlace:", en: "Invite with this link:", de: "Lade mit diesem Link ein:" },

  // ---- scoring sheet ----
  "s.how": { es: "¿Cómo se puntúa? — {preset}", en: "How scoring works — {preset}", de: "So wird gezählt — {preset}" },
  "s.exact": { es: "Marcador exacto", en: "Exact score", de: "Exaktes Ergebnis" },
  "s.winnerDiff": { es: "Ganador y diferencia de gol (sin exacto)", en: "Winner + goal difference (not exact)", de: "Sieger + Tordifferenz (nicht exakt)" },
  "s.winner": { es: "Solo el ganador o empate", en: "Winner or draw only", de: "Nur Sieger oder Remis" },
  "s.teamGoals": { es: "Pegarle a los goles de un equipo (extra)", en: "One team's goals right (extra)", de: "Tore eines Teams richtig (extra)" },
  "s.result": { es: "Ganador o empate correcto", en: "Correct winner or draw", de: "Richtiger Sieger oder Remis" },
  "s.goalDiff": { es: "Diferencia de gol correcta (si no fue empate)", en: "Correct goal difference (non-draw)", de: "Richtige Tordifferenz (kein Remis)" },
  "s.joker": { es: "Comodín — uno por ronda, dobla ese partido", en: "Wildcard — one per round, doubles that match", de: "Joker — einer pro Runde, verdoppelt das Spiel" },
  "s.multipliers": { es: "Eliminatorias multiplican los puntos", en: "Knockout rounds multiply points", de: "K.-o.-Runden multiplizieren die Punkte" },
  "s.unico": { es: "Único acertado — solo usted pega el exacto", en: "Sole exact — only you nail the score", de: "Allein exakt — nur du triffst das Ergebnis" },
  "s.bonusRow": { es: "Bonus: {cat}", en: "Bonus: {cat}", de: "Bonus: {cat}" },
  "s.note": {
    es: "En eliminatorias cuentan solo los 90 minutos — ni alargue ni penales. Las preguntas de la recocha valen lo que diga quien organiza.",
    en: "Knockout matches count regulation time only — no extra time, no penalties. Recocha questions are worth whatever the organizer sets.",
    de: "Bei K.-o.-Spielen zählen nur die 90 Minuten — keine Verlängerung, kein Elfmeterschießen. Recocha-Fragen zählen, was der Organisator festlegt.",
  },
  "s.pts": { es: "{n} pts", en: "{n} pts", de: "{n} Pkt" },
  "s.pt1": { es: "{n} pt", en: "{n} pt", de: "{n} Pkt" },

  // ---- fixtures ----
  "f.title": { es: "Partidos", en: "Matches", de: "Spiele" },
  "f.hint": { es: "Horas en su zona. Puede cambiar su pronóstico hasta el pitazo.", en: "Times in your timezone. You can change picks until kickoff.", de: "Zeiten in deiner Zeitzone. Tipps bis zum Anpfiff änderbar." },
  "f.nOpen": { es: "{n} abiertos", en: "{n} open", de: "{n} offen" },
  "f.emptyTitle": { es: "Sin calendario todavía", en: "No schedule yet", de: "Noch kein Spielplan" },
  "f.emptyBody": { es: "Los partidos aparecen apenas se sincronicen.", en: "Matches show up as soon as they sync.", de: "Spiele erscheinen, sobald sie synchronisiert sind." },
  "f.matchday": { es: "Fecha {n}", en: "Matchday {n}", de: "Spieltag {n}" },
  "f.r32": { es: "Dieciseisavos", en: "Round of 32", de: "Sechzehntelfinale" },
  "f.r16": { es: "Octavos", en: "Round of 16", de: "Achtelfinale" },
  "f.qf": { es: "Cuartos", en: "Quarter-final", de: "Viertelfinale" },
  "f.sf": { es: "Semifinal", en: "Semi-final", de: "Halbfinale" },
  "f.third": { es: "Tercer puesto", en: "Third place", de: "Spiel um Platz 3" },
  "f.final": { es: "La final", en: "The final", de: "Das Finale" },
  "f.tbd": { es: "Por definir", en: "TBD", de: "Noch offen" },
  "f.reg90": { es: "en los 90 · terminó {h}–{a}", en: "after 90 · ended {h}–{a}", de: "nach 90 · Endstand {h}–{a}" },
  "f.yourPick": { es: "Su pronóstico:", en: "Your pick:", de: "Dein Tipp:" },
  "f.noPickPailas": { es: "no marcó — pailas", en: "no pick — tough luck", de: "kein Tipp — Pech gehabt" },
  "f.plusPts": { es: "+{n} pts", en: "+{n} pts", de: "+{n} Pkt" },
  "f.goalsOf": { es: "Goles {team}", en: "Goals {team}", de: "Tore {team}" },
  "f.minus": { es: "Menos goles {team}", en: "Fewer goals {team}", de: "Weniger Tore {team}" },
  "f.plus": { es: "Más goles {team}", en: "More goals {team}", de: "Mehr Tore {team}" },

  // ---- bonus ----
  "b.title": { es: "Bonus del torneo", en: "Tournament bonus picks", de: "Turnier-Bonustipps" },
  "b.closedLine": { es: "Ya cerraron — estos son los del parche.", en: "Locked — here's what everyone picked.", de: "Gesperrt — das hat die Crew getippt." },
  "b.closesAt": { es: "Cierran el {when} (su hora).", en: "Lock on {when} (your time).", de: "Schließen am {when} (deine Zeit)." },
  "b.noDeadline": { es: "Quien organiza todavía no ha fijado el cierre.", en: "The organizer hasn't set the deadline yet.", de: "Der Organisator hat noch keine Frist gesetzt." },
  "b.champion": { es: "Campeón", en: "Champion", de: "Weltmeister" },
  "b.runnerUp": { es: "Subcampeón", en: "Runner-up", de: "Vizeweltmeister" },
  "b.third": { es: "Tercer puesto", en: "Third place", de: "Dritter Platz" },
  "b.topScorer": { es: "Goleador", en: "Top scorer", de: "Torschützenkönig" },
  "b.bestGk": { es: "Mejor arquero", en: "Best goalkeeper", de: "Bester Torwart" },
  "b.none": { es: "— sin pronóstico —", en: "— no pick —", de: "— kein Tipp —" },
  "b.playerPh": { es: "Nombre del jugador", en: "Player's name", de: "Name des Spielers" },
  "b.save": { es: "Guardar pronósticos", en: "Save picks", de: "Tipps speichern" },
  "b.editable": { es: "Puede cambiarlos hasta el cierre.", en: "You can change them until the deadline.", de: "Bis zur Frist änderbar." },
  "b.nobody": { es: "Nadie se le midió.", en: "Nobody dared.", de: "Keiner hat sich getraut." },

  // ---- recocha ----
  "r.title": { es: "La Recocha", en: "La Recocha", de: "La Recocha" },
  "r.sub": { es: "Las preguntas las propone el parche y las resuelve quien organiza.", en: "The crew proposes the questions; the organizer settles them.", de: "Die Crew stellt die Fragen, der Organisator entscheidet." },
  "r.nOpen": { es: "{n} abiertas", en: "{n} open", de: "{n} offen" },
  "r.open": { es: "Abiertas", en: "Open", de: "Offen" },
  "r.emptyTitle": { es: "Nada abierto por ahora", en: "Nothing open right now", de: "Gerade nichts offen" },
  "r.emptyBody": { es: "Proponga una pregunta abajo — la que sea.", en: "Propose a question below — anything goes.", de: "Schlag unten eine Frage vor — alles erlaubt." },
  "r.proposedBy": { es: "propuso {name} · {n} pts", en: "by {name} · {n} pts", de: "von {name} · {n} Pkt" },
  "r.closes": { es: "cierra {when}", en: "closes {when}", de: "schließt {when}" },
  "r.answer": { es: "Responder", en: "Answer", de: "Antworten" },
  "r.change": { es: "Cambiar", en: "Change", de: "Ändern" },
  "r.yourAnswer": { es: "Su respuesta: {v} — puede cambiarla hasta el cierre.", en: "Your answer: {v} — changeable until it closes.", de: "Deine Antwort: {v} — bis zum Schluss änderbar." },
  "r.waiting": { es: "Cerradas, esperando resultado", en: "Closed, awaiting the verdict", de: "Geschlossen, Ergebnis steht aus" },
  "r.closed": { es: "cerrada", en: "closed", de: "geschlossen" },
  "r.resolvedH": { es: "Resueltas", en: "Settled", de: "Entschieden" },
  "r.resolved": { es: "resuelta", en: "settled", de: "entschieden" },
  "r.closest": { es: "al más cercano", en: "closest wins", de: "näheste gewinnt" },
  "r.answerIs": { es: "Respuesta:", en: "Answer:", de: "Antwort:" },
  "r.correct": { es: "Respuesta correcta", en: "Correct answer", de: "Richtige Antwort" },
  "r.closestOpt": { es: "Gana quien más se acerque (en vez de exacto)", en: "Closest answer wins (instead of exact)", de: "Näheste Antwort gewinnt (statt exakt)" },
  "r.resolve": { es: "Resolver", en: "Settle", de: "Entscheiden" },
  "r.toApprove": { es: "En votación del parche", en: "Up for a crew vote", de: "Crew-Abstimmung läuft" },
  "r.tally": { es: "{a} a favor · {r} en contra · pasa con {needed} de {eligible}", en: "{a} for · {r} against · passes at {needed} of {eligible}", de: "{a} dafür · {r} dagegen · braucht {needed} von {eligible}" },
  "r.voteApprove": { es: "¡Que entre!", en: "Approve", de: "Dafür" },
  "r.voteReject": { es: "Que no", en: "Reject", de: "Dagegen" },
  "r.yourVote": { es: "su voto", en: "your vote", de: "deine Stimme" },
  "r.quorumNote": { es: "Mayoría del parche al momento de proponerla ({n} entonces).", en: "Majority of the crew as of when it was proposed ({n} back then).", de: "Mehrheit der Crew zum Zeitpunkt des Vorschlags ({n} damals)." },
  "r.proposes": { es: "Propone {name} · tipo {type} · cierra {when}", en: "By {name} · type {type} · closes {when}", de: "Von {name} · Typ {type} · schließt {when}" },
  "r.approve": { es: "Aprobar", en: "Approve", de: "Freigeben" },
  "r.reject": { es: "Rechazar", en: "Reject", de: "Ablehnen" },

  "r.nobody": { es: "Nadie respondió.", en: "Nobody answered.", de: "Keiner hat geantwortet." },
  "r.proposeH": { es: "Proponga una pregunta", en: "Propose a question", de: "Frage vorschlagen" },
  "r.proposeSub": {
    es: "La que sea: “¿cuántos bailes de salsa choke?”, “¿llora el comentarista si gana Colombia?”",
    en: "Anything: “how many salsa choke dances?”, “does the commentator cry if Colombia wins?”",
    de: "Alles geht: „Wie viele Salsa-Choke-Tänze?“, „Weint der Kommentator, wenn Kolumbien gewinnt?“",
  },
  "r.q": { es: "Pregunta", en: "Question", de: "Frage" },
  "r.type": { es: "Tipo de respuesta", en: "Answer type", de: "Antworttyp" },
  "r.number": { es: "Número", en: "Number", de: "Zahl" },
  "r.yesno": { es: "Sí / No", en: "Yes / No", de: "Ja / Nein" },
  "r.choice": { es: "Opciones", en: "Multiple choice", de: "Auswahl" },
  "r.options": { es: "Opciones", en: "Options", de: "Optionen" },
  "r.optionsHint": { es: "(una por línea, solo para tipo “Opciones”)", en: "(one per line, only for multiple choice)", de: "(eine pro Zeile, nur bei Auswahl)" },
  "r.match": { es: "Partido (opcional — cierra con el pitazo)", en: "Match (optional — closes at kickoff)", de: "Spiel (optional — schließt beim Anpfiff)" },
  "r.noMatch": { es: "Sin partido — cierre manual", en: "No match — manual deadline", de: "Kein Spiel — manuelle Frist" },
  "r.manualClose": { es: "Cierre manual", en: "Manual deadline", de: "Manuelle Frist" },
  "r.points": { es: "Puntos", en: "Points", de: "Punkte" },
  "r.propose": { es: "Mandársela al parche", en: "Send it to the crew", de: "Ab an die Crew" },
  "r.choose": { es: "Elija…", en: "Pick…", de: "Wähle…" },
  "r.yes": { es: "Sí", en: "Yes", de: "Ja" },
  "r.no": { es: "No", en: "No", de: "Nein" },
  "r.yourAnswerLabel": { es: "Su respuesta", en: "Your answer", de: "Deine Antwort" },

  // ---- settings ----
  "set.title": { es: "Configuración", en: "Settings", de: "Einstellungen" },
  "set.invite": { es: "Enlace de invitación", en: "Invite link", de: "Einladungslink" },
  "set.regen": { es: "Regenerar enlace (invalida el anterior)", en: "Regenerate link (invalidates the old one)", de: "Link erneuern (alter wird ungültig)" },
  "set.vaca": { es: "La vaca", en: "The pot", de: "Der Pott" },
  "set.vacaPh": { es: "$50.000 por cabeza · 70/20/10", en: "$10 each · 70/20/10", de: "10 € pro Kopf · 70/20/10" },
  "set.bonusClose": { es: "Cierre de los bonus", en: "Bonus picks deadline", de: "Frist für Bonustipps" },
  "set.bonusCloseSub": { es: "Hasta cuándo se puede pronosticar campeón, goleador, etc.", en: "Until when champion, top scorer, etc. can be picked.", de: "Bis wann Weltmeister, Torschützenkönig usw. getippt werden können." },
  "set.save": { es: "Guardar", en: "Save", de: "Speichern" },
  "set.crew": { es: "El parche ({n})", en: "The crew ({n})", de: "Die Crew ({n})" },
  "set.organiza": { es: "organiza", en: "organizer", de: "Organisator" },

  // ---- create group ----
  "new.eyebrow": { es: "Nueva polla", en: "New polla", de: "Neue Polla" },
  "new.title": { es: "Arme su polla", en: "Set up your polla", de: "Stell deine Polla auf" },
  "new.name": { es: "Nombre de la polla", en: "Polla name", de: "Name der Polla" },
  "new.namePh": { es: "Polla de la oficina", en: "Office polla", de: "Büro-Polla" },
  "new.scoring": { es: "Sistema de puntos", en: "Scoring system", de: "Punktesystem" },
  "new.unico": { es: "Único acertado", en: "Sole exact bonus", de: "Allein-exakt-Bonus" },
  "new.unicoSub": { es: "+5 si solo usted pega el marcador exacto", en: "+5 if you're the only one with the exact score", de: "+5, wenn nur du das exakte Ergebnis triffst" },
  "new.vacaLabel": { es: "La vaca", en: "The pot", de: "Der Pott" },
  "new.vacaHint": { es: "(opcional — la plata va por fuera de la app)", en: "(optional — money is handled outside the app)", de: "(optional — Geld läuft außerhalb der App)" },
  "new.create": { es: "¡Armar la polla!", en: "Let's go!", de: "Los geht's!" },
  "preset.clasica": { es: "Clásica", en: "Classic", de: "Klassisch" },
  "preset.clasica.d": {
    es: "La planilla tradicional: 1 pt resultado, 3 pts marcador exacto, +1 por diferencia de gol.",
    en: "The traditional sheet: 1 pt result, 3 pts exact score, +1 goal-difference bonus.",
    de: "Der Klassiker: 1 Pkt Tendenz, 3 Pkt exaktes Ergebnis, +1 für die Tordifferenz.",
  },
  "preset.marcador_o_nada": { es: "Marcador o nada", en: "Exact or nothing", de: "Exakt oder nichts" },
  "preset.marcador_o_nada.d": {
    es: "Para valientes: 4 pts resultado, 10 pts marcador exacto, y las eliminatorias multiplican.",
    en: "For the bold: 4 pts result, 10 pts exact score, knockout rounds multiply.",
    de: "Für Mutige: 4 Pkt Tendenz, 10 Pkt exakt, K.-o.-Runden multiplizieren.",
  },
  "preset.escalonada": { es: "Escalonada con comodín", en: "Tiered with wildcard", de: "Gestaffelt mit Joker" },
  "preset.escalonada.d": {
    es: "Niveles excluyentes: exacto 10 / ganador y diferencia 5 / ganador 2 (+1 goles de un equipo). Un comodín por ronda dobla un partido.",
    en: "Exclusive tiers: exact 10 / winner + goal diff 5 / winner 2 (+1 for one team's goals). One wildcard per round doubles a match.",
    de: "Exklusive Stufen: exakt 10 / Sieger + Differenz 5 / Sieger 2 (+1 für Tore eines Teams). Ein Joker pro Runde verdoppelt ein Spiel.",
  },
  "preset.unicoTag": { es: "único acertado", en: "sole-exact bonus", de: "Allein-exakt-Bonus" },

  // ---- email (Tania from Bucaramanga handles the codes) ----
  "mail.subject": { es: "{code} — su código, se lo manda Tania", en: "{code} — your code, from Tania", de: "{code} — dein Code, von Tania" },
  "mail.body": {
    es: "¡Quiubo! Le habla Tania, desde Bucaramanga.\n\nSu código para entrar a la polla es: {code}\n\nMétale rápido que eso vence en 10 minutos. Y si usted no pidió ningún código, haga de cuenta que no le escribí — borre este correo y ya.\n\nUn abrazo,\nTania\nPollera Colorá",
    en: "Hi! Tania here, writing from Bucaramanga, Colombia — I handle the codes around here.\n\nYour code to get into the polla is: {code}\n\nDon't dawdle, it expires in 10 minutes. And if you never asked for a code, just pretend I never wrote — delete this and we're good.\n\nUn abrazo,\nTania\nPollera Colorá",
    de: "Hallo! Hier ist Tania aus Bucaramanga, Kolumbien — ich bin hier für die Codes zuständig.\n\nDein Code für die Polla: {code}\n\nMach flott, er gilt nur 10 Minuten. Und falls du gar keinen Code wolltest: Tu einfach so, als hätte ich nie geschrieben — Mail löschen, fertig.\n\nUn abrazo,\nTania\nPollera Colorá",
  },
};

export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const msg = M[key];
  let s = msg ? msg[locale] : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}
