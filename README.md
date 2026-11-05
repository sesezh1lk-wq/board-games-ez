# ez board game

Подбор настольных игр по тем, что уже понравились. Тот же сайт, что на Cloudflare Workers: данные лежат в `public/data.json`, рекомендация считается в браузере.

Живая копия на GitHub Pages: https://sesezh1lk-wq.github.io/board-games-ez/

## Локально

```powershell
npm ci
npm run dev
```

Сборка: `npm run build`. В `vite.config.ts` стоит `base: './'`, поэтому `dist/` открывается и с корня домена, и из подпапки репозитория на GitHub Pages.

## Публикация

Пуш в `main` запускает `.github/workflows/pages.yml`: сборка и деплой через GitHub Actions. Источник Pages в настройках репозитория — **GitHub Actions**, не ветка.
