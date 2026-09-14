// 🟢 Das absolut minimale, saubere Business-Modell für dein Kotlin-Backend!

import { INoteJson } from "../repositories/dto/note-json";
import { generateLocalId } from "../shared/constants/id-const";

export class Note {
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
        this.userId = init.userId?? ""
        this.title = init.title
        this.content = init.content
        this.id = init.id?? generateLocalId()
        this.colorType = init.colorType
        this.tag = init.tag?? "" 
        this.departmentId = init.departmentId
        this.isInCalculation = init.isInCalculation?? false
        this.temperature = init.temperature?? undefined
        this.weatherCode = init.weatherCode?? undefined
        this.scope = init.scope?? 'DEPARTMENT'
    }

    /**
   * 📥 Erzeugt eine echte Note-Instanz aus dem JSON/Plain-Objekt der Queue
   */
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

  /**
   * 📤 Erzeugt ein fahrbereites JSON-Objekt für den LocalStorage / QueuePayload
   */
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
