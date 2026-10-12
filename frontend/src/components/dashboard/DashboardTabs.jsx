import React from 'react';
import ChartAnalyzer from '../ChartAnalyzer';
import EducationPanel from '../EducationPanel';
import StrategyPanel from '../StrategyPanel';
import DashboardOverview from './DashboardOverview';

const DashboardTabs = ({
    activeTab, initialData, nextNews, onToggleEngine,
    onUpdateConfig,
}) => (
    <div className="flex h-full min-w-0 flex-col">
        <section className={`space-y-5 animate-fade-in ${activeTab === 'dashboard' ? 'block' : 'hidden'}`}>
            <DashboardOverview
                initialData={initialData}
                nextNews={nextNews}
                onToggleEngine={onToggleEngine}
            />
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
    </div>
);

export default DashboardTabs;