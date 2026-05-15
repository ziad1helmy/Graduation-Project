import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.model.js';
import Activity from '../src/models/Activity.model.js';

async function run(email) {
  await connectDB();
  try {
    const user = await User.findOne({ email }).lean();
    if (!user) {
      console.error('User not found:', email);
      return process.exit(1);
    }

    const activities = await Activity.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
    console.log(`Activities for ${email} (count: ${activities.length}):`);
    activities.forEach((a) => {
      console.log('---');
      console.log(a.type, a.action, a.title);
      console.log('refType:', a.referenceType, 'refId:', a.referenceId);
      console.log('meta:', JSON.stringify(a.metadata));
    });
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

const email = process.argv[2] || 'aya.hassan@lifelink.demo';
run(email);
