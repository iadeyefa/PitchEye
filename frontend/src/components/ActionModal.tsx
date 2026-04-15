import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ActionModal.css";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";
import { canUserCreateTeamSessions } from "../utils/sessionPermissions";

type ActionModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function ActionModal({ isOpen, onClose }: ActionModalProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [canCreateSessions, setCanCreateSessions] = useState(true);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    useEffect(() => {
        const loadPermission = async () => {
            if (!isOpen) return;

            try {
                if (!supabase) throw new Error("Supabase not initialized");
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");

                const [profileRes, teamRes] = await Promise.all([
                    fetch("http://localhost:8000/api/users/get_user/", {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    }),
                    fetch("http://localhost:8000/api/teams/my/", {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    }),
                ]);

                const profileData = profileRes.ok ? await profileRes.json() : [];
                const teamData = teamRes.ok ? await teamRes.json() : null;
                setCanCreateSessions(
                    canUserCreateTeamSessions(profileData[0]?.role, teamData?.team ?? null, user?.id)
                );
            } catch (_error) {
                setCanCreateSessions(true);
            }
        };

        loadPermission();
    }, [isOpen, user?.id]);

    if (!isOpen) return null;

    const handleCreateSession = () => {
        onClose();
        navigate("/games/create");
    };

    const handleUploadClip = () => {
        onClose();
        navigate("/upload");
    };

    const handleJoinSession = () => {
        onClose();
        navigate("/join");
    };

    return (
        <div className="am-overlay" onClick={onClose}>
            <div className="am-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create options">
                <div className="am-handle" />
                <p className="am-heading">What would you like to create?</p>

                <div className="am-options">
                    {canCreateSessions && (
                    <button className="am-option am-option--game" onClick={handleCreateSession}>
                        <div className="am-option-icon">
                            <img src="/gamecreationicon.png" alt="Create Session" width="22" height="22"></img>
                        </div>
                        <div className="am-option-text">
                            <span className="am-option-title">Create Session</span>
                            <span className="am-option-desc">Create a game or practice session with a QR code</span>
                        </div>
                        <svg className="am-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>
                    )}

                    <button className="am-option am-option--clip" onClick={handleUploadClip}>
                        <div className="am-option-icon">
                            <img src="/uploadvideoicon.png" alt="Upload Video" width="22" height="22"></img>
                        </div>
                        <div className="am-option-text">
                            <span className="am-option-title">Upload Clip</span>
                            <span className="am-option-desc">Share a video from a recent match or practice</span>
                        </div>
                        <svg className="am-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>

                    <button className="am-option am-option--clip" onClick={handleJoinSession}>
                        <div className="am-option-icon">
                            <img src="/gamecreationicon.png" alt="Join Session" width="22" height="22"></img>
                        </div>
                        <div className="am-option-text">
                            <span className="am-option-title">Join Session</span>
                            <span className="am-option-desc">Enter a session code and attach clips without joining the full team</span>
                        </div>
                        <svg className="am-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>
                </div>

                <button className="am-cancel" onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
}
