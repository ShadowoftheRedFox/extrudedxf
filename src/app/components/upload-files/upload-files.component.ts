import { Component, inject } from '@angular/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RendererService } from '../../services/renderer.service';

@Component({
  selector: 'ft-upload-files',
  standalone: true,
  imports: [],
  templateUrl: './upload-files.component.html',
  styleUrl: './upload-files.component.scss',
})
export class UploadFilesComponent {
  rendererService = inject(RendererService);
  loader = new GLTFLoader();

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
        this.renderGroup.add(glb.scene);

        console.log(this.renderGroup);
      });
    };
    reader.readAsArrayBuffer(file);
  }

  get renderGroup() {
    return this.rendererService.renderGroup;
  }
}
