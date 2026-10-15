import { ProjectMember } from '../../models/project-member';
import { ArrayStateProvider } from '../central-queue/state-providers/array-state-provider';
import { TeamAction } from '../../models/queue-items/member-queue-payload';

export class TeamStateProvider extends ArrayStateProvider< ProjectMember > {
    protected override storageKey = 'offline_global_members';

    // 🎯 Registriert ProjectMember für automatische Snapshot/Cache-Deserialisierung
    protected modelStatic = ProjectMember;

    constructor() {
        super([]);
    }

    // 🛡️ Standardisierte Schnittstelle der Basisklasse
    public override applyActionPayload(action: string, payload: any): void {
        switch (action as TeamAction | 'SET_MEMBERS') {
            case 'SET_MEMBERS': {
                const members = Array.isArray(payload?.members)
                    ? payload.members.map((m: any) => (m instanceof ProjectMember ? m : ProjectMember.fromJson(m)))
                    : [];
                this.setRawState(members);
                break;
            }
            case 'CREATE_MEMBER': {
                if (payload?.member) {
                    const newMember = payload.member instanceof ProjectMember ? payload.member : ProjectMember.fromJson(payload.member);
                    this.addOrUpdateItem(newMember);
                }
                break;
            }
            case 'UPDATE_PROFILE': {
                if (payload?.id && payload?.updatedUser) {
                    this.applyAction((items) =>
                        items.map((m) => 
                            m.user.id === payload.id 
                                ? m.cloneWith({ user: payload.updatedUser }) 
                                : m
                        )
                    );
                }
                break;
            }
            case 'UPDATE_COFFEE': {
                if (payload?.id) {
                    this.applyAction((items) =>
                        items.map((m) => {
                            if (m.user.id === payload.id) {
                                // 🛡️ Prototyp-sicheres Klonen über cloneWith
                                const updatedUser = m.user.cloneWith({
                                    coffeeAccount: {
                                        balance: payload.balance,
                                        role: payload.role,
                                        emoji: payload.emoji
                                    }
                                });
                                return m.cloneWith({ user: updatedUser });
                            }
                            return m;
                        })
                    );
                }
                break;
            }
            case 'DELETE_MEMBER': {
                if (payload?.id) {
                    this.removeItemById(payload.id);
                }
                break;
            }
        }
    }
}