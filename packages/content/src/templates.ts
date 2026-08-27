import type { BattleClass, Direction, Hex, Rarity } from '@sigilgrid/core';

export const CONTENT_VERSION = '2.1.0';

export type Silhouette =
  | 'humanoid'
  | 'beast'
  | 'undead'
  | 'slime'
  | 'insect'
  | 'dragon'
  | 'eidolon'
  | 'spell'
  | 'blade'
  | 'vessel'
  | 'place'
  | 'chocobo'
  | 'moogle'
  | 'plant'
  | 'relic';

export type CardTemplate = {
  templateId: string;
  cardNumber: number;
  displayName: string;
  rarity: Rarity;
  lore: string;
  silhouette: Silhouette;
  defaultArrows: Direction[];
  attack: Hex;
  battleClass: BattleClass;
  physicalDefense: Hex;
  magicalDefense: Hex;
  arrowVariants: Direction[][];
};

/** Starting stats from the FF Wiki Tetra Master card list. */
const RAW: [number, string, string, Silhouette, string][] = [
  [1, 'Goblin', '0P00', 'humanoid', 'A snaggle-toothed raider of the Mist Continent.'],
  [2, 'Fang', '0P00', 'beast', 'A leaping predator that hunts in the grasslands.'],
  [3, 'Skeleton', '0P00', 'undead', 'Animated bones still clutching a rusted blade.'],
  [4, 'Flan', '0M01', 'slime', 'A wobbling pudding that shrugs off steel.'],
  [5, 'Zaghnol', '0P00', 'beast', 'A tusked mount used on the outer plains.'],
  [6, 'Lizard Man', '0P00', 'humanoid', 'A spear-wielding reptile of the marshes.'],
  [7, 'Zombie', '1M10', 'undead', 'A shambling corpse that will not lie down.'],
  [8, 'Bomb', '1M01', 'spell', 'A living ember that explodes when startled.'],
  [9, 'Ironite', '1P10', 'insect', 'An armored crustacean of the shoals.'],
  [10, 'Sahagin', '1P10', 'humanoid', 'A trident-bearing fish-man of the coast.'],
  [11, 'Yeti', '1M01', 'beast', 'A snow brute with a surprisingly gentle howl.'],
  [12, 'Mimic', '1M11', 'relic', 'A treasure chest with teeth.'],
  [13, 'Wyerd', '1M01', 'beast', 'A winged nuisance of the high roads.'],
  [14, 'Mandragora', '1M02', 'plant', 'A shrieking root that walks on leafy feet.'],
  [15, 'Crawler', '2P20', 'insect', 'A segmented worm that burrows under caravans.'],
  [16, 'Sand Scorpion', '2P20', 'insect', 'A desert stinger buried just beneath the dunes.'],
  [17, 'Nymph', '2M02', 'eidolon', 'A flickering forest spirit.'],
  [18, 'Sand Golem', '2P20', 'relic', 'A walking dune given a face of stone.'],
  [19, 'Zuu', '2P02', 'beast', 'A flightless terror-bird of the open waste.'],
  [20, 'Dragonfly', '2P21', 'insect', 'A jeweled hunter that skims the marsh.'],
  [21, 'Carrion Worm', '2M11', 'insect', 'It feeds where battles have already ended.'],
  [22, 'Cerberus', '2P20', 'beast', 'Three heads, one appetite.'],
  [23, 'Antlion', '3P21', 'insect', 'A pit-lurker that waits for a single misstep.'],
  [24, 'Cactuar', '3PC0', 'plant', 'A thousand needles in a running pose.'],
  [25, 'Gimme Cat', '3M11', 'beast', 'It only wants what you are holding.'],
  [26, 'Ragtimer', '3M21', 'relic', 'A dancing clockwork leftover from Alexandria.'],
  [27, 'Hedgehog Pie', '3M12', 'beast', 'A round, bristling familiar of black mages.'],
  [28, 'Ralvuimago', '3P40', 'beast', 'A horned charger of the outer continents.'],
  [29, 'Ochu', '3P21', 'plant', 'A towering plant with a mouth like a cave.'],
  [30, 'Troll', '3P32', 'humanoid', 'A club-wielding giant of the highlands.'],
  [31, 'Blazer Beetle', '4P51', 'insect', 'A burning carapace on six legs.'],
  [32, 'Abomination', '4P33', 'undead', 'Flesh stacked in the wrong order.'],
  [33, 'Zemzelett', '4M15', 'beast', 'A storm-bird that nests in lightning.'],
  [34, 'Stroper', '4P30', 'plant', 'A walking thicket with a hunter’s patience.'],
  [35, 'Tantarian', '4M22', 'relic', 'A cursed tome that prefers to eat readers.'],
  [36, 'Grand Dragon', '4P44', 'dragon', 'An old wyrm that still remembers kingdoms.'],
  [37, 'Feather Circle', '4M22', 'beast', 'A ring of wings that never quite lands.'],
  [38, 'Hecteyes', '4M04', 'slime', 'Too many eyes, all of them watching.'],
  [39, 'Ogre', '5P41', 'humanoid', 'A fortress of muscle and bad temper.'],
  [40, 'Armstrong', '5M24', 'undead', 'A marionette soldier that never stands down.'],
  [41, 'Ash', '5M33', 'undead', 'Cinder given a will of its own.'],
  [42, 'Wraith', '5M40', 'undead', 'A pale hunger in a tattered shroud.'],
  [43, 'Gargoyle', '5M32', 'undead', 'Stone wings, a living scowl.'],
  [44, 'Vepal', '5M33', 'undead', 'A masked spirit of the old catacombs.'],
  [45, 'Grimlock', '5M23', 'undead', 'It laughs with someone else’s voice.'],
  [46, 'Tonberry', '2P33', 'humanoid', 'A lantern, a knife, and a very long memory.'],
  [47, 'Veteran', '5M19', 'undead', 'A war-mage who declined to die on schedule.'],
  [48, 'Garuda', '6M41', 'eidolon', 'A sky-queen with a tempest for a cloak.'],
  [49, 'Malboro', '5M36', 'plant', 'Bad breath, worse intentions.'],
  [50, 'Mover', '6MF0', 'spell', 'A hovering orb that unmakes the careless.'],
  [51, 'Abadon', '7M62', 'undead', 'A winged ruin that feeds on despair.'],
  [52, 'Behemoth', 'BP46', 'beast', 'The classic mountain of horns and fury.'],
  [53, 'Iron Man', 'CP60', 'relic', 'A hollow knight of living metal.'],
  [54, 'Nova Dragon', 'EP7C', 'dragon', 'A star-fire wyrm of the end of things.'],
  [55, 'Ozma', 'DM0C', 'eidolon', 'A falling sky given a single terrible eye.'],
  [56, 'Hades', 'FMC1', 'eidolon', 'The underworld’s chemist, grinning.'],
  [57, 'Holy', '8M23', 'spell', 'White light that does not ask permission.'],
  [58, 'Meteor', 'BMA0', 'spell', 'A rain of stones from a red sky.'],
  [59, 'Flare', 'CM00', 'spell', 'The last word in raw destruction.'],
  [60, 'Shiva', '5M05', 'eidolon', 'Ice given a dancer’s poise.'],
  [61, 'Ifrit', '6M90', 'eidolon', 'A horned inferno on two feet.'],
  [62, 'Ramuh', '4M16', 'eidolon', 'The old man of the thunderwood.'],
  [63, 'Atomos', '4M66', 'eidolon', 'A gravity well with an appetite.'],
  [64, 'Odin', 'CM84', 'eidolon', 'The rider who ends battles in one stroke.'],
  [65, 'Leviathan', 'BM61', 'eidolon', 'The sea itself, coiled and waiting.'],
  [66, 'Bahamut', 'CM85', 'dragon', 'The king of dragons, briefly borrowed.'],
  [67, 'Ark', 'EM55', 'vessel', 'A warship eidolon of another age.'],
  [68, 'Fenrir', '8M21', 'beast', 'Eiko’s wolf of moon and stone.'],
  [69, 'Madeen', 'AM16', 'eidolon', 'A radiant guardian born of a last wish.'],
  [70, 'Alexander', 'DMB5', 'eidolon', 'A holy fortress that walks.'],
  [71, 'Excalibur II', 'FPB0', 'blade', 'The sword that should not exist yet.'],
  [72, 'Ultima Weapon', 'FP16', 'blade', 'A blade that drinks the end of the world.'],
  [73, 'Masamune', 'CPB3', 'blade', 'A curved edge that remembers every duel.'],
  [74, 'Elixir', '6M66', 'relic', 'A miracle bottled, cork still warm.'],
  [75, 'Dark Matter', 'CM3C', 'spell', 'Compressed night, unstable by design.'],
  [76, 'Ribbon', '0MCF', 'relic', 'A scrap of cloth that laughs at curses.'],
  [77, 'Tiger Racket', '0P01', 'blade', 'Freya’s hunting racket, still humming.'],
  [78, 'Save the Queen', '6P30', 'blade', 'Beatrix’s answer to every argument.'],
  [79, 'Genji', '0P6A', 'relic', 'Armor from a war that never quite ended.'],
  [80, 'Mythril Sword', '1P00', 'blade', 'Honest steel with a pale gleam.'],
  [81, 'Blue Narciss', '8P81', 'vessel', 'A royal ship under a blue sail.'],
  [82, 'Hilda Garde 3', '6P30', 'vessel', 'Cid’s third try at the sky.'],
  [83, 'Invincible', 'BP8C', 'vessel', 'Kuja’s fortress, hanging in the dark.'],
  [84, 'Cargo Ship', '2P60', 'vessel', 'Lindblum’s workhorse of the mistways.'],
  [85, 'Hilda Garde 1', '6P40', 'vessel', 'The first airship that believed in Cid.'],
  [86, 'Red Rose', '8P18', 'vessel', 'Alexandria’s flower of war.'],
  [87, 'Theater Ship', '1P61', 'vessel', 'Tantalus travels, and the play goes with them.'],
  [88, 'Viltgance', 'EP81', 'vessel', 'A lancer of the high mist.'],
  [89, 'Chocobo', '0P00', 'chocobo', 'Kweh. The rest is details.'],
  [90, 'Fat Chocobo', '1P11', 'chocobo', 'A golden mountain of feathers and appetite.'],
  [91, 'Mog', '1M00', 'moogle', 'Kupo! A letter is probably involved.'],
  [92, 'Frog', '0P00', 'beast', 'A pond philosopher with excellent jumps.'],
  [93, 'Oglop', '2P10', 'insect', 'Quina’s least favorite snack, possibly.'],
  [94, 'Alexandria', '0PB6', 'place', 'Towers, roses, and a very loud queen.'],
  [95, 'Lindblum', '0P6B', 'place', 'Gears, airships, and a regent in a frog suit.'],
  [96, 'Two Moons', '6M55', 'spell', 'Gaia’s night, written twice.'],
  [97, 'Gargant', '2P03', 'beast', 'A burrowing beast of the Forgotten Continent.'],
  [98, 'Namingway', '7M77', 'humanoid', 'He will rename you whether you like it or not.'],
  [99, 'Boco', '7P77', 'chocobo', 'Bartz’s chocobo, a long way from home.'],
  [100, 'Airship', '7P77', 'vessel', 'The idea of flight, printed on card stock.'],
];

