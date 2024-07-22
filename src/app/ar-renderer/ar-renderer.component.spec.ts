import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArRendererComponent } from './ar-renderer.component';

describe('ArRendererComponent', () => {
  let component: ArRendererComponent;
  let fixture: ComponentFixture<ArRendererComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArRendererComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ArRendererComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
