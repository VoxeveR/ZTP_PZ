const fs = require('node:fs');
const path = require('node:path');
const deps = path.join(process.env.TEMP, 'ztp-report-tools', 'node_modules');
const sharp = require(path.join(deps, 'sharp'));
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  HeadingLevel, AlignmentType, WidthType, Header, Footer, PageNumber,
  ExternalHyperlink, BorderStyle, ShadingType, VerticalAlign,
} = require(path.join(deps, 'docx'));
const root = path.resolve(__dirname, '..', '..', '..');
const assets = path.join(__dirname, 'assets');
const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, 'evidence.json'), 'utf8'));
const cases = Object.fromEntries(evidence.cases.map(c=>[c.key,c]));
const history = JSON.parse(fs.readFileSync(path.join(__dirname, 'history-example.json'), 'utf8'));
const navy='17324D', teal='007F87', gray='536375', light='F0F5F8';
const children=[];
let figureNo=0;
const textRun=(text, options={})=>new TextRun({text,...options});
function p(text, options={}) {
  const para=new Paragraph({children:Array.isArray(text)?text:[textRun(text)],spacing:{after:115,line:280},...options});
  children.push(para); return para;
}
function h(text, level=2, page=false) {
  return p(text,{heading:level===1?HeadingLevel.HEADING_1:level===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3,
    pageBreakBefore:page, keepNext:true,spacing:{before:level===1?100:160,after:150}});
}
function code(text) {
  const lines=text.trim().split('\n');
  lines.forEach((line,index)=>p([textRun(line,{font:'Consolas',size:17,color:'20384D'})],{
    shading:{type:ShadingType.CLEAR,fill:light},indent:{left:130,right:80},
    spacing:{after:0,before:0,line:215},keepNext:index<lines.length-1,
  }));
  p('',{spacing:{after:50,line:100}});
}
function table(headers, rows, widths) {
  const all=[headers,...rows];
  children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},
    columnWidths:widths,
    borders:{top:{style:BorderStyle.SINGLE,size:4,color:'D5DFE5'},bottom:{style:BorderStyle.SINGLE,size:4,color:'D5DFE5'},
      left:{style:BorderStyle.SINGLE,size:4,color:'D5DFE5'},right:{style:BorderStyle.SINGLE,size:4,color:'D5DFE5'},
      insideHorizontal:{style:BorderStyle.SINGLE,size:3,color:'D5DFE5'},insideVertical:{style:BorderStyle.SINGLE,size:3,color:'D5DFE5'}},
    rows:all.map((row,i)=>new TableRow({tableHeader:i===0,cantSplit:true,children:row.map((cell,j)=>new TableCell({
      width:widths?{size:widths[j],type:WidthType.DXA}:undefined,
      verticalAlign:VerticalAlign.CENTER,
      margins:{top:95,bottom:95,left:115,right:115},
      shading:{type:ShadingType.CLEAR,fill:i===0?navy:(i%2===0?'F4F7F9':'FFFFFF')},
      children:[new Paragraph({children:[textRun(String(cell),{size:20,bold:i===0,color:i===0?'FFFFFF':'243B50'})],spacing:{after:0,line:245}})],
    }))})),
  }));
  p('',{spacing:{after:30,line:100}});
}
async function image(file, caption, maxHeight=390, maxWidth=640) {
  const data=fs.readFileSync(file);
  const meta=await sharp(data).metadata();
  const scale=Math.min(maxWidth/meta.width,maxHeight/meta.height);
  p([new ImageRun({data,type:'png',transformation:{width:Math.round(meta.width*scale),height:Math.round(meta.height*scale)},
    altText:{title:caption,description:caption,name:path.basename(file)}})],{alignment:AlignmentType.CENTER,keepNext:true,spacing:{after:65}});
  p(`Rysunek ${++figureNo}. ${caption}`,{alignment:AlignmentType.CENTER,spacing:{after:155,line:240},
    children:[textRun(`Rysunek ${figureNo}. ${caption}`,{size:18,italics:true,color:gray})]});
}
async function caseFigure(key, caption, maxHeight=345) {
  await image(path.join(__dirname,cases[key].image),caption,maxHeight);
}
function source(text) {p(`Kod źródłowy: ${text}`,{children:[textRun(`Kod źródłowy: ${text}`,{size:18,color:gray})],spacing:{after:120,line:235}});}
function link(label,url) {p([new ExternalHyperlink({link:url,children:[textRun(label,{style:'Hyperlink',size:21})]}),textRun(` — ${url}`,{size:19,color:gray})]);}
const xmlEscape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

