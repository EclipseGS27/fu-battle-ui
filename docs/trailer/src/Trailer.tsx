// The whole trailer: five acts on one timeline, each fading in over the last moments of the one before.
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { Opening } from './scenes/Opening';
import { Combat, COMBAT_LEN } from './scenes/Combat';
import { Features, FEATURES_LEN } from './scenes/Features';
import { Showcase, SHOWCASE_LEN } from './scenes/Showcase';
import { Closing, CLOSING_LEN } from './scenes/Closing';
import { Soundtrack } from './audio/Soundtrack';

export const XFADE = 16;
export const ACTS = (() => {
	const list: { name: string; len: number; C: React.FC }[] = [
		{ name: 'Opening', len: 600, C: Opening },
		{ name: 'Combat', len: COMBAT_LEN, C: Combat },
		{ name: 'Features', len: FEATURES_LEN, C: Features },
		{ name: 'Showcase', len: SHOWCASE_LEN, C: Showcase },
		{ name: 'Closing', len: CLOSING_LEN, C: Closing },
	];
	let at = 0;
	return list.map((a) => {
		const from = at;
		at += a.len;
		return { ...a, from };
	});
})();
export const TRAILER_LEN = ACTS[ACTS.length - 1].from + ACTS[ACTS.length - 1].len;

const FadeIn: React.FC<{ children: React.ReactNode; first: boolean }> = ({ children, first }) => {
	const f = useCurrentFrame();
	return <AbsoluteFill style={{ opacity: first ? 1 : interpolate(f, [0, XFADE], [0, 1], { extrapolateRight: 'clamp' }) }}>{children}</AbsoluteFill>;
};

export const Trailer: React.FC = () => (
	<AbsoluteFill style={{ background: '#03050b' }}>
		{ACTS.map((a, i) => (
			<Sequence key={a.name} name={a.name} from={i ? a.from - XFADE : 0} durationInFrames={a.len + (i ? XFADE : 0) + (i < ACTS.length - 1 ? XFADE : 0)}>
				<FadeIn first={i === 0}>
					{i ? (
						<Sequence from={0} layout="none">
							<a.C />
						</Sequence>
					) : (
						<a.C />
					)}
				</FadeIn>
			</Sequence>
		))}
		<Soundtrack />
	</AbsoluteFill>
);
