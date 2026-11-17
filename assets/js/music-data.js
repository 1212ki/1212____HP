(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MusicData = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function isReleaseDateFormat(value) {
    return typeof value === 'string' && value.length === 10 && /^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$/.test(value);
  }
  function releases(data) {
    return ['digital', 'demo'].flatMap(key => Array.isArray(data?.discography?.[key]) ? data.discography[key] : []);
  }
  function sortReleasesByDate(items) {
    return items.slice().sort((a, b) => {
      const av = isReleaseDateFormat(a.releaseDate), bv = isReleaseDateFormat(b.releaseDate);
      if (av !== bv) return av ? -1 : 1;
      if (!av || a.releaseDate === b.releaseDate) return 0;
      return a.releaseDate > b.releaseDate ? -1 : 1;
    });
  }
  function resolveFeaturedRelease(data) {
    const all = releases(data);
    const explicit = typeof data?.site?.featuredReleaseId === 'string' && data.site.featuredReleaseId;
    return (explicit && all.find(item => item.id === explicit))
      || sortReleasesByDate(all).find(item => isReleaseDateFormat(item.releaseDate)) || null;
  }
  function clearDanglingMusicReferences(input) {
    const data = structuredClone(input || {});
    if (!data.site || typeof data.site !== 'object') data.site = {};
    const all = releases(data);
    const ids = new Set(all.map(item => item.id));
    const videoIds = new Set(['musicVideos', 'liveMovies', 'demos'].flatMap(key =>
      Array.isArray(data.youtube?.[key]) ? data.youtube[key].map(item => item.id) : []));
    if (typeof data.site.featuredReleaseId !== 'string' || !ids.has(data.site.featuredReleaseId)) data.site.featuredReleaseId = '';
    for (const item of all) {
      if (typeof item.releaseType !== 'string') item.releaseType = '';
      if (typeof item.playbackVideoId !== 'string' || !videoIds.has(item.playbackVideoId)) item.playbackVideoId = '';
    }
    return data;
  }
  return { isReleaseDateFormat, sortReleasesByDate, resolveFeaturedRelease, clearDanglingMusicReferences };
}));
