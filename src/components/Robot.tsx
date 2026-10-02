import React, { useEffect, useState } from "react";
import { ROBOT_FRAMES } from "../sprites.js";
import { PixelArt } from "./PixelArt.js";

export function Robot() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current + 1) % ROBOT_FRAMES.length), 450);
    return () => clearInterval(timer);
  }, []);
  return <PixelArt sprite={ROBOT_FRAMES[frame]} />;
}
