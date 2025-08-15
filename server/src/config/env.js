require("dotenv").config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 5050),
  MONGO_URI: process.env.MONGO_URI || "",
  OSRM_URL: process.env.OSRM_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  PEXELS_KEY: process.env.PEXELS_KEY || "",
  UNSPLASH_KEY: process.env.UNSPLASH_KEY || "",
  GROQ_KEY: process.env.GROQ_KEY || ""
};