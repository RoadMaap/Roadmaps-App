import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useBacktest } from '../../context/BacktestContext';
import ToggleSwitch from '../riskpanel/ToggleSwitch';

const inputFrame = 'flex h-9 min-w-0 items-center rounded-md border border-[#2F2E35] bg-[#141318] px-2 transition-colors focus-within:border-emerald-500/60';
const numberInput = 'w-full min-w-0 border-none bg-transparent text-xs text-[#FCFCFD] outline-none';

const BacktestOverview = () => {
    const { t, lang } = useLanguage();
    const {
        settings,
        setSettings,
        logs,
        clearLogs,
        progress,
        isBacktesting,
        backtestResult,
        setBacktestResult,
        setIsBacktesting,
    } = useBacktest();
    const [isCancelling, setIsCancelling] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const logViewportRef = useRef(null);
    const hasRequestedResultRef = useRef(false);
    useEffect(() => {
        if (!window.eel || backtestResult || hasRequestedResultRef.current) return;
        hasRequestedResultRef.current = true;
        window.eel.get_last_backtest_result()().then((response) => {
            if (response?.success && response.result) setBacktestResult(response.result);
        }).catch((error) => console.error('Could not restore backtest results:', error));
    }, [backtestResult, setBacktestResult]);

    useEffect(() => {
        if (logViewportRef.current) logViewportRef.current.scrollTop = logViewportRef.current.scrollHeight;
    }, [logs]);

    useEffect(() => {
        if (!isBacktesting) setIsCancelling(false);
    }, [isBacktesting]);

    const updateSetting = (key, value) => setSettings({ [key]: value });

    const handleRunToggle = async () => {
        if (!window.eel || isCancelling) return;
        try {
            if (isBacktesting) {
                setIsCancelling(true);
                const response = await window.eel.stop_backtest()();
                if (response?.success === false) setIsCancelling(false);
            } else {
                setIsBacktesting(true);
                setIsCancelling(false);
                await window.eel.save_backtest_config(settings)();
                const response = await window.eel.start_backtest()();
                if (response?.cancelled) {
                    setIsBacktesting(false);
                    setIsCancelling(false);
                    return;
                }
                if (response?.success === false) {
                    setIsBacktesting(false);
                    setIsCancelling(false);
                    return;
                }
            }
        } catch (error) {
            setIsBacktesting(false);
            setIsCancelling(false);
            console.error('Backtest control request failed:', error);
        }
    };

    const choosePath = async () => {
        if (!window.eel) return;
        try {
            const path = await window.eel.choose_mt5_path()();
            if (path) updateSetting('mt5_path', path);
        } catch (error) {
            console.error('Could not select MT5 terminal path:', error);
        }
    };

    const copyLogs = async () => {
        if (!logs?.length) return;
        const text = logs.map((log) => `[${new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}] ${log.text}`).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            window.setTimeout(() => setIsCopied(false), 2000);
        } catch (error) {
            console.error('Could not copy backtest logs:', error);
        }
    };

    const percent = Math.min(100, Math.max(0, Number(progress?.percent || 0)));
    const statusText = isBacktesting
        ? (lang === 'fa' ? 'سیستم آنلاین - اجرای بک‌تست' : 'SYSTEM ONLINE - RUNNING BACKTEST')
        : (t('system_offline') || 'SYSTEM OFFLINE');

    return (
        <div className="pb-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
            <div className="grid min-h-[500px] grid-cols-1 gap-4 pb-4 lg:grid-cols-12">
                <section className="flex min-h-[500px] flex-col overflow-hidden rounded-lg border border-[#2F2E35] bg-[#1A191E] lg:col-span-8" aria-label={t('bt_system_settings') || 'System & Simulation Settings'}>
                    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 custom-scroll sm:p-6">
                        <section className="flex flex-col gap-4">
                            <header className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center text-emerald-400">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </span>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-bold tracking-tight text-[#FCFCFD]">{t('bt_system_settings') || 'System & Simulation Settings'}</h2>
                                    <p className="text-[10px] font-medium text-[#7A797E]">{t('backtest_lab_subtitle')}</p>
                                </div>
                            </header>

                            <div className="space-y-3 rounded-md border border-[#2F2E35] bg-[#141318] p-3 sm:p-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block text-[9px] font-bold text-zinc-500">{t('bt_initial_capital') || 'Initial Capital ($)'}
                                        <span className={`${inputFrame} mt-1.5`} dir="ltr"><span className="mr-2 text-[10px] text-[#7A797E]">$</span><input type="number" value={settings.initial_capital ?? 10000} onChange={(event) => updateSetting('initial_capital', Number(event.target.value))} className={numberInput} /></span>
                                    </label>
                                    <label className="block text-[9px] font-bold text-zinc-500">{t('bt_start_date') || 'Start Date'}
                                        <span className={`${inputFrame} mt-1.5`} dir="ltr"><input type="date" value={settings.start_date || '2023-01-01'} onChange={(event) => updateSetting('start_date', event.target.value)} className={numberInput} /></span>
                                    </label>
                                </div>
                                <label className="block text-[9px] font-bold text-zinc-500">{t('bt_leverage') || 'Simulated Leverage (1:X)'}
                                    <span className={`${inputFrame} mt-1.5`} dir="ltr"><span className="mr-2 text-[10px] text-[#7A797E]">1:</span><input type="number" min="1" value={settings.leverage ?? 100} onChange={(event) => updateSetting('leverage', Number(event.target.value))} className={numberInput} /></span>
                                </label>
                                <article className={`rounded-md border p-3 transition-colors ${settings.margin_limit_enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[#2F2E35] bg-[#141318]'}`}>
                                    <div className="mb-3 flex items-center gap-3"><ToggleSwitch checked={Boolean(settings.margin_limit_enabled)} onChange={(event) => updateSetting('margin_limit_enabled', event.target.checked)} label={t('bt_margin_limit') || 'Max Margin Usage'} /><span className="text-xs font-semibold text-[#BDBABD]">{t('bt_margin_limit') || 'Max Margin Usage (%)'}</span></div>
                                    <div className={`flex items-center gap-2 ${settings.margin_limit_enabled ? '' : 'pointer-events-none opacity-35'}`}><div className={`${inputFrame} flex-1`} dir="ltr"><input type="number" value={settings.margin_limit_pct ?? 100} onChange={(event) => updateSetting('margin_limit_pct', Number(event.target.value))} className={numberInput} /><span className="ml-2 text-[10px] font-semibold text-[#7A797E]">%</span></div></div>
                                </article>
                                <article className={`rounded-md border p-3 transition-colors ${settings.lookback_enabled !== false ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[#2F2E35] bg-[#141318]'}`}>
                                    <div className="mb-3 flex items-center gap-3"><ToggleSwitch checked={settings.lookback_enabled !== false} onChange={(event) => updateSetting('lookback_enabled', event.target.checked)} label={t('bt_warmup_lookback') || 'Warm-up / Lookback Candles'} /><span className="text-xs font-semibold text-[#BDBABD]">{t('bt_warmup_lookback') || 'Warm-up / Lookback Candles'}</span></div>
                                    <div className={`flex items-center gap-2 ${settings.lookback_enabled !== false ? '' : 'pointer-events-none opacity-35'}`}><span className="w-16 shrink-0 text-[10px] font-semibold uppercase text-[#7A797E]">{t('candles') || 'Candles'}</span><div className={`${inputFrame} flex-1`} dir="ltr"><input type="number" value={settings.lookback_period ?? 500} onChange={(event) => updateSetting('lookback_period', Number(event.target.value))} className={numberInput} /></div></div>
                                </article>
                                <article className={`rounded-md border p-3 transition-colors ${settings.strict_lookahead_protection ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[#2F2E35] bg-[#141318]'}`}>
                                    <div className="flex items-center gap-3"><ToggleSwitch checked={Boolean(settings.strict_lookahead_protection)} onChange={(event) => updateSetting('strict_lookahead_protection', event.target.checked)} label={t('bt_strict_lookahead') || 'Strict Lookahead Protection'} /><span className="text-xs font-semibold text-[#BDBABD]">{t('bt_strict_lookahead') || 'Strict Lookahead Protection'}</span></div>
                                </article>
                            </div>
                        </section>

                        <div aria-hidden="true" className="h-px bg-[#2F2E35]" />

                        <section className="flex flex-col gap-4">
                            <header className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center text-emerald-400"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg></span>
                                <div><h2 className="text-sm font-bold tracking-tight text-[#FCFCFD]">{t('global_risk_protections') || 'Global Risk Management'}</h2><p className="text-[10px] font-medium text-[#7A797E]">{t('global_risk_desc')}</p></div>
                            </header>
                            <div className="space-y-3 rounded-md border border-[#2F2E35] bg-[#141318] p-3 sm:p-4">
                                <article className={`rounded-md border p-3 transition-colors ${settings.be_enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[#2F2E35] bg-[#141318]'}`}>
                                    <div className="mb-3 flex items-center gap-3"><ToggleSwitch checked={Boolean(settings.be_enabled)} onChange={(event) => updateSetting('be_enabled', event.target.checked)} label={t('auto_breakeven')} /><span className="text-xs font-semibold text-[#BDBABD]">{t('auto_breakeven')}</span></div>
                                    <div className={`flex items-center gap-2 ${settings.be_enabled ? '' : 'pointer-events-none opacity-35'}`}><span className="w-16 shrink-0 text-[10px] font-semibold uppercase text-[#7A797E]">{t('trigger')}</span><div className={`${inputFrame} flex-1`} dir="ltr"><input type="number" value={settings.be_trigger ?? 1} onChange={(event) => updateSetting('be_trigger', Number(event.target.value))} className={numberInput} /><span className="ml-1 text-[9px] font-semibold text-[#7A797E]">R</span></div></div>
                                </article>
                                <article className={`rounded-md border p-3 transition-colors ${settings.pc_enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[#2F2E35] bg-[#141318]'}`}>
                                    <div className="mb-3 flex items-center gap-3"><ToggleSwitch checked={Boolean(settings.pc_enabled)} onChange={(event) => updateSetting('pc_enabled', event.target.checked)} label={t('partial_close')} /><span className="text-xs font-semibold text-[#BDBABD]">{t('partial_close')}</span></div>
                                    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${settings.pc_enabled ? '' : 'pointer-events-none opacity-35'}`}>
                                        <label className={`${inputFrame} gap-2`} dir="ltr"><span className="w-8 shrink-0 text-[9px] font-semibold text-[#7A797E]">{t('vol')}</span><input type="number" value={settings.pc_volume ?? 50} onChange={(event) => updateSetting('pc_volume', Number(event.target.value))} className={numberInput} /><span className="text-[9px] font-semibold text-[#7A797E]">%</span></label>
                                        <label className={`${inputFrame} gap-2`} dir="ltr"><span className="w-8 shrink-0 text-[9px] font-semibold text-[#7A797E]">{t('at')}</span><input type="number" value={settings.pc_trigger ?? 2} onChange={(event) => updateSetting('pc_trigger', Number(event.target.value))} className={numberInput} /><span className="text-[9px] font-semibold text-[#7A797E]">R</span></label>
                                    </div>
                                </article>
                            </div>
                        </section>
                    </div>
                </section>

                <div className="flex min-h-[500px] flex-col gap-6 lg:col-span-4">
                    <section className="relative flex min-h-[180px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#2F2E35] bg-[#1A191E] p-6">
                        <h2 className="relative z-10 mb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{t('trading_engine')}</h2>
                        <button type="button" onClick={handleRunToggle} disabled={isCancelling} aria-label={isCancelling ? (t('bt_cancelling') || 'Cancelling backtest') : isBacktesting ? (t('bt_stop') || 'Cancel Backtest') : (t('bt_run') || 'Run Backtest')} className={`relative z-10 flex items-center justify-center gap-2 outline-none transition-all duration-300 disabled:cursor-wait disabled:opacity-70 ${isBacktesting ? 'min-h-11 w-full max-w-xs rounded-md bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-500' : 'h-20 w-20 rounded-full border-2 border-zinc-700 bg-[#18181b] text-zinc-600 hover:border-zinc-500 hover:text-zinc-300 hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]'}`}>
                            {isBacktesting ? (
                                <>
                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" /></svg>
                                    <span>{isCancelling ? (t('bt_cancelling') || 'Cancelling...') : (t('bt_stop') || 'Cancel Backtest')}</span>
                                </>
                            ) : (
                                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            )}
                        </button>
                        <div className="relative z-10 mt-5 flex h-10 flex-col items-center justify-start">
                            <span className={`text-[10px] font-bold transition-colors ${isBacktesting ? 'text-emerald-400' : 'text-zinc-500'}`}>{statusText}</span>
                            {isBacktesting && <span className="mt-1 text-[9px] font-mono text-emerald-500/70">{isCancelling ? (t('bt_cancelling') || 'Cancelling...') : progress?.phase || 'Preparing backtest'}</span>}
                        </div>
                        {isBacktesting && <div className="relative z-10 mt-2 w-full max-w-xs">
                            <div className="mb-1 flex justify-between text-[9px] font-mono text-zinc-400"><span>{progress?.phase || 'Running'}</span><span>{Math.round(percent)}%</span></div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[#2a2b31]"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${percent}%` }} /></div>
                        </div>}
                    </section>

                    <section className="shrink-0 rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{t('terminal_path') || 'Terminal Path'}</label>
                            <span className={`h-2 w-2 rounded-full ${settings.mt5_path ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        </div>
                        <div className="flex gap-2 rounded-xl border border-white/5 bg-[#09090b] p-1.5">
                            <input type="text" value={settings.mt5_path || (t('not_selected') || 'Not Selected')} readOnly className="min-w-0 flex-1 truncate border-none bg-transparent px-2 text-[10px] font-mono text-zinc-400 outline-none" />
                            <button type="button" onClick={choosePath} className="rounded-lg bg-white/5 px-3 text-[10px] font-bold text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">{t('browse_btn') || 'BROWSE'}</button>
                        </div>
                    </section>

                    <section className="flex h-[635px] shrink-0 flex-col overflow-hidden rounded-lg border border-[#2F2E35] bg-[#1A191E]">
                        <header className="flex shrink-0 items-center justify-between border-b border-[#2F2E35] bg-[#1E1D22] px-4 py-3">
                            <div className="flex items-center gap-2"><svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3" /></svg><h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t('live_logs') || 'Live Logs'}</h2></div>
                            <div className="flex items-center gap-1.5">
                                <button type="button" onClick={copyLogs} disabled={!logs?.length} aria-label={t('copy_logs') || 'Copy Logs'} title={t('copy_logs') || 'Copy Logs'} className="rounded-md bg-emerald-500/20 p-1.5 text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40">
                                    {isCopied ? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}
                                </button>
                                <button type="button" onClick={clearLogs} disabled={!logs?.length} aria-label={t('clear_logs') || 'Clear Logs'} title={t('clear_logs') || 'Clear Logs'} className="rounded-md bg-rose-500/20 p-1.5 text-rose-300 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                        </header>
                        <div ref={logViewportRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto scroll-smooth bg-[#141318] p-4 font-mono text-[10px] custom-scroll">
                            {!logs?.length && <div className="border-l-2 border-zinc-800 pl-2 text-zinc-600">{t('system_init') || 'System Initialized. Waiting for commands...'}</div>}
                            {(logs || []).map((log, index) => {
                                const tone = log.type === 'error' ? 'border-rose-500/50 text-rose-400 bg-rose-500/5 py-1 pr-1' : log.type === 'success' ? 'border-emerald-500/50 text-emerald-400' : log.type === 'warning' ? 'border-yellow-500/50 text-yellow-400' : 'border-zinc-700 text-zinc-400';
                                return <div key={`${log.timestamp}-${index}`} className="flex gap-2"><span className="mt-0.5 shrink-0 text-[9px] text-zinc-600">[{new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}]</span><div className={`flex-1 break-words whitespace-pre-wrap border-l-2 pl-2 leading-relaxed ${tone}`}>{log.text}</div></div>;
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default BacktestOverview;