import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  ViewChild,
  inject,
} from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { RendererService } from '../services/renderer.service';
import * as THREE from 'three';
import { ARButton, RGBELoader, XREstimatedLight } from 'three/examples/jsm/Addons'
import { RouterModule } from '@angular/router';
import { Actions, ConfigService } from '../services/config.service';


@Component({
  selector: 'ft-ar-renderer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ar-renderer.component.html',
  styleUrl: './ar-renderer.component.scss'
})
export class ArRendererComponent implements AfterViewInit {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef<HTMLElement>;

  service = inject(RendererService);
  config = inject(ConfigService);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
  defaultLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  xrLight = new XREstimatedLight(this.renderer);
  controller = this.renderer.xr.getController(0);
  container!: HTMLElement;

  constructor(private ngZone: NgZone) { }

  ngAfterViewInit(): void {
    this.container = this.rendererContainer.nativeElement;
    this.initThree();
    this.populate(false);
  }

  initThree() {
    this.defaultLight.position.set(0.5, 1, 0.25);
    this.scene.add(this.defaultLight);

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Don't add the XREstimatedLight to the scene initially.
    // It doesn't have any estimated lighting values until an AR session starts.
    this.xrLight.addEventListener('estimationstart', () => {
      // Swap the default light out for the estimated one one we start getting some estimated values.
      this.scene.add(this.xrLight);
      this.scene.remove(this.defaultLight);

      // The estimated lighting also provides an environment cubemap, which we can apply here.
      if (this.xrLight.environment) {
        this.scene.environment = this.xrLight.environment;
      }
    });

    this.xrLight.addEventListener('estimationend', () => {
      // Swap the lights back when we stop receiving estimated values.
      this.scene.add(this.defaultLight);
      this.scene.remove(this.xrLight);
      // Revert back to the default environment.
      this.scene.environment = null;
    });

    // In order for lighting estimation to work, 'light-estimation' must be included as either an optional or required feature.
    document.body.appendChild(ARButton.createButton(this.renderer, { optionalFeatures: ['light-estimation', 'anchors', 'hit-test'] }));

    this.renderer.setAnimationLoop((timestamp: number, frame?: XRFrame) => {
      // Only render content if XR view is presenting.
      if (this.renderer.xr.isPresenting) {
        this.renderer.render(this.scene, this.camera);
      }
    });
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  populate(placeholders = true) {
    if (placeholders) {
      const ballGeometry = new THREE.SphereGeometry(0.175, 32, 32);
      const ballGroup = new THREE.Group();
      ballGroup.position.z = - 2;

      const rows = 3;
      const cols = 3;

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const ballMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: i / rows,
            metalness: j / cols
          });
          const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
          ballMesh.position.set((i + 0.5 - rows * 0.5) * 0.4, (j + 0.5 - cols * 0.5) * 0.4, 0);
          ballGroup.add(ballMesh);
        }
      }

      this.scene.add(ballGroup);

      this.controller.addEventListener('select', () => {
        ballGroup.position.set(0, 0, - 2).applyMatrix4(this.controller.matrixWorld);
        ballGroup.quaternion.setFromRotationMatrix(this.controller.matrixWorld);
      });
      this.scene.add(this.controller);
    } else {
      this.scene.add(this.renderGroup);
      this.renderGroup.position.set(0, 0, -10);
      this.controller.addEventListener('select', () => {
        this.renderGroup.position.set(0, 0, - 10).applyMatrix4(this.controller.matrixWorld);
        this.renderGroup.quaternion.setFromRotationMatrix(this.controller.matrixWorld);
      });
      this.scene.add(this.controller);
    }
  }

  get width() { return this.container.offsetWidth; }
  get height() { return this.container.offsetWidth; }
  get renderGroup() { return this.service.renderGroup; }
}
