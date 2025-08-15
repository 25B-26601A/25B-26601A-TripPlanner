const mongoose = require("mongoose");

const CreditSchema = new mongoose.Schema({
  provider: String,
  author: String,
  username: String,
  link: String,
  source: String,
}, { _id: false });

const ImageSchema = new mongoose.Schema({
  src: { type: String, required: true },
  alt: String,
  credit: { type: CreditSchema, default: null },
}, { _id: false });

const MapPointSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, default: null },
  lon: { type: Number, default: null },
}, { _id: false });

const DestinationSchema = new mongoose.Schema({
  name: String,
  city: String,
  country: String,
  lat: Number,
  lon: Number,
}, { _id: false });

const OvernightSchema = new mongoose.Schema({
  city: String,
  lodging_suggestion: String,
}, { _id: false });

const DaySchema = new mongoose.Schema({
  day: Number,
  distance_km: Number,
  start: String,
  end: String,
  waypoints: [String],
  overnight: { type: OvernightSchema, default: null },
  highlights: [String],
}, { _id: false });

const PlaceDescriptionSchema = new mongoose.Schema({
  name: String,
  summary: String,
  lang: String,
  url: String,
}, { _id: false });

const TripSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  notes: { type: String, default: "" },
  mode: { type: String, enum: ["bike", "walk"], required: true },
  summary: { type: String, required: true, trim: true, maxlength: 200 },
  destination: { type: DestinationSchema, required: true },
  image: { type: ImageSchema, default: null },
  total_distance_km: { type: Number, default: null },
  days: { type: [DaySchema], default: [] },
  map_points: { type: [MapPointSchema], default: [] },
  place_descriptions: { type: [PlaceDescriptionSchema], default: [] },
  route: {
    geojson: { type: Object, default: null },
    distance_km: { type: Number, default: null },
    duration_min: { type: Number, default: null },
    profile: { type: String, default: null },
  },
  idem_key: { type: String, index: { unique: true, sparse: true } }
}, { timestamps: true });

module.exports = mongoose.model("Trip", TripSchema);
