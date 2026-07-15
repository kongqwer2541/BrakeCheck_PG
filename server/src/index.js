import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.appPort, () => {
  console.log(`${env.appName} server is running on http://localhost:${env.appPort}`);
});
