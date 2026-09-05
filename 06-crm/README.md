# re:bar OS — единая CRM сети

Одна система для УК, кураторов, партнёров, точек и маркетинга: воронка и запуск партнёра, база знаний по направлениям, обучение с чек-листами, самоподключение партнёров по инвайту.

Розница (продажи, склад, касса) остаётся в `05-hub/` до отдельной миграции; из карточек точек есть ссылка в Hub.

## Запуск

```bash
cd 06-crm
cp .env.example .env          # AUTH_SECRET, LEADS_WEBHOOK_SECRET, APP_URL
npm install                   # postinstall → prisma generate
npm run db:push
npm run db:seed               # УК-команда, УУ/Иркутск, демо-партнёр Чита, воронка
npm run kb:import             # база знаний из документов репо + курсы
npm run dev                   # http://localhost:3100
```

`npm run db:reset` — полный сброс (push --force-reset → seed → kb:import).

## Демо-доступы

Пароль для всех: `SEED_PASSWORD` из `.env` (по умолчанию `rebar-os`).

| Роль | Email | Что видит |
|---|---|---|
| Основатель | `damdikdamdin@gmail.com` | всё: сводка сети, воронка, партнёры, запуски, маркетинг, команда, редактирование базы знаний |
| Менеджер продаж УК | `sales@rebar.local` | воронка, лиды, скрипты и FAQ, курс «Продажа франшизы» |
| Куратор запуска | `curator@rebar.local` | свои запуски, партнёры, прогресс обучения, команда партнёров |
| Маркетолог УК | `marketing@rebar.local` | контент-календарь, кампании, UTM, аналитика, маркетинг-KB |
| Партнёр (Чита) | `partner@rebar.local` | свой запуск, точки, команда, юрпакет, методичка, курс партнёра |
| Управляющий точкой (УУ) | `ulan@rebar.local` | чек-лист дня, стандарты, обучение, ссылка в Hub |
| Продавец (Иркутск) | `irkutsk@rebar.local` | то же, без управления командой |

## Роли

`founder`, `uk_admin`, `uk_sales`, `uk_curator`, `uk_marketer`, `partner`, `store_manager`, `seller`. Права — в `src/lib/access.ts`; навигация по роли — `src/lib/nav.ts`; видимость статей — `visibleRoles` пространства и статьи.

## Подключение партнёра

1. Лид в воронке доходит до «Договор»/«Оплата» → в карточке лида кнопка **Подключить партнёра**.
2. Создаются `Partner`, `Store(launch)`, `LaunchProject` (16 шагов / 6 фаз), инвайт на 14 дней. Куратор и УК получают уведомление в инбокс, УК — в Telegram.
3. Партнёр открывает `/join/<token>`, задаёт пароль → визард `/onboarding` (профиль → точка → приглашение команды → старт).
4. Партнёру автоматически назначаются курсы по роли («Запуск партнёра», «Открытие точки: маркетинг»).

Партнёр сам приглашает управляющего и продавцов (`/team`) — им назначается курс «Рабочий день продавца».

## База знаний

`scripts/kb-manifest.ts` — карта документов репо → статьи: раздел, slug, роли, теги. `scripts/import-kb.ts` конвертирует md/txt как есть, docx через `mammoth`, pdf через `pdf-parse`; оригиналы копируются в `public/kb-files/` и доступны для скачивания из статьи. Стратегия УК разбивается на статьи по §.

Разделы: Стратегия УК · Юрпакет · Запуск партнёра · Продажи франшизы · Маркетинг · Розница и операции. 49 статей, 5 курсов.

Статьи редактируются в UI (`/kb/<slug>/edit`, markdown + превью, версия увеличивается). Повторный `kb:import` перезаписывает тело импортированных статей из файлов — правки по импортированным документам делайте в исходных файлах репо.

Файлы `03-crm-and-ops/legal/06_*.docx` и `07_*.docx` в репо повреждены (обрезанный zip); в базу загружены экспорты `*_FINAL_v3.1.md` из Google Docs.

## Интеграции

- `POST /api/leads` — тот же контракт, что в Hub (`X-Api-Key: LEADS_WEBHOOK_SECRET`, поля `name, phone, email?, city?, note?, source?, utm*`). Лендинг переключён на `:3100`.
- `/apply` — публичная форма заявки без ключа.
- Telegram: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — новые заявки и подключения партнёров; `Partner.telegramChat` — уведомления партнёру о шагах запуска.
- Инбокс: `Notification` — задачи, шаги запуска, завершение курсов, онбординг, сброс пароля (ссылку передаёт админ, почта не настроена).
- `HUB_URL` — ссылка «Розница в Hub» из карточки точки и рабочего дня.

## Стек

Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript, Tailwind v4 (oklch-токены, dark mode), Prisma 6 + SQLite (схема Postgres-совместимая), Auth.js v5 credentials + JWT, cmdk (⌘K), Recharts, react-markdown + remark-gfm.

Редактор статей — markdown-текстарея с live-превью (не Tiptap: меньше зависимостей, статьи импортируются из markdown и остаются диффабельными).

## Структура

```
prisma/schema.prisma        модель: организация, воронка, запуск, задачи, KB, обучение, маркетинг
prisma/seed.ts              демо-данные
scripts/kb-manifest.ts      карта документов → статьи и курсы
scripts/import-kb.ts        импорт docx/pdf/md
src/lib/access.ts           роли и права
src/lib/nav.ts              рейл по роли
src/components/shell/*      рейл, ⌘K, инбокс
src/app/(public)/           login, join/[token], apply, reset
src/app/(app)/              /, pipeline, partners, launches, tasks, kb, learn, marketing, network, stores, team, day, onboarding
src/app/api/leads           вебхук заявок
```

## Что дальше

Перенос розницы из Hub, AI-ассистент по базе знаний, ОФД/1С, native-приложение — вне текущего объёма.
