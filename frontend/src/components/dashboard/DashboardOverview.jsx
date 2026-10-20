import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useEngineLiveData } from '../../context/EngineStateContext';
import EnginePanel from '../EnginePanel';
import RiskPanel from '../riskpanel/RiskPanel';
import NetProfit from './NetProfit';
import { TotalBalance } from '../ui/total-balance';

const BALANCE_RANGES = [
    { key: '24h', label: '24h', durationMs: 24 * 60 * 60 * 1000 },
    { key: '1w', label: '1w', durationMs: 7 * 24 * 60 * 60 * 1000 },
    { key: '1m', label: '1m', durationMs: 30 * 24 * 60 * 60 * 1000 },
    { key: 'all', label: 'All', durationMs: null },
];

const DashboardOverview = ({ initialData, nextNews, onToggleEngine }) => {
    const { t, lang } = useLanguage();
    const liveData = useEngineLiveData();
    const profit = liveData?.profit || 0;
    const equity = liveData?.equity || 0;
    const positions = liveData?.positions || 0;
    const equityRef = useRef(equity);
    const [equityHistory, setEquityHistory] = useState(() => [{ time: Date.now(), value: equity }]);

    useEffect(() => {
        equityRef.current = equity;
    }, [equity]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setEquityHistory((previous) => [...previous, { time: Date.now(), value: equityRef.current }].slice(-43_200));
        }, 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const balanceWindows = useMemo(() => BALANCE_RANGES.map((range) => {
        const cutoff = range.durationMs === null ? -Infinity : Date.now() - range.durationMs;
        const samples = equityHistory.filter((point) => point.time >= cutoff);
        const firstTime = samples[0]?.time ?? Date.now();
        const lastTime = samples[samples.length - 1]?.time ?? firstTime;
        return {
            key: range.key,
            label: range.label,
            series: samples.length ? samples.map((point) => point.value) : [equity],
            length: Math.max(1, (lastTime - firstTime) / 1000),
            unit: 'seconds',
        };
    }), [equityHistory, equity]);

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.5fr]" dir="ltr">
                <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="flex min-w-0 flex-col rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4 sm:p-5" aria-label={t('account_balance')}>
                    <TotalBalance
                        title={t('account_balance')}
                        windows={balanceWindows}
                        defaultRange="24h"
                        currentValue={equity}
                    />
                </section>

                <div className="min-w-0" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                    <NetProfit profit={profit} brokerTimeMs={liveData?.brokerTimeMs} />
                </div>

                <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="flex min-w-0 flex-col rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4 sm:col-start-2 sm:row-start-2 sm:p-5" aria-label={t('open_positions')}>
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-start text-[#F28C45]"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></span>
                        <span className="text-[10px] font-semibold uppercase text-[#7A797E]">{t('open_positions')}</span>
                    </div>
                    <p className="mt-4 text-2xl font-bold tabular-nums text-[#FCFCFD]">{positions}</p>
                    <span className={`mt-auto flex h-12 items-center gap-1.5 text-[10px] font-medium leading-tight ${positions > 0 ? 'text-emerald-300' : 'text-[#7A797E]'}`}>
                        <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${positions > 0 ? 'bg-emerald-400' : 'bg-[#7A797E]'}`} />
                        <span>{positions > 0 ? t('market_exposure_active') : t('no_exposure')}</span>
                    </span>
                </section>
            </div>
            <div className="grid min-h-[500px] grid-cols-1 gap-4 pb-4 lg:grid-cols-12">
                <div className="min-h-[500px] lg:col-span-8"><RiskPanel initialData={initialData} nextNews={nextNews} /></div>
                <div className="min-h-[500px] lg:col-span-4">
                    <EnginePanel onToggle={onToggleEngine} />
                </div>
            </div>
        </>
    );
};

export default DashboardOverview;