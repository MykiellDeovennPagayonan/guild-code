import type { Appearance } from "./appearance.ts";
import { Layer, RI, RX, RY, dilate, widen, type Point } from "./frame.ts";
import { getPart } from "./parts/registry.ts";
import { REFERENCE_WEAPON_COUNT, WEAPONS } from "./parts/weapons.ts";
import { FX, LIFT, POSE_DEF, type Foot, type Pose } from "./poses.ts";

const STOW_Y = -8;

export function buildParts(cfg: Appearance) {
  const head = getPart("head", cfg.head),
    top = getPart("top", cfg.top),
    face = getPart("face", cfg.face),
    outfit = getPart("outfit", cfg.outfit);
  const boots = getPart("boots", cfg.boots),
    back = getPart("back", cfg.back),
    weapon = getPart("weapon", cfg.weapon),
    species = getPart("species", cfg.species);
  const B = species.build || 0;
  /* head + metrics */
  const hf = new Layer().put(head.p, 0, 0);
  const mask = hf.clone();
  let minY = 0;
  const Ls: Record<number, number> = {},
    Rs: Record<number, number> = {};
  for (let y = -RY; y < 0; y++) {
    let l = null,
      r = null;
    for (let x = -RX; x < RX; x++)
      if (hf.get(x, y)) {
        if (l === null) l = x;
        r = x;
      }
    if (l !== null && r !== null) {
      Ls[y] = l;
      Rs[y] = r;
      if (y < minY) minY = y;
    }
  }
  const topY = head.crown !== undefined ? head.crown : minY;
  const clampY = (y: number) => Math.max(topY, Math.min(-1, y));
  const shells: Record<number, Layer> = {};
  hf.put(face.p, head.face[0], head.face[1]);
  const metrics = {
    top: topY,
    fx: head.face[0],
    fy: head.face[1],
    brow: head.face[1] - 2,
    mask,
    L: (y: number) => Ls[clampY(y)]!,
    R: (y: number) => Rs[clampY(y)]!,
    shell: (n: number) => shells[n] || (shells[n] = dilate(mask, n)),
  };
  // Species marks read head metrics before the finished outline exists.
  species.marks?.(metrics, hf);
  const solid = hf.clone().outline();
  const hd = { ...metrics, solid };
  const T = { far: new Layer(), back: new Layer(), front: new Layer() };
  top.make(hd, T);
  /* hat back, species ears / fins, head + face, hat front, then anything that pokes out in front */
  const headL = new Layer().blit(T.back, 0, 0);
  if (species.back) {
    const sb = new Layer();
    species.back(hd, sb);
    headL.blit(sb.outline(), 0, 0);
  }
  headL.blit(solid, 0, 0).blit(T.front, 0, 0);
  if (species.front) headL.merge(species.front(hd), 0, 0);
  const tail = species.tail ? new Layer().put(species.tail, 0, 0).outline() : null;
  const torso = new Layer().put(B ? widen(outfit.p) : outfit.p, 0, outfit.bottom).outline();
  let behind = null;
  if (outfit.behind && outfit.behindAt)
    behind = new Layer().put(outfit.behind, outfit.behindAt[0] - B, outfit.behindAt[1]).outline();
  /* back accessory variants */
  const backs = back.v.map((v) => {
    const l = new Layer().put(v, 0, 0);
    if (back.mirror) l.put(v, 0, 0, { flip: true });
    return l.outline();
  });
  const weap: Layer[] = [];
  const legacyWeapon = WEAPONS.indexOf(weapon) < REFERENCE_WEAPON_COUNT;
  for (let d = 0; d < 8; d++) {
    const layer = new Layer().put(d % 2 ? weapon.ne : weapon.n, 0, 0, { rot: d >> 1 }).outline();
    // Downward legacy stamps already crop at the bottom of the reference's grip-centered layer.
    if (legacyWeapon && d >= 3 && d <= 5) layer.clipped = false;
    weap.push(layer);
  }
  const stowedWeapon = new Layer().put(weapon.ne, 0, STOW_Y, { rot: 2 }).outline();
  return {
    cfg,
    outfit,
    boots,
    back,
    backs,
    headL,
    headFar: T.far,
    torso,
    behind,
    weap,
    stowedWeapon,
    tail,
    build: B,
    fist: species.fist || 0,
    legMap: { [RI.P]: RI[outfit.leg] },
  };
}

type Parts = ReturnType<typeof buildParts>;

