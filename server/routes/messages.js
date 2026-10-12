const express = require("express");
const pool = require("../db");

const router = express.Router();

// Send a new message
router.post("/", async (req, res) => {
  try {
    const {
      conversation_id,
      sender_id,
      content
    } = req.body;

    // Check required fields
    if (!conversation_id || !sender_id || !content) {
      return res.status(400).json({
        message: "Conversation, sender, and message are required"
      });
    }

    // Save message to PostgreSQL
    const result = await pool.query(
      `INSERT INTO messages
       (conversation_id, sender_id, message_type, content)
       VALUES ($1, $2, 'text', $3)
       RETURNING *`,
      [
        conversation_id,
        sender_id,
        content
      ]
    );

    await pool.query(
      `INSERT INTO notifications
        (user_id, sender_id, conversation_id, message_id, notification_type, content)
       SELECT user_id, $1, $2, $3, 'message', $4
       FROM conversation_members
       WHERE conversation_id = $2
         AND user_id <> $1`,
      [sender_id, conversation_id, result.rows[0].id, content]
    );

    res.status(201).json({
      message: "Message sent successfully!",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Send message error:", error);

    res.status(500).json({
      message: "Failed to send message",
      error: error.message
    });
  }
});
// Get messages for a conversation
router.get("/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    const result = await pool.query(
      `SELECT
        id,
        conversation_id,
        sender_id,
        message_type,
        content,
        created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    res.status(200).json({
      message: "Messages loaded successfully!",
      data: result.rows
    });

  } catch (error) {
    console.error("Get messages error:", error);

    res.status(500).json({
      message: "Failed to load messages",
      error: error.message
    });
  }
});

module.exports = router;