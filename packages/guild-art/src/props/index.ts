import type { PropLayer } from "../frame.ts";
import { prop } from "./art.ts";

const hearthStone = [
  "............jjjjjjjjjjjjjjjj............",
  "............jkkkkkkOkkkkkkkk............",
  ".............jjjjjjjjjjjjjk.............",
  ".............jkkkOkkkkkkkkk.............",
  ".............jkkkkkkkkOkkOk.............",
  "............jjjjjjjjjjjjjjjj............",
  "............jkkOkkkkkkkkOkkk............",
  "...........jjjjjjjjjjjjjjjjjj...........",
  "..........jjkkkkOkkkkkkkkkkkjk..........",
  ".........jjkkkOkkkkkkkkkkOkkkjk.........",
  ".......jjjjjjjjjjjjjjjjjjjjjjjjjj.......",
  "......jjjjjjjjjjjjjjjjjjjjjjjjjjjk......",
  "......kkkkkkkkkkkkkkkkkkkkkkkkkkkk......",
  ".......jkkjkkkkkkkkkkkkkkkkkOjkkk.......",
  ".......jkkjjjjOOOOOOOOOOOOjjjjkkk.......",
  ".......jkkjjOOOOOOOOOOOOOOOOjjkkk.......",
  ".......jkkjOOOOOOOOOOOOOOOOOOjkkk.......",
  ".......jkkjOOOOOOOOOOOOOOOOOOjkkk.......",
  ".......jjkjOOOOOOOOOOOOOOOOOOjkjk.......",
  ".......jkkjOOOOOOOOOOOOOOOOOOjkkk.......",
  ".......jkkjOOOOOOOOOOOOOOOOOOjkkk.......",
  ".......jkkjOOOOOOOOOOOOOOOOOOjkkk.......",
  ".......jkkjOOOOOOOOOOOOOOOOOOjkkk.......",
  ".......jkkjmOmOmOmOmOmOmOmOmOjkkk.......",
  "......jjjjjjjjjjjjjjjjjjjjjjjjjjjk......",
  ".....jjjjjjjOjjjjjjjjjjjjjjjOjjjjjk.....",
  "....jkkkkkkkOkkkkkkkkkkkkkkkOkkkkkkk....",
  "....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk....",
];
const hearth = [
  [
    "......g.........",
    "......G...g.....",
    "..g..GG...G.....",
    "..G..GGG.GG..g..",
    ".gGGGGXGGGGG.Gg.",
    "ggGGGXXXGXGGGggg",
  ],
  [
    ".........g......",
    ".....g...G......",
    ".g...G..GG...g..",
    ".G...GG.GGG..G..",
    "gGG.GGXGGXGGGGg.",
    "ggGGGXXXXXXGGggg",
  ],
  [
    "....g...........",
    "....G.....g.....",
    "..g.GG...GG...g.",
    "..G.GGG.GGGg..G.",
    ".gGGGGXXGXGG.GGg",
    "ggGGGXXXXXGGGGgg",
  ],
  [
    "........g.......",
    "........G...g...",
    "..g..g.GG...G...",
    "..G..G.GGG.GGg..",
    ".gGGGGGGXXGGGGg.",
    "ggGGGXGXXXXGGggg",
  ],
].map((flame) =>
  prop(hearthStone, [...Array<string>(17).fill(""), ...flame.map((row) => "............" + row)]),
);

const longTable = prop([
  "..Ww...............wW...............................",
  "..WW..........bB...WW......g........................",
  "..dd.........bBBB..dd......G........................",
  "..DD.........bBBb..DD.....gGg.......................",
  ".DDDDDDDDDDDDDDDDDDDBBBBBBDDDDDDDDDDDDDDDDDDDDDDDD.",
  "DDDDDDDDDDDDDDDDDDDDBBBBBBDDDDDDDDDDDDDDDDDDDDDDDDDd",
  "ddddddddddddddddddddBBBBBbdddddddddddddddddddddddddd",
  "..DDd.O............DBBBbB.d.................O.DDd..",
  "..DDdDDDDDDDDDDDDDDDgggggDDDDDDDDDDDDDDDDDDDDDDDd..",
  "..DDd...............gBgBg.....................DDd..",
  "..DDd.........................................DDd..",
  "..DDd.........................................DDd..",
  ".DDdd.........................................Dddd.",
]);

const bench = prop([
  ".DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.",
  "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDd",
  "ddddddddddddddddddddddddddddddddddddddddd",
  "..DDd..........ddd.................DDd..",
  "..DDd..............................DDd..",
  ".Dddd..............................Dddd.",
]);

