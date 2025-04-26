const express = require('express');
const router = express.Router();
const pool = require('../db');
const crypto = require('crypto');

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

// Generate a unique room code
function generateRoomCode() {
    return crypto.randomBytes(4).toString('hex');
}

// Create a new meeting
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, description, meeting_time, duration_minutes, group_id } = req.body;

        if (!title || !meeting_time) {
            return res.status(400).json({ message: 'Title and meeting time are required' });
        }

        // If group_id provided, verify user is a member of that group
        if (group_id) {
            const [membership] = await pool.query(
                'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                [group_id, req.user.id]
            );

            if (membership.length === 0) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
        }

        const room_code = generateRoomCode();

        const [result] = await pool.query(
            'INSERT INTO meetings (title, description, meeting_time, duration_minutes, created_by, group_id, room_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, description || null, meeting_time, duration_minutes || 60, req.user.id, group_id || null, room_code]
        );

        res.status(201).json({
            id: result.insertId,
            title,
            description,
            meeting_time,
            duration_minutes: duration_minutes || 60,
            created_by: req.user.id,
            group_id: group_id || null,
            room_code
        });
    } catch (error) {
        console.error('Error creating meeting:', error);
        res.status(500).json({ message: 'Failed to create meeting' });
    }
});

// Get all meetings for logged-in user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT m.* 
             FROM meetings m
             LEFT JOIN group_members gm ON m.group_id = gm.group_id
             WHERE m.created_by = ? OR (gm.user_id = ? AND m.group_id IS NOT NULL)
             GROUP BY m.id
             ORDER BY m.meeting_time`,
            [req.user.id, req.user.id]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ message: 'Failed to fetch meetings' });
    }
});

// Get meetings for a specific group
router.get('/group/:groupId', authenticateToken, async (req, res) => {
    try {
        // Check if user is a member of this group
        const [membership] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [req.params.groupId, req.user.id]
        );

        if (membership.length === 0) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const [rows] = await pool.query(
            'SELECT * FROM meetings WHERE group_id = ? ORDER BY meeting_time',
            [req.params.groupId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching group meetings:', error);
        res.status(500).json({ message: 'Failed to fetch group meetings' });
    }
});

// Get a specific meeting
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT m.* 
             FROM meetings m
             LEFT JOIN group_members gm ON m.group_id = gm.group_id
             WHERE m.id = ? AND (m.created_by = ? OR (gm.user_id = ? AND m.group_id IS NOT NULL))`,
            [req.params.id, req.user.id, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Meeting not found or you do not have access' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching meeting:', error);
        res.status(500).json({ message: 'Failed to fetch meeting details' });
    }
});

// Update a meeting
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if the meeting exists and was created by the current user
        const [meeting] = await pool.query(
            'SELECT * FROM meetings WHERE id = ?',
            [req.params.id]
        );

        if (meeting.length === 0) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        if (meeting[0].created_by !== req.user.id) {
            return res.status(403).json({ message: 'You do not have permission to update this meeting' });
        }

        const { title, description, meeting_time, duration_minutes } = req.body;

        if (!title || !meeting_time) {
            return res.status(400).json({ message: 'Title and meeting time are required' });
        }

        await pool.query(
            'UPDATE meetings SET title = ?, description = ?, meeting_time = ?, duration_minutes = ? WHERE id = ?',
            [title, description || null, meeting_time, duration_minutes || 60, req.params.id]
        );

        res.json({ message: 'Meeting updated successfully' });
    } catch (error) {
        console.error('Error updating meeting:', error);
        res.status(500).json({ message: 'Failed to update meeting' });
    }
});

// Delete a meeting
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if the meeting exists and was created by the current user
        const [meeting] = await pool.query(
            'SELECT * FROM meetings WHERE id = ? AND created_by = ?',
            [req.params.id, req.user.id]
        );

        if (meeting.length === 0) {
            return res.status(403).json({ message: 'You do not have permission to delete this meeting' });
        }

        await pool.query('DELETE FROM meetings WHERE id = ?', [req.params.id]);

        res.json({ message: 'Meeting deleted successfully' });
    } catch (error) {
        console.error('Error deleting meeting:', error);
        res.status(500).json({ message: 'Failed to delete meeting' });
    }
});

module.exports = router;
