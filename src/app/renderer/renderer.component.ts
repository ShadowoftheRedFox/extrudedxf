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
import {
  Box3,
  Vector2,
  Vector3,
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  ReinhardToneMapping,
  RepeatWrapping,
  Scene,
  TextureLoader,
  WebGLRenderer,
  Raycaster,
  Object3D,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  GridHelper,
  ArrowHelper,
  LineBasicMaterial,
  BufferGeometry,
  Line,
  Points,
  PointsMaterial,
  Plane,
  Matrix4,
} from 'three';
import { RouterModule } from '@angular/router';
import { Actions, ConfigService } from '../services/config.service';

@Component({
  selector: 'ft-renderer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './renderer.component.html',
  styleUrl: './renderer.component.scss',
})
export class RendererComponent implements AfterViewInit {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef;
  @ViewChild('drawer') drawer!: MatDrawer;

  service = inject(RendererService);
  config = inject(ConfigService);

  constructor(private ngZone: NgZone) { }

  grid = new GridHelper(50, 50, new Color(0x0000ff));
  raycaster = new Raycaster();

  sourie!: Vector2;
  sourieClick = false;
  // boite pour les faces autour de la pergo
  // possiblement à faire plus détaillé si la pergo est complexe
  boxPergo!: Mesh;

  pointIndexDrag: { perspectiveId: number, pointId: number } | null = null;
  perspectivePlan: Plane | null = null;
  perspectivePlanNormal = new Vector3();
  pergolaNeedUpdate = false;
  horizon: {
    dir: Vector3;
    lengthWorld: number;
    lengthScreen: number;
    normal: Vector3;
    lc: number
  } | null = null;

  perspectiveMatrice = new Matrix4();

  ngAfterViewInit(): void {
    this.initThree();
    this.animate();
  }

  initThree() {
    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;

    // Création de la scène
    this.scene = new Scene();

    // Création de la caméra
    this.camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(new Vector3());

    // TODO lookAt object ajouté

    // crée un vector sui va suivre la sourie
    this.sourie = new Vector2();

    // Création du renderer
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
    this.renderer.shadowMap.enabled = true; // activer les ombres
    this.renderer.shadowMap.type = PCFShadowMap; // utiliser un type de map d'ombres douces

    // Création de orbit control

    // Création des lumières réalistiques
    this.renderer.toneMapping = ReinhardToneMapping;
    this.renderer.toneMappingExposure = 2.3;

    // Création d'une lumière
    const ambientLight = new AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    // Création d'une lumière directionnelle
    const directionalLight = new DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1); // positionne la lumière au-dessus de la scène
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    this.scene.background = new Color(0x454545);

    // Création d'un gestionnaire de chargement de textures
    const textureLoader = new TextureLoader();

    // Chargement de la texture d'image
    const texture = textureLoader.load(
      '/assets/textures/background-grid-dark.png'
    );

    // Répétition de la texture
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(250, 250); // répète la texture 4 fois en largeur et en hauteur

    // Création d'un sol

    // Crée un matériau de base pour le sol (ou utilise le matériau existant)
    const groundMaterial = new MeshStandardMaterial({
      map: texture,
      side: DoubleSide,
      transparent: true,
    });

    // Crée un groupe pour contenir le sol et l'effet de profondeur de champ
    const groundGroup = new Group();

    // Crée un sol
    const groundGeometry = new PlaneGeometry(1000, 1000);
    this.groundMesh = new Mesh(groundGeometry, groundMaterial);
    this.groundMesh.rotation.x = -Math.PI / 2; // rotation pour que le sol soit horizontal
    this.groundMesh.receiveShadow = true; // permet au sol de recevoir les ombres
    groundGroup.add(this.groundMesh);

    // Ajout du sol à la scène
    this.scene.add(groundGroup);
    this.scene.add(this.renderGroup);

