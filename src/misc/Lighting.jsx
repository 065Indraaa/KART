import { Environment, Lightformer, Sky } from "@react-three/drei";
import { useRef } from "react";
import { useGameStore } from "../store";
import { useFrame } from "@react-three/fiber";
import { EnvironmentSphere } from "./EnvironmentSphere";
import { Helper } from "@react-three/drei";
import { CameraHelper } from "three";
import { palette } from "../theme";

export const Lighting = () => {
  const directionalLight = useRef(null)
  
  useFrame(() => {

        const playerPosition = useGameStore.getState().playerPosition;
        if (!playerPosition && !directionalLight.current) return;
    
        if(playerPosition){
        directionalLight.current.position.x = playerPosition.x + 2;
        directionalLight.current.target.position.x = playerPosition.x;
    
        directionalLight.current.position.y = playerPosition.y + 5;
        directionalLight.current.target.position.y = playerPosition.y;
    
        directionalLight.current.position.z = playerPosition.z + 2 ;
        directionalLight.current.target.position.z = playerPosition.z;
    
        directionalLight.current.target.updateMatrixWorld();
        }
  })
  
  return (
    <>
      {/* Warm tropical key light + player-following shadow camera. */}
      <directionalLight
            castShadow
            ref={directionalLight}
            position={[0, 0, 0]}
            intensity={3.2}
            color={"#fff1d6"}
            shadow-bias={-0.0001}
            shadow-mapSize={[2048, 2048]}
            // layers={1}
            
          >
            <orthographicCamera
              attach="shadow-camera"
              near={1}
              far={20}
              top={5}
              left={-5}
              right={5}
              bottom={-5}
            >
              {/* <Helper type={CameraHelper} /> */}
            </orthographicCamera>
          </directionalLight>

          {/* Soft sky/sand fill so shadows stay open and readable (no extra shadow map). */}
          <hemisphereLight
            args={[palette.skyHorizon, palette.sand, 0.6]}
          />

          <EnvironmentSphere />
    </>
  );
};
