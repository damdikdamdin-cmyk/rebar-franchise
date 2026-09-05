# Скилы для лендингов и веб-дизайна

Собрано из github.com/anthropics/skills (официальные) и github.com/jezweb/claude-skills (комьюнити) — 19 августа 2026.

## Как установить .skill в аккаунт Claude

Двойной клик на `.skill` файле в Claude (веб или десктоп) → если организация разрешает, появится кнопка «Install skill». В Claude Code — распакуйте в `~/.claude/skills/<имя>/`.

## Что где

### Официальные (Anthropic) — работают везде

| Файл | Про что |
|---|---|
| `frontend-design.skill` | Дизайн-мышление: типографика, палитра, «не как из шаблона», намеренные визуальные решения. Читайте ПЕРЕД тем как писать первую строку UI. |
| `web-artifacts-builder.skill` | React 18 + TypeScript + Vite + Tailwind + shadcn/ui — для сложных claude.ai артефактов с состоянием, роутингом. |
| `theme-factory.skill` | 10 готовых тем (цвета+шрифты) для лендингов, слайдов, документов + генератор новых тем. |
| `canvas-design.skill` | Плакаты, статичный визуальный арт в .png / .pdf через дизайн-философию. |
| `brand-guidelines.skill` | Шаблон бренд-системы (цвета, шрифты, тон). Пример — Anthropic. |
| `algorithmic-art.skill` | Генеративный p5.js арт (particles, flow fields) — крутые hero-секции и фоны. |

### Комьюнити (jezweb/claude-skills) — заточены под Claude Code CLI, но SKILL.md отлично читается как гайд

| Файл | Про что |
|---|---|
| `landing-page.skill` | Полный генератор одностраничного лендинга: single-file HTML + Tailwind CDN, hero/features/pricing/FAQ/footer, dark mode, OG-теги. |
| `design-system.skill` | Извлечь дизайн-систему из живого сайта или скрина → `DESIGN.md`, чтобы генерировать страницы в едином стиле. |
| `tailwind-theme-builder.skill` | Tailwind v4 + shadcn/ui + dark mode + CSS-переменные через `@theme inline`. Решает проблемы миграции v3→v4. |
| `shadcn-ui.skill` | Установка и настройка компонентов shadcn/ui поверх темы. Рецепты форм, таблиц, навигации. |
| `design-review.skill` | Ревью визуального качества страницы: типографика, отступы, иерархия. «Выглядит как сделал дизайнер или разработчик?» |

## Рекомендуемая связка для «крутого современного лендинга»

1. **frontend-design** — задаёт направление и не даёт скатиться в шаблонный AI-look.
2. **theme-factory** ИЛИ **tailwind-theme-builder** — фиксирует палитру и шрифты.
3. **landing-page** ИЛИ **web-artifacts-builder** — строит саму страницу (single-file или React).
4. **shadcn-ui** — если нужны сложные интерактивные компоненты.
5. **design-review** — финальный проход, чтобы поймать «выглядит недожатым».
6. **algorithmic-art** / **canvas-design** — генеративная графика и hero-визуалы, если хочется вау.

## Источники

- https://github.com/anthropics/skills
- https://github.com/jezweb/claude-skills
