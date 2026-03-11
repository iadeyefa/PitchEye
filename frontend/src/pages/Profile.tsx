import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "../styles/ProfilePage.css";
import { useAuth } from "../AuthContext";

export default function Profile() {
    const { user } = useAuth();
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [games, setGames] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const isValidEmail = (email: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const getToken = async () => {
        if (!supabase) throw new Error("Supabase not initialized");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        return session.access_token;
    };

    useEffect(() => {
        retrieveGames();
    }, []);

    const retrieveGames = async () => {
        try {
            const token = await getToken();
            const response = await fetch("http://localhost:8000/api/games/my/", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const data = await response.json();
            setGames(data);
        } catch (err: unknown) {
            setError((err as Error).message || "Unable to fetch user games");
        } finally {
            setLoading(false);
        }
    };

    const handleChangeEmail = async () => {
        if (!supabase) return;
        setError("");
        setSuccess("");
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) throw error;
            setSuccess("Email updated — check your inbox to confirm.");
            setNewEmail("");
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to update email");
        }
    };

    const handleChangePassword = async () => {
        if (!supabase) return;
        setError("");
        setSuccess("");
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setSuccess("Password updated successfully.");
            setNewPassword("");
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to update password");
        }
    };

    return (
        <div className="p-container">
            <div className="p-card">
                <h1>Profile</h1>
                <p className="p-email">{user?.email}</p>

                {error && <div className="p-error">{error}</div>}
                {success && <div className="p-success">{success}</div>}

                <div className="p-section">
                    <h3>Change Email</h3>
                    <input
                        className="p-input"
                        type="email"
                        placeholder="New email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                    />
                    <button
                        className="p-btn"
                        onClick={handleChangeEmail}
                        disabled={!isValidEmail(newEmail)}
                    >
                        Update Email
                    </button>
                </div>

                <div className="p-section">
                    <h3>Change Password</h3>
                    <input
                        className="p-input"
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                        className="p-btn"
                        onClick={handleChangePassword}
                        disabled={newPassword.length < 6}
                    >
                        Update Password
                    </button>
                </div>

                <div className="p-section">
                    <h3>My Game/Practice Sessions</h3>
                    {loading ? (
                        <p className="p-empty">Loading...</p>
                    ) : games.length === 0 ? (
                        <p className="p-empty">No games yet.</p>
                    ) : (
                        games.map((game) => (
                            <div key={game.id} className="p-game-item">
                                <span className="p-game-title">{game.title}</span>
                                <span className="p-game-code">{game.session_code}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}