import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles/common.css";
import "../styles/CreateGame.css";

type GameProps = {
    id: number;
    title: string;
    session_code: string;
    qr_code_url: string | { signedURL?: string; signed_url?: string };
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
        const qrUrl = typeof result.qr_code_url === "object"
            ? (result.qr_code_url as any).signedURL ?? (result.qr_code_url as any).signed_url
            : result.qr_code_url;

        return (
            <div className="app-card-container">
                <div className="app-card">
                    <p className="app-card-eyebrow">Now Live</p>
                    <h2 className="app-card-title">{result.title}</h2>
                    <p className="app-card-subtitle">
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
                            <p className="app-card-hint">Scan to join</p>
                        </div>
                    )}

                    <button className="app-card-btn-secondary" onClick={reset}>+ New Game</button>
                </div>
            </div>
        );
    }

    return (
        <div className="app-card-container">
            <div className="app-card">
                <h1 className="app-card-title">Create Game</h1>
                <p className="app-card-subtitle">Set up a new session for your team</p>

                {error && <div className="app-card-error">{error}</div>}

                <form onSubmit={handleSubmit} className="app-card-form">
                    <div className="app-card-field">
                        <label className="app-card-label" htmlFor="game-title">Game Title</label>
                        <input
                            id="game-title"
                            className="app-card-input"
                            type="text"
                            placeholder="Enter Game Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="app-card-field">
                        <label className="app-card-label" htmlFor="game-time">Date & Time</label>
                        <input
                            id="game-time"
                            className="app-card-input"
                            type="datetime-local"
                            value={gameTime}
                            onChange={(e) => setGameTime(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="app-card-btn-primary" disabled={loading}>
                        {loading ? "Generating..." : "Create Game"}
                    </button>
                </form>
            </div>
        </div>
    );
}
