const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const routes = require("./routes");
const { API_PREFIX } = require("./utils/paths");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/healthz", (_req, res) => res.send("ok"));
app.use(API_PREFIX, routes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

module.exports = app;
