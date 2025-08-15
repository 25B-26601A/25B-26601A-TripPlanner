const { Router } = require("express");
const auth = require("./auth");
const trips = require("./trips");
const route = require("./route");
const images = require("./images");

const router = Router();

router.get("/ping", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

router.use("/auth", auth);
router.use("/trips", trips);
router.use("/route", route);
router.use("/images", images);

module.exports = router;
