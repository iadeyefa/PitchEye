import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

type Props = {
    src: string;
    className?: string;
    controls?: boolean;
    muted?: boolean;
    autoPlay?: boolean;
    preload?: "none" | "metadata" | "auto";
    playsInline?: boolean;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    onInactive?: () => void;
    liveEdge?: boolean;
    onClick?: React.MouseEventHandler<HTMLVideoElement>;
};

const isHlsUrl = (value: string) => value.toLowerCase().includes(".m3u8");

export default function SmartVideo({
    src,
    className,
    controls = false,
    muted = false,
    autoPlay = false,
    preload = "metadata",
    playsInline = true,
    videoRef: externalVideoRef,
    onInactive,
    liveEdge = false,
    onClick,
}: Props) {
    const internalVideoRef = useRef<HTMLVideoElement>(null);
    const videoRef = externalVideoRef ?? internalVideoRef;

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let hls: Hls | null = null;
        let inactiveTimeout: ReturnType<typeof setTimeout> | null = null;
        let lastCurrentTime = 0;

        const clearInactiveCheck = () => {
            if (inactiveTimeout) {
                clearTimeout(inactiveTimeout);
                inactiveTimeout = null;
            }
        };

        const scheduleInactiveCheck = () => {
            if (!onInactive) return;
            clearInactiveCheck();
            inactiveTimeout = setTimeout(() => {
                const currentVideo = videoRef.current;
                if (!currentVideo) return;
                const progressed = currentVideo.currentTime > lastCurrentTime + 0.2;
                lastCurrentTime = currentVideo.currentTime;
                if (!progressed && !currentVideo.paused) {
                    onInactive();
                } else {
                    scheduleInactiveCheck();
                }
            }, 8000);
        };

        const handleProgress = () => {
            lastCurrentTime = video.currentTime;
            scheduleInactiveCheck();
        };

        const handleEndedOrStalled = () => {
            onInactive?.();
        };

        video.pause();
        video.removeAttribute("src");
        video.load();

        if (onInactive) {
            video.addEventListener("playing", handleProgress);
            video.addEventListener("timeupdate", handleProgress);
            video.addEventListener("stalled", handleEndedOrStalled);
            video.addEventListener("ended", handleEndedOrStalled);
        }

        if (isHlsUrl(src)) {
            if (Hls.isSupported()) {
                hls = new Hls(
                    liveEdge
                        ? {
                              lowLatencyMode: true,
                              startPosition: -1,
                              liveSyncDurationCount: 1,
                              liveMaxLatencyDurationCount: 3,
                              manifestLoadingMaxRetry: 20,
                              manifestLoadingRetryDelay: 2000,
                              manifestLoadingMaxRetryTimeout: 10000,
                          }
                        : undefined
                );
                hls.loadSource(src);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (liveEdge && hls?.liveSyncPosition != null) {
                        video.currentTime = hls.liveSyncPosition;
                    }
                    if (autoPlay || liveEdge) {
                        video.play().catch(() => {});
                    }
                    scheduleInactiveCheck();
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                        onInactive?.();
                    }
                });
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = src;
                video.addEventListener(
                    "loadedmetadata",
                    () => {
                        if (liveEdge && Number.isFinite(video.duration) && video.duration > 0) {
                            video.currentTime = Math.max(video.duration - 1, 0);
                        }
                        if (autoPlay || liveEdge) {
                            video.play().catch(() => {});
                        }
                    },
                    { once: true }
                );
                scheduleInactiveCheck();
            } else {
                video.src = src;
            }
        } else {
            video.src = src;
            if (autoPlay) {
                video.play().catch(() => {});
            }
        }

        return () => {
            clearInactiveCheck();
            if (onInactive) {
                video.removeEventListener("playing", handleProgress);
                video.removeEventListener("timeupdate", handleProgress);
                video.removeEventListener("stalled", handleEndedOrStalled);
                video.removeEventListener("ended", handleEndedOrStalled);
            }
            hls?.destroy();
        };
    }, [autoPlay, liveEdge, onInactive, src, videoRef]);

    return (
        <video
            ref={videoRef}
            className={className}
            controls={controls}
            muted={muted}
            playsInline={playsInline}
            preload={preload}
            onClick={onClick}
        >
            Your browser does not support video playback.
        </video>
    );
}
