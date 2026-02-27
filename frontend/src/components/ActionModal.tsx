import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ActionModal.css";

type ActionModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function ActionModal({ isOpen, onClose }: ActionModalProps) {
    const navigate = useNavigate();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCreateGame = () => {
        onClose();
        navigate("/games/create");
    };

    const handleUploadClip = () => {
        onClose();
        navigate("/upload");
    };

    return (
        <div className="am-overlay" onClick={onClose}>
            <div className="am-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create options">
                <div className="am-handle" />
                <p className="am-heading">What would you like to create?</p>

                <div className="am-options">
                    <button className="am-option am-option--game" onClick={handleCreateGame}>
                        <div className="am-option-icon">
                            <img src="../../public/gamecreationicon.png" alt="Create Game"></img>
                        </div>
                        <div className="am-option-text">
                            <span className="am-option-title">Create Game</span>
                            <span className="am-option-desc">Set up a session &amp; generate a QR code for your team</span>
                        </div>
                        <svg className="am-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>

                    <button className="am-option am-option--clip" onClick={handleUploadClip}>
                        <div className="am-option-icon">
                            <img src="../../public/uploadvideoicon.png" alt="Upload Video"></img>
                        </div>
                        <div className="am-option-text">
                            <span className="am-option-title">Upload Clip</span>
                            <span className="am-option-desc">Share a video from a recent match or practice</span>
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