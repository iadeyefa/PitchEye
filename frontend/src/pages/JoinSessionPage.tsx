import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../styles/common.css";
import { addJoinedSessionCode, JoinedSessionGame, removeJoinedSessionCode } from "../utils/joinedSessions";

export default function JoinSessionPage() {
    const navigate = useNavigate();
    const { sessionCode: routeSessionCode } = useParams<{ sessionCode?: string }>();
    const [sessionCode, setSessionCode] = useState((routeSessionCode || "").toUpperCase());
    const [joinedGame, setJoinedGame] = useState<JoinedSessionGame | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const normalizedSessionCode = sessionCode.trim().toUpperCase();
    const hasJoinedCurrentSession =
        !!joinedGame && joinedGame.session_code.toUpperCase() === normalizedSessionCode;

    useEffect(() => {
        setSessionCode((routeSessionCode || "").toUpperCase());
    }, [routeSessionCode]);

    const joinSession = async (codeOverride?: string) => {
        const normalizedCode = (codeOverride || sessionCode).trim().toUpperCase();
        if (!normalizedCode) {
            setError("Enter a session code");
            return;
        }

        setLoading(true);
        setError("");
        try {
            if (!supabase) throw new Error("Supabase not initialized");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch(`http://localhost:8000/api/games/join/${normalizedCode}/`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || "Session not found");
            }

            addJoinedSessionCode(session.user.id, normalizedCode);
            setJoinedGame(payload as JoinedSessionGame);
            setSessionCode(normalizedCode);
        } catch (err: unknown) {
            setJoinedGame(null);
            setError((err as Error).message || "Unable to join session");
        } finally {
            setLoading(false);
        }
    };

    const leaveSession = async () => {
        if (!joinedGame || !supabase) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            setError("Not authenticated");
            return;
        }

        removeJoinedSessionCode(session.user.id, joinedGame.session_code);
        setJoinedGame(null);
        setError("");
    };

    useEffect(() => {
        if (routeSessionCode) {
            joinSession(routeSessionCode);
        }
    }, [routeSessionCode]);

    return (
        <div className="app-card-container">
            <div className="app-card">
                <p className="app-card-eyebrow">Session Access</p>
                <h1 className="app-card-title">Join Session</h1>
                <p className="app-card-subtitle">
                    Enter a session code to follow a live session, open its page, or upload clips later.
                </p>

                {error && <div className="app-card-error">{error}</div>}

                <form
                    className="app-card-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        joinSession();
                    }}
                >
                    <div className="app-card-field">
                        <label className="app-card-label" htmlFor="session-code">Session Code</label>
                        <input
                            id="session-code"
                            className="app-card-input"
                            type="text"
                            value={sessionCode}
                            onChange={(event) => setSessionCode(event.target.value.toUpperCase())}
                            placeholder="Enter session code"
                            maxLength={10}
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="app-card-btn-primary"
                        disabled={loading || !sessionCode.trim() || hasJoinedCurrentSession}
                    >
                        {loading ? "Joining..." : hasJoinedCurrentSession ? "Session Joined" : "Join Session"}
                    </button>
                </form>

                {joinedGame && (
                    <div style={{ marginTop: 20 }}>
                        <div className="app-card-success">
                            Joined <strong>{joinedGame.title}</strong> with code {joinedGame.session_code}.
                        </div>
                        <div className="app-card-form" style={{ marginTop: 16 }}>
                            <button
                                type="button"
                                className="app-card-btn-secondary"
                                onClick={leaveSession}
                            >
                                Leave Session
                            </button>
                            <button
                                type="button"
                                className="app-card-btn-primary"
                                onClick={() => navigate(`/games/${joinedGame.id}`)}
                            >
                                Open Session
                            </button>
                            <button
                                type="button"
                                className="app-card-btn-secondary"
                                onClick={() => navigate("/live")}
                            >
                                View Live Feed
                            </button>
                            <button
                                type="button"
                                className="app-card-btn-secondary"
                                onClick={() => navigate(`/upload?gameId=${joinedGame.id}`)}
                            >
                                Upload Clip
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
