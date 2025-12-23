/**
 * local server entry file, for local development
 */
import app from './app.js';
import { startWatcher } from './services/csvWatcher.js';
import { notificationScheduler } from './services/notificationScheduler.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);

  // Start CSV file watcher for automatic imports
  startWatcher();

  // Start notification scheduler (cron jobs)
  notificationScheduler.start();
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;