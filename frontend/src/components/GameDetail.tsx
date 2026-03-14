import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../styles/common.css";
import "../styles/CreateGame.css";

type Game = {
    id: number;
    title: string;
    session_code: string;
    qr_code_url: string;
    game_time: string;
};

export default function GameDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchGame();
    }, [id]);

    const fetchGame = async () => {
        try {
            if (!supabase) throw new Error("Supabase not initialized");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch(`http://localhost:8000/api/games/${id}/`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const data = await response.json();
            setGame(data[0]);
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="app-card-container"><div className="app-card"><p style={{color:'white'}}>Loading...</p></div></div>;
    if (error || !game) return <div className="app-card-container"><div className="app-card"><p style={{color:'#f87171'}}>{error || "Game not found"}</p></div></div>;

    return (
        <div className="app-card-container">
            <div className="app-card">
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', marginBottom: '16px', padding: 0 }}
                >
                    ← Back
                </button>
                <p className="app-card-eyebrow">Game Session</p>
                <h2 className="app-card-title">{game.title}</h2>
                <p className="app-card-subtitle">
                    {new Date(game.game_time).toLocaleString(undefined, {
                        dateStyle: "medium", timeStyle: "short",
                    })}
                </p>

                <div className="cg-session-block">
                    <span className="cg-session-label">SESSION CODE</span>
                    <span className="cg-session-code">{game.session_code}</span>
                </div>

                {game.qr_code_url && (
                    <div className="cg-qr-wrapper">
                        <img src={game.qr_code_url} alt="QR Code" className="cg-qr" />
                        <p className="app-card-hint">Scan to join</p>
                    </div>
                )}
            </div>
        </div>
    );
}