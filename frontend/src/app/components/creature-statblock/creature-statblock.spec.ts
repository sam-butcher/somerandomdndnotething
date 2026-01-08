import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatureStatblock } from './creature-statblock';

describe('CreatureStatblock', () => {
  let component: CreatureStatblock;
  let fixture: ComponentFixture<CreatureStatblock>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatureStatblock]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatureStatblock);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
