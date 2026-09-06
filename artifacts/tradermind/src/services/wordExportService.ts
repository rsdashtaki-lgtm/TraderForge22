import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db, dataUrlToBlob, type Trade } from '../db/database';

type ImageSource = {
  id: string;
  label: string;
  blob: Blob;
  width?: number | null;
  height?: number | null;
};

const rtlText = (text: string, bold = false) =>
  new TextRun({ text, bold, rightToLeft: true });

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'number') return new Intl.NumberFormat('fa-IR').format(value);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(formatValue).join('، ') || '—';
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed)
          .map(([key, item]) => `${key}: ${formatValue(item)}`)
          .join(' | ');
      }
    } catch {
      // Plain text is expected for most trade fields.
    }
    return value;
  }
  return String(value);
}

function formatDate(value: unknown): string {
  if (typeof value !== 'number' || !value) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function tableCell(label: string, value: unknown, highlighted = false): TableCell {
  return new TableCell({
    shading: highlighted ? { type: ShadingType.CLEAR, fill: 'E8F0FE' } : undefined,
    children: [
      new Paragraph({
        bidirectional: true,
        children: [rtlText(label, true)],
      }),
      new Paragraph({
        bidirectional: true,
        children: [rtlText(formatValue(value))],
      }),
    ],
  });
}

function dataTable(rows: Array<[string, unknown]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value], index) =>
      new TableRow({
        children: [tableCell(label, value, index % 2 === 0)],
      }),
    ),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    },
  });
}

function paragraph(text: string, bold = false): Paragraph {
  return new Paragraph({
    bidirectional: true,
    spacing: { after: 100 },
    children: [rtlText(text, bold)],
  });
}

function numericRows(trade: Trade): Array<[string, unknown]> {
  return [
    ['شناسه معامله', trade.id],
    ['نماد', trade.symbol],
    ['بازار', trade.market],
    ['جهت', trade.direction === 'long' ? 'خرید (Long)' : 'فروش (Short)'],
    ['وضعیت', trade.status],
    ['نتیجه', trade.result],
    ['زمان باز شدن', formatDate(trade.openedAt)],
    ['زمان بسته شدن', formatDate(trade.closedAt)],
    ['قیمت ورود', trade.entryPrice],
    ['قیمت خروج', trade.exitPrice],
    ['حد ضرر', trade.stopLoss],
    ['هدف سود', trade.takeProfit],
    ['حجم معامله', trade.positionSize],
    ['ریسک درصدی', trade.riskPercentage],
    ['مبلغ ریسک', trade.riskAmount],
    ['R Multiple', trade.rMultiple],
    ['سود/زیان', trade.profitLoss],
    ['کارمزدها', trade.fees],
    ['کمیسیون', trade.commission],
    ['اسپرد', trade.spread],
    ['ورود برنامه‌ریزی‌شده', trade.plannedEntry],
    ['حد ضرر برنامه‌ریزی‌شده', trade.plannedSL],
    ['هدف برنامه‌ریزی‌شده', trade.plannedTP],
    ['RR برنامه‌ریزی‌شده', trade.plannedRR],
    ['ریسک برنامه‌ریزی‌شده', trade.plannedRisk],
    ['حجم برنامه‌ریزی‌شده', trade.plannedPositionSize],
    ['امتیاز پایبندی', trade.adherenceScore],
    ['لغزش حد ضرر', trade.slMoved],
    ['جابجایی هدف سود', trade.tpMoved],
    ['بستن بخشی', trade.partialClose],
    ['افزودن به موقعیت', trade.addedToPosition],
    ['کاهش موقعیت', trade.reducedPosition],
    ['خروج دستی', trade.manualExit],
  ];
}

function analyticalRows(trade: Trade): Array<[string, unknown]> {
  return [
    ['استراتژی', trade.strategyId],
    ['حساب', trade.accountId],
    ['باکس معاملاتی', trade.boxId],
    ['جلسه معاملاتی', trade.tradingSession],
    ['نوع ستاپ', trade.setupType],
    ['منطقه زمانی', trade.timezone],
    ['دلیل ورود', trade.entryReason],
    ['دلیل خروج', trade.reasonForExit],
    ['احساسات', trade.emotions],
    ['یادداشت احساسات', trade.emotionNotes],
    ['یادداشت معامله', trade.notes],
    ['درس‌آموخته', trade.lesson],
    ['دلیل مدیریت معامله', trade.managementReason],
    ['برچسب‌ها', trade.tags],
    ['امتیاز پایبندی', trade.adherenceRating],
    ['یادداشت پایبندی', trade.adherenceNotes],
    ['مرور معامله', trade.review],
    ['مرور ساختاریافته پس از معامله', trade.postTradeReview],
    ['تحلیل چندتایم‌فریمی', trade.mtfAnalysis],
    ['خلاصه پیش از معامله', trade.preTradeBriefing],
    ['پایش زنده', trade.liveMonitoring],
  ];
}

async function imageFromDataUrl(
  id: string,
  label: string,
  dataUrl: string,
  width?: number | null,
  height?: number | null,
): Promise<ImageSource | null> {
  if (!dataUrl.startsWith('data:')) return null;
  return { id, label, blob: dataUrlToBlob(dataUrl), width, height };
}

