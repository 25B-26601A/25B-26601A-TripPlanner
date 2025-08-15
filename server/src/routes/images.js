const { Router } = require("express");
const imageService = require("../services/imageService");

const router = Router();

router.get("/", (req, res) => imageService.getImage(req, res));

module.exports = router;
