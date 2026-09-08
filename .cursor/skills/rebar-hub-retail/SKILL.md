---
name: rebar-hub-retail
description: >-
  Розничный контур re:bar OS (бывш. Hub) по образцу LiveSklad (re:bar).
  Используй при работе над POS/продажами, складом, товарами, поступлениями,
  перемещениями, возвратами, инвентаризацией, кассами, транзакциями,
  денежным потоком, зарплатой, печатными формами и отчётами точки в 06-crm.
---

# re:bar OS · Розница (LiveSklad → Hub → OS)

## Источник правды

Действующая CRM точек раньше — **LiveSklad**. Механики перенесены в Hub, затем
**полностью в re:bar OS** (`06-crm/`, порт **3100**). `05-hub/` — архив.

Не путать с воронкой франшизы УК: розничные документы на уровне **Store**,
но в той же БД и UI, что воронка/KB.

## Карта модулей LiveSklad → OS

| LiveSklad | OS route | Приоритет |
|-----------|----------|-----------|
| Продажи | `/stores/[id]/pos` | P0 |
| История чеков (мягкое удаление) | `/stores/[id]/sales` | P0 |
| Остатки | `/stores/[id]/stock` | P0 |
| Карточка товара | `/catalog/products/[id]` | P0 |
| Поступления | `/stores/[id]/receipts` | P0 |
| Клиенты | `/stores/[id]/customers` | P0 |
| Кассы / транзакции / cashflow | `/stores/[id]/cash*` | P0 |
| Инвентаризации (✓/×, аналитика) | `/stores/[id]/inventories` | P0 |
| Заказы / перемещения / возвраты / инвентаризации | `/stores/[id]/…` | P1 |
| Отчёты / зарплата | `/stores/[id]/reports`, `payroll` | P1 |
| Печатные формы | `/settings/print-forms` + `/print/[key]` | P0 |
| Устройства | `/settings/devices` | P0 |
| Гарантии | `/stores/[id]/warranty` | P0 |
| Устройства (S/N, история IMEI) | `/stores/[id]/devices` | P0 |
| Сводка сети (УК) | `/network` | P0 |

## Инварианты склада

1. Остаток меняется **только** через документы.
2. Серийный товар (`serialTracked`) обязателен для телефонов.
3. Цены: закуп / розница / ремонтная / под заказ.
4. Мультиточечность: UK — все; партнёр — свои; store_manager/seller — свою.

Код: `06-crm/src/lib/stock.ts`, `cash.ts`, `actions/retail.ts`, `lib/print/**`.

## Печать и штрихкоды

- Шаблоны: `PrintTemplate`, defaults в `src/lib/print/defaults.ts`
- Редактор: `/settings/print-forms` (Tiptap)
- Рендер: `/print/[key]?…` + bwip-js
- Автоштрихкод EAN-13: `src/lib/barcode.ts`

## Связанные скилы

- `rebar-franchise` — бренд и контекст сети
- `frontend-design` / `webapp-testing` — UI и e2e
