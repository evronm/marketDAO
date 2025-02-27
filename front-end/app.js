// Constants and Globals
let provider, signer, daoContract, factoryContract;
let daoAddress, factoryAddress;
let proposals = [];
let userAddress;

// Contract ABIs - Copy these from your compiled contracts
const daoABI = [
  "function name() view returns (string)",
  "function supportThreshold() view returns (uint256)",
  "function quorumPercentage() view returns (uint256)",
  "function electionDuration() view returns (uint256)",
  "function tokenPrice() view returns (uint256)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function totalSupply(uint256 id) view returns (uint256)",
  "function purchaseTokens() payable",
  "function getGovernanceTokenHolders() view returns (address[])",
  "function isProposalActive(address proposal) view returns (bool)"
];

const factoryABI = [
  "function dao() view returns (address)",
  "function proposalCount() view returns (uint256)",
  "function getProposal(uint256 index) view returns (address)",
  "function createResolutionProposal(string description) returns (address)",
  "function createTreasuryProposal(string description, address recipient, uint256 amount, address token, uint256 tokenId) returns (address)",
  "function createMintProposal(string description, address recipient, uint256 amount) returns (address)",
  "function createTokenPriceProposal(string description, uint256 newPrice) returns (address)"
];

const proposalABI = [
  "function dao() view returns (address)",
  "function proposer() view returns (address)",
  "function description() view returns (string)",
  "function supportTotal() view returns (uint256)",
  "function support(address) view returns (uint256)",
  "function electionTriggered() view returns (bool)",
  "function electionStart() view returns (uint256)",
  "function executed() view returns (bool)",
  "function addSupport(uint256 amount)",
  "function removeSupport(uint256 amount)",
  "function canTriggerElection() view returns (bool)",
  // Additional fields for specific proposal types
  "function recipient() view returns (address)",
  "function amount() view returns (uint256)",
  "function token() view returns (address)",
  "function tokenId() view returns (uint256)",
  "function newPrice() view returns (uint256)"
];

// Set contract addresses - Update these with your deployed contract addresses
// For development with Anvil
daoAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
factoryAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// DOM Elements
const connectBtn = document.getElementById('connect');
const proposalList = document.getElementById('proposal-list');
const proposalForm = document.getElementById('proposal-form');
const proposalType = document.getElementById('proposal-type');
const dynamicFields = document.getElementById('dynamic-fields');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const purchaseTokensBtn = document.getElementById('purchase-tokens');
const purchaseAmount = document.getElementById('purchase-amount');

// Event Listeners
window.addEventListener('DOMContentLoaded', initialize);
connectBtn.addEventListener('click', connectWallet);
proposalType.addEventListener('change', updateProposalForm);
proposalForm.addEventListener('submit', createProposal);
purchaseTokensBtn.addEventListener('click', purchaseTokens);

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    
    // Update active tab
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Show target content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === target + '-proposals' || content.id === target + '-proposal') {
        content.classList.add('active');
      }
    });
  });
});

