
import { useState } from "react";
import "./App.css";
import Messenger from "./Messenger";

// API URL for local development and production deployment
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [showLogin, setShowLogin] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(localStorage.getItem("token"))
  );

  if (isLoggedIn) {
    return <Messenger />;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">💬</div>

        <h1>Private Messenger</h1>

        <p className="auth-subtitle">
          {showLogin
            ? "Sign in to your private messages"
            : "Create your private messenger account"}
        </p>

        {showLogin ? (
          <LoginForm />
        ) : (
          <RegisterForm />
        )}

        <div className="auth-switch">
          {showLogin ? (
            <>
              Don't have an account?{" "}
              <button onClick={() => setShowLogin(false)}>
                Create account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => setShowLogin(true)}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------
// LOGIN FORM
// --------------------

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            data.message ||
            "Login failed. Please check your credentials."
        );
        return;
      }

      if (!data.token || !data.user) {
        alert("Login response is missing your account information.");
        return;
      }

      // Save the authentication token
      localStorage.setItem("token", data.token);

      // Save user information
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      console.log("Logged in user:", data.user);

      // Refresh the app to open Messenger
      window.location.reload();
    } catch (error) {
      console.error("Login error:", error);

      alert(
        "Unable to connect to the server. Please try again."
      );
    }
  };

  return (
    <form className="auth-form" onSubmit={handleLogin}>
      <label>Email</label>

      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />

      <label>Password</label>

      <input
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />

      <button className="auth-button" type="submit">
        Sign In
      </button>
    </form>
  );
}

// --------------------
// REGISTER FORM
// --------------------

function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_name: fullName,
            username,
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            data.message ||
            "Registration failed."
        );
        return;
      }

      alert("Account created successfully! You can now sign in.");

      console.log("Registered user:", data.user);

      // Return to the login screen after successful registration
      setFullName("");
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Registration error:", error);

      alert(
        "Unable to connect to the server. Please try again."
      );
    }
  };

  return (
    <form className="auth-form" onSubmit={handleRegister}>
      <label>Full Name</label>

      <input
        type="text"
        placeholder="Enter your full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
        required
      />

      <label>Username</label>

      <input
        type="text"
        placeholder="Choose a username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        required
      />

      <label>Email</label>

      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />

      <label>Password</label>

      <input
        type="password"
        placeholder="Create a password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
      />

      <button className="auth-button" type="submit">
        Create Account
      </button>
    </form>
  );
}

export default App;