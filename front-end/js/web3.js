// web3.js - Handles Web3 initialization and provider setup

/**
 * Initialize Web3 and get the provider
 * @returns {Promise<ethers.providers.Web3Provider|null>} - Web3 provider or null if failed
 */
export async function initWeb3() {
    // Check if MetaMask is installed
    if (window.ethereum) {
        try {
            // Create a Web3 provider using ethers.js
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            
            // Try to get accounts (no popup)
            const accounts = await provider.listAccounts();
            
            // Set the network
            const network = await provider.getNetwork();
            console.log('Connected to network:', network.name, 'chainId:', network.chainId);
            
            if (network.chainId !== 31337 && network.chainId !== 1337) {
                console.warn('Not connected to a local development network. ChainId:', network.chainId);
                // Optional: Show warning about using a non-local network
            }
            
            // Return the provider
            return provider;
        } catch (error) {
            console.error('Error initializing Web3:', error);
            return null;
        }
    } else {
        // MetaMask not installed, show instructions
        console.error('Please install MetaMask to use this application');
        
        // Update UI to show MetaMask installation instructions
        const container = document.querySelector('.container');
        const header = document.querySelector('header');
        
        const message = document.createElement('div');
        message.className = 'metamask-message';
        message.innerHTML = `
            <div class="message-content">
                <h2>MetaMask Required</h2>
                <p>This application requires MetaMask to interact with the blockchain.</p>
                <p>Please install MetaMask and refresh the page.</p>
                <a href="https://metamask.io/download/" target="_blank" class="btn">Install MetaMask</a>
            </div>
        `;
        
        // Insert after header
        if (header && container) {
            container.insertBefore(message, header.nextSibling);
        }
        
        return null;
    }
}

/**
 * Get the signer for transactions
 * @param {ethers.providers.Web3Provider} provider - The Web3 provider
 * @returns {Promise<ethers.Signer>} - Signer for transactions
 */
export async function getSigner(provider) {
    if (!provider) {
        throw new Error('Provider not initialized');
    }
    
    try {
        // Request account access if needed
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Get the signer
        const signer = provider.getSigner();
        return signer;
    } catch (error) {
        console.error('Error getting signer:', error);
        throw error;
    }
}

/**
 * Get the current account address
 * @param {ethers.providers.Web3Provider} provider - The Web3 provider
 * @returns {Promise<string|null>} - Current account address or null
 */
export async function getCurrentAccount(provider) {
    if (!provider) {
        return null;
    }
    
    try {
        const accounts = await provider.listAccounts();
        return accounts.length > 0 ? accounts[0] : null;
    } catch (error) {
        console.error('Error getting current account:', error);
        return null;
    }
}

/**
 * Format an address for display (0x1234...5678)
 * @param {string} address - The address to format
 * @returns {string} - Formatted address
 */
export function formatAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Format Wei to Ether
 * @param {ethers.BigNumber} wei - The amount in Wei
 * @returns {string} - Formatted Ether amount
 */
export function formatEther(wei) {
    return ethers.utils.formatEther(wei);
}
