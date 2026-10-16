import React, { useEffect, useState } from 'react';
import { useBacktest } from '../../context/BacktestContext';
import { useLanguage } from '../../context/LanguageContext';

const panelClass = 'min-w-0 rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4 sm:p-5';
const colors = ['#34D399', '#F28C45', '#60A5FA', '#F87171', '#A3E635', '#FBBF24', '#2DD4BF'];

const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) => `${number(value) < 0 ? '-$' : '$'}${Math.abs(number(value)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value) => `${number(value).toFixed(2)}%`;
const dateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const Stat = ({ label, value, detail, tone = 'default' }) => (
    <article className="min-w-0 rounded-md border border-[#2F2E35] bg-[#141318] p-3">
        <div className="truncate text-[9px] font-semibold uppercase text-[#7A797E]">{label}</div>
        <div className={`mt-2 truncate text-base font-bold tabular-nums sm:text-lg ${tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-[#FCFCFD]'}`}>{value}</div>
        {detail && <div className="mt-1 truncate text-[10px] text-zinc-500">{detail}</div>}
    </article>
);

const ChartPanel = ({ title, subtitle, children, className = '' }) => (
    <section className={`${panelClass} ${className}`}>
        <div className="mb-4">
            <h2 className="text-sm font-bold text-[#FCFCFD]">{title}</h2>
            {subtitle && <p className="mt-1 text-[10px] text-[#7A797E]">{subtitle}</p>}
        </div>
        {children}
    </section>
);

const TimeSeriesChart = ({ data, valueKey, color, gradientId, negative = false, emptyLabel }) => {
    const points = (data || []).map((point) => ({
        time: point.time,
        value: number(point[valueKey]) * (negative ? -1 : 1),
    }));
    if (!points.length) return <ChartEmpty label={emptyLabel} />;

    const width = 900;
    const height = 270;
    const left = 58;
    const right = 16;
    const top = 16;
    const bottom = 34;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    let min = Math.min(0, ...points.map((point) => point.value));
    let max = Math.max(0, ...points.map((point) => point.value));
    if (min === max) max = min + 1;
    const x = (index) => left + (points.length === 1 ? chartWidth / 2 : index / (points.length - 1) * chartWidth);
    const y = (value) => top + ((max - value) / (max - min)) * chartHeight;
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.value)}`).join(' ');
    const baseline = y(0);
    const areaPath = `${linePath} L ${x(points.length - 1)} ${baseline} L ${x(0)} ${baseline} Z`;
    const markerStep = Math.max(1, Math.ceil(points.length / 90));

    return (
        <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={negative ? 'Underwater drawdown chart' : 'Portfolio equity curve chart'}>
            <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0.01" /></linearGradient></defs>
            {[0, 0.5, 1].map((fraction) => {
                const gridY = top + chartHeight * fraction;
                const tickValue = max - (max - min) * fraction;
                return <g key={fraction}><line x1={left} x2={width - right} y1={gridY} y2={gridY} stroke="#34343B" strokeDasharray="3 5" /><text x={left - 8} y={gridY + 3} textAnchor="end" fill="#777780" fontSize="10">{tickValue.toFixed(negative ? 1 : 0)}{negative ? '%' : ''}</text></g>;
            })}
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.filter((_, index) => index % markerStep === 0 || index === points.length - 1).map((point) => {
                const index = points.indexOf(point);
                return <circle key={`${point.time}-${index}`} cx={x(index)} cy={y(point.value)} r="3.2" fill={color} stroke="#141318" strokeWidth="1.5"><title>{`${dateTime(point.time)} | ${negative ? `${Math.abs(point.value).toFixed(2)}%` : money(point.value)}`}</title></circle>;
            })}
            <text x={left} y={height - 7} fill="#777780" fontSize="10">{dateTime(points[0].time)}</text>
            <text x={width - right} y={height - 7} textAnchor="end" fill="#777780" fontSize="10">{dateTime(points[points.length - 1].time)}</text>
        </svg>
    );
};

const BarChart = ({ data, emptyLabel, moneyValues = true }) => {
    const entries = data || [];
    if (!entries.length || entries.every((entry) => number(entry.value) === 0)) return <ChartEmpty label={emptyLabel} />;
    const width = 900;
    const height = 260;
    const left = 52;
    const right = 14;
    const top = 18;
    const bottom = 42;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const values = entries.map((entry) => number(entry.value));
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = max - min || 1;
    const zeroY = top + (max / range) * chartHeight;
    const slot = chartWidth / entries.length;
    const barWidth = Math.max(3, Math.min(28, slot * 0.68));

    return (
        <svg className="h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Profit and loss bar chart">
            <line x1={left} x2={width - right} y1={zeroY} y2={zeroY} stroke="#55555E" />
            {entries.map((entry, index) => {
                const value = number(entry.value);
                const valueY = top + ((max - value) / range) * chartHeight;
                const rectY = Math.min(zeroY, valueY);
                const rectHeight = Math.max(1, Math.abs(zeroY - valueY));
                const centerX = left + slot * index + slot / 2;
                const showLabel = entries.length <= 12 || index % 3 === 0;
                return <g key={`${entry.label}-${index}`}><rect x={centerX - barWidth / 2} y={rectY} width={barWidth} height={rectHeight} rx="2" fill={value >= 0 ? '#34D399' : '#F87171'} fillOpacity="0.86"><title>{`${entry.label}: ${moneyValues ? money(value) : value.toFixed(2)}`}</title></rect>{showLabel && <text x={centerX} y={height - 12} textAnchor="middle" fill="#8B8B94" fontSize={entries.length > 15 ? '9' : '10'}>{entry.label}</text>}</g>;
            })}
        </svg>
    );
};

const StrategyDonut = ({ data, emptyLabel }) => {
    const entries = (data || []).filter(([, value]) => number(value) !== 0);
    const total = entries.reduce((sum, [, value]) => sum + Math.abs(number(value)), 0);
    if (!entries.length || total === 0) return <ChartEmpty label={emptyLabel} />;
    const radius = 66;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
            <svg className="mx-auto w-full max-w-[180px]" viewBox="0 0 180 180" role="img" aria-label="Strategy contribution donut chart">
                <circle cx="90" cy="90" r={radius} fill="none" stroke="#303038" strokeWidth="22" />
                {entries.map(([name, value], index) => {
                    const segment = Math.abs(number(value)) / total * circumference;
                    const currentOffset = offset;
                    offset += segment;
                    const color = number(value) >= 0 ? colors[index % colors.length] : '#F87171';
                    return <circle key={name} cx="90" cy="90" r={radius} fill="none" stroke={color} strokeWidth="22" strokeDasharray={`${segment} ${circumference - segment}`} strokeDashoffset={-currentOffset} transform="rotate(-90 90 90)"><title>{`${name}: ${money(value)}`}</title></circle>;
                })}
                <text x="90" y="86" textAnchor="middle" fill="#FCFCFD" fontSize="12" fontWeight="700">{entries.length}</text>
                <text x="90" y="104" textAnchor="middle" fill="#85858E" fontSize="9">STRATEGIES</text>
            </svg>
            <div className="space-y-2">
                {entries.map(([name, value], index) => <div key={name} className="flex min-w-0 items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-zinc-300"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: number(value) < 0 ? '#F87171' : colors[index % colors.length] }} /><span className="truncate">{name}</span></span><span className={`shrink-0 font-mono ${number(value) < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(value)}</span></div>)}
            </div>
        </div>
    );
};

