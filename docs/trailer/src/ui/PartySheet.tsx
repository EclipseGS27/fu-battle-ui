// The Battle UI party sheet, rebuilt from its templates (templates/party/roster.hbs, tabs.hbs, header.hbs)
// and styled by its own styles/sheet.css + styles/party.css.
import React from 'react';
import '../vendor/fu-battle-ui/styles/sheet.css';
import '../vendor/fu-battle-ui/styles/party.css';
import { ART, ArtName, artUrl, faceUrl } from '../art/art';

export type PartyMember = {
	art: ArtName;
	name: string;
	level: number;
	exp: number;
	hp: [number, number];
	mp: [number, number];
	ip: [number, number];
	stats: [string, string][];
	main: string;
	cl: number;
	identity: string;
	more: string;
	fp: number;
	chips?: [string, string][];
	crisis?: boolean;
};

const pct = (a: number, b: number) => Math.max(0, Math.min(100, (a / b) * 100));

export const PartySheet: React.FC<{ members: PartyMember[]; cursor: number; rise: (i: number) => number; glowLv: number; w: number; h: number }> = ({ members, cursor, rise, glowLv, w, h }) => {
	const tabs = ['Party', 'Inventory', 'Adversaries', 'Codex', 'Bonds', 'Settings'];
	return (
		<div className="application fbui-sheet fbui-party sheet" style={{ width: w, height: h }}>
			<header className="window-header">
				<h1 className="window-title">Party: The Oracle’s Escort</h1>
			</header>
			<section className="window-content">
				<nav className="fbp-menu tabs">
					{tabs.map((t, i) => (
						<a key={t} className={`fbp-mi ${i === cursor ? 'active' : ''}`}>
							{t}
						</a>
					))}
					<span className="fbp-sep" />
					<button type="button" className="fbp-mi act">
						<i className="fas fa-bed" />
						Rest
					</button>
					<button type="button" className="fbp-mi act">
						<i className="fas fa-feather" />
						Award
					</button>
					<button type="button" className="fbp-mi act">
						<i className="fas fa-clock" />
						Add clock
					</button>
					<button type="button" className="fbp-mi act">
						<i className="fa-solid fa-chart-line" />
						Fabula &amp; Ultima
					</button>
				</nav>
				<section className="widgets fbp-head">
					<div className="fbp-title">
						<img src={faceUrl(members[0].art)} alt="" />
						<div>
							<small>PARTY MENU</small>
							<input type="text" defaultValue="The Oracle’s Escort" />
						</div>
					</div>
					<div className="fbp-res">
						<div className="r gold">
							<small>Zenit</small>
							<b>1,240</b>
						</div>
						<div className="r">
							<small>EXP earned</small>
							<b>28</b>
						</div>
						<div className="r">
							<small>Fabula spent</small>
							<b>6</b>
						</div>
						<div className="r">
							<small>Ultima spent</small>
							<b>3</b>
						</div>
					</div>
				</section>
				<section className="tab fbs-tab fbp-roster overview active">
					<div className="fbp-row">
						{members.map((m, i) => (
							<article key={m.name} className={`fbp-card ${m.crisis ? 'crisis' : ''}`} style={{ translate: `0 ${rise(i)}px`, opacity: rise(i) > 200 ? 0 : 1 - rise(i) / 260 }}>
								<button type="button" className="pt">
									<img src={artUrl(m.art)} alt="" style={{ objectPosition: `${(ART[m.art].feetX / ART[m.art].w) * 100}% 0%`, objectFit: 'cover', background: 'radial-gradient(circle at 50% 30%, rgba(120,170,255,0.35), transparent 70%)' }} />
								</button>
								{m.exp >= 10 ? (
									<button type="button" className="lvup" style={{ boxShadow: `0 0 ${12 + 14 * glowLv}px rgba(242, 196, 90, ${0.6 + 0.4 * glowLv})` }}>
										<i className="fa-solid fa-angles-up" /> LEVEL UP
									</button>
								) : null}
								{m.chips?.length ? (
									<div className="sts">
										{m.chips.map(([label, color]) => (
											<span key={label} className="fbs-chip on" style={{ ['--c' as string]: color }}>
												{label}
											</span>
										))}
									</div>
								) : null}
								<div className="info">
									<small className="lv">
										Lv.{m.level}
										{m.crisis ? <em className="flag">CRISIS</em> : null}
									</small>
									<b className="nm">{m.name}</b>
									<div className="ln">
										<span>Next Lv:</span>
										<span>
											<b>{m.exp}</b>/10 EXP
										</span>
									</div>
									<div className="ln hp">
										<span>HP</span>
										<span>
											<b>{m.hp[0]}</b>/{m.hp[1]}
										</span>
									</div>
									<div className={`fbs-bar hp ${m.crisis ? 'crisis' : ''}`}>
										<span style={{ width: `${pct(m.hp[0], m.hp[1])}%` }} />
										<i style={{ left: '50%' }} />
									</div>
									<div className="ln mp">
										<span>MP</span>
										<span>
											<b>{m.mp[0]}</b>/{m.mp[1]}
										</span>
									</div>
									<div className="fbs-bar mp thin">
										<span style={{ width: `${pct(m.mp[0], m.mp[1])}%` }} />
									</div>
									<div className="ln ip">
										<span>IP</span>
										<span>
											<b>{m.ip[0]}</b>/{m.ip[1]}
										</span>
									</div>
									<div className="defs">
										{m.stats.map(([k, v]) => (
											<span key={k}>
												<small>{k}</small> {v}
											</span>
										))}
									</div>
								</div>
								<div className="rank">
									<div className="ln">
										<span>{m.main}</span>
										<span>CL {m.cl}</span>
									</div>
									<b className="who">{m.identity}</b>
									<small className="more">{m.more}</small>
									<div className="ln fp">
										<span>Fabula</span>
										<span>
											<b>{m.fp}</b> FP
										</span>
									</div>
								</div>
								<button type="button" className="emb">
									<span className="frame" />
									<span className="cap">STATUS</span>
									<span className="art">
										<img src={artUrl(m.art)} alt="" style={{ maxHeight: 84, maxWidth: 110 }} />
									</span>
								</button>
							</article>
						))}
					</div>
				</section>
			</section>
		</div>
	);
};
