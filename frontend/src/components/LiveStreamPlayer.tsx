import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

type Props = {
    hlsUrl: string;
    label: string;
};

export default function LiveStreamPlayer({ hlsUrl, label }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (Hls.isSupported()) {
            const hls = new Hls({
                lowLatencyMode: true,
                manifestLoadingMaxRetry: 20,
                manifestLoadingRetryDelay: 2000,
                manifestLoadingMaxRetryTimeout: 10000,
            });
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => {});
            });
            return () => hls.destroy();
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = hlsUrl;
            video.play().catch(() => {});
        }
    }, [hlsUrl]);

    return (
        <article className="live-card">
            <div className="live-thumb live-thumb--video">
                <video
                    ref={videoRef}
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
            </div>
        </article>
    );
}
