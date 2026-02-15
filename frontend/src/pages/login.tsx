import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import SignupModal from "../components/SignupModal";

type LoginProps = {
  onLogin: (email: string) => void;
};

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      onLogin(email);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <video
        autoPlay
        loop
        muted
        preload="auto"
        className="background-video"
        playsInline
        onError={(e) => console.error("Video load error:", e)}
        onPlay={() => console.log("Video playing")}
        onLoadStart={() => console.log("Video loading...")}
      >
        <source src="/LoginVideo.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <div className="overlay" />
      <h1 className="app-title">PitchEye</h1>

      <div className="login-box">
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="signup-link">
          Don't have an account?{" "}
          <button
            type="button"
            className="signup-link-btn"
            onClick={() => setIsSignupOpen(true)}
            disabled={loading}
          >
            Sign Up
          </button>
        </div>
      </div>

      <SignupModal
        isOpen={isSignupOpen}
        onClose={() => setIsSignupOpen(false)}
        onSignupSuccess={() => {
          setEmail("");
          setPassword("");
        }}
      />
    </div>
  );
}
