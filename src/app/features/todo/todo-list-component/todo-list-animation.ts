import { trigger, transition, style, animate } from '@angular/animations';

// --- Bausteine für die Todo-Animation ---
const ENTER_TRANSITION = transition(':enter', [
  style({ 
    opacity: 0, 
    transform: 'translateY(-15px)', 
    height: '0px', 
    marginBottom: '0px',
    paddingTop: '0px',
    paddingBottom: '0px',
    overflow: 'hidden'
  }),
  animate('200ms ease-out', style({ 
    opacity: 1, 
    transform: 'translateY(0)', 
    height: '*', 
    marginBottom: '*',
    paddingTop: '*',
    paddingBottom: '*'
  }))
]);

const LEAVE_TRANSITION = transition(':leave', [
  style({ overflow: 'hidden' }),
  animate('250ms ease-in', style({ 
    opacity: 0, 
    transform: 'translateX(100px)', 
    height: '0px', 
    marginBottom: '0px',
    paddingTop: '0px',
    paddingBottom: '0px',
    borderWidth: '0px'
  }))
]);

// --- Bausteine für die Filter-Animation ---
const FILTER_ENTER = transition(':enter', [
  style({ opacity: 0, transform: 'translateY(-10px)' }),
  animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
]);

const FILTER_LEAVE = transition(':leave', [
  animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(10px)' }))
]);


// =========================================================================
// 🚀 DIE HAUPT-TRIGGER (Diese exportieren wir, um sie in Komponenten zu nutzen)
// =========================================================================

export const TO_DO_ANIMATION = trigger('todoAnimation', [
  ENTER_TRANSITION,
  LEAVE_TRANSITION
]);

export const FILTER_ANIMATION = trigger('filterAnimation', [
  FILTER_ENTER,
  FILTER_LEAVE
]);