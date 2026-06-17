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

const makeBuiltInSpriteSet = (suffix = '') => ({
  idle: getFirstAsset(`main${suffix}.png`, 'main.png'),
  wave: getFirstAsset(`wave${suffix}.png`, `Wave${suffix}.png`, 'Wave.png', 'wave.png', 'main.png'),
  love: getFirstAsset(`kiss${suffix}.png`, 'kiss.png', 'main.png'),
  hug: getFirstAsset(`hug${suffix}.png`, 'hug.png', 'main.png'),
  honey: getFirstAsset(`honey${suffix}.png`, 'honey.png', 'main.png'),
  sleep: getFirstAsset(`night${suffix}.png`, 'night.png', 'main.png'),
  dance: getFirstAsset(`cheeky${suffix}.png`, 'cheeky.png', 'main.png'),
  celebrate: getFirstAsset(`cane${suffix}.png`, 'cane.png', 'main.png'),
});

export const AVATAR_SPRITES = {
  yogi: makeBuiltInSpriteSet(''),
  craig: makeBuiltInSpriteSet('1'),
  alex: makeBuiltInSpriteSet('3'),
};

export const AVATARS = [
  {
    id: 'yogi',
    name: 'Yogi',
    preview: AVATAR_SPRITES.yogi.idle,
  },
  {
    id: 'craig',
    name: 'Craig',
    preview: AVATAR_SPRITES.craig.idle,
  },
  {
    id: 'alex',
    name: 'Alex',
    preview: AVATAR_SPRITES.alex.idle,
  },
];

export const AVATAR_BY_ID = AVATARS.reduce((avatars, avatar) => ({
  ...avatars,
  [avatar.id]: avatar,
}), {});

export const getAvatarName = (avatarId, avatars = AVATARS) => (
  avatars.find((avatar) => avatar.id === avatarId)?.name || AVATAR_BY_ID[avatarId]?.name || 'Yogi'
);

export const getAvatarPreview = (avatarId, avatars = AVATARS) => (
  avatars.find((avatar) => avatar.id === avatarId)?.preview || AVATAR_BY_ID[avatarId]?.preview || AVATARS[0].preview
);

export const getSpriteAsset = (avatarId = 'yogi', animation = 'idle', avatarSprites = AVATAR_SPRITES) => {
  const spriteSet = avatarSprites[avatarId] || AVATAR_SPRITES[avatarId] || AVATAR_SPRITES.yogi;
  return spriteSet[animation] || spriteSet.idle || AVATAR_SPRITES.yogi.idle;
};

export const mergeAvatarAssets = (remoteAvatars = []) => {
  const cleanedRemoteAvatars = (remoteAvatars || [])
    .filter((avatar) => avatar?.id && avatar?.name)
    .map((avatar) => {
      const preview = avatar.preview_url || avatar.idle_url || getAvatarPreview(avatar.id);

      return {
        id: avatar.id,
        name: avatar.name,
        preview,
        isRemote: true,
      };
    });

  const mergedAvatarsById = new Map();

  for (const avatar of AVATARS) {
    mergedAvatarsById.set(avatar.id, avatar);
  }

  for (const avatar of cleanedRemoteAvatars) {
    mergedAvatarsById.set(avatar.id, avatar);
  }

  const mergedSprites = { ...AVATAR_SPRITES };

  for (const avatar of remoteAvatars || []) {
    if (!avatar?.id) continue;

    const builtInFallback = AVATAR_SPRITES[avatar.id] || AVATAR_SPRITES.yogi;

    mergedSprites[avatar.id] = {
      idle: avatar.idle_url || avatar.preview_url || builtInFallback.idle,
      wave: avatar.wave_url || builtInFallback.wave,
      love: avatar.love_url || avatar.kiss_url || builtInFallback.love,
      hug: avatar.hug_url || builtInFallback.hug,
      honey: avatar.honey_url || builtInFallback.honey,
      sleep: avatar.sleep_url || avatar.night_url || builtInFallback.sleep,
      dance: avatar.dance_url || avatar.cheeky_url || builtInFallback.dance,
      celebrate: avatar.celebrate_url || avatar.cane_url || builtInFallback.celebrate,
    };
  }

  return {
    avatars: Array.from(mergedAvatarsById.values()),
    avatarSprites: mergedSprites,
  };
};
