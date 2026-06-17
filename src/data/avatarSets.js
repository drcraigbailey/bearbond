import yogiMain from '../assets/bear/main.png';
import yogiWave from '../assets/bear/Wave.png';
import yogiKiss from '../assets/bear/kiss.png';
import yogiHug from '../assets/bear/hug.png';
import yogiHoney from '../assets/bear/honey.png';
import yogiNight from '../assets/bear/night.png';
import yogiCheeky from '../assets/bear/cheeky.png';
import yogiCane from '../assets/bear/cane.png';

import craigMain from '../assets/bear/main1.png';
import craigWave from '../assets/bear/wave1.png';
import craigKiss from '../assets/bear/kiss1.png';
import craigHug from '../assets/bear/hug1.png';
import craigHoney from '../assets/bear/honey1.png';
import craigNight from '../assets/bear/night1.png';
import craigCheeky from '../assets/bear/cheeky1.png';
import craigCane from '../assets/bear/cane1.png';

import alexMain from '../assets/bear/main3.png';
import alexWave from '../assets/bear/wave3.png';
import alexKiss from '../assets/bear/kiss3.png';
import alexHug from '../assets/bear/hug3.png';
import alexHoney from '../assets/bear/honey3.png';
import alexNight from '../assets/bear/night3.png';
import alexCheeky from '../assets/bear/cheeky3.png';
import alexCane from '../assets/bear/cane3.png';

export const AVATAR_SPRITES = {
  yogi: {
    idle: yogiMain,
    wave: yogiWave,
    love: yogiKiss,
    hug: yogiHug,
    honey: yogiHoney,
    sleep: yogiNight,
    dance: yogiCheeky,
    celebrate: yogiCane,
  },
  craig: {
    idle: craigMain,
    wave: craigWave,
    love: craigKiss,
    hug: craigHug,
    honey: craigHoney,
    sleep: craigNight,
    dance: craigCheeky,
    celebrate: craigCane,
  },
  alex: {
    idle: alexMain,
    wave: alexWave,
    love: alexKiss,
    hug: alexHug,
    honey: alexHoney,
    sleep: alexNight,
    dance: alexCheeky,
    celebrate: alexCane,
  },
};

export const AVATARS = [
  {
    id: 'yogi',
    name: 'Yogi',
    preview: yogiMain,
  },
  {
    id: 'craig',
    name: 'Craig',
    preview: craigMain,
  },
  {
    id: 'alex',
    name: 'Alex',
    preview: alexMain,
  },
];

export const AVATAR_BY_ID = AVATARS.reduce((avatars, avatar) => ({
  ...avatars,
  [avatar.id]: avatar,
}), {});

export const getAvatarName = (avatarId) => AVATAR_BY_ID[avatarId]?.name || 'Yogi';

export const getAvatarPreview = (avatarId) => AVATAR_BY_ID[avatarId]?.preview || AVATARS[0].preview;

export const getSpriteAsset = (avatarId = 'yogi', animation = 'idle') => {
  const spriteSet = AVATAR_SPRITES[avatarId] || AVATAR_SPRITES.yogi;
  return spriteSet[animation] || spriteSet.idle || AVATAR_SPRITES.yogi.idle;
};
