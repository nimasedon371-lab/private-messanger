const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const pool = require("./db");

const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const conversationRoutes = require("./routes/conversations");
const contactRoutes = require("./routes/contacts");
const notificationRoutes = require("./routes/notifications");
const profileRoutes = require("./routes/profile");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const server = http.createServer(app);

// ==========================================
// SOCKET.IO SERVER
// ==========================================


const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CLIENT_URL,
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});
// Track every connected socket for each user.
const connectedUsers = new Map();

// ==========================================
// MIDDLEWARE
// ==========================================


app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
}));

app.use(express.json());

// ==========================================
// API ROUTES
// ==========================================

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/notifications", authMiddleware, notificationRoutes);
app.use("/api/profile", authMiddleware, profileRoutes);

// ==========================================
// TEST API
// ==========================================

app.get("/", (req, res) => {
  res.json({
    message: "Private Messenger API is running!",
  });
});

// ==========================================
// TEST DATABASE CONNECTION
// ==========================================

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connected successfully!",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database error:", error.message);

    res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ------------------------------------------
  // REGISTER USER + SAVE ONLINE STATUS
  // ------------------------------------------

  socket.on("register_user", async (userId) => {
    if (
      userId === undefined ||
      userId === null ||
      userId === ""
    ) {
      return;
    }

    const numericId = Number(userId);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      console.error("Invalid user ID:", userId);
      return;
    }

    const id = String(numericId);

    // Avoid registering the same socket twice.
    if (socket.data.userId === id) {
      return;
    }

    // Remove an earlier registration if necessary.
    if (socket.data.userId) {
      await removeConnectedUser(socket);
    }

    socket.data.userId = id;

    let userSockets = connectedUsers.get(id);

    if (!userSockets) {
      userSockets = new Set();
      connectedUsers.set(id, userSockets);
    }

    const wasOffline = userSockets.size === 0;

    userSockets.add(socket.id);
    socket.join(`user_${id}`);

    try {
      // Save online status in PostgreSQL.
      // Keep the previous last_seen time until
      // this user goes offline again.
      const result = await pool.query(
        `UPDATE users
         SET is_online = TRUE
         WHERE id = $1
         RETURNING id`,
        [numericId]
      );

      if (result.rowCount === 0) {
        console.error("User not found in database:", id);
        await removeConnectedUser(socket);
        return;
      }

      console.log(`User ${id} is online`);

      if (wasOffline) {
        io.emit("user_status", {
          userId: id,
          status: "Online",
          lastSeen: null,
        });
      }
    } catch (error) {
      console.error(
        "Could not update online status:",
        error.message
      );
    }
  });

  // ------------------------------------------
  // JOIN A CONVERSATION ROOM
  // ------------------------------------------

  socket.on("join_conversation", (conversationId) => {
    if (
      conversationId === undefined ||
      conversationId === null ||
      conversationId === ""
    ) {
      return;
    }

    socket.join(`conversation_${conversationId}`);

    console.log(
      `Socket ${socket.id} joined conversation ${conversationId}`
    );
  });

  // ------------------------------------------
  // SEND REAL-TIME MESSAGE
  // ------------------------------------------

  socket.on("send_message", (messageData) => {
    if (
      !messageData ||
      messageData.conversation_id === undefined ||
      messageData.conversation_id === null
    ) {
      return;
    }

    const room =
      `conversation_${messageData.conversation_id}`;

    io.to(room).emit("new_message", messageData);

    console.log(
      `New message broadcast to conversation ${messageData.conversation_id}`
    );
  });

  // ------------------------------------------
  // USER STARTED TYPING
  // ------------------------------------------

  socket.on("typing_start", (data) => {
    if (
      !data ||
      data.conversationId === undefined ||
      data.conversationId === null ||
      data.userId === undefined ||
      data.userId === null
    ) {
      return;
    }

    socket.to(`conversation_${data.conversationId}`).emit(
      "user_typing",
      {
        conversationId: data.conversationId,
        userId: data.userId,
        userName: data.userName || "Someone",
      }
    );
  });

  // ------------------------------------------
  // USER STOPPED TYPING
  // ------------------------------------------

  socket.on("typing_stop", (data) => {
    if (
      !data ||
      data.conversationId === undefined ||
      data.conversationId === null ||
      data.userId === undefined ||
      data.userId === null
    ) {
      return;
    }

    socket.to(`conversation_${data.conversationId}`).emit(
      "user_stopped_typing",
      {
        conversationId: data.conversationId,
        userId: data.userId,
      }
    );
  });

  // ------------------------------------------
  // DISCONNECT
  // ------------------------------------------

  socket.on("disconnect", async () => {
    console.log("Socket disconnected:", socket.id);

    await removeConnectedUser(socket);
  });
});

// ==========================================
// REMOVE DISCONNECTED USER SOCKET
// ==========================================

async function removeConnectedUser(socket) {
  const userId = socket.data.userId;

  if (!userId) {
    return;
  }

  const userSockets = connectedUsers.get(userId);

  if (userSockets) {
    userSockets.delete(socket.id);

    // Only mark the user offline when their
    // final connected tab/device disconnects.
    if (userSockets.size === 0) {
      connectedUsers.delete(userId);

      try {
        const result = await pool.query(
          `UPDATE users
           SET is_online = FALSE,
               last_seen = NOW()
           WHERE id = $1
           RETURNING last_seen`,
          [Number(userId)]
        );

        const lastSeen = result.rows[0]
          ? result.rows[0].last_seen
          : null;

        // Notify clients after the database update.
        io.emit("user_status", {
          userId,
          status: "Offline",
          lastSeen,
        });

        console.log(
          `User ${userId} is offline. Last seen:`,
          lastSeen
        );
      } catch (error) {
        console.error(
          "Could not save last seen:",
          error.message
        );

        // Still notify clients if the database update fails.
        io.emit("user_status", {
          userId,
          status: "Offline",
          lastSeen: null,
        });
      }
    }
  }

  socket.data.userId = null;
}

// ==========================================
// START SERVER
// ==========================================


const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

