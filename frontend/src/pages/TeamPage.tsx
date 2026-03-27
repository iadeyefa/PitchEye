import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
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
};

export default function TeamPage() {
    const navigate = useNavigate();
    const [team, setTeam] = useState<Team | null>(null);
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

    if (loading) return <div className="p-container"><div className="p-card"><p className="p-empty">Loading...</p></div></div>;
    if (error || !team) return <div className="p-container"><div className="p-card"><p className="p-empty">{error || "Team not found"}</p></div></div>;

    return (
        <div className="p-container">
            <div className="p-layout">
                <section className="p-card p-card--hero">
                    <button className="p-back-btn" onClick={() => navigate(-1)}>
                        ← Back
                    </button>

                    <p className="p-eyebrow">Team Workspace</p>
                    <h1>{team.name}</h1>
                    <p className="p-title">
                        Manage roster, share the join code, and keep team sessions in one place.
                    </p>

                    <div className="p-team-banner">
                        <div>
                            <p className="p-team-kicker">Join code</p>
                            <h2 className="p-team-banner-code">{team.join_code}</h2>
                        </div>
                        <button className="p-btn p-btn--secondary" onClick={handleCopyCode}>
                            Copy code
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
                                            {m.role === userRole ? "Same role as you" : "Active member"}
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
                                <h2 className="p-section-title">Team schedule</h2>
                            </div>
                            {isTeamLeader && (
                                <button className="p-inline-link" onClick={() => navigate("/games/create")}>
                                    Create session
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
                                        <span className="p-game-code">{game.session_code}</span>
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
                                        <span className="p-game-code">{game.session_code}</span>
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