// Initialization
async function initialize() {
  try {
    // Check if web3 is available
    if (window.ethereum) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      console.log('Ethereum provider detected');
      
      // Set up contracts
      setupContracts();
      
      // Load DAO info
      await loadDAOInfo();
      
      // Setup the form fields
      updateProposalForm();
      
      // Try to connect if already authorized
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        await connectWallet();
      }
    } else {
      console.log('No Ethereum provider detected');
      alert('Please install MetaMask to use this dApp');
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

function setupContracts() {
  daoContract = new ethers.Contract(daoAddress, daoABI, provider);
  factoryContract = new ethers.Contract(factoryAddress, factoryABI, provider);
}

async function connectWallet() {
  try {
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    
    // Update UI
    document.getElementById('address').textContent = userAddress.substring(0, 6) + '...' + userAddress.substring(38);
    connectBtn.textContent = 'Connected';
    
    // Connect contracts to signer
    daoContract = daoContract.connect(signer);
    factoryContract = factoryContract.connect(signer);
    
    // Load user balance
    await loadUserBalance();
    
    // Load proposals
    await loadProposals();
  } catch (error) {
    console.error('Connection error:', error);
    alert('Failed to connect wallet');
  }
}

async function loadDAOInfo() {
  try {
    const [name, supportThreshold, quorum, electionDuration, tokenPrice] = await Promise.all([
      daoContract.name(),
      daoContract.supportThreshold(),
      daoContract.quorumPercentage(),
      daoContract.electionDuration(),
      daoContract.tokenPrice()
    ]);
    
    document.getElementById('dao-name').textContent = name;
    document.getElementById('support-threshold').textContent = supportThreshold.toString();
    document.getElementById('quorum').textContent = quorum.toString();
    document.getElementById('election-duration').textContent = electionDuration.toString();
    document.getElementById('token-price').textContent = ethers.utils.formatEther(tokenPrice);
  } catch (error) {
    console.error('Error loading DAO info:', error);
  }
}

async function loadUserBalance() {
  try {
    const balance = await daoContract.balanceOf(userAddress, 0);
    document.getElementById('user-balance').textContent = balance.toString();
  } catch (error) {
    console.error('Error loading user balance:', error);
  }
}

async function loadProposals() {
  try {
    proposalList.innerHTML = '';
    const count = await factoryContract.proposalCount();
    
    for (let i = 0; i < count; i++) {
      const proposalAddress = await factoryContract.getProposal(i);
      await loadProposal(proposalAddress, i);
    }
  } catch (error) {
    console.error('Error loading proposals:', error);
  }
}

async function loadProposal(address, index) {
  try {
    const proposal = new ethers.Contract(address, proposalABI, signer);
    
    // Get basic proposal info
    const [
      description, 
      proposer, 
      supportTotal, 
      userSupport, 
      electionTriggered, 
      executed,
      isActive
    ] = await Promise.all([
      proposal.description(),
      proposal.proposer(),
      proposal.supportTotal(),
      proposal.support(userAddress),
      proposal.electionTriggered(),
      proposal.executed(),
      daoContract.isProposalActive(address)
    ]);
    
    // Determine proposal type based on available functions
    let proposalType = 'Resolution';
    let details = '';
    
    try {
      const recipient = await proposal.recipient();
      const amount = await proposal.amount();
      
      try {
        const token = await proposal.token();
        proposalType = 'Treasury Transfer';
        details = `Recipient: ${recipient.substring(0, 6)}...${recipient.substring(38)}<br>Amount: ${amount}`;
      } catch {
        proposalType = 'Mint Tokens';
        details = `Recipient: ${recipient.substring(0, 6)}...${recipient.substring(38)}<br>Amount: ${amount}`;
      }
    } catch {
      try {
        const newPrice = await proposal.newPrice();
        proposalType = 'Token Price';
        details = `New Price: ${ethers.utils.formatEther(newPrice)} ETH`;
      } catch {
        // It's a resolution proposal
      }
    }
    
    // Calculate support percentage
    const totalSupply = await daoContract.totalSupply(0);
    const supportNeeded = totalSupply.mul(await daoContract.supportThreshold()).div(100);
    const supportPercentage = totalSupply.isZero() ? 0 : (supportTotal.mul(100).div(totalSupply)).toNumber();
    
    // Create proposal card from template
    const template = document.getElementById('proposal-template');
    const card = document.importNode(template.content, true).querySelector('.proposal-card');
    
    card.querySelector('.proposal-title').textContent = `Proposal #${index + 1}`;
    card.querySelector('.proposal-type').textContent = proposalType;
    card.querySelector('.proposal-description').textContent = description;
    card.querySelector('.proposal-details').innerHTML = details;
    card.querySelector('.support-total').textContent = supportTotal.toString();
    card.querySelector('.support-needed').textContent = supportNeeded.toString();
    
    // Update progress bar
    const progressBar = card.querySelector('.progress');
    progressBar.style.width = `${Math.min(supportPercentage, 100)}%`;
    
    // Set up buttons based on state
    const addSupportBtn = card.querySelector('.add-support');
    const removeSupportBtn = card.querySelector('.remove-support');
    const voteYesBtn = card.querySelector('.vote-yes');
    const voteNoBtn = card.querySelector('.vote-no');
    const executeBtn = card.querySelector('.execute');
    const amountInput = card.querySelector('.support-amount');
    
    if (executed || !isActive) {
      addSupportBtn.disabled = true;
      removeSupportBtn.disabled = true;
      voteYesBtn.disabled = true;
      voteNoBtn.disabled = true;
      executeBtn.disabled = true;
      amountInput.disabled = true;
      card.classList.add('executed');
    } else if (electionTriggered) {
      addSupportBtn.style.display = 'none';
      removeSupportBtn.style.display = 'none';
      amountInput.style.display = 'none';
      executeBtn.style.display = 'block';
      voteYesBtn.style.display = 'block';
      voteNoBtn.style.display = 'block';
    } else {
      voteYesBtn.style.display = 'none';
      voteNoBtn.style.display = 'none';
      executeBtn.style.display = 'none';
    }
    
    // Add event listeners
    addSupportBtn.addEventListener('click', async () => {
      const amount = parseInt(amountInput.value);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }
      
      try {
        const tx = await proposal.addSupport(amount);
        await tx.wait();
        await loadProposals();
      } catch (error) {
        console.error('Error adding support:', error);
        alert('Failed to add support');
      }
    });
    
    removeSupportBtn.addEventListener('click', async () => {
      const amount = parseInt(amountInput.value);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }
      
      try {
        const tx = await proposal.removeSupport(amount);
        await tx.wait();
        await loadProposals();
      } catch (error) {
        console.error('Error removing support:', error);
        alert('Failed to remove support');
      }
    });
    
    executeBtn.addEventListener('click', async () => {
      try {
        const tx = await proposal.execute();
        await tx.wait();
        await loadProposals();
      } catch (error) {
        console.error('Error executing proposal:', error);
        alert('Failed to execute proposal');
      }
    });
    
    // Add the card to the list
    proposalList.appendChild(card);
  } catch (error) {
    console.error('Error loading proposal:', error);
  }
}