const DIRS: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function rarityFor(n: number): Rarity {
  if (n <= 25) return 'common';
  if (n <= 50) return 'uncommon';
  if (n <= 75) return 'rare';
  return 'relic';
}

function parseStat(code: string): { attack: Hex; battleClass: BattleClass; physicalDefense: Hex; magicalDefense: Hex } {
  const hex = (c: string) => Number.parseInt(c, 16) as Hex;
  return {
    attack: hex(code[0]!),
    battleClass: code[1] as BattleClass,
    physicalDefense: hex(code[2]!),
    magicalDefense: hex(code[3]!),
  };
}

function slug(name: string): string {
  if (name === 'Lizard Man') return 'lizardman';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function arrowsFor(n: number): Direction[] {
  const strength = Math.ceil(n / 20);
  const count = Math.min(7, Math.max(1, strength + (n % 3)));
  const pool = [...DIRS];
  const picked: Direction[] = [];
  let x = (n * 1103515245 + 12345) >>> 0;
  for (let i = 0; i < count && pool.length; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const idx = x % pool.length;
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked;
}

function variants(base: Direction[]): Direction[][] {
  const v2 = rotate(base);
  const v3 = rotate(v2);
  const extra = DIRS.filter((d) => !base.includes(d)).slice(0, 1);
  const v4 = extra.length ? [...base, extra[0]!] : base;
  return [base, v2, v3, v4];
}

function rotate(arrows: Direction[]): Direction[] {
  return arrows.map((a) => DIRS[(DIRS.indexOf(a) + 1) % 8]!);
}

export const TEMPLATES: CardTemplate[] = RAW.map(([n, displayName, code, silhouette, lore]) => {
  const stats = parseStat(code);
  const defaultArrows = arrowsFor(n);
  return {
    templateId: slug(displayName),
    cardNumber: n,
    displayName,
    rarity: rarityFor(n),
    lore,
    silhouette,
    defaultArrows,
    ...stats,
    arrowVariants: variants(defaultArrows),
  };
});

export function templateById(id: string): CardTemplate {
  const found = TEMPLATES.find((x) => x.templateId === id);
  if (!found) throw new Error(`unknown template ${id}`);
  return found;
}
