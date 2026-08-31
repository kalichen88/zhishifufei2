declare module "hls.js" {
  export default class Hls {
    static isSupported(): boolean;
    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;
  }
}
