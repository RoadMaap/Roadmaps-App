import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Sidebar from '../sidebar/Sidebar';
import DashboardHeader from './DashboardHeader';
import DashboardTabs from './DashboardTabs';
import OptionalUpdateModal from './OptionalUpdateModal';

const Dashboard = ({ updateInfo, onStartOptionalUpdate }) => {
    const { t, toggleLanguage } = useLanguage();
    const mainContentRef = useRef(null);
    const [mt5Path, setMt5Path] = useState('');
    const [initialData, setInitialData] = useState(null);
    const [logs, setLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [strategies, setStrategies] = useState({});
    const [userName, setUserName] = useState('');
    const [showOptionalModal, setShowOptionalModal] = useState(false);
    const [dismissedOptionalVersion, setDismissedOptionalVersion] = useState(null);
    const [nextNews, setNextNews] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [profitHistory, setProfitHistory] = useState(Array(15).fill(0));
    const [initialEquity, setInitialEquity] = useState(null);
    const [liveData, setLiveData] = useState({ profit: 0, equity: 0, positions: 0 });

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
    }, [activeTab]);

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
        setLogs((previousLogs) => {
            const newLogs = [...(previousLogs || []), { time, message: message || '', color }];
            return newLogs.length > 100 ? newLogs.slice(-100) : newLogs;
        });
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

    function update_dashboard(profit, equity, positions) {
        const nextProfit = parseFloat(profit) || 0;
        const nextEquity = parseFloat(equity) || 0;
        setLiveData({ profit: nextProfit, equity: nextEquity, positions: positions || 0 });
        setProfitHistory((previousHistory) => {
            const newHistory = [...(previousHistory || []), nextProfit];
            if (newHistory.length > 20) newHistory.shift();
            return newHistory;
        });
        if (initialEquity === null && nextEquity > 0) setInitialEquity(nextEquity - nextProfit);
    }

    const getEquityProgress = () => {
        if (!initialEquity || initialEquity <= 0) return { width: '0%', isProfit: true, percent: '0.0' };
        const currentEquity = liveData?.equity || 0;
        if (currentEquity >= initialEquity) {
            const profitPercent = 100 - (initialEquity / currentEquity) * 100;
            return { width: `${profitPercent}%`, isProfit: true, percent: profitPercent.toFixed(1) };
        }
        const remainingPercent = (currentEquity / initialEquity) * 100;
        const lossPercent = 100 - remainingPercent;
        return { width: `${remainingPercent}%`, isProfit: false, percent: lossPercent.toFixed(1) };
    };

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

    const equityProgress = getEquityProgress();
    const status = isRunning ? 'Running' : mt5Path ? 'Ready' : 'Disconnected';

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[#141318] font-sans text-[#FCFCFD] selection:bg-[#F28C45]/20">
            <div className="relative flex flex-1 overflow-hidden">
                <Sidebar status={status} activeTab={activeTab} onTabChange={setActiveTab} />
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
                        userName={userName}
                        strategyCount={Object.keys(strategies || {}).length}
                        hasUpdate={Boolean(updateInfo)}
                        onShowUpdate={() => setShowOptionalModal(true)}
                        onToggleLanguage={toggleLanguage}
                    />
                    <div className="relative z-10 flex-1 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
                        <div className="mx-auto h-full w-full max-w-[1920px]">
                            <DashboardTabs
                                activeTab={activeTab}
                                initialData={initialData}
                                nextNews={nextNews}
                                liveData={liveData}
                                profitHistory={profitHistory}
                                equityProgress={equityProgress}
                                mt5Path={mt5Path}
                                onPathChange={setMt5Path}
                                logs={logs}
                                isRunning={isRunning}
                                onToggleEngine={handleToggleEngine}
                                onClearLogs={() => setLogs([])}
                                strategies={strategies}
                                onStrategiesChange={setStrategies}
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