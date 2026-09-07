# re:bar OS — единая платформа сети

Одна система для УК, кураторов, партнёров и точек: воронка франшизы, запуски, база знаний, обучение, маркетинг **и розница** (POS, склад, касса, печать).

Раньше розница жила в `05-hub/` (порт 3000). Контур перенесён сюда (`:3100`). Hub оставлен как архив/заглушка.

## Запуск

```bash
cd 06-crm
cp .env.example .env          # AUTH_SECRET, LEADS_WEBHOOK_SECRET, APP_URL
npm install                   # postinstall → prisma generate
npm run db:push
npm run db:seed               # УК, точки, воронка + демо-розница
npm run kb:import             # база знаний из документов репо + курсы
npm run dev                   # http://localhost:3100
```

Если база уже есть без товаров: `npm run db:seed:retail` (аддитивно, без wipe).

`npm run db:reset` — полный сброс (force-reset → seed → kb:import). Только для локальной SQLite.

## Демо-доступы

Пароль для всех: `SEED_PASSWORD` из `.env` (по умолчанию `rebar-os`).

| Роль | Email | Что видит |
|---|---|---|
| Основатель | `damdikdamdin@gmail.com` | всё: сводка сети + аналитика розницы, воронка, партнёры, запуски, маркетинг, каталог, печать |
| Менеджер продаж УК | `sales@rebar.local` | воронка, лиды, скрипты и FAQ |
| Куратор запуска | `curator@rebar.local` | запуски, партнёры, сводка сети / розница |
| Маркетолог УК | `marketing@rebar.local` | контент, кампании, UTM |
| Партнёр (Чита) | `partner@rebar.local` | свой запуск, точки, POS своих магазинов |
| Управляющий (УУ) | `ulan@rebar.local` | рабочий день, POS / склад / касса своей точки |
| Продавец (Иркутск) | `irkutsk@rebar.local` | то же для своей точки |

## Розница

- Точка: `/stores/[id]` → POS, остатки, поступления, касса, гарантии, отчёты…
- Каталог: `/catalog/products`
- Печать: `/settings/print-forms`, рендер `/print/[key]?…`
- Устройства (сканер): `/settings/devices`
- Сводка сети `/network` — выручка по точкам за 30 дней, топ товаров (УК)

Логика склада без изменений относительно Hub: остаток только через документы, серийные товары обязательны для `serialTracked`.

## Роли

`founder`, `uk_admin`, `uk_sales`, `uk_curator`, `uk_marketer`, `partner`, `store_manager`, `seller`. Права — `src/lib/access.ts`; навигация — `src/lib/nav.ts`.

## Подключение партнёра

1. Лид → **Подключить партнёра** → Partner + Store(launch) + LaunchProject + инвайт.
2. Партнёр `/join/<token>` → онбординг.
3. После открытия точки розница доступна в `/stores/[id]/pos` без отдельного приложения.

## База знаний

`scripts/kb-manifest.ts` → `npm run kb:import`. Разделы: Стратегия · Юрпакет · Запуск · Продажи франшизы · Маркетинг · Розница.

## Интеграции

- `POST /api/leads` — лендинг (`X-Api-Key: LEADS_WEBHOOK_SECRET`)
- `/apply` — публичная заявка
- Telegram: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
- Печать: `COMPANY_NAME` / `COMPANY_INN` / … в `.env` как реквизиты по умолчанию

## Стек

Next.js 16, React 19, Prisma 6 + SQLite, Auth.js v5, TipTap (печатные формы), bwip-js (штрихкоды), Recharts, cmdk.

## Структура

```
prisma/schema.prisma        организация + воронка + KB + розница
prisma/seed.ts              полный демо-сид
prisma/seed-retail.ts       аддитивная розница
src/lib/stock.ts|cash.ts|print/**   склад / касса / печать
src/actions/retail.ts|print.ts
src/app/(app)/stores/[id]/*         модули точки
src/app/(app)/catalog|settings/*    справочник и настройки
src/app/print/[key]                 рендер печатных форм
```
