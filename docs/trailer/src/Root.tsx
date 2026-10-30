import React from 'react';
import { Composition, Folder } from 'remotion';
import './global.css';
import { fontsReady } from './theme';
import { Trailer, TRAILER_LEN } from './Trailer';
import { Opening, OPENING_LEN } from './scenes/Opening';
import { Combat, COMBAT_LEN } from './scenes/Combat';
import { Features, FEATURES_LEN } from './scenes/Features';
import { Showcase, SHOWCASE_LEN } from './scenes/Showcase';
import { Closing, CLOSING_LEN } from './scenes/Closing';

fontsReady.catch(() => {});

const V = { fps: 60, width: 1920, height: 1080 };

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Trailer" component={Trailer} durationInFrames={TRAILER_LEN} {...V} />
		<Folder name="Acts">
			<Composition id="Opening" component={Opening} durationInFrames={OPENING_LEN} {...V} />
			<Composition id="Combat" component={Combat} durationInFrames={COMBAT_LEN} {...V} />
			<Composition id="Features" component={Features} durationInFrames={FEATURES_LEN} {...V} />
			<Composition id="Showcase" component={Showcase} durationInFrames={SHOWCASE_LEN} {...V} />
			<Composition id="Closing" component={Closing} durationInFrames={CLOSING_LEN} {...V} />
		</Folder>
	</>
);
