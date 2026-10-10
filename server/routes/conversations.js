const express = require("express");
const pool = require("../db");

const router = express.Router();

// ==========================================
// GET ALL CONVERSATIONS FOR A USER
// ==========================================

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `
      SELECT
        c.id AS conversation_id,
        c.conversation_type,
        c.name AS conversation_name,
        u.id AS other_user_id,
        u.username,
        u.full_name,
        u.profile_picture,
        u.is_online,
        u.last_seen
      FROM conversations c

      JOIN conversation_members cm
        ON c.id = cm.conversation_id

      JOIN conversation_members other_cm
        ON c.id = other_cm.conversation_id
        AND other_cm.user_id != $1

      JOIN users u
        ON u.id = other_cm.user_id

      WHERE cm.user_id = $1

      ORDER BY c.created_at DESC
      `,
      [userId]
    );

    res.json({
      message: "Conversations loaded successfully!",
      data: result.rows,
    });
  } catch (error) {
    console.error(
      "Get conversations error:",
      error
    );

    res.status(500).json({
      message: "Failed to load conversations",
      error: error.message,
    });
  }
});


// ==========================================
// CREATE OR GET PRIVATE CONVERSATION
// ==========================================

router.post("/private", async (req, res) => {
  try {
    const {
      user_id,
      other_user_id,
    } = req.body;

    if (!user_id || !other_user_id) {
      return res.status(400).json({
        message:
          "Both users are required",
      });
    }

    if (
      Number(user_id) ===
      Number(other_user_id)
    ) {
      return res.status(400).json({
        message:
          "You cannot start a conversation with yourself",
      });
    }

    // --------------------------------------
    // Check whether conversation already exists
    // --------------------------------------

    const existingConversation =
      await pool.query(
        `
        SELECT c.id
        FROM conversations c

        JOIN conversation_members cm1
          ON c.id = cm1.conversation_id

        JOIN conversation_members cm2
          ON c.id = cm2.conversation_id

        WHERE c.conversation_type = 'private'
          AND cm1.user_id = $1
          AND cm2.user_id = $2
        `,
        [
          user_id,
          other_user_id,
        ]
      );

    // --------------------------------------
    // If conversation already exists
    // --------------------------------------

    if (
      existingConversation.rows
        .length > 0
    ) {
      return res.json({
        message:
          "Conversation already exists!",
        conversation_id:
          existingConversation
            .rows[0].id,
        existing: true,
      });
    }

    // --------------------------------------
    // Create new conversation
    // --------------------------------------

    const conversationResult =
      await pool.query(
        `
        INSERT INTO conversations
        (conversation_type, created_by)
        VALUES ('private', $1)
        RETURNING id
        `,
        [user_id]
      );

    const conversationId =
      conversationResult
        .rows[0].id;

    // --------------------------------------
    // Add first user
    // --------------------------------------

    await pool.query(
      `
      INSERT INTO conversation_members
      (conversation_id, user_id)
      VALUES ($1, $2)
      `,
      [
        conversationId,
        user_id,
      ]
    );

    // --------------------------------------
    // Add second user
    // --------------------------------------

    await pool.query(
      `
      INSERT INTO conversation_members
      (conversation_id, user_id)
      VALUES ($1, $2)
      `,
      [
        conversationId,
        other_user_id,
      ]
    );

    res.status(201).json({
      message:
        "Private conversation created!",
      conversation_id:
        conversationId,
      existing: false,
    });

  } catch (error) {
    console.error(
      "Create private conversation error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to create conversation",
      error: error.message,
    });
  }
});


module.exports = router;