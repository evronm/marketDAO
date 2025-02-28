document.addEventListener('DOMContentLoaded', function() {
    // Contract addresses
    const DAO_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
    const FACTORY_ADDRESS = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512';
    
    // Contract interfaces
    let provider;
    let signer;
    let daoContract;
    let factoryContract;
    let connectedAddress;
    
    // DOM Elements
    const connectWalletButton = document.getElementById('connect-wallet');
    const connectionCard = document.getElementById('connection-card');
    const daoInfo = document.getElementById('dao-info');
    const createProposal = document.getElementById('create-proposal');
    const activeProposals = document.getElementById('active-proposals');
    const activeElections = document.getElementById('active-elections');
    const proposalHistory = document.getElementById('proposal-history');
    
    // Navigation Links - Add event listeners
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Hide all sections
            daoInfo.style.display = 'none';
            createProposal.style.display = 'none';
            activeProposals.style.display = 'none';
            activeElections.style.display = 'none';
            proposalHistory.style.display = 'none';
            
            // Show the appropriate section based on the clicked link
            const linkText = this.textContent.trim();
            if (linkText === 'Dashboard') {
                daoInfo.style.display = 'block';
                createProposal.style.display = 'block';
            } else if (linkText === 'Proposals') {
                activeProposals.style.display = 'block';
            } else if (linkText === 'Elections') {
                activeElections.style.display = 'block';
            } else if (linkText === 'History') {
                proposalHistory.style.display = 'block';
            }
        });
    });
    
    // Improved Tab switching - more robust implementation
    function setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        if (tabs.length === 0) {
            console.warn('No tabs found in the document');
            return;
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');

                // Update active tab
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Show active content
                const tabContentElements = document.querySelectorAll('.tab-content');
                tabContentElements.forEach(content => content.classList.remove('active'));
                
                const targetTab = document.getElementById(`${tabName}-tab`);
                if (targetTab) {
                    targetTab.classList.add('active');
                } else {
                    console.warn(`Tab content element not found: #${tabName}-tab`);
                }
            });
        });
    }
    
    // Initialize tabs immediately and again after wallet connection
    setupTabs();
    
    // Treasury form token type changes
    const treasuryToken = document.getElementById('treasury-token');
    const tokenAddressGroup = document.getElementById('token-address-group');
    const tokenIdGroup = document.getElementById('token-id-group');
    
    if (treasuryToken && tokenAddressGroup && tokenIdGroup) {
        treasuryToken.addEventListener('change', () => {
            const tokenType = treasuryToken.value;
            
            if (tokenType === 'eth') {
                tokenAddressGroup.style.display = 'none';
                tokenIdGroup.style.display = 'none';
            } else if (tokenType === 'erc20') {
                tokenAddressGroup.style.display = 'block';
                tokenIdGroup.style.display = 'none';
            } else {
                tokenAddressGroup.style.display = 'block';
                tokenIdGroup.style.display = 'block';
            }
        });
    } else {
        console.warn('Treasury form elements not found');
    }
    
    // Connect wallet
    connectWalletButton.addEventListener('click', connectWallet);
    
    // Token purchase calculation
    const purchaseAmount = document.getElementById('purchase-amount');
    const purchaseCost = document.getElementById('purchase-cost');
    
    if (purchaseAmount && purchaseCost) {
        purchaseAmount.addEventListener('input', updatePurchaseCost);
    } else {
        console.warn('Purchase amount or cost elements not found');
    }
    
    // Form submissions - with error handling
    function addFormEventListener(formId, handler) {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', handler);
        } else {
            console.warn(`Form not found: #${formId}`);
        }
    }
    
    addFormEventListener('resolution-form', createResolutionProposal);
    addFormEventListener('treasury-form', createTreasuryProposal);
    addFormEventListener('mint-form', createMintProposal);
    addFormEventListener('price-form', createTokenPriceProposal);
    
    const purchaseTokensButton = document.getElementById('purchase-tokens');
    if (purchaseTokensButton) {
        purchaseTokensButton.addEventListener('click', purchaseTokens);
    } else {
        console.warn('Purchase tokens button not found');
    }
    
    // DAO Contract ABI - Simplified for essential functions
    const daoAbi = [
        "function name() view returns (string)",
        "function supportThreshold() view returns (uint256)",
        "function quorumPercentage() view returns (uint256)",
        "function maxProposalAge() view returns (uint256)",
        "function electionDuration() view returns (uint256)",
        "function allowMinting() view returns (bool)",
        "function tokenPrice() view returns (uint256)",
        "function hasTreasury() view returns (bool)",
        "function acceptsETH() view returns (bool)",
        "function acceptsERC20() view returns (bool)",
        "function acceptsERC721() view returns (bool)",
        "function acceptsERC1155() view returns (bool)",
        "function balanceOf(address account, uint256 id) view returns (uint256)",
        "function totalSupply(uint256 tokenId) view returns (uint256)",
        "function getGovernanceTokenHolders() view returns (address[])",
        "function purchaseTokens() payable",
        "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
    ];
    
    // Factory Contract ABI
    const factoryAbi = [
        "function proposalCount() view returns (uint256)",
        "function proposals(uint256 index) view returns (address)",
        "function getProposal(uint256 index) view returns (address)",
        "function createResolutionProposal(string description) returns (address)",
        "function createTreasuryProposal(string description, address recipient, uint256 amount, address token, uint256 tokenId) returns (address)",
        "function createMintProposal(string description, address recipient, uint256 amount) returns (address)",
        "function createTokenPriceProposal(string description, uint256 newPrice) returns (address)"
    ];
    
    // Proposal ABIs
    const proposalAbi = [
        "function description() view returns (string)",
        "function proposer() view returns (address)",
        "function createdAt() view returns (uint256)",
        "function supportTotal() view returns (uint256)",
        "function support(address) view returns (uint256)",
        "function electionTriggered() view returns (bool)",
        "function electionStart() view returns (uint256)",
        "function votingTokenId() view returns (uint256)",
        "function yesVoteAddress() view returns (address)",
        "function noVoteAddress() view returns (address)",
        "function executed() view returns (bool)",
        "function addSupport(uint256 amount)",
        "function removeSupport(uint256 amount)",
        "function execute()"
    ];
    
    const resolutionProposalAbi = [...proposalAbi];
    
    const treasuryProposalAbi = [
        ...proposalAbi,
        "function recipient() view returns (address)",
        "function amount() view returns (uint256)",
        "function token() view returns (address)",
        "function tokenId() view returns (uint256)"
    ];
    
    const mintProposalAbi = [
        ...proposalAbi,
        "function recipient() view returns (address)",
        "function amount() view returns (uint256)"
    ];
    
    const tokenPriceProposalAbi = [
        ...proposalAbi,
        "function newPrice() view returns (uint256)"
    ];
    
    // Helper Functions
    function showNotification(message, type = '') {
        const notification = document.getElementById('notification');
        if (!notification) {
            console.warn('Notification element not found');
            return;
        }
        
        notification.textContent = message;
        notification.className = 'notification';
        
        if (type) {
            notification.classList.add(type);
        }
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    function formatEther(wei) {
        return ethers.utils.formatEther(wei);
    }
    
    function parseEther(eth) {
        return ethers.utils.parseEther(eth.toString());
    }
    
    function shortenAddress(address) {
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }
    
    // Main Functions
    async function connectWallet() {
        try {
            // Check if MetaMask is installed
            if (typeof window.ethereum === 'undefined') {
                showNotification('Please install MetaMask to use this dApp', 'error');
                return;
            }
            
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            connectedAddress = accounts[0];
            
            // Initialize ethers provider and signer
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            
            // Initialize contracts
            daoContract = new ethers.Contract(DAO_ADDRESS, daoAbi, signer);
            factoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, signer);
            
            // Update UI
            connectionCard.style.display = 'none';
            
            // Default view is Dashboard - show only relevant sections
            daoInfo.style.display = 'block';
            createProposal.style.display = 'block';
            activeProposals.style.display = 'none';
            activeElections.style.display = 'none';
            proposalHistory.style.display = 'none';
            
            // Make sure Dashboard nav link is active
            document.querySelectorAll('.nav-links a').forEach(link => {
                link.classList.remove('active');
                if (link.textContent.trim() === 'Dashboard') {
                    link.classList.add('active');
                }
            });
            
            // Reinitialize tabs after UI elements are shown
            setupTabs();
            
            // Load DAO data
            await loadDaoInfo();
            await loadActiveProposals();
            
            // Listen for account changes
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            
            showNotification('Wallet connected successfully!', 'success');
        } catch (error) {
            console.error('Error connecting wallet:', error);
            showNotification('Failed to connect wallet: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    function handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            // Disconnected
            location.reload();
        } else if (accounts[0] !== connectedAddress) {
            // Changed account
            connectedAddress = accounts[0];
            loadDaoInfo();
            loadActiveProposals();
            showNotification('Account changed', 'success');
        }
    }
    
    async function loadDaoInfo() {
        try {
            // Get DAO parameters
            const name = await daoContract.name();
            const supportThreshold = await daoContract.supportThreshold();
            const quorumPercentage = await daoContract.quorumPercentage();
            const maxProposalAge = await daoContract.maxProposalAge();
            const electionDuration = await daoContract.electionDuration();
            const allowMinting = await daoContract.allowMinting();
            const tokenPrice = await daoContract.tokenPrice();
            const hasTreasury = await daoContract.hasTreasury();
            const acceptsETH = await daoContract.acceptsETH();
            const acceptsERC20 = await daoContract.acceptsERC20();
            const acceptsERC721 = await daoContract.acceptsERC721();
            const acceptsERC1155 = await daoContract.acceptsERC1155();
            
            // Get user's token balance
            const tokenBalance = await daoContract.balanceOf(connectedAddress, 0);
            
            // Get total token supply
            const tokenSupply = await daoContract.totalSupply(0);
            
            // Update UI - with error checking for all elements
            const updateElementText = (id, text) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = text;
                } else {
                    console.warn(`Element not found: #${id}`);
                }
            };
            
            updateElementText('dao-name', name);
            updateElementText('token-balance', tokenBalance.toString());
            updateElementText('token-supply', tokenSupply.toString());
            updateElementText('token-price', formatEther(tokenPrice) + ' ETH');
            
            updateElementText('support-threshold', supportThreshold + '%');
            updateElementText('quorum-percentage', quorumPercentage + '%');
            updateElementText('election-duration', electionDuration + ' blocks');
            updateElementText('max-proposal-age', maxProposalAge + ' blocks');
            updateElementText('allow-minting', allowMinting ? 'Yes' : 'No');
            
            // Build treasury config string
            let treasuryConfig = hasTreasury ? 'Yes (' : 'No';
            if (hasTreasury) {
                const configs = [];
                if (acceptsETH) configs.push('ETH');
                if (acceptsERC20) configs.push('ERC20');
                if (acceptsERC721) configs.push('ERC721');
                if (acceptsERC1155) configs.push('ERC1155');
                treasuryConfig += configs.join(', ') + ')';
            }
            updateElementText('treasury-config', treasuryConfig);
            
            // Update token purchase section
            const tokenPurchase = document.getElementById('token-purchase');
            if (tokenPurchase) {
                tokenPurchase.style.display = tokenPrice.toString() === '0' ? 'none' : 'block';
            } else {
                console.warn('Token purchase section not found');
            }
        } catch (error) {
            console.error('Error loading DAO info:', error);
            showNotification('Failed to load DAO information: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function updatePurchaseCost() {
        try {
            const amount = parseFloat(purchaseAmount.value) || 0;
            const tokenPrice = await daoContract.tokenPrice();
            const tokenPriceEth = parseFloat(formatEther(tokenPrice));
            const cost = amount * tokenPriceEth;
            purchaseCost.textContent = `${cost.toFixed(4)} ETH`;
        } catch (error) {
            console.error('Error updating purchase cost:', error);
            purchaseCost.textContent = 'Error calculating cost';
        }
    }
    
    async function purchaseTokens() {
        try {
            const amount = parseInt(purchaseAmount.value);
            if (isNaN(amount) || amount <= 0) {
                showNotification('Please enter a valid amount', 'error');
                return;
            }
            
            const tokenPrice = await daoContract.tokenPrice();
            const totalCost = tokenPrice.mul(amount);
            
            const tx = await daoContract.purchaseTokens({ value: totalCost });
            showNotification('Transaction submitted. Waiting for confirmation...', 'success');
            
            await tx.wait();
            showNotification(`Successfully purchased ${amount} tokens!`, 'success');
            
            // Refresh DAO info
            await loadDaoInfo();
        } catch (error) {
            console.error('Error purchasing tokens:', error);
            showNotification('Failed to purchase tokens: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function loadActiveProposals() {
        try {
            // Hide loading spinners
            document.querySelectorAll('.loading').forEach(spinner => {
                spinner.style.display = 'none';
            });
            
            // Get proposal count
            const proposalCount = await factoryContract.proposalCount();
            
            // Clear existing proposals
            const proposalsGrid = document.getElementById('proposals-grid');
            if (!proposalsGrid) {
                console.warn('Proposals grid element not found');
                return;
            }
            
            proposalsGrid.innerHTML = '';
            
            if (proposalCount.toNumber() === 0) {
                proposalsGrid.innerHTML = '<div class="card"><p>No proposals found</p></div>';
                return;
            }
            
            // Get current block number
            const currentBlock = await provider.getBlockNumber();
            
            // Track active elections for the elections section
            const activeElectionsData = [];
            
            // Loop through all proposals
            for (let i = proposalCount.toNumber() - 1; i >= 0; i--) {
                const proposalAddress = await factoryContract.getProposal(i);
                
                // First create a generic proposal interface to check common properties
                const proposalContract = new ethers.Contract(proposalAddress, proposalAbi, signer);
                
                // Check if proposal has been executed
                const executed = await proposalContract.executed();
                
                // Skip executed proposals for this section
                if (executed) continue;
                
                // Get proposal type-agnostic data
                const description = await proposalContract.description();
                const proposerAddress = await proposalContract.proposer();
                const createdAtBlock = await proposalContract.createdAt();
                const supportTotal = await proposalContract.supportTotal();
                const electionTriggered = await proposalContract.electionTriggered();
                
                let proposalType = 'Resolution';
                let additionalDetails = '';
                
                // Try to determine proposal type and get additional details
                try {
                    // Check if it's a TreasuryProposal
                    const treasuryContract = new ethers.Contract(proposalAddress, treasuryProposalAbi, signer);
                    const recipient = await treasuryContract.recipient();
                    if (recipient) {
                        proposalType = 'Treasury';
                        const amount = await treasuryContract.amount();
                        const token = await treasuryContract.token();
                        const tokenId = await treasuryContract.tokenId();
                        
                        if (token === ethers.constants.AddressZero) {
                            additionalDetails = `Send ${formatEther(amount)} ETH to ${shortenAddress(recipient)}`;
                        } else if (tokenId.toString() === '0') {
                            additionalDetails = `Send ${amount} ERC20 tokens at ${shortenAddress(token)} to ${shortenAddress(recipient)}`;
                        } else {
                            additionalDetails = `Send ${amount} of token ID ${tokenId} from ${shortenAddress(token)} to ${shortenAddress(recipient)}`;
                        }
                    }
                } catch (error) {
                    // Not a treasury proposal
                }
                
                if (proposalType === 'Resolution') {
                    try {
                        // Check if it's a MintProposal
                        const mintContract = new ethers.Contract(proposalAddress, mintProposalAbi, signer);
                        const recipient = await mintContract.recipient();
                        if (recipient) {
                            proposalType = 'Mint';
                            const amount = await mintContract.amount();
                            additionalDetails = `Mint ${amount} governance tokens to ${shortenAddress(recipient)}`;
                        }
                    } catch (error) {
                        // Not a mint proposal
                    }
                }
                
                if (proposalType === 'Resolution') {
                    try {
                        // Check if it's a TokenPriceProposal
                        const priceContract = new ethers.Contract(proposalAddress, tokenPriceProposalAbi, signer);
                        const newPrice = await priceContract.newPrice();
                        if (newPrice !== undefined) {
                            proposalType = 'Token Price';
                            additionalDetails = `Change token price to ${formatEther(newPrice)} ETH`;
                        }
                    } catch (error) {
                        // Not a token price proposal
                    }
                }
                
                // Get user's support for this proposal
                const userSupport = await proposalContract.support(connectedAddress);
                
                // Create proposal card HTML
                let proposalCard = `
                    <div class="card proposal-card" data-address="${proposalAddress}">
                        <div class="proposal-header">
                            <div class="proposal-type">${proposalType}</div>
                            <div class="proposal-title">${description}</div>
                        </div>
                        <div class="proposal-details">
                            <div class="proposal-detail">
                                <div class="detail-label">Proposer:</div>
                                <div class="address">${shortenAddress(proposerAddress)}</div>
                            </div>
                            <div class="proposal-detail">
                                <div class="detail-label">Created At:</div>
                                <div>Block #${createdAtBlock}</div>
                            </div>
                            <div class="proposal-detail">
                                <div class="detail-label">Current Support:</div>
                                <div>${supportTotal}</div>
                            </div>
                            ${additionalDetails ? `
                            <div class="proposal-detail">
                                <div class="detail-label">Details:</div>
                                <div>${additionalDetails}</div>
                            </div>
                            ` : ''}
                            ${userSupport.toString() !== '0' ? `
                            <div class="proposal-detail">
                                <div class="detail-label">Your Support:</div>
                                <div>${userSupport}</div>
                            </div>
                            ` : ''}
                        </div>
                `;
                
                if (electionTriggered) {
                    // This is an active election
                    const electionStart = await proposalContract.electionStart();
                    const votingTokenId = await proposalContract.votingTokenId();
                    const yesVoteAddress = await proposalContract.yesVoteAddress();
                    const noVoteAddress = await proposalContract.noVoteAddress();
                    
                    // Calculate blocks remaining
                    const electionDuration = await daoContract.electionDuration();
                    const electionEndBlock = electionStart.add(electionDuration);
                    const blocksRemaining = electionEndBlock.sub(currentBlock);
                    
                    // Get voting token balance
                    const votingTokens = await daoContract.balanceOf(connectedAddress, votingTokenId);
                    
                    // Get current vote counts
                    const yesVotes = await daoContract.balanceOf(yesVoteAddress, votingTokenId);
                    const noVotes = await daoContract.balanceOf(noVoteAddress, votingTokenId);
                    const totalVotes = yesVotes.add(noVotes);
                    const totalVotingTokens = await daoContract.totalSupply(votingTokenId);
                    
                    // Calculate percentages
                    const yesPercentage = totalVotes.gt(0) ? (yesVotes.mul(100).div(totalVotingTokens)).toString() : '0';
                    const noPercentage = totalVotes.gt(0) ? (noVotes.mul(100).div(totalVotingTokens)).toString() : '0';
                    const participationPercentage = totalVotes.gt(0) ? (totalVotes.mul(100).div(totalVotingTokens)).toString() : '0';
                    
                    proposalCard += `
                        <div class="election-status status-active">Active Election</div>
                        <div class="proposal-detail">
                            <div class="detail-label">Voting Ends:</div>
                            <div>In ${blocksRemaining.toString()} blocks</div>
                        </div>
                        <div class="proposal-detail">
                            <div class="detail-label">Your Voting Tokens:</div>
                            <div>${votingTokens.toString()}</div>
                        </div>
                        <div class="proposal-detail">
                            <div class="detail-label">Yes Votes:</div>
                            <div>${yesVotes.toString()} (${yesPercentage}%)</div>
                        </div>
                        <div class="proposal-detail">
                            <div class="detail-label">No Votes:</div>
                            <div>${noVotes.toString()} (${noPercentage}%)</div>
                        </div>
                        <div class="proposal-detail">
                            <div class="detail-label">Participation:</div>
                            <div>${participationPercentage}%</div>
                        </div>
                        
                        <div class="vote-options">
                            <div class="vote-button vote-yes" data-proposal="${proposalAddress}" data-vote="yes" data-token-id="${votingTokenId}">
                                Vote Yes
                            </div>
                            <div class="vote-button vote-no" data-proposal="${proposalAddress}" data-vote="no" data-token-id="${votingTokenId}">
                                Vote No
                            </div>
                        </div>
                    `;
                    
                    // If election is completed but not executed
                    if (blocksRemaining.lte(0)) {
                        proposalCard += `
                            <button class="execute-proposal" data-address="${proposalAddress}">Execute Proposal</button>
                        `;
                    }
                    
                    // Store election data for the elections section
                    activeElectionsData.push({
                        address: proposalAddress,
                        description: description,
                        type: proposalType,
                        details: additionalDetails,
                        electionStart: electionStart.toString(),
                        blocksRemaining: blocksRemaining.toString(),
                        yesVotes: yesVotes.toString(),
                        noVotes: noVotes.toString(),
                        yesPercentage: yesPercentage,
                        noPercentage: noPercentage,
                        participationPercentage: participationPercentage,
                        votingTokenId: votingTokenId.toString()
                    });
                } else {
                    // This is a proposal that hasn't triggered an election yet
                    // Get DAO parameters for threshold calculation
                    const supportThreshold = await daoContract.supportThreshold();
                    const totalSupply = await daoContract.totalSupply(0);
                    const requiredSupport = totalSupply.mul(supportThreshold).div(100);
                    const supportPercentage = supportTotal.mul(100).div(requiredSupport);
                    
                    proposalCard += `
                        <div class="election-status status-pending">Awaiting Support</div>
                        <div class="proposal-detail">
                            <div class="detail-label">Required Support:</div>
                            <div>${requiredSupport.toString()} tokens</div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(supportPercentage.toString(), 100)}%"></div>
                        </div>
                        <div class="proposal-actions">
                            <input type="number" min="1" placeholder="Support amount" class="support-amount" />
                            <button class="secondary add-support" data-address="${proposalAddress}">Add Support</button>
                            ${userSupport.toString() !== '0' ? `
                            <button class="danger remove-support" data-address="${proposalAddress}">Remove Support</button>
                            ` : ''}
                        </div>
                    `;
                }
                
                proposalCard += `</div>`;
                
                // Add to proposals grid
                proposalsGrid.innerHTML += proposalCard;
            }
            
            // Update Active Elections section
            const electionsGrid = document.getElementById('elections-grid');
            if (!electionsGrid) {
                console.warn('Elections grid element not found');
                return;
            }
            
            electionsGrid.innerHTML = '';
            
            if (activeElectionsData.length === 0) {
                electionsGrid.innerHTML = '<div class="card"><p>No active elections</p></div>';
            } else {
                for (const election of activeElectionsData) {
                    const electionCard = `
                        <div class="card proposal-card">
                            <div class="proposal-header">
                                <div class="proposal-type">${election.type}</div>
                                <div class="proposal-title">${election.description}</div>
                            </div>
                            <div class="election-status status-active">Active Election</div>
                            <div class="proposal-details">
                                ${election.details ? `
                                <div class="proposal-detail">
                                    <div class="detail-label">Details:</div>
                                    <div>${election.details}</div>
                                </div>
                                ` : ''}
                                <div class="proposal-detail">
                                    <div class="detail-label">Remaining:</div>
                                    <div>${election.blocksRemaining} blocks</div>
                                </div>
                                <div class="proposal-detail">
                                    <div class="detail-label">Yes Votes:</div>
                                    <div>${election.yesVotes} (${election.yesPercentage}%)</div>
                                </div>
                                <div class="proposal-detail">
                                    <div class="detail-label">No Votes:</div>
                                    <div>${election.noVotes} (${election.noPercentage}%)</div>
                                </div>
                                <div class="proposal-detail">
                                    <div class="detail-label">Participation:</div>
                                    <div>${election.participationPercentage}%</div>
                                </div>
                            </div>
                            <div class="vote-options">
                                <div class="vote-button vote-yes" data-proposal="${election.address}" data-vote="yes" data-token-id="${election.votingTokenId}">
                                    Vote Yes
                                </div>
                                <div class="vote-button vote-no" data-proposal="${election.address}" data-vote="no" data-token-id="${election.votingTokenId}">
                                    Vote No
                                </div>
                            </div>
                            ${parseInt(election.blocksRemaining) <= 0 ? `
                                <button class="execute-proposal" data-address="${election.address}">Execute Proposal</button>
                            ` : ''}
                        </div>
                    `;
                    electionsGrid.innerHTML += electionCard;
                }
            }
            
            // Add event listeners for proposal interactions
            document.querySelectorAll('.add-support').forEach(button => {
                button.addEventListener('click', addSupport);
            });
            
            document.querySelectorAll('.remove-support').forEach(button => {
                button.addEventListener('click', removeSupport);
            });
            
            document.querySelectorAll('.vote-button').forEach(button => {
                button.addEventListener('click', castVote);
            });
            
            document.querySelectorAll('.execute-proposal').forEach(button => {
                button.addEventListener('click', executeProposal);
            });
        } catch (error) {
            console.error('Error loading proposals:', error);
            showNotification('Failed to load proposals: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function addSupport(event) {
        try {
            const proposalAddress = event.target.getAttribute('data-address');
            const amountInput = event.target.parentElement.querySelector('.support-amount');
            const amount = parseInt(amountInput.value);
            
            if (isNaN(amount) || amount <= 0) {
                showNotification('Please enter a valid amount', 'error');
                return;
            }
            
            const proposalContract = new ethers.Contract(proposalAddress, proposalAbi, signer);
            const tx = await proposalContract.addSupport(amount);
            
            showNotification('Adding support...', 'success');
            await tx.wait();
            
            showNotification('Support added successfully!', 'success');
            loadActiveProposals();
        } catch (error) {
            console.error('Error adding support:', error);
            showNotification('Failed to add support: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function removeSupport(event) {
        try {
            const proposalAddress = event.target.getAttribute('data-address');
            const proposalContract = new ethers.Contract(proposalAddress, proposalAbi, signer);
            
            // Get user's current support
            const userSupport = await proposalContract.support(connectedAddress);
            
            // Remove all support
            const tx = await proposalContract.removeSupport(userSupport);
            
            showNotification('Removing support...', 'success');
            await tx.wait();
            
            showNotification('Support removed successfully!', 'success');
            loadActiveProposals();
        } catch (error) {
            console.error('Error removing support:', error);
            showNotification('Failed to remove support: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function castVote(event) {
        try {
            const proposalAddress = event.target.getAttribute('data-proposal');
            const voteType = event.target.getAttribute('data-vote');
            const tokenId = event.target.getAttribute('data-token-id');
            
            // Get the proposal contract
            const proposalContract = new ethers.Contract(proposalAddress, proposalAbi, signer);
            
            // Get the vote address based on vote type
            let voteAddress;
            if (voteType === 'yes') {
                voteAddress = await proposalContract.yesVoteAddress();
            } else {
                voteAddress = await proposalContract.noVoteAddress();
            }
            
            // Get user's voting token balance
            const votingTokens = await daoContract.balanceOf(connectedAddress, tokenId);
            
            if (votingTokens.toString() === '0') {
                showNotification('You have no voting tokens', 'error');
                return;
            }
            
            // Ask user for voting amount
            const voteAmount = prompt(`How many tokens do you want to vote? (Max: ${votingTokens.toString()})`);
            const amount = parseInt(voteAmount);
            
            if (isNaN(amount) || amount <= 0 || amount > votingTokens.toNumber()) {
                showNotification('Invalid amount', 'error');
                return;
            }
            
            // Approve and transfer tokens
            const tx = await daoContract.safeTransferFrom(
                connectedAddress,
                voteAddress,
                tokenId,
                amount,
                "0x"
            );
            
            showNotification(`Casting ${voteType} vote...`, 'success');
            await tx.wait();
            
            showNotification(`Voted ${voteType} successfully!`, 'success');
            loadActiveProposals();
        } catch (error) {
            console.error('Error casting vote:', error);
            showNotification('Failed to cast vote: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function executeProposal(event) {
        try {
            const proposalAddress = event.target.getAttribute('data-address');
            const proposalContract = new ethers.Contract(proposalAddress, proposalAbi, signer);
            
            const tx = await proposalContract.execute();
            
            showNotification('Executing proposal...', 'success');
            await tx.wait();
            
            showNotification('Proposal executed successfully!', 'success');
            loadActiveProposals();
            loadDaoInfo();
        } catch (error) {
            console.error('Error executing proposal:', error);
            showNotification('Failed to execute proposal: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    // Proposal Creation Functions
    async function createResolutionProposal(event) {
        event.preventDefault();
        
        try {
            const description = document.getElementById('resolution-description').value;
            
            if (!description) {
                showNotification('Description is required', 'error');
                return;
            }
            
            const tx = await factoryContract.createResolutionProposal(description);
            
            showNotification('Creating proposal...', 'success');
            await tx.wait();
            
            showNotification('Proposal created successfully!', 'success');
            
            // Clear form
            document.getElementById('resolution-description').value = '';
            
            // Refresh proposals
            loadActiveProposals();
        } catch (error) {
            console.error('Error creating resolution proposal:', error);
            showNotification('Failed to create proposal: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function createTreasuryProposal(event) {
        event.preventDefault();
        
        try {
            const description = document.getElementById('treasury-description').value;
            const recipient = document.getElementById('treasury-recipient').value;
            const amount = document.getElementById('treasury-amount').value;
            const tokenType = document.getElementById('treasury-token').value;
            
            if (!description || !recipient || !amount) {
                showNotification('All fields are required', 'error');
                return;
            }
            
            let token = ethers.constants.AddressZero;
            let tokenId = 0;
            
            if (tokenType !== 'eth') {
                token = document.getElementById('treasury-token-address').value;
                
                if (!token) {
                    showNotification('Token address is required', 'error');
                    return;
                }
                
                if (tokenType === 'erc721' || tokenType === 'erc1155') {
                    tokenId = document.getElementById('treasury-token-id').value;
                    
                    if (!tokenId) {
                        showNotification('Token ID is required', 'error');
                        return;
                    }
                }
            }
            
            const amountBN = parseEther(amount);
            
            const tx = await factoryContract.createTreasuryProposal(
                description,
                recipient,
                amountBN,
                token,
                tokenId
            );
            
            showNotification('Creating treasury proposal...', 'success');
            await tx.wait();
            
            showNotification('Treasury proposal created successfully!', 'success');
            
            // Clear form
            document.getElementById('treasury-description').value = '';
            document.getElementById('treasury-recipient').value = '';
            document.getElementById('treasury-amount').value = '';
            document.getElementById('treasury-token').value = 'eth';
            document.getElementById('treasury-token-address').value = '';
            document.getElementById('treasury-token-id').value = '';
            
            // Refresh proposals
            loadActiveProposals();
        } catch (error) {
            console.error('Error creating treasury proposal:', error);
            showNotification('Failed to create treasury proposal: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function createMintProposal(event) {
        event.preventDefault();
        
        try {
            const description = document.getElementById('mint-description').value;
            const recipient = document.getElementById('mint-recipient').value;
            const amount = document.getElementById('mint-amount').value;
            
            if (!description || !recipient || !amount) {
                showNotification('All fields are required', 'error');
                return;
            }
            
            const tx = await factoryContract.createMintProposal(
                description,
                recipient,
                amount
            );
            
            showNotification('Creating mint proposal...', 'success');
            await tx.wait();
            
            showNotification('Mint proposal created successfully!', 'success');
            
            // Clear form
            document.getElementById('mint-description').value = '';
            document.getElementById('mint-recipient').value = '';
            document.getElementById('mint-amount').value = '';
            
            // Refresh proposals
            loadActiveProposals();
        } catch (error) {
            console.error('Error creating mint proposal:', error);
            showNotification('Failed to create mint proposal: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    async function createTokenPriceProposal(event) {
        event.preventDefault();
        
        try {
            const description = document.getElementById('price-description').value;
            const newPrice = document.getElementById('new-price').value;
            
            if (!description || newPrice === '') {
                showNotification('All fields are required', 'error');
                return;
            }
            
            const newPriceBN = parseEther(newPrice);
            
            const tx = await factoryContract.createTokenPriceProposal(
                description,
                newPriceBN
            );
            
            showNotification('Creating token price proposal...', 'success');
            await tx.wait();
            
            showNotification('Token price proposal created successfully!', 'success');
            
            // Clear form
            document.getElementById('price-description').value = '';
            document.getElementById('new-price').value = '';
            
            // Refresh proposals
            loadActiveProposals();
        } catch (error) {
            console.error('Error creating token price proposal:', error);
            showNotification('Failed to create token price proposal: ' + (error.message || 'Unknown error'), 'error');
        }
    }
});
