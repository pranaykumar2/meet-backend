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

// Create a new group
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Group name is required' });
        }

        const [result] = await pool.query(
            'INSERT INTO `groups` (name, description, created_by) VALUES (?, ?, ?)',
            [name, description || null, req.user.id]
        );

        // Add creator as an admin member of the group
        await pool.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [result.insertId, req.user.id, 'admin']
        );

        res.status(201).json({
            id: result.insertId,
            name,
            description,
            created_by: req.user.id
        });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ message: 'Failed to create group' });
    }
});

// Get all groups for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT g.* 
             FROM \`groups\` g
             JOIN group_members gm ON g.id = gm.group_id
             WHERE gm.user_id = ?`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ message: 'Failed to fetch groups' });
    }
});

// Get a specific group by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // First check if user is a member of this group
        const [membership] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (membership.length === 0) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const [rows] = await pool.query(
            'SELECT * FROM `groups` WHERE id = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Group not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ message: 'Failed to fetch group details' });
    }
});

// Update a group (only accessible to group creator or admin)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if user has admin rights on this group
        const [groupAdmin] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?',
            [req.params.id, req.user.id, 'admin']
        );

        if (groupAdmin.length === 0) {
            return res.status(403).json({ message: 'You do not have permission to update this group' });
        }

        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Group name is required' });
        }

        await pool.query(
            'UPDATE `groups` SET name = ?, description = ? WHERE id = ?',
            [name, description || null, req.params.id]
        );

        res.json({ message: 'Group updated successfully' });
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ message: 'Failed to update group' });
    }
});

// Delete a group (only accessible to group creator)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if the group exists and was created by the current user
        const [group] = await pool.query(
            'SELECT * FROM `groups` WHERE id = ? AND created_by = ?',
            [req.params.id, req.user.id]
        );

        if (group.length === 0) {
            return res.status(403).json({ message: 'You do not have permission to delete this group' });
        }

        // Delete the group (cascade will delete memberships)
        await pool.query('DELETE FROM `groups` WHERE id = ?', [req.params.id]);

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ message: 'Failed to delete group' });
    }
});

// Group member management endpoints
// Add a member to a group
router.post('/:id/members', authenticateToken, async (req, res) => {
    try {
        const { user_id, role } = req.body;

        if (!user_id) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Check if user has admin rights on this group
        const [groupAdmin] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?',
            [req.params.id, req.user.id, 'admin']
        );

        if (groupAdmin.length === 0) {
            return res.status(403).json({ message: 'You do not have permission to add members to this group' });
        }

        // Check if user exists
        const [userExists] = await pool.query(
            'SELECT * FROM users WHERE id = ?',
            [user_id]
        );

        if (userExists.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is already a member
        const [existingMember] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [req.params.id, user_id]
        );

        if (existingMember.length > 0) {
            return res.status(409).json({ message: 'User is already a member of this group' });
        }

        // Add user to group
        await pool.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [req.params.id, user_id, role || 'member']
        );

        res.status(201).json({ message: 'Member added successfully' });
    } catch (error) {
        console.error('Error adding group member:', error);
        res.status(500).json({ message: 'Failed to add member to group' });
    }
});

// Get all members of a group
router.get('/:id/members', authenticateToken, async (req, res) => {
    try {
        // Check if user is a member of this group
        const [membership] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (membership.length === 0) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const [rows] = await pool.query(
            `SELECT u.id, u.username, u.email, gm.role, gm.joined_at 
             FROM users u
             JOIN group_members gm ON u.id = gm.user_id
             WHERE gm.group_id = ?`,
            [req.params.id]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching group members:', error);
        res.status(500).json({ message: 'Failed to fetch group members' });
    }
});

// Remove a member from a group
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
    try {
        // Check if user has admin rights on this group
        const [groupAdmin] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?',
            [req.params.id, req.user.id, 'admin']
        );

        // Allow users to remove themselves
        const isSelfRemoval = parseInt(req.params.userId) === req.user.id;

        if (!isSelfRemoval && groupAdmin.length === 0) {
            return res.status(403).json({ message: 'You do not have permission to remove members from this group' });
        }

        await pool.query(
            'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
            [req.params.id, req.params.userId]
        );

        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing group member:', error);
        res.status(500).json({ message: 'Failed to remove member from group' });
    }
});

// Update a member's role in a group
router.put('/:id/members/:userId', authenticateToken, async (req, res) => {
    try {
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({ message: 'Role is required' });
        }

        // Check if user has admin rights on this group
        const [groupAdmin] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?',
            [req.params.id, req.user.id, 'admin']
        );

        if (groupAdmin.length === 0) {
            return res.status(403).json({ message: 'You do not have permission to update member roles in this group' });
        }

        await pool.query(
            'UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?',
            [role, req.params.id, req.params.userId]
        );

        res.json({ message: 'Member role updated successfully' });
    } catch (error) {
        console.error('Error updating member role:', error);
        res.status(500).json({ message: 'Failed to update member role' });
    }
});

module.exports = router;
