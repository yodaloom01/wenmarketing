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
let allCoins = []; // Store all coins

// Load coins from server
async function loadCoins() {
    try {
        const response = await fetch('http://localhost:3000/api/coins');
        coins = await response.json();
        allCoins = [...coins]; // Store all coins
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
            <div class="coin-name">${coin.name}</div>
            <div class="coin-address">${coin.contractAddress}</div>
            <div class="votes-count">
                🔥 ${coin.votes || 0} total votes
                <br>
                <span style="font-size: 0.9em; color: var(--accent)">
                    (${coin.recentVotes || 0} in last minute)
                </span>
            </div>
            <button onclick="vote(${coin.id})" class="vote-btn">VOTE</button>
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

        // Get the clicked button's position for the confetti effect
        const btn = document.querySelector(`button[onclick="vote(${coinId})"]`);
        const rect = btn.getBoundingClientRect();
        createConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);

        // Add winning animation to the coin card
        const card = btn.closest('.coin-card');
        card.classList.add('win-animation');
        setTimeout(() => card.classList.remove('win-animation'), 500);

        // Play a satisfying sound
        const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAABQAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAABSAJAaWQAAAAAAAAAAAAAAAAAAAAP/jOMAAAAAAAAAAAABJbmZvAAAADwAAAAMAAABmAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf///////////////////////////////////////////////////////////////////////////wAAAABMYXZjNTguMTMAAAAAAAAAAAAAAAAkAAAAAAAAAAAAFIAkBpZEAAAAAAAAAAAAAAAAAAAA//uQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
        audio.volume = 0.2;
        audio.play();
        
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
    const recentVotes = [...coins]
        .sort((a, b) => (b.recentVotes || 0) - (a.recentVotes || 0))
        .slice(0, 5);

    leaderboardList.innerHTML = recentVotes.map((coin, index) => `
        <div class="leaderboard-entry">
            <div>
                <span style="color: var(--gold)">#${index + 1}</span>
                <span style="color: var(--money-green)">${coin.name}</span>
            </div>
            <div>🔥 ${coin.recentVotes || 0} votes/min</div>
        </div>
    `).join('');

    // Total clicks leaderboard
    const topTotal = [...coins]
        .sort((a, b) => (b.votes || 0) - (a.votes || 0))
        .slice(0, 5);

    totalClicksList.innerHTML = topTotal.map((coin, index) => `
        <div class="leaderboard-entry">
            <div>
                <span style="color: var(--gold)">#${index + 1}</span>
                <span style="color: var(--money-green)">${coin.name}</span>
            </div>
            <div>💰 ${coin.votes || 0} total</div>
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

// Add confetti effect for voting
function createConfetti(x, y) {
    const colors = ['#00ff66', '#ffd700', '#ff3e3e'];
    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.left = x + 'px';
        confetti.style.top = y + 'px';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.borderRadius = '50%';
        confetti.style.pointerEvents = 'none';
        document.body.appendChild(confetti);

        const angle = Math.random() * Math.PI * 2;
        const velocity = 5 + Math.random() * 5;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;

        let posX = x;
        let posY = y;

        const animate = () => {
            posX += vx;
            posY += vy - 0.5; // Add gravity effect
            confetti.style.left = posX + 'px';
            confetti.style.top = posY + 'px';
            confetti.style.opacity = parseFloat(confetti.style.opacity || 1) - 0.02;

            if (parseFloat(confetti.style.opacity) > 0) {
                requestAnimationFrame(animate);
            } else {
                confetti.remove();
            }
        };

        requestAnimationFrame(animate);
    }
}

// Search functionality
const searchInput = document.getElementById('searchInput');

// Add search event listener
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm === '') {
        coins = [...allCoins];
    } else {
        coins = allCoins.filter(coin => 
            coin.name.toLowerCase().includes(searchTerm) ||
            coin.contractAddress.toLowerCase().includes(searchTerm)
        );
    }
    updateCoinList();
}); 