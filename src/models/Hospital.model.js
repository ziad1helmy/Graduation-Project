import mongoose from 'mongoose';
import User from './User.model.js'

const hospitalSchema = new mongoose.Schema({
    hospitalName: {
        type: String,
        required: true,
    },

    // Is licenc number and hospital ID are the same??
    hospitalId: {
        type: Number,
        required: true,
    },

    licenseNumber: {
        type: String,
        required: true,
    },

    // Hospital display address (city, governorate for rendering).
    // Geo-matching uses the shared `location` field on the base User schema.
    address: {
        city: String,
        governorate: String, // was: governrate (typo fixed)
    },

    contactNumber: String,
})

const Hospital = User.discriminator('hospital', hospitalSchema);

export default Hospital;