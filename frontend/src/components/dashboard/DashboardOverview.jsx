import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import EnginePanel from '../EnginePanel';
import RiskPanel from '../riskpanel/RiskPanel';
import Sparkline from '../Sparkline';

const DashboardOverview = ({
    initialData, nextNews, liveData, profitHistory, equityProgress,
    mt5Path, onPathChange, logs, isRunning, onToggleEngine, onClearLogs,
}) => {
    const { t, lang } = useLanguage();
    const profit = liveData?.profit || 0;
    const equity = liveData?.equity || 0;
    const positions = liveData?.positions || 0;

    return (
        <>
            <section className="rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4 sm:p-5" aria-label={`${t('net_profit_today')}, ${t('account_balance')}, ${t('open_positions')}`}>
                <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
                    <div className="flex min-w-0 flex-col pb-4 md:min-h-[176px] md:px-5 md:pb-0">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-start text-[#F28C45]"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 2v20m5-15H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>
                            <span className="text-[10px] font-semibold uppercase text-[#7A797E]">{t('net_profit_today')}</span>
                        </div>
                        <p className={`mt-4 text-2xl font-bold tabular-nums ${profit > 0 ? 'text-emerald-300' : profit < 0 ? 'text-[#E47770]' : 'text-[#FCFCFD]'}`}>${profit.toFixed(2)}</p>
                        {profit !== 0 && <p className={`mt-1 text-[10px] font-semibold ${profit > 0 ? 'text-emerald-300' : 'text-[#E47770]'}`}>{profit > 0 ? '+' : '-'}{profit > 0 ? t('roi') || 'ROI' : t('drawdown') || 'Drawdown'}</p>}
                        <div className="mt-auto flex h-12 w-full translate-y-2 justify-center pt-2 opacity-90">
                            <div className="h-full w-full">
                                <Sparkline data={profitHistory || []} color={profit < 0 ? '#E47770' : '#10B981'} centered />
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col border-t border-[#2F2E35] py-4 md:min-h-[176px] md:border-s md:border-t-0 md:px-5 md:py-0">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-start text-[#F28C45]"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg></span>
                            <span className="text-[10px] font-semibold uppercase text-[#7A797E]">{t('account_balance')}</span>
                        </div>
                        <p className="mt-4 text-2xl font-bold tabular-nums text-[#FCFCFD]">${equity.toFixed(2)}</p>
                        <div className="relative mt-auto h-12 translate-y-2">
                            <div className="absolute inset-0 flex -translate-y-2 items-center justify-between gap-2">
                                <span className="truncate text-[9px] font-semibold uppercase text-[#7A797E]">{t('equity_growth')}</span>
                                <span className={`text-[10px] font-semibold ${equityProgress.isProfit ? 'text-[#F28C45]' : 'text-[#E47770]'}`}>
                                    {equityProgress.isProfit ? '+' : '-'}{equityProgress.percent}%
                                </span>
                            </div>
                            <div className="absolute inset-x-0 bottom-4 h-2 overflow-hidden rounded-full border border-[#2F2E35] bg-[#141318]">
                                {equityProgress.isProfit && <div className="h-full w-full bg-[#7A797E]/20" />}
                                <div
                                    className={`relative -mt-2 h-full transition-all duration-700 ease-out ${equityProgress.isProfit ? 'bg-[#F28C45]' : 'bg-[#E47770]'}`}
                                    style={{ width: equityProgress.width, marginInlineStart: equityProgress.isProfit && lang === 'fa' ? 'auto' : 0 }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col border-t border-[#2F2E35] pt-4 md:min-h-[176px] md:border-s md:border-t-0 md:ps-5 md:pt-0">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-start text-[#F28C45]"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></span>
                            <span className="text-[10px] font-semibold uppercase text-[#7A797E]">{t('open_positions')}</span>
                        </div>
                        <p className="mt-4 text-2xl font-bold tabular-nums text-[#FCFCFD]">{positions}</p>
                        <span className={`mt-auto flex h-12 items-center gap-1.5 text-[10px] font-medium leading-tight ${positions > 0 ? 'text-emerald-300' : 'text-[#7A797E]'}`}>
                            <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${positions > 0 ? 'bg-emerald-400' : 'bg-[#7A797E]'}`} />
                            <span>{positions > 0 ? t('market_exposure_active') : t('no_exposure')}</span>
                        </span>
                    </div>
                </div>
            </section>
            <div className="grid min-h-[500px] grid-cols-1 gap-4 pb-4 lg:grid-cols-12">
                <div className="min-h-[500px] lg:col-span-8"><RiskPanel initialData={initialData} nextNews={nextNews} /></div>
                <div className="min-h-[500px] lg:col-span-4">
                    <EnginePanel mt5Path={mt5Path} onPathChange={onPathChange} logs={logs} isRunning={isRunning} onToggle={onToggleEngine} onClearLogs={onClearLogs} />
                </div>
            </div>
        </>
    );
};

export default DashboardOverview;