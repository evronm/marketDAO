// Utility functions for the Market DAO application

const Utils = {
    /**
     * Shortens an Ethereum address for display
     * @param {string} address - The full Ethereum address
     * @param {number} chars - Number of characters to show at start and end
     * @returns {string} The shortened address
     */
    shortenAddress: (address, chars = 4) => {
        if (!address) return '';
        return `${address.substring(0, chars + 2)}...${address.substring(42 - chars)}`;
    },

    /**
     * Formats a number as a percentage string
     * @param {number} value - The value to format (0-100)
     * @returns {string} Formatted percentage
     */
    formatPercentage: (value) => {
        return `${parseFloat(value).toFixed(2)}%`;
    },

    /**
     * Formats a number as ETH with specified decimal places
     * @param {string|number} wei - The amount in wei
     * @param {number} decimals - Number of decimal places to show
     * @returns {string} Formatted ETH amount
     */
    formatEth: (wei, decimals = 4) => {
        if (!wei) return '0 ETH';
        const eth = ethers.utils.formatEther(wei);
        return `${parseFloat(eth).toFixed(decimals)} ETH`;
    },

    /**
     * Formats a number as a token amount
     * @param {string|number} amount - The token amount
     * @returns {string} Formatted token amount
     */
    formatTokenAmount: (amount) => {
        if (!amount) return '0';
        return parseInt(amount).toLocaleString();
    },

    /**
     * Converts block count to an estimated time
     * @param {number} blocks - Number of blocks
     * @returns {string} Human readable time
     */
    blocksToTime: (blocks) => {
        const seconds = blocks * CONFIG.blockTime;
        
        if (seconds < 60) {
            return `${seconds} seconds`;
        } else if (seconds < 3600) {
            return `${Math.floor(seconds / 60)} minutes`;
        } else if (seconds < 86400) {
            return `${Math.floor(seconds / 3600)} hours`;
        } else {
            return `${Math.floor(seconds / 86400)} days`;
        }
    },

    /**
     * Creates a timestamp from a block number difference
     * @param {number} blockNumber - The block number
     * @param {number} currentBlock - The current block number
     * @returns {string} Relative time string
     */
    getTimeFromBlocks: (blockNumber, currentBlock) => {
        if (!blockNumber || !currentBlock) return 'Unknown';
        
        const blockDiff = Math.abs(currentBlock - blockNumber);
        return Utils.blocksToTime(blockDiff);
    },

    /**
     * Shows a notification to the user
     * @param {string} message - The message to display
     * @param {string} type - The type of notification (success, error)
     */
    showNotification: (message, type = 'info') => {
        const notification = document.getElementById('notification');
        const notificationMessage = document.getElementById('notificationMessage');
        const notificationContent = notification.querySelector('.notification-content');
        
        // Remove any existing classes
        notificationContent.classList.remove('success', 'error');
        
        // Add the appropriate class
        if (type === 'success' || type === 'error') {
            notificationContent.classList.add(type);
        }
        
        // Set the message
        notificationMessage.textContent = message;
        
        // Show the notification
        notification.classList.remove('hidden');
        
        // Hide the notification after 5 seconds
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 5000);
    },

    /**
     * Shows a modal with content
     * @param {string} title - The modal title
     * @param {string|HTMLElement} content - The content or HTML element to display
     */
    showModal: (title, content) => {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = title;
        
        // Clear previous content
        modalContent.innerHTML = '';
        
        // Add new content
        if (typeof content === 'string') {
            modalContent.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            modalContent.appendChild(content);
        }
        
        // Show the modal
        modal.classList.remove('hidden');
    },

    /**
     * Hides the currently displayed modal
     */
    hideModal: () => {
        const modal = document.getElementById('modal');
        modal.classList.add('hidden');
    },

    /**
     * Helper to catch and display errors from async operations
     * @param {Function} fn - The async function to execute
     * @param {string} errorPrefix - Text to prefix any error messages with
     * @returns {Promise} The result of the function
     */
    async handleError(fn, errorPrefix = 'Error') {
        try {
            return await fn();
        } catch (error) {
            console.error(error);
            let message = error.reason || error.message || error;
            this.showNotification(`${errorPrefix}: ${message}`, 'error');
            throw error;
        }
    },

    /**
     * Check if a string is a valid Ethereum address
     * @param {string} address - The address to check
     * @returns {boolean} True if valid
     */
    isValidAddress: (address) => {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    },

    /**
     * Waits for a transaction to be mined
     * @param {Promise} txPromise - The transaction promise
     * @param {string} pendingMessage - Message to show while pending
     * @param {string} successMessage - Message to show on success
     * @returns {Promise} The transaction receipt
     */
    async waitForTransaction(txPromise, pendingMessage, successMessage) {
        try {
            Utils.showNotification(pendingMessage, 'info');
            const tx = await txPromise;
            Utils.showNotification('Transaction submitted. Waiting for confirmation...', 'info');
            
            const receipt = await tx.wait();
            Utils.showNotification(successMessage, 'success');
            return receipt;
        } catch (error) {
            console.error(error);
            let message = error.reason || error.message || error;
            Utils.showNotification(`Transaction failed: ${message}`, 'error');
            throw error;
        }
    }
};

// Set up event listeners for UI components
document.addEventListener('DOMContentLoaded', () => {
    // Close notification
    document.getElementById('notificationClose').addEventListener('click', () => {
        document.getElementById('notification').classList.add('hidden');
    });
    
    // Close modal
    document.querySelector('.close-button').addEventListener('click', Utils.hideModal);
    
    // Close modal on outside click
    document.getElementById('modal').addEventListener('click', (event) => {
        if (event.target === document.getElementById('modal')) {
            Utils.hideModal();
        }
    });
});
