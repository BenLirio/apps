// Heuristics that infer reasonable defaults from an element's NAME.
// Used both as override (the AI's `kind` is wrong if it gave us "fire"
// classified as a powder) and as fallback when the AI fails entirely.
//
// Each function takes a key (slug) and returns either null (no hint)
// or a partial spec to be merged in.

import { state } from '../state.js';

export function kindOverrideFromName(key, desc) {
  function hits(str, words) {
    for (const w of words) {
      const re = new RegExp('(^|[^a-z0-9])' + w + '([^a-z0-9]|$)', 'i');
      if (re.test(str)) return true;
    }
    return false;
  }
  const name = (key || '').toLowerCase();
  if (hits(name, ['fire','flame','inferno','ember','plasma','lightning','spark','arc'])) return 'gas';
  if (hits(name, ['smoke','steam','vapor','mist','fog','cloud','haze','aroma'])) return 'gas';
  if (hits(name, ['balloon','helium','bubble'])) return 'gas';
  if (hits(name, ['wall','brick','concrete','bedrock','stone','rock','marble','granite'])) return 'static';
  if (hits(name, ['wood','timber','log','bark','plank'])) return 'static';
  if (hits(name, ['metal','iron','steel','copper','brass','gold','silver','aluminum','tin'])) return 'static';
  if (hits(name, ['ice','icicle','glacier'])) return 'static';
  if (hits(name, ['plant','leaf','vine','tree','grass','moss','fern'])) return 'static';
  if (hits(name, ['glass','crystal','gem','diamond'])) return 'static';
  if (hits(name, ['battery','wire','circuit','cable','capacitor'])) return 'static';
  if (hits(name, ['fan','vent','jet'])) return 'static';
  if (hits(name, ['lava','magma'])) return 'liquid';
  if (hits(name, ['water','ocean','river','sea'])) return 'liquid';
  if (hits(name, ['oil','gasoline','petrol','fuel','kerosene'])) return 'liquid';
  if (hits(name, ['acid','poison','venom'])) return 'liquid';
  if (hits(name, ['honey','syrup','molasses','caramel','tar'])) return 'liquid';
  if (hits(name, ['blood','slime','goo','ooze'])) return 'liquid';
  if (hits(name, ['mercury','quicksilver'])) return 'liquid';
  if (hits(name, ['juice','milk','wine','soda','ink','paint','beer'])) return 'liquid';
  if (hits(name, ['sand','salt','sugar','flour','dust','talc'])) return 'powder';
  if (hits(name, ['ash','soot','cinder','glitter','gravel','pebble'])) return 'powder';
  if (hits(name, ['snow','seed','gunpowder','gun-powder','confetti'])) return 'powder';
  if (hits(name, ['tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine'])) return 'powder';
  if (hits(name, ['mold','fungus','mycelium','lichen','coral','conway','automaton','slime-mold','vine'])) return 'cellular';
  return null;
}

