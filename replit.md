# TraderMind OS

ژورنال معاملاتی حرفه‌ای — نرم‌افزار دسکتاپ آفلاین برای ثبت، تحلیل و بهبود معاملات.

## Run & Operate

- `pnpm --filter @workspace/tradermind run dev` — اجرا در Replit (پیش‌نمایش وب)
- `pnpm run typecheck` — بررسی TypeScript کل پروژه
- `pnpm run build` — typecheck + build کامل
- `pnpm --filter @workspace/tradermind run test` — اجرای تست‌ها

## ساخت setup.exe و APK (GitHub Actions)

با tag زدن یک نسخه جدید، هر دو فرآیند خودکار اجرا می‌شوند:

```bash
git tag v1.2.0
git push origin v1.2.0
```

فایل‌های خروجی در بخش **Releases** گیت‌هاب قرار می‌گیرند:
- `TraderMind-Setup-1.2.0.exe` (ویندوز — از workflow `build-electron.yml`)
- `TraderMind-1.2.0.apk` (اندروید — از workflow `build-android.yml`)

## Stack

- pnpm workspaces، Node.js 20+، TypeScript 5.9
- **Frontend:** React 19، Vite 7، Tailwind CSS v4، shadcn/ui
- **Desktop:** Electron 36 + electron-builder (NSIS installer)
- **Mobile:** Capacitor 7 + Android SDK
- **Database:** Dexie (IndexedDB) — کاملاً آفلاین، بدون سرور
- **State:** Zustand
- **Charts:** Recharts

## ساختار پروژه

```
artifacts/
  tradermind/           # اپلیکیشن اصلی TraderMind OS
    electron/           # فایل‌های اصلی Electron (main.ts, preload.ts)
    src/                # کد React (pages, components, services, db)
    public/             # آیکون و فایل‌های استاتیک
    electron-builder.json   # تنظیمات بسته‌بندی نصب‌کننده
    capacitor.config.ts     # تنظیمات Capacitor برای اندروید
  api-server/           # Express API server (برای نسخه وب Replit)
lib/                    # کتابخانه‌های مشترک
.github/workflows/      # GitHub Actions برای ساخت خودکار
  build-electron.yml    # ساخت .exe (ویندوز) و .dmg (مک)
  build-android.yml     # ساخت .apk (اندروید)
```

## Architecture

- برنامه کاملاً آفلاین — تمام داده‌ها در IndexedDB (Dexie v4) ذخیره می‌شوند
- در Replit به عنوان وب‌اپ اجرا می‌شود؛ در تولید به عنوان Electron desktop app
- Router از hash-based navigation استفاده می‌کند تا هم در مرورگر و هم در `file://` کار کند
- برای اندروید، Capacitor با `https://localhost` سرو می‌کند (نه `file://`)

## User preferences

- زبان کد: TypeScript / کامنت‌های فارسی
- نصب‌کننده: NSIS با پشتیبانی زبان فارسی
- هدف: کاربران ایرانی

## Gotchas

- برای ساخت `.exe` حتماً از GitHub Actions استفاده کنید — Replit محیط Linux است
- `android/` پوشه توسط `cap add android` در CI ایجاد می‌شود؛ نیازی به commit نیست
- `electron-builder.json` فایل `public/icon.png` را برای آیکون استفاده می‌کند
- `tsconfig.electron.json` جداگانه است و Electron main را کامپایل می‌کند

## Pointers

- Schema DB: `artifacts/tradermind/src/db/database.ts`
- ورودی اپ: `artifacts/tradermind/src/App.tsx`
- Electron main: `artifacts/tradermind/electron/main.ts`
- تنظیمات build: `artifacts/tradermind/electron-builder.json`
- Capacitor config: `artifacts/tradermind/capacitor.config.ts`
- GitHub Actions: `.github/workflows/`

## See also

- `pnpm-workspace` skill — ساختار monorepo و TypeScript
