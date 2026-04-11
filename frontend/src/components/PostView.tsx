import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../styles/common.css";
import "../styles/PostView.css";

type Post = {
    id: number;
    video_url: string;
    uploaded_at?: string;
    caption?: string | null;
    original_filename?: string;
    tagged_players?: string[];
    uploader?: {
        username?: string;
        email?: string;
    };
    game_title?: string | null;
};

const formatTimestamp = (value?: string) => {
    if (!value) return "";

    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return "";

    return target.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
};

const getUploaderLabel = (post: Post) =>
    post.uploader?.username?.trim() || post.uploader?.email?.split("@")[0] || "teammate";

const getCaption = (post: Post) => {
    const caption = post.caption?.trim();
    if (caption) return caption;
    if (post.game_title) return `Clip from ${post.game_title}`;
    if (post.original_filename) return post.original_filename;
    return "Team clip";
};

export default function PostView() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [post, setPost] = useState<Post | null>(null);
    const [showTags, setShowTags] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchPost = async () => {
            try {
                if (!supabase) throw new Error("Supabase not initialized");
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");
                if (!id) throw new Error("Post not found");

                const response = await fetch(`http://localhost:8000/api/videos/${id}/`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || "Unable to load post");
                }

                const data: Post = await response.json();
                setPost(data);
            } catch (err: unknown) {
                setError((err as Error).message || "Unable to load post");
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [id]);

    return (
        <div className="pv-container">
            <div className="pv-inner">
                <button className="pv-back" onClick={() => navigate(-1)}>
                    ← Back
                </button>

                {loading && <p className="pv-state">Loading post...</p>}
                {!loading && error && <p className="pv-state">{error}</p>}

                {!loading && !error && post && (
                    <>
                        <div className="pv-author">
                            <div className="pv-avatar">
                                {getUploaderLabel(post).charAt(0).toUpperCase()}
                            </div>
                            <div className="pv-author-meta">
                                <span className="pv-username">@{getUploaderLabel(post)}</span>
                                {post.game_title && <span className="pv-game">{post.game_title}</span>}
                            </div>
                        </div>

                        <div className="pv-video-wrapper">
                            <video
                                className="pv-video"
                                src={post.video_url}
                                controls
                                playsInline
                                preload="metadata"
                            >
                                Your browser does not support video playback.
                            </video>

                            {(post.tagged_players || []).length > 0 && (
                                <>
                                    <button
                                        className="pv-tag-toggle"
                                        onClick={() => setShowTags((v) => !v)}
                                        aria-label="Toggle player tags"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                            <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                                        </svg>
                                    </button>

                                    {showTags && (
                                        <div className="pv-tags-overlay">
                                            {post.tagged_players?.map((player) => (
                                                <span key={player} className="pv-tag-pill">@{player}</span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="pv-meta">
                            <div className="pv-caption-row">
                                <p className="pv-caption">{getCaption(post)}</p>
                                <span className="pv-timestamp">{formatTimestamp(post.uploaded_at)}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
