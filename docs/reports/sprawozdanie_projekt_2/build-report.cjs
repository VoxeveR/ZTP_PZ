// Builds the lab 2 report from the evidence captured by capture-evidence.cjs. Styling and helpers follow
// docs/reports/sprawozdanie_projekt_1/build-report.cjs; the outline follows the lab 2 template
// (LABS/LAB2/imie_nazwisko_grupa_sprawozdanie_projekt_2.docx). Code excerpts are read from the source files.
// Usage, from the repo root: node docs/reports/sprawozdanie_projekt_2/build-report.cjs
const fs = require('node:fs');
const path = require('node:path');
const deps = path.join(process.env.TEMP, 'ztp-report-tools', 'node_modules');
const sharp = require(path.join(deps, 'sharp'));
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  HeadingLevel, AlignmentType, WidthType, Footer, PageNumber,
  ExternalHyperlink, BorderStyle, ShadingType, VerticalAlign,
} = require(path.join(deps, 'docx'));
const root = path.resolve(__dirname, '..', '..', '..');
const src = path.join(root, 'backend', 'src');
const assets = path.join(__dirname, 'assets');
const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, 'evidence.json'), 'utf8'));
const cases = Object.fromEntries(evidence.cases.map((c) => [c.key, c]));
const serverLog = fs.readFileSync(path.join(__dirname, 'server-log.txt'), 'utf8').split('\n').filter(Boolean);
const navy = '17324D', teal = '007F87', gray = '536375', light = 'F0F5F8';
const children = [];
let figureNo = 0;

const textRun = (text, options = {}) => new TextRun({ text, ...options });
function p(text, options = {}) {
  const para = new Paragraph({ children: Array.isArray(text) ? text : [textRun(text)], spacing: { after: 115, line: 280 }, ...options });
  children.push(para);
  return para;
}
function h(text, level = 2, page = false) {
  return p(text, {
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    pageBreakBefore: page, keepNext: true, spacing: { before: level === 1 ? 100 : 160, after: 150 },
  });
}
function code(text) {
  const lines = text.replace(/\s+$/, '').split('\n');
  lines.forEach((line, index) => p([textRun(line, { font: 'Consolas', size: 17, color: '20384D' })], {
    shading: { type: ShadingType.CLEAR, fill: light }, indent: { left: 130, right: 80 },
    spacing: { after: 0, before: 0, line: 215 }, keepNext: index < lines.length - 1,
  }));
  p('', { spacing: { after: 50, line: 100 } });
}
function table(headers, rows, widths) {
  const all = [headers, ...rows];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D5DFE5' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D5DFE5' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'D5DFE5' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'D5DFE5' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: 'D5DFE5' }, insideVertical: { style: BorderStyle.SINGLE, size: 3, color: 'D5DFE5' },
    },
    rows: all.map((row, i) => new TableRow({
      tableHeader: i === 0, cantSplit: true,
      children: row.map((cell, j) => new TableCell({
        width: widths ? { size: widths[j], type: WidthType.DXA } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 95, bottom: 95, left: 115, right: 115 },
        shading: { type: ShadingType.CLEAR, fill: i === 0 ? navy : (i % 2 === 0 ? 'F4F7F9' : 'FFFFFF') },
        children: [new Paragraph({ children: [textRun(String(cell), { size: 20, bold: i === 0, color: i === 0 ? 'FFFFFF' : '243B50' })], spacing: { after: 0, line: 245 } })],
      })),
    })),
  }));
  p('', { spacing: { after: 30, line: 100 } });
}
async function image(file, caption, maxHeight = 390, maxWidth = 640) {
  const data = fs.readFileSync(file);
  const meta = await sharp(data).metadata();
  const scale = Math.min(maxWidth / meta.width, maxHeight / meta.height);
  p([new ImageRun({
    data, type: 'png', transformation: { width: Math.round(meta.width * scale), height: Math.round(meta.height * scale) },
    altText: { title: caption, description: caption, name: path.basename(file) },
  })], { alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 65 } });
  p(`Rysunek ${++figureNo}. ${caption}`, {
    alignment: AlignmentType.CENTER, spacing: { after: 155, line: 240 },
    children: [textRun(`Rysunek ${figureNo}. ${caption}`, { size: 18, italics: true, color: gray })],
  });
}
const shot = (key, caption, maxHeight = 345) => image(path.join(assets, `${key}.png`), caption, maxHeight);
function bibliography(label, url) { p([textRun(`${label}: `), new ExternalHyperlink({ link: url, children: [textRun(url, { style: 'Hyperlink' })] })], { bullet: { level: 0 }, spacing: { after: 80, line: 260 } }); }

/** Lines of a source file from the first line containing `from` through the first following line containing `to`. */
function excerpt(file, from, to, { dedent = true } = {}) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => l.includes(from));
  if (start < 0) throw new Error(`${file}: "${from}" not found`);
  const end = lines.findIndex((l, i) => i >= start && l.includes(to));
  if (end < 0) throw new Error(`${file}: "${to}" not found after "${from}"`);
  const picked = lines.slice(start, end + 1);
  if (!dedent) return picked.join('\n');
  const indent = Math.min(...picked.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return picked.map((l) => l.slice(indent)).join('\n');
}
/** The complete block (function, method or object literal) starting at the first line containing `from`. */
function block(file, from, { leading = 0 } = {}) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => l.includes(from));
  if (start < 0) throw new Error(`${file}: "${from}" not found`);
  let depth = 0;
  let opened = false;
  let end = start;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; opened = true; }
      if (ch === '}') depth--;
    }
    if (opened && depth === 0) { end = i; break; }
  }
  const picked = lines.slice(start - leading, end + 1);
  const indent = Math.min(...picked.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return picked.map((l) => l.slice(indent)).join('\n');
}
const blocks = (file, ...froms) => froms.map((from) => block(file, from)).join('\n\n');
const fmtUtc = (iso) => iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
const logLine = (l) => l.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})\.\d+Z/, '$2Z');

