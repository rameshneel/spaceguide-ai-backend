import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/spaceguide-ai-backend";

    // Connection options for production readiness
    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    const conn = await mongoose.connect(mongoURI, options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    logger.info(`Database: ${conn.connection.name}`);

    // Handle connection events for better monitoring
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });
  } catch (error) {
    logger.error("Database connection failed:", error);
    logger.error("Please ensure MongoDB is running and MONGODB_URI is correct");
    process.exit(1);
  }
};

export default connectDB;
