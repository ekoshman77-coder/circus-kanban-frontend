# SyncFocus & ProjectHub – Frontend 🚀
> Reaktives Fullstack-Ökosystem für agiles Projekt- und Selbstmanagement

Dieses Repository enthält das **Frontend** der Applikation, eine ganzheitliche Plattform, die klassisches Taskmanagement mit strategischer Projektplanung, Team-Kollaboration, KI-gestützten Empfehlungen und feingranularer Administration vereint.

---

## 🏗️ Technologischer Stack
* **Framework:** Angular 21 (Moderne Standalone-Architektur mit Signals & Reactive Control Flow)
* **Reaktivität & Datenfluss:** RxJS-Pipelines, Angular Signals (`signal`, `computed`), Reactive Forms
* **Interaktivität:** Angular CDK Drag & Drop (Kanban-Systeme & Quick-Trash)
* **UI/UX Design:** CSS3/SCSS (Custom Glassmorphism Look, dynamische Farb-Gradients, Responsive Layouts)
* **Backend Integration:** Kotlin, Spring Boot, Spring Data JPA Specifications
* **Netzwerk & Resilience:** HTTP-Interceptoren (Auth/Error Handling), LocalStorage Queuing & Offline-Sync

---

## 📖 Architektur-Handbuch & Dokumentation

### 1. Kern-Architektur & Offline-First (Core & Offline-First)

#### 1.1. Betriebsmodi des Systems („Zwei-Hüte“-Modell)
Das System unterstützt zwei zentrale Betriebsmodi, die über den `CentralQueueService` gesteuert werden:
* **Live Mode (Standardmodus):** Alle Änderungen werden lokal sofort angewendet (Optimistic Updates). Mutationen werden sequenziell über eine zentrale FIFO-Warteschlange (`CentralQueueService`) an den Server gesendet. Bei Verbindungsabbrüchen (`ConnectionService`) wird das Senden pausiert und die Anfragen werden gepuffert, bis die Verbindung wiederhergestellt ist.
* **Labor Mode (Isolierte Sandbox):** Konzipiert für sicheres Arbeiten von Praktikanten und isolierte Experimente. Alle Mutationen werden lokal angewendet, aber nicht an den Server gesendet. Änderungen werden in Form von Draft-Ketten (Entwurfsketten) gespeichert. Der Benutzer kann die gesamte Kette an einen anderen Benutzer (z. B. einen Betreuer) senden oder beim Wechsel zurück in den Live Mode auf den Server anwenden.

#### 1.2. Zentralisierte Steuerung (CentralQueueService)
Der `CentralQueueService` dient als einheitlicher Einstiegspunkt (Wrapper/Facade) für alle Datenmutationen und verbirgt die Details des aktuellen Betriebsmodus vor dem Rest der Anwendung:
* **Dynamische Steuerung:** Verwaltet dynamisch zwei Betriebsmodi über den Injector: Den Live-Modus (`LiveCentralQueueService`) für den Produktivbetrieb mit echter Netzwerkanbindung und den Labor-Modus / Sandbox (`LaborCentralQueueService`) für isoliertes Experimentieren.
* **Transparenz für den Client:** Andere Dienste und Komponenten kommunizieren ausschließlich über den Facade-Layer.
* **Persistenz & Sequenzierung:** Steuert die Persistenz über den `LocalStorage` und verarbeitet anstehende Aktionen sequenziell.
* **Sitzungssicherheit:** Hängende Netzwerkoperationen (`cancelInFlight$`) werden beim Logout sauber bereinigt.

#### 1.3. Die Queue-Grundstrukturen (`QueueItem` & `SnapshotPayload`)
* Jedes Queue-Item besitzt eine eindeutige ID, den zugehörigen `serviceName` (gemäß `QueueHandlerName`), die `action` sowie ein typisiertes `payload`.
* Das Payload erbt von `SnapshotPayload` und enthält neben den eigentlichen Nutzdaten auch `displayInfo` (Kategorie und Titel) für Benachrichtigungen, Draft-Boxen und UI-Entwürfe.

