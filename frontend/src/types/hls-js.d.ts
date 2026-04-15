declare module "hls.js" {
    export type HlsErrorType = "networkError" | "mediaError" | string;

    export default class Hls {
        static Events: {
            MANIFEST_PARSED: string;
            ERROR: string;
        };

        static ErrorTypes: {
            NETWORK_ERROR: HlsErrorType;
            MEDIA_ERROR: HlsErrorType;
        };

        static isSupported(): boolean;

        constructor(config?: Record<string, unknown>);
        loadSource(url: string): void;
        attachMedia(media: HTMLMediaElement): void;
        on(event: string, listener: (...args: any[]) => void): void;
        startLoad(startPosition?: number): void;
        recoverMediaError(): void;
        destroy(): void;
    }
}
