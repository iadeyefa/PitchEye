import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles/CreateGame.css";

type GameProps = {
    id: number;
    title: string;
    session_code: string;
    qr_code_url: string;
    game_time: string;
};

export default function CreateGame() {
    const [title, setTitle] = useState("");
    const [gameTime, setGameTime] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<GameProps | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");

        if (!title.trim()) { setError("Game title is required"); return; }
        if (!gameTime) { setError("Game time is required"); return; }

        setLoading(true);
        try {
            if (!supabase) throw new Error("Supabase not initialized");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch("http://localhost:8000/api/games/create/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ title: title.trim(), game_time: gameTime }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || `Error ${response.status}`);
            }

            const game: GameProps = await response.json();
            setResult(game);
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to create game");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setResult(null);
        setTitle("");
        setGameTime("");
        setError("");
    };

    if (result) {
        const qrUrl = result.qr_code_url;

        return (
            <div className="cg-container">
                <div className="cg-card">
                    <p className="cg-eyebrow">Now Live</p>
                    <h2 className="cg-title">{result.title}</h2>
                    <p className="cg-subtitle">
                        {new Date(result.game_time).toLocaleString(undefined, {
                            dateStyle: "medium", timeStyle: "short",
                        })}
                    </p>

                    <div className="cg-session-block">
                        <span className="cg-session-label">SESSION CODE</span>
                        <span className="cg-session-code">{result.session_code}</span>
                    </div>

                    {qrUrl && (
                        <div className="cg-qr-wrapper">
                            <img src={qrUrl} alt="QR Code" className="cg-qr" />
                            <p className="cg-hint">Scan to join</p>
                        </div>
                    )}

                    <button className="cg-btn-secondary" onClick={reset}>+ New Game</button>
                </div>
            </div>
        );
    }

    return (
        <div className="cg-container">
            <div className="cg-card">
                <h1 className="cg-title">Create Game</h1>
                <p className="cg-subtitle">Set up a new session for your team</p>

                {error && <div className="cg-error">{error}</div>}

                <form onSubmit={handleSubmit} className="cg-form">
                    <div className="cg-field">
                        <label className="cg-label" htmlFor="game-title">Game Title</label>
                        <input
                            id="game-title"
                            className="cg-input"
                            type="text"
                            placeholder="Enter Game Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="cg-field">
                        <label className="cg-label" htmlFor="game-time">Date & Time</label>
                        <input
                            id="game-time"
                            className="cg-input"
                            type="datetime-local"
                            value={gameTime}
                            onChange={(e) => setGameTime(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="cg-btn-primary" disabled={loading || !title || ! gameTime}>
                        {loading ? "Generating..." : "Create Game"}
                    </button>
                </form>
            </div>
        </div>
    );
}