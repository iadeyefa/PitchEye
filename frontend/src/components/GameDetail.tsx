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
    qr_code_active?: boolean;
    session_started?: boolean;
    can_accept_uploads?: boolean;
};

type Clip = {
    id: number;
    uploaded_at?: string;
    video_url: string;
    original_filename?: string;
};

export default function GameDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [game, setGame] = useState<Game | null>(null);
    const [clips, setClips] = useState<Clip[]>([]);
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

            const [gameResponse, clipsResponse] = await Promise.all([
                fetch(`http://localhost:8000/api/games/${id}/`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                }),
                fetch(`http://localhost:8000/api/videos/game/${id}/`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                }),
            ]);
            if (!gameResponse.ok) throw new Error(`Error ${gameResponse.status}`);
            if (!clipsResponse.ok) throw new Error(`Error ${clipsResponse.status}`);
            const data = await gameResponse.json();
            const clipsData = await clipsResponse.json();
            setGame(data[0]);
            setClips(clipsData);
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
                        <p className="app-card-hint">
                            {game.can_accept_uploads ? "Scan to join" : game.qr_code_active ? "Session has not started yet" : "QR code expired"}
                        </p>
                    </div>
                )}

                <div className="cg-session-actions">
                    {game.can_accept_uploads ? (
                        <button className="app-card-btn-primary" onClick={() => navigate(`/upload?gameId=${game.id}`)}>
                            Upload Clip To Session
                        </button>
                    ) : (
                        <div className="cg-expired-note">
                            {game.qr_code_active
                                ? "This session has not started yet, so clips cannot be attached to it yet."
                                : "This session QR code has expired, so new clips can no longer be attached to it."}
                        </div>
                    )}
                </div>

                <div className="cg-clips-section">
                    <div className="cg-clips-header">
                        <p className="app-card-eyebrow">Attached Clips</p>
                        <span className="app-card-hint">{clips.length} total</span>
                    </div>
                    {clips.length === 0 ? (
                        <p className="app-card-hint">No clips attached yet.</p>
                    ) : (
                        <div className="cg-clips-list">
                            {clips.map((clip) => (
                                <a key={clip.id} className="cg-clip-item" href={clip.video_url} target="_blank" rel="noreferrer">
                                    <div>
                                        <span className="cg-clip-title">{clip.original_filename || `Clip #${clip.id}`}</span>
                                        <span className="cg-clip-meta">
                                            {clip.uploaded_at
                                                ? new Date(clip.uploaded_at).toLocaleString(undefined, {
                                                    dateStyle: "medium",
                                                    timeStyle: "short",
                                                })
                                                : "Recently uploaded"}
                                        </span>
                                    </div>
                                    <span className="cg-clip-link">View</span>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
