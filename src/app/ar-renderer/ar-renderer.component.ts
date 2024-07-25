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
import { ARButton, ConvexObjectBreaker, RGBELoader, XREstimatedLight } from 'three/examples/jsm/Addons'
import { RouterModule } from '@angular/router';
import { Actions, ConfigService } from '../services/config.service';
import { degToRad } from 'three/src/math/MathUtils';
import { MatIconModule } from '@angular/material/icon';


@Component({
  selector: 'ft-ar-renderer',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './ar-renderer.component.html',
  styleUrl: './ar-renderer.component.scss'
})
export class ArRendererComponent implements AfterViewInit {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef<HTMLElement>;

  service: RendererService = inject(RendererService);
  config: ConfigService = inject(ConfigService);

  // container pour Three JS
  container!: HTMLElement;
  // container lors du mode AR
  ARContainer: HTMLDivElement | null = null;

  renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  scene: THREE.Scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  defaultLight: THREE.HemisphereLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  // lumière AR qui émule dans la scene Three JS la lumière réelle ambiente
  xrLight: XREstimatedLight = new XREstimatedLight(this.renderer);
  // le controller (une manette par exemple), ici, émule les interactions des touchés
  controller: THREE.XRTargetRaySpace = this.renderer.xr.getController(0);

  // variables pour calculer la position réelle d'une surface réelle et avoir sa position (et rotation) dans la scene Three JS
  hitTestSource: XRHitTestSource | null = null;
  hitTestSourceRequested: boolean = false;

  // affichage du point calculer avec les deux variables ci dessus
  reticule!: THREE.Mesh;

  // pour différencier un touché d'un maintient
  moveCount: number = 0;
  moving: boolean = false;
  // à partir de combien d'événement "touché" est-ce que l'on considère que c'est un maintient
  moveThreshold: number = 10;

  // position du premier click sur l'écran
  pointerStart: THREE.Vector2 = new THREE.Vector2();
  // position du click le plus récent sur l'écran
  pointerCurrent: THREE.Vector2 = new THREE.Vector2();
  // direction entre le pointerStart et pointerCurrent
  pointerDirection: THREE.Vector2 = new THREE.Vector2();

  // position de la caméra "réelle" dans la scene Three JS
  // on fera suivre ces propriété à la caméra de Three JS
  viewPos: XRViewerPose | undefined = undefined;

  // pour redimmensionner la pergola pors des tests
  // objectScale = 1; // taille réelle
  objectScale: number = 0.08; // taille bureau
  currentScale: number = this.objectScale;

  // un raycast utilisé pour tirer entre la caméra et un objet
  raycast: THREE.Raycaster = new THREE.Raycaster();

  // intervalles pour les boutons en mode AR
  // car on a seulement le touchDown et touchUp
  rotateLeft: any = null;
  rotateRight: any = null;
  scaleDown: any = null;
  scaleUp: any = null;

  // session AR en cours pour pouvoir la fermer à tout moment
  ARSession: XRSession | null = null;
  // la croix pour quitter la session ne fonctionne plus, donc met une écoute nous même
  ARSVGListener: boolean = false;

  // plan parallèle à l'écran réel dans Three JS
  selectionPlane: THREE.Plane | null = null;
  // si on a sélectionné l'objet
  selection: boolean = false;
  selectionPlaneHelper: THREE.PlaneHelper | null = null;

  constructor() { }

