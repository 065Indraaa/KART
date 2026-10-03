import { RaceManager } from "./race/RaceManager";
import Flames from "./particles/drift/flames/Flames";
import { Track } from "./models/Mario-circuit-test";
import TropicalEnvironment from "./misc/TropicalEnvironment";
import { ObjectVFX } from "./objects/ObjectVFX";

export const TrackScene = () => {
  return (
    <>
      <RaceManager />
      <Track />

      <TropicalEnvironment />
      <ObjectVFX />

      <Flames />
    </>
  );
};
