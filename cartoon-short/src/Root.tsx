import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { GradesShort, GRADES_FRAMES } from "./videos/grades/Grades";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="GradesShort" component={GradesShort} durationInFrames={GRADES_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
