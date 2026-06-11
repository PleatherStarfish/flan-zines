import type { CharacterAction, CharacterExportSize, PixelCharacterProject } from './project';

export type Rgba = readonly [number, number, number, number];
export type PixelFrame = {
	width: number;
	height: number;
	data: Uint8ClampedArray;
	durationMs: number;
};

type SizeConfig = {
	logicalWidth: number;
	logicalHeight: number;
	scale: number;
};

const SIZE_CONFIG: Record<CharacterExportSize, SizeConfig> = {
	tiny: { logicalWidth: 16, logicalHeight: 24, scale: 1 },
	small: { logicalWidth: 24, logicalHeight: 32, scale: 2 },
	medium: { logicalWidth: 24, logicalHeight: 32, scale: 4 },
	large: { logicalWidth: 24, logicalHeight: 32, scale: 8 }
};

const FRAME_COUNTS: Record<CharacterAction, number> = {
	idle: 2,
	faceForward: 2,
	runRight: 4,
	runLeft: 4,
	jump: 3,
	wave: 4,
	hold: 2,
	cast: 4
};

const FRAME_DELAYS: Record<CharacterAction, number> = {
	idle: 280,
	faceForward: 320,
	runRight: 110,
	runLeft: 110,
	jump: 130,
	wave: 160,
	hold: 260,
	cast: 120
};

type CharacterPose = {
	facingOffset: number;
	jumpY: number;
	armSwing: number;
	legSwing: number;
	wave: boolean;
	cast: boolean;
	view: 'front' | 'threeQuarter' | 'profile';
};

export function actionFrameCount(action: CharacterAction): number {
	return FRAME_COUNTS[action];
}

export function renderCharacterFrames(
	project: PixelCharacterProject,
	action: CharacterAction,
	size: CharacterExportSize
): PixelFrame[] {
	const frames: PixelFrame[] = [];
	for (let i = 0; i < actionFrameCount(action); i++) {
		const logical =
			action === 'runLeft'
				? mirrorFrame(renderLogicalFrame(project, 'runRight', i, size))
				: renderLogicalFrame(project, action, i, size);
		frames.push(scaleFrame(logical, SIZE_CONFIG[size].scale));
	}
	return frames;
}

export function renderPosterFrame(
	project: PixelCharacterProject,
	action: CharacterAction,
	size: CharacterExportSize
): PixelFrame {
	return renderCharacterFrames(project, action, size)[0];
}

function renderLogicalFrame(
	project: PixelCharacterProject,
	action: CharacterAction,
	frameIndex: number,
	size: CharacterExportSize
): PixelFrame {
	const config = SIZE_CONFIG[size];
	const frame = newFrame(config.logicalWidth, config.logicalHeight, FRAME_DELAYS[action]);
	const palette = paletteFor(project);
	const pose = poseFor(action, frameIndex);
	const tiny = size === 'tiny';
	const cx = Math.floor(config.logicalWidth / 2) + pose.facingOffset;
	const jumpY = pose.jumpY;
	const body = bodyMetrics(project, config.logicalWidth, config.logicalHeight, tiny);
	const torsoW =
		pose.view === 'profile' ? Math.max(tiny ? 6 : 8, body.torsoW - (tiny ? 2 : 3)) : body.torsoW;
	const head = {
		w: tiny ? 8 : 10,
		h: tiny ? 7 : 10,
		x: cx - Math.floor((tiny ? 8 : 10) / 2),
		y: (tiny ? 2 : 3) + jumpY
	};
	const torso = {
		w: torsoW,
		h: body.torsoH,
		x: cx - Math.floor(torsoW / 2) - (pose.view === 'profile' ? 1 : 0),
		y: head.y + head.h + (tiny ? 0 : 1)
	};
	const legY = torso.y + torso.h - 1;

	drawCape(frame, project, torso, palette, pose);
	drawLegs(frame, project, cx, legY, palette, pose, tiny);
	drawTorso(frame, project, torso, palette, pose, tiny);
	drawArms(frame, project, torso, palette, pose, tiny);
	drawHead(frame, project, head, palette, pose, tiny);
	drawProp(frame, project, torso, palette, pose, tiny);
	return frame;
}

