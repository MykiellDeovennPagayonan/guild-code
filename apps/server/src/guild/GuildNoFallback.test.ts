import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

it.effect("keeps Guild launch sources independent of T3 model fallback", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const roots = [
      import.meta.dirname,
      path.resolve(import.meta.dirname, "../../../../packages/guild-core/src"),
    ];
    for (const root of roots) {
      const entries = yield* fs.readDirectory(root, { recursive: true });
      for (const entry of entries.filter(
        (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
      )) {
        const source = yield* fs.readFileString(path.join(root, entry));
        assert.notMatch(
          source,
          /\b(?:resolveNewThreadModelSelection|fallbackModelSelection)\b/,
          entry,
        );
      }
    }
  }).pipe(Effect.provide(NodeServices.layer)),
);
