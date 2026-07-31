import { contextBridge } from 'electron';

// اگر در آینده نیاز به API های Node.js داشتید اینجا expose کنید
// فعلاً خالی است چون برنامه فقط از IndexedDB استفاده می‌کند
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.env.npm_package_version ?? '1.0.0',
});
