import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { databaseRouter } from './routes/database.routes.js';
import { excelRouter } from './routes/excel.routes.js';
import { exportDimensionRouter } from './routes/export-dimension.routes.js';
import { historyRouter } from './routes/history.routes.js';
import { inspectionQueueRouter } from './routes/inspection-queue.routes.js';
import { lotRouter } from './routes/lot.routes.js';
import { reportExportRouter } from './routes/report-export.routes.js';
import { resultsRouter } from './routes/results.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { summaryRouter } from './routes/summary.routes.js';
import { userRouter } from './routes/user.routes.js';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonBodyLimit = '1mb';
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

export const app = express();

const allowedCorsOrigins = new Set(env.corsOrigins);

app.use((req, res, next) => {
  Object.entries(securityHeaders).forEach(([headerName, headerValue]) => {
    res.setHeader(headerName, headerValue);
  });
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  }
}));
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

const clientPath = path.join(__dirname, '../..', 'client');
app.use(express.static(clientPath, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'BrakeCheck API is ready'
  });
});

app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/database', databaseRouter);
app.use('/api/excel', excelRouter);
app.use('/api/export-dimension', exportDimensionRouter);
app.use('/api/history', historyRouter);
app.use('/api/inspection-queues', inspectionQueueRouter);
app.use('/api/lots', lotRouter);
app.use('/api/reports/export', reportExportRouter);
app.use('/api/results', resultsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/users', userRouter);

app.use('/api', (req, res) => {
  res.status(404).json({
    ok: false,
    message: 'ไม่พบ API ที่เรียกใช้งาน'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

app.use(errorMiddleware);
