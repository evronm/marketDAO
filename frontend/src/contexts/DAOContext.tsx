import React, { createContext, useContext, useState, useEffect } from 'react';

interface DAOContextType {
  daoAddress: string;
  factoryAddress: string;
  setDAOAddress: (address: string, factory: string) => void;
  recentDAOs: Array<{ dao: string; factory: string; name?: string }>;
}

const DAOContext = createContext<DAOContextType | undefined>(undefined);

const DEFAULT_DAO_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
const DEFAULT_FACTORY_ADDRESS = '0x0165878a594ca255338adfa4d48449f69242eb8f';

const STORAGE_KEY = 'marketdao_recent_daos';
const CURRENT_DAO_KEY = 'marketdao_current_dao';
const VERSION_KEY = 'marketdao_version';
const CURRENT_VERSION = '4'; // Increment this to force cache clear

// Check version and clear cache if needed (outside component to run once on module load)
const storedVersion = localStorage.getItem(VERSION_KEY);
if (storedVersion !== CURRENT_VERSION) {
  console.log(`Version mismatch (stored: ${storedVersion}, current: ${CURRENT_VERSION}), clearing cache`);
  localStorage.removeItem(CURRENT_DAO_KEY);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
}

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
  console.log('DAOContext initial addresses:', initial);
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
