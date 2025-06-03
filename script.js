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
        const isUltraLegendary = (coin.recentVotes || 0) >= 1000;
        const isLegendary = (coin.recentVotes || 0) >= 500 && !isUltraLegendary;
        
        // Determine total votes tier
        let totalVotesTier = '';
        let tierLabel = '';
        const totalVotes = coin.votes || 0;
        
        if (totalVotes >= 100000) {
            totalVotesTier = 'diamond-tier';
            tierLabel = 'DIAMOND';
        } else if (totalVotes >= 50000) {
            totalVotesTier = 'gold-tier';
            tierLabel = 'GOLD';
        } else if (totalVotes >= 25000) {
            totalVotesTier = 'silver-tier';
            tierLabel = 'SILVER';
        } else if (totalVotes >= 10000) {
            totalVotesTier = 'bronze-tier';
            tierLabel = 'BRONZE';
        }

        const tierClass = totalVotesTier || (isUltraLegendary ? 'ultra-legendary' : isLegendary ? 'legendary' : '');
        
        return `
            <div class="coin-card ${tierClass}">
                ${coin.image ? `<img src="${coin.image}" alt="${coin.name}" class="coin-image">` : ''}
                <div class="coin-name">${coin.name}</div>
                <div class="coin-address">${coin.contractAddress}</div>
                <div class="votes-count">
                    🔥 ${coin.votes || 0} total votes
                </div>
                ${tierLabel ? `<div class="tier-label">${tierLabel}</div>` : ''}
                <button onclick="vote('${coin.id}')" class="vote-btn">VOTE</button>
            </div>
        `;
    }).join('');

    // Check for any coins with 1000+ votes/min for ultra-legendary banner
    checkForHighVotes();
}

// Animate number like a slot machine
function animateNumber(element, start, end, duration = 1000) {
    const range = end - start;
    const increment = range / (duration / 16); // 60fps
    let current = start;
    
    const updateNumber = () => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            element.innerHTML = `🔥 ${end} total votes<br><span style="font-size: 0.9em; color: var(--accent)">(${end} in last minute)</span>`;
            return;
        }
        element.innerHTML = `🔥 ${Math.floor(current)} total votes<br><span style="font-size: 0.9em; color: var(--accent)">(${Math.floor(current)} in last minute)</span>`;
        requestAnimationFrame(updateNumber);
    };
    
    requestAnimationFrame(updateNumber);
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

        // Get current vote count before update
        const currentVotes = coins.find(c => String(c.id) === String(coinId))?.votes || 0;

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
            // Animate the vote count change
            animateNumber(votesCount, currentVotes, updatedCoin.votes || 0, 800);
            // Update leaderboards
            updateLeaderboards();
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
            <div style="display: flex; align-items: center; gap: 10px;">
                ${coin.image ? `<img src="${coin.image}" alt="${coin.name}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">` : ''}
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
            <div style="display: flex; align-items: center; gap: 10px;">
                ${coin.image ? `<img src="${coin.image}" alt="${coin.name}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">` : ''}
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

function checkForHighVotes() {
    const highVoteCoins = coins.filter(coin => (coin.recentVotes || 0) >= 1000);
    if (highVoteCoins.length > 0) {
        const banner = document.createElement('div');
        banner.className = 'promo-banner';
        banner.innerHTML = `🌈 ULTRA LEGENDARY: ${highVoteCoins[0].name} HIT ${highVoteCoins[0].recentVotes}+ VOTES! 🌈`;
        document.body.appendChild(banner);
        banner.style.display = 'block';
        
        setTimeout(() => {
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(-100%)';
            setTimeout(() => banner.remove(), 500);
        }, 5000);
    }
} 