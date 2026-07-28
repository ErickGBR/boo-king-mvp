import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import businessRoutes from './routes/businesses.js';
import appointmentRoutes from './routes/appointments.js';
import bookingRoutes from './routes/booking.js';
import calendarRoutes from './routes/calendar.js';
import categoriesRoutes from './routes/categories.js';
import reportsRoutes from './routes/reports.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/reports', reportsRoutes);

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
