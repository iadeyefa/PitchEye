import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import Login from "./pages/login";
import LivePage from "./pages/LivePage";
import Upload from "./components/UploadClip";
import Profile from "./pages/Profile";
import Navbar from "./components/Navbar";
import CreateGame from "./components/CreateGame";
import { useAuth } from "./AuthContext";

function App() {
  const { user, loading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <div className="container">
        <div className="dashboard">
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <>
    {user && <Navbar />}
    <Routes>
      {/* Login page */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <Login onLogin={() => {}} />
          )
        }
      />

      {/* Protected FYP */}
      <Route
        path="/"
        element={
          user ? (
            <div className="container">
              <div className="dashboard">
                <h1>Welcome to your PitchEye FYP!</h1>
                <p>Email: {user.email}</p>
                <button onClick={handleLogout}>
                  Logout
                </button>
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
        element={<Navigate to={user ? "/" : "/login"} replace />}
      />
      <Route path="/live" element={user ? <LivePage /> : <Navigate to="/link" replace />} />
      <Route path="/upload" element={user ? <Upload /> : <Navigate to="/upload" replace />} />
      <Route path="/profile" element={user ? <Profile /> : <Navigate to="/profile" replace />} />
        <Route path="/games/create" element={user ? <CreateGame /> : <Navigate to="/login" replace />} />
    </Routes>
    </>
  );
}

export default App;
