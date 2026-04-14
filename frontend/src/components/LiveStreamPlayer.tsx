import React, { useRef, useState } from "react";
import SmartVideo from "./SmartVideo";

type Props = {
    hlsUrl: string;
    label: string;
    onInactive?: () => void;
};

export default function LiveStreamPlayer({ hlsUrl, label, onInactive }: Props) {
    const [expanded, setExpanded] = useState(false);
    const expandedVideoRef = useRef<HTMLVideoElement | null>(null);

    const handleOpenFullscreen = async () => {
        const video = expandedVideoRef.current;
        if (!video) return;

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => undefined);
            return;
        }

        await video.requestFullscreen?.().catch(() => undefined);
    };

    return (
        <>
        <article className="live-card">
            <div className="live-thumb live-thumb--video">
                <SmartVideo
                    src={hlsUrl}
                    muted
                    autoPlay
                    className="live-inline-video"
                    onInactive={onInactive}
                    liveEdge
                />
                <div className="live-badge">Recording live</div>
                <button type="button" className="live-expand-btn" onClick={() => setExpanded(true)}>
                    Expand
                </button>
            </div>
            <div className="live-card-body">
                <div className="live-card-top">
                    <h3 className="live-card-title">{label}</h3>
                </div>
            </div>
        </article>
        {expanded && (
            <div className="live-viewer-overlay" onClick={() => setExpanded(false)} role="presentation">
                <div
                    className="live-viewer-modal"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Expanded stream for ${label}`}
                >
                    <div className="live-viewer-header">
                        <h3 className="live-viewer-title">{label}</h3>
                        <div className="live-viewer-actions">
                            <button type="button" className="live-viewer-control" onClick={handleOpenFullscreen}>
                                Full Screen
                            </button>
                            <button type="button" className="live-viewer-close" onClick={() => setExpanded(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                    <div className="live-viewer-video-shell">
                        <SmartVideo
                            src={hlsUrl}
                            controls
                            videoRef={expandedVideoRef}
                            className="live-viewer-video"
                            onInactive={onInactive}
                            liveEdge
                            autoPlay
                        />
                        <div className="live-live-pill">Live</div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
