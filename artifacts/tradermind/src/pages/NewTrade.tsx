import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { tradeService } from "../services/tradeService";
import { analysisService } from "../services/analysisService";
import { strategyService } from "../services/strategyService";
import { accountService } from "../services/accountService";
import { tradingBoxService } from "../services/tradingBoxService";
import { db, Trade, Strategy, AnalysisSession, Account, TradingBox } from "../db/database";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { ArrowLeft, Save, Eye, Plus, X, Image as ImageIcon, Zap, BookOpen, ChevronDown, ChevronUp, CheckSquare, Square, CreditCard, Box } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "../components/ui/progress";
import { format } from "date-fns";
import PreTradeInsightPanel from "../components/PreTradeInsightPanel";
import ScreenshotManager from "../components/ScreenshotManager";
import { TradeScreenshot } from "../types/screenshot";

const MARKETS = ['Forex', 'Crypto', 'Indices', 'Stocks', 'Commodities', 'Other'];

// ── لیست نمادهای معاملاتی رایج ──────────────────────────────────────────────
const TRADING_SYMBOLS: { label: string; value: string; market: string }[] = [
  // فارکس — جفت‌ارزهای اصلی
  { label: 'EURUSD', value: 'EURUSD', market: 'Forex' },
  { label: 'GBPUSD', value: 'GBPUSD', market: 'Forex' },
  { label: 'USDJPY', value: 'USDJPY', market: 'Forex' },
  { label: 'USDCHF', value: 'USDCHF', market: 'Forex' },
  { label: 'AUDUSD', value: 'AUDUSD', market: 'Forex' },
  { label: 'NZDUSD', value: 'NZDUSD', market: 'Forex' },
  { label: 'USDCAD', value: 'USDCAD', market: 'Forex' },
  // فارکس — جفت‌ارزهای متقاطع
  { label: 'EURGBP', value: 'EURGBP', market: 'Forex' },
  { label: 'EURJPY', value: 'EURJPY', market: 'Forex' },
  { label: 'EURCHF', value: 'EURCHF', market: 'Forex' },
  { label: 'GBPJPY', value: 'GBPJPY', market: 'Forex' },
  { label: 'GBPCHF', value: 'GBPCHF', market: 'Forex' },
  { label: 'AUDJPY', value: 'AUDJPY', market: 'Forex' },
  { label: 'AUDNZD', value: 'AUDNZD', market: 'Forex' },
  { label: 'CADJPY', value: 'CADJPY', market: 'Forex' },
  { label: 'CHFJPY', value: 'CHFJPY', market: 'Forex' },
  { label: 'EURAUD', value: 'EURAUD', market: 'Forex' },
  { label: 'EURCAD', value: 'EURCAD', market: 'Forex' },
  { label: 'EURNZD', value: 'EURNZD', market: 'Forex' },
  { label: 'GBPAUD', value: 'GBPAUD', market: 'Forex' },
  { label: 'GBPCAD', value: 'GBPCAD', market: 'Forex' },
  { label: 'GBPNZD', value: 'GBPNZD', market: 'Forex' },
  { label: 'NZDJPY', value: 'NZDJPY', market: 'Forex' },
  // کالاها
  { label: 'XAUUSD — طلا', value: 'XAUUSD', market: 'Commodities' },
  { label: 'XAGUSD — نقره', value: 'XAGUSD', market: 'Commodities' },
  { label: 'XPTUSD — پلاتین', value: 'XPTUSD', market: 'Commodities' },
  { label: 'USOIL — نفت خام WTI', value: 'USOIL', market: 'Commodities' },
  { label: 'UKOIL — نفت برنت', value: 'UKOIL', market: 'Commodities' },
  { label: 'NATGAS — گاز طبیعی', value: 'NATGAS', market: 'Commodities' },
  // شاخص‌ها
  { label: 'US30 — داو جونز', value: 'US30', market: 'Indices' },
  { label: 'NAS100 — نزدک', value: 'NAS100', market: 'Indices' },
  { label: 'SPX500 — اس‌اند‌پی ۵۰۰', value: 'SPX500', market: 'Indices' },
  { label: 'GER40 — داکس', value: 'GER40', market: 'Indices' },
  { label: 'UK100 — فوتسی ۱۰۰', value: 'UK100', market: 'Indices' },
  { label: 'JPN225 — نیکی', value: 'JPN225', market: 'Indices' },
  { label: 'FRA40 — کک', value: 'FRA40', market: 'Indices' },
  { label: 'AUS200 — ASX200', value: 'AUS200', market: 'Indices' },
  { label: 'VIX — شاخص نوسان', value: 'VIX', market: 'Indices' },
  // کریپتو
  { label: 'BTCUSDT — بیت‌کوین', value: 'BTCUSDT', market: 'Crypto' },
  { label: 'ETHUSDT — اتریوم', value: 'ETHUSDT', market: 'Crypto' },
  { label: 'BNBUSDT — بایننس', value: 'BNBUSDT', market: 'Crypto' },
  { label: 'SOLUSDT — سولانا', value: 'SOLUSDT', market: 'Crypto' },
  { label: 'XRPUSDT — ریپل', value: 'XRPUSDT', market: 'Crypto' },
  { label: 'ADAUSDT — کاردانو', value: 'ADAUSDT', market: 'Crypto' },
  { label: 'DOGEUSDT — دوج‌کوین', value: 'DOGEUSDT', market: 'Crypto' },
  { label: 'DOTUSDT — پولکادات', value: 'DOTUSDT', market: 'Crypto' },
  { label: 'LTCUSDT — لایت‌کوین', value: 'LTCUSDT', market: 'Crypto' },
  { label: 'AVAXUSDT — آوالانچ', value: 'AVAXUSDT', market: 'Crypto' },
  { label: 'MATICUSDT — پالیگان', value: 'MATICUSDT', market: 'Crypto' },
  { label: 'LINKUSDT — چین‌لینک', value: 'LINKUSDT', market: 'Crypto' },
  { label: 'ATOMUSDT — کازموس', value: 'ATOMUSDT', market: 'Crypto' },
  { label: 'NEARUSDT — نیر', value: 'NEARUSDT', market: 'Crypto' },
  { label: 'SUIUSDT — سوئی', value: 'SUIUSDT', market: 'Crypto' },
  { label: 'PEPEUSDT — پپه', value: 'PEPEUSDT', market: 'Crypto' },
  { label: 'TRUMPUSDT — ترامپ', value: 'TRUMPUSDT', market: 'Crypto' },
];

