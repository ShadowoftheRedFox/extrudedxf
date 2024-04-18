import { Component, inject } from '@angular/core';
import { Box3, Box3Helper, Color, TextureLoader } from 'three';
import { RendererService } from '../../services/renderer.service';

@Component({
  selector: 'ft-upload-background-image',
  standalone: true,
  imports: [],
  templateUrl: './upload-background-image.component.html',
  styleUrls: ['./upload-background-image.component.scss'],
})
export class UploadBackgroundImageComponent {
  rendererService = inject(RendererService);
  textureLoader = new TextureLoader();

  onUploadBackgroundImage(e: HTMLInputElement) {
    if (!e.files) {
      return;
    }

    const file = e.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const imageAspectRatio = img.width / img.height;
        const viewportAspectRatio = viewportWidth / viewportHeight;

        let newWidth, newHeight;

        if (imageAspectRatio > viewportAspectRatio) {
          newWidth = viewportWidth;
          newHeight = newWidth / imageAspectRatio;
        } else {
          newHeight = viewportHeight;
          newWidth = newHeight * imageAspectRatio;
        }

        this.rendererService.resizeRenderer(newWidth, newHeight);
        console.log("Nouvelle largeur de l'image :", newWidth);
        console.log("Nouvelle hauteur de l'image :", newHeight);
      };
      img.src = event.target?.result as string;

      const dataUrl = event.target?.result;
      const texture = this.textureLoader.load(dataUrl as string, () => {
        this.rendererService.backgroundImage = texture;
        this.rendererService.scene.background = texture;

        this.draw_helper_renderGroup();
      });
    };
    reader.readAsDataURL(file);
  }

  draw_helper_renderGroup() {
    this.renderGroup.add(
      new Box3Helper(
        new Box3().expandByObject(this.renderGroup),
        new Color(0xff0000)
      )
    );
  }

  get renderGroup() {
    return this.rendererService.renderGroup;
  }
}