export function namePropertyHints(key) {
  const n = (key || '').toLowerCase();
  const has = (...words) => words.some(w => n.indexOf(w) >= 0);
  if (has('fire','flame','inferno','ember','plasma','spark','lightning','arc')) return { density: 1, buoyancy: 1, lifeMin: 30, lifeMax: 70, airflowFactor: 0.5 };
  if (has('lava','magma'))   return { density: 8, viscosity: 0.8, stickiness: 0 };
  if (has('mercury','quicksilver')) return { density: 9, viscosity: 0.1, stickiness: 0, conducts: true };
  if (has('steam'))          return { density: 2, buoyancy: 0.8, lifeMin: 30, lifeMax: 60, airflowFactor: 0.8 };
  if (has('smoke'))          return { density: 2, buoyancy: 0.6, lifeMin: 60, lifeMax: 120, airflowFactor: 0.7 };
  if (has('fog','mist','vapor','cloud','haze')) return { density: 2, buoyancy: 0.5, lifeMin: 60, lifeMax: 120, airflowFactor: 0.7 };
  if (has('balloon','helium','bubble')) return { density: 1, buoyancy: 0.95, lifeMin: 300, lifeMax: 500, airflowFactor: 0.9, pressureBlast: 180 };
  if (has('honey','syrup','molasses','caramel')) return { density: 6, viscosity: 0.9, stickiness: 0.7 };
  if (has('tar','pitch','glue','resin')) return { density: 6, viscosity: 0.95, stickiness: 0.85 };
  if (has('acid'))           return { density: 4, viscosity: 0.1, stickiness: 0 };
  if (has('oil','gasoline','petrol','fuel')) return { density: 2, viscosity: 0.3, stickiness: 0 };
  if (has('water','juice','milk','wine','soda')) return { density: 5, viscosity: 0, stickiness: 0 };
  if (has('slime','goo','ooze'))   return { density: 5, viscosity: 0.6, stickiness: 0.5 };
  if (has('blood'))          return { density: 6, viscosity: 0.4, stickiness: 0 };
  if (has('ink','paint'))    return { density: 5, viscosity: 0.2, stickiness: 0 };
  if (has('snow'))           return { density: 2, flow: 0.4, stickiness: 0 };
  if (has('flour','dust','talc','powder')) return { density: 1, flow: 0.95, stickiness: 0, airflowFactor: 0.9 };
  if (has('ash','soot','cinder')) return { density: 2, flow: 0.9, stickiness: 0, airflowFactor: 0.7 };
  if (has('gravel','pebbles','rocks')) return { density: 7, flow: 0.15, stickiness: 0 };
  if (has('gunpowder')||has('gun-powder')) return { density: 4, flow: 0.6, stickiness: 0, ignitesAtCharge: 20 };
  if (has('salt','sugar','seed','rice','glitter','confetti','sand')) return { density: 4, flow: 0.55, stickiness: 0 };
  if (has('wood','timber','log','bark','plank')) return { density: 4 };
  if (has('battery'))        return { density: 8, conducts: true, chargeEmit: 120 };
  if (has('wire','cable','circuit')) return { density: 7, conducts: true };
  if (has('copper','brass')) return { density: 8, conducts: true };
  if (has('metal','iron','steel','aluminum','tin')) return { density: 8, conducts: true };
  if (has('gold','silver')) return { density: 9, conducts: true };
  if (has('fan','vent','jet')) return { density: 6, emitsAirflow: { vx: 0, vy: 6 } };
  if (has('uranium','plutonium','radio')) return { density: 9, raInit: 250, raDelta: -1, raTransformsTo: 'stone' };
  if (has('ice','icicle')) return { density: 5 };
  if (has('plant','leaf','vine','tree','grass','moss')) return { density: 3 };
  return null;
}