async function diagrams() {
  const box = (x, y, w, hgt, title, sub, fill = '#F0F5F8') => `
    <rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="12" fill="${fill}" stroke="#A1B5C3" stroke-width="2"/>
    <text x="${x + w / 2}" y="${y + hgt / 2 - (sub ? 6 : -8)}" text-anchor="middle" fill="#17324D" font-size="24" font-weight="bold">${title}</text>
    ${sub ? `<text x="${x + w / 2}" y="${y + hgt / 2 + 26}" text-anchor="middle" fill="#536375" font-size="19">${sub}</text>` : ''}`;
  const arrow = (x1, y1, x2, y2, label = '', dash = false) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const a1 = [x2 - 14 * Math.cos(angle - 0.45), y2 - 14 * Math.sin(angle - 0.45)];
    const a2 = [x2 - 14 * Math.cos(angle + 0.45), y2 - 14 * Math.sin(angle + 0.45)];
    return `<path d="M${x1} ${y1} L${x2} ${y2} M${a1[0]} ${a1[1]} L${x2} ${y2} L${a2[0]} ${a2[1]}" stroke="#007F87" stroke-width="3" fill="none" ${dash ? 'stroke-dasharray="10 8"' : ''}/>
      ${label ? `<text x="${(x1 + x2) / 2 + 10}" y="${(y1 + y2) / 2 - 8}" font-size="18" fill="#536375">${label}</text>` : ''}`;
  };
  const architecture = `<svg xmlns="http://www.w3.org/2000/svg" width="1460" height="760" viewBox="0 0 1460 760">
    <rect width="1460" height="760" fill="#FFFFFF"/><g font-family="Arial, sans-serif">
    ${box(30, 60, 300, 110, 'Klient / Swagger', 'żądanie HTTP')}
    ${box(400, 60, 330, 110, 'NotificationsController', 'routing, DTO, filtr błędów')}
    ${box(800, 60, 300, 110, 'NotificationsService', 'reguły, transakcje', '#E2F2F1')}
    ${box(1150, 60, 290, 110, 'Notifications-', 'Repository (TypeORM)')}
    ${box(1170, 300, 260, 110, 'PostgreSQL', 'tabela notifications')}
    ${box(800, 300, 300, 110, 'NotificationWorker', 'co 5 s: processReady()', '#FFF6E6')}
    ${box(400, 300, 330, 110, 'NotificationDispatcher', 'wybór kanału')}
    ${box(400, 540, 330, 110, 'DeliveryService', 'sendEmail / sendPush')}
    ${box(30, 470, 300, 100, 'MailHog', 'SMTP :1025')}
    ${box(30, 610, 300, 100, 'ntfy', 'HTTP POST /topic')}
    ${arrow(330, 115, 400, 115)}${arrow(730, 115, 800, 115)}${arrow(1100, 115, 1150, 115)}${arrow(1300, 170, 1300, 300)}
    ${arrow(950, 300, 950, 170, 'wywołuje', true)}
    ${arrow(800, 150, 730, 330, 'execute()')}
    ${arrow(565, 410, 565, 540)}
    ${arrow(400, 575, 330, 525)}${arrow(400, 615, 330, 655)}
    <text x="345" y="505" font-size="18" fill="#536375">EMAIL</text><text x="345" y="690" font-size="18" fill="#536375">PUSH</text>
    <text x="30" y="740" font-size="20" fill="#536375">Linia przerywana: worker działa w tym samym procesie co serwer HTTP i korzysta z tego samego serwisu.</text>
    </g></svg>`;
  await sharp(Buffer.from(architecture)).png().toFile(path.join(assets, 'architecture.png'));

  const state = (x, y, label, fill) => `<rect x="${x}" y="${y}" width="250" height="90" rx="45" fill="${fill}" stroke="#7F96A8" stroke-width="2"/>
    <text x="${x + 125}" y="${y + 56}" text-anchor="middle" font-size="27" font-weight="bold" fill="#17324D">${label}</text>`;
  const machine = `<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="560" viewBox="0 0 1300 560">
    <rect width="1300" height="560" fill="#FFFFFF"/><g font-family="Arial, sans-serif">
    ${state(80, 235, 'PENDING', '#FFF6E6')}
    ${state(900, 60, 'SENT', '#E2F2F1')}${state(900, 235, 'FAILED', '#FBE8E8')}${state(900, 410, 'CANCELLED', '#ECEFF3')}
    ${arrow(330, 260, 900, 105)}${arrow(330, 280, 900, 280)}${arrow(330, 300, 900, 455)}
    <text transform="translate(611 166) rotate(-15.2)" text-anchor="middle" font-size="20" fill="#536375">wysyłka udana (send-now, worker)</text>
    <text x="560" y="262" font-size="20" fill="#536375">wysyłka nieudana</text>
    <text transform="translate(622 363) rotate(15.2)" text-anchor="middle" font-size="20" fill="#536375">anulowanie</text>
    <text x="24" y="45" font-size="19" fill="#007F87">Każde z trzech przejść można też wykonać przez PATCH /{id}/status.</text>
    <path d="M30 280 H80" stroke="#17324D" stroke-width="3"/><circle cx="24" cy="280" r="9" fill="#17324D"/>
    <text x="80" y="370" font-size="20" fill="#536375">Stan początkowy po POST</text>
    <text x="1280" y="545" text-anchor="end" font-size="20" fill="#536375">SENT, FAILED, CANCELLED - stany końcowe, bez przejść</text>
    </g></svg>`;
  await sharp(Buffer.from(machine)).png().toFile(path.join(assets, 'state-machine.png'));
}

