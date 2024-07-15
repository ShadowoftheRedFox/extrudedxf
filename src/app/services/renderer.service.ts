import { Injectable } from '@angular/core';
import { Scene, PerspectiveCamera, WebGLRenderer, Mesh, Group, Object3D, Object3DEventMap, Line, Box3Helper } from 'three';

export interface LignePerspective {
  id: number,
  ligne: Line;
  pointA: Mesh;
  pointB: Mesh;
  box?: Box3Helper;
  group: Object3D
  axe: string;
}

@Injectable({
  providedIn: 'root',
})
export class RendererService {
  scene!: Scene;
  camera!: PerspectiveCamera;
  renderer!: WebGLRenderer;
  groundMesh!: Mesh;

  perspectiveLines: LignePerspective[] = [];

  renderGroup: Group = new Group();

  constructor() { }

  import!: Group<Object3DEventMap>;
  backgroundImage: any;
}