    console.log("Scene: ", this.scene);
    console.log("PL: ", this.perspectiveLines);
    console.log("Matrice: ", this.perspectiveMatrice);
  }

  animate() {
    this.ngZone.runOutsideAngular(() => {
      this.preserveControlsTarget();
      requestAnimationFrame(() => this.animate());
    });

    if (this.pergolaNeedUpdate && this.pergola != null) {
      this.pergolaNeedUpdate = false;
      this.calcPositionObjet();
    }

    this.renderer.render(this.scene, this.camera);
  }

  pointDeFuite(ligne1: Vector3, ligne2: Vector3, origine1: Vector3, origine2: Vector3): Vector3 {
    const [l1, l2, o1, o2] = [ligne1.clone(), ligne2.clone(), origine1.clone(), origine2.clone()];
    l1.z = 0;
    l2.z = 0;
    o1.z = 0;
    o2.z = 0;
    const result = new Vector3();
    const [dx1, dy1] = [l1.x, l1.y];
    const [dx2, dy2] = [l2.x, l2.y];
    const [x1, y1] = [o1.x, o1.y];
    const [x2, y2] = [o2.x, o2.y];
    // Calculer le déterminant pour vérifier si les vecteurs sont parallèles
    const determinant = dx1 * dy2 - dy1 * dx2;

    if (determinant === 0) {
      // Les vecteurs sont parallèles (pas d'intersection)
      return result;
    }

    // Calcul des coefficients pour trouver le paramètre t de la droite A
    const t = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / determinant;

    // Calcul des coordonnées du point d'intersection
    result.x = x1 + t * dx1;
    result.y = y1 + t * dy1;

    return result;
  }

  preserveControlsTarget() {
    if (this.renderGroup && !this.service.backgroundImage) {
      const bb = new Box3().expandByObject(this.renderGroup);
      const size = bb.getSize(new Vector3());
      // this.renderGroup.position.y = size.y / 2;

    }

    if (this.service.backgroundImage) {
      this.groundMesh.visible = false;
      this.scene.getObjectById(this.grid.id)?.removeFromParent();
      this.scene.add(this.grid);
    }
  }

  @HostListener("document:mousemove", ['$event'])
  handleMouseMouve(event: MouseEvent) {
    this.sourie.setX((event.clientX / this.rendererContainer.nativeElement.clientWidth) * 2 - 1);
    this.sourie.setY(-(event.clientY / this.rendererContainer.nativeElement.clientHeight) * 2 + 1);

    if (this.sourieClick && this.pointIndexDrag != null && this.perspectiveLines.length > 0 && this.perspectivePlan != null) {
      // on récupère notre object et notre ligne
      const obj = this.scene.getObjectById(this.pointIndexDrag.pointId) as Mesh;
      if (!obj) return;
      const PL = this.perspectiveLines.filter(pl => { if (pl.id == this.pointIndexDrag?.perspectiveId) { return true; } return false; })[0];
      // re balance un raycast pour savoir ou mettre l'objet sur le plan
      this.setRaycast();
      const pointPlan = new Vector3();
      this.raycaster.ray.intersectPlane(this.perspectivePlan, pointPlan);
      obj.position.set(pointPlan.x, pointPlan.y, 0);
      PL.ligne.removeFromParent();
      const geometry = new BufferGeometry().setFromPoints([
        PL.pointA.getWorldPosition(new Vector3()),
        PL.pointB.getWorldPosition(new Vector3()),
      ]);

      const materialLine = new LineBasicMaterial({ color: PL.id % 2 ? 0xff0000 : 0x0000ff });
      PL.ligne = new Line(geometry, materialLine);

      PL.group.add(PL.ligne);

      this.pergolaNeedUpdate = true;
    }
  }
  @HostListener("document:mousedown", ['$event'])
  handleMouseDown(event: MouseEvent) {
    this.sourieClick = true;

    this.selectionPoint();
  }
  @HostListener("document:mouseup", ['$event'])
  handleMouseUp(event: MouseEvent) {
    this.sourieClick = false;
  }

  @HostListener('window:resize')
  onWindowResize() {
    // Mettez à jour la taille du renderer
    const pixelRatio = window.devicePixelRatio;
    const width = Math.floor(this.rendererContainer.nativeElement.clientWidth * pixelRatio);
    const height = Math.floor(this.rendererContainer.nativeElement.clientHeight * pixelRatio);
    this.renderer.setSize(width, height, true);

    // Mettez à jour l'aspect ratio de la caméra
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyboardUpEvent(event: KeyboardEvent) {
    this.config.onkeyup(event);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardDownEvent(event: KeyboardEvent) {
    // ajoute le listener pour les entrés
    this.config.onKeyDown(event);
    // trouver l'action voulu
    const action: Actions = this.config.getActions(event);
    switch (action) {
      case Actions.Rien:
        this.drawFaceBox();
        break;
      case Actions.Centrer:
        this.renderGroup.position.set(0, 0, 0);
        this.renderGroup.rotation.set(0, 0, 0);
        this.renderGroup.quaternion.set(0, 0, 0, 0);
        break;
      case Actions.DessinerTrapeze:
        break;
      case Actions.DessinerLignePerspective:
        // TEST pcq la cam se mets toujours n'importe comment, foutu ici
        this.camera.lookAt(new Vector3(0, 0, 0));
        this.ajouteLignePerspective();
        break;
      case Actions.ChoisirFace:
        this.drawFaceBox();
        this.choisirFace();
        break;
      case Actions.Snap:
        break;
      case Actions.Efface:
        // généralement pour le debug, pas sur que cela fera grand chose plus tard
        const arrows = this.scene.getObjectsByProperty("name", "RaycastArrow");
        arrows.forEach(arr => {
          arr.clear();
          arr.remove();
          arr.removeFromParent();
        })
        // enleve la face visible
        if (this.boxPergo && Array.isArray(this.boxPergo.material)) {
          this.boxPergo.material.forEach(mat => {
            if (Object.hasOwn(mat, "visible")) {
              mat.visible = false;
            } else {
              Object.defineProperty(mat, "visible", false);
            }
          });
        }
        break;
    }

    if (this.config.isPressed(event, true, ["control"], ['escape'])) {
      this.service.backgroundImage = null;
      this.scene.background = null;
      this.groundMesh.visible = true;
      this.scene.remove(this.grid);
      this.scene.background = new Color(0x454545);
    } else if (this.config.isPressed(event, true, ["control"], ["h"])) {
      this.service.import.visible = !this.service.import.visible;
    }

    this.camera.updateProjectionMatrix();
  }

  choisirFace() {
    // dessine la boite qui servira à afficher la face choisie
    if (!this.boxPergo) {
      this.drawFaceBox();
      if (this.verbose) {
        console.log("Pas de boxPergo");
      }
    }

    // recupere la face pour le snap
    this.setRaycast();
    // colisions seulement sur la boxPergo
    const intersetcs = this.raycaster.intersectObject(this.boxPergo);
    if (intersetcs.length == 0) {
      if (this.verbose) {
        console.log("Pas d'intersections");
      }
      return;
    }
    console.log(intersetcs);
    // récupère l'intersect le plus proche
    const face = intersetcs[0];
    if (this.verbose) {
      this.drawRaycast(this.raycaster, face.distance);
    }
    if (!Array.isArray(this.boxPergo.material)) {
      throw new Error("La pergoBox n'as pas plusieurs material")
    }

    if (face.faceIndex != undefined) {
      // met invisible tout les autres mat
      this.boxPergo.material.forEach(mat => {
        if (Object.hasOwn(mat, "visible")) {
          mat.visible = false;
        } else {
          Object.defineProperty(mat, "visible", false);
        }
      });
      const mat = this.boxPergo.material[Math.floor(face.faceIndex / 2)];
      if (Object.hasOwn(mat, "visible")) {
        mat.visible = !mat.visible;
      } else {
        Object.defineProperty(mat, "visible", true);
      }
    }
  }

  drawFaceBox() {
    // ajoute une nouvelle boxPergo à la scene
    if (!this.boxPergo && this.pergola != null) {
      const bounds = new Box3().setFromObject(this.renderGroup);
      const geometry = new BoxGeometry().scale(bounds.max.x, bounds.max.y, bounds.max.z);
      // pour voir la face des deux cotés: DoubleSide
      const cubeMaterial = [
        new MeshBasicMaterial({ color: 0xff0000, side: DoubleSide, visible: false, name: "red" }),
        new MeshBasicMaterial({ color: 0x00ff00, side: DoubleSide, visible: false, name: "green" }),
        new MeshBasicMaterial({ color: 0x0000ff, side: DoubleSide, visible: false, name: "blue" }),
        new MeshBasicMaterial({ color: 0xffff00, side: DoubleSide, visible: false, name: "purple" }),
        new MeshBasicMaterial({ color: 0x00ffff, side: DoubleSide, visible: false, name: "cyan" }),
        new MeshBasicMaterial({ color: 0xff00ff, side: DoubleSide, visible: false, name: "yellow" }),
      ];
      this.boxPergo = new Mesh(geometry, cubeMaterial);
      this.boxPergo.geometry.computeBoundingBox();
      this.boxPergo.name = "boxPergo"
      const addedVect = new Vector3();
      if (this.boxPergo.geometry.boundingBox) {
        this.boxPergo.geometry.boundingBox.getSize(addedVect);
      }

      // modifie ces propriétés pour "coller" a la pergola
      this.boxPergo.position.copy(this.renderGroup.position).add(addedVect.divideScalar(2));
      this.pergola.add(this.boxPergo);
    }
    // légèrement plus gros pour dépasser pour éviter le z-fighting
    this.boxPergo.scale.copy(this.renderGroup.scale).multiplyScalar(1.001);
  }

  // pour les text, pour bouger les coos des points
  static perspectiveLinesId = 0;
  ajouteLignePerspective() {
    if (this.perspectiveLines.length == 0) {
      // crée les mat des lignes et des points
      // TODO un label?
      // TODO un menu pour gérer si on veut en ajouter/enelever?

      // crée 2 paires, deux rouge deux bleus
      for (let i = 0; i < 4; i++) {

        RendererComponent.perspectiveLinesId++;

        const boxGeometry = new BoxGeometry(0.3, 0.3, 0.3);
        const material1 = new MeshBasicMaterial({ color: Math.random() * 16581375 });
        const material2 = new MeshBasicMaterial({ color: Math.random() * 16581375 });

        const cube_1 = new Mesh(boxGeometry, material1);
        const cube_2 = new Mesh(boxGeometry, material2);

        cube_1.position.x += - 5;
        cube_1.position.y += -2 + RendererComponent.perspectiveLinesId;
        cube_2.position.x += 0;
        cube_2.position.y += -2 + RendererComponent.perspectiveLinesId;

        cube_1.name = "perspectivePoint";
        cube_2.name = "perspectivePoint";

        const geometry = new BufferGeometry().setFromPoints([
          cube_1.getWorldPosition(new Vector3()),
          cube_2.getWorldPosition(new Vector3()),
        ]);

        const materialLine = new LineBasicMaterial({ color: RendererComponent.perspectiveLinesId % 2 ? 0xff0000 : 0x0000ff });
        const line = new Line(geometry, materialLine);
        line.name = "perspectiveLine"

        const helper_x = new Object3D().add(cube_1, cube_2, line);
        this.perspectiveLines.push({
          axe: RendererComponent.perspectiveLinesId % 2 ? "profondeur" : "longueur",
          ligne: line,
          pointA: cube_1,
          pointB: cube_2,
          group: helper_x,
          id: RendererComponent.perspectiveLinesId
        });
        helper_x.userData = {
          perspectiveLinesId: RendererComponent.perspectiveLinesId
        }

        this.scene.add(helper_x);

        // crée un plan vertical sur la scène
        if (!this.perspectivePlan) {
          const plan = new Plane(new Vector3(1, 1, 0), this.camera.position.distanceTo(new Vector3()));
          this.perspectivePlan = plan;
        }
      }

      // ligne verticale
      RendererComponent.perspectiveLinesId++;

      const boxGeometry = new BoxGeometry(0.3, 0.3, 0.3);
      const material = new MeshBasicMaterial({ color: 0xffff00 });

      const cube_1 = new Mesh(boxGeometry, material);
      const cube_2 = new Mesh(boxGeometry, material);

      cube_1.position.x += Math.random() * 10 - 5;
      cube_1.position.y += Math.random() * 10 - 5;
      cube_2.position.x += Math.random() * 10 - 5;
      cube_2.position.y += Math.random() * 10 - 5;

      cube_1.name = "perspectivePoint";
      cube_2.name = "perspectivePoint";

      const geometry = new BufferGeometry().setFromPoints([
        cube_1.getWorldPosition(new Vector3()),
        cube_2.getWorldPosition(new Vector3()),
      ]);

      const materialLine = new LineBasicMaterial({ color: 0xffff00 });
      const line = new Line(geometry, materialLine);
      line.name = "perspectiveLine"

      const helper_x = new Object3D().add(cube_1, cube_2, line);
      this.perspectiveLines.push({
        axe: "hauteur",
        ligne: line,
        pointA: cube_1,
        pointB: cube_2,
        group: helper_x,
        id: RendererComponent.perspectiveLinesId
      });
      helper_x.userData = {
        perspectiveLinesId: RendererComponent.perspectiveLinesId
      }
      // TEST ce vecteur est présent ou cas ou, il sera surement dégagé
      helper_x.visible = false;

      this.scene.add(helper_x);
    }
  }

  selectionPoint() {
    if (!this.perspectiveLines.length) return;
    const points: Mesh[] = [];
    this.perspectiveLines.forEach(l => {
      points.push(l.pointA);
      points.push(l.pointB);
    });
    this.setRaycast();
    const intersects = this.raycaster.intersectObjects(points);
    if (intersects.length === 0) {
      this.pointIndexDrag = null;
    } else {
      let lineId = -1;
      if (intersects[0].object.parent && intersects[0].object.parent.userData) {
        lineId = intersects[0].object.parent.userData["perspectiveLinesId"];
      }
      this.pointIndexDrag = { pointId: intersects[0].object.id, perspectiveId: lineId };
      this.perspectivePlanNormal.subVectors(this.camera.position, intersects[0].point).normalize();
      this.perspectivePlan?.setFromNormalAndCoplanarPoint(this.perspectivePlanNormal, intersects[0].point);
    }
  }

  // le concept est le suivant
  // on place 4 lignes, qui nous donne 2 points de fuite et un horizon
  // à partir de là, on peut calculer le fov, zfar et znear de la camera utilisée dans la photo
  // pour le reproduire dans la scene, ne reste plus qu'à bouger l'objet
  // voir: https://stackoverflow.com/questions/53289330/transformation-of-3d-objects-related-to-vanishing-points-and-horizon-line
  calcPositionObjet() {
    const height = this.rendererContainer.nativeElement.clientHeight;
    const width = this.rendererContainer.nativeElement.clientWidth;
    // on récupère les deux dimensions de perspective
    let PLd = this.perspectiveLines.filter(pl => { return pl.axe == "profondeur" });
    let PLg = this.perspectiveLines.filter(pl => { return pl.axe == "longueur" });
    const PLh = this.perspectiveLines.filter(pl => { return pl.axe == "hauteur" });
    if (PLd.length !== 2 || PLg.length !== 2 || PLh.length !== 1) {
      throw new Error(`les dimensions de perspective ne sont pas 2! PLd ${PLd.length} , PLg ${PLg.length} , PLh ${PLh.length}`);
    }

    // TODO il y aura surement de l'optimisation à faire
    //    du genre, on ne bouge qu'un point à la fois, pas recalculer tout

    // calcule la direction des lignes
    let dir_PLd_0 = new Vector3().subVectors(PLd[0].pointB.position, PLd[0].pointA.position).normalize();
    let dir_PLd_1 = new Vector3().subVectors(PLd[1].pointB.position, PLd[1].pointA.position).normalize();
    let dir_PLg_0 = new Vector3().subVectors(PLg[0].pointB.position, PLg[0].pointA.position).normalize();
    let dir_PLg_1 = new Vector3().subVectors(PLg[1].pointB.position, PLg[1].pointA.position).normalize();
    const dirh = new Vector3().subVectors(PLh[0].pointB.position, PLh[0].pointA.position).normalize();

    // calcule les deux points de fuite et récupère l'horizon
    let PDFd = this.pointDeFuite(dir_PLd_0, dir_PLd_1, PLd[0].pointA.position, PLd[1].pointA.position);
    let PDFg = this.pointDeFuite(dir_PLg_0, dir_PLg_1, PLg[0].pointA.position, PLg[1].pointA.position);
    // PDFd distance to PDFl, donc le point de départ est PDFl, sinon il faut prenre l'opposé de lengthWorld
    // lengthWorld est la longueur dans la scene (en ThreeJS unit), lengthScreen est la longueur sur l'écran (en pixel)
    this.horizon = { dir: new Vector3().subVectors(PDFd, PDFg).normalize(), lengthWorld: PDFd.distanceTo(PDFg), lengthScreen: 1, normal: new Vector3(), lc: 0 };

    // crée les quadrilataire des PL, en organisant les points dans le sens contraire des aiguilles d'un montre
    // le premier point est celui en haut à gauche
    // tri des points
    let QuadCornersD = this.sortCCWPoints([PLd[0].pointA, PLd[0].pointB, PLd[1].pointA, PLd[1].pointB]);
    let QuadCornersG = this.sortCCWPoints([PLg[0].pointA, PLg[0].pointB, PLg[1].pointA, PLg[1].pointB]);

    // on vas créer nos trapèzes à partir de ces points
    // vu qu'ils doivent avoir une direction verticale commune, il faut les passer en paire
    let [TrapD, TrapG] = this.getTrapFromQuad(QuadCornersD, QuadCornersG);

    // vu qu'on suppose que nos zones délimités sont rectangulaire
    // cela implique que nos trapèzes non projetés sont aussi des rectangles
    // donc nous allons récupérer le centre des trapèzes,
    // et le centre du segment si les deux trapèzes se touchaient
    let CentreTrapD = this.getCenterFromTrap(TrapD);
    let CentreTrapG = this.getCenterFromTrap(TrapG);
    const CentreSegment = this.getCenterSegment(TrapD, TrapG);
    // on s'assure que TrapD soit bien à doite, et que TrapG soit bien à gauche
    if (CentreTrapD.x < CentreTrapG.x) {
      // on inverse tout les objets correspondants
      let temp: any;
      temp = this.swap(PLd, PLg);
      PLd = temp[0]; PLg = temp[1];
      temp = this.swap(dir_PLd_0, dir_PLg_0);
      dir_PLd_0 = temp[0]; dir_PLg_0 = temp[1];
      temp = this.swap(dir_PLd_1, dir_PLg_1);
      dir_PLd_1 = temp[0]; dir_PLg_1 = temp[1];
      temp = this.swap(PDFd, PDFg);
      PDFd = temp[0]; PDFg = temp[1];
      temp = this.swap(QuadCornersD, QuadCornersG);
      QuadCornersD = temp[0]; QuadCornersG = temp[1];
      temp = this.swap(TrapD, TrapG);
      TrapD = temp[0]; TrapG = temp[1];
      temp = this.swap(CentreTrapD, CentreTrapG);
      CentreTrapD = temp[0]; CentreTrapG = temp[1];
    }

    // récupère un ratio mètre/pixel pour faire les conversions
    // on prend la position, qu'on normalize comme la sourie, et on repositionne
    const PtG = PDFg.clone();
    const PtD = PDFd.clone();
    PtG.project(this.camera);
    PtD.project(this.camera);
    const halfW = width / 2;
    const halfH = height / 2;
    PtG.z = PtD.z = 0;
    PtG.x = (PtG.x * halfW) + halfW;
    PtG.y = (PtG.y * halfH) + halfH;
    PtD.x = (PtD.x * halfW) + halfW;
    PtD.y = (PtD.y * halfH) + halfH;
    this.horizon.lengthScreen = Math.sqrt(Math.pow((PtG.x - PtD.x), 2) + Math.pow((PtG.y - PtD.y), 2));

    // calcule du FOV de l'image
    if (!this.scene.background) {
      throw new Error("besoin de l'image pour calculer une perspective");
    }
    const FOV = 90.0 * width / this.horizon.lengthScreen;

    //calcul du znear
    const znear = Math.abs(1 / Math.tan(0.5 * FOV));
    // calcul du zfar
    const zfar = 1000 * znear;

    // récupère le ratio de profondeur, avec pour étalon la ligne centrale lc
    const ZRatios = this.getZRatio(TrapD, TrapG);
    // le produit scalaire entre deux directions:
    // - centre quadG à centre Arrete milieu
    // - centre quadD à centre Arrete milieu
    // devrait être égale à 0 (sur StackOverflow: dot(pnt1-pnt0,pnt2-pnt0)=0)
    // on calcule donc z0, z1, z2 et l
    // après calcul, l = sqrt(((x1-x0)(x2-x0)+(y1-y0)(y2-y0))/(znear*znear*(l1*l2 + l0*(l1+l2+l0))))
    // maintenant qu'on à l, on peut calculer z0, z1 et z2
    const l = Math.sqrt(
      ((CentreTrapG.x - CentreSegment.x) * (CentreTrapD.x - CentreSegment.x) +
        (CentreTrapG.y - CentreSegment.y) * (CentreTrapD.y - CentreSegment.y)) /
      (znear * znear * (ZRatios.ld * ZRatios.lg - ZRatios.lc * (ZRatios.ld + ZRatios.lg + ZRatios.lc)))
    );
    if (!isNaN(l)) {
      // profondeur au milieu du segment central
      const zc = znear * ZRatios.lc / l;
      // profondeur au milieu du segment de gauche
      const zg = znear * ZRatios.lg / l;
      // profondeur au milieu du segment de droite
      const zd = znear * ZRatios.ld / l;

      // Enfin, avec toutes ces infos, on peut faire une matrice de transformation qui va mettre un objet dans la perspective
      this.perspectiveMatrice = new Matrix4(
        CentreTrapG.x, CentreSegment.x, CentreTrapD.x, 0,
        CentreTrapG.y, CentreSegment.y, CentreTrapD.y, 0,
        zg/*       */, zc/*         */, zd/*       */, 0,
        1/*        */, 1/*          */, 1/*        */, 1
      );
      // Position Objet * matrice = resultat
      // Finalement,  Position Object x = resultat.x / resultat.z
      //              Position Object y = resultat.y / resultat.z
      // sur l'écran, <-1, 1>
      this.renderGroup.scale.set(zg, zc, zd);
      this.changePositionObjet(this.perspectiveMatrice);
    }

    if (this.defaultContent.helperBox) {
      // affichage des différents composants
      // affiches les lignes de perspectives
      // this.drawArrow(dir_PLd_0, PLd[0].pointA.position, { unique: true, id: 0xff0000, length: PLd[0].pointB.position.distanceTo(PLd[0].pointA.position) });
      // this.drawArrow(dir_PLd_1, PLd[1].pointA.position, { unique: true, id: 0xff1000, length: PLd[1].pointB.position.distanceTo(PLd[1].pointA.position) });
      // this.drawArrow(dir_PLg_0, PLg[0].pointA.position, { unique: true, id: 0x0000ff, length: PLg[0].pointB.position.distanceTo(PLg[0].pointA.position) });
      // this.drawArrow(dir_PLg_1, PLg[1].pointA.position, { unique: true, id: 0x0001ff, length: PLg[1].pointB.position.distanceTo(PLg[1].pointA.position) });
      // affiche la ligne verticale
      // this.drawArrow(dirh, PLh[0].pointA.position, { unique: true, id: 0xffff00, length: PLh[0].pointB.position.distanceTo(PLh[0].pointA.position) });

      // affiche les points de fuite
      this.drawPoint(PDFd, { unique: true, id: 0xff0000 });
      this.drawPoint(PDFg, { unique: true, id: 0x0000ff });
      // affiche l'horizon
      this.drawArrow(this.horizon.dir, PDFg, { unique: true, id: 0x000000, length: this.horizon.lengthWorld });

      // affichage de l'ordre des points par groupe
      (QuadCornersD[0].material as MeshBasicMaterial).color.set("red");
      (QuadCornersD[1].material as MeshBasicMaterial).color.set("blue");
      (QuadCornersD[2].material as MeshBasicMaterial).color.set("green");
      (QuadCornersD[3].material as MeshBasicMaterial).color.set("yellow");

      (QuadCornersG[0].material as MeshBasicMaterial).color.set("red");
      (QuadCornersG[1].material as MeshBasicMaterial).color.set("blue");
      (QuadCornersG[2].material as MeshBasicMaterial).color.set("green");
      (QuadCornersG[3].material as MeshBasicMaterial).color.set("yellow");

      // affiche la surface que les quad couvrent
      this.plane(TrapD, "planeD"); // rouge
      this.plane(TrapG, "planeG"); // bleu

      // affiche le centre des quads
      this.drawPoint(CentreTrapD, { unique: true, id: 0xffff00 });
      this.drawPoint(CentreTrapG, { unique: true, id: 0x00ffff });
    }
  }

  changePositionObjet(matrice: Matrix4) {
    // if (!this.renderGroup) return;
    // console.table([matrice.elements.slice(0, 4), matrice.elements.slice(4, 8), matrice.elements.slice(8, 12), matrice.elements.slice(12, 16)])
    // this.renderGroup.scale.set(1, 2, 1);
    // this.renderGroup.position.set(0, 0, 0);
    // this.renderGroup.scale.set(1, 1, 1);
    // const center = new Vector3();
    // this.drawArrow(this.renderGroup.position, center, { unique: true, id: 0xff2222, arrow: false, length: center.distanceTo(this.renderGroup.position) });
  }

  plane(QuadCorners: Vector3[], name: "planeD" | "planeG" = "planeD") {
    if (QuadCorners.length !== 4) throw new RangeError("le quad n'a pas 4 points!");
    const plan = this.scene.getObjectByName(name) as Mesh;
    if (!plan) {
      const planeGeom = new BufferGeometry().setFromPoints(this.getVerticesFromQuad(QuadCorners));
      const planeMat = new MeshBasicMaterial({ color: name == "planeG" ? 0x0000ff : 0xff0000, opacity: 0.2, transparent: true });
      const plane = new Mesh(planeGeom, planeMat);
      plane.name = name;
      this.scene.add(plane);
    } else {
      const pos = this.getVerticesFromQuad(QuadCorners);
      const posAttr = plan.geometry.getAttribute("position");
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setXYZ(i, pos[i].x, pos[i].y, pos[i].z);
      }
      posAttr.needsUpdate = true;
    }
  }

  getZRatio(quadD: Vector3[], quadG: Vector3[]): { lg: number, lc: number, ld: number } {
    const res = { lg: 0, lc: 0, ld: 0 };
    res.lg = quadG[0].distanceTo(quadG[1]);
    res.ld = quadD[2].distanceTo(quadD[3]);
    if (this.horizon) {
      res.lc = this.horizon.lc
    }

    // console.log(res);

    return res;
  }

  swap<T>(item1: T, item2: T): [T, T] {
    return [item2, item1];
    // if (!item1 || !item2) return;
    let temp: any;
    temp = item1;
    item1 = item2;
    item2 = temp;
  }

  sortCCWPoints<T extends Object3D>(points: T[]) {
    // BUG peut se mélanger si les points sont trop éloignés les uns des autres
    const [a_, b_] = [new Vector3(), new Vector3()];
    // Find min max to get center
    // Sort from top to bottom
    points.sort((a, b) => { a.getWorldPosition(a_); b.getWorldPosition(b_); return a_.y - b_.y; });
    // Get center y
    points[0].getWorldPosition(a_);
    points[points.length - 1].getWorldPosition(b_);
    const cy = (a_.y + b_.y) / 2;

    // Sort from right to left
    points.sort((a, b) => { a.getWorldPosition(a_); b.getWorldPosition(b_); return b_.x - a_.x; });

    // Get center x
    points[0].getWorldPosition(a_);
    points[points.length - 1].getWorldPosition(b_);
    const cx = (a_.x + b_.x) / 2;

    // Center point
    const center = { x: cx, y: cy };

    // Pre calculate the angles as it will be slow in the sort
    // As the points are sorted from right to left the first point
    // is the rightmost

    // Starting angle used to reference other angles
    var startAng = Math.PI / 2;
    points.forEach(point => {
      point.getWorldPosition(a_);
      var ang = Math.atan2(a_.y - center.y, a_.x - center.x);
      if (!startAng) { startAng = ang }
      else {
        if (ang < startAng) {  // ensure that all points are clockwise of the start point
          ang += Math.PI * 2;
        }
      }
      point.userData["angle"] = ang;
    });


    // Sort clockwise;
    points.sort((a, b) => a.userData["angle"] - b.userData["angle"]);
    return points;
  }

  getCenterSegment(pointsD: Vector3[], pointsG: Vector3[]): Vector3 {
    if (pointsD.length !== 4) throw new RangeError("d n'a pas 4 points!");
    if (pointsG.length !== 4) throw new RangeError("g n'a pas 4 points!");
    const center = new Vector3();

    const ligne_hauteD = new Vector3().subVectors(pointsD[0], pointsD[3]).normalize();
    const ligne_hauteG = new Vector3().subVectors(pointsG[0], pointsG[3]).normalize();

    const ligne_basseD = new Vector3().subVectors(pointsD[1], pointsD[2]).normalize();
    const ligne_basseG = new Vector3().subVectors(pointsG[1], pointsG[2]).normalize();

    const pointHaut = this.pointDeFuite(ligne_hauteD, ligne_hauteG, pointsD[3], pointsG[3]);
    const pointBas = this.pointDeFuite(ligne_basseD, ligne_basseG, pointsD[2], pointsG[2]);

    center.x = (pointHaut.x + pointBas.x) / 2;
    center.y = (pointHaut.y + pointBas.y) / 2;

    if (this.horizon) {
      this.horizon.lc = pointHaut.distanceTo(pointBas);
    }

    if (this.defaultContent.helperBox) {
      this.drawPoint(center, { unique: true, id: 0x111111 });
      this.drawPoint(pointHaut, { unique: true, id: 0xff00db });
      this.drawPoint(pointBas, { unique: true, id: 0x00ff3b });
    }

    return center;
  }

  getCenterFromTrap(points: Vector3[]): Vector3 {
    if (points.length !== 4) throw new RangeError("pas 4 points!");
    const center = new Vector3();

    points.forEach(point => {
      center.x += point.x;
      center.y += point.y;
    });

    center.x /= points.length;
    center.y /= points.length;

    return center;
  }

  getTrapFromQuad(quadD: Mesh[], quadG: Mesh[]): Vector3[][] {
    if (quadD.length != 4) throw new RangeError("le quad d n'a pas 4 points!");
    if (quadG.length != 4) throw new RangeError("le quad l n'a pas 4 points!");
    if (!this.horizon) throw new Error("pas d'horizon");

    const points = [
      [quadD[0].position, quadD[1].position, quadD[2].position, quadD[3].position],
      [quadG[0].position, quadG[1].position, quadG[2].position, quadG[3].position]
    ]

    // on vas prendre les deux lignes de chaque quad, et calculer de nouveaux points
    // pour que les bords verticaux soit parralèles
    // on le calcul à partir de la normal de l'horizon
    const horizonNormal = new Vector3(this.horizon.dir.y, -this.horizon.dir.x);
    this.horizon.normal = horizonNormal;
    this.drawArrow(horizonNormal, new Vector3(), { unique: true, id: 0x000001, arrow: true, length: 5 });

    // vecteurs directeurs des lignes correspondantes
    const ligne_hauteD = new Vector3().subVectors(quadD[0].position, quadD[3].position).normalize();
    const ligne_basseD = new Vector3().subVectors(quadD[1].position, quadD[2].position).normalize();
    const ligne_hauteG = new Vector3().subVectors(quadG[0].position, quadG[3].position).normalize();
    const ligne_basseG = new Vector3().subVectors(quadG[1].position, quadG[2].position).normalize();

    // maintenant, on prend les points les plus à gauche et à droite, et on prend le point d'intersection avec la ligne opposé
    var PtG_quadD = { pt: quadD[0].position, id: 0 };
    var PtD_quadD = { pt: quadD[0].position, id: 0 };
    quadD.forEach((pt, id) => { if (pt.position.x < PtG_quadD.pt.x) { PtG_quadD = { pt: pt.position, id: id }; } });
    quadD.forEach((pt, id) => { if (pt.position.x > PtD_quadD.pt.x) { PtD_quadD = { pt: pt.position, id: id }; } });
    var PtG_quadG = { pt: quadG[0].position, id: 0 };
    var PtD_quadG = { pt: quadG[0].position, id: 0 };
    quadG.forEach((pt, id) => { if (pt.position.x < PtG_quadG.pt.x) { PtG_quadG = { pt: pt.position, id: id }; } });
    quadG.forEach((pt, id) => { if (pt.position.x > PtD_quadG.pt.x) { PtD_quadG = { pt: pt.position, id: id }; } });

    // coin haut gauche donc change bas gauche (ou l'inverse avec le else)
    if (PtG_quadD.id == 0 || PtG_quadD.id == 3) {
      points[0][1] = this.pointDeFuite(ligne_basseD, horizonNormal, points[0][1], PtG_quadD.pt);
    } else {
      points[0][0] = this.pointDeFuite(ligne_hauteD, horizonNormal, points[0][0], PtG_quadD.pt);
    }
    // coin haut droit donc change bas droit (ou l'inverse avec le else)
    if (PtD_quadD.id == 0 || PtD_quadD.id == 3) {
      points[0][2] = this.pointDeFuite(ligne_basseD, horizonNormal, points[0][2], PtD_quadD.pt);
    } else {
      points[0][3] = this.pointDeFuite(ligne_hauteD, horizonNormal, points[0][3], PtD_quadD.pt);
    }

    // coin haut gauche donc change bas gauche (ou l'inverse avec le else)
    if (PtG_quadG.id == 0 || PtG_quadG.id == 3) {
      points[1][1] = this.pointDeFuite(ligne_basseG, horizonNormal, points[1][1], PtG_quadG.pt);
    } else {
      points[1][0] = this.pointDeFuite(ligne_hauteG, horizonNormal, points[1][0], PtG_quadG.pt);
    }
    // coin haut droit donc change bas droit (ou l'inverse avec le else)
    if (PtD_quadG.id == 0 || PtD_quadG.id == 3) {
      points[1][2] = this.pointDeFuite(ligne_basseG, horizonNormal, points[1][2], PtD_quadG.pt);
    } else {
      points[1][3] = this.pointDeFuite(ligne_hauteG, horizonNormal, points[1][3], PtD_quadG.pt);
    }

    return points;
  }

  getVerticesFromQuad(quad: Vector3[]): Vector3[] {
    if (quad.length != 4) throw new RangeError("le quad n'a pas 4 points!");
    // const array: Vector3[] = [];
    // quad.forEach(q => {
    //   const v = new Vector3();
    //   q.getWorldPosition(v);
    //   array.push(v);
    // });
    // on a un tableau de nos positions dans le monde
    // on fait nos deux triangles
    const vertices: Vector3[] = [];
    vertices.push(quad[0], quad[1], quad[2]);
    vertices.push(quad[0], quad[2], quad[3]);
    return vertices;
  }

  setRaycast() {
    this.raycaster.setFromCamera(this.sourie, this.camera);
  }

  drawRaycast(raycaster: Raycaster, distance = 300) {
    if (!raycaster || !this.defaultContent.helperBox) return;
    const arrow = new ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, distance, 0xff0000);
    arrow.name = "RaycastArrow";
    this.renderGroup.add(arrow);
  }

  drawArrow(direction: Vector3, start: Vector3, options: { unique?: boolean, id?: number, length?: number, arrow?: boolean } = {}) {
    if (!direction || !start) return;
    if (!options.unique) options.unique = false;
    if (!options.id) options.id = 0;
    if (!options.length) options.length = 300;
    if (!options.arrow) options.arrow = false;

    const arrow = new ArrowHelper(direction, start, options.length, options.id, options.arrow ? 0.2 * options.length : 0, options.arrow ? 0.2 * 0.2 * options.length : 0);
    arrow.name = "RaycastArrow" + (options.unique ? "Unique" + options.id.toString() : "");
    if (options.unique) {
      const u = this.scene.getObjectByName("RaycastArrowUnique" + options.id.toString());
      if (u) {
        u.removeFromParent();
      }
    }
    this.scene.add(arrow);
  }

  drawPoint(pos: Vector3, options: { unique?: boolean, id?: number } = {}) {
    if (!pos) return;
    if (!options.unique) options.unique = false;
    if (!options.id) options.id = 0;
    const geometry = new BufferGeometry().setFromPoints([pos]);
    const mat = new PointsMaterial({ color: options.id });
    const point = new Points(geometry, mat)
    point.name = "DrewPoint" + (options.unique ? "Unique" + options.id.toString() : "");
    if (options.unique) {
      const u = this.scene.getObjectByName("DrewPointUnique" + options.id.toString());
      if (u) {
        u.removeFromParent();
      }
    }
    this.scene.add(point);
  }

  get pergola() {
    const p = this.renderGroup.getObjectByName("Pergola");
    if (!p) {
      console.warn("Il n'y a pas de pergolas dans renderGroup")
      return null;
    };
    return p;
  }

  get verbose() { return this.config.verbose; }
  get defaultContent() { return this.config.defaultContent; }
  get scene() { return this.service.scene; }
  get camera() { return this.service.camera; }
  get renderer() { return this.service.renderer; }
  get renderGroup() { return this.service.renderGroup; }
  get groundMesh() { return this.service.groundMesh; }
  get perspectiveLines() { return this.service.perspectiveLines; }
  set scene(val: Scene) { this.service.scene = val; }
  set renderer(val: WebGLRenderer) { this.service.renderer = val; }
  set camera(val: PerspectiveCamera) { this.service.camera = val; }
  set groundMesh(val: Mesh) { this.service.groundMesh = val; }
}

/*
TODO:
Menu pour tracer des lignes de fuites: longueur, largeur, hauteur
Bouton pour remettre la pargola en place par défaut (rotation etc)
Choisir la face choisie pour le snap
délier les perspectiveLines en 4 points et faire les lignes selon l'ordre des points (théoriquement ce qui est fait en calcul, mais pas visuellement)

BUG:
il faut remplacer les this.rendererContainer.nativeElement.clientWidth et this.rendererContainer.nativeElement.clientHeight par la taille de la canvas si celle ci ne prend pas toute la fenêtre
si le batiment en photo n'est pas fait d'angle droit, le resultat ne sera tres probablement pas celui escompté
*/

