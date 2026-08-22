# SyncFocus & ProjectHub – Frontend 🚀
> Reaktives Fullstack-Ökosystem für agiles Projekt- und Selbstmanagement

Dieses Repository enthält das **Frontend** der Applikation, eine ganzheitliche Plattform, die klassisches Taskmanagement mit strategischer Projektplanung, Team-Kollaboration, KI-gestützten Empfehlungen und feingranularer Administration vereint.

---

## 🏗️ Technologischer Stack (Frontend)
* **Framework:** Angular 21 (Moderne Standalone-Architektur mit Signals & Reactive Control Flow)
* **Reaktivität & Datenfluss:** RxJS-Pipelines, Angular Signals (`signal`, `computed`), Reactive Forms
* **Interaktivität:** Angular CDK Drag & Drop (Kanban-Systeme & Quick-Trash)
* **UI/UX Design:** CSS3/SCSS (Custom Glassmorphism Look, dynamische Farb-Gradients, Responsive Layouts)
* **Netzwerk & Resilience:** HTTP-Interceptoren (Auth/Error Handling), LocalStorage Queuing & Offline-Sync

---

## 🧩 Kern-Module der Plattform

1. **👑 Administrator-Zentrale (Admin Board):**
   * **Abteilungs-Verwaltung:** Erstellung, Bearbeitung und automatischer Systemschutz geschützter Bereiche.
   * **Benutzer-Approval & Kanban:** Drag-and-Drop-Warteraum zur Zuweisung neuer Benutzer in Abteilungen, Rollenvergabe und Schnell-Ablehnung via Mülleimer-Zone.
   * **Berechtigungs-Matrix (Permissions):** Feingranulares System zur Verwaltung von Rollen, Ressourcen, Aktionen und Scopes – inklusive Klapp-Modus, Inline-Editing und Sicherheits-Validationen.

2. **🤖 KI-Gestützter Smartplaner & Fokus-Zentrum:**
   * **Dual-KI-Empfehlungs-System:** Benutzer erhalten intelligente Vorschläge zur Aufgaben-Priorisierung von zwei Modellen (Bayes-Klassifikator & kompaktes Neuronales Netz) und können direkt zwischen den Empfehlungen wählen.
   * **Pomodoro-Fokustimer:** Integrierte Workflows für unterbrechungsfreies Arbeiten.

3. **📋 Agiles Task-Board:** 
   * Flexibles Arbeiten über Listenansichten oder ein interaktives Kanban-Board, erweitert um eine Expresserfassung für schnelle Retrospektiven.

4. **💡 Smarte Projekt- & Meilenstein-Kalkulation (Ideenboard):**
   * Verknüpfung von Ideenfindung mit Projektkalkulation, Meilenstein-Definition und Ressourcenplanung.

5. **📊 Analytisches Statistik-Dashboard *(Work in Progress)*:**
   * Deep-Dive-Auswertungen zur Team-Performance, Tagesauslastung und Fokussessions (aktuell in kontinuierlicher Erweiterung).

---

## 🛠️ Installation & Start

### Voraussetzungen
* **Node.js:** v20.x oder v22.x (LTS)
* **Angular CLI:** v21.x oder höher 🚀
* 
### Schritte
1. Repository klonen:
   ```bash
   git clone <https://github.com/ekoshman77-coder/circus-kanban-frontend>
   cd <StartProject>

2. Abhängigkeiten installieren:
```bash
npm install
```

3. Entwicklungs-Server starten:

```bash
ng serve
```
Wenn server läuft navigieren zu `http://localhost:4200/`


## Testing & Build

Unit Tests ausführen:

```bash
ng test
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

```bash
ng test
```

## Running end-to-end tests

```bash
ng e2e
```

## Production Build erstellen:

```bash
ng build
```

👥 Team & Projektbeteiligte

    Elena Koshman – Lead Developer & Software-Architektin
    Gemini (Google) – Co-Developer (Architektur, UI/UX-Design & Code-Entwicklung)