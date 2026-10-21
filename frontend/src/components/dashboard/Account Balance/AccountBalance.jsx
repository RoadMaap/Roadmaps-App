import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useEngineLiveData } from '../../../context/EngineStateContext';
import { BalanceHeader } from '../../ui/balance-header';
import safeStorage from '../../../lib/safeStorage';

const EQUITY_HISTORY_KEY = 'roadmaps_account_balance_history_v3';
const LEGACY_EQUITY_HISTORY_KEY = 'roadmaps_account_balance_history_v2';
const EQUITY_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const EQUITY_SAMPLE_INTERVAL_MS = 60_000;
const EQUITY_HISTORY_MAX_POINTS = 1_440;

const loadEquityHistory = (equity) => {
    const cutoff = Date.now() - EQUITY_HISTORY_WINDOW_MS;
    const saved = safeStorage.getObject(EQUITY_HISTORY_KEY);
    const legacy = saved ? null : safeStorage.getObject(LEGACY_EQUITY_HISTORY_KEY);
    let history = Array.isArray(saved)
        ? saved.filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
            .map(([time, value]) => ({ time, value }))
        : Array.isArray(legacy)
            ? legacy.flatMap((bucket) => {
                if (!Array.isArray(bucket) || bucket.length !== 8 || !bucket.every(Number.isFinite)) return [];
                const [, open, low, lowTime, high, highTime, close, closeTime] = bucket;
                return [
                    { time: bucket[0], value: open },
                    { time: lowTime, value: low },
                    { time: highTime, value: high },
                    { time: closeTime, value: close },
                ];
            })
            : [];

    history = history.filter((point) => point.time >= cutoff).sort((left, right) => left.time - right.time);
    if (equity > 0 && (!history.length || history[history.length - 1].value !== equity)) {
        history.push({ time: Date.now(), value: equity });
    }
    return history.slice(-EQUITY_HISTORY_MAX_POINTS);
};

const AccountBalance = ({ className = '' }) => {
    const { t, lang } = useLanguage();
    const liveData = useEngineLiveData();
    const equity = liveData?.equity || 0;
    const equityRef = useRef(equity);
    const hasLiveEquityRef = useRef(equity > 0);
    const [equityHistory, setEquityHistory] = useState(() => loadEquityHistory(equity));
    const equityHistoryRef = useRef(equityHistory);

    const recordEquity = () => {
        const value = equityRef.current;
        if (!hasLiveEquityRef.current || value <= 0) return;

        const now = Date.now();
        const last = equityHistoryRef.current[equityHistoryRef.current.length - 1];
        if (last && now - last.time < EQUITY_SAMPLE_INTERVAL_MS) return;

        const next = [...equityHistoryRef.current, { time: now, value }]
            .filter((point) => point.time >= now - EQUITY_HISTORY_WINDOW_MS)
            .slice(-EQUITY_HISTORY_MAX_POINTS);
        equityHistoryRef.current = next;
        setEquityHistory(next);
        safeStorage.setObject(EQUITY_HISTORY_KEY, next.map(({ time, value: pointValue }) => [time, pointValue]));
    };

    useEffect(() => {
        equityRef.current = equity;
        if (equity > 0) {
            hasLiveEquityRef.current = true;
            recordEquity();
        }
    }, [equity]);

    useEffect(() => {
        const timer = window.setInterval(recordEquity, EQUITY_SAMPLE_INTERVAL_MS);
        return () => {
            window.clearInterval(timer);
            safeStorage.setObject(EQUITY_HISTORY_KEY, equityHistoryRef.current.map(({ time, value }) => [time, value]));
        };
    }, []);

    const baseline = equityHistory[0]?.value ?? equity;
    const change = equity - baseline;
    const changePct = baseline > 0 ? (change / baseline) * 100 : 0;

    return (
        <section
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
            className={`flex h-full min-w-0 flex-col rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4 sm:p-5 ${className}`}
            aria-label={t('account_balance')}
        >
            <BalanceHeader
                title={t('account_balance')}
                total={equity}
                change={change}
                changePct={changePct}
                period="24h"
                className="w-full"
            />
        </section>
    );
};

export default AccountBalance;
