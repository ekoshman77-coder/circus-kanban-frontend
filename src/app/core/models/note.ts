// 🟢 Das absolut minimale, saubere Business-Modell für dein Kotlin-Backend!

import { INoteJson } from "../repositories/dto/note-json";
import { generateLocalId } from "../shared/constants/id-const";

export class Note {
    id?: string;
    userId: string;
    title: string;
    content: string;
    colorType: string;
    tag?: string;
    isInCalculation?: boolean;
    temperature?: number;
    weatherCode?: number;
    
    constructor(init: {
        title: string, 
        content: string, 
        colorType: string, 
        userId: string,
        tag?: string | null, 
        id?: string | null,
        isInCalculation?: boolean,
        temperature?: number | null;
        weatherCode?: number | null;
    }) {
        this.userId = init.userId?? ""
        this.title = init.title
        this.content = init.content
        this.id = init.id?? generateLocalId()
        this.colorType = init.colorType
        this.tag = init.tag?? "" 
        this.isInCalculation = init.isInCalculation?? false
        this.temperature = init.temperature?? undefined
        this.weatherCode = init.weatherCode?? undefined
    }
}