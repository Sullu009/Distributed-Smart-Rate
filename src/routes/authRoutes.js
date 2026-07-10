const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getProfile,
  changeRole,
} = require("../controllers/authController");
router.patch("/change-role", changeRole);

const authMiddleware = require("../middleware/authMiddleware");

// Public Routes
router.post("/register", register);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: sultan2@gmail.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */
router.post("/login", login);

// Protected Route
router.get("/profile", authMiddleware, getProfile);

module.exports = router;