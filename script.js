// DOM Elements
const addCoinBtn = document.getElementById('addCoinBtn');
const addCoinModal = document.getElementById('addCoinModal');
const closeBtn = document.querySelector('.close-btn');
const addCoinForm = document.getElementById('addCoinForm');
const coinList = document.getElementById('coinList');

// Sample data structure (replace with backend storage later)
let coins = [];

// Show/Hide Modal
addCoinBtn.addEventListener('click', () => {
    addCoinModal.classList.add('active');
});

closeBtn.addEventListener('click', () => {
    addCoinModal.classList.remove('active');
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === addCoinModal) {
        addCoinModal.classList.remove('active');
    }
});

// Handle form submission
addCoinForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Simulate payment processing
    const paymentSuccess = await processPayment();
    
    if (paymentSuccess) {
        const formData = new FormData(addCoinForm);
        const coinData = {
            id: Date.now(),
            name: formData.get('coinName'),
            contractAddress: formData.get('contractAddress'),
            description: formData.get('description'),
            image: await getImageDataUrl(formData.get('coinImage')),
            votes: 0,
            timestamp: Date.now()
        };

        coins.push(coinData);
        updateCoinList();
        addCoinForm.reset();
        addCoinModal.classList.remove('active');
    }
});

// Simulate payment processing (replace with real payment gateway)
async function processPayment() {
    // Simulate payment API call
    return new Promise((resolve) => {
        setTimeout(() => {
            alert('Payment successful! Your coin has been listed.');
            resolve(true);
        }, 1000);
    });
}

// Convert image file to data URL
function getImageDataUrl(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

// Update coin list display
function updateCoinList() {
    // Sort coins by votes (descending) and timestamp for tiebreaker
    const sortedCoins = [...coins].sort((a, b) => {
        if (b.votes === a.votes) {
            return b.timestamp - a.timestamp;
        }
        return b.votes - a.votes;
    });

    coinList.innerHTML = sortedCoins.map(coin => `
        <div class="coin-card">
            <img src="${coin.image}" alt="${coin.name}" class="coin-image">
            <div class="coin-info">
                <h3 class="coin-name">${coin.name}</h3>
                <p class="contract-address">${coin.contractAddress}</p>
                <p class="description">${coin.description}</p>
                <div class="vote-stats">
                    <button class="hammer-btn" onclick="vote(${coin.id})">
                        🔨 HAMMER! (<span class="votes">${coin.votes.toLocaleString()}</span>)
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Handle single click voting
function vote(coinId) {
    const coin = coins.find(c => c.id === coinId);
    if (coin) {
        coin.votes++;
        
        // Visual feedback
        const btn = document.querySelector(`button[onclick="vote(${coinId})"]`);
        if (btn) {
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 50);
        }
        
        updateCoinList();
    }
}

// Initialize with sample data (optional)
const sampleCoin = {
    id: 1,
    name: "Sample Coin",
    contractAddress: "0x1234...5678",
    description: "Click the hammer as fast as you can! Each click = 1 vote! 🚀",
    image: "https://via.placeholder.com/300",
    votes: 0,
    timestamp: Date.now()
};

coins.push(sampleCoin);
updateCoinList(); 