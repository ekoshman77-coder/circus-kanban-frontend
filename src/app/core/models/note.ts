import { generateLocalId } from "../shared/constants/id-const";
import { DomainModel } from "./domain-model";

export class Note implements DomainModel< Note > {
    id: string;
    userId: string;
    title: string;
    content: string;
    colorType: string;
    tag?: string;
    departmentId?: string;
    isInCalculation?: boolean;
    temperature?: number;
    weatherCode?: number;
    scope: string;
    
    constructor(init: {
        title: string, 
        content: string, 
        colorType: string, 
        userId: string,
        tag?: string | null, 
        id?: string | null,
        isInCalculation?: boolean,
        departmentId?: string,
        temperature?: number | null;
        weatherCode?: number | null;
        scope?: string; 
    }) {
        this.userId = init.userId ?? "";
        this.title = init.title;
        this.content = init.content;
        this.id = init.id ?? generateLocalId();
        this.colorType = init.colorType;
        this.tag = init.tag ?? ""; 
        this.departmentId = init.departmentId;
        this.isInCalculation = init.isInCalculation ?? false;
        this.temperature = init.temperature ?? undefined;
        this.weatherCode = init.weatherCode ?? undefined;
        this.scope = init.scope ?? 'DEPARTMENT';
    }

    public cloneWith(changes: Partial< Note >): Note {
        return new Note({
            id: changes.id ?? this.id,
            userId: changes.userId ?? this.userId,
            title: changes.title ?? this.title,
            content: changes.content ?? this.content,
            colorType: changes.colorType ?? this.colorType,
            tag: changes.tag !== undefined ? changes.tag : this.tag,
            departmentId: changes.departmentId !== undefined ? changes.departmentId : this.departmentId,
            isInCalculation: changes.isInCalculation !== undefined ? changes.isInCalculation : this.isInCalculation,
            temperature: changes.temperature !== undefined ? changes.temperature : this.temperature,
            weatherCode: changes.weatherCode !== undefined ? changes.weatherCode : this.weatherCode,
            scope: changes.scope ?? this.scope
        });
    }

    public static fromJson(json: any): Note {
        return new Note({
            id: json.id,
            userId: json.userId,
            title: json.title,
            content: json.content,
            colorType: json.colorType,
            tag: json.tag,
            departmentId: json.departmentId,
            isInCalculation: json.isInCalculation,
            temperature: json.temperature,
            weatherCode: json.weatherCode,
            scope: json.scope
        });
    }

    public toJson(): any {
        return {
            id: this.id,
            userId: this.userId,
            title: this.title,
            content: this.content,
            colorType: this.colorType,
            tag: this.tag,
            departmentId: this.departmentId,
            isInCalculation: this.isInCalculation,
            temperature: this.temperature,
            weatherCode: this.weatherCode,
            scope: this.scope
        };
    }
}