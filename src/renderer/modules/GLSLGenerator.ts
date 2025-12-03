export type ModelProvider = 'gemini' | 'openai'

export interface GLSLGenerationOptions {
  apiKey?: string
  prompt?: string
  audioFile?: File
  modelProvider?: ModelProvider
  model?: string
}

type ProgressListener = (payload: { code: string; isComplete: boolean }) => void

type ShaderListener = (glslCode: string) => void

const DEFAULT_SHADER = `#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  float pulse = 0.5 + 0.5 * sin(u_time * 0.8);
  vec3 color = vec3(st.x, st.y, pulse);
  gl_FragColor = vec4(color, 1.0);
}`

export class GLSLGenerator {
  private listeners = new Set<ShaderListener>()
  private progressListeners = new Set<ProgressListener>()
  private prompt?: string
  private lastShader = DEFAULT_SHADER

  constructor(options: GLSLGenerationOptions = {}) {
    this.prompt = options.prompt
  }

  async generateGLSL(): Promise<void> {
    const code = this.buildShaderFromPrompt()
    this.lastShader = code
    this.notifyProgress(code, true)
    this.notifyShader(code)
  }

  destroy(): void {
    this.listeners.clear()
    this.progressListeners.clear()
  }

  subscribe(listener: ShaderListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  subscribeProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener)
    return () => this.progressListeners.delete(listener)
  }

  setPrompt(prompt: string): void {
    this.prompt = prompt
  }

  async rollbackToPreviousShader(): Promise<void> {
    this.notifyShader(this.lastShader)
  }

  private buildShaderFromPrompt(): string {
    if (!this.prompt) {
      return DEFAULT_SHADER
    }
    return `// prompt: ${this.prompt}\n${DEFAULT_SHADER}`
  }

  private notifyShader(code: string) {
    this.listeners.forEach((listener) => listener(code))
  }

  private notifyProgress(code: string, isComplete: boolean) {
    this.progressListeners.forEach((listener) => listener({ code, isComplete }))
  }
}
