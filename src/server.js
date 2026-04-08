import app from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectDB } from './config/db.js';

validateEnv();
await connectDB();

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  console.log('Swagger docs available at /api-docs');
});
