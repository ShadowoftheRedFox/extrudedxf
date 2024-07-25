import { Component, OnInit, inject } from '@angular/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RendererService } from '../../services/renderer.service';
import { Box3, Box3Helper, BoxGeometry, Color, Mesh, MeshBasicMaterial, TextureLoader, Vector3 } from 'three';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'ft-upload-files',
  standalone: true,
  imports: [],
  templateUrl: './upload-files.component.html',
  styleUrl: './upload-files.component.scss',
})
export class UploadFilesComponent implements OnInit {
  rendererService = inject(RendererService);
  configService = inject(ConfigService);
  loader = new GLTFLoader();

  ngOnInit(): void {
    if (this.configService.defaultContent.enabled) {
      const textureLoader = new TextureLoader();
      const textureDefault = textureLoader.load(this.configService.defaultContent.background, () => {
        // met l'image en fond
        this.rendererService.backgroundImage = textureDefault;
        this.rendererService.scene.background = textureDefault;
        this.rendererService.scene.backgroundIntensity = 0.5;
      });
      // ajoute l'objet
      fetch(this.configService.defaultContent.group).then(res => res.text().then(buff => {
        this.loader.parse(buff as string, '', (glb) => {
          this.rendererService.import = glb.scene;
          this.rendererService.import.name = "Pergola"
          // TODO test sans objet pergo
          const geometry = new BoxGeometry(1, 1, 1);
          const material = new MeshBasicMaterial({ color: 0x226387 });
          const cube = new Mesh(geometry, material);
          this.renderGroup.add(cube);
          // this.renderGroup.add(this.rendererService.import);

          console.log("Groupe: ", this.renderGroup);

          // fait regarder la caméra sur l'object ajouté
          const box = new Box3().setFromObject(this.renderGroup);
          const camVect = new Vector3();
          box.getSize(camVect);
          // this.camera.lookAt(camVect.divideScalar(1).add(this.renderGroup.position));

          // Ajout de support/debug
          if (this.configService.defaultContent.helperBox) {
            const boxHelper = new Box3Helper(
              new Box3().expandByObject(this.renderGroup, true),
              new Color(0xff0000)
            );
            boxHelper.name = "boxHelper";
            // this.renderGroup.add(boxHelper)
          }
        });
      }))
    }
  }

  handle3DObjectUpload(e: HTMLInputElement) {
    if (!e.files) {
      return;
    }

    const file = e.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;

      this.loader.parse(data as string, '', (glb) => {
        this.rendererService.import = glb.scene;
        this.rendererService.import.name = "Pergola"
        this.renderGroup.add(glb.scene);

        console.log("Groupe: ", this.renderGroup);

        // Ajout de support/debug
        if (this.configService.defaultContent.helperBox) {
          const boxHelper = new Box3Helper(
            new Box3().expandByObject(this.renderGroup, true),
            new Color(0xff0000)
          );
          boxHelper.name = "boxHelper";
          this.renderGroup.add(boxHelper)
        }
      });
    };
    reader.readAsArrayBuffer(file);
  }

  get renderGroup() {
    return this.rendererService.renderGroup;
  }

  get camera() {
    return this.rendererService.camera;
  }
}
