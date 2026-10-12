import React, { createContext, useContext, useMemo, useState } from 'react';

const EngineLogsContext = createContext(null);
const EngineLogActionsContext = createContext(null);
const EngineLiveDataContext = createContext(null);
const EngineMetricActionsContext = createContext(null);
const EngineRunningContext = createContext(null);
const EngineStatusActionsContext = createContext(null);

const EngineLogsProvider = ({ children }) => {
    const [logs, setLogs] = useState([]);
    const actions = useMemo(() => ({
        appendLog: (entry) => setLogs((current) => [...current, entry].slice(-100)),
        clearLogs: () => setLogs([]),
    }), []);

    return (
        <EngineLogActionsContext.Provider value={actions}>
            <EngineLogsContext.Provider value={logs}>{children}</EngineLogsContext.Provider>
        </EngineLogActionsContext.Provider>
    );
};

const EngineMetricsProvider = ({ children }) => {
    const [liveData, setLiveData] = useState({ profit: 0, equity: 0, positions: 0 });
    const actions = useMemo(() => ({ setLiveData }), []);

    return (
        <EngineMetricActionsContext.Provider value={actions}>
            <EngineLiveDataContext.Provider value={liveData}>{children}</EngineLiveDataContext.Provider>
        </EngineMetricActionsContext.Provider>
    );
};

const EngineStatusProvider = ({ children }) => {
    const [isRunning, setIsRunning] = useState(false);

    return (
        <EngineStatusActionsContext.Provider value={useMemo(() => ({ setIsRunning }), [])}>
            <EngineRunningContext.Provider value={isRunning}>{children}</EngineRunningContext.Provider>
        </EngineStatusActionsContext.Provider>
    );
};

export const EngineStateProvider = ({ children }) => (
    <EngineStatusProvider>
        <EngineMetricsProvider>
            <EngineLogsProvider>{children}</EngineLogsProvider>
        </EngineMetricsProvider>
    </EngineStatusProvider>
);

export const useEngineLogs = () => useContext(EngineLogsContext);
export const useEngineLiveData = () => useContext(EngineLiveDataContext);
export const useEngineRunning = () => useContext(EngineRunningContext);
export const useEngineLogActions = () => useContext(EngineLogActionsContext);
export const useEngineMetricActions = () => useContext(EngineMetricActionsContext);
export const useEngineStatusActions = () => useContext(EngineStatusActionsContext);