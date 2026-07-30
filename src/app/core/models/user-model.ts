import { generateLocalId, isLocalId } from "../shared/constants/id-const";

  export type ProjectRole = 'OWNER' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'DESIGNER' | 'VIEWER' | 'NONE';

  export interface IUserInit {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  isApproved: boolean | null,
  projectIds: string[],
  coffeeBalance?: number,
  role?: string,
  emoji?: string
}

/**
 * Repräsentiert das User-Objekt innerhalb der Anwendung.
 * Verantwortlich für Datenmodellierung, Formatierung der Benutzerdaten 
 * und geschäftsspezifische Logik (wie Farb-Hashes oder Initialen).
 */
export class UserModel {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  coffeeBalance: number;
  departmentId: string | null;
  isApproved: boolean | null;
  projectIds: string[];
  role: string;
  emoji: string;

  constructor(data: IUserInit) {
    this.id = data.id || generateLocalId();
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.username = data.username || '';
    this.departmentId = data.departmentId?? null;
    this.isApproved = data.isApproved?? null;
    this.projectIds = data.projectIds || [];
    this.coffeeBalance = data.coffeeBalance?? 0;
    this.role = data.role?? ''
    this.emoji = data.emoji?? "🦊"
  }

  /**
   * Gibt den vollständigen Namen des Benutzers zurück.
   * @returns Der kombinierte Vor- und Nachname, bereinigt von Leerzeichen.
   */  
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /**
   * Erzeugt die Benutzer-Initialen basierend auf den Namen.
   * @returns Die ersten Buchstaben von Vor- und Nachname in Großbuchstaben, 
   * oder '?' falls keine Daten vorhanden sind.
   */
  getInitials(): string {
    const first = this.firstName.charAt(0) || '';
    const last = this.lastName.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  }

  /**
   * Generiert eine konsistente, ästhetische Pastell-Farbe basierend auf dem Usernamen.
   * Ideal für Avatare oder UI-Elemente, um Nutzern visuell identifizierbar zu machen.
   * @returns Eine HSL-Farbzeichenkette (z.B. 'hsl(210, 70%, 75%)').
   */
  getColorHash(): string {
    if (!this.username) return '#cbd5e1'; // Fallback-Grau

    let hash = 0;
    for (let i = 0; i < this.username.length; i++) {
      hash = (hash * 31) + this.username.charCodeAt(i);
      hash = (hash << 5) - hash + (this.username.charCodeAt(i) * 12345);
    }

    const spreadValue = Math.abs(hash * 777);
    const h = spreadValue % 360;

    const s = 70; // Sättigung (Tick höher für kräftigere Pastelltöne)
    const l = 75; // Helligkeit (Tick dunkler, damit man die Unterschiede besser sieht)

    return `hsl(${h}, ${s}%, ${l}%)`;
  }

public static fromJson(json: any): UserModel {
    return new UserModel({
      id: json.id,
      firstName: json.firstName,
      lastName: json.lastName,
      username: json.username,
      // 🟢 HIER IST DIE MAGIE: Exakt matchen mit dem Namen aus deinem Kotlin UserResponseDTO!
      coffeeBalance: json.coffeeBalance !== undefined ? json.coffeeBalance : 0,
      isApproved: json.isApproved,
      departmentId: json.departmentId,
      projectIds: json.projectIds || [],
      // Falls das Backend diese Felder irgendwann mitschickt, liest er sie aus, sonst greift der Konstruktor-Fallback
      emoji: json.emoji?? "🦊",
      role: json.role?? "DEVELOPER"
    });
  }

public toJson(): any {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      username: this.username,
      // 🟢 HIER ERGÄNZEN: Damit der Server die Balance beim Senden auch versteht
      coffeeBalance: this.coffeeBalance,
      departmentId: this.departmentId,
      isApproved: this.isApproved,
      projectIds: this.projectIds,
      // Falls die Rolle und das Emoji auch wieder zurückgespeichert werden sollen:
      emoji: this.emoji,
      role: this.role
    };
  }
}