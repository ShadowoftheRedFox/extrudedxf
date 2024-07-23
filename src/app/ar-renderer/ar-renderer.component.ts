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

  container!: HTMLElement;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  defaultLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  xrLight = new XREstimatedLight(this.renderer);
  controller = this.renderer.xr.getController(0);

  hitTestSource: XRHitTestSource | null = null;
  hitTestSourceRequested = false;

  reticule!: THREE.Mesh;

  moveCount = 0;
  moving = false;
  moveThreshold = 10;

  constructor() { }

  ngAfterViewInit(): void {
    this.container = this.rendererContainer.nativeElement;
    this.initThree();
    this.populate(false);
  }

  initThree() {
    // caméra classique et lumière hémisphère
    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 20);
    this.defaultLight.position.set(0.5, 1, 0.25);

    // crée le réticule qui sera affiché là ou on vise dans le monde réel
    this.reticule = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.2, 32).rotateX(- Math.PI / 2),
      new THREE.MeshBasicMaterial()
    );
    this.reticule.matrixAutoUpdate = false;
    this.reticule.visible = false;

    this.scene.add(this.defaultLight, this.camera, this.reticule, this.controller);

    // indique que l'on va utilisé de l'AR ou VR
    this.renderer.xr.enabled = true;
    // mets la taille et le ratio de pixel
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.container.appendChild(this.renderer.domElement);

    // on ajoute l'estimation de la lumière uniquement quand la session débute
    this.xrLight.addEventListener('estimationstart', () => {
      // échange la lumière par défault et celle estimée
      this.scene.add(this.xrLight);
      this.scene.remove(this.defaultLight);

      // la lumière estimé propose un environnement qu'on applique ici
      if (this.xrLight.environment) {
        this.scene.environment = this.xrLight.environment;
      }
    });

    this.xrLight.addEventListener('estimationend', () => {
      // échange les lumières à nouveau à la fin de la session
      this.scene.add(this.defaultLight);
      this.scene.remove(this.xrLight);
      // remet l'environnement pas défaut
      this.scene.environment = null;
    });

    // crée l'instance de AR avec les options
    document.body.appendChild(ARButton.createButton(this.renderer,
      {
        optionalFeatures: [
          'light-estimation', // estime la lumière en AR
          'hit-test',         // permet de lancer des raycast dans le monde réelle
          'dom-overlay',      // indique qu'il y aura du html par dessus l'AR
        ]
      }
    ));

    // TEST -------------------------------------------------------------------------------
    // const geometry = new THREE.CylinderGeometry(0, 0.05, 0.2, 32).rotateX(Math.PI / 2);

    // this.controller.addEventListener('select', () => {
    //   const material = new THREE.MeshPhongMaterial({ color: 0xffffff * Math.random() });
    //   const mesh = new THREE.Mesh(geometry, material);
    //   mesh.position.set(0, 0, - 0.3).applyMatrix4(this.controller.matrixWorld);
    //   mesh.quaternion.setFromRotationMatrix(this.controller.matrixWorld);
    //   this.scene.add(mesh);
    // });

    // this.renderer.setAnimationLoop(() => {
    //   this.renderer.render(this.scene, this.camera);
    // });

    // TEST END ---------------------------------------------------------------------------

    // on écoute les selections (équivalent à mouseup)
    this.controller.addEventListener("select", (data) => {
      // si c'est un clique et non un movement
      if (this.reticule.visible && !this.moving) {
        // positionne l'objet sur le réticule
        if (this.scene.getObjectByName(this.renderGroup.name)) {
          this.renderGroup.position.setFromMatrixPosition(this.reticule.matrix)
        };
        if (this.scene.getObjectByName("ballGroup") != undefined) {
          this.scene.getObjectByName("ballGroup")?.position.setFromMatrixPosition(this.reticule.matrix)
        };

        console.log("update position");
        // console.log("vect direction: ", new THREE.Vector3().subVectors(new THREE.Vector3().setFromMatrixPosition(this.reticule.matrix), this.controller.position));
      }
      this.moveCount = 0;
      this.moving = false;
    });

    // écoute pour les movements
    this.controller.addEventListener("move", (data) => {
      this.moveCount++;
      if (this.moveCount > this.moveThreshold) {
        this.moving = true;
        // TODO rotation
      }
    });

    // lance l'animation
    this.renderer.setAnimationLoop((timestamp: number, frame?: XRFrame) => {
      // affiche le context seulement en AR
      if (this.renderer.xr.isPresenting) {
        if (frame && this.moveCount > 0) {
          // récupère le point visé
          this.XRHitTest(this.renderer, frame,
            (hitPoseTransformed: Float32Array) => {
              if (hitPoseTransformed) {
                // affiche le réticule au bon endroit
                this.reticule.visible = true;
                this.reticule.matrix.fromArray(hitPoseTransformed);
              }
            },
            () => {
              // cache le réticule si pas de point trouvé
              this.reticule.visible = false;
            })
        }

        // lance le rendu
        this.renderer.render(this.scene, this.camera);
      }
    });
  }

  // re dimensionne corectement si changements de taille
  @HostListener('window:resize')
  onWindowResize() {
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  // ajoute soit la pergola, soit un objet créé
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

      ballGroup.name = "ballGroup"

      this.scene.add(ballGroup);

      this.controller.addEventListener('select', () => {
        ballGroup.position.set(0, 0, - 2).applyMatrix4(this.controller.matrixWorld);
        ballGroup.quaternion.setFromRotationMatrix(this.controller.matrixWorld);
      });
      this.scene.add(this.controller);
    } else {
      const scaleDown = 1
      this.renderGroup.scale.set(scaleDown, scaleDown, scaleDown);
      this.scene.add(this.renderGroup);
      this.renderGroup.position.set(0, 0, -scaleDown * 5);
    }
  }

  // calcule le point visé dans la réalité
  XRHitTest(
    renderer: THREE.WebGLRenderer,
    frame: XRFrame,
    onHitTestResultReady: (hitPoseMatrix: Float32Array) => void,
    onHitTestResultEmpty: () => void,
  ) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = frame.session;

    let xrHitPoseMatrix: Float32Array | null | undefined;

    if (this.hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then((referenceSpace) => {
        if (session.requestHitTestSource) {
          session
            ?.requestHitTestSource({ space: referenceSpace })
            ?.then((source) => {
              this.hitTestSource = source;
            });
        }
      });

      session.addEventListener('end', () => {
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
      });

      this.hitTestSourceRequested = true;
    }

    if (this.hitTestSource) {
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);

      if (hitTestResults.length) {
        const hit = hitTestResults[0];

        if (hit && hit !== null && referenceSpace) {
          const xrHitPose = hit.getPose(referenceSpace);

          if (xrHitPose) {
            xrHitPoseMatrix = xrHitPose.transform.matrix;
            return onHitTestResultReady(xrHitPoseMatrix);
          } else {
            console.warn("Pas de xrhitpose");
          }
        } else {
          console.warn("Pas de hit/ref");
        }
      } else {
        console.warn("Pas de array member");
      }
    } else {
      console.warn("Pas de source");
    }
    return onHitTestResultEmpty();
  }

  get width() { return this.container.offsetWidth; }
  get height() { return this.container.offsetHeight; }
  get renderGroup() { return this.service.renderGroup; }
}
