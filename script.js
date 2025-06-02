// DOM Elements
const addCoinBtn = document.getElementById('addCoinBtn');
const addCoinModal = document.getElementById('addCoinModal');
const closeBtn = document.querySelector('.close-btn');
const addCoinForm = document.getElementById('addCoinForm');
const coinList = document.getElementById('coinList');
const leaderboardList = document.getElementById('leaderboardList');
const totalClicksList = document.getElementById('totalClicksList');
const periodBtns = document.querySelectorAll('.period-btn');

// Load coins from localStorage
let coins = JSON.parse(localStorage.getItem('coins')) || [];

// Click tracking
const clickHistory = new Map(); // Map of coinId to array of click timestamps

// Initialize click history for all coins
coins.forEach(coin => initClickHistory(coin.id));

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
    
    // Keep only last minute of clicks
    const oneMinuteAgo = Date.now() - (60 * 1000);
    while (timestamps.length > 0 && timestamps[0] < oneMinuteAgo) {
        timestamps.shift();
    }
}

// Calculate clicks per minute
function calculateClicksPerMinute(coinId) {
    const timestamps = clickHistory.get(coinId) || [];
    const oneMinuteAgo = Date.now() - (60 * 1000);
    const recentClicks = timestamps.filter(t => t >= oneMinuteAgo);
    return recentClicks.length;
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
document.getElementById('addCoinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = {
        coinName: document.getElementById('coinName').value,
        contractAddress: document.getElementById('contractAddress').value
    };
    
    try {
        // Send email using EmailJS
        const response = await emailjs.send(
            "service_yr1se2k",
            "template_h7svgsi",
            {
                from_name: formData.coinName,
                to_name: "Admin",
                message: `
Coin Name: ${formData.coinName}
Contract Address: ${formData.contractAddress}`,
                reply_to: "wenmarketing2025@gmail.com"
            }
        );
        
        // Show success message
        alert('Thank you! Your coin submission has been sent for review. Once approved, it will appear on the site.');
        
        // Reset form and close modal
        document.getElementById('addCoinForm').reset();
        addCoinModal.classList.remove('active');
    } catch (error) {
        console.error("Email sending failed:", error);
        alert('There was an error submitting your coin. Please try again.');
    }
});

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
        
        // Save updated votes to localStorage
        localStorage.setItem('coins', JSON.stringify(coins));
        
        // Visual feedback
        const btn = document.querySelector(`button[onclick="vote(${coinId})"]`);
        if (btn) {
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 50);
        }
        
        updateCoinList();
        updateLeaderboards();
    }
}

// Update leaderboards
function updateLeaderboards() {
    // Last minute trending
    const trendingCoins = coins.map(coin => ({
        ...coin,
        clicksPerMinute: calculateClicksPerMinute(coin.id)
    }))
    .sort((a, b) => b.clicksPerMinute - a.clicksPerMinute)
    .slice(0, 5); // Top 5 coins

    leaderboardList.innerHTML = trendingCoins.map((coin, index) => `
        <div class="leaderboard-entry">
            <div class="rank">#${index + 1}</div>
            <div class="coin-info-compact">
                <div class="coin-name-compact">${coin.name}</div>
                <div class="contract-address">${coin.contractAddress}</div>
            </div>
            <div class="click-stats">
                <div class="clicks-per-minute">${coin.clicksPerMinute}</div>
                <div class="trend-indicator">clicks/min</div>
            </div>
        </div>
    `).join('');

    // Total clicks leaderboard
    const topTotalClicks = [...coins]
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 5); // Top 5 coins

    totalClicksList.innerHTML = topTotalClicks.map((coin, index) => `
        <div class="leaderboard-entry">
            <div class="rank">#${index + 1}</div>
            <div class="coin-info-compact">
                <div class="coin-name-compact">${coin.name}</div>
                <div class="contract-address">${coin.contractAddress}</div>
            </div>
            <div class="click-stats">
                <div class="clicks-per-minute">${coin.votes.toLocaleString()}</div>
                <div class="trend-indicator">total clicks</div>
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
        updateLeaderboards();
    });
});

// Update displays every second to keep trending current
setInterval(updateLeaderboards, 1000);

// Initialize the display
updateCoinList();
updateLeaderboards(); 