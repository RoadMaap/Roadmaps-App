import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Sidebar from '../sidebar/Sidebar';
import DashboardHeader from './DashboardHeader';
import DashboardTabs from './DashboardTabs';
import OptionalUpdateModal from './OptionalUpdateModal';
import { useEngineLogActions, useEngineMetricActions, useEngineRunning, useEngineStatusActions } from '../../context/EngineStateContext';
import { useConfigActions, useMt5Path, useStrategies } from '../../context/ConfigStateContext';
import { useBacktest } from '../../context/BacktestContext';

const Dashboard = ({ updateInfo, onStartOptionalUpdate }) => {
    const { t, toggleLanguage } = useLanguage();
    const mainContentRef = useRef(null);
    const { appendLog } = useEngineLogActions();
    const { setLiveData } = useEngineMetricActions();
    const { setIsRunning } = useEngineStatusActions();
    const { setStrategies, setMt5Path } = useConfigActions();
    const mt5Path = useMt5Path();
    const strategies = useStrategies();
    const isRunning = useEngineRunning();
    const { appMode, setAppMode, setCurrentTab, hasUnreadBacktestResult, strategies: btStrategies, setStrategies: setBacktestStrategies, setSettings: setBacktestSettings } = useBacktest();
    const [initialData, setInitialData] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [userName, setUserName] = useState('');
    const [showOptionalModal, setShowOptionalModal] = useState(false);
    const [dismissedOptionalVersion, setDismissedOptionalVersion] = useState(null);
    const [nextNews, setNextNews] = useState(null);

    useEffect(() => {
        const fetchInit = async () => {
            if (!window.eel) return;
            try {
                const data = await window.eel.get_initial_data()();
                if (data) {
                    setInitialData(data);
                    setMt5Path(data?.mt5_path || '');
                    if (data?.strategies) setStrategies(data.strategies);
                }
                const authStatus = await window.eel.get_auth_status()();
                const profile = authStatus?.profile;
                const authenticatedUserName = profile?.name
                    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
                    || profile?.username
                    || profile?.email?.split('@')[0];
                if (authenticatedUserName) setUserName(authenticatedUserName);
            } catch (error) {
                console.error('Error fetching initial data from Eel:', error);
            }
        };
        fetchInit();
        if (window.eel) {
            window.eel.expose(update_dashboard, 'update_dashboard');
            window.eel.expose(update_status, 'update_status');
            window.eel.expose(update_news_ticker, 'update_news_ticker');
        }
        return () => {
            if (window.eel) {
                delete window.update_dashboard;
                delete window.update_status;
                delete window.update_news_ticker;
            }
        };
    }, []);

    useEffect(() => {
        if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
    }, [activeTab, appMode]);

    useEffect(() => {
        setCurrentTab(activeTab);
    }, [activeTab, setCurrentTab]);

    useEffect(() => {
        if (appMode !== 'backtest') {
            setActiveTab((current) => (current === 'bt_overview' || current === 'bt_strategies' || current === 'bt_analytics' || current === 'bt_plot' ? 'dashboard' : current));
            return;
        }
        setActiveTab((current) => (current === 'dashboard' || current === 'strategies' || current === 'analyze' || current === 'education' ? 'bt_overview' : current));
    }, [appMode]);

    useEffect(() => {
        if (appMode !== 'backtest' || !window.eel) return;
        const fetchBacktestInit = async () => {
            try {
                const payload = await window.eel.get_backtest_initial_data()();
                if (payload?.settings) setBacktestSettings(payload.settings);
                if (payload?.strategies) setBacktestStrategies(payload.strategies);
            } catch (error) {
                console.error('Error loading backtest data from Eel:', error);
            }
        };
        fetchBacktestInit();
    }, [appMode, setBacktestSettings, setBacktestStrategies]);

    useEffect(() => {
        if (appMode !== 'live' || !window.eel) return;
        window.eel.get_initial_data()().then((payload) => {
            if (payload?.strategies) setStrategies(payload.strategies);
        }).catch((error) => console.error('Error refreshing live strategies from Eel:', error));
    }, [appMode, setStrategies]);

    useEffect(() => {
        const optionalVersion = updateInfo?.latest_version ?? 'available';
        if (updateInfo && updateInfo.is_force_update !== true && optionalVersion !== dismissedOptionalVersion) {
            setShowOptionalModal(true);
        }
    }, [updateInfo, dismissedOptionalVersion]);

    const dismissOptionalModal = () => {
        setDismissedOptionalVersion(updateInfo?.latest_version ?? 'available');
        setShowOptionalModal(false);
    };

    function update_news_ticker(newsData) {
        setNextNews(newsData);
    }

    function update_status(type, message) {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        let color = 'text-zinc-500';
        if (type === 'error') {
            color = 'text-rose-500';
            setIsRunning(false);
        } else if (type === 'success') {
            color = 'text-emerald-500';
            if (message?.includes('فعال شد') || message?.includes('Active')) setIsRunning(true);
        } else if (type === 'warning') {
            color = 'text-yellow-500';
            if (message?.includes('توقف') || message?.includes('Stop') || message?.includes('Halting')) setIsRunning(false);
        }
        appendLog({ time, message: message || '', color });
    }

    const handleToggleEngine = async () => {
        if (!mt5Path) {
            update_status('error', 'MT5 Path not selected!');
            return;
        }
        if (isRunning) {
            setIsRunning(false);
            if (window.eel) await window.eel.stop_robot()();
        } else {
            setIsRunning(true);
            if (window.eel) await window.eel.start_robot()();
        }
    };

    function update_dashboard(profit, equity, positions, brokerTimeMs) {
        const nextProfit = parseFloat(profit) || 0;
        const nextEquity = parseFloat(equity) || 0;
        const nextBrokerTimeMs = brokerTimeMs != null && Number.isFinite(Number(brokerTimeMs))
            ? Number(brokerTimeMs)
            : null;
        setLiveData({ profit: nextProfit, equity: nextEquity, positions: positions || 0, brokerTimeMs: nextBrokerTimeMs });
    }

    const handleStrategyConfigUpdate = (strategyName, newConfig) => {
        setStrategies((previousStrategies) => ({
            ...previousStrategies,
            [strategyName]: {
                ...(previousStrategies?.[strategyName] || {}),
                config: newConfig,
            },
        }));
        if (window.eel) window.eel.update_strategy_config(strategyName, 'config', newConfig);
    };

    const status = isRunning ? 'Running' : mt5Path ? 'Ready' : 'Disconnected';
    const strategyCount = appMode === 'backtest' ? Object.keys(btStrategies || {}).length : Object.keys(strategies || {}).length;

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[#141318] font-sans text-[#FCFCFD] selection:bg-[#F28C45]/20">
            <div className="relative flex flex-1 overflow-hidden">
                <div className="relative z-30 h-full w-[76px] shrink-0">
                    <Sidebar
                        status={status}
                        activeTab={activeTab}
                        appMode={appMode}
                        hasUnreadBacktestResult={hasUnreadBacktestResult}
                        onTabChange={(tab) => {
                            setActiveTab(tab);
                            setCurrentTab(tab);
                        }}
                    />
                </div>
                <main ref={mainContentRef} className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] bg-[#141318] custom-scroll">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-25"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
                            backgroundSize: '36px 36px',
                            maskImage: 'radial-gradient(ellipse at center, black 15%, transparent 85%)',
                        }}
                    />
                    <DashboardHeader
                        activeTab={activeTab}
                        appMode={appMode}
                        userName={userName}
                        strategyCount={strategyCount}
                        hasUpdate={Boolean(updateInfo)}
                        onModeChange={setAppMode}
                        onShowUpdate={() => setShowOptionalModal(true)}
                        onToggleLanguage={toggleLanguage}
                    />
                    <div className="relative z-10 flex-1 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
                        <div className="mx-auto h-full w-full max-w-[1920px]">
                            <DashboardTabs
                                activeTab={activeTab}
                                appMode={appMode}
                                initialData={initialData}
                                nextNews={nextNews}
                                onToggleEngine={handleToggleEngine}
                                onUpdateConfig={handleStrategyConfigUpdate}
                            />
                        </div>
                    </div>
                </main>
            </div>
            {showOptionalModal && updateInfo && (
                <OptionalUpdateModal
                    updateInfo={updateInfo}
                    onDismiss={dismissOptionalModal}
                    onInstall={() => {
                        setDismissedOptionalVersion(updateInfo?.latest_version ?? 'available');
                        setShowOptionalModal(false);
                        onStartOptionalUpdate?.();
                    }}
                />
            )}
        </div>
    );
};

export default Dashboard;