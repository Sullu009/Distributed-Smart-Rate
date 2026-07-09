const User = require("../models/User");

const getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    const freeUsers = await User.countDocuments({
      role: "FREE",
    });

    const premiumUsers = await User.countDocuments({
      role: "PREMIUM",
    });

    const adminUsers = await User.countDocuments({
      role: "ADMIN",
    });

    res.status(200).json({
      success: true,
      analytics: {
        totalUsers,
        freeUsers,
        premiumUsers,
        adminUsers,
      },
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  getAnalytics,
};