# re:bar Hub — архив

**Розница и франшиза объединены в [re:bar OS](../06-crm/)** → [http://localhost:3100](http://localhost:3100).

Этот каталог (`05-hub`, порт 3000) больше не развивается как отдельная платформа. Код сохранён для справки и cutover-чеклистов LiveSklad → Hub; рабочие маршруты POS/склада/печати перенесены в `06-crm`.

```bash
cd ../06-crm
npm run dev   # http://localhost:3100
```

Демо-пароль OS: `rebar-os` (см. `06-crm/README.md`).

Чеклист миграции точек с LiveSklad: `03-crm-and-ops/crm/cutover-ulan-irkutsk.md` (пути учёта теперь в OS).
