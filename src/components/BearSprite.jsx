import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/BearBond.css';
import '../styles/SpriteFix.css';

// --- YOGI SPRITES (PNGs) ---
import yogiMain from '../assets/bear/main.png';
import yogiWave from '../assets/bear/Wave.png'; 
import yogiKiss from '../assets/bear/kiss.png';
import yogiHug from '../assets/bear/hug.png'; 
import yogiHoney from '../assets/bear/honey.png';
import yogiNight from '../assets/bear/night.png';
import yogiCheeky from '../assets/bear/cheeky.png';
import yogiCane from '../assets/bear/cane.png';

// --- CRAIG SPRITES (PNGs) ---
import craigMain from '../assets/bear/main1.png';
import craigWave from '../assets/bear/wave1.png'; 
import craigKiss from '../assets/bear/kiss1.png';
import craigHug from '../assets/bear/hug1.png'; 
import craigHoney from '../assets/bear/honey1.png';
import craigNight from '../assets/bear/night1.png';
import craigCheeky from '../assets/bear/cheeky1.png';
import craigCane from '../assets/bear/cane1.png';

const YOGI_MAP = {
  idle: yogiMain,
  wave: yogiWave,
  love: yogiKiss,
  hug: yogiHug,
  honey: yogiHoney,
  sleep: yogiNight,
  dance: yogiCheeky,
  celebrate: yogiCane,
};

const CRAIG_MAP = {
  idle: craigMain,
  wave: craigWave,
  love: craigKiss,
  hug: craigHug,
  honey: craigHoney,
  sleep: craigNight,
  dance: craigCheeky,
  celebrate: craigCane,
};

const FRAME_COUNT = 6;
const FRAME_DURATION_MS = 140;
const ACTION_PLAYTHROUGH_COUNT = 3;
const MAX_SPRITE_BOX = 250;
const FALLBACK_RATIOS = {
  yogi: 1,
  craig: 0.62,
};

const getFittedFrameSize = (ratio) => {
  if (ratio >= 1) {
    return {
      width: MAX_SPRITE_BOX,
      height: MAX_SPRITE_BOX / ratio,
    };
  }

  return {
    width: MAX_SPRITE_BOX * ratio,
    height: MAX_SPRITE_BOX,
  };
};

export default function BearSprite({ currentAnimation, onAnimationComplete, character = 'yogi' }) {
  const [frame, setFrame] = useState(0);
  const [frameRatio, setFrameRatio] = useState(FALLBACK_RATIOS[character] || 1);
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  const SPRITE_MAP = character === 'craig' ? CRAIG_MAP : YOGI_MAP;
  const currentSpriteSrc = SPRITE_MAP[currentAnimation] || SPRITE_MAP.idle;
  const isIdle = currentAnimation === 'idle';

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    setFrame(0);

    if (currentAnimation === 'idle') return undefined;

    let absoluteFrame = 0;
    const totalFrames = FRAME_COUNT * ACTION_PLAYTHROUGH_COUNT;

    const frameInterval = window.setInterval(() => {
      absoluteFrame += 1;

      if (absoluteFrame >= totalFrames) {
        window.clearInterval(frameInterval);
        setFrame(FRAME_COUNT - 1);

        window.setTimeout(() => {
          onAnimationCompleteRef.current?.();
        }, 120);

        return;
      }

      setFrame(absoluteFrame % FRAME_COUNT);
    }, FRAME_DURATION_MS);

    return () => {
      window.clearInterval(frameInterval);
    };
  }, [currentAnimation]);

  useEffect(() => {
    const image = new Image();

    image.onload = () => {
      const frameWidth = isIdle ? image.naturalWidth : image.naturalWidth / FRAME_COUNT;
      const frameHeight = image.naturalHeight || MAX_SPRITE_BOX;
      setFrameRatio(frameWidth / frameHeight);
    };

    image.src = currentSpriteSrc;
  }, [currentSpriteSrc, isIdle]);

  const frameSize = useMemo(() => getFittedFrameSize(frameRatio || 1), [frameRatio]);
  const spriteStateClass = isIdle ? 'idle-sprite-wrapper' : 'action-sprite-wrapper';

  return (
    <div className={`bear-sprite-wrapper ${character === 'craig' ? 'craig-sprite-wrapper' : ''} ${spriteStateClass}`}>
      <div
        className="bear-frame-viewport"
        style={{
          width: `${frameSize.width}px`,
          height: `${frameSize.height}px`,
        }}
      >
        {isIdle ? (
          <img
            src={currentSpriteSrc}
            alt=""
            className="bear-sprite-image"
            draggable="false"
          />
        ) : (
          <img
            src={currentSpriteSrc}
            alt=""
            className="bear-sprite-sheet"
            draggable="false"
            style={{
              height: `${frameSize.height}px`,
              transform: `translateX(-${frame * frameSize.width}px)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
