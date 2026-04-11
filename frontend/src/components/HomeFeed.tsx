import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../styles/common.css";
import "../styles/HomeFeed.css";

type FeedPost = {
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

    const target = new Date(value).getTime();
    if (Number.isNaN(target)) return "";

    const diffMs = target - Date.now();
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ["year", 1000 * 60 * 60 * 24 * 365],
        ["month", 1000 * 60 * 60 * 24 * 30],
        ["week", 1000 * 60 * 60 * 24 * 7],
        ["day", 1000 * 60 * 60 * 24],
        ["hour", 1000 * 60 * 60],
        ["minute", 1000 * 60],
    ];

    for (const [unit, size] of steps) {
        const amount = Math.round(diffMs / size);
        if (Math.abs(amount) >= 1) {
            return formatter.format(amount, unit);
        }
    }

    return "just now";
};

const getPostSummary = (post: FeedPost) => {
    const caption = post.caption?.trim();
    if (caption) return caption;
    if (post.game_title) return `Clip from ${post.game_title}`;
    if (post.original_filename) return post.original_filename;
    return "Team clip";
};

const getUploaderLabel = (post: FeedPost) =>
    post.uploader?.username?.trim() || post.uploader?.email?.split("@")[0] || "teammate";

export default function HomeFeed() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchFeed = async () => {
            try {
                if (!supabase) throw new Error("Supabase not initialized");
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");

                const response = await fetch("http://localhost:8000/api/videos/feed/", {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || "Unable to load posts");
                }

                const data: FeedPost[] = await response.json();
                setPosts(data);
            } catch (err: unknown) {
                setError((err as Error).message || "Unable to load posts");
            } finally {
                setLoading(false);
            }
        };

        fetchFeed();
    }, []);

    const filtered = posts.filter((post) => {
        const query = search.toLowerCase();
        if (!query) return true;

        return (
            getPostSummary(post).toLowerCase().includes(query) ||
            getUploaderLabel(post).toLowerCase().includes(query) ||
            (post.game_title || "").toLowerCase().includes(query) ||
            (post.tagged_players || []).some((tag) => tag.toLowerCase().includes(query))
        );
    });

    return (
        <div className="hf-container">
            <div className="hf-search-wrapper">
                <svg className="hf-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                    className="hf-search"
                    type="text"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="hf-feed">
                {loading && <p className="hf-empty">Loading posts...</p>}
                {!loading && error && <p className="hf-empty">{error}</p>}
                {!loading && !error && filtered.length === 0 && (
                    <p className="hf-empty">{posts.length === 0 ? "No team clips yet" : "No posts found"}</p>
                )}
                {filtered.map((post) => (
                    <div
                        key={post.id}
                        className="hf-post-card"
                        onClick={() => navigate(`/post/${post.id}`)}
                    >
                        <div className="hf-thumbnail">
                            <video
                                className="hf-video"
                                src={post.video_url}
                                controls
                                playsInline
                                preload="metadata"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Your browser does not support video playback.
                            </video>
                        </div>

                        <div className="hf-post-meta">
                            <div className="hf-post-footer">
                                <span className="hf-username">@{getUploaderLabel(post)}</span>
                                <span className="hf-timestamp">{formatTimestamp(post.uploaded_at)}</span>
                            </div>
                            <p className="hf-caption">{getPostSummary(post)}</p>
                            {post.game_title && <p className="hf-subtitle">{post.game_title}</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
