const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();


// ====================
// REGISTER
// ====================

router.post("/register", async (req, res) => {
  try {
    const { username, full_name, email, password } = req.body;

    if (!username || !full_name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Username or email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
       (username, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, email, created_at`,
      [username, full_name, email, passwordHash]
    );

    res.status(201).json({
      message: "User registered successfully!",
      user: result.rows[0]
    });

  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Registration failed"
    });
  }
});


// ====================
// LOGIN
// ====================

router.post("/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    console.log("LOGIN REQUEST");
    console.log("Email:", email);

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    // Find user
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    console.log("Users found:", result.rows.length);

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    console.log("User found:", user.username);

    // Check password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    console.log("Password match:", passwordMatch);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    console.log("JWT created successfully");

    res.status(200).json({
      message: "Login successful!",
      token: token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        profile_picture: user.profile_picture,
        bio: user.bio
      }
    });

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      message: "Login failed",
      error: error.message
    });
  }
});


module.exports = router;