#### 1.4. Das Data-Manager-Muster & Sanitization-Modul
* **BaseQueueDataManager & StateProvider:** Jeder fachliche Bereich implementiert einen eigenen Data-Manager (z. B. `PlannerDataManagerService` oder den `SanitizationDataManager`), der das Interface `IQueueHandler` implementiert.
* **State-Verwaltung:** Komplexe States laufen über spezialisierte `StateProvider` (wie den `EmptyStateProvider` für Services ohne lokalen Listen-State wie die Sanitization).
* **Automatisches Error- & Rollback-Handling:** Bei Serverfehlern (4xx/Netzwerk) greifen automatisierte Rollbacks, Shadow-Modi für Forward-Replays und die Einbindung in den `NotificationService`.
* **Integration des Sanitization-Moduls:** Der neue `SanitizationDataManager` schickt Mustererstellungen (`CREATE_PATTERN`) gekapselt in ein `CreatePatternPayload` an die Queue. Dadurch ist das Anlernen sensibler Muster vollständig offline-resilient, vor Duplikaten geschützt (Backend-Validierung mit HTTP 409 / `ResourceAlreadyExistsException`) und labor-tauglich.

---

### 2. Dreistufige Architektur der Services (Clean Layering)

To keep the application maintainable, scalable, and clean, data handling is strictly split across three layers:
* **DataManagers** (z. B. `AdminTodoDataManagerService`, `DepartmentDataManager`): Niedrigetagierte Netzwerk-, Offline-Cache- und Queue-Verwaltung ohne UI-Logik; liefern Daten über reaktive Signale (`getSignal(): Signal<T[]>`).
* **Services / Facades** (z. B. `AdminTodoService`, `DepartmentService`): UI-Fassaden, die mehrere Data-Manager bündeln, Signale für Interfaces vorbereiten und die Sortierung steuern.
* **Components** (z. B. `AdminTodoBoardComponent`): Reines Rendering und Handling von Benutzeraktionen unter strikter Einhaltung des **Spiegelungsprinzips** (alle Signale und Methoden werden in der TypeScript-Klasse explizit gespiegelt, z. B. `public isOnline = this.adminTodoService.isOnline`, um direkte Aufrufe tiefer Abhängigkeiten im HTML-Template zu vermeiden).

---

### 3. Entwürfe (Drafts) & Fehlerbehandlung (Failure-Ketten)

* **Draft-Ketten:** Im Labor-Modus oder bei Offline-Zuständen werden Mutationen gesammelt und als Draft-Ketten verwaltet.
* **Failure-Ketten:** Fehlgeschlagene Anfragen im Live-Modus (Netzwerkfehler, Timeouts) werden vom `CentralQueueService` abgefangen, in `Failure-Ketten` umgewandelt und in die Drafts überführt.
* **Fehlerbehebung:** Benutzer können fehlerhafte Anfragen einsehen, Daten korrigieren oder das Senden erneut versuchen, ohne dass Daten verloren gehen.
* **403 Forbidden & Eskalation:** Bei Zugriffsfehlern (HTTP 403) aufgrund von RBAC-Einschränkungen werden Drafts gesichert und können an Administratoren oder Vorgesetzte zur Bestätigung eskaliert werden.

---

### 4. Manager Registry & Interface Uniformity

* **Enum & Record Konfiguration:** Alle Manager-Namen sind in einem `DataManagerType`-Enum fixiert und werden über eine Record-Konstante beim Start instantiiert und registriert.
* **Polymorphismus:** Jeder DataManager implementiert das Interface `IQueueHandler` für einheitliche Fetch-, Signal-, Rollback- und Rollforward-Operationen.
* **Massen- und gezielte Operationen:** Ermöglicht zweiphasiges Bootstrapping beim Start, Cleanup beim Logout sowie präzise Zielansprachen einzelner Queue-Items anhand ihres `DataManagerType`.

---

### 5. Navigation & UI-Struktur