(async () => {
  await diagrams();
  const n = (key) => cases[key].responseBody;
  const sched = evidence.scheduled;
  const workerLines = serverLog.filter((l) => /NotificationWorker|NotificationsService\] Notification \d+ \(|failed:/.test(l));
  const metricsLines = evidence.metrics.split('\n').filter((l) => l && !l.startsWith('#'));
  const metric = (name) => metricsLines.find((l) => l.startsWith(`${name} `))?.split(' ').pop();
  const byChannel = metricsLines.filter((l) => l.startsWith('notifications_by_channel{'))
    .map((l) => l.match(/status="(\w+)",channel="(\w+)"} (\d+)/).slice(1));
  const captureDate = new Date(evidence.capturedAt).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric' });

  // Title page: label, project, title, a short accent rule, then the author directly under the title (no table).
  const centered = (runs, spacing) => p('', { alignment: AlignmentType.CENTER, spacing, children: runs });
  centered([textRun('SPRAWOZDANIE', { bold: true, size: 26, color: teal, characterSpacing: 80 })], { before: 2300, after: 320 });
  centered([textRun('Projekt 2', { bold: true, size: 64, color: navy })], { after: 360 });
  centered([textRun('System planowania', { bold: true, size: 38, color: navy }), new TextRun({ break: 1 }),
    textRun('i obsługi powiadomień', { bold: true, size: 38, color: navy })], { after: 560, line: 340 });
  p('', { alignment: AlignmentType.CENTER, indent: { left: 3950, right: 3950 }, spacing: { after: 620 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: teal, space: 1 } } });
  centered([textRun('Piotr Ziętek', { bold: true, size: 34, color: navy })], { after: 160 });
  centered([textRun('Nr albumu 148585', { size: 24, color: gray }), textRun('   •   ', { size: 24, color: teal }),
    textRun('Grupa SiRR', { size: 24, color: gray })], { after: 4300 });
  centered([textRun('Etapy 2.1-2.3: maszyna stanów, planowanie w UTC, wysyłka EMAIL i PUSH,', { size: 21, color: gray }),
    new TextRun({ break: 1 }), textRun('worker, idempotencja i metryki Prometheus', { size: 21, color: gray })], { after: 160, line: 270 });
  centered([textRun('NestJS • TypeScript • PostgreSQL • MailHog • ntfy • Prometheus', { size: 21, color: gray })], { after: 160 });
  centered([textRun(captureDate, { size: 21, color: gray })], {});

  // 1. Wstęp.
  h('1. Wstęp', 1, true);
  p('Celem projektu jest rozbudowa aplikacji z Projektu 1 o system planowania i obsługi powiadomień dotyczących produktów. Powiadomienie ma treść, kanał (EMAIL lub PUSH), odbiorcę, planowany moment wysyłki i strefę czasową. Aplikacja przechowuje je w bazie, kontroluje przejścia statusów maszyną stanów, a worker działający w tle wysyła je o czasie przez lokalne usługi MailHog i ntfy. Etap 2.3 dodaje idempotencję tworzenia oraz metryki w formacie Prometheus.');
  p('Implementacja korzysta z NestJS, TypeScript i TypeORM. Przykłady laboratoryjne prowadzącej są napisane w FastAPI i dotyczą studentów; projekt realizuje te same wymagania dla domeny produktów. Pliki Docker prowadzącej (usługi MailHog, ntfy i Prometheus w docker-compose.yml) zostały przeniesione do projektu, a konfiguracja Prometheusa została zaadaptowana.');
  p(`Działanie zweryfikowano automatycznie i ręcznie. 76 testów NestJS przeszło w kontenerze, w tym 8 testów integracyjnych powiadomień, które faktycznie wysyłają wiadomości do MailHog i ntfy. 46 manualnych scenariuszy wykonanych w Swagger UI i interfejsie Prometheusa (docs/LAB_2_MANUAL_TESTS.md) zakończyło się wynikiem pozytywnym. Zrzuty ekranu w sprawozdaniu pochodzą z jednego przebiegu z ${captureDate}, opisanego w punkcie 2.`);
  h('1.1. Opis struktury projektu - moduł Notifications');
  p('Moduł powiadomień jest osobnym feature’em backend/src/features/notifications, obok products, categories i product-history. Zgodnie z vertical slicing wszystkie warstwy funkcjonalności znajdują się w jednym katalogu. Odpowiednikami katalogów model/, data/, service/ i web/ z instrukcji są poniższe pliki.');
  table(['Plik / katalog', 'Odpowiedzialność'], [
    ['notification.entity.ts, notification-status.ts, notification-channel.ts', 'Model: encja tabeli notifications, statusy i kanały (model/).'],
    ['notification-create.dto.ts, notification-response.dto.ts, notification-status-update.dto.ts, process-ready-response.dto.ts', 'Kontrakt HTTP: dane wejściowe z walidacją techniczną i format odpowiedzi (model/).'],
    ['notifications.repository.ts', 'Dostęp do danych: zapis, odczyt, blokady wierszy, rekordy gotowe do wysyłki, zliczanie do metryk (data/).'],
    ['notifications.service.ts, notification-state-machine.ts, notification-time.ts', 'Logika: walidacja, konwersja do UTC, maszyna stanów, wykonanie wysyłki, idempotencja, metryki (service/).'],
    ['notification-dispatcher.ts, notification-delivery.service.ts, notification-worker.ts', 'Realizacja: wybór kanału, wysyłka do MailHog i ntfy, worker cykliczny (service/).'],
    ['notifications.controller.ts, notifications-metrics.controller.ts, notifications.openapi.ts', 'Warstwa web: endpointy, /metrics i opis Swagger (web/).'],
    ['notification.errors.ts, notification-exception.filter.ts, notification-id.pipe.ts, idempotency-key.ts', 'Błędy domenowe i ich mapowanie na kody HTTP, walidacja ID i nagłówka.'],
    ['infrastructure/database/migrations/1790000003000…5000', 'Tabela notifications, indeks dla workera i kolumna idempotency_key.'],
    ['docker-compose.yml, .config/prometheus.yml', 'PostgreSQL, MailHog, ntfy i Prometheus; konfiguracja scrapowania.'],
  ], [4200, 5100]);
  p('NotificationsModule rejestruje encję, repozytorium, serwisy, dwa kontrolery, filtr błędów i worker; AppModule importuje go obok modułów produktów. Moduł nie zależy od produktów: komunikuje się z innymi częściami aplikacji wyłącznie przez wspólną infrastrukturę (baza, konfiguracja, OpenAPI).');

  // 2. Interaktywna dokumentacja.
  h('2. Interaktywna dokumentacja', 1, true);
  p('Swagger UI generowany przez @nestjs/swagger opisuje endpointy, parametry, modele i kody odpowiedzi. Przycisk Try it out pozwala wypełnić żądanie, a Execute wysyła je do działającego serwera. Zgodnie z wymaganiem dokumentacja ma podstrony dla poszczególnych obszarów aplikacji.');
  table(['Adres', 'Zawartość'], [
    ['http://127.0.0.1:8000/docs', 'Pełna dokumentacja: produkty, historia produktów, powiadomienia i /metrics.'],
    ['http://127.0.0.1:8000/products-docs', 'Tylko produkty i historia produktów.'],
    ['http://127.0.0.1:8000/notifications-docs', 'Tylko powiadomienia (7 operacji, w tym /metrics).'],
  ], [4000, 5300]);
  p('Każda podstrona to osobny dokument OpenAPI. OpenApiService.publish() buduje dokument z opcją include, która ogranicza go do wskazanych modułów NestJS, i publikuje go pod osobną ścieżką. Kontrolery mają tagi (products, notifications), więc operacje są pogrupowane w sekcje.');
  p('Etykieta wersji widoczna obok tytułu („2.1”) pochodzi z wywołania setVersion() i nie została zaktualizowana po etapie 2.1; nie wpływa na treść dokumentacji.');
  await shot('docs-notifications', 'Podstrona /notifications-docs - operacje modułu powiadomień i ich schematy.', 520);
  await shot('docs-products', 'Podstrona /products-docs - wyłącznie endpointy produktów i historii.', 470);
  p(`Zrzuty w dalszej części wykonano ${captureDate} w Swagger UI, w przeglądarce sterowanej skryptem capture-evidence.cjs. Aplikacja działała na porcie 8000 z workerem co 5 s, na osobnej bazie tymczasowej z migracjami (${evidence.database}), usuniętej po zakończeniu. Ilustracje łączą nagłówek operacji z wykonaną odpowiedzią; nie zmieniano treści odpowiedzi.`);

  // 3. Moduł planowania i obsługi powiadomień.
  h('3. Moduł planowania i obsługi powiadomień', 1, true);
  h('3.1. Implementacja w architekturze warstwowej');
  await image(path.join(assets, 'architecture.png'), 'Warstwy modułu powiadomień i przepływ wysyłki.', 330);
  table(['Warstwa / element', 'Odpowiedzialność'], [
    ['NotificationsController', 'Obsługa HTTP: POST/GET /notifications, GET /{id}, PATCH /{id}/status, POST /{id}/send-now, POST /process-ready. Brak logiki biznesowej.'],
    ['DTO i pipes', 'NotificationCreateDto sprawdza typy, enum kanału i format ISO 8601 daty; nieznane pola są odrzucane. NotificationIdPipe sprawdza ID. Błąd: 400.'],
    ['NotificationsService', 'Walidacja domenowa (422), konwersja do UTC, maszyna stanów, transakcje z blokadą wiersza, wykonanie wysyłki, idempotencja i metryki.'],
    ['NotificationsRepository', 'Zapytania TypeORM: zapis i odczyt, SELECT … FOR UPDATE (także SKIP LOCKED), rekordy gotowe do wysyłki, GROUP BY do metryk.'],
    ['Dispatcher i DeliveryService', 'Wybór kanału i techniczna wysyłka do MailHog (SMTP) lub ntfy (HTTP).'],
    ['NotificationWorker', 'Cykliczne wywołanie processReady() w tle aplikacji.'],
    ['NotificationExceptionFilter', 'Mapowanie błędów domenowych: walidacja i niedozwolone przejście 422, konflikt klucza 409, brak rekordu 404.'],
  ], [2800, 6500]);
  p('Przykładowo POST /api/v1/notifications przechodzi przez walidację DTO, NotificationsService.create() (reguły, konwersja czasu, status PENDING, klucz idempotencji) i NotificationsRepository.create(). Serwis nie zna protokołu HTTP: rzuca błędy domenowe, które filtr tłumaczy na kody odpowiedzi.');

  h('3.2. Maszyna stanów', 2, true);
  await image(path.join(assets, 'state-machine.png'), 'Dozwolone przejścia statusu powiadomienia.', 300);
  p('Powiadomienie po utworzeniu ma status PENDING. Tylko z tego stanu możliwe jest przejście: do SENT po udanej wysyłce, do FAILED po nieudanej lub do CANCELLED na żądanie klienta. SENT, FAILED i CANCELLED są stanami końcowymi. Definicja jest jedną tabelą przejść, z której korzystają wszystkie ścieżki zmiany statusu:');
  code(blocks('backend/src/features/notifications/notification-state-machine.ts', 'export const ALLOWED_TRANSITIONS', 'export function canTransition'));

  h('3.2.1. Stany dozwolone oraz zabezpieczenia przed stanami niedozwolonymi', 3);
  table(['Zabezpieczenie', 'Działanie'], [
    ['canTransition() w serwisie', 'PATCH /{id}/status i wykonanie wysyłki sprawdzają przejście; niedozwolone kończy się 422 („Transition from X to Y is not allowed”).'],
    ['Blokada wiersza', 'Sprawdzenie i zapis statusu odbywają się w transakcji z SELECT … FOR UPDATE, więc dwa żądania nie opuszczą stanu PENDING jednocześnie.'],
    ['send-now tylko dla PENDING', 'Ponowna wysyłka lub wysyłka anulowanego powiadomienia kończy się 422 bez kontaktu z MailHog/ntfy.'],
    ['Worker', 'Pomija wiersze zablokowane przez inne żądanie (SKIP LOCKED) i ponownie sprawdza status PENDING po zablokowaniu.'],
    ['DTO', 'Status spoza enum (np. DONE) jest odrzucany jako 400 przed logiką biznesową.'],
    ['Baza danych', 'CHECK status IN (PENDING, SENT, FAILED, CANCELLED) i CHECK dla kanału blokują nieznane wartości także poza aplikacją.'],
  ], [3000, 6300]);
  p(`Na zrzutach: powiadomienie id=${n('05-patch-cancelled').id} zaplanowane na 2027 r. zostało anulowane (200), a próba ustawienia SENT ze stanu końcowego CANCELLED zakończyła się 422. Ostatni zrzut pokazuje send-now dla powiadomienia id=${sched.pushId}, wysłanego już wcześniej przez worker.`);
  await shot('05-patch-cancelled', 'PATCH /{id}/status - HTTP 200, przejście PENDING → CANCELLED.', 330);
  await shot('06-patch-final-422', 'PATCH /{id}/status - HTTP 422, ze stanu CANCELLED nie ma przejść.', 230);
  await shot('07-send-now-not-pending-422', 'POST /{id}/send-now - HTTP 422, wysłać można tylko powiadomienie PENDING.', 230);

  h('3.3. Kanały komunikacji', 2, true);
  p('Kanał wybiera dispatcher na podstawie pola channel. Dodanie kolejnego kanału wymaga rozszerzenia enum, dispatcher’a i serwisu wysyłki; switch z typem never sprawia, że kompilator wskaże nieobsłużony kanał.');
  p('Wynik wysyłki zapisuje NotificationsService.execute(): po udanym dispatch() status SENT, po wyjątku (np. błąd sieci, odpowiedź ntfy inna niż 2xx, przekroczenie 5 s) status FAILED i wpis w logu. Zapis następuje w tej samej transakcji, w której wiersz jest zablokowany.');

  h('3.3.1. Powiadomienia PUSH', 3, true);
  h('3.3.1.1. Opis implementacji', 3);
  p('Dla kanału PUSH pole recipient jest nazwą topicu ntfy. Wysyłka to żądanie HTTP POST na adres NTFY_URL/<topic> z treścią w body. Adres ntfy pochodzi z konfiguracji (domyślnie http://localhost:8088), a żądanie ma limit 5 s.');
  code(block('backend/src/features/notifications/notification-delivery.service.ts', 'async sendPush(notification: Notification)', { leading: 1 }));
  h('3.3.1.2. ntfy - opis aplikacji i dostarczone powiadomienie', 3);
  p('ntfy to otwarty system powiadomień push typu publish/subscribe oparty na HTTP. Nadawca publikuje wiadomość żądaniem POST na topic, a subskrybenci (aplikacja mobilna, przeglądarka) otrzymują ją przez WebSocket lub Server-Sent Events [1]. W projekcie działa lokalnie w Dockerze (obraz binwiederhier/ntfy, port 8088), więc nie wymaga zewnętrznych usług.');
  p(`Powiadomienie PUSH utworzono w Swaggerze z czasem lokalnym ${sched.local.replace('T', ' ')} w strefie Europe/Warsaw, czyli 25 s po wysłaniu żądania. Serwer zapisał je jako ${fmtUtc(sched.utc)} ze statusem PENDING. Worker wysłał je bez dodatkowych wywołań; odczyt po terminie pokazuje status SENT, a wiadomość jest widoczna na topicu ${evidence.topic}.`);
  await shot('01-post-push-scheduled', 'POST /api/v1/notifications - HTTP 201, zaplanowane powiadomienie PUSH w statusie PENDING.', 330);
  await shot('03-get-push-sent', 'GET /api/v1/notifications/{id} po terminie - status SENT nadany przez worker.', 330);
  await shot('ntfy-topic', `Interfejs webowy ntfy - dostarczone powiadomienie na topicu ${evidence.topic}.`, 360);

  h('3.3.2. Powiadomienia Email', 3, true);
  h('3.3.2.1. Opis implementacji', 3);
  p('Dla kanału EMAIL serwis korzysta z biblioteki nodemailer i protokołu SMTP. Transport jest konfigurowany przy starcie modułu (SMTP_HOST, SMTP_PORT, MAIL_FROM) z limitami czasu połączenia; temat wiadomości to Notification, a treść jest zwykłym tekstem.');
  code(block('backend/src/features/notifications/notification-delivery.service.ts', 'async sendEmail(notification: Notification)'));
  h('3.3.2.2. MailHog - opis aplikacji i dostarczone powiadomienie', 3);
  p('MailHog to narzędzie programistyczne emulujące serwer SMTP. Przechwytuje wysyłane wiadomości zamiast przekazywać je do prawdziwych skrzynek i udostępnia je w interfejsie webowym oraz przez API [2]. W projekcie przyjmuje pocztę na porcie 1025, a interfejs działa pod http://localhost:8025.');
  p(`Powiadomienie EMAIL utworzono w tym samym żądaniu czasowym co PUSH (id=${sched.emailId}). Worker wysłał je w tym samym przebiegu; w MailHog widać wiadomość od noreply@ztp.local do ${n('02-post-email-scheduled').recipient} z treścią powiadomienia.`);
  await shot('02-post-email-scheduled', 'POST /api/v1/notifications - HTTP 201, zaplanowane powiadomienie EMAIL.', 330);
  await shot('04-get-email-sent', 'GET /api/v1/notifications/{id} po terminie - status SENT.', 330);
  await shot('mailhog-message', 'MailHog - wiadomość dostarczona przez worker.', 360);

  h('3.4. Worker cykliczny', 2, true);
  p('Worker realizuje zaplanowane powiadomienia bez udziału klienta. Co NOTIFICATION_WORKER_INTERVAL_MS (domyślnie 5000 ms) pobiera rekordy PENDING z scheduled_at ≤ bieżący czas UTC i wykonuje je po kolei. Endpoint POST /process-ready uruchamia ten sam kod na żądanie.');
  p('Worker działa w tym samym procesie co serwer HTTP, jako provider NestJS. onApplicationBootstrap() uruchamia go po inicjalizacji aplikacji, a pętla oparta na setTimeout nie blokuje obsługi żądań: Node.js przeplata przebiegi workera z requestami w jednej pętli zdarzeń. Kolejny przebieg jest planowany dopiero po zakończeniu poprzedniego, więc przebiegi się nie nakładają. Przy zamykaniu aplikacji onModuleDestroy() zatrzymuje pętlę i czeka na trwający przebieg, zanim zamknięte zostanie połączenie z bazą.');
  p('processReady() wykonuje każde powiadomienie w osobnej transakcji. Wiersz jest blokowany z opcją SKIP LOCKED: jeśli w tym samym czasie obsługuje go send-now, worker go pomija, a po zablokowaniu ponownie sprawdza status PENDING. Dzięki temu jedno powiadomienie nie zostanie wysłane dwa razy.');
  p(`Fragment logu aplikacji z przebiegu, w którym wykonano zrzuty (czas UTC). Powiadomienia ${sched.pushId} i ${sched.emailId} miały termin ${fmtUtc(sched.utc)}; kolejne pochodzą z danych przykładowych z punktu 4, w tym jedno nieudane (niepoprawny topic ntfy).`);
  code(workerLines.slice(0, 9).map(logLine).join('\n'));

  h('3.5. Planowanie czasowe z konwersją do UTC', 2, true);
  p('Klient podaje scheduledAt w formacie ISO 8601 oraz nazwę strefy IANA w polu timezone. Wartość bez przesunięcia jest traktowana jako czas lokalny we wskazanej strefie; wartość z przesunięciem (np. Z) oznacza konkretny moment, którego strefa nie przesuwa. Serwis sprawdza strefę, przelicza czas do UTC biblioteką Luxon i odrzuca moment, który nie leży w przyszłości. W bazie kolumna scheduled_at ma typ TIMESTAMPTZ i przechowuje czas już po konwersji, a timezone zapamiętuje strefę klienta.');
  code(blocks('backend/src/features/notifications/notification-time.ts', 'export function isValidTimezone', 'export function toUtc('));
  table(['Wejście (scheduledAt, timezone)', 'Zapisane scheduledAt', 'Wynik'], [
    [`${sched.local}, Europe/Warsaw`, sched.utc, '201 - czas lokalny zimą (UTC+1)'],
    [`${cases['08-post-utc-offset'].requestBody.scheduledAt}, Asia/Tokyo`, n('08-post-utc-offset').scheduledAt, '201 - oznaczenie Z, strefa nie przesuwa momentu'],
    [`${cases['09-post-past-422'].requestBody.scheduledAt}, Europe/Warsaw`, '-', `422 - ${n('09-post-past-422').message}`],
    ['dowolny, Mars/Base', '-', '422 - niepoprawna strefa IANA'],
    ['jutro, Europe/Warsaw', '-', '400 - format inny niż ISO 8601'],
  ], [3700, 2900, 2700]);
  p('Wspólny punkt odniesienia upraszcza planowanie: worker porównuje scheduled_at z bieżącym czasem UTC jednym zapytaniem, niezależnie od stref klientów. Ta sama godzina 09:00 w Warszawie daje 08:00 UTC zimą i 07:00 UTC latem, co potwierdziły scenariusze manualne TC-2.1-04 i TC-2.1-05.');
  await shot('08-post-utc-offset', 'POST - czas z oznaczeniem Z zapisany bez przesunięcia, mimo strefy Asia/Tokyo.', 330);
  await shot('09-post-past-422', 'POST - HTTP 422, planowany moment musi leżeć w przyszłości.', 230);

  h('3.6. Idempotencja', 2, true);
  p('Idempotencja pozwala bezpiecznie ponowić żądanie, np. po przekroczeniu czasu połączenia, gdy klient nie wie, czy pierwsze zostało przetworzone. Zgodnie z instrukcją model ma pole idempotency_key - unikalne i wymagane - a serwer generuje je przy tworzeniu powiadomienia i zwraca w odpowiedzi. Klucza nie ma w danych wejściowych: próba przesłania go w body kończy się 400.');
  code(block('backend/src/features/notifications/notifications.service.ts', 'export function generateIdempotencyKey'));
  p('Sam klucz generowany po stronie serwera nie rozpoznaje jednak ponowionego żądania, bo każde żądanie dostaje nowy klucz. Dlatego klient może przekazać własny klucz w nagłówku Idempotency-Key. Jeśli istnieje już powiadomienie z tym kluczem i takimi samymi danymi, serwer zwraca je z kodem 200 i nagłówkiem Idempotent-Replayed: true, zamiast tworzyć drugie. Ten sam klucz z innymi danymi daje 409. Równoczesne żądania rozstrzyga ograniczenie UNIQUE w bazie.');
  p('Kolumnę idempotency_key dodaje osobna migracja, która nadaje klucze istniejącym rekordom, aby kolumna mogła być wymagana także w bazie z wcześniejszymi danymi.');
  p(`Na zrzutach to samo żądanie wysłano dwukrotnie z nagłówkiem Idempotency-Key: ${cases['10-post-key-201'].headers['Idempotency-Key']}. Pierwsze utworzyło powiadomienie id=${n('10-post-key-201').id} (201), drugie zwróciło to samo id (200, nagłówek idempotent-replayed). Trzecie, z tym samym kluczem i inną treścią, zakończyło się 409. W żądaniach bez nagłówka serwer generuje klucz notif_…, jak na zrzucie z punktu 3.3.1.2.`);
  await shot('10-post-key-201', 'POST z nagłówkiem Idempotency-Key - HTTP 201, utworzone powiadomienie.', 330);
  await shot('11-post-key-replay-200', 'Ponowienie tego samego żądania - HTTP 200, to samo id, nagłówek idempotent-replayed: true.', 420);
  await shot('12-post-key-conflict-409', 'Ten sam klucz z inną treścią - HTTP 409.', 230);

  // 4. Prometheus.
  h('4. Prometheus - metryki i statystyki', 1, true);
  p('Prometheus to system monitorowania, który cyklicznie pobiera (scrape) metryki z aplikacji w modelu pull i zapisuje je w bazie szeregów czasowych. Pozwala to analizować zmiany wartości w czasie zapytaniami PromQL oraz na wykresach [3]. Aplikacja udostępnia metryki w formacie tekstowym Prometheus pod adresem GET /metrics [4].');
  table(['Metryka', 'Znaczenie'], [
    ['notifications_sent_total', 'Liczba powiadomień w statusie SENT.'],
    ['notifications_failed_total', 'Liczba powiadomień w statusie FAILED.'],
    ['notifications_pending_total', 'Liczba powiadomień oczekujących (PENDING).'],
    ['notifications_cancelled_total', 'Liczba powiadomień anulowanych.'],
    ['notifications_by_channel{status, channel}', 'Liczba powiadomień dla każdej pary status × kanał (8 serii, także z wartością 0).'],
  ], [4000, 5300]);
  p('Wszystkie metryki są typu gauge i odzwierciedlają bieżący stan tabeli. Serwis pobiera je jednym zapytaniem GROUP BY status, channel i składa tekst w formacie Prometheus. Endpoint jest wyłączony z prefiksu /api/v1, aby znajdował się pod domyślną ścieżką scrapowania Prometheusa.');
  p('Usługę Prometheusa przeniesiono z docker-compose.yml etapu 2.3; dodano extra_hosts, aby adres host.docker.internal działał także na Linuksie. Plik .config/prometheus.yml pochodzi z etapu 2.3 i różni się tylko nazwą joba. Prometheus co 5 s pobiera /metrics z aplikacji działającej na hoście na porcie 8000; interfejs jest dostępny pod http://localhost:9090.');
  code(excerpt('.config/prometheus.yml', 'global:', 'targets:', { dedent: false }));
  p(`Do obserwacji metryk służy skrypt npm run notifications:seed, który tworzy przez API przykładowe powiadomienia: pięć z terminem za 10-35 s, jedno PUSH na niepoprawny topic (kończy się FAILED), jedno na za godzinę i jedno anulowane. Wysyła też jedno żądanie dwukrotnie z tym samym kluczem idempotencji (201, potem 200).`);
  await shot('13-get-metrics', 'GET /metrics w Swaggerze - metryki po przetworzeniu danych przykładowych przez worker.', 470);
  await shot('prom-targets', 'Prometheus → Status → Targets: cel nestjs_notifications w stanie UP.', 230);
  await shot('prom-table-by-channel', 'Zapytanie notifications_by_channel, zakładka Table - 8 serii status × kanał.', 430);
  await shot('prom-graph-totals', 'Wykres sum według statusu w czasie przebiegu: PENDING rośnie po seedzie i maleje, gdy worker wysyła powiadomienia.', 470);
  await shot('prom-graph-by-channel', 'Wykres notifications_by_channel - te same zmiany w podziale na kanały EMAIL i PUSH.', 500);
  p(`Wykresy obejmują wyłącznie przebieg, w którym wykonano zrzuty (okno ${evidence.prometheusRange}). Po utworzeniu dwóch zaplanowanych powiadomień PENDING wynosi 2, a po ich wysyłce spada do 0. Seed podnosi PENDING do 9; worker co 5 s wysyła kolejne rekordy, więc PENDING maleje, a SENT rośnie do ${metric('notifications_sent_total')}. Jedno PUSH kończy się FAILED, a dwa powiadomienia są anulowane. Stan końcowy:`);
  table(['Status', 'EMAIL', 'PUSH', 'Razem'], ['PENDING', 'SENT', 'FAILED', 'CANCELLED'].map((status) => {
    const value = (channel) => byChannel.find(([s, c]) => s === status && c === channel)[2];
    return [status, value('EMAIL'), value('PUSH'), metric(`notifications_${status.toLowerCase()}_total`)];
  }), [2700, 2200, 2200, 2200]);
  p('Wartości w Prometheusie są zgodne z odpowiedzią /metrics; zgodność wszystkich serii z kroku 5 instrukcji oraz zmianę metryk po dodaniu i anulowaniu powiadomienia (krok 7) sprawdzono w scenariuszach TC-2.3-10 i TC-2.3-11.');

  // Bibliography: a bullet list of links only.
  h('Bibliografia', 1, true);
  for (const [label, url] of [
    ['[1] ntfy - dokumentacja', 'https://docs.ntfy.sh/'],
    ['[2] MailHog - repozytorium projektu', 'https://github.com/mailhog/MailHog'],
    ['[3] Prometheus - Overview', 'https://prometheus.io/docs/introduction/overview/'],
    ['[4] Prometheus - Exposition formats', 'https://prometheus.io/docs/instrumenting/exposition_formats/'],
    ['[5] NestJS - OpenAPI (Swagger)', 'https://docs.nestjs.com/openapi/introduction'],
  ]) bibliography(label, url);

  const doc = new Document({
    title: 'Sprawozdanie Projekt 2 - System planowania i obsługi powiadomień',
    subject: 'NestJS, powiadomienia, maszyna stanów, UTC, MailHog, ntfy, worker, idempotencja, Prometheus',
    creator: '', description: 'Sprawozdanie opracowane na podstawie projektu ZTP.',
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 23, color: '243B50' }, paragraph: { spacing: { line: 280, after: 115 } } },
        heading1: { run: { font: 'Calibri', size: 36, bold: true, color: navy }, paragraph: { spacing: { before: 120, after: 180 }, keepNext: true } },
        heading2: { run: { font: 'Calibri', size: 29, bold: true, color: navy }, paragraph: { spacing: { before: 170, after: 140 }, keepNext: true } },
        heading3: { run: { font: 'Calibri', size: 24, bold: true, color: teal }, paragraph: { spacing: { before: 130, after: 100 }, keepNext: true } },
      },
    },
    sections: [{
      properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 1000, right: 1000, header: 430, footer: 430 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20, color: gray })] })] }) },
      children,
    }],
  });
  // REPORT_OUTPUT lets you build a copy elsewhere, e.g. while the document is open in Word.
  const output = process.env.REPORT_OUTPUT ?? path.join(__dirname, 'Piotr_Zietek_SiRR_nst_sprawozdanie_projekt_2.docx');
  fs.writeFileSync(output, await Packer.toBuffer(doc));
  console.log(JSON.stringify({ output, figures: figureNo, paragraphs: children.filter((c) => c instanceof Paragraph).length, bytes: fs.statSync(output).size }));
})().catch((e) => { console.error(e); process.exitCode = 1; });