// لیست حجم پوزیشن (لات) از ۰.۰۱ شروع می‌شود
const POSITION_SIZE_OPTIONS = [
  0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09,
  0.10, 0.12, 0.15, 0.18, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45,
  0.50, 0.60, 0.70, 0.80, 0.90, 1.00, 1.25, 1.50, 1.75, 2.00,
  2.50, 3.00, 4.00, 5.00, 7.50, 10.00, 15.00, 20.00, 25.00,
  30.00, 50.00, 100.00,
];

// لیست درصد ریسک
const RISK_PERCENTAGE_OPTIONS = [
  0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00,
  2.50, 3.00, 4.00, 5.00, 7.50, 10.00,
];

// حالت‌های احساسی به فارسی
const EMOTIONS = [
  { id: 'Calm',            label: 'آرام',                 color: 'bg-sky-500' },
  { id: 'Confident',       label: 'مطمئن',                color: 'bg-emerald-500' },
  { id: 'Uncertain',       label: 'نامطمئن',              color: 'bg-amber-500' },
  { id: 'Fearful',         label: 'ترسیده',               color: 'bg-orange-500' },
  { id: 'Anxious',         label: 'مضطرب',                color: 'bg-orange-500' },
  { id: 'Excited',         label: 'هیجان‌زده',            color: 'bg-violet-500' },
  { id: 'Frustrated',      label: 'ناکام',                color: 'bg-red-500' },
  { id: 'FOMO',            label: 'ترس از دست دادن',      color: 'bg-rose-500' },
  { id: 'Revenge Trading', label: 'معامله انتقامی',       color: 'bg-red-600' },
  { id: 'Overconfident',   label: 'بیش از حد مطمئن',      color: 'bg-yellow-500' },
  { id: 'Tired',           label: 'خسته',                 color: 'bg-slate-500' },
  { id: 'Distracted',      label: 'حواس‌پرت',             color: 'bg-slate-500' },
];

