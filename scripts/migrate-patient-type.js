import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Request from '../src/models/Request.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lifelink';

async function migratePatientTypeAndCause() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const requests = await Request.find({}).lean();
    console.log(`Found ${requests.length} requests to review.`);

    let updatedCount = 0;

    for (const req of requests) {
      const updates = {};
      let needsUpdate = false;

      // Define default mapping
      const validEnums = [
        'surgery',
        'cardiac_surgery',
        'accident',
        'burns',
        'cancer',
        'leukemia',
        'maternity',
        'chronic_illness',
        'hemophilia',
        'thalassemia',
        'dialysis',
        'gastrointestinal_bleeding',
        'organ_transplant',
        'pediatric',
        'emergency',
        'general',
      ];

      const normalizeToEnum = (val) => {
        if (!val) return 'general';
        const lower = String(val).toLowerCase();
        if (lower.includes('surgery')) {
          if (lower.includes('cardiac') || lower.includes('heart')) return 'cardiac_surgery';
          return 'surgery';
        }
        if (lower.includes('burn')) return 'burns';
        if (lower.includes('accident') || lower.includes('trauma')) return 'accident';
        if (lower.includes('leukemia')) return 'leukemia';
        if (lower.includes('cancer') || lower.includes('oncology')) return 'cancer';
        if (lower.includes('maternity') || lower.includes('birth') || lower.includes('pregnancy')) return 'maternity';
        if (lower.includes('hemophilia')) return 'hemophilia';
        if (lower.includes('thalassemia')) return 'thalassemia';
        if (lower.includes('chronic') || lower.includes('anemia') || lower.includes('sickle')) return 'chronic_illness';
        if (lower.includes('dialysis') || lower.includes('kidney')) return 'dialysis';
        if (lower.includes('gastro') || lower.includes('gi') || lower.includes('bleeding')) return 'gastrointestinal_bleeding';
        if (lower.includes('transplant') || lower.includes('organ')) return 'organ_transplant';
        if (lower.includes('pediatric') || lower.includes('child')) return 'pediatric';
        if (lower.includes('emergency') || lower.includes('icu') || lower.includes('urgent')) return 'emergency';
        return 'general';
      };

      if (!validEnums.includes(req.patientType)) {
        updates.patientType = normalizeToEnum(req.patientType || req.cause);
        needsUpdate = true;
      }

      if (!validEnums.includes(req.cause)) {
        updates.cause = normalizeToEnum(req.cause || req.patientType);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Request.updateOne({ _id: req._id }, { $set: updates });
        updatedCount++;
      }
    }

    console.log(`Migration completed successfully. Updated ${updatedCount} requests.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migratePatientTypeAndCause();
