/**
 * UI management for Market DAO
 * Handles navigation, notifications, and other UI elements
 */
class UIManager {
    constructor() {
        this.activeSection = 'dashboard';
        this.initializeNavigation();
        this.initializeTabSwitching();
        this.initializeProposalForm();
        this.initializeModalHandling();
    }
    
    /**
     * Initialize sidebar navigation
     */
    initializeNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetSection = link.getAttribute('data-section');
                this.switchSection(targetSection);
                
                // Update navigation
                navLinks.forEach(navLink => navLink.classList.remove('active'));
                link.classList.add('active');
            });
        });
    }
    
    /**
     * Initialize tab switching within sections
     */
    initializeTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabGroup = button.parentElement;
                const targetTab = button.getAttribute('data-tab');
                
                // Deactivate all tabs and buttons in this group
                const buttons = tabGroup.querySelectorAll('.tab-btn');
                buttons.forEach(btn => btn.classList.remove('active'));
                
                // Get parent section and deactivate all tab content
                const section = tabGroup.closest('.content-section');
                const tabContents = section.querySelectorAll('.tab-content');
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Activate the target tab and button
                button.classList.add('active');
                const targetContent = section.querySelector(`#${targetTab}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }
    
    /**
     * Initialize proposal form visibility toggling
     */
    initializeProposalForm() {
        const newProposalBtn = document.getElementById('new-proposal-btn');
        const proposalForm = document.getElementById('proposal-form');
        const cancelProposalBtn = document.getElementById('cancel-proposal');
        const proposalTypeSelect = document.getElementById('proposal-type');
        
        // Show form when new proposal button is clicked
        if (newProposalBtn) {
            newProposalBtn.addEventListener('click', () => {
                proposalForm.classList.remove('hidden');
                newProposalBtn.classList.add('hidden');
            });
        }
        
        // Hide form when cancel button is clicked
        if (cancelProposalBtn) {
            cancelProposalBtn.addEventListener('click', () => {
                proposalForm.classList.add('hidden');
                newProposalBtn.classList.remove('hidden');
                document.getElementById('create-proposal-form').reset();
            });
        }
        
        // Show/hide fields based on proposal type
        if (proposalTypeSelect) {
            proposalTypeSelect.addEventListener('change', () => {
                const selectedType = proposalTypeSelect.value;
                
                // Hide all type-specific fields
                document.getElementById('recipient-field').classList.add('hidden');
                document.getElementById('amount-field').classList.add('hidden');
                document.getElementById('token-address-field').classList.add('hidden');
                document.getElementById('token-id-field').classList.add('hidden');
                document.getElementById('token-price-field').classList.add('hidden');
                
                // Show fields based on selected type
                switch (selectedType) {
                    case 'treasury':
                        document.getElementById('recipient-field').classList.remove('hidden');
                        document.getElementById('amount-field').classList.remove('hidden');
                        document.getElementById('token-address-field').classList.remove('hidden');
                        document.getElementById('token-id-field').classList.remove('hidden');
                        break;
                    case 'mint':
                        document.getElementById('recipient-field').classList.remove('hidden');
                        document.getElementById('amount-field').classList.remove('hidden');
                        break;
                    case 'token-price':
                        document.getElementById('token-price-field').classList.remove('hidden');
                        break;
                }
            });
        }
    }
    
    /**
     * Initialize modal handling
     */
    initializeModalHandling() {
        const modalContainer = document.getElementById('modal-container');
        const modalOverlay = document.querySelector('.modal-overlay');
        const modalClose = document.querySelector('.modal-close');
        
        // Close modal when clicking overlay
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                modalContainer.classList.add('hidden');
            });
        }
        
        // Close modal when clicking close button
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                modalContainer.classList.add('hidden');
            });
        }
        
        // Close modal when pressing Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modalContainer.classList.contains('hidden')) {
                modalContainer.classList.add('hidden');
            }
        });
    }
    
    /**
     * Switch active section
     * @param {string} sectionId - ID of the section to activate
     */
    switchSection(sectionId) {
        // Hide all sections
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(section => section.classList.remove('active'));
        
        // Show target section
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.activeSection = sectionId;
            
            // Dispatch event for section change
            window.dispatchEvent(new CustomEvent('section-changed', {
                detail: { section: sectionId }
            }));
        }
    }
    
    /**
     * Show a notification
     * @param {string} type - Type of notification (success, warning, error)
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     */
    showNotification(type, title, message) {
        const notificationArea = document.getElementById('notification-area');
        const template = document.getElementById('notification-template');
        
        if (!notificationArea || !template) {
            console.error('Notification elements not found');
            return;
        }
        
        // Clone the template
        const notification = template.content.cloneNode(true).querySelector('.notification');
        
        // Set notification type class
        notification.classList.add(type);
        
        // Set icon based on type
        const iconElement = notification.querySelector('.notification-icon');
        let icon;
        switch (type) {
            case 'success':
                icon = 'fa-check-circle';
                break;
            case 'warning':
                icon = 'fa-exclamation-triangle';
                break;
            case 'error':
                icon = 'fa-times-circle';
                break;
            default:
                icon = 'fa-info-circle';
        }
        iconElement.innerHTML = `<i class="fas ${icon}"></i>`;
        
        // Set content
        notification.querySelector('.notification-title').textContent = title;
        notification.querySelector('.notification-message').textContent = message;
        
        // Add close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('removing');
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
        
        // Add to notification area
        notificationArea.appendChild(notification);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('removing');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, AppConfig.ui.notificationDuration);
    }
    
    /**
     * Show a modal dialog
     * @param {string} title - Modal title
     * @param {string} content - HTML content for the modal body
     */
    showModal(title, content) {
        const modalContainer = document.getElementById('modal-container');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        if (!modalContainer || !modalTitle || !modalBody) {
            console.error('Modal elements not found');
            return;
        }
        
        // Set content
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        
        // Show modal
        modalContainer.classList.remove('hidden');
    }
    
    /**
     * Show a loading indicator in a container
     * @param {string} containerId - ID of the container
     * @param {string} message - Loading message
     */
    showLoading(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }
    
    /**
     * Format an address for display
     * @param {string} address - The address to format
     */
    formatAddress(address) {
        if (!address) return '';
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }
    
    /**
     * Format a timestamp to a readable date
     * @param {number} timestamp - Unix timestamp
     */
    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        return new Date(timestamp * 1000).toLocaleString();
    }
    
    /**
     * Format an amount of ETH for display
     * @param {string|number} amount - Amount in ETH
     */
    formatEth(amount) {
        if (!amount) return '0 ETH';
        return parseFloat(amount).toFixed(4) + ' ETH';
    }
    
    /**
     * Update DAO information in the dashboard
     * @param {Object} daoInfo - DAO information
     */
    updateDashboard(daoInfo) {
        if (!daoInfo) return;
        
        // Update DAO information
        document.getElementById('dao-name').textContent = daoInfo.name;
        document.getElementById('support-threshold').textContent = `${daoInfo.supportThreshold}%`;
        document.getElementById('quorum-percentage').textContent = `${daoInfo.quorumPercentage}%`;
        document.getElementById('token-supply').textContent = `${daoInfo.tokenSupply} Tokens`;
        document.getElementById('token-price').textContent = daoInfo.tokenPrice == 0 ? 'Disabled' : this.formatEth(daoInfo.tokenPrice);
        document.getElementById('allow-minting').textContent = daoInfo.allowMinting ? 'Yes' : 'No';
        document.getElementById('has-treasury').textContent = daoInfo.hasTreasury ? 'Active' : 'Inactive';
        
        // Build treasury types string
        let treasuryTypes = [];
        if (daoInfo.acceptsETH) treasuryTypes.push('ETH');
        if (daoInfo.acceptsERC20) treasuryTypes.push('ERC20');
        if (daoInfo.acceptsERC721) treasuryTypes.push('ERC721');
        if (daoInfo.acceptsERC1155) treasuryTypes.push('ERC1155');
        
        document.getElementById('treasury-types').textContent = treasuryTypes.length > 0 ? treasuryTypes.join(', ') : 'None';
    }
}

// Create global UI instance
const UI = new UIManager();
