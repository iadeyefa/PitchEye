import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "../styles/ProfilePage.css";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

type Game = {
    id: number;
    title: string;
    session_code: string;
    game_time: string;
    qr_code_active?: boolean;
};

type Team = {
    id: number;
    name: string;
    join_code: string;
};

type ProfileData = {
    username?: string;
    email?: string;
    role?: string;
};

export default function Profile() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profileName, setProfileName] = useState("");
    const [profileNameDraft, setProfileNameDraft] = useState("");
    const [isEditingProfileName, setIsEditingProfileName] = useState(false);
    const [profileNameLoading, setProfileNameLoading] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [myGames, setMyGames] = useState<Game[]>([]);
    const [team, setTeam] = useState<Team | null>(null);
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState("");
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>("");
    const [teamMode, setTeamMode] = useState<'join' | 'create'>('join');
    const [newTeamName, setNewTeamName] = useState("");

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
        const profileRes = await fetch("http://localhost:8000/api/users/get_user/", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (profileRes.ok) {
            const profileData: ProfileData[] = await profileRes.json();
            if (profileData.length > 0) setUserRole(profileData[0].role || "");
            if (profileData.length > 0) {
                const resolvedName = profileData[0].username?.trim() || profileData[0].email?.split("@")[0] || user?.email?.split("@")[0] || "Profile";
                setProfileName(resolvedName);
                setProfileNameDraft(resolvedName);
            }
        }

        const response = await fetch("http://localhost:8000/api/teams/my/", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 404 || response.status === 403) return; // no team yet
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data = await response.json();
        setTeam(data.team);
    };

    const handleCreateTeam = async () => {
        setJoinError("");
        try {
            const token = await getToken();
            const response = await fetch("http://localhost:8000/api/teams/create_team/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ team_name: newTeamName }),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to create team");
            }
            setNewTeamName("");
            await fetchMyTeam(token);
        } catch (err: unknown) {
            setJoinError((err as Error).message);
        }
    };

    const handleLeaveTeam = async () => {
        try {
            const token = await getToken();
            await fetch("http://localhost:8000/api/teams/leave_team/", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            setTeam(null);
        } catch (err: unknown) {
            setError((err as Error).message);
        }
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
            await response.json();
            setJoinCode("");
            await fetchMyTeam(token);
        } catch (err: unknown) {
            setJoinError((err as Error).message);
        }
    };

    const isTeamLeader = userRole === "admin" || userRole === "coach";
    const upcomingGames = myGames
        .filter((game) => new Date(game.game_time).getTime() >= Date.now())
        .sort((a, b) => new Date(a.game_time).getTime() - new Date(b.game_time).getTime());
    const pastGames = myGames
        .filter((game) => new Date(game.game_time).getTime() < Date.now())
        .sort((a, b) => new Date(b.game_time).getTime() - new Date(a.game_time).getTime());
    const nextGame = upcomingGames[0] ?? null;

    const formatGameTime = (gameTime: string) =>
        new Date(gameTime).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });

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

    const handleProfileNameSave = async () => {
        if (!profileNameDraft.trim()) {
            setError("Name is required");
            return;
        }

        setError("");
        setSuccess("");
        setProfileNameLoading(true);
        try {
            const token = await getToken();
            const response = await fetch("http://localhost:8000/api/users/update_user/", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ username: profileNameDraft.trim() }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || "Failed to update name");
            }

            setProfileName(profileNameDraft.trim());
            setSuccess("Name updated.");
            setIsEditingProfileName(false);
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to update name");
        } finally {
            setProfileNameLoading(false);
        }
    };

    return (
        <div className="p-container">
            <div className="p-layout">
                <section className="p-card p-card--hero">
                    <p className="p-eyebrow">Profile</p>
                    <div className="p-title-row">
                        {isEditingProfileName ? (
                            <>
                                <input
                                    className="p-title-input"
                                    type="text"
                                    value={profileNameDraft}
                                    onChange={(e) => setProfileNameDraft(e.target.value)}
                                    maxLength={60}
                                />
                                <div className="p-title-actions">
                                    <button className="p-small-btn" onClick={handleProfileNameSave} disabled={profileNameLoading}>
                                        {profileNameLoading ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                        className="p-small-btn p-small-btn--ghost"
                                        onClick={() => {
                                            setProfileNameDraft(profileName);
                                            setIsEditingProfileName(false);
                                        }}
                                        disabled={profileNameLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h1>{profileName || user?.email?.split("@")[0] || "Profile"}</h1>
                                <button className="p-inline-link p-inline-link--tight" onClick={() => setIsEditingProfileName(true)}>
                                    Edit Name
                                </button>
                            </>
                        )}
                    </div>
                    <p className="p-email">{user?.email}</p>

                    <div className="p-stat-grid">
                        <div className="p-stat-card">
                            <span className="p-stat-value">{myGames.length}</span>
                            <span className="p-stat-label">Sessions</span>
                        </div>
                        <div className="p-stat-card">
                            <span className="p-stat-value">{team ? "1" : "0"}</span>
                            <span className="p-stat-label">Teams</span>
                        </div>
                        <div className="p-stat-card">
                            <span className="p-stat-value">{userRole || "member"}</span>
                            <span className="p-stat-label">Role</span>
                        </div>
                    </div>
                </section>

                <div className="p-grid">
                    <section className="p-card">
                        <div className="p-section-heading">
                            <div>
                                <p className="p-eyebrow">Account</p>
                                <h2 className="p-section-title">Personal Settings</h2>
                            </div>
                        </div>

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
                    </section>

                    <section className="p-card">
                        <div className="p-section-heading">
                            <div>
                                <p className="p-eyebrow">Activity</p>
                                <h2 className="p-section-title">My Sessions</h2>
                            </div>
                            <button className="p-btn p-btn--secondary p-btn--inline" onClick={() => navigate("/games/create")}>
                                Create Session
                            </button>
                        </div>

                        {loading ? (
                            <p className="p-empty">Loading...</p>
                        ) : (
                            <>
                                <div className="p-highlight-card">
                                    <p className="p-highlight-label">Next up</p>
                                    {nextGame ? (
                                        <>
                                            <h3 className="p-highlight-title">{nextGame.title}</h3>
                                            <p className="p-highlight-meta">{formatGameTime(nextGame.game_time)}</p>
                                            <button
                                                className="p-btn p-btn--secondary"
                                                onClick={() => navigate(`/games/${nextGame.id}`)}
                                            >
                                                Open Session
                                            </button>
                                        </>
                                    ) : (
                                        <p className="p-empty">No upcoming sessions yet.</p>
                                    )}
                                </div>

                                <div className="p-section">
                                    <h3>Upcoming</h3>
                                    {upcomingGames.length === 0 ? (
                                        <p className="p-empty">Nothing scheduled yet.</p>
                                    ) : (
                                        upcomingGames.slice(0, 4).map((game) => (
                                            <button key={game.id} className="p-game-item" onClick={() => navigate(`/games/${game.id}`)}>
                                                <div className="p-game-copy">
                                                    <span className="p-game-title">{game.title}</span>
                                                    <span className="p-game-meta">{formatGameTime(game.game_time)}</span>
                                                </div>
                                                <span className={`p-game-code ${game.qr_code_active === false ? "p-game-code--inactive" : ""}`}>
                                                    {game.qr_code_active === false ? "Inactive" : game.session_code}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>

                                <div className="p-section">
                                    <h3>Recent</h3>
                                    {pastGames.length === 0 ? (
                                        <p className="p-empty">No completed sessions yet.</p>
                                    ) : (
                                        pastGames.slice(0, 3).map((game) => (
                                            <button key={game.id} className="p-game-item" onClick={() => navigate(`/games/${game.id}`)}>
                                                <div className="p-game-copy">
                                                    <span className="p-game-title">{game.title}</span>
                                                    <span className="p-game-meta">{formatGameTime(game.game_time)}</span>
                                                </div>
                                                <span className={`p-game-code ${game.qr_code_active === false ? "p-game-code--inactive" : ""}`}>
                                                    {game.qr_code_active === false ? "Inactive" : game.session_code}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </section>

                    <section className="p-card">
                        <div className="p-section-heading">
                            <div>
                                <p className="p-eyebrow">Team Access</p>
                                <h2 className="p-section-title">Team Membership</h2>
                            </div>
                        </div>

                        {loading ? (
                            <p className="p-empty">Loading...</p>
                        ) : team ? (
                            <>
                                <div className="p-team-summary p-team-summary--membership">
                                    <div>
                                        <p className="p-team-kicker">Current team</p>
                                        <h3 className="p-team-heading">{team.name}</h3>
                                        <p className="p-team-code">Code: {team.join_code}</p>
                                    </div>
                                    <button className="p-btn p-btn--secondary p-btn--team-summary" onClick={() => navigate(`/teams/${team.id}`)}>
                                        Open Team Page
                                    </button>
                                </div>
                                <button className="p-btn-leave" onClick={handleLeaveTeam}>
                                    Leave Team
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="p-empty">You are not part of a team yet.</p>

                                {isTeamLeader && (
                                    <div className="p-team-toggle">
                                        <button
                                            className={`p-toggle-btn ${teamMode === 'join' ? 'p-toggle-btn--active' : ''}`}
                                            onClick={() => setTeamMode('join')}
                                        >
                                            Join Team
                                        </button>
                                        <button
                                            className={`p-toggle-btn ${teamMode === 'create' ? 'p-toggle-btn--active' : ''}`}
                                            onClick={() => setTeamMode('create')}
                                        >
                                            Create Team
                                        </button>
                                    </div>
                                )}

                                {joinError && <div className="p-error">{joinError}</div>}

                                {teamMode === 'join' && (
                                    <div className="p-section">
                                        <h3>Join with code</h3>
                                        <input
                                            className="p-input"
                                            type="text"
                                            placeholder="Enter team code"
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                            maxLength={6}
                                        />
                                        <button className="p-btn" onClick={handleJoinTeam} disabled={joinCode.length < 6}>
                                            Join Team
                                        </button>
                                    </div>
                                )}

                                {teamMode === 'create' && isTeamLeader && (
                                    <div className="p-section">
                                        <h3>Create team</h3>
                                        <input
                                            className="p-input"
                                            type="text"
                                            placeholder="Team name"
                                            value={newTeamName}
                                            onChange={(e) => setNewTeamName(e.target.value)}
                                        />
                                        <button className="p-btn" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
                                            Create Team
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
