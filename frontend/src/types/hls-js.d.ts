declare module "hls.js" {
    export default class Hls {
        static Events: {
            MANIFEST_PARSED: string;
            ERROR: string;
        };

        static isSupported(): boolean;

        constructor(config?: Record<string, unknown>);
        loadSource(url: string): void;
        attachMedia(media: HTMLMediaElement): void;
        on(event: string, listener: (...args: any[]) => void): void;
        destroy(): void;
    }
}
