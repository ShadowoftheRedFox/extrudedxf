import { Injectable } from '@angular/core';
import { Scene, PerspectiveCamera, WebGLRenderer, Mesh, Group } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

@Injectable({
  providedIn: 'root',
})
export class RendererService {
  scene!: Scene;
  camera!: PerspectiveCamera;
  controls!: OrbitControls;
  renderer!: WebGLRenderer;
  groundMesh!: Mesh;

  renderGroup: Group = new Group();

  constructor() {}

  import: any;
  backgroundImage: any;
}
