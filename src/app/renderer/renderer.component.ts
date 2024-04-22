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
import { RouterModule } from '@angular/router';
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  ReinhardToneMapping,
  RepeatWrapping,
  Scene,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RendererService } from '../services/renderer.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ft-renderer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './renderer.component.html',
  styleUrl: './renderer.component.scss',
})
export class RendererComponent implements AfterViewInit {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef;
  @ViewChild('drawer') drawer!: MatDrawer;

  service = inject(RendererService);

  constructor(private ngZone: NgZone) {}

  stats: Map<string, string> = this.service.stats;
  cube!: Mesh;

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
    this.camera.position.z = 5;

    this.camera.position.set(0, 0, 5);

    // Création du renderer
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
    this.renderer.shadowMap.enabled = true; // activer les ombres
    this.renderer.shadowMap.type = PCFShadowMap; // utiliser un type de map d'ombres douces
    this.renderer.setPixelRatio(window.devicePixelRatio * 1.5);

    // Création de orbit control
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    // this.controls.minPolarAngle = Math.PI / 4; // Angle minimum de la latitude (en radians), ici on limite à 45 degrés vers le haut
    // this.controls.maxPolarAngle = Math.PI / 2; // Angle maximum de la latitude (en radians), ici on limite à 90 degrés vers le haut

    // Création des lumières réalistiques
    this.renderer.toneMapping = ReinhardToneMapping;
    this.renderer.toneMappingExposure = 2.3;

    // Création d'une lumière
    const ambientLight = new AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);

    // Création d'une lumière directionnelle
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1); // positionne la lumière au-dessus de la scène
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // this.scene.background = new Color(0x454545);

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
    this.scene.fog = new Fog(0x454545, 1, 20);
  }

  animate() {
    this.ngZone.runOutsideAngular(() => {
      this.preserveControlsTarget();
      this.stats = this.service.stats;
      requestAnimationFrame(() => this.animate());
    });

    this.renderer.render(this.scene, this.camera);
    this.controls.update();
  }

  grid = new GridHelper(50, 50, new Color(0xffffff));

  preserveControlsTarget() {
    if (this.renderGroup && !this.service.backgroundImage) {
      const bb = new Box3().expandByObject(this.renderGroup);
      const size = bb.getSize(new Vector3());
      // this.renderGroup.position.y = size.y / 2;

      this.controls.target = bb.getCenter(new Vector3());
    }

    if (this.service.backgroundImage) {
      this.groundMesh.visible = false;
      this.scene.getObjectById(this.grid.id)?.removeFromParent();
      this.scene.add(this.grid);
    }
  }

  onDebug(){
    
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.service.backgroundImage) {
      return;
    }

    // Mettez à jour la taille du renderer
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.service.resizeRenderer(width, height);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Gérer les touches de flèche haut et bas
    if (1 != 1) {
    }
    // else if (event.key === 'ArrowUp') {
    //   this.controls.target.y -= 0.05;
    //   this.controls.update();
    // }
    // else if (event.key === 'ArrowDown') {
    //   this.controls.target.y += 0.05;
    // } else if (event.key === 'ArrowRight') {
    //   this.camera.fov += 1;
    // } else if (event.key === 'ArrowLeft') {
    //   this.camera.fov -= 1;
    // }
    else if (event.key === 'Escape') {
      this.service.backgroundImage = null;
      this.scene.background = null;
    } else if (event.key === 'z' || event.key === 'Z') {
      this.renderGroup.rotation.x += 0.01;
    } else if (event.key === 'q' || event.key === 'Q') {
      this.renderGroup.rotation.z += 0.01;
    } else if (event.key === 's' || event.key === 'S') {
      this.renderGroup.rotation.x -= 0.01;
    } else if (event.key === 'd' || event.key === 'D') {
      this.renderGroup.rotation.z -= 0.01;
    } else if (event.key === 'f' || event.key === 'F') {
      this.renderGroup.rotation.y += 0.01;
    } else if (event.key === 'r' || event.key === 'R') {
      this.renderGroup.rotation.y -= 0.01;
    } else if (event.key === 'o' || event.key === 'O') {
      this.renderGroup.position.z -= 0.05;
    } else if (event.key === 'l' || event.key === 'L') {
      this.renderGroup.position.z += 0.05;
    } else if (event.key === 'k' || event.key === 'K') {
      this.renderGroup.position.x -= 0.05;
    } else if (event.key === 'm' || event.key === 'M') {
      this.renderGroup.position.x += 0.05;
    } else if (event.key === 'h' || event.key === 'H') {
      this.service.import.visible = !this.service.import.visible;
    } else if (event.key === 'w' || event.key === 'W') {
      (this.service.import as Object3D).traverse((el) => {
        if (el instanceof Mesh) {
          el.material.wireframe = !el.material.wireframe;
        }
      });
    } else if (event.key === 'p' || event.key === 'P') {
      this.grid.visible = !this.grid.visible;
    }

    this.controls.update();
    this.camera.updateProjectionMatrix();
  }

  get scene() {
    return this.service.scene;
  }

  get camera() {
    return this.service.camera;
  }

  get controls() {
    return this.service.controls;
  }

  get renderer() {
    return this.service.renderer;
  }

  get renderGroup() {
    return this.service.renderGroup;
  }

  get groundMesh() {
    return this.service.groundMesh;
  }

  set scene(val: Scene) {
    this.service.scene = val;
  }

  set renderer(val: WebGLRenderer) {
    this.service.renderer = val;
  }

  set camera(val: PerspectiveCamera) {
    this.service.camera = val;
  }

  set controls(val: OrbitControls) {
    this.service.controls = val;
  }
  set groundMesh(val: Mesh) {
    this.service.groundMesh = val;
  }
}
