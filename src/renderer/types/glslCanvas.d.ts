declare module 'glslCanvas' {
  export type GlslCanvasOptions = Record<string, unknown>

  export default class GlslCanvas {
    constructor(canvas: HTMLCanvasElement, options?: GlslCanvasOptions);
    load(fragmentShader: string): void;
    setUniform(name: string, value: number | number[]): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    destroy(): void;
  }
}
