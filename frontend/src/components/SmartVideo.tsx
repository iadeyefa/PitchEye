import React, { useEffect, useMemo, useRef, useState } from "react";
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
    fallbackSrcs?: string[];
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
    fallbackSrcs = [],
}: Props) {
    const internalVideoRef = useRef<HTMLVideoElement>(null);
    const videoRef = externalVideoRef ?? internalVideoRef;
    const onInactiveRef = useRef(onInactive);
    onInactiveRef.current = onInactive;
    const candidateSources = useMemo(
        () => [src, ...fallbackSrcs.filter((candidate) => candidate && candidate !== src)],
        [fallbackSrcs, src],
    );
    const [sourceIndex, setSourceIndex] = useState(0);
    const activeSrc = candidateSources[Math.min(sourceIndex, candidateSources.length - 1)] || src;

    useEffect(() => {
        setSourceIndex(0);
    }, [candidateSources]);

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
            if (!onInactiveRef.current) return;
            clearInactiveCheck();
            inactiveTimeout = setTimeout(() => {
                const currentVideo = videoRef.current;
                if (!currentVideo) return;
                const progressed = currentVideo.currentTime > lastCurrentTime + 0.2;
                lastCurrentTime = currentVideo.currentTime;
                if (!progressed && !currentVideo.paused) {
                    onInactiveRef.current?.();
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
            onInactiveRef.current?.();
        };

        video.pause();
        video.removeAttribute("src");
        video.load();

        if (onInactiveRef.current) {
            video.addEventListener("playing", handleProgress);
            video.addEventListener("timeupdate", handleProgress);
            video.addEventListener("stalled", handleEndedOrStalled);
            video.addEventListener("ended", handleEndedOrStalled);
        }

        const advanceToNextSource = () => {
            setSourceIndex((current) => {
                if (current < candidateSources.length - 1) {
                    return current + 1;
                }
                onInactiveRef.current?.();
                return current;
            });
        };

        if (isHlsUrl(activeSrc)) {
            if (Hls.isSupported()) {
                hls = new Hls(
                    liveEdge
                        ? {
                              lowLatencyMode: false,
                              startPosition: -1,
                              liveSyncDurationCount: 3,
                              liveMaxLatencyDurationCount: 6,
                              maxLiveSyncPlaybackRate: 1.2,
                              backBufferLength: 90,
                              manifestLoadingMaxRetry: 20,
                              manifestLoadingRetryDelay: 2000,
                              manifestLoadingMaxRetryTimeout: 10000,
                          }
                        : undefined
                );
                hls.loadSource(activeSrc);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (autoPlay || liveEdge) {
                        video.play().catch(() => {});
                    }
                    scheduleInactiveCheck();
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                            advanceToNextSource();
                            return;
                        }
                        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            advanceToNextSource();
                            return;
                        }
                        advanceToNextSource();
                    }
                });
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = activeSrc;
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
                video.src = activeSrc;
            }
        } else {
            video.src = activeSrc;
            if (autoPlay) {
                video.play().catch(() => {});
            }
        }

        return () => {
            clearInactiveCheck();
            video.removeEventListener("playing", handleProgress);
            video.removeEventListener("timeupdate", handleProgress);
            video.removeEventListener("stalled", handleEndedOrStalled);
            video.removeEventListener("ended", handleEndedOrStalled);
            hls?.destroy();
        };
    }, [activeSrc, autoPlay, candidateSources.length, liveEdge, videoRef]);

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