// ── کامپوننت انتخاب نماد با جستجو ──────────────────────────────────────────
function SymbolSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search.length > 0
    ? TRADING_SYMBOLS.filter(s =>
        s.value.includes(search.toUpperCase()) ||
        s.label.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 30)
    : TRADING_SYMBOLS.slice(0, 40);

  const displayValue = value || '';

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          placeholder="جستجو یا وارد کردن نماد (مثلاً EURUSD، BTCUSDT، XAUUSD)"
          value={search || displayValue}
          onFocus={() => { setOpen(true); setSearch(''); }}
          onChange={e => {
            const v = e.target.value.toUpperCase();
            setSearch(v);
            onChange(v);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="text-lg font-bold uppercase"
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg overflow-y-auto max-h-56">
            {filtered.map(sym => (
              <button
                key={sym.value}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex justify-between items-center gap-2"
                onMouseDown={() => {
                  onChange(sym.value);
                  setSearch('');
                  setOpen(false);
                }}
              >
                <span className="font-semibold">{sym.value}</span>
                <span className="text-muted-foreground text-xs truncate">{sym.label.includes('—') ? sym.label.split('—')[1].trim() : sym.market}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {displayValue && !search && (
        <p className="text-xs text-muted-foreground">
          {TRADING_SYMBOLS.find(s => s.value === displayValue)?.market || 'نماد سفارشی'}
          {' • '}
          {TRADING_SYMBOLS.find(s => s.value === displayValue)?.label.includes('—')
            ? TRADING_SYMBOLS.find(s => s.value === displayValue)?.label.split('—')[1].trim()
            : displayValue}
        </p>
      )}
    </div>
  );
}

export default function NewTrade() {
  const [, setLocation] = useLocation();
  // FIX: در hash routing الکترون، query params باید مستقیماً از hash خوانده شوند
  // چون useElectronHashLocation اکنون فقط path را برمی‌گرداند (بدون query string)
  // تا Wouter بتواند route matching درستی انجام دهد
  const _searchStr = window.location.protocol === 'file:'
    ? (() => {
        const hash = window.location.hash.replace(/^#/, '');
        const qIdx = hash.indexOf('?');
        return qIdx >= 0 ? hash.slice(qIdx + 1) : '';
      })()
    : window.location.search;
  const searchParams = new URLSearchParams(_searchStr);
  const sessionId = searchParams.get('sessionId');
  const editId = searchParams.get('editId');
  // idFromUrl فقط برای بازیابی پیش‌نویس پس از رفرش صفحه استفاده می‌شود
  // اگر new=true باشد یا editId وجود داشته باشد، از آن صرف‌نظر می‌شود
  const isNewTrade = searchParams.get('new') === 'true';
  const idFromUrl = (isNewTrade || editId) ? null : searchParams.get('id');

  const [trade, setTrade] = useState<Trade | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [session, setSession] = useState<AnalysisSession | null>(null);
  const [linkedStrategy, setLinkedStrategy] = useState<Strategy | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tradingBoxes, setTradingBoxes] = useState<TradingBox[]>([]);
  const [leaveDialog, setLeaveDialog] = useState<{ show: boolean; resolve?: (leave: boolean) => void }>({ show: false });

  useEffect(() => {
    db.trades.toArray().then(setAllTrades);
    accountService.getAll().then(setAccounts);
    tradingBoxService.getAll().then(setTradingBoxes);
  }, []);

  // بررسی معامله تکراری
  useEffect(() => {
    if (!trade || !trade.symbol || !trade.entryPrice || !initialized.current) return;
    const check = async () => {
      const existing = await db.trades
        .where('symbol').equalsIgnoreCase(trade.symbol).toArray();
      const dup = existing.find(t =>
        t.id !== trade.id &&
        t.direction === trade.direction &&
        Math.abs(t.entryPrice - trade.entryPrice) < trade.entryPrice * 0.001 &&
        Math.abs(t.openedAt - trade.openedAt) < 60_000
      );
      if (dup) {
        setDuplicateWarning(`احتمال تکرار: معامله مشابهی در ${new Date(dup.openedAt).toLocaleDateString('fa-IR')} ثبت شده است.`);
      } else {
        setDuplicateWarning(null);
      }
    };
    const timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
  }, [trade?.symbol, trade?.direction, trade?.entryPrice, trade?.openedAt]);

  const tradeIdRef = useRef<string | null>(editId || idFromUrl || null);
  const lastSavedRef = useRef<Trade | null>(null);
  const initialized = useRef(false);
  // Tracks the last set of URL params we initialized for — re-init when they change
  const lastInitKey = useRef<string>('__unset__');

  useEffect(() => {
    // Build a key from the current URL params that identify which trade to open
    // Using editId|idFromUrl|sessionId so any change triggers a fresh load
    const currentKey = `${editId ?? ''}|${idFromUrl ?? ''}|${sessionId ?? ''}`;

    // Skip if we already initialized for this exact combination (prevents StrictMode double-run)
    if (lastInitKey.current === currentKey && initialized.current) return;
    lastInitKey.current = currentKey;

    // Reset state for fresh initialization
    initialized.current = false;
    tradeIdRef.current = editId || idFromUrl || null;
    lastSavedRef.current = null;
    setTrade(null);

    const init = async () => {
      if (initialized.current) return;
      initialized.current = true;

      const strats = await strategyService.getAllStrategies();
      setStrategies(strats);

      let currentTrade: Trade | null = null;

      if (tradeIdRef.current) {
        const existing = await tradeService.getTradeById(tradeIdRef.current);
        if (existing) {
          currentTrade = existing;
        }
      } 
      
      if (!currentTrade) {
        currentTrade = await tradeService.createTrade({
          sessionId: sessionId || null
        });
        tradeIdRef.current = currentTrade.id;
        // Update URL so a page refresh reloads this draft (doesn't go through Wouter
        // to avoid a re-render loop; query string is only used for recovery on refresh)
        const newSearch = '?id=' + currentTrade.id + (sessionId ? `&sessionId=${sessionId}` : '');
        window.history.replaceState(null, '', window.location.pathname + newSearch);
        // Keep our init key in sync so Wouter re-renders don't re-trigger init
        lastInitKey.current = `|${currentTrade.id}|${sessionId ?? ''}`;
      }

      setTrade(currentTrade);
      lastSavedRef.current = currentTrade;

      const targetSessionId = currentTrade.sessionId || sessionId;
      if (targetSessionId) {
        const sess = await analysisService.getSessionById(targetSessionId);
        if (sess) {
          setSession(sess);
          const strat = await strategyService.getStrategyById(sess.strategyId);
          if (strat) setLinkedStrategy(strat);

          if (currentTrade.adherenceScore === null) {
            const score = await tradeService.computeAdherenceScore(sess.id);
            handleChange('adherenceScore', score);
          }
        }
      }
    };
    init();
  }, [editId, idFromUrl, sessionId]);

  const handleChange = useCallback((field: keyof Trade, value: any) => {
    setTrade(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const saveTrade = useCallback(async (dataToSave: Trade) => {
    if (!dataToSave.id) return;
    setIsSaving(true);
    await tradeService.updateTrade(dataToSave.id, dataToSave);
    lastSavedRef.current = dataToSave;
    setIsSaving(false);
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 2000);
  }, []);

  useEffect(() => {
    if (!trade || !initialized.current) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)) {
        saveTrade(trade);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [trade, saveTrade]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (trade && JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)) {
        tradeService.updateTrade(trade.id, trade);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [trade]);

  // هشدار هنگام فشردن دکمه برگشت با داده‌های ذخیره‌نشده
  useEffect(() => {
    const onPopState = async () => {
      if (!trade || JSON.stringify(trade) === JSON.stringify(lastSavedRef.current)) return;
      const shouldLeave = await new Promise<boolean>(resolve => {
        setLeaveDialog({ show: true, resolve });
      });
      if (!shouldLeave) {
        window.history.pushState(null, '', window.location.href);
      } else {
        await tradeService.updateTrade(trade.id, trade);
        // باگ ۲: هنگام ویرایش، به صفحه جزئیات معامله برگرد نه لیست
        setLocation(editId ? `/journal/trades/${editId}` : '/journal/trades');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [trade, setLocation, editId]);

  // اتودیتکت نتیجه بر اساس سود/زیان
  useEffect(() => {
    if (!trade || !initialized.current || trade.status !== 'closed') return;
    if (trade.profitLoss === null || trade.profitLoss === undefined) return;
    let autoResult: string;
    if (trade.profitLoss > 0) autoResult = 'win';
    else if (trade.profitLoss < 0) autoResult = 'loss';
    else autoResult = 'breakeven';
    if (trade.result !== autoResult) {
      handleChange('result', autoResult);
    }
  }, [trade?.profitLoss, trade?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeaveDialogConfirm = (leave: boolean) => {
    setLeaveDialog(prev => {
      prev.resolve?.(leave);
      return { show: false };
    });
  };

  // باگ ۲: وقتی در حال ویرایش معامله هستیم، برگشت به صفحه جزئیات معامله می‌رود نه لیست
  const backUrl = editId ? `/journal/trades/${editId}` : '/journal/trades';

  const handleCancel = async () => {
    if (trade && JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)) {
      await tradeService.updateTrade(trade.id, trade);
    }
    setLocation(backUrl);
  };

  const handleDateChange = (field: 'openedAt' | 'closedAt', dateString: string) => {
    const timestamp = new Date(dateString).getTime();
    handleChange(field, timestamp);
  };

  const formatDateForInput = (timestamp: number | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  const computeRMultiple = () => {
    if (!trade || trade.exitPrice === null || trade.exitPrice === undefined) return;
    const diff = Math.abs(trade.entryPrice - trade.stopLoss);
    if (diff === 0) return;

    let r = 0;
    if (trade.direction === 'long') {
      r = (trade.exitPrice - trade.entryPrice) / diff;
    } else {
      r = (trade.entryPrice - trade.exitPrice) / diff;
    }
    return r.toFixed(2);
  };

  const toggleEmotion = (emotionId: string) => {
    if (!trade) return;
    const currentEmotions = JSON.parse(trade.emotions || '[]') as string[];
    let updated;
    if (currentEmotions.includes(emotionId)) {
      updated = currentEmotions.filter(e => e !== emotionId);
    } else {
      updated = [...currentEmotions, emotionId];
    }
    handleChange('emotions', JSON.stringify(updated));
  };

  const currentEmotions = trade ? (JSON.parse(trade.emotions || '[]') as string[]) : [];
  const review = trade ? JSON.parse(trade.review || '{}') : {};
  const tags = trade ? JSON.parse(trade.tags || '[]') as string[] : [];
  const computedR = computeRMultiple();

  if (!trade) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Initializing trade...</div>;
  }

  return (
    <div className="w-full min-w-0 max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 border-b pb-4 sticky top-0 bg-background/80 backdrop-blur z-10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation(backUrl)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{editId ? 'Edit Trade' : 'Log Trade'}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className={`text-muted-foreground transition-opacity ${showSavedIndicator ? 'opacity-100' : 'opacity-0'}`}>
                Saved
              </span>
              {isSaving && <span className="text-muted-foreground animate-pulse">Saving...</span>}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          {/* Quick/Full toggle */}
          <div className="order-3 flex w-full min-w-0 rounded-lg border overflow-hidden sm:order-none sm:w-auto sm:flex-none">
            <Button
              variant={isQuickMode ? 'default' : 'ghost'}
              size="sm"
              className="min-w-0 flex-1 rounded-none gap-1.5 h-9 px-2 sm:flex-none sm:px-3"
              onClick={() => setIsQuickMode(true)}
            >
              <Zap className="w-3.5 h-3.5" /> سریع
            </Button>
            <Button
              variant={!isQuickMode ? 'default' : 'ghost'}
              size="sm"
              className="min-w-0 flex-1 rounded-none gap-1.5 h-9 px-2 sm:flex-none sm:px-3"
              onClick={() => setIsQuickMode(false)}
            >
              <BookOpen className="w-3.5 h-3.5" /> کامل
            </Button>
          </div>
          <Button className="order-1 flex-1 sm:order-none sm:flex-none" variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button className="order-2 flex-1 whitespace-nowrap sm:order-none sm:flex-none" onClick={async () => { if (trade) { await tradeService.updateTrade(trade.id, trade); } setLocation(`/journal/trades/${trade.id}`); }}>
            <Eye className="w-4 h-4 mr-2" /> Save & View
          </Button>
        </div>
      </div>

      {/* هشدار تکرار */}
      {duplicateWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{duplicateWarning}</span>
          <button onClick={() => setDuplicateWarning(null)} className="mr-auto shrink-0 hover:opacity-70">✕</button>
        </div>
      )}

      <div className="space-y-12">
        {/* SECTION 1: Trade Info */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">1. Trade Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>نماد معاملاتی (Symbol)</Label>
              <SymbolSelector
                value={trade.symbol}
                onChange={v => {
                  handleChange('symbol', v.toUpperCase());
                  // auto-set market based on symbol
                  const found = TRADING_SYMBOLS.find(s => s.value === v.toUpperCase());
                  if (found && !trade.market) handleChange('market', found.market);
                }}
              />
            </div>

            {/* پانل بینش پیش از معامله — بعد از ورود نماد ظاهر می‌شود */}
            {trade.symbol && trade.symbol.length >= 2 && (
              <div className="lg:col-span-3">
                <PreTradeInsightPanel
                  symbol={trade.symbol}
                  tags={tags}
                  allTrades={allTrades}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Market</Label>
              <Select value={trade.market || ''} onValueChange={v => handleChange('market', v)}>
                <SelectTrigger><SelectValue placeholder="Select Market" /></SelectTrigger>
                <SelectContent>
                  {MARKETS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Direction</Label>
              <div className="flex gap-2">
                <Button 
                  variant={trade.direction === 'long' ? 'default' : 'outline'}
                  onClick={() => handleChange('direction', 'long')}
                  className={`flex-1 ${trade.direction === 'long' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/30' : ''}`}
                >
                  LONG
                </Button>
                <Button 
                  variant={trade.direction === 'short' ? 'default' : 'outline'}
                  onClick={() => handleChange('direction', 'short')}
                  className={`flex-1 ${trade.direction === 'short' ? 'bg-rose-500/20 text-rose-500 border-rose-500/50 hover:bg-rose-500/30' : ''}`}
                >
                  SHORT
                </Button>
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Status</Label>
              <div className="flex gap-2">
                {['open', 'closed', 'cancelled'].map(status => (
                  <Button 
                    key={status}
                    variant={trade.status === status ? 'default' : 'outline'}
                    onClick={() => handleChange('status', status)}
                    className="flex-1 capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Strategy</Label>
              <Select value={trade.strategyId || 'none'} onValueChange={v => handleChange('strategyId', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select Strategy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Strategy</SelectItem>
                  {strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* حساب معاملاتی */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> حساب معاملاتی</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => setLocation('/accounts')}>
                  <Plus className="w-3 h-3" /> مدیریت
                </Button>
              </div>
              <Select value={(trade as any).accountId || 'none'} onValueChange={v => handleChange('accountId' as any, v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب حساب (اختیاری)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون حساب</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        {a.name}{a.broker ? ` — ${a.broker}` : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* باکس معاملاتی */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> باکس معاملاتی</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => setLocation('/trading-boxes')}>
                  <Plus className="w-3 h-3" /> مدیریت
                </Button>
              </div>
              <Select value={(trade as any).boxId || 'none'} onValueChange={v => handleChange('boxId' as any, v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب باکس (اختیاری)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون باکس</SelectItem>
                  {tradingBoxes.filter(b => b.status === 'active').map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                        {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ── سشن + ستاپ (بخشی از Section 1) ── */}
        {!isQuickMode && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">۱ب. سشن معاملاتی و ستاپ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>سشن معاملاتی</Label>
                <Select value={(trade as any).tradingSession || ''} onValueChange={v => handleChange('tradingSession' as any, v || null)}>
                  <SelectTrigger><SelectValue placeholder="انتخاب کنید…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="london">لندن</SelectItem>
                    <SelectItem value="new-york">نیویورک</SelectItem>
                    <SelectItem value="asia">آسیا</SelectItem>
                    <SelectItem value="overlap">اوورلپ</SelectItem>
                    <SelectItem value="other">سایر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع ستاپ</Label>
                <Select value={(trade as any).setupType || ''} onValueChange={v => handleChange('setupType' as any, v || null)}>
                  <SelectTrigger><SelectValue placeholder="انتخاب کنید…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="break-and-retest">Break and Retest</SelectItem>
                    <SelectItem value="fvg">FVG (Fair Value Gap)</SelectItem>
                    <SelectItem value="liquidity-grab">Liquidity Grab</SelectItem>
                    <SelectItem value="order-block">Order Block</SelectItem>
                    <SelectItem value="trend-continuation">Trend Continuation</SelectItem>
                    <SelectItem value="reversal">Reversal</SelectItem>
                    <SelectItem value="support-resistance">حمایت/مقاومت</SelectItem>
                    <SelectItem value="other">سایر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: Entry Details */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">2. Entry Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label>Opened At</Label>
              <Input 
                type="datetime-local" 
                value={formatDateForInput(trade.openedAt)}
                onChange={e => handleDateChange('openedAt', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Entry Price</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.entryPrice || ''} onChange={e => handleChange('entryPrice', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Stop Loss</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.stopLoss || ''} onChange={e => handleChange('stopLoss', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Take Profit</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.takeProfit || ''} onChange={e => handleChange('takeProfit', parseFloat(e.target.value) || null)} />
            </div>
          </div>
        </section>

        {/* ── برنامه معامله (Planned Trade) — همیشه قابل ویرایش است ── */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">۲ب. برنامه معامله (Planned)</h2>
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: 'plannedEntry', label: 'ورود برنامه‌ریزی‌شده' },
              { key: 'plannedSL', label: 'حد ضرر برنامه‌ریزی‌شده' },
              { key: 'plannedTP', label: 'حد سود برنامه‌ریزی‌شده' },
              { key: 'plannedRR', label: 'R:R برنامه‌ریزی‌شده' },
              { key: 'plannedRisk', label: 'ریسک برنامه‌ریزی‌شده (%)' },
              { key: 'plannedPositionSize', label: 'حجم برنامه‌ریزی‌شده' },
            ].map(f => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}</Label>
                <Input
                  type="text" inputMode="decimal"
                  value={(trade as any)[f.key] || ''}
                  onChange={e => handleChange(f.key as any, parseFloat(e.target.value) || null)}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: Position Sizing — از ۰.۰۱ لات شروع می‌شود */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">3. حجم و ریسک</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* حجم پوزیشن — لیست از ۰.۰۱ */}
            <div className="space-y-2">
              <Label>حجم پوزیشن (لات)</Label>
              <Select
                value={trade.positionSize != null ? String(trade.positionSize) : ''}
                onValueChange={v => handleChange('positionSize', v ? parseFloat(v) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب حجم…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {POSITION_SIZE_OPTIONS.map(v => (
                    <SelectItem key={v} value={String(v)}>
                      {v % 1 === 0 ? v.toFixed(2) : v < 0.1 ? v.toFixed(2) : v.toFixed(2)} لات
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* ورودی دستی برای مقادیر سفارشی */}
              <Input
                type="text" inputMode="decimal" placeholder="یا مقدار دلخواه وارد کنید…"
                value={trade.positionSize != null && !POSITION_SIZE_OPTIONS.includes(trade.positionSize) ? String(trade.positionSize) : ''}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) handleChange('positionSize', v);
                  else if (e.target.value === '') handleChange('positionSize', null);
                }}
                className="h-8 text-sm mt-1"
              />
            </div>

            {/* درصد ریسک — لیست */}
            <div className="space-y-2">
              <Label>ریسک (٪)</Label>
              <Select
                value={trade.riskPercentage != null ? String(trade.riskPercentage) : ''}
                onValueChange={v => handleChange('riskPercentage', v ? parseFloat(v) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب ریسک…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {RISK_PERCENTAGE_OPTIONS.map(v => (
                    <SelectItem key={v} value={String(v)}>
                      {v}٪
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text" inputMode="decimal" placeholder="یا مقدار دلخواه…"
                value={trade.riskPercentage != null && !RISK_PERCENTAGE_OPTIONS.includes(trade.riskPercentage) ? String(trade.riskPercentage) : ''}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) handleChange('riskPercentage', v);
                  else if (e.target.value === '') handleChange('riskPercentage', null);
                }}
                className="h-8 text-sm mt-1"
              />
            </div>

            <div className="space-y-2">
              <Label>مقدار ریسک ($)</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.riskAmount || ''} onChange={e => handleChange('riskAmount', parseFloat(e.target.value) || null)} />
            </div>
          </div>
        </section>

        {/* ── دلیل ورود ── */}
        {!isQuickMode && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۳ب. دلیل ورود</h2>
            <div className="space-y-2">
              <Label>دلیل ورود به معامله</Label>
              <Textarea
                placeholder="چرا وارد این معامله شدید؟ چه چیزی را در چارت دیدید؟ ستاپ چه بود؟"
                value={(trade as any).entryReason || ''}
                onChange={e => handleChange('entryReason' as any, e.target.value || null)}
                className="min-h-[100px]"
              />
            </div>
          </section>
        )}

        {/* SECTION 4: Exit Details */}
        {trade.status === 'closed' && (
          <section className="space-y-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold border-b pb-2">4. Exit Details</h2>
            
            <div className="space-y-2">
              <Label>Result</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'win', l: 'Win', c: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' },
                  { v: 'loss', l: 'Loss', c: 'bg-rose-500/20 text-rose-500 border-rose-500/50' },
                  { v: 'breakeven', l: 'Break Even', c: 'bg-slate-500/20 text-slate-500 border-slate-500/50' },
                  { v: 'partial-win', l: 'Partial Win', c: 'bg-teal-500/20 text-teal-500 border-teal-500/50' },
                  { v: 'partial-loss', l: 'Partial Loss', c: 'bg-amber-500/20 text-amber-500 border-amber-500/50' }
                ].map(res => (
                  <Button
                    key={res.v}
                    variant={trade.result === res.v ? 'default' : 'outline'}
                    onClick={() => handleChange('result', res.v)}
                    className={trade.result === res.v ? res.c : ''}
                  >
                    {res.l}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Closed At</Label>
                <Input 
                  type="datetime-local" 
                  value={formatDateForInput(trade.closedAt)}
                  onChange={e => handleDateChange('closedAt', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Exit Price</Label>
                <Input type="text" inputMode="decimal" step="any" value={trade.exitPrice || ''} onChange={e => handleChange('exitPrice', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-2">
                <Label>P&L</Label>
                <Input type="text" inputMode="decimal" step="any" value={trade.profitLoss || ''} onChange={e => handleChange('profitLoss', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>R Multiple</Label>
                  {computedR && <span className="text-xs text-muted-foreground">Auto: {computedR}R</span>}
                </div>
                <Input type="text" inputMode="decimal" step="any" value={trade.rMultiple || ''} onChange={e => handleChange('rMultiple', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-2">
                <Label>Fees</Label>
                <Input type="text" inputMode="decimal" step="any" value={trade.fees || ''} onChange={e => handleChange('fees', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label>Reason for Exit</Label>
                <Input value={trade.reasonForExit || ''} onChange={e => handleChange('reasonForExit', e.target.value)} placeholder="Hit target, trailed stop, etc." />
              </div>
            </div>
          </section>
        )}

        {/* ── مدیریت معامله ── */}
        {!isQuickMode && trade.status === 'closed' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۴ب. مدیریت معامله</h2>
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'slMoved',         label: 'جابجایی حد ضرر' },
                { key: 'tpMoved',         label: 'جابجایی حد سود' },
                { key: 'partialClose',    label: 'بستن بخشی از پوزیشن' },
                { key: 'addedToPosition', label: 'افزودن به پوزیشن' },
                { key: 'reducedPosition', label: 'کاهش پوزیشن' },
                { key: 'manualExit',      label: 'خروج دستی' },
              ].map(item => {
                const val = (trade as any)[item.key];
                return (
                  <button key={item.key}
                    onClick={() => handleChange(item.key as any, val === true ? false : val === false ? null : true)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-right transition-colors ${
                      val === true ? 'border-primary bg-primary/10 text-primary' :
                      val === false ? 'border-muted-foreground/30 text-muted-foreground/50' :
                      'border-border hover:border-primary/40'
                    }`}>
                    {val === true ? <CheckSquare className="w-4 h-4 shrink-0" /> :
                     val === false ? <Square className="w-4 h-4 shrink-0 opacity-40" /> :
                     <Square className="w-4 h-4 shrink-0" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>توضیح تصمیمات مدیریت</Label>
              <Textarea
                placeholder="چرا حد ضرر را جابجا کردید؟ دلیل خروج زودهنگام چه بود؟"
                value={(trade as any).managementReason || ''}
                onChange={e => handleChange('managementReason' as any, e.target.value || null)}
                className="min-h-[80px]"
              />
            </div>
          </section>
        )}

        {/* SECTION 5: Strategy Adherence */}
        {(trade.sessionId || sessionId) && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">5. Strategy Adherence</h2>
            
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Linked Session</div>
                    <div className="font-semibold">{linkedStrategy?.name || 'Unknown Strategy'}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setLocation(`/analysis/${trade.sessionId || sessionId}`)}>
                    View Session
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Adherence Score</span>
                      <span className="font-bold">{trade.adherenceScore ?? 0}%</span>
                    </div>
                    <Progress value={trade.adherenceScore ?? 0} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>How well did you follow the rules?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { v: 'fully', l: 'Fully Followed', c: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' },
                        { v: 'mostly', l: 'Mostly Followed', c: 'bg-teal-500/20 text-teal-500 border-teal-500/50' },
                        { v: 'partially', l: 'Partially Followed', c: 'bg-amber-500/20 text-amber-500 border-amber-500/50' },
                        { v: 'not', l: 'Did Not Follow', c: 'bg-rose-500/20 text-rose-500 border-rose-500/50' }
                      ].map(rating => (
                        <Button
                          key={rating.v}
                          variant={trade.adherenceRating === rating.v ? 'default' : 'outline'}
                          onClick={() => handleChange('adherenceRating', rating.v)}
                          className={trade.adherenceRating === rating.v ? rating.c : ''}
                        >
                          {rating.l}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Adherence Notes</Label>
                    <Textarea 
                      placeholder="Why did you deviate from the rules?"
                      value={trade.adherenceNotes || ''}
                      onChange={e => handleChange('adherenceNotes', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* SECTION 6: Emotions — به فارسی */}
        {!isQuickMode && (<section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">۶. وضعیت احساسی</h2>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map(emo => {
              const isSelected = currentEmotions.includes(emo.id);
              return (
                <button
                  key={emo.id}
                  onClick={() => toggleEmotion(emo.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isSelected 
                      ? `${emo.color} text-white shadow-md scale-105` 
                      : `bg-muted/50 text-muted-foreground hover:bg-muted border border-border`
                  }`}
                >
                  {emo.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label>یادداشت احساسی</Label>
            <Textarea 
              placeholder="در طول این معامله چه احساسی داشتید؟"
              value={trade.emotionNotes || ''}
              onChange={e => handleChange('emotionNotes', e.target.value)}
            />
          </div>
        </section>)}

        {/* ── تحلیل چند تایم‌فریمی (MTF) ── */}
        {!isQuickMode && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۶ب. تحلیل چند تایم‌فریمی</h2>
            {(['4H', '15M', '5M', '1M'] as const).map(tf => {
              const mtf = (() => { try { return JSON.parse((trade as any).mtfAnalysis || 'null') || {}; } catch { return {}; } })();
              const tfData = mtf[tf] || {};
              const update = (field: string, value: string) => {
                const newMtf = { ...mtf, [tf]: { ...tfData, [field]: value } };
                handleChange('mtfAnalysis' as any, JSON.stringify(newMtf));
              };
              return (
                <Card key={tf} className="bg-muted/10">
                  <CardContent className="p-4 space-y-3">
                    <div className="font-semibold text-sm">{tf}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">بایاس / جهت</Label>
                        <Input value={tfData.bias || ''} onChange={e => update('bias', e.target.value)} placeholder="صعودی / نزولی / خنثی" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ساختار بازار</Label>
                        <Input value={tfData.structure || ''} onChange={e => update('structure', e.target.value)} placeholder="HH/HL، LL/LH" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">زمینه و یادداشت</Label>
                        <Textarea value={tfData.notes || ''} onChange={e => update('notes', e.target.value)} placeholder={`تحلیل ${tf} را وارد کنید…`} className="min-h-[60px] text-sm" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}

        {/* SECTION 7: Screenshots */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">۷. اسکرین‌شات‌ها</h2>
          <ScreenshotManager
            trade={trade}
            allTrades={allTrades}
            onChange={screenshots => handleChange('screenshots', JSON.stringify(screenshots))}
          />
        </section>

        {/* SECTION 8: Review */}
        {!isQuickMode && trade.status === 'closed' && (
          <section className="space-y-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold border-b pb-2">8. Trade Review</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>What did I do well?</Label>
                <Textarea 
                  value={review.didWell || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, didWell: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>What did I do wrong?</Label>
                <Textarea 
                  value={review.didWrong || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, didWrong: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>What did I learn?</Label>
                <Textarea 
                  value={review.learned || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, learned: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Would I take this trade again?</Label>
                <div className="flex gap-2">
                  {['yes', 'no', 'maybe'].map(val => (
                    <Button
                      key={val}
                      variant={review.wouldTakeAgain === val ? 'default' : 'outline'}
                      onClick={() => handleChange('review', JSON.stringify({ ...review, wouldTakeAgain: val }))}
                      className="flex-1 capitalize"
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Was this a valid setup?</Label>
                <div className="flex gap-2">
                  {['yes', 'no', 'unclear'].map(val => (
                    <Button
                      key={val}
                      variant={review.validSetup === val ? 'default' : 'outline'}
                      onClick={() => handleChange('review', JSON.stringify({ ...review, validSetup: val }))}
                      className="flex-1 capitalize"
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 9: Notes & Tags */}
        {!isQuickMode && (<section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">9. Notes & Tags</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input 
                placeholder="Press Enter to add tags (e.g., trend-following, fvg, overtrading)" 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val && !tags.includes(val)) {
                      handleChange('tags', JSON.stringify([...tags, val]));
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm flex items-center gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-primary/70" 
                      onClick={() => handleChange('tags', JSON.stringify(tags.filter(t => t !== tag)))} 
                    />
                  </span>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>درس معامله</Label>
              <Textarea
                placeholder="از این معامله چه یاد گرفتید؟ چه نکته‌ای برای آینده دارد؟"
                value={(trade as any).lesson || ''}
                onChange={e => handleChange('lesson' as any, e.target.value || null)}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>General Notes</Label>
              <Textarea 
                placeholder="Any additional thoughts on this trade..."
                value={trade.notes || ''}
                onChange={e => handleChange('notes', e.target.value)}
                className="min-h-[120px]"
              />
            </div>
          </div>
        </section>)}

      </div>

      {/* دیالوگ هشدار داده ذخیره‌نشده */}
      <Dialog open={leaveDialog.show} onOpenChange={open => !open && handleLeaveDialogConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تغییرات ذخیره نشده</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            تغییراتی که وارد کردید هنوز ذخیره نشده‌اند. آیا می‌خواهید ذخیره شوند و از این صفحه خارج شوید؟
          </p>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => handleLeaveDialogConfirm(false)}>بمانید</Button>
            <Button variant="destructive" onClick={() => handleLeaveDialogConfirm(true)}>ذخیره و خروج</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
