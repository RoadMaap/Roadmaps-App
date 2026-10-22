import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const BacktestContext = createContext(null);

const initialBacktestState = {
    appMode: 'live',
    currentTab: 'dashboard',
    settings: {
        initial_capital: 10000,
        start_date: '2023-01-01',
        lookback_period: 500,
        leverage: 100,
        margin_limit_enabled: false,
        margin_limit_pct: 100,
        strict_lookahead_protection: true,
        be_enabled: false,
        be_trigger: 1,
        pc_enabled: false,
        pc_volume: 50,
        pc_trigger: 2,
        mt5_path: '',
    },
    strategies: {},
    logs: [],
    progress: { percent: 0, phase: 'Ready', isRunning: false },
    isBacktesting: false,
    backtestResult: null,
    hasUnreadBacktestResult: false,
};

export const BacktestProvider = ({ children }) => {
    const [state, setState] = useState(initialBacktestState);
    const setSettings = useCallback((settings) => setState((previous) => ({
        ...previous,
        settings: { ...previous.settings, ...settings },
    })), []);
    const setStrategies = useCallback((strategies) => setState((previous) => ({
        ...previous,
        strategies: typeof strategies === 'function' ? strategies(previous.strategies) : strategies,
    })), []);
    const setBacktestResult = useCallback((result) => setState((previous) => ({
        ...previous,
        backtestResult: result,
        isBacktesting: false,
        progress: { ...previous.progress, percent: 100, isRunning: false },
    })), []);
    const setIsBacktesting = useCallback((isBacktesting) => setState((previous) => ({
        ...previous,
        isBacktesting: Boolean(isBacktesting),
        progress: { ...previous.progress, isRunning: Boolean(isBacktesting) },
    })), []);
    const setCurrentTab = useCallback((currentTab) => setState((previous) => {
        if (previous.currentTab === currentTab && (currentTab !== 'bt_analytics' || !previous.hasUnreadBacktestResult)) return previous;
        return {
            ...previous,
            currentTab,
            hasUnreadBacktestResult: currentTab === 'bt_analytics' ? false : previous.hasUnreadBacktestResult,
        };
    }), []);
    const receiveBacktestResult = useCallback((result) => setState((previous) => ({
        ...previous,
        backtestResult: result,
        isBacktesting: false,
        progress: { ...previous.progress, percent: 100, isRunning: false },
        hasUnreadBacktestResult: previous.currentTab !== 'bt_analytics',
    })), []);

    useEffect(() => {
        if (!window.eel) return;

        const handleStatus = (messageType, message) => {
            setState((previous) => ({
                ...previous,
                logs: [...previous.logs, { type: messageType, text: message || '', timestamp: Date.now() }].slice(-120),
            }));
        };

        const handleProgress = (percent, phaseText) => {
            const normalizedPercent = Number(percent || 0);
            setState((previous) => ({
                ...previous,
                isBacktesting: true,
                progress: {
                    percent: normalizedPercent,
                    phase: phaseText || previous.progress?.phase || 'Running',
                    isRunning: true,
                },
            }));
        };

        const handleResults = (report) => {
            setState((previous) => ({
                ...previous,
                isBacktesting: false,
                progress: { ...previous.progress, percent: 100, isRunning: false },
                backtestResult: report?.cancelled ? previous.backtestResult : report || previous.backtestResult,
                hasUnreadBacktestResult: report?.cancelled
                    ? previous.hasUnreadBacktestResult
                    : previous.currentTab !== 'bt_analytics',
            }));
        };

        window.eel.expose(handleStatus, 'update_backtest_status');
        window.eel.expose(handleProgress, 'update_backtest_progress');
        window.eel.expose(handleResults, 'update_backtest_results');

        return () => {
            delete window.update_backtest_status;
            delete window.update_backtest_progress;
            delete window.update_backtest_results;
        };
    }, []);

    const value = useMemo(() => ({
        ...state,
        setAppMode: (mode) => setState((previous) => ({
            ...previous,
            appMode: mode === 'backtest' ? 'backtest' : 'live',
        })),
        setSettings,
        setStrategies,
        addLog: (messageType, text) => setState((previous) => ({
            ...previous,
            logs: [...previous.logs, { type: messageType, text, timestamp: Date.now() }].slice(-120),
        })),
        clearLogs: () => setState((previous) => ({ ...previous, logs: [] })),
        setProgress: (percent, phase = 'Running') => setState((previous) => {
            const normalized = Number(percent || 0);
            return {
                ...previous,
                isBacktesting: normalized < 100,
                progress: { percent: normalized, phase, isRunning: normalized < 100 },
            };
        }),
        setBacktestResult,
        setIsBacktesting,
        setCurrentTab,
        receiveBacktestResult,
    }), [state, setSettings, setStrategies, setBacktestResult, setIsBacktesting, setCurrentTab, receiveBacktestResult]);

    return <BacktestContext.Provider value={value}>{children}</BacktestContext.Provider>;
};

export const useBacktest = () => {
    const context = useContext(BacktestContext);
    if (!context) throw new Error('useBacktest must be used within a BacktestProvider');
    return context;
};
