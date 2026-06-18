const rootBearAssets = import.meta.glob('../assets/bear/*.png', {
  eager: true,
  import: 'default',
});

const nestedBearAssets = import.meta.glob('../assets/bear/**/*.png', {
  eager: true,
  import: 'default',
});

const bearAssets = {
  ...rootBearAssets,
  ...nestedBearAssets,
};

const normalisePath = (path) => path.replace(/\\/g, '/').toLowerCase();

const getAssetFromFolder = (avatarId, fileName) => {
  const expectedEnding = `/bear/${avatarId}/${fileName}`.toLowerCase();
  const match = Object.entries(bearAssets).find(([path]) => normalisePath(path).endsWith(expectedEnding));
  return match?.[1] || null;
};

const getAssetFromBearRoot = (fileName) => {
  const expectedEnding = `/bear/${fileName}`.toLowerCase();
  const match = Object.entries(bearAssets).find(([path]) => normalisePath(path).endsWith(expectedEnding));
  return match?.[1] || null;
};

const getFirstAssetFromFolder = (avatarId, fileNames = []) => {
  for (const fileName of fileNames) {
    const asset = getAssetFromFolder(avatarId, fileName);
    if (asset) return asset;
  }

  return null;
};

const getFirstAssetFromBearRoot = (fileNames = []) => {
  for (const fileName of fileNames) {
    const asset = getAssetFromBearRoot(fileName);
    if (asset) return asset;
  }

  return null;
};

const addSuffixBeforeExtension = (fileName, suffix = '') => {
  if (!suffix) return fileName;
  return fileName.replace(/(\.[^.]+)$/, `${suffix}$1`);
};

const withLegacySuffix = (fileNames = [], suffix = '') => fileNames.map((fileName) => addSuffixBeforeExtension(fileName, suffix));

const SPRITE_FILE_NAMES = {
  idle: ['main.png'],
  wave: ['wave.png', 'Wave.png'],
  hello: ['hello.png', 'wave.png', 'Wave.png'],
  love: ['kiss.png'],
  hug: ['hug.png'],
  honey: ['honey.png'],
  night: ['night.png'],
  sleep: ['night.png'],
  dance: ['cheeky.png'],
  celebrate: ['cane.png'],
  chicken: ['chicken.png'],
};

const getBuiltInAsset = (avatarId, animation, legacySuffix = '') => {
  const folderFileNames = SPRITE_FILE_NAMES[animation] || SPRITE_FILE_NAMES.idle;
  const legacyFileNames = [
    ...withLegacySuffix(folderFileNames, legacySuffix),
    ...folderFileNames,
  ];

  return (
    getFirstAssetFromFolder(avatarId, folderFileNames) ||
    getFirstAssetFromBearRoot(legacyFileNames) ||
    getFirstAssetFromFolder('yogi', SPRITE_FILE_NAMES.idle) ||
    getFirstAssetFromBearRoot(SPRITE_FILE_NAMES.idle)
  );
};

const makeBuiltInSpriteSet = (avatarId, legacySuffix = '') => ({
  idle: getBuiltInAsset(avatarId, 'idle', legacySuffix),
  wave: getBuiltInAsset(avatarId, 'wave', legacySuffix),
  hello: getBuiltInAsset(avatarId, 'hello', legacySuffix),
  love: getBuiltInAsset(avatarId, 'love', legacySuffix),
  hug: getBuiltInAsset(avatarId, 'hug', legacySuffix),
  honey: getBuiltInAsset(avatarId, 'honey', legacySuffix),
  night: getBuiltInAsset(avatarId, 'night', legacySuffix),
  sleep: getBuiltInAsset(avatarId, 'sleep', legacySuffix),
  dance: getBuiltInAsset(avatarId, 'dance', legacySuffix),
  celebrate: getBuiltInAsset(avatarId, 'celebrate', legacySuffix),
  chicken: getBuiltInAsset(avatarId, 'chicken', legacySuffix),
});

export const BUILT_IN_AVATAR_SPRITES = {
  yogi: makeBuiltInSpriteSet('yogi'),
  craig: makeBuiltInSpriteSet('craig', '1'),
  alex: makeBuiltInSpriteSet('alex', '3'),
};

