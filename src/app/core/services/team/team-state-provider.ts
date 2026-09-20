import { ProjectMember } from '../../models/project-member';
import { IProjectMemberJSON } from '../../repositories/dto/project-member-json';
import { ArrayStateProvider } from '../central-queue/state-providers/array-state-provider';
import { TeamAction } from '../../models/queue-items/member-queue-payload';

export class TeamStateProvider extends ArrayStateProvider<ProjectMember> {
    protected storageKey = 'offline_global_members';

    constructor() {
        super([]);
    }

    public override loadFromCache(): void {
        const cached = this.localStorageService.getItem<IProjectMemberJSON[]>(this.storageKey);
        if (cached && Array.isArray(cached)) {
            const restored = cached.map((m) => ProjectMember.fromJson(m));
            this.setRawState(restored);
        }
    }

    // 🛡️ standardisierte Schnittstelle der Basisklasse
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
                        items.map((m) => (m.user.id === payload.id ? new ProjectMember(payload.updatedUser, m.projectRole) : m))
                    );
                }
                break;
            }
            case 'UPDATE_COFFEE': {
                if (payload?.id) {
                    this.applyAction((items) =>
                        items.map((m) => {
                            if (m.user.id === payload.id) {
                                // Erstelle eine frische UserModel-Instanz oder weise ein neues Objekt zu
                                m.user.coffeeAccount = {
                                    balance: payload.balance,
                                    role: payload.role,
                                    emoji: payload.emoji
                                };
                                return new ProjectMember(m.user, m.projectRole);
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

    public override restoreFromSnapshot(snapshot: unknown): void {
        if (Array.isArray(snapshot)) {
            const restored = (snapshot as IProjectMemberJSON[]).map((m) => ProjectMember.fromJson(m));
            this.setRawState(restored);
        }
    }
}