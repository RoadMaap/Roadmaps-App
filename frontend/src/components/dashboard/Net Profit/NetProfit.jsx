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
            className="mx-auto h-full w-full max-w-[760px] min-w-0 rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4 sm:p-6 sm:pb-5"
            aria-label={`${t('net_profit_today')}: $${profit.toFixed(2)}`}
        >
            <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
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
                    showHeader
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