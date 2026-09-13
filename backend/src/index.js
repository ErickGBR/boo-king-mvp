import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import businessRoutes from './routes/businesses.js';
import appointmentRoutes from './routes/appointments.js';
import bookingRoutes from './routes/booking.js';
import calendarRoutes from './routes/calendar.js';
import categoriesRoutes from './routes/categories.js';
import reportsRoutes from './routes/reports.js';
import staffRoutes from './routes/staff.js';
import googleRoutes from './routes/google.js';
import ticketsRoutes from './routes/tickets.js';
import servicesRoutes from './routes/services.js';

const app = express();
const PORT = process.env.PORT || 4000;

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});

const ticketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});

app.use('/api/auth', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/booking', bookingLimiter, bookingRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/tickets', ticketLimiter, ticketsRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

const isProduction = process.env.NODE_ENV === 'production';
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
if (isProduction) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Global error middleware — every async handler is wrapped with asyncHandler
// (src/middleware/asyncHandler.js), so ANY rejection lands here instead of
// crashing the process (QA finding CRÍTICO). The full error is logged
// server-side, but internal details are never leaked to the client: 5xx
// responses are generic; only explicit 4xx errors (err.status) set by our own
// handlers expose their message.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
