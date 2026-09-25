export interface FactionDef {
  id: string;
  name: string;
  short: string;
  leader: string;
  leaderTitle: string;
  portrait: string;
  color: string;
  capital: string;
  /** 0..1 how eager to attack */
  aggression: number;
  /** 0..1 how much it values gold/trade over war */
  greed: number;
  /** base defense bonus of its holdings */
  discipline: number;
  troopName: string;
  enemyTypes: string[];
  motto: string;
  desc: string;
  greeting: string[];
  battlemap: string;
}

export const FACTIONS: Record<string, FactionDef> = {
  cinder: {
    id: 'cinder', name: 'The Cinder Throne', short: 'Cinder', leader: 'Ozmyr', leaderTitle: 'the Burnt King', portrait: 'warlords/ozmyr',
    color: '#d8432f', capital: 'kiln', aggression: 0.85, greed: 0.2, discipline: 1.2, troopName: 'Burnlads',
    enemyTypes: ['burnlad', 'burnlad', 'burnlad', 'kilnguard'],
    motto: 'All will burn clean.',
    desc: 'The Burnt King rules from the Kiln, a dead reactor he swears still whispers to him. His Burnlads are branded children of the ash who fear nothing but his disappointment. Every hold he takes is put to the torch and rebuilt in his image.',
    greeting: ['The King sees you, drifter. Kneel or burn.', 'You stand in the warm places now. Speak.', 'Ash to ash. What do you want?'],
    battlemap: 'kiln',
  },
  choir: {
    id: 'choir', name: 'The Choir of Ash', short: 'Choir', leader: 'Mother Carrion', leaderTitle: 'Voice of the Crater', portrait: 'warlords/carrion',
    color: '#9a5bd6', capital: 'crater', aggression: 0.55, greed: 0.2, discipline: 1.0, troopName: 'Ashen Faithful',
    enemyTypes: ['cultist', 'cultist', 'psyker', 'hollow'],
    motto: 'Listen. The storm is singing.',
    desc: 'Pilgrims of the Glass Crater who worship the Maelstrom itself. Their psychics bleed from the eyes and smile while doing it. They hate the Burnt King as a heretic who would steal their god.',
    greeting: ['The storm spoke your name before you arrived, child.', 'Kneel on the glass. Listen.', 'Your mind is loud. Sit, and be quieter.'],
    battlemap: 'glass',
  },
  iron: {
    id: 'iron', name: 'The Iron Hundred', short: 'Iron', leader: 'Baron Kesh', leaderTitle: 'Commander of Holdfast', portrait: 'warlords/kesh',
    color: '#5b8fd1', capital: 'holdfast', aggression: 0.4, greed: 0.35, discipline: 1.5, troopName: 'Riflemen',
    enemyTypes: ['militia', 'militia', 'militia', 'saltguard'],
    motto: 'Hold the line. Hold the water.',
    desc: 'The descendants of a militia that seized the great dam. Drilled, disciplined and stubborn, they control the only clean water in the basin and know exactly what it is worth.',
    greeting: ['State your business, and be brief.', 'The Baron has little time for drifters. Make it count.', 'Water is life. Holdfast is water. Speak.'],
    battlemap: 'road',
  },
  pump: {
    id: 'pump', name: 'The Pumpworks', short: 'Pumpworks', leader: 'Dremmer Gasface', leaderTitle: 'the Oil Baron', portrait: 'warlords/dremmer',
    color: '#ec8a2a', capital: 'pumpworks', aggression: 0.5, greed: 0.85, discipline: 1.1, troopName: 'Pump Thugs',
    enemyTypes: ['pumpthug', 'pumpthug', 'scav', 'raider'],
    motto: 'Everything runs on fuel. Everything.',
    desc: 'Dremmer\'s refinery is the beating black heart of the Burnlands: every war-rig and generator drinks his guzzoline. He sells to all sides and would sell his own mother if she ran on diesel.',
    greeting: ['*wheeze* ...Customer or cargo?', '*hiss of the mask* Dremmer listens. Dremmer always listens for profit.', 'Fuel for blood, blood for fuel. What\'re you selling?'],
    battlemap: 'industrial',
  },
  rats: {
    id: 'rats', name: 'The Rat Kings', short: 'Rats', leader: 'Gnaw', leaderTitle: 'King Under the Water', portrait: 'warlords/gnaw',
    color: '#8fbf3a', capital: 'undergrid', aggression: 0.6, greed: 0.5, discipline: 0.9, troopName: 'Tunnel Rats',
    enemyTypes: ['ratman', 'ratman', 'ratman', 'crawler'],
    motto: 'Below is safe. Below is ours.',
    desc: 'Mutants and outcasts who live in the flooded tunnels under the drowned city. Everyone above calls them vermin. Gnaw calls them his children, and he has a great many children.',
    greeting: ['Hehh. Surface-walker. Smell like sun.', 'Gnaw\'s children hear everything in the pipes. Talk soft.', 'You come Below. Why? Trade? Or food?'],
    battlemap: 'sewer',
  },
  dust: {
    id: 'dust', name: 'The Dust Riders', short: 'Riders', leader: 'Ruthie Two-Guns', leaderTitle: 'Queen of the Long Road', portrait: 'warlords/ruthie',
    color: '#e3c84a', capital: 'wreckyard', aggression: 0.7, greed: 0.6, discipline: 1.0, troopName: 'Road Raiders',
    enemyTypes: ['raider', 'raider', 'raider', 'warboss'],
    motto: 'Ride fast. Take everything.',
    desc: 'Chrome, chains and gasoline. Ruthie\'s raiders own the highways and take a cut of everything that moves on them. Loyal to Ruthie, to speed, and to nothing else.',
    greeting: ['Well hell, look what crawled in off the road!', 'Ruthie likes brave. Ruthie likes stupid more. Which are you?', 'Talk fast, drifter. Engines are running.'],
    battlemap: 'waste',
  },
  salt: {
    id: 'salt', name: 'The Saltmarch', short: 'Saltmarch', leader: 'Isolde Vane', leaderTitle: 'the Salt Widow', portrait: 'warlords/isolde',
    color: '#3cb7a8', capital: 'brinetown', aggression: 0.3, greed: 0.9, discipline: 1.1, troopName: 'Caravan Guards',
    enemyTypes: ['saltguard', 'saltguard', 'saltguard', 'scav'],
    motto: 'Every road leads to the market.',
    desc: 'Merchant-princes of the salt flats who run the caravans between every hold. Isolde Vane buried three husbands and a rival cartel. She prefers to buy her wars, but she will fight them.',
    greeting: ['A new face. How refreshing. What can you offer me?', 'Everything has a price, dear. Even you.', 'Sit. Have some water, it\'s clean. That will be two barter.'],
    battlemap: 'salt',
  },
};

export const INDEPENDENT = {
  id: 'free', name: 'Free Holds', short: 'Free', color: '#9d9384', troopName: 'Militia', enemyTypes: ['scav', 'scav', 'militia'],
};

export const PLAYER_FACTION_ID = 'player';
export const FACTION_IDS = Object.keys(FACTIONS);
