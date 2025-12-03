import { GLSLGenerator, type GLSLGenerationOptions } from './GLSLGenerator'

export class GeminiGLSLGenerator extends GLSLGenerator {
  constructor(options: GLSLGenerationOptions) {
    super({ ...options, modelProvider: 'gemini' })
  }
}
