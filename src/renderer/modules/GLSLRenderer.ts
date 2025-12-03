import type { AudioAnalysis } from './AudioInput'

export class GLSLRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private frame: number | null = null
  private hue = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.handleResize()
    window.addEventListener('resize', this.handleResize)
    this.start()
  }

  updateShader(_shaderCode: string): Promise<boolean> {
    return Promise.resolve(true)
  }

  renderAudioAnalysis(_analysis: AudioAnalysis, _sensitivity: number): void {
    // not implemented in canvas fallback
  }

  updateAudioData(_analysis: AudioAnalysis, _sensitivity: number): void {
    // compatibility shim
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResize)
    if (this.frame) cancelAnimationFrame(this.frame)
  }

  private start() {
    const loop = () => {
      this.drawFrame()
      this.frame = requestAnimationFrame(loop)
    }
    loop()
  }

  private drawFrame() {
    if (!this.ctx) return
    const { width, height } = this.canvas
    this.ctx.clearRect(0, 0, width, height)
    const gradient = this.ctx.createLinearGradient(0, 0, width, height)
    this.hue = (this.hue + 0.4) % 360
    gradient.addColorStop(0, `hsl(${this.hue}, 70%, 55%)`)
    gradient.addColorStop(1, `hsl(${(this.hue + 120) % 360}, 70%, 45%)`)
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(0, 0, width, height)
  }

  private handleResize = () => {
    const ratio = window.devicePixelRatio || 1
    this.canvas.width = Math.floor(window.innerWidth * ratio)
    this.canvas.height = Math.floor(window.innerHeight * ratio)
    this.canvas.style.width = `${window.innerWidth}px`
    this.canvas.style.height = `${window.innerHeight}px`
  }
}
