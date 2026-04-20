import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import "../styles/ProfilePage.css";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { canUserCreateTeamSessions } from "../utils/sessionPermissions";
import { getJoinedSessionCodes, mergeGamesById, removeJoinedSessionCode, resolveJoinedSessions } from "../utils/joinedSessions";

type Game = {
    id: number;
    title: string;
    session_code: string;
    game_time: string;
    created_by?: string;
    qr_code_active?: boolean;
    can_accept_uploads?: boolean;
    session_started?: boolean;
    owned_by_current_user?: boolean;
};

type Team = {
    id: number;
    name: string;
    join_code: string;
    admin_id?: string;
    session_creation_access?: string;
};

type ProfileData = {
    username?: string;
    email?: string;
    role?: string;
};

export default function Profile() {
    const { user, logout } = useAuth();
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
    const [endingGameId, setEndingGameId] = useState<number | null>(null);
    const [editingGameId, setEditingGameId] = useState<number | null>(null);
    const [gameTimeDraft, setGameTimeDraft] = useState("");
    const [savingGameTime, setSavingGameTime] = useState(false);
    const [userRole, setUserRole] = useState<string>("");
    const [teamMode, setTeamMode] = useState<'join' | 'create'>('join');
    const [newTeamName, setNewTeamName] = useState("");
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [joinedSessionCodes, setJoinedSessionCodes] = useState<string[]>([]);

    const isValidEmail = (email: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const getToken = useCallback(async () => {
        if (!supabase) throw new Error("Supabase not initialized");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        return session.access_token;
    }, []);

    const fetchMyGames = useCallback(async (token: string) => {
        const response = await fetch("http://localhost:8000/api/games/my/", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data: Game[] = await response.json();
        const joinedGames = await resolveJoinedSessions(token, user?.id);
        setJoinedSessionCodes(getJoinedSessionCodes(user?.id));
        setMyGames(mergeGamesById(data, joinedGames as Game[]));
    }, [user?.id]);

    const fetchMyTeam = useCallback(async (token: string) => {
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
        if (response.status === 404 || response.status === 403) return;
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data = await response.json();
        setTeam(data.team);
    }, [user]);

    const fetchAll = useCallback(async () => {
        try {
            const token = await getToken();
            await Promise.all([fetchMyGames(token), fetchMyTeam(token)]);
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [fetchMyGames, fetchMyTeam, getToken]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

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
    const canCreateSessions = canUserCreateTeamSessions(userRole, team, user?.id);
    const upcomingGames = myGames
        .filter((game) => new Date(game.game_time).getTime() >= Date.now())
        .sort((a, b) => new Date(a.game_time).getTime() - new Date(b.game_time).getTime());
    const activeGames = myGames
        .filter((game) => game.can_accept_uploads)
        .sort((a, b) => new Date(b.game_time).getTime() - new Date(a.game_time).getTime());
    const pastGames = myGames
        .filter((game) => new Date(game.game_time).getTime() < Date.now() && !game.can_accept_uploads)
        .sort((a, b) => new Date(b.game_time).getTime() - new Date(a.game_time).getTime());

    const formatGameTime = (gameTime: string) =>
        new Date(gameTime).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });

    const toDateTimeLocalValue = (gameTime: string) => {
        const date = new Date(gameTime);
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - offset * 60000);
        return localDate.toISOString().slice(0, 16);
    };

    const handleEndSession = async (game: Game) => {
        if (endingGameId || !game.can_accept_uploads) return;

        const confirmed = window.confirm(`End "${game.title}" now? Players will no longer be able to join or upload clips.`);
        if (!confirmed) return;

        setError("");
        setSuccess("");
        setEndingGameId(game.id);
        try {
            const token = await getToken();
            const response = await fetch(`http://localhost:8000/api/games/${game.id}/end/`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || "Failed to end session");
            }

            setMyGames((current) => current.map((item) => (item.id === game.id ? payload : item)));
            setSuccess(`Ended "${game.title}".`);
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to end session");
        } finally {
            setEndingGameId(null);
        }
    };

    const handleStartEditingGame = (game: Game) => {
        setEditingGameId(game.id);
        setGameTimeDraft(toDateTimeLocalValue(game.game_time));
        setError("");
        setSuccess("");
    };

    const handleSaveGameTime = async (game: Game) => {
        if (!gameTimeDraft) {
            setError("A new start time is required");
            return;
        }

        setSavingGameTime(true);
        setError("");
        setSuccess("");
        try {
            const token = await getToken();
            const response = await fetch(`http://localhost:8000/api/games/${game.id}/update/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ game_time: gameTimeDraft }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || "Failed to update session");
            }

            setMyGames((current) => current.map((item) => (item.id === game.id ? payload : item)));
            setEditingGameId(null);
            setGameTimeDraft("");
            setSuccess(`Updated "${game.title}" start time.`);
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to update session");
        } finally {
            setSavingGameTime(false);
        }
    };

    const renderSessionCard = (game: Game, options?: { allowEnd?: boolean; allowReschedule?: boolean }) => {
        const isEditing = editingGameId === game.id;
        const isOwnedByCurrentUser = game.owned_by_current_user !== false;
        const isJoinedByCode = joinedSessionCodes.includes(game.session_code.toUpperCase());

        return (
            <div key={game.id} className="p-game-item">
                <button className="p-game-main" onClick={() => navigate(`/games/${game.id}`)}>
                    <div className="p-game-copy">
                        <span className="p-game-title">{game.title}</span>
                        <span className="p-game-meta">{formatGameTime(game.game_time)}</span>
                        {!isOwnedByCurrentUser && (
                            <span className="p-game-note">{isJoinedByCode ? "Joined by session code" : "Shared from your team"}</span>
                        )}
                    </div>
                    <span className={`p-game-code ${game.qr_code_active === false ? "p-game-code--inactive" : ""}`}>
                        {game.qr_code_active === false ? "Inactive" : game.session_code}
                    </span>
                </button>

                {isOwnedByCurrentUser && (options?.allowEnd || options?.allowReschedule) && (
                    <div className="p-game-actions">
                        {options.allowEnd && (
                            <button
                                className="p-game-action p-game-action--danger"
                                onClick={() => handleEndSession(game)}
                                disabled={endingGameId === game.id}
                            >
                                {endingGameId === game.id ? "Ending..." : "End Session"}
                            </button>
                        )}
                        {options.allowReschedule && !isEditing && (
                            <button
                                className="p-game-action"
                                onClick={() => handleStartEditingGame(game)}
                            >
                                Change Start Time
                            </button>
                        )}
                    </div>
                )}

                {!isOwnedByCurrentUser && isJoinedByCode && (
                    <div className="p-game-actions">
                        <button
                            className="p-game-action p-game-action--ghost"
                            onClick={() => {
                                if (!user?.id) return;
                                removeJoinedSessionCode(user.id, game.session_code);
                                setJoinedSessionCodes(getJoinedSessionCodes(user.id));
                                setMyGames((current) => current.filter((item) => item.id !== game.id));
                            }}
                        >
                            Leave Session
                        </button>
                    </div>
                )}

                {options?.allowReschedule && isEditing && (
                    <div className="p-game-edit-row">
                        <input
                            className="p-input"
                            type="datetime-local"
                            value={gameTimeDraft}
                            onChange={(e) => setGameTimeDraft(e.target.value)}
                        />
                        <div className="p-game-actions">
                            <button
                                className="p-game-action"
                                onClick={() => handleSaveGameTime(game)}
                                disabled={savingGameTime}
                            >
                                {savingGameTime ? "Saving..." : "Save"}
                            </button>
                            <button
                                className="p-game-action p-game-action--ghost"
                                onClick={() => {
                                    setEditingGameId(null);
                                    setGameTimeDraft("");
                                }}
                                disabled={savingGameTime}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
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

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/login");
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to log out");
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm(
            "Are you sure you want to delete your account? This cannot be undone."
        );
        if (!confirmed) return;

        setIsDeletingAccount(true);
        setError("");
        try {
            const token = await getToken();
            const res = await fetch("http://localhost:8000/api/users/delete_user/", {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to delete account");
            await logout();
            navigate("/login");
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to delete account");
            setIsDeletingAccount(false);
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

                        <div className="p-section">
                            <h3>Session</h3>
                            <button className="p-btn p-btn--secondary" onClick={handleLogout}>
                                Log Out
                            </button>
                        </div>

                    </section>

                    <section className="p-card">
                        <div className="p-section-heading">
                            <div>
                                <p className="p-eyebrow">Activity</p>
                                <h2 className="p-section-title">My Sessions</h2>
                                <p className="p-title">Includes sessions you created, sessions shared with your team, and sessions you joined by code.</p>
                            </div>
                            {canCreateSessions && (
                                <button className="p-btn p-btn--secondary p-btn--inline" onClick={() => navigate("/games/create")}>
                                    Create Session
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <p className="p-empty">Loading...</p>
                        ) : (
                            <>
                                <div className="p-section">
                                    <h3>Active</h3>
                                    {activeGames.length === 0 ? (
                                        <p className="p-empty">No active sessions right now.</p>
                                    ) : (
                                        activeGames.slice(0, 2).map((game) => renderSessionCard(game, { allowEnd: true }))
                                    )}
                                </div>

                                <div className="p-section">
                                    <h3>Upcoming</h3>
                                    {upcomingGames.length === 0 ? (
                                        <p className="p-empty">Nothing scheduled yet.</p>
                                    ) : (
                                        upcomingGames.slice(0, 2).map((game) => renderSessionCard(game, { allowReschedule: true }))
                                    )}
                                </div>

                                <div className="p-section">
                                    <h3>Recent</h3>
                                    {pastGames.length === 0 ? (
                                        <p className="p-empty">No completed sessions yet.</p>
                                    ) : (
                                        pastGames.slice(0, 2).map((game) => renderSessionCard(game))
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

                <div style={{ textAlign: "center", paddingTop: "16px", paddingBottom: "16px" }}>
                    <button
                        className="p-game-action p-game-action--danger"
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount}
                    >
                        {isDeletingAccount ? "Deleting..." : "Delete Account"}
                    </button>
                </div>
            </div>
        </div>
    );
}
