import React, { createContext, useContext, useMemo, useState } from 'react';

const StrategiesContext = createContext(null);
const Mt5PathContext = createContext(null);
const ConfigActionsContext = createContext(null);

export const ConfigStateProvider = ({ children }) => {
    const [strategies, setStrategies] = useState({});
    const [mt5Path, setMt5Path] = useState('');
    const actions = useMemo(() => ({ setStrategies, setMt5Path }), []);

    return (
        <ConfigActionsContext.Provider value={actions}>
            <StrategiesContext.Provider value={strategies}>
                <Mt5PathContext.Provider value={mt5Path}>
                    {children}
                </Mt5PathContext.Provider>
            </StrategiesContext.Provider>
        </ConfigActionsContext.Provider>
    );
};

export const useStrategies = () => useContext(StrategiesContext);
export const useMt5Path = () => useContext(Mt5PathContext);
export const useConfigActions = () => useContext(ConfigActionsContext);