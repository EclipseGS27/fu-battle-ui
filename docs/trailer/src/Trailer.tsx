// The whole trailer: five acts on one timeline, each fading in over the last moments of the one before.
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { Opening } from './scenes/Opening';
import { Combat } from './scenes/Combat';
import { Features } from './scenes/Features';
import { Showcase } from './scenes/Showcase';
import { Closing } from './scenes/Closing';
import { ACT_AT, ACT_LEN } from './timeline';
import { Soundtrack } from './audio/Soundtrack';

export const XFADE = 16;
export const ACTS = [
	{ name: 'Opening', from: ACT_AT.opening, len: ACT_LEN.opening, C: Opening },
	{ name: 'Combat', from: ACT_AT.combat, len: ACT_LEN.combat, C: Combat },
	{ name: 'Features', from: ACT_AT.features, len: ACT_LEN.features, C: Features },
	{ name: 'Showcase', from: ACT_AT.showcase, len: ACT_LEN.showcase, C: Showcase },
	{ name: 'Closing', from: ACT_AT.closing, len: ACT_LEN.closing, C: Closing },
];
export const TRAILER_LEN = ACT_AT.closing + ACT_LEN.closing;

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
