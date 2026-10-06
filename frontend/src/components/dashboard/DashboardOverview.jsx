import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import EnginePanel from '../EnginePanel';
import RiskPanel from '../riskpanel/RiskPanel';
import Sparkline from '../Sparkline';
import MetricCard from './MetricCard';

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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MetricCard
                    title={t('net_profit_today')}
                    value={`$${profit.toFixed(2)}`}
                    trend={profit > 0 ? 'up' : profit < 0 ? 'down' : 'neutral'}
                    subValue={profit !== 0 ? `${profit > 0 ? '+' : '-'}${profit > 0 ? t('roi') || 'ROI' : t('drawdown') || 'Drawdown'}` : undefined}
                    icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 2v20m5-15H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
                >
                    <div className="h-14 w-full opacity-90">
                        <Sparkline data={profitHistory || []} color={profit >= 0 ? '#F28C45' : '#E47770'} />
                    </div>
                </MetricCard>

                <MetricCard
                    title={t('account_balance')}
                    value={`$${equity.toFixed(2)}`}
                    icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                >
                    <div className="h-2 w-full overflow-hidden rounded-full border border-[#2F2E35] bg-[#141318]">
                        {equityProgress.isProfit && <div className="h-full w-full bg-[#7A797E]/20" />}
                        <div
                            className={`relative -mt-2 h-full transition-all duration-700 ease-out ${equityProgress.isProfit ? 'bg-[#F28C45]' : 'bg-[#E47770]'}`}
                            style={{ width: equityProgress.width, marginInlineStart: equityProgress.isProfit && lang === 'fa' ? 'auto' : 0 }}
                        />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[9px] font-semibold uppercase text-[#7A797E]">{t('equity_growth')}</span>
                        <span className={`text-[10px] font-semibold ${equityProgress.isProfit ? 'text-[#F28C45]' : 'text-[#E47770]'}`}>
                            {equityProgress.isProfit ? '+' : '-'}{equityProgress.percent}%
                        </span>
                    </div>
                </MetricCard>

                <MetricCard
                    title={t('open_positions')}
                    value={positions}
                    icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                >
                    <div className={`flex min-h-9 items-center gap-2 rounded-md border px-3 ${positions > 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#2F2E35] bg-[#141318]'}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${positions > 0 ? 'bg-emerald-400' : 'bg-[#7A797E]'}`} />
                        <span className={`truncate text-[10px] font-medium uppercase ${positions > 0 ? 'text-emerald-300' : 'text-[#7A797E]'}`}>
                            {positions > 0 ? t('market_exposure_active') : t('no_exposure')}
                        </span>
                    </div>
                </MetricCard>
            </div>
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