#### 5.1. App Header & AppTitle
* **Gamification:** Display von Level-Icon (`levelIcon`), Titel (`levelTitle`), dynamischem XP-Fortschrittsbalken (`progressPercent()`) und genauer Punktzahl.
* **Netzwerkstatus:** Live-Anzeige der Verbindung zum Kotlin-Server (`ConnectionService`) über visuelle Indikatoren.
* **Draft Badge:** Schnelle Anzeige ausstehender lokaler Entwürfe.

#### 5.2. Routing & Menüstruktur
* **Haupt-Tabs:** Startseite (`/`), Aufgaben & Board (`/todopage`), Ideen (`/ideas`), Team-Verwaltung (`/team`).
* **Tools-Dropdown (`🧰`):** 
  * Smart Planner (`/planner`) – Umfassende KI-gestützte Zeitplanung.
  * Fokus-Timer (`/focus`) – Pomodoro-basierter Work-Mode.
  * Statistiken (`/statistics`) – Performance-Analyse.
  * Quick-Center (`/quick-center`) – Schnelleingabe-Konsole.
  * Admin-Board (`/admin`) – Geschützt via `@if (isAdmin())` und Routing-Guards; beinhaltet User-Management, Abteilungen, Ideen-Moderation, Projekt-Management (75%-Zone mit Drag-and-Drop) und Admin Todo Board (Direct Fetch).
* **Globale UI-Komponenten:** `StreakPanel` (Streak-Statistiken), `DraftBox` & Floating Button, `GraduationModal` (Aufstiegsmeldung bei Levelup).

---

### 6. Backend-Architektur (Kotlin & Spring Boot)

* **Spring Data JPA Specifications:** Dynamische Abfrageerstellung (z. B. `AdminTodoSpecification`) zur flexiblen Filterung nach Abteilungen, Projekten, Target-Usern, Archivstatus und Datumsbereichen direkt auf Datenbankebene.
* **Direct Fetch:** Optimierte Admin-Endpunkte (z. B. `GET /api/admin/todos/filter`) für den direkten Datenabruf ohne lokalen Queue-Puffer.
* **Dynamische RBAC aus der DB:** Die Berechtigungsmatrix (Permissions, Rollen, Scopes) ist dynamisch in der Datenbank hinterlegt und über eine eigene Admin-Tab-Oberfläche im laufenden Betrieb anpassbar.

---

### 7. Intelligentes KI-Analysesystem (Smart AI Engine)

#### 7.1. Multi-Model Ensemble im Smart Planner
* **Naive Bayes Classifier:** Schnellgewichteter Klassifikator auf Basis von Frequenzen und Historien.
* **Mini-Neural Network:** Leichtgewichtiges neuronales Netz zur Erkennung komplexer Muster bei Prioritäten und Auslastungen.
* Both models suggest priorities in parallel; the user can accept, decline, or choose between them.

#### 7.2. Reinforcement Feedback Loop
* Jede Entscheidung des Benutzers (Annahme/Ablehnung) wird als Label zurückgemeldet, um das System online weiter zu trainieren.

#### 7.3. Textanomalie-Erkennung (Text Anomaly Detection)
* Ein Bayes-Klassifikator prüft Eingaben auf Testmüll, zufällige Zeichenketten oder sensible Daten.
* **Admin-in-the-Loop:** Entdeckt der Klassifikator verdächtigen Text nicht, kann der Administrator das System über das Admin-Panel manuell mit neuen Mustern nachschulen.

#### 7.4. Erweiterter KI-Einsatz im System
* Automatische Task- und Ideen-Kategorisierung.
* Vorschlag von Meilensteinen für Projekte und Quick-Task-Erzeugung.
* Aufwandsschätzung & Empfehlung zur Umwandlung von Ideen in konkrete Aufgaben.
* Prozedurale Erzeugung von Level-Namen im `AppTitle`.

---

## 👥 Team & Projektbeteiligte

* **Elena Koshman** – Lead Developer & Software-Architektin
* **Gemini (Google)** – AI Collaborator & Co-Developer (Architektur, UI/UX-Design & Code-Entwicklung)