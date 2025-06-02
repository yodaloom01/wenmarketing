// DOM Elements
const addCoinBtn = document.getElementById('addCoinBtn');
const addCoinModal = document.getElementById('addCoinModal');
const closeBtn = document.querySelector('.close-btn');
const addCoinForm = document.getElementById('addCoinForm');
const coinList = document.getElementById('coinList');
const leaderboardList = document.getElementById('leaderboardList');
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
document.getElementById('addCoinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = {
        coinName: document.getElementById('coinName').value,
        contractAddress: document.getElementById('contractAddress').value,
        description: document.getElementById('description').value
    };

    // Get image file
    const imageFile = document.getElementById('coinImage').files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        // Resize image before sending
        const img = new Image();
        img.onload = async function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions to keep aspect ratio
            if (width > height) {
                if (width > 800) {
                    height *= 800 / width;
                    width = 800;
                }
            } else {
                if (height > 800) {
                    width *= 800 / height;
                    height = 800;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get resized image as data URL with reduced quality
            const resizedImageUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            try {
                console.log("Attempting to send email with data:", formData);

                // Send email using EmailJS
                const response = await emailjs.send(
                    "service_yr1se2k",
                    "template_h7svgsi",
                    {
                        from_name: formData.coinName,
                        to_name: "Admin",
                        message: `
Coin Name: ${formData.coinName}
Contract Address: ${formData.contractAddress}
Description: ${formData.description}`,
                        reply_to: "wenmarketing2025@gmail.com",
                        image_url: resizedImageUrl
                    }
                );
                
                console.log("Email sent successfully", response);
                // Show success message
                alert('Thank you! Your coin submission has been sent for review. Once approved, it will appear on the site.');
                
                // Reset form and close modal
                document.getElementById('addCoinForm').reset();
                addCoinModal.classList.remove('active');
            } catch (error) {
                console.error("Email sending failed:", error);
                alert('There was an error submitting your coin. Please try again.');
            }
        };
        img.src = e.target.result;
    };

    if (imageFile) {
        reader.readAsDataURL(imageFile);
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

// Initialize the display
updateCoinList();
updateLeaderboard(); 