import { useCallback, useEffect, useRef } from 'react';
import GlslCanvas from 'glslCanvas';
import type { AudioAnalysis } from '../modules/AudioInput';
import type { CSSProperties } from 'react';
import type { DeckTimelineState } from '../types/realtime';

type BlendMode = 'normal' | 'screen' | 'add' | 'multiply' | 'overlay';

const blendModeMap: Record<BlendMode, CSSProperties['mixBlendMode'] | undefined> = {
  normal: undefined,
  screen: 'screen',
  add: 'plus-lighter',
  multiply: 'multiply',
  overlay: 'overlay',
};

interface VideoLayerProps {
  id: string;
  src: string;
  opacity: number;
  blendMode?: BlendMode;
  mediaState?: DeckTimelineState;
  registerContainer?: (element: HTMLDivElement | null) => void;
  disableTimeSync?: boolean;
}

export function VideoFallbackLayer({
  id,
  src,
  opacity,
  blendMode,
  mediaState,
  registerContainer,
  disableTimeSync = false,
}: VideoLayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleVideoRef = useCallback(
    (element: HTMLDivElement | null) => {
      containerRef.current = element;
      registerContainer?.(element);
    },
    [registerContainer],
  );
  const mixBlend =
    blendMode && (blendModeMap[blendMode] ?? (blendMode as CSSProperties['mixBlendMode']));
  const resolvedSrc = mediaState?.src ?? src;
  const shouldPlay = opacity > 0.001 && (mediaState ? mediaState.isPlaying : true);

  useEffect(() => {
    const container = containerRef.current;
    const video = container?.querySelector('video') ?? null;
    if (!video) {
      return;
    }

    const attemptPlay = () => {
      try {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Ignore autoplay errors; the layer will retry on next opacity change.
          });
        }
      } catch {
        // Ignore synchronous play errors triggered by autoplay policies.
      }
    };

    const handleCanPlay = () => {
      video.removeEventListener('canplay', handleCanPlay);
      attemptPlay();
    };

    if (shouldPlay && !disableTimeSync) {
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        attemptPlay();
      } else {
        video.addEventListener('canplay', handleCanPlay);
      }
    } else {
      video.pause();
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [disableTimeSync, resolvedSrc, shouldPlay]);

  useEffect(() => {
    const container = containerRef.current;
    const video = container?.querySelector('video') ?? null;
    if (!video || !mediaState) {
      return;
    }

    if (!mediaState.isPlaying || !shouldPlay) {
      try {
        video.pause();
      } catch {
        // ignore pause failures
      }
    }
  }, [mediaState, shouldPlay]);

  useEffect(() => {
    if (disableTimeSync) {
      return;
    }

    const container = containerRef.current;
    const video = container?.querySelector('video') ?? null;
    if (!video || !mediaState) {
      return;
    }

    const nowSeconds = Date.now() / 1000;
    const basePosition = Number.isFinite(mediaState.basePosition) ? mediaState.basePosition : 0;
    const playRate = Number.isFinite(mediaState.playRate) ? mediaState.playRate : 1;
    const updatedAt = Number.isFinite(mediaState.updatedAt) ? mediaState.updatedAt : nowSeconds;
    const elapsed = mediaState.isPlaying ? Math.max(0, nowSeconds - updatedAt) : 0;
    const fallbackPosition = Number.isFinite(mediaState.position) ? mediaState.position : 0;
    const targetSeconds = mediaState.isPlaying
      ? Math.max(0, basePosition + elapsed * playRate)
      : Math.max(0, fallbackPosition);

    const syncCurrentTime = () => {
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) {
        const clampedTarget = Math.min(targetSeconds, duration);
        const tolerance = Math.max(0.2, duration * 0.02);
        if (Math.abs(video.currentTime - clampedTarget) > tolerance) {
          try {
            video.currentTime = clampedTarget;
          } catch {
            // ignore seek errors
          }
        }
      } else {
        try {
          video.currentTime = targetSeconds;
        } catch {
          // ignore seek errors
        }
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      syncCurrentTime();
      return;
    }

    const handleLoadedMetadata = () => {
      syncCurrentTime();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [disableTimeSync, mediaState, resolvedSrc]);

  useEffect(() => {
    if (disableTimeSync) {
      return;
    }

    const container = containerRef.current;
    const video = container?.querySelector('video') ?? null;
    if (!video || !mediaState) {
      return;
    }

    const desiredRate = Number.isFinite(mediaState.playRate) ? mediaState.playRate : 1;
    if (Math.abs(video.playbackRate - desiredRate) > 0.01) {
      try {
        video.playbackRate = desiredRate;
      } catch {
        // ignore playback rate errors
      }
    }
  }, [disableTimeSync, mediaState, resolvedSrc]);

  return (
    <div
      ref={handleVideoRef}
      className="fallback-layer"
      id={id}
      data-video-src={resolvedSrc}
      style={{
        opacity,
        mixBlendMode: mixBlend,
      }}
    />
  );
}

interface ShaderLayerProps {
  layerKey: string;
  shaderCode: string;
  opacity: number;
  blendMode?: BlendMode;
  registerAudioHandler: (
    key: string,
    handler: (data: AudioAnalysis, sensitivity: number) => void,
  ) => () => void;
}

function ensurePrecision(code: string): string {
  const needsPrecision = !/precision\s+mediump\s+float/.test(code);
  const hasMain = /void\s+main\s*\(/.test(code);
  const hasMainImage = /void\s+mainImage\s*\(\s*out\s+vec4\s+\w+\s*,\s*in\s+vec2\s+\w+\s*\)/.test(code);

  const prelude: string[] = [];
  if (needsPrecision) {
    prelude.push(`#ifdef GL_ES
precision mediump float;
#endif`);
  }

  // Common Shadertoy-style uniforms（足りないものだけ追加）
  if (!/uniform\s+vec3\s+iResolution/.test(code)) {
    prelude.push('uniform vec3 iResolution;');
  }
  if (!/uniform\s+float\s+iTime/.test(code)) {
    prelude.push('uniform float iTime;');
  }
  if (!/uniform\s+vec4\s+iMouse/.test(code)) {
    prelude.push('uniform vec4 iMouse;');
  }
  ['0', '1', '2', '3'].forEach((idx) => {
    if (!new RegExp(`uniform\\s+sampler2D\\s+iChannel${idx}`).test(code)) {
      prelude.push(`uniform sampler2D iChannel${idx};`);
    }
  });

  // textureLod を WebGL1 でも動くようにフォールバック
  if (code.includes('textureLod') && !/define\s+textureLod/.test(code)) {
    prelude.push(`#ifdef GL_EXT_shader_texture_lod
#extension GL_EXT_shader_texture_lod : enable
#define textureLod texture2DLodEXT
#else
#define textureLod texture2D
#endif`);
  }

  const body = hasMain
    ? code
    : hasMainImage
      ? `${code}

void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`
      : code;

  return `${prelude.join('\n')}\n${body}`;
}

function getFrequencyBandEnergy(frequencyData: Uint8Array, startRatio: number, endRatio: number) {
  const start = Math.floor(frequencyData.length * startRatio);
  const end = Math.floor(frequencyData.length * endRatio);
  if (end <= start) return 0;

  let sum = 0;
  for (let i = start; i < end; i += 1) {
    sum += frequencyData[i];
  }
  return (sum / (end - start)) / 255;
}

export function ShaderFallbackLayer({
  layerKey,
  shaderCode,
  opacity,
  blendMode,
  registerAudioHandler,
}: ShaderLayerProps) {
  const DUMMY_WHITE_PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/xcAAn8B9zZTSaIAAAAASUVORK5CYII=';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sandboxRef = useRef<GlslCanvas | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (sandboxRef.current) {
        try {
          sandboxRef.current.setUniform('iResolution', [canvas.width, canvas.height, 1]);
          sandboxRef.current.setUniform('u_resolution', [canvas.width, canvas.height]);
        } catch {
          // ignore uniform errors during resize
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const sandbox = new GlslCanvas(canvas);
    sandboxRef.current = sandbox;
    sandbox.load(ensurePrecision(shaderCode));
    const setTex = (sandbox as unknown as { setTexture?: (name: string, src: string) => void }).setTexture;
    if (typeof setTex === 'function') {
      setTex('iChannel0', DUMMY_WHITE_PX);
      setTex('iChannel1', DUMMY_WHITE_PX);
      setTex('iChannel2', DUMMY_WHITE_PX);
      setTex('iChannel3', DUMMY_WHITE_PX);
    }

    const syncResolution = () => {
      sandboxRef.current?.setUniform('iResolution', [canvas.width, canvas.height, 1]);
      sandboxRef.current?.setUniform('u_resolution', [canvas.width, canvas.height]);
    };
    syncResolution();

    let unregister = () => {};
    unregister = registerAudioHandler(layerKey, (audioData, sensitivity) => {
      const clamp = (value: number) => Math.min(1.0, Math.max(0.0, value * sensitivity));
      try {
        sandboxRef.current?.setUniform('u_volume', clamp(audioData.volume));
        sandboxRef.current?.setUniform(
          'u_bass',
          clamp(getFrequencyBandEnergy(audioData.frequencyData, 0, 0.1)),
        );
        sandboxRef.current?.setUniform(
          'u_mid',
          clamp(getFrequencyBandEnergy(audioData.frequencyData, 0.1, 0.5)),
        );
        sandboxRef.current?.setUniform(
          'u_high',
          clamp(getFrequencyBandEnergy(audioData.frequencyData, 0.5, 1.0)),
        );

        const spectrum = Array.from(audioData.frequencyData.slice(0, 32)).map((value) =>
          clamp(value / 255),
        );
        sandboxRef.current?.setUniform('u_spectrum', spectrum);
      } catch (err) {
        console.error('Failed to update fallback shader uniforms:', err);
      }
    });

    const tick = (ts: number) => {
      const t = (ts - startTimeRef.current) / 1000;
      try {
        sandboxRef.current?.setUniform('iTime', t);
        sandboxRef.current?.setUniform('u_time', t);
      } catch {
        // ignore uniform errors during teardown
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      unregister();
      sandbox.destroy();
      sandboxRef.current = null;
      window.removeEventListener('resize', resize);
    };
  }, [layerKey, shaderCode, registerAudioHandler]);

  useEffect(() => {
    if (!sandboxRef.current) return;
    try {
      sandboxRef.current.load(ensurePrecision(shaderCode));
    } catch (err) {
      console.error('Failed to load fallback shader:', err);
    }
  }, [shaderCode]);

  return (
    <canvas
      ref={canvasRef}
      className="fallback-layer"
      style={{
        opacity,
        mixBlendMode:
          blendMode && (blendModeMap[blendMode] ?? (blendMode as CSSProperties['mixBlendMode'])),
      }}
    />
  );
}
