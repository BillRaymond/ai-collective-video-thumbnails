export type InternalAssetKind = 'photo' | 'logo';

export type InternalAsset = {
	kind: InternalAssetKind;
	path: string;
	filename: string;
	label: string;
};

const INTERNAL_PHOTO_PATHS = [
	'/images/speakers/photos/adelina-martiniuc.png',
	'/images/speakers/photos/aj-green.jpg',
	'/images/speakers/photos/anubhav-maheshwari.jpg',
	'/images/speakers/photos/ash-kumra.webp',
	'/images/speakers/photos/bhola-chhetri.jpg',
	'/images/speakers/photos/bill-raymond.jpg',
	'/images/speakers/photos/carl-fritjofsson.jpg',
	'/images/speakers/photos/catherine-mcmillan.png',
	'/images/speakers/photos/chappy-asel.jpg',
	'/images/speakers/photos/clarey-zhu.jpg',
	'/images/speakers/photos/craig-mcluckie.jpg',
	'/images/speakers/photos/dan-pechi.jpg',
	'/images/speakers/photos/daniel-green.jpg',
	'/images/speakers/photos/dhruva-reddy.jpg',
	'/images/speakers/photos/dmytro-spodarets.jpg',
	'/images/speakers/photos/esra-kucukciftci.png',
	'/images/speakers/photos/faraz-yaghouti.png',
	'/images/speakers/photos/felicia-popa.jpg',
	'/images/speakers/photos/florent-de-goriainoff.png',
	'/images/speakers/photos/ghazwa-khalatbari.png',
	'/images/speakers/photos/gunjan-patel.jpg',
	'/images/speakers/photos/henry-zhang.jpg',
	'/images/speakers/photos/homer-wang.png',
	'/images/speakers/photos/josh-haas.jpg',
	'/images/speakers/photos/lloyd-spencer.jpg',
	'/images/speakers/photos/maju-kuruvilla.jpg',
	'/images/speakers/photos/manmit-shrimali.jpg',
	'/images/speakers/photos/matthew-zeiler.jpg',
	'/images/speakers/photos/mohammad-islam.jpg',
	'/images/speakers/photos/murray-newlands.jpg',
	'/images/speakers/photos/nathalie-criou.jpg',
	'/images/speakers/photos/nikhil-choudhary.png',
	'/images/speakers/photos/nikhil-gupta.jpg',
	'/images/speakers/photos/paulina-xu.png',
	'/images/speakers/photos/philip-rathle.jpg',
	'/images/speakers/photos/rie-yano.jpg',
	'/images/speakers/photos/roshan-manjaly.jpg',
	'/images/speakers/photos/sam-liang.jpg',
	'/images/speakers/photos/sanchit-garg.jpg',
	'/images/speakers/photos/shekhar-natarajan.png',
	'/images/speakers/photos/swati-deo.jpg',
	'/images/speakers/photos/tony-loehr.jpg',
	'/images/speakers/photos/tyrone-ross.jpg',
	'/images/speakers/photos/vaibhav-agrawal.jpg',
	'/images/speakers/photos/vidhya-bhat.jpg',
	'/images/speakers/photos/vik-ghai.jpg',
	'/images/speakers/photos/vivek-ravisankar.jpg',
	'/images/speakers/photos/wallis-mills.jpg',
	'/images/speakers/photos/wolf-ruzicka.jpg',
	'/images/speakers/photos/zhenbo-yan.png'
] as const;

const INTERNAL_LOGO_PATHS = [
	'/images/speakers/logos/agentic-fabriq.jpg',
	'/images/speakers/logos/aws.png',
	'/images/speakers/logos/broadcom.jpg',
	'/images/speakers/logos/bubble.svg',
	'/images/speakers/logos/cambermast.png',
	'/images/speakers/logos/cisco.svg',
	'/images/speakers/logos/clarifai.png',
	'/images/speakers/logos/cline.png',
	'/images/speakers/logos/coral-capital.png',
	'/images/speakers/logos/creandum.jpg',
	'/images/speakers/logos/data-phoenix.png',
	'/images/speakers/logos/databricks.png',
	'/images/speakers/logos/drata.png',
	'/images/speakers/logos/fluents.jpg',
	'/images/speakers/logos/g2c-ventures.jpg',
	'/images/speakers/logos/hackerrank.jpg',
	'/images/speakers/logos/headline.jpg',
	'/images/speakers/logos/hermitage-capital.jpg',
	'/images/speakers/logos/ia-seed-capital.png',
	'/images/speakers/logos/modern-enterprise.jpg',
	'/images/speakers/logos/nebius.jpg',
	'/images/speakers/logos/neo4j.jpg',
	'/images/speakers/logos/nirman-ventures.jpg',
	'/images/speakers/logos/odd-bird-vc.jpg',
	'/images/speakers/logos/orchestra-ai.png',
	'/images/speakers/logos/otter-ai.png',
	'/images/speakers/logos/palo-alto-networks.jpg',
	'/images/speakers/logos/pricing-innovations.jpg',
	'/images/speakers/logos/roryplans.png',
	'/images/speakers/logos/salesforce.png',
	'/images/speakers/logos/snowflake.png',
	'/images/speakers/logos/spangle-ai.jpg',
	'/images/speakers/logos/stacklok.png',
	'/images/speakers/logos/the-ai-collective.png',
	'/images/speakers/logos/threshold-vc.svg',
	'/images/speakers/logos/tinyfish.png',
	'/images/speakers/logos/turing-labs.png',
	'/images/speakers/logos/unlimit.svg',
	'/images/speakers/logos/vapi.svg',
	'/images/speakers/logos/visa.jpg',
	'/images/speakers/logos/workforce-mentor.jpg',
	'/images/speakers/logos/zime-ai.jpg'
] as const;

function labelFromPath(path: string) {
	const filename = path.split('/').pop() ?? path;
	return filename.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
}

function toAsset(kind: InternalAssetKind, path: string): InternalAsset {
	return {
		kind,
		path,
		filename: path.split('/').pop() ?? path,
		label: labelFromPath(path)
	};
}

export const internalPhotoAssets = INTERNAL_PHOTO_PATHS.map((path) => toAsset('photo', path));
export const internalLogoAssets = INTERNAL_LOGO_PATHS.map((path) => toAsset('logo', path));
export const internalImageAssets = [...internalPhotoAssets, ...internalLogoAssets];