function poseFor(action: CharacterAction, frameIndex: number): CharacterPose {
	if (action === 'jump') {
		const y = frameIndex === 1 ? -4 : frameIndex === 2 ? -2 : 0;
		return {
			facingOffset: 1,
			jumpY: y,
			armSwing: -1,
			legSwing: 0,
			wave: false,
			cast: false,
			view: 'profile'
		};
	}
	if (action === 'wave') {
		return {
			facingOffset: 0,
			jumpY: 0,
			armSwing: frameIndex % 2 === 0 ? -2 : -4,
			legSwing: 0,
			wave: true,
			cast: false,
			view: 'front'
		};
	}
	if (action === 'cast') {
		return {
			facingOffset: 1,
			jumpY: 0,
			armSwing: frameIndex % 2 === 0 ? -2 : -3,
			legSwing: frameIndex % 2 === 0 ? 1 : -1,
			wave: false,
			cast: true,
			view: 'profile'
		};
	}
	if (action === 'runRight') {
		return {
			facingOffset: 1,
			jumpY: frameIndex % 2 === 0 ? 0 : -1,
			armSwing: frameIndex % 2 === 0 ? -2 : 2,
			legSwing: frameIndex % 2 === 0 ? 2 : -2,
			wave: false,
			cast: false,
			view: 'profile'
		};
	}
	if (action === 'hold') {
		return {
			facingOffset: 1,
			jumpY: 0,
			armSwing: 1,
			legSwing: 0,
			wave: false,
			cast: false,
			view: 'threeQuarter'
		};
	}
	return {
		facingOffset: action === 'faceForward' ? 0 : frameIndex % 2,
		jumpY: frameIndex % 2 === 0 ? 0 : -1,
		armSwing: 0,
		legSwing: 0,
		wave: false,
		cast: false,
		view: action === 'faceForward' ? 'front' : 'threeQuarter'
	};
}

function bodyMetrics(
	project: PixelCharacterProject,
	width: number,
	height: number,
	tiny: boolean
): { torsoW: number; torsoH: number } {
	if (tiny) {
		if (project.body === 'round' || project.body === 'sturdy') return { torsoW: 9, torsoH: 7 };
		if (project.body === 'tall') return { torsoW: 7, torsoH: 8 };
		if (project.body === 'short') return { torsoW: 8, torsoH: 6 };
		return { torsoW: 8, torsoH: 7 };
	}
	if (project.body === 'round' || project.body === 'sturdy') return { torsoW: 13, torsoH: 9 };
	if (project.body === 'tall') return { torsoW: 10, torsoH: 10 };
	if (project.body === 'short') return { torsoW: 11, torsoH: 8 };
	return { torsoW: Math.max(11, Math.floor(width * 0.46)), torsoH: Math.floor(height * 0.28) };
}

