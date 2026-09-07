# re:bar — франшиза электроники

Один репозиторий: лендинг, презентация, юрпакет, маркетинг и **единая платформа re:bar OS** (франшиза + розница).

## Для команды — первые тесты

См. **[TEAM-TEST.md](./TEAM-TEST.md)** — клон, запуск, логины, чеклист.

Кратко:

```bash
cd 06-crm && cp .env.example .env && npm install
npx prisma db push && npm run db:seed && npm run kb:import
npm run dev   # http://localhost:3100
```

Пароль демо: `rebar-os`

## Структура

```
rebar-franchise/
├── TEAM-TEST.md            # инструкция для тестеров
├── _shared/strategy/       # стратегия УК
├── 01-landing/             # лендинг (заявки → OS :3100)
├── 02-presentation/        # презентация
├── 03-crm-and-ops/         # скрипты, запуск, юрдокументы
├── 04-marketing/           # маркетинг-материалы
├── 05-hub/                 # архив Hub (redirect → OS)
├── 06-crm/                 # ★ re:bar OS — основная система
└── .cursor/skills/         # скилы Cursor
```

## Контакты

Founder: Дамдин Цыпылов · damdikdamdin@gmail.com  
Репозиторий: https://cursor.com/codebase/damdikdamdin/rebar-franchise