export const BUILT_IN_AVATARS = [
  {
    id: 'yogi',
    name: 'Yogi',
    preview: BUILT_IN_AVATAR_SPRITES.yogi.idle,
  },
  {
    id: 'craig',
    name: 'Craig',
    preview: BUILT_IN_AVATAR_SPRITES.craig.idle,
  },
  {
    id: 'alex',
    name: 'Alex',
    preview: BUILT_IN_AVATAR_SPRITES.alex.idle,
  },
];

// Mutable registries so Supabase avatars can be added while the app is running.
export const AVATAR_SPRITES = { ...BUILT_IN_AVATAR_SPRITES };
export const AVATARS = [...BUILT_IN_AVATARS];

export const AVATAR_BY_ID = {};

const rebuildAvatarIndex = () => {
  for (const key of Object.keys(AVATAR_BY_ID)) delete AVATAR_BY_ID[key];
  for (const avatar of AVATARS) AVATAR_BY_ID[avatar.id] = avatar;
};

rebuildAvatarIndex();

export const getAvatarName = (avatarId, avatars = AVATARS) => (
  avatars.find((avatar) => avatar.id === avatarId)?.name || AVATAR_BY_ID[avatarId]?.name || 'Yogi'
);

export const getAvatarPreview = (avatarId, avatars = AVATARS) => (
  avatars.find((avatar) => avatar.id === avatarId)?.preview || AVATAR_BY_ID[avatarId]?.preview || AVATARS[0].preview
);

export const getSpriteAsset = (avatarId = 'yogi', animation = 'idle', avatarSprites = AVATAR_SPRITES) => {
  const spriteSet = avatarSprites[avatarId] || AVATAR_SPRITES[avatarId] || BUILT_IN_AVATAR_SPRITES[avatarId] || BUILT_IN_AVATAR_SPRITES.yogi;
  return spriteSet[animation] || spriteSet.idle || BUILT_IN_AVATAR_SPRITES.yogi.idle;
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

  for (const avatar of BUILT_IN_AVATARS) {
    mergedAvatarsById.set(avatar.id, avatar);
  }

  for (const avatar of cleanedRemoteAvatars) {
    mergedAvatarsById.set(avatar.id, avatar);
  }

  const mergedSprites = { ...BUILT_IN_AVATAR_SPRITES };

  for (const avatar of remoteAvatars || []) {
    if (!avatar?.id) continue;

    const builtInFallback = BUILT_IN_AVATAR_SPRITES[avatar.id] || BUILT_IN_AVATAR_SPRITES.yogi;
    const nightSprite = avatar.night_url || avatar.sleep_url || builtInFallback.night || builtInFallback.sleep;

    mergedSprites[avatar.id] = {
      idle: avatar.idle_url || avatar.preview_url || builtInFallback.idle,
      wave: avatar.wave_url || builtInFallback.wave,
      hello: avatar.hello_url || avatar.wave_url || builtInFallback.hello || builtInFallback.wave,
      love: avatar.love_url || avatar.kiss_url || builtInFallback.love,
      hug: avatar.hug_url || builtInFallback.hug,
      honey: avatar.honey_url || builtInFallback.honey,
      night: nightSprite,
      sleep: nightSprite,
      dance: avatar.dance_url || avatar.cheeky_url || builtInFallback.dance,
      celebrate: avatar.celebrate_url || avatar.cane_url || builtInFallback.celebrate,
      chicken: avatar.chicken_url || builtInFallback.chicken,
    };
  }

  AVATARS.splice(0, AVATARS.length, ...Array.from(mergedAvatarsById.values()));

  for (const key of Object.keys(AVATAR_SPRITES)) {
    if (!mergedSprites[key]) delete AVATAR_SPRITES[key];
  }

  for (const [key, value] of Object.entries(mergedSprites)) {
    AVATAR_SPRITES[key] = value;
  }

  rebuildAvatarIndex();

  return {
    avatars: AVATARS,
    avatarSprites: AVATAR_SPRITES,
  };
};
