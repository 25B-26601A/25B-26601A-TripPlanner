const { Router } = require("express");
const auth = require("../middleware/auth");
const svc = require("../services/tripService");

const router = Router();

router.get("/", auth, svc.listTrips);
router.post("/", auth, svc.createTrip);
router.post("/ai", svc.aiPlan);
router.get("/:id", auth, svc.getTrip);
router.patch("/:id", auth, svc.updateTrip);
router.delete("/:id", auth, svc.deleteTrip);

module.exports = router;