async function getTradeImages(trade: Trade, chartScreenshots: any[]): Promise<ImageSource[]> {
  const images: ImageSource[] = [];
  try {
    const embedded = JSON.parse(trade.screenshots || '[]') as Array<{ id?: string; label?: string; dataUrl?: string }>;
    for (let index = 0; index < embedded.length; index++) {
      const item = embedded[index];
      if (!item.dataUrl) continue;
      const image = await imageFromDataUrl(
        item.id ?? `${trade.id}-embedded-${index}`,
        item.label ?? `تصویر ${index + 1}`,
        item.dataUrl,
      );
      if (image) images.push(image);
    }
  } catch {
    // Broken legacy screenshot JSON should not prevent the document export.
  }

  const linked = chartScreenshots
    .filter(screenshot => screenshot.tradeId === trade.id)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  for (const screenshot of linked) {
    try {
      const blob = screenshot.imageBlob instanceof Blob
        ? screenshot.imageBlob
        : typeof screenshot.dataUrl === 'string' && screenshot.dataUrl.startsWith('data:')
          ? dataUrlToBlob(screenshot.dataUrl)
          : null;
      if (blob) {
        images.push({
          id: screenshot.id,
          label: screenshot.label || screenshot.screenshotType || 'اسکرین‌شات',
          blob,
          width: screenshot.width,
          height: screenshot.height,
        });
      }
    } catch {
      // Ignore a single unreadable image and keep the rest of the trade.
    }
  }
  return images;
}

async function blobToImageRun(image: ImageSource): Promise<ImageRun> {
  let blob = image.blob;
  let sourceWidth = image.width || 1200;
  let sourceHeight = image.height || 675;
  const isSupportedFormat = blob.type.includes('png')
    || blob.type.includes('jpeg')
    || blob.type.includes('jpg')
    || blob.type.includes('gif')
    || blob.type.includes('bmp');

  // Word's ImageRun does not accept WebP. Convert compressed app screenshots
  // to PNG in the browser before embedding them in the DOCX package.
  if (!isSupportedFormat && typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    sourceWidth = image.width || bitmap.width;
    sourceHeight = image.height || bitmap.height;
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);
    bitmap.close();
    const converted = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (converted) blob = converted;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const maxWidth = 620;
  const maxHeight = 420;
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
  return new ImageRun({
    type: blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'jpg' : 'png',
    data: bytes,
    transformation: {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
    },
  });
}

async function deliverDocument(blob: Blob, filename: string): Promise<void> {
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  if (isAndroidNative) {
    const path = `TraderMind/Exports/${filename}`;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    await Filesystem.writeFile({
      path,
      directory: Directory.Documents,
      data: btoa(binary),
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });
    try {
      await Share.share({
        title: 'گزارش Word معاملات TraderMind',
        text: 'گزارش Word در Documents/TraderMind/Exports ذخیره شد.',
        files: [uri],
        dialogTitle: 'ذخیره یا ارسال گزارش Word',
      });
    } catch {
      // The file is already saved; closing the share sheet is not an error.
    }
    return;
  }

  const file = new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: 'گزارش Word معاملات TraderMind', files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const wordExportService = {
  async exportAllTrades(): Promise<void> {
    const [trades, chartScreenshots] = await Promise.all([
      db.trades.orderBy('openedAt').toArray(),
      db.chartScreenshots.toArray(),
    ]);

    const children: Array<Paragraph | Table> = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        children: [rtlText('گزارش معاملات TraderMind', true)],
      }),
      paragraph(`تاریخ تهیه گزارش: ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date())}`),
      paragraph(`تعداد معاملات: ${new Intl.NumberFormat('fa-IR').format(trades.length)}`),
    ];

    for (let index = 0; index < trades.length; index++) {
      const trade = trades[index];
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: index > 0,
          bidirectional: true,
          children: [rtlText(`معامله ${index + 1}: ${trade.symbol} — ${trade.id}`, true)],
        }),
        paragraph('جدول داده‌های عددی و عملیاتی', true),
        dataTable(numericRows(trade)),
        paragraph('جدول توضیحات و تحلیل معامله', true),
        dataTable(analyticalRows(trade)),
      );

      const images = await getTradeImages(trade, chartScreenshots);
      children.push(paragraph(`تصاویر مرتبط با معامله (${images.length})`, true));
      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        const image = images[imageIndex];
        children.push(
          paragraph(`${imageIndex + 1}. ${image.label}`),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [await blobToImageRun(image)],
          }),
        );
      }
    }

    if (trades.length === 0) {
      children.push(paragraph('هیچ معامله‌ای برای خروجی گرفتن وجود ندارد.'));
    }

    const document = new Document({
      sections: [{ properties: {}, children }],
      styles: {
        default: {
          document: {
            run: { font: 'Vazirmatn', size: 22 },
          },
        },
      },
    });
    const blob = await Packer.toBlob(document);
    const filename = `tradermind-trades-${new Date().toISOString().slice(0, 10)}.docx`;
    await deliverDocument(blob, filename);
  },
};