const bearAssets = import.meta.glob('../assets/bear/*.png', {
  eager: true,
  import: 'default',
});

const getAssetByFileName = (fileName) => {
  const match = Object.entries(bearAssets).find(([path]) => path.endsWith(`/${fileName}`));
  return match?.[1] || null;
};

const getFirstAsset = (...fileNames) => {
  for (const fileName of fileNames) {
    const asset = getAssetByFileName(fileName);
    if (asset) return asset;
  }

  return getAssetByFileName('main.png');
};

export const AVATARS = [
  {
    id: 'yogi',
    name: 'Yogi',
    suffix: '',
    preview: getFirstAsset('main.png'),
  },
  {
    id: 'craig',
    name: 'Craig',
    suffix: '1',
    preview: getFirstAsset('main1.png', 'main.png'),
  },
  {
    id: 'alex',
    name: 'Alex',
    suffix: '3',
    preview: getFirstAsset('main3.png', 'main.png'),
  },
];

export const AVATAR_BY_ID = AVATARS.reduce((avatars, avatar) => ({
  ...avatars,
  [avatar.id]: avatar,
}), {});

const SPRITE_BASENAMES = {
  idle: ['main'],
  wave: ['wave', 'Wave'],
  love: ['kiss'],
  hug: ['hug'],
  honey: ['honey'],
  sleep: ['night'],
  dance: ['cheeky'],
  celebrate: ['cane'],
};

export const getAvatarName = (avatarId) => AVATAR_BY_ID[avatarId]?.name || 'Yogi';

export const getAvatarPreview = (avatarId) => AVATAR_BY_ID[avatarId]?.preview || AVATARS[0].preview;

export const getSpriteAsset = (avatarId = 'yogi', animation = 'idle') => {
  const avatar = AVATAR_BY_ID[avatarId] || AVATARS[0];
  const baseNames = SPRITE_BASENAMES[animation] || SPRITE_BASENAMES.idle;

  const avatarFileCandidates = baseNames.flatMap((baseName) => [
    `${baseName}${avatar.suffix}.png`,
    `${baseName}.png`,
  ]);

  return getFirstAsset(...avatarFileCandidates, 'main.png');
};
