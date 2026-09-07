# re:bar OS — инструкция для первых тестов

Платформа для команды: **одна система** (франшиза + розница).  
Приложение: `06-crm/` → в браузере **http://localhost:3100**

Hub (`05-hub/`, порт 3000) больше не нужен для тестов — архив.

## Быстрый старт (5 минут)

```bash
git clone https://origin.cursor.com/damdikdamdin/rebar-franchise.git
cd rebar-franchise/06-crm
cp .env.example .env
# сгенерируйте секрет: openssl rand -base64 32 → вставьте в AUTH_SECRET
npm install
npx prisma db push
npm run db:seed
npm run kb:import
npm run dev
```

Откройте http://localhost:3100/login

Пароль для всех демо-учёток: **`rebar-os`**  
(можно сменить в `.env` → `SEED_PASSWORD`, затем снова `npm run db:seed`)

| Кто | Email | Смотреть |
|-----|--------|----------|
| Основатель / УК | `damdikdamdin@gmail.com` | всё: воронка, сеть, розница, аналитика |
| Продажи франшизы | `sales@rebar.local` | воронка, лиды |
| Куратор | `curator@rebar.local` | запуски, партнёры, сводка |
| Маркетинг | `marketing@rebar.local` | контент, UTM, аналитика |
| Партнёр (Чита) | `partner@rebar.local` | свой запуск, точка |
| Управляющий Улан-Удэ | `ulan@rebar.local` | POS, склад, касса, день |
| Продавец Иркутск | `irkutsk@rebar.local` | POS своей точки |

## Что прогнать в первом прогоне

1. **УК** — `/pipeline` (лид), `/network` (выручка по точкам), `/partners`
2. **Точка** — `/stores` → Улан-Удэ → **POS** (продажа), **Остатки**, **Гарантии**
3. **Печать** — после продажи чек/гарантия; `/settings/print-forms`
4. **Партнёр** — `/launches`, `/day`, `/learn`
5. **Заявка с лендинга** — форма на `01-landing` бьёт в `POST /api/leads` (ключ в `.env`: `LEADS_WEBHOOK_SECRET`)

## Важно для реальных тестов

- База локальная (SQLite в `06-crm/prisma/dev.db`) — у каждого своя, данные не общие.
- Не коммитьте `.env` и пароли.
- Баги и пожелания — в чат основателю или issue в репозитории Cursor.
- Полный сброс демо: `npm run db:reset` (только локально, сотрёт данные).

## Репозиторий

- Страница: https://cursor.com/codebase/damdikdamdin/rebar-franchise  
- Clone: `https://origin.cursor.com/damdikdamdin/rebar-franchise.git`  

Доступ коллегам выдаётся на странице репозитория в Cursor (не публичная ссылка для всех).