function drawHead(
	frame: PixelFrame,
	project: PixelCharacterProject,
	head: { x: number; y: number; w: number; h: number },
	palette: CharacterColors,
	pose: ReturnType<typeof poseFor>,
	tiny: boolean
): void {
	const profile = pose.view === 'profile';
	rectWithOutline(frame, head.x, head.y, head.w, head.h, palette.skin, palette.outline);
	rect(frame, head.x + head.w - 2, head.y + 2, 1, head.h - 3, palette.skinShadow);
	rect(frame, head.x + head.w - 4, head.y + head.h - 2, 3, 1, palette.skinShadow);
	drawHair(frame, project, head, palette, pose, tiny);
	if (project.accessories.includes('hat') || project.hair === 'hatHidden') {
		drawCap(frame, head, palette, pose, tiny);
	}
	if (project.accessories.includes('mask')) {
		rect(frame, head.x + 1, head.y + Math.floor(head.h / 2), head.w - 2, 2, palette.accent);
	}
	const eyeY = head.y + (tiny ? 3 : 4);
	const eyeH = tiny ? 2 : 3;
	if (profile) {
		const eyeX = head.x + head.w - (tiny ? 4 : 5);
		rect(frame, eyeX, eyeY, 1, eyeH, palette.outline);
		if (!tiny) {
			pixel(frame, head.x + head.w, eyeY + 2, palette.outline);
			pixel(frame, head.x + head.w - 1, eyeY + 2, palette.skin);
			rect(frame, head.x + head.w - 4, head.y + 7, 2, 1, palette.outline);
		} else {
			pixel(frame, head.x + head.w - 4, head.y + 5, palette.outline);
		}
		if (project.accessories.includes('glasses') && !tiny) {
			rect(frame, eyeX - 1, eyeY - 1, 3, 3, palette.outline);
			rect(frame, eyeX, eyeY, 1, 1, palette.skin);
			line(frame, eyeX - 2, eyeY, head.x + 2, eyeY, palette.outline);
		}
		return;
	}
	const leftEye = head.x + (tiny ? 2 : 3);
	const rightEye = head.x + head.w - (tiny ? 3 : 4);
	rect(frame, leftEye, eyeY, 1, eyeH, palette.outline);
	rect(frame, rightEye, eyeY, 1, eyeH, palette.outline);
	if (project.accessories.includes('glasses') && !tiny) {
		rect(frame, leftEye - 1, eyeY - 1, 3, 3, palette.outline);
		rect(frame, rightEye - 1, eyeY - 1, 3, 3, palette.outline);
		rect(frame, leftEye, eyeY, 1, 1, palette.skin);
		rect(frame, rightEye, eyeY, 1, 1, palette.skin);
		pixel(frame, leftEye + 2, eyeY, palette.outline);
	}
	if (tiny) {
		pixel(frame, head.x + 3, head.y + 5, palette.outline);
		pixel(frame, head.x + 4, head.y + 5, palette.outline);
		return;
	}
	if (pose.facingOffset !== 0) {
		rect(frame, head.x + head.w - 3, eyeY + 2, 2, 1, palette.skinShadow);
	}
	rect(frame, head.x + 4, head.y + 7, 3, 1, palette.outline);
}

function drawHair(
	frame: PixelFrame,
	project: PixelCharacterProject,
	head: { x: number; y: number; w: number; h: number },
	palette: CharacterColors,
	pose: CharacterPose,
	tiny: boolean
): void {
	if (project.hair === 'hatHidden' || project.accessories.includes('hat')) return;
	if (pose.view === 'profile') {
		rect(frame, head.x + 1, head.y + 1, head.w - 3, tiny ? 2 : 3, palette.hair);
		rect(frame, head.x + 1, head.y + 2, tiny ? 3 : 4, head.h - 2, palette.hair);
		rect(frame, head.x + head.w - 4, head.y + 1, 3, tiny ? 2 : 3, palette.hair);
		if (project.hair === 'long') rect(frame, head.x, head.y + 3, 3, head.h, palette.hair);
		if (project.hair === 'curly') {
			rect(frame, head.x - 1, head.y + 1, 3, 3, palette.hair);
			rect(frame, head.x + 2, head.y, 5, 2, palette.hair);
		}
		if (project.hair === 'tiedBack') rect(frame, head.x - 2, head.y + 4, 3, 3, palette.hair);
		rect(frame, head.x + head.w - 3, head.y + 1, 2, 1, palette.hairLight);
		return;
	}
	rect(frame, head.x + 1, head.y + 1, head.w - 2, tiny ? 2 : 3, palette.hair);
	rect(frame, head.x + 1, head.y + 2, tiny ? 2 : 3, tiny ? 2 : 3, palette.hair);
	rect(frame, head.x + head.w - 3, head.y + 2, 2, tiny ? 4 : 5, palette.hair);
	if (project.hair === 'long') {
		rect(frame, head.x, head.y + 3, 1, head.h - 2, palette.hair);
		rect(frame, head.x + head.w - 1, head.y + 3, 1, head.h - 1, palette.hair);
		if (!tiny) {
			rect(frame, head.x - 1, head.y + 4, 2, head.h - 2, palette.hair);
			rect(frame, head.x + head.w - 1, head.y + 4, 2, head.h - 1, palette.hair);
		}
	}
	if (project.hair === 'curly') {
		if (!tiny) {
			rect(frame, head.x - 1, head.y + 1, head.w + 2, 2, palette.hair);
			rect(frame, head.x, head.y - 1, head.w, 2, palette.hair);
			rect(frame, head.x + 2, head.y - 2, head.w - 4, 1, palette.hair);
		}
		for (let x = head.x + 1; x < head.x + head.w - 1; x += 2) pixel(frame, x, head.y, palette.hair);
	}
	if (project.hair === 'tiedBack') {
		rect(frame, head.x - 2, head.y + 4, 2, tiny ? 2 : 3, palette.hair);
		rect(frame, head.x + head.w, head.y + 4, 2, tiny ? 2 : 3, palette.hair);
	}
	rect(frame, head.x + head.w - 3, head.y + 1, 2, 1, palette.hairLight);
}

