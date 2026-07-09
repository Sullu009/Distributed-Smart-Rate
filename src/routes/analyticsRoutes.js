const express = require("express");
const router = express.Router();

const { getAnalytics } = require("../controllers/analyticsController");
const authMiddleware = require("../middleware/authMiddleware");

// Analytics Route
router.get("/", authMiddleware, getAnalytics);

module.exports = router;