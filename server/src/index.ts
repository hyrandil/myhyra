import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import { PORT, SESSION_SECRET, WEB_ORIGINS } from './config';
import authRoutes from './routes/authRoutes';
import bookingRoutes from './routes/bookingRoutes';
import userRoutes from './routes/userRoutes';
import absenceRoutes from './routes/absenceRoutes';
import reportRoutes from './routes/reportRoutes';
import timeRoutes from './routes/timeRoutes';
import departmentRoutes from './routes/departmentRoutes';
import holidayRoutes from './routes/holidayRoutes';
import './db';

const app = express();
app.set('trust proxy', 1);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (WEB_ORIGINS.includes(origin)) return callback(null, true);
      // Allow common dev hosts on port 5173 (e.g., LAN IPs)
      if (/^https?:\/\/[^:]+:5173$/.test(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(
  session({
    name: 'sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(bodyParser.json());

app.get('/', (_req, res) => {
  res.json({
    name: 'MyHyra Time Tracking API',
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/holidays', holidayRoutes);

app.listen(PORT, () => {
  console.log(`API läuft auf Port ${PORT}`);
});
