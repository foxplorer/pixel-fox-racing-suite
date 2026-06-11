/// <reference types="vite/client" />
/// <reference types="@react-three/fiber" />
/// <reference types="node" />

declare module '*.mp3' {
  const src: string
  export default src
}

declare namespace JSX {
  interface IntrinsicElements {
    ambientLight: any
    boxGeometry: any
    bufferAttribute: any
    bufferGeometry: any
    circleGeometry: any
    color: any
    coneGeometry: any
    cylinderGeometry: any
    directionalLight: any
    fog: any
    group: any
    instancedMesh: any
    mesh: any
    meshBasicMaterial: any
    meshStandardMaterial: any
    object3D: any
    planeGeometry: any
    pointLight: any
    points: any
    pointsMaterial: any
    spotLight: any
  }
}
