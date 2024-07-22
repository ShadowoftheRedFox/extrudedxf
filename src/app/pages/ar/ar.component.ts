import { Component, inject } from '@angular/core';
import { UploadFilesComponent } from '../../components/upload-files/upload-files.component';
import { UploadBackgroundImageComponent } from '../../components/upload-background-image/upload-background-image.component';
import { ParamMenuComponent } from '../../components/param-menu/param-menu.component';
import { RendererService } from '../../services/renderer.service';
import { ArRendererComponent } from '../../ar-renderer/ar-renderer.component';

@Component({
  selector: 'ft-ar',
  standalone: true,
  imports: [
    ArRendererComponent,
    UploadFilesComponent,
    UploadBackgroundImageComponent,
    ParamMenuComponent,
  ],
  templateUrl: './ar.component.html',
  styleUrl: './ar.component.scss'
})
export class ArComponent {
  rendererService = inject(RendererService);
}
