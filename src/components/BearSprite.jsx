import { useEffect, useState } from 'react';
import '../styles/BearBond.css';

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
  idle: yogiMain, wave: yogiWave, love: yogiKiss, hug: yogiHug, honey: yogiHoney, sleep: yogiNight, dance: yogiCheeky, celebrate: yogiCane,
};

const CRAIG_MAP = {
  idle: craigMain, wave: craigWave, love: craigKiss, hug: craigHug, honey: craigHoney, sleep: craigNight, dance: craigCheeky, celebrate: craigCane,
};

const FRAME_COUNT = 6;

export default function BearSprite({ currentAnimation, onAnimationComplete, character = 'yogi' }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (currentAnimation === 'idle') return;

    const frameInterval = setInterval(() => {
      setFrame((prevFrame) => (prevFrame + 1) % FRAME_COUNT);
    }, 120);

    const actionTimeout = setTimeout(() => {
      if (onAnimationComplete) onAnimationComplete();
    }, 2880);

    return () => {
      clearInterval(frameInterval);
      clearTimeout(actionTimeout);
    };
  }, [currentAnimation, onAnimationComplete]);

  const SPRITE_MAP = character === 'craig' ? CRAIG_MAP : YOGI_MAP;
  const currentSpriteSrc = SPRITE_MAP[currentAnimation] || SPRITE_MAP.idle;
  const isIdle = currentAnimation === 'idle';

  return (
    <div className={`bear-sprite-wrapper ${character === 'craig' ? 'craig-sprite-wrapper' : ''}`}>
      <div 
        className="bear-sprite-animated"
        style={{
          backgroundImage: `url(${currentSpriteSrc})`,
          // Animated sheets are 6 frames wide. Use auto height so Craig keeps the same proportions as main1.png.
          backgroundSize: isIdle ? 'contain' : `${FRAME_COUNT * 100}% auto`,
          backgroundPosition: isIdle ? 'center' : `${(frame / (FRAME_COUNT - 1)) * 100}% center`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated'
        }}
      />
    </div>
  );
}
