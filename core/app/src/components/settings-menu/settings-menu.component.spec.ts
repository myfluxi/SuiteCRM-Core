import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {SettingsmenuUiComponent} from './settings-menu.component';

describe('SettingsmenuUiComponent', () => {
    let component: SettingsmenuUiComponent;
    let fixture: ComponentFixture<SettingsmenuUiComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [SettingsmenuUiComponent]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(SettingsmenuUiComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });
});