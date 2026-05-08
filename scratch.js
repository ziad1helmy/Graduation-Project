import { connect, closeDatabase } from './tests/helpers/db.js';
import * as authService from './src/services/auth.service.js';
import User from './src/models/User.model.js';

async function run() {
  await connect();
  const email = 'test@example.com';
  
  // create dummy user
  const user = await User.create({
    fullName: 'Test User',
    email,
    password: 'Password123!',
    role: 'donor'
  });
  
  const otp = user.createEmailVerificationOtp();
  await user.save({ validateBeforeSave: false });

  try {
    await authService.verifyEmailOtp({ email, otp });
    console.log('SUCCESS');
  } catch (err) {
    console.error('ERROR:', err);
  }

  await closeDatabase();
}

run().catch(console.error);
