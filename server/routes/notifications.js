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
      `SELECT
         n.id,
         n.sender_id,
         n.conversation_id,
         n.message_id,
         n.notification_type,
         n.content,
         n.is_read,
         n.created_at,
         u.username AS sender_username,
         u.full_name AS sender_name,
         u.profile_picture AS sender_profile_picture
       FROM notifications n
       LEFT JOIN users u ON u.id = n.sender_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 100`,
      [userId]
    );

    const unreadResult = await pool.query(
      `SELECT COUNT(*)::integer AS unread_count
       FROM notifications
       WHERE user_id = $1
         AND is_read = FALSE`,
      [userId]
    );

    return res.json({
      data: result.rows,
      unread_count: unreadResult.rows[0].unread_count,
    });
  } catch (error) {
    console.error("Load notifications error:", error.message);
    return res.status(500).json({
      message: "Failed to load notifications",
    });
  }
});

router.patch("/read-all", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      message: "Authentication required. Please log in.",
    });
  }

  try {
    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1
         AND is_read = FALSE`,
      [userId]
    );

    return res.json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error.message);
    return res.status(500).json({
      message: "Failed to mark notifications as read",
    });
  }
});

router.patch("/:notificationId/read", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const notificationId = Number(req.params.notificationId);

  if (!userId) {
    return res.status(401).json({
      message: "Authentication required. Please log in.",
    });
  }

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({
      message: "Invalid notification ID",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1
         AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification read error:", error.message);
    return res.status(500).json({
      message: "Failed to mark notification as read",
    });
  }
});

module.exports = router;
