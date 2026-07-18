import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoteComponent } from './note-component';
import { NoteViewModel } from '../../../core/viewmodel/note-view-model';
import { UserService } from '../../../core/services/user/user-service';
import { signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { vi } from 'vitest';

describe('NoteComponent', () => {
    let component: NoteComponent;
    let fixture: ComponentFixture<NoteComponent>;
    
    // 👤 Wir bauen uns ein reaktives Mock-Signal für den aktuellen User
    const mockUserIdSignal = signal<string | null>('user-123');
    
    const mockUserService = {
        getCurrentUserId: vi.fn().mockImplementation(() => mockUserIdSignal())
    };

    // 📦 Eine Test-Note vorbereiten
    const mockNote = {
        id: 'note-999',
        title: 'Kreative Idee',
        content: 'Wir bauen einen Schlitz-Effekt',
        tag: 'UI-Design',
        colorType: 'note-blue',
        userId: 'user-123', // Gehört standardmäßig unserem Test-User
        isInCalculation: false
    };

    beforeEach(async () => {
        // Signal vor jedem Test auf den Standard-User zurücksetzen
        mockUserIdSignal.set('user-123');

        await TestBed.configureTestingModule({
            imports: [NoteComponent, FormsModule],
            providers: [
                { provide: UserService, useValue: mockUserService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(NoteComponent);
        component = fixture.componentInstance;
        
        // Das ViewModel frisch instanziieren und der Komponente übergeben
        component.vm = new NoteViewModel(mockNote as any);
        fixture.detectChanges();
    });

    it('sollte die Komponente erfolgreich erstellen', () => {
        expect(component).toBeTruthy();
    });

    // 🔒 TEST-REIHE 1: BERECHTIGUNGEN & SCHREIBSCHUTZ
    describe('🔒 Berechtigungen', () => {
        it('sollte Editieren erlauben, wenn die Note dem angemeldeten User gehört', () => {
            fixture.detectChanges();
            expect(component.vm.canEdit(component.currentUserId())).toBe(true);
        });

        it('sollte Schreibschutz aktivieren, wenn die Note einem anderen User gehört', () => {
            // Wir simulieren, dass ein anderer User eingeloggt ist
            mockUserIdSignal.set('user-fremd');
            fixture.detectChanges();

            expect(component.vm.canEdit(component.currentUserId())).toBe(false);
        });
    });

    // 📝 TEST-REIHE 2: EDITIER-LOGIK & KEY-EVENTS
    describe('📝 Inline-Editing & Events', () => {
        it('sollte beim Aufruf von saveEdit den Edit-Modus beenden und Event funken', () => {
            const spyEmit = vi.spyOn(component.updated, 'emit');
            component.vm.startEdit();
            
            component.saveEdit();

            expect(component.vm.isEditing()).toBe(false);
            expect(spyEmit).toHaveBeenCalledWith(component.vm.note);
        });

        it('sollte bei einfachem Enter-Tastendruck die Änderungen speichern', () => {
            const spySave = vi.spyOn(component, 'saveEdit');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false });

            component.onKeyDown(enterEvent);

            expect(spySave).toHaveBeenCalled();
        });

        it('sollte bei Shift+Enter NICHT speichern (Zeilenumbruch in der Textarea erlauben)', () => {
            const spySave = vi.spyOn(component, 'saveEdit');
            const shiftEnterEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });

            component.onKeyDown(shiftEnterEvent);

            expect(spySave).not.toHaveBeenCalled();
        });
    });
});