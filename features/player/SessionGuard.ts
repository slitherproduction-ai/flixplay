export type PlaybackSessionToken = number;

export type PlaybackSessionGuard = {
  begin: () => PlaybackSessionToken;
  isCurrent: (token: PlaybackSessionToken) => boolean;
  end: (token: PlaybackSessionToken) => void;
  invalidate: () => void;
};

export function createPlaybackSessionGuard(): PlaybackSessionGuard {
  let generation = 0;
  let active: PlaybackSessionToken | null = null;

  return {
    begin() {
      generation += 1;
      active = generation;
      return generation;
    },
    isCurrent(token) {
      return active === token;
    },
    end(token) {
      if (active === token) active = null;
    },
    invalidate() {
      generation += 1;
      active = null;
    },
  };
}
