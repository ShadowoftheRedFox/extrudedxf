import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadBackgroundImageComponent } from './upload-background-image.component';

describe('UploadBackgroundImageComponent', () => {
  let component: UploadBackgroundImageComponent;
  let fixture: ComponentFixture<UploadBackgroundImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadBackgroundImageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UploadBackgroundImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
