import { useEffect, useRef, useState } from "react";
import { clampTime, SCENE_SEGMENT_MS } from "../../shared/sceneMotion";

export function useScenePlayback({
  sceneId,
  count,
  position,
  onPosition,
  context,
  reduced,
}: {
  sceneId: string;
  count: number;
  position: number;
  onPosition: (n: number) => void;
  context: string;
  reduced: boolean;
}) {
  const [time, setTime] = useState(position);
  const [mode, setMode] = useState<"idle" | "play" | "seek">("idle");
  const [speed, setSpeed] = useState(1);
  const clock = useRef(position),
    committed = useRef(position),
    target = useRef(0);
  const speedRef = useRef(speed),
    callback = useRef(onPosition);
  speedRef.current = speed;
  callback.current = onPosition;
  const publish = (value: number) => {
    const next = clampTime(value, count);
    clock.current = next;
    setTime(next);
    const semantic = Math.floor(next);
    if (semantic !== committed.current) {
      committed.current = semantic;
      callback.current(semantic);
    }
  };
  useEffect(() => {
    if (position !== committed.current) {
      setMode("idle");
      committed.current = position;
      clock.current = position;
      setTime(position);
    }
  }, [position]);
  useEffect(() => {
    setMode("idle");
    clock.current = position;
    committed.current = position;
    setTime(position);
  }, [sceneId]);
  useEffect(() => {
    setMode("idle");
    const stop = Math.floor(clock.current);
    clock.current = stop;
    setTime(stop);
  }, [context, reduced]);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) {
        setMode("idle");
        const at = Math.floor(clock.current);
        clock.current = at;
        setTime(at);
      }
    };
    document.addEventListener("visibilitychange", stop);
    return () => document.removeEventListener("visibilitychange", stop);
  }, []);
  useEffect(() => {
    if (mode === "idle" || reduced) return;
    let handle = 0,
      last: number | undefined;
    const tick = (now: number) => {
      if (document.hidden) {
        setMode("idle");
        return;
      }
      const delta =
        last === undefined
          ? 0
          : (Math.min(80, now - last) / SCENE_SEGMENT_MS) * speedRef.current;
      last = now;
      const end = mode === "play" ? count - 1 : target.current;
      const direction = end >= clock.current ? 1 : -1;
      const next =
        direction > 0
          ? Math.min(end, clock.current + delta)
          : Math.max(end, clock.current - delta);
      publish(next);
      if (next === end) setMode("idle");
      else handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [mode, reduced, sceneId, count, context]);
  const seek = (value: number) => {
    setMode("idle");
    publish(value);
  };
  const move = (value: number) => {
    const next = clampTime(value, count);
    if (reduced) {
      seek(next);
      return;
    }
    target.current = next;
    if (Math.abs(next - clock.current) < 1e-8) {
      seek(next);
      return;
    }
    setMode("seek");
  };
  const play = () => {
    if (reduced) {
      seek(Math.min(count - 1, Math.floor(clock.current) + 1));
      return;
    }
    if (clock.current >= count - 1) publish(0);
    setMode("play");
  };
  const toggle = () => {
    if (mode !== "idle") setMode("idle");
    else play();
  };
  return {
    time,
    playing: mode === "play",
    moving: mode !== "idle",
    speed,
    setSpeed,
    seek,
    move,
    toggle,
    play,
  };
}
