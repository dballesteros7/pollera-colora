import { cookies, headers } from "next/headers";

export type Locale = "es" | "en" | "de" | "it" | "fr" | "nl" | "pt" | "zh" | "zht";
export const LOCALES: Locale[] = ["es", "en", "de", "it", "fr", "nl", "pt", "zh", "zht"];

// BCP 47 tags for Intl formatting
export const LOCALE_TAG: Record<Locale, string> = {
  es: "es-CO",
  en: "en-US",
  de: "de-DE",
  it: "it-IT",
  fr: "fr-FR",
  nl: "nl-NL",
  pt: "pt-BR",
  zh: "zh-CN",
  zht: "zh-TW",
};

// dropdown labels — flags per Diego's spec: Colombia for Spanish, Germany for
// German, Brazil for (Brazilian) Portuguese, CN/TW for the two Chinese scripts
export const LOCALE_LABEL: Record<Locale, string> = {
  es: "🇨🇴 Español",
  en: "🇺🇸 English",
  de: "🇩🇪 Deutsch",
  it: "🇮🇹 Italiano",
  fr: "🇫🇷 Français",
  nl: "🇳🇱 Nederlands",
  pt: "🇧🇷 Português",
  zh: "🇨🇳 简体中文",
  zht: "🇹🇼 繁體中文",
};

function isLocale(v: string | undefined): v is Locale {
  return LOCALES.includes(v as Locale);
}

export async function getLocale(): Promise<Locale> {
  const cookie = (await cookies()).get("lang")?.value;
  if (isLocale(cookie)) return cookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.trim().toLowerCase();
    if (tag.startsWith("zh")) {
      // Traditional script: zh-TW, zh-HK, zh-MO, zh-Hant-*
      return /hant|tw|hk|mo/.test(tag) ? "zht" : "zh";
    }
    const code = tag.slice(0, 2);
    if (isLocale(code)) return code;
  }
  return "es";
}

type Msg = Record<Locale, string>;

