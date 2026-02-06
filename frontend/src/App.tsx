import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import Login from "./pages/login";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const handleLogin = (email: string) => {
    setUserEmail(email);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setUserEmail("");
    setIsLoggedIn(false);
  };

  return (
    <Routes>
      {/* Login page */}
      <Route
        path="/login"
        element={
          isLoggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <Login onLogin={handleLogin} />
          )
        }
      />

      {/* Protected FYP */}
      <Route
        path="/"
        element={
          isLoggedIn ? (
            <div className="container">
              <div className="dashboard">
                <h1>Welcome to your PitchEye FYP!</h1>
                <p>Email: {userEmail}</p>
                <button onClick={handleLogout}>Logout</button>
              </div>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* For when we create the rest of the app */}
      <Route
        path="*"
        element={<Navigate to={isLoggedIn ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}
