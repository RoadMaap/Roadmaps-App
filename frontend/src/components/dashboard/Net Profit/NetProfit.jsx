import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { DottedAreaChart } from '../../ui/dotted-area-chart';

const SAMPLE_INTERVAL_MS = 1_000;
const HISTORY_SIZE = 300;

const NetProfit = ({ profit, brokerTimeMs }) => {
    const { t } = useLanguage();
    const latestData = useRef({ profit, brokerTimeMs });
    const [profitHistory, setProfitHistory] = useState(() => [{
        time: Number.isFinite(brokerTimeMs) ? brokerTimeMs : Date.now(),
        value: profit,
    }]);
    const formattedProfit = profit.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    useEffect(() => {
        latestData.current = { profit, brokerTimeMs };
    }, [brokerTimeMs, profit]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setProfitHistory((previous) => {
                const previousTime = previous[previous.length - 1]?.time ?? 0;
                const brokerTime = latestData.current.brokerTimeMs;
                const sampleTime = Number.isFinite(brokerTime) && brokerTime > previousTime
                    ? brokerTime
                    : Math.max(Date.now(), previousTime + SAMPLE_INTERVAL_MS);
                return [...previous, { time: sampleTime, value: latestData.current.profit }].slice(-HISTORY_SIZE);
            });
        }, SAMPLE_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, []);

    return (
        <section
            className="mx-auto flex h-full w-full max-w-[760px] min-w-0 flex-col rounded-[10px] border-2 border-[#1B1B1B] bg-[#121212] p-1.5"
            aria-label={`${t('net_profit_today')}: $${profit.toFixed(2)}`}
        >
            <div className="relative z-10 flex h-8 shrink-0 items-center justify-between gap-2 px-1.5">
                <h3 className="min-w-0 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">{t('net_profit_today')}</h3>
                <div className="flex shrink-0 items-baseline gap-2 text-[9px]">
                    <span className="font-semibold text-foreground/90">{formattedProfit}</span>
                    <span className="font-medium text-foreground/60">USD</span>
                </div>
            </div>
            <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[7px] border-2 border-[#1B1B1B] bg-[#090909] px-2">
                <DottedAreaChart
                    name={t('net_profit_today')}
                    symbol="USD"
                    prices={profitHistory.map((point) => point.value)}
                    sampleTimes={profitHistory.map((point) => point.time)}
                    start={profitHistory[0]?.time ?? brokerTimeMs ?? 0}
                    interval={SAMPLE_INTERVAL_MS}
                    timeWindowSize={HISTORY_SIZE}
                    referenceValue={0}
                    currentValue={profit}
                    showHeader={false}
                    showChange={false}
                    showTimeAxis={false}
                    className="mx-auto flex h-full min-h-0 w-full max-w-[600px] flex-col"
                    ariaLabel={`${t('net_profit_today')}: $${profit.toFixed(2)}`}
                />
            </div>
        </section>
    );
};

export default NetProfit;