import React, { useEffect, useState } from "react";
import { BUDDY, BUDDY_BLINKING } from "../sprites.js";
import { PixelArt } from "./PixelArt.js";

export function Buddy() {
  const [isBlinking, setIsBlinking] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  return <PixelArt sprite={isBlinking ? BUDDY_BLINKING : BUDDY} />;
}