function drawCap(
	frame: PixelFrame,
	head: { x: number; y: number; w: number; h: number },
	palette: CharacterColors,
	pose: CharacterPose,
	tiny: boolean
): void {
	const profile = pose.view === 'profile';
	if (tiny) {
		rect(frame, head.x + head.w - 2, head.y + 1, 1, 4, palette.hair);
		rect(frame, head.x, head.y - 1, head.w, 2, palette.outline);
		rect(frame, head.x + 1, head.y - 1, head.w - 2, 1, palette.accent);
		rect(frame, profile ? head.x + head.w - 1 : head.x - 2, head.y + 1, 4, 1, palette.outline);
		return;
	}
	rect(frame, head.x + head.w - 1, head.y + 1, 1, 6, palette.hair);
	rect(frame, head.x + head.w - 2, head.y + 1, 1, 3, palette.hair);
	rect(frame, head.x + 1, head.y + 1, 2, 2, palette.hair);
	rect(frame, head.x + 1, head.y - 3, head.w - 2, 1, palette.outline);
	rect(frame, head.x, head.y - 2, head.w, 3, palette.outline);
	rect(frame, head.x + 1, head.y - 2, head.w - 2, 2, palette.accent);
	rect(frame, head.x + 3, head.y - 1, 3, 2, palette.coat);
	if (profile) {
		rect(frame, head.x + head.w - 1, head.y + 1, 5, 1, palette.outline);
		rect(frame, head.x + head.w, head.y, 2, 1, palette.accent);
	} else {
		rect(frame, head.x - 3, head.y + 1, 5, 1, palette.outline);
	}
}

function drawTorso(
	frame: PixelFrame,
	project: PixelCharacterProject,
	torso: { x: number; y: number; w: number; h: number },
	palette: CharacterColors,
	pose: CharacterPose,
	tiny: boolean
): void {
	const profile = pose.view === 'profile';
	const shirt = shirtColorFor(project, palette);
	rect(frame, torso.x + Math.floor(torso.w / 2) - 2, torso.y - 2, 4, 2, palette.skin);
	rectWithOutline(frame, torso.x, torso.y, torso.w, torso.h, shirt, palette.outline);
	rect(frame, torso.x + 1, torso.y + torso.h - 2, torso.w - 2, 1, palette.shirtShadow);
	if (profile) {
		rect(frame, torso.x + torso.w - 2, torso.y + 2, 1, torso.h - 3, palette.shirtShadow);
	} else if (!tiny && project.outfit === 'everyday') {
		const motifY = torso.y + Math.floor(torso.h / 2);
		for (let x = torso.x + 3; x < torso.x + torso.w - 3; x += 2)
			pixel(frame, x, motifY + (x % 4 === 0 ? 1 : 0), palette.coat);
	}
	if (project.outfit === 'hoodie')
		rect(frame, torso.x + 1, torso.y, torso.w - 2, 2, palette.accent);
	if (project.outfit === 'jacket') {
		rect(frame, torso.x, torso.y, 2, torso.h, palette.accent);
		rect(frame, torso.x + torso.w - 2, torso.y, 2, torso.h, palette.accent);
		rect(frame, torso.x + Math.floor(torso.w / 2) - 1, torso.y + 1, 2, torso.h - 2, palette.coat);
	}
	if (project.outfit === 'lab')
		rect(frame, torso.x, torso.y + 1, torso.w, torso.h - 1, palette.coat);
	if (project.outfit === 'armor') {
		rect(frame, torso.x + 2, torso.y + 2, torso.w - 4, 1, palette.outline);
		pixel(frame, torso.x + torso.w - 3, torso.y + 1, palette.accent);
	}
	if (project.outfit === 'wizard' && !tiny) {
		rect(frame, torso.x + Math.floor(torso.w / 2), torso.y + 1, 1, torso.h - 2, palette.magic);
	}
}

