const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;

// Registration route (no change from before)
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email)
        return res.status(400).json({ message: 'All fields required' });

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length > 0)
        return res.status(400).json({ message: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, hashedPassword, email]
    );
    res.json({ message: 'User registered successfully' });
});

// Login route (return JWT)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ message: 'All fields required' });

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0)
        return res.status(400).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
        return res.status(400).json({ message: 'Invalid credentials' });

    // Generate JWT
    const token = jwt.sign({
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin
    }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin } });
});

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Admin middleware
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) return res.sendStatus(403);
    next();
}

// Anyone can : List users
router.get('/users', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(
            'SELECT id, username FROM users ORDER BY username LIMIT ? OFFSET ?',
            [limit, offset]
        );

        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');
        const totalCount = countResult[0].total;

        res.json({
            users: rows,
            pagination: {
                total: totalCount,
                page,
                limit,
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

module.exports = router;
