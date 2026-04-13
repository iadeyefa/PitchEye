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
import HomeFeed from "./components/HomeFeed";
import PostView from "./components/PostView";
import GameDetail from "./components/GameDetail";
import TeamPage from "./pages/TeamPage";
import LiveFeed from "./components/LiveFeed";

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
            <HomeFeed />
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
      <Route path="/post/:id" element={<PostView />} />
      <Route path="/games/:id" element={user ? <GameDetail /> : <Navigate to="/login" replace />} />
      <Route path="/teams/:id" element={user ? <TeamPage /> : <Navigate to="/login" replace />} />
    </Routes>
    </>
  );
}

export default App;