async function diagrams() {
  const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'database-schema.json'),'utf8'));
  function type(c) {
    if(c.data_type==='character varying')return `VARCHAR(${c.character_maximum_length})`;
    if(c.data_type==='numeric')return `NUMERIC(${c.numeric_precision},${c.numeric_scale})`;
    if(c.data_type==='timestamp with time zone')return 'TIMESTAMPTZ';
    return c.udt_name==='int4'?'INTEGER':c.data_type.toUpperCase();
  }
  function entity(name,x,y,w,pk,fk) {
    const cols=schema.filter(c=>c.table_name===name);
    const height=78+cols.length*48;
    return `<rect x="${x}" y="${y}" width="${w}" height="${height}" rx="12" fill="#fff" stroke="#96AABB" stroke-width="2"/>
      <path d="M${x+12},${y} H${x+w-12} Q${x+w},${y} ${x+w},${y+12} V${y+61} H${x} V${y+12} Q${x},${y} ${x+12},${y}" fill="#17324D"/>
      <text x="${x+20}" y="${y+40}" fill="white" font-size="29" font-weight="700">${name}</text>
      ${cols.map((c,i)=>`<text x="${x+20}" y="${y+100+i*48}" font-size="23" fill="#243B50">${pk===c.column_name?'PK ':fk===c.column_name?'FK ':'   '}${c.column_name}</text>
        <text x="${x+w-18}" y="${y+100+i*48}" text-anchor="end" font-size="21" fill="#536375">${type(c)}</text>`).join('')}`;
  }
  const erd=`<svg xmlns="http://www.w3.org/2000/svg" width="1460" height="1160" viewBox="0 0 1460 1160">
    <rect width="1460" height="1160" fill="#F6F9FB"/>
    <g font-family="Arial, sans-serif">
    <text x="55" y="58" font-size="32" font-weight="700" fill="#17324D">Schemat ERD — tabele aplikacji</text>
    ${entity('categories',55,115,570,'id')}
    ${entity('products',835,115,570,'id','category_id')}
    ${entity('forbidden_product_names',55,690,570,'id')}
    ${entity('product_history',835,690,570,'id')}
    <path d="M625 260 H835 M644 244 V276 M654 244 V276 M813 260 L835 244 M813 260 L835 276" fill="none" stroke="#007F87" stroke-width="4"/>
    <text x="675" y="235" font-size="22" fill="#007F87">1 : N</text>
    <text x="640" y="310" font-size="19" fill="#536375">category_id</text>
    <text x="640" y="338" font-size="19" fill="#536375">FK / RESTRICT</text>
    <path d="M1120 433 V690" fill="none" stroke="#B57B2E" stroke-width="4" stroke-dasharray="12 10"/>
    <rect x="925" y="515" width="390" height="80" rx="8" fill="#FFF6E6"/>
    <text x="1120" y="546" text-anchor="middle" font-size="22" fill="#885D22">products.id = product_history.product_id</text>
    <text x="1120" y="576" text-anchor="middle" font-size="22" fill="#885D22">Powiązanie logiczne, bez FK</text>
    <text x="55" y="1085" font-size="22" fill="#536375">PK — klucz główny. Wszystkie pokazane kolumny mają NOT NULL.</text>
    <text x="55" y="1121" font-size="22" fill="#536375">Wygenerowano z information_schema po wykonaniu migracji projektu.</text>
    </g></svg>`;
  fs.writeFileSync(path.join(assets,'erd.svg'),erd);
  await sharp(Buffer.from(erd)).png().toFile(path.join(assets,'erd.png'));
  const labels=[['Klient / Swagger','żądanie HTTP'],['Kontroler + DTO','routing i walidacja'],['Serwis','reguły i transakcje'],['Repozytorium','zapytania TypeORM'],['PostgreSQL','dane i ograniczenia']];
  const flow=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="280"><rect width="1400" height="280" fill="white"/><g font-family="Arial, sans-serif">${labels.map((a,i)=>{const x=12+i*279;return `<rect x="${x}" y="48" width="252" height="125" rx="12" fill="${i===2?'#E2F2F1':'#F0F5F8'}" stroke="#A1B5C3"/><text x="${x+126}" y="99" text-anchor="middle" fill="#17324D" font-size="24" font-weight="bold">${a[0]}</text><text x="${x+126}" y="137" text-anchor="middle" fill="#536375" font-size="20">${a[1]}</text>${i<4?`<path d="M${x+254} 110 H${x+277} l-9 -8 m9 8 l-9 8" stroke="#007F87" stroke-width="3" fill="none"/>`:''}`}).join('')}<text x="700" y="230" text-anchor="middle" font-size="23" fill="#536375">Odpowiedź wraca przez te same warstwy do klienta.</text></g></svg>`;
  await sharp(Buffer.from(flow)).png().toFile(path.join(assets,'architecture.png'));
}

(async()=>{
  await diagrams();
  p('SPRAWOZDANIE',{alignment:AlignmentType.CENTER,spacing:{before:850,after:160},children:[textRun('SPRAWOZDANIE',{bold:true,size:30,color:teal})]});
  p('Projekt 1',{alignment:AlignmentType.CENTER,spacing:{after:170},children:[textRun('Projekt 1',{bold:true,size:58,color:navy})]});
  p('Aplikacja do zarządzania\nproduktami (CRUD)',{alignment:AlignmentType.CENTER,spacing:{after:220},children:[textRun('Aplikacja do zarządzania',{bold:true,size:36,color:navy}),new TextRun({break:1}),textRun('produktami (CRUD)',{bold:true,size:36,color:navy})]});
  p('NestJS • TypeScript • TypeORM • PostgreSQL',{alignment:AlignmentType.CENTER,children:[textRun('NestJS • TypeScript • TypeORM • PostgreSQL',{size:24,color:gray})],spacing:{after:750}});
  table(['Dane autora','Do uzupełnienia'],[['Numer albumu','........................................................'],['Imię','........................................................'],['Nazwisko','........................................................'],['Grupa','........................................................']],[2800,6500]);
  p('Zakres: etapy 1.1–1.3 — CRUD, walidacja, historia zmian i testy integracyjne.',{alignment:AlignmentType.CENTER,spacing:{before:220,after:160}});
  p('Data opracowania: 24.10.2026',{alignment:AlignmentType.CENTER,children:[textRun('Data opracowania: 24.10.2026',{size:21,color:gray})]});

  h('1. Wstęp',1,true);
  p('Celem projektu jest udostępnienie REST API do zarządzania produktami przypisanymi do kategorii. Aplikacja pozwala pobierać, tworzyć, zastępować, częściowo aktualizować i usuwać produkty. Kontroluje poprawność danych, zapisuje trwałą historię zmian i jest weryfikowana testami integracyjnymi z rzeczywistą bazą PostgreSQL.');
  p('Implementacja została wykonana w NestJS i TypeScript z użyciem TypeORM. FastAPI pojawia się w materiałach laboratoryjnych oraz w dostarczonych przykładach Python, ale nie jest frameworkiem opisywanego backendu. Punkt 1.3 przedstawia krótką charakterystykę FastAPI i odnosi ją do zastosowanej technologii.');
  h('1.1. Struktura projektu');
  table(['Katalog / plik','Odpowiedzialność'],[
    ['backend/src/main.ts','Uruchomienie aplikacji i nasłuchiwanie HTTP. Domyślnie 127.0.0.1:8000.'],
    ['backend/src/app.ts, app.module.ts','Utworzenie aplikacji, prefiks api/v1, CORS, walidacja body oraz połączenie modułów.'],
    ['backend/src/features/products','CRUD, walidacja biznesowa, DTO, encja produktu, repozytorium, snapshot i dokumentacja endpointów produktów.'],
    ['backend/src/features/categories','Encja i DTO kategorii oraz własny moduł, serwis i repozytorium. Lookup kategorii wspiera walidację produktu.'],
    ['backend/src/features/product-history','Osobny kontroler, serwis, repozytorium, encja, DTO i opis OpenAPI historii produktu.'],
    ['backend/src/infrastructure','Wspólna konfiguracja bazy i migracje, obsługa HTTP, OpenAPI oraz cykl życia aplikacji.'],
    ['backend/test','Testy produktów, historii i zamykania aplikacji; helper tworzący odizolowane bazy testowe.'],
    ['backend/package.json, Dockerfile','Zależności, komendy uruchamiania i testów oraz wieloetapowy obraz aplikacji.'],
    ['docker-compose.yml; katalogi 1.1–1.3','PostgreSQL w Dockerze; oryginalne instrukcje i przykłady laboratoryjne.'],
  ],[3750,5550]);
  p('Podział odpowiada vertical slicing: pliki są grupowane według funkcjonalności. Wewnątrz każdego feature’a pozostaje rozdział odpowiedzialności kontrolera, serwisu i repozytorium. ProductsPersistenceModule eksportuje repozytorium produktów do operacji CRUD i odczytu historii, dzięki czemu moduły nie tworzą cyklicznej zależności.');

  h('1.2. Baza danych',2,true);
  p('Aplikacja korzysta z relacyjnej bazy PostgreSQL 16 uruchamianej przez Docker Compose. Domyślna baza to appdb, a port hosta to 5432. Wolumen pgdata zachowuje dane po ponownym uruchomieniu kontenera. TypeORM łączy aplikację z bazą; synchronize jest wyłączone, a strukturę tworzą wersjonowane migracje uruchamiane przy starcie.');
  table(['Tabela','Kolumny i przeznaczenie'],[
    ['categories','id INTEGER PK; name VARCHAR(100) UNIQUE; min_price i max_price NUMERIC(10,2). Słownik kategorii i dopuszczalnych cen.'],
    ['products','id INTEGER PK; name VARCHAR(20); price NUMERIC(10,2); quantity INTEGER; category_id INTEGER FK. Przechowuje aktualny stan produktu.'],
    ['forbidden_product_names','id INTEGER PK; name VARCHAR(100) UNIQUE. Frazy, których nazwa produktu nie może zawierać. Brak relacji FK z products.'],
    ['product_history','id INTEGER PK; product_id INTEGER; action VARCHAR(10); previous_state i current_state JSONB; changed_at TIMESTAMPTZ. Trwały rejestr zmian.'],
  ],[2500,6800]);
  p('Relacja categories → products ma krotność 1:N. Każdy produkt musi należeć do jednej kategorii. Klucz obcy products.category_id ma ON DELETE RESTRICT, co blokuje usunięcie kategorii używanej przez produkt. Wszystkie kolumny aplikacyjne pokazane na ERD są NOT NULL.');
  p('Pole product_history.product_id stanowi powiązanie logiczne z produktem, ale celowo nie jest kluczem obcym. Dzięki temu historia istnieje także po fizycznym usunięciu produktu. Wartości previous_state i current_state przechowują niezależne dokumenty JSON, obejmujące również dane kategorii z chwili operacji.');
  table(['Kategoria startowa','Cena minimalna','Cena maksymalna'],evidence.categories.map(c=>[c.name,c.min_price,c.max_price]),[3700,2800,2800]);
  p('Dodatkowe zabezpieczenia obejmują CHECK dla nieujemnej ceny i ilości, poprawnego formatu nazwy i widełek kategorii; unikalny indeks lower(products.name); kontrolę rodzaju akcji i obiektowego formatu JSON w historii. Zakazane frazy startowe to fake, illegal i banned.');
  source('src/infrastructure/database/migrations/1790000000000-create-products.ts; 1790000001000-extend-products.ts; 1790000002000-create-product-history.ts.');

  h('1.2.1. Wygenerowany schemat ERD',2,true);
  await image(path.join(assets,'erd.png'),'Schemat czterech tabel aplikacji, wygenerowany z rzeczywistej struktury PostgreSQL po wykonaniu migracji.',560);
  p('Linia ciągła oznacza rzeczywisty klucz obcy categories–products. Linia przerywana oznacza wyłącznie powiązanie logiczne produktów z historią. Tabela forbidden_product_names jest niezależnym słownikiem odczytywanym podczas walidacji.');
  p('Schemat powstał na podstawie information_schema.columns oraz pg_constraint w świeżej bazie z migracjami projektu. Pominięto wewnętrzną tabelę metadanych migracji TypeORM. Indeks product_history_product_changed_idx wspiera filtrowanie po produkcie i sortowanie wpisów od najnowszych.');

  h('1.3. FastAPI i framework zastosowany w projekcie',2,true);
  p('FastAPI jest frameworkiem Python do budowania API. Wykorzystuje adnotacje typów i Pydantic do walidacji oraz opisu danych, a warstwę HTTP opiera na Starlette. Obsługuje kod asynchroniczny, wstrzykiwanie zależności i generowanie specyfikacji OpenAPI. Udostępnia interaktywną dokumentację, m.in. Swagger UI, co ułatwia sprawdzanie endpointów bez osobnego klienta. Źródło: oficjalna dokumentacja FastAPI — Features [1].');
  p('W tym projekcie podobne zadania realizuje NestJS: kontrolery obsługują trasy HTTP, providers i moduły organizują zależności, DTO opisują żądania, a class-validator i class-transformer uczestniczą w walidacji. TypeORM obsługuje PostgreSQL i transakcje. Pakiet @nestjs/swagger generuje OpenAPI na podstawie dekoratorów i wystawia Swagger UI [2].');
  table(['Obszar','Wykorzystane rozwiązanie'],[
    ['Język i środowisko','TypeScript, Node.js; package.json wymaga Node.js ≥ 22.'],
    ['Framework i baza','NestJS 12.x, TypeORM 0.3.x, PostgreSQL 16.'],
    ['Walidacja i dokumentacja','class-validator, class-transformer, @nestjs/swagger.'],
    ['Testy','Wbudowany node:test, node:assert/strict, fetch i rzeczywisty PostgreSQL.'],
  ],[3000,6300]);
  h('2. REST API',1);
  h('2.1. Charakterystyka i zastosowanie REST API');
  p('API udostępnia zasoby przez adresy URL i standardowe metody HTTP. Zasobem jest produkt: kolekcja ma adres /api/v1/products, a pojedynczy produkt /api/v1/products/{id}. Treść żądań i odpowiedzi jest przekazywana jako JSON. Metoda HTTP określa działanie, a kod odpowiedzi informuje klienta o wyniku.');
  p('Takie API może być używane przez interfejs WWW, aplikację mobilną, integrację zewnętrzną lub skrypty automatyzujące. Obecny projekt udostępnia backend i dokumentację Swagger; przyszły klient React może korzystać z tego samego kontraktu. Serwer nie wymaga sesji użytkownika do realizacji opisanych operacji.');

  h('2.2. Przepływ informacji w architekturze N-Layer',2,true);
  await image(path.join(assets,'architecture.png'),'Przepływ żądania i odpowiedzi pomiędzy warstwami aplikacji.',150);
  table(['Warstwa / element','Odpowiedzialność w projekcie'],[
    ['Kontroler HTTP','ProductsController i ProductHistoryController wybierają operację według metody i ścieżki. Odbierają parametry i body, wywołują serwis.'],
    ['DTO i pipes','ProductWriteDto, ProductPatchDto i BodyValidationPipe kontrolują strukturę body. ProductIdPipe sprawdza identyfikator przed konwersją.'],
    ['Serwis aplikacyjny','ProductsService realizuje reguły biznesowe i koordynuje transakcję. CategoriesService udostępnia kategorię, ProductHistoryService obsługuje historię.'],
    ['Repozytorium','ProductsRepository, CategoriesRepository i ProductHistoryRepository wykonują zapytania TypeORM. Korzystają ze wspólnego EntityManager przy zapisie transakcyjnym.'],
    ['Baza danych','PostgreSQL przechowuje rekordy, egzekwuje klucze, indeksy i CHECK oraz zapewnia transakcje i blokady wierszy.'],
    ['Obsługa odpowiedzi i błędów','Snapshot / DTO określają format odpowiedzi. ProductExceptionFilter tłumaczy błędy domenowe na kody HTTP.'],
  ],[2800,6500]);
  p('Przykładowy PATCH przechodzi przez kontroler, kontrolę typów, pobranie produktu z blokadą, walidację nowego pełnego stanu, aktualizację i zapis historii. Odpowiedź wraca do klienta po zatwierdzeniu transakcji.');
  p('Rozdzielenie warstw ułatwia zmianę kontraktu HTTP niezależnie od zapytań SQL, skupia reguły produktu w serwisie i pozwala w testach obserwować cały przepływ. Vertical slicing porządkuje te warstwy według funkcjonalności; nie usuwa podziału odpowiedzialności.');
  source('src/features/products/products.controller.ts, products.service.ts, products.repository.ts; src/features/categories; src/features/product-history.');

  h('2.3. Metody CRUD — implementacja',2,true);
  table(['Metoda i ścieżka','Działanie','Sukces'],[
    ['GET /api/v1/products','Lista produktów z kategoriami; także [] przy braku rekordów.','200'],
    ['GET /api/v1/products/{id}','Odczyt pojedynczego produktu.','200'],
    ['POST /api/v1/products','Utworzenie produktu i wpisu CREATE.','201'],
    ['PUT /api/v1/products/{id}','Pełne zastąpienie edytowalnych pól i wpis REPLACE.','200'],
    ['PATCH /api/v1/products/{id}','Zmiana wskazanych pól i wpis UPDATE.','200'],
    ['DELETE /api/v1/products/{id}','Usunięcie produktu i wpis DELETE.','204'],
    ['GET /api/v1/products/{id}/history','Lista trwałych wpisów historii.','200'],
  ],[3700,4700,900]);
  p('POST i PUT wymagają pól name, price, quantity oraz categoryId. PUT zachowuje identyfikator produktu. PATCH dopuszcza pominięcie pól, ale wymaga co najmniej jednego; jawne null jest odrzucane. Przykładowe poprawne body POST:');
  code(JSON.stringify(cases['02-post-created'].requestBody,null,2));
  p('Repozytorium realizuje odczyt listy z dołączeniem kategorii i uporządkowaniem po id. Przy aktualizacji wykonuje UPDATE, a następnie odczytuje nowy stan, który jest zwracany klientowi i zapisywany w historii:');
  code(`const result = await (manager?.getRepository(Product) ?? this.products)
  .update(id, values);
