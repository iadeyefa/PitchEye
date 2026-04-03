import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";
import "../styles/ProfilePage.css";
import "../styles/common.css";

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

type Game = {
    id: number;
    title: string;
    session_code: string;
    game_time: string;
    qr_code_active?: boolean;
};

export default function TeamPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [team, setTeam] = useState<Team | null>(null);
    const [teamNameDraft, setTeamNameDraft] = useState("");
    const [isEditingTeamName, setIsEditingTeamName] = useState(false);
    const [teamNameLoading, setTeamNameLoading] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [userRole, setUserRole] = useState<string>("");
    const [copyMessage, setCopyMessage] = useState("");
    const { id } = useParams<{ id: string }>();

    useEffect(() => {
        fetchTeam();
    }, []);

    const fetchTeam = async () => {
        try {
            if (!supabase) throw new Error("Supabase not initialized");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const [teamRes, profileRes] = await Promise.all([
                fetch(`http://localhost:8000/api/teams/${id}/`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                }),
                fetch("http://localhost:8000/api/users/get_user/", {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                }),
            ]);

            if (teamRes.status === 404) { navigate("/profile"); return; }
            if (!teamRes.ok) throw new Error(`Error ${teamRes.status}`);

            const teamData = await teamRes.json();
            setTeam(teamData.team);
            setTeamNameDraft(teamData.team.name);
            setMembers(teamData.members);
            setGames(teamData.games);

            if (profileRes.ok) {
                const profileData = await profileRes.json();
                if (profileData.length > 0) setUserRole(profileData[0].role);
            }
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const isTeamLeader = userRole === "admin" || userRole === "coach";
    const upcomingGames = games
        .filter((game) => new Date(game.game_time).getTime() >= Date.now())
        .sort((a, b) => new Date(a.game_time).getTime() - new Date(b.game_time).getTime());
    const pastGames = games
        .filter((game) => new Date(game.game_time).getTime() < Date.now())
        .sort((a, b) => new Date(b.game_time).getTime() - new Date(a.game_time).getTime());

    const formatGameTime = (gameTime: string) =>
        new Date(gameTime).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });

    const handleCopyCode = async () => {
        if (!team) return;
        try {
            await navigator.clipboard.writeText(team.join_code);
            setCopyMessage("Team code copied.");
        } catch (_error) {
            setCopyMessage("Copy failed. You can still share the code manually.");
        }
    };

    const handleTeamNameSave = async () => {
        if (!team || !teamNameDraft.trim()) {
            setError("Team name is required");
            return;
        }

        setError("");
        setTeamNameLoading(true);
        try {
            if (!supabase) throw new Error("Supabase not initialized");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch(`http://localhost:8000/api/teams/${team.id}/update/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ team_name: teamNameDraft.trim() }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || "Failed to update team name");
            }

            const updatedTeam: Team = await response.json();
            setTeam(updatedTeam);
            setTeamNameDraft(updatedTeam.name);
            setIsEditingTeamName(false);
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to update team name");
        } finally {
            setTeamNameLoading(false);
        }
    };

    if (loading) return <div className="p-container"><div className="p-card"><p className="p-empty">Loading...</p></div></div>;
    if (error || !team) return <div className="p-container"><div className="p-card"><p className="p-empty">{error || "Team not found"}</p></div></div>;

    return (
        <div className="p-container">
            <div className="p-layout">
                <section className="p-card p-card--hero">
                    <button className="p-back-btn" onClick={() => navigate(-1)}>
                        ← Back
                    </button>

                    <p className="p-eyebrow">Team Home</p>
                    <div className="p-title-row">
                        {isEditingTeamName ? (
                            <>
                                <input
                                    className="p-title-input"
                                    type="text"
                                    value={teamNameDraft}
                                    onChange={(e) => setTeamNameDraft(e.target.value)}
                                    maxLength={80}
                                />
                                <div className="p-title-actions">
                                    <button className="p-small-btn" onClick={handleTeamNameSave} disabled={teamNameLoading}>
                                        {teamNameLoading ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                        className="p-small-btn p-small-btn--ghost"
                                        onClick={() => {
                                            setTeamNameDraft(team.name);
                                            setIsEditingTeamName(false);
                                        }}
                                        disabled={teamNameLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h1>{team.name}</h1>
                                {isTeamLeader && (
                                    <button className="p-inline-link p-inline-link--tight" onClick={() => setIsEditingTeamName(true)}>
                                        Edit Team Name
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="p-team-banner">
                        <div>
                            <p className="p-team-kicker">Join code</p>
                            <h2 className="p-team-banner-code">{team.join_code}</h2>
                        </div>
                        <button className="p-btn p-btn--secondary" onClick={handleCopyCode}>
                            Copy Code
                        </button>
                    </div>

                    {copyMessage && <div className="p-success">{copyMessage}</div>}

                    <div className="p-stat-grid">
                        <div className="p-stat-card">
                            <span className="p-stat-value">{members.length}</span>
                            <span className="p-stat-label">Members</span>
                        </div>
                        <div className="p-stat-card">
                            <span className="p-stat-value">{upcomingGames.length}</span>
                            <span className="p-stat-label">Upcoming</span>
                        </div>
                        <div className="p-stat-card">
                            <span className="p-stat-value">{userRole || "member"}</span>
                            <span className="p-stat-label">Your role</span>
                        </div>
                    </div>
                </section>

                <div className="p-grid">
                    <section className="p-card">
                        <div className="p-section-heading">
                            <div>
                                <p className="p-eyebrow">Roster</p>
                                <h2 className="p-section-title">Members</h2>
                            </div>
                        </div>

                        {members.length === 0 ? (
                            <p className="p-empty">No members found.</p>
                        ) : (
                            members.map((m) => (
                                <div key={m.id} className="p-member-item">
                                    <div className="p-member-copy">
                                        <span className="p-member-email">{m.email}</span>
                                        <span className="p-member-note">
                                            {m.id === user?.id ? "You" : m.role === userRole ? "Same role as you" : "Active member"}
                                        </span>
                                    </div>
                                    <span className="p-member-role">{m.role}</span>
                                </div>
                            ))
                        )}
                    </section>

                    <section className="p-card">
                        <div className="p-section-heading">
                            <div>
                                <p className="p-eyebrow">Sessions</p>
                                <h2 className="p-section-title">Team Schedule</h2>
                            </div>
                            {isTeamLeader && (
                                <button className="p-btn p-btn--secondary p-btn--inline" onClick={() => navigate("/games/create")}>
                                    Create Session
                                </button>
                            )}
                        </div>

                        <div className="p-section">
                            <h3>Upcoming</h3>
                            {upcomingGames.length === 0 ? (
                                <p className="p-empty">No team sessions scheduled.</p>
                            ) : (
                                upcomingGames.map((game) => (
                                    <button
                                        key={game.id}
                                        className="p-game-item"
                                        onClick={() => navigate(`/games/${game.id}`)}
                                    >
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
                                <p className="p-empty">No completed team sessions yet.</p>
                            ) : (
                                pastGames.slice(0, 4).map((game) => (
                                    <button
                                        key={game.id}
                                        className="p-game-item"
                                        onClick={() => navigate(`/games/${game.id}`)}
                                    >
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
                    </section>
                </div>
            </div>
        </div>
    );
}