const stool = prop([".DDDDDDD.", "DDDDDDDDd", ".Ddddddd.", ".Dd...Dd."]);

const workTable = prop([
  "..............................kk....",
  "......w.....wWWW..............kk....",
  ".....wWw...wWWWWWww..Www......kk....",
  "..DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.",
  ".DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
  ".dddddddddddddddddddddddddddddddddd",
  "...DDdDdddDddggDdddDDDDd.....DDd...",
  "...DDd.ddddddddddd..DDd......DDd...",
  "...DDd..............DDd......DDd...",
  "...Ddd.......................Ddd...",
]);

const questBoard = prop([
  "............gGGg............",
  "..........gGGGGGg...........",
  "...........GgGGg............",
  ".DDDDDDDDDDDDDDDDDDDDDDDDDd.",
  "DDDDDDDDDDDDDDDDDDDDDDDDDDdd",
  "DDdwWwwdddddddddgdWWWWwwDDdd",
  "DDdWGWWdgdWWWwwwdWWWWWWwDDdd",
  "DDdWWWWwdWWGWWWwdWDdDWWwDDdd",
  "DDdWDdWwdWDDWWwddWWWWWWwDDdd",
  "DDdWWWWwdWWWWWWwdddwwwwwDDdd",
  "DDddwwwwdddwwwwwddwgwwddDDdd",
  "DDdddWWGwwdddddddWWWWwddDDdd",
  "DDdddWWWWwdddddddWDDDwddDDdd",
  "DDdddwwwwwdddddddWWWWwddDDdd",
  "DDddddddddddddddddwwwwddDDdd",
  ".DDDDDDDDDDDDDDDDDDDDDDDDdd.",
  "..ddd...................ddd.",
]);

const bell = prop([
  "....DDd....",
  "....Dgd....",
  "....gGg....",
  "...GGGGg...",
  "...GGGGg...",
  "..GGGGGGg..",
  "..GGGGGGg..",
  ".GGGGGGGGg.",
  ".ggggggggg.",
  ".....g.....",
  "....gGg....",
]);

const banner = prop([
  "...D..DDDDDDDDDD..d...",
  ".gDDDDDDDDDDDDDDDDDdg.",
  "...gGAAAAAAAaaaGg.....",
  "...gGLAAAAAAaaaGg.....",
  "...gGLAAAAAAaaaGg.....",
  "...gGLAAAAAAaaaGg.....",
  "...gGLAAAGAAaaaGg.....",
  "...gGLAAGGGaaaaGg.....",
  "...gGLAGGgGGaaaGg.....",
  "...gGLAGgAgGaaaGg.....",
  "...gGLAAAgaaaaaGg.....",
  "...gGLAAgggaaaaGg.....",
  "...gGLAAAAAAaaaGg.....",
  "...gGLAAAAAAaaaGg.....",
  "...gGLAaAAAAaaaGg.....",
  "...gGAa..Aa..aaGg.....",
  "...ggg.......ggg.....",
  "...g...........g.....",
]);

const lanternMetal = [
  ".kkk....",
  ".kjkk...",
  "...kkk..",
  "...jkj..",
  "..jkkjk.",
  ".jGGGGkk",
  ".jGGGGkk",
  ".jGGGGkk",
  "..kkkkk.",
  "...kgk..",
];
const lantern = [
  [],
  ["", "", "", "", "", "....X", "...X"],
  ["", "", "", "", "", "", "....X", "...X"],
].map((light) => prop(lanternMetal, light));

const door = prop(
  [
    "......jjjjjj......",
    "....jjkkkkkkjj....",
    "...jjkDDDDDdkjk...",
    "..jjDDDDDDDDdkjk..",
    ".jjkDDDDdDDDDdkjk.",
    ".jkDDDDddDDDDddjk.",
    "jjkDDDdDDdDDDddkjk",
    "jkDDDDdDDdDDDDdkjk",
    "jkDkDDdDDdDDDDdkjk",
    "jkjkjDdDDdDDDDdkjk",
    "jjGGGkDDdDDDDDdkjk",
    "jjGGGkDDdDDDDDdkjk",
    "jkjkkDdDDdDDDDdkjk",
    "jkdkDDdDDdDDDDdkjk",
    "jkDDDDdDDdDDDDdkjk",
    "jkMMMmmmmmmmmmMkjk",
    "jkmMMmmmmmmmmmMkjk",
    "jkDDDDdDDdDDDDdkjk",
    "jkDDDDdDDdDGgDdkjk",
    "jkDDDDdDDdDggDdkjk",
    "jkDDDDdDDdDDDDdkjk",
    "jkDDDDdDDdDDDDdkjk",
    "jkMMMmmmmmmmmmMkjk",
    "jkmMMmmmmmmmmmMkjk",
    "jkdddddddddddddkjk",
    "jjjjjjjjjjjjjjjjjk",
  ],
  [...Array<string>(10).fill(""), "...X"],
);

