// Configuration
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'
    : 'https://wenmarketing.onrender.com'; // Render backend URL

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
        const response = await fetch(`${API_URL}/api/coins`);
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
    console.log('Form submission started');
    
    const submitButton = addCoinForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    
    try {
        // Get form data
        const formData = {
            name: document.getElementById('coinName').value,
            contractAddress: document.getElementById('contractAddress').value,
            isPaid: false // Add flag to track payment status
        };
        console.log('Form data:', formData);

        // First add the coin to get an ID
        console.log('Adding coin to server...');
        const coinResponse = await fetch(`${API_URL}/api/coins`, {
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
        console.log('Coin added, processing payment...');

        // Now process payment
        console.log('Creating payment intent...');
        const response = await fetch(`${API_URL}/create-payment-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Payment intent response:', response);

        const responseData = await response.json();
        console.log('Payment intent data:', responseData);
        
        if (!response.ok) {
            // If payment intent fails, delete the coin
            await fetch(`${API_URL}/api/coins/${newCoin.id}`, {
                method: 'DELETE'
            });
            throw new Error(responseData.error || 'Failed to create payment');
        }

        console.log('Confirming card payment...');
        const { error, paymentIntent } = await stripe.confirmCardPayment(responseData.clientSecret, {
            payment_method: {
                card: card,
            }
        });

        if (error) {
            // If payment fails, delete the coin
            await fetch(`${API_URL}/api/coins/${newCoin.id}`, {
                method: 'DELETE'
            });
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
            
            console.log('Email sent, updating coin payment status...');
            // Update coin to mark it as paid
            await fetch(`${API_URL}/api/coins/${newCoin.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ...formData, isPaid: true })
            });

            // Reload all coins to refresh the display
            await loadCoins();
            
            // Close modal and reset form
            addCoinModal.classList.remove('active');
            addCoinForm.reset();
            card.unmount();
            
            alert('Payment successful and coin added!');
            
            // Update displays
            updateCoinList();
            updateLeaderboards();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Payment & Add Coin';
    }
});

// Add promotional banner to body
const promoBanner = document.createElement('div');
promoBanner.className = 'promo-banner';
document.body.appendChild(promoBanner);

// Update coin list display
function updateCoinList() {
    coinList.innerHTML = coins.map(coin => {
        const isLegendary = (coin.recentVotes || 0) >= 1000;
        return `
            <div class="coin-card ${isLegendary ? 'legendary' : ''}">
                <div class="coin-name">${coin.name}</div>
                <div class="coin-address">${coin.contractAddress}</div>
                <div class="votes-count">
                    🔥 ${coin.votes || 0} total votes
                    <br>
                    <span style="font-size: 0.9em; color: var(--accent)">
                        (${coin.recentVotes || 0} in last minute)
                    </span>
                </div>
                <button onclick="vote('${coin.id}')" class="vote-btn">VOTE</button>
            </div>
        `;
    }).join('');

    // Check for any coins with 1000+ votes/min
    const legendaryCoins = coins.filter(coin => (coin.recentVotes || 0) >= 1000);
    if (legendaryCoins.length > 0) {
        promoBanner.style.display = 'block';
        promoBanner.innerHTML = `🏆 ${legendaryCoins.map(c => c.name).join(', ')} ${legendaryCoins.length === 1 ? 'has' : 'have'} reached LEGENDARY status with 1000+ votes/min! 🏆`;
    } else {
        promoBanner.style.display = 'none';
    }
}

// Handle voting
async function vote(coinId) {
    try {
        const btn = document.querySelector(`button[onclick="vote('${coinId}')"]`);
        const card = btn.closest('.coin-card');
        const votesCount = card.querySelector('.votes-count');
        
        // Add voting animation class
        btn.classList.add('voting');
        votesCount.classList.add('updating');

        // Create coin rain effect
        createCoinRain(btn);

        // Original vote API call
        const response = await fetch(`${API_URL}/api/coins/${coinId}/vote`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to update votes');
        }

        const updatedCoin = await response.json();
        const coinIndex = coins.findIndex(c => String(c.id) === String(coinId));
        if (coinIndex !== -1) {
            coins[coinIndex] = updatedCoin;
        }

        // Remove animation classes after delay
        setTimeout(() => {
            btn.classList.remove('voting');
            votesCount.classList.remove('updating');
        }, 500);

    } catch (error) {
        console.error('Vote error:', error);
    }
}

function createCoinRain(btn) {
    const rect = btn.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    
    // Create multiple coins
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const coin = document.createElement('div');
            coin.className = 'coin-rain';
            coin.style.left = `${startX - 50 + Math.random() * 100}px`;
            coin.style.top = `${rect.top}px`;
            document.body.appendChild(coin);

            // Remove coin after animation
            coin.addEventListener('animationend', () => {
                coin.remove();
            });
        }, i * 50);
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

// Admin authentication check
function checkAdminStatus() {
    // Check if admin token exists in localStorage
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    const adminBtn = document.querySelector('.admin-btn');
    
    if (adminBtn) {
        if (!isAdmin) {
            adminBtn.style.display = 'none';
            // Remove logout button if it exists
            const logoutBtn = document.querySelector('.logout-btn');
            if (logoutBtn) logoutBtn.remove();
        } else {
            adminBtn.style.display = 'block';
            // Add logout button if it doesn't exist
            if (!document.querySelector('.logout-btn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.className = 'logout-btn';
                logoutBtn.style.cssText = `
                    position: fixed;
                    bottom: 2rem;
                    right: 12rem;
                    background: #e74c3c;
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: background 0.3s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                `;
                logoutBtn.textContent = '🔓 Logout';
                logoutBtn.onclick = () => {
                    localStorage.removeItem('isAdmin');
                    localStorage.removeItem('adminAuthenticated');
                    checkAdminStatus();
                    alert('Logged out successfully');
                };
                document.body.appendChild(logoutBtn);
            }
        }
    }
}

// Call checkAdminStatus when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAdminStatus();
    loadCoins();
});

// Add secret key combination to enable admin (Ctrl + Alt + A)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.key === 'a') {
        const password = prompt('Enter admin password:');
        if (password === 'wenmarketing2025') {
            localStorage.setItem('isAdmin', 'true');
            checkAdminStatus(); // Immediately check and update admin status
            alert('Admin mode activated');
            location.reload(); // Refresh the page to show changes
        }
    }
}); 