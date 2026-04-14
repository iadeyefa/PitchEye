import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import SmartVideo from "./SmartVideo";
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
    comments?: CommentItem[];
    comment_count?: number;
};

type CommentItem = {
    id: number;
    video_id: number;
    user_id: string;
    body: string;
    created_at?: string;
    parent_comment_id?: number | null;
    user?: {
        id?: string;
        username?: string;
        email?: string;
    };
    replies?: CommentItem[];
};

type TeamMember = {
    id: string;
    username?: string;
    email?: string;
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
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [showTags, setShowTags] = useState(false);
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [commentBody, setCommentBody] = useState("");
    const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
    const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                if (!supabase) throw new Error("Supabase not initialized");
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");
                if (!id) throw new Error("Post not found");
                setCurrentUserId(session.user.id);

                const [response, teamResponse] = await Promise.all([
                    fetch(`http://localhost:8000/api/videos/${id}/`, {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    }),
                    fetch("http://localhost:8000/api/teams/my/", {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    }),
                ]);

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || "Unable to load post");
                }

                const data: Post = await response.json();
                setPost(data);
                setComments(data.comments || []);

                if (teamResponse.ok) {
                    const teamData = await teamResponse.json();
                    setTeamMembers(teamData.members || []);
                } else {
                    setTeamMembers([]);
                }
            } catch (err: unknown) {
                setError((err as Error).message || "Unable to load post");
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [id]);

    const getCommentAuthor = (comment: CommentItem) =>
        comment.user?.username?.trim() || comment.user?.email?.split("@")[0] || "teammate";

    const getMemberHandle = (member: TeamMember) =>
        member.username?.trim() || member.email?.split("@")[0] || "";

    const matchingMembers = useMemo(() => {
        if (!mentionQuery) return [];

        const query = mentionQuery.toLowerCase();
        return teamMembers
            .map((member) => ({ ...member, handle: getMemberHandle(member) }))
            .filter((member) => member.handle && member.handle.toLowerCase().includes(query))
            .slice(0, 5);
    }, [mentionQuery, teamMembers]);

    const updateMentionState = (value: string, cursorPosition: number | null) => {
        if (cursorPosition === null) {
            setMentionQuery("");
            setMentionRange(null);
            return;
        }

        const textBeforeCursor = value.slice(0, cursorPosition);
        const match = textBeforeCursor.match(/(^|\s)@([A-Za-z0-9._-]*)$/);
        if (!match) {
            setMentionQuery("");
            setMentionRange(null);
            return;
        }

        const handle = match[2] || "";
        const atIndex = cursorPosition - handle.length - 1;
        setMentionQuery(handle);
        setMentionRange({ start: atIndex, end: cursorPosition });
    };

    const handleCommentInputChange = (value: string, cursorPosition: number | null) => {
        setCommentBody(value);
        updateMentionState(value, cursorPosition);
    };

    const insertMention = (handle: string) => {
        if (!mentionRange) return;

        const nextValue = `${commentBody.slice(0, mentionRange.start)}@${handle} ${commentBody.slice(mentionRange.end)}`;
        const nextCursor = mentionRange.start + handle.length + 2;
        setCommentBody(nextValue);
        setMentionQuery("");
        setMentionRange(null);

        requestAnimationFrame(() => {
            if (!commentInputRef.current) return;
            commentInputRef.current.focus();
            commentInputRef.current.setSelectionRange(nextCursor, nextCursor);
        });
    };

    const handleSubmitComment = async () => {
        const body = commentBody.trim();
        if (!body || !id || !supabase) return;

        setSubmittingComment(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch(`http://localhost:8000/api/videos/${id}/comments/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    body,
                    parent_comment_id: replyTarget?.id ?? null,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Unable to post comment");

            setComments((current) => {
                if (!replyTarget) return [...current, data];

                return current.map((comment) =>
                    comment.id === replyTarget.id
                        ? { ...comment, replies: [...(comment.replies || []), data] }
                        : comment
                );
            });
            setCommentBody("");
            setMentionQuery("");
            setMentionRange(null);
            setReplyTarget(null);
        } catch (err: unknown) {
            setError((err as Error).message || "Unable to post comment");
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!supabase || deletingCommentId) return;

        setDeletingCommentId(commentId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch(`http://localhost:8000/api/videos/comments/${commentId}/`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Unable to delete comment");

            setComments((current) =>
                current
                    .filter((comment) => comment.id !== commentId)
                    .map((comment) => ({
                        ...comment,
                        replies: (comment.replies || []).filter((reply) => reply.id !== commentId),
                    }))
            );
            if (replyTarget?.id === commentId) {
                setReplyTarget(null);
            }
        } catch (err: unknown) {
            setError((err as Error).message || "Unable to delete comment");
        } finally {
            setDeletingCommentId(null);
        }
    };

    const renderComment = (comment: CommentItem, isReply = false) => (
        <div key={comment.id} className={`pv-comment-item ${isReply ? "pv-comment-item--reply" : ""}`}>
            <div className="pv-comment-top">
                <div>
                    <p className="pv-comment-author">@{getCommentAuthor(comment)}</p>
                    <p className="pv-comment-time">{formatTimestamp(comment.created_at)}</p>
                </div>
                <div className="pv-comment-tools">
                    {!isReply && (
                        <button
                            className="pv-comment-reply"
                            onClick={() => {
                                setReplyTarget(comment);
                                commentInputRef.current?.focus();
                            }}
                        >
                            Reply
                        </button>
                    )}
                    {comment.user_id === currentUserId && (
                        <button
                            className="pv-comment-delete"
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={deletingCommentId === comment.id}
                        >
                            {deletingCommentId === comment.id ? "Deleting..." : "Delete"}
                        </button>
                    )}
                </div>
            </div>
            <p className="pv-comment-body">{comment.body}</p>
            {!isReply && (comment.replies?.length ?? 0) > 0 && (
                <div className="pv-reply-list">
                    {comment.replies!.map((reply) => renderComment(reply, true))}
                </div>
            )}
        </div>
    );

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
                            <SmartVideo
                                className="pv-video"
                                src={post.video_url}
                                controls
                                preload="metadata"
                            />

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

                        <section className="pv-comments">
                            <div className="pv-comments-header">
                                <h2>Comments</h2>
                                <span>{comments.length}</span>
                            </div>

                            <div className="pv-comment-form">
                                {replyTarget && (
                                    <div className="pv-reply-banner">
                                        <span>Replying to @{getCommentAuthor(replyTarget)}</span>
                                        <button
                                            type="button"
                                            className="pv-reply-cancel"
                                            onClick={() => setReplyTarget(null)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                                <textarea
                                    ref={commentInputRef}
                                    className="pv-comment-input"
                                    placeholder="Add a comment. Type @ to mention a teammate"
                                    value={commentBody}
                                    onChange={(event) => handleCommentInputChange(event.target.value, event.target.selectionStart)}
                                    onClick={(event) => updateMentionState(event.currentTarget.value, event.currentTarget.selectionStart)}
                                    onKeyUp={(event) => updateMentionState(event.currentTarget.value, event.currentTarget.selectionStart)}
                                    maxLength={1000}
                                />
                                {matchingMembers.length > 0 && (
                                    <div className="pv-mention-menu">
                                        {matchingMembers.map((member) => (
                                            <button
                                                key={member.id}
                                                type="button"
                                                className="pv-mention-option"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    insertMention(getMemberHandle(member));
                                                }}
                                            >
                                                <span className="pv-mention-handle">@{getMemberHandle(member)}</span>
                                                <span className="pv-mention-meta">{member.username ? member.email : "teammate"}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button
                                    className="pv-comment-submit"
                                    onClick={handleSubmitComment}
                                    disabled={submittingComment || !commentBody.trim()}
                                >
                                    {submittingComment ? "Posting..." : "Post"}
                                </button>
                            </div>

                            <div className="pv-comment-list">
                                {comments.length === 0 ? (
                                    <p className="pv-state">No comments yet.</p>
                                ) : (
                                    comments.map((comment) => renderComment(comment))
                                )}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