const receptionDesk = prop([
  ".................................gGg.......",
  "....WWWW.WWw......................G........",
  "....WDDWWWWw......................g........",
  "...wwwwwwwww....................ggggg......",
  "..DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD..",
  ".DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDd",
  ".dddddddddddddddddddddddddddddddddddddddddd",
  "...DDddDDDDdddDDDDDDDDDDDDdddDDDDddDDd....",
  "...DDd.DDDDd..DDDDDDDDDDDDd..DDDDd.DDd....",
  "...DDd.DDDDd..DDDAAAAaaaDDd..DDDDd.DDd....",
  "...DDd.DDDDd..DDDALAAaaaDDd..DDDDd.DDd....",
  "...DDd.DDDDd..DDDALGGaaaDDd..DDDDd.DDd....",
  "...DDd.DDDDd..DDDAGGgaaaDDd..DDDDd.DDd....",
  "...DDd.DDDDd..DDDAAAAAaaDDd..DDDDd.DDd....",
  "...DDd.ddddd..DDDaaaaaaaDDd..ddddd.DDd....",
  "...DDddDDDDdddDDDDDDDDDDDDdddDDDDddDDd....",
  "..DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDd....",
  "..dddddddddddddddddddddddddddddddddddd....",
]);

const noticeBoard = prop([
  ".....D........................D.....",
  "....gGg......................gGg....",
  "..DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDd..",
  ".DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDdd.",
  "..DDdWWWWWWwwdddddddddWWWGWWwwDDd..",
  "..DDdWgWWWWWwddWWWWWWdWWWWWWWwDDd..",
  "..DDdWCCcWWWwddWGWWWwdWDDDDWWwDDd..",
  "..DDdWcCCcWWwddWDDWWwdWWWWWWWwDDd..",
  "..DDdWWWWWWWwddWWWWWwdWDDDWWWwDDd..",
  "..DDdWDDDWWWwddWDDWWwdWWWDWWWwDDd..",
  "..DDdWWWWWWWwddWDDWWwdWWWWWWWwDDd..",
  "..DDdWDddWWWwddWWWWwwdwwwwwwwwDDd..",
  "..DDdwwwwwwwwddwwwwwwdddddddddDDd..",
  ".DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDdd.",
  ".dddddddddddddddddddddddddddddddddd.",
]);

const rug = prop([
  "....gggggggggggggggggggggggggggggggggggggggggggggggggggg....",
  "...gAAAAaAaAaAaAaAaAaAaAaAAGGAAaAaAaAaAaAaAaAaAaAaAAAAag...",
  "..gAAAaAAAaAAAaAAAaAAAaAAGGGGGAAaAAAaAAAaAAAaAAAaAAAaAAg..",
  ".gAAAAAaAaAaAaAaAaAaAaAaAAGGAAaAaAaAaAaAaAaAaAaAaAAAAAAag.",
  "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg",
  "g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.",
]);

export interface PropArt {
  readonly frames: readonly PropLayer[];
  readonly frameMs?: number;
}

export const PROPS = {
  hearth: { frames: hearth, frameMs: 260 },
  longTable: { frames: [longTable] },
  bench: { frames: [bench] },
  stool: { frames: [stool] },
  workTable: { frames: [workTable] },
  questBoard: { frames: [questBoard] },
  bell: { frames: [bell] },
  banner: { frames: [banner] },
  lantern: { frames: lantern, frameMs: 350 },
  door: { frames: [door] },
  receptionDesk: { frames: [receptionDesk] },
  noticeBoard: { frames: [noticeBoard] },
  rug: { frames: [rug] },
} satisfies Record<string, PropArt>;

export type PropId = keyof typeof PROPS;

export const ROOM_PROPS = {
  guild_hall: [
    "hearth",
    "longTable",
    "bench",
    "stool",
    "workTable",
    "questBoard",
    "bell",
    "banner",
    "lantern",
    "door",
  ],
  recruitment_hall: ["receptionDesk", "noticeBoard", "banner", "rug", "door"],
} as const satisfies Record<string, readonly PropId[]>;
