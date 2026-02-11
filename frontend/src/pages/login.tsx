import React, { useState } from "react";

type LoginProps = {
  onLogin: (email: string) => void;
};

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email && password) {
      onLogin(email);
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
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
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
              required
            />
          </div>

          <button type="submit" className="login-btn">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
