/**
 * MongoDB Helper for Stylist Pipeline
 * Provides connection setup and data access functions
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URL = process.env.MONGO_CONNECTION_STRING;

// ============================================================================
// CONNECTION SETUP
// ============================================================================

let isConnected = false;

/**
 * Connect to MongoDB with retry logic
 */
export async function connectMongoDB() {
    if (isConnected) {
        console.log('MongoDB already connected');
        return;
    }

    if (!MONGO_URL) {
        throw new Error('MONGO_URL environment variable is not set');
    }

    try {
        await mongoose.connect(MONGO_URL, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            retryWrites: true,
            retryReads: true,
        });

        isConnected = true;
        console.log('MongoDB connected successfully');

    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        throw error;
    }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectMongoDB() {
    if (!isConnected) return;

    await mongoose.connection.close();
    isConnected = false;
    console.log('MongoDB disconnected');
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
});

// ============================================================================
// DATA ACCESS FUNCTIONS
// ============================================================================

/**
 * Fetch body scan document for a user
 * @param {string} username - User email/username
 * @returns {Promise<Object|null>} - Body scan document or null
 */
export async function getBodyScan(username) {
    if (!isConnected) {
        await connectMongoDB();
    }

    const bodyscanCollection = mongoose.connection.collection('bodyscans');
    const bodyscanDoc = await bodyscanCollection.findOne({ username: username });

    return bodyscanDoc;
}

/**
 * Fetch body measurements for a user (extracts measurement fields from body scan)
 * @param {string} username - User email/username
 * @returns {Promise<Object|null>} - Body measurements object or null
 */
export async function getUserBodyMeasurements(username) {
    const bodyscanDoc = await getBodyScan(username);

    if (!bodyscanDoc) {
        return null;
    }

    // Extract the measurement fields needed for the pipeline
    return {
        chest_circumference: bodyscanDoc.chest_circumference,
        waist_circumference: bodyscanDoc.waist_circumference,
        hip_circumference: bodyscanDoc.hip_circumference,
        shoulder_breadth: bodyscanDoc.shoulder_breadth,
        neck_circumference: bodyscanDoc.neck_circumference,
        thigh_left_circumference: bodyscanDoc.thigh_left_circumference,
        ankle_left_circumference: bodyscanDoc.ankle_left_circumference,
        arm_right_length: bodyscanDoc.arm_right_length,
        inside_leg_height: bodyscanDoc.inside_leg_height,
        height: bodyscanDoc.height,
    };
}

// ============================================================================
// USER STYLING PROFILES
// ============================================================================

/**
 * Fetch user's styling profile (goals, preferences, body type overrides)
 * @param {string} username - User email/username
 * @returns {Promise<Object|null>} - Styling profile or null
 */
export async function getUserStylingProfile(username) {
    if (!isConnected) {
        await connectMongoDB();
    }

    const collection = mongoose.connection.collection('user_styling_profiles');
    const profile = await collection.findOne({ username: username });

    return profile;
}

/**
 * Save or update a user's styling profile
 * @param {string} username - User email/username
 * @param {Object} profile - Styling profile data (goals, preferences, etc.)
 * @returns {Promise<Object>} - Update result
 */
export async function saveUserStylingProfile(username, profile) {
    if (!isConnected) {
        await connectMongoDB();
    }

    const collection = mongoose.connection.collection('user_styling_profiles');
    const result = await collection.updateOne(
        { username: username },
        {
            $set: {
                ...profile,
                username: username,
                updated_at: new Date(),
            },
            $setOnInsert: {
                created_at: new Date(),
            },
        },
        { upsert: true }
    );

    return result;
}

// ============================================================================
// SCORING RESULTS
// ============================================================================

/**
 * Save a scoring result to MongoDB
 * @param {Object} result - Full scoring result to save
 * @returns {Promise<string>} - Inserted document ID
 */
export async function saveScoringResult(result) {
    if (!isConnected) {
        await connectMongoDB();
    }

    const collection = mongoose.connection.collection('scoring_results');
    const doc = {
        ...result,
        created_at: new Date(),
    };

    const insertResult = await collection.insertOne(doc);
    return insertResult.insertedId.toString();
}

/**
 * Fetch scoring history for a user
 * @param {string} username - User email/username
 * @param {number} limit - Max results to return (default 20)
 * @returns {Promise<Array>} - Array of scoring results, newest first
 */
export async function getUserScoringHistory(username, limit = 20) {
    if (!isConnected) {
        await connectMongoDB();
    }

    const collection = mongoose.connection.collection('scoring_results');
    const results = await collection
        .find({ username: username })
        .sort({ created_at: -1 })
        .limit(limit)
        .toArray();

    return results;
}

// ============================================================================
// CLI TESTING
// ============================================================================

async function main() {
    const testUser = 'vineeth@kridha.io';

    console.log(`\nFetching body scan for: ${testUser}\n`);

    try {
        await connectMongoDB();

        const bodyscan = await getBodyScan(testUser);

        if (bodyscan) {
            console.log('=== BODY SCAN DOCUMENT ===\n');
            console.log(JSON.stringify(bodyscan, null, 2));

            console.log('\n=== EXTRACTED MEASUREMENTS ===\n');
            const measurements = await getUserBodyMeasurements(testUser);
            console.log(JSON.stringify(measurements, null, 2));
        } else {
            console.log(`No body scan found for user: ${testUser}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await disconnectMongoDB();
    }
}

// Run if called directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main();
}
