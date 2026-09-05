# re:bar Hub

Закрытая CRM франшизы: воронка УК, запуск партнёра и розница точек в одной базе.

## Запуск

```bash
cd 05-hub
cp .env.example .env
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Сиды (пароль по умолчанию `rebar-hub`, задаётся `SEED_PASSWORD`):

| Роль | Email |
|------|--------|
| Основатель | damdikdamdin@gmail.com |
| Менеджер УК | sales@rebar.local |
| Куратор | curator@rebar.local |
| Партнёр (Чита, запуск) | partner@rebar.local |
| Продавец Улан-Удэ | ulan@rebar.local |
| Продавец Иркутск | irkutsk@rebar.local |

## Розница (замена LiveSklad)

Модули точки `/stores/[id]/*`: POS, заказы, остатки, поступления, перемещения, возвраты, инвентаризации, списания, клиенты, кассы, транзакции, денежный поток, зарплата, отчёты, печать чека/гарантии.

Справочник: `/catalog/products`. Импорт CSV cutover: `/settings/import`. Чеклист УУ/Иркутск: `03-crm-and-ops/crm/cutover-ulan-irkutsk.md`.

Для Prisma используйте локальный бинарь: `./node_modules/.bin/prisma db push` и `node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts`.

## Роли

- **founder / uk_admin** — вся сеть, приглашения
- **uk_sales** — воронка заявок с лендинга
- **uk_curator** — запуски и KPI точек
- **partner** — свои точки, свой запуск, свои продажи
- **seller** — только продажи своей точки

Собственные магазины (Улан-Удэ, Иркутск) и франчайзи видят одни и те же розничные карточки. УК видит сводку по всем.

## Webhook лендинга

`POST /api/leads` с заголовком `X-Api-Key: <LEADS_WEBHOOK_SECRET>`.

Тело: `{ name, phone, city?, note?, source?, utmSource?, utmMedium?, utmCampaign? }`.

Форма в `01-landing/index.html` шлёт сюда. Для продакшена задайте `window.REBAR_HUB_LEADS_URL` и `window.REBAR_HUB_LEADS_KEY`.

## Telegram

Если заданы `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`, новая заявка и конвертация в партнёра уходят в чат.

## Что это не заменяет

ОФД/АТОЛ API, 1С, Avito-синк, native-приложение. Lendo фиксируется суммой в чеке; фискализация — отдельно.
