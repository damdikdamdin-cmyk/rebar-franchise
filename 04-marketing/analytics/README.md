# Аналитика — re:bar franchise

**Статус:** 🟡 v1 готов (нужны ID счётчиков и домен)  
**Связан с:** `plan/marketing-plan-v1.md` §8–9, `creatives/ad-copy-v1.md`

## Файлы

| Файл | Содержание |
|------|------------|
| `analytics-setup-v1.md` | Пошаговая настройка: Метрика, VK, Meta, GA4 |
| `goals-events-v1.md` | Цели, события, маппинг на воронку |
| `utm-guide-v1.md` | UTM-структура + готовые ссылки по каналам |
| `tracking-snippet.html` | Код для вставки в `01-landing/index.html` |
| `dashboard-spec-v1.md` | Спецификация дашборда (Google Sheets) |
| `weekly-report-template.md` | Шаблон еженедельного отчёта |

## Что нужно от founder (перед внедрением)

| # | Параметр | Где взять |
|---|----------|-----------|
| 1 | ID Яндекс.Метрики | metrika.yandex.ru → Создать счётчик |
| 2 | VK Pixel ID | ads.vk.com → Пиксели |
| 3 | Meta Pixel ID | business.facebook.com → Events Manager |
| 4 | GA4 Measurement ID (опционально) | analytics.google.com |
| 5 | Домен лендинга | rebar.pro / rebar-franchise.ru / … |

## Порядок внедрения

1. Создать счётчики (по `analytics-setup-v1.md`)
2. Подставить ID в `tracking-snippet.html`
3. Вставить сниппет в `<head>` и перед `</body>` лендинга
4. Настроить цели в Метрике (по `goals-events-v1.md`)
5. Разметить рекламу UTM-ссылками (по `utm-guide-v1.md`)
6. Создать дашборд в Google Sheets (по `dashboard-spec-v1.md`)

## Метрики Y1 (напоминание)

| Метрика | Цель |
|---------|------|
| CAC лида | 500–2 000 ₽ |
| CR лендинга (визит → заявка) | 1–3% |
| CAC договора | 30–80K ₽ |
| ROMI | ≥ 3–5× |
