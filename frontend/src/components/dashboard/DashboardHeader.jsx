import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

const DashboardHeader = ({ activeTab, userName, strategyCount, hasUpdate, onShowUpdate, onToggleLanguage }) => {
    const { t, lang } = useLanguage();
    const title = activeTab === 'dashboard'
        ? userName || 'Trading App'
        : activeTab === 'education'
            ? t('ai_builder_title')
            : activeTab === 'analyze'
                ? t('chart_analysis') || 'Chart analysis'
                : t('strategy_management');
    const subtitle = activeTab === 'dashboard'
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
                <div className="hidden min-h-10 items-center gap-3 rounded-md border border-[#2F2E35] bg-[#1E1D22] px-3 sm:flex">
                    <span className="text-[10px] font-semibold uppercase text-[#7A797E]">{t('active_strategies')}</span>
                    <span className="h-4 w-px bg-[#2F2E35]" aria-hidden="true" />
                    <span className="font-mono text-sm font-bold text-[#F28C45]">{strategyCount.toString().padStart(2, '0')}</span>
                </div>
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
        </header>
    );
};

export default DashboardHeader;