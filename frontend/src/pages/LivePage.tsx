import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../styles/common.css";
import "../styles/LivePage.css";

type ActiveGame = {
    id: number;
    title: string;
    session_code: string;
    game_time: string;
    can_accept_uploads?: boolean;
};

type MockLiveClip = {
    id: number;
    angle: string;
    camera: string;
    status: string;
    startedAgo: string;
    viewers: number;
    tags: string[];
};

const MOCK_LIVE_CLIPS: MockLiveClip[] = [
    {
        id: 1,
        angle: "Halfway Line",
        camera: "Parent iPhone 15",
        status: "Recording live",
        startedAgo: "Started 12s ago",
        viewers: 18,
        tags: ["midfield", "wide"],
    },
    {
        id: 2,
        angle: "Goal Box",
        camera: "Coach Pixel",
        status: "Buffering upload",
        startedAgo: "Started 28s ago",
        viewers: 11,
        tags: ["attack", "close"],
    },
    {
        id: 3,
        angle: "Bench Side",
        camera: "Dad Galaxy",
        status: "Recording live",
        startedAgo: "Started 41s ago",
        viewers: 7,
        tags: ["sideline", "player reactions"],
    },
];

export default function LivePage() {
    const navigate = useNavigate();
    const [games, setGames] = useState<ActiveGame[]>([]);
    const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchLiveSessions = async () => {
            try {
                if (!supabase) throw new Error("Supabase not initialized");
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");

                const response = await fetch("http://localhost:8000/api/games/attachable/", {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });

                if (!response.ok) throw new Error(`Error ${response.status}`);

                const data: ActiveGame[] = await response.json();
                const liveGames = data.filter((game) => game.can_accept_uploads);
                setGames(liveGames);
                setSelectedGameId((current) => current ?? liveGames[0]?.id ?? null);
            } catch (err: unknown) {
                setError((err as Error).message || "Unable to load live sessions");
            } finally {
                setLoading(false);
            }
        };

        fetchLiveSessions();
    }, []);

    const selectedGame = useMemo(
        () => games.find((game) => game.id === selectedGameId) ?? games[0] ?? null,
        [games, selectedGameId],
    );

    if (loading) {
        return (
            <div className="live-container">
                <div className="live-shell">
                    <p className="live-empty">Loading live sessions...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="live-container">
                <div className="live-shell">
                    <p className="live-empty">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="live-container">
            <div className="live-shell">
                <section className="live-hero">
                    <div>
                        <p className="live-eyebrow">Live Session Feed</p>
                        <h1 className="live-title">Watch sideline captures as they come in</h1>
                        <p className="live-subtitle">
                            This is the base live view for now.
                        </p>
                    </div>
                    {selectedGame && (
                        <button
                            type="button"
                            className="live-open-btn"
                            onClick={() => navigate(`/games/${selectedGame.id}`)}
                        >
                            Open Session
                        </button>
                    )}
                </section>

                {!selectedGame ? (
                    <section className="live-empty-card">
                        <div className="live-empty-illustration">No Live Session</div>
                        <h2>No active session right now</h2>
                        <p>
                            The live clip placeholders will appear here.
                        </p>
                    </section>
                ) : (
                    <>
                        <section className="live-session-card">
                            <div className="live-session-header">
                                <div>
                                    <div className="live-status-row">
                                        <span className="live-status-dot" />
                                        <span className="live-status-text">Session active</span>
                                    </div>
                                    <h2 className="live-session-title">{selectedGame.title}</h2>
                                    <p className="live-session-meta">
                                        {new Date(selectedGame.game_time).toLocaleString(undefined, {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        })}{" "}
                                        • Code {selectedGame.session_code}
                                    </p>
                                </div>

                                {games.length > 1 && (
                                    <label className="live-session-picker">
                                        <span>Switch session</span>
                                        <select
                                            value={selectedGame.id}
                                            onChange={(event) => setSelectedGameId(Number(event.target.value))}
                                        >
                                            {games.map((game) => (
                                                <option key={game.id} value={game.id}>
                                                    {game.title}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </div>

                            <div className="live-stat-row">
                                <div className="live-stat-card">
                                    <span className="live-stat-value">{MOCK_LIVE_CLIPS.length}</span>
                                    <span className="live-stat-label">Live angles</span>
                                </div>
                                <div className="live-stat-card">
                                    <span className="live-stat-value">
                                        {MOCK_LIVE_CLIPS.reduce((sum, clip) => sum + clip.viewers, 0)}
                                    </span>
                                    <span className="live-stat-label">Watching now</span>
                                </div>
                                <div className="live-stat-card">
                                    <span className="live-stat-value">Mock</span>
                                    <span className="live-stat-label">Feed mode</span>
                                </div>
                            </div>
                        </section>

                        <section className="live-grid">
                            {MOCK_LIVE_CLIPS.map((clip) => (
                                <article key={clip.id} className="live-card">
                                    <div className="live-thumb">
                                        <div className="live-badge">{clip.status}</div>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="live-thumb-icon">
                                            <rect x="2" y="4" width="15" height="16" rx="2" />
                                            <path d="M17 9l5-3v12l-5-3V9z" />
                                        </svg>
                                    </div>

                                    <div className="live-card-body">
                                        <div className="live-card-top">
                                            <div>
                                                <h3 className="live-card-title">{clip.angle}</h3>
                                                <p className="live-card-meta">{clip.camera}</p>
                                            </div>
                                            <span className="live-viewer-pill">{clip.viewers} watching</span>
                                        </div>

                                        <p className="live-card-copy">
                                            {clip.startedAgo} for <strong>{selectedGame.title}</strong>. Real-time footage from the Expo recorder will slot in here.
                                        </p>

                                        <div className="live-tag-row">
                                            {clip.tags.map((tag) => (
                                                <span key={tag} className="live-tag">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