// The Spanish voice is the brand (ustedeo colombiano). Other languages are
// informal and keep the Colombian key terms — polla, parche, vaca, recocha —
// as proper nouns; the join-page explainer introduces them.
const M: Record<string, Msg> = {
  // ---- shared / shell ----
  "tab.table": { es: "Tabla", en: "Standings", de: "Tabelle", it: "Classifica", pt: "Tabela", fr: "Classement", zh: "积分榜", zht: "積分榜", nl: "Stand" },
  "tab.matches": { es: "Partidos", en: "Matches", de: "Spiele", it: "Partite", pt: "Jogos", fr: "Matchs", zh: "比赛", zht: "比賽", nl: "Wedstrijden" },
  "tab.recocha": { es: "Recocha", en: "Recocha", de: "Recocha", it: "Recocha", pt: "Recocha", fr: "Recocha", zh: "Recocha", zht: "Recocha", nl: "Recocha" },
  "tab.bonus": { es: "Bonus", en: "Bonus", de: "Bonus", it: "Bonus", pt: "Bônus", fr: "Bonus", zh: "奖励", zht: "獎勵", nl: "Bonus" },
  "a11y.logout": { es: "Salir", en: "Sign out", de: "Abmelden", it: "Esci", pt: "Sair", fr: "Déconnexion", zh: "退出", zht: "登出", nl: "Uitloggen" },
  "a11y.settings": { es: "Configuración", en: "Settings", de: "Einstellungen", it: "Impostazioni", pt: "Configurações", fr: "Paramètres", zh: "设置", zht: "設定", nl: "Instellingen" },
  "a11y.language": { es: "Idioma", en: "Language", de: "Sprache", it: "Lingua", pt: "Idioma", fr: "Langue", zh: "语言", zht: "語言", nl: "Taal" },
  "a11y.bot": { es: "jugador IA", en: "AI player", de: "KI-Spieler", it: "giocatore IA", pt: "jogador IA", fr: "joueur IA", zh: "AI 玩家", zht: "AI 玩家", nl: "AI-speler" },
  "badge.open": { es: "abierto", en: "open", de: "offen", it: "aperto", pt: "aberto", fr: "ouvert", zh: "开放", zht: "開放", nl: "open" },
  "badge.locked": { es: "cerrado", en: "locked", de: "gesperrt", it: "chiuso", pt: "fechado", fr: "verrouillé", zh: "已锁定", zht: "已鎖定", nl: "gesloten" },
  "badge.live": { es: "en juego", en: "live", de: "läuft", it: "in corso", pt: "ao vivo", fr: "en direct", zh: "进行中", zht: "進行中", nl: "live" },
  "badge.final": { es: "finalizado", en: "final", de: "Beendet", it: "finita", pt: "final", fr: "terminé", zh: "已结束", zht: "已結束", nl: "afgelopen" },
  "badge.tbd": { es: "por definir", en: "TBD", de: "steht aus", it: "da definire", pt: "a definir", fr: "à définir", zh: "待定", zht: "待定", nl: "n.t.b." },
  "badge.organiza": { es: "{name} organiza", en: "Run by {name}", de: "{name} organisiert", it: "organizza {name}", pt: "{name} organiza", fr: "{name} organise", zh: "{name} 主持", zht: "{name} 主辦", nl: "{name} organiseert" },
  "btn.save": { es: "Guardar", en: "Save", de: "Speichern", it: "Salva", pt: "Salvar", fr: "Enregistrer", zh: "保存", zht: "儲存", nl: "Opslaan" },
  "btn.update": { es: "Actualizar", en: "Update", de: "Ändern", it: "Aggiorna", pt: "Atualizar", fr: "Modifier", zh: "更新", zht: "更新", nl: "Bijwerken" },
  "comodin": { es: "Comodín ×2", en: "Joker ×2", de: "Joker ×2", it: "Jolly ×2", pt: "Coringa ×2", fr: "Joker ×2", zh: "百搭 ×2", zht: "百搭 ×2", nl: "Joker ×2" },

  // ---- home / landing ----
  "hero.title1": { es: "¡Se armó", en: "Game on —", de: "Auf geht's —", it: "Parte —", pt: "Começou —", fr: "C'est parti —", zh: "开赛啦 —", zht: "開賽啦 —", nl: "Het is zover —" },
  "hero.title2": { es: "la polla!", en: "the polla!", de: "die Polla!", it: "la polla!", pt: "o bolão!", fr: "la polla !", zh: "Polla 来了！", zht: "Polla 來了！", nl: "de polla!" },
  "landing.sub": {
    es: "La polla del Mundial 2026 para el parche. Pronósticos, preguntas del parche y la tabla para pelear.",
    en: "The Colombian-style World Cup 2026 prediction pool for your crew. Score predictions, wild side questions, and a table worth fighting over.",
    de: "Das kolumbianische WM-2026-Tippspiel für deine Crew. Ergebnisse tippen, verrückte Zusatzfragen und eine Tabelle zum Streiten.",
    it: "Il pronostico colombiano dei Mondiali 2026 per la tua combriccola. Risultati, domande folli e una classifica per litigare.",
    pt: "O bolão colombiano da Copa 2026 para a sua galera. Palpites, perguntas malucas e uma tabela que vai dar briga.",
    fr: "La polla colombienne du Mondial 2026 pour ta bande. Pronostics, questions folles et un classement pour se chamailler.", zh: "哥伦比亚风格的 2026 世界杯竞猜，和朋友们一起玩。预测比分、回答搞怪问题、为排名争个不停。",
    zht: "哥倫比亞風格的 2026 世界盃競猜，和朋友們一起玩。預測比分、回答搞怪問題、為排名爭個不停。", nl: "De Colombiaanse WK-poule voor 2026, voor jou en je maten. Uitslagen voorspellen, gekke vragen en een stand om ruzie over te maken.",
  },
  "landing.cta": { es: "Entrar con su correo", en: "Sign in with email", de: "Mit E-Mail anmelden", it: "Entra con l'email", pt: "Entrar com e-mail", fr: "Se connecter par e-mail", zh: "用邮箱登录", zht: "用電子郵件登入", nl: "Inloggen met e-mail" },
  "landing.hint": {
    es: "Sin contraseñas. No se mueve plata por la app.",
    en: "No passwords. No money moves through the app.",
    de: "Keine Passwörter. Über die App fließt kein Geld.",
    it: "Niente password. Non passa un soldo dall'app.",
    pt: "Sem senhas. Nenhum dinheiro passa pelo app.",
    fr: "Pas de mot de passe. Aucun argent ne passe par l'appli.", zh: "无需密码。应用内不涉及任何金钱。",
    zht: "無需密碼。應用程式內不涉及任何金錢。", nl: "Geen wachtwoorden. Er gaat geen geld door de app.",
  },
  "name.title": { es: "¡Quiubo!", en: "You're in!", de: "Du bist drin!", it: "Sei dentro!", pt: "Tá dentro!", fr: "Te voilà !", zh: "欢迎！", zht: "歡迎！", nl: "Je bent erbij!" },
  "name.q": { es: "¿Cómo le decimos en las pollas?", en: "What should we call you in the pollas?", de: "Wie sollen wir dich in den Pollas nennen?", it: "Come ti chiamiamo nelle pollas?", pt: "Como te chamamos nos bolões?", fr: "Comment on t'appelle dans les pollas ?", zh: "在竞猜里怎么称呼你？", zht: "在競猜裡怎麼稱呼你？", nl: "Hoe noemen we je in de polla's?" },
  "name.label": { es: "Su nombre", en: "Your name", de: "Dein Name", it: "Il tuo nome", pt: "Seu nome", fr: "Ton nom", zh: "你的名字", zht: "你的名字", nl: "Je naam" },
  "name.placeholder": { es: "Como le dicen en el parche", en: "What your crew calls you", de: "Wie dich deine Crew nennt", it: "Come ti chiama la combriccola", pt: "Como a galera te chama", fr: "Comme t'appelle ta bande", zh: "朋友们对你的称呼", zht: "朋友們對你的稱呼", nl: "Zoals je maten je noemen" },
  "name.done": { es: "Listo", en: "Done", de: "Fertig", it: "Fatto", pt: "Pronto", fr: "C'est bon", zh: "好了", zht: "好了", nl: "Klaar" },
  "home.greeting": { es: "Hola, {name}", en: "Hi, {name}", de: "Hallo, {name}", it: "Ciao, {name}", pt: "Oi, {name}", fr: "Salut, {name}", zh: "你好，{name}", zht: "你好，{name}", nl: "Hoi, {name}" },
  "home.yourPollas": { es: "Sus pollas", en: "Your pollas", de: "Deine Pollas", it: "Le tue pollas", pt: "Seus bolões", fr: "Tes pollas", zh: "我的竞猜", zht: "我的競猜", nl: "Jouw polla's" },
  "home.emptyTitle": { es: "Todavía no está en ninguna", en: "You're not in one yet", de: "Du bist noch in keiner", it: "Non sei ancora in nessuna", pt: "Você ainda não está em nenhum", fr: "Tu n'en as pas encore", zh: "你还没加入任何竞猜", zht: "你還沒加入任何競猜", nl: "Je doet nog nergens mee" },
  "home.emptyBody": {
    es: "Arme su propia polla o pídale el enlace a quien organiza la del parche.",
    en: "Start your own polla or ask your crew's organizer for the link.",
    de: "Starte deine eigene Polla oder hol dir den Link von der Spielleitung deiner Crew.",
    it: "Crea la tua polla o chiedi il link a chi organizza quella della combriccola.",
    pt: "Crie seu próprio bolão ou peça o link pra quem organiza o da galera.",
    fr: "Crée ta propre polla ou demande le lien à la personne qui organise dans ta bande.", zh: "创建自己的竞猜，或向主持人要邀请链接。",
    zht: "建立自己的競猜，或向主辦人要邀請連結。", nl: "Start je eigen polla of vraag de organisator van je groep om de link.",
  },
  "home.create": { es: "Crear una polla", en: "Create a polla", de: "Polla erstellen", it: "Crea una polla", pt: "Criar um bolão", fr: "Créer une polla", zh: "创建竞猜", zht: "建立競猜", nl: "Een polla starten" },
  "home.youOrganize": { es: "Usted organiza esta polla", en: "You run this polla", de: "Du organisierst diese Polla", it: "Organizzi tu questa polla", pt: "Você organiza este bolão", fr: "Tu organises cette polla", zh: "你是这个竞猜的主持人", zht: "你是這個競猜的主辦人", nl: "Jij organiseert deze polla" },
  "home.member": { es: "Es del parche", en: "You're in the crew", de: "Du bist dabei", it: "Sei della combriccola", pt: "Você faz parte da galera", fr: "Tu fais partie de la bande", zh: "你已加入", zht: "你已加入", nl: "Je hoort erbij" },

  // ---- login ----
  "login.sub": { es: "Entre al parche y meta sus pronósticos.", en: "Join your crew and get your predictions in.", de: "Komm zu deiner Crew und gib deine Tipps ab.", it: "Entra nella combriccola e piazza i tuoi pronostici.", pt: "Entre na galera e mande seus palpites.", fr: "Rejoins ta bande et place tes pronostics.", zh: "加入朋友们，开始预测比分。", zht: "加入朋友們，開始預測比分。", nl: "Doe mee met je maten en geef je voorspellingen door." },
  "login.email": { es: "Su correo", en: "Your email", de: "Deine E-Mail", it: "La tua email", pt: "Seu e-mail", fr: "Ton e-mail", zh: "你的邮箱", zht: "你的電子信箱", nl: "Je e-mail" },
  "login.emailPh": { es: "nombre@correo.com", en: "name@email.com", de: "name@mail.de", it: "nome@email.it", pt: "nome@email.com", fr: "nom@email.fr", zh: "name@email.com", zht: "name@email.com", nl: "naam@email.nl" },
  "login.send": { es: "Mándeme el código", en: "Send me the code", de: "Code schicken", it: "Mandami il codice", pt: "Me manda o código", fr: "Envoie-moi le code", zh: "发送验证码", zht: "傳送驗證碼", nl: "Stuur me de code" },
  "login.sending": { es: "Enviando…", en: "Sending…", de: "Wird gesendet…", it: "Invio…", pt: "Enviando…", fr: "Envoi…", zh: "发送中…", zht: "傳送中…", nl: "Versturen…" },
  "login.codeInfo": { es: "Le llega un código de 6 dígitos. Sin contraseñas.", en: "A 6-digit code lands in your inbox. No passwords.", de: "Ein 6-stelliger Code kommt per Mail. Keine Passwörter.", it: "Ti arriva un codice di 6 cifre. Niente password.", pt: "Um código de 6 dígitos chega no seu e-mail. Sem senhas.", fr: "Un code à 6 chiffres arrive dans ta boîte. Pas de mot de passe.", zh: "6 位验证码将发送到你的邮箱。无需密码。", zht: "6 位驗證碼將傳送到你的信箱。無需密碼。", nl: "Je krijgt een 6-cijferige code in je inbox. Geen wachtwoorden." },
  "login.sentTo": { es: "Código enviado a", en: "Code sent to", de: "Code geschickt an", it: "Codice inviato a", pt: "Código enviado para", fr: "Code envoyé à", zh: "验证码已发送至", zht: "驗證碼已傳送至", nl: "Code gestuurd naar" },
  "login.code": { es: "Código", en: "Code", de: "Code", it: "Codice", pt: "Código", fr: "Code", zh: "验证码", zht: "驗證碼", nl: "Code" },
  "login.codeMailed": { es: "Se lo mandamos al correo", en: "We emailed it to you", de: "Wir haben ihn dir gemailt", it: "Te l'abbiamo mandato via email", pt: "Mandamos pro seu e-mail", fr: "On te l'a envoyé par e-mail", zh: "已发送到你的邮箱", zht: "已傳送到你的信箱", nl: "We hebben 'm naar je gemaild" },
  "login.enter": { es: "Entrar", en: "Sign in", de: "Anmelden", it: "Entra", pt: "Entrar", fr: "Se connecter", zh: "登录", zht: "登入", nl: "Inloggen" },
  "login.verifying": { es: "Verificando…", en: "Checking…", de: "Wird geprüft…", it: "Verifica…", pt: "Verificando…", fr: "Vérification…", zh: "验证中…", zht: "驗證中…", nl: "Controleren…" },
  "err.email": { es: "Ingrese un correo válido.", en: "Enter a valid email.", de: "Gib eine gültige E-Mail ein.", it: "Inserisci un'email valida.", pt: "Digite um e-mail válido.", fr: "Saisis un e-mail valide.", zh: "请输入有效的邮箱地址。", zht: "請輸入有效的電子信箱。", nl: "Voer een geldig e-mailadres in." },
  "err.rate": { es: "Demasiados códigos pedidos. Espere unos minutos.", en: "Too many codes requested. Wait a few minutes.", de: "Zu viele Codes angefordert. Warte ein paar Minuten.", it: "Troppi codici richiesti. Aspetta qualche minuto.", pt: "Calma — pediu código demais. Espera uns minutinhos.", fr: "Trop de codes demandés. Attends quelques minutes.", zh: "请求验证码次数过多，请稍等几分钟。", zht: "請求驗證碼次數過多，請稍等幾分鐘。", nl: "Te veel codes aangevraagd. Wacht een paar minuten." },
  "err.send": { es: "No pudimos mandar el código. Intente de nuevo.", en: "We couldn't send the code. Try again.", de: "Code konnte nicht gesendet werden. Versuch's nochmal.", it: "Non siamo riusciti a inviare il codice. Riprova.", pt: "Não conseguimos enviar o código. Tente de novo.", fr: "Impossible d'envoyer le code. Réessaie.", zh: "验证码发送失败，请重试。", zht: "驗證碼傳送失敗，請重試。", nl: "We konden de code niet versturen. Probeer het opnieuw." },
  "err.expired": { es: "El código venció. Pida uno nuevo.", en: "That code expired. Request a new one.", de: "Der Code ist abgelaufen. Fordere einen neuen an.", it: "Il codice è scaduto. Richiedine uno nuovo.", pt: "O código expirou. Peça outro.", fr: "Le code a expiré. Demandes-en un nouveau.", zh: "验证码已过期，请重新获取。", zht: "驗證碼已過期，請重新取得。", nl: "Die code is verlopen. Vraag een nieuwe aan." },
  "err.wrongCode": { es: "Código incorrecto.", en: "Wrong code.", de: "Falscher Code.", it: "Codice errato.", pt: "Código errado.", fr: "Code incorrect.", zh: "验证码错误。", zht: "驗證碼錯誤。", nl: "Verkeerde code." },

  // ---- join ----
  "join.badLinkTitle": { es: "Enlace inválido", en: "Invalid link", de: "Ungültiger Link", it: "Link non valido", pt: "Link inválido", fr: "Lien invalide", zh: "链接无效", zht: "連結無效", nl: "Ongeldige link" },
  "join.badLinkBody": {
    es: "Este enlace no existe o fue regenerado. Pídale uno nuevo a quien organiza la polla.",
    en: "This link doesn't exist or was regenerated. Ask the polla's organizer for a fresh one.",
    de: "Diesen Link gibt es nicht oder er wurde erneuert. Frag die Spielleitung nach einem neuen.",
    it: "Questo link non esiste o è stato rigenerato. Chiedine uno nuovo a chi organizza.",
    pt: "Esse link não existe ou foi renovado. Peça um novo pra quem organiza o bolão.",
    fr: "Ce lien n'existe pas ou a été renouvelé. Demande un nouveau lien à la personne qui organise la polla.", zh: "该链接不存在或已更新。请向主持人索取新链接。",
    zht: "該連結不存在或已更新。請向主辦人索取新連結。", nl: "Deze link bestaat niet of is vernieuwd. Vraag de organisator van de polla om een nieuwe.",
  },
  "join.eyebrow": { es: "Le guardaron puesto en la polla", en: "There's a spot saved for you", de: "Ein Platz ist für dich reserviert", it: "C'è un posto riservato per te", pt: "Guardaram uma vaga pra você", fr: "Une place t'attend dans la polla", zh: "有人给你留了位置", zht: "有人給你留了位置", nl: "Er is een plekje voor je vrijgehouden" },
  "join.organizes": { es: "Organiza", en: "Organized by", de: "Organisiert von", it: "Organizza", pt: "Organizado por", fr: "Organisé par", zh: "主持人", zht: "主辦人", nl: "Georganiseerd door" },
  "join.vaca": { es: "vaca", en: "pot", de: "Pott", it: "cassa", pt: "caixinha", fr: "cagnotte", zh: "奖池", zht: "獎池", nl: "pot" },
  "join.more": { es: "+ {n} más", en: "+ {n} more", de: "+ {n} weitere", it: "+ altri {n}", pt: "+ mais {n}", fr: "+ {n} autres", zh: "还有 {n} 人", zht: "還有 {n} 人", nl: "+ nog {n}" },
  "join.players": { es: "{n} en el parche", en: "{n} player(s)", de: "{n} Spieler", it: "{n} giocatore/i", pt: "{n} jogador(es)", fr: "{n} joueur(s)", zh: "{n} 名玩家", zht: "{n} 名玩家", nl: "{n} speler(s)" },
  "join.matches": { es: "104 partidos", en: "104 matches", de: "104 Spiele", it: "104 partite", pt: "104 jogos", fr: "104 matchs", zh: "104 场比赛", zht: "104 場比賽", nl: "104 wedstrijden" },
  "join.cta": { es: "¡Hágale, me uno al parche!", en: "Count me in!", de: "Ich bin dabei!", it: "Ci sto!", pt: "Tô dentro!", fr: "J'en suis !", zh: "算我一个！", zht: "算我一份！", nl: "Ik doe mee!" },
  "join.as": { es: "Va como", en: "Joining as", de: "Du machst mit als", it: "Entri come", pt: "Entrando como", fr: "Tu rejoins en tant que", zh: "你的身份：", zht: "你的身分：", nl: "Je doet mee als" },
  "join.loginFirst": { es: "Primero entre con su correo.", en: "Sign in with your email first.", de: "Melde dich zuerst mit deiner E-Mail an.", it: "Prima entra con la tua email.", pt: "Primeiro entre com seu e-mail.", fr: "Connecte-toi d'abord avec ton e-mail.", zh: "请先用邮箱登录。", zht: "請先用電子郵件登入。", nl: "Log eerst in met je e-mail." },
  "join.noMoney": { es: "No se mueve plata por la app.", en: "No money moves through the app.", de: "Über die App fließt kein Geld.", it: "Non passa un soldo dall'app.", pt: "Nenhum dinheiro passa pelo app.", fr: "Aucun argent ne passe par l'appli.", zh: "应用内不涉及任何金钱。", zht: "應用程式內不涉及任何金錢。", nl: "Er gaat geen geld door de app." },
  "explain.title": { es: "¿Qué es una polla?", en: "What's a “polla”? 🇨🇴", de: "Was ist eine „Polla“? 🇨🇴", it: "Cos'è una “polla”? 🇨🇴", pt: "O que é uma “polla”? 🇨🇴", fr: "C'est quoi, une « polla » ? 🇨🇴", zh: "什么是“polla”？🇨🇴", zht: "什麼是「polla」？🇨🇴", nl: "Wat is een “polla”? 🇨🇴" },
  "explain.body": {
    es: "La polla es la tradición colombiana de cada Mundial: el parche (la familia, la oficina, los amigos) arma una vaca, cada quien pronostica los marcadores, y quien más puntos haga al final se lleva el premio. Acá además hay comodines, bonus de campeón y goleador, y La Recocha: preguntas locas que propone el mismo parche. La plata —si la hay— se arregla por fuera de la app.",
    en: "A polla is Colombia's beloved World Cup tradition (and yes, the word means something cheekier in Spain — in Colombia it's just a betting pool, promise): your crew (the “parche” — family, office, friends) chips into a shared pot (the “vaca”), everyone predicts match scores, and whoever has the most points at the end takes the prize. On top of that there are jokers, champion & top-scorer bonus picks, and La Recocha — wild side questions the crew itself invents. Money, if any, is handled offline among friends.",
    de: "Eine Polla ist Kolumbiens geliebte WM-Tradition: deine Crew (das „Parche“ — Familie, Büro, Freunde) zahlt in einen gemeinsamen Pott (die „Vaca“), alle tippen die Ergebnisse, und wer am Ende die meisten Punkte hat, gewinnt. Dazu kommen Joker, Bonus-Tipps für Weltmeister & Torschützenkönig und La Recocha — verrückte Zusatzfragen, die sich die Crew selbst ausdenkt. Geld — falls überhaupt — wird privat geregelt.",
    it: "La polla è l'amata tradizione colombiana di ogni Mondiale: la combriccola (il “parche” — famiglia, ufficio, amici) mette i soldi in una cassa comune (la “vaca”), tutti pronosticano i risultati, e chi ha più punti alla fine vince il premio. In più ci sono i jolly, i bonus per campione e capocannoniere, e La Recocha — domande folli inventate dalla combriccola stessa. I soldi, se ci sono, si regolano fuori dall'app.",
    pt: "A polla é a amada tradição colombiana de cada Copa — igualzinho a um bolão: a galera (o “parche” — família, trabalho, amigos) faz uma vaquinha (a “vaca” — até o nome é igual), todo mundo dá palpite nos placares, e quem fizer mais pontos no final leva o prêmio. Além disso tem coringas, bônus de campeão e artilheiro, e La Recocha — perguntas malucas que a própria galera inventa. Dinheiro, se houver, se resolve fora do app.",
    fr: "La polla, c'est la tradition colombienne de chaque Mondial : la bande (le « parche » — famille, bureau, amis) met de l'argent dans une cagnotte commune (la « vaca »), tout le monde pronostique les scores, et la personne qui a le plus de points à la fin remporte le prix. En plus, il y a des jokers, des bonus champion et meilleur buteur, et La Recocha — des questions folles inventées par la bande elle-même. L'argent, s'il y en a, se règle entre amis, hors de l'appli.", zh: "Polla 是哥伦比亚每届世界杯的传统：朋友圈（“parche” — 家人、同事、朋友）凑一个奖池（“vaca”），大家预测比分，最后积分最高的人赢得奖品。此外还有百搭、冠军和最佳射手的奖励竞猜，以及 La Recocha — 朋友们自己发明的搞怪问题。钱（如果有的话）由朋友们线下解决。",
    zht: "Polla 是哥倫比亞每屆世界盃的傳統：你的圈子（「parche」— 家人、同事、朋友）湊一個獎池（「vaca」），大家預測比分，最後積分最高的人贏得獎品。此外還有百搭、冠軍和最佳射手的獎勵競猜，以及 La Recocha — 朋友們自己發明的搞怪問題。錢（如果有的話）由朋友們私下解決。", nl: "Een polla is Colombia's geliefde WK-traditie: je maten (het “parche” — familie, kantoor, vrienden) leggen geld in een gezamenlijke pot (de “vaca”), iedereen voorspelt de uitslagen, en wie aan het eind de meeste punten heeft wint de prijs. Daarbovenop zijn er jokers, bonusvoorspellingen voor kampioen en topscorer, en La Recocha — gekke vragen die de groep zelf verzint. Geld — als dat er al is — wordt buiten de app om onderling geregeld.",
  },

  // ---- group home ----
  "g.title": { es: "Tabla de posiciones", en: "Standings", de: "Tabelle", it: "Classifica", pt: "Classificação", fr: "Classement", zh: "积分榜", zht: "積分榜", nl: "Stand" },
  "g.live": { es: "¡En juego!", en: "Live now!", de: "Läuft gerade!", it: "In corso!", pt: "Ao vivo!", fr: "En direct !", zh: "正在进行！", zht: "正在進行！", nl: "Nu bezig!" },
  "g.next": { es: "Próximo partido", en: "Next match", de: "Nächstes Spiel", it: "Prossima partita", pt: "Próximo jogo", fr: "Prochain match", zh: "下一场比赛", zht: "下一場比賽", nl: "Volgende wedstrijd" },
  "g.startsIn": { es: "arranca en {t}", en: "kicks off in {t}", de: "Anpfiff in {t}", it: "inizia tra {t}", pt: "começa em {t}", fr: "coup d'envoi dans {t}", zh: "{t}后开赛", zht: "{t}後開賽", nl: "begint over {t}" },
  "g.yourPick": { es: "su pronóstico", en: "your pick", de: "dein Tipp", it: "il tuo pronostico", pt: "seu palpite", fr: "ton prono", zh: "你的预测", zht: "你的預測", nl: "jouw voorspelling" },
  "g.noPick": { es: "no marcó", en: "no pick yet", de: "kein Tipp", it: "nessun pronostico", pt: "sem palpite", fr: "pas de prono", zh: "尚未预测", zht: "尚未預測", nl: "nog geen voorspelling" },
  "g.seeMatches": { es: "Ver partidos", en: "All matches", de: "Alle Spiele", it: "Tutte le partite", pt: "Ver jogos", fr: "Tous les matchs", zh: "查看比赛", zht: "查看比賽", nl: "Alle wedstrijden" },
  "g.emptyTitle": { es: "La tabla arranca en ceros", en: "The table starts at zero", de: "Die Tabelle startet bei null", it: "La classifica parte da zero", pt: "A tabela começa zerada", fr: "Le classement démarre à zéro", zh: "积分榜从零开始", zht: "積分榜從零開始", nl: "De stand begint op nul" },
  "g.emptyBody": {
    es: "Invite al parche y metan sus pronósticos antes del pitazo.",
    en: "Invite your crew and get predictions in before kickoff.",
    de: "Lad deine Crew ein und gebt eure Tipps vor dem Anpfiff ab!",
    it: "Invita la combriccola e piazzate i pronostici prima del fischio.",
    pt: "Chame a galera e mandem os palpites antes do apito.",
    fr: "Invite ta bande et placez vos pronos avant le coup d'envoi.", zh: "邀请朋友们，在开赛前提交预测。",
    zht: "邀請朋友們，在開賽前提交預測。", nl: "Nodig je maten uit en geef jullie voorspellingen door vóór de aftrap.",
  },
  "g.who": { es: "Quién", en: "Who", de: "Wer", it: "Chi", pt: "Quem", fr: "Qui", zh: "玩家", zht: "玩家", nl: "Wie" },
  "g.pts": { es: "Pts", en: "Pts", de: "Pkt", it: "Pti", pt: "Pts", fr: "Pts", zh: "积分", zht: "積分", nl: "Ptn" },
  "g.exact": { es: "Exactos", en: "Exact", de: "Exakt", it: "Esatti", pt: "Exatos", fr: "Exacts", zh: "全中", zht: "全中", nl: "Exact" },
  "g.vaca": { es: "Vaca: {note}", en: "Pot: {note}", de: "Pott: {note}", it: "Cassa: {note}", pt: "Caixinha: {note}", fr: "Cagnotte : {note}", zh: "奖池：{note}", zht: "獎池：{note}", nl: "Pot: {note}" },
  "g.predict": { es: "Pronosticar partidos", en: "Predict matches", de: "Spiele tippen", it: "Pronostica le partite", pt: "Dar palpites", fr: "Pronostiquer les matchs", zh: "预测比赛", zht: "預測比賽", nl: "Wedstrijden voorspellen" },
  "g.predictSub": { es: "Los 104 del Mundial, día a día", en: "All 104 World Cup matches, day by day", de: "Alle 104 WM-Spiele, Tag für Tag", it: "Tutte le 104 partite, giorno per giorno", pt: "Os 104 jogos da Copa, dia a dia", fr: "Les 104 matchs du Mondial, jour par jour", zh: "全部 104 场世界杯比赛", zht: "全部 104 場世界盃比賽", nl: "Alle 104 WK-wedstrijden, dag voor dag" },
  "g.unmarked": { es: "{n} sin marcar", en: "{n} open", de: "{n} offen", it: "{n} da fare", pt: "{n} sem palpite", fr: "{n} sans prono", zh: "{n} 场未预测", zht: "{n} 場未預測", nl: "{n} open" },
  "g.recochaSub": { es: "Las preguntas locas del parche", en: "Your crew's wild side questions", de: "Die verrückten Zusatzfragen deiner Crew", it: "Le domande folli della combriccola", pt: "As perguntas malucas da galera", fr: "Les questions folles de la bande", zh: "朋友们的搞怪问题", zht: "朋友們的搞怪問題", nl: "De gekke vragen van je maten" },
  "g.bonusTitle": { es: "Bonus: campeón y goleador", en: "Bonus: champion & top scorer", de: "Bonus: Weltmeister & Torschützenkönig", it: "Bonus: campione e capocannoniere", pt: "Bônus: campeão e artilheiro", fr: "Bonus : champion et buteur", zh: "奖励：冠军与最佳射手", zht: "獎勵：冠軍與最佳射手", nl: "Bonus: kampioen & topscorer" },
  "g.bonusClosed": { es: "Cerrados — mire los del parche", en: "Locked — see everyone's picks", de: "Gesperrt — sieh dir alle Tipps an", it: "Chiusi — guarda quelli della combriccola", pt: "Fechados — veja os da galera", fr: "Verrouillés — regarde ceux de la bande", zh: "已锁定 — 看看大家的选择", zht: "已鎖定 — 看看大家的選擇", nl: "Gesloten — bekijk ieders keuzes" },
  "g.bonusSoon": { es: "Cierran pronto, ¡pilas!", en: "Closing soon — don't sleep on it!", de: "Schließt bald — nicht verpennen!", it: "Chiudono presto — sveglia!", pt: "Fecha logo — se liga!", fr: "Ça ferme bientôt — fonce !", zh: "即将截止，抓紧！", zht: "即將截止，手腳要快！", nl: "Sluit binnenkort — niet slapen!" },
  "g.bonusOpen": { es: "Abiertos", en: "Open", de: "Offen", it: "Aperti", pt: "Abertos", fr: "Ouverts", zh: "开放中", zht: "開放中", nl: "Open" },
  "g.invite": { es: "Invite con este enlace:", en: "Invite with this link:", de: "Lade mit diesem Link ein:", it: "Invita con questo link:", pt: "Convide com este link:", fr: "Invite avec ce lien :", zh: "用这个链接邀请：", zht: "用這個連結邀請：", nl: "Nodig je maten uit met deze link:" },

  // ---- scoring sheet ----
  "s.how": { es: "¿Cómo se puntúa? — {preset}", en: "How scoring works — {preset}", de: "So wird gezählt — {preset}", it: "Come si fanno i punti — {preset}", pt: "Como funciona a pontuação — {preset}", fr: "Comment on compte les points — {preset}", zh: "计分规则 — {preset}", zht: "計分規則 — {preset}", nl: "Zo werkt de puntentelling — {preset}" },
  "s.exact": { es: "Marcador exacto", en: "Exact score", de: "Exaktes Ergebnis", it: "Risultato esatto", pt: "Placar exato", fr: "Score exact", zh: "比分全中", zht: "比分全中", nl: "Exacte uitslag" },
  "s.winnerDiff": { es: "Ganador y diferencia de gol (sin exacto)", en: "Winner + goal difference (not exact)", de: "Sieger + Tordifferenz (nicht exakt)", it: "Vincente + differenza reti (non esatto)", pt: "Vencedor + saldo de gols (não exato)", fr: "Vainqueur + différence de buts (pas exact)", zh: "胜负与净胜球正确（非全中）", zht: "勝負與淨勝球正確（非全中）", nl: "Winnaar + doelsaldo (niet exact)" },
  "s.winner": { es: "Solo el ganador o empate", en: "Winner or draw only", de: "Nur Sieger oder Remis", it: "Solo vincente o pareggio", pt: "Só o vencedor ou empate", fr: "Vainqueur ou nul seulement", zh: "仅胜平负正确", zht: "僅勝負正確", nl: "Alleen winnaar of gelijkspel" },
  "s.teamGoals": { es: "Pegarle a los goles de un equipo (extra)", en: "One team's goals right (extra)", de: "Tore eines Teams richtig (extra)", it: "Gol di una squadra azzeccati (extra)", pt: "Acertar os gols de um time (extra)", fr: "Buts d'une équipe trouvés (extra)", zh: "猜中一队进球数（加分）", zht: "猜中一隊進球數（加分）", nl: "Doelpunten van één team goed (extra)" },
  "s.result": { es: "Ganador o empate correcto", en: "Correct winner or draw", de: "Richtiger Sieger oder Remis", it: "Vincente o pareggio corretto", pt: "Vencedor ou empate correto", fr: "Vainqueur ou nul correct", zh: "胜平负正确", zht: "勝負正確", nl: "Juiste winnaar of gelijkspel" },
  "s.goalDiff": { es: "Diferencia de gol correcta (si no fue empate)", en: "Correct goal difference (non-draw)", de: "Richtige Tordifferenz (kein Remis)", it: "Differenza reti corretta (no pareggio)", pt: "Saldo de gols correto (sem empate)", fr: "Différence de buts correcte (hors nul)", zh: "净胜球正确（非平局）", zht: "淨勝球正確（非平局）", nl: "Juist doelsaldo (geen gelijkspel)" },
  "s.joker": { es: "Comodín — uno por fecha del grupo y por ronda de eliminación (9 en todo el Mundial). Dobla ese partido.", en: "Joker — one per group matchday and per knockout round (9 across the World Cup). Doubles that match.", de: "Joker — einer pro Gruppen-Spieltag und pro K.-o.-Runde (9 im ganzen Turnier). Verdoppelt dieses Spiel.", it: "Jolly — uno per giornata dei gironi e per turno a eliminazione (9 in tutto il Mondiale). Raddoppia quella partita.", pt: "Coringa — um por rodada da fase de grupos e por fase do mata-mata (9 na Copa toda). Dobra aquele jogo.", fr: "Joker — un par journée de poules et par tour à élimination (9 sur tout le Mondial). Double ce match.", zh: "百搭 — 小组赛每轮和淘汰赛每个阶段各一个（全程共 9 个）。让该场比分翻倍。", zht: "百搭 — 小組賽每輪和淘汰賽每個階段各一個（全程共 9 個）。讓該場比分翻倍。", nl: "Joker — één per groepsspeeldag en per knock-outronde (9 in het hele toernooi). Verdubbelt die wedstrijd." },
  "s.multipliers": { es: "La eliminación directa multiplica los puntos", en: "Knockout rounds multiply points", de: "K.-o.-Runden multiplizieren die Punkte", it: "L'eliminazione diretta moltiplica i punti", pt: "Mata-mata multiplica os pontos", fr: "Les phases finales multiplient les points", zh: "淘汰赛积分按轮次翻倍", zht: "淘汰賽積分加倍", nl: "De knock-outfase vermenigvuldigt de punten" },
  "s.unico": { es: "Único acertado — solo usted le pega al exacto", en: "Sole exact — only you nail the score", de: "Allein exakt — nur du triffst das Ergebnis", it: "Unico esatto — solo tu azzecchi il risultato", pt: "Único exato — só você acerta o placar", fr: "Exact en solo — personne d'autre ne trouve le score", zh: "独中 — 只有你猜中比分", zht: "獨中 — 只有你猜中比分", nl: "Als enige exact — alleen jij hebt de juiste uitslag" },
  "s.bonusRow": { es: "Bonus: {cat}", en: "Bonus: {cat}", de: "Bonus: {cat}", it: "Bonus: {cat}", pt: "Bônus: {cat}", fr: "Bonus : {cat}", zh: "奖励：{cat}", zht: "獎勵：{cat}", nl: "Bonus: {cat}" },
  "s.note": {
    es: "En la eliminación directa cuentan solo los 90 minutos — ni tiempo extra ni penales. Las preguntas de la recocha valen lo que diga quien organiza.",
    en: "Knockout matches count regulation time only — no extra time, no penalties. Recocha questions are worth whatever the organizer sets.",
    de: "Bei K.-o.-Spielen zählen nur die 90 Minuten — keine Verlängerung, kein Elfmeterschießen. Recocha-Fragen sind so viel wert, wie die Spielleitung festlegt.",
    it: "Nell'eliminazione diretta contano solo i 90 minuti — niente supplementari né rigori. Le domande della recocha valgono quanto decide chi organizza.",
    pt: "No mata-mata contam só os 90 minutos — sem prorrogação nem pênaltis. As perguntas da recocha valem o que o organizador definir.",
    fr: "En phase finale, seules les 90 minutes comptent — ni prolongation ni tirs au but. Les questions de la recocha valent ce que décide la personne qui organise.", zh: "淘汰赛只计 90 分钟常规时间 — 不含加时和点球。Recocha 问题的分值由主持人设定。",
    zht: "淘汰賽只計 90 分鐘正規時間 — 不含加時和點球。Recocha 問題的分值由主辦人設定。", nl: "In de knock-outfase tellen alleen de 90 minuten — geen verlenging, geen penalty's. Recocha-vragen zijn zoveel waard als de organisator bepaalt.",
  },
  "s.pts": { es: "{n} pts", en: "{n} pts", de: "{n} Pkt", it: "{n} pt", pt: "{n} pts", fr: "{n} pts", zh: "{n} 分", zht: "{n} 分", nl: "{n} ptn" },
  "s.pt1": { es: "{n} pt", en: "{n} pt", de: "{n} Pkt", it: "{n} pt", pt: "{n} pt", fr: "{n} pt", zh: "{n} 分", zht: "{n} 分", nl: "{n} pt" },

  // ---- fixtures ----
  "f.title": { es: "Partidos", en: "Matches", de: "Spiele", it: "Partite", pt: "Jogos", fr: "Matchs", zh: "比赛", zht: "比賽", nl: "Wedstrijden" },
  "f.hint": { es: "Horas en su zona. Puede cambiar su pronóstico hasta el pitazo.", en: "Times in your timezone. You can change picks until kickoff.", de: "Zeiten in deiner Zeitzone. Tipps bis zum Anpfiff änderbar.", it: "Orari nel tuo fuso. Puoi cambiare i pronostici fino al fischio.", pt: "Horários no seu fuso. Pode mudar o palpite até o apito.", fr: "Heures dans ton fuseau. Tu peux changer ton prono jusqu'au coup d'envoi.", zh: "显示为你的时区。开赛前都可以修改预测。", zht: "顯示為你的時區。開賽前都可以修改預測。", nl: "Tijden in jouw tijdzone. Je kunt je voorspelling aanpassen tot de aftrap." },
  "f.nOpen": { es: "{n} abiertos", en: "{n} open", de: "{n} offen", it: "{n} aperte", pt: "{n} abertos", fr: "{n} ouverts", zh: "{n} 场开放", zht: "{n} 場開放", nl: "{n} open" },
  "f.emptyTitle": { es: "Sin calendario todavía", en: "No schedule yet", de: "Noch kein Spielplan", it: "Ancora nessun calendario", pt: "Ainda sem tabela", fr: "Pas encore de calendrier", zh: "暂无赛程", zht: "暫無賽程", nl: "Nog geen speelschema" },
  "f.emptyBody": { es: "Los partidos aparecen apenas se sincronicen.", en: "Matches show up as soon as they sync.", de: "Spiele erscheinen, sobald sie synchronisiert sind.", it: "Le partite appaiono appena sincronizzate.", pt: "Os jogos aparecem assim que sincronizarem.", fr: "Les matchs apparaissent dès la synchro.", zh: "比赛同步后即会显示。", zht: "比賽同步後即會顯示。", nl: "Wedstrijden verschijnen zodra ze gesynchroniseerd zijn." },
  "f.matchday": { es: "Fecha {n}", en: "Matchday {n}", de: "Spieltag {n}", it: "Giornata {n}", pt: "Rodada {n}", fr: "Journée {n}", zh: "第 {n} 轮", zht: "第 {n} 輪", nl: "Speelronde {n}" },
  "f.r32": { es: "Dieciseisavos", en: "Round of 32", de: "Sechzehntelfinale", it: "Sedicesimi", pt: "16 avos de final", fr: "16es de finale", zh: "32 强赛", zht: "32 強", nl: "Zestiende finales" },
  "f.r16": { es: "Octavos", en: "Round of 16", de: "Achtelfinale", it: "Ottavi", pt: "Oitavas de final", fr: "8es de finale", zh: "16 强赛", zht: "16 強", nl: "Achtste finales" },
  "f.qf": { es: "Cuartos", en: "Quarterfinals", de: "Viertelfinale", it: "Quarti", pt: "Quartas de final", fr: "Quarts de finale", zh: "四分之一决赛", zht: "8 強", nl: "Kwartfinales" },
  "f.sf": { es: "Semifinal", en: "Semifinals", de: "Halbfinale", it: "Semifinale", pt: "Semifinal", fr: "Demi-finale", zh: "半决赛", zht: "準決賽", nl: "Halve finales" },
  "f.third": { es: "Tercer puesto", en: "Third place", de: "Spiel um Platz 3", it: "Finale 3º posto", pt: "Disputa de 3º lugar", fr: "Petite finale", zh: "季军赛", zht: "季軍賽", nl: "Troostfinale" },
  "f.final": { es: "La final", en: "The final", de: "Das Finale", it: "La finale", pt: "A final", fr: "La finale", zh: "决赛", zht: "決賽", nl: "De finale" },
  "f.tbd": { es: "Por definir", en: "TBD", de: "Noch offen", it: "Da definire", pt: "A definir", fr: "À définir", zh: "待定", zht: "待定", nl: "Nog onbekend" },
  "f.reg90": { es: "en los 90 · terminó {h}–{a}", en: "after 90 · ended {h}–{a}", de: "nach 90 · Endstand {h}–{a}", it: "nei 90 · finita {h}–{a}", pt: "nos 90 · terminou {h}–{a}", fr: "après 90 min · terminé {h}–{a}", zh: "90 分钟比分 · 最终 {h}–{a}", zht: "90 分鐘比分 · 最終 {h}–{a}", nl: "na 90 min · eindstand {h}–{a}" },
  "f.yourPick": { es: "Su pronóstico:", en: "Your pick:", de: "Dein Tipp:", it: "Il tuo pronostico:", pt: "Seu palpite:", fr: "Ton prono :", zh: "你的预测：", zht: "你的預測：", nl: "Jouw voorspelling:" },
  "f.noPickPailas": { es: "no marcó — pailas", en: "no pick — tough luck", de: "kein Tipp — Pech gehabt", it: "nessun pronostico — peccato", pt: "sem palpite — já era", fr: "pas de prono — tant pis !", zh: "没预测 — 可惜啦", zht: "沒預測 — 可惜啦", nl: "geen voorspelling — helaas pindakaas" },
  "f.plusPts": { es: "+{n} pts", en: "+{n} pts", de: "+{n} Pkt", it: "+{n} pt", pt: "+{n} pts", fr: "+{n} pts", zh: "+{n} 分", zht: "+{n} 分", nl: "+{n} ptn" },
  "f.howScored": { es: "¿Cómo se calcularon los puntos?", en: "How were the points scored?", de: "Wie kamen die Punkte zustande?", it: "Come sono stati assegnati i punti?", pt: "Como os pontos foram calculados?", fr: "Comment les points ont-ils été calculés ?", zh: "积分是怎么算的？", zht: "積分是怎麼算的？", nl: "Hoe zijn de punten berekend?" },
  "f.youTag": { es: "usted", en: "you", de: "du", it: "tu", pt: "você", fr: "toi", zh: "你", zht: "你", nl: "jij" },
  "f.stageX": { es: "Eliminatoria ×{m}", en: "Knockout ×{m}", de: "K.-o. ×{m}", it: "Eliminazione ×{m}", pt: "Mata-mata ×{m}", fr: "Phase finale ×{m}", zh: "淘汰赛 ×{m}", zht: "淘汰賽 ×{m}", nl: "Knock-out ×{m}" },
  "f.calcMiss": { es: "Sin aciertos", en: "No points", de: "Keine Treffer", it: "Nessun punto", pt: "Sem acertos", fr: "Aucun point", zh: "未得分", zht: "未得分", nl: "Geen punten" },
  "f.jokerHint": { es: "uno por ronda · 9 en total", en: "one per round · 9 total", de: "einer pro Runde · 9 insgesamt", it: "uno per turno · 9 in totale", pt: "um por rodada · 9 no total", fr: "un par tour · 9 au total", zh: "每轮一个 · 共 9 个", zht: "每輪一個 · 共 9 個", nl: "één per ronde · 9 in totaal" },
  "f.goalsOf": { es: "Goles {team}", en: "Goals {team}", de: "Tore {team}", it: "Gol {team}", pt: "Gols {team}", fr: "Buts {team}", zh: "{team} 进球数", zht: "{team}進球數", nl: "Doelpunten {team}" },
  "f.minus": { es: "Menos goles {team}", en: "Fewer goals {team}", de: "Weniger Tore {team}", it: "Meno gol {team}", pt: "Menos gols {team}", fr: "Moins de buts {team}", zh: "减少 {team} 的进球", zht: "減少{team}進球", nl: "Minder doelpunten {team}" },
  "f.plus": { es: "Más goles {team}", en: "More goals {team}", de: "Mehr Tore {team}", it: "Più gol {team}", pt: "Mais gols {team}", fr: "Plus de buts {team}", zh: "增加 {team} 的进球", zht: "增加{team}進球", nl: "Meer doelpunten {team}" },

  "f.alsoAll": { es: "Copiar a mis otras pollas", en: "Copy to my other pollas", de: "In meine anderen Pollas kopieren", it: "Copia nelle mie altre pollas", fr: "Copier dans mes autres pollas", pt: "Copiar para meus outros bolões", zh: "同时复制到我的其他竞猜", zht: "同時複製到我的其他競猜", nl: "Kopieer naar mijn andere polla's" },
  "f.copyFrom": { es: "Copiar pronósticos de", en: "Copy your picks from", de: "Tipps übernehmen aus", it: "Copia i pronostici da", fr: "Copier tes pronos depuis", pt: "Copiar palpites de", zh: "复制预测，来源", zht: "複製預測，來源", nl: "Voorspellingen kopiëren uit" },
  "f.copyBtn": { es: "Copiar", en: "Copy", de: "Übernehmen", it: "Copia", fr: "Copier", pt: "Copiar", zh: "复制", zht: "複製", nl: "Kopiëren" },
  "f.copyHint": { es: "Trae sus marcadores de otra polla — solo partidos abiertos que no haya marcado acá. Los comodines no se copian.", en: "Brings your scores from another polla — only open matches you haven't picked here. Jokers don't copy.", de: "Holt deine Ergebnisse aus einer anderen Polla — nur offene Spiele ohne Tipp hier. Joker werden nicht kopiert.", it: "Porta i tuoi risultati da un'altra polla — solo partite aperte senza pronostico qui. I jolly non si copiano.", fr: "Récupère tes scores d'une autre polla — seulement les matchs ouverts sans prono ici. Les jokers ne se copient pas.", pt: "Traz seus placares de outro bolão — só jogos abertos sem palpite aqui. Coringas não copiam.", zh: "从另一个竞猜导入你的比分 — 仅限此处未预测的开放比赛。百搭不会复制。", zht: "從另一個競猜匯入你的比分 — 僅限此處未預測的開放比賽。百搭不會複製。", nl: "Haalt je voorspellingen uit een andere polla op — alleen open wedstrijden zonder voorspelling hier. Jokers worden niet gekopieerd." },

  // ---- bonus ----
  "b.title": { es: "Bonus del torneo", en: "Tournament bonus picks", de: "Turnier-Bonustipps", it: "Bonus del torneo", pt: "Bônus do torneio", fr: "Bonus du tournoi", zh: "锦标赛奖励竞猜", zht: "錦標賽獎勵競猜", nl: "Toernooibonus" },
  "b.closedLine": { es: "Ya cerraron — estos son los del parche.", en: "Locked — here's what everyone picked.", de: "Gesperrt — das hat die Crew getippt.", it: "Chiusi — ecco cosa ha scelto la combriccola.", pt: "Fechado — esses são os palpites da galera.", fr: "Verrouillés — voilà les choix de tout le monde.", zh: "已截止 — 这是大家的选择。", zht: "已截止 — 這是大家的選擇。", nl: "Gesloten — dit heeft iedereen gekozen." },
  "b.closesAt": { es: "Cierran el {when} (su hora).", en: "Picks lock {when} (your time).", de: "Offen bis {when} (deine Zeit).", it: "Chiudono il {when} (ora locale).", pt: "Fecha em {when} (seu horário).", fr: "Verrouillage le {when} (ton heure).", zh: "截止时间：{when}（你的时区）。", zht: "截止時間：{when}（你的時區）。", nl: "Sluit op {when} (jouw tijd)." },
  "b.noDeadline": { es: "Quien organiza todavía no ha fijado el cierre.", en: "The organizer hasn't set the deadline yet.", de: "Die Spielleitung hat noch keine Frist gesetzt.", it: "Chi organizza non ha ancora fissato la scadenza.", pt: "Quem organiza ainda não definiu o prazo.", fr: "La personne qui organise n'a pas encore fixé l'échéance.", zh: "主持人尚未设定截止时间。", zht: "主辦人尚未設定截止時間。", nl: "De organisator heeft nog geen deadline ingesteld." },
  "b.champion": { es: "Campeón", en: "Champion", de: "Weltmeister", it: "Campione", pt: "Campeão", fr: "Champion", zh: "冠军", zht: "冠軍", nl: "Kampioen" },
  "b.runnerUp": { es: "Subcampeón", en: "Runner-up", de: "Vizeweltmeister", it: "Vicecampione", pt: "Vice-campeão", fr: "Vice-champion", zh: "亚军", zht: "亞軍", nl: "Verliezend finalist" },
  "b.third": { es: "Tercer puesto", en: "Third place", de: "Dritter Platz", it: "Terzo posto", pt: "Terceiro lugar", fr: "Troisième place", zh: "季军", zht: "季軍", nl: "Derde plaats" },
  "b.topScorer": { es: "Goleador", en: "Top scorer", de: "Torschützenkönig", it: "Capocannoniere", pt: "Artilheiro", fr: "Meilleur buteur", zh: "最佳射手", zht: "最佳射手", nl: "Topscorer" },
  "b.bestGk": { es: "Mejor arquero", en: "Best goalkeeper", de: "Bester Torwart", it: "Miglior portiere", pt: "Melhor goleiro", fr: "Meilleur gardien", zh: "最佳门将", zht: "最佳守門員", nl: "Beste keeper" },
  "b.none": { es: "— sin pronóstico —", en: "— no pick —", de: "— kein Tipp —", it: "— nessun pronostico —", pt: "— sem palpite —", fr: "— aucun choix —", zh: "— 未选择 —", zht: "— 未選擇 —", nl: "— geen voorspelling —" },
  "b.playerPh": { es: "Nombre del jugador", en: "Player's name", de: "Name des Spielers", it: "Nome del giocatore", pt: "Nome do jogador", fr: "Nom du joueur", zh: "球员姓名", zht: "球員姓名", nl: "Naam van de speler" },
  "b.save": { es: "Guardar pronósticos", en: "Save picks", de: "Tipps speichern", it: "Salva pronostici", pt: "Salvar palpites", fr: "Enregistrer les choix", zh: "保存竞猜", zht: "儲存競猜", nl: "Keuzes opslaan" },
  "b.editable": { es: "Puede cambiarlos hasta el cierre.", en: "You can change them until the deadline.", de: "Bis zur Frist änderbar.", it: "Puoi cambiarli fino alla scadenza.", pt: "Pode mudar até o prazo.", fr: "Modifiables jusqu'à l'échéance.", zh: "截止前都可以修改。", zht: "截止前都可以修改。", nl: "Je kunt ze aanpassen tot de deadline." },
  "b.nobody": { es: "Nadie se le midió.", en: "Nobody dared.", de: "Niemand hat sich getraut.", it: "Nessuno ha osato.", pt: "Ninguém se arriscou.", fr: "Personne n'a osé.", zh: "还没人敢猜。", zht: "還沒人敢猜。", nl: "Niemand durfde." },

  // ---- recocha ----
  "r.title": { es: "La Recocha", en: "La Recocha", de: "La Recocha", it: "La Recocha", pt: "La Recocha", fr: "La Recocha", zh: "La Recocha", zht: "La Recocha", nl: "La Recocha" },
  "r.sub": { es: "Las preguntas las propone el parche y las resuelve quien organiza.", en: "The crew proposes the questions; the organizer settles them.", de: "Die Crew stellt die Fragen, die Spielleitung entscheidet.", it: "La combriccola propone le domande; chi organizza decide il risultato.", pt: "A galera propõe as perguntas; quem organiza dá o veredito.", fr: "La bande propose les questions ; la personne qui organise tranche.", zh: "朋友们出题，主持人裁定答案。", zht: "朋友們出題，主辦人裁定答案。", nl: "Je maten stellen de vragen voor; de organisator beslist." },
  "r.nOpen": { es: "{n} abiertas", en: "{n} open", de: "{n} offen", it: "{n} aperte", pt: "{n} abertas", fr: "{n} ouvertes", zh: "{n} 题开放中", zht: "{n} 題開放中", nl: "{n} open" },
  "r.open": { es: "Abiertas", en: "Open", de: "Offen", it: "Aperte", pt: "Abertas", fr: "Ouvertes", zh: "开放中", zht: "開放中", nl: "Open" },
  "r.emptyTitle": { es: "Nada abierto por ahora", en: "Nothing open right now", de: "Gerade nichts offen", it: "Niente di aperto al momento", pt: "Nada aberto agora", fr: "Rien d'ouvert pour l'instant", zh: "暂时没有开放的问题", zht: "暫時沒有開放的問題", nl: "Even niets open" },
  "r.emptyBody": { es: "Proponga una pregunta abajo — la que sea.", en: "Propose a question below — anything goes.", de: "Schlag unten eine Frage vor — alles erlaubt.", it: "Proponi una domanda qui sotto — vale tutto.", pt: "Proponha uma pergunta aí embaixo — vale tudo.", fr: "Propose une question ci-dessous — tout est permis.", zh: "在下方提个问题 — 什么都行。", zht: "在下方提個問題 — 什麼都行。", nl: "Stel hieronder een vraag voor — alles mag." },
  "r.proposedBy": { es: "propuso {name} · {n} pts", en: "by {name} · {n} pts", de: "von {name} · {n} Pkt", it: "di {name} · {n} pt", pt: "de {name} · {n} pts", fr: "de {name} · {n} pts", zh: "{name} 提出 · {n} 分", zht: "{name} 提出 · {n} 分", nl: "van {name} · {n} ptn" },
  "r.closes": { es: "cierra {when}", en: "closes {when}", de: "schließt {when}", it: "chiude {when}", pt: "fecha {when}", fr: "ferme {when}", zh: "{when}截止", zht: "{when}截止", nl: "sluit {when}" },
  "r.answer": { es: "Responder", en: "Answer", de: "Antworten", it: "Rispondi", pt: "Responder", fr: "Répondre", zh: "回答", zht: "回答", nl: "Antwoorden" },
  "r.change": { es: "Cambiar", en: "Change", de: "Ändern", it: "Cambia", pt: "Mudar", fr: "Changer", zh: "修改", zht: "修改", nl: "Wijzigen" },
  "r.yourAnswer": { es: "Su respuesta: {v} — puede cambiarla hasta el cierre.", en: "Your answer: {v} — changeable until it closes.", de: "Deine Antwort: {v} — bis zur Frist änderbar.", it: "La tua risposta: {v} — modificabile fino alla chiusura.", pt: "Sua resposta: {v} — pode mudar até fechar.", fr: "Ta réponse : {v} — modifiable jusqu'à la fermeture.", zh: "你的回答：{v} — 截止前可修改。", zht: "你的回答：{v} — 截止前可修改。", nl: "Jouw antwoord: {v} — aan te passen tot de sluiting." },
  "r.waiting": { es: "Cerradas, esperando resultado", en: "Closed, awaiting the verdict", de: "Geschlossen, Ergebnis steht aus", it: "Chiuse, in attesa del verdetto", pt: "Fechadas, esperando o veredito", fr: "Fermées, en attente du verdict", zh: "已截止，等待裁定", zht: "已截止，等待裁定", nl: "Gesloten, wachten op de uitslag" },
  "r.closed": { es: "cerrada", en: "closed", de: "geschlossen", it: "chiusa", pt: "fechada", fr: "fermée", zh: "已截止", zht: "已截止", nl: "gesloten" },
  "r.resolvedH": { es: "Resueltas", en: "Settled", de: "Entschieden", it: "Risolte", pt: "Resolvidas", fr: "Tranchées", zh: "已裁定", zht: "已裁定", nl: "Uitslag bekend" },
  "r.resolved": { es: "resuelta", en: "settled", de: "entschieden", it: "risolta", pt: "resolvida", fr: "tranchée", zh: "已裁定", zht: "已裁定", nl: "beslist" },
  "r.closest": { es: "a quien más se acerque", en: "closest wins", de: "am nächsten dran gewinnt", it: "vince il più vicino", pt: "mais próximo ganha", fr: "le plus proche gagne", zh: "最接近者得分", zht: "最接近者得分", nl: "dichtstbij wint" },
  "r.answerIs": { es: "Respuesta:", en: "Answer:", de: "Antwort:", it: "Risposta:", pt: "Resposta:", fr: "Réponse :", zh: "答案：", zht: "答案：", nl: "Antwoord:" },
  "r.correct": { es: "Respuesta correcta", en: "Correct answer", de: "Richtige Antwort", it: "Risposta corretta", pt: "Resposta correta", fr: "Bonne réponse", zh: "正确答案", zht: "正確答案", nl: "Juiste antwoord" },
  "r.closestOpt": { es: "Gana quien más se acerque (en vez de exacto)", en: "Closest answer wins (instead of exact)", de: "Wer am nächsten dran ist, gewinnt (statt exakt)", it: "Vince la risposta più vicina (invece dell'esatta)", pt: "Ganha quem chegar mais perto (em vez de exato)", fr: "La réponse la plus proche gagne (plutôt qu'une réponse exacte)", zh: "最接近的回答得分（而非完全一致）", zht: "最接近的回答得分（而非完全一致）", nl: "Wie het dichtst zit wint (in plaats van exact)" },
  "r.resolve": { es: "Resolver", en: "Settle", de: "Entscheiden", it: "Risolvi", pt: "Resolver", fr: "Trancher", zh: "裁定", zht: "裁定", nl: "Beslissen" },
  "r.toApprove": { es: "En votación del parche", en: "Up for a crew vote", de: "Crew-Abstimmung läuft", it: "Al voto della combriccola", pt: "Em votação da galera", fr: "Au vote de la bande", zh: "朋友们投票中", zht: "朋友們投票中", nl: "De maten stemmen" },
  "r.tally": { es: "{a} a favor · {r} en contra · pasa con {needed} de {eligible}", en: "{a} for · {r} against · passes at {needed} of {eligible}", de: "{a} dafür · {r} dagegen · braucht {needed} von {eligible}", it: "{a} a favore · {r} contro · passa con {needed} su {eligible}", pt: "{a} a favor · {r} contra · passa com {needed} de {eligible}", fr: "{a} pour · {r} contre · adoptée à {needed} sur {eligible}", zh: "{a} 赞成 · {r} 反对 · {eligible} 人中需 {needed} 票通过", zht: "{a} 贊成 · {r} 反對 · {eligible} 人中需 {needed} 票通過", nl: "{a} voor · {r} tegen · aangenomen bij {needed} van {eligible}" },
  "r.voteApprove": { es: "¡Que entre!", en: "Approve", de: "Dafür", it: "Approva", pt: "Pode entrar!", fr: "Pour", zh: "赞成", zht: "贊成", nl: "Voor" },
  "r.voteReject": { es: "Que no", en: "Reject", de: "Dagegen", it: "Rifiuta", pt: "Melhor não", fr: "Contre", zh: "反对", zht: "反對", nl: "Tegen" },
  "r.quorumNote": { es: "Mayoría del parche al momento de proponerla ({n} entonces).", en: "Majority of the crew as of when it was proposed ({n} back then).", de: "Mehrheit der Crew zum Zeitpunkt des Vorschlags ({n} damals).", it: "Maggioranza della combriccola al momento della proposta (erano {n} all'epoca).", pt: "Maioria da galera no momento da proposta ({n} na época).", fr: "Majorité de la bande au moment de la proposition ({n} à l'époque).", zh: "以提出时的成员数为准（当时 {n} 人）。", zht: "以提出時的成員數為準（當時 {n} 人）。", nl: "Meerderheid van de groep op het moment van voorstellen (toen {n})." },
  "r.proposes": { es: "Propone {name} · tipo {type} · cierra {when}", en: "By {name} · type {type} · closes {when}", de: "Von {name} · Typ {type} · schließt {when}", it: "Di {name} · tipo {type} · chiude {when}", pt: "De {name} · tipo {type} · fecha {when}", fr: "De {name} · type {type} · ferme {when}", zh: "{name} 提出 · 类型 {type} · {when}截止", zht: "{name} 提出 · 類型 {type} · {when}截止", nl: "Van {name} · type {type} · sluit {when}" },
  "r.nobody": { es: "Nadie respondió.", en: "Nobody answered.", de: "Niemand hat geantwortet.", it: "Nessuno ha risposto.", pt: "Ninguém respondeu.", fr: "Personne n'a répondu.", zh: "没有人回答。", zht: "沒有人回答。", nl: "Niemand heeft geantwoord." },
  "r.proposeH": { es: "Proponga una pregunta", en: "Propose a question", de: "Frage vorschlagen", it: "Proponi una domanda", pt: "Proponha uma pergunta", fr: "Propose une question", zh: "提个问题", zht: "提個問題", nl: "Stel een vraag voor" },
  "r.proposeSub": {
    es: "La que sea: “¿cuántos bailes de salsa choke?”, “¿llora el comentarista si gana Colombia?”",
    en: "Anything: “how many salsa choke dances?”, “does the commentator cry if Colombia wins?”",
    de: "Alles geht: „Wie viele Salsa-Choke-Tänze?“, „Weint der Kommentator, wenn Kolumbien gewinnt?“",
    it: "Qualsiasi cosa: “quanti balli di salsa choke?”, “piange il telecronista se vince la Colombia?”",
    pt: "Qualquer coisa: “quantas dancinhas de salsa choke?”, “o narrador chora se a Colômbia ganhar?”",
    fr: "Tout est permis : « combien de danses salsa choke ? », « le commentateur pleure-t-il si la Colombie gagne ? »", zh: "什么都行：“会有几段 salsa choke 舞？”、“哥伦比亚赢了，解说员会哭吗？”",
    zht: "什麼都行：「會有幾段 salsa choke 舞？」、「哥倫比亞贏了主播會哭嗎？」", nl: "Wat dan ook: “hoeveel salsa choke-dansjes?”, “huilt de commentator als Colombia wint?”",
  },
  "r.q": { es: "Pregunta", en: "Question", de: "Frage", it: "Domanda", pt: "Pergunta", fr: "Question", zh: "问题", zht: "問題", nl: "Vraag" },
  "r.type": { es: "Tipo de respuesta", en: "Answer type", de: "Antworttyp", it: "Tipo di risposta", pt: "Tipo de resposta", fr: "Type de réponse", zh: "回答类型", zht: "回答類型", nl: "Antwoordtype" },
  "r.number": { es: "Número", en: "Number", de: "Zahl", it: "Numero", pt: "Número", fr: "Nombre", zh: "数字", zht: "數字", nl: "Getal" },
  "r.yesno": { es: "Sí / No", en: "Yes / No", de: "Ja / Nein", it: "Sì / No", pt: "Sim / Não", fr: "Oui / Non", zh: "是 / 否", zht: "是 / 否", nl: "Ja / Nee" },
  "r.choice": { es: "Opción múltiple", en: "Multiple choice", de: "Auswahl", it: "Scelta multipla", pt: "Múltipla escolha", fr: "Choix multiple", zh: "选择题", zht: "選擇題", nl: "Meerkeuze" },
  "r.options": { es: "Opciones", en: "Options", de: "Optionen", it: "Opzioni", pt: "Opções", fr: "Options", zh: "选项", zht: "選項", nl: "Opties" },
  "r.optionsHint": { es: "(una por línea, solo para tipo “Opciones”)", en: "(one per line, only for multiple choice)", de: "(eine pro Zeile, nur bei Typ „Auswahl“)", it: "(una per riga, solo per scelta multipla)", pt: "(uma por linha, só para múltipla escolha)", fr: "(une par ligne, seulement pour le choix multiple)", zh: "（每行一个，仅选择题需要）", zht: "（每行一個，僅選擇題需要）", nl: "(één per regel, alleen voor meerkeuze)" },
  "r.match": { es: "Partido (opcional — cierra con el pitazo)", en: "Match (optional — closes at kickoff)", de: "Spiel (optional — schließt beim Anpfiff)", it: "Partita (opzionale — chiude al fischio)", pt: "Jogo (opcional — fecha no apito)", fr: "Match (optionnel — ferme au coup d'envoi)", zh: "关联比赛（可选 — 开赛时截止）", zht: "關聯比賽（可選 — 開賽時截止）", nl: "Wedstrijd (optioneel — sluit bij de aftrap)" },
  "r.noMatch": { es: "Sin partido — cierre manual", en: "No match — manual deadline", de: "Kein Spiel — manuelle Frist", it: "Nessuna partita — scadenza manuale", pt: "Sem jogo — prazo manual", fr: "Sans match — échéance manuelle", zh: "不关联比赛 — 手动截止", zht: "不關聯比賽 — 手動截止", nl: "Geen wedstrijd — handmatige deadline" },
  "r.manualClose": { es: "Cierre manual", en: "Manual deadline", de: "Manuelle Frist", it: "Scadenza manuale", pt: "Prazo manual", fr: "Échéance manuelle", zh: "手动截止时间", zht: "手動截止時間", nl: "Handmatige deadline" },
  "r.points": { es: "Puntos", en: "Points", de: "Punkte", it: "Punti", pt: "Pontos", fr: "Points", zh: "分值", zht: "分值", nl: "Punten" },
  "r.propose": { es: "Mandársela al parche", en: "Send it to the crew", de: "Ab an die Crew", it: "Mandala alla combriccola", pt: "Mandar pra galera", fr: "Envoie-la à la bande", zh: "发给朋友们", zht: "發給朋友們", nl: "Stuur 'm naar de groep" },
  "r.choose": { es: "Elija…", en: "Pick…", de: "Wähle…", it: "Scegli…", pt: "Escolha…", fr: "Choisis…", zh: "请选择…", zht: "請選擇…", nl: "Kies…" },
  "r.yes": { es: "Sí", en: "Yes", de: "Ja", it: "Sì", pt: "Sim", fr: "Oui", zh: "是", zht: "是", nl: "Ja" },
  "r.no": { es: "No", en: "No", de: "Nein", it: "No", pt: "Não", fr: "Non", zh: "否", zht: "否", nl: "Nee" },
  "r.yourAnswerLabel": { es: "Su respuesta", en: "Your answer", de: "Deine Antwort", it: "La tua risposta", pt: "Sua resposta", fr: "Ta réponse", zh: "你的回答", zht: "你的回答", nl: "Jouw antwoord" },

  // ---- settings ----
  "set.title": { es: "Configuración", en: "Settings", de: "Einstellungen", it: "Impostazioni", pt: "Configurações", fr: "Paramètres", zh: "设置", zht: "設定", nl: "Instellingen" },
  "set.invite": { es: "Enlace de invitación", en: "Invite link", de: "Einladungslink", it: "Link d'invito", pt: "Link de convite", fr: "Lien d'invitation", zh: "邀请链接", zht: "邀請連結", nl: "Uitnodigingslink" },
  "set.regen": { es: "Regenerar enlace (invalida el anterior)", en: "Regenerate link (invalidates the old one)", de: "Link erneuern (der alte wird ungültig)", it: "Rigenera link (invalida il precedente)", pt: "Gerar novo link (invalida o anterior)", fr: "Régénérer le lien (invalide l'ancien)", zh: "重新生成链接（旧链接失效）", zht: "重新產生連結（舊連結失效）", nl: "Nieuwe link maken (de oude vervalt)" },
  "set.vaca": { es: "La vaca", en: "The pot", de: "Der Pott", it: "La cassa", pt: "A caixinha", fr: "La cagnotte", zh: "奖池", zht: "獎池", nl: "De pot" },
  "set.vacaPh": { es: "$50.000 por cabeza · 70/20/10", en: "$10 each · 70/20/10", de: "10 € pro Kopf · 70/20/10", it: "10 € a testa · 70/20/10", pt: "R$ 50 por cabeça · 70/20/10", fr: "10 € par tête · 70/20/10", zh: "每人 ¥50 · 70/20/10", zht: "每人 NT$200 · 70/20/10", nl: "€ 10 p.p. · 70/20/10" },
  "set.bonusClose": { es: "Cierre de los bonus", en: "Bonus picks deadline", de: "Frist für Bonustipps", it: "Scadenza dei bonus", pt: "Prazo dos bônus", fr: "Échéance des bonus", zh: "奖励竞猜截止时间", zht: "獎勵競猜截止時間", nl: "Deadline bonusvoorspellingen" },
  "set.bonusCloseSub": { es: "Hasta cuándo se puede pronosticar campeón, goleador, etc.", en: "Until when champion, top scorer, etc. can be picked.", de: "Bis wann Weltmeister, Torschützenkönig usw. getippt werden können.", it: "Fino a quando si possono pronosticare campione, capocannoniere, ecc.", pt: "Até quando dá pra cravar campeão, artilheiro, etc.", fr: "Jusqu'à quand on peut pronostiquer champion, buteur, etc.", zh: "冠军、最佳射手等竞猜的截止时间。", zht: "冠軍、最佳射手等競猜的截止時間。", nl: "Tot wanneer kampioen, topscorer enz. voorspeld kunnen worden." },
  "set.save": { es: "Guardar", en: "Save", de: "Speichern", it: "Salva", pt: "Salvar", fr: "Enregistrer", zh: "保存", zht: "儲存", nl: "Opslaan" },
  "set.crew": { es: "El parche ({n})", en: "The crew ({n})", de: "Die Crew ({n})", it: "La combriccola ({n})", pt: "A galera ({n})", fr: "La bande ({n})", zh: "成员（{n}）", zht: "成員（{n}）", nl: "De maten ({n})" },
  "set.organiza": { es: "organiza", en: "organizer", de: "Spielleitung", it: "organizza", pt: "organiza", fr: "organise", zh: "主持人", zht: "主辦人", nl: "organisator" },
  "set.you": { es: "Su nombre en las pollas", en: "Your name in the pollas", de: "Dein Name in den Pollas", it: "Il tuo nome nelle pollas", pt: "Seu nome nos bolões", fr: "Ton nom dans les pollas", zh: "你在竞猜中的名字", zht: "你在競猜中的名字", nl: "Je naam in de polla's" },
  "set.youHint": { es: "Así lo verá el parche en todas sus pollas.", en: "This is how every crew sees you, in all your pollas.", de: "So sieht dich die Crew in allen deinen Pollas.", it: "Così ti vedrà la combriccola in tutte le tue pollas.", pt: "É assim que a galera te vê em todos os seus bolões.", fr: "C'est comme ça que ta bande te voit dans toutes tes pollas.", zh: "所有竞猜里的朋友都会看到这个名字。", zht: "所有競猜裡的朋友都會看到這個名字。", nl: "Zo zien je maten je in al je polla's." },

  // ---- create group ----
  "new.eyebrow": { es: "Nueva polla", en: "New polla", de: "Neue Polla", it: "Nuova polla", pt: "Novo bolão", fr: "Nouvelle polla", zh: "新竞猜", zht: "新競猜", nl: "Nieuwe polla" },
  "new.title": { es: "Arme su polla", en: "Set up your polla", de: "Stell deine Polla zusammen", it: "Crea la tua polla", pt: "Monte seu bolão", fr: "Monte ta polla", zh: "创建你的竞猜", zht: "建立你的競猜", nl: "Zet je polla op" },
  "new.name": { es: "Nombre de la polla", en: "Polla name", de: "Name der Polla", it: "Nome della polla", pt: "Nome do bolão", fr: "Nom de la polla", zh: "竞猜名称", zht: "競猜名稱", nl: "Naam van de polla" },
  "new.namePh": { es: "Polla de la oficina", en: "Office polla", de: "Büro-Polla", it: "Polla dell'ufficio", pt: "Bolão da firma", fr: "Polla du bureau", zh: "办公室竞猜", zht: "辦公室競猜", nl: "Kantoorpolla" },
  "new.scoring": { es: "Sistema de puntos", en: "Scoring system", de: "Punktesystem", it: "Sistema di punteggio", pt: "Sistema de pontos", fr: "Système de points", zh: "计分系统", zht: "計分系統", nl: "Puntensysteem" },
  "new.unico": { es: "Único acertado", en: "Sole-exact bonus", de: "Allein-exakt-Bonus", it: "Bonus unico esatto", pt: "Bônus único exato", fr: "Bonus seul exact", zh: "独中奖励", zht: "獨中獎勵", nl: "Als enige exact" },
  "new.unicoSub": { es: "+5 si solo usted le pega al marcador exacto", en: "+5 if you're the only one with the exact score", de: "+5, wenn nur du das exakte Ergebnis triffst", it: "+5 se sei l'unico col risultato esatto", pt: "+5 se só você acertar o placar exato", fr: "+5 si personne d'autre ne trouve le score exact", zh: "若只有你猜中比分，+5 分", zht: "若只有你猜中比分，+5 分", nl: "+5 als alleen jij de exacte uitslag hebt" },
  "new.vacaLabel": { es: "La vaca", en: "The pot", de: "Der Pott", it: "La cassa", pt: "A caixinha", fr: "La cagnotte", zh: "奖池", zht: "獎池", nl: "De pot" },
  "new.vacaHint": { es: "(opcional — la plata va por fuera de la app)", en: "(optional — money is handled outside the app)", de: "(optional — Geld läuft außerhalb der App)", it: "(opzionale — i soldi girano fuori dall'app)", pt: "(opcional — o dinheiro fica fora do app)", fr: "(optionnel — l'argent se gère hors de l'appli)", zh: "（可选 — 金钱在应用外处理）", zht: "（可選 — 金錢在應用程式外處理）", nl: "(optioneel — het geld gaat buiten de app om)" },
  "new.create": { es: "¡Armar la polla!", en: "Let's go!", de: "Los geht's!", it: "Si parte!", pt: "Bora!", fr: "C'est parti !", zh: "开整！", zht: "開團！", nl: "Daar gaan we!" },
  "preset.clasica": { es: "Clásica", en: "Classic", de: "Klassisch", it: "Classica", pt: "Clássica", fr: "Classique", zh: "经典", zht: "經典", nl: "Klassiek" },
  "preset.clasica.d": {
    es: "La planilla tradicional: 1 pt resultado, 3 pts marcador exacto, +1 por diferencia de gol.",
    en: "The traditional sheet: 1 pt result, 3 pts exact score, +1 goal-difference bonus.",
    de: "Der Klassiker: 1 Pkt Tendenz, 3 Pkt exaktes Ergebnis, +1 für die Tordifferenz.",
    it: "La schedina tradizionale: 1 pt risultato, 3 pt esatto, +1 per la differenza reti.",
    pt: "A cartela tradicional: 1 pt resultado, 3 pts placar exato, +1 pelo saldo de gols.",
    fr: "La grille traditionnelle : 1 pt résultat, 3 pts score exact, +1 pour la différence de buts.", zh: "传统玩法：胜平负 1 分，比分全中 3 分，净胜球 +1 分。",
    zht: "傳統玩法：勝負 1 分，比分全中 3 分，淨勝球 +1 分。", nl: "Het traditionele lijstje: 1 pt uitslag, 3 ptn exacte score, +1 voor het doelsaldo.",
  },
  "preset.marcador_o_nada": { es: "Marcador o nada", en: "Exact or nothing", de: "Exakt oder nichts", it: "Esatto o niente", pt: "Na mosca ou nada", fr: "Exact ou rien", zh: "全中为王", zht: "全中為王", nl: "Exact of niets" },
  "preset.marcador_o_nada.d": {
    es: "Para valientes: 4 pts resultado, 10 pts marcador exacto, y la eliminación directa multiplica.",
    en: "For the bold: 4 pts result, 10 pts exact score, knockout rounds multiply.",
    de: "Für Mutige: 4 Pkt Tendenz, 10 Pkt exakt, K.-o.-Runden multiplizieren.",
    it: "Per i coraggiosi: 4 pt risultato, 10 pt esatto, l'eliminazione diretta moltiplica.",
    pt: "Pros corajosos: 4 pts resultado, 10 pts exato, mata-mata multiplica.",
    fr: "Pour les téméraires : 4 pts résultat, 10 pts score exact, et les phases finales multiplient.", zh: "勇者玩法：胜平负 4 分，全中 10 分，淘汰赛加倍。",
    zht: "勇者玩法：勝負 4 分，全中 10 分，淘汰賽加倍。", nl: "Voor durvers: 4 ptn uitslag, 10 ptn exacte score, en de knock-outfase vermenigvuldigt je punten.",
  },
  "preset.escalonada": { es: "Escalonada con comodín", en: "Tiered with joker", de: "Gestaffelt mit Joker", it: "A livelli con jolly", pt: "Escalonada com coringa", fr: "Par paliers avec joker", zh: "阶梯+百搭", zht: "階梯+百搭", nl: "Trapsgewijs met joker" },
  "preset.escalonada.d": {
    es: "Niveles excluyentes: exacto 10 / ganador y diferencia 5 / ganador 2 (+1 goles de un equipo). Un comodín por ronda dobla un partido.",
    en: "Exclusive tiers: exact 10 / winner + goal diff 5 / winner 2 (+1 for one team's goals). One joker per round doubles a match.",
    de: "Exklusive Stufen: exakt 10 / Sieger + Differenz 5 / Sieger 2 (+1 für Tore eines Teams). Ein Joker pro Runde verdoppelt ein Spiel.",
    it: "Livelli non cumulabili: esatto 10 / vincente + differenza 5 / vincente 2 (+1 gol di una squadra). Un jolly per turno raddoppia una partita.",
    pt: "Níveis exclusivos: exato 10 / vencedor + saldo 5 / vencedor 2 (+1 gols de um time). Um coringa por rodada dobra um jogo.",
    fr: "Paliers exclusifs : exact 10 / vainqueur + différence 5 / vainqueur 2 (+1 buts d'une équipe). Un joker par tour double un match.", zh: "阶梯计分：全中 10 / 胜平负+净胜球 5 / 胜平负 2（+1 猜中一队进球）。每轮一个百搭让该场翻倍。",
    zht: "階梯計分：全中 10 / 勝負+淨勝球 5 / 勝負 2（+1 猜中一隊進球）。每輪一個百搭讓該場翻倍。", nl: "Niveaus sluiten elkaar uit: exact 10 / winnaar + doelsaldo 5 / winnaar 2 (+1 voor de doelpunten van één team). Eén joker per ronde verdubbelt een wedstrijd.",
  },
  "preset.unicoTag": { es: "único acertado", en: "sole-exact bonus", de: "Allein-exakt-Bonus", it: "bonus unico esatto", pt: "bônus único exato", fr: "bonus seul exact", zh: "独中奖励", zht: "獨中獎勵", nl: "als enige exact" },

  // ---- action feedback (toasts + pending buttons) ----
  "ui.saving": { es: "Guardando…", en: "Saving…", de: "Wird gespeichert…", it: "Salvataggio…", fr: "Enregistrement…", nl: "Opslaan…", pt: "Salvando…", zh: "保存中…", zht: "儲存中…" },
  "ui.saved": { es: "¡Guardado!", en: "Saved!", de: "Gespeichert!", it: "Salvato!", fr: "Enregistré !", nl: "Opgeslagen!", pt: "Salvo!", zh: "已保存！", zht: "已儲存！" },
  "ui.copiedN": { es: "{n} pronósticos copiados", en: "{n} picks copied", de: "{n} Tipps übernommen", it: "{n} pronostici copiati", fr: "{n} pronos copiés", nl: "{n} voorspellingen gekopieerd", pt: "{n} palpites copiados", zh: "已复制 {n} 个预测", zht: "已複製 {n} 個預測" },
  "ui.copied0": { es: "Nada para copiar — ya estaba al día.", en: "Nothing to copy — you're up to date.", de: "Nichts zu übernehmen — alles aktuell.", it: "Niente da copiare — sei già a posto.", fr: "Rien à copier — tout est à jour.", nl: "Niets te kopiëren — je bent al bij.", pt: "Nada pra copiar — já tá em dia.", zh: "没有可复制的 — 都是最新的。", zht: "沒有可複製的 — 都是最新的。" },
  "ui.lockedErr": { es: "Pailas, ya cerró — no se guardó.", en: "Locked — couldn't save.", de: "Schon gesperrt — nicht gespeichert.", it: "Già chiusa — non salvato.", fr: "Déjà verrouillé — pas enregistré.", nl: "Al gesloten — niet opgeslagen.", pt: "Já fechou — não salvou.", zh: "已锁定 — 未保存。", zht: "已鎖定 — 未儲存。" },
  "ui.scoreErr": { es: "No se guardó — máximo 99 goles. 🦅", en: "Save failed — 99 goals is the max. 🦅", de: "Nicht gespeichert — maximal 99 Tore. 🦅", it: "Non salvato — massimo 99 gol. 🦅", fr: "Échec — 99 buts maximum. 🦅", nl: "Niet opgeslagen — maximaal 99 goals. 🦅", pt: "Não salvou — máximo 99 gols. 🦅", zh: "保存失败 — 最多 99 球。🦅", zht: "儲存失敗 — 最多 99 球。🦅" },
  "ui.scoreErrAus": { es: "No se guardó — máximo 99 goles. 🦘", en: "Save failed — 99 goals is the max. 🦘", de: "Nicht gespeichert — maximal 99 Tore. 🦘", it: "Non salvato — massimo 99 gol. 🦘", fr: "Échec — 99 buts maximum. 🦘", nl: "Niet opgeslagen — maximaal 99 goals. 🦘", pt: "Não salvou — máximo 99 gols. 🦘", zh: "保存失败 — 最多 99 球。🦘", zht: "儲存失敗 — 最多 99 球。🦘" },

  // ---- email (Tania from Bucaramanga handles the codes) ----
  "mail.subject": { es: "{code} — su código, se lo manda Tania", en: "{code} — your code, from Tania", de: "{code} — dein Code, von Tania", it: "{code} — il tuo codice, da Tania", pt: "{code} — seu código, da Tania", fr: "{code} — ton code, de la part de Tania", zh: "{code} — 你的验证码，Tania 发来", zht: "{code} — 你的驗證碼，Tania 寄來的", nl: "{code} — je code, van Tania" },
  "mail.body": {
    es: "¡Quiubo! Le habla Tania, desde Bucaramanga.\n\nSu código para entrar a la polla es: {code}\n\nMétale rápido que eso vence en 10 minutos. Y si usted no pidió ningún código, haga de cuenta que no le escribí — borre este correo y ya.\n\nUn abrazo,\nTania\nPollera Colorá",
    en: "Hi! Tania here, writing from Bucaramanga, Colombia — I handle the codes around here.\n\nYour code to get into the polla is: {code}\n\nDon't dawdle, it expires in 10 minutes. And if you never asked for a code, just pretend I never wrote — delete this and we're good.\n\nUn abrazo,\nTania\nPollera Colorá",
    de: "Hallo! Hier ist Tania aus Bucaramanga, Kolumbien — ich bin hier für die Codes zuständig.\n\nDein Code für die Polla: {code}\n\nMach schnell, er gilt nur 10 Minuten. Und falls du gar keinen Code wolltest: Tu einfach so, als hätte ich nie geschrieben — Mail löschen, fertig.\n\nUn abrazo,\nTania\nPollera Colorá",
    it: "Ciao! Sono Tania, ti scrivo da Bucaramanga, Colombia — qui i codici li gestisco io.\n\nIl tuo codice per entrare nella polla è: {code}\n\nSbrigati che scade in 10 minuti. E se non hai chiesto nessun codice, fai finta che non ti abbia mai scritto — cancella e via.\n\nUn abrazo,\nTania\nPollera Colorá",
    pt: "Oi! Aqui é a Tania, escrevendo de Bucaramanga, Colômbia — quem cuida dos códigos por aqui sou eu.\n\nSeu código pra entrar no bolão é: {code}\n\nCorre que ele vence em 10 minutos. E se você não pediu código nenhum, finge que eu nem escrevi — apaga e pronto.\n\nUm abraço,\nTania\nPollera Colorá",
    fr: "Salut ! C'est Tania, je t'écris de Bucaramanga, en Colombie — ici, c'est moi qui gère les codes.\n\nTon code pour entrer dans la polla : {code}\n\nDépêche-toi, il expire dans 10 minutes. Et si tu n'as rien demandé, fais comme si je n'avais jamais écrit — supprime ce mail et voilà.\n\nUn abrazo,\nTania\nPollera Colorá", zh: "你好！我是 Tania，从哥伦比亚布卡拉曼加给你写信 — 这里的验证码归我管。\n\n你进入竞猜的验证码是：{code}\n\n抓紧哦，10 分钟后就过期了。如果你没有请求验证码，就当我没写过 — 删掉这封邮件就好。\n\nUn abrazo，\nTania\nPollera Colorá",
    zht: "你好！我是 Tania，從哥倫比亞布卡拉曼加寫信給你 — 這裡的驗證碼歸我管。\n\n你進入競猜的驗證碼是：{code}\n\n動作要快喔，10 分鐘後就過期了。如果你沒有請求驗證碼，就當我沒寫過 — 刪掉這封信就好。\n\nUn abrazo，\nTania\nPollera Colorá", nl: "Hoi! Hier Tania, ik schrijf je vanuit Bucaramanga, Colombia — de codes regel ik hier.\n\nJe code om in de polla te komen is: {code}\n\nNiet treuzelen, hij verloopt over 10 minuten. En heb je helemaal geen code aangevraagd? Doe dan alsof ik nooit geschreven heb — verwijder deze mail en klaar.\n\nUn abrazo,\nTania\nPollera Colorá",
  },

  // ---- matchday recap ----
  "tab.recap": { es: "Resumen", en: "Recap", de: "Rückblick", it: "Riepilogo", pt: "Resumo", fr: "Récap", zh: "回顾", zht: "回顧", nl: "Overzicht" },
  "footer.fdAttribution": { es: "Datos de fútbol por la API de football-data.org", en: "Football data provided by the football-data.org API", de: "Fußballdaten von der football-data.org-API", it: "Dati calcistici dall'API di football-data.org", pt: "Dados de futebol pela API football-data.org", fr: "Données football fournies par l'API football-data.org", zh: "足球数据来自 football-data.org API", zht: "足球資料來自 football-data.org API", nl: "Voetbaldata via de football-data.org-API" },
  "recap.eyebrow": { es: "Resumen", en: "Recap", de: "Rückblick", it: "Riepilogo", pt: "Resumo", fr: "Récap", zh: "回顾", zht: "回顧", nl: "Overzicht" },
  "recap.provisional": { es: "En curso · resultados parciales", en: "In progress · partial results", de: "Läuft · Zwischenstand", it: "In corso · risultati parziali", pt: "Em andamento · resultados parciais", fr: "En cours · résultats partiels", zh: "进行中 · 部分结果", zht: "進行中 · 部分結果", nl: "Bezig · tussenstand" },
  "recap.notStarted": { es: "Esta fecha todavía no arranca.", en: "This matchday hasn't started yet.", de: "Dieser Spieltag hat noch nicht begonnen.", it: "Questa giornata non è ancora iniziata.", pt: "Esta rodada ainda não começou.", fr: "Cette journée n'a pas encore commencé.", zh: "本轮比赛还没开始。", zht: "本輪比賽還沒開始。", nl: "Deze speelronde is nog niet begonnen." },
  "recap.yourTotal": { es: "Sus puntos", en: "Your points", de: "Deine Punkte", it: "I tuoi punti", pt: "Seus pontos", fr: "Tes points", zh: "你的积分", zht: "你的積分", nl: "Jouw punten" },
  "recap.rankLine": { es: "Puesto {rank} de {n} en su polla", en: "{rank} of {n} in your polla", de: "Platz {rank} von {n} in deiner Polla", it: "{rank}º su {n} nella tua polla", pt: "{rank}º de {n} no seu bolão", fr: "{rank}e sur {n} dans ta polla", zh: "在你的竞猜中排第 {rank} / 共 {n} 人", zht: "在你的競猜中排第 {rank} / 共 {n} 人", nl: "{rank} van {n} in je polla" },
  "recap.best": { es: "Su mejor pronóstico", en: "Your best call", de: "Dein bester Tipp", it: "La tua giocata migliore", pt: "Seu melhor palpite", fr: "Ton meilleur pronostic", zh: "你最准的一场", zht: "你最準的一場", nl: "Je beste voorspelling" },
  "recap.yourScore": { es: "Su marcador", en: "Your score", de: "Dein Tipp", it: "Il tuo pronostico", pt: "Seu palpite", fr: "Ton pronostic", zh: "你的比分", zht: "你的比分", nl: "Jouw voorspelling" },
  "recap.botTag": { es: "Robot", en: "Bot", de: "Bot", it: "Bot", pt: "Robô", fr: "Bot", zh: "机器人", zht: "機器人", nl: "Bot" },
  "recap.aliasHint": { es: "Apodo — no es su nombre real", en: "Alias — not their real name", de: "Spitzname — nicht der echte Name", it: "Soprannome — non è il vero nome", pt: "Apelido — não é o nome real", fr: "Pseudo — pas son vrai nom", zh: "化名——并非真实姓名", zht: "化名——並非真實姓名", nl: "Schuilnaam — niet de echte naam" },
  "recap.worst": { es: "El que se le escapó", en: "The one that got away", de: "Um ein Haar", it: "Per un soffio", pt: "Por pouco", fr: "À un cheveu", zh: "就差一点", zht: "就差一點", nl: "Net niet" },
  "recap.missSolo": { es: "¡A un gol del marcador exacto… y lo clavaba usted solito contra todos!", en: "One goal from the exact score — and you'd have nailed it alone against everyone!", de: "Ein Tor vom exakten Ergebnis — und du hättest es als Einziger getroffen!", it: "A un gol dal risultato esatto — e l'avresti azzeccato solo tu contro tutti!", pt: "A um gol do placar exato — e você teria acertado sozinho contra todos!", fr: "À un but du score exact — et tu l'aurais trouvé seul contre tous !", zh: "距离精确比分只差一球——而且你本可以独中、力压全场！", zht: "距離精確比分只差一球——而且你本可以獨中、力壓全場！", nl: "Eén goal van de exacte uitslag — en jij had hem als enige geraakt!" },
  "recap.missOneGoal": { es: "A un solo gol del marcador exacto.", en: "Just one goal from the exact score.", de: "Nur ein Tor vom exakten Ergebnis entfernt.", it: "A un solo gol dal risultato esatto.", pt: "A apenas um gol do placar exato.", fr: "À un seul but du score exact.", zh: "距离精确比分只差一球。", zht: "距離精確比分只差一球。", nl: "Op één goal na de exacte uitslag." },
  "recap.missGoals": { es: "A {n} goles del marcador exacto.", en: "{n} goals from the exact score.", de: "{n} Tore vom exakten Ergebnis entfernt.", it: "A {n} gol dal risultato esatto.", pt: "A {n} gols do placar exato.", fr: "À {n} buts du score exact.", zh: "距离精确比分差 {n} 球。", zht: "距離精確比分差 {n} 球。", nl: "{n} goals van de exacte uitslag." },
  "recap.missPoints": { es: "Se le escaparon +{n} pts.", en: "That's +{n} pts that slipped away.", de: "Da sind dir +{n} Pkt entgangen.", it: "Ti sono sfuggiti +{n} pt.", pt: "Escaparam +{n} pts.", fr: "+{n} pts envolés.", zh: "白白溜走了 +{n} 分。", zht: "白白溜走了 +{n} 分。", nl: "Daar gingen +{n} ptn verloren." },
  "recap.beatBot": { es: "Le ganó a {bot} 🤖", en: "You beat {bot} 🤖", de: "Du hast {bot} geschlagen 🤖", it: "Hai battuto {bot} 🤖", pt: "Você venceu {bot} 🤖", fr: "Tu as battu {bot} 🤖", zh: "你赢了 {bot} 🤖", zht: "你贏了 {bot} 🤖", nl: "Je versloeg {bot} 🤖" },
  "recap.tieBot": { es: "Empató con {bot} 🤖", en: "You tied {bot} 🤖", de: "Gleichstand mit {bot} 🤖", it: "Pari con {bot} 🤖", pt: "Empate com {bot} 🤖", fr: "Égalité avec {bot} 🤖", zh: "你和 {bot} 打平 🤖", zht: "你和 {bot} 打平 🤖", nl: "Gelijk met {bot} 🤖" },
  "recap.lostBot": { es: "{bot} le ganó esta fecha 🤖", en: "{bot} beat you this time 🤖", de: "{bot} war diesmal besser 🤖", it: "{bot} ti ha battuto stavolta 🤖", pt: "{bot} venceu você desta vez 🤖", fr: "{bot} t'a battu cette fois 🤖", zh: "这轮 {bot} 赢了你 🤖", zht: "這輪 {bot} 贏了你 🤖", nl: "{bot} won deze keer 🤖" },
  "recap.buddyPolla": { es: "Su parcero en la polla", en: "Your buddy in your polla", de: "Dein Kumpel in deiner Polla", it: "Il tuo compagno nella tua polla", pt: "Seu parceiro no seu bolão", fr: "Ton acolyte dans ta polla", zh: "你在本竞猜的搭档", zht: "你在本競猜的搭檔", nl: "Je maatje in je polla" },
  "recap.buddyGlobal": { es: "Su parcero entre todas las pollas", en: "Your buddy across all pollas", de: "Dein Kumpel über alle Pollas", it: "Il tuo compagno tra tutte le pollas", pt: "Seu parceiro entre todos os bolões", fr: "Ton acolyte toutes pollas confondues", zh: "你在所有竞猜中的搭档", zht: "你在所有競猜中的搭檔", nl: "Je maatje over alle polla's" },
  "recap.buddyBoth": { es: "Su parcero, en su polla y en todas", en: "Your buddy, in your polla and beyond", de: "Dein Kumpel, in deiner Polla und überall", it: "Il tuo compagno, nella tua polla e ovunque", pt: "Seu parceiro, no seu bolão e em todos", fr: "Ton acolyte, dans ta polla et partout", zh: "你的搭档（本竞猜及所有竞猜）", zht: "你的搭檔（本競猜及所有競猜）", nl: "Je maatje, in je polla en daarbuiten" },
  "recap.buddyLine": { es: "Piensan igualito: coinciden en {n} de {total} pronósticos.", en: "Two minds, one scoreline: you match on {n} of {total} predictions.", de: "Ein Herz und eine Seele: {n} von {total} Tipps identisch.", it: "Stessa testa: {n} su {total} pronostici identici.", pt: "Pensam igual: {n} de {total} palpites idênticos.", fr: "Mêmes idées : {n} pronostics identiques sur {total}.", zh: "想法一致：在 {total} 个共同预测中你们有 {n} 个完全相同。", zht: "想法一致：在 {total} 個共同預測中你們有 {n} 個完全相同。", nl: "Twee handen op één buik: {n} van {total} voorspellingen identiek." },
  "recap.global": { es: "Entre todas las pollas", en: "Across all pollas", de: "Über alle Pollas", it: "Tra tutte le pollas", pt: "Entre todos os bolões", fr: "Toutes pollas confondues", zh: "所有竞猜总排名", zht: "所有競猜總排名", nl: "Over alle polla's" },
  "recap.aliasDisclaimer": { es: "Los jugadores de pollas en las que no está aparecen con apodos de futbolistas famosos para proteger su privacidad — no es su nombre real.", en: "Players from pollas you're not in are shown under famous footballer aliases to protect their privacy — these aren't their real names.", de: "Spieler aus Pollas, in denen du nicht bist, erscheinen unter Spitznamen berühmter Fußballer, um ihre Privatsphäre zu schützen — das sind nicht ihre echten Namen.", it: "I giocatori delle pollas a cui non partecipi appaiono con soprannomi di calciatori famosi per tutelarne la privacy — non sono i loro veri nomi.", pt: "Jogadores de bolões dos quais você não participa aparecem com apelidos de jogadores famosos para proteger a privacidade — não são os nomes reais.", fr: "Les joueurs des pollas où tu n'es pas apparaissent sous des pseudos de footballeurs célèbres pour protéger leur vie privée — ce ne sont pas leurs vrais noms.", zh: "你未参与的竞猜中的玩家会以著名球员化名显示，以保护其隐私——这些不是真实姓名。", zht: "你未參與的競猜中的玩家會以著名球員化名顯示，以保護其隱私——這些不是真實姓名。", nl: "Spelers uit polla's waar je niet in zit verschijnen onder schuilnamen van beroemde voetballers om hun privacy te beschermen — dit zijn niet hun echte namen." },
  "recap.globalSub": { es: "Reordenado como si todos jugaran con la planilla Clásica.", en: "Re-ranked as if everyone played Clásica scoring.", de: "Neu sortiert, als spielten alle nach Clásica.", it: "Riordinato come se tutti giocassero con il punteggio Clásica.", pt: "Reordenado como se todos jogassem com a pontuação Clássica.", fr: "Reclassé comme si tout le monde jouait en barème Clásica.", zh: "按所有人都用「经典」计分重新排名。", zht: "按所有人都用「經典」計分重新排名。", nl: "Herrangschikt alsof iedereen met Clásica-puntentelling speelt." },
  "recap.topPercent": { es: "Está en el top {p}% de {n} jugadores activos", en: "You're in the top {p}% of {n} active players", de: "Du bist in den Top {p}% von {n} aktiven Spielern", it: "Sei nel top {p}% di {n} giocatori attivi", pt: "Você está no top {p}% de {n} jogadores ativos", fr: "Tu es dans le top {p}% de {n} joueurs actifs", zh: "你在 {n} 名活跃玩家中排进前 {p}%", zht: "你在 {n} 名活躍玩家中排進前 {p}%", nl: "Je zit in de top {p}% van {n} actieve spelers" },
  "recap.notEligible": { es: "Entra al ranking global cuando su polla tenga al menos dos jugadores con pronósticos.", en: "You'll join the global ranking once your polla has at least two players with predictions.", de: "Du kommst ins globale Ranking, sobald deine Polla mindestens zwei Spieler mit Tipps hat.", it: "Entrerai nella classifica globale quando la tua polla avrà almeno due giocatori con pronostici.", pt: "Você entra no ranking global quando seu bolão tiver pelo menos dois jogadores com palpites.", fr: "Tu rejoindras le classement global dès que ta polla aura au moins deux joueurs avec des pronostics.", zh: "当你的竞猜中至少有两名玩家做出预测时，你就会进入全局排名。", zht: "當你的競猜中至少有兩名玩家做出預測時，你就會進入全域排名。", nl: "Je komt in de wereldwijde ranglijst zodra je polla minstens twee spelers met voorspellingen heeft." },
  "recap.indexTitle": { es: "Resúmenes", en: "Recaps", de: "Rückblicke", it: "Riepiloghi", pt: "Resumos", fr: "Récaps", zh: "回顾", zht: "回顧", nl: "Overzichten" },
  "recap.indexSub": { es: "Cómo le fue en cada fecha.", en: "How you did each matchday.", de: "Wie es an jedem Spieltag lief.", it: "Com'è andata in ogni giornata.", pt: "Como você foi em cada rodada.", fr: "Tes résultats par journée.", zh: "你每一轮的表现。", zht: "你每一輪的表現。", nl: "Je resultaten per speelronde." },
  "recap.empty": { es: "Todavía no hay fechas para resumir.", en: "No matchdays to recap yet.", de: "Noch keine Spieltage zum Zusammenfassen.", it: "Ancora nessuna giornata da riepilogare.", pt: "Ainda não há rodadas para resumir.", fr: "Aucune journée à récapituler pour l'instant.", zh: "暂时还没有可回顾的轮次。", zht: "暫時還沒有可回顧的輪次。", nl: "Nog geen speelrondes om samen te vatten." },
  "recap.statusLive": { es: "En curso", en: "In progress", de: "Läuft", it: "In corso", pt: "Em andamento", fr: "En cours", zh: "进行中", zht: "進行中", nl: "Bezig" },
  "recap.statusDone": { es: "Terminada", en: "Done", de: "Beendet", it: "Conclusa", pt: "Encerrada", fr: "Terminée", zh: "已结束", zht: "已結束", nl: "Afgelopen" },
  "g.recapTitle": { es: "Resumen de la fecha", en: "Matchday recap", de: "Spieltag-Rückblick", it: "Riepilogo giornata", pt: "Resumo da rodada", fr: "Récap de la journée", zh: "本轮回顾", zht: "本輪回顧", nl: "Speelronde-overzicht" },
  "g.recapReady": { es: "¡Ya salió! Mire cómo le fue y compárese con todas las pollas.", en: "It's out! See how you did and compare across all pollas.", de: "Da ist er! Sieh, wie es lief, und vergleich dich über alle Pollas.", it: "È pronto! Guarda com'è andata e confrontati con tutte le pollas.", pt: "Saiu! Veja como você foi e compare entre todos os bolões.", fr: "C'est dispo ! Vois ton résultat et compare-toi à toutes les pollas.", zh: "出炉啦！看看你的表现，并和所有竞猜对比。", zht: "出爐啦！看看你的表現，並和所有競猜對比。", nl: "Hij is er! Zie hoe je het deed en vergelijk over alle polla's." },
  "g.recapReadyBadge": { es: "¡Listo!", en: "Ready!", de: "Fertig!", it: "Pronto!", pt: "Pronto!", fr: "Dispo !", zh: "已出炉", zht: "已出爐", nl: "Klaar!" },
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
