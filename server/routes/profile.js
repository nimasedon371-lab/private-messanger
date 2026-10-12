const express = require("express");
const pool = require("../db");

const router = express.Router();

function getAuthenticatedUserId(req) {
  const userId = Number(req.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

router.get("/", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      message: "Authentication required. Please log in.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, full_name, email, profile_picture, bio
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("Load profile error:", error.message);
    return res.status(500).json({ message: "Failed to load profile" });
  }
});

router.patch("/", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      message: "Authentication required. Please log in.",
    });
  }

  const { full_name, bio, profile_picture } = req.body || {};

  if (
    typeof full_name !== "string" ||
    typeof bio !== "string" ||
    typeof profile_picture !== "string"
  ) {
    return res.status(400).json({
      message: "Name, bio, and profile picture URL are required",
    });
  }

  const cleanName = full_name.trim();
  const cleanBio = bio.trim();
  const cleanPicture = profile_picture.trim();

  if (cleanName.length < 1 || cleanName.length > 100) {
    return res.status(400).json({
      message: "Name must be between 1 and 100 characters",
    });
  }

  if (cleanBio.length > 500) {
    return res.status(400).json({
      message: "Bio must be 500 characters or fewer",
    });
  }

  if (cleanPicture.length > 2048) {
    return res.status(400).json({
      message: "Profile picture URL must be 2048 characters or fewer",
    });
  }

  if (cleanPicture) {
    try {
      const pictureUrl = new URL(cleanPicture);
      if (!["http:", "https:"].includes(pictureUrl.protocol)) {
        throw new Error("Unsupported URL protocol");
      }
    } catch {
      return res.status(400).json({
        message: "Enter a valid http or https profile picture URL",
      });
    }
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           bio = $2,
           profile_picture = $3
       WHERE id = $4
       RETURNING id, username, full_name, email, profile_picture, bio`,
      [cleanName, cleanBio || null, cleanPicture || null, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.json({
      message: "Profile updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

module.exports = router;
