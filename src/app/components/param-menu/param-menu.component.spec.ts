import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParamMenuComponent } from './param-menu.component';

describe('ParamMenuComponent', () => {
  let component: ParamMenuComponent;
  let fixture: ComponentFixture<ParamMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParamMenuComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ParamMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
