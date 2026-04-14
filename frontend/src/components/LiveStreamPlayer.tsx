import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import SmartVideo from "./SmartVideo";

type Props = {
    hlsUrl: string;
    label: string;
    onInactive?: () => void;
};

export default function LiveStreamPlayer({ hlsUrl, label }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [playbackError, setPlaybackError] = useState("");

    const handleOpenFullscreen = async () => {
        const video = expandedVideoRef.current;
        if (!video) return;

        setPlaybackError("");

        const cleanupPlayback = () => {
            hlsRef.current?.destroy();
            hlsRef.current = null;

            try {
                video.pause();
            } catch {
                // Ignore browser-specific pause failures during teardown.
            }

            try {
                video.removeAttribute("src");
                video.load();
            } catch {
                // Ignore browser-specific load/reset failures during teardown.
            }
        };

        cleanupPlayback();

        const handleVideoError = () => {
            setPlaybackError("Unable to play this live stream right now.");
        };

        video.addEventListener("error", handleVideoError);

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = hlsUrl;
            video.play().catch(() => {
                setPlaybackError("Autoplay was blocked. Click play to start the live stream.");
            });

            return () => {
                cleanupPlayback();
                video.removeEventListener("error", handleVideoError);
            };
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                lowLatencyMode: true,
            });
            hlsRef.current = hls;

            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => {
                    setPlaybackError("Autoplay was blocked. Click play to start the live stream.");
                });
            });
            hls.on(Hls.Events.ERROR, (_event: string, data: { fatal?: boolean }) => {
                if (data.fatal) {
                    setPlaybackError("Unable to load the live stream feed.");
                }
            });

            return () => {
                cleanupPlayback();
                video.removeEventListener("error", handleVideoError);
            };
        }

        setPlaybackError("This browser cannot play HLS live video.");
        return () => {
            video.removeEventListener("error", handleVideoError);
        };
    }, [hlsUrl]);

    return (
        <>
        <article className="live-card">
            <div className="live-thumb live-thumb--video">
                <video
                    ref={videoRef}
                    controls
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
                {playbackError && <p className="live-card-meta">{playbackError}</p>}
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
