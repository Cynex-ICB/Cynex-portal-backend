import mongoose from "mongoose";
import User from "../models/User.js";

async function ensureUserIndexes() {
  try {
    const indexes = await User.collection.indexes();
    const hasLegacyEmailIndex = indexes.some((index) => index.name === "email_1");

    if (hasLegacyEmailIndex) {
      await User.collection.dropIndex("email_1");
      console.log("Dropped legacy users.email index");
    }

    await User.collection.createIndex(
      { collegeEmail: 1 },
      { unique: true, name: "collegeEmail_1" }
    );
  } catch (error) {
    console.warn("Could not verify user indexes:", error.message);
  }
}

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing. Add it to your .env file.");
  }

  await mongoose.connect(mongoUri);
  await ensureUserIndexes();
  console.log("MongoDB connected");
}

export default connectDB;
