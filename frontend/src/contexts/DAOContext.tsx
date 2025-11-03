import React, { createContext, useContext, useState, useEffect } from 'react';

interface DAOContextType {
  daoAddress: string;
  factoryAddress: string;
  setDAOAddress: (address: string, factory: string) => void;
  recentDAOs: Array<{ dao: string; factory: string; name?: string }>;
}

const DAOContext = createContext<DAOContextType | undefined>(undefined);

const DEFAULT_DAO_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F';
const DEFAULT_FACTORY_ADDRESS = '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853';

const STORAGE_KEY = 'marketdao_recent_daos';
const CURRENT_DAO_KEY = 'marketdao_current_dao';

export const DAOProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check URL params first, then localStorage, then default
  const getInitialDAO = (): { dao: string; factory: string } => {
    const params = new URLSearchParams(window.location.search);
    const urlDAO = params.get('dao');
    const urlFactory = params.get('factory');

    if (urlDAO && urlFactory) {
      return { dao: urlDAO, factory: urlFactory };
    }

    const stored = localStorage.getItem(CURRENT_DAO_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fall through to default
      }
    }

    return { dao: DEFAULT_DAO_ADDRESS, factory: DEFAULT_FACTORY_ADDRESS };
  };

  const initial = getInitialDAO();
  const [daoAddress, setDaoAddressState] = useState(initial.dao);
  const [factoryAddress, setFactoryAddressState] = useState(initial.factory);
  const [recentDAOs, setRecentDAOs] = useState<Array<{ dao: string; factory: string; name?: string }>>([]);

  // Load recent DAOs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecentDAOs(JSON.parse(stored));
      } catch (err) {
        console.warn('Failed to load recent DAOs:', err);
      }
    }
  }, []);

  const setDAOAddress = (dao: string, factory: string) => {
    setDaoAddressState(dao);
    setFactoryAddressState(factory);

    // Save current DAO
    localStorage.setItem(CURRENT_DAO_KEY, JSON.stringify({ dao, factory }));

    // Update recent DAOs
    setRecentDAOs((prev) => {
      const filtered = prev.filter((d) => d.dao !== dao);
      const updated = [{ dao, factory }, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('dao', dao);
    url.searchParams.set('factory', factory);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <DAOContext.Provider value={{ daoAddress, factoryAddress, setDAOAddress, recentDAOs }}>
      {children}
    </DAOContext.Provider>
  );
};

export const useDAOAddress = () => {
  const context = useContext(DAOContext);
  if (!context) {
    throw new Error('useDAOAddress must be used within DAOProvider');
  }
  return context;
};
