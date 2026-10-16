import React from 'react';
import ChartAnalyzer from '../ChartAnalyzer';
import EducationPanel from '../EducationPanel';
import StrategyPanel from '../StrategyPanel';
import DashboardOverview from './DashboardOverview';
import BacktestOverview from '../backtest/BacktestOverview';
import BacktestStrategyPanel from '../backtest/BacktestStrategyPanel';
import BacktestAnalyticsPanel from '../backtest/BacktestAnalyticsPanel';
import BacktestPlotPanel from '../backtest/BacktestPlotPanel';
import PremiumGuard from '../PremiumGuard';

const DashboardTabs = ({ activeTab, appMode = 'live', initialData, nextNews, onToggleEngine, onUpdateConfig }) => (
    <div className="flex h-full min-w-0 flex-col">
        {appMode === 'live' && (
            <>
                <section className={`space-y-5 animate-fade-in ${activeTab === 'dashboard' ? 'block' : 'hidden'}`}>
                    <DashboardOverview initialData={initialData} nextNews={nextNews} onToggleEngine={onToggleEngine} />
                </section>
                <section className={`h-full min-h-0 min-w-0 animate-fade-in ${activeTab === 'strategies' ? 'block' : 'hidden'}`}>
                    <StrategyPanel onUpdateConfig={onUpdateConfig} />
                </section>
                <section className={`h-full min-h-0 animate-fade-in ${activeTab === 'education' ? 'block' : 'hidden'}`}>
                    <EducationPanel />
                </section>
                <section className={`h-full min-h-0 animate-fade-in ${activeTab === 'analyze' ? 'block' : 'hidden'}`}>
                    <ChartAnalyzer />
                </section>
            </>
        )}

        {appMode === 'backtest' && (
            <>
                <section className={`h-full min-h-0 animate-fade-in ${activeTab === 'bt_overview' ? 'block' : 'hidden'}`}>
                    <PremiumGuard requiredPlan="Advance" className="block">
                        <BacktestOverview />
                    </PremiumGuard>
                </section>
                <section className={`h-full min-h-0 animate-fade-in ${activeTab === 'bt_strategies' ? 'block' : 'hidden'}`}>
                    <PremiumGuard requiredPlan="Advance" className="block">
                        <BacktestStrategyPanel />
                    </PremiumGuard>
                </section>
                <section className={`h-full min-h-0 animate-fade-in ${activeTab === 'bt_analytics' ? 'block' : 'hidden'}`}>
                    <PremiumGuard requiredPlan="Advance" className="block">
                        <BacktestAnalyticsPanel />
                    </PremiumGuard>
                </section>
                <section className={`h-full min-h-0 animate-fade-in ${activeTab === 'bt_plot' ? 'block' : 'hidden'}`}>
                    <PremiumGuard requiredPlan="Advance" className="block">
                        <BacktestPlotPanel />
                    </PremiumGuard>
                </section>
                <section className={`h-full min-h-0 animate-fade-in ${activeTab === 'education' ? 'block' : 'hidden'}`}>
                    <EducationPanel />
                </section>
            </>
        )}
    </div>
);

export default DashboardTabs;