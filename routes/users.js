const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Auth middleware (reused from your auth.js)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// Search users
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.length < 3) {
            return res.status(400).json({ message: 'Search query must be at least 3 characters' });
        }

        const [rows] = await pool.query(
            `SELECT id, username, email 
             FROM users 
             WHERE username LIKE ? OR email LIKE ?
             LIMIT 20`,
            [`%${query}%`, `%${query}%`]
        );

        // Don't send back the current user in results
        const filteredResults = rows.filter(user => user.id !== req.user.id);

        res.json(filteredResults);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Failed to search users' });
    }
});

module.exports = router;
