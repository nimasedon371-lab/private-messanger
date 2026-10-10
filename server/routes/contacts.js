const express = require("express");
const pool = require("../db");

const router = express.Router();

// Get all users except the currently logged-in user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        full_name,
        email,
        profile_picture,
        bio,
        is_online,
        last_seen
      FROM users
      WHERE id != $1
      ORDER BY full_name ASC
      `,
      [userId]
    );

    res.json({
      message: "Contacts loaded successfully!",
      data: result.rows,
    });
  } catch (error) {
    console.error(
      "Get contacts error:",
      error
    );

    res.status(500).json({
      message: "Failed to load contacts",
      error: error.message,
    });
  }
});

module.exports = router;