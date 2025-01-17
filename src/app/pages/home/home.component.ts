import { Component, inject } from '@angular/core';
import { UploadFilesComponent } from '../../components/upload-files/upload-files.component';
import { RendererComponent } from '../../renderer/renderer.component';
import { UploadBackgroundImageComponent } from '../../components/upload-background-image/upload-background-image.component';
import { RendererService } from '../../services/renderer.service';

@Component({
  selector: 'ft-home',
  standalone: true,
  imports: [
    RendererComponent,
    UploadFilesComponent,
    UploadBackgroundImageComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  rendererService = inject(RendererService);
}
