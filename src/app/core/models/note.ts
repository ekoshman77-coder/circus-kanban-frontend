// 🟢 Das absolut minimale, saubere Business-Modell für dein Kotlin-Backend!

import { INoteJson } from "../repositories/dto/note-json";

export class Note implements INoteJson {
    id?: string;
    userId: string;
    title: string;
    content: string;
    colorType: string;
    tag?: string;
    isInCalculation?: boolean;
    
    constructor(init: {
        title: string, 
        content: string, 
        colorType: string, 
        userId: string,
        tag?: string | null, 
        id?: string | null,
        isInCalculation?: boolean
    }) {
        this.userId = init.userId?? ""
        this.title = init.title
        this.content = init.content
        this.id = init.id?? String(Date.now() + Math.floor(Math.random() * 1000));
        this.colorType = init.colorType
        this.tag = init.tag?? "" 
        this.isInCalculation = init.isInCalculation?? false
    }
}