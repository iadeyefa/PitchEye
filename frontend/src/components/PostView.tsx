import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/common.css";
import "../styles/PostView.css";

type Comment = {
    id: number;
    username: string;
    text: string;
};

type Post = {
    id: number;
    username: string;
    caption: string;
    timestamp: string;
    likes: number;
    tagged_players: string[];
    comments: Comment[];
};

// TODO: Delete and implement api once finished
const DUMMY_POSTS: Record<number, Post> = {
    1: {
        id: 1,
        username: "soccer_mom_2",
        caption: "Practice last night xyz",
        timestamp: "5 hours ago",
        likes: 14,
        tagged_players: ["player_six", "player_two", "player_one"],
        comments: [
            { id: 1, username: "soccer_dad", text: "Great session!" },
            { id: 2, username: "soccer_player", text: "Loved this drill" },
            { id: 3, username: "soccer_fan", text: "Keep it up 🔥" },
        ],
    },
    2: {
        id: 2,
        username: "coach_davis",
        caption: "Great defensive play from the boys 🔒",
        timestamp: "2 hours ago",
        likes: 31,
        tagged_players: ["player_three", "player_five"],
        comments: [
            { id: 1, username: "soccer_mom_2", text: "Amazing block!" },
            { id: 2, username: "pitcheye_fc", text: "Clip of the week 👏" },
        ],
    },
    3: {
        id: 3,
        username: "pitcheye_fc",
        caption: "Top G goal from last weekend's match",
        timestamp: "1 day ago",
        likes: 88,
        tagged_players: ["player_four"],
        comments: [
            { id: 1, username: "coach_davis", text: "What a finish" },
            { id: 2, username: "soccer_fan", text: "Insane 🎯" },
            { id: 3, username: "soccer_mom_2", text: "My kid scored this!!" },
        ],
    },
};

export default function PostView() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [commentInput, setCommentInput] = useState("");
    const [liked, setLiked] = useState(false);
    const [showTags, setShowTags] = useState(false);

    const post = DUMMY_POSTS[Number(id)] ?? DUMMY_POSTS[1];

    const handleComment = (e: React.FormEvent) => {
        e.preventDefault();
        setCommentInput("");
        // TODO: wire up to API later
    };

    return (
        <div className="pv-container">
            <div className="pv-inner">
                <button className="pv-back" onClick={() => navigate(-1)}>
                    ← Back
                </button>

                <div className="pv-author">
                    <div className="pv-avatar">
                        {post.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="pv-username">@{post.username}</span>
                </div>

                {/* TODO: video thumbnail */}
                <div className="pv-video-wrapper">
                    <div className="pv-thumbnail">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="pv-thumb-icon">
                            <rect x="2" y="4" width="15" height="16" rx="2" />
                            <path d="M17 9l5-3v12l-5-3V9z" />
                        </svg>
                    </div>

                    {post.tagged_players.length > 0 && (
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
                                    {post.tagged_players.map((p) => (
                                        <span key={p} className="pv-tag-pill">@{p}</span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="pv-meta">
                    <button
                        className={`pv-like-btn ${liked ? "pv-like-btn--active" : ""}`}
                        onClick={() => setLiked((v) => !v)}
                        aria-label="Like"
                    >
                        <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        <span>{post.likes + (liked ? 1 : 0)}</span>
                    </button>

                    <div className="pv-caption-row">
                        <p className="pv-caption">{post.caption}</p>
                        <span className="pv-timestamp">{post.timestamp}</span>
                    </div>
                </div>

                <div className="pv-comments-section">
                    <div className="pv-comments-list">
                        {post.comments.map((c) => (
                            <div key={c.id} className="pv-comment">
                                <span className="pv-comment-text">{c.text}</span>
                                <span className="pv-comment-user">@{c.username}</span>
                            </div>
                        ))}
                    </div>

                    <form className="pv-comment-form" onSubmit={handleComment}>
                        <input
                            className="pv-comment-input"
                            type="text"
                            placeholder="Leave a comment..."
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                        />
                        <button
                            type="submit"
                            className="pv-comment-submit"
                            disabled={!commentInput.trim()}
                        >
                            Post
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
