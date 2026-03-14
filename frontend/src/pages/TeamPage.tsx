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
    const [userRole, setUserRole] = useState<string>("")
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

    if (loading) return <div className="p-container"><div className="p-card"><p className="p-empty">Loading...</p></div></div>;
    if (error || !team) return <div className="p-container"><div className="p-card"><p className="p-empty">{error || "Team not found"}</p></div></div>;

    return (
        <div className="p-container">
            <div className="p-card">
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', marginBottom: '16px', padding: 0, fontSize: '0.875rem' }}
                >
                    ← Back
                </button>

                <h1 style={{ color: 'white', margin: '0 0 4px' }}>{team.name}</h1>
                <p className="p-email">Team Code: {team.join_code}</p>

                <div className="p-section">
                    <h3>Members</h3>
                    {members.map((m) => (
                        <div key={m.id} className="p-member-item">
                            <span className="p-member-email">{m.email}</span>
                            <span className="p-member-role">{m.role}</span>
                        </div>
                    ))}
                </div>

                <div className="p-section">
                    <h3>Team Sessions</h3>
                    {games.length === 0 ? (
                        <p className="p-empty">No team sessions yet.</p>
                    ) : (
                        games.map((game) => (
                            <button
                                key={game.id}
                                className="p-game-item"
                                onClick={() => navigate(`/games/${game.id}`)}
                            >
                                <span className="p-game-title">{game.title}</span>
                                <span className="p-game-code">{game.session_code}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}