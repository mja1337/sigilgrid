import type { AiPersonality, BattleClass } from '@sigilgrid/core';

export type DialogueLine = {
  speaker: string;
  text: string;
};

export type Reward =
  | { kind: 'pack'; count: number }
  | { kind: 'card'; templateId: string }
  | { kind: 'cosmetic'; id: string }
  | { kind: 'lore'; id: string }
  | { kind: 'seal'; count: number };

export type TutorialHint = {
  instanceId?: string;
  cell?: number;
  message: string;
};

export type Encounter = {
  id: string;
  act: 1 | 2 | 3 | 4;
  index: number;
  title: string;
  opponentName: string;
  opponentTitle: string;
  tactic: string;
  storyBeat: string;
  pre: DialogueLine[];
  post: DialogueLine[];
  blockedCells: number[];
  firstPlayer: 'player' | 'opponent';
  playerTemplates?: string[];
  opponentTemplates: string[];
  ai: 'easy' | 'standard' | 'expert';
  personality: AiPersonality;
  rewards: Reward[];
  tutorial?: TutorialHint[];
  practiceRematch?: boolean;
  /** Final rite: play this encounter id sequence as rounds. */
  linkedRounds?: string[];
  epilogueKey?: 'seal' | 'use';
};

const easy: AiPersonality = { aggression: 0.2, classBias: { P: 1 }, riskTolerance: 0.3 };
const mid: AiPersonality = { aggression: 0.55, classBias: { M: 1, X: 0.4 }, riskTolerance: 0.5 };
const hard: AiPersonality = { aggression: 0.8, classBias: { A: 1, X: 0.8 }, riskTolerance: 0.7 };