export function traitDefaultsForName(key, kind) {
  const n = (key || '').toLowerCase();
  const has = (...words) => words.some(w => n.indexOf(w) >= 0);
  if (has('fire','flame','inferno','ember','plasma','spark','lightning','arc'))
    return { emitTemp: 240, ignitionPoint: 255, flammability: 0, conductivity: 220, corrosivity: 40, hardness: 0, airflowFactor: 0.5, conducts: has('lightning','arc','plasma'), chargeEmit: has('lightning','arc') ? 110 : 0 };
  if (has('lava','magma'))
    return { emitTemp: 210, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 80, hardness: 30 };
  if (has('mercury','quicksilver'))
    return { emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 0, conducts: true };
  if (has('steam'))
    return { emitTemp: 130, ignitionPoint: 255, flammability: 0, conductivity: 200, corrosivity: 0, hardness: 0, airflowFactor: 0.8 };
  if (has('smoke','fog','mist','vapor','cloud','haze'))
    return { emitTemp: 70, ignitionPoint: 255, flammability: 0, conductivity: 200, corrosivity: 0, hardness: 0, airflowFactor: 0.7 };
  if (has('balloon','helium','bubble'))
    return { emitTemp: 30, ignitionPoint: 90, flammability: 0.30, conductivity: 80, corrosivity: 0, hardness: 0, airflowFactor: 0.9, pressureBlast: 180 };
  if (has('ice','icicle','glacier','snow'))
    return { emitTemp: 10, ignitionPoint: 255, flammability: 0, conductivity: 160, corrosivity: 0, hardness: 60 };
  if (has('water','juice','milk','wine','soda'))
    return { emitTemp: 25, ignitionPoint: 255, flammability: 0, conductivity: 140, corrosivity: 0, hardness: 0 };
  if (has('oil','gasoline','petrol','fuel'))
    return { emitTemp: 30, ignitionPoint: 100, flammability: 0.20, conductivity: 90, corrosivity: 0, hardness: 0 };
  if (has('acid'))
    return { emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 110, corrosivity: 200, hardness: 0 };
  if (has('honey','syrup','molasses','caramel'))
    return { emitTemp: 30, ignitionPoint: 180, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 0 };
  if (has('tar','pitch','glue','resin'))
    return { emitTemp: 30, ignitionPoint: 130, flammability: 0.10, conductivity: 60, corrosivity: 0, hardness: 0 };
  if (has('blood'))
    return { emitTemp: 38, ignitionPoint: 200, flammability: 0, conductivity: 130, corrosivity: 0, hardness: 0 };
  if (has('slime','goo','ooze'))
    return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 90, corrosivity: 0, hardness: 0 };
  if (has('plant','leaf','vine','tree','grass','moss'))
    return { emitTemp: 30, ignitionPoint: 120, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 40 };
  if (has('wood','timber','log','bark','twig','plank'))
    return { emitTemp: 30, ignitionPoint: 140, flammability: 0.04, conductivity: 40, corrosivity: 0, hardness: 100 };
  if (has('paper','cardboard','parchment'))
    return { emitTemp: 30, ignitionPoint: 110, flammability: 0.25, conductivity: 50, corrosivity: 0, hardness: 20 };
  if (has('battery'))
    return { emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 180, corrosivity: 0, hardness: 160, conducts: true, chargeEmit: 120 };
  if (has('wire','cable','circuit'))
    return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 220, corrosivity: 0, hardness: 100, conducts: true };
  if (has('copper','brass'))
    return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 140, conducts: true };
  if (has('metal','iron','steel','aluminum','tin'))
    return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 240, conducts: true };
  if (has('gold','silver'))
    return { emitTemp: 30, ignitionPoint: 250, flammability: 0, conductivity: 250, corrosivity: 0, hardness: 200, conducts: true };
  if (has('diamond','gem'))
    return { emitTemp: 30, ignitionPoint: 250, flammability: 0, conductivity: 220, corrosivity: 0, hardness: 255 };
  if (has('crystal','glass'))
    return { emitTemp: 30, ignitionPoint: 240, flammability: 0, conductivity: 120, corrosivity: 0, hardness: 180 };
  if (has('rock','stone','brick','concrete','bedrock','marble','granite'))
    return { emitTemp: 30, ignitionPoint: 240, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 200 };
  if (has('tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine'))
    return { emitTemp: 30, ignitionPoint: 100, flammability: 0.30, conductivity: 90, corrosivity: 0, hardness: 30, ignitesAtCharge: 30 };
  if (has('gunpowder')||has('gun-powder'))
    return { emitTemp: 30, ignitionPoint: 90, flammability: 0.50, conductivity: 80, corrosivity: 0, hardness: 20, ignitesAtCharge: 20 };
  if (has('ash','soot','cinder'))
    return { emitTemp: 50, ignitionPoint: 255, flammability: 0, conductivity: 60, corrosivity: 0, hardness: 30, airflowFactor: 0.7 };
  if (has('mold','fungus','mycelium','lichen','coral','slime-mold'))
    return { emitTemp: 30, ignitionPoint: 150, flammability: 0.06, conductivity: 70, corrosivity: 0, hardness: 50 };
  if (has('uranium','plutonium','radio'))
    return { emitTemp: 110, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 30, hardness: 180, raInit: 250, raDelta: -1, raTransformsTo: 'stone' };
  if (has('fan','vent','jet'))
    return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 120 };
  if (kind === 'gas')      return { emitTemp: 60, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 0, hardness: 0, airflowFactor: 0.7 };
  if (kind === 'liquid')   return { emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 130, corrosivity: 0, hardness: 0 };
  if (kind === 'powder')   return { emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 90,  corrosivity: 0, hardness: 60 };
  if (kind === 'cellular') return { emitTemp: 30, ignitionPoint: 160, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 50 };
  return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 180 };
}

