// How long each act runs, and where it starts in the trailer (180 s at 60 fps).
// The score (scripts/make-audio.py) follows the same boundaries: 0, 18, 68, 120.5, 156 and 180 s.
export const ACT_LEN = { opening: 1080, combat: 3000, features: 3150, showcase: 2130, closing: 1440 };
export const ACT_AT = {
	opening: 0,
	combat: ACT_LEN.opening,
	features: ACT_LEN.opening + ACT_LEN.combat,
	showcase: ACT_LEN.opening + ACT_LEN.combat + ACT_LEN.features,
	closing: ACT_LEN.opening + ACT_LEN.combat + ACT_LEN.features + ACT_LEN.showcase,
};
export const TOTAL = ACT_AT.closing + ACT_LEN.closing;
