# ANALYTICS

Сборка файлов re:bar Marketing v2

---


============================================================
# FILE: analytics/README.md
============================================================

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


============================================================
# FILE: analytics/analytics-setup-v1.md
============================================================

# Настройка аналитики v1

**Версия:** 1.0 · сентябрь 2026  
**Сайт:** [домен TBD]  
**Ответственный:** founder + маркетолог

---

## 1. Яндекс.Метрика (приоритет №1)

### Создание счётчика

1. Перейти на [metrika.yandex.ru](https://metrika.yandex.ru)
2. **Добавить счётчик** → указать домен лендинга
3. Включить опции:
   - ✅ Вебвизор
   - ✅ Карта скроллинга
   - ✅ Аналитика форм
   - ✅ Отслеживание хеша в URL
   - ✅ E-commerce (на будущее)
4. Скопировать **номер счётчика** → подставить в `tracking-snippet.html` как `YM_ID`

### Связка с Яндекс.Директ

1. Метрика → **Настройки** → **Связь с Директом** → привязать аккаунт
2. В Директе: кампании → **Стратегия** → оптимизация по цели `lead_submit`
3. Включить автоматические цели Метрики (как запасной вариант)

### Цели в Метрике

Создать вручную (Настройки → Цели):

| ID цели | Название | Тип | Условие |
|---------|----------|-----|---------|
| `lead_submit` | Заявка отправлена | JavaScript-событие | `lead_submit` |
| `modal_open` | Открыта форма | JavaScript-событие | `modal_open` |
| `calc_use` | Использован калькулятор | JavaScript-событие | `calc_use` |
| `scroll_75` | Скролл 75% | Скролл | 75% страницы |
| `time_60s` | Время на сайте 60 сек | Время | 60 секунд |

> Код отправки событий — в `tracking-snippet.html` и `goals-events-v1.md`.

### Сегменты (создать после 2 недель трафика)

- `Платный трафик` — utm_medium = cpc | cpm
- `Органика` — utm_source отсутствует
- `Яндекс` — utm_source = yandex
- `VK` — utm_source = vk
- `Telegram` — utm_source = telegram
- `Отказники < 15 сек` — для ретаргета

---

## 2. VK Реклама — пиксель

### Создание

1. [ads.vk.com](https://ads.vk.com) → **Ретаргетинг** → **Пиксели**
2. Создать пиксель «re:bar franchise landing»
3. Скопировать **ID пикселя** → `VK_PIXEL_ID` в сниппете

### События VK

| Событие | Когда | Код |
|---------|-------|-----|
| `PageView` | Загрузка страницы | Автоматически |
| `Lead` | Отправка заявки | `VK.Retargeting.Event('lead')` |
| `ViewContent` | Открытие модалки | `VK.Retargeting.Event('view_content')` |

### Аудитории для ретаргета

| Аудитория | Условие | Для чего |
|-----------|---------|----------|
| Все посетители | 30 дней | Ретаргет |
| Не оставили заявку | Визит без Lead, 14 дней | Дожим |
| Открыли форму, не отправили | view_content без Lead, 7 дней | Горячий ретаргет |
| Использовали калькулятор | calc_use, 14 дней | Интерес к цифрам |

---

## 3. Meta Pixel (Instagram / Facebook)

### Создание

1. [business.facebook.com](https://business.facebook.com) → Events Manager
2. **Подключить источник данных** → Веб → Meta Pixel
3. Название: `re:bar franchise`
4. Скопировать **Pixel ID** → `META_PIXEL_ID` в сниппете

### События Meta

| Событие | Когда | Код |
|---------|-------|-----|
| `PageView` | Загрузка | Автоматически |
| `Lead` | Заявка | `fbq('track', 'Lead')` |
| `ViewContent` | Модалка | `fbq('track', 'ViewContent')` |
| `InitiateCheckout` | Клик «Заказать звонок» | `fbq('track', 'InitiateCheckout')` |

> Для Instagram таргета Meta Pixel обязателен. Без VPN у части аудитории — учитывать при оценке охвата.

### Conversions API (опционально, M2+)

Server-side через CRM webhook при создании лида — повышает точность атрибуции.

---

## 4. Google Analytics 4 (опционально)

### Когда нужен

- Если планируете Google Ads (пока нет в плане M1)
- Для кросс-проверки данных с Метрикой
- Для интеграции с Looker Studio

### Создание

1. [analytics.google.com](https://analytics.google.com) → Создать ресурс GA4
2. Поток данных → Веб → домен лендинга
3. Measurement ID `G-XXXXXXXX` → `GA4_ID` в сниппете

### События GA4

| Событие | Параметры |
|---------|-----------|
| `generate_lead` | form_name, utm_source |
| `modal_open` | — |
| `calculator_use` | investment, revenue |

---

## 5. Telegram (без пикселя)

Telegram не имеет пикселя. Отслеживание:

1. **UTM-ссылки** на каждый пост/посев (`utm_source=telegram`)
2. **Telegram-бот** с deep link: `t.me/rebar_franchise_bot?start=utm_telegram_post1`
3. Бот фиксирует источник в CRM при первом сообщении

---

## 6. Чеклист запуска

### До запуска рекламы

- [ ] Счётчик Метрики создан и установлен на лендинг
- [ ] Цели `lead_submit`, `modal_open`, `scroll_75` работают (проверить в Метрике → Отладчик)
- [ ] VK Pixel установлен, событие Lead тестируется
- [ ] Meta Pixel установлен (если запускаем Instagram)
- [ ] UTM-ссылки готовы для всех кампаний
- [ ] Связка Метрика ↔ Директ настроена
- [ ] Дашборд Google Sheets создан

### Тест (5 минут)

1. Открыть лендинг с `?utm_source=test&utm_medium=manual&utm_campaign=debug`
2. Прокрутить до 75%
3. Открыть форму → отправить тестовую заявку
4. Проверить:
   - Метрика → Отладчик → события `modal_open`, `lead_submit`
   - VK → Пиксель → последние события
   - Meta → Events Manager → Test Events

---

## 7. Передача UTM в CRM

При интеграции формы с CRM (AmoCRM / Битрикс24) — передавать:

```json
{
  "name": "...",
  "phone": "...",
  "city": "...",
  "note": "...",
  "utm_source": "yandex",
  "utm_medium": "cpc",
  "utm_campaign": "franchise_q4_2026",
  "utm_content": "test_a_money",
  "landing_page": "https://[домен]/?utm_...",
  "referrer": "https://yandex.ru/..."
}
```

UTM сохранять в cookies/localStorage при первом визите (код в `tracking-snippet.html`).

---

## 8. Конфиденциальность

- Форма: согласие на обработку ПД (добавить чекбокс перед запуском рекламы)
- Cookie-баннер: для VK/Meta pixel — уведомление по 152-ФЗ (можно минимальный)
- Метрика: IP анонимизация не нужна для РФ-сайта, но Вебвизор — отключить запись полей формы (настройка в Метрике)

---

*После получения ID счётчиков — внедрить `tracking-snippet.html` в лендинг (чат `01-landing/`).*


============================================================
# FILE: analytics/goals-events-v1.md
============================================================

# Цели и события v1

**Версия:** 1.0 · сентябрь 2026  
**Инструменты:** Яндекс.Метрика (основной), VK Pixel, Meta Pixel

---

## Воронка → события

```
Визит (PageView)
  ↓
Скролл 75% (scroll_75)          ← микроконверсия
  ↓
Время 60+ сек (time_60s)         ← микроконверсия
  ↓
Клик CTA (cta_click)             ← микроконверсия
  ↓
Открытие формы (modal_open)      ← намерение
  ↓
Отправка заявки (lead_submit)    ← ★ основная конверсия
  ↓
[CRM] Квалификация               ← офлайн, в CRM
  ↓
[CRM] Zoom-встреча               ← офлайн
  ↓
[CRM] Договор                    ← ★ финальная конверсия
```

---

## Таблица событий

| Событие | Триггер на лендинге | Метрика | VK | Meta | Приоритет |
|---------|---------------------|---------|-----|------|-----------|
| `page_view` | Загрузка страницы | авто | PageView | PageView | — |
| `scroll_75` | Скролл ≥ 75% | цель | — | — | низкий |
| `time_60s` | 60 сек на странице | цель | — | — | низкий |
| `cta_click` | Клик «Заказать звонок» | JS-событие | — | InitiateCheckout | средний |
| `modal_open` | Открытие модалки заявки | JS-событие | view_content | ViewContent | средний |
| `calc_use` | Изменение слайдера калькулятора | JS-событие | — | — | низкий |
| `calc_format` | Выбор формата (пункт/стандарт/флагман) | JS-событие | — | — | низкий |
| `lead_submit` | Успешная отправка формы | JS-событие | lead | Lead | **высокий** |
| `lead_error` | Ошибка отправки формы | JS-событие | — | — | средний |

---

## Параметры событий (Метрика)

При отправке `lead_submit` передавать параметры:

| Параметр | Значение | Зачем |
|----------|----------|-------|
| `utm_source` | yandex / vk / telegram / … | Атрибуция |
| `utm_medium` | cpc / cpm / post / organic | Тип трафика |
| `utm_campaign` | franchise_q4_2026 | Кампания |
| `utm_content` | test_a_money | Креатив |
| `has_city` | true / false | Качество лида |
| `has_note` | true / false | Вовлечённость |
| `page_section` | hero / final / promo | Откуда открыл форму |

Пример вызова:
```javascript
ym(YM_ID, 'reachGoal', 'lead_submit', {
  utm_source: getUtm('utm_source'),
  utm_medium: getUtm('utm_medium'),
  utm_campaign: getUtm('utm_campaign'),
  utm_content: getUtm('utm_content'),
  has_city: !!city,
  has_note: !!note
});
```

---

## Маппинг на воронку Y1

| Этап воронки | Событие / источник | Целевой CR |
|--------------|-------------------|------------|
| Показы → клик | Рекламный кабинет | CTR 1–3% |
| Клик → визит | Метрика: визиты с UTM | ~100% |
| Визит → заявка | Метрика: lead_submit / визиты | 1–3% |
| Заявка → квалиф. | CRM: стадия «Квалифицирован» | 40% |
| Квалиф. → Zoom | CRM: стадия «Встреча» | 50% |
| Zoom → договор | CRM: стадия «Договор» | 15–25% |

### Формулы

```
CR лендинга = lead_submit / визиты × 100%
CAC лида = расход канала / lead_submit (по UTM)
CAC договора = расход канала / договоры (из CRM, по UTM)
ROMI = (LTV × договоры − расход) / расход
```

---

## Офлайн-конверсии (CRM)

Метрика не видит Zoom и договоры — считать в CRM + дашборде.

### Поля CRM для аналитики

| Поле | Тип | Пример |
|------|-----|--------|
| `utm_source` | текст | yandex |
| `utm_medium` | текст | cpc |
| `utm_campaign` | текст | franchise_q4_2026 |
| `utm_content` | текст | test_a_money |
| `landing_url` | URL | полная ссылка с UTM |
| `lead_date` | дата | 2026-09-15 |
| `qualified` | да/нет | да |
| `zoom_date` | дата | 2026-09-18 |
| `contract_date` | дата | 2026-10-02 |
| `contract_amount` | число | 100000 (паушал) |
| `channel_cost` | число | из рекламного кабинета |

### Стадии воронки CRM

1. **Новая заявка** — lead_submit
2. **Контакт установлен** — менеджер позвонил
3. **Квалифицирован** — город, бюджет, срок ОК
4. **Презентация отправлена**
5. **Zoom назначен**
6. **Zoom проведён**
7. **Договор на подписании**
8. **Договор подписан** ★
9. **Отказ** (с причиной)

---

## A/B тест — какие метрики смотреть

| Тест | Метрика победы | Мин. выборка |
|------|----------------|--------------|
| Угол A vs B vs C (креатив) | CPL (CAC лида) | 30 заявок на вариант |
| Hero лендинга | CR визит → lead_submit | 500 визитов на вариант |
| CTA текст | modal_open / cta_click | 200 кликов |
| Промо-блок | lead_submit с page_section=promo | 100 визитов на промо |

---

## Алерты (настроить в M2)

| Условие | Действие |
|---------|----------|
| CR лендинга < 0.5% за 3 дня | Проверить форму, скорость сайта |
| CPL > 2 500 ₽ за неделю | Пауза канала, смена креатива |
| 0 заявок при 100+ визитах | Проверить форму / Метрику |
| modal_open >> lead_submit (CR < 20%) | Проблема формы или полей |

---

*События реализованы в `tracking-snippet.html`. После внедрения — проверить через Метрику → Отладчик.*


============================================================
# FILE: analytics/utm-guide-v1.md
============================================================

# UTM-гайд v1

**Версия:** 1.0 · сентябрь 2026  
**Домен:** `https://[ДОМЕН]` — заменить после выбора

---

## Структура

```
https://[ДОМЕН]/?utm_source={source}&utm_medium={medium}&utm_campaign={campaign}&utm_content={content}
```

| Параметр | Обязательный | Описание |
|----------|--------------|----------|
| `utm_source` | ✅ | Площадка: yandex, vk, telegram, instagram, catalog, youtube |
| `utm_medium` | ✅ | Тип: cpc, cpm, post, seed, organic, email |
| `utm_campaign` | ✅ | Кампания: franchise_q4_2026, promo_100k |
| `utm_content` | рекомендуется | Креатив/тест: test_a_money, banner_01, video_02 |
| `utm_term` | опционально | Ключевое слово (только Директ) |

### Правила именования

- Только латиница, цифры, подчёркивание
- Без пробелов и кириллицы
- Lowercase: `yandex`, не `Yandex`
- Одинаковые значения во всех кабинетах — для сводного отчёта

---

## Яндекс.Директ

### Шаблон для кампаний

```
https://[ДОМЕН]/?utm_source=yandex&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content={creative}
```

### Готовые ссылки по углам

**Угол A — Деньги:**
```
https://[ДОМЕН]/?utm_source=yandex&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content=test_a_money
```

**Угол B — Доказательство:**
```
https://[ДОМЕН]/?utm_source=yandex&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content=test_b_proof
```

**Угол C — Промо:**
```
https://[ДОМЕН]/?utm_source=yandex&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content=test_c_promo
```

### Автоподстановка в Директе

В настройках кампании → **Параметры URL**:
```
utm_source=yandex&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content={ad_id}&utm_term={keyword}
```

> `{ad_id}` и `{keyword}` — макросы Директа. Подставляются автоматически.

---

## VK Реклама

### Шаблон

```
https://[ДОМЕН]/?utm_source=vk&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content={creative}
```

### Готовые ссылки

| Креатив | Ссылка |
|---------|--------|
| Баннер A (деньги) | `?utm_source=vk&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content=banner_01_money` |
| Баннер B (цифры) | `?utm_source=vk&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content=banner_02_proof` |
| Баннер C (промо) | `?utm_source=vk&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content=banner_03_promo` |
| Видео 01 | `?utm_source=vk&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content=video_01_royalty` |
| Видео 02 | `?utm_source=vk&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content=video_02_numbers` |

### Лид-форма VK (если без лендинга)

В поле «Ссылка после отправки»:
```
https://[ДОМЕН]/?utm_source=vk&utm_medium=leadform&utm_campaign=franchise_q4_2026&utm_content=vk_leadform_01
```

---

## Telegram

### Посты в канале founder

```
https://[ДОМЕН]/?utm_source=telegram&utm_medium=post&utm_campaign=franchise_q4_2026&utm_content=channel_post_{NN}
```

Примеры:
- `channel_post_01` — первый пост про 0% роялти
- `channel_post_02` — кейс Улан-Удэ
- `channel_post_03` — промо 100K

### Посевы в чужих каналах

```
https://[ДОМЕН]/?utm_source=telegram&utm_medium=seed&utm_campaign=franchise_q4_2026&utm_content=seed_{channel_name}
```

Примеры:
- `seed_business_irkutsk`
- `seed_franchise_ru`
- `seed_siberia_biz`

### Telegram-бот (deep link)

```
https://t.me/rebar_franchise_bot?start=src_telegram_post01
```

Бот парсит `start` параметр и записывает в CRM как utm_source=telegram.

---

## Instagram

### Bio link

```
https://[ДОМЕН]/?utm_source=instagram&utm_medium=organic&utm_campaign=franchise_q4_2026&utm_content=bio_link
```

### Таргет

```
https://[ДОМЕН]/?utm_source=instagram&utm_medium=cpc&utm_campaign=franchise_q4_2026&utm_content={creative}
```

| Креатив | utm_content |
|---------|-------------|
| Reels роялти | `reels_01_royalty` |
| Reels цифры | `reels_02_numbers` |
| Stories промо | `stories_03_promo` |
| Карусель | `carousel_04_dual` |

### Хайлайт «Франшиза»

```
https://[ДОМЕН]/?utm_source=instagram&utm_medium=organic&utm_campaign=franchise_q4_2026&utm_content=highlight_franchise
```

---

## Каталоги франшиз

```
https://[ДОМЕН]/?utm_source=catalog&utm_medium=listing&utm_campaign=franchise_q4_2026&utm_content={platform}
```

| Площадка | utm_content |
|----------|-------------|
| Franshiza.ru | `franshiza_ru` |
| BeBoss | `beboss` |
| TopFranchise | `topfranchise` |

---

## YouTube

```
https://[ДОМЕН]/?utm_source=youtube&utm_medium=organic&utm_campaign=franchise_q4_2026&utm_content=shorts_{NN}
```

---

## Email / мессенджеры (ручная рассылка)

```
https://[ДОМЕН]/?utm_source=email&utm_medium=manual&utm_campaign=franchise_q4_2026&utm_content=outreach_{NN}
```

---

## Таблица сводная (для копирования в рекламные кабинеты)

| Канал | source | medium | campaign | content (пример) |
|-------|--------|--------|----------|------------------|
| Яндекс Директ A | yandex | cpc | franchise_q4_2026 | test_a_money |
| Яндекс Директ B | yandex | cpc | franchise_q4_2026 | test_b_proof |
| Яндекс Директ C | yandex | cpc | franchise_q4_2026 | test_c_promo |
| VK баннер 01 | vk | cpc | franchise_q4_2026 | banner_01_money |
| VK баннер 02 | vk | cpc | franchise_q4_2026 | banner_02_proof |
| VK видео 01 | vk | cpc | franchise_q4_2026 | video_01_royalty |
| Telegram пост | telegram | post | franchise_q4_2026 | channel_post_01 |
| Telegram посев | telegram | seed | franchise_q4_2026 | seed_business_irkutsk |
| Instagram bio | instagram | organic | franchise_q4_2026 | bio_link |
| Instagram таргет | instagram | cpc | franchise_q4_2026 | reels_01_royalty |
| Каталог | catalog | listing | franchise_q4_2026 | franshiza_ru |

---

## Генератор (шаблон Google Sheets)

Колонки:
- A: Канал
- B: source
- C: medium
- D: campaign
- E: content
- F: `=CONCATENATE("https://[ДОМЕН]/?utm_source=",B2,"&utm_medium=",C2,"&utm_campaign=",D2,"&utm_content=",E2)`

---

## Проверка UTM

После перехода по ссылке:
1. Метрика → Отчёты → Источники → UTM-метки
2. Или в консоли браузера: `localStorage.getItem('rebar_utm')`

---

*Заменить `[ДОМЕН]` на финальный домен перед запуском рекламы.*


============================================================
# FILE: analytics/dashboard-spec-v1.md
============================================================

# Спецификация дашборда v1

**Версия:** 1.0 · сентябрь 2026  
**Инструмент:** Google Sheets (или Looker Studio M2+)  
**Обновление:** еженедельно (четверг), вручную M1 → автоматизация M2

---

## Структура файла

Один Google Sheets с 4 вкладками:

| Вкладка | Назначение | Источник данных |
|---------|------------|-----------------|
| `Сводка` | KPI недели/месяца | Формулы из других вкладок |
| `Трафик` | Визиты, заявки, CR по каналам | Метрика (ручной экспорт M1) |
| `Расходы` | Бюджет по каналам | Рекламные кабинеты |
| `CRM` | Воронка продаж | CRM (ручной экспорт) |

---

## Вкладка «Сводка»

### Блок 1 · KPI недели (строки 1–15)

| Ячейка | Метрика | Формула / источник |
|--------|---------|-------------------|
| B2 | Период | «16–22 сент 2026» (ручной ввод) |
| B3 | Расход всего | `=SUM(Расходы!B:B)` |
| B4 | Визиты | `=SUM(Трафик!C:C)` |
| B5 | Заявки | `=SUM(Трафик!D:D)` |
| B6 | CR лендинга | `=B5/B4` (формат %) |
| B7 | CPL (CAC лида) | `=B3/B5` |
| B8 | Квалифицированные | `=COUNTIF(CRM!G:G,"да")` |
| B9 | Zoom-встречи | `=COUNTIF(CRM!H:H,"<>")` |
| B10 | Договоры | `=COUNTIF(CRM!I:I,"<>")` |
| B11 | CAC договора | `=B3/B10` |
| B12 | ROMI | `=(B10*500000-B3)/B3` (LTV паушал ~500K) |

### Блок 2 · По каналам (строки 17–30)

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Канал | Расход | Визиты | Заявки | CPL | CR |
| Яндекс | формула | формула | формула | =B/C | =D/C |
| VK | … | … | … | … | … |
| Telegram | … | … | … | … | … |
| Instagram | … | … | … | … | … |
| Органика | 0 | … | … | — | … |

### Блок 3 · Цели vs план (строки 32–40)

| Метрика | Факт | План | % выполнения |
|---------|------|------|--------------|
| Заявки/мес | формула | 60 | =факт/план |
| CPL | формула | 1500 | =план/факт (инверсия) |
| Договоры/мес | формула | 2 | =факт/план |

---

## Вкладка «Трафик»

### Колонки

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Дата | utm_source | utm_medium | utm_campaign | utm_content | Визиты | Заявки (lead_submit) |

### Импорт из Метрики

1. Метрика → Отчёты → Источники → UTM-метки
2. Период: неделя
3. Метрики: Визиты, Достижения цели `lead_submit`
4. Группировка: utm_source, utm_medium, utm_campaign, utm_content
5. Экспорт CSV → вставить в вкладку

> M2+: подключить через API Метрики или коннектор Looker Studio.

---

## Вкладка «Расходы»

### Колонки

| A | B | C | D | E |
|---|---|---|---|---|
| Дата | Канал | Кампания | Расход ₽ | Примечание |

### Источники

| Канал | Где смотреть |
|-------|--------------|
| Яндекс | direct.yandex.ru → Статистика → Расход |
| VK | ads.vk.com → Статистика |
| Telegram | Вручную (чек посева) |
| Instagram | Meta Ads Manager |
| Креативы | Вручную (разовые) |

---

## Вкладка «CRM»

### Колонки

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Дата заявки | Имя | Телефон | Город | utm_source | utm_medium | utm_campaign | Квалиф. | Zoom | Договор |

### Импорт

Экспорт из AmoCRM / Битрикс24 → вставка раз в неделю.

---

## Условное форматирование

| Условие | Цвет |
|---------|------|
| CPL > 2 000 ₽ | 🔴 красный фон |
| CPL 1 000–2 000 ₽ | 🟡 жёлтый |
| CPL < 1 000 ₽ | 🟢 зелёный |
| CR < 1% | 🔴 |
| CR 1–3% | 🟢 |

---

## Looker Studio (M2+, опционально)

Подключить:
1. Google Sheets (эта таблица)
2. Яндекс.Метрика (коннектор)
3. CRM (через Sheets как прокси)

Дашборд: один экран, обновление daily.

---

## Создание (5 минут)

1. Google Sheets → Создать → назвать «re:bar · Marketing Dashboard»
2. Создать 4 вкладки по структуре выше
3. Заполнить заголовки колонок
4. Добавить формулы на вкладке «Сводка»
5. Поделиться с founder + менеджером (редактирование)

---

*Шаблон можно продублировать в Google Drive рядом с маркетинг-планом.*


============================================================
# FILE: analytics/weekly-report-template.md
============================================================

# Шаблон еженедельного отчёта

**Период:** _____________  
**Автор:** _____________  
**Дата:** _____________

---

## 1. Сводка (TL;DR)

> 2–3 предложения: что произошло за неделю, главный вывод, решение на следующую неделю.

---

## 2. Цифры

| Метрика | План | Факт | Δ | Комментарий |
|---------|------|------|---|-------------|
| Расход | | | | |
| Визиты | | | | |
| Заявки | | | | |
| CR лендинга | 1–3% | | | |
| CPL | < 1 500 ₽ | | | |
| Квалифицированные | | | | |
| Zoom | | | | |
| Договоры | | | | |

---

## 3. По каналам

### Яндекс.Директ
- Расход: _____ ₽
- Клики: _____ | CTR: _____%
- Заявки: _____ | CPL: _____ ₽
- Лучший креатив: _____________
- Худший креатив: _____________
- **Решение:** масштабировать / пауза / сменить креатив

### VK Реклама
- Расход: _____ ₽
- Показы: _____ | CTR: _____%
- Заявки: _____ | CPL: _____ ₽
- **Решение:** _____________

### Telegram
- Посевы: _____ ₽ | Посты: _____
- Переходы (оценка): _____
- Заявки: _____
- **Решение:** _____________

### Instagram
- Расход: _____ ₽
- Заявки: _____ | CPL: _____ ₽
- **Решение:** _____________

### Органика
- Визиты: _____
- Заявки: _____

---

## 4. A/B тесты

| Тест | Вариант A | Вариант B | Победитель | Действие |
|------|-----------|-----------|------------|----------|
| | | | | |

---

## 5. Качество лидов (от продажника)

- Всего заявок: _____
- Дозвонились: _____
- Квалифицированные: _____
- Причины отказов: _____________
- Обратная связь по каналам: _____________

---

## 6. Проблемы и блокеры

| Проблема | Влияние | Решение | Срок |
|----------|---------|---------|------|
| | | | |

---

## 7. План на следующую неделю

| # | Задача | Ответственный | Бюджет |
|---|--------|---------------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## 8. Решения founder

- [ ] Утвердить масштабирование канала: _____________
- [ ] Утвердить новый креатив: _____________
- [ ] Утвердить бюджет на след. неделю: _____ ₽

---

*Копировать в Google Docs / Notion каждый четверг. Хранить в папке `04-marketing/analytics/reports/`.*


============================================================
# FILE: analytics/tracking-snippet.html
============================================================

<!--
  re:bar franchise — tracking snippet v1
  Вставить в 01-landing/index.html

  ИНСТРУКЦИЯ:
  1. Заменить YM_ID, VK_PIXEL_ID, META_PIXEL_ID на реальные
  2. Блок <head> — счётчики
  3. Блок перед </body> — события и UTM
  4. Обновить обработчик leadForm (см. секцию FORM SUBMIT)
-->

<!-- ========== HEAD: счётчики ========== -->

<!-- Яндекс.Метрика -->
<script type="text/javascript">
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
  (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

  ym(YM_ID, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
    trackHash: true,
    ecommerce: "dataLayer"
  });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/YM_ID" style="position:absolute; left:-9999px;" alt="" /></div></noscript>

<!-- VK Pixel -->
<script type="text/javascript">
!function(){
  var t=document.createElement("script");
  t.type="text/javascript"; t.async=true;
  t.src="https://vk.com/js/api/openapi.js?169";
  t.onload=function(){ VK.Retargeting.Init("VK_PIXEL_ID"); VK.Retargeting.Hit(); };
  document.head.appendChild(t);
}();
</script>
<noscript><img src="https://vk.com/rtrg?p=VK_PIXEL_ID" style="position:fixed; left:-999px;" alt=""/></noscript>

<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'META_PIXEL_ID');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=META_PIXEL_ID&ev=PageView&noscript=1"/></noscript>

<!-- GA4 (опционально — раскомментировать) -->
<!--
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXX');
</script>
-->


<!-- ========== BODY (перед </body>): UTM + события ========== -->
<script>
(function(){
  'use strict';

  // --- Конфиг ---
  var YM_ID = '00000000';           // ← ЗАМЕНИТЬ
  var VK_PIXEL_ID = 'VK_PIXEL_ID';  // ← ЗАМЕНИТЬ
  var META_PIXEL_ID = 'META_PIXEL_ID'; // ← ЗАМЕНИТЬ
  var UTM_KEY = 'rebar_utm';
  var UTM_TTL_DAYS = 30;

  // --- UTM: сохранение при первом визите ---
  function parseUtm(){
    var p = new URLSearchParams(location.search);
    var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
    var utm = {};
    var found = false;
    keys.forEach(function(k){
      var v = p.get(k);
      if(v){ utm[k] = v; found = true; }
    });
    if(found){
      utm.landing_page = location.href;
      utm.referrer = document.referrer || '';
      utm.ts = Date.now();
      localStorage.setItem(UTM_KEY, JSON.stringify(utm));
    }
    return getUtm();
  }

  function getUtm(){
    try { return JSON.parse(localStorage.getItem(UTM_KEY)) || {}; }
    catch(e){ return {}; }
  }

  var utm = parseUtm();

  // --- Хелпер: отправка цели во все системы ---
  function track(event, params){
    params = params || {};
    // Метрика
    if(typeof ym === 'function'){
      ym(YM_ID, 'reachGoal', event, params);
    }
    // VK
    if(typeof VK !== 'undefined' && VK.Retargeting){
      var vkMap = { lead_submit:'lead', modal_open:'view_content' };
      if(vkMap[event]) VK.Retargeting.Event(vkMap[event]);
    }
    // Meta
    if(typeof fbq === 'function'){
      var metaMap = {
        lead_submit: 'Lead',
        modal_open: 'ViewContent',
        cta_click: 'InitiateCheckout'
      };
      if(metaMap[event]) fbq('track', metaMap[event], params);
    }
    // GA4
    if(typeof gtag === 'function'){
      var gaMap = { lead_submit:'generate_lead', modal_open:'modal_open', calc_use:'calculator_use' };
      if(gaMap[event]) gtag('event', gaMap[event], params);
    }
  }

  // --- Скролл 75% ---
  var scroll75 = false;
  window.addEventListener('scroll', function(){
    if(scroll75) return;
    var pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
    if(pct >= 0.75){ scroll75 = true; track('scroll_75'); }
  }, {passive:true});

  // --- Время 60 сек ---
  setTimeout(function(){ track('time_60s'); }, 60000);

  // --- CTA клики ---
  document.addEventListener('click', function(e){
    if(e.target.closest('[data-open-modal]')){
      track('cta_click', { page_section: getSection(e.target) });
    }
  });

  function getSection(el){
    var sec = el.closest('section');
    return sec ? (sec.id || 'unknown') : 'unknown';
  }

  // --- Модалка: открытие ---
  var origOpenModal = window.openModal;
  // Перехват через MutationObserver на modalBack
  var modalBack = document.getElementById('modalBack');
  if(modalBack){
    var obs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if(m.attributeName === 'class' && modalBack.classList.contains('on')){
          track('modal_open', { page_section: 'modal' });
        }
      });
    });
    obs.observe(modalBack, { attributes:true });
  }

  // --- Калькулятор ---
  var calcTracked = false;
  ['inv','rev','mix'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('input', function(){
      if(!calcTracked){ calcTracked = true; track('calc_use'); }
    });
  });
  var fmt = document.getElementById('fmt');
  if(fmt){
    fmt.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', function(){
        track('calc_format', { format: b.textContent.trim() });
      });
    });
  }

  // --- FORM SUBMIT: заменить существующий обработчик ---
  // Вставить ВМЕСТО текущего setTimeout в leadForm submit:
  //
  // track('lead_submit', {
  //   utm_source: utm.utm_source || 'direct',
  //   utm_medium: utm.utm_medium || 'none',
  //   utm_campaign: utm.utm_campaign || '',
  //   utm_content: utm.utm_content || '',
  //   has_city: !!document.getElementById('leadCity').value,
  //   has_note: !!document.getElementById('leadNote').value
  // });
  //
  // + отправка в CRM webhook (когда будет готов)

  // Экспорт для интеграции с формой
  window.rebarTrack = track;
  window.rebarUtm = getUtm;

})();
</script>
