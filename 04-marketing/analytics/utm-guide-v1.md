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