return result.affected ? this.findById(id, manager) : null;`);
  p('Idempotentny PUT pozostawia tę samą reprezentację produktu po ponowieniu identycznego żądania. Każde udane wywołanie zapisu tworzy jednak własny wpis audytowy. Cena w odpowiedziach jest tekstem z dwiema cyframi po przecinku dziesiętnym, np. "149.90", aby zachować kontrakt dokładnej wartości dziesiętnej PostgreSQL.');
  source('src/features/products/products.controller.ts; products.repository.ts; product-response.dto.ts.');

  h('2.3.1. Zastosowane walidacje',2,true);
  table(['Reguła','Sposób realizacji / wynik błędu'],[
    ['Struktura body','DTO sprawdzają typy i obecność wymaganych pól. whitelist i forbidNonWhitelisted odrzucają nieznane pola. Błąd: 400.'],
    ['Nazwa produktu','Normalizacja NFC; 3–20 liter lub cyfr, także litery polskie. Spacje i znaki specjalne są odrzucane. Błąd reguły: 422.'],
    ['Unikalność nazwy','Porównanie lower(name), z pominięciem własnego id przy edycji. Unikalny indeks chroni także równoczesne zapisy. Błąd: 409.'],
    ['Zakazane frazy','Odczyt forbidden_product_names z bazy; wykrywanie fragmentu nazwy bez rozróżniania wielkości liter. Błąd: 422.'],
    ['Cena','Liczba lub odpowiedni tekst dziesiętny, maksymalnie 2 miejsca dziesiętne; techniczny błąd formatu: 400. Cena musi mieścić się w widełkach kategorii, z uwzględnieniem granic; naruszenie: 422.'],
    ['Stan magazynowy','quantity musi być liczbą całkowitą (błąd typu: 400) w zakresie 0–2147483647 (naruszenie zakresu: 422).'],
    ['Kategoria','categoryId jest liczbą całkowitą 1–2147483647; kategoria musi istnieć. Nieprawidłowy parametr lub brak kategorii: 400.'],
    ['Identyfikator w URL','ProductIdPipe odrzuca np. abc, 1.5, 0, -1, 1e2 i liczby poza zakresem INTEGER. Błąd: 400.'],
    ['PATCH','Brak wszystkich edytowalnych pól: 422. null i nieznane pola: 400. Po scaleniu danych ponownie walidowany jest cały produkt.'],
  ],[2700,6600]);
  p('Rozróżniono walidację techniczną DTO i biznesową w ProductsService.validate(). Przykładowo quantity: "5" jest błędem typu (400), natomiast quantity: -1 narusza regułę domenową (422). Zmiana samej kategorii przez PATCH ponownie sprawdza istniejącą cenę względem nowych widełek.');
  source('product-write.dto.ts; product-patch.dto.ts; product-id.pipe.ts; products.service.ts; infrastructure/http/body-validation.pipe.ts.');

  h('2.3.2. Kody odpowiedzi',2,true);
  table(['Kod HTTP','Znaczenie i przykład w aplikacji'],[
    ['200 OK','Udany GET, PUT lub PATCH oraz odczyt historii.'],
    ['201 Created','Produkt utworzony przez POST; odpowiedź zawiera utworzony obiekt.'],
    ['204 No Content','Udany DELETE; brak treści odpowiedzi.'],
    ['400 Bad Request','Niepoprawny JSON, typ, brak pola, nieznane pole, nieprawidłowy id lub nieistniejąca kategoria.'],
    ['404 Not Found','Brak produktu; dla historii brak zarówno produktu, jak i zapisanych wpisów.'],
    ['409 Conflict','Konflikt unikalnej nazwy produktu, także przy innej wielkości liter.'],
    ['422 Unprocessable Entity','Naruszenie reguły biznesowej: nazwa, zakazana fraza, cena, ilość lub pusty PATCH.'],
    ['500 Internal Server Error','Nieoczekiwany błąd infrastruktury, np. wymuszony w teście błąd zapisu historii; transakcja jest wycofywana.'],
  ],[2250,7050]);
  h('2.4. Dokumentacja interaktywna');
  p('Swagger UI opisuje dostępne operacje, parametry, modele danych i możliwe odpowiedzi. Przycisk Try it out pozwala uzupełnić żądanie, a Execute wysyła je do działającego serwera. Wynik zawiera rzeczywisty kod HTTP i treść odpowiedzi. Dokument jest generowany przez OpenApiService.setup() i dekoratory @nestjs/swagger [2].');
  p('Adres głównej aplikacji: http://127.0.0.1:8000/docs. Specyfikacja OpenAPI JSON: http://127.0.0.1:8000/docs-json. Operacje są pogrupowane jako products i product-history.');
  p(`Zrzuty w dalszej części wykonano 24.10.2026 w rzeczywistym Swagger UI, na osobnej bazie testowej z migracjami i serwerze pod adresem ${evidence.base}. Losowy port umożliwia równoległe działanie głównej aplikacji. Ilustracje zestawiają fragment nagłówka operacji z fragmentem odpowiedzi; pominięto powtarzalny opis schematów i nagłówki HTTP. Treści odpowiedzi nie były zmieniane. Dłuższe listy pokazano częściowo. Baza demonstracyjna została po zakończeniu usunięta.`);

  h('2.4.1. Poprawny odczyt i utworzenie produktu',2,true);
  p('GET zwraca listę startowych produktów. Następnie POST z body z punktu 2.3 tworzy ReportProduct1 z ceną 149.90 i ilością 10.');
  await caseFigure('01-get-products','GET /api/v1/products — HTTP 200, fragment listy produktów z kategorią.',305);
  await caseFigure('02-post-created',`POST /api/v1/products — HTTP 201, utworzony produkt id=${cases['02-post-created'].responseBody.id}.`,335);

  h('2.4.2. Pełna i częściowa aktualizacja',2,true);
  p('PUT przesyła wszystkie cztery wymagane pola i zmienia cenę na 199.90 oraz ilość na 12. Kolejny PATCH przesyła tylko {"quantity": 7}. Odpowiedź PATCH potwierdza pełny stan produktu z nową ilością.');
  await caseFigure('10-put-replaced','PUT /api/v1/products/{id} — HTTP 200, cena 199.90 i ilość 12.',335);
  await caseFigure('11-patch-updated','PATCH /api/v1/products/{id} — HTTP 200, ilość zmieniona z 12 na 7.',335);

  h('2.4.3. Usunięcie i obsługa braku produktu',2,true);
  p('DELETE usuwa produkt i zwraca HTTP 204 bez body. Późniejszy GET dla tego samego id kończy się HTTP 404. Dane usuniętego produktu nadal są dostępne w historii, co pokazano w rozdziale 3.');
  await caseFigure('12-delete-product','DELETE /api/v1/products/{id} — HTTP 204, brak treści odpowiedzi.',260);
  await caseFigure('13-get-deleted-404','GET usuniętego produktu — HTTP 404 z komunikatem o braku produktu.',300);

  h('2.4.4. Walidacja nazwy i ceny',2,true);
  p('Przypadek 1: name = "ab" ma tylko dwa znaki. Przypadek 2: price = "9.99" jest niższa od minimum kategorii Electronics (10.00). Pozostałe pola żądań mają poprawne wartości.');
  await caseFigure('04-post-name-422','POST — HTTP 422, nazwa musi zawierać 3–20 liter lub cyfr.',300);
  await caseFigure('05-post-price-422','POST — HTTP 422, cena poza widełkami kategorii Electronics.',300);

  h('2.4.5. Stan magazynowy i zakazane frazy',2,true);
  p('Przypadek 3: quantity = -1 narusza regułę nieujemnego stanu. Przypadek 4: name = "FakeReport1" zawiera frazę fake zapisaną w bazie. Wielkość liter nie wpływa na wynik kontroli.');
  await caseFigure('06-post-stock-422','POST — HTTP 422, ilość musi należeć do zakresu 0–2147483647.',300);
  await caseFigure('07-post-forbidden-422','POST — HTTP 422, nazwa zawiera zakazaną frazę.',300);

  h('2.4.6. Walidacja techniczna i konflikt nazw',2,true);
  p('Przypadek 5: w body POST pominięto quantity. Przypadek 6: próba utworzenia REPORTPRODUCT1 koliduje z istniejącym ReportProduct1, mimo różnej wielkości liter.');
  await caseFigure('08-post-missing-400','POST — HTTP 400, brak wymaganego pola quantity.',300);
  await caseFigure('09-post-conflict-409','POST — HTTP 409, nazwa produktu już istnieje.',300);

  h('3. Historia zmian',1,true);
  h('3.1. Implementacja i zapis stanów');
  p('Historia stanowi osobny feature product-history. Wpis zawiera id, productId, action, previousState, currentState i changedAt. Jest dopisywany do product_history przy udanym POST, PUT, PATCH lub DELETE. Snapshot obejmuje pełny produkt i dane kategorii. Zapis JSONB utrwala wartości z chwili operacji; późniejsza zmiana danych bieżących nie nadpisuje wcześniejszego wpisu.');
  table(['Operacja','Akcja','Stan przed','Stan po'],[
    ['POST','CREATE','{}','Utworzony produkt'],['PUT','REPLACE','Poprzedni produkt','Produkt po zastąpieniu'],
    ['PATCH','UPDATE','Poprzedni produkt','Produkt po scaleniu pól'],['DELETE','DELETE','Usuwany produkt','{}'],
  ],[1800,1800,2850,2850]);
  p('ProductsService.change() koordynuje PUT i PATCH. Poniżej fragment metody — pominięto sprawdzenia braku produktu, aby uwidocznić kolejność zapisu:');
  code(`return this.persist(() => this.products.transaction(async (manager) => {
  const current = await this.products.findById(id, manager, true);
  const previousState = this.toResponse(current);
  const values = await this.validate(payload(current), id, manager);
  const updated = await this.products.replace(id, values, manager);
  const currentState = this.toResponse(updated);
  await this.history.append(
    manager, id, action, previousState, currentState,
  );
  return currentState;
}));`);
  p('toResponse() korzysta z buildProductSnapshot(), tworząc nowy obiekt produktu i kategorii. Zapis produktu i INSERT historii używają tego samego EntityManager. Błąd dowolnego zapisu powoduje rollback całej transakcji [3]. Blokada pessimistic_write produktu przy PUT, PATCH i DELETE serializuje zmiany tego samego wiersza, aby stan „przed” odpowiadał ostatniemu zatwierdzonemu stanowi.');
  source('src/features/products/products.service.ts, product.snapshot.ts; src/features/product-history/product-history.service.ts, product-history.repository.ts.');

  h('3.2. Prezentacja GET /api/v1/products/{id}/history',2,true);
  p(`Dla produktu id=${cases['02-post-created'].responseBody.id} wykonano kolejno POST, PUT, PATCH i DELETE. Odczyt historii po usunięciu zwrócił HTTP 200 i cztery wpisy. Poniższa tabela przedstawia ten sam przebieg chronologicznie; endpoint zwraca go od najnowszego wpisu (changedAt DESC, id DESC).`);
  table(['Akcja','Cena przed → po','Ilość przed → po'],[
    ['CREATE','brak → 149.90','brak → 10'],['REPLACE','149.90 → 199.90','10 → 12'],
    ['UPDATE','199.90 → 199.90','12 → 7'],['DELETE','199.90 → brak','7 → brak'],
  ],[2000,3650,3650]);
  await caseFigure('14-history-after-delete','Swagger: historia usuniętego produktu — HTTP 200, pierwszy wpis DELETE z previousState oraz currentState = {}.',500);
  p('Jeśli produkt istnieje, ale nie ma wpisów historii, serwer zwraca []. Jeśli nie ma ani produktu, ani jego historii, odpowiedź wynosi 404. Niepoprawny id daje 400. Dane startowe z migracji nie otrzymują sztucznie utworzonej historii. Bezpośrednie zmiany SQL omijają mechanizm dopisywania historii realizowany przez serwis aplikacji.');

  h('4. Testy',1,true);
  h('4.1. Implementacja testów integracyjnych');
  p('Testy znajdują się w backend/test i używają wbudowanego runnera node:test oraz node:assert/strict. Uruchamiają rzeczywistą aplikację NestJS, wysyłają żądania HTTP przez fetch i korzystają z PostgreSQL. Dzięki temu sprawdzają jednocześnie routing, walidację DTO, serwisy, repozytoria, migracje, transakcje i format odpowiedzi.');
  table(['Plik','Sprawdzany zakres'],[
    ['products.e2e.test.mjs','CRUD, błędne i brakujące dane, granice cen, Unicode w nazwach, unikalność i równoczesne POST, CHECK w bazie, Swagger i CORS.'],
    ['product-history.e2e.test.mjs','Stany przed/po dla czterech operacji, odczyt po usunięciu, brak historii błędnych zapisów, równoczesne PATCH i rollback przy awarii audytu.'],
    ['lifecycle.e2e.test.mjs','Zamykanie serwera i puli PostgreSQL, oczekiwanie na trwające żądania, sygnały SIGINT i SIGTERM.'],
    ['support/test-database.mjs','Tworzenie unikalnej bazy testowej, przełączenie konfiguracji, sprzątanie i przywrócenie DB_NAME.'],
  ],[3500,5800]);
  p('Przykładowy test sprawdza, że niepoprawny POST nie zmienia liczby produktów ani wpisów historii. Fragment pochodzi z product-history.e2e.test.mjs:');
  code(`const database = app.get(DataSource);
