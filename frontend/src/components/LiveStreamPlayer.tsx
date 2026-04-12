import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Props = {
    hlsUrl: string;
    label: string;
};

export default function LiveStreamPlayer({ hlsUrl, label }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playbackError, setPlaybackError] = useState("");

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        setPlaybackError("");
        video.pause();
        video.removeAttribute("src");
        video.load();

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
                video.pause();
                video.removeEventListener("error", handleVideoError);
            };
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                lowLatencyMode: true,
            });

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
                hls.destroy();
                video.pause();
                video.removeEventListener("error", handleVideoError);
            };
        }

        setPlaybackError("This browser cannot play HLS live video.");
        return () => {
            video.removeEventListener("error", handleVideoError);
        };
    }, [hlsUrl]);

    return (
        <article className="live-card">
            <div className="live-thumb live-thumb--video">
                <video
                    ref={videoRef}
                    controls
                    muted
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <div className="live-badge">Recording live</div>
            </div>
            <div className="live-card-body">
                <div className="live-card-top">
                    <h3 className="live-card-title">{label}</h3>
                </div>
                {playbackError && <p className="live-card-meta">{playbackError}</p>}
            </div>
        </article>
    );
}