function drawLegs(
	frame: PixelFrame,
	project: PixelCharacterProject,
	cx: number,
	legY: number,
	palette: CharacterColors,
	pose: ReturnType<typeof poseFor>,
	tiny: boolean
): void {
	const legH = tiny ? 7 : 8;
	const legW = tiny ? 2 : 4;
	const footY = legY + legH - 1;
	const swing = pose.legSwing;
	const pants = project.outfit === 'wizard' ? palette.robe : palette.pants;
	const hasShorts = project.outfit === 'everyday' || project.outfit === 'halloween';
	if (pose.view === 'profile') {
		const backX = cx - (tiny ? 3 : 4) - (swing > 0 ? 1 : 0);
		const frontX = cx + (tiny ? 0 : 1) + (swing < 0 ? 1 : 0);
		const backLift = swing < 0 ? 1 : 0;
		const frontLift = swing > 0 ? 1 : 0;
		rectWithOutline(
			frame,
			backX,
			legY + backLift,
			tiny ? 2 : 3,
			legH - backLift,
			pants,
			palette.outline
		);
		rect(
			frame,
			backX + 1,
			legY + backLift + 1,
			tiny ? 1 : 2,
			legH - backLift - 3,
			palette.pantsShadow
		);
		rectWithOutline(
			frame,
			frontX,
			legY + frontLift,
			tiny ? 2 : 3,
			legH - frontLift,
			pants,
			palette.outline
		);
		if (hasShorts) {
			const skinStart = legY + (tiny ? 3 : 4);
			rect(frame, backX + 1, skinStart, tiny ? 1 : 1, 2, palette.skin);
			rect(frame, frontX + 1, skinStart, tiny ? 1 : 1, 2, palette.skin);
		}
		rect(frame, backX - 1, footY, tiny ? 4 : 5, 2, palette.shoes);
		rect(frame, frontX, footY, tiny ? 4 : 6, 2, palette.shoes);
		return;
	}
	const leftLift = swing < 0 ? 1 : 0;
	const rightLift = swing > 0 ? 1 : 0;
	const leftX = cx - (tiny ? 4 : 5) - (swing > 0 ? 1 : 0);
	const rightX = cx + (tiny ? 1 : 2) + (swing < 0 ? 1 : 0);
	rectWithOutline(frame, leftX, legY + leftLift, legW, legH - leftLift, pants, palette.outline);
	rectWithOutline(frame, rightX, legY + rightLift, legW, legH - rightLift, pants, palette.outline);
	if (hasShorts) {
		const skinStart = legY + (tiny ? 3 : 4);
		if (legH - leftLift > 5) rect(frame, leftX + 1, skinStart, legW - 2, 2, palette.skin);
		if (legH - rightLift > 5) rect(frame, rightX + 1, skinStart, legW - 2, 2, palette.skin);
	}
	rect(frame, leftX - 1, footY, tiny ? 4 : 6, 2, palette.shoes);
	rect(frame, rightX, footY, tiny ? 4 : 6, 2, palette.shoes);
}

function drawArms(
	frame: PixelFrame,
	project: PixelCharacterProject,
	torso: { x: number; y: number; w: number; h: number },
	palette: CharacterColors,
	pose: ReturnType<typeof poseFor>,
	tiny: boolean
): void {
	const armY = torso.y + (tiny ? 2 : 3);
	const leftX = torso.x - 2;
	const rightX = torso.x + torso.w;
	const armH = tiny ? 5 : 7;
	const sleeve = project.outfit === 'armor' ? palette.metal : shirtColorFor(project, palette);
	const hand = project.outfit === 'armor' ? palette.metal : palette.skin;
	if (pose.wave) {
		drawArmColumn(frame, leftX, armY + 1, armH, sleeve, hand, palette.outline);
		drawArmColumn(frame, rightX, armY - 3, armH, sleeve, hand, palette.outline);
		pixel(frame, rightX + 1, armY - 4, hand);
		return;
	}
	if (pose.cast) {
		drawArmColumn(frame, leftX, armY + 2, armH - 1, sleeve, hand, palette.outline);
		line(frame, rightX, armY + 2, rightX + 4, armY - 2, hand);
		line(frame, rightX + 1, armY + 2, rightX + 5, armY - 2, palette.outline);
		return;
	}
	const swing = pose.armSwing;
	drawArmColumn(frame, leftX, armY + Math.max(0, swing), armH, sleeve, hand, palette.outline);
	drawArmColumn(frame, rightX, armY + Math.max(0, -swing), armH, sleeve, hand, palette.outline);
}