  ngAfterViewInit(): void {
    this.container = this.rendererContainer.nativeElement;
    this.initThree();
    this.populate(false);
    this.eventListen();
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

    // on écoute les selections (équivalent à mouseup)
    this.controller.addEventListener("select", (data) => {
      // si c'est un clique et non un movement
      if (this.reticule.visible && !this.moving) {
        // positionne l'objet sur le réticule
        this.object.position.setFromMatrixPosition(this.reticule.matrix)

        // console.log("update position");
      }
      this.moveCount = 0;
      this.moving = false;
    });

    // écoute pour les movements
    this.controller.addEventListener("move", (data) => {
      this.moveCount++;
      if (this.moveCount > this.moveThreshold) {
        this.moving = true;
      }
    });

    // lance l'animation
    this.renderer.setAnimationLoop((timestamp: number, frame?: XRFrame) => {
      // affiche le context seulement en AR
      if (this.renderer.xr.isPresenting) {
        if (frame && !this.moving) {
          // dans le cas où l'on veut arreter la session, retient la session
          if (!this.ARSession) {
            this.ARSession = frame.session;
          }
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

        // récupère l'élément où s'affiche l'AR
        if (this.ARContainer == null) {
          const els = Array.from(document.body.children);
          // console.log(els[els.length - 1]);
          if (els.length) {
            this.ARContainer = els[els.length - 1] as HTMLDivElement;
            this.setupARButton();
          }
        }

        // rajoute une écoute pour fermer la session
        if (!this.ARSVGListener && this.ARContainer && this.ARContainer.getElementsByTagName("svg").length > 0 && this.ARSession) {
          this.ARContainer.getElementsByTagName("svg")[0].addEventListener("click", (e) => {
            this.AREnd();
          });
          this.ARSVGListener = true;
        }

        // lance le rendu
        this.renderer.render(this.scene, this.camera);
      } else {
        // si on est pas en AR, alors on vois le bouton, qu'on stylise
        //* ça spam fort ici, changer d'endroit?
        this.customARButton();
      }
    });
  }

  // fonction qu'on appel quand on quitte avec la croix
  AREnd() {
    // remet à 0 les paramètres qui doivent l'être
    this.ARSession?.end();
    this.ARSession = null;
    this.ARSVGListener = false;

    document.body.style.touchAction = "auto";

    clearInterval(this.rotateLeft);
    this.rotateLeft = null;
    clearInterval(this.rotateRight);
    this.rotateRight = null;
    clearInterval(this.scaleDown);
    this.scaleDown = null;
    clearInterval(this.scaleUp);
    this.scaleUp = null;
  }

  // quand on détecte qu'on est en mode AR, ajoute les boutons à l'élément qui affiche l'AR
  setupARButton() {
    if (!this.ARContainer) return;
    this.ARContainer.innerHTML += `
    <div class="ar_overlay_button middle left"
      onpointerup="window.dispatchEvent(new CustomEvent('rotateLeft', {detail: {clicked:false}}))"
      onpointerdown="window.dispatchEvent(new CustomEvent('rotateLeft', {detail: {clicked:true}}))">
      <span class="material-symbols-outlined">autorenew</span>
    </div>
    <div class="ar_overlay_button middle right"
      onpointerup="window.dispatchEvent(new CustomEvent('rotateRight', {detail: {clicked: false}}))"
      onpointerdown="window.dispatchEvent(new CustomEvent('rotateRight', {detail: {clicked:true}}))">
      <span class="material-symbols-outlined">sync</span>
    </div>
    <div class="ar_overlay_button bottom left"
      onpointerup="window.dispatchEvent(new CustomEvent('scaleDown', {detail: {clicked: false}}))"
      onpointerdown="window.dispatchEvent(new CustomEvent('scaleDown', {detail: {clicked:true}}))">
      <span class="material-symbols-outlined">remove</span>
    </div>
    <div class="ar_overlay_button bottom right"
      onpointerup="window.dispatchEvent(new CustomEvent('scaleUp', {detail: {clicked: false}}))"
      onpointerdown="window.dispatchEvent(new CustomEvent('scaleUp', {detail: {clicked:true}}))">
      <span class="material-symbols-outlined">add</span>
    </div>
    `;
  }

  // écoute les événements des boutons ajouter dans l'ARContainer, via des événements custom
  eventListen() {
    window.addEventListener("rotateLeft", (ev: any) => {
      if ((ev as CustomEvent).detail.clicked) {
        this.rotateLeft = setInterval(() => {
          this.object.rotateY(degToRad(-1));
          // console.log("rotateLeft?");
        }, 60);
      } else {
        clearInterval(this.rotateLeft);
        this.rotateLeft = null;
      }
      ev.preventDefault();
      ev.stopPropagation();
    });
    window.addEventListener("rotateRight", (ev: any) => {
      if ((ev as CustomEvent).detail.clicked) {
        this.rotateRight = setInterval(() => {
          this.object.rotateY(degToRad(1));
          // console.log("rotateRight?");
        }, 60);
      } else {
        clearInterval(this.rotateRight);
        this.rotateRight = null;
      }
      ev.preventDefault();
      ev.stopPropagation();
    });
    window.addEventListener("scaleDown", (ev: any) => {
      if ((ev as CustomEvent).detail.clicked) {
        this.scaleDown = setInterval(() => {
          this.currentScale -= this.objectScale / 30;
          if (this.currentScale < this.objectScale / 10) this.currentScale = this.objectScale / 10;
          this.object.scale.set(this.currentScale, this.currentScale, this.currentScale);
          // console.log("scaleDown?");
        }, 60);
      } else {
        clearInterval(this.scaleDown);
        this.scaleDown = null;
      }
      ev.preventDefault();
      ev.stopPropagation();
    });
    window.addEventListener("scaleUp", (ev: any) => {
      if ((ev as CustomEvent).detail.clicked) {
        this.scaleUp = setInterval(() => {
          this.currentScale += this.objectScale / 30;
          if (this.currentScale > this.objectScale * 10) this.currentScale = this.objectScale * 10;
          this.object.scale.set(this.currentScale, this.currentScale, this.currentScale);
          // console.log("scaleUp?");
        }, 60);
      } else {
        clearInterval(this.scaleUp);
        this.scaleUp = null;
      }
      ev.preventDefault();
      ev.stopPropagation();
    });
  }

  customARButton() {
    // il peut aussi s'afficher un message si le navigateur n'est pas compatible ou qu'on est pas en https
    if (!('xr' in navigator)) {
      const ARMessages = document.getElementsByTagName("a");
      if (ARMessages.length > 0) {
        let ARMessage = ARMessages[0];
        let found = false;
        Array.from(ARMessages).forEach(el => {
          if (
            !found &&
            (
              (el.innerHTML == "WEBXR NEEDS HTTPS" && el.href == document.location.href.replace(/^http:/, 'https:')) ||
              (el.innerHTML == "WEBXR NOT AVAILABLE" && el.href == "https://immersiveweb.dev/")
            )
          ) {
            ARMessage = el;
            found = true;
          }
        })
        if (found) {
          ARMessage.style.position = "absolute !important";
          ARMessage.style.bottom = "calc(50 % - 45px) !important";
          ARMessage.style.left = `50%`
          ARMessage.style.transform = `translate(-50%, -50%)`
          ARMessage.style.fontSize = "1.2rem";
          ARMessage.style.width = "";
          ARMessage.style.color = "red";
          ARMessage.style.borderColor = "red";
          ARMessage.style.opacity = "1";
          if (window.isSecureContext === false) {
            ARMessage.innerHTML == "Vous devez être dans un environnement sécurisé pour utilisé la réalité augmentée"
          } else {
            ARMessage.innerHTML == "Votre navigateur n'est pas compatible avec la réalité augmentée"
          }
        }
      }
    }
    // récupère le bouton AR dans le DOM
    const ARButton = document.getElementById("ARButton");
    if (!ARButton) return;
    // change le style en fonction du contenu
    // console.warn(ARButton.offsetWidth);
    switch (ARButton.textContent) {
      case 'START AR':
        ARButton.textContent = "Débuter la réalité augmentée";
        ARButton.style.opacity = "1";
        break;
      case 'AR NOT SUPPORTED':
        ARButton.textContent = "Réalité augmentée non supporté";
        ARButton.style.color = "red";
        ARButton.style.borderColor = "red";
        break;
      case 'AR NOT ALLOWED':
        ARButton.textContent = "Réalité augmentée non authorisé";
        ARButton.style.color = "red";
        ARButton.style.borderColor = "red";
        break;
      case 'STOP AR':
        ARButton.textContent = "Arrêter la réalité augmentée";
        ARButton.style.color = "red";
        ARButton.style.borderColor = "red";
        ARButton.style.opacity = "1";
        break;
      default:
        break;
    }
    ARButton.style.left = `50%`
    ARButton.style.transform = `translate(-50%, -50%)`
    ARButton.style.fontSize = "1.2rem";
    ARButton.style.width = "";
  }

  // re dimensionne corectement si changements de taille
  @HostListener('window:resize')
  onWindowResize() {
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  @HostListener('window:contextmenu', ['$event'])
  onContextMenu(event: PointerEvent) {
    // empeche des menus de s'afficher avec le touché
    event.preventDefault();
    // event.stopPropagation();
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent) {
    // empeche le document de récupérer l'événement
    document.body.style.touchAction = "none";
    // point du click en coordonnés centré, (0,0) est le centre de l'écran
    this.pointerCurrent.setX((event.clientX / this.rendererContainer.nativeElement.clientWidth) * 2 - 1);
    this.pointerCurrent.setY(-(event.clientY / this.rendererContainer.nativeElement.clientHeight) * 2 + 1);

    if (this.viewPos) {
      // copie les propriétés de la caméra AR à celle de Three JS
      ((a: number[]) => { this.camera.matrix.set(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15]) })(Array.from(this.viewPos.transform.matrix));
    }

    // à partir de là, on peut raycast de la caméra à la scène normalement
    this.setRaycast();
    // arrowhelper qui affiche le raycast
    // {
    //   if (this.scene.getObjectByName("arrowRC")) {
    //     this.scene.remove(this.scene.getObjectByName("arrowRC") as THREE.Object3D);
    //   }
    //   const arrowRC = new THREE.ArrowHelper(this.raycast.ray.direction, this.raycast.ray.origin, this.camera.position.distanceTo(this.object.position), 0x0000ff);
    //   arrowRC.name = 'arrowRC';
    //   this.scene.add(arrowRC);
    // }
    if (this.raycast.intersectObject(this.object).length && !this.selection) {
      // on a selectionné la pergola
      // crée un plan normal au vecteur pour deplacer la pergola parallèlement à l'écran
      this.selectionPlane = new THREE.Plane(this.raycast.ray.direction.reflect(new THREE.Vector3()), -this.camera.position.distanceTo(this.object.position));
      this.selection = true;

      // if (this.selectionPlaneHelper) {
      //   this.scene.remove(this.selectionPlaneHelper);
      // }
      // this.selectionPlaneHelper = new THREE.PlaneHelper(this.selectionPlane, 1, 0xff0000);
      // this.scene.add(this.selectionPlaneHelper)
    }

    if (this.selection && this.selectionPlane) {
      // on a un plan et le raycast, on peut savoir ou pointe le raycast sur le plan
      const pos = this.raycast.ray.intersectPlane(this.selectionPlane, new THREE.Vector3())
      if (pos) {
        // on bouge la pergola sur le point d'intersection
        this.object.position.copy(pos)
      }
    }
  }

  // on ne touche plus, remttre à 0
  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: PointerEvent) {
    this.pointerCurrent.set(0, 0);
    this.pointerStart.set(0, 0);
    this.pointerDirection.set(0, 0)
    this.selectionPlane = null;
    this.selection = false;
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
      const bb = new THREE.Box3().expandByObject(ballGroup);
      // const bbh = new THREE.Box3Helper(bb, 0xff0000);
      // bbh.visible = false;
      ballGroup.userData["bb"] = bb;
      // ballGroup.userData["bbh"] = bbh;
      // ballGroup.add(bbh);

      this.scene.add(ballGroup);
    } else {
      // re dimensionne l'objet et le pose selon cette dimension
      const scaleDown = this.objectScale;
      this.renderGroup.scale.set(scaleDown, scaleDown, scaleDown);
      this.renderGroup.position.set(0, 0, -scaleDown * 5);

      // garde une boite de taille de côté si besoin
      const bb = new THREE.Box3().expandByObject(this.renderGroup);
      // const bbh = new THREE.Box3Helper(bb, 0xff0000);
      // bbh.visible = false;
      this.renderGroup.userData["bb"] = bb;
      // this.renderGroup.userData["bbh"] = bbh;

      // this.renderGroup.add(bbh)
      this.scene.add(this.renderGroup);
    }
  }

  // calcule le point visé dans la réalité
  // Voir : https://threejs.org/examples/#webxr_ar_hittest
  XRHitTest(
    renderer: THREE.WebGLRenderer,
    frame: XRFrame,
    onHitTestResultReady: (hitPoseMatrix: Float32Array) => void,
    onHitTestResultEmpty: () => void,
  ) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = frame.session;
    // récupère la position actuelle de la caméra réelle en passant
    if (referenceSpace) {
      this.viewPos = frame.getViewerPose(referenceSpace)
    }

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
            // console.warn("Pas de xrhitpose");
          }
        } else {
          // console.warn("Pas de hit/ref");
        }
      } else {
        // console.warn("Pas de array member");
      }
    } else {
      // console.warn("Pas de source");
    }
    return onHitTestResultEmpty();
  }

  setRaycast() {
    this.raycast.setFromCamera(this.pointerCurrent, this.camera);
  }

  get width() { return this.container.offsetWidth; }
  get height() { return this.container.offsetHeight; }
  get renderGroup() { return this.service.renderGroup; }
  // utilitaire pour avoir le bon objet lors des tests
  get object() { if (this.scene.getObjectByName("pivot")) { return this.scene.getObjectByName("pivot") as THREE.Object3D } else { return this.renderGroup; } }
}
