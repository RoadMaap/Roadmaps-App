import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const UpgradeModal = ({ onClose, onUpgrade, onDemo, lang, t }) => {
    const features = [
        'feature_unlimited_strategies',
        'feature_ai_vision',
        'feature_smart_news_filter',
        'feature_advanced_risk',
        'feature_engine_warmup',
    ];

    useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    return createPortal((
        <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <section role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title" dir={lang === 'fa' ? 'rtl' : 'ltr'} className="relative my-auto w-full max-w-md overflow-hidden rounded-xl border border-amber-200/20 bg-[#18171b] p-6 text-[#FCFCFD] shadow-[0_24px_90px_rgba(0,0,0,0.65)] sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                <button type="button" onClick={onClose} aria-label={t('close')} className="absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/25 bg-amber-200/10 text-amber-200">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2L12 3Z" /><path strokeLinecap="round" strokeWidth="1.7" d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" /></svg>
                </span>
                <p className="mb-2 text-[10px] font-bold uppercase text-amber-200/80">{t('plan_pro')}</p>
                <h2 id="upgrade-modal-title" className="text-xl font-bold leading-snug">{t('upgrade_modal_title')}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{t('upgrade_modal_desc')}</p>
                <ul className="mt-6 space-y-3">
                    {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm text-zinc-200">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m3 8 3 3 7-7" /></svg>
                            </span>
                            {t(feature)}
                        </li>
                    ))}
                </ul>
                <button type="button" onClick={onUpgrade} className="mt-7 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-200 px-5 py-3 text-sm font-bold text-[#201b10] transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
                    {t('upgrade_account')}
                    <span aria-hidden="true">↗</span>
                </button>
                <button type="button" onClick={onDemo} className="mt-3 min-h-10 w-full rounded-md border border-[#3A3940] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
                    {t('try_pro_demo')}
                </button>
            </section>
        </div>
    ), document.body);
};

const DashboardHeader = ({ activeTab, appMode = 'live', userName, strategyCount, hasUpdate, onShowUpdate, onToggleLanguage }) => {
    const { t, lang } = useLanguage();
    const { plan, setPlan } = useAuth();
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const planLabel = String(plan || 'Basic').toLowerCase() === 'advance' ? 'Advance' : String(plan || 'Basic').toLowerCase() === 'pro' ? 'Pro' : 'Basic';
    const isBacktestMode = appMode === 'backtest';
    const title = isBacktestMode
        ? activeTab === 'bt_overview'
            ? t('bt_overview') || 'Backtest Lab'
            : activeTab === 'bt_strategies'
                ? t('bt_strategies') || 'Backtest Strategies'
                : activeTab === 'bt_analytics'
                    ? t('bt_analytics') || 'Quant Analytics'
                    : activeTab === 'bt_plot'
                        ? t('bt_plot') || 'Chart Plot'
                        : t('bt_overview') || 'Backtest Lab'
        : activeTab === 'dashboard'
            ? userName || 'Trading App'
            : activeTab === 'education'
                ? t('ai_builder_title')
                : activeTab === 'analyze'
                    ? t('chart_analysis') || 'Chart analysis'
                    : t('strategy_management');
    const subtitle = isBacktestMode
        ? activeTab === 'bt_plot'
            ? t('bt_plot_subtitle') || 'Candlestick, Indicators & Trade Execution Plot'
            : t('backtest_lab_subtitle') || 'Live quant simulation and portfolio validation'
        : activeTab === 'dashboard'
            ? t('real_time_monitoring')
            : activeTab === 'education'
                ? t('ai_builder_subtitle')
                : activeTab === 'analyze'
                    ? t('upload_chart_screenshots')
                    : t('strategy_config_subtitle');

    return (
        <header className="sticky top-0 z-20 flex min-h-[76px] shrink-0 items-center justify-between gap-4 bg-[#141318]/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="min-w-0">
                <h1 className="truncate text-lg font-bold leading-tight text-[#FCFCFD] sm:text-xl">{title}</h1>
                <p className="mt-1 truncate text-xs font-medium text-[#7A797E]">{subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="flex min-h-10 items-center gap-2 rounded-md border border-[#2F2E35] bg-[#1E1D22] px-2 sm:gap-3 sm:px-3">
                    <span className="hidden text-[10px] font-semibold uppercase text-[#7A797E] lg:inline">{t('active_strategies')}</span>
                    <span className="h-4 w-px bg-[#2F2E35]" aria-hidden="true" />
                    <span className="font-mono text-sm font-bold text-[#F28C45]">{strategyCount.toString().padStart(2, '0')}</span>
                </div>
                <button
                    type="button"
                    onClick={() => setIsUpgradeModalOpen(true)}
                    aria-haspopup="dialog"
                    aria-label={planLabel}
                    className={`inline-flex min-h-10 items-center rounded-md border px-2 text-[10px] font-bold transition sm:px-3 ${planLabel === 'Basic' ? 'border-zinc-600/70 bg-zinc-700/30 text-zinc-300 hover:bg-zinc-700/60' : 'border-amber-200/40 bg-amber-200/10 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.13)] hover:bg-amber-200/15'}`}
                >
                    {planLabel}
                </button>
                {hasUpdate && (
                    <button
                        type="button"
                        onClick={onShowUpdate}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#F28C45]/40 bg-[#F28C45]/10 px-3 text-xs font-semibold text-[#F28C45] transition-colors hover:bg-[#F28C45]/15 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#F28C45] sm:px-4"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3" />
                        </svg>
                        <span className="hidden sm:inline">{t('update_available')}</span>
                    </button>
                )}
                <button
                    type="button"
                    onClick={onToggleLanguage}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-[#2F2E35] bg-[#1E1D22] text-[#F28C45] transition-colors hover:bg-[#2A292F] hover:text-[#FCFCFD] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#F28C45]"
                    title={lang === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
                    aria-label={lang === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" strokeWidth="1.7" />
                        <path strokeLinecap="round" strokeWidth="1.7" d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                    </svg>
                </button>
            </div>
            {isUpgradeModalOpen && (
                <UpgradeModal
                    onClose={() => setIsUpgradeModalOpen(false)}
                    onDemo={async () => {
                        const nextPlan = 'Advance';
                        setPlan(nextPlan);
                        if (window.eel) await window.eel.save_user_config({ plan: nextPlan })();
                        if (window.eel) await window.eel.set_user_plan(nextPlan)();
                        setIsUpgradeModalOpen(false);
                    }}
                    onUpgrade={() => {
                        const nextPlan = 'Advance';
                        setPlan(nextPlan);
                        if (window.eel) window.eel.save_user_config({ plan: nextPlan })();
                        if (window.eel) window.eel.set_user_plan(nextPlan)();
                        window.dispatchEvent(new CustomEvent('roadmaps:upgrade-requested', { detail: { requiredPlan: 'Advance' } }));
                        setIsUpgradeModalOpen(false);
                    }}
                    lang={lang}
                    t={t}
                />
            )}
        </header>
    );
};

export default DashboardHeader;