import { describe, it, expect, beforeEach } from 'vitest';
import { UserModel } from './user-model';
import { IUserInit } from './user-model'; // Da IUserInit in derselben Datei definiert ist

describe('UserModel', () => {
  let defaultData: IUserInit;

  beforeEach(() => {
    // Ein vollständiges, gültiges Standardobjekt für unsere Tests
    defaultData = {
      id: 'user-123',
      username: 'codemaster',
      firstName: 'Max',
      lastName: 'Mustermann',
      projectIds: ['proj-1'],
      coffeeBalance: 5,
      role: 'DEVELOPER',
      emoji: '🦊'
    };
  });

  it('sollte ein UserModel korrekt mit den Initialisierungsdaten erstellen', () => {
    const user = new UserModel(defaultData);
    expect(user.id).toBe('user-123');
    expect(user.username).toBe('codemaster');
    expect(user.emoji).toBe('🦊');
  });

  it('sollte Standardwerte setzen, wenn optionale Felder fehlen', () => {
    const minimalData: IUserInit = {
      id: '',
      username: 'guest',
      firstName: 'Solo',
      lastName: '',
      projectIds: []
    };

    const user = new UserModel(minimalData);
    expect(user.coffeeBalance).toBe(0); // Standard-Fallback
    expect(user.emoji).toBe('🦊');       // Standard-Emoji
    expect(user.role).toBe('');         // Standard-Rolle
  });

  it('sollte den vollen Namen korrekt kombinieren', () => {
    const user = new UserModel(defaultData);
    expect(user.fullName).toBe('Max Mustermann');
  });

  it('sollte die Initialen korrekt generieren', () => {
    const user = new UserModel(defaultData);
    expect(user.getInitials()).toBe('MM');
  });

  it('sollte ein Fragezeichen für Initialen zurückgeben, wenn Vor- und Nachname leer sind', () => {
    const emptyUser = new UserModel({
      id: '1',
      username: 'anon',
      firstName: '',
      lastName: '',
      projectIds: []
    });
    expect(emptyUser.getInitials()).toBe('?');
  });

  it('sollte einen konsistenten Farb-Hash basierend auf dem Usernamen generieren', () => {
    const user1 = new UserModel(defaultData);
    const user2 = new UserModel(defaultData);
    
    // Gleicher Username muss dieselbe Farbe erzeugen
    expect(user1.getColorHash()).toBe(user2.getColorHash());
    expect(user1.getColorHash()).toContain('hsl');
  });

  it('sollte bei fehlendem Usernamen ein Fallback-Grau für die Farbe zurückgeben', () => {
    const namelessUser = new UserModel({
      id: '1',
      username: '',
      firstName: 'No',
      lastName: 'Name',
      projectIds: []
    });
    expect(namelessUser.getColorHash()).toBe('#cbd5e1');
  });
});