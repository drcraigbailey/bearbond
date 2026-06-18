from pathlib import Path
import re

path = Path('src/components/MainBearScene.jsx')
text = path.read_text(encoding='utf-8')
original = text

scene_storage_block = """const saveStoredScene = (pairId, userId, sceneId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !sceneId) return;
  window.localStorage.setItem(getSceneStorageKey(pairId, userId), sceneId);
};
"""

avatar_storage_block = """const getDisplayAvatarStorageKey = (pairId, userId) => `bearbond.displayAvatar.${pairId}.${userId}`;

const getStoredDisplayAvatar = (pairId, userId) => {
  if (typeof window === 'undefined' || !pairId || !userId) return null;
  return window.localStorage.getItem(getDisplayAvatarStorageKey(pairId, userId));
};

const saveStoredDisplayAvatar = (pairId, userId, avatarId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !avatarId) return;
  window.localStorage.setItem(getDisplayAvatarStorageKey(pairId, userId), avatarId);
};

const getPartnerDisplayAvatarStorageKey = (pairId, userId) => `bearbond.partnerDisplayAvatar.${pairId}.${userId}`;

const getStoredPartnerDisplayAvatar = (pairId, userId) => {
  if (typeof window === 'undefined' || !pairId || !userId) return null;
  return window.localStorage.getItem(getPartnerDisplayAvatarStorageKey(pairId, userId));
};

const saveStoredPartnerDisplayAvatar = (pairId, userId, avatarId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !avatarId) return;
  window.localStorage.setItem(getPartnerDisplayAvatarStorageKey(pairId, userId), avatarId);
};
"""

if 'getDisplayAvatarStorageKey' not in text:
    if scene_storage_block not in text:
        raise SystemExit('Could not find scene storage block to insert avatar storage helpers.')
    text = text.replace(scene_storage_block, scene_storage_block + '\n' + avatar_storage_block)
elif 'getPartnerDisplayAvatarStorageKey' not in text:
    save_display_block = """const saveStoredDisplayAvatar = (pairId, userId, avatarId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !avatarId) return;
  window.localStorage.setItem(getDisplayAvatarStorageKey(pairId, userId), avatarId);
};
"""
    partner_only_block = """
const getPartnerDisplayAvatarStorageKey = (pairId, userId) => `bearbond.partnerDisplayAvatar.${pairId}.${userId}`;

const getStoredPartnerDisplayAvatar = (pairId, userId) => {
  if (typeof window === 'undefined' || !pairId || !userId) return null;
  return window.localStorage.getItem(getPartnerDisplayAvatarStorageKey(pairId, userId));
};

const saveStoredPartnerDisplayAvatar = (pairId, userId, avatarId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !avatarId) return;
  window.localStorage.setItem(getPartnerDisplayAvatarStorageKey(pairId, userId), avatarId);
};
"""
    if save_display_block not in text:
        raise SystemExit('Could not find display avatar helper block to add partner avatar helpers.')
    text = text.replace(save_display_block, save_display_block + partner_only_block)

text = text.replace(
    "const [activeDisplayCharacter, setActiveDisplayCharacter] = useState(() => partnerProfile?.character || 'yogi');",
    "const [activeDisplayCharacter, setActiveDisplayCharacter] = useState(() => getStoredDisplayAvatar(pair.id, user.id) || partnerProfile?.character || 'yogi');"
)

text = text.replace(
    "const [partnerCharacterOverride, setPartnerCharacterOverride] = useState('');",
    "const [partnerCharacterOverride, setPartnerCharacterOverride] = useState(() => getStoredDisplayAvatar(pair.id, user.id) || '');"
)

partner_override_line = "const [partnerCharacterOverride, setPartnerCharacterOverride] = useState(() => getStoredDisplayAvatar(pair.id, user.id) || '');"
if 'sentPartnerDisplayCharacter' not in text:
    text = text.replace(
        partner_override_line,
        partner_override_line + "\n  const [sentPartnerDisplayCharacter, setSentPartnerDisplayCharacter] = useState(() => getStoredPartnerDisplayAvatar(pair.id, user.id) || '');"
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
new_display_effect = """  useEffect(() => {
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

  useEffect(() => {
    setSentPartnerDisplayCharacter(getStoredPartnerDisplayAvatar(pair.id, user.id) || '');
  }, [pair.id, user.id]);
"""
if old_effects in text:
    text = text.replace(old_effects, new_display_effect)
elif 'setSentPartnerDisplayCharacter(getStoredPartnerDisplayAvatar' not in text:
    display_effect_pattern = re.compile(
        r"  useEffect\(\(\) => \{\n    const storedDisplayAvatar = getStoredDisplayAvatar\(pair\.id, user\.id\);.*?\n  \}, \[pair\.id, user\.id, partnerProfile\?\.id, partnerProfile\?\.character\]\);\n",
        re.S,
    )
    match = display_effect_pattern.search(text)
    if match:
      text = text[:match.end()] + """

  useEffect(() => {
    setSentPartnerDisplayCharacter(getStoredPartnerDisplayAvatar(pair.id, user.id) || '');
  }, [pair.id, user.id]);
""" + text[match.end():]

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

new_handle = """  const handleAvatarSelect = async (avatarId) => {
    if (!avatarId) return;

    const avatarName = getAvatarName(avatarId, availableAvatars);
    const now = new Date().toISOString();
    const commandSent = await sendDirectCommand({ commandType: 'avatar', commandName: avatarId });

    if (!commandSent) return;

    saveStoredPartnerDisplayAvatar(pair.id, user.id, avatarId);
    setSentPartnerDisplayCharacter(avatarId);

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

  const handleRemainLoggedInChange"""

text, count = re.subn(
    r"  const handleAvatarSelect = async \(avatarId\) => \{.*?\n  \};\n\n  const handleRemainLoggedInChange",
    new_handle,
    text,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'Could not safely replace handleAvatarSelect. Replacements made: {count}')

text = text.replace(
    "className={`settings-avatar-card ${ownCharacter === avatar.id ? 'selected' : ''}`}",
    "className={`settings-avatar-card ${sentPartnerDisplayCharacter === avatar.id ? 'selected' : ''}`}"
)
text = text.replace(
    "className={`settings-avatar-card ${displayCharacter === avatar.id ? 'selected' : ''}`}",
    "className={`settings-avatar-card ${sentPartnerDisplayCharacter === avatar.id ? 'selected' : ''}`}"
)

text = text.replace(
    """            <span className="setting-toggle-label">Avatar</span>
            <div className="settings-avatar-grid">""",
    """            <span className="setting-toggle-label">Partner display avatar</span>
            <span className="setting-toggle-hint">Selected avatar is the one currently showing on your partner's phone.</span>
            <div className="settings-avatar-grid">"""
)

if text == original:
    print('No changes made. The file may already be patched.')
else:
    path.write_text(text, encoding='utf-8')
    print('Patched MainBearScene.jsx: Settings now remembers and highlights the avatar selected for your partner until you change it again.')
