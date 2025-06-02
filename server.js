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

app.use(express.static('.'));
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    next();
});

// Get all coins
app.get('/api/coins', (req, res) => {
    const coins = readCoins();
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
            votes: 0
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

// Update votes
app.put('/api/coins/:id/vote', (req, res) => {
    const coins = readCoins();
    const coinId = parseInt(req.params.id);
    const coin = coins.find(c => c.id === coinId);
    
    if (!coin) {
        return res.status(404).json({ error: 'Coin not found' });
    }

    coin.votes = (coin.votes || 0) + 1;
    writeCoins(coins);
    res.json(coin);
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