function updateProposalForm() {
  const type = proposalType.value;
  dynamicFields.innerHTML = '';
  
  switch (type) {
    case 'resolution':
      // No additional fields needed
      break;
      
    case 'treasury':
      dynamicFields.innerHTML = `
        <div class="form-group">
          <label for="recipient">Recipient Address</label>
          <input id="recipient" type="text" required>
        </div>
        <div class="form-group">
          <label for="amount">Amount</label>
          <input id="amount" type="number" required min="1">
        </div>
        <div class="form-group">
          <label for="token">Token Address (0x0 for ETH)</label>
          <input id="token" type="text" value="0x0000000000000000000000000000000000000000">
        </div>
        <div class="form-group">
          <label for="token-id">Token ID (for ERC721/ERC1155)</label>
          <input id="token-id" type="number" value="0">
        </div>
      `;
      break;
      
    case 'mint':
      dynamicFields.innerHTML = `
        <div class="form-group">
          <label for="mint-recipient">Recipient Address</label>
          <input id="mint-recipient" type="text" required>
        </div>
        <div class="form-group">
          <label for="mint-amount">Amount</label>
          <input id="mint-amount" type="number" required min="1">
        </div>
      `;
      break;
      
    case 'price':
      dynamicFields.innerHTML = `
        <div class="form-group">
          <label for="new-price">New Token Price (ETH)</label>
          <input id="new-price" type="number" step="0.000000000000000001" required>
        </div>
      `;
      break;
  }
}

async function createProposal(event) {
  event.preventDefault();
  
  if (!signer) {
    alert('Please connect your wallet first');
    return;
  }
  
  const type = proposalType.value;
  const description = document.getElementById('proposal-description').value;
  
  if (!description) {
    alert('Please enter a description');
    return;
  }
  
  try {
    let tx;
    
    switch (type) {
      case 'resolution':
        tx = await factoryContract.createResolutionProposal(description);
        break;
        
      case 'treasury':
        const recipient = document.getElementById('recipient').value;
        const amount = document.getElementById('amount').value;
        const token = document.getElementById('token').value;
        const tokenId = document.getElementById('token-id').value;
        
        tx = await factoryContract.createTreasuryProposal(
          description,
          recipient,
          amount,
          token,
          tokenId
        );
        break;
        
      case 'mint':
        const mintRecipient = document.getElementById('mint-recipient').value;
        const mintAmount = document.getElementById('mint-amount').value;
        
        tx = await factoryContract.createMintProposal(
          description,
          mintRecipient,
          mintAmount
        );
        break;
        
      case 'price':
        const newPrice = ethers.utils.parseEther(document.getElementById('new-price').value);
        
        tx = await factoryContract.createTokenPriceProposal(
          description,
          newPrice
        );
        break;
    }
    
    await tx.wait();
    alert('Proposal created successfully!');
    proposalForm.reset();
    
    // Switch to active proposals tab
    tabs[0].click();
    
    // Reload proposals
    await loadProposals();
  } catch (error) {
    console.error('Error creating proposal:', error);
    alert('Failed to create proposal: ' + error.message);
  }
}

async function purchaseTokens() {
  if (!signer) {
    alert('Please connect your wallet first');
    return;
  }
  
  const amount = purchaseAmount.value;
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  try {
    const tokenPrice = await daoContract.tokenPrice();
    if (tokenPrice.isZero()) {
      alert('Direct token purchases are disabled');
      return;
    }
    
    const totalCost = tokenPrice.mul(amount);
    
    const tx = await daoContract.purchaseTokens({
      value: totalCost
    });
    
    await tx.wait();
    alert('Tokens purchased successfully!');
    purchaseAmount.value = '';
    
    // Refresh user balance
    await loadUserBalance();
  } catch (error) {
    console.error('Error purchasing tokens:', error);
    alert('Failed to purchase tokens: ' + error.message);
  }
}