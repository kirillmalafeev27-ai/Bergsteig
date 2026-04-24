(function () {
  const PROFILE_STORAGE_KEY = 'bergstieg_profile_v2';
  const MAX_JOURNAL_ENTRIES = 16;
  const MAX_POLAROIDS = 12;
  const MAX_MARKERS = 24;
  const MAX_CAIRNS = 16;

  const RELICS = [
    {
      id: 'compass',
      title: 'Компас',
      kicker: 'Маршрутчик',
      plus: 'Показывает линию следующего камня',
      minus: 'Снежный щит недоступен',
      copy: 'Сухой латунный компас. Даёт одну точную подсказку, но оставляет без щита.'
    },
    {
      id: 'rosary',
      title: 'Чётки',
      kicker: 'Тихий ритм',
      plus: 'Кислород уходит медленнее',
      minus: 'Панорамы короче и спокойнее',
      copy: 'Помогают держать дыхание ровным, но сбивают азарт подъёма.'
    },
    {
      id: 'schnapps',
      title: 'Шнапс',
      kicker: 'Тепло внутри',
      plus: 'Время на склоне слегка замедляется',
      minus: 'Слоты 4 и 5 закрыты',
      copy: 'Согревает и тянет время, зато два последних бонуса остаются в рюкзаке.'
    },
    {
      id: 'photo',
      title: 'Фотография',
      kicker: 'Личный оберег',
      plus: 'Даёт одну дополнительную жизнь',
      minus: 'Лавины идут чаще',
      copy: 'Потрёпанный снимок кого-то важного. Иногда держит на тросе лишнюю секунду.'
    },
    {
      id: 'iceaxe',
      title: 'Старый ледоруб',
      kicker: 'Железная память',
      plus: 'Подъём сильнее и руки мерзнут медленнее',
      minus: 'Объектив быстрее забивает снегом',
      copy: 'Тяжёлый инструмент старой школы: помогает тянуться вверх, но цепляет весь снег на пути.'
    }
  ];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeStorageGetRaw(key, fallback = '') {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      console.warn(`Storage read failed for ${key}:`, error);
      return fallback;
    }
  }

  function safeStorageSetRaw(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Storage write failed for ${key}:`, error);
    }
  }

  function normalizeRelicId(id) {
    return RELICS.some((relic) => relic.id === id) ? id : RELICS[0].id;
  }

  function createDefaultProfile() {
    return {
      selectedRelic: RELICS[0].id,
      journal: [],
      photos: [],
      markers: [],
      cairns: [],
      companionLost: false,
      personalBest: 0,
      pendingPhrase: null,
      nextEcho: null,
      activeEcho: null,
      lastSession: null,
      laneFalls: {
        left: 0,
        center: 0,
        right: 0
      }
    };
  }

  function sanitizeProfile(rawProfile) {
    const fallback = createDefaultProfile();
    if (!rawProfile || typeof rawProfile !== 'object') {
      return fallback;
    }

    return {
      selectedRelic: normalizeRelicId(rawProfile.selectedRelic),
      journal: Array.isArray(rawProfile.journal) ? rawProfile.journal.slice(0, MAX_JOURNAL_ENTRIES) : [],
      photos: Array.isArray(rawProfile.photos) ? rawProfile.photos.slice(0, MAX_POLAROIDS) : [],
      markers: Array.isArray(rawProfile.markers) ? rawProfile.markers.slice(0, MAX_MARKERS) : [],
      cairns: Array.isArray(rawProfile.cairns) ? rawProfile.cairns.slice(0, MAX_CAIRNS) : [],
      companionLost: Boolean(rawProfile.companionLost),
      personalBest: Number.isFinite(rawProfile.personalBest) ? rawProfile.personalBest : 0,
      pendingPhrase: rawProfile.pendingPhrase && typeof rawProfile.pendingPhrase === 'object' ? rawProfile.pendingPhrase : null,
      nextEcho: rawProfile.nextEcho && typeof rawProfile.nextEcho === 'object' ? rawProfile.nextEcho : null,
      activeEcho: rawProfile.activeEcho && typeof rawProfile.activeEcho === 'object' ? rawProfile.activeEcho : null,
      lastSession: rawProfile.lastSession && typeof rawProfile.lastSession === 'object' ? rawProfile.lastSession : null,
      laneFalls: {
        left: Number(rawProfile.laneFalls && rawProfile.laneFalls.left) || 0,
        center: Number(rawProfile.laneFalls && rawProfile.laneFalls.center) || 0,
        right: Number(rawProfile.laneFalls && rawProfile.laneFalls.right) || 0
      }
    };
  }

  function loadProfile() {
    const raw = safeStorageGetRaw(PROFILE_STORAGE_KEY, '');
    if (!raw) {
      return createDefaultProfile();
    }
    try {
      return sanitizeProfile(JSON.parse(raw));
    } catch (error) {
      console.warn('Could not restore Bergstieg profile:', error);
      return createDefaultProfile();
    }
  }

  function saveProfile(profile) {
    const sanitized = sanitizeProfile(profile);
    safeStorageSetRaw(PROFILE_STORAGE_KEY, JSON.stringify(sanitized));
    if (typeof window !== 'undefined' && window.dispatchEvent && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('berg-memory-updated', {
        detail: deepClone(sanitized)
      }));
    }
  }

  function updateProfile(mutator) {
    const profile = loadProfile();
    mutator(profile);
    const sanitized = sanitizeProfile(profile);
    saveProfile(sanitized);
    return sanitized;
  }

  function pushBounded(list, item, maxItems) {
    list.unshift(item);
    if (list.length > maxItems) {
      list.length = maxItems;
    }
  }

  function laneKeyFromNumber(lane) {
    if (lane < 0) {
      return 'left';
    }
    if (lane > 0) {
      return 'right';
    }
    return 'center';
  }

  function getRelic(id) {
    return RELICS.find((relic) => relic.id === normalizeRelicId(id)) || RELICS[0];
  }

  function enabledBonusIdsForRelic(relicId) {
    const id = normalizeRelicId(relicId);
    if (id === 'schnapps') {
      return ['climb', 'sidestep', 'powerSwing'];
    }
    if (id === 'compass') {
      return ['climb', 'sidestep', 'powerSwing', 'cleanLens'];
    }
    return ['climb', 'sidestep', 'powerSwing', 'snowShield', 'cleanLens'];
  }

  function planEchoFromSummary(summary, profile) {
    if (!summary || typeof summary !== 'object') {
      return null;
    }

    if (summary.answers >= 6 && summary.correct === summary.answers) {
      return {
        id: `echo-cave-${Date.now()}`,
        type: 'cave',
        title: 'Пещера на линии',
        copy: 'Прошлая сессия прошла без ошибок. В стене открылся тёмный карман с тёплым светом.',
        createdAt: new Date().toISOString()
      };
    }

    const repeatedLane = Object.entries(profile.laneFalls || {}).find(([, count]) => count >= 3);
    if (repeatedLane) {
      return {
        id: `echo-climber-${Date.now()}`,
        type: 'old-climber',
        title: 'Старый альпинист',
        copy: 'На линии, где слишком часто случались падения, теперь стоит седой силуэт и ждёт в метели.',
        createdAt: new Date().toISOString()
      };
    }

    if (summary.bestStreak >= 5) {
      return {
        id: `echo-clear-sky-${Date.now()}`,
        type: 'clear-sky',
        title: 'Тихий коридор',
        copy: 'Серия правильных ответов оставила за собой спокойный участок: здесь ветер почти не трогает склон.',
        createdAt: new Date().toISOString()
      };
    }

    return null;
  }

  const BergMemory = {
    RELICS,

    loadProfile,

    saveProfile,

    getRelic,

    getSelectedRelic() {
      return getRelic(loadProfile().selectedRelic);
    },

    setSelectedRelic(relicId) {
      updateProfile((profile) => {
        profile.selectedRelic = normalizeRelicId(relicId);
      });
    },

    enabledBonusIdsForRelic,

    getJournalEntries() {
      return deepClone(loadProfile().journal);
    },

    getPhotos() {
      return deepClone(loadProfile().photos);
    },

    startSession() {
      return updateProfile((profile) => {
        if (profile.nextEcho) {
          profile.activeEcho = profile.nextEcho;
          profile.nextEcho = null;
        } else {
          profile.activeEcho = null;
        }
      });
    },

    clearActiveEcho() {
      updateProfile((profile) => {
        profile.activeEcho = null;
      });
    },

    queuePendingPhrase(entry) {
      updateProfile((profile) => {
        profile.pendingPhrase = {
          ...entry,
          queuedAt: new Date().toISOString()
        };
      });
    },

    completePendingPhrase(translation, meta = {}) {
      return updateProfile((profile) => {
        const pending = profile.pendingPhrase;
        if (!pending) {
          return;
        }
        pushBounded(profile.journal, {
          id: `journal-${Date.now()}`,
          createdAt: new Date().toISOString(),
          phrase: pending.phrase,
          translation: translation || pending.translation || 'Перевод не получен',
          language: pending.language || 'de',
          sourceTopic: pending.sourceTopic || '',
          sourceLevel: pending.sourceLevel || '',
          origin: meta.origin || pending.origin || 'session'
        }, MAX_JOURNAL_ENTRIES);
        profile.pendingPhrase = null;
      });
    },

    getPendingPhrase() {
      const profile = loadProfile();
      return profile.pendingPhrase ? { ...profile.pendingPhrase } : null;
    },

    recordPhoto(photo) {
      return updateProfile((profile) => {
        if (!photo || !photo.imageDataUrl) {
          return;
        }
        pushBounded(profile.photos, {
          id: `photo-${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...photo
        }, MAX_POLAROIDS);
      });
    },

    recordSessionSummary(summary) {
      return updateProfile((profile) => {
        const previousBest = Number(profile.personalBest) || 0;
        profile.lastSession = {
          ...summary,
          recordedAt: new Date().toISOString()
        };
        profile.personalBest = Math.max(profile.personalBest || 0, Number(summary.personalPeak) || 0);

        if (summary.personalPeak && Number(summary.personalPeak) > previousBest) {
          pushBounded(profile.markers, {
            id: `flag-${Date.now()}`,
            type: 'flag',
            lane: typeof summary.peakLane === 'number' ? summary.peakLane : 0,
            progress: Number(summary.personalPeak) || 0,
            title: 'Личный пик',
            copy: `Лучший выход: ${Math.round(summary.personalPeak)} м`
          }, MAX_MARKERS);
        }

        if (summary.fallMarker) {
          pushBounded(profile.markers, {
            id: `picket-${Date.now()}`,
            type: 'picket',
            lane: typeof summary.fallMarker.lane === 'number' ? summary.fallMarker.lane : 0,
            progress: Number(summary.fallMarker.progress) || 0,
            title: 'Пикет',
            copy: 'Здесь в прошлый раз сорвало с троса.'
          }, MAX_MARKERS);

          const laneKey = laneKeyFromNumber(summary.fallMarker.lane);
          profile.laneFalls[laneKey] = (profile.laneFalls[laneKey] || 0) + 1;
        }

        if (summary.scratchMarker) {
          pushBounded(profile.markers, {
            id: `scratch-${Date.now() + 1}`,
            type: 'scratch',
            lane: typeof summary.scratchMarker.lane === 'number' ? summary.scratchMarker.lane : 0,
            progress: Number(summary.scratchMarker.progress) || 0,
            title: 'Царапина на льду',
            copy: 'Здесь тебя поймал камень.'
          }, MAX_MARKERS);
        }

        if (summary.cairn) {
          pushBounded(profile.cairns, {
            id: `cairn-${Date.now()}`,
            progress: Number(summary.cairn.progress) || 0,
            lane: typeof summary.cairn.lane === 'number' ? summary.cairn.lane : 0,
            stones: Number(summary.cairn.stones) || 3,
            title: 'Каменная пирамидка',
            copy: summary.cairn.copy || 'След трудного ответа рядом со скалой.'
          }, MAX_CAIRNS);
        }

        if (summary.companionLost) {
          profile.companionLost = true;
        }

        const nextEcho = planEchoFromSummary(summary, profile);
        if (nextEcho) {
          profile.nextEcho = nextEcho;
        }
      });
    }
  };

  window.BERG_MEMORY = BergMemory;
})();
