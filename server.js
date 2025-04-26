require('dotenv').config();
const express = require('express');

const app = express();


app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const meetingRoutes = require('./routes/meetings');
const userRoutes = require('./routes/users');

app.use('/api', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
