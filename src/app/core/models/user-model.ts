import { IUserJSON } from "../repositories/dto/user-json";
import { generateLocalId, isLocalId } from "../shared/constants/id-const";

export interface IUserInit {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  projectIds: string[],
  coffeeBalance?: number,
  role?: string,
  emoji?: string
}

export class UserModel {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  coffeeBalance: number;
  projectIds: string[];
  role: string;
  emoji: string;

  constructor(data: IUserInit) {
    this.id = data.id || generateLocalId();
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.username = data.username || '';
    this.projectIds = data.projectIds || [];
    this.coffeeBalance = data.coffeeBalance?? 0;
    this.role = data.role?? "teammember"
    this.emoji = data.emoji?? "🦊"
  }

  
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /**
   * Generiert die Initialen aus Vor- und Nachname
   */
  getInitials(): string {
    const first = this.firstName.charAt(0) || '';
    const last = this.lastName.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  }

  /**
   * Generiert einen festen, wunderschönen Pastell-Farbton basierend auf dem Usernamen!
   */
  getColorHash(): string {
    if (!this.username) return '#cbd5e1'; // Fallback-Grau

    let hash = 0;
    for (let i = 0; i < this.username.length; i++) {
      // 1. KNISS: Wir multiplizieren den alten Hash mit einer großen Primzahl (31) 
      // und erhöhen den Einfluss des aktuellen Buchstabens massiv!
      hash = (hash * 31) + this.username.charCodeAt(i);

      // 2. KNIFF: Bitweise Verschiebung kombiniert mit einer wilden Multiplikation,
      // um die Bits bei jedem Schritt komplett durchzumischen.
      hash = (hash << 5) - hash + (this.username.charCodeAt(i) * 12345);
    }

    // 3. KNIFF: Den Farbkreis (0-360) "aufspreizen"
    // Statt einfach nur Modulo (%) zu rechnen, multiplizieren wir den Wert mit einer 
    // großen ungeraden Zahl, damit benachbarte Hashes weit auseinanderfliegen!
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
      projectIds: json.projectIds || [],
      // Falls das Backend diese Felder irgendwann mitschickt, liest er sie aus, sonst greift der Konstruktor-Fallback
      emoji: json.emoji?? "🦊",
      role: json.role?? "Teammember"
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
      projectIds: this.projectIds,
      // Falls die Rolle und das Emoji auch wieder zurückgespeichert werden sollen:
      emoji: this.emoji,
      role: this.role
    };
  }
}