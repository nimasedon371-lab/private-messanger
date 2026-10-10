import { useState } from "react";
import "./App.css";
import Messenger from "./Messenger";  

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

        <div className="auth-logo">
          💬
        </div>

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
      "http://localhost:5000/api/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      }
    );

    const data = await response.json();

 if (!response.ok) {
  alert(data.error || data.message);
  return;
}
    // Save JWT token
    localStorage.setItem("token", data.token);

    // Save user information
    localStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );

    alert("Login successful!");

console.log("Logged in user:", data.user);

window.location.reload();

  } catch (error) {
    console.error("Login error:", error);

    alert("Unable to connect to the server.");
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
        required
      />

      <label>Password</label>

      <input
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
      "http://localhost:5000/api/auth/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          full_name: fullName,
          username,
          email,
          password
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Registration failed");
      return;
    }

    alert("Account created successfully!");

    console.log("Registered user:", data.user);

  } catch (error) {
    console.error("Registration error:", error);
    alert("Unable to connect to the server.");
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
        required
      />

      <label>Username</label>

      <input
        type="text"
        placeholder="Choose a username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <label>Email</label>

      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label>Password</label>

      <input
        type="password"
        placeholder="Create a password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button className="auth-button" type="submit">
        Create Account
      </button>

    </form>
  );
}

export default App;