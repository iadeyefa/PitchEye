import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../styles/common.css";
import "../styles/UploadClip.css";

type GameOption = {
    id: number;
    title: string;
    game_time: string;
    session_code: string;
    qr_code_active?: boolean;
    session_started?: boolean;
    can_accept_uploads?: boolean;
};

type TeamMember = {
    id: string;
    email: string;
    role: string;
    username?: string;
};

type ClipProps = {
    id: number;
    video_url: string;
    uploaded_at?: string;
    game_id: number;
    game_title?: string;
    original_filename?: string;
};

type VideoMetadata = {
    duration: number | null;
    recordedAt: string | null;
};

export default function UploadClip() {
    const navigate = useNavigate();
    const location = useLocation();
    const [video, setVideo] = useState<File | null>(null);
    const [caption, setCaption] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [games, setGames] = useState<GameOption[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [selectedGameId, setSelectedGameId] = useState("");
    const [gamesLoading, setGamesLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<ClipProps | null>(null);
    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata>({ duration: null, recordedAt: null });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const preselectedGameId = new URLSearchParams(location.search).get("gameId");

    useEffect(() => {
        const fetchGames = async () => {
            try {
                if (!supabase) throw new Error("Supabase not initialized");
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");

                const [gamesResponse, teamResponse] = await Promise.all([
                    fetch("http://localhost:8000/api/games/attachable/", {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    }),
                    fetch("http://localhost:8000/api/teams/my/", {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    }),
                ]);
                if (!gamesResponse.ok) throw new Error(`Error ${gamesResponse.status}`);
                const data: GameOption[] = await gamesResponse.json();
                setGames(data);

                if (preselectedGameId && data.some((game) => String(game.id) === preselectedGameId)) {
                    setSelectedGameId(preselectedGameId);
                } else if (data.length === 1) {
                    setSelectedGameId(String(data[0].id));
                }

                if (teamResponse.ok) {
                    const teamData = await teamResponse.json();
                    setTeamMembers(teamData.members || []);
                }
            } catch (err: unknown) {
                setError((err as Error).message || "Unable to load sessions");
            } finally {
                setGamesLoading(false);
            }
        };

        fetchGames();
    }, [preselectedGameId]);

    useEffect(() => {
        if (!video) {
            setVideoMetadata({ duration: null, recordedAt: null });
            return;
        }

        const objectUrl = URL.createObjectURL(video);
        const probe = document.createElement("video");

        const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            probe.removeAttribute("src");
            probe.load();
        };

        probe.preload = "metadata";
        probe.src = objectUrl;

        const handleLoadedMetadata = () => {
            const nextDuration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : null;
            const nextRecordedAt = Number.isFinite(video.lastModified) && video.lastModified > 0
                ? new Date(video.lastModified).toISOString()
                : null;

            setVideoMetadata({
                duration: nextDuration,
                recordedAt: nextRecordedAt,
            });
            cleanup();
        };

        const handleError = () => {
            setVideoMetadata({
                duration: null,
                recordedAt: Number.isFinite(video.lastModified) && video.lastModified > 0
                    ? new Date(video.lastModified).toISOString()
                    : null,
            });
            cleanup();
        };

        probe.onloadedmetadata = handleLoadedMetadata;
        probe.onerror = handleError;

        return () => {
            probe.onloadedmetadata = null;
            probe.onerror = null;
            cleanup();
        };
    }, [video]);

    // Tagging players
    // TODO: Incorporate player exists validation 
    const commitTag = () => {
        const val = tagInput.trim().replace(/^@/, "");
        if (val && !tags.includes(val)) setTags((prev) => [...prev, val]);
        setTagInput("");
    };

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTag(); }
        if (e.key === "Backspace" && !tagInput) setTags((prev) => prev.slice(0, -1));
    };

    const removeTag = (t: string) => setTags((prev) => prev.filter((tag) => tag !== t));
    const normalizeMemberLabel = (member: TeamMember) =>
        (member.username?.trim() || member.email.split("@")[0]).replace(/^@/, "");
    const filteredMembers = tagInput.trim()
        ? teamMembers.filter((member) => {
            const query = tagInput.trim().toLowerCase().replace(/^@/, "");
            const label = normalizeMemberLabel(member).toLowerCase();
            return (
                !tags.includes(normalizeMemberLabel(member)) &&
                (label.includes(query) || member.email.toLowerCase().includes(query))
            );
        }).slice(0, 5)
        : [];

    const addSuggestedTag = (member: TeamMember) => {
        const label = normalizeMemberLabel(member);
        if (!tags.includes(label)) setTags((prev) => [...prev, label]);
        setTagInput("");
    };

    // submitting
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");

        if (!video) { setError("Please select a video to upload"); return; }
        if (!selectedGameId) { setError("Please choose a session"); return; }

        setLoading(true);
        try {
            if (!supabase) throw new Error("Supabase not initialized");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const selectedGame = games.find((game) => String(game.id) === selectedGameId);
            const recordedAt = videoMetadata.recordedAt || new Date().toISOString();
            const duration = videoMetadata.duration;
            const timeOffset = selectedGame
                ? (new Date(recordedAt).getTime() - new Date(selectedGame.game_time).getTime()) / 1000
                : null;

            const formData = new FormData();
            formData.append("video", video);
            formData.append("game_id", selectedGameId);
            formData.append("device_id", "web-upload");
            formData.append("device_name", "Web Upload");
            formData.append("recorded_at", recordedAt);
            formData.append("caption", caption.trim());
            formData.append("tagged_players", JSON.stringify(tags));
            if (duration && duration > 0) {
                formData.append("duration", String(duration));
            }
            if (timeOffset !== null && Number.isFinite(timeOffset)) {
                const safeOffset = Math.max(0, timeOffset);
                formData.append("time_offset", String(safeOffset));
                formData.append("start_time", String(safeOffset));
                if (duration && duration > 0) {
                    formData.append("end_time", String(safeOffset + duration));
                }
            }

            const response = await fetch("http://localhost:8000/api/videos/upload/", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || "Failed to upload clip");
            }

            const clip: ClipProps = await response.json();
            setResult(clip);
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to upload clip");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setResult(null);
        setVideo(null);
        setCaption("");
        setTags([]);
        setTagInput("");
        setError("");
        setSelectedGameId(preselectedGameId || "");
    };

    if (result) {
        return (
            <div className="app-card-container">
                <div className="app-card">
                    <p className="app-card-eyebrow">Clip Posted</p>
                    <h2 className="app-card-title">{result.original_filename || video?.name || "Clip uploaded"}</h2>
                    {result.game_title && <p className="app-card-subtitle">Attached to: {result.game_title}</p>}
                    <p className="app-card-subtitle">
                        {new Date(result.uploaded_at || Date.now()).toLocaleString(undefined, {
                            dateStyle: "medium", timeStyle: "short",
                        })}
                    </p>
                    <div className="uc-action-row">
                        <button className="app-card-btn-secondary" onClick={reset}>
                            + Upload Another
                        </button>
                        <button className="app-card-btn-primary" onClick={() => navigate(`/games/${result.game_id}`)}>
                            Open Session
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-card-container">
            <div className="app-card">
                <h1 className="app-card-title">Upload Clip</h1>
                <p className="app-card-subtitle">Share a video and attach it to a session.</p>

                {error && <div className="app-card-error">{error}</div>}

                <form onSubmit={handleSubmit} className="app-card-form">
                    <div className="app-card-field">
                        <label className="app-card-label" htmlFor="clip-session">Session</label>
                        <select
                            id="clip-session"
                            className="app-card-input uc-select"
                            value={selectedGameId}
                            onChange={(e) => setSelectedGameId(e.target.value)}
                            disabled={loading || gamesLoading || games.length === 0}
                        >
                            <option value="">{gamesLoading ? "Loading sessions..." : "Select a session"}</option>
                            {games.map((game) => (
                                <option key={game.id} value={game.id}>
                                    {game.title} · {new Date(game.game_time).toLocaleDateString()} · {game.session_code}
                                </option>
                            ))}
                        </select>
                        {games.length === 0 && !gamesLoading && (
                            <span className="uc-hint">Create a session that has started and still has an active QR code before uploading a clip.</span>
                        )}
                        {games.length > 0 && (
                            <span className="uc-hint">Only sessions that have started and still have active QR codes can receive new clips.</span>
                        )}
                    </div>

                    <div className="app-card-field">
                        <label className="app-card-label">Video</label>
                        <div
                            className={`uc-dropzone ${video ? "uc-dropzone--selected" : ""}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files[0];
                                if (file?.type.startsWith("video/")) setVideo(file);
                            }}
                        >
                            {video ? (
                                <div className="uc-file-info">
                                    <span className="uc-file-name">{video.name}</span>
                                    <span className="uc-file-size">
                                        {(video.size / 1024 / 1024).toFixed(1)} MB
                                    </span>
                                    {videoMetadata.duration && (
                                        <span className="uc-file-size">
                                            {Math.round(videoMetadata.duration)} sec
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="uc-dropzone-hint">
                                    Tap to select or drag &amp; drop a video
                                </span>
                            )}
                        </div>
                        <input
                            title='uc-input'
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            style={{ display: "none" }}
                            disabled={loading}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setVideo(file);
                            }}
                        />
                    </div>

                    <div className="app-card-field">
                        <label className="app-card-label" htmlFor="clip-caption">Caption</label>
                        <input
                            id="clip-caption"
                            className="app-card-input"
                            type="text"
                            placeholder="Describe the play"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            disabled={loading}
                            maxLength={280}
                        />
                    </div>

                    <div className="app-card-field">
                        <label className="app-card-label" htmlFor="clip-tags">Tag Players</label>
                        <div
                            className="uc-tag-area"
                            onClick={() => document.getElementById("clip-tags")?.focus()}
                        >
                            {tags.map((t) => (
                                <span key={t} className="uc-tag-pill">
                                    @{t}
                                    <button
                                        type="button"
                                        className="uc-tag-remove"
                                        onClick={(e) => { e.stopPropagation(); removeTag(t); }}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                            <input
                                id="clip-tags"
                                className="uc-tag-input"
                                type="text"
                                placeholder={tags.length === 0 ? "@username" : ""}
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                onBlur={commitTag}
                                disabled={loading}
                            />
                        </div>
                        {filteredMembers.length > 0 && (
                            <div className="uc-tag-suggestions">
                                {filteredMembers.map((member) => (
                                    <button
                                        key={member.id}
                                        type="button"
                                        className="uc-tag-suggestion"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => addSuggestedTag(member)}
                                    >
                                        <span className="uc-tag-suggestion-name">@{normalizeMemberLabel(member)}</span>
                                        <span className="uc-tag-suggestion-meta">{member.email}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <span className="uc-hint">Press Enter or comma to add a tag</span>
                    </div>

                    <button
                        type="submit"
                        className="app-card-btn-primary"
                        disabled={loading || !video || !selectedGameId || gamesLoading}
                    >
                        {loading ? "Uploading..." : "Post Clip"}
                    </button>
                </form>
            </div>
        </div>
    );
}
