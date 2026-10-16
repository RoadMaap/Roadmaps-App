import React, { useEffect, useState } from 'react';
import { CandlestickChart, Download, Expand, X } from 'lucide-react';
import { useBacktest } from '../../context/BacktestContext';
import { useLanguage } from '../../context/LanguageContext';

const BacktestPlotPanel = () => {
    const { backtestResult } = useBacktest();
    const { t, lang } = useLanguage();
    const charts = backtestResult?.chart_images || [];
    const [selectedStrategyId, setSelectedStrategyId] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const selectedChart = charts.find((chart) => chart.strategy_id === selectedStrategyId) || charts[0] || null;
    const isRtl = lang === 'fa';

    useEffect(() => {
        if (charts.length && !charts.some((chart) => chart.strategy_id === selectedStrategyId)) {
            setSelectedStrategyId(charts[0].strategy_id);
        }
    }, [charts, selectedStrategyId]);

    useEffect(() => {
        if (!isFullscreen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setIsFullscreen(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [isFullscreen]);

    const downloadPng = () => {
        if (!selectedChart?.image_base64) return;
        const link = document.createElement('a');
        link.href = selectedChart.image_base64;
        link.download = `${selectedChart.strategy_id}_${selectedChart.symbol}_backtest.png`.replace(/[^A-Za-z0-9_.-]/g, '_');
        link.click();
    };

    const openInteractive = async () => {
        if (!window.eel || !selectedChart) return;
        try {
            const response = await window.eel.open_backtest_mpl_window(selectedChart.strategy_id)();
            if (response?.success === false) console.error(response.message || 'Could not open the interactive chart window.');
        } catch (error) {
            console.error('Could not open the interactive chart window:', error);
        }
    };

    const legend = [
        { label: isRtl ? 'سیگنال خرید' : 'Buy Signal', shape: 'triangle-up', color: 'text-lime-300' },
        { label: isRtl ? 'سیگنال فروش' : 'Sell Signal', shape: 'triangle-down', color: 'text-rose-300' },
        { label: isRtl ? 'ورود' : 'Entry', shape: 'arrow-right', color: 'text-sky-300' },
        { label: isRtl ? 'خروج' : 'Exit', shape: 'arrow-left', color: 'text-fuchsia-300' },
        { label: isRtl ? 'حد ضرر' : 'Stop Loss', shape: 'line', color: 'text-rose-400' },
        { label: isRtl ? 'حد سود' : 'Take Profit', shape: 'line', color: 'text-emerald-300' },
    ];

    return (
        <div className="space-y-4 pb-5" dir={isRtl ? 'rtl' : 'ltr'}>
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"><CandlestickChart className="h-5 w-5" aria-hidden="true" /></span>
                    <div>
                        <h2 className="text-lg font-bold text-[#FCFCFD]">{t('bt_plot') || (isRtl ? 'پلات نمودار' : 'Chart Plot')}</h2>
                        <p className="mt-1 text-xs text-[#7A797E]">{t('bt_plot_subtitle') || (isRtl ? 'نمایش کندل‌استیک، اندیکاتورها و نقاط ورود و خروج' : 'Candlestick, Indicators & Trade Execution Plot')}</p>
                    </div>
                </div>
                {charts.length > 1 && <div className="flex max-w-full flex-wrap gap-2" role="tablist" aria-label={isRtl ? 'انتخاب استراتژی' : 'Strategy selector'}>
                    {charts.map((chart) => {
                        const active = selectedChart?.strategy_id === chart.strategy_id;
                        return <button key={chart.strategy_id} type="button" role="tab" aria-selected={active} onClick={() => setSelectedStrategyId(chart.strategy_id)} className={`max-w-full truncate rounded-md border px-3 py-2 text-xs font-semibold transition ${active ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-[#34343B] bg-[#1A191E] text-zinc-400 hover:text-white'}`}>
                            {chart.strategy_id} · {chart.symbol}
                        </button>;
                    })}
                </div>}
            </header>

            {!selectedChart ? (
                <section className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-[#3A3940] bg-[#1A191E] p-8 text-center">
                    <CandlestickChart className="h-10 w-10 text-zinc-600" aria-hidden="true" />
                    <p className="mt-4 text-sm font-semibold text-zinc-300">{isRtl ? 'نموداری برای نمایش موجود نیست' : 'No chart is available yet'}</p>
                    <p className="mt-2 max-w-md text-xs leading-5 text-zinc-500">{isRtl ? 'برای تولید نمودار، ابتدا از زبانه مرور کلی یک بک‌تست اجرا کنید.' : 'Run a backtest from Overview to generate candlestick and trade execution plots.'}</p>
                    {!!backtestResult?.chart_warnings?.length && <div className="mt-5 max-w-2xl space-y-1 text-start">{backtestResult.chart_warnings.map((warning, index) => <p key={`${warning}-${index}`} className="text-[10px] leading-5 text-amber-200/80">{warning}</p>)}</div>}
                </section>
            ) : (
                <section className="overflow-hidden rounded-lg border border-[#2F2E35] bg-[#1A191E]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2F2E35] bg-[#1E1D22] px-4 py-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-zinc-400">
                            <span><b className="text-zinc-200">{isRtl ? 'نماد' : 'Symbol'}:</b> {selectedChart.symbol}</span>
                            <span><b className="text-zinc-200">{isRtl ? 'بازه زمانی' : 'Timeframe'}:</b> {selectedChart.timeframe}</span>
                            <span><b className="text-zinc-200">{isRtl ? 'نوع کندل' : 'Candle Type'}:</b> {selectedChart.candle_type}</span>
                            <span><b className="text-zinc-200">{isRtl ? 'کندل‌های اخیر' : 'Candles'}:</b> 1000</span>
                            <span><b className="text-zinc-200">{isRtl ? 'تعداد معاملات' : 'Trades'}:</b> {selectedChart.trades_count}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button type="button" onClick={openInteractive} title={isRtl ? 'باز کردن پنجره تعاملی Matplotlib' : 'Open Interactive Matplotlib Window'} aria-label={isRtl ? 'باز کردن پنجره تعاملی Matplotlib' : 'Open Interactive Matplotlib Window'} className="flex h-9 items-center gap-2 rounded-md border border-[#3A3940] bg-[#17171C] px-3 text-[10px] font-semibold text-zinc-200 transition hover:border-emerald-300/30 hover:text-emerald-200">
                                <CandlestickChart className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{isRtl ? 'پنجره تعاملی' : 'Interactive Window'}</span>
                            </button>
                            <button type="button" onClick={() => setIsFullscreen(true)} title={isRtl ? 'بزرگ‌نمایی تمام‌صفحه' : 'Fullscreen Zoom'} aria-label={isRtl ? 'بزرگ‌نمایی تمام‌صفحه' : 'Fullscreen Zoom'} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#3A3940] bg-[#17171C] text-zinc-300 transition hover:text-white"><Expand className="h-4 w-4" aria-hidden="true" /></button>
                            <button type="button" onClick={downloadPng} title={isRtl ? 'دانلود تصویر چارت' : 'Download PNG'} aria-label={isRtl ? 'دانلود تصویر چارت' : 'Download PNG'} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#3A3940] bg-[#17171C] text-zinc-300 transition hover:text-white"><Download className="h-4 w-4" aria-hidden="true" /></button>
                        </div>
                    </div>

                    <div className="overflow-auto bg-[#101115] p-3 sm:p-5">
                        <img src={selectedChart.image_base64} alt={`${selectedChart.symbol} ${selectedChart.timeframe} candlestick and trade execution chart`} className="mx-auto h-auto max-h-[72vh] w-auto min-w-full object-contain" />
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[#2F2E35] px-4 py-3">
                        {legend.map((item) => <span key={item.label} className={`inline-flex items-center gap-1.5 text-[10px] ${item.color}`}>
                            {item.shape === 'line' ? <span className={`h-0 w-5 border-t border-dashed ${item.label.toLowerCase().includes('loss') || item.label.includes('ضرر') ? 'border-rose-400' : 'border-emerald-300'}`} /> : <span aria-hidden="true">{item.shape === 'triangle-up' ? '▲' : item.shape === 'triangle-down' ? '▼' : item.shape === 'arrow-right' ? '▶' : '◀'}</span>}
                            {item.label}
                        </span>)}
                    </div>
                    {!!selectedChart.warnings?.length && <div className="space-y-1 border-t border-amber-300/10 bg-amber-300/[0.04] px-4 py-3">
                        {selectedChart.warnings.map((warning, index) => <p key={`${warning}-${index}`} className="text-[10px] leading-5 text-amber-200/80">{warning}</p>)}
                    </div>}
                </section>
            )}

            {isFullscreen && selectedChart && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={isRtl ? 'نمای تمام‌صفحه نمودار' : 'Fullscreen chart'} onMouseDown={(event) => event.target === event.currentTarget && setIsFullscreen(false)}>
                <button type="button" onClick={() => setIsFullscreen(false)} aria-label={isRtl ? 'بستن' : 'Close'} className="absolute end-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-black/40 text-white hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
                <img src={selectedChart.image_base64} alt={`${selectedChart.symbol} candlestick chart`} className="max-h-full max-w-full object-contain" />
            </div>}
        </div>
    );
};

export default BacktestPlotPanel;