const ChartEmpty = ({ label }) => <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-[#34343B] text-xs text-zinc-500">{label}</div>;

const BacktestAnalyticsPanel = () => {
    const { backtestResult } = useBacktest();
    const { t, lang } = useLanguage();
    const [page, setPage] = useState(0);
    const summary = backtestResult?.summary || {};
    const breakdowns = backtestResult?.breakdowns || {};
    const equityCurve = backtestResult?.equity_curve || [];
    const trades = backtestResult?.trades || [];
    const pageSize = 15;
    const pageCount = Math.max(1, Math.ceil(trades.length / pageSize));
    const visibleTrades = trades.slice(page * pageSize, (page + 1) * pageSize);
    const dayNames = lang === 'fa' ? ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه', 'یکشنبه'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    useEffect(() => setPage(0), [backtestResult]);

    const kpis = [
        { label: t('bt_metric_initial_capital') || 'Initial Capital', value: money(summary.initial_capital) },
        { label: t('bt_metric_final_equity') || 'Final Equity', value: money(summary.final_equity) },
        { label: t('bt_metric_net_profit') || 'Net Profit', value: money(summary.net_profit), detail: percent(summary.net_profit_pct), tone: number(summary.net_profit) < 0 ? 'negative' : 'positive' },
        { label: t('bt_metric_win_rate') || 'Win Rate', value: percent(summary.win_rate) },
        { label: t('bt_metric_profit_factor') || 'Profit Factor', value: number(summary.profit_factor).toFixed(2) },
        { label: t('bt_metric_stability') || 'Stability Score (R²)', value: `${number(summary.stability_score).toFixed(1)}%` },
        { label: t('bt_metric_max_drawdown') || 'Max Drawdown', value: money(summary.max_drawdown_dollar), detail: percent(summary.max_drawdown_pct), tone: 'negative' },
        { label: t('bt_metric_daily_drawdown') || 'Max Daily Drawdown', value: money(summary.max_daily_dd_dollar), detail: percent(summary.max_daily_dd_pct), tone: 'negative' },
        { label: t('bt_metric_avg_win') || 'Average Win', value: money(summary.avg_win), tone: 'positive' },
        { label: t('bt_metric_avg_loss') || 'Average Loss', value: money(summary.avg_loss), tone: 'negative' },
        { label: t('bt_metric_total_trades') || 'Total Trades', value: number(summary.total_trades).toLocaleString(), detail: `${t('bt_metric_partial_closes') || 'Partial Closes'}: ${number(summary.partial_closes)}` },
        { label: t('bt_metric_commission') || 'Total Commission', value: money(summary.total_commission) },
    ];

    const openFullReport = async () => {
        if (!window.eel) return;
        try {
            const response = await window.eel.export_backtest_html_report()();
            if (response?.success && response.path) {
                const path = response.path.replace(/\\/g, '/');
                window.open(`file:///${path}`, '_blank', 'noopener,noreferrer');
            }
        } catch (error) {
            console.error('Could not export the Backtest report:', error);
        }
    };

    const dayData = dayNames.map((label, index) => ({ label, value: breakdowns.pnl_by_day?.[index] ?? breakdowns.pnl_by_day?.[String(index)] ?? 0 }));
    const hourData = Array.from({ length: 24 }, (_, hour) => ({ label: String(hour).padStart(2, '0'), value: breakdowns.pnl_by_hour?.[hour] ?? breakdowns.pnl_by_hour?.[String(hour)] ?? 0 }));
    const monthlyData = Object.entries(breakdowns.monthly_pnl || {}).sort(([left], [right]) => left.localeCompare(right)).map(([label, value]) => ({ label, value }));

    return (
        <div className="space-y-4 pb-5" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-[#FCFCFD]">{t('bt_analytics') || 'Quant Analytics'}</h2>
                    <p className="mt-1 text-xs text-[#7A797E]">{t('backtest_lab_subtitle')}</p>
                </div>
                <button type="button" onClick={openFullReport} disabled={!backtestResult} className="flex min-h-9 items-center gap-2 rounded-md border border-[#3A3940] bg-[#1E1D22] px-3 text-xs font-semibold text-zinc-200 transition hover:bg-[#2A292F] disabled:cursor-not-allowed disabled:opacity-40">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M14 3h7v7m0-7-9 9" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>
                    {t('bt_open_report') || 'Open Full Interactive HTML Report'}
                </button>
            </header>

            {!backtestResult && <div className="rounded-md border border-dashed border-[#3A3940] bg-[#1A191E] px-4 py-5 text-sm text-zinc-400">{lang === 'fa' ? 'پس از اجرای بک‌تست، گزارش و نمودارها در این صفحه نمایش داده می‌شوند.' : 'Run a backtest to populate the report and analytics.'}</div>}

            <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6" aria-label={t('bt_analytics') || 'Quant Analytics'}>
                {kpis.map((item) => <Stat key={item.label} {...item} />)}
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
                <ChartPanel title={lang === 'fa' ? 'منحنی سرمایه سبد' : 'Portfolio Equity Curve'} subtitle={lang === 'fa' ? 'تغییر سرمایه بر اساس معاملات بسته‌شده' : 'Portfolio value over the backtest timeline'}>
                    <TimeSeriesChart data={equityCurve} valueKey="equity" color="#34D399" gradientId="equity-fill" emptyLabel={lang === 'fa' ? 'داده‌ای برای نمایش موجود نیست' : 'No equity data available'} />
                </ChartPanel>
                <ChartPanel title={lang === 'fa' ? 'افت سرمایه زیرسطحی (%)' : 'Underwater Drawdown (%)'} subtitle={lang === 'fa' ? 'افت نسبت به اوج سرمایه' : 'Drawdown from the portfolio peak'}>
                    <TimeSeriesChart data={equityCurve} valueKey="drawdown_pct" color="#F87171" gradientId="drawdown-fill" negative emptyLabel={lang === 'fa' ? 'داده‌ای برای نمایش موجود نیست' : 'No drawdown data available'} />
                </ChartPanel>
                <ChartPanel title={lang === 'fa' ? 'سود و زیان بر اساس روز هفته' : 'PnL by Day of Week'}>
                    <BarChart data={dayData} emptyLabel={lang === 'fa' ? 'معامله‌ای ثبت نشده است' : 'No trades recorded'} />
                </ChartPanel>
                <ChartPanel title={lang === 'fa' ? 'سود و زیان بر اساس ساعت' : 'PnL by Hour of Day'}>
                    <BarChart data={hourData} emptyLabel={lang === 'fa' ? 'معامله‌ای ثبت نشده است' : 'No trades recorded'} />
                </ChartPanel>
                <ChartPanel title={lang === 'fa' ? 'سود و زیان ماهانه' : 'Monthly PnL'}>
                    <BarChart data={monthlyData} emptyLabel={lang === 'fa' ? 'معامله‌ای ثبت نشده است' : 'No trades recorded'} />
                </ChartPanel>
                <ChartPanel title={lang === 'fa' ? 'مشارکت استراتژی‌ها' : 'Strategy Contribution'}>
                    <StrategyDonut data={Object.entries(breakdowns.pnl_by_strategy || {})} emptyLabel={lang === 'fa' ? 'معامله‌ای ثبت نشده است' : 'No strategy results available'} />
                </ChartPanel>
            </div>

            <section className={`${panelClass} overflow-hidden`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-sm font-bold text-[#FCFCFD]">{lang === 'fa' ? 'گزارش معاملات' : 'Trade Log'}</h2><p className="mt-1 text-[10px] text-[#7A797E]">{trades.length} {lang === 'fa' ? 'رویداد معاملاتی' : 'trade events'}</p></div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span>{trades.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, trades.length)} / ${trades.length}` : '0 / 0'}</span>
                        <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} aria-label={lang === 'fa' ? 'صفحه قبل' : 'Previous page'} className="flex h-8 w-8 items-center justify-center rounded border border-[#34343B] disabled:opacity-35"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m15 18-6-6 6-6" /></svg></button>
                        <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1} aria-label={lang === 'fa' ? 'صفحه بعد' : 'Next page'} className="flex h-8 w-8 items-center justify-center rounded border border-[#34343B] disabled:opacity-35"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9 18 6-6-6-6" /></svg></button>
                    </div>
                </div>
                <div className="max-h-[520px] overflow-auto custom-scroll">
                    <table className="min-w-[1250px] w-full border-collapse text-left text-[10px]" dir="ltr">
                        <thead className="sticky top-0 z-10 bg-[#222127] text-[9px] uppercase text-zinc-400">
                            <tr>{['Strategy', 'Symbol', 'Type', 'Lot Size', 'Entry Time', 'Exit Time', 'Entry Price', 'Exit Price', 'SL', 'TP', 'Commission', 'Net Profit $', 'Exit Reason'].map((label) => <th key={label} className="border-b border-[#34343B] px-3 py-3 font-semibold">{label}</th>)}</tr>
                        </thead>
                        <tbody>
                            {visibleTrades.map((trade, index) => {
                                const pnl = number(trade.net_profit);
                                return <tr key={`${trade.strategy}-${trade.entry_time}-${index}`} className="border-b border-[#2C2B32] text-zinc-300 hover:bg-white/[0.025]">
                                    <td className="max-w-40 truncate px-3 py-2.5 font-semibold text-white">{trade.strategy || trade.strategy_name || trade.strategy_id || '—'}</td>
                                    <td className="px-3 py-2.5 font-mono">{trade.symbol || '—'}</td>
                                    <td className={`px-3 py-2.5 uppercase ${String(trade.type).toLowerCase() === 'buy' ? 'text-emerald-300' : 'text-rose-300'}`}>{trade.type || '—'}</td>
                                    <td className="px-3 py-2.5 font-mono">{number(trade.lot_size ?? trade.lot).toFixed(2)}</td>
                                    <td className="whitespace-nowrap px-3 py-2.5">{dateTime(trade.entry_time)}</td>
                                    <td className="whitespace-nowrap px-3 py-2.5">{dateTime(trade.exit_time)}</td>
                                    <td className="px-3 py-2.5 font-mono">{number(trade.entry_price).toFixed(5)}</td>
                                    <td className="px-3 py-2.5 font-mono">{number(trade.exit_price).toFixed(5)}</td>
                                    <td className="px-3 py-2.5 font-mono">{number(trade.sl).toFixed(5)}</td>
                                    <td className="px-3 py-2.5 font-mono">{number(trade.tp).toFixed(5)}</td>
                                    <td className="px-3 py-2.5 font-mono">{money(trade.commission)}</td>
                                    <td className={`px-3 py-2.5 font-mono font-bold ${pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(pnl)}</td>
                                    <td className="px-3 py-2.5">{trade.exit_reason || '—'}</td>
                                </tr>;
                            })}
                            {!visibleTrades.length && <tr><td colSpan="13" className="px-3 py-12 text-center text-zinc-500">{lang === 'fa' ? 'معامله‌ای برای نمایش وجود ندارد' : 'No trades to display'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default BacktestAnalyticsPanel;