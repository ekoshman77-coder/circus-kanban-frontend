import { describe, it, expect, beforeEach } from 'vitest';
import { UserModel, IUserInit } from './user-model';

describe('UserModel (Vitest - Strictly Typed)', () => {
  let defaultData: IUserInit;

  beforeEach(() => {
    // Vollständiges Standardobjekt gemäß aktuellem IUserInit Interface
    defaultData = {
      id: 'user-123',
      username: 'codemaster',
      firstName: 'Max',
      lastName: 'Mustermann',
      department: null,
      departmentRole: 'Entwickler',
      isApproved: true,
      projectIds: ['proj-1'],
      coffeeAccount: {
        balance: 5,
        role: 'Kaffee-Junkie',
        emoji: '🦊'
      }
    };
  });

  it('sollte ein UserModel korrekt mit den Initialisierungsdaten erstellen', () => {
    const user = new UserModel(defaultData);

    expect(user.id).toBe('user-123');
    expect(user.username).toBe('codemaster');
    expect(user.departmentRole).toBe('Entwickler');
    expect(user.coffeeAccount.balance).toBe(5);
    expect(user.coffeeAccount.role).toBe('Kaffee-Junkie');
    expect(user.coffeeAccount.emoji).toBe('🦊');
  });

  it('sollte Standardwerte setzen, wenn optionale Felder fehlen', () => {
    const minimalData: IUserInit = {
      id: '',
      username: 'guest',
      firstName: 'Solo',
      lastName: '',
      department: null,
      isApproved: false,
      projectIds: []
    };

    const user = new UserModel(minimalData);

    expect(user.coffeeAccount.balance).toBe(0);          // Standard-Fallback
    expect(user.coffeeAccount.role).toBe('Teammitglied'); // Standard-Rolle
    expect(user.coffeeAccount.emoji).toBe('🦊');          // Standard-Emoji
    expect(user.departmentRole).toBe('');                 // Standard-Abteilungsrolle
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
      department: null,
      isApproved: true,
      projectIds: []
    });

    expect(emptyUser.getInitials()).toBe('?');
  });

  it('sollte einen konsistenten Farb-Hash basierend auf dem Usernamen generieren', () => {
    const user1 = new UserModel(defaultData);
    const user2 = new UserModel(defaultData);
    
    expect(user1.getColorHash()).toBe(user2.getColorHash());
    expect(user1.getColorHash()).toContain('hsl');
  });

  it('sollte bei fehlendem Usernamen ein Fallback-Grau für die Farbe zurückgeben', () => {
    const namelessUser = new UserModel({
      id: '1',
      username: '',
      firstName: 'No',
      lastName: 'Name',
      department: null,
      isApproved: true,
      projectIds: []
    });

    expect(namelessUser.getColorHash()).toBe('#cbd5e1');
  });

  describe('JSON Konvertierung & Abteilungs-Logik', () => {
    it('sollte ein UserModel aus flachem JSON korrekt deserialisieren (fromJson)', () => {
      const json = {
        id: 'json-1',
        username: 'devguy',
        firstName: 'Erika',
        lastName: 'Musterfrau',
        isApproved: true,
        department_role: 'Lead',
        coffeeBalance: 10,
        role: 'Barista',
        emoji: '☕'
      };

      const user = UserModel.fromJson(json);

      expect(user.id).toBe('json-1');
      expect(user.departmentRole).toBe('Lead');
      expect(user.coffeeAccount.balance).toBe(10);
      expect(user.coffeeAccount.role).toBe('Barista');
      expect(user.coffeeAccount.emoji).toBe('☕');
    });

    it('sollte das UserModel inklusive CoffeeAccount korrekt serialisieren (toJson)', () => {
      const user = new UserModel(defaultData);
      const json = user.toJson();

      expect(json.id).toBe('user-123');
      expect(json.coffeeBalance).toBe(5);
      expect(json.coffeeAccount).toEqual({
        balance: 5,
        role: 'Kaffee-Junkie',
        emoji: '🦊'
      });
    });

    it('sollte isAdmin() false zurückgeben, wenn keine Abteilung zugewiesen ist', () => {
      const user = new UserModel(defaultData);
      expect(user.isAdmin()).toBe(false);
    });
  });
});