export const ENCOUNTERS: Encounter[] = [
  {
    id: 't1',
    act: 1,
    index: 1,
    title: 'Courier’s Colour',
    opponentName: 'Len the Runner',
    opponentTitle: 'Ember Market courier',
    tactic: 'Arrows and unopposed flips',
    storyBeat: 'A courier’s sigil changes colour before anyone claims it.',
    blockedCells: [],
    firstPlayer: 'player',
    opponentTemplates: ['lizardman', 'zombie', 'bomb', 'ironite', 'sahagin'],
    playerTemplates: ['goblin', 'fang', 'skeleton', 'flan', 'zaghnol'],
    ai: 'easy',
    personality: easy,
    tutorial: [
      {
        message: 'Select Goblin, then place it so its arrows face an enemy that does not point back.',
      },
    ],
    rewards: [
      { kind: 'card', templateId: 'cactuar' },
      { kind: 'lore', id: 'ember-market' },
    ],
    pre: [
      { speaker: 'Len', text: 'Keep your satchel closed. The ashfall makes sigils itch to wander.' },
      { speaker: 'You', text: 'I only need the grid between here and Glasswater.' },
      { speaker: 'Len', text: 'Then learn the first rite: point where they cannot point back.' },
    ],
    post: [
      { speaker: 'Len', text: 'See? The moth took the tick without a quarrel. That’s an unopposed claim.' },
      { speaker: 'You', text: 'The courier’s sigil… it flushed copper before you even lost.' },
      { speaker: 'Len', text: 'Don’t tell the stall-keepers. They’ll price the colour, not the truth.' },
    ],
  },
  {
    id: 't2',
    act: 1,
    index: 2,
    title: 'Bands of the Bell',
    opponentName: 'Mira Bell',
    opponentTitle: 'Apprentice ringer',
    tactic: 'Contested battles and readable bands',
    storyBeat: 'A duel where both arrows meet, and the numbers finally speak.',
    blockedCells: [15],
    firstPlayer: 'opponent',
    opponentTemplates: ['yeti', 'mimic', 'wyerd', 'mandragora', 'crawler'],
    playerTemplates: ['goblin', 'fang', 'skeleton', 'flan', 'zaghnol'],
    ai: 'easy',
    personality: easy,
    tutorial: [{ message: 'When arrows meet, a battle is born. Watch the Resolve panel after you commit.' }],
    rewards: [
      { kind: 'pack', count: 1 },
      { kind: 'lore', id: 'bands' },
    ],
    pre: [
      { speaker: 'Mira', text: 'If we both point, the grid asks for a roll. I like seeing the bands. Secrets make poor bells.' },
    ],
    post: [
      { speaker: 'Mira', text: 'Higher finals win. Ties keep the defender. Remember that when you feel lucky.' },
    ],
  },
  {
    id: 't3',
    act: 1,
    index: 3,
    title: 'One-Hop Swing',
    opponentName: 'Old Hatch',
    opponentTitle: 'Ember stall-wright',
    tactic: 'Combo without recursive chaining',
    storyBeat: 'A puzzle board that teaches the satisfying swing.',
    blockedCells: [5, 6, 9, 10],
    firstPlayer: 'player',
    opponentTemplates: ['nymph', 'sand-golem', 'zuu', 'dragonfly', 'carrion-worm'],
    playerTemplates: ['bomb', 'mimic', 'mandragora', 'nymph', 'cactuar'],
    ai: 'easy',
    personality: easy,
    tutorial: [{ message: 'Win a contested fight and the loser’s arrows may convert one hop of enemies. No further hops.' }],
    rewards: [
      { kind: 'card', templateId: 'tonberry' },
      { kind: 'seal', count: 1 },
      { kind: 'cosmetic', id: 'frame-ember' },
    ],
    pre: [
      { speaker: 'Hatch', text: 'People think combos run forever. They don’t. One hop, then the board holds its breath.' },
    ],
    post: [
      { speaker: 'Hatch', text: 'Take the hound. And if a sigil changes colour again, don’t sell it. Follow it.' },
    ],
  },
  {
    id: 'a1-rival',
    act: 2,
    index: 4,
    title: 'Ash on the Ledger',
    opponentName: 'Sera Quill',
    opponentTitle: 'Market auditor',
    tactic: 'Blocked cells and board pressure',
    storyBeat: 'The market’s books show rites paying better than caravans.',
    blockedCells: [3, 12],
    firstPlayer: 'player',
    opponentTemplates: ['cerberus', 'antlion', 'cactuar', 'gimme-cat', 'ragtimer'],
    ai: 'standard',
    personality: mid,
    rewards: [{ kind: 'pack', count: 1 }, { kind: 'lore', id: 'city-rites' }],
    pre: [
      { speaker: 'Sera', text: 'Disputes used to mean walls and wages. Now they mean five sigils and a square.' },
      { speaker: 'You', text: 'Because the ashfall eats marching columns.' },
      { speaker: 'Sera', text: 'Or because someone prefers the grid’s quiet conversions.' },
    ],
    post: [
      { speaker: 'Sera', text: 'Go on to Glasswater. Rivals are buying altered sigils. Not for play — for a patron.' },
    ],
  },
  {
    id: 'a2-road',
    act: 2,
    index: 5,
    title: 'Glasswater Ambush',
    opponentName: 'The Pale Pair',
    opponentTitle: 'Road claimants',
    tactic: 'Contested order as a decision',
    storyBeat: 'Two collectors work the same stretch of road.',
    blockedCells: [0, 15],
    firstPlayer: 'opponent',
    opponentTemplates: ['hedgehog-pie', 'ochu', 'troll', 'blazer-beetle', 'abomination'],
    ai: 'standard',
    personality: { aggression: 0.7, classBias: { P: 1 }, riskTolerance: 0.6 },
    rewards: [{ kind: 'card', templateId: 'malboro' }],
    pre: [
      { speaker: 'Pale Pair', text: 'Your satchel smells like market copper. Our patron pays in quieter metal.' },
    ],
    post: [
      { speaker: 'Pale Pair', text: 'Keep the warden. The patron wanted the colour-changed ones, not the honest steel.' },
    ],
  },
  {
    id: 'a2-mage',
    act: 2,
    index: 6,
    title: 'Thin Glass Defense',
    opponentName: 'Ilya of the Veil',
    opponentTitle: 'Itinerant binder',
    tactic: 'M and X into weak magical defense',
    storyBeat: 'A rival deck leans physical and leaves the mind unarmored.',
    blockedCells: [7, 8],
    firstPlayer: 'player',
    opponentTemplates: ['zemzelett', 'stroper', 'tantarian', 'grand-dragon', 'hecteyes'],
    ai: 'standard',
    personality: { aggression: 0.4, classBias: { P: 1 }, riskTolerance: 0.4 },
    rewards: [
      { kind: 'card', templateId: 'shiva' },
      { kind: 'lore', id: 'patron' },
    ],
    pre: [
      { speaker: 'Ilya', text: 'They stack hide and horn. Look at the third glyph — magical glass, barely fired.' },
      { speaker: 'You', text: 'So I bring tide and wisp.' },
      { speaker: 'Ilya', text: 'And X, if you have it. The lower defense is a door.' },
    ],
    post: [
      { speaker: 'Ilya', text: 'The patron’s mark is an empty lantern. Someone is feeding the ashfall altered rites.' },
    ],
  },
  {
    id: 'a2-lock',
    act: 3,
    index: 7,
    title: 'Toll of the Lock',
    opponentName: 'Captain Brine',
    opponentTitle: 'Canal lock-ward',
    tactic: 'Risk and board geometry',
    storyBeat: 'Wager rites are whispered; the lock stays honest for now.',
    blockedCells: [2, 5, 10, 13],
    firstPlayer: 'player',
    opponentTemplates: ['ogre', 'wraith', 'gargoyle', 'tonberry', 'garuda'],
    ai: 'standard',
    personality: mid,
    rewards: [
      { kind: 'seal', count: 2 },
      { kind: 'cosmetic', id: 'back-tide' },
    ],
    pre: [
      { speaker: 'Brine', text: 'After this act, some fools stake cards. Not on my lock. Play clean, then decide.' },
    ],
    post: [
      { speaker: 'Brine', text: 'Archive road is east. If records pre-date the cities, we have been playing someone else’s game.' },
    ],
  },
  {
    id: 'a3-door',
    act: 3,
    index: 8,
    title: 'Index of Folded Prayers',
    opponentName: 'Keeper Soth',
    opponentTitle: 'Clockwork archivist',
    tactic: 'X/A classes and six-block boards',
    storyBeat: 'Records show Ashfall rites older than the city-states.',
    blockedCells: [1, 2, 4, 7, 8, 11],
    firstPlayer: 'opponent',
    opponentTemplates: ['malboro', 'mover', 'behemoth', 'iron-man', 'ozma'],
    ai: 'expert',
    personality: hard,
    practiceRematch: true,
    rewards: [{ kind: 'card', templateId: 'ifrit' }, { kind: 'lore', id: 'pre-city' }],
    pre: [
      { speaker: 'Soth', text: 'Six closures. An A-class relic in my sleeve. You may practice until the gears forgive you.' },
    ],
    post: [
      { speaker: 'Soth', text: 'The rites are older than walls. The ashfall is not a weather. It is a leftover instruction.' },
    ],
  },
  {
    id: 'a3-combo',
    act: 3,
    index: 9,
    title: 'Trap in the Stacks',
    opponentName: 'Page Twelve',
    opponentTitle: 'Living index',
    tactic: 'Combo traps and tailored decks',
    storyBeat: 'The archive itself plays, preferring chains.',
    blockedCells: [0, 3],
    firstPlayer: 'player',
    opponentTemplates: ['hades', 'shiva', 'ifrit', 'ramuh', 'bahamut'],
    ai: 'expert',
    personality: { aggression: 0.85, classBias: { X: 1 }, riskTolerance: 0.75 },
    rewards: [{ kind: 'card', templateId: 'odin' }, { kind: 'pack', count: 1 }],
    pre: [
      { speaker: 'Page Twelve', text: 'Select your five as if the shelves were listening. They are.' },
    ],
    post: [
      { speaker: 'Page Twelve', text: 'The Black Lantern is not a place. It is a permission.' },
    ],
  },
  {
    id: 'a4-r1',
    act: 4,
    index: 10,
    title: 'First Lantern',
    opponentName: 'The Source',
    opponentTitle: 'Unfinished rite',
    tactic: 'Difficult layouts, synthesis',
    storyBeat: 'Three rounds under one persistent scene.',
    blockedCells: [1, 4, 11, 14],
    firstPlayer: 'player',
    opponentTemplates: ['alexander', 'madeen', 'fenrir', 'ark', 'leviathan'],
    ai: 'expert',
    personality: hard,
    linkedRounds: ['a4-r1', 'a4-r2', 'a4-r3'],
    rewards: [{ kind: 'seal', count: 1 }],
    pre: [
      { speaker: 'The Source', text: 'Three boards. One choice at the end. The choice will not unbalance the grid — only the story you keep.' },
    ],
    post: [{ speaker: 'The Source', text: 'Again.' }],
  },
  {
    id: 'a4-r2',
    act: 4,
    index: 11,
    title: 'Second Lantern',
    opponentName: 'The Source',
    opponentTitle: 'Unfinished rite',
    tactic: 'Escalating geometry',
    storyBeat: 'The board tightens.',
    blockedCells: [0, 2, 5, 10, 13, 15],
    firstPlayer: 'opponent',
    opponentTemplates: ['excalibur-ii', 'ultima-weapon', 'masamune', 'dark-matter', 'invincible'],
    ai: 'expert',
    personality: hard,
    rewards: [{ kind: 'card', templateId: 'bahamut' }],
    pre: [{ speaker: 'The Source', text: 'Altered sigils return because the instruction was never closed.' }],
    post: [{ speaker: 'The Source', text: 'Last board.' }],
  },
  {
    id: 'a4-r3',
    act: 4,
    index: 12,
    title: 'The Black Lantern Rite',
    opponentName: 'The Source',
    opponentTitle: 'Unfinished rite',
    tactic: 'Full synthesis',
    storyBeat: 'Seal the source or use it — narrative only.',
    blockedCells: [3, 6, 7, 8, 9, 12],
    firstPlayer: 'player',
    opponentTemplates: ['namingway', 'boco', 'airship', 'ozma', 'alexander'],
    ai: 'expert',
    personality: hard,
    epilogueKey: 'seal',
    rewards: [
      { kind: 'card', templateId: 'madeen' },
      { kind: 'cosmetic', id: 'frame-lantern' },
      { kind: 'lore', id: 'ending' },
    ],
    pre: [{ speaker: 'The Source', text: 'Win, then choose: seal the upgrade-well, or drink from it. The math of the grid stays honest either way.' }],
    post: [{ speaker: 'The Source', text: 'The ashfall listens to stories more than swords. Tell yours carefully.' }],
  },
];