function drawArmColumn(
	frame: PixelFrame,
	x: number,
	y: number,
	h: number,
	sleeve: Rgba,
	hand: Rgba,
	outline: Rgba
): void {
	rect(frame, x, y, 2, h, outline);
	if (h > 3) rect(frame, x + 1, y + 1, 1, h - 3, sleeve);
	rect(frame, x + 1, y + h - 2, 1, 1, hand);
}

function drawProp(
	frame: PixelFrame,
	project: PixelCharacterProject,
	torso: { x: number; y: number; w: number; h: number },
	palette: CharacterColors,
	pose: ReturnType<typeof poseFor>,
	tiny: boolean
): void {
	if (project.prop === 'none' && !pose.cast) return;
	const x = torso.x + torso.w + (pose.view === 'profile' ? 0 : tiny ? 1 : 2);
	const y = torso.y + (tiny ? 4 : 5);
	if (project.prop === 'computer') {
		const w = tiny ? 5 : 7;
		const h = tiny ? 4 : 5;
		rectWithOutline(frame, x, y - 1, w, h, palette.prop, palette.outline);
		rect(frame, x + 1, y, w - 2, tiny ? 1 : 2, palette.coat);
		rect(frame, x - 1, y + h - 1, w + 2, 1, palette.outline);
		pixel(frame, x + 1, y + h - 2, palette.magic);
		return;
	}
	if (project.prop === 'book') {
		const w = tiny ? 4 : 6;
		const h = tiny ? 4 : 5;
		rectWithOutline(frame, x, y, w, h, palette.accent, palette.outline);
		rect(frame, x + Math.floor(w / 2), y + 1, 1, h - 2, palette.coat);
		pixel(frame, x + 1, y + 1, palette.shirtShadow);
		return;
	}
	if (project.prop === 'wand' || pose.cast) {
		line(frame, x, y + 2, x + (tiny ? 4 : 6), y - (tiny ? 2 : 3), palette.outline);
		pixel(frame, x + (tiny ? 4 : 6), y - (tiny ? 2 : 3), palette.magic);
		if (!tiny) {
			pixel(frame, x + 7, y - 4, palette.magic);
			pixel(frame, x + 6, y - 5, palette.magic);
			pixel(frame, x + 8, y - 3, palette.magic);
		}
	}
}

function drawCape(
	frame: PixelFrame,
	project: PixelCharacterProject,
	torso: { x: number; y: number; w: number; h: number },
	palette: CharacterColors,
	pose: ReturnType<typeof poseFor>
): void {
	if (!project.accessories.includes('cape') && project.outfit !== 'wizard') return;
	const drift = pose.legSwing > 0 ? -1 : 0;
	rect(frame, torso.x - 1 + drift, torso.y + 1, torso.w + 2, torso.h + 5, palette.accent);
}

function shirtColorFor(project: PixelCharacterProject, palette: CharacterColors): Rgba {
	if (project.outfit === 'armor') return palette.metal;
	if (project.outfit === 'wizard') return palette.robe;
	if (project.outfit === 'halloween') return palette.pumpkin;
	return palette.shirt;
}

function paletteFor(project: PixelCharacterProject): CharacterColors {
	return {
		skin: hex(project.palette.skin),
		skinShadow: hex(project.palette.skinShadow),
		hair: hex(project.palette.hair),
		hairLight: mix(hex(project.palette.hair), hex('#ffffff'), 0.22),
		outline: hex(project.palette.outline),
		shirt: hex(project.palette.shirt),
		shirtShadow: mix(hex(project.palette.shirt), hex('#000000'), 0.28),
		pants: hex(project.palette.pants),
		pantsShadow: mix(hex(project.palette.pants), hex('#000000'), 0.24),
		shoes: hex(project.palette.shoes),
		accent: hex(project.palette.accent),
		prop: hex(project.palette.prop),
		magic: hex(project.palette.magic),
		metal: hex('#a8b2bd'),
		robe: hex('#4c1d95'),
		pumpkin: hex('#f97316'),
		coat: hex('#e7eef7')
	};
}

