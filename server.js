require('dotenv').config();
const express = require('express');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'exists' : 'missing');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');
const path = require('path');
const app = express();

const COINS_FILE = path.join(__dirname, 'coins.json');

// Initialize coins.json if it doesn't exist
if (!fs.existsSync(COINS_FILE)) {
    console.log('Creating new coins.json file');
    fs.writeFileSync(COINS_FILE, JSON.stringify([], null, 2));
}

// Read coins from file
function readCoins() {
    console.log('Reading coins from file');
    const data = JSON.parse(fs.readFileSync(COINS_FILE, 'utf8'));
    console.log('Current coins data:', data);
    return Array.isArray(data) ? data : (data.coins || []);
}

// Write coins to file
function writeCoins(coins) {
    console.log('Writing coins to file:', coins);
    fs.writeFileSync(COINS_FILE, JSON.stringify(coins, null, 2));
}

// Calculate recent votes (within last minute)
function calculateRecentVotes(timestamps) {
    const oneMinuteAgo = Date.now() - 60000;
    return timestamps.filter(time => time > oneMinuteAgo).length;
}

app.use(express.static('.'));
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Get all coins
app.get('/api/coins', (req, res) => {
    const coins = readCoins();
    // Calculate recent votes for each coin
    coins.forEach(coin => {
        if (!coin.voteTimestamps) coin.voteTimestamps = [];
        coin.recentVotes = calculateRecentVotes(coin.voteTimestamps);
    });
    res.json(coins);
});

// Add new coin
app.post('/api/coins', (req, res) => {
    console.log('Attempting to add new coin:', req.body);
    try {
        const coins = readCoins();
        const newCoin = {
            ...req.body,
            id: Date.now(),
            votes: 0,
            voteTimestamps: []
        };
        console.log('Created new coin object:', newCoin);
        coins.push(newCoin);
        writeCoins(coins);
        console.log('Successfully added coin');
        res.json(newCoin);
    } catch (error) {
        console.error('Error adding coin:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update votes
app.put('/api/coins/:id/vote', (req, res) => {
    const coins = readCoins();
    const coinId = parseInt(req.params.id);
    const coin = coins.find(c => c.id === coinId);
    
    if (!coin) {
        return res.status(404).json({ error: 'Coin not found' });
    }

    // Initialize vote timestamps if not exists
    if (!coin.voteTimestamps) {
        coin.voteTimestamps = [];
    }

    // Add new vote
    coin.votes = (coin.votes || 0) + 1;
    coin.voteTimestamps.push(Date.now());

    // Calculate recent votes
    coin.recentVotes = calculateRecentVotes(coin.voteTimestamps);

    // Clean up old timestamps (keep only last hour to prevent array from growing too large)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    coin.voteTimestamps = coin.voteTimestamps.filter(time => time > oneHourAgo);

    writeCoins(coins);
    res.json(coin);
});

// Update coin
app.put('/api/coins/:id', (req, res) => {
    const coins = readCoins();
    const coinId = parseInt(req.params.id);
    const coinIndex = coins.findIndex(c => c.id === coinId);
    
    if (coinIndex === -1) {
        return res.status(404).json({ error: 'Coin not found' });
    }

    coins[coinIndex] = {
        ...coins[coinIndex],
        ...req.body,
        id: coinId // Preserve the original ID
    };

    writeCoins(coins);
    res.json(coins[coinIndex]);
});

// Delete coin
app.delete('/api/coins/:id', (req, res) => {
    console.log('Attempting to delete coin:', req.params.id);
    const coins = readCoins();
    const coinId = parseInt(req.params.id);
    const coinIndex = coins.findIndex(c => c.id === coinId);
    
    if (coinIndex === -1) {
        return res.status(404).json({ error: 'Coin not found' });
    }

    coins.splice(coinIndex, 1);
    writeCoins(coins);
    res.json({ message: 'Coin deleted successfully' });
});

app.post('/create-payment-intent', async (req, res) => {
    try {
        console.log('Creating payment intent...');
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 10000, // $100.00
            currency: 'usd'
        });
        console.log('Payment intent created:', paymentIntent.id);

        res.send({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        console.error('Stripe error details:', {
            message: error.message,
            type: error.type,
            code: error.code
        });
        res.status(500).send({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
}); 