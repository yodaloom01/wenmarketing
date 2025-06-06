require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
let stripe;

// Initialize Stripe only if key exists
if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('STRIPE_SECRET_KEY: exists');
} else {
    console.log('STRIPE_SECRET_KEY: missing - payment features will be disabled');
}

const app = express();

// Configure CORS to allow all origins temporarily
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());
app.use(express.static('.'));

const COINS_FILE = path.join('/data', 'coins.json');

// Ensure data directory exists
async function ensureDataDir() {
    const dataDir = path.join('/data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// Initialize coins.json if it doesn't exist
async function initCoinsFile() {
    try {
        await fs.access(COINS_FILE);
    } catch {
        await ensureDataDir();
        // Initial coins data
        const initialCoins = [
            {
                id: "1",
                name: "Popcat",
                contractAddress: "0x123...",
                isPaid: true,
                votes: 0,
                voteTimestamps: []
            },
            {
                id: "2",
                name: "Fartcoin",
                contractAddress: "0x456...",
                isPaid: true,
                votes: 0,
                voteTimestamps: []
            },
            {
                id: "3",
                name: "Joe Boden",
                contractAddress: "0x789...",
                isPaid: true,
                votes: 0,
                voteTimestamps: []
            }
        ];
        await fs.writeFile(COINS_FILE, JSON.stringify(initialCoins, null, 2));
        console.log('Created new coins.json file with initial data');
    }
}

// Read coins from file
async function readCoins() {
    try {
        await initCoinsFile();
        const data = await fs.readFile(COINS_FILE, 'utf8');
        let coins = JSON.parse(data);
        
        // Ensure all coins have string IDs
        coins = coins.map(coin => ({
            ...coin,
            id: String(coin.id)
        }));
        
        return coins;
    } catch (error) {
        console.error('Error reading coins:', error);
        return [];
    }
}

// Write coins to file
async function writeCoins(coins) {
    try {
        // Ensure all coins have string IDs before writing
        const coinsToWrite = coins.map(coin => ({
            ...coin,
            id: String(coin.id)
        }));
        await fs.writeFile(COINS_FILE, JSON.stringify(coinsToWrite, null, 2));
    } catch (error) {
        console.error('Error writing coins:', error);
        throw error;
    }
}

// Calculate recent votes (within last minute)
function calculateRecentVotes(timestamps) {
    const oneMinuteAgo = Date.now() - 60000;
    return timestamps.filter(time => time > oneMinuteAgo).length;
}

// Get all coins
app.get('/api/coins', async (req, res) => {
    try {
        const coins = await readCoins();
        // If includeAll is true, return all coins, otherwise filter out unpaid ones
        const coinsToReturn = req.query.includeAll === 'true' ? coins : coins.filter(coin => coin.isPaid !== false);
        
        coinsToReturn.forEach(coin => {
            if (!coin.voteTimestamps) coin.voteTimestamps = [];
            coin.recentVotes = calculateRecentVotes(coin.voteTimestamps);
        });
        res.json(coinsToReturn);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch coins' });
    }
});

// Get single coin by ID
app.get('/api/coins/:id', async (req, res) => {
    try {
        const coins = await readCoins();
        const id = req.params.id;
        console.log('Fetching coin with ID:', id); // Debug log
        console.log('Available coins:', coins); // Debug log
        const coin = coins.find(c => String(c.id) === String(id));
        if (!coin) {
            console.log('Coin not found for ID:', id); // Debug log
            return res.status(404).json({ error: `Coin not found with ID: ${id}` });
        }
        console.log('Found coin:', coin); // Debug log
        res.json(coin);
    } catch (error) {
        console.error('Server error:', error); // Debug log
        res.status(500).json({ error: 'Failed to fetch coin' });
    }
});

// Add new coin
app.post('/api/coins', async (req, res) => {
    try {
        const coins = await readCoins();
        // Generate a simple incremental ID
        const maxId = coins.reduce((max, coin) => {
            const coinId = parseInt(coin.id);
            return coinId > max ? coinId : max;
        }, 0);
        
        const newCoin = {
            ...req.body,
            id: String(maxId + 1),
            votes: 0,
            voteTimestamps: []
        };
        coins.push(newCoin);
        await writeCoins(coins);
        res.json(newCoin);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add coin' });
    }
});

// Update votes
app.put('/api/coins/:id/vote', async (req, res) => {
    try {
        const coins = await readCoins();
        const id = req.params.id;
        console.log('Voting for coin with ID:', id); // Debug log
        const coin = coins.find(c => String(c.id) === String(id));
        if (!coin) {
            console.log('Coin not found for voting:', id); // Debug log
            return res.status(404).json({ error: 'Coin not found' });
        }
        coin.votes = (coin.votes || 0) + 1;
        coin.voteTimestamps = coin.voteTimestamps || [];
        coin.voteTimestamps.push(Date.now());
        console.log('Updated coin:', coin); // Debug log
        await writeCoins(coins);
        res.json(coin);
    } catch (error) {
        console.error('Vote update error:', error); // Debug log
        res.status(500).json({ error: 'Failed to update votes' });
    }
});

// Update coin
app.put('/api/coins/:id', async (req, res) => {
    try {
        const coins = await readCoins();
        const id = req.params.id;
        const index = coins.findIndex(c => String(c.id) === String(id));
        if (index === -1) {
            return res.status(404).json({ error: 'Coin not found' });
        }
        coins[index] = { ...coins[index], ...req.body, id: coins[index].id };
        await writeCoins(coins);
        res.json(coins[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update coin' });
    }
});

// Delete coin
app.delete('/api/coins/:id', async (req, res) => {
    try {
        const coins = await readCoins();
        const id = req.params.id;
        const filteredCoins = coins.filter(c => String(c.id) !== String(id));
        await writeCoins(filteredCoins);
        res.json({ message: 'Coin deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete coin' });
    }
});

// Create payment intent (requires Stripe)
app.post('/create-payment-intent', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Payment service unavailable - Stripe key not configured' });
    }
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 10000, // $100 in cents
            currency: 'usd'
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Ensure data directory exists on startup
    ensureDataDir().then(() => {
        console.log('Data directory ready');
        initCoinsFile().catch(console.error);
    }).catch(err => {
        console.error('Failed to create data directory:', err);
    });
}); 