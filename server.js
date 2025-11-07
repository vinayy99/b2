// backend/src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './database/config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import skillSwapRoutes from './routes/skillSwaps.js';
import applicationRoutes from './routes/applications.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Allow only frontend origin
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// DB check
testConnection();

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'CollabMate backend running',
    timestamp: new Date(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/skill-swaps', skillSwapRoutes);
app.use('/api', applicationRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

export default app;
