import { Matrix4, Scene } from 'three';

// glTF deforms a skin in joint space, ignoring its node's own transform.
// Keep the armature and rigid pieces under their common scale, and put skins
// at scene level. Bake the mirrored hand's bind pose and winding together.
export function makeExportScene(model) {
  const scene = new Scene(); scene.add(model);
  const skins = [], identity = new Matrix4();
  model.traverse(o => { if (o.isSkinnedMesh) skins.push(o); });
  for (const mesh of skins) {
    if (!mesh.bindMatrix.equals(identity)) {
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.applyMatrix4(mesh.bindMatrix);
      if (mesh.bindMatrix.determinant() < 0) {
        const indices = mesh.geometry.index.array;
        for (let i = 0; i < indices.length; i += 3) [indices[i+1], indices[i+2]] = [indices[i+2], indices[i+1]];
      }
      mesh.bindMatrix.identity();
    }
    mesh.position.set(0,0,0); mesh.quaternion.identity(); mesh.scale.setScalar(1);
    scene.add(mesh);
  }
  model.scale.setScalar(0.0017);
  scene.updateMatrixWorld(true);
  return scene;
}