type CharacterColors = Record<
	| 'skin'
	| 'skinShadow'
	| 'hair'
	| 'hairLight'
	| 'outline'
	| 'shirt'
	| 'shirtShadow'
	| 'pants'
	| 'pantsShadow'
	| 'shoes'
	| 'accent'
	| 'prop'
	| 'magic'
	| 'metal'
	| 'robe'
	| 'pumpkin'
	| 'coat',
	Rgba
>;

function newFrame(width: number, height: number, durationMs: number): PixelFrame {
	return { width, height, durationMs, data: new Uint8ClampedArray(width * height * 4) };
}

function rectWithOutline(
	frame: PixelFrame,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: Rgba,
	outline: Rgba
): void {
	rect(frame, x, y, w, h, outline);
	if (w > 2 && h > 2) rect(frame, x + 1, y + 1, w - 2, h - 2, fill);
}

function rect(frame: PixelFrame, x: number, y: number, w: number, h: number, color: Rgba): void {
	for (let yy = y; yy < y + h; yy++) {
		for (let xx = x; xx < x + w; xx++) pixel(frame, xx, yy, color);
	}
}

function line(
	frame: PixelFrame,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	color: Rgba
): void {
	const dx = Math.abs(x1 - x0);
	const sx = x0 < x1 ? 1 : -1;
	const dy = -Math.abs(y1 - y0);
	const sy = y0 < y1 ? 1 : -1;
	let err = dx + dy;
	let x = x0;
	let y = y0;
	while (true) {
		pixel(frame, x, y, color);
		if (x === x1 && y === y1) break;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y += sy;
		}
	}
}

function pixel(frame: PixelFrame, x: number, y: number, color: Rgba): void {
	if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return;
	const i = (Math.floor(y) * frame.width + Math.floor(x)) * 4;
	frame.data[i] = color[0];
	frame.data[i + 1] = color[1];
	frame.data[i + 2] = color[2];
	frame.data[i + 3] = color[3];
}

function mirrorFrame(frame: PixelFrame): PixelFrame {
	const out = newFrame(frame.width, frame.height, frame.durationMs);
	for (let y = 0; y < frame.height; y++) {
		for (let x = 0; x < frame.width; x++) {
			const src = (y * frame.width + x) * 4;
			const dst = (y * frame.width + (frame.width - 1 - x)) * 4;
			out.data[dst] = frame.data[src];
			out.data[dst + 1] = frame.data[src + 1];
			out.data[dst + 2] = frame.data[src + 2];
			out.data[dst + 3] = frame.data[src + 3];
		}
	}
	return out;
}

function scaleFrame(frame: PixelFrame, scale: number): PixelFrame {
	if (scale === 1) return frame;
	const out = newFrame(frame.width * scale, frame.height * scale, frame.durationMs);
	for (let y = 0; y < out.height; y++) {
		for (let x = 0; x < out.width; x++) {
			const srcX = Math.floor(x / scale);
			const srcY = Math.floor(y / scale);
			const src = (srcY * frame.width + srcX) * 4;
			const dst = (y * out.width + x) * 4;
			out.data[dst] = frame.data[src];
			out.data[dst + 1] = frame.data[src + 1];
			out.data[dst + 2] = frame.data[src + 2];
			out.data[dst + 3] = frame.data[src + 3];
		}
	}
	return out;
}

function hex(value: string): Rgba {
	const raw = value.replace('#', '');
	const expanded =
		raw.length === 3
			? raw
					.split('')
					.map((char) => char + char)
					.join('')
			: raw;
	return [
		parseInt(expanded.slice(0, 2), 16),
		parseInt(expanded.slice(2, 4), 16),
		parseInt(expanded.slice(4, 6), 16),
		255
	];
}

function mix(a: Rgba, b: Rgba, amount: number): Rgba {
	const keep = 1 - amount;
	return [
		Math.round(a[0] * keep + b[0] * amount),
		Math.round(a[1] * keep + b[1] * amount),
		Math.round(a[2] * keep + b[2] * amount),
		255
	];
}
