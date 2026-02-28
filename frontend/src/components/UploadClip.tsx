import React, { useState, useRef } from "react";
import "../styles/UploadClip.css";

type ClipProps = {
    id: number;
    caption: string;
    tagged_players: string[];
    video_url: string;
    created_at: string;
};

// TODO: Delete once endpoint added in
const DUMMY_RESPONSE: ClipProps = {
    id: 1,
    caption: "",
    tagged_players: [],
    video_url: "https://example.com/clips/dummy.mp4",
    created_at: new Date().toISOString(),
};

export default function UploadClip() {
    const [video, setVideo] = useState<File | null>(null);
    const [caption, setCaption] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<ClipProps | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // submitting
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");

        if (!video) { setError("Please select a video to upload"); return; }

        setLoading(true);
        
        // TODO: update with the actual endpoint once that exists
        await new Promise((r) => setTimeout(r, 1500)); 
        setLoading(false);

        setResult({
            ...DUMMY_RESPONSE,
            caption: caption.trim() || "Untitled Clip",
            tagged_players: tags,
            created_at: new Date().toISOString(),
        });
    };

    const reset = () => {
        setResult(null);
        setVideo(null);
        setCaption("");
        setTags([]);
        setTagInput("");
        setError("");
    };

    if (result) {
        return (
            <div className="uc-container">
                <div className="uc-card">
                    <p className="uc-eyebrow">Clip Posted</p>
                    <h2 className="uc-title">{result.caption}</h2>
                    {result.tagged_players.length > 0 && (
                        <p className="uc-subtitle">
                            Tagged: {result.tagged_players.map((p) => `@${p}`).join(", ")}
                        </p>
                    )}
                    <p className="uc-subtitle">
                        {new Date(result.created_at).toLocaleString(undefined, {
                            dateStyle: "medium", timeStyle: "short",
                        })}
                    </p>
                    <div className="uc-action-row">
                        <button className="uc-btn-secondary" onClick={reset}>
                            + Upload Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="uc-container">
            <div className="uc-card">
                <h1 className="uc-title">Upload Clip</h1>
                <p className="uc-subtitle">Share a video from a recent match or practice</p>

                {error && <div className="uc-error">{error}</div>}

                <form onSubmit={handleSubmit} className="uc-form">
                    <div className="uc-field">
                        <label className="uc-label">Video</label>
                        <div
                            className={`uc-dropzone${video ? "uc-dropzone--selected" : ""}`}
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

                    <div className="uc-field">
                        <label className="uc-label" htmlFor="clip-caption">Caption</label>
                        <input
                            id="clip-caption"
                            className="uc-input"
                            type="text"
                            placeholder="Describe the play"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            disabled={loading}
                            maxLength={280}
                        />
                    </div>

                    <div className="uc-field">
                        <label className="uc-label" htmlFor="clip-tags">Tag Players</label>
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
                        <span className="uc-hint">Press Enter or comma to add a tag</span>
                    </div>

                    <button
                        type="submit"
                        className="uc-btn-primary"
                        disabled={loading || !video}
                    >
                        {loading ? "Uploading..." : "Post Clip"}
                    </button>
                </form>
            </div>
        </div>
    );
}