export const LORE: Record<string, { title: string; body: string }> = {
  'ember-market': {
    title: 'Ember Market',
    body: 'Stalls built from kiln bricks, where disputes are now settled on cloth grids so the ashfall cannot eat a riot.',
  },
  bands: {
    title: 'Power bands',
    body: 'Each engraved digit is a sixteen-wide band. The rite samples, then both sides exhaust themselves. Ties keep the defender.',
  },
  'city-rites': {
    title: 'City-state rites',
    body: 'When marching became suicide, the councils legalized the Grid. Some say they were eager.',
  },
  patron: {
    title: 'The empty lantern',
    body: 'A mark with no flame. Collectors buy colour-changed sigils and vanish toward the archive road.',
  },
  'pre-city': {
    title: 'Older than walls',
    body: 'Clockwork shelves keep rites that name no city. The ashfall may be leftover instruction, not weather.',
  },
  ending: {
    title: 'After the lantern',
    body: 'Whether sealed or used, the grid remains. Wayfinders still walk. Altered sigils still return — but now you know they are answering.',
  },
};

export const COSMETICS = [
  { id: 'frame-plain', name: 'Plain vellum', kind: 'frame' as const },
  { id: 'frame-ember', name: 'Ember inlay', kind: 'frame' as const },
  { id: 'frame-lantern', name: 'Black lantern', kind: 'frame' as const },
  { id: 'back-plain', name: 'Navy back', kind: 'back' as const },
  { id: 'back-tide', name: 'Tide glass', kind: 'back' as const },
];
