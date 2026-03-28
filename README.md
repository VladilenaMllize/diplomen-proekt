# REST API Устройства – Десктоп REST Client

Дипломен проект: десктоп приложение за откриване, мониторинг и управление на хардуерни устройства и сензори чрез REST.

## Основни функции
- Добавяне на устройства по IP адрес и порт
- Изпращане на HTTP заявки (GET/POST/PUT/PATCH/DELETE), query параметри, дублиране от историята
- Четимо визуализиране на отговори (JSON/XML parsing)
- Автентикация (Basic, Bearer, API Key) — **чувствителните стойности се шифроват с Electron `safeStorage`** при запис на диск (ако ОС поддържа)
- Глобални променливи `{{име}}` в път, headers, body и макроси (напр. `{{token}}`); макросите запазват `{{step1.field}}` за предишни стъпки
- Health check с периодични заявки
- Макроси (поредица от заявки), преименуване, пренареждане на стъпки с drag-and-drop
- История на заявки и отговори
- Светла/тъмна тема и език EN/BG

## Архитектура

- **Frontend (REST Client)**: Electron + React + TypeScript + Tailwind – десктоп приложение за управление на устройства
- **Backend**: Node.js + Express – симулира сензорно устройство с REST API, за демонстрация

## Стартиране (development)

### Само REST Client
```bash
npm install
npm run dev
```

### REST Client + Backend (за пълен demo)
```bash
npm install
cd backend && npm install && cd ..
npm run dev:all
```

Или в два отделни терминала:
```bash
npm run backend    # Терминал 1 – backend на http://localhost:3000
npm run dev        # Терминал 2 – REST Client
```

## Използване на Backend с REST Client

1. Стартирай backend: `npm run backend`
2. Стартирай REST Client: `npm run dev`
3. В приложението добави устройство:
   - IP: `127.0.0.1`
   - Port: `3000` (ако backend покаже друг порт заради заето 3000, използвай него)
   - Protocol: `http`
4. Изпращай заявки към `/health`, `/sensors`, `/config`

**Забележка:** Ако порт 3000 е зает, backend автоматично ще използва 3001, 3002 и т.н.

**GET /sensors** поддържа пагинация и филтър: `?page=1&limit=10&q=temp`. Отговорът е `{ items, page, limit, total }`.

**OpenAPI 3:** спецификацията е в [`backend/openapi.yaml`](backend/openapi.yaml); при стартиран backend се обслужва на **`http://localhost:<port>/openapi.yaml`**.

**WebSocket:** `ws://localhost:<port>/ws` — при POST към `/sensors` се изпраща съобщение `{"type":"sensor:upsert","payload":{...}}` към свързаните клиенти.

**Rate limiting:** глобално ~300 заявки/минута на IP (express-rate-limit).

## Пакетиране (Distribution)

Инсталирай зависимости: `npm install`.

**На текущата ОС** (препоръчително – на Windows се прави `.exe`, на macOS се прави `.app`/`.dmg`):

```bash
npm run dist
```

**Само Windows** (NSIS + portable `.exe`):

```bash
npm run dist:win
```

**Само macOS** (`.dmg` + `.zip` с приложението) – **задължително се изпълнява на Mac** (не може да се генерира валиден Mac пакет от Windows):

```bash
npm run dist:mac
```

Генерира в `dist/` (зависи от платформата):

| Платформа | Артефакти |
|-----------|-----------|
| Windows | **REST Client-x.x.x-Setup.exe** (NSIS), **REST Client x.x.x.exe** (portable) |
| macOS | **REST Client-x.x.x.dmg**, **REST Client-x.x.x-mac.zip** (или подобни имена) |

На Mac, ако приложението не е подписано с Apple Developer ID, при първо отваряне може да е нужно: **десен бутон → Open** (или System Settings → Privacy & Security).

Backend **не** е част от пакета – за demo го стартирай отделно с `npm run backend`.

## Тестване на Backend API

**PowerShell** (препоръчително за Windows):
```powershell
cd backend
.\test-api.ps1
```

Ръчно с `Invoke-RestMethod`:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/sensors?page=1&limit=5&q=temp" -Method Get
Invoke-RestMethod -Uri "http://localhost:3000/config" -Method Put -Body '{"name":"My Hub","version":"2.0"}' -ContentType "application/json"
```

**Забележка:** В PowerShell `curl` е alias за `Invoke-WebRequest` – синтаксисът е различен. За истински curl използвай `curl.exe` и внимавай с кавичките в JSON.

## Backend API (Mock Sensor Hub)

| Method | Path       | Описание                  |
|--------|------------|---------------------------|
| GET    | `/health`  | Health check              |
| GET    | `/sensors` | Списък сензори (пагинация `page`, `limit`, филтър `q`) |
| POST   | `/sensors` | Добавяне/актуализация     |
| GET    | `/config`  | Конфигурация на устройство |
| PUT    | `/config`  | Обновяване на конфигурация |

## Тестове

- **Unit:** `npm test` (Vitest) — URL building, шаблони за макроси/глобални променливи, парсване на отговори.
- **E2E (mock backend):** `npm run test:e2e` (Playwright) — стартира backend на порт `3099` (или `E2E_BACKEND_PORT`), проверява health, пагинация, Zod валидация и OpenAPI endpoint.

## Бележки
- **REST Client:** Данните (устройства, макроси, история, настройки) се съхраняват локално в `appData` директорията на Electron.
- **Backend:** Сензорите и конфигурацията се съхраняват в SQLite база данни (`backend/data/sensors.db`) – данните се запазват между рестарти.
- Приложението е изградено с Electron + React + TypeScript + Tailwind.
- Backend използва Node.js + Express + TypeScript + SQLite (better-sqlite3).