const mongoose = require("mongoose");
const env = require("./env");

module.exports = async function connectDB() {
  if (!env.MONGO_URI) {
    console.warn("MONGO_URI is not set");
    return;
  }
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");
};