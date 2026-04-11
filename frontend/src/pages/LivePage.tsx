import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import LiveStreamPlayer from "../components/LiveStreamPlayer";
import "../styles/common.css";
import "../styles/LivePage.css";

const SRS_API = process.env.REACT_APP_SRS_API;
const SRS_HTTP = process.env.REACT_APP_SRS_HTTP;
const API_BASE = "http://localhost:8000/api";

type ActiveGame = {
    id: number;
    title: string;
    session_code: string;
    game_time: string;
    can_accept_uploads?: boolean;
    created_by: string;
};

type SrsStream = {
    name: string;
    app: string;
};

type StreamInfo = {
    id: string;
    stream_key: string;
    rtmp_url: string;
    hls_url: string;
    status: string;
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
    const [userId, setUserId] = useState<string | null>(null);
    const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const fetchLiveSessions = async () => {
            try {
                if (!supabase) throw new Error("Supabase not initialized");
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");
                
                setUserId(session.user.id);

                const response = await fetch(`${API_BASE}/games/attachable/`, {
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

    useEffect(() => {
        const checkStreamStatus = async () => {
            if (!selectedGame) return;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                
                const res = await fetch(
                    `${API_BASE}/streams/session/${selectedGame.session_code}/`,
                    { headers: { Authorization: `Bearer ${session.access_token}` } }
                );
                if (res.ok) {
                    const data = await res.json();
                    setStreamInfo(data);
                } else {
                    setStreamInfo(null);
                }
            } catch {
                setStreamInfo(null);
            }
        };
        
        checkStreamStatus();
    }, [selectedGame]);

    const selectedGame = useMemo(
        () => games.find((game) => game.id === selectedGameId) ?? games[0] ?? null,
        [games, selectedGameId],
    );

    const isHost = useMemo(() => {
        return selectedGame && userId && selectedGame.created_by === userId;
    }, [selectedGame, userId]);

    const handleStartStream = async () => {
        if (!selectedGame || !userId) return;
        setIsStarting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");
            
            const res = await fetch(`${API_BASE}/streams/start/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ game_id: selectedGame.id }),
            });
            
            if (!res.ok) throw new Error("Failed to start stream");
            const data = await res.json();
            setStreamInfo(data);
        } catch (err) {
            alert("Failed to start stream");
        } finally {
            setIsStarting(false);
        }
    };

    const handleEndStream = async () => {
        if (!streamInfo) return;
        setIsEnding(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");
            
            const res = await fetch(`${API_BASE}/streams/end/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ stream_key: streamInfo.stream_key }),
            });
            
            if (!res.ok) throw new Error("Failed to end stream");
            setStreamInfo(null);
        } catch (err) {
            alert("Failed to end stream");
        } finally {
            setIsEnding(false);
        }
    };

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
                                {isHost && (
                                    <div className="live-stat-card">
                                        {!streamInfo ? (
                                            <button
                                                className="live-open-btn"
                                                onClick={handleStartStream}
                                                disabled={isStarting}
                                            >
                                                {isStarting ? "Starting..." : "Go Live"}
                                            </button>
                                        ) : (
                                            <button
                                                className="live-open-btn"
                                                onClick={handleEndStream}
                                                disabled={isEnding}
                                                style={{ backgroundColor: "#dc2626" }}
                                            >
                                                {isEnding ? "Ending..." : "End Stream"}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                        {streamInfo && (
                            <section className="live-session-card">
                                <div className="live-session-header">
                                    <div>
                                        <div className="live-status-row">
                                            <span className="live-status-dot" style={{ backgroundColor: "#22c55e" }} />
                                            <span className="live-status-text">You are live</span>
                                        </div>
                                        <h2 className="live-session-title">Stream Key</h2>
                                        <p className="live-session-meta" style={{ fontFamily: "monospace" }}>
                                            {streamInfo.stream_key}
                                        </p>
                                    </div>
                                </div>
                                <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
                                    RTMP URL: {streamInfo.rtmp_url}
                                </p>
                            </section>
                        )}

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