export function armLayer(
  parts: Parts,
  sx: number,
  sy: number,
  hx: number,
  hy: number,
  near: boolean,
) {
  const o = parts.outfit,
    l = new Layer();
  const n = Math.max(Math.abs(hx - sx), Math.abs(hy - sy));
  const sl = RI[o.sleeve],
    sk = RI.S;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(sx + (hx - sx) * (n ? i / n : 0)),
      y = Math.round(sy + (hy - sy) * (n ? i / n : 0));
    const c = i < o.sleeveLen ? sl : sk;
    if (o.bulky && i < n && i < o.sleeveLen) l.rect(x - (near ? 1 : 0), y, 3, 2, c);
    else l.rect(x, y, 2, 2, c);
  }
  if (near && o.sleeveHi && o.sleeveLen > 0) l.set(sx, sy, RI[o.sleeveHi]);
  if (parts.fist) l.rect(hx - (near ? 1 : 0), hy, 3, 2, RI[o.hand]);
  else l.rect(hx, hy, 2, 2, RI[o.hand]);
  if (near && o.pad) l.put(o.pad, sx, sy);
  return l.outline();
}
export function legLayer(parts: Parts, hipX: number, hipY: number, foot: Foot) {
  const l = new Layer(),
    c = RI[parts.outfit.leg];
  const topY = foot[1] - 1;
  for (let y = hipY + 1; y < topY; y++) {
    const t = (y - hipY) / (topY - hipY);
    const x = Math.round(hipX + (foot[0] - hipX) * t);
    l.rect(x - 1, y, 2, 1, c);
  }
  l.put(parts.boots.v[foot[2]], foot[0], foot[1], { map: parts.legMap });
  return l.outline();
}

/* compose one pose into a frame layer; also returns the anchors used */
export interface Anchors {
  readonly root: Point;
  readonly head: Point;
  readonly handN: Point;
  readonly handF: Point;
  readonly back: Point;
  readonly footN: Foot;
  readonly footF: Foot;
}

export function composeFrame(parts: Parts, pose: Pose): { layer: Layer; anchors: Anchors } {
  const out = new Layer();
  const bx = pose.b[0],
    by = pose.b[1] + LIFT;
  const hx = bx + pose.h[0],
    hy = by - 10 + pose.h[1];
  const B = parts.build,
    nB = pose.sN === POSE_DEF.sN ? B : 0; // an arm reaching across the body keeps its pose
  const nH: Point = [bx + pose.hN[0] - nB, by + pose.hN[1]],
    fH: Point = [bx + pose.hF[0] + B, by + pose.hF[1]];
  const nS: Point = [bx + pose.sN[0] - nB, by + pose.sN[1]],
    fS: Point = [bx + pose.sF[0] + B, by + pose.sF[1]];
  const fN: Foot = [pose.fN[0] - B, pose.fN[1], pose.fN[2]],
    fF: Foot = [pose.fF[0] + B, pose.fF[1], pose.fF[2]];
  const bk = parts.backs[Math.min(parts.backs.length - 1, parts.back.pick(pose.cape))]!;
  const back: Point = [bx - 5 - B, by - 8];
  out.blit(bk, bx - B, by); // back accessory
  if (parts.tail) out.blit(parts.tail, bx - B, by); // species tail
  out.blit(parts.headFar, hx, hy); // long hair behind the body
  if (parts.behind) out.blit(parts.behind, bx, by);
  const wl = pose.w === -1 || pose.stow ? undefined : parts.weap[pose.w];
  if (pose.stow && pose.w !== -1) out.blit(parts.stowedWeapon, back[0], back[1] - STOW_Y);
  else if (wl && !pose.wz) out.blit(wl, nH[0], nH[1]);
  out.blit(armLayer(parts, fS[0], fS[1], fH[0], fH[1], false), 0, 0); // far arm
  out.blit(legLayer(parts, bx + 2 + B, by - 5, fF), 0, 0); // far leg
  out.blit(legLayer(parts, bx - 2 - B, by - 5, fN), 0, 0); // near leg
  out.blit(parts.torso, bx, by); // torso
  out.blit(parts.headL, hx, hy); // hat back + head + face + hat front
  if (pose.fx) out.put(FX[pose.fx], 0, 0); // slash
  if (wl && pose.wz) out.blit(wl, nH[0], nH[1]); // weapon
  out.blit(armLayer(parts, nS[0], nS[1], nH[0], nH[1], true), 0, 0); // near arm + hand over the grip
  return {
    layer: out,
    anchors: { root: [0, 0], head: [hx, hy], handN: nH, handF: fH, back, footN: fN, footF: fF },
  };
}
