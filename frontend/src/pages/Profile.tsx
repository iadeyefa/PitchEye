import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "../styles/ProfilePage.css";
import { useAuth } from "../AuthContext";

type Game = {
    id: number;
    title: string;
    session_code: string;
    game_time: string;
};

type Member = {
    id: string;
    email: string;
    role: string;
};

type Team = {
    id: number;
    name: string;
    join_code: string;
};

export default function Profile() {
    const { user } = useAuth();
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [myGames, setMyGames] = useState<Game[]>([]);
    const [team, setTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [teamGames, setTeamGames] = useState<Game[]>([]);
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState("");
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
        fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            const token = await getToken();
            await Promise.all([fetchMyGames(token), fetchMyTeam(token)]);
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyGames = async (token: string) => {
        const response = await fetch("http://localhost:8000/api/games/my/", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data = await response.json();
        setMyGames(data);
    };

    const fetchMyTeam = async (token: string) => {
        const response = await fetch("http://localhost:8000/api/teams/my/", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 404) return; // no team yet, that's fine
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data = await response.json();
        setTeam(data.team);
        setMembers(data.members);
        setTeamGames(data.games);
    };

    const handleJoinTeam = async () => {
        setJoinError("");
        try {
            const token = await getToken();
            const response = await fetch("http://localhost:8000/api/teams/join/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ join_code: joinCode }),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Invalid team code");
            }
            const data = await response.json();
            setJoinCode("");
            await fetchMyTeam(token);
        } catch (err: unknown) {
            setJoinError((err as Error).message);
        }
    };

    const handleChangeEmail = async () => {
        if (!supabase) return;
        setError(""); setSuccess("");
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
        setError(""); setSuccess("");
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
                    <button className="p-btn" onClick={handleChangeEmail} disabled={!isValidEmail(newEmail)}>
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
                    <button className="p-btn" onClick={handleChangePassword} disabled={newPassword.length < 6}>
                        Update Password
                    </button>
                </div>

                <div className="p-section">
                    <h3>My Game/Practice Sessions</h3>
                    {loading ? (
                        <p className="p-empty">Loading...</p>
                    ) : myGames.length === 0 ? (
                        <p className="p-empty">No games yet.</p>
                    ) : (
                        myGames.map((game) => (
                            <div key={game.id} className="p-game-item">
                                <span className="p-game-title">{game.title}</span>
                                <span className="p-game-code">{game.session_code}</span>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-section">
                    <h3>My Team</h3>
                    {loading ? (
                        <p className="p-empty">Loading...</p>
                    ) : team ? (
                        <>
                            <div className="p-team-header">
                                <span className="p-team-name">{team.name}</span>
                                <span className="p-game-code">{team.join_code}</span>
                            </div>

                            <h3>Members</h3>
                            {members.map((m) => (
                                <div key={m.id} className="p-member-item">
                                    <span className="p-member-email">{m.email}</span>
                                    <span className="p-member-role">{m.role}</span>
                                </div>
                            ))}

                            <h3>Team Sessions</h3>
                            {teamGames.length === 0 ? (
                                <p className="p-empty">No team sessions yet.</p>
                            ) : (
                                teamGames.map((game) => (
                                    <div key={game.id} className="p-game-item">
                                        <span className="p-game-title">{game.title}</span>
                                        <span className="p-game-code">{game.session_code}</span>
                                    </div>
                                ))
                            )}
                        </>
                    ) : (
                        <>
                            <p className="p-empty">You're not part of a team yet.</p>
                            {joinError && <div className="p-error">{joinError}</div>}
                            <input
                                className="p-input"
                                type="text"
                                placeholder="Enter team code"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={6}
                            />
                            <button
                                className="p-btn"
                                onClick={handleJoinTeam}
                                disabled={joinCode.length < 6}
                            >
                                Join Team
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}