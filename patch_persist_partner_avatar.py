from pathlib import Path

path = Path('src/components/MainBearScene.jsx')
text = path.read_text(encoding='utf-8')
original = text

insert_after = """const saveStoredScene = (pairId, userId, sceneId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !sceneId) return;
  window.localStorage.setItem(getSceneStorageKey(pairId, userId), sceneId);
};
"""
insert_avatar_storage = """const saveStoredScene = (pairId, userId, sceneId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !sceneId) return;
  window.localStorage.setItem(getSceneStorageKey(pairId, userId), sceneId);
};

const getDisplayAvatarStorageKey = (pairId, userId) => `bearbond.displayAvatar.${pairId}.${userId}`;

const getStoredDisplayAvatar = (pairId, userId) => {
  if (typeof window === 'undefined' || !pairId || !userId) return null;
  return window.localStorage.getItem(getDisplayAvatarStorageKey(pairId, userId));
};

const saveStoredDisplayAvatar = (pairId, userId, avatarId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !avatarId) return;
  window.localStorage.setItem(getDisplayAvatarStorageKey(pairId, userId), avatarId);
};
"""
if 'getDisplayAvatarStorageKey' not in text:
    text = text.replace(insert_after, insert_avatar_storage)

text = text.replace(
    "const [activeDisplayCharacter, setActiveDisplayCharacter] = useState(() => partnerProfile?.character || 'yogi');",
    "const [activeDisplayCharacter, setActiveDisplayCharacter] = useState(() => getStoredDisplayAvatar(pair.id, user.id) || partnerProfile?.character || 'yogi');"
)

text = text.replace(
    "const [partnerCharacterOverride, setPartnerCharacterOverride] = useState('');",
    "const [partnerCharacterOverride, setPartnerCharacterOverride] = useState(() => getStoredDisplayAvatar(pair.id, user.id) || '');"
)

old_effects = """  useEffect(() => {
    if (partnerProfile?.character) {
      setActiveDisplayCharacter(partnerProfile.character);
    }
  }, [partnerProfile?.id, partnerProfile?.character]);

  useEffect(() => {
    setPartnerCharacterOverride('');
  }, [partnerProfile?.id, partnerProfile?.character]);
"""
new_effects = """  useEffect(() => {
    const storedDisplayAvatar = getStoredDisplayAvatar(pair.id, user.id);

    if (storedDisplayAvatar) {
      setPartnerCharacterOverride(storedDisplayAvatar);
      setActiveDisplayCharacter(storedDisplayAvatar);
      return;
    }

    if (partnerProfile?.character) {
      setActiveDisplayCharacter(partnerProfile.character);
    }
  }, [pair.id, user.id, partnerProfile?.id, partnerProfile?.character]);
"""
if old_effects in text:
    text = text.replace(old_effects, new_effects)

text = text.replace(
    """    setPartnerCharacterOverride(avatarId);
    setActiveDisplayCharacter(avatarId);
    setCurrentAnimation('idle');
""",
    """    setPartnerCharacterOverride(avatarId);
    setActiveDisplayCharacter(avatarId);
    saveStoredDisplayAvatar(pair.id, user.id, avatarId);
    setCurrentAnimation('idle');
"""
)

old_handle = """  const handleAvatarSelect = async (avatarId) => {
    if (avatarId === ownCharacter) return;

    if (!onAvatarChange) {
      showToast('Avatar picker is not available.');
      return;
    }

    const changed = await onAvatarChange(avatarId);

    if (!changed) {
      showToast('Could not change avatar.');
      return;
    }

    const avatarName = getAvatarName(avatarId, availableAvatars);
    const now = new Date().toISOString();
    const commandSent = await sendDirectCommand({ commandType: 'avatar', commandName: avatarId });

    if (commandSent) {
      await sendClosedAppPush({
        actionName: avatarId,
        eventType: 'avatar',
        notificationLabel: avatarName,
        eventAt: now,
      });
    }

    setCurrentAnimation('idle');
    showToast(commandSent
      ? `Your avatar changed to ${avatarName}. Partner updated.`
      : `Your avatar changed to ${avatarName}, but partner update did not send.`
    );
  };
"""
new_handle = """  const handleAvatarSelect = async (avatarId) => {
    if (!avatarId) return;

    const avatarName = getAvatarName(avatarId, availableAvatars);
    const now = new Date().toISOString();
    const commandSent = await sendDirectCommand({ commandType: 'avatar', commandName: avatarId });

    if (!commandSent) return;

    await sendClosedAppPush({
      actionName: avatarId,
      eventType: 'avatar',
      notificationLabel: avatarName,
      eventAt: now,
    });

    setSettingsOpen(false);
    setCurrentAnimation('idle');
    showToast(`Partner avatar changed to ${avatarName}.`);
  };
"""
if old_handle in text:
    text = text.replace(old_handle, new_handle)

text = text.replace(
    "className={`settings-avatar-card ${ownCharacter === avatar.id ? 'selected' : ''}`}",
    "className={`settings-avatar-card ${displayCharacter === avatar.id ? 'selected' : ''}`}"
)

if text == original:
    print('No changes made. The file may already be patched or the expected text changed.')
else:
    path.write_text(text, encoding='utf-8')
    print('Patched src/components/MainBearScene.jsx: partner avatar display now persists per pair/user.')
