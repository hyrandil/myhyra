import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { PORT } from './config';
import authRoutes from './routes/authRoutes';
import bookingRoutes from './routes/bookingRoutes';
import userRoutes from './routes/userRoutes';
import absenceRoutes from './routes/absenceRoutes';
import reportRoutes from './routes/reportRoutes';
import timeRoutes from './routes/timeRoutes';
import departmentRoutes from './routes/departmentRoutes';
import './db';

const app = express();
app.use(cors());
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

app.listen(PORT, () => {
  console.log(`API läuft auf Port ${PORT}`);
});
