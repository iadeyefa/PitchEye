import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/common.css";
import "../styles/HomeFeed.css";

type Post = {
    id: number;
    username: string;
    caption: string;
    timestamp: string;
    likes: number;
    comments: number;
    tagged_players: string[];
};

// TODO: Delete and implement api once finished
const DUMMY_POSTS: Post[] = [
    {
        id: 1,
        username: "soccer_mom_2",
        caption: "Practice last night xyz",
        timestamp: "5 hours ago",
        likes: 14,
        comments: 3,
        tagged_players: ["player_one", "player_two", "player_six"],
    },
    {
        id: 2,
        username: "coach_davis",
        caption: "Great defensive play from the boys 🔒",
        timestamp: "2 hours ago",
        likes: 31,
        comments: 7,
        tagged_players: ["player_three", "player_five"],
    },
    {
        id: 3,
        username: "pitcheye_fc",
        caption: "Top G goal from last weekend's match",
        timestamp: "1 day ago",
        likes: 88,
        comments: 12,
        tagged_players: ["player_four"],
    },
];


export default function HomeFeed() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const filtered = DUMMY_POSTS.filter((p) =>
        p.caption.toLowerCase().includes(search.toLowerCase()) ||
        p.username.toLowerCase().includes(search.toLowerCase())
    );

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
                {filtered.length === 0 && (
                    <p className="hf-empty">No posts found</p>
                )}
                {filtered.map((post) => (
                    <div
                        key={post.id}
                        className="hf-post-card"
                        onClick={() => navigate(`/post/${post.id}`)}
                    >
                        {/* TODO: video thumbnails would go here */}
                        <div className="hf-thumbnail">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="hf-thumb-icon">
                                <rect x="2" y="4" width="15" height="16" rx="2" />
                                <path d="M17 9l5-3v12l-5-3V9z" />
                            </svg>
                        </div>

                        {/* TODO: post meta */}
                        <div className="hf-post-meta">
                            <div className="hf-post-actions">
                                <button
                                    className="hf-action-btn"
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Like"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                    <span>{post.likes}</span>
                                </button>
                                <button
                                    className="hf-action-btn"
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Comment"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    <span>{post.comments}</span>
                                </button>
                            </div>

                            <p className="hf-caption">{post.caption}</p>
                            <div className="hf-post-footer">
                                <span className="hf-username">@{post.username}</span>
                                <span className="hf-timestamp">{post.timestamp}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
