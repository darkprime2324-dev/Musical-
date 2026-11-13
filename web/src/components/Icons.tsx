export const IconPlaylist = () => <svg viewBox="0 0 24 24"><path d="M4 6h12M4 12h12M4 18h8" /><path d="M19 12v6" /><circle cx="17" cy="18" r="2" /></svg>;
export const IconLyrics = () => <svg viewBox="0 0 24 24"><path d="M5 5h14M5 10h14M5 15h9M5 20h6" /></svg>;
export const IconFull = () => <svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
export const IconSettings = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>;
export const IconPlus = () => <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
export const IconPrev = () => <svg viewBox="0 0 24 24"><path d="M6 5v14M18 5l-10 7 10 7z" /></svg>;
export const IconNext = () => <svg viewBox="0 0 24 24"><path d="M18 5v14M6 5l10 7-10 7z" /></svg>;
export const IconPlay = ({ playing }: { playing: boolean }) => (
  <svg viewBox="0 0 24 24" id="playIcon">
    {playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /> : <path d="M7 4.5v15l13-7.5z" fill="currentColor" />}
  </svg>
);