export function isHex(s) { return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s); }

export function fillFallbackColors(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h * 31) + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const out = [];
  for (let i = 0; i < 5; i++) {
    const hh = (hue + i * 12) % 360;
    const ll = 38 + i * 6;
    out.push(hslToHex(hh, 55, ll));
  }
  return out;
}

export function canonicalPaletteFromName(key) {
  const n = (key || '').toLowerCase();
  const has = (...words) => words.some(w => n.indexOf(w) >= 0);
  if (has('fire','flame','inferno','ember','plasma','spark')) return ['#ff4020','#ff8010','#ffc040','#ffe070'];
  if (has('lightning','arc')) return ['#fff8e0','#a0d0ff','#ffffff','#80b0ff'];
  if (has('lava','magma')) return ['#ff5020','#ff8030','#d03010','#ffc040'];
  if (has('steam')) return ['#d8e8f0','#b0c8d8','#f0f6fa','#c0d8e0'];
  if (has('smoke')) return ['#606060','#808080','#4a4a4a','#a0a0a0'];
  if (has('fog','mist','vapor','cloud','haze')) return ['#a0b8c8','#c0d0dc','#7890a0','#90a8b8'];
  if (has('balloon','helium','bubble')) return ['#e84060','#d03050','#ff6080','#a02040'];
  if (has('honey','syrup','molasses','caramel')) return ['#e8a030','#d48020','#ffc050','#b86020'];
  if (has('tar','pitch','glue','resin')) return ['#1a1008','#2a1810','#3a2418','#1f1410'];
  if (has('acid')) return ['#60ff30','#80ff40','#30d020','#b0ff60'];
  if (has('oil','gasoline','petrol','fuel')) return ['#2a1010','#4a2810','#1a0808','#603020'];
  if (has('mercury','quicksilver')) return ['#c0c0d0','#a0a0b8','#d8d8e0','#909098'];
  if (has('slime','goo','ooze')) return ['#60c060','#40a040','#80d080','#509050'];
  if (has('blood')) return ['#a02020','#801010','#c03030','#600808'];
  if (has('snow')) return ['#ffffff','#e8f0ff','#d0e0f0','#fafcff'];
  if (has('ash','soot','cinder')) return ['#505050','#707070','#3a3a3a','#606060'];
  if (has('gunpowder')||has('gun-powder')) return ['#2a2a2a','#404040','#1a1a1a','#303030'];
  if (has('tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine')) return ['#c02020','#e03030','#ff4040','#802020'];
  if (has('ice','icicle')) return ['#c0e0ff','#a0d0f0','#e0f0ff','#80b0e0'];
  if (has('plant','leaf','vine','tree','grass','moss')) return ['#409040','#60a050','#308030','#80b060'];
  if (has('wood','timber','log','bark','twig','plank')) return ['#7a4820','#8a5828','#5a3010','#a06838'];
  if (has('battery')) return ['#e0c020','#a08018','#fff060','#806010'];
  if (has('copper','brass')) return ['#c87838','#a85820','#d88848','#985020'];
  if (has('metal','iron','steel','aluminum','tin')) return ['#9a9a9a','#b0b0b0','#707070','#c8c8c8'];
  if (has('gold')) return ['#e0c040','#c8a830','#fff060','#b08820'];
  if (has('silver')) return ['#d0d0e0','#b0b0c0','#e8e8f0','#909098'];
  if (has('uranium','plutonium','radio')) return ['#80b020','#608018','#a0d040','#506010'];
  if (has('fan','vent','jet')) return ['#506070','#3a4858','#607888','#404a55'];
  if (has('mold','fungus','mycelium','lichen','coral','slime-mold')) return ['#304820','#405830','#50682a','#2a3818'];
  if (has('conway','automaton','life')) return ['#40e080','#30c060','#60f090','#20a050'];
  return null;
}

export function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const col = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * col).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
