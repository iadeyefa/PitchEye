import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
    recorded_at?: string;
    video_url: string;
    original_filename?: string;
    duration?: number | null;
    time_offset?: number | null;
    start_time?: number | null;
    end_time?: number | null;
};

type SyncClip = Clip & {
    syncStart: number;
    syncEnd: number;
    syncDuration: number;
};

export default function GameDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [game, setGame] = useState<Game | null>(null);
    const [clips, setClips] = useState<Clip[]>([]);
    const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
    const [syncOpen, setSyncOpen] = useState(false);
    const [syncCurrentTime, setSyncCurrentTime] = useState(0);
    const [syncPlaying, setSyncPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [shareFeedback, setShareFeedback] = useState("");
    const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
    const playbackAnchorRef = useRef<{ wallClock: number; timeline: number } | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const fetchGame = useCallback(async () => {
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
    }, [id]);

    useEffect(() => {
        fetchGame();
    }, [fetchGame]);

    useEffect(() => {
        if (!selectedClip) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setSelectedClip(null);
                setShareFeedback("");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedClip]);

    const getClipTitle = (clip: Clip) => clip.original_filename || `Clip #${clip.id}`;

    const getClipTimestamp = (clip: Clip) =>
        clip.uploaded_at
            ? new Date(clip.uploaded_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
            })
            : "Recently uploaded";

    const formatTimelineTime = (seconds: number) => {
        const safeSeconds = Math.max(0, Math.floor(seconds));
        const mins = Math.floor(safeSeconds / 60);
        const secs = safeSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const syncClips = useMemo<SyncClip[]>(() => {
        if (!game) return [];

        const gameStart = new Date(game.game_time).getTime();

        return clips
            .map((clip) => {
                const explicitStart = typeof clip.start_time === "number" ? clip.start_time : null;
                const explicitOffset = typeof clip.time_offset === "number" ? clip.time_offset : null;
                const derivedOffset = clip.recorded_at
                    ? (new Date(clip.recorded_at).getTime() - gameStart) / 1000
                    : null;
                const start = explicitStart ?? explicitOffset ?? derivedOffset ?? 0;

                const duration = typeof clip.duration === "number" && Number.isFinite(clip.duration) && clip.duration > 0
                    ? clip.duration
                    : 0;

                const explicitEnd = typeof clip.end_time === "number" ? clip.end_time : null;
                const end = explicitEnd ?? (start + duration);

                return {
                    ...clip,
                    syncStart: Number.isFinite(start) ? Math.max(0, start) : 0,
                    syncEnd: Number.isFinite(end) ? Math.max(start, end) : Math.max(start, start + duration),
                    syncDuration: duration,
                };
            })
            .sort((a, b) => a.syncStart - b.syncStart);
    }, [clips, game]);

    const syncTimelineEnd = useMemo(() => {
        if (syncClips.length === 0) return 0;
        return Math.max(
            ...syncClips.map((clip) => {
                const fallbackEnd = clip.syncDuration > 0 ? clip.syncStart + clip.syncDuration : clip.syncStart + 15;
                return Math.max(clip.syncEnd, fallbackEnd);
            }),
        );
    }, [syncClips]);

    const syncVideosToTime = useCallback((timelineTime: number, shouldPlay: boolean) => {
        syncClips.forEach((clip) => {
            const video = videoRefs.current[clip.id];
            if (!video) return;

            const clipEnd = clip.syncDuration > 0 ? clip.syncStart + clip.syncDuration : clip.syncEnd;
            const isActive = timelineTime >= clip.syncStart && (clip.syncDuration <= 0 || timelineTime <= clipEnd);

            if (!isActive) {
                video.pause();
                if (timelineTime < clip.syncStart && Math.abs(video.currentTime) > 0.25) {
                    video.currentTime = 0;
                }
                return;
            }

            const desiredTime = Math.max(0, timelineTime - clip.syncStart);
            if (Math.abs(video.currentTime - desiredTime) > 0.35) {
                video.currentTime = desiredTime;
            }

            if (shouldPlay) {
                void video.play().catch(() => undefined);
            } else {
                video.pause();
            }
        });
    }, [syncClips]);

    useEffect(() => {
        if (!syncOpen) {
            setSyncPlaying(false);
            playbackAnchorRef.current = null;
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        syncVideosToTime(syncCurrentTime, false);
    }, [syncOpen, syncCurrentTime, syncVideosToTime]);

    useEffect(() => {
        if (!syncPlaying || !syncOpen) {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            syncVideosToTime(syncCurrentTime, false);
            return;
        }

        playbackAnchorRef.current = {
            wallClock: performance.now(),
            timeline: syncCurrentTime,
        };

        const tick = () => {
            const anchor = playbackAnchorRef.current;
            if (!anchor) return;

            const elapsed = (performance.now() - anchor.wallClock) / 1000;
            const nextTime = Math.min(syncTimelineEnd, anchor.timeline + elapsed);
            setSyncCurrentTime(nextTime);
            syncVideosToTime(nextTime, true);

            if (nextTime >= syncTimelineEnd) {
                setSyncPlaying(false);
                playbackAnchorRef.current = null;
                return;
            }

            animationFrameRef.current = requestAnimationFrame(tick);
        };

        animationFrameRef.current = requestAnimationFrame(tick);

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [syncPlaying, syncOpen, syncCurrentTime, syncTimelineEnd, syncVideosToTime]);

    const handleShareClip = async (clip: Clip) => {
        const shareData = {
            title: getClipTitle(clip),
            text: `Watch ${getClipTitle(clip)} from ${game?.title ?? "this session"}`,
            url: clip.video_url,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                setShareFeedback("Share sheet opened.");
                return;
            }

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(clip.video_url);
                setShareFeedback("Clip link copied to clipboard.");
                return;
            }

            setShareFeedback("Sharing is not supported on this device.");
        } catch (err) {
            if ((err as Error).name === "AbortError") {
                return;
            }
            setShareFeedback("Unable to share this clip right now.");
        }
    };

    const openSyncView = () => {
        setSyncCurrentTime(0);
        setSyncPlaying(false);
        setSyncOpen(true);
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
                    <span className={`cg-session-code ${game.qr_code_active ? "" : "cg-session-code--inactive"}`}>
                        {game.qr_code_active ? game.session_code : "INACTIVE"}
                    </span>
                </div>

                {game.qr_code_url && game.qr_code_active ? (
                    <div className="cg-qr-wrapper">
                        <img src={game.qr_code_url} alt="QR Code" className="cg-qr" />
                        <p className="app-card-hint">
                            {game.can_accept_uploads ? "Scan to join" : game.qr_code_active ? "Session has not started yet" : "QR code expired"}
                        </p>
                    </div>
                ) : (
                    <div className="cg-qr-wrapper">
                        <div className="cg-qr cg-qr--placeholder">Inactive</div>
                        <p className="app-card-hint">Session code inactive</p>
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
                        <div className="cg-clips-header-actions">
                            {clips.length > 0 && (
                                <button type="button" className="cg-sync-trigger" onClick={openSyncView}>
                                    Sync View
                                </button>
                            )}
                            <span className="app-card-hint">{clips.length} total</span>
                        </div>
                    </div>
                    {clips.length === 0 ? (
                        <p className="app-card-hint">No clips attached yet.</p>
                    ) : (
                        <div className="cg-clips-list">
                            {clips.map((clip) => (
                                <button
                                    key={clip.id}
                                    type="button"
                                    className="cg-clip-item"
                                    onClick={() => {
                                        setSelectedClip(clip);
                                        setShareFeedback("");
                                    }}
                                >
                                    <div>
                                        <span className="cg-clip-title">{getClipTitle(clip)}</span>
                                        <span className="cg-clip-meta">{getClipTimestamp(clip)}</span>
                                    </div>
                                    <span className="cg-clip-link">View</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedClip && (
                <div
                    className="cg-viewer-overlay"
                    onClick={() => {
                        setSelectedClip(null);
                        setShareFeedback("");
                    }}
                    role="presentation"
                >
                    <div
                        className="cg-viewer-modal"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Viewer for ${getClipTitle(selectedClip)}`}
                    >
                        <div className="cg-viewer-header">
                            <div>
                                <p className="cg-viewer-title">{getClipTitle(selectedClip)}</p>
                                <p className="cg-viewer-meta">{getClipTimestamp(selectedClip)}</p>
                            </div>
                            <button
                                type="button"
                                className="cg-viewer-close"
                                onClick={() => {
                                    setSelectedClip(null);
                                    setShareFeedback("");
                                }}
                                aria-label="Close clip viewer"
                            >
                                ×
                            </button>
                        </div>

                        <div className="cg-viewer-video-shell">
                            <video
                                className="cg-viewer-video"
                                src={selectedClip.video_url}
                                controls
                                playsInline
                                autoPlay
                            >
                                Your browser does not support video playback.
                            </video>
                        </div>

                        <div className="cg-viewer-actions">
                            <a
                                className="app-card-btn-secondary cg-viewer-action"
                                href={selectedClip.video_url}
                                download={getClipTitle(selectedClip)}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Download
                            </a>
                            <button
                                type="button"
                                className="app-card-btn-primary cg-viewer-action"
                                onClick={() => handleShareClip(selectedClip)}
                            >
                                Share
                            </button>
                        </div>

                        {shareFeedback && <p className="cg-viewer-feedback">{shareFeedback}</p>}
                    </div>
                </div>
            )}

            {syncOpen && (
                <div
                    className="cg-viewer-overlay"
                    onClick={() => {
                        setSyncOpen(false);
                        setSyncPlaying(false);
                    }}
                    role="presentation"
                >
                    <div
                        className="cg-sync-modal"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Synchronized clips for ${game.title}`}
                    >
                        <div className="cg-viewer-header">
                            <div>
                                <p className="cg-viewer-title">Sync View</p>
                                <p className="cg-viewer-meta">
                                    Clips are aligned to the session timeline using each clip&apos;s recorded time or stored offset.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="cg-viewer-close"
                                onClick={() => {
                                    setSyncOpen(false);
                                    setSyncPlaying(false);
                                }}
                                aria-label="Close synchronized viewer"
                            >
                                ×
                            </button>
                        </div>

                        <div className="cg-sync-controls">
                            <button
                                type="button"
                                className="app-card-btn-primary cg-sync-play"
                                onClick={() => setSyncPlaying((value) => !value)}
                                disabled={syncTimelineEnd <= 0}
                            >
                                {syncPlaying ? "Pause" : "Play"} timeline
                            </button>
                            <div className="cg-sync-scrubber">
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(syncTimelineEnd, 0)}
                                    step={0.1}
                                    value={syncCurrentTime}
                                    onChange={(event) => {
                                        const nextValue = Number(event.target.value);
                                        setSyncPlaying(false);
                                        setSyncCurrentTime(nextValue);
                                    }}
                                />
                                <div className="cg-sync-time-row">
                                    <span>{formatTimelineTime(syncCurrentTime)}</span>
                                    <span>{formatTimelineTime(syncTimelineEnd)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="cg-sync-track">
                            {syncClips.map((clip) => {
                                const width = syncTimelineEnd > 0
                                    ? Math.max(8, ((clip.syncDuration || 8) / syncTimelineEnd) * 100)
                                    : 100;
                                const left = syncTimelineEnd > 0 ? (clip.syncStart / syncTimelineEnd) * 100 : 0;

                                return (
                                    <div key={clip.id} className="cg-sync-track-row">
                                        <span className="cg-sync-track-label">{getClipTitle(clip)}</span>
                                        <div className="cg-sync-track-bar">
                                            <div
                                                className="cg-sync-track-segment"
                                                style={{ width: `${width}%`, left: `${left}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="cg-sync-grid">
                            {syncClips.map((clip) => {
                                const clipDuration = clip.syncDuration > 0 ? clip.syncDuration : Math.max(0, clip.syncEnd - clip.syncStart);
                                const isActive = syncCurrentTime >= clip.syncStart
                                    && (clipDuration <= 0 || syncCurrentTime <= clip.syncStart + clipDuration);

                                return (
                                    <div key={clip.id} className={`cg-sync-card ${isActive ? "cg-sync-card--active" : ""}`}>
                                        <div className="cg-sync-card-header">
                                            <div>
                                                <p className="cg-sync-card-title">{getClipTitle(clip)}</p>
                                                <p className="cg-sync-card-meta">
                                                    Starts at {formatTimelineTime(clip.syncStart)}
                                                    {clipDuration > 0 ? ` • ${Math.round(clipDuration)}s long` : ""}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="cg-sync-open-link"
                                                onClick={() => {
                                                    setSyncOpen(false);
                                                    setSyncPlaying(false);
                                                    setSelectedClip(clip);
                                                    setShareFeedback("");
                                                }}
                                            >
                                                Open
                                            </button>
                                        </div>

                                        <div className="cg-sync-video-shell">
                                            <video
                                                ref={(node) => {
                                                    videoRefs.current[clip.id] = node;
                                                }}
                                                className="cg-sync-video"
                                                src={clip.video_url}
                                                muted
                                                playsInline
                                                preload="metadata"
                                            />
                                            {!isActive && (
                                                <div className="cg-sync-video-state">
                                                    {syncCurrentTime < clip.syncStart
                                                        ? `Begins at ${formatTimelineTime(clip.syncStart)}`
                                                        : "Clip ended"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
