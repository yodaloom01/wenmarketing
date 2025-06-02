// DOM Elements
const addCoinBtn = document.getElementById('addCoinBtn');
const addCoinModal = document.getElementById('addCoinModal');
const closeBtn = document.querySelector('.close-btn');
const addCoinForm = document.getElementById('addCoinForm');
const coinList = document.getElementById('coinList');
const leaderboardList = document.getElementById('leaderboardList');
const totalClicksList = document.getElementById('totalClicksList');
const periodBtns = document.querySelectorAll('.period-btn');

// Initialize Stripe
const stripe = Stripe('pk_test_51RVfG92XAflmugNSsC9892GoRZr004DsntU4TBah6dDAylznyLlSdHZ5rLW7ZWy8cpCbAx2udzCoTkKhulMzPkFj00uj3IjRxp');
const elements = stripe.elements();
const card = elements.create('card');

// Click tracking
const clickHistory = new Map(); // Map of coinId to array of click timestamps

let coins = [];

// Load coins from server
async function loadCoins() {
    try {
        const response = await fetch('http://localhost:3000/api/coins');
        coins = await response.json();
        coins.forEach(coin => initClickHistory(coin.id));
        updateCoinList();
        updateLeaderboards();
    } catch (error) {
        console.error('Error loading coins:', error);
    }
}

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

// Mount card when modal opens
addCoinBtn.addEventListener('click', () => {
    addCoinBtn.textContent = 'Add New Coin';
    addCoinForm.reset();
    addCoinModal.classList.add('active');
    // Mount the card element if it's not already mounted
    setTimeout(() => {
        card.mount('#card-element');
    }, 100);
});

closeBtn.addEventListener('click', () => {
    addCoinModal.classList.remove('active');
    card.unmount();
    addCoinForm.reset();
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === addCoinModal) {
        addCoinModal.classList.remove('active');
        card.unmount();
        addCoinForm.reset();
    }
});

// Handle form submission
addCoinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitButton = addCoinForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    
    try {
        // Get form data
        const formData = {
            name: document.getElementById('coinName').value,
            contractAddress: document.getElementById('contractAddress').value
        };

        // Process payment for new coin
        console.log('Creating payment intent...');
        const response = await fetch('http://localhost:3000/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.error || 'Failed to create payment');
        }

        console.log('Confirming card payment...');
        const { error, paymentIntent } = await stripe.confirmCardPayment(responseData.clientSecret, {
            payment_method: {
                card: card,
            }
        });

        if (error) {
            throw new Error(error.message);
        }

        if (paymentIntent.status === 'succeeded') {
            console.log('Payment successful, sending email...');
            // Payment successful, now send email
            const templateParams = {
                from_name: formData.name,
                to_name: "Admin",
                message: `
Coin Name: ${formData.name}
Contract Address: ${formData.contractAddress}`,
                reply_to: "wenmarketing2025@gmail.com"
            };

            await emailjs.send(
                "service_yr1se2k",
                "template_h7svgsi",
                templateParams
            );
            
            console.log('Email sent, adding coin to server...');
            // Add coin to server
            const coinResponse = await fetch('http://localhost:3000/api/coins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!coinResponse.ok) {
                throw new Error('Failed to add coin to server');
            }

            const newCoin = await coinResponse.json();
            coins.push(newCoin);
            initClickHistory(newCoin.id);
        }
            
        // Close modal and reset form
        addCoinModal.classList.remove('active');
        addCoinForm.reset();
        card.unmount();
        
        alert('Payment successful and coin added!');
        
        // Update displays
        updateCoinList();
        updateLeaderboards();
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Payment & Add Coin';
    }
});

// Update coin list display
function updateCoinList() {
    coinList.innerHTML = coins.map(coin => `
        <div class="coin-card">
            <img src="${coin.image || 'default-coin-image.png'}" alt="${coin.name}" class="coin-image">
            <div class="coin-info">
                <div class="coin-header">
                    <h3 class="coin-name">${coin.name}</h3>
                </div>
                <p class="contract-address">${coin.contractAddress}</p>
                <p class="description">${coin.description || ''}</p>
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
async function vote(coinId) {
    try {
        const response = await fetch(`http://localhost:3000/api/coins/${coinId}/vote`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to update votes');
        }

        const updatedCoin = await response.json();
        const coinIndex = coins.findIndex(c => c.id === coinId);
        if (coinIndex !== -1) {
            coins[coinIndex] = updatedCoin;
        }

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
        updateLeaderboards();
    } catch (error) {
        console.error('Error voting:', error);
        alert('Error updating votes: ' + error.message);
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

// Load coins when page loads
loadCoins(); 