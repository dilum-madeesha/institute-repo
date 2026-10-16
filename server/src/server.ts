import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ENV } from './config/env';
import { connectDB } from './config/db';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import { startNotificationWorker } from './services/notificationWorker';
import { initEmailTransporter } from './services/emailService';
import { startAttendanceWindowWorker } from './services/attendanceWindow';

const app = express();

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
  })
);

app.use(generalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Institute Class LMS API',
  });
});

// API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  await initEmailTransporter();
  startNotificationWorker();
  startAttendanceWindowWorker();

  app.listen(ENV.PORT, () => {
    console.log(`[Server] Institute LMS Server running on http://localhost:${ENV.PORT} in ${ENV.NODE_ENV} mode`);
  });
};

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});

export default app;
