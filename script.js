// DOM Elements
const addCoinBtn = document.getElementById('addCoinBtn');
const addCoinModal = document.getElementById('addCoinModal');
const closeBtn = document.querySelector('.close-btn');
const addCoinForm = document.getElementById('addCoinForm');
const coinList = document.getElementById('coinList');
const leaderboardList = document.getElementById('leaderboardList');
const periodBtns = document.querySelectorAll('.period-btn');

// Sample data structure (replace with backend storage later)
let coins = [];

// Click tracking
const clickHistory = new Map(); // Map of coinId to array of click timestamps

// Initialize click history for a coin
function initClickHistory(coinId) {
    if (!clickHistory.has(coinId)) {
        clickHistory.set(coinId, []);
    }
}

// Add click to history
function trackClick(coinId) {
    initClickHistory(coinId);
    const timestamps = clickHistory.get(coinId);
    timestamps.push(Date.now());
    
    // Keep only last 15 minutes of clicks
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    while (timestamps.length > 0 && timestamps[0] < fifteenMinutesAgo) {
        timestamps.shift();
    }
}

// Calculate clicks per minute for a specific time period
function calculateClicksPerMinute(coinId, minutes) {
    const timestamps = clickHistory.get(coinId) || [];
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentClicks = timestamps.filter(t => t >= cutoff);
    return recentClicks.length / minutes;
}

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
        initClickHistory(coinData.id);
        updateCoinList();
        updateLeaderboard();
        addCoinForm.reset();
        addCoinModal.classList.remove('active');
    }
});

// Simulate payment processing (replace with real payment gateway)
async function processPayment() {
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
    coinList.innerHTML = coins.map(coin => `
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

// Handle voting
function vote(coinId) {
    const coin = coins.find(c => c.id === coinId);
    if (coin) {
        coin.votes++;
        trackClick(coinId);
        
        // Visual feedback
        const btn = document.querySelector(`button[onclick="vote(${coinId})"]`);
        if (btn) {
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 50);
        }
        
        updateCoinList();
        updateLeaderboard();
    }
}

// Update leaderboard
function updateLeaderboard() {
    const activePeriod = document.querySelector('.period-btn.active').dataset.period;
    const minutes = parseInt(activePeriod);
    
    // Calculate clicks per minute for each coin
    const rankings = coins.map(coin => ({
        ...coin,
        clicksPerMinute: calculateClicksPerMinute(coin.id, minutes)
    }))
    .sort((a, b) => b.clicksPerMinute - a.clicksPerMinute)
    .slice(0, 10); // Top 10 coins

    leaderboardList.innerHTML = rankings.map((coin, index) => `
        <div class="leaderboard-entry">
            <div class="rank">#${index + 1}</div>
            <div class="coin-info-compact">
                <div class="coin-name-compact">${coin.name}</div>
                <div class="contract-address">${coin.contractAddress}</div>
            </div>
            <div class="click-stats">
                <div class="clicks-per-minute">${coin.clicksPerMinute.toFixed(1)}</div>
                <div class="trend-indicator">clicks/min</div>
            </div>
        </div>
    `).join('');
}

// Handle period button clicks
periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active state
        periodBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update leaderboard
        updateLeaderboard();
    });
});

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
initClickHistory(sampleCoin.id);
updateCoinList();
updateLeaderboard(); 