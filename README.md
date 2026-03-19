# REST API Устройства – Десктоп REST Client

Дипломен проект: десктоп приложение за откриване, мониторинг и управление на хардуерни устройства и сензори чрез REST.

## Основни функции
- Добавяне на устройства по IP адрес и порт
- Изпращане на HTTP заявки (GET/POST/PUT/DELETE)
- Четимо визуализиране на отговори (JSON/XML parsing)
- Автентикация (Basic, Bearer, API Key)
- Health check с периодични заявки
- Макроси (поредица от заявки)
- История на заявки и отговори

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

## Пакетиране (Distribution)

```bash
npm run dist
```

Генерира в `dist/`:
- **REST Client-x.x.x-Setup.exe** – NSIS инсталатор
- **REST Client x.x.x.exe** – portable изпълним файл (без инсталация)

Backend **не** е част от пакета – за demo го стартирай отделно с `npm run backend`.

## Backend API (Mock Sensor Hub)

| Method | Path       | Описание                  |
|--------|------------|---------------------------|
| GET    | `/health`  | Health check              |
| GET    | `/sensors` | Списък сензори            |
| POST   | `/sensors` | Добавяне/актуализация     |
| GET    | `/config`  | Конфигурация на устройство |
| PUT    | `/config`  | Обновяване на конфигурация |

## Бележки
- Данните се съхраняват локално в `appData` директорията на Electron.
- Приложението е изградено с Electron + React + TypeScript + Tailwind.
- Backend използва Node.js + Express + TypeScript.