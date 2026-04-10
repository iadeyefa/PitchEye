import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import LiveStreamPlayer from "../components/LiveStreamPlayer";
import "../styles/common.css";
import "../styles/LivePage.css";

const SRS_API = process.env.REACT_APP_SRS_API;
const SRS_HTTP = process.env.REACT_APP_SRS_HTTP;

type ActiveGame = {
    id: number;
    title: string;
    session_code: string;
    game_time: string;
    can_accept_uploads?: boolean;
};

type SrsStream = {
    name: string;
    app: string;
};

function prettifyAngle(streamName: string, sessionCode: string): string {
    const prefix = `${sessionCode}_`.toLowerCase();
    const raw = streamName.toLowerCase().startsWith(prefix)
        ? streamName.slice(prefix.length)
        : streamName;
    return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LivePage() {
    const navigate = useNavigate();
    const [games, setGames] = useState<ActiveGame[]>([]);
    const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [liveStreams, setLiveStreams] = useState<SrsStream[]>([]);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Poll SRS for active streams whenever the selected game changes
    useEffect(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (!selectedGame) { setLiveStreams([]); return; }

        const fetchStreams = async () => {
            try {
                const res = await fetch(`${SRS_API}/api/v1/streams/`);
                const json = await res.json();
                const all: SrsStream[] = json.streams ?? [];
                const prefix = selectedGame.session_code.toLowerCase() + "_";
                setLiveStreams(all.filter((s) => s.name.toLowerCase().startsWith(prefix)));
            } catch {
                // silently ignore — streams list just stays stale
            }
        };

        fetchStreams();
        pollRef.current = setInterval(fetchStreams, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [selectedGame]);

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
                            Live streams appear automatically as volunteers go live.
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
                        <p>Start a session from the dashboard to see live streams here.</p>
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
                                    <span className="live-stat-value">{liveStreams.length}</span>
                                    <span className="live-stat-label">Live angles</span>
                                </div>
                                <div className="live-stat-card">
                                    <span className="live-stat-value">
                                        {liveStreams.length > 0 ? "Live" : "Waiting"}
                                    </span>
                                    <span className="live-stat-label">Feed mode</span>
                                </div>
                            </div>
                        </section>

                        <section className="live-grid">
                            {liveStreams.length === 0 ? (
                                <p className="live-empty">
                                    No active streams yet — have a volunteer scan the QR code and go live.
                                </p>
                            ) : (
                                liveStreams.map((stream) => (
                                    <LiveStreamPlayer
                                        key={stream.name}
                                        hlsUrl={`${SRS_HTTP}/live/${stream.name}.m3u8`}
                                        label={prettifyAngle(stream.name, selectedGame.session_code)}
                                    />
                                ))
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