const counts = () => database.query(\`
  SELECT (SELECT count(*) FROM products) AS products,
         (SELECT count(*) FROM product_history) AS history
\`);
const before = await counts();
assert.equal(
  (await write('POST', '', payload({ name: 'ab' }))).status, 422,
);
assert.deepEqual(await counts(), before);`);
  p('Osobny scenariusz dodaje do testowej tabeli historii CHECK (false) NOT VALID, który blokuje nowe wpisy. POST, PUT, PATCH i DELETE zwracają wtedy 500. Test potwierdza, że produkt i historia pozostają bez zmian. Ograniczenie jest usuwane w finally, a cała baza testowa po zakończeniu pliku.');

  h('4.2. Testy bez trwałego śladu w bazie',2,true);
  p('Izolacja opiera się na osobnej bazie dla każdego pliku testowego, a nie na jednej wspólnej transakcji obejmującej testy. Pozwala to sprawdzać rzeczywiste zatwierdzanie i rollback transakcji wykonywanych przez aplikację oraz równoczesne żądania. Dane podstawowej bazy appdb nie są modyfikowane.');
  table(['Mechanizm','Znaczenie'],[
    ['randomUUID() i prefiks ztp_test_','Każdy plik otrzymuje unikalną nazwę bazy; równoległe uruchomienia nie współdzielą danych.'],
    ['CREATE DATABASE; zmiana DB_NAME','Helper tworzy pustą bazę i kieruje do niej aplikację. Użytkownik PostgreSQL musi mieć uprawnienia do jej tworzenia i usuwania.'],
    ['Import aplikacji po zmianie konfiguracji','Wybór testowej bazy następuje przed uruchomieniem aplikacji. MigrationsRun buduje schemat i dane startowe.'],
    ['app.listen(0, "127.0.0.1")','System wybiera wolny port; testy nie kolidują z serwerem na 8000 ani z innymi plikami testów.'],
    ['after(), try/finally i app.close()','Hook zamyka aplikację i jej zasoby. finally uruchamia cleanup także przy błędzie zamykania.'],
    ['DROP DATABASE ... WITH (FORCE)','Usuwana jest wyłącznie baza o nazwie wygenerowanej przez helper. Przywracana jest poprzednia wartość DB_NAME.'],
  ],[3350,5950]);
  p('Kluczowe fragmenty helpera (skrót):');
  code(`const name = \`ztp_test_\${randomUUID().replaceAll('-', '')}\`;
await admin.query(\`CREATE DATABASE "\${name}"\`);
const previousName = process.env.DB_NAME;
process.env.DB_NAME = name;
// ... uruchomienie aplikacji i wykonanie testów ...
await client.query(\`DROP DATABASE IF EXISTS "\${name}" WITH (FORCE)\`);
if (previousName === undefined) delete process.env.DB_NAME;
else process.env.DB_NAME = previousName;`);
  p('Rekordy mogą pozostawać pomiędzy scenariuszami w obrębie jednego pliku; usunięcie całej bazy na końcu usuwa również produkty, historię, zmienione słowniki i zużyte sekwencje. Jest to izolacja na poziomie pliku i przebiegu zestawu testów, nie automatyczny reset po każdym pojedynczym teście.');
  source('backend/test/support/test-database.mjs; hooki before()/after() w testach produktów i historii.');

  h('4.3. Uruchamianie testów i wynik',2,true);
  p('Wymagane są Node.js w wersji co najmniej 22, zależności npm oraz działający PostgreSQL. Z katalogu głównego ZTP należy wykonać:');
  code(`docker compose up -d --wait
cd backend
npm ci
npm test`);
  p('npm ci jest potrzebne przy pierwszym przygotowaniu środowiska lub po zmianie lockfile. npm test najpierw kompiluje TypeScript, a następnie uruchamia node --test test/*.e2e.test.mjs. Główny serwer nie musi być uruchomiony, ponieważ testy tworzą własne instancje aplikacji.');
  table(['Komenda w backend','Zakres'],[
    ['npm test / npm run test:all','Cały zestaw testów.'],['npm run test:products','CRUD, walidacje, Swagger i CORS.'],
    ['npm run test:history / test:required','Historia, transakcje i scenariusze wymagane w etapie 1.3.'],
    ['npm run test:lifecycle','Cykl życia i zamykanie aplikacji.'],
    ['npm run test:docker','Budowa obrazu i cały zestaw w Linuxie; również testy rzeczywistych sygnałów.'],
  ],[4200,5100]);
  p('Weryfikacja podczas przygotowania sprawozdania (24.10.2026) dała następujący wynik:');
  const logBytes=fs.readFileSync(path.join(__dirname,'test-results.txt'));
  const log=logBytes[0]===255&&logBytes[1]===254?logBytes.toString('utf16le'):logBytes.toString('utf8');
  const summary=log.split(/\r?\n/).filter(l=>/ℹ (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) /.test(l));
  if (summary.length<7) throw new Error('Nie odczytano podsumowania testów.');
  code(summary.map(l=>l.replace('ℹ ','')).join('\n'));
  p('Z 68 testów zaliczono 66, nie wystąpiły błędy, a 2 pominięto. Pominięcia dotyczą rzeczywistego dostarczania SIGINT/SIGTERM, które wymagają Linuxa lub macOS. Test zamykania aplikacji wywoływanego programowo został wykonany także na Windows. npm run test:docker pozwala sprawdzić sygnały w kontenerze; tego przebiegu nie przedstawiono jako wyniku powyższej sesji.');

  h('Źródła i materiały projektu',1,true);
  p('Opis implementacji oparto na kodzie projektu znajdującym się w katalogu ZTP, po wydzieleniu feature’ów categories i product-history. Fragmenty kodu oznaczone jako skrót pomijają część instrukcji, zachowując opisywany przepływ. Schemat ERD, odpowiedzi Swaggera oraz wynik testów zostały wygenerowane podczas przygotowania sprawozdania.');
  table(['Materiał lokalny','Zastosowanie w sprawozdaniu'],[
    ['backend/src/features/products','CRUD, walidacje, format odpowiedzi, tworzenie snapshotów i granice transakcji.'],
    ['backend/src/features/categories','Struktura kategorii i odczyt widełek cenowych.'],
    ['backend/src/features/product-history','Zapis i odczyt historii, JSONB oraz endpoint Swaggera.'],
    ['backend/src/infrastructure/database','Połączenie z bazą, migracje, indeksy i ograniczenia.'],
    ['backend/test; backend/package.json','Implementacja, izolacja i uruchamianie testów.'],
    ['docker-compose.yml; backend/Dockerfile','Uruchamianie PostgreSQL i wariantu kontenerowego aplikacji/testów.'],
  ],[4300,5000]);
  p('Dokumentacja zewnętrzna (dostęp: 24.10.2026):');
  link('[1] FastAPI — Features','https://fastapi.tiangolo.com/features/');
  link('[2] NestJS — OpenAPI (Swagger)','https://docs.nestjs.com/openapi/introduction');
  link('[3] TypeORM — Transactions','https://typeorm.io/docs/advanced-topics/transactions/');
  p('Załączone ilustracje stanowią rzeczywiste fragmenty wykonanych operacji. Schemat ERD przedstawia relacje faktycznie występujące w bazie oraz osobno oznaczone powiązanie logiczne historii. Dane autora na stronie tytułowej należy uzupełnić przed oddaniem dokumentu.');

  const doc=new Document({
    title:'Sprawozdanie Projekt 1 — Aplikacja do zarządzania produktami (CRUD)',
    subject:'NestJS, vertical slicing, PostgreSQL, CRUD, historia zmian i testy integracyjne',
    creator:'',description:'Sprawozdanie opracowane na podstawie projektu ZTP.',
    styles:{default:{document:{run:{font:'Calibri',size:23,color:'243B50'},paragraph:{spacing:{line:280,after:115}}},
      heading1:{run:{font:'Calibri',size:36,bold:true,color:navy},paragraph:{spacing:{before:120,after:180},keepNext:true}},
      heading2:{run:{font:'Calibri',size:29,bold:true,color:navy},paragraph:{spacing:{before:170,after:140},keepNext:true}},
      heading3:{run:{font:'Calibri',size:24,bold:true,color:teal},paragraph:{spacing:{before:130,after:100},keepNext:true}}},
    },
    sections:[{properties:{titlePage:true,page:{size:{width:11906,height:16838},margin:{top:900,bottom:900,left:1000,right:1000,header:430,footer:430}}},
      headers:{default:new Header({children:[new Paragraph({children:[textRun('PROJEKT 1  /  ZARZĄDZANIE PRODUKTAMI',{font:'Calibri',size:17,color:gray})],
        border:{bottom:{style:BorderStyle.SINGLE,size:5,color:'CAD8E0'}},spacing:{after:70}})]})},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[textRun('Sprawozdanie • ',{size:17,color:gray}),new TextRun({children:[PageNumber.CURRENT],size:17,color:gray})]})]})},
      children,
    }],
  });
  const output=path.join(root,'Sprawozdanie_Projekt_1_CRUD.docx');
  fs.writeFileSync(output,await Packer.toBuffer(doc));
  console.log(JSON.stringify({output,figures:figureNo,paragraphs:children.filter(c=>c instanceof Paragraph).length,bytes:fs.statSync(output).size}));
})().catch(e=>{console.error(e);process.exitCode=1;});
