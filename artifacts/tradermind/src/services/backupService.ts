import JSZip from 'jszip';
import { db, Trade, Strategy, Phase, Step, Rule, AnalysisSession, DailyJournal } from '../db/database';
import { securityService } from '../security/securityService';
import { APP_VERSION, DB_VERSION, BACKUP_FORMAT_VERSION, SCHEMA_VERSION } from '../constants/version';

export { APP_VERSION, DB_VERSION, BACKUP_FORMAT_VERSION, SCHEMA_VERSION };

const STORAGE_KEY_HISTORY = 'tradermind-backup-history';
const STORAGE_KEY_APP = 'tradermind-app-storage';
const STORAGE_KEY_LAST = 'tradermind-last-backup';

// ─────────────────────────────────────────────
// انواع
// ─────────────────────────────────────────────
export interface BackupMetadata {
  appName: string;
  backupVersion: string;
  appVersion: string;
  databaseVersion: number;
  /** نسخه Schema — اضافه شده در v3.0 */
  schemaVersion: number;
  createdAt: string;
  totalRecords: number;
  /** SHA-256 از JSON رشته‌ای داده‌ها — برای بررسی یکپارچگی */
  checksum?: string;
  /** آیا داده‌ها رمزگذاری شده‌اند؟ */
  encrypted?: boolean;
}

