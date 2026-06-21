// src/app/core/constants/milestone-templates.ts

export interface TemplateMilestone {
  title: string;
  duration: number;
}

export const MILESTONE_TEMPLATES: Record<string, TemplateMilestone[]> = {
  'Frontend': [
    { title: '📦 Projekt-Setup & UI-Design-System spiegeln', duration: 1 },
    { title: '🎨 Layout-Komponenten & Responsive Views erstellen', duration: 3 },
    { title: '🔄 State-Management, RxJS/Signals & API-Services anbinden', duration: 3 },
    { title: '🧪 Unit-Tests schreiben & Deployment-Pipeline prüfen', duration: 1 }
  ],
  'Backend': [
    { title: '🗄️ Datenmodell entwerfen & Liquibase/Flyway Migrationen', duration: 2 },
    { title: '🛡️ Security, JWT-Authentifizierung & User-Rollen aufsetzen', duration: 2 },
    { title: '⚙️ REST-API Endpunkte (Kotlin/Spring) implementieren', duration: 4 },
    { title: '📈 Integrationstests & API-Dokumentation (Swagger/OpenAPI)', duration: 1 }
  ],
  'Design': [
    { title: '🗺️ User Research, Wireframes & User Flows skizzieren', duration: 2 },
    { title: '🎨 High-Fidelity Prototyp in Figma ausarbeiten', duration: 4 },
    { title: '📐 Design-System (Farben, Typo, Spacings) dokumentieren', duration: 2 },
    { title: '📦 Assets exportieren & Developer Hand-off vorbereiten', duration: 1 }
  ],
  'Allgemein': [
    { title: '📋 Anforderungen analysieren & User Stories verfeinern', duration: 1 },
    { title: '🚀 Initiales Deployment & CI/CD Pipeline aufsetzen', duration: 2 },
    { title: '🏁 Finales Testing, Code Review & Release-Vorbereitung', duration: 2 }
  ]
};