export interface BackupData {
  metadata: BackupMetadata;
  data: {
    strategies: Strategy[];
    phases: Phase[];
    steps: Step[];
    rules: Rule[];
    analysisSessions: AnalysisSession[];
    trades: Trade[];
    dailyJournals: DailyJournal[];
    settings: Record<string, string>;
    // فیلدهای اختیاری — ممکن است در نسخه‌های قدیمی‌تر وجود نداشته باشند
    tradeEvents?: unknown[];
    tradeVersions?: unknown[];
    chartScreenshots?: unknown[];
    riskViolations?: unknown[];
    replaySessions?: unknown[];
    replayDecisions?: unknown[];
    knowledgeNotes?: unknown[];
    liveTrades?: unknown[];
    accounts?: unknown[];
    tradingBoxes?: unknown[];
    performanceReviews?: unknown[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: BackupMetadata;
  parsedData?: BackupData['data'];
  needsPassword?: boolean;
}

export interface MergeStats {
  added: number;
  updated: number;
  skipped: number;
}

export interface BackupHistoryItem {
  id: string;
  createdAt: string;
  size: number;
  type: 'export' | 'import';
  mode?: 'replace' | 'merge';
  status: 'success' | 'failed';
  recordCount: number;
  encrypted?: boolean;
}

// ─────────────────────────────────────────────
// ساخت payload داده
// ─────────────────────────────────────────────
async function buildBackupData() {
  const [strategies, phases, steps, rules, analysisSessions, trades, dailyJournals] =
    await Promise.all([
      db.strategies.toArray(),
      db.phases.toArray(),
      db.steps.toArray(),
      db.rules.toArray(),
      db.analysisSessions.toArray(),
      db.trades.toArray(),
      db.dailyJournals.toArray(),
    ]);

  const settings = backupService.exportSettings();
  const totalRecords =
    strategies.length + phases.length + steps.length + rules.length +
    analysisSessions.length + trades.length + dailyJournals.length;

  const data: BackupData['data'] = {
    strategies, phases, steps, rules, analysisSessions, trades, dailyJournals, settings,
  };

  // محاسبه Checksum برای بررسی یکپارچگی
  const dataJson = JSON.stringify(data);
  const checksum = await securityService.sha256(dataJson);

  const metadata: BackupMetadata = {
    appName: 'TraderMind',
    backupVersion: BACKUP_FORMAT_VERSION,
    appVersion: APP_VERSION,
    databaseVersion: DB_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    totalRecords,
    checksum,
  };

  return { data, metadata, totalRecords };
}

// ─────────────────────────────────────────────
// ساخت و دانلود ZIP
// ─────────────────────────────────────────────
async function buildAndDownloadZip(
  payload: BackupData,
  filename: string,
  trades: any[],
): Promise<number> {
  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify(payload, null, 2));

  // تصاویر معاملات
  const mediaFolder = zip.folder('media');
  let mediaIndex = 1;
  for (const trade of trades) {
    if (trade.screenshots) {
      try {
        const screenshots: Array<{ id: string; dataUrl: string }> = JSON.parse(trade.screenshots);
        for (const sc of screenshots) {
          if (sc.dataUrl?.startsWith('data:')) {
            const ext = sc.dataUrl.split(';')[0].split('/')[1] || 'webp';
            const base64 = sc.dataUrl.split(',')[1];
            mediaFolder?.file(`image-${String(mediaIndex).padStart(3, '0')}.${ext}`, base64, { base64: true });
            mediaIndex++;
          }
        }
      } catch { /* تصویر نادرست نادیده گرفته می‌شود */ }
    }
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return zipBlob.size;
}

// ─────────────────────────────────────────────
// PART 8: ساخت و دانلود .gz با CompressionStream
// ─────────────────────────────────────────────
async function buildAndDownloadGz(
  payload: BackupData,
  filename: string,
): Promise<number> {
  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(jsonStr);

  // CompressionStream API — مدرن و بدون نیاز به کتابخانه
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  const writePromise = (async () => {
    await writer.write(uint8Array);
    await writer.close();
  })();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  await writePromise;

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

  const gzBlob = new Blob([merged], { type: 'application/gzip' });
  const url = URL.createObjectURL(gzBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return gzBlob.size;
}

/** decompress یک فایل .gz و برگرداندن JSON string */
async function decompressGz(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  const writePromise = (async () => {
    await writer.write(new Uint8Array(arrayBuffer));
    await writer.close();
  })();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  await writePromise;

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

  return new TextDecoder().decode(merged);
}

// ─────────────────────────────────────────────
// سرویس اصلی
// ─────────────────────────────────────────────
export const backupService = {
  // ────────── Export معمولی (.gz) ──────────
  async exportAll(): Promise<void> {
    const { data, metadata, totalRecords } = await buildBackupData();
    const payload: BackupData = { metadata, data };

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const filename = `TraderMind_Backup_${dateStr}_${timeStr}.tradermind-backup.gz`;

    const size = await buildAndDownloadGz(payload, filename);

    localStorage.setItem(STORAGE_KEY_LAST, new Date().toISOString());
    this.addToHistory({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      size,
      type: 'export',
      status: 'success',
      recordCount: totalRecords,
    });
  },

  // ────────── Export رمزگذاری‌شده ──────────
  /**
   * Backup رمزگذاری‌شده با AES-GCM
   * داده‌ها با رمز عبور کاربر رمزگذاری می‌شوند.
   * بدون رمز، محتوا قابل خواندن نیست.
   */
  async exportEncrypted(password: string): Promise<void> {
    const { data, metadata, totalRecords } = await buildBackupData();

    const dataJson = JSON.stringify(data);
    const encryptedData = await securityService.encrypt(dataJson, password);

    const encPayload = {
      metadata: { ...metadata, encrypted: true, checksum: undefined },
      encryptedData,
    };

    const zip = new JSZip();
    zip.file('backup.json', JSON.stringify(encPayload, null, 2));

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const filename = `TraderMind_Backup_Encrypted_${dateStr}_${timeStr}.zip`;

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem(STORAGE_KEY_LAST, new Date().toISOString());
    this.addToHistory({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      size: zipBlob.size,
      type: 'export',
      status: 'success',
      recordCount: totalRecords,
      encrypted: true,
    });
  },

  // ────────── رمزگشایی Backup رمزگذاری‌شده ──────────
  async decryptBackup(file: File, password: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file('backup.json');
      if (!jsonFile) {
        errors.push('فایل backup.json در آرشیو یافت نشد.');
        return { valid: false, errors, warnings };
      }
      const jsonStr = await jsonFile.async('string');
      let parsed: any;
      try { parsed = JSON.parse(jsonStr); } catch {
        errors.push('فایل backup.json خراب است.');
        return { valid: false, errors, warnings };
      }

      if (!parsed?.metadata?.encrypted || !parsed.encryptedData) {
        errors.push('این فایل رمزگذاری‌شده نیست.');
        return { valid: false, errors, warnings };
      }

      let decryptedJson: string;
      try {
        decryptedJson = await securityService.decrypt(parsed.encryptedData, password);
      } catch {
        errors.push('رمز عبور صحیح نیست یا فایل قابل بازیابی نیست.');
        return { valid: false, errors, warnings };
      }

      let data: any;
      try { data = JSON.parse(decryptedJson); } catch {
        errors.push('داده‌های رمزگشایی‌شده خراب هستند.');
        return { valid: false, errors, warnings };
      }

      return { valid: true, errors, warnings, metadata: parsed.metadata, parsedData: data };
    } catch {
      errors.push('خطا در باز کردن فایل.');
      return { valid: false, errors, warnings };
    }
  },

  // ────────── تنظیمات ──────────
  exportSettings(): Record<string, string> {
    const settings: Record<string, string> = {};
    const val = localStorage.getItem(STORAGE_KEY_APP);
    if (val) settings[STORAGE_KEY_APP] = val;
    return settings;
  },

  importSettings(settings: Record<string, string>) {
    for (const [key, value] of Object.entries(settings)) {
      localStorage.setItem(key, value);
    }
  },

  // ────────── اعتبارسنجی ──────────
  async validateFile(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (file.name.endsWith('.json')) {
      return this.validateLegacyJson(file);
    }

    // PART 8: پشتیبانی از فرمت جدید .gz
    if (file.name.endsWith('.gz') || file.name.includes('.tradermind-backup')) {
      try {
        const jsonStr = await decompressGz(file);
        let parsed: any;
        try { parsed = JSON.parse(jsonStr); } catch {
          errors.push('محتوای فایل .gz خراب است.');
          return { valid: false, errors, warnings };
        }
        return this.validateParsed(parsed, errors, warnings);
      } catch {
        errors.push('خطا در decompress فایل .gz. فایل ممکن است آسیب دیده باشد.');
        return { valid: false, errors, warnings };
      }
    }

    if (!file.name.endsWith('.zip') && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      errors.push('فرمت فایل پشتیبان پشتیبانی نمی‌شود. فایل باید .tradermind-backup.gz، ZIP یا JSON باشد.');
      return { valid: false, errors, warnings };
    }

    try {
      const zip = await JSZip.loadAsync(file);
      const backupJsonFile = zip.file('backup.json');
      if (!backupJsonFile) {
        errors.push('فایل backup.json در آرشیو پشتیبان یافت نشد.');
        return { valid: false, errors, warnings };
      }

      const jsonStr = await backupJsonFile.async('string');
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        errors.push('فایل backup.json خراب است و قابل خواندن نیست.');
        return { valid: false, errors, warnings };
      }

      if (parsed?.metadata?.encrypted) {
        return { valid: true, errors, warnings, metadata: parsed.metadata, needsPassword: true };
      }

      return this.validateParsed(parsed, errors, warnings);
    } catch {
      errors.push('خطا در باز کردن فایل ZIP. فایل ممکن است آسیب دیده باشد.');
      return { valid: false, errors, warnings };
    }
  },

  async validateLegacyJson(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed.version === 1 || parsed.exportedAt) {
        warnings.push('فایل پشتیبان از نسخه قدیمی برنامه است. برخی اطلاعات ممکن است ناقص باشد.');
        const data = {
          strategies: parsed.strategies || [],
          phases: parsed.phases || [],
          steps: parsed.steps || [],
          rules: parsed.rules || [],
          analysisSessions: parsed.analysisSessions || [],
          trades: parsed.trades || [],
          dailyJournals: parsed.dailyJournals || [],
          settings: {},
        };
        const total = Object.values(data).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
        return {
          valid: true, errors, warnings,
          metadata: {
            appName: 'TraderMind',
            backupVersion: '1.0',
            appVersion: 'قدیمی',
            databaseVersion: parsed.version || 1,
            schemaVersion: 1,
            createdAt: parsed.exportedAt ? new Date(parsed.exportedAt).toISOString() : new Date().toISOString(),
            totalRecords: total,
          },
          parsedData: data,
        };
      }

      errors.push('فایل پشتیبان معتبر نیست یا متعلق به برنامه دیگری است.');
      return { valid: false, errors, warnings };
    } catch {
      errors.push('فایل JSON خراب است و قابل خواندن نیست.');
      return { valid: false, errors, warnings };
    }
  },

  async validateParsed(parsed: any, errors: string[], warnings: string[]): Promise<ValidationResult> {
    if (!parsed?.metadata) {
      errors.push('ساختار فایل پشتیبان معتبر نیست (metadata یافت نشد).');
      return { valid: false, errors, warnings };
    }
    if (parsed.metadata.appName !== 'TraderMind') {
      errors.push('این فایل متعلق به برنامه دیگری است.');
      return { valid: false, errors, warnings };
    }
    if (!parsed.metadata.backupVersion) {
      errors.push('نسخه فایل پشتیبان مشخص نیست.');
      return { valid: false, errors, warnings };
    }
    if (!parsed.data) {
      errors.push('داده‌های پشتیبان یافت نشد.');
      return { valid: false, errors, warnings };
    }

    // PART 5: بررسی schemaVersion
    if (parsed.metadata.schemaVersion && parsed.metadata.schemaVersion < SCHEMA_VERSION) {
      warnings.push(`This backup was created on an older database version (schema v${parsed.metadata.schemaVersion} → current v${SCHEMA_VERSION}). Some fields may be missing.`);
    }
    if (!parsed.metadata.schemaVersion) {
      warnings.push('This backup was created on an older database version. Some fields may be missing.');
    }

    // بررسی Checksum
    if (parsed.metadata.checksum) {
      try {
        const actualChecksum = await securityService.sha256(JSON.stringify(parsed.data));
        if (actualChecksum !== parsed.metadata.checksum) {
          errors.push('یکپارچگی فایل تأیید نشد — فایل احتمالاً تغییر کرده یا خراب است.');
          return { valid: false, errors, warnings };
        }
      } catch {
        warnings.push('بررسی یکپارچگی فایل ممکن نبود.');
      }
    }

    // بررسی ساختار آرایه‌های اصلی
    const requiredArrays = ['strategies', 'phases', 'steps', 'analysisSessions', 'trades', 'dailyJournals'];
    for (const key of requiredArrays) {
      if (parsed.data[key] !== undefined && !Array.isArray(parsed.data[key])) {
        errors.push(`ساختار داده‌های "${key}" معتبر نیست.`);
      }
    }
    if (errors.length > 0) return { valid: false, errors, warnings };

    // ── PART 7: روابط trade ──────────────────────────────────────────────
    const tradeIds = new Set((parsed.data.trades || []).map((t: any) => t.id).filter(Boolean));

    // trade → tradeEvents
    if (Array.isArray(parsed.data.tradeEvents)) {
      const orphans = parsed.data.tradeEvents.filter((e: any) => e.tradeId && !tradeIds.has(e.tradeId));
      if (orphans.length > 0) warnings.push(`${orphans.length} رویداد معامله بدون معامله معتبر (orphan tradeEvents).`);
    }
    // trade → tradeVersions
    if (Array.isArray(parsed.data.tradeVersions)) {
      const orphans = parsed.data.tradeVersions.filter((v: any) => v.tradeId && !tradeIds.has(v.tradeId));
      if (orphans.length > 0) warnings.push(`${orphans.length} نسخه معامله بدون معامله معتبر (orphan tradeVersions).`);
    }
    // trade → chartScreenshots
    if (Array.isArray(parsed.data.chartScreenshots)) {
      const corrupt = parsed.data.chartScreenshots.filter((s: any) => !s.id || (s.dataUrl === undefined && s.imageBlob === undefined));
      if (corrupt.length > 0) warnings.push(`${corrupt.length} اسکرین‌شات خراب یا بدون تصویر (corrupted screenshots).`);
      const orphans = parsed.data.chartScreenshots.filter((s: any) => s.tradeId && !tradeIds.has(s.tradeId));
      if (orphans.length > 0) warnings.push(`${orphans.length} اسکرین‌شات بدون معامله معتبر (orphan chartScreenshots).`);
    }
    // trade → riskViolations
    if (Array.isArray(parsed.data.riskViolations)) {
      const orphans = parsed.data.riskViolations.filter((r: any) => r.tradeId && !tradeIds.has(r.tradeId));
      if (orphans.length > 0) warnings.push(`${orphans.length} تخلف ریسک بدون معامله معتبر (orphan riskViolations).`);
    }
    // replaySession → replayDecisions
    if (Array.isArray(parsed.data.replaySessions) && Array.isArray(parsed.data.replayDecisions)) {
      const sessionIds = new Set((parsed.data.replaySessions || []).map((s: any) => s.id).filter(Boolean));
      const orphans = parsed.data.replayDecisions.filter((d: any) => d.sessionId && !sessionIds.has(d.sessionId));
      if (orphans.length > 0) warnings.push(`${orphans.length} تصمیم replay بدون session معتبر (orphan replayDecisions).`);
    }

    // بررسی روابط strategy
    const strategyIds = new Set((parsed.data.strategies || []).map((s: any) => s.id));
    const phaseIds = new Set((parsed.data.phases || []).map((p: any) => p.id));
    const stepIds = new Set((parsed.data.steps || []).map((s: any) => s.id));
    const orphanPhases = (parsed.data.phases || []).filter((p: any) => p.strategyId && !strategyIds.has(p.strategyId));
    if (orphanPhases.length > 0) warnings.push(`${orphanPhases.length} فاز بدون استراتژی معتبر یافت شد.`);
    const orphanSteps = (parsed.data.steps || []).filter((s: any) => s.phaseId && !phaseIds.has(s.phaseId));
    if (orphanSteps.length > 0) warnings.push(`${orphanSteps.length} مرحله بدون فاز معتبر یافت شد.`);
    const orphanRules = (parsed.data.rules || []).filter((r: any) => r.stepId && !stepIds.has(r.stepId));
    if (orphanRules.length > 0) warnings.push(`${orphanRules.length} قانون بدون مرحله معتبر یافت شد.`);

    return { valid: true, errors, warnings, metadata: parsed.metadata, parsedData: parsed.data };
  },

  // ────────── PART 6: Safe Restore ──────────
  /**
   * Flow امن بازیابی:
   * 1. Parse + Validate کامل (بدون لمس DB)
   * 2. اگر validation گذشت → Atomic Clear + bulkAdd
   * 3. در صورت شکست هر مرحله → DB دست‌نخورده می‌ماند
   */
  async safeRestore(file: File): Promise<{ success: boolean; warnings: string[]; error?: string }> {
    // مرحله ۱: parse + validate
    const validation = await this.validateFile(file);
    if (!validation.valid) {
      return { success: false, warnings: validation.warnings, error: validation.errors.join(' | ') };
    }
    const data = validation.parsedData;
    if (!data) {
      return { success: false, warnings: validation.warnings, error: 'داده‌های پارس‌شده یافت نشد.' };
    }

    // مرحله ۲: Atomic Replace — فقط پس از validation موفق
    try {
      await this.importReplace(data);
    } catch (e: unknown) {
      return {
        success: false,
        warnings: validation.warnings,
        error: `خطا در بازنویسی دیتابیس: ${(e as { message?: string })?.message ?? 'unknown'}`,
      };
    }

    return { success: true, warnings: validation.warnings };
  },

  // ────────── جایگزینی کامل ──────────
  /**
   * Atomic full restore: تمام جداول (core + extended) در یک Dexie transaction.
   * اگر هر مرحله‌ای fail شود، Dexie کل عملیات را rollback می‌کند و DB سالم می‌ماند.
   */
  async importReplace(data: BackupData['data']): Promise<void> {
    // همه جداول موجود در backup را در یک transaction restore می‌کنیم
    const tables = [
      db.strategies, db.phases, db.steps, db.rules,
      db.analysisSessions, db.trades, db.dailyJournals,
      db.tradeEvents, db.tradeVersions, db.chartScreenshots,
      db.riskViolations, db.replaySessions, db.replayDecisions,
      db.knowledgeNotes, db.accounts, db.tradingBoxes,
      db.performanceReviews,
    ];

    await db.transaction('rw', tables, async () => {
      // ── پاکسازی همه جداول ──
      await Promise.all(tables.map(t => t.clear()));

      // ── جداول اصلی ──
      if (data.strategies?.length)      await db.strategies.bulkAdd(data.strategies as Strategy[]);
      if (data.phases?.length)          await db.phases.bulkAdd(data.phases as Phase[]);
      if (data.steps?.length)           await db.steps.bulkAdd(data.steps as Step[]);
      if (data.rules?.length)           await db.rules.bulkAdd(data.rules as Rule[]);
      if (data.analysisSessions?.length) await db.analysisSessions.bulkAdd(data.analysisSessions as AnalysisSession[]);
      if (data.trades?.length)          await db.trades.bulkAdd(data.trades as Trade[]);
      if (data.dailyJournals?.length)   await db.dailyJournals.bulkAdd(data.dailyJournals as DailyJournal[]);

      // ── جداول اضافی (اختیاری — ممکن است در backup قدیمی نباشند) ──
      if (data.tradeEvents?.length)       await db.tradeEvents.bulkAdd(data.tradeEvents as any[]);
      if (data.tradeVersions?.length)     await db.tradeVersions.bulkAdd(data.tradeVersions as any[]);
      if (data.chartScreenshots?.length)  await db.chartScreenshots.bulkAdd(data.chartScreenshots as any[]);
      if (data.riskViolations?.length)    await db.riskViolations.bulkAdd(data.riskViolations as any[]);
      if (data.replaySessions?.length)    await db.replaySessions.bulkAdd(data.replaySessions as any[]);
      if (data.replayDecisions?.length)   await db.replayDecisions.bulkAdd(data.replayDecisions as any[]);
      if (data.knowledgeNotes?.length)    await db.knowledgeNotes.bulkAdd(data.knowledgeNotes as any[]);
      if (data.accounts?.length)          await db.accounts.bulkAdd(data.accounts as any[]);
      if (data.tradingBoxes?.length)      await db.tradingBoxes.bulkAdd(data.tradingBoxes as any[]);
      if (data.performanceReviews?.length) await db.performanceReviews.bulkAdd(data.performanceReviews as any[]);
    });

    // Settings در localStorage ذخیره می‌شود — خارج از IndexedDB transaction (قابل قبول)
    if (data.settings) this.importSettings(data.settings);
  },

  // ────────── ادغام (Keep Newest) ──────────
  async importMerge(data: BackupData['data']): Promise<MergeStats> {
    const stats: MergeStats = { added: 0, updated: 0, skipped: 0 };

    const mergeTable = async (table: any, items: any[]) => {
      for (const item of items) {
        if (!item?.id) { stats.skipped++; continue; }
        const existing = await table.get(item.id);
        if (!existing) {
          await table.add(item);
          stats.added++;
        } else {
          const existingTime = existing.updatedAt ?? existing.createdAt ?? 0;
          const backupTime = item.updatedAt ?? item.createdAt ?? 0;
          if (backupTime > existingTime) {
            await table.put(item);
            stats.updated++;
          } else {
            stats.skipped++;
          }
        }
      }
    };

    await mergeTable(db.strategies, data.strategies || []);
    await mergeTable(db.phases, data.phases || []);
    await mergeTable(db.steps, data.steps || []);
    await mergeTable(db.rules, data.rules || []);
    await mergeTable(db.analysisSessions, data.analysisSessions || []);
    await mergeTable(db.trades, data.trades || []);
    await mergeTable(db.dailyJournals, data.dailyJournals || []);

    return stats;
  },

  // ────────── پاک کردن همه داده‌ها ──────────
  async resetAll(): Promise<void> {
    await db.transaction('rw',
      [db.strategies, db.phases, db.steps, db.rules,
       db.analysisSessions, db.trades, db.dailyJournals],
      async () => {
        await Promise.all([
          db.strategies.clear(), db.phases.clear(), db.steps.clear(),
          db.rules.clear(), db.analysisSessions.clear(),
          db.trades.clear(), db.dailyJournals.clear(),
        ]);
      }
    );
  },

  // ────────── تاریخچه ──────────
  getHistory(): BackupHistoryItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  addToHistory(item: BackupHistoryItem) {
    const history = this.getHistory();
    history.unshift(item);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 20)));
  },

  clearHistory() {
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  },

  // ────────── خروجی Excel ──────────
  async exportToExcel(): Promise<void> {
    const trades = await db.trades.toArray();

    const rows = trades.map(t => ({
      تاریخ: t.openedAt ? new Date(t.openedAt).toLocaleDateString('fa-IR') : '',
      نماد: t.symbol,
      جهت: t.direction === 'long' ? 'خرید (Long)' : 'فروش (Short)',
      وضعیت: t.status,
      نتیجه: t.result,
      'سود/زیان (R)': t.rMultiple ?? '',
      'سود/زیان ($)': t.profitLoss ?? '',
      'نسبت R/R برنامه‌ریزی‌شده': t.plannedRR ?? '',
      'حجم موقعیت': t.positionSize ?? '',
      'ریسک %': t.riskPercentage ?? '',
      'قیمت ورود': t.entryPrice,
      'قیمت خروج': t.exitPrice ?? '',
      'حد ضرر': t.stopLoss,
      'هدف سود': t.takeProfit ?? '',
      'جلسه معاملاتی': t.tradingSession ?? '',
      ست‌آپ: t.setupType ?? '',
      'دلیل ورود': t.entryReason ?? '',
      'دلیل خروج': t.reasonForExit ?? '',
      یادداشت: t.notes ?? '',
      'درس‌آموخته': t.lesson ?? '',
    }));

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'معاملات');

    // عرض ستون‌ها
    if (rows.length) {
      ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 18 }));
    }

    const filename = `tradermind_trades_